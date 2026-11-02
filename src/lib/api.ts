// Reads Northstar's ops feed. Every response is checked field by field before the app sees it,
// so a changed or broken feed becomes a clear error instead of a wrong number. The runs are checked
// against the feed's own description of its workflow: an undescribed job or flag is an error. AI calls are
// checked the same way against the AI feed's description: an undescribed outcome is an error.
import { feedReachable } from './origin';
import { parseInstant } from './time';
import {
  EVENT_TYPES, JOB_STATUSES, RESULT_OUTCOMES,
  type AiCall, type AiDescription, type AiOutcomeSpec, type AiPage, type ErrorSpec, type ModelPrice, type FlagSpec, type ResultSpec, type Run, type RunEvent, type RunsPage,
  type Step, type StepSpec, type Workflow,
} from './types';

export const API_BASE = 'https://northstar-digital-api.onrender.com';
/**
 * Where requests go. Under `npm run dev` they stay same-origin and Vite proxies them to Render
 * (vite.config.ts), because Northstar's CORS allows only the deployed origin. Tests and builds
 * call Render directly.
 */
const FEED_BASE = import.meta.env.MODE === 'development' ? '' : API_BASE;
/** Whether this page can read the feed at all (7.2a). Outside a browser (tests, scripts) there's no origin to refuse. */
const REACHABLE = typeof window === 'undefined' || feedReachable(window.location.origin, import.meta.env.MODE === 'development');
export const RUNS_MAX_LIMIT = 500;
export const AI_MAX_LIMIT = 2000;

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * rate_limited: 429 · unavailable: 503 (store down) · http: any other non-2xx · network: no response · shape: unexpected
 * body · refused: never sent, because this page's origin can't read the feed (a preview; origin.ts)
 */
export type ApiErrorKind = 'rate_limited' | 'unavailable' | 'http' | 'network' | 'shape' | 'refused';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  /** From the Retry-After header, in seconds, when the server sent one. */
  readonly retryAfterS: number | null;

  constructor(kind: ApiErrorKind, message: string, status: number | null = null, retryAfterS: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.retryAfterS = retryAfterS;
  }
}

// ----- urls -----

function feedUrl(path: string, since: string | null, limit: number, max: number): string {
  if (!Number.isInteger(limit) || limit < 1 || limit > max) throw new RangeError(`limit must be 1–${max}`);
  const query = `limit=${limit}` + (since === null ? '' : `&since=${encodeURIComponent(since)}`);
  return `${FEED_BASE}${path}?${query}`;
}

export const runsUrl = (since: string | null, limit = RUNS_MAX_LIMIT) =>
  feedUrl('/api/ops/runs', since, limit, RUNS_MAX_LIMIT);

export const aiUrl = (since: string | null, limit = AI_MAX_LIMIT) =>
  feedUrl('/api/ops/ai', since, limit, AI_MAX_LIMIT);

// ----- shape checks -----

type Obj = Record<string, unknown>;

const bad = (path: string, expected: string): never => {
  throw new ApiError('shape', `unexpected feed data at ${path}: expected ${expected}`);
};

function object(v: unknown, path: string): Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : bad(path, 'an object');
}

function array(v: unknown, path: string): unknown[] {
  return Array.isArray(v) ? v : bad(path, 'an array');
}

function string(o: Obj, key: string, path: string): string {
  const v = o[key];
  return typeof v === 'string' ? v : bad(`${path}.${key}`, 'a string');
}

function nullableString(o: Obj, key: string, path: string): string | null {
  const v = o[key];
  return v === null || typeof v === 'string' ? v : bad(`${path}.${key}`, 'a string or null');
}

function boolean(o: Obj, key: string, path: string): boolean {
  const v = o[key];
  return typeof v === 'boolean' ? v : bad(`${path}.${key}`, 'true or false');
}

function count(o: Obj, key: string, path: string): number {
  const v = o[key];
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : bad(`${path}.${key}`, 'a whole number ≥ 0');
}

function time(o: Obj, key: string, path: string): string {
  const v = string(o, key, path);
  try {
    parseInstant(v);
  } catch {
    bad(`${path}.${key}`, 'an ISO 8601 time with a timezone');
  }
  return v;
}

function oneOf<T extends string>(o: Obj, key: string, path: string, allowed: readonly T[]): T {
  const v = o[key];
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : bad(`${path}.${key}`, allowed.join(' | '));
}

function text(o: Obj, key: string, path: string, max: number): string {
  const v = string(o, key, path);
  return v.trim().length >= 1 && v.length <= max ? v : bad(`${path}.${key}`, `text of 1–${max} characters`);
}

function seconds(v: unknown, path: string): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : bad(path, 'a number of seconds ≥ 0');
}

/** Workflow versions this NEXUS reads. */
export const WORKFLOW_VERSION = 1;
/** A job id as the description writes it; URL state checks `step=` against it too. */
export const JOB_KIND = /^[a-z][a-z0-9_]{0,39}$/;
/** Limits on a description; the connect page quotes these, so they're exported. */
export const MAX_STEPS = 8;
export const MAX_TRIES = 10;
export const LABEL_MAX = 40;
export const PURPOSE_MAX = 140;
/** Result, error and flag labels may run a little longer than a job's label. */
const DETAIL_LABEL_MAX = 60;

function result(v: unknown, path: string): ResultSpec {
  const o = object(v, path);
  return { code: string(o, 'code', path), outcome: oneOf(o, 'outcome', path, RESULT_OUTCOMES), label: text(o, 'label', path, DETAIL_LABEL_MAX) };
}

function stepSpec(v: unknown, path: string): StepSpec {
  const o = object(v, path);
  const kind = string(o, 'kind', path);
  if (!JOB_KIND.test(kind)) bad(`${path}.kind`, 'a job id (lowercase letters, digits and _)');
  const delivers = o.delivers === null ? null : text(o, 'delivers', path, LABEL_MAX);
  const maxAttempts = count(o, 'max_attempts', path);
  if (maxAttempts < 1 || maxAttempts > MAX_TRIES) bad(`${path}.max_attempts`, `a whole number 1–${MAX_TRIES}`);
  return {
    kind,
    label: text(o, 'label', path, LABEL_MAX),
    purpose: text(o, 'purpose', path, PURPOSE_MAX),
    delivers,
    always_simulated: boolean(o, 'always_simulated', path),
    starts_after_s: seconds(o.starts_after_s, `${path}.starts_after_s`),
    max_attempts: maxAttempts,
    backoff_s: array(o.backoff_s, `${path}.backoff_s`).map((s, i) => seconds(s, `${path}.backoff_s[${i}]`)),
    results: array(o.results, `${path}.results`).map((r, i) => result(r, `${path}.results[${i}]`)),
  };
}

function errorSpec(v: unknown, path: string): ErrorSpec {
  const o = object(v, path);
  return { code: string(o, 'code', path), label: text(o, 'label', path, DETAIL_LABEL_MAX), sends_nothing: boolean(o, 'sends_nothing', path) };
}

function flagSpec(v: unknown, path: string): FlagSpec {
  const o = object(v, path);
  return { key: string(o, 'key', path), label: text(o, 'label', path, LABEL_MAX), effect: text(o, 'effect', path, PURPOSE_MAX) };
}

export function parseWorkflow(v: unknown, path = 'workflow'): Workflow {
  const o = object(v, path);
  if (o.version !== WORKFLOW_VERSION) {
    throw new ApiError('shape', `this feed describes workflow version ${String(o.version)}; NEXUS reads version ${WORKFLOW_VERSION}`);
  }
  const trigger = object(o.trigger, `${path}.trigger`);
  const steps = array(o.steps, `${path}.steps`).map((s, i) => stepSpec(s, `${path}.steps[${i}]`));
  if (steps.length < 1 || steps.length > MAX_STEPS) bad(`${path}.steps`, `1–${MAX_STEPS} jobs`);
  if (new Set(steps.map((s) => s.kind)).size !== steps.length) bad(`${path}.steps`, 'each job described once');
  return {
    version: WORKFLOW_VERSION,
    trigger: { one: text(trigger, 'one', `${path}.trigger`, 40), many: text(trigger, 'many', `${path}.trigger`, 40) },
    steps,
    errors: array(o.errors, `${path}.errors`).map((e, i) => errorSpec(e, `${path}.errors[${i}]`)),
    flags: array(o.flags, `${path}.flags`).map((f, i) => flagSpec(f, `${path}.flags[${i}]`)),
  };
}

function kindIn(o: Obj, path: string, kinds: readonly string[]): string {
  const v = o.kind;
  return typeof v === 'string' && kinds.includes(v) ? v : bad(`${path}.kind`, `a described job (${kinds.join(' | ')})`);
}

function step(v: unknown, path: string, kinds: readonly string[]): Step {
  const o = object(v, path);
  return {
    kind: kindIn(o, path, kinds),
    status: oneOf(o, 'status', path, JOB_STATUSES),
    attempts: count(o, 'attempts', path),
    max_attempts: count(o, 'max_attempts', path),
    run_after: time(o, 'run_after', path),
    result: nullableString(o, 'result', path),
    last_error: nullableString(o, 'last_error', path),
    updated_at: time(o, 'updated_at', path),
  };
}

function event(v: unknown, path: string, kinds: readonly string[]): RunEvent {
  const o = object(v, path);
  return {
    kind: kindIn(o, path, kinds),
    event: oneOf(o, 'event', path, EVENT_TYPES),
    attempt: count(o, 'attempt', path),
    detail: nullableString(o, 'detail', path),
    at: time(o, 'at', path),
  };
}

export const RUN_ID = /^r_[0-9a-f]{12}$/;

function run(v: unknown, path: string, wf: Workflow): Run {
  const o = object(v, path);
  const id = string(o, 'run_id', path);
  if (!RUN_ID.test(id)) bad(`${path}.run_id`, 'an opaque id (r_ + 12 hex)');
  const kinds = wf.steps.map((s) => s.kind);
  const keys = wf.flags.map((f) => f.key);
  const flags = array(o.flags, `${path}.flags`).map((f, i) =>
    typeof f === 'string' && keys.includes(f) ? f : bad(`${path}.flags[${i}]`, `a described flag (${keys.join(' | ') || 'none described'})`));
  return {
    run_id: id,
    created_at: time(o, 'created_at', path),
    flags,
    steps: array(o.steps, `${path}.steps`).map((s, i) => step(s, `${path}.steps[${i}]`, kinds)),
    events: array(o.events, `${path}.events`).map((e, i) => event(e, `${path}.events[${i}]`, kinds)),
  };
}

/** AI description versions this NEXUS reads. */
export const AI_VERSION = 1;
/** Limits on the AI description; the connect page quotes these. */
export const MAX_OUTCOMES = 8;
export const MAX_MODELS = 20;
export const MODEL_MAX = 80;
const SOURCE_MAX = 200;
const OUTCOME_CODE = /^[a-z][a-z0-9_]{0,39}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function nullableCount(o: Obj, key: string, path: string): number | null {
  const v = o[key];
  return v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0) ? v : bad(`${path}.${key}`, 'a whole number ≥ 0, or null');
}

function usd(o: Obj, key: string, path: string): number {
  const v = o[key];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : bad(`${path}.${key}`, 'US dollars per 1M tokens, ≥ 0');
}

function outcomeSpec(v: unknown, path: string): AiOutcomeSpec {
  const o = object(v, path);
  const code = string(o, 'code', path);
  if (!OUTCOME_CODE.test(code)) bad(`${path}.code`, 'lowercase letters, digits and _, up to 40 characters');
  return { code, label: text(o, 'label', path, LABEL_MAX), answered: boolean(o, 'answered', path) };
}

function modelPrice(v: unknown, path: string): ModelPrice {
  const o = object(v, path);
  const pricedOn = nullableString(o, 'priced_on', path);
  if (pricedOn !== null && !DAY_RE.test(pricedOn)) bad(`${path}.priced_on`, 'a day as YYYY-MM-DD, or null');
  return {
    name: text(o, 'name', path, MODEL_MAX),
    usd_per_m_in: usd(o, 'usd_per_m_in', path),
    usd_per_m_out: usd(o, 'usd_per_m_out', path),
    priced_on: pricedOn,
    source: text(o, 'source', path, SOURCE_MAX),
  };
}

export function parseAiDescription(v: unknown, path = 'ai'): AiDescription {
  const o = object(v, path);
  if (o.version !== AI_VERSION) {
    throw new ApiError('shape', `this feed describes AI version ${String(o.version)}; NEXUS reads version ${AI_VERSION}`);
  }
  const noun = object(o.call, `${path}.call`);
  const outcomes = array(o.outcomes, `${path}.outcomes`).map((x, i) => outcomeSpec(x, `${path}.outcomes[${i}]`));
  if (outcomes.length < 1 || outcomes.length > MAX_OUTCOMES) bad(`${path}.outcomes`, `1–${MAX_OUTCOMES} outcomes`);
  if (new Set(outcomes.map((x) => x.code)).size !== outcomes.length) bad(`${path}.outcomes`, 'each outcome described once');
  if (!outcomes.some((x) => x.answered)) bad(`${path}.outcomes`, 'at least one outcome that answered');
  const retention = count(o, 'retention_days', path);
  if (retention < 1) bad(`${path}.retention_days`, 'a whole number of days ≥ 1');
  const models = array(o.models, `${path}.models`).map((x, i) => modelPrice(x, `${path}.models[${i}]`));
  if (models.length > MAX_MODELS) bad(`${path}.models`, `at most ${MAX_MODELS} models`);
  if (new Set(models.map((m) => m.name)).size !== models.length) bad(`${path}.models`, 'each model priced once');
  return {
    version: AI_VERSION,
    call: { one: text(noun, 'one', `${path}.call`, 40), many: text(noun, 'many', `${path}.call`, 40) },
    outcomes,
    timeout_s: seconds(o.timeout_s, `${path}.timeout_s`),
    retention_days: retention,
    models,
  };
}

function call(v: unknown, path: string, codes: readonly string[]): AiCall {
  const o = object(v, path);
  return {
    at: time(o, 'at', path),
    model: text(o, 'model', path, MODEL_MAX),
    tokens_in: nullableCount(o, 'tokens_in', path),
    tokens_out: nullableCount(o, 'tokens_out', path),
    latency_ms: count(o, 'latency_ms', path),
    outcome: oneOf(o, 'outcome', path, codes),
  };
}

export function parseRunsPage(v: unknown): RunsPage {
  const o = object(v, 'page');
  const wf = parseWorkflow(o.workflow);
  return {
    now: time(o, 'now', 'page'),
    truncated: boolean(o, 'truncated', 'page'),
    workflow: wf,
    runs: array(o.runs, 'runs').map((r, i) => run(r, `runs[${i}]`, wf)),
  };
}

export function parseAiPage(v: unknown): AiPage {
  const o = object(v, 'page');
  const ai = parseAiDescription(o.ai);
  const codes = ai.outcomes.map((x) => x.code);
  return {
    now: time(o, 'now', 'page'),
    truncated: boolean(o, 'truncated', 'page'),
    ai,
    calls: array(o.calls, 'calls').map((c, i) => call(c, `calls[${i}]`, codes)),
  };
}

// ----- fetching -----

function retryAfter(res: Response): number | null {
  const v = res.headers.get('Retry-After');
  return v !== null && /^\d+$/.test(v.trim()) ? Number(v.trim()) : null;
}

async function getJson(url: string, fetchFn: FetchFn, signal: AbortSignal | undefined, reachable: boolean): Promise<unknown> {
  // A preview: Northstar would do the work and the browser would drop the answer, so nothing is sent (7.2a).
  if (!reachable) throw new ApiError('refused', 'this page can\'t read the Northstar feed (only the production site can)');
  let res: Response;
  try {
    res = await fetchFn(url, signal ? { signal } : undefined);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError('network', 'the Northstar API could not be reached');
  }
  if (res.status === 429) throw new ApiError('rate_limited', 'too many requests', 429, retryAfter(res));
  if (res.status === 503) throw new ApiError('unavailable', 'the Northstar API is unavailable', 503, retryAfter(res));
  if (!res.ok) throw new ApiError('http', `the Northstar API answered ${res.status}`, res.status);
  try {
    return await res.json();
  } catch {
    throw new ApiError('shape', 'the Northstar API answered with something other than JSON', res.status);
  }
}

export interface FetchOptions {
  /** ISO 8601 lower bound on created_at (runs) or at (AI calls); null for everything. */
  since: string | null;
  limit?: number;
  signal?: AbortSignal;
  fetchFn?: FetchFn;
  /** Whether this page's origin can read the feed; false sends nothing (default: this page's, origin.ts). */
  reachable?: boolean;
}

const defaultFetch: FetchFn = (url, init) => fetch(url, init);

export async function fetchRuns({ since, limit, signal, fetchFn = defaultFetch, reachable = REACHABLE }: FetchOptions): Promise<RunsPage> {
  return parseRunsPage(await getJson(runsUrl(since, limit), fetchFn, signal, reachable));
}

export async function fetchAi({ since, limit, signal, fetchFn = defaultFetch, reachable = REACHABLE }: FetchOptions): Promise<AiPage> {
  return parseAiPage(await getJson(aiUrl(since, limit), fetchFn, signal, reachable));
}

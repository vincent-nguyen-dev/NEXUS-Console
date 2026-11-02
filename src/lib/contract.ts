// The feed contract as the /connect page shows it. Every field here is checked against the parser in
// contract.test.ts (remove a required one from the real recording and the parser must name it), so the page
// can't promise what NEXUS doesn't accept. Codes and field names are kept apart from prose: the page renders
// them as code, and the prose keeps to the vocabulary ("try", "gave up", "job").
import {
  AI_MAX_LIMIT, AI_VERSION, LABEL_MAX, MAX_MODELS, MAX_OUTCOMES, MAX_STEPS, MAX_TRIES, MODEL_MAX, PURPOSE_MAX, RUNS_MAX_LIMIT,
  WORKFLOW_VERSION,
} from './api';
import { FETCH_TIMEOUT_MS, POLL_MS } from './pollPolicy';
import { replayModel } from './replay';
import { EVENT_TYPES, JOB_STATUSES, RESULT_OUTCOMES, type Run, type RunEvent, type Workflow } from './types';
import { primaryStep } from './workflow';

/** A field of one object in the feed. */
export interface FieldDoc {
  key: string;
  type: string;
  /** The allowed codes, shown as code. */
  values?: readonly string[];
  rule: string;
  /** Where the parser says a missing one is (contract.test checks it). */
  errorPath: string;
}

export interface FieldGroup {
  id: string;
  title: string;
  /** Where the group's first instance sits in a page, e.g. "runs[0].events[0]". */
  at: string;
  fields: FieldDoc[];
}

const f = (base: string) => (key: string, type: string, rule: string, values?: readonly string[]): FieldDoc =>
  ({ key, type, rule, errorPath: base === '' ? key : `${base}.${key}`, ...(values ? { values } : {}) });

const page = f('page');
const top = f('');
const wf = f('workflow');
const trig = f('workflow.trigger');
const job = f('workflow.steps[0]');
const res = f('workflow.steps[0].results[0]');
const err = f('workflow.errors[0]');
const flag = f('workflow.flags[0]');
const run = f('runs[0]');
const state = f('runs[0].steps[0]');
const ev = f('runs[0].events[0]');

export const LIMITS = {
  runs: RUNS_MAX_LIMIT, jobs: MAX_STEPS, tries: MAX_TRIES, label: LABEL_MAX, purpose: PURPOSE_MAX,
  version: WORKFLOW_VERSION, pollS: POLL_MS / 1000, waitS: FETCH_TIMEOUT_MS / 1000,
} as const;

export const FIELD_GROUPS: FieldGroup[] = [
  {
    id: 'page', title: 'The answer', at: '',
    fields: [
      page('now', 'time', 'Your clock when you answered. NEXUS measures every "ago" from it, so a wrong visitor clock changes nothing.'),
      page('truncated', 'true or false', `True when more runs match than you sent (at most ${RUNS_MAX_LIMIT} per answer).`),
      top('workflow', 'object', 'The description of your jobs, below.'),
      top('runs', 'list', 'One entry per run, newest first.'),
    ],
  },
  {
    id: 'workflow', title: 'The workflow', at: 'workflow',
    fields: [
      wf('version', 'number', `Always ${WORKFLOW_VERSION}. Any other number is refused with a message saying so.`),
      wf('trigger', 'object', 'What starts a run, as two words.'),
      wf('steps', 'list', `The jobs every run gets, 1 to ${MAX_STEPS}, each described once, in the order they're drawn.`),
      wf('errors', 'list', 'The error codes your jobs report, in words. May be empty.'),
      wf('flags', 'list', 'Switches a run can carry, such as a test outage. May be empty.'),
    ],
  },
  {
    id: 'trigger', title: 'What starts a run', at: 'workflow.trigger',
    fields: [
      trig('one', 'text', `The noun for one, as a sentence uses it ("enquiry", "order"). Up to ${LABEL_MAX} characters.`),
      trig('many', 'text', 'The plural ("enquiries", "orders").'),
    ],
  },
  {
    id: 'job', title: 'One job, described', at: 'workflow.steps[0]',
    fields: [
      job('kind', 'id', 'Your id for the job: lowercase letters, digits and _, up to 40 characters. Runs refer to it.'),
      job('label', 'text', `Its name on the map, up to ${LABEL_MAX} characters.`),
      job('purpose', 'text', `What it's for, one sentence, up to ${PURPOSE_MAX} characters.`),
      job('delivers', 'text or null', 'What it sends to a person ("email", "payment"), or null for a job that sends nothing. The rates are about jobs that deliver.'),
      job('always_simulated', 'true or false', 'True for a stand-in that never really sends. NEXUS keeps it out of the delivery rates.'),
      job('starts_after_s', 'seconds', "When it's due after the run starts: 0 runs at once; more is scheduled for later and left out of completion time."),
      job('max_attempts', 'whole number', `Tries allowed, 1 to ${MAX_TRIES}. More is refused: the whole answer, not just the job.`),
      job('backoff_s', 'list of seconds', 'The planned wait after each failed try, in order.'),
      job('results', 'list', 'What each result code means. A code you leave out still shows, as itself.'),
    ],
  },
  {
    id: 'result', title: 'A result code', at: 'workflow.steps[0].results[0]',
    fields: [
      res('code', 'text', 'The code a success records, exactly as the events carry it.'),
      res('outcome', 'one of', 'Delivered really reached someone; simulated and skipped sent nothing; done is a job that delivers nothing.', RESULT_OUTCOMES),
      res('label', 'text', 'In words, lowercase ("email sent").'),
    ],
  },
  {
    id: 'error', title: 'An error code', at: 'workflow.errors[0]',
    fields: [
      err('code', 'text', 'A short code your jobs record when a try fails. Never exception text.'),
      err('label', 'text', 'In words ("simulated outage").'),
      err('sends_nothing', 'true or false', 'True only when a try that failed this way never reached the outside service. NEXUS then says "so nothing was sent".'),
    ],
  },
  {
    id: 'flag', title: 'A switch', at: 'workflow.flags[0]',
    fields: [
      flag('key', 'text', 'The key runs list when it was on.'),
      flag('label', 'text', 'Its name ("Outage switch").'),
      flag('effect', 'text', 'What it does, lowercase, as a sentence ends ("fails team notification tries 1 and 2 on purpose").'),
    ],
  },
  {
    id: 'run', title: 'A run', at: 'runs[0]',
    fields: [
      run('run_id', 'id', 'Opaque: r_ and 12 hex characters. Make it from your own row id with an HMAC (a keyed fingerprint), so it can\'t be traced back to a customer.'),
      run('created_at', 'time', 'When the run started. Windows, "newest" and every offset count from it.'),
      run('flags', 'list', 'The keys of the switches that were on. Each must be in the workflow\'s flags.'),
      run('steps', 'list', 'Each job\'s current state, one per job.'),
      run('events', 'list', 'Every change, in the order it happened.'),
    ],
  },
  {
    id: 'state', title: 'A job\'s current state', at: 'runs[0].steps[0]',
    fields: [
      state('kind', 'id', 'One of the workflow\'s jobs.'),
      state('status', 'one of', 'Where the job is now.', JOB_STATUSES),
      state('attempts', 'whole number', 'Tries started so far.'),
      state('max_attempts', 'whole number', 'Tries allowed for this job.'),
      state('run_after', 'time', 'When it is (or was) due.'),
      state('result', 'text or null', 'The result code of a success, else null.'),
      state('last_error', 'text or null', 'The last error code, else null.'),
      state('updated_at', 'time', 'When this row last changed.'),
    ],
  },
  {
    id: 'event', title: 'An event', at: 'runs[0].events[0]',
    fields: [
      ev('kind', 'id', 'Which job it belongs to.'),
      ev('event', 'one of', 'What happened.', EVENT_TYPES),
      ev('attempt', 'whole number', 'The try it belongs to: 1 for the first, 0 when queued.'),
      ev('detail', 'text or null', 'The result code of a success, the error code of a failure, the planned wait in seconds of a retry plan, or why a job gave up.'),
      ev('at', 'time', 'When it happened.'),
    ],
  },
];

// ----- the AI feed (optional, phase 6.1) -----

const aiPage = f('page');
const aiTop = f('');
const ai = f('ai');
const noun = f('ai.call');
const outcome = f('ai.outcomes[0]');
const model = f('ai.models[0]');
const aiCall = f('calls[0]');

export const AI_LIMITS = {
  calls: AI_MAX_LIMIT, outcomes: MAX_OUTCOMES, models: MAX_MODELS, model: MODEL_MAX, label: LABEL_MAX, version: AI_VERSION,
} as const;

/** The optional second feed: one entry per question a model was asked to answer, with its own description. */
export const AI_FIELD_GROUPS: FieldGroup[] = [
  {
    id: 'ai-page', title: 'The AI answer', at: '',
    fields: [
      aiPage('now', 'time', 'Your clock when you answered, as for runs.'),
      aiPage('truncated', 'true or false', `True when more calls match than you sent (at most ${AI_MAX_LIMIT} per answer).`),
      aiTop('ai', 'object', 'The description of your calls, below. Without it the answer is refused.'),
      aiTop('calls', 'list', 'One entry per question your model was asked to answer, newest first. A request you turned away before calling the model is left out.'),
    ],
  },
  {
    id: 'ai', title: 'The AI description', at: 'ai',
    fields: [
      ai('version', 'number', `Always ${AI_VERSION}. Any other number is refused with a message saying so.`),
      ai('call', 'object', 'What one call is, as two words.'),
      ai('outcomes', 'list', `Every outcome code a call can record, 1 to ${MAX_OUTCOMES}, at least one of them answered.`),
      ai('timeout_s', 'seconds', 'How long a call may take before it counts as failed.'),
      ai('retention_days', 'whole number', 'How many days you keep calls. NEXUS says so when a window reaches further back.'),
      ai('models', 'list', `The list price of each model, up to ${MAX_MODELS}. A model left out shows as unpriced and stays out of the cost estimate.`),
    ],
  },
  {
    id: 'ai-call-noun', title: 'What one call is', at: 'ai.call',
    fields: [
      noun('one', 'text', `The noun for one, as a sentence uses it ("chat", "summary"). Up to ${LABEL_MAX} characters.`),
      noun('many', 'text', 'The plural ("chats", "summaries").'),
    ],
  },
  {
    id: 'ai-outcome', title: 'An outcome code', at: 'ai.outcomes[0]',
    fields: [
      outcome('code', 'id', 'The code your calls record: lowercase letters, digits and _, up to 40 characters. A call with a code not listed here is refused.'),
      outcome('label', 'text', 'In words, lowercase ("answered", "timed out").'),
      outcome('answered', 'true or false', 'True when the model answered. Only those calls are timed: a failed one\'s time is the time until it failed.'),
    ],
  },
  {
    id: 'ai-model', title: 'A model\'s price', at: 'ai.models[0]',
    fields: [
      model('name', 'text', `The model name, exactly as your calls record it, up to ${MODEL_MAX} characters.`),
      model('usd_per_m_in', 'number', 'US dollars per 1 million tokens sent to the model, at list price.'),
      model('usd_per_m_out', 'number', 'US dollars per 1 million tokens it sent back.'),
      model('priced_on', 'day or null', 'The day you read the price (YYYY-MM-DD), or null for one that costs nothing. NEXUS shows it beside the estimate.'),
      model('source', 'text', 'Where the price comes from: a link or a few words.'),
    ],
  },
  {
    id: 'ai-call', title: 'A call', at: 'calls[0]',
    fields: [
      aiCall('at', 'time', 'When the call was made. Windows count from it.'),
      aiCall('model', 'text', 'Which model answered (or was asked).'),
      aiCall('tokens_in', 'whole number or null', 'Tokens sent to the model, or null when it failed before answering.'),
      aiCall('tokens_out', 'whole number or null', 'Tokens it sent back, or null.'),
      aiCall('latency_ms', 'whole number', 'Milliseconds: the model\'s time for an answered call, the time until it failed otherwise.'),
      aiCall('outcome', 'id', 'One of the description\'s outcome codes.'),
    ],
  },
];

/** Every documented AI key, as a path pattern ("calls[].at"). */
export const aiDocumentedPaths = (): Set<string> =>
  new Set(AI_FIELD_GROUPS.flatMap((g) => g.fields.map((x) => `${g.at.replace(/\[0\]/g, '[]')}${g.at === '' ? '' : '.'}${x.key}`)));

/** The object at a path like "runs[0].events[0]" ("" is the page itself). */
export function objectAt(root: Record<string, unknown>, path: string): Record<string, unknown> | undefined {
  if (path === '') return root;
  let o: unknown = root;
  for (const part of path.split('.')) {
    const m = /^(\w+)\[(\d+)\]$/.exec(part);
    o = m ? ((o as Record<string, unknown[]>)[m[1] ?? ''] ?? [])[Number(m[2])] : (o as Record<string, unknown>)[part];
    if (o === null || typeof o !== 'object') return undefined;
  }
  return o as Record<string, unknown>;
}

/** Every documented key, as a path pattern ("runs[].events[].at"), for the drift test. */
export const documentedPaths = (): Set<string> =>
  new Set(FIELD_GROUPS.flatMap((g) => g.fields.map((x) => `${g.at.replace(/\[0\]/g, '[]')}${g.at === '' ? '' : '.'}${x.key}`)));

// ----- the example -----

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** Keeps only the documented keys, so a field NEXUS doesn't read never appears on the page as if it did. */
export function documentedOnly(value: Json, path = ''): Json {
  if (Array.isArray(value)) return value.map((v) => documentedOnly(v, `${path}[]`));
  if (value === null || typeof value !== 'object') return value;
  const known = documentedPaths();
  const out: { [k: string]: Json } = {};
  for (const [k, v] of Object.entries(value)) {
    const p = path === '' ? k : `${path}.${k}`;
    if (known.has(p)) out[k] = documentedOnly(v, p);
  }
  return out;
}

/** JSON for reading: nested objects indented, short objects in a list one per line. */
export function formatJson(value: Json, indent = 0): string {
  const pad = (n: number) => '  '.repeat(n);
  const flat = JSON.stringify(value);
  if (value === null || typeof value !== 'object') return flat;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((v) => {
      const one = JSON.stringify(v);
      return one.length <= 130 ? one : formatJson(v, indent + 1);
    });
    return `[\n${items.map((i) => `${pad(indent + 1)}${i}`).join(',\n')}\n${pad(indent)}]`;
  }
  if (flat.length <= 70) return flat;
  const entries = Object.entries(value).map(([k, v]) => `${pad(indent + 1)}${JSON.stringify(k)}: ${formatJson(v, indent + 1)}`);
  return `{\n${entries.join(',\n')}\n${pad(indent)}}`;
}

// ----- one try, traced -----

/** The primary job's first try in a run: its events, and the sentence the replay says for its failure. */
export function firstTryTrace(run: Run, wf: Workflow): { events: RunEvent[]; sentence: string | null } {
  const kind = primaryStep(wf);
  const events = run.events.filter((e) => e.kind === kind && e.attempt === 1);
  const failed = events.find((e) => e.event === 'failed');
  const moment = failed ? replayModel(run, wf).moments.find((m) => m.lane === 'team' && m.attempt === 1 && m.shape === 'retry') : undefined;
  return { events, sentence: moment?.text ?? null };
}

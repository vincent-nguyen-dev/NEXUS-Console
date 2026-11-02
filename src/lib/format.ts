// Numbers and events in plain language. The wording follows the project's honesty rules: what a
// result means (delivered, simulated, skipped) comes from the feed's description, never from its code.
import { parseInstant } from './time';
import type { EventType, Run, RunEvent, StepKind, Workflow } from './types';
import { errorOf, isScheduled, resultOf, stepLabel } from './workflow';

/** The first 4 hex characters of an opaque run id (`r_6d15828d95f5` → `6d15`). */
export const shortRunId = (runId: string): string => runId.replace(/^r_/, '').slice(0, 4);

/**
 * The shortest prefix (at least `min` hex) that tells each run apart from the others in the list.
 * Four hex alone isn't enough at scale: 500 runs share a 4-hex prefix with about 85% probability.
 */
export function uniquePrefixes(runIds: string[], min = 4): Map<string, string> {
  const hex = [...new Set(runIds)].map((id) => [id, id.replace(/^r_/, '')] as const);
  const out = new Map<string, string>();
  for (const [id, h] of hex) {
    let len = min;
    while (len < h.length && hex.some(([other, o]) => other !== id && o.startsWith(h.slice(0, len)))) len++;
    out.set(id, h.slice(0, len));
  }
  return out;
}

/** A measured duration: 0.1 s below a minute, then min/s, h/min, d/h. Rounded before choosing the unit. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError(`not a duration: ${seconds}`);
  const tenths = Math.round(seconds * 10);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)} s`;
  const secs = Math.round(seconds);
  if (secs < 3600) return `${Math.floor(secs / 60)} min ${secs % 60} s`;
  const mins = Math.round(seconds / 60);
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} h ${mins % 60} min`;
  const hours = Math.round(seconds / 3600);
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

/** A configured wait (whole seconds), written like the setting: `10 s`, `2 min`. */
export function formatPlanned(seconds: number): string {
  if (Number.isInteger(seconds) && seconds >= 0 && seconds < 60) return `${seconds} s`;
  if (Number.isInteger(seconds) && seconds % 60 === 0 && seconds < 3600) return `${seconds / 60} min`;
  return formatDuration(seconds);
}

/** A whole percent that never shows 0% or 100% unless it is exact. */
export function formatPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return '–';
  if (numerator === denominator) return '100%';
  if (numerator === 0) return '0%';
  const p = Math.round((numerator / denominator) * 100);
  return `${Math.min(99, Math.max(1, p))}%`;
}

/** A time after the lead, e.g. `+0.4 s`; earlier times (never expected) get a minus sign. */
export const formatOffset = (seconds: number): string =>
  seconds < 0 ? `−${formatDuration(-seconds)}` : `+${formatDuration(seconds)}`;

/** An error code in words, from the description ("simulated outage"), else the code itself. */
export const errorText = (wf: Workflow, code: string | null): string => errorOf(wf, code).label;

/** A success in one form: `{job} {verb} on try {n} ({what the result means})`. */
function succeededText(e: RunEvent, run: Run, wf: Workflow, label: string): string {
  const r = resultOf(wf, e.kind, e.detail);
  const failedBefore = run.events.some((f) => f.kind === e.kind && f.event === 'failed' && f.attempt < e.attempt);
  let verb = failedBefore ? 'recovered' : 'succeeded';
  if (r.outcome === 'simulated') verb = 'worked';
  else if (r.outcome === 'skipped') verb = 'skipped';
  const what = r.outcome === 'unknown' ? `result: ${e.detail ?? 'none'}` : r.label;
  return `${label} ${verb} on try ${e.attempt} (${what})`;
}

/** One event as a sentence, e.g. "Team notification recovered on try 3 (email sent)". */
export function describeEvent(e: RunEvent, run: Run, wf: Workflow): string {
  const label = stepLabel(wf, e.kind);
  switch (e.event) {
    case 'queued':
      return isScheduled(wf, e.kind) ? `${label} scheduled` : `${label} queued`;
    case 'started':
      return `${label} try ${e.attempt} started`;
    case 'failed':
      return `${label} failed on try ${e.attempt} (${errorText(wf, e.detail)})`;
    case 'retry_scheduled':
      return `${label} will retry in ${formatPlanned(Number(e.detail))}`;
    case 'succeeded':
      return succeededText(e, run, wf, label);
    case 'dead':
      return e.detail === 'lease_expired'
        ? `${label} gave up: try ${e.attempt} never reported back`
        : `${label} gave up after ${e.attempt} ${e.attempt === 1 ? 'try' : 'tries'}`;
  }
}

/** How long ago, coarse on purpose for a badge: `12 s`, `4 min`, `2 h 5 min`, `3 d`. Rounded down. */
export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 === 0 ? `${h} h` : `${h} h ${min % 60} min`;
  return `${Math.floor(h / 24)} d`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The UTC calendar day of a time, e.g. `22 Oct 2026`. UTC so every visitor reads the same day. */
export function formatUtcDay(iso: string): string {
  const d = new Date(parseInstant(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A UTC time to a tenth of a second, e.g. `22 Oct 2026 03:07:47.1`. Tenths are cut, not rounded,
 * as a clock shows them, so 59.96 s never reads as 60.0.
 */
export function formatUtcTime(iso: string): string {
  const tenths = Math.floor(parseInstant(iso) / 100);
  const d = new Date(Math.floor(tenths / 10) * 1000);
  const clock = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${((tenths % 10) + 10) % 10}`;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${clock}`;
}

/** A UTC day and minute for prose, e.g. `22 Oct, 03:07 UTC`. Minutes are cut, as a clock shows them. */
export function formatUtcMinute(iso: string): string {
  const d = new Date(Math.floor(parseInstant(iso) / 60_000) * 60_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/**
 * "4 min ago", measured on the server's clock: the server's time at the last answer, minus the
 * event's time, plus how long ago that answer came. A wrong client clock can't skew it.
 */
export const agoFromServer = (at: string, serverNow: string, ageMs: number): string =>
  `${formatAgo(parseInstant(serverNow) - parseInstant(at) + ageMs)} ago`;

/**
 * ok ✓ (really done or sent) · simulated ○ (finished, nothing sent) · retry ↻ (failed, will retry) · dead ✕ ·
 * noresult ◌ (a try that never reported back) · neutral • · lead ●: every status has a shape as well as a colour.
 */
export type Tone = 'ok' | 'simulated' | 'retry' | 'dead' | 'noresult' | 'neutral' | 'lead';

export function eventTone(e: Pick<RunEvent, 'kind' | 'event' | 'detail'>, wf: Workflow): Tone {
  switch (e.event) {
    case 'succeeded': {
      const outcome = resultOf(wf, e.kind, e.detail).outcome;
      if (outcome === 'skipped') return 'neutral';
      return outcome === 'simulated' ? 'simulated' : 'ok';
    }
    case 'failed':
    case 'retry_scheduled':
      return 'retry';
    case 'dead':
      return 'dead';
    default:
      return 'neutral';
  }
}

const EVENT_LABELS: Record<EventType, string> = {
  queued: 'Queued', started: 'Started', failed: 'Failed', retry_scheduled: 'Retry planned', succeeded: 'Succeeded', dead: 'Gave up',
};

/** The event column of the table. A job due later is queued for then, so it reads "Scheduled". */
export const eventLabel = (wf: Workflow, kind: StepKind, event: EventType): string =>
  isScheduled(wf, kind) && event === 'queued' ? 'Scheduled' : EVENT_LABELS[event];

/** The detail column: the code as the feed recorded it, and what the description says it means. */
export function eventDetail(wf: Workflow, kind: StepKind, event: EventType, detail: string | null): { code: string | null; gloss: string | null } {
  if (detail === null) return { code: null, gloss: null };
  if (event === 'retry_scheduled') return { code: null, gloss: `in ${formatPlanned(Number(detail))}` };
  if (event === 'failed') return { code: detail, gloss: errorText(wf, detail) };
  if (detail === 'lease_expired') return { code: detail, gloss: 'never reported back' };
  const r = resultOf(wf, kind, detail);
  return { code: detail, gloss: r.outcome === 'unknown' ? null : r.label };
}

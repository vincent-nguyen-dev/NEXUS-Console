// All view state lives in the URL query, so every screen can be shared and Back works.
// Unknown or invalid values fall back to the default instead of failing, and defaults are left
// out when writing, so the plain URL is the default view.
import { JOB_KIND, MAX_TRIES, RUN_ID } from './api';
import { DEFAULT_WINDOW, ORDERS, WINDOWS, type Order, type WindowKey } from './filters';
import { FLAG_FILTERS, type FlagFilter } from './flagFilter';
import { EVENT_TYPES, type EventType, type StepKind } from './types';

/** Views that exist. Each later step adds its own (retries in 07, ai in 09). */
export const VIEWS = ['overview', 'events', 'ai', 'retries'] as const;
export type View = (typeof VIEWS)[number];

export const MODES = ['live', 'guided', 'file'] as const;
export type Mode = (typeof MODES)[number];

/** The highest try a URL can select: the feed contract's limit (a job may allow up to 10 tries). */
export const MAX_ATTEMPT = MAX_TRIES;

export interface UrlState {
  view: View;
  mode: Mode;
  win: WindowKey;
  step: StepKind | null;
  /** Only meaningful with a step. */
  attempt: number | null;
  /** The events table's event filter. */
  event: EventType | null;
  /** The events table's sort. */
  order: Order;
  run: string | null;
  /** The test-switch filter: runs with a switch on, or with none. Null shows every run. */
  flags: FlagFilter | null;
}

export const DEFAULT_URL_STATE: UrlState = {
  view: 'overview', mode: 'live', win: DEFAULT_WINDOW, step: null, attempt: null, event: null, order: 'newest', run: null,
  flags: null,
};

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | null =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;

export function parseUrlState(search: string): UrlState {
  const q = new URLSearchParams(search);
  // Any well-formed job id: the data's description decides later whether it names a job (an unknown one selects nothing).
  const stepText = q.get('step');
  const step = stepText !== null && JOB_KIND.test(stepText) ? stepText : null;
  const attemptText = q.get('attempt');
  const attempt = step !== null && attemptText !== null && /^[1-9][0-9]?$/.test(attemptText) && Number(attemptText) <= MAX_ATTEMPT
    ? Number(attemptText)
    : null;
  const run = q.get('run');
  const mode = pick(q.get('mode'), MODES) ?? DEFAULT_URL_STATE.mode;
  return {
    view: pick(q.get('view'), VIEWS) ?? DEFAULT_URL_STATE.view,
    mode,
    win: pick(q.get('win'), WINDOWS) ?? DEFAULT_URL_STATE.win,
    step,
    attempt,
    event: pick(q.get('event'), EVENT_TYPES),
    order: pick(q.get('order'), ORDERS) ?? DEFAULT_URL_STATE.order,
    run: run !== null && RUN_ID.test(run) ? run : null,
    flags: pick(q.get('flags'), FLAG_FILTERS),
  };
}

/** `?key=value&…` in a fixed key order, or '' for the default state. */
export function serializeUrlState(s: UrlState): string {
  const q = new URLSearchParams();
  if (s.view !== DEFAULT_URL_STATE.view) q.set('view', s.view);
  if (s.mode !== DEFAULT_URL_STATE.mode) q.set('mode', s.mode);
  if (s.win !== DEFAULT_URL_STATE.win) q.set('win', s.win);
  if (s.step !== null) {
    q.set('step', s.step);
    if (s.attempt !== null) q.set('attempt', String(s.attempt));
  }
  if (s.event !== null) q.set('event', s.event);
  if (s.order !== DEFAULT_URL_STATE.order) q.set('order', s.order);
  if (s.run !== null) q.set('run', s.run);
  if (s.flags !== null) q.set('flags', s.flags);
  const text = q.toString();
  return text === '' ? '' : `?${text}`;
}

/** Changes that Back should undo get their own history entry; filter tweaks replace the current one. */
const PUSH_KEYS = ['view', 'mode', 'run'] as const satisfies readonly (keyof UrlState)[];

export function historyAction(prev: UrlState, next: UrlState): 'push' | 'replace' | 'none' {
  if (serializeUrlState(prev) === serializeUrlState(next)) return 'none';
  return PUSH_KEYS.some((k) => prev[k] !== next[k]) ? 'push' : 'replace';
}

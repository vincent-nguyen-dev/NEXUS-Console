// When to ask Northstar for data, and whether what we hold answers the current window.
// Render's free tier and Neon's 100 CU-h/month are the budget: poll only while someone is looking.
import { windowSince, type WindowKey } from './filters';
import { parseInstant } from './time';
import type { RunsPage } from './types';

export const POLL_MS = 30_000;
/** After this long without input the poll slows down… */
export const IDLE_AFTER_MS = 5 * 60_000;
export const IDLE_POLL_MS = 120_000;
/** …and after this long it stops until the visitor is back. */
export const PAUSE_AFTER_MS = 30 * 60_000;
/** A request still open after this long means Render is probably waking up. */
export const WAKING_AFTER_MS = 5_000;
/** Data older than this is stale whatever the interval (2 × the idle interval). */
export const STALE_CAP_MS = 2 * IDLE_POLL_MS;
/** `since` reaches this much further back, so a client clock that runs a little fast loses nothing. */
export const CLOCK_MARGIN_MS = 60_000;
/** Render takes about a minute to wake; longer than this counts as no answer. */
export const FETCH_TIMEOUT_MS = 90_000;
/** Waits after 1, 2 and 3+ failed requests in a row. */
export const ERROR_BACKOFF_MS = [30_000, 60_000, 120_000] as const;
/** Wait after a 429 without a Retry-After header. */
export const RATE_LIMIT_DEFAULT_MS = 60_000;

export interface DelayInput {
  idle: boolean;
  /** Failed requests in a row. */
  errors: number;
  rateLimited: boolean;
  retryAfterS: number | null;
}

/** Milliseconds until the next request. Never shorter than the normal interval. */
export function nextDelay({ idle, errors, rateLimited, retryAfterS }: DelayInput): number {
  const base = idle ? IDLE_POLL_MS : POLL_MS;
  if (rateLimited) return Math.max(base, retryAfterS === null ? RATE_LIMIT_DEFAULT_MS : retryAfterS * 1000);
  if (errors > 0) return Math.max(base, ERROR_BACKOFF_MS[Math.min(errors, ERROR_BACKOFF_MS.length) - 1] ?? 0);
  return base;
}

/** The `since` to request: the window's start on the server's clock (client clock + learned offset), minus the margin. */
export function sinceFor(win: WindowKey, clientNowMs: number, offsetMs: number): string | null {
  return windowSince(win, clientNowMs + offsetMs - CLOCK_MARGIN_MS);
}

/** Epoch ms where the window starts at `serverNowMs`, or null for All. */
export function windowStartMs(win: WindowKey, serverNowMs: number): number | null {
  const since = windowSince(win, serverNowMs);
  return since === null ? null : parseInstant(since);
}

/** Whether a request made with `requestedSinceMs` reaches back to the window's start. */
export function reachesWindow(requestedSinceMs: number | null, win: WindowKey, serverNowMs: number): boolean {
  if (requestedSinceMs === null) return true;
  const start = windowStartMs(win, serverNowMs);
  return start !== null && requestedSinceMs <= start;
}

/**
 * Whether a page holds every run since `startMs`. A truncated page is newest-first, so it is still
 * complete for any window that starts after its oldest run.
 */
export function complete(page: Pick<RunsPage, 'truncated' | 'runs'>, startMs: number | null): boolean {
  return completeFrom(page.truncated, oldestRunMs(page), startMs);
}

/** The oldest run's creation time (ms), or null for no runs. */
export const oldestRunMs = (page: Pick<RunsPage, 'runs'>): number | null =>
  page.runs.length === 0 ? null : Math.min(...page.runs.map((r) => parseInstant(r.created_at)));

/** `complete` for any newest-first page, given its oldest row's time (the AI feed's calls too). */
export function completeFrom(truncated: boolean, oldestMs: number | null, startMs: number | null): boolean {
  if (!truncated) return true;
  if (startMs === null || oldestMs === null) return false;
  return oldestMs < startMs;
}

/** Whether a loaded page can answer `win` without a new request. */
export function covers(page: RunsPage, requestedSinceMs: number | null, win: WindowKey, serverNowMs: number): boolean {
  return coversFrom(page.truncated, oldestRunMs(page), requestedSinceMs, win, serverNowMs);
}

export function coversFrom(truncated: boolean, oldestMs: number | null, requestedSinceMs: number | null, win: WindowKey, serverNowMs: number): boolean {
  return reachesWindow(requestedSinceMs, win, serverNowMs) && completeFrom(truncated, oldestMs, windowStartMs(win, serverNowMs));
}

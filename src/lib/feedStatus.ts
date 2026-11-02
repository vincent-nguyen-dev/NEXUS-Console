// What the freshness badge says. Freshness changes only when a request finishes (or stays open
// too long), never because the polling interval changed: slowing down must not make old data look new.
import type { ApiErrorKind } from './api';
import { agoFromServer } from './format';
import type { DataSource } from './source';
import { STALE_CAP_MS, WAKING_AFTER_MS } from './pollPolicy';
import { parseInstant } from './time';
import type { Run } from './types';

export interface FeedSnapshot {
  hasData: boolean;
  /** Client time of the last successful response. */
  lastSuccessAt: number | null;
  /** Client time the open request started, or null. */
  inFlightSince: number | null;
  /** The last finished request's error; cleared by a success. */
  lastError: { kind: ApiErrorKind } | null;
  paused: boolean;
  /** Client time of the next scheduled request, or null. */
  nextAt: number | null;
}

export type StatusKind =
  | 'recorded'      // the frozen recording
  | 'file'          // the visitor's own file, read in this tab
  | 'connecting'    // no data, request open < 5 s
  | 'waking'        // no data, request open ≥ 5 s
  | 'offline'       // no data, no answer
  | 'rate_limited'  // no data, 429
  | 'api_error'     // no data, 503 / other status / unreadable feed
  | 'preview'       // no data, never asked: this origin can't read the feed (origin.ts)
  | 'reconnecting'  // data held, request open ≥ 5 s
  | 'stale'         // data held, last request failed or data older than the cap
  | 'paused'        // polling stopped after 30 min without input
  | 'live';

export interface FeedStatus {
  kind: StatusKind;
  /** Milliseconds since the last success, when there is data. */
  ageMs: number | null;
  /** Milliseconds until the next request, when one is scheduled. */
  retryInMs: number | null;
  /** The error behind offline/rate_limited/api_error/stale, if any. */
  error: ApiErrorKind | null;
}

function noDataKind(error: ApiErrorKind): StatusKind {
  if (error === 'network') return 'offline';
  if (error === 'refused') return 'preview';
  if (error === 'rate_limited') return 'rate_limited';
  return 'api_error';
}

export function feedStatus(s: FeedSnapshot, nowMs: number, source: DataSource): FeedStatus {
  const ageMs = s.hasData && s.lastSuccessAt !== null ? nowMs - s.lastSuccessAt : null;
  const retryInMs = s.nextAt === null ? null : Math.max(0, s.nextAt - nowMs);
  const error = s.lastError?.kind ?? null;
  const open = s.inFlightSince === null ? null : nowMs - s.inFlightSince;
  const out = (kind: StatusKind): FeedStatus => ({ kind, ageMs, retryInMs, error });

  if (source === 'recording') return out('recorded');
  if (source === 'file') return out('file');
  if (!s.hasData) {
    if (open !== null) return out(open >= WAKING_AFTER_MS ? 'waking' : 'connecting');
    if (error !== null) return out(noDataKind(error));
    return out(s.paused ? 'paused' : 'connecting');
  }
  if (s.paused) return out('paused');
  if (open !== null && open >= WAKING_AFTER_MS) return out('reconnecting');
  if (error !== null) return out('stale');
  if (ageMs !== null && ageMs > STALE_CAP_MS) return out('stale');
  return out('live');
}

/** Whether the data may be described as "right now". */
export const isLive = (status: FeedStatus): boolean => status.kind === 'live';

/** The newest `created_at` among the runs, or null when there are none. */
export function newestCreatedAt(runs: readonly Run[]): string | null {
  let best: Run | null = null;
  for (const r of runs) if (best === null || parseInstant(r.created_at) > parseInstant(best.created_at)) best = r;
  return best?.created_at ?? null;
}

/**
 * How long ago the newest enquiry arrived ("12 h ago"), on the server's clock, or null without runs. Checkpoint A: "Live ·
 * updated 20 s ago" read as new activity, so when NEXUS last checked and when the newest enquiry
 * arrived are said apart.
 */
export function newestEnquiryAgo(runs: readonly Run[], serverNow: string, ageMs: number): string | null {
  const at = newestCreatedAt(runs);
  return at === null ? null : agoFromServer(at, serverNow, ageMs);
}

/** The status pill's four states (visual language v2), plus the recording and a file, which are never live. */
export type PillState = 'live' | 'waking' | 'stale' | 'unavailable' | 'static';

const PILL: Record<StatusKind, PillState> = {
  live: 'live',
  connecting: 'waking', waking: 'waking',
  reconnecting: 'stale', stale: 'stale', paused: 'stale',
  offline: 'unavailable', rate_limited: 'unavailable', api_error: 'unavailable', preview: 'unavailable',
  recorded: 'static', file: 'static',
};

export const pillState = (status: FeedStatus): PillState => PILL[status.kind];

/** What the pill announces after `prev` (step 7.1b, F4): a poll slower than 5 s shows "Reconnecting" but stays
 * quiet, so a slow check isn't read out as two changes ("Reconnecting", then "Live"). */
export const announcedKind = (prev: StatusKind, next: StatusKind): StatusKind => (next === 'reconnecting' ? prev : next);

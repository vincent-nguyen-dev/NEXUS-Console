// Time windows and the event table's rows and filters.
import { parseInstant } from './time';
import type { EventType, Run, StepKind } from './types';

export const WINDOWS = ['24h', '7d', '30d', 'all'] as const;
export type WindowKey = (typeof WINDOWS)[number];
export const DEFAULT_WINDOW: WindowKey = '30d';

const HOUR = 3600 * 1000;
const WINDOW_MS: Record<Exclude<WindowKey, 'all'>, number> = { '24h': 24 * HOUR, '7d': 7 * 24 * HOUR, '30d': 30 * 24 * HOUR };

/** The `since` for a window ending at `nowMs`, or null for All. */
export function windowSince(win: WindowKey, nowMs: number): string | null {
  return win === 'all' ? null : new Date(nowMs - WINDOW_MS[win]).toISOString();
}

/** Runs created at or after the window's start, the same rule the server applies to `since`. */
export function runsInWindow(runs: Run[], win: WindowKey, nowMs: number): Run[] {
  if (win === 'all') return runs;
  const start = nowMs - WINDOW_MS[win];
  return runs.filter((r) => parseInstant(r.created_at) >= start);
}

export interface EventRow {
  runId: string;
  kind: StepKind;
  event: EventType;
  attempt: number;
  detail: string | null;
  at: string;
  /** Seconds since the previous event of the same run and step; null for its first event. */
  waitS: number | null;
}

/** Every event of every run, newest first. Events with the same time stay in recorded order (reversed). */
export function eventRows(runs: Run[]): EventRow[] {
  const rows: { row: EventRow; ms: number; seq: number }[] = [];
  for (const run of runs) {
    const previous = new Map<StepKind, number>();
    for (const e of run.events) {
      const ms = parseInstant(e.at);
      const before = previous.get(e.kind);
      previous.set(e.kind, ms);
      rows.push({
        row: {
          runId: run.run_id, kind: e.kind, event: e.event, attempt: e.attempt, detail: e.detail, at: e.at,
          waitS: before === undefined ? null : (ms - before) / 1000,
        },
        ms,
        seq: rows.length,
      });
    }
  }
  return rows.sort((a, b) => b.ms - a.ms || b.seq - a.seq).map((r) => r.row);
}

export interface RowFilter {
  step?: StepKind | null;
  attempt?: number | null;
  event?: EventType | null;
}

const any = <T>(want: T | null | undefined, value: T) => want === undefined || want === null || want === value;

export function filterRows(rows: EventRow[], { step, attempt, event }: RowFilter): EventRow[] {
  return rows.filter((r) => any(step, r.kind) && any(attempt, r.attempt) && any(event, r.event));
}

export const ORDERS = ['newest', 'oldest'] as const;
export type Order = (typeof ORDERS)[number];

/** Rows from eventRows (newest first) in the order asked for. Oldest first keeps the recorded order for ties. */
export const sortRows = (rows: EventRow[], order: Order): EventRow[] => (order === 'newest' ? rows : [...rows].reverse());

/** For each row, whether it starts a new run's block (the events table draws a stronger line there). Order kept. */
export const runBlocks = (rows: readonly Pick<EventRow, 'runId'>[]): boolean[] =>
  rows.map((r, i) => i === 0 || rows[i - 1]?.runId !== r.runId);

// The Overview's "Latest runs": the events worth reading, newest first, in plain language, grouped by run.
// started/queued are left out (the events table has them); a retry plan joins its failure.
import { describeEvent, eventTone, formatPlanned, type Tone } from './format';
import type { Selection } from './map';
import { parseInstant } from './time';
import type { Run, StepKind, Workflow } from './types';
import { otherJobTrouble, runStory, type RunStory } from './runStory';
import { flagsOf, numberWord } from './workflow';

export const LATEST_SIGNALS = 8;

export interface SignalRow {
  key: string;
  runId: string;
  at: string;
  /** null for the run's "Lead saved" row. */
  kind: StepKind | null;
  attempt: number | null;
  text: string;
  tone: Tone;
}

export function signalRows(runs: Run[], wf: Workflow): SignalRow[] {
  const rows: { row: SignalRow; ms: number; seq: number }[] = [];
  const push = (row: SignalRow) => rows.push({ row, ms: parseInstant(row.at), seq: rows.length });
  for (const run of runs) {
    const id = run.run_id;
    push({ key: `${id}|lead`, runId: id, at: run.created_at, kind: null, attempt: null, text: `New ${wf.trigger.one}: ${numberWord(wf.steps.length)} jobs queued`, tone: 'lead' });
    for (const e of run.events) {
      if (e.event !== 'failed' && e.event !== 'succeeded' && e.event !== 'dead') continue;
      const row = { key: `${id}|${e.kind}|${e.event}|${e.attempt}|${e.at}`, runId: id, at: e.at, kind: e.kind, attempt: e.attempt };
      if (e.event === 'failed') {
        const retry = run.events.find((r) => r.kind === e.kind && r.event === 'retry_scheduled' && r.attempt === e.attempt);
        push(retry
          ? { ...row, text: `${describeEvent(e, run, wf)}. Retry planned in ${formatPlanned(Number(retry.detail))}`, tone: 'retry' }
          : { ...row, text: describeEvent(e, run, wf), tone: 'dead' });
      } else {
        push({ ...row, text: describeEvent(e, run, wf), tone: eventTone(e, wf) });
      }
    }
  }
  return rows.sort((a, b) => b.ms - a.ms || b.seq - a.seq).map((r) => r.row);
}

/** The rows that match the map's selection: a step drops the Lead rows, a try keeps only that attempt. */
export function selectSignals(rows: SignalRow[], { step, attempt }: Selection, limit = LATEST_SIGNALS): { rows: SignalRow[]; total: number } {
  const matching = step === null ? rows : rows.filter((r) => r.kind === step && (attempt === null || r.attempt === attempt));
  return { rows: matching.slice(0, limit), total: matching.length };
}

/** One row of "Latest runs": a run told by its primary job, with its moments for the expanded view. */
export interface RunRow {
  runId: string;
  /** The time of its newest moment. */
  at: string;
  story: RunStory;
  /** Another job's trouble, one sentence each; empty when nothing went wrong there. */
  trouble: string[];
  /** The labels of the test switches set on this run. */
  flags: string[];
  /** Its moments, newest first. */
  moments: SignalRow[];
}

/**
 * The runs behind the newest moments, one row each and newest update first: the runs the moments list would
 * have shown rows for, under the same map selection. A selection orders by the newest matching moment.
 */
export function latestRuns(runs: Run[], wf: Workflow, selection: Selection, limit = LATEST_SIGNALS): { rows: RunRow[]; total: number } {
  const all = signalRows(runs, wf);
  const matching = selectSignals(all, selection, Infinity).rows;
  const byId = new Map(runs.map((r) => [r.run_id, r]));
  const order: string[] = [];
  for (const row of matching) if (!order.includes(row.runId)) order.push(row.runId);
  const rows = order.slice(0, limit).flatMap((id): RunRow[] => {
    const run = byId.get(id);
    if (!run) return [];
    const moments = all.filter((m) => m.runId === id);
    return [{
      runId: id,
      at: moments[0]?.at ?? run.created_at,
      story: runStory(run, wf),
      trouble: otherJobTrouble(run, wf),
      flags: flagsOf(wf, run).filter((f) => f.on).map((f) => f.flag.label),
      moments,
    }];
  });
  return { rows, total: order.length };
}

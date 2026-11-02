// One run drawn over the map: the tries it really made, the waits between them, and how each ended. A pinned
// run's note reads like its drawer (runSummary), so the two never disagree.
import { formatDuration, formatOffset, formatUtcDay } from './format';
import { runSummary } from './runDetail';
import { secondsBetween } from './time';
import { attemptChain } from './topology';
import type { Run, StepKind, Workflow } from './types';
import { flagsOf, resultOf } from './workflow';

export type TraceOutcome = 'sent' | 'simulated' | 'skipped' | 'done' | 'failed' | 'noresult' | 'gaveup' | 'running';

export interface TraceTry {
  attempt: number;
  outcome: TraceOutcome;
  /** When the try ended (or started, while running), after the enquiry: "+0.8 s". */
  at: string;
}

export interface TraceLane {
  kind: StepKind;
  tries: TraceTry[];
  /** "waited 10.2 s", or "waiting now" while the retry hasn't started. */
  waits: { afterTry: number; text: string }[];
  finished: boolean;
  /** A job due later that hasn't run: its day ("29 Oct 2026"). */
  due: string | null;
}

export interface Trace {
  runId: string;
  lanes: TraceLane[];
}

export function traceOf(run: Run, wf: Workflow): Trace {
  const lanes = wf.steps.map(({ kind }): TraceLane => {
    const chain = attemptChain(run, kind);
    const tries = chain.map((a): TraceTry => {
      let outcome: TraceOutcome = 'running';
      if (a.outcome === 'succeeded') {
        const meaning = resultOf(wf, kind, a.detail).outcome;
        outcome = meaning === 'delivered' ? 'sent' : meaning === 'simulated' ? 'simulated' : meaning === 'skipped' ? 'skipped' : 'done';
      } else if (a.outcome === 'failed') outcome = 'failed';
      else if (a.outcome === 'dead') outcome = 'gaveup';
      else if (a.outcome === 'lease_expired') outcome = 'noresult';
      return { attempt: a.attempt, outcome, at: formatOffset(secondsBetween(run.created_at, a.endedAt ?? a.startedAt)) };
    });
    const waits = chain.flatMap((a) =>
      a.wait === null ? [] : [{ afterTry: a.attempt, text: a.wait.actualS === null ? 'waiting now' : `waited ${formatDuration(a.wait.actualS)}` }]);
    const step = run.steps.find((s) => s.kind === kind);
    const finished = step?.status === 'succeeded' || step?.status === 'dead';
    const due = !finished && chain.length === 0 && step ? formatUtcDay(step.run_after) : null;
    return { kind, tries, waits, finished, due };
  });
  return { runId: run.run_id, lanes };
}

/** "Run 7c06 · outage switch on. The team notification recovered …": the run's own summary, as its drawer says it. */
export function traceNote(run: Run, serverNow: string, wf: Workflow, shortId: string): string {
  const on = flagsOf(wf, run).filter((f) => f.on).map((f) => `${f.flag.label.toLowerCase()} on`);
  const s = runSummary(run, serverNow, wf);
  return [`Run ${shortId}${on.length > 0 ? ` · ${on.join(' · ')}` : ''}.`, s.headline, ...s.lines].join(' ');
}

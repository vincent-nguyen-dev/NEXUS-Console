// What each job of a run means, read from the feed's own description of its workflow (Workflow).
// NEXUS never knows a job by name: completion time, the KPIs and the story's focus all come from the
// roles below, derived from the description.
import type { ErrorSpec, FlagSpec, ResultOutcome, Run, StepKind, StepSpec, Workflow } from './types';

export function stepSpec(wf: Workflow, kind: StepKind): StepSpec {
  const spec = wf.steps.find((s) => s.kind === kind);
  // The parser refuses runs with undescribed jobs, so this only fails on a programming error.
  if (!spec) throw new Error(`no description for job ${kind}`);
  return spec;
}

export const stepLabel = (wf: Workflow, kind: StepKind): string => stepSpec(wf, kind).label;

const kindsOf = (steps: StepSpec[]) => steps.map((s) => s.kind);

/** Jobs due as soon as the run starts. Completion time and "in progress" are about these. */
export const immediateSteps = (wf: Workflow): StepKind[] => kindsOf(wf.steps.filter((s) => s.starts_after_s === 0));

/** Jobs due later (e.g. a deletion a week after), reported apart from the rest. */
export const scheduledSteps = (wf: Workflow): StepKind[] => kindsOf(wf.steps.filter((s) => s.starts_after_s > 0));

/** Jobs that really deliver something right away: the KPIs' rates are about these. */
export const measuredSteps = (wf: Workflow): StepKind[] =>
  kindsOf(wf.steps.filter((s) => s.starts_after_s === 0 && s.delivers !== null && !s.always_simulated));

/** Jobs that never really deliver. Their success says nothing about delivery, so they're kept apart. */
export const simulatedSteps = (wf: Workflow): StepKind[] => kindsOf(wf.steps.filter((s) => s.always_simulated));

export const isScheduled = (wf: Workflow, kind: StepKind): boolean => stepSpec(wf, kind).starts_after_s > 0;

/** The job a story about one run is about: the first measured one, else the first job. */
export function primaryStep(wf: Workflow): StepKind {
  const kind = measuredSteps(wf)[0] ?? wf.steps[0]?.kind;
  if (kind === undefined) throw new Error('the workflow describes no job');
  return kind;
}

export interface ResultMeaning {
  outcome: ResultOutcome;
  /** The description's label, or the raw code when it doesn't know the code. */
  label: string;
}

export function resultOf(wf: Workflow, kind: StepKind, code: string | null): ResultMeaning {
  const r = stepSpec(wf, kind).results.find((x) => x.code === code);
  return r ? { outcome: r.outcome, label: r.label } : { outcome: 'unknown', label: code ?? 'no result' };
}

/** An error code in words, and whether a try that failed this way sent nothing. */
export function errorOf(wf: Workflow, code: string | null): { label: string; sendsNothing: boolean } {
  const e: ErrorSpec | undefined = wf.errors.find((x) => x.code === code);
  if (e) return { label: e.label, sendsNothing: e.sends_nothing };
  return { label: code === null ? 'no error code' : code.replaceAll('_', ' '), sendsNothing: false };
}

/** The described flags, each with whether it was on for this run. */
export const flagsOf = (wf: Workflow, run: Run): { flag: FlagSpec; on: boolean }[] =>
  wf.flags.map((flag) => ({ flag, on: run.flags.includes(flag.key) }));

/** Runs with at least one flag on (e.g. a test outage), which skew the rates on purpose. */
export const flaggedRuns = (runs: Run[]): number => runs.filter((r) => r.flags.length > 0).length;

/** The planned wait after try `afterTry` failed, or null when no retry follows. */
export function plannedWaitS(wf: Workflow, kind: StepKind, afterTry: number): number | null {
  const spec = stepSpec(wf, kind);
  return afterTry >= 1 && afterTry < spec.max_attempts ? (spec.backoff_s[afterTry - 1] ?? null) : null;
}

/** A delay in words: "7 days", "1 hour", "90 seconds". Whole units only, else the next smaller unit. */
export function delayText(seconds: number): string {
  const units: [number, string][] = [[86_400, 'day'], [3_600, 'hour'], [60, 'minute'], [1, 'second']];
  for (const [size, name] of units) {
    if (seconds >= size && seconds % size === 0) {
      const n = seconds / size;
      return `${n} ${name}${n === 1 ? '' : 's'}`;
    }
  }
  return `${seconds} seconds`;
}

/** What starts a run, as prose needs it: "enquiry", "enquiries", "Enquiry". From the feed. */
export const triggerOf = (wf: Workflow) => ({
  one: wf.trigger.one,
  many: wf.trigger.many,
  One: wf.trigger.one.charAt(0).toUpperCase() + wf.trigger.one.slice(1),
});

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** A small count in words, as prose writes it: 3 → "three". */
export const numberWord = (n: number): string => WORDS[n] ?? String(n);

/** "team notification" → "team notifications": the labels are English nouns. */
export const pluralLabel = (label: string): string => (/s$/i.test(label) ? label : `${label}s`);

/**
 * For a story about one run: when a try failed with an error that sends nothing on a run with a test
 * switch on, the outside service was down on purpose. Returns that service ("email service"), or null.
 */
export function simulatedOutageOf(wf: Workflow, run: Run, kind: StepKind, code: string | null): string | null {
  const delivers = stepSpec(wf, kind).delivers;
  return delivers !== null && run.flags.length > 0 && errorOf(wf, code).sendsNothing ? `${delivers} service` : null;
}

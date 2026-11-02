// Each run's story in one shape and one sentence, told by its primary job (workflow.ts): the run strip's chips,
// and, counted together, the summary line under the map's title. "Sent" only ever means a delivered result.
import { deliveryOf, jobFacts } from './metrics';
import { parseInstant } from './time';
import type { Run, StepKind, Workflow } from './types';
import { isScheduled, pluralLabel, primaryStep, resultOf, stepLabel } from './workflow';

export type StoryKind = 'sent' | 'recovered' | 'simulated' | 'skipped' | 'done' | 'duplicate' | 'gaveup' | 'waiting' | 'running' | 'scheduled';

export interface RunStory {
  kind: StoryKind;
  /** "Team notification sent on try 3 after 2 failed tries" */
  text: string;
}

const tries = (n: number) => `${n} failed ${n === 1 ? 'try' : 'tries'}`;

/** Where it finished, and how, as the summary groups it: "sent on try 3 after 2 failed tries". */
function ending(run: Run, wf: Workflow, kind: StepKind = primaryStep(wf)): { kind: StoryKind; phrase: string; attempt: number } | null {
  const f = jobFacts(run, kind);
  const a = f.succeededAttempt;
  if (a === null || f.status !== 'succeeded') return null;
  const verdict = deliveryOf(run, kind, wf).verdict;
  const meaning = resultOf(wf, kind, f.result);
  if (verdict === 'sent_once') {
    return a === 1 ? { kind: 'sent', phrase: 'sent on try 1', attempt: a } : { kind: 'recovered', phrase: `sent on try ${a} after ${tries(a - 1)}`, attempt: a };
  }
  if (verdict === 'simulated') return { kind: 'simulated', phrase: `simulated on try ${a}`, attempt: a };
  if (verdict === 'skipped') return { kind: 'skipped', phrase: `${meaning.label} on try ${a}`, attempt: a };
  return { kind: 'done', phrase: `done on try ${a}`, attempt: a };
}

export function runStory(run: Run, wf: Workflow): RunStory {
  return jobStory(run, primaryStep(wf), wf);
}

/** The same sentence for any one job of the run. */
export function jobStory(run: Run, kind: StepKind, wf: Workflow): RunStory {
  const label = stepLabel(wf, kind);
  const f = jobFacts(run, kind);
  const d = deliveryOf(run, kind, wf);
  if (d.verdict === 'duplicate') {
    return { kind: 'duplicate', text: `${label} recorded ${d.succeededEvents} successes: it may have been sent more than once` };
  }
  if (d.verdict === 'not_sent') {
    const attempt = run.events.find((e) => e.kind === kind && e.event === 'dead')?.attempt ?? 0;
    return f.deadDetail === 'lease_expired'
      ? { kind: 'gaveup', text: `${label} gave up: try ${attempt} never reported back` }
      : { kind: 'gaveup', text: `${label} gave up after ${attempt} tries` };
  }
  const end = ending(run, wf, kind);
  if (end !== null) {
    const nothing = end.kind === 'simulated' || end.kind === 'skipped' ? ', nothing sent' : '';
    return { kind: end.kind, text: `${label} ${end.phrase}${nothing}` };
  }
  if (f.status === 'retrying') {
    return { kind: 'waiting', text: `${label} failed ${f.failures} ${f.failures === 1 ? 'time' : 'times'}, waiting to retry` };
  }
  const started = run.events.some((e) => e.kind === kind && e.event === 'started');
  if (!started && isScheduled(wf, kind)) return { kind: 'scheduled', text: `${label} scheduled` };
  return { kind: 'running', text: `${label} still running` };
}

/**
 * "13 team notifications: 6 sent on try 1 · 7 sent on try 3 after 2 failed tries · 0 gave up". Groups by how
 * each run's primary job ended, by try; "gave up" is always said, even at 0. Null without runs.
 */
export function flowSummary(runs: Run[], wf: Workflow): string | null {
  if (runs.length === 0) return null;
  const label = stepLabel(wf, primaryStep(wf)).toLowerCase();
  const groups = new Map<string, { phrase: string; attempt: number; order: number; count: number }>();
  let gave = 0;
  let going = 0;
  let duplicate = 0;
  const ORDER: Partial<Record<StoryKind, number>> = { sent: 0, simulated: 1, skipped: 2, done: 3, recovered: 0 };
  for (const run of runs) {
    const story = runStory(run, wf);
    if (story.kind === 'gaveup') gave++;
    else if (story.kind === 'duplicate') duplicate++;
    else {
      const end = ending(run, wf);
      if (end === null) going++;
      else {
        const g = groups.get(end.phrase) ?? { phrase: end.phrase, attempt: end.attempt, order: ORDER[end.kind] ?? 4, count: 0 };
        g.count++;
        groups.set(end.phrase, g);
      }
    }
  }
  const parts = [...groups.values()].sort((a, b) => a.attempt - b.attempt || a.order - b.order).map((g) => `${g.count} ${g.phrase}`);
  if (duplicate > 0) parts.push(`${duplicate} recorded more than one success`);
  parts.push(`${gave} gave up`);
  if (going > 0) parts.push(`${going} still going`);
  const noun = runs.length === 1 ? label : pluralLabel(label);
  return `${runs.length} ${noun}: ${parts.join(' · ')}`;
}

/** What went wrong in the run's other jobs, one sentence each (gave up, more than one success, still failing). */
export function otherJobTrouble(run: Run, wf: Workflow): string[] {
  const primary = primaryStep(wf);
  return wf.steps
    .filter((s) => s.kind !== primary)
    .map((s) => jobStory(run, s.kind, wf))
    .filter((story) => story.kind === 'gaveup' || story.kind === 'duplicate' || story.kind === 'waiting')
    .map((story) => story.text);
}

/** The run strip shows at most this many runs, the newest. */
export const STRIP_MAX = 40;

/** The strip's runs, oldest left → newest right: the same runs the summary counts, or their newest 40. */
export function stripRuns(runs: Run[]): { runs: Run[]; label: string } {
  const sorted = [...runs].sort((a, b) => parseInstant(a.created_at) - parseInstant(b.created_at));
  const shown = sorted.slice(-STRIP_MAX);
  let label = `${runs.length} runs in this window, oldest → newest.`;
  if (runs.length === 1) label = '1 run in this window.';
  if (runs.length > STRIP_MAX) label = `The newest ${STRIP_MAX} of these ${runs.length} runs, oldest → newest.`;
  return { runs: shown, label };
}

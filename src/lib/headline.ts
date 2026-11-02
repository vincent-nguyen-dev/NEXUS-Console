// The sentence above the map. It summarizes the selected window, and says "Right now" only while
// the data is live: an old failure must not read like a current one, and stale data can't speak for now.
import type { WindowKey } from './filters';
import type { DataSource } from './source';
import { jobFacts } from './metrics';
import type { Run, StepKind, Workflow } from './types';
import { immediateSteps, pluralLabel, stepLabel, triggerOf } from './workflow';

export interface Headline {
  /** About the window, always present. */
  window: string;
  /** About the current state, only when the data is live and there is something running. */
  now: string | null;
}

export interface HeadlineContext {
  win: WindowKey;
  source: DataSource;
  /** The window holds more runs than the feed returned. */
  partial: boolean;
  live: boolean;
  /** The test-switch filter as words ("the outage switch off"), or null (flagFilter.ts). */
  filter?: string | null;
}

/** The window in words, as it ends a sentence: "in the last 30 days". */
export const PERIOD: Record<WindowKey, string> = {
  '24h': 'the last 24 hours', '7d': 'the last 7 days', '30d': 'the last 30 days', all: 'all recorded runs',
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "team notification(s)" when every job counted is the same one; "job(s)" when they are mixed. */
function jobNoun(n: number, kinds: Set<StepKind>, wf: Workflow): string {
  const [only] = kinds;
  if (kinds.size !== 1 || only === undefined) return plural(n, 'job', 'jobs');
  const label = stepLabel(wf, only).toLowerCase();
  return plural(n, label, pluralLabel(label));
}

export function headline(runs: Run[], { win, source, partial, live, filter = null }: HeadlineContext, wf: Workflow): Headline {
  if (partial) return { window: 'Showing only the newest 500 runs: this window has more.', now: null };
  const guided = source === 'recording';
  if (runs.length === 0) {
    const t = triggerOf(wf);
    const only = filter === null ? '' : ` with ${filter}`;
    return { window: win === 'all' ? `No ${t.many}${only} recorded yet.` : `No ${t.many}${only} in ${PERIOD[win]}.`, now: null };
  }
  const lead = guided ? 'In this recorded run' : `In ${PERIOD[win]}${filter === null ? '' : ` (runs with ${filter})`}`;

  const all = runs.flatMap((r) => wf.steps.map((s) => jobFacts(r, s.kind)));
  const immediate = immediateSteps(wf);
  const delivery = all.filter((j) => immediate.includes(j.kind));
  const dead = all.filter((j) => j.status === 'dead');
  const recovered = delivery.filter((j) => j.status === 'succeeded' && j.failures > 0);
  const finished = delivery.filter((j) => j.finished);

  let window: string;
  if (dead.length > 0) {
    window = `${lead}, ${jobNoun(dead.length, new Set(dead.map((j) => j.kind)), wf)} gave up.`;
  } else if (recovered.length > 0) {
    window = `${lead}, ${jobNoun(recovered.length, new Set(recovered.map((j) => j.kind)), wf)} recovered after retries, and no job gave up.`;
  } else if (finished.length === delivery.length) {
    window = runs.length === 1
      ? `${lead}, the one run finished on the first try.`
      : `${lead}, all ${runs.length} runs finished on the first try.`;
  } else if (finished.length > 0) {
    window = `${lead}, ${plural(runs.length, wf.trigger.one, wf.trigger.many)} came in, and every finished job succeeded on its first try.`;
  } else {
    window = `${lead}, ${plural(runs.length, wf.trigger.one, wf.trigger.many)} came in, and no job has finished yet.`;
  }

  if (!live || source !== 'live') return { window, now: null };
  const retrying = delivery.filter((j) => j.status === 'retrying');
  if (retrying.length > 0) {
    const noun = jobNoun(retrying.length, new Set(retrying.map((j) => j.kind)), wf);
    return { window, now: `Right now: ${noun} ${retrying.length === 1 ? 'is' : 'are'} waiting to retry.` };
  }
  const inProgress = runs.filter((r) => immediate.some((k) => !jobFacts(r, k).finished)).length;
  if (inProgress > 0) {
    return { window, now: `Right now: ${plural(inProgress, 'run is', 'runs are')} in progress.` };
  }
  return { window, now: null };
}

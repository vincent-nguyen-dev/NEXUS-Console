// The KPI strip's tiles as text. The rates are about the measured jobs (workflow.ts); an always-simulated
// job gets its own tile, because mixing it in would flatter the real delivery rate.
// Each tile carries "How is this counted?" (the rule, the working with this window's numbers, what skews
// it, the source), and, below a minimum, its progress toward it. Everything here is a fact about recorded
// data: nothing predicts when a minimum will be reached.
import type { WindowKey } from './filters';
import { formatDuration, formatPercent, formatUtcDay, formatUtcMinute } from './format';
import { PERIOD } from './headline';
import { RUNS_MAX_LIMIT } from './api';
import { MIN_P95_RUNS, MIN_RATE_DENOMINATOR, SMALL_P95_RUNS, completionP95, completionSeconds, firstAttemptSuccess, jobFacts, recovered } from './metrics';
import { parseInstant } from './time';
import { sourceText, type DataSource } from './source';
import type { Run, StepKind, Workflow } from './types';
import {
  delayText, immediateSteps, measuredSteps, numberWord, pluralLabel, resultOf, scheduledSteps, simulatedSteps, stepLabel, stepSpec, triggerOf,
} from './workflow';

export interface HowCounted {
  rule: string;
  /** The arithmetic with this window's numbers ("5 ÷ 10 = 50%"), or how far it is from its minimum. */
  working: string;
  /** What's excluded, what skews it, and why its minimum exists. */
  notes: string[];
  source: string;
}

export interface Progress {
  have: number;
  need: number;
  /** "complete runs", "qualifying failures", … */
  noun: string;
  /** "Latest complete run: 26 Oct, 09:52 UTC", or null. */
  latest: string | null;
  /** Points to longer windows (never claims they reach the minimum), or says the recording is one run. */
  hint: string | null;
}

export interface Kpi {
  id: 'runs' | 'first_try' | 'recovered' | 'simulated' | 'completion_p95';
  label: string;
  value: string;
  /** False when the value is a placeholder ("No rate yet"), shown smaller and muted. */
  hasValue: boolean;
  /** One short line under the value. */
  note: string;
  how: HowCounted;
  /** Set below a minimum: the tile shows progress instead of the placeholder. */
  progress: Progress | null;
}

export interface KpiScope {
  win: WindowKey;
  source: DataSource;
  /** The visitor's file name, for the source line (file source only). */
  fileName: string | null;
  /** The page's `now` (server time of the answer). */
  asOf: string;
  /** When the recording was frozen. */
  capturedAt: string;
  /** The test-switch filter as words ("the outage switch off"), or null when every run counts (flagFilter.ts). */
  filter?: string | null;
}

export const partialNote = (source: DataSource) =>
  `${sourceText(source).onlyNewest(RUNS_MAX_LIMIT)}, and this window has more. Choose a shorter window.`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function kpiSource({ win, source, fileName, asOf, capturedAt, filter = null }: KpiScope): string {
  if (source === 'recording') return `Source: the recording of one run, frozen ${formatUtcDay(capturedAt)}.`;
  const runs = (win === 'all' ? 'all recorded runs' : `runs created in ${PERIOD[win]}`) + (filter === null ? '' : ` with ${filter}`);
  if (source === 'file') return `Source: your file (${fileName ?? 'not named'}), ${runs}, as of its time, ${formatUtcMinute(asOf)}.`;
  return `Source: Northstar's ops feed, ${runs}, as of ${formatUtcMinute(asOf)}.`;
}

const WINDOW_NAME: Record<Exclude<WindowKey, 'all'>, string> = { '24h': '24-hour', '7d': '7-day', '30d': '30-day' };
const LONGER: Record<Exclude<WindowKey, 'all'>, string> = { '24h': '7 days, 30 days or All', '7d': '30 days or All', '30d': 'All' };

/**
 * Below a minimum, where else to look. The console fetches only the selected window, so it can't know
 * whether a longer one reaches the minimum: the hint only says longer windows include older runs.
 */
export function windowHint(have: number, need: number, noun: string, win: WindowKey, guided: boolean, filter: string | null = null): string | null {
  if (have >= need) return null;
  if (guided) return `The recording is one run; this needs ${need} ${noun}.`;
  // With the filter on, the count is of filtered runs: say so, and say what could add others (never that it would reach the minimum).
  if (filter !== null) {
    return win === 'all'
      ? `All recorded runs with ${filter} hold ${have} of the ${need}. Clearing the filter can include other runs.`
      : `This ${WINDOW_NAME[win]} window holds ${have} of the ${need} with ${filter}. Clearing the filter or choosing a longer window can include other runs.`;
  }
  if (win === 'all') return null;
  return `This ${WINDOW_NAME[win]} window holds ${have} of the ${need}. Longer windows include older runs: try ${LONGER[win]}.`;
}

/** "Latest complete run: 26 Oct, 09:52 UTC", from the newest enquiry that counts toward a minimum. */
function latest(label: string, runs: Run[], guided: boolean): string | null {
  if (guided || runs.length === 0) return null;
  const newest = runs.reduce((a, b) => (parseInstant(b.created_at) > parseInstant(a.created_at) ? b : a));
  return `${label}: ${formatUtcMinute(newest.created_at)}`;
}

const WHY_RATE_MIN = `With fewer than ${MIN_RATE_DENOMINATOR}, a single result moves the rate by ${100 / MIN_RATE_DENOMINATOR} points or more (${MIN_RATE_DENOMINATOR} is a demo threshold).`;
const WHY_P95_MIN = `A 95th percentile from fewer than ${MIN_P95_RUNS} runs would swing with every new run, so NEXUS waits (${MIN_P95_RUNS} is a demo threshold).`;

/** The tiles' names for a group of jobs: one job's label, or a generic name for several. */
interface Names {
  /** "Team notification" */
  title: string;
  /** "team notifications" */
  many: string;
}

function names(wf: Workflow, kinds: StepKind[], several: string): Names {
  const [only] = kinds;
  if (kinds.length === 1 && only !== undefined) {
    const label = stepLabel(wf, only);
    return { title: label, many: pluralLabel(label.toLowerCase()) };
  }
  return { title: several, many: several.toLowerCase() };
}

/** "Results: 10 emails sent · 2 skipped at the daily email cap.", from what the description says each result means. */
function resultsLine(runs: Run[], kinds: StepKind[], wf: Workflow): string | null {
  const counts = new Map<string, number>();
  for (const r of runs) {
    for (const kind of kinds) {
      const f = jobFacts(r, kind);
      if (f.status !== 'succeeded') continue;
      const meaning = resultOf(wf, kind, f.result);
      const delivers = stepSpec(wf, kind).delivers;
      const key = meaning.outcome === 'delivered' && delivers !== null ? `\u0000${delivers}` : meaning.label;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const parts = [...counts.entries()].map(([key, n]) =>
    key.startsWith('\u0000') ? plural(n, `${key.slice(1)} sent`, `${key.slice(1)}s sent`) : `${n} ${key}`);
  return parts.length === 0 ? null : `Results: ${parts.join(' · ')}.`;
}

/** One sentence per described flag that was on, e.g. a test outage that fails tries on purpose. */
function flagNotes(runs: Run[], wf: Workflow): string[] {
  return wf.flags.flatMap((flag) => {
    const on = runs.filter((r) => r.flags.includes(flag.key)).length;
    return on === 0
      ? []
      : [`${on} of the ${plural(runs.length, 'run', 'runs')} had the ${flag.label.toLowerCase()} on, which ${flag.effect}, so this rate is low by design.`];
  });
}

export function buildKpis(runs: Run[], partial: boolean, scope: KpiScope, wf: Workflow): Kpi[] {
  const sourceLine = kpiSource(scope);
  const { win, source } = scope;
  const guided = source === 'recording';
  const PARTIAL_NOTE = partialNote(source);
  const measured = measuredSteps(wf);
  const simulated = simulatedSteps(wf);
  const m = names(wf, measured, 'Real jobs');
  const s = names(wf, simulated, 'Simulated jobs');
  const rules = {
    first: `${capital(m.many)} that succeeded on try 1 ÷ finished ${m.many} (finished = succeeded or gave up).`,
    recovered: `${capital(m.many)} that failed at least once and then succeeded ÷ ${m.many} that failed at least once and finished.`,
    simulated: `${capital(s.many)} that finished on try 1, out of those that finished.`,
    p95: p95Rule(wf),
    runs: `Runs created in the window, by when each ${triggerOf(wf).one} was saved. One run per ${triggerOf(wf).one}.`,
  };
  const labels = {
    first: `${m.title} · first try`, recovered: `${m.title} · recovered`, simulated: `${s.title} · simulated`,
    p95: `${triggerOf(wf).One} to last job · 95th percentile`,
  };

  if (partial) {
    const withheld = (id: Kpi['id'], label: string, rule: string): Kpi => ({
      id, label, value: 'Withheld', hasValue: false, note: PARTIAL_NOTE,
      how: { rule, working: `Withheld: this window holds more runs than ${sourceText(scope.source).thanReturned}.`, notes: [PARTIAL_NOTE], source: sourceLine },
      progress: null,
    });
    return [
      {
        id: 'runs', label: 'Runs', value: `${runs.length}+`, hasValue: true, note: PARTIAL_NOTE,
        how: { rule: rules.runs, working: `At least ${runs.length} runs (the newest 500).`, notes: [PARTIAL_NOTE], source: sourceLine }, progress: null,
      },
      ...(measured.length > 0
        ? [withheld('first_try', labels.first, rules.first), withheld('recovered', labels.recovered, rules.recovered)]
        : []),
      ...(simulated.length > 0 ? [withheld('simulated', labels.simulated, rules.simulated)] : []),
      withheld('completion_p95', labels.p95, rules.p95),
    ];
  }

  const tiles: Kpi[] = [{
    id: 'runs', label: 'Runs', value: String(runs.length), hasValue: true, note: `one per ${triggerOf(wf).one}`,
    how: {
      rule: rules.runs, working: plural(runs.length, 'run', 'runs'),
      notes: [RUNS_NOTE[scope.source]], source: sourceLine,
    },
    progress: null,
  }];

  if (measured.length > 0) {
    // First try
    const first = firstAttemptSuccess(runs, measured);
    const finished = runs.filter((r) => measured.some((k) => jobFacts(r, k).finished));
    const firstNotes = [...flagNotes(runs, wf), resultsLine(runs, measured, wf), WHY_RATE_MIN].filter((p) => p !== null);
    tiles.push(first.value === null
      ? {
          id: 'first_try', label: labels.first, value: 'No rate yet', hasValue: false,
          note: `A rate needs ${MIN_RATE_DENOMINATOR} finished (demo threshold).`,
          how: { rule: rules.first, working: `${first.denominator} finished ${first.denominator === 1 ? m.many.replace(/s$/, '') : m.many} so far; a rate needs ${MIN_RATE_DENOMINATOR}.`, notes: firstNotes, source: sourceLine },
          progress: progress(first.denominator, MIN_RATE_DENOMINATOR, `finished ${m.many}`, latest(`Latest finished ${m.many.replace(/s$/, '')}`, finished, guided), win, guided, scope.filter ?? null),
        }
      : {
          id: 'first_try', label: labels.first, value: formatPercent(first.numerator, first.denominator), hasValue: true,
          // "10 of 20 finished" read as "10 didn't finish" (checkpoint B, T2); the rule still defines the 20.
          note: `${first.numerator} of ${first.denominator} succeeded on try 1`,
          how: { rule: rules.first, working: `${first.numerator} ÷ ${first.denominator} = ${formatPercent(first.numerator, first.denominator)}`, notes: firstNotes, source: sourceLine },
          progress: null,
        });

    // Recovered
    const rec = recovered(runs, measured);
    const qualifying = runs.filter((r) => measured.some((k) => {
      const f = jobFacts(r, k);
      return f.finished && f.failures > 0;
    }));
    const fromFlags = qualifying.filter((r) => r.flags.length > 0).length;
    const flagNames = wf.flags.map((f) => `the ${f.label.toLowerCase()}`).join(' or ');
    const recNotes = [
      'A failure is a recorded "failed" event. A try that never reported back is retried without one, so it isn\'t counted here.',
      rec.denominator === 0 || wf.flags.length === 0
        ? null
        : fromFlags === rec.denominator
          ? `All ${rec.denominator} came from runs with ${flagNames} on.`
          : `${fromFlags} of the ${rec.denominator} came from runs with ${flagNames} on.`,
      WHY_RATE_MIN,
    ].filter((p) => p !== null);
    tiles.push(rec.value !== null
      ? {
          id: 'recovered', label: labels.recovered, value: formatPercent(rec.numerator, rec.denominator), hasValue: true,
          note: `${rec.numerator} of ${rec.denominator} that failed`,
          how: { rule: rules.recovered, working: `${rec.numerator} ÷ ${rec.denominator} = ${formatPercent(rec.numerator, rec.denominator)}`, notes: recNotes, source: sourceLine },
          progress: null,
        }
      : {
          id: 'recovered', label: labels.recovered, value: 'No rate yet', hasValue: false,
          note: rec.denominator === 0
            ? `No ${m.many.replace(/s$/, '')} has failed in this window.`
            : `A rate needs ${MIN_RATE_DENOMINATOR} qualifying failures (demo threshold).`,
          how: {
            rule: rules.recovered,
            working: `${plural(rec.denominator, 'qualifying failure', 'qualifying failures')} so far (${rec.numerator} recovered); a rate needs ${MIN_RATE_DENOMINATOR}.`,
            notes: recNotes, source: sourceLine,
          },
          progress: progress(rec.denominator, MIN_RATE_DENOMINATOR, 'qualifying failures', latest('Latest qualifying failure', qualifying, guided), win, guided, scope.filter ?? null),
        });
  }

  if (simulated.length > 0) {
    // Simulated jobs: counts only, never a rate
    const done = runs.flatMap((r) => simulated.map((k) => jobFacts(r, k))).filter((j) => j.finished);
    const firstTry = done.filter((j) => j.status === 'succeeded' && j.succeededAttempt === 1).length;
    const gaveUp = done.filter((j) => j.status === 'dead').length;
    const notes = [`Simulated: it never really delivers, so this isn't a delivery rate and stays out of the ${m.many.replace(/s$/, '')} numbers.`];
    tiles.push(done.length === 0
      ? {
          id: 'simulated', label: labels.simulated, value: 'None yet', hasValue: false,
          note: `No ${s.many.replace(/s$/, '')} has finished in this window.`,
          how: { rule: rules.simulated, working: 'None finished yet.', notes, source: sourceLine }, progress: null,
        }
      : {
          id: 'simulated', label: labels.simulated, value: `${firstTry} of ${done.length}`, hasValue: true,
          note: `finished on try 1${gaveUp > 0 ? `, ${gaveUp} gave up` : ''} · simulated`,
          how: { rule: rules.simulated, working: `${firstTry} of ${done.length}${gaveUp > 0 ? ` (${gaveUp} gave up)` : ''}`, notes, source: sourceLine },
          progress: null,
        });
  }

  // Enquiry to last job, 95th percentile
  const p95 = completionP95(runs, wf);
  const left = [
    p95.excluded.inFlight > 0 ? `${p95.excluded.inFlight} in progress` : null,
    p95.excluded.dead > 0 ? `${p95.excluded.dead} gave up` : null,
  ].filter((p) => p !== null);
  const p95Notes = [
    ...scheduledSteps(wf).map((k) => `${stepLabel(wf, k)} isn't counted: it runs ${delayText(stepSpec(wf, k).starts_after_s)} later.`),
    left.length === 0 ? 'Left out: none (no run in progress or gave up).' : `Left out: ${left.join(', ')}.`,
    WHY_P95_MIN,
  ];
  const complete = runs.filter((r) => completionSeconds(r, wf) !== null);
  const rank = Math.floor((95 * p95.n + 99) / 100);
  tiles.push(p95.value === null
    ? {
        id: 'completion_p95', label: labels.p95, value: 'No value yet', hasValue: false,
        note: `A percentile needs ${MIN_P95_RUNS} complete runs (demo threshold).`,
        how: { rule: rules.p95, working: `${p95.n} of the ${MIN_P95_RUNS} complete runs needed.`, notes: p95Notes, source: sourceLine },
        progress: progress(p95.n, MIN_P95_RUNS, 'complete runs', latest('Latest complete run', complete, guided), win, guided, scope.filter ?? null),
      }
    : {
        id: 'completion_p95', label: labels.p95, value: formatDuration(p95.value), hasValue: true,
        note: p95.n < SMALL_P95_RUNS ? `over ${p95.n} complete runs · a small sample: the slowest one or two set it` : `over ${p95.n} complete runs`,
        how: { rule: rules.p95, working: `n = ${p95.n} → position ${rank} → ${formatDuration(p95.value)}`, notes: p95Notes, source: sourceLine },
        progress: null,
      });

  return tiles;
}

function progress(have: number, need: number, noun: string, latestText: string | null, win: WindowKey, guided: boolean, filter: string | null): Progress {
  return { have, need, noun, latest: latestText, hint: windowHint(have, need, noun, win, guided, filter) };
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function p95Rule(wf: Workflow): string {
  const n = immediateSteps(wf).length;
  const which = n === 1 ? 'the job that starts right away' : n === 2 ? 'both jobs that start right away' : `all ${numberWord(n)} jobs that start right away`;
  return `For runs where ${which} succeeded: the time from the ${triggerOf(wf).one} until the last of them finished. ` +
    'The 95th percentile is the value at position ⌈0.95 × n⌉ when the times are sorted (nearest rank).';
}


const RUNS_NOTE: Record<DataSource, string> = {
  live: 'Test enquiries from the owner and from visitors, including one scheduled test a day.',
  recording: 'The recording holds one run.',
  file: 'The runs in your file.',
};

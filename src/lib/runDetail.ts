// One run, explained: the drawer's plain summary, "sent once?", each job's try chain and timeline.
// Unfinished jobs are described "at the last update", never as "now": the data can be stale. The summary
// is about the primary job (workflow.ts); what each result means comes from the feed's description.
import { errorText, eventTone, formatDuration, formatOffset, formatPlanned, formatUtcDay, type Tone } from './format';
import type { WindowKey } from './filters';
import type { DataSource } from './source';
import { completionSeconds, deliveryOf, jobFacts, retryWaits } from './metrics';
import { parseInstant, secondsBetween } from './time';
import { attemptChain, type AttemptOutcome } from './topology';
import type { Run, RunEvent, RunsPage, StepKind, Workflow } from './types';
import { delayText, flagsOf, primaryStep, resultOf, scheduledSteps, stepLabel, stepSpec, triggerOf } from './workflow';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const eventsOf = (run: Run, kind: StepKind): RunEvent[] => run.events.filter((e) => e.kind === kind);
const find = (run: Run, kind: StepKind, event: RunEvent['event'], attempt?: number) =>
  run.events.find((e) => e.kind === kind && e.event === event && (attempt === undefined || e.attempt === attempt));

// ----- level 1: the summary -----

export interface RunFact {
  /** `tries`, `sent`, `completion`, or `flag:` + a described flag's key. */
  id: string;
  label: string;
  value: string;
  /** How it's counted, in one sentence (the drawer's "How these are counted"). */
  how: string;
}

export type SentOnceAnswer = 'yes' | 'no' | 'not_yet' | 'unclear';

export interface RunSummary {
  /** About the primary job, the one that really delivers something. */
  headline: string;
  /** Every other job, in the description's order. */
  lines: string[];
  facts: RunFact[];
  sentOnce: { answer: SentOnceAnswer; text: string };
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** "the team notification", "an email" as prose needs them. */
const the = (wf: Workflow, kind: StepKind) => `the ${stepLabel(wf, kind).toLowerCase()}`;
const thing = (wf: Workflow, kind: StepKind) => stepSpec(wf, kind).delivers ?? 'result';

function primaryHeadline(run: Run, wf: Workflow): string {
  const kind = primaryStep(wf);
  const job = the(wf, kind);
  const noun = thing(wf, kind);
  const f = jobFacts(run, kind);
  const d = deliveryOf(run, kind, wf);
  const ok = find(run, kind, 'succeeded');
  const dead = find(run, kind, 'dead');
  const a = ok?.attempt ?? dead?.attempt ?? 0;
  const t = ok ? formatDuration(secondsBetween(run.created_at, ok.at)) : '';
  const meaning = resultOf(wf, kind, d.result).label;
  const came = `after the ${triggerOf(wf).one} came in`;
  switch (d.verdict) {
    case 'duplicate':
      return `${capital(job)} recorded ${f.succeededEvents} successes: the ${noun} may have gone out more than once.`;
    case 'sent_once':
      if (f.failures > 0) {
        return `${capital(job)} recovered after ${plural(f.failures, 'failed try', 'failed tries')}: one ${noun} was sent, ${t} ${came}.`;
      }
      return a === 1
        ? `${capital(job)} was sent on the first try, ${t} ${came}.`
        : `${capital(job)} was sent on try ${a}, ${t} ${came}.`;
    case 'simulated':
      return `${capital(job)} finished on try ${a} (${meaning}), so nothing was sent.`;
    case 'skipped':
      return `${capital(job)} was ${meaning} on try ${a}, so nothing was sent.`;
    case 'not_sent':
      return f.deadDetail === 'lease_expired'
        ? `${capital(job)} gave up: try ${a} never reported back. No ${noun} was sent.`
        : `${capital(job)} gave up after ${plural(a, 'try', 'tries')}. No ${noun} was sent.`;
    case 'pending':
      return f.status === 'retrying' && f.failures > 0
        ? `Not finished at the last update: ${job} failed ${plural(f.failures, 'time', 'times')} and was waiting to retry.`
        : `Not finished at the last update: ${job} was still in progress.`;
    case 'unknown':
      return `${capital(job)} finished with an unrecognized result: ${d.result ?? 'none'}.`;
  }
}

/** A job that runs right away, other than the primary one. */
function immediateLine(run: Run, kind: StepKind, wf: Workflow): string {
  const job = the(wf, kind);
  const f = jobFacts(run, kind);
  if (f.status === 'succeeded') {
    const r = resultOf(wf, kind, f.result);
    return r.outcome === 'simulated'
      ? `${capital(job)} was simulated on try ${f.succeededAttempt}: nothing was sent.`
      : `${capital(job)} finished on try ${f.succeededAttempt} with result ${r.outcome === 'unknown' ? (f.result ?? 'none') : r.label}.`;
  }
  if (f.status === 'dead') return `${capital(job)} gave up.`;
  return `${capital(job)} hadn't finished at the last update.`;
}

/** A job due later, e.g. a deletion days after the enquiry. */
function scheduledLine(run: Run, kind: StepKind, wf: Workflow, serverNow: string): string {
  const label = stepLabel(wf, kind);
  const step = run.steps.find((s) => s.kind === kind);
  if (!step) return `${label} was not scheduled for this run.`;
  const done = find(run, kind, 'succeeded');
  if (step.status === 'succeeded' && done) {
    return `${label} finished on ${formatUtcDay(done.at)} (${resultOf(wf, kind, done.detail).label}).`;
  }
  if (step.status === 'dead') return `${label} gave up.`;
  const due = parseInstant(step.run_after);
  if (due > parseInstant(serverNow)) {
    // In the delay's own unit: a deletion a week later reads "7 days", a receipt an hour later "1 hour".
    const after = delayText(Math.round((due - parseInstant(run.created_at)) / 1000));
    return `${label} is scheduled for ${formatUtcDay(step.run_after)}, ${after} after the ${triggerOf(wf).one}.`;
  }
  return `${label} was due on ${formatUtcDay(step.run_after)} and hadn't run at the last update.`;
}

function sentOnce(run: Run, wf: Workflow): RunSummary['sentOnce'] {
  const kind = primaryStep(wf);
  const noun = thing(wf, kind);
  const d = deliveryOf(run, kind, wf);
  const meaning = resultOf(wf, kind, d.result).label;
  switch (d.verdict) {
    case 'sent_once':
      return { answer: 'yes', text: `Yes. ${capital(the(wf, kind))} recorded exactly one success (result: ${d.result ?? 'none'}).` };
    case 'duplicate':
      return { answer: 'no', text: `No: ${d.succeededEvents} success events were recorded.` };
    case 'simulated':
      return { answer: 'no', text: `No ${noun} was sent: the result was ${meaning}.` };
    case 'skipped':
      return { answer: 'no', text: `No ${noun} was sent: ${meaning}.` };
    case 'not_sent':
      return { answer: 'no', text: `No ${noun} was sent: the job gave up.` };
    case 'pending':
      return { answer: 'not_yet', text: `Not yet: ${the(wf, kind)} hadn't finished at the last update.` };
    case 'unknown':
      return { answer: 'unclear', text: `Unclear: result ${d.result ?? 'none'}.` };
  }
}

/** `serverNow` is the page's `now`: it decides whether a scheduled job is still ahead or overdue. */
export function runSummary(run: Run, serverNow: string, wf: Workflow): RunSummary {
  const kind = primaryStep(wf);
  const label = stepLabel(wf, kind);
  const noun = thing(wf, kind);
  const step = run.steps.find((s) => s.kind === kind);
  const tries = eventsOf(run, kind).filter((e) => e.event === 'started').length;
  const delivery = deliveryOf(run, kind, wf);
  const sent = delivery.verdict === 'sent_once' || (delivery.verdict === 'duplicate' && resultOf(wf, kind, delivery.result).outcome === 'delivered')
    ? delivery.succeededEvents
    : 0;
  const completion = completionSeconds(run, wf);
  const scheduled = scheduledSteps(wf);
  const lines = wf.steps
    .filter((s) => s.kind !== kind)
    .map((s) => (s.starts_after_s > 0 ? scheduledLine(run, s.kind, wf, serverNow) : immediateLine(run, s.kind, wf)));
  const notCounted = scheduled
    .map((k) => ` ${stepLabel(wf, k)} isn't counted: it runs ${delayText(stepSpec(wf, k).starts_after_s)} later.`)
    .join('');
  return {
    headline: primaryHeadline(run, wf),
    lines,
    facts: [
      {
        id: 'tries', label: `${label} tries`, value: `${tries} of ${step?.max_attempts ?? '?'} allowed`,
        how: `Tries started, out of the ${step?.max_attempts ?? '?'} allowed.`,
      },
      {
        id: 'sent', label: `${capital(noun)}s sent`, value: String(sent),
        how: "Successful tries whose result means it was really sent. Simulated results aren't counted.",
      },
      {
        id: 'completion', label: `${triggerOf(wf).One} to last job`, value: completion === null ? 'Not complete' : formatDuration(completion),
        how: `From the ${triggerOf(wf).one} until the last of the jobs that start right away finished.${notCounted}`,
      },
      ...flagsOf(wf, run).map(({ flag, on }) => ({
        id: `flag:${flag.key}`, label: flag.label, value: on ? `On (${flag.effect})` : 'Off',
        how: `A test switch set on this run. When it's on, it ${flag.effect}.`,
      })),
    ],
    sentOnce: sentOnce(run, wf),
  };
}

// ----- level 2: each step -----

export interface ChainLink {
  attempt: number;
  /** `waiting`: a retry is planned and hasn't started. */
  outcome: AttemptOutcome | 'waiting';
  /** "failed", "succeeded", … */
  label: string;
  tone: Tone;
  /** The measured wait before this try, "waiting" while a retry is due, or null. */
  waitBefore: string | null;
}

const OUTCOME: Record<AttemptOutcome, { label: string; tone: Tone }> = {
  succeeded: { label: 'succeeded', tone: 'ok' },
  failed: { label: 'failed', tone: 'retry' },
  dead: { label: 'gave up', tone: 'dead' },
  lease_expired: { label: 'never reported back', tone: 'noresult' },
  running: { label: 'running', tone: 'neutral' },
};

/** A success says what it did, by what the description says the result means. */
const SUCCESS: Record<string, { label: string; tone: Tone }> = {
  delivered: { label: 'sent', tone: 'ok' },
  simulated: { label: 'simulated', tone: 'simulated' },
  skipped: { label: 'skipped', tone: 'neutral' },
  done: { label: 'done', tone: 'ok' },
};

/** One run's tries for one job, as drawn in the drawer: ✕ ─ 10.2 s ─ ✕ ─ 30.2 s ─ ✓. */
export function runChain(run: Run, kind: StepKind, wf: Workflow): ChainLink[] {
  const chain = attemptChain(run, kind);
  const links: ChainLink[] = chain.map((a, i) => {
    const wait = chain[i - 1]?.wait ?? null;
    const look = (a.outcome === 'succeeded' ? SUCCESS[resultOf(wf, kind, a.detail).outcome] : undefined) ?? OUTCOME[a.outcome];
    return {
      attempt: a.attempt,
      outcome: a.outcome,
      label: look.label,
      tone: look.tone,
      waitBefore: wait === null || wait.actualS === null ? null : formatDuration(wait.actualS),
    };
  });
  // A failure whose retry hasn't started yet: the chain ends in a wait.
  const last = chain.at(-1);
  if (last?.wait && last.wait.actualS === null) {
    links.push({ attempt: last.attempt + 1, outcome: 'waiting', label: 'not started yet', tone: 'neutral', waitBefore: 'waiting' });
  }
  return links;
}

/** The chain for a screen reader: "Try 1 failed, waited 10.2 s, try 2 failed, …". */
export const chainText = (links: ChainLink[]): string =>
  links.map((l, i) => `${l.waitBefore === null ? '' : l.waitBefore === 'waiting' ? 'waiting, ' : `waited ${l.waitBefore}, `}${i === 0 ? 'Try' : 'try'} ${l.attempt} ${l.label}`).join(', ');

export interface TimelineRow {
  key: string;
  at: string;
  /** "+0.4 s" after the lead. */
  offset: string;
  text: string;
  note: string | null;
  tone: Tone;
}

function succeededText(kind: StepKind, e: RunEvent, wf: Workflow): string {
  const a = `Try ${e.attempt}`;
  const r = resultOf(wf, kind, e.detail);
  switch (r.outcome) {
    case 'delivered':
    case 'done':
      return `${a} succeeded: ${r.label}`;
    case 'simulated':
      return `${a} finished: ${r.label}`;
    case 'skipped':
      return `${a} finished: ${r.label} (nothing sent)`;
    case 'unknown':
      return `${a} finished: result ${e.detail ?? 'none'}`;
  }
}

function waitNote(actualS: number, plannedS: number): string {
  const diff = actualS - plannedS;
  const how = Math.abs(diff) < 0.05 ? 'on time' : `${formatDuration(Math.abs(diff))} ${diff > 0 ? 'later' : 'earlier'}`;
  return `Waited ${formatDuration(actualS)}, planned ${formatPlanned(plannedS)} (${how})`;
}

/** Every event of one job as a row, with the retry plan joined to its failure (9 events → 7 rows for the recorded run). */
export function stepTimeline(run: Run, kind: StepKind, wf: Workflow): TimelineRow[] {
  const events = eventsOf(run, kind);
  const step = run.steps.find((s) => s.kind === kind);
  const waits = retryWaits(run, kind);
  const chain = attemptChain(run, kind);
  const offset = (at: string) => secondsBetween(run.created_at, at);
  const rows: TimelineRow[] = [];

  events.forEach((e, i) => {
    const row = (text: string, note: string | null, tone: Tone) =>
      rows.push({ key: `${i}|${e.event}|${e.attempt}`, at: e.at, offset: formatOffset(offset(e.at)), text, note, tone });
    switch (e.event) {
      case 'queued':
        if (stepSpec(wf, kind).starts_after_s > 0) row(`Scheduled when the ${triggerOf(wf).one} came in`, step ? `Due ${formatUtcDay(step.run_after)}` : null, 'neutral');
        else row(`Queued when the ${triggerOf(wf).one} came in`, null, 'neutral');
        break;
      case 'started': {
        let note: string | null = null;
        const wait = waits.find((w) => w.attempt === e.attempt - 1);
        if (wait && wait.actualS !== null) note = waitNote(wait.actualS, wait.plannedS);
        else if (chain.find((c) => c.attempt === e.attempt - 1)?.outcome === 'lease_expired') {
          note = `Try ${e.attempt - 1} never reported back, so the job was started again.`;
        }
        row(`Try ${e.attempt} started`, note, 'neutral');
        break;
      }
      case 'failed': {
        const retry = find(run, kind, 'retry_scheduled', e.attempt);
        const planned = retry ? Number(retry.detail) : null;
        row(
          `Try ${e.attempt} failed: ${errorText(wf, e.detail)}`,
          retry && planned !== null ? `Retry planned for ${formatOffset(offset(retry.at) + planned)} (${formatPlanned(planned)} wait)` : null,
          retry ? 'retry' : 'dead',
        );
        break;
      }
      case 'retry_scheduled':
        // Joined to its failure; a retry plan without one (never seen) still gets a row.
        if (!find(run, kind, 'failed', e.attempt)) row(`Retry planned in ${formatPlanned(Number(e.detail))}`, null, 'retry');
        break;
      case 'succeeded':
        row(succeededText(kind, e, wf), null, eventTone(e, wf));
        break;
      case 'dead':
        row(
          e.detail === 'lease_expired' ? `Gave up: try ${e.attempt} never reported back` : `Gave up after ${plural(e.attempt, 'try', 'tries')}`,
          null,
          'dead',
        );
        break;
    }
  });
  return rows;
}

// ----- finding the run -----

export type MissingReason = 'window' | 'truncated' | 'unknown' | 'recording' | 'file';

export type RunLookup = { kind: 'loading' } | { kind: 'found'; run: Run } | { kind: 'missing'; reason: MissingReason };

/** The run behind `run=` in the data on screen, or why it isn't there. */
export function lookupRun(id: string, page: RunsPage | null, { source, win }: { source: DataSource; win: WindowKey }): RunLookup {
  if (page === null) return { kind: 'loading' };
  const run = page.runs.find((r) => r.run_id === id);
  if (run) return { kind: 'found', run };
  if (source === 'recording') return { kind: 'missing', reason: 'recording' };
  if (win !== 'all') return { kind: 'missing', reason: 'window' };
  if (source === 'file') return { kind: 'missing', reason: page.truncated ? 'truncated' : 'file' };
  return { kind: 'missing', reason: page.truncated ? 'truncated' : 'unknown' };
}

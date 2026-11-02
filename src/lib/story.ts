// The guided story at /story: five beats through the recorded run. Each beat asks first and shows the
// evidence after an answer or a skip; nothing is locked. Every finding, every answer and every number
// is computed from the run, never typed in.
import { errorText, formatDuration } from './format';
import { completionSeconds, deliveryOf, jobFacts, retryWaits } from './metrics';
import { runSummary } from './runDetail';
import { secondsBetween } from './time';
import { attemptChain } from './topology';
import type { Run, StepKind, Workflow } from './types';
import type { UrlState } from './urlState';
import { errorOf, isScheduled, primaryStep, resultOf, simulatedOutageOf, stepLabel, stepSpec } from './workflow';

/** How the console's recorded-run mode is entered: a clean overview. */
export const GUIDED_RESET = {
  mode: 'guided', view: 'overview', step: null, attempt: null, event: null, run: null, flags: null,
} as const satisfies Partial<UrlState>;

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** The try that ended the team notification (its success or its give-up), or the last one started. */
export function finalTry(run: Run, wf: Workflow): number {
  return attemptChain(run, primaryStep(wf)).at(-1)?.attempt ?? 1;
}

const successEvents = (run: Run, wf: Workflow) => run.events.filter((e) => e.kind === primaryStep(wf) && e.event === 'succeeded');

// ----- the findings -----

export function findJob(run: Run, wf: Workflow): string {
  const chain = attemptChain(run, primaryStep(wf));
  const failed = chain.filter((a) => a.outcome === 'failed' || a.outcome === 'dead');
  const last = chain.at(-1);
  const label = stepLabel(wf, primaryStep(wf));
  const noun = stepSpec(wf, primaryStep(wf)).delivers ?? 'result';
  if (!last) return `The ${label.toLowerCase()} never started.`;
  let end = `try ${last.attempt} is still running`;
  if (last.outcome === 'succeeded') {
    end = resultOf(wf, primaryStep(wf), last.detail).outcome === 'delivered'
      ? `try ${last.attempt} sent the ${noun}`
      : `try ${last.attempt} finished without sending (result: ${last.detail ?? 'none'})`;
  } else if (last.outcome === 'dead') end = `it gave up on try ${last.attempt}`;
  else if (last.outcome === 'failed') end = `a retry was still planned`;
  if (failed.length === 0) return `${label}: ${end}, with no failure before it.`;
  const failedTries = failed.filter((a) => a !== last || last.outcome !== 'dead').map((a) => `try ${a.attempt}`);
  const cause = errorText(wf, failed[0]?.detail ?? null);
  return failedTries.length === 0
    ? `${label}: ${end} (${cause}).`
    : `${label}: ${list(failedTries)} failed (${cause}), then ${end}.`;
}

export function recovery(run: Run, wf: Workflow): string {
  const f = jobFacts(run, primaryStep(wf));
  // Planned vs actual waits stay in the wait bars; in a sentence they were noise (usability gate, Q9).
  const waits = retryWaits(run, primaryStep(wf))
    .filter((w) => w.actualS !== null)
    .map((w) => formatDuration(w.actualS ?? 0));
  if (f.status === 'succeeded' && f.failures > 0) {
    const noun = stepSpec(wf, primaryStep(wf)).delivers ?? 'result';
    const what = resultOf(wf, primaryStep(wf), f.result).outcome === 'delivered' ? `sent the ${noun}` : `finished (result: ${f.result ?? 'none'})`;
    const after = waits.length > 0 ? `, after waits of ${list(waits)} between tries` : '';
    return `Yes. Try ${f.succeededAttempt} ${what}${after}.`;
  }
  if (f.status === 'succeeded') return `It didn't need to: try ${f.succeededAttempt} succeeded with no failure before it.`;
  return `No. ${runSummary(run, run.created_at, wf).headline}`;
}

function waitedS(run: Run, wf: Workflow): number {
  return retryWaits(run, primaryStep(wf)).reduce((sum, w) => sum + (w.actualS ?? 0), 0);
}

export function duration(run: Run, wf: Workflow): string {
  const s = completionSeconds(run, wf);
  if (s === null) return `The run never completed: ${runSummary(run, run.created_at, wf).headline}`;
  const waited = waitedS(run, wf);
  return waited > 0
    ? `${formatDuration(s)} from the enquiry until the last job finished. ${formatDuration(waited)} of it was waiting between tries, on purpose.`
    : `${formatDuration(s)} from the enquiry until the last job finished, with no waiting between tries.`;
}

const failedEvents = (run: Run, wf: Workflow) => run.events.filter((e) => e.kind === primaryStep(wf) && e.event === 'failed');

/**
 * How many times the team email was sent, in plain words. Checkpoint A: a newcomer read each try as a
 * send, so a failed try is said to have sent nothing, but only for the outage switch, which Northstar's
 * code stops before the email service is contacted. Another error may have reached it.
 */
export function sentOnce(run: Run, wf: Workflow): string {
  const d = deliveryOf(run, primaryStep(wf), wf);
  const n = successEvents(run, wf).length;
  const noun = stepSpec(wf, primaryStep(wf)).delivers ?? 'result';
  if (d.verdict === 'sent_once') {
    const sent = jobFacts(run, primaryStep(wf)).succeededAttempt ?? 1;
    const failed = failedEvents(run, wf);
    if (failed.length === 0) return `Once. Try ${sent} sent the ${noun}.`;
    if (failed.every((e) => errorOf(wf, e.detail).sendsNothing)) {
      const one = failed.length === 1;
      const names = list(failed.map((e) => String(e.attempt)));
      const service = simulatedOutageOf(wf, run, primaryStep(wf), failed[0]?.detail ?? null);
      const stop = service === null ? '' : ` (the outage switch stops there)`;
      return `Once. Try ${sent} sent the ${noun}. ${one ? 'Try' : 'Tries'} ${names} failed before Northstar contacted the ` +
        `${service ?? 'outside service'}${stop}, so ${one ? 'it' : 'they'} sent nothing.`;
    }
    return `Once: try ${sent} is the only try that recorded "${d.result ?? ''}".`;
  }
  if (d.verdict === 'duplicate') return `More than once: Northstar recorded ${n} successes, so the ${noun} may have gone out more than once.`;
  if (n === 1) return `Not at all: the one success had the result "${d.result ?? 'none'}", so nothing was sent.`;
  return `Not at all: the ${stepLabel(wf, primaryStep(wf)).toLowerCase()} never succeeded, so the ${noun} was never sent.`;
}

/** Beat 4's count line, e.g. "3 tries · 2 failed · 1 sent". */
export function sendCount(run: Run, wf: Workflow): string {
  const chain = attemptChain(run, primaryStep(wf));
  const failed = chain.filter((a) => a.outcome === 'failed' || a.outcome === 'dead').length;
  const sent = successEvents(run, wf).filter((e) => resultOf(wf, e.kind, e.detail).outcome === 'delivered').length;
  return `${chain.length} ${chain.length === 1 ? 'try' : 'tries'} · ${failed} failed · ${sent} sent`;
}

// ----- the beats -----

export interface Beat {
  n: number;
  title: string;
}

export const BEATS: readonly Beat[] = [
  { n: 1, title: 'Which job failed?' },
  { n: 2, title: 'Watch it happen' },
  { n: 3, title: 'Did it recover?' },
  { n: 4, title: 'Was it sent twice?' },
  { n: 5, title: 'Your verdict' },
];

/** The beat in `?beat=n` (1–5); anything else is beat 1. */
export function parseBeat(search: string): number {
  const text = new URLSearchParams(search).get('beat');
  return text !== null && /^[1-5]$/.test(text) ? Number(text) : 1;
}

/** `?beat=n`, or '' for beat 1, so the plain /story is the start. */
export const serializeBeat = (n: number): string => (n === 1 ? '' : `?beat=${n}`);

/** Beat 1: the visitor guesses which job failed. The answer is the job with a recorded failure. */
export function failingJob(run: Run): StepKind | null {
  return run.events.find((e) => e.event === 'failed')?.kind ?? null;
}

/** "the team notification. Try 1 failed because …", or null when nothing failed. */
function failureSentence(run: Run, wf: Workflow): string | null {
  const first = run.events.find((e) => e.event === 'failed');
  if (!first) return null;
  const service = simulatedOutageOf(wf, run, first.kind, first.detail);
  const cause = service !== null ? `the ${service} was down (a simulated outage)` : errorText(wf, first.detail);
  return `the ${stepLabel(wf, first.kind).toLowerCase()}. Try ${first.attempt} failed because ${cause}.`;
}

/** Beat 1 after a skip: the answer, without marking anything. */
export function sceneAnswer(run: Run, wf: Workflow): string {
  const sentence = failureSentence(run, wf);
  return sentence === null ? 'No job failed in this run.' : `It was ${sentence}`;
}

export function sceneFeedback(run: Run, picked: StepKind, wf: Workflow): { right: boolean; text: string } {
  const failing = failingJob(run);
  if (failing !== null && picked === failing) return { right: true, text: `Right: ${failureSentence(run, wf) ?? ''}` };
  const answer = failing === null ? 'No job failed in this run.' : `The ${stepLabel(wf, failing).toLowerCase()} is the one that failed.`;
  let why = `the ${stepLabel(wf, picked).toLowerCase()} didn't fail.`;
  const facts = jobFacts(run, picked);
  if (isScheduled(wf, picked) && facts.status === 'queued') {
    const step = run.steps.find((s) => s.kind === picked);
    const day = step ? Math.round(secondsBetween(run.created_at, step.run_after) / 86_400) : null;
    why = `the ${stepLabel(wf, picked).toLowerCase()} doesn't run until day ${day ?? '?'}.`;
  } else if (facts.status === 'succeeded' && facts.failures === 0) {
    why = `the ${stepLabel(wf, picked).toLowerCase()} went through on try ${facts.succeededAttempt ?? 1}.`;
  }
  return { right: false, text: `Not this one: ${why} ${answer}` };
}

/** Beat 3: the time from the enquiry to the team email, split into waiting and working. Rounded once, at display. */
export interface Breakdown {
  totalS: number;
  waitingS: number;
  workingS: number;
  /** The working time's parts: the first pickup and each try. They add up to workingS before rounding. */
  parts: { label: string; s: number }[];
  /** The parts rounded to 0.1 s one by one and added, which can differ from workingS rounded once. */
  partsRoundedSumS: number;
}

const tenth = (s: number) => Math.round(s * 10) / 10;

export function recoveryBreakdown(run: Run, wf: Workflow): Breakdown | null {
  const chain = attemptChain(run, primaryStep(wf));
  const last = chain.at(-1);
  const first = chain[0];
  if (!first || last?.outcome !== 'succeeded' || last.endedAt === null) return null;
  const at = (iso: string) => secondsBetween(run.created_at, iso);
  const totalS = at(last.endedAt);
  const waitingS = waitedS(run, wf);
  const parts = [
    { label: 'first pickup', s: at(first.startedAt) },
    ...chain.map((t) => ({ label: `try ${t.attempt}`, s: t.endedAt === null ? 0 : at(t.endedAt) - at(t.startedAt) })),
  ];
  const partsRoundedSumS = tenth(parts.reduce((sum, p) => sum + tenth(p.s), 0));
  return { totalS, waitingS, workingS: totalS - waitingS, parts, partsRoundedSumS };
}

// ----- the conclusion -----

export const QUESTIONS = [
  {
    id: 'recovered',
    text: 'Did the team notification recover?',
    choices: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
  },
  {
    id: 'duration',
    text: 'How long from the enquiry to the last job?',
    choices: [
      { value: 'under_10s', label: 'Under 10 s' },
      { value: '10s_1min', label: '10 s to 1 min' },
      { value: 'over_1min', label: 'Over 1 min' },
      { value: 'never', label: 'It never finished' },
    ],
  },
  {
    id: 'sent',
    text: "How many times was the team's email sent?",
    choices: [
      { value: 'once', label: 'Once' },
      { value: 'more', label: 'More than once' },
      { value: 'none', label: 'Not at all' },
    ],
  },
] as const;

export type QuestionId = (typeof QUESTIONS)[number]['id'];
export type Answers = Partial<Record<QuestionId, string>>;

export function correctChoice(run: Run, id: QuestionId, wf: Workflow): string {
  switch (id) {
    case 'recovered': {
      const f = jobFacts(run, primaryStep(wf));
      return f.status === 'succeeded' && f.failures > 0 ? 'yes' : 'no';
    }
    case 'duration': {
      const s = completionSeconds(run, wf);
      if (s === null) return 'never';
      return s < 10 ? 'under_10s' : s < 60 ? '10s_1min' : 'over_1min';
    }
    case 'sent': {
      const v = deliveryOf(run, primaryStep(wf), wf).verdict;
      return v === 'sent_once' ? 'once' : v === 'duplicate' ? 'more' : 'none';
    }
  }
}

const FACT: Record<QuestionId, (run: Run, wf: Workflow) => string> = { recovered: recovery, duration, sent: sentOnce };

/** What the data says for a question, whatever the visitor answered. */
export const factFor = (run: Run, id: QuestionId, wf: Workflow): string => FACT[id](run, wf);

export interface Check {
  id: QuestionId;
  right: boolean;
  /** "✓ Right: …" or "✕ The data says: …" */
  text: string;
}

/** Each answered question, marked against the run. Unanswered questions are left out. */
export function checkAnswers(run: Run, answers: Answers, wf: Workflow): Check[] {
  return QUESTIONS.flatMap((q) => {
    const answer = answers[q.id];
    if (answer === undefined) return [];
    const right = answer === correctChoice(run, q.id, wf);
    return [{ id: q.id, right, text: `${right ? 'Right' : 'The data says'}: ${FACT[q.id](run, wf)}` }];
  });
}

/** Beat 5: one row per question. "Your answer" and "the data" stay apart; a skip is neutral, never wrong. */
export interface VerdictRow {
  id: QuestionId;
  question: string;
  /** The label of the visitor's choice, or null when they didn't answer. */
  answer: string | null;
  /** The label of the data's choice. */
  data: string;
  /** null when not answered. */
  right: boolean | null;
  fact: string;
}

export function verdictRows(run: Run, answers: Answers, wf: Workflow): VerdictRow[] {
  return QUESTIONS.map((q) => {
    const labelOf = (value: string | undefined) => q.choices.find((c) => c.value === value)?.label ?? null;
    const given = answers[q.id];
    const correct = correctChoice(run, q.id, wf);
    return {
      id: q.id,
      question: q.text,
      answer: labelOf(given),
      data: labelOf(correct) ?? correct,
      right: given === undefined ? null : given === correct,
      fact: FACT[q.id](run, wf),
    };
  });
}

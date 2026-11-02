// The guided story's replay: one recorded run as a timeline of moments. Real gaps longer than
// COMPRESS_ABOVE_S play in WAIT_SHOWN_S; shorter ones play in real time. The clock always reads real
// time (interpolated), so the replay never changes a recorded timestamp or the run's total.
import { errorText, formatDuration, formatPlanned, formatOffset } from './format';
import { deliveryOf } from './metrics';
import { secondsBetween } from './time';
import { attemptChain } from './topology';
import type { Run, RunEvent, StepKind, Workflow } from './types';
import { errorOf, immediateSteps, primaryStep, resultOf, simulatedOutageOf, stepLabel, stepSpec } from './workflow';

export const COMPRESS_ABOVE_S = 2;
export const WAIT_SHOWN_S = 2.5;
/** Within this, a measured wait counts as "as planned". */
const ON_PLAN_S = 0.5;

export type MomentShape = 'lead' | 'neutral' | 'retry' | 'ok' | 'simulated' | 'dead';

export interface Moment {
  /** Seconds after the enquiry, as recorded. */
  realS: number;
  /** Seconds into the replay. */
  displayS: number;
  /** "+10.9 s" */
  time: string;
  lane: 'team' | 'visitor' | null;
  attempt: number;
  text: string;
  shape: MomentShape;
}

export interface Segment {
  fromReal: number;
  toReal: number;
  fromDisplay: number;
  toDisplay: number;
  compressed: boolean;
}

export interface ReplayWait {
  afterTry: number;
  plannedS: number;
  realS: number;
  /** How long the wait takes in the replay. */
  shownS: number;
  /** "real wait 10.2 s · shown in 3.1 s" */
  label: string;
}

export interface ReplayModel {
  moments: Moment[];
  segments: Segment[];
  waits: ReplayWait[];
  totalRealS: number;
  totalDisplayS: number;
  /** The team notification's last word, true whatever the run did ("Try 3 sent the email…", "Try 2 is still running"). */
  ending: string;
}

/** The replay's two lanes: the primary job ("team"), and the other jobs that run right away ("visitor"). */
function laneOf(wf: Workflow, kind: StepKind): 'team' | 'visitor' | null {
  if (kind === primaryStep(wf)) return 'team';
  return immediateSteps(wf).includes(kind) ? 'visitor' : null;
}
const EPS = 1e-9;

function teamEnding(run: Run, wf: Workflow): string {
  const chain = attemptChain(run, primaryStep(wf));
  const last = chain.at(-1);
  if (!last) return 'No result recorded.';
  if (last.outcome === 'succeeded') return successText(run, wf, last.attempt, last.detail);
  if (last.outcome === 'dead') return deadText(last.attempt, last.detail);
  if (last.outcome === 'failed' && last.wait !== null) return `Try ${last.attempt} failed; a retry is still planned.`;
  return `Try ${last.attempt} is still running.`;
}

function successText(run: Run, wf: Workflow, attempt: number, detail: string | null): string {
  const kind = primaryStep(wf);
  const r = resultOf(wf, kind, detail);
  const noun = stepSpec(wf, kind).delivers ?? 'result';
  if (r.outcome === 'delivered') {
    return deliveryOf(run, kind, wf).verdict === 'sent_once'
      ? `Try ${attempt} sent the ${noun}. It's the only "${detail ?? ''}" result recorded.`
      : `Try ${attempt} sent the ${noun}.`;
  }
  if (r.outcome === 'simulated') return `Try ${attempt} finished: ${r.label}.`;
  if (r.outcome === 'skipped') return `Try ${attempt} finished: ${r.label} (nothing sent).`;
  return `Try ${attempt} finished: result ${detail ?? 'none'}.`;
}

const deadText = (attempt: number, detail: string | null) =>
  detail === 'lease_expired' ? `Gave up: try ${attempt} never reported back.` : `Gave up after ${attempt} ${attempt === 1 ? 'try' : 'tries'}.`;

// Only an error the description says sends nothing (the outage switch fails a try before the email
// service is contacted) gets "nothing was sent"; any other error may have reached the outside service.
function causeText(wf: Workflow, run: Run, kind: StepKind, code: string | null, previous: string | null): string {
  const nothingSent = errorOf(wf, code).sendsNothing ? ', so nothing was sent' : '';
  if (code !== null && code === previous) return `still down${nothingSent}`;
  const service = simulatedOutageOf(wf, run, kind, code);
  return service !== null ? `the ${service} is down (simulated)${nothingSent}` : `${errorText(wf, code)}${nothingSent}`;
}

/** The run's moments in recorded order, before display times are added. */
function rawMoments(run: Run, wf: Workflow): Omit<Moment, 'displayS'>[] {
  const at = (e: RunEvent) => secondsBetween(run.created_at, e.at);
  const waits = attemptChain(run, primaryStep(wf));
  const out: Omit<Moment, 'displayS'>[] = [
    { realS: 0, time: formatOffset(0), lane: null, attempt: 0, text: 'An enquiry is saved. Three jobs are queued.', shape: 'lead' },
  ];
  const lastCause: Partial<Record<StepKind, string | null>> = {};
  for (const e of run.events) {
    const lane = laneOf(wf, e.kind);
    if (!lane) continue; // a job due later (e.g. on day 7) is outside the replay
    const label = stepLabel(wf, e.kind);
    const push = (text: string, shape: MomentShape) =>
      out.push({ realS: at(e), time: formatOffset(at(e)), lane, attempt: e.attempt, text, shape });
    switch (e.event) {
      case 'started': {
        const wait = lane === 'team' ? waits.find((w) => w.attempt === e.attempt - 1)?.wait : undefined;
        if (wait && wait.actualS !== null) {
          const plan = Math.abs(wait.actualS - wait.plannedS) < ON_PLAN_S ? 'as planned' : 'planned';
          push(`Waited ${formatDuration(wait.actualS)}, ${plan} (${formatPlanned(wait.plannedS)}). Try ${e.attempt} starts.`, 'neutral');
        } else {
          push(`${label}, try ${e.attempt} starts.`, 'neutral');
        }
        break;
      }
      case 'failed': {
        const cause = causeText(wf, run, e.kind, e.detail, lastCause[e.kind] ?? null);
        lastCause[e.kind] = e.detail;
        const retry = run.events.find((r) => r.kind === e.kind && r.event === 'retry_scheduled' && r.attempt === e.attempt);
        const plan = retry ? ` Northstar plans a retry in ${formatPlanned(Number(retry.detail))}.` : '';
        const who = lane === 'team' ? `Try ${e.attempt}` : `${label}, try ${e.attempt}`;
        push(`${who} failed: ${cause}.${plan}`, 'retry');
        break;
      }
      case 'succeeded':
        if (lane === 'team') {
          push(successText(run, wf, e.attempt, e.detail), resultOf(wf, e.kind, e.detail).outcome === 'delivered' ? 'ok' : 'simulated');
        } else {
          const spec = stepSpec(wf, e.kind);
          push(spec.always_simulated && spec.delivers !== null
            ? `${label} worked on try ${e.attempt} (simulated: no ${spec.delivers} goes out).`
            : `${label} worked on try ${e.attempt} (${resultOf(wf, e.kind, e.detail).label}).`, 'simulated');
        }
        break;
      case 'dead':
        push(lane === 'team' ? deadText(e.attempt, e.detail) : `${label}: ${deadText(e.attempt, e.detail).toLowerCase()}`, 'dead');
        break;
      default:
        break; // queued: the first moment; retry_scheduled: part of its failure
    }
  }
  return out;
}

export function replayModel(run: Run, wf: Workflow): ReplayModel {
  const raw = rawMoments(run, wf);
  const segments: Segment[] = [];
  let display = 0;
  for (let i = 1; i < raw.length; i++) {
    const from = raw[i - 1]?.realS ?? 0;
    const to = raw[i]?.realS ?? 0;
    if (to - from <= EPS) continue;
    const compressed = to - from > COMPRESS_ABOVE_S;
    const length = compressed ? WAIT_SHOWN_S : to - from;
    segments.push({ fromReal: from, toReal: to, fromDisplay: display, toDisplay: display + length, compressed });
    display += length;
  }
  const model: ReplayModel = {
    moments: [], segments, waits: [], totalRealS: raw.at(-1)?.realS ?? 0, totalDisplayS: display, ending: teamEnding(run, wf),
  };
  model.moments = raw.map((m) => ({ ...m, displayS: displayAt(model, m.realS) }));
  model.waits = attemptChain(run, primaryStep(wf)).flatMap((t) => {
    if (t.wait === null || t.wait.actualS === null || t.endedAt === null) return [];
    const start = secondsBetween(run.created_at, t.endedAt);
    const shownS = displayAt(model, start + t.wait.actualS) - displayAt(model, start);
    return [{
      afterTry: t.attempt, plannedS: t.wait.plannedS, realS: t.wait.actualS, shownS,
      label: `real wait ${formatDuration(t.wait.actualS)} · shown in ${formatDuration(shownS)}`,
    }];
  });
  return model;
}

/** Replay seconds for a recorded time (clamped to the run). */
export function displayAt(model: Pick<ReplayModel, 'segments'>, realS: number): number {
  for (const s of model.segments) {
    if (realS <= s.toReal + EPS) {
      if (realS <= s.fromReal) return s.fromDisplay;
      return s.fromDisplay + ((realS - s.fromReal) / (s.toReal - s.fromReal)) * (s.toDisplay - s.fromDisplay);
    }
  }
  return model.segments.at(-1)?.toDisplay ?? 0;
}

/** The recorded time the clock shows at a replay position (clamped to the run). */
export function realAt(model: Pick<ReplayModel, 'segments'>, displayS: number): number {
  for (const s of model.segments) {
    if (displayS <= s.toDisplay + EPS) {
      if (displayS <= s.fromDisplay) return s.fromReal;
      return s.fromReal + ((displayS - s.fromDisplay) / (s.toDisplay - s.fromDisplay)) * (s.toReal - s.fromReal);
    }
  }
  return model.segments.at(-1)?.toReal ?? 0;
}

/** How many moments have happened at a replay position (at least the first). */
export function momentsShown(model: ReplayModel, displayS: number): number {
  return Math.max(1, model.moments.filter((m) => m.displayS <= displayS + EPS).length);
}

/** The next moment's replay time after `displayS`, or the end. */
export function nextStop(model: ReplayModel, displayS: number): number {
  return model.moments.find((m) => m.displayS > displayS + 1e-6)?.displayS ?? model.totalDisplayS;
}

/** The previous moment's replay time before `displayS`, or the start. */
export function prevStop(model: ReplayModel, displayS: number): number {
  return [...model.moments].reverse().find((m) => m.displayS < displayS - 1e-6)?.displayS ?? 0;
}

/** Reduced motion: no autoplay, no animated head, only steps between still frames. */
export const playbackMode = (reducedMotion: boolean): 'animate' | 'step' => (reducedMotion ? 'step' : 'animate');

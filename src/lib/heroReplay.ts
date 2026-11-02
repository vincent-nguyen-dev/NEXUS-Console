// The landing hero plays the recorded run (step 5.3a, checkpoint A's S6): one moment at a time over the story's
// replay model (replay.ts), with a scrubber. This module says what the hero shows at a replay position: how far the
// figure is drawn, which wait is running, the caption, and which of NEXUS's three promises the moment is about.
import { formatDuration } from './format';
import { deliveryOf } from './metrics';
import { momentsShown, type ReplayModel, type ReplayWait } from './replay';
import { runStory } from './runStory';
import type { Run, Workflow } from './types';
import { primaryStep } from './workflow';

/** The band's three promises (5.3b): what ran, what retried, was anything sent twice. */
export type HeroPromise = 'ran' | 'retried' | 'twice';

/** The figure at a replay position: moments drawn, the team tries ended or started, the wait running (if any). */
export interface HeroFrame {
  shown: number;
  /** The primary job's tries that have ended, with how ("failed" or "sent"; any other ending is "other"). */
  ended: Map<number, 'failed' | 'sent' | 'other'>;
  /** The primary job's tries that have started. */
  started: Set<number>;
  /** Whether the other immediate job (the visitor confirmation) has started, and finished. */
  visitor: 'none' | 'started' | 'done';
  /** The wait running now, or null. */
  wait: ReplayWait | null;
}

const EPS = 1e-6;

/** The wait between the try that failed (its moment) and the next try's start, by replay time. */
function waitSpans(model: ReplayModel): { wait: ReplayWait; from: number; to: number }[] {
  return model.waits.flatMap((w) => {
    const failed = model.moments.find((m) => m.lane === 'team' && m.attempt === w.afterTry && m.shape === 'retry');
    const next = model.moments.find((m) => m.lane === 'team' && m.attempt === w.afterTry + 1);
    return failed && next ? [{ wait: w, from: failed.displayS, to: next.displayS }] : [];
  });
}

export function frameAt(model: ReplayModel, displayS: number): HeroFrame {
  const shown = momentsShown(model, displayS);
  const past = model.moments.slice(0, shown);
  const ended = new Map<number, 'failed' | 'sent' | 'other'>();
  const started = new Set<number>();
  let visitor: HeroFrame['visitor'] = 'none';
  for (const m of past) {
    if (m.lane === 'team') {
      started.add(m.attempt);
      if (m.shape === 'retry' || m.shape === 'dead') ended.set(m.attempt, 'failed');
      else if (m.shape === 'ok') ended.set(m.attempt, 'sent');
      else if (m.shape === 'simulated') ended.set(m.attempt, 'other');
    }
    if (m.lane === 'visitor') visitor = m.shape === 'neutral' ? (visitor === 'done' ? 'done' : 'started') : 'done';
  }
  const span = waitSpans(model).find((s) => displayS > s.from + EPS && displayS < s.to - EPS) ?? null;
  return { shown, ended, started, visitor, wait: span?.wait ?? null };
}

/** The hero at rest: the run's whole story in one sentence, computed from the run (never typed). */
export function restCaption(run: Run, wf: Workflow, model: ReplayModel): string {
  const once = deliveryOf(run, primaryStep(wf), wf).verdict === 'sent_once' ? ' Sent once.' : '';
  return `${runStory(run, wf).text}, ${formatDuration(model.totalRealS)} after the enquiry.${once}`;
}

/** The caption at a replay position: the latest moment, then the wait if one is running. A failure happens
 * right before its wait, so a caption of the wait alone would never say that the try failed (step 7.1b, F5). */
export function captionAt(model: ReplayModel, displayS: number): string {
  const f = frameAt(model, displayS);
  const latest = model.moments[f.shown - 1]?.text ?? '';
  if (f.wait === null) return latest;
  return `${latest} Northstar waits before try ${f.wait.afterTry + 1} (${f.wait.label}).`.trim();
}

/** A pointer position along the scrubber (0 = start, 1 = end) as a replay time, clamped. */
export function scrubToDisplayS(fraction: number, model: Pick<ReplayModel, 'totalDisplayS'>): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(1, Math.max(0, fraction)) * model.totalDisplayS;
}

/** Which promise the replay is about now: a failure or a wait is "what retried", the send is "sent twice?". */
export function promiseFor(model: ReplayModel, displayS: number): HeroPromise {
  const f = frameAt(model, displayS);
  const m = model.moments[f.shown - 1];
  if (f.wait !== null || m?.shape === 'retry' || m?.shape === 'dead') return 'retried';
  if (m?.lane === 'team' && m.shape === 'ok') return 'twice';
  return 'ran';
}

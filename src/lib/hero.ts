// The landing page's figure: one recorded run, in words a newcomer can follow. Every label is
// computed from the run (the recording in src/fixtures/guided-run.json); hero.test.ts pins the numbers.
import { errorText, formatDuration, formatOffset, formatUtcMinute } from './format';
import { deliveryOf, jobFacts } from './metrics';
import { secondsBetween } from './time';
import { attemptChain } from './topology';
import type { Run, StepKind, Workflow } from './types';
import { errorOf, primaryStep, resultOf, scheduledSteps, simulatedOutageOf, simulatedSteps, stepLabel, stepSpec } from './workflow';

export interface HeroTry {
  attempt: number;
  outcome: 'failed' | 'sent' | 'other';
  /** Seconds after the enquiry when the try ended (failed or succeeded). */
  endS: number;
  /** "try 1 failed" */
  title: string;
  /** "+0.8 s" */
  time: string;
  /** "try 1 failed · +0.8 s" */
  label: string;
  /** Why it failed, in words ("email service down (simulated)"), or null. */
  cause: string | null;
  /** The raw error code, or null. */
  code: string | null;
}

export interface HeroWait {
  afterTry: number;
  actualS: number;
  /** "waited 10.2 s, tried again" */
  label: string;
}

export interface HeroModel {
  /** "22 Oct, 03:07 UTC" */
  when: string;
  /** The three jobs' labels and purposes, by their role in the figure (from the recording's description). */
  titles: { team: string; visitor: string; deletion: string };
  purposes: { team: string; visitor: string; deletion: string };
  team: { tries: HeroTry[]; waits: HeroWait[]; sentOnce: boolean; failureNote: string | null };
  visitor: { label: string; simulated: boolean };
  /** "scheduled for day 7", or what happened to the deletion. */
  deletion: string;
  /** Seconds spent waiting between tries. */
  waitingS: number;
  /** The whole run in one sentence, for the figure's accessible name. */
  summary: string;
}

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/**
 * The figure is drawn for a recording with a primary job, a simulated one and a scheduled one
 * (Northstar's three). The recording is frozen, so this only fails if the fixture changes.
 */
export function roles(wf: Workflow): { team: StepKind; visitor: StepKind; deletion: StepKind } {
  const visitor = simulatedSteps(wf)[0];
  const deletion = scheduledSteps(wf)[0];
  if (visitor === undefined || deletion === undefined) throw new Error('the hero figure needs a simulated and a scheduled job');
  return { team: primaryStep(wf), visitor, deletion };
}

export function heroModel(run: Run, wf: Workflow): HeroModel {
  const at = (iso: string) => secondsBetween(run.created_at, iso);
  const kinds = roles(wf);
  // The outage switch fails the email service on purpose; anything else keeps its own wording.
  const cause = (code: string | null) => {
    const service = simulatedOutageOf(wf, run, kinds.team, code);
    return service !== null ? `${service} down (simulated)` : errorText(wf, code);
  };

  const tries: HeroTry[] = attemptChain(run, kinds.team).flatMap((t) => {
    if (t.endedAt === null) return [];
    const endS = at(t.endedAt);
    let outcome: HeroTry['outcome'] = 'other';
    if (t.outcome === 'failed' || t.outcome === 'dead') outcome = 'failed';
    else if (t.outcome === 'succeeded' && resultOf(wf, kinds.team, t.detail).outcome === 'delivered') outcome = 'sent';
    const title = `try ${t.attempt} ${outcome === 'other' ? 'ended' : outcome}`;
    const time = formatOffset(endS);
    return [{
      attempt: t.attempt, outcome, endS, title, time, label: `${title} · ${time}`,
      cause: outcome === 'failed' ? cause(t.detail) : null,
      code: outcome === 'failed' ? t.detail : null,
    }];
  });

  const waits: HeroWait[] = attemptChain(run, kinds.team).flatMap((t) =>
    t.wait === null || t.wait.actualS === null ? [] : [{
      afterTry: t.attempt, actualS: t.wait.actualS, label: `waited ${formatDuration(t.wait.actualS)}, tried again`,
    }]);
  const waitingS = waits.reduce((sum, w) => sum + w.actualS, 0);
  const sentOnce = deliveryOf(run, kinds.team, wf).verdict === 'sent_once';

  const confirm = attemptChain(run, kinds.visitor).find((t) => t.outcome === 'succeeded');
  const simulated = confirm !== undefined && resultOf(wf, kinds.visitor, confirm.detail).outcome === 'simulated';
  const visitor = confirm?.endedAt
    ? `worked on try ${confirm.attempt} · ${formatOffset(at(confirm.endedAt))}${simulated ? ' · simulated' : ''}`
    : 'not finished';

  const purge = run.steps.find((s) => s.kind === kinds.deletion);
  const purgeFacts = jobFacts(run, kinds.deletion);
  let deletion = 'not scheduled';
  if (purgeFacts.status === 'succeeded') deletion = 'done';
  else if (purge) deletion = `scheduled for day ${Math.round(at(purge.run_after) / 86_400)}`;

  const failed = tries.filter((t) => t.outcome === 'failed');
  const last = tries.at(-1);
  const recovery = [
    waits.length > 0 ? `after waits of ${list(waits.map((w) => formatDuration(w.actualS)))}` : null,
    last?.outcome === 'sent' ? `try ${last.attempt} sent the email${sentOnce ? ' once' : ''} at ${formatOffset(last.endS)}` : null,
  ].filter((p) => p !== null).join(', ');
  const team = [
    failed.length > 0 ? `${list(failed.map((t) => `try ${t.attempt}`))} failed (${errorText(wf, failed[0]?.code ?? null)})` : null,
    recovery === '' ? null : recovery,
  ].filter((p) => p !== null).join('; ');
  const causes = [...new Set(failed.map((t) => t.cause))];
  const failedNames = list(failed.map((t) => String(t.attempt)));
  let failureNote: string | null = null;
  if (failed.length > 0) {
    // Only errors the description says send nothing (the outage switch stops before the email service).
    const nothingSent = failed.every((t) => errorOf(wf, t.code).sendsNothing) ? ', so nothing was sent' : '';
    failureNote = causes.length === 1
      ? `Why ${failed.length === 1 ? 'try' : 'tries'} ${failedNames} failed: ${causes[0] ?? ''}${nothingSent}`
      : `Tries ${failedNames} failed: ${failed.map((t) => t.cause).join('; ')}${nothingSent}`;
  }
  const when = formatUtcMinute(run.created_at);
  const titles = { team: stepLabel(wf, kinds.team), visitor: stepLabel(wf, kinds.visitor), deletion: stepLabel(wf, kinds.deletion) };
  const summary = `One recorded enquiry, ${when}. ${titles.team}: ${team === '' ? 'no try finished' : team}. ` +
    `${titles.visitor}: ${visitor}${simulated ? ' (no email goes to visitors)' : ''}. ${titles.deletion}: ${deletion}.`;

  const purposes = {
    team: stepSpec(wf, kinds.team).purpose, visitor: stepSpec(wf, kinds.visitor).purpose, deletion: stepSpec(wf, kinds.deletion).purpose,
  };
  return { when, titles, purposes, team: { tries, waits, sentOnce, failureNote }, visitor: { label: visitor, simulated }, deletion, waitingS, summary };
}

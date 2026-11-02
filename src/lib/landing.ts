// The landing pages' live parts: the status chip and the home page's numbers row. Each landing page asks
// Northstar once (it also wakes Render while the visitor reads) and never polls.
import type { ApiErrorKind } from './api';
import { runsInWindow } from './filters';
import { newestEnquiryAgo } from './feedStatus';
import { formatAgo, formatUtcMinute } from './format';
import { deliveryOf, jobFacts, recovered } from './metrics';
import { STALE_CAP_MS, WAKING_AFTER_MS, complete, windowStartMs } from './pollPolicy';
import { parseInstant } from './time';
import type { RunsPage } from './types';
import { immediateSteps, primaryStep } from './workflow';

/** The window the landing page counts in, the console's default. */
export const LANDING_WINDOW = '30d';

/** One retry after a failure that looks like Render waking up, this long after it. */
export const LANDING_RETRY_MS = 20_000;

/** Only a missing answer or a 503 (Render's edge while it wakes) earns the single retry. */
export const shouldRetry = (error: ApiErrorKind, retriesDone: number): boolean =>
  retriesDone === 0 && (error === 'network' || error === 'unavailable');

export interface LandingFacts {
  /** Runs created in the last 30 days (server clock). */
  runs: number;
  /** Northstar returned only its newest 500 runs and the window has more. */
  partial: boolean;
  team: { finished: number; sentOnce: number };
  failedTries: number;
  /** Failed tries on runs with a test switch on (the outage switch). */
  outageFailures: number;
  /** Immediate jobs that failed at least once and finished, and how many of those succeeded. */
  recovered: { numerator: number; denominator: number };
  gaveUp: number;
}

export function landingFacts(page: RunsPage): LandingFacts {
  const serverNow = parseInstant(page.now);
  const runs = runsInWindow(page.runs, LANDING_WINDOW, serverNow);
  const wf = page.workflow;
  const team = primaryStep(wf);
  const failedOf = (r: (typeof runs)[number]) => r.events.filter((e) => e.event === 'failed');
  const failed = runs.flatMap(failedOf);
  const rec = recovered(runs, immediateSteps(wf));
  return {
    runs: runs.length,
    partial: !complete(page, windowStartMs(LANDING_WINDOW, serverNow)),
    team: {
      finished: runs.filter((r) => jobFacts(r, team).finished).length,
      sentOnce: runs.filter((r) => deliveryOf(r, team, wf).verdict === 'sent_once').length,
    },
    failedTries: failed.length,
    outageFailures: runs.filter((r) => r.flags.length > 0).flatMap(failedOf).length,
    recovered: { numerator: rec.numerator, denominator: rec.denominator },
    gaveUp: runs.reduce((n, r) => n + r.steps.filter((s) => s.status === 'dead').length, 0),
  };
}

export interface Tile {
  label: string;
  value: string;
  note: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The home page's numbers row (step 5.4): every tile is a count with its n, never a placeholder. */
export function landingNumbers(f: LandingFacts, trigger: string): Tile[] {
  if (f.partial || f.runs === 0) return [];
  const tiles: Tile[] = [{ label: 'Runs', value: String(f.runs), note: `one per ${trigger} · n\u00a0=\u00a0${f.runs}` }];
  if (f.team.finished > 0) {
    const pending = f.runs - f.team.finished;
    tiles.push({
      label: 'Team email recorded as sent once',
      value: `${f.team.sentOnce} of ${f.team.finished}`,
      note: pending > 0 ? `finished team notifications · ${pending} still running` : 'finished team notifications',
    });
  }
  const parts: string[] = [];
  if (f.failedTries === 0) parts.push('none in the last 30 days');
  else if (f.outageFailures === f.failedTries) parts.push('all from the outage test switch');
  else if (f.outageFailures > 0) parts.push(`${f.outageFailures} from the outage test switch`);
  const { numerator, denominator } = f.recovered;
  if (denominator > 0) parts.push(`${numerator} of ${plural(denominator, 'job', 'jobs')} recovered`);
  tiles.push({ label: 'Failed tries', value: String(f.failedTries), note: parts.join(' · ') });
  tiles.push({
    label: 'Gave up',
    value: String(f.gaveUp),
    note: f.gaveUp === 0 ? 'no job stopped without succeeding' : `${plural(f.gaveUp, 'job', 'jobs')} stopped without succeeding · the console shows why`,
  });
  return tiles;
}

export type NumbersView =
  | { kind: 'tiles'; tiles: Tile[]; asOf: string }
  /** No answer yet: Northstar is being asked, or waking. Never zeros. */
  | { kind: 'waiting' }
  | { kind: 'unavailable' }
  | { kind: 'preview' }
  /** Northstar sent only its newest 500 runs and the window has more: nothing can be counted honestly. */
  | { kind: 'partial' }
  | { kind: 'empty' };

export function numbersView(feed: LandingFeed): NumbersView {
  switch (feed.kind) {
    case 'loading':
    case 'retrying':
      return { kind: 'waiting' };
    case 'failed':
      return { kind: 'unavailable' };
    case 'preview':
      return { kind: 'preview' };
    case 'ok': {
      const f = landingFacts(feed.page);
      if (f.partial) return { kind: 'partial' };
      if (f.runs === 0) return { kind: 'empty' };
      return { kind: 'tiles', tiles: landingNumbers(f, feed.page.workflow.trigger.one), asOf: formatUtcMinute(feed.page.now) };
    }
  }
}

// ----- the status chip -----

export type LandingFeed =
  | { kind: 'loading'; startedAt: number }
  /** The first request failed in a way that looks like waking; the single retry is pending or open. */
  | { kind: 'retrying' }
  | { kind: 'ok'; page: RunsPage; receivedAt: number }
  | { kind: 'failed' }
  /** Never asked: this page's origin can't read the feed (a preview, origin.ts). */
  | { kind: 'preview' };

export type ChipTone = 'checking' | 'waking' | 'live' | 'stale' | 'unavailable' | 'preview';

export interface ChipView {
  tone: ChipTone;
  text: string;
  detail: string;
  /** What a screen reader hears when the state changes (the ticking age isn't announced). */
  announce: string;
}

export function chipView(feed: LandingFeed, nowMs: number): ChipView {
  const waking: ChipView = {
    tone: 'waking', text: 'Waking Northstar', detail: 'its free server sleeps · about 1 min', announce: 'Waking Northstar',
  };
  switch (feed.kind) {
    case 'loading':
      return nowMs - feed.startedAt < WAKING_AFTER_MS
        ? { tone: 'checking', text: 'Checking Northstar…', detail: '', announce: 'Checking Northstar' }
        : waking;
    case 'retrying':
      return waking;
    case 'preview':
      return {
        tone: 'preview', text: 'Preview build', detail: 'live data on the production site', announce: 'Preview build: no live data',
      };
    case 'failed':
      return {
        tone: 'unavailable', text: "Northstar can't be reached right now", detail: 'the recorded run still works',
        announce: 'Northstar unavailable',
      };
    case 'ok': {
      const age = Math.max(0, nowMs - feed.receivedAt);
      if (age > STALE_CAP_MS) {
        return {
          tone: 'stale', text: `Last updated ${formatUtcMinute(feed.page.now)}`, detail: 'the console refreshes it',
          announce: 'Northstar data is a few minutes old',
        };
      }
      const f = landingFacts(feed.page);
      const count = f.partial ? `${f.runs}+ runs` : plural(f.runs, 'run', 'runs');
      const newest = newestEnquiryAgo(runsInWindow(feed.page.runs, LANDING_WINDOW, parseInstant(feed.page.now)), feed.page.now, age);
      return {
        tone: 'live', text: `Northstar connected · ${count} in 30 days`,
        detail: `checked ${formatAgo(age)} ago${newest === null ? '' : ` · newest ${feed.page.workflow.trigger.one} ${newest}`}`,
        announce: 'Northstar connected',
      };
    }
  }
}

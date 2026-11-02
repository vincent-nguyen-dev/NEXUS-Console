// "Watch your own enquiry arrive": the visitor sends one on the connected system's real form, and the console
// lists every run created since they started watching. NEXUS can't tell whose a run is (the feed has no names
// or addresses), so it never says "yours", only "since you started watching". Times are on the server's clock,
// like `created_at`, so a wrong client clock can't hide an arrival.
import { CONNECTED } from './connected';
import type { FeedStatus } from './feedStatus';
import { formatAgo, formatDuration, formatUtcMinute } from './format';
import { POLL_MS } from './pollPolicy';
import type { PrefStorage } from './prefs';
import { runSummary } from './runDetail';
import { parseInstant } from './time';
import type { Run, Workflow } from './types';
import { flagsOf, simulatedSteps, stepLabel, triggerOf } from './workflow';

/** A watch older than this is dropped: after an hour, "since you started" says little. */
export const WATCH_KEEP_MS = 60 * 60_000;
/** Arrivals listed in the panel; the rest are counted. */
export const WATCH_SHOWN = 3;
const WATCH_KEY = 'nexus.watch.since';

/** The server's time now: the page's `now` plus how long ago that answer came. */
export const serverNowMs = (pageNow: string, ageMs: number): number => parseInstant(pageNow) + ageMs;

/** Runs created at or after `sinceMs`, newest first. */
export const arrivals = (runs: readonly Run[], sinceMs: number): Run[] =>
  runs.filter((r) => parseInstant(r.created_at) >= sinceMs).sort((a, b) => parseInstant(b.created_at) - parseInstant(a.created_at));

export const isCurrent = (sinceMs: number, serverNow: number): boolean => serverNow - sinceMs <= WATCH_KEEP_MS;

// ----- kept for this tab (sessionStorage), so a reload keeps watching; storage can be missing or throw -----

export function readWatch(storage: PrefStorage | null): number | null {
  try {
    const text = storage?.getItem(WATCH_KEY) ?? null;
    if (text === null || !/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(text)) return null;
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

export function saveWatch(storage: PrefStorage | null, sinceMs: number): void {
  try {
    storage?.setItem(WATCH_KEY, new Date(sinceMs).toISOString());
  } catch {
    // Not kept: a reload stops watching.
  }
}

export function clearWatch(storage: PrefStorage | null): void {
  try {
    storage?.setItem(WATCH_KEY, '');
  } catch {
    // Nothing to clear.
  }
}

// ----- the panel's text -----

/** How to send one, from the feed's description plus the connected site's form. */
export function howTo(wf: Workflow): string[] {
  const site = CONNECTED.name;
  const lines = [
    `Open ${site}'s contact form in a new tab. Any name works, with an address like you@example.com: you don't need real details. ${site} keeps what you type for 7 days, then deletes it. NEXUS never sees it: the feed carries only job events.`,
  ];
  // The form has one test switch; it can only be matched to the description when that has exactly one too.
  const flag = wf.flags.length === 1 ? wf.flags[0] : undefined;
  if (flag !== undefined) {
    lines.push(`Want to see a failure? Tick "${CONNECTED.switchText}" on the form. That's the ${flag.label.toLowerCase()}: it ${flag.effect}.`);
  }
  const simulated = simulatedSteps(wf).map((k) => `${stepLabel(wf, k)} is always simulated, so ${site} sends you nothing.`);
  lines.push([CONNECTED.ownerNote, ...simulated].join(' '));
  lines.push(`Then come back to this tab. NEXUS checks only while this tab is in view: right away when you're back, then every ${POLL_MS / 1000} seconds.`);
  return lines;
}

export const watchingText = (sinceMs: number, wf: Workflow): string =>
  `Watching for a new ${triggerOf(wf).one} since ${formatUtcMinute(new Date(sinceMs).toISOString())}.`;

/** When NEXUS last checked and checks next, or why it isn't checking. */
export function checkText(status: FeedStatus): string {
  switch (status.kind) {
    case 'live':
      return status.retryInMs === null
        ? 'Checking now…'
        : `Last check ${formatAgo(status.ageMs ?? 0)} ago, next in ${formatAgo(status.retryInMs)}.`;
    case 'paused':
      return 'Checks are paused: resume them above.';
    case 'reconnecting':
    case 'waking':
    case 'connecting':
      return 'Waiting for Northstar to answer (it may be waking up).';
    default:
      return "The last check didn't get an answer. NEXUS keeps trying; the status above says more.";
  }
}

export interface ArrivalRow {
  runId: string;
  /** "Arrived 1 min 29 s after you started · run 7f3a · outage switch on" */
  line: string;
  /** The run's summary at the last update. */
  headline: string;
}

export interface ArrivalView {
  heading: string;
  rows: ArrivalRow[];
  /** "+ 1 more", or null. */
  more: string | null;
}

/** `arrived` newest first (from `arrivals`); `prefixes` are the short ids used across the console. */
export function arrivalView(arrived: readonly Run[], sinceMs: number, serverNow: string, wf: Workflow, prefixes: Map<string, string>): ArrivalView {
  const t = triggerOf(wf);
  const n = arrived.length;
  const rows = arrived.slice(0, WATCH_SHOWN).map((run) => {
    const after = formatDuration(Math.max(0, parseInstant(run.created_at) - sinceMs) / 1000);
    const flags = flagsOf(wf, run).map(({ flag, on }) => `${flag.label.toLowerCase()} ${on ? 'on' : 'off'}`);
    const id = prefixes.get(run.run_id) ?? run.run_id.replace(/^r_/, '');
    return {
      runId: run.run_id,
      line: [`Arrived ${after} after you started`, `run ${id}`, ...flags].join(' · '),
      headline: runSummary(run, serverNow, wf).headline,
    };
  });
  return {
    heading: `${n} new ${n === 1 ? t.one : t.many} since you started watching`,
    rows,
    more: n > WATCH_SHOWN ? `+ ${n - WATCH_SHOWN} more` : null,
  };
}

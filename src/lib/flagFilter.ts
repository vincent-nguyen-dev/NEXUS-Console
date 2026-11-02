// The test-switch filter: all runs, runs with a switch on, or runs with none. Its words come from the feed's
// own description of its flags (one flag: its label; several: "test switches"), never from Northstar's codes.
// It narrows the overview and the events view; the status line, the watch panel and the drawer's lookup still
// see every run (App.tsx).
import type { Run, Workflow } from './types';

export const FLAG_FILTERS = ['on', 'off'] as const;
export type FlagFilter = (typeof FLAG_FILTERS)[number];

export interface FlagControl {
  label: string;
  on: string;
  off: string;
}

/** The control's words, or null when the feed describes no flag (no control is shown). */
export function flagControl(wf: Workflow): FlagControl | null {
  const [only] = wf.flags;
  if (only === undefined) return null;
  if (wf.flags.length === 1) return { label: only.label, on: 'On', off: 'Off' };
  return { label: 'Test switches', on: 'Any on', off: 'None on' };
}

/** The runs the filter keeps. Without a filter it returns the same array. */
export function applyFlagFilter(runs: Run[], filter: FlagFilter | null): Run[] {
  if (filter === null) return runs;
  return runs.filter((r) => (r.flags.length > 0) === (filter === 'on'));
}

/** "the outage switch off", "a test switch on": the filter as the end of "runs with …", or null without one. */
export function flagPhrase(wf: Workflow, filter: FlagFilter | null): string | null {
  const [only] = wf.flags;
  if (filter === null || only === undefined) return null;
  if (wf.flags.length === 1) return `the ${only.label.toLowerCase()} ${filter}`;
  return filter === 'on' ? 'a test switch on' : 'no test switch on';
}

/** The line under the control while a filter is on: what it covers, and what still shows every run. */
export function filterScope(wf: Workflow, filter: FlagFilter | null): string | null {
  const phrase = flagPhrase(wf, filter);
  if (phrase === null) return null;
  return `Filtering the map, numbers, activity, events and retries to runs with ${phrase}. The status line and the watch panel still show every run.`;
}

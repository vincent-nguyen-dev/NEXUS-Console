// The signal-box map as text and track states: what each node says and which tracks are lit.
// A track lights only when a recorded event went along it; everything else stays dark.
import { formatDuration, formatPlanned, formatUtcDay } from './format';
import { deliveryOf, jobFacts, retryWaits } from './metrics';
import { attemptChain, buildTopology, type Station } from './topology';
import type { Run, RunsPage, StepKind, Workflow } from './types';
import { isScheduled, numberWord, resultOf, stepLabel, stepSpec, triggerOf } from './workflow';

/** unlit: nothing went this way · route: runs reached it · ok/dead: finished there · scheduled: due later. */
export type TrackState = 'unlit' | 'route' | 'ok' | 'retry' | 'dead' | 'scheduled';

export type NodeId = 'lead' | `lane:${StepKind}` | `try:${StepKind}:${number}`;

/**
 * A station's shape on the redrawn map: one outcome ('sent', 'failed', …) or 'mixed' when its runs ended
 * differently (the words under it then give each count).
 */
export type StationShape = 'sent' | 'simulated' | 'skipped' | 'done' | 'failed' | 'noresult' | 'gaveup' | 'running' | 'mixed';

export interface MapStation {
  id: NodeId;
  attempt: number;
  /** "6 sent · 7 failed": how this try ended, in words, by what each result means (never "sent" for a simulated one). */
  words: string;
  shape: StationShape;
  /** "3 started · 3 succeeded · 3 failed": non-zero parts only. */
  detail: string;
  /** The same on the map, where space is short: "3 ✓ · 3 ✕" (the legend explains the symbols). */
  short: string;
  started: number;
  succeeded: number;
  failed: number;
  dead: number;
}

export interface WaitLabel {
  /** The attempt that failed; the wait leads to attempt + 1. */
  attempt: number;
  planned: string;
  /** "actual 10.2 s (3)", "actual 30.2–31.5 s (3)", or null when every retry is still waiting. */
  actual: string | null;
  /** Retries with a measured wait (the n behind `actual`). */
  measured: number;
  waiting: number;
  /** The map's label: "waited 10.2 s · 7", "waited 30.2–31.5 s · 7", "waiting now · 1". The planned wait is in the note. */
  text: string;
}

export interface MapLane {
  kind: StepKind;
  id: NodeId;
  /** Due later (e.g. a deletion days after the enquiry), not right away. */
  scheduled: boolean;
  title: string;
  subtitle: string;
  /** lead → lane */
  feed: TrackState;
  /** lane → try 1 */
  toTry1: TrackState;
  /**
   * try 1 → where the retry siding rejoins: the path of runs that finished on try 1. Lit only if one did, so a
   * window of retried runs (e.g. the outage filter on) never shows a straight path nobody took.
   */
  firstPath: TrackState;
  /** where the siding rejoins → end: every run that finished went this way. */
  toEnd: TrackState;
  /** the dashed retry track for tries 2+ (unlit when no retry happened) */
  siding: TrackState;
  stations: MapStation[];
  waits: WaitLabel[];
  end: { text: string; state: TrackState };
  /** The redrawn map's end label: two short lines ("13 simulated", "none sent") and its shape. */
  endLabel: { lines: [string, string | null]; shape: 'sent' | 'simulated' | 'done' | 'gaveup' | 'scheduled' | 'none' };
}

export interface MapModel {
  runs: number;
  leadSubtitle: string;
  lanes: MapLane[];
  /** The description the lanes were drawn from (the note under the map reads it too). */
  workflow: Workflow;
}

/** What a job is for, in one sentence: the description's own words. */
export const stepPurpose = (wf: Workflow, kind: StepKind): string => stepSpec(wf, kind).purpose;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function stationDetail(s: Station): string {
  return [
    `${s.started} started`,
    s.succeeded > 0 ? `${s.succeeded} succeeded` : null,
    s.failed > 0 ? `${s.failed} failed` : null,
    s.dead > 0 ? `${s.dead} gave up` : null,
  ].filter((p) => p !== null).join(' · ');
}

function stationShort(s: Station): string {
  const parts = [
    s.succeeded > 0 ? `${s.succeeded} ✓` : null,
    s.failed - s.dead > 0 ? `${s.failed - s.dead} ✕` : null,
    s.dead > 0 ? `${s.dead} gave up` : null,
  ].filter((p) => p !== null);
  // No outcome yet: still running, or a lease that ran out before a retry. "started" is true for both.
  return parts.length ? parts.join(' · ') : `${s.started} started`;
}

function laneSubtitle(runs: Run[], kind: StepKind, wf: Workflow): string {
  if (runs.length === 0) return 'No runs';
  const facts = runs.map((r) => jobFacts(r, kind));
  if (isScheduled(wf, kind)) {
    const done = facts.filter((f) => f.status === 'succeeded').length;
    return `${runs.length - done} scheduled · ${done} done`;
  }
  const dead = facts.filter((f) => f.status === 'dead').length;
  const retrying = facts.filter((f) => f.status === 'retrying').length;
  const recovered = facts.filter((f) => f.status === 'succeeded' && f.failures > 0).length;
  const firstTry = facts.filter((f) => f.status === 'succeeded' && f.succeededAttempt === 1).length;
  if (dead > 0) return `${dead} gave up`;
  if (retrying > 0) return `${retrying} retrying`;
  if (recovered > 0) return `${recovered} recovered after retries`;
  if (firstTry === runs.length) {
    return stepSpec(wf, kind).always_simulated ? `All ${runs.length} simulated on try 1` : `All ${runs.length} succeeded on try 1`;
  }
  return `${runs.length - firstTry} in progress`;
}

function laneEnd(runs: Run[], kind: StepKind, wf: Workflow): MapLane['end'] {
  const spec = stepSpec(wf, kind);
  const facts = runs.map((r) => jobFacts(r, kind));
  const dead = facts.filter((f) => f.status === 'dead').length;
  const succeeded = facts.filter((f) => f.status === 'succeeded').length;
  const gaveUp = dead > 0 ? `${dead} gave up` : null;
  const state: TrackState = dead > 0 ? 'dead' : succeeded > 0 ? 'ok' : 'unlit';

  if (spec.starts_after_s > 0) {
    return { text: `${succeeded} done`, state: succeeded > 0 ? 'ok' : runs.length > 0 ? 'scheduled' : 'unlit' };
  }
  if (spec.always_simulated) {
    const parts = [succeeded > 0 ? `${succeeded} simulated · none sent` : null, gaveUp].filter((p) => p !== null);
    return { text: parts.length ? parts.join(' · ') : 'None finished', state };
  }
  const counts = { sent: 0, simulated: 0, skipped: 0, other: 0 };
  for (const r of runs) {
    const v = deliveryOf(r, kind, wf).verdict;
    if (v === 'sent_once') counts.sent++;
    else if (v === 'simulated') counts.simulated++;
    else if (v === 'skipped') counts.skipped++;
    else if (v === 'unknown' && jobFacts(r, kind).status === 'succeeded') counts.other++;
  }
  // A job that delivers something counts what it sent; one that delivers nothing counts what it did.
  const sent = spec.delivers === null
    ? (counts.sent + counts.other > 0 ? `${counts.sent + counts.other} done` : null)
    : (counts.sent > 0 ? plural(counts.sent, `${spec.delivers} sent`, `${spec.delivers}s sent`) : null);
  const parts = [
    sent,
    counts.simulated > 0 ? `${counts.simulated} simulated` : null,
    counts.skipped > 0 ? `${counts.skipped} skipped` : null,
    gaveUp,
  ].filter((p) => p !== null);
  return { text: parts.length ? parts.join(' · ') : 'None finished', state };
}

const DAY_RE = / \d{4}$/;

/** The end label in two lines, and its shape: ✓ only for a real delivery, the ring for a simulated job. */
function endLabel(runs: Run[], kind: StepKind, wf: Workflow, end: MapLane['end']): MapLane['endLabel'] {
  const spec = stepSpec(wf, kind);
  if (spec.starts_after_s > 0) {
    const done = runs.filter((r) => jobFacts(r, kind).status === 'succeeded').length;
    const waiting = runs.filter((r) => !jobFacts(r, kind).finished);
    const due = waiting.map((r) => r.steps.find((s) => s.kind === kind)?.run_after).filter((d): d is string => d !== undefined).sort()[0];
    const dueText = due === undefined ? null : `first due ${formatUtcDay(due).replace(DAY_RE, '')}`;
    if (runs.length === 0) return { lines: ['No runs', null], shape: 'none' };
    if (waiting.length === 0) return { lines: [`${done} done`, null], shape: 'done' };
    // Two short lines fit the end label's 150 px: "12 scheduled" over "1 done, next 31 Oct".
    const second = done > 0 && dueText !== null ? `${done} done, ${dueText.replace('first due', 'next')}` : dueText;
    return { lines: [`${waiting.length} scheduled`, second], shape: 'scheduled' };
  }
  const [first = end.text, ...rest] = end.text.split(' · ');
  const lines: [string, string | null] = [first, rest.length > 0 ? rest.join(' · ') : null];
  if (end.state === 'dead') return { lines, shape: 'gaveup' };
  if (end.state !== 'ok') return { lines, shape: 'none' };
  if (spec.always_simulated) return { lines, shape: 'simulated' };
  const sent = runs.some((r) => deliveryOf(r, kind, wf).verdict === 'sent_once');
  return { lines, shape: sent ? 'sent' : 'done' };
}

/** Planned vs actual waits before each retry of one step, over all runs. */
export function waitSummary(runs: Run[], kind: StepKind): WaitLabel[] {
  const byAttempt = new Map<number, { planned: number[]; actual: number[]; waiting: number }>();
  for (const run of runs) {
    for (const w of retryWaits(run, kind)) {
      let entry = byAttempt.get(w.attempt);
      if (!entry) byAttempt.set(w.attempt, (entry = { planned: [], actual: [], waiting: 0 }));
      entry.planned.push(w.plannedS);
      if (w.actualS === null) entry.waiting++;
      else entry.actual.push(w.actualS);
    }
  }
  return [...byAttempt.entries()].sort(([a], [b]) => a - b).map(([attempt, e]) => {
    const lo = Math.min(...e.planned);
    const hi = Math.max(...e.planned);
    const planned = `planned ${lo === hi ? formatPlanned(lo) : `${formatPlanned(lo)}–${formatPlanned(hi)}`}`;
    let actual: string | null = null;
    if (e.actual.length > 0) {
      const min = formatDuration(Math.min(...e.actual));
      const max = formatDuration(Math.max(...e.actual));
      actual = `actual ${min === max ? min : `${min.replace(' s', '')}–${max}`} (${e.actual.length})`;
    }
    let text = `waiting now · ${e.waiting}`;
    if (e.actual.length > 0) {
      const min = formatDuration(Math.min(...e.actual));
      const max = formatDuration(Math.max(...e.actual));
      text = `waited ${min === max ? min : `${min.replace(' s', '')}–${max}`} · ${e.actual.length}${e.waiting > 0 ? ` · ${e.waiting} waiting` : ''}`;
    }
    return { attempt, planned, actual, measured: e.actual.length, waiting: e.waiting, text };
  });
}

/** How each try of one job ended across the runs, by attempt: the same reading as a traced run (runTrace.ts). */
function stationOutcomes(runs: Run[], kind: StepKind, wf: Workflow): Map<number, Map<Exclude<StationShape, 'mixed'>, number>> {
  const out = new Map<number, Map<Exclude<StationShape, 'mixed'>, number>>();
  for (const run of runs) {
    for (const a of attemptChain(run, kind)) {
      let shape: Exclude<StationShape, 'mixed'> = 'running';
      if (a.outcome === 'succeeded') {
        const m = resultOf(wf, kind, a.detail).outcome;
        shape = m === 'delivered' ? 'sent' : m === 'simulated' ? 'simulated' : m === 'skipped' ? 'skipped' : 'done';
      } else if (a.outcome === 'failed') shape = 'failed';
      else if (a.outcome === 'dead') shape = 'gaveup';
      else if (a.outcome === 'lease_expired') shape = 'noresult';
      const counts = out.get(a.attempt) ?? new Map();
      counts.set(shape, (counts.get(shape) ?? 0) + 1);
      out.set(a.attempt, counts);
    }
  }
  return out;
}

const WORD: Record<Exclude<StationShape, 'mixed'>, string> = {
  sent: 'sent', simulated: 'simulated', skipped: 'skipped', done: 'done', failed: 'failed', noresult: 'never reported back', gaveup: 'gave up', running: 'running',
};
const WORD_ORDER: Exclude<StationShape, 'mixed'>[] = ['sent', 'simulated', 'done', 'skipped', 'failed', 'noresult', 'gaveup', 'running'];

export function mapModel(runs: Run[], wf: Workflow): MapModel {
  const topo = buildTopology(runs, wf);
  const lanes = topo.lanes.map((lane): MapLane => {
    const kind = lane.kind;
    const outcomes = stationOutcomes(runs, kind, wf);
    const stations = lane.stations.map((s): MapStation => {
      const counts = outcomes.get(s.attempt) ?? new Map<Exclude<StationShape, 'mixed'>, number>();
      const present = WORD_ORDER.filter((k) => (counts.get(k) ?? 0) > 0);
      return {
        id: `try:${kind}:${s.attempt}`, attempt: s.attempt, detail: stationDetail(s), short: stationShort(s),
        words: present.map((k) => `${counts.get(k)} ${WORD[k]}`).join(' · '),
        shape: present.length === 1 ? (present[0] ?? 'running') : present.length === 0 ? 'running' : 'mixed',
        started: s.started, succeeded: s.succeeded, failed: s.failed, dead: s.dead,
      };
    });
    const end = laneEnd(runs, kind, wf);
    const started = stations.length > 0;
    const notStarted: TrackState = isScheduled(wf, kind) && runs.length > 0 ? 'scheduled' : 'unlit';
    // Each part is lit only where runs went: a failed try 1 never lights the straight path, and the end only
    // lights once a run finished. Runs still on try 1 with no failure keep the in-progress route lit.
    const failed = stations.some((s) => s.failed > 0) || stations.some((s) => s.attempt >= 2);
    const first = stations.find((s) => s.attempt === 1);
    const finished = end.state === 'ok' || end.state === 'dead';
    const toTry1: TrackState = started ? 'route' : notStarted;
    let firstPath: TrackState = notStarted;
    let toEnd: TrackState = notStarted;
    if (started) {
      firstPath = (first?.succeeded ?? 0) > 0 ? 'ok' : failed ? 'unlit' : 'route';
      toEnd = finished ? 'ok' : failed ? 'unlit' : 'route';
    }
    return {
      kind,
      id: `lane:${kind}`,
      scheduled: isScheduled(wf, kind),
      title: stepLabel(wf, kind),
      subtitle: laneSubtitle(runs, kind, wf),
      feed: runs.length > 0 ? 'route' : 'unlit',
      toTry1,
      firstPath,
      toEnd,
      siding: stations.some((s) => s.attempt >= 2) ? 'retry' : 'unlit',
      stations,
      waits: waitSummary(runs, kind),
      end,
      endLabel: endLabel(runs, kind, wf, end),
    };
  });
  return { runs: topo.runs, leadSubtitle: runs.length === 0 ? 'No runs' : plural(runs.length, 'run', 'runs'), lanes, workflow: wf };
}

// ----- keyboard -----

/** Columns of node ids, left to right: lead, lanes, try 1, try 2, … Rows are lanes (null where a lane has no such try). */
export function mapGrid(model: MapModel): (NodeId | null)[][] {
  const maxTry = Math.max(0, ...model.lanes.map((l) => Math.max(0, ...l.stations.map((s) => s.attempt))));
  const cols: (NodeId | null)[][] = [['lead'], model.lanes.map((l) => l.id)];
  for (let a = 1; a <= maxTry; a++) {
    cols.push(model.lanes.map((l) => l.stations.find((s) => s.attempt === a)?.id ?? null));
  }
  return cols;
}

/** The map's one Tab stop (step 7.1c, F8): the first of `preferred` that's on the map (the node last focused, then
 * the selection), else the enquiry. Arrow keys move between nodes, so Tab enters and leaves the map once. */
export function tabStop(grid: (NodeId | null)[][], preferred: readonly (NodeId | null)[]): NodeId {
  const onMap = new Set(grid.flat().filter((id): id is NodeId => id !== null));
  return preferred.find((id): id is NodeId => id !== null && onMap.has(id)) ?? 'lead';
}

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

/** The node an arrow key moves to, or the same node at an edge. */
export function neighbor(grid: (NodeId | null)[][], id: NodeId, key: ArrowKey): NodeId {
  const col = grid.findIndex((c) => c.includes(id));
  if (col < 0) return id;
  const row = grid[col]?.indexOf(id) ?? 0;
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const column = grid[col] ?? [];
    const step = key === 'ArrowUp' ? -1 : 1;
    for (let r = row + step; r >= 0 && r < column.length; r += step) {
      const next = column[r];
      if (next) return next;
    }
    return id;
  }
  const step = key === 'ArrowLeft' ? -1 : 1;
  const nextCol = grid[col + step];
  if (!nextCol) return id;
  if (col === 0) return nextCol.find((n) => n !== null) ?? id; // lead → first lane
  if (nextCol.length === 1) return nextCol[0] ?? id; // back to lead
  return nextCol[row] ?? id;
}

// ----- the note under the map -----

export interface Selection {
  step: StepKind | null;
  attempt: number | null;
}

export const selectionId = ({ step, attempt }: Selection): NodeId | null =>
  step === null ? null : attempt === null ? `lane:${step}` : `try:${step}:${attempt}`;

export function parseNodeId(id: NodeId): Selection {
  if (id === 'lead') return { step: null, attempt: null };
  const [, kind, attempt] = id.split(':');
  return { step: kind as StepKind, attempt: attempt === undefined ? null : Number(attempt) };
}

export interface Note {
  heading: string;
  body: string;
}

function describe(model: MapModel, id: NodeId): Note {
  if (id === 'lead') {
    const t = triggerOf(model.workflow);
    return { heading: `New ${t.one}`, body: `${model.leadSubtitle} in this window. Every ${t.one} starts all ${numberWord(model.lanes.length)} jobs.` };
  }
  const { step, attempt } = parseNodeId(id);
  const lane = model.lanes.find((l) => l.kind === step);
  if (!lane) return { heading: '', body: '' };
  if (attempt === null) {
    const purpose = stepPurpose(model.workflow, lane.kind);
    if (isScheduled(model.workflow, lane.kind)) return { heading: lane.title, body: `${purpose} ${lane.subtitle}.` };
    return { heading: lane.title, body: `${purpose} ${lane.subtitle}. ${lane.end.text}.` };
  }
  const heading = `${lane.title} · try ${attempt}`;
  const station = lane.stations.find((s) => s.attempt === attempt);
  if (!station) return { heading, body: `No try ${attempt} in this window.` };
  const wait = lane.waits.find((w) => w.attempt === attempt - 1);
  const measured = wait?.actual
    ? `; ${wait.actual.replace(/ \(\d+\)$/, '')} over ${plural(wait.measured, 'retry', 'retries')}`
    : '';
  const waitText = wait ? ` It started after the ${wait.planned.replace('planned ', '')} planned wait${measured}.` : '';
  return { heading, body: `${station.detail}.${waitText}` };
}

/** What the note under the map says: the previewed node, else the selected one, else a hint. */
export function selectionNote(model: MapModel, selection: Selection, preview: NodeId | null): Note {
  const selected = selectionId(selection);
  if (preview !== null && preview !== selected) {
    const n = describe(model, preview);
    return { heading: `Preview: ${n.heading}`, body: n.body };
  }
  if (selected === null) return { heading: '', body: 'Nothing selected. Click a job, a try or a run to see its numbers; hover to preview.' };
  const n = describe(model, selected);
  return { heading: `Selected: ${n.heading}`, body: n.body };
}

// ----- the signal -----

const eventKey = (runId: string, e: Run['events'][number]) => `${runId}|${e.kind}|${e.event}|${e.attempt}|${e.at}`;

/**
 * Tracks to light briefly for events that are new since the previous page: `feed:`, `main:` or
 * `siding:` plus the step. Nothing for the first page (no previous one).
 */
export function newSignals(prev: RunsPage | null, next: RunsPage): Set<string> {
  const out = new Set<string>();
  if (prev === null) return out;
  const seen = new Set(prev.runs.flatMap((r) => r.events.map((e) => eventKey(r.run_id, e))));
  for (const run of next.runs) {
    for (const e of run.events) {
      if (seen.has(eventKey(run.run_id, e))) continue;
      if (e.event === 'queued') out.add(`feed:${e.kind}`);
      else if (e.attempt >= 2 || e.event === 'retry_scheduled') out.add(`siding:${e.kind}`);
      else out.add(`main:${e.kind}`);
    }
  }
  return out;
}

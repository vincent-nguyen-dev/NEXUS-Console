// The map card (step 5.1b): the screen's one featured card. A turning metal edge, a tilt at rest, a lamp over the
// title; then the summary, the map (wide when it fits, the list otherwise), the run strip, the note and the
// legend. Selection lives in the URL (step, attempt); a pinned or previewed run is drawn over the map in ink.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { uniquePrefixes } from '../../lib/format';
import {
  mapGrid, mapModel, neighbor, parseNodeId, selectionId, selectionNote, tabStop, type ArrowKey, type NodeId, type Selection,
} from '../../lib/map';
import { minWideWidth, wideLayout } from '../../lib/mapGeometry';
import { kpiFocus } from '../../lib/kpiFocus';
import type { Kpi } from '../../lib/kpis';
import { flowSummary } from '../../lib/runStory';
import { traceNote, traceOf } from '../../lib/runTrace';
import type { Run, StepKind, Workflow } from '../../lib/types';
import { numberWord, triggerOf } from '../../lib/workflow';
import { MapLegend } from './MapLegend';
import { MapVertical } from './MapVertical';
import { MapWide } from './MapWide';
import { RunStrip } from './RunStrip';

interface Props {
  /** The feed's description of its workflow: the lanes are drawn from it. Null before the first answer. */
  workflow: Workflow | null;
  /** The shown runs (window and filter), or null while there is no data to draw (loading, error, partial window). */
  runs: Run[] | null;
  /** Why there is no data, shown in the note. */
  emptyNote: string;
  /** "outage switch off" for the title, or null without a filter. */
  filterLabel?: string | null;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  signals: { keys: Set<string>; id: number };
  /** Lanes that retried in the unfiltered window: they keep their siding's room, so the filter moves nothing. */
  reserve?: ReadonlySet<StepKind>;
  /** The page's `now` (server time), for a traced run's note. */
  serverNow?: string | null;
  /** Source, window and filter: when it changes, the lit route draws in again. */
  drawKey?: string;
  /** The recording: its one run is always drawn as a trace, with no strip. */
  recording?: boolean;
  /** The pinned run (App state, never the URL), and the run a Latest activity row previews. */
  pinned?: string | null;
  rowPreview?: string | null;
  onPin?: (runId: string | null) => void;
  onOpenRun?: (runId: string) => void;
  /** A KPI tile pointed at or focused: the map lights the nodes it counts. */
  focusKpi?: Kpi['id'] | null;
}

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
/** The vertical route turns the map 90°: down/up go along a job (its tries), right/left across jobs. */
const TURNED: Record<string, ArrowKey> = { ArrowDown: 'ArrowRight', ArrowUp: 'ArrowLeft', ArrowRight: 'ArrowDown', ArrowLeft: 'ArrowUp' };
const NO_RESERVE: ReadonlySet<StepKind> = new Set();

/** The container's width, measured before paint so the map doesn't flash as a list first. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.clientWidth));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** The metal edge only turns while the card is on screen. */
function useOnScreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setOn(entry?.isIntersecting ?? true));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, on] as const;
}

/** Without a description NEXUS doesn't know the jobs, so it draws nothing rather than guessing lanes. */
export function TopologyMap(props: Props) {
  if (props.workflow === null) {
    return (
      <section aria-labelledby="map-title" className="flex flex-col gap-3">
        <h2 id="map-title" className="font-display text-lg font-semibold">What ran</h2>
        <div className="flex min-h-40 items-center justify-center rounded-lg border border-rule bg-panel p-6">
          <p className="max-w-[60ch] text-center text-base text-muted">
            The map is drawn from Northstar&apos;s own description of its workflow. It appears with the first answer.
          </p>
        </div>
        <p className="min-h-11 rounded-md bg-panel px-3.5 py-2.5 text-base">{props.emptyNote}</p>
      </section>
    );
  }
  return <DrawnMap {...props} workflow={props.workflow} />;
}

function DrawnMap(p: Props & { workflow: Workflow }) {
  const { workflow, runs, emptyNote, selection, onSelect, signals } = p;
  const ready = runs !== null;
  const model = useMemo(() => mapModel(runs ?? [], workflow), [runs, workflow]);
  const grid = useMemo(() => mapGrid(model), [model]);
  const prefixes = useMemo(() => uniquePrefixes((runs ?? []).map((r) => r.run_id)), [runs]);
  const [preview, setPreview] = useState<NodeId | null>(null);
  const [stripPreview, setStripPreview] = useState<string | null>(null);
  const [ref, width] = useWidth();
  const [frameRef, onScreen] = useOnScreen();
  const buttons = useRef(new Map<NodeId, HTMLButtonElement>());

  // Wide when it fits, with 8 px of hysteresis so a scrollbar appearing can't flip it back and forth. Derived
  // during render from the previous answer (React's "previous props" pattern), not in an effect.
  const min = minWideWidth(model);
  const [fit, setFit] = useState({ width: 0, min: 0, wide: false });
  let wide = fit.wide;
  if (fit.width !== width || fit.min !== min) {
    wide = width > 0 && (fit.wide ? width >= min : width >= min + 8);
    setFit({ width, min, wide });
  }
  const layout = useMemo(() => wideLayout(model, width, p.reserve ?? NO_RESERVE), [model, width, p.reserve]);

  // Switching between the wide map and the vertical route remounts the nodes: the focused one is found again.
  const focused = useRef<NodeId | null>(null);
  // The one Tab stop: the node last focused, else the selection (F8). State, so the buttons' tabIndex follows it.
  const [lastFocus, setLastFocus] = useState<NodeId | null>(null);
  useEffect(() => {
    const id = focused.current;
    if (id !== null && document.activeElement === document.body) buttons.current.get(id)?.focus();
  }, [wide]);

  // The run drawn over the map: the recording's one run, else the pinned one, else a hovered chip or row.
  const byId = (id: string | null | undefined) => (id ? (runs ?? []).find((r) => r.run_id === id) ?? null : null);
  const pinnedRun = byId(p.pinned);
  const traceRun = p.recording ? (runs?.[0] ?? null) : (pinnedRun ?? byId(stripPreview) ?? byId(p.rowPreview));
  const trace = useMemo(() => (traceRun === null ? null : traceOf(traceRun, workflow)), [traceRun, workflow]);

  const selected = selectionId(selection);
  const stop = tabStop(grid, [lastFocus, selected]);
  // The spotlight: a hovered or focused station first, then what a KPI tile counts, then the selection.
  const kpiSpots = useMemo(() => (p.focusKpi ? [...kpiFocus(p.focusKpi, runs ?? [], model)] : []), [p.focusKpi, runs, model]);
  let spots: NodeId[] = selected === null ? [] : [selected];
  if (kpiSpots.length > 0) spots = kpiSpots;
  if (preview !== null) spots = [preview];
  let note = ready ? selectionNote(model, selection, preview) : { heading: '', body: emptyNote };
  const short = (r: Run) => prefixes.get(r.run_id) ?? r.run_id.slice(2, 6);
  if (traceRun !== null && p.serverNow && !p.recording) {
    note = { heading: pinnedRun === traceRun ? '' : 'Preview', body: traceNote(traceRun, p.serverNow, workflow, short(traceRun)) };
  }

  const select = (id: NodeId) => {
    if (!ready) return;
    // The selected node again, or Lead saved, clears the selection.
    onSelect(id === selected || id === 'lead' ? { step: null, attempt: null } : parseNodeId(id));
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, id: NodeId) => {
    if (e.key === 'Escape') {
      onSelect({ step: null, attempt: null });
      return;
    }
    if (!ARROWS.has(e.key)) return;
    e.preventDefault();
    const key = wide ? (e.key as ArrowKey) : (TURNED[e.key] ?? (e.key as ArrowKey));
    buttons.current.get(neighbor(grid, id, key))?.focus();
  };
  const registerButton = (id: NodeId, el: HTMLButtonElement | null) => {
    if (el) buttons.current.set(id, el);
    else buttons.current.delete(id);
  };

  // Announced: a selection, or a pinned run. Hover previews stay quiet.
  let announce = selected === null ? '' : selectionNote(model, selection, null).heading;
  if (pinnedRun !== null) announce = `Run ${short(pinnedRun)} traced on the map.`;

  const t = triggerOf(workflow);
  const n = runs?.length ?? 0;
  let title = ready ? `What ran, across ${n} ${n === 1 ? 'run' : 'runs'}` : 'What ran';
  if (p.recording) title = 'What the recorded run did';
  else if (p.filterLabel) title += ` · ${p.filterLabel}`;
  const summary = ready ? flowSummary(runs, workflow) : null;
  const drawKey = `${p.drawKey ?? ''}|${ready ? 'ready' : 'waiting'}`;

  return (
    <section id="map" tabIndex={-1} aria-labelledby="map-title" className="map-stage scroll-mt-6 focus:outline-none">
      <div ref={frameRef} className="map-frame" data-offscreen={onScreen ? undefined : 'true'}>
        <div className="relative flex flex-col gap-4 overflow-hidden rounded-[14px] bg-panel p-5">
          <div key={`lamp-${drawKey}`} aria-hidden="true">
            <div className="map-lamp-cone" />
            <div className="map-lamp-bar" />
          </div>
          <div className="relative flex flex-col gap-1.5">
            <h2 id="map-title" className="font-display text-2xl font-semibold">{title}</h2>
            {summary !== null && <p className="text-md">{summary}</p>}
            <p className="max-w-[90ch] text-base text-muted">
              {`Each ${t.one} starts ${numberWord(model.lanes.length)} jobs. The lit line is the path runs took; a dashed amber line is a wait before the next try. `}
              {wide ? 'Click a job or a try for its numbers.' : 'Tap a row for its numbers.'}
            </p>
          </div>
          <div
            ref={ref}
            className="overflow-hidden"
            onFocus={(e) => {
              focused.current = (e.target.getAttribute('data-node') as NodeId | null) ?? null;
              if (focused.current !== null) setLastFocus(focused.current);
            }}
          >
            {wide ? (
              <MapWide
                model={model} layout={layout} ready={ready} selected={selected} signals={signals} trace={trace} drawKey={drawKey}
                spots={spots} stop={stop} onSelect={select} onPreview={setPreview} onKey={onKey} registerButton={registerButton}
              />
            ) : (
              <MapVertical
                model={model} ready={ready} selected={selected} trace={trace} drawKey={drawKey} reserve={p.reserve ?? NO_RESERVE}
                stop={stop} onSelect={select} onKey={onKey} registerButton={registerButton}
              />
            )}
          </div>
          {ready && !p.recording && p.onPin && (
            <RunStrip runs={runs} workflow={workflow} prefixes={prefixes} pinned={p.pinned ?? null} onPin={p.onPin} onPreview={setStripPreview} />
          )}
          <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 rounded-sm bg-raised px-3.5 py-2.5 text-base">
            <p className="max-w-[110ch]">
              {note.heading && <b className="font-semibold">{note.heading}. </b>}
              {note.body}
            </p>
            {pinnedRun !== null && p.onOpenRun && (
              <button type="button" onClick={() => p.onOpenRun?.(pinnedRun.run_id)} className="min-h-11 rounded-sm border border-route px-3 text-route">
                Open its run
              </button>
            )}
          </div>
          {wide && <MapLegend />}
          <span role="status" className="sr-only">{ready ? announce : ''}</span>
        </div>
      </div>
    </section>
  );
}

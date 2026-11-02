// The wide map (step 5.1b, Round C board C1): tracks and shapes in one SVG layer, nodes as real buttons placed on
// top (focus, keyboard, screen-reader names). The lit route glows; tries 2+ sit on an amber siding that rejoins
// the line. A traced run is drawn in ink over the dimmed map. Geometry comes from mapGeometry; nothing is scaled.
import type { KeyboardEvent, ReactNode } from 'react';
import { stepPurpose, type MapLane, type MapModel, type NodeId, type StationShape, type TrackState } from '../../lib/map';
import type { WideLane, WideLayout } from '../../lib/mapGeometry';
import type { Trace, TraceOutcome } from '../../lib/runTrace';
import { delayText, stepSpec, triggerOf } from '../../lib/workflow';
import { Sep } from '../Sep';
import { dim } from './tracks';

interface Props {
  model: MapModel;
  layout: WideLayout;
  /** False while there is no data: counts show "—" and nothing can be selected. */
  ready: boolean;
  selected: NodeId | null;
  signals: { keys: Set<string>; id: number };
  /** The run drawn over the map (pinned, or previewed), or null. */
  trace: Trace | null;
  /** Changes when the shown runs change set (source, window, filter): the lit route draws in again. */
  drawKey: string;
  /** The nodes the spotlight sits under (hovered, focused, selected, or what a KPI tile counts); none for no light. */
  spots: readonly NodeId[];
  /** The map's one Tab stop (7.1c, F8). */
  stop: NodeId;
  onSelect: (id: NodeId) => void;
  onPreview: (id: NodeId | null) => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>, id: NodeId) => void;
  registerButton: (id: NodeId, el: HTMLButtonElement | null) => void;
}

const ROUTE = 'var(--color-route)';
const TRACK = 'var(--color-track)';
const INK = 'var(--color-ink)';

/** A lit track glows in the route colour; amber is a wait; red a give-up; the rest is unlit track. */
export function Track({ d, state, lit = true }: { d: string; state: TrackState; lit?: boolean }) {
  if (state === 'unlit') return null;
  if (state === 'scheduled') return <path d={d} fill="none" stroke={TRACK} strokeWidth={3} strokeDasharray="2 8" strokeLinecap="round" />;
  if (state === 'retry') return <path d={d} fill="none" stroke="var(--color-retry)" strokeWidth={3} strokeDasharray="8 6" strokeLinecap="round" className="map-sid" />;
  const color = state === 'dead' ? 'var(--color-dead)' : ROUTE;
  return (
    <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
      filter={lit ? 'url(#map-glow)' : undefined} className="map-lit" />
  );
}

/** One short highlight that travels the track once for a new event. */
function Signal({ d }: { d: string }) {
  return <path d={d} pathLength={100} className="map-signal" fill="none" stroke={INK} strokeWidth={4} />;
}

export function Shape({ shape, x, y }: { shape: StationShape | TraceOutcome | 'scheduled' | 'none' | 'gaveup'; x: number; y: number }): ReactNode {
  const ring = (cls: string, extra: ReactNode = null, dash?: string) => (
    <g>
      <circle cx={x} cy={y} r={13} className={`fill-panel ${cls}`} strokeWidth={3} strokeDasharray={dash} />
      {extra}
    </g>
  );
  switch (shape) {
    case 'sent':
      return (
        <g>
          <circle cx={x} cy={y} r={13} className="fill-ok" />
          <path d={`M ${x - 6} ${y} L ${x - 2} ${y + 5} L ${x + 7} ${y - 5}`} fill="none" className="stroke-bg" strokeWidth={3} />
        </g>
      );
    case 'simulated':
      return ring('stroke-ok');
    case 'done':
      return ring('stroke-ink', <path d={`M ${x - 5} ${y} L ${x - 1.5} ${y + 4} L ${x + 6} ${y - 4}`} fill="none" className="stroke-ink" strokeWidth={2.5} />);
    case 'failed':
      return ring('stroke-retry', <path transform={`translate(${x - 8} ${y - 8})`} d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" fill="none" className="stroke-retry" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />);
    case 'gaveup':
      return ring('stroke-dead', <path d={`M${x - 5} ${y - 5}l10 10M${x + 5} ${y - 5}l-10 10`} className="stroke-dead" strokeWidth={2.5} strokeLinecap="round" />);
    case 'noresult':
      return ring('stroke-ink', null, '4 4');
    case 'skipped':
      return ring('stroke-muted', <path d={`M${x - 5} ${y}h10`} className="stroke-muted" strokeWidth={2.5} strokeLinecap="round" />);
    case 'scheduled':
      return ring('stroke-muted', <path d={`M${x} ${y - 5}v5l3 2`} fill="none" className="stroke-muted" strokeWidth={2.5} strokeLinecap="round" />);
    case 'mixed':
      return ring('stroke-ink', <circle cx={x} cy={y} r={4} className="fill-ink" />);
    case 'running':
      return ring('stroke-ink', <circle cx={x} cy={y} r={3} className="fill-ink" />);
    case 'none':
      return <circle cx={x} cy={y} r={12} className="fill-panel stroke-track" strokeWidth={2.5} />;
  }
}

const branch = (layout: WideLayout, y: number) =>
  `M ${layout.leadX} ${layout.leadY} L ${layout.branchX} ${layout.leadY} C ${layout.branchX + 28} ${layout.leadY} ${layout.branchX + 24} ${y} ${layout.laneX} ${y}`;
const rise = (g: WideLane, toX: number) =>
  `M ${g.try1X} ${g.lineY} C ${g.try1X + 24} ${g.lineY} ${g.try1X + 20} ${g.sidingY} ${g.try1X + 56} ${g.sidingY} H ${toX}`;
const down = (g: WideLane, fromX: number, toX: number) =>
  `M ${fromX} ${g.sidingY} H ${fromX + 50} C ${fromX + 86} ${g.sidingY} ${fromX + 82} ${g.lineY} ${toX} ${g.lineY}`;

/** Where a node sits, for the spotlight. */
function nodeAt(layout: WideLayout, model: MapModel, id: NodeId): { x: number; y: number } | null {
  if (id === 'lead') return { x: layout.leadX, y: layout.leadY };
  const [, kind, attempt] = id.split(':');
  const i = model.lanes.findIndex((l) => l.kind === kind);
  const g = layout.lanes[i];
  if (!g) return null;
  if (attempt === undefined) return { x: layout.laneX + 70, y: g.lineY - 20 };
  return g.stations.find((s) => s.attempt === Number(attempt)) ?? null;
}

const labelClass = 'pointer-events-none absolute w-40 -translate-x-1/2 text-center text-sm';

export function MapWide({ model, layout, ready, selected, signals, trace, drawKey, spots, stop, onSelect, onPreview, onKey, registerButton }: Props) {
  const anyRuns = model.runs > 0;
  const step = selected === null || selected === 'lead' ? null : selected.split(':')[1];
  const spotsAt = spots.map((id) => ({ id, at: nodeAt(layout, model, id) })).filter((s) => s.at !== null) as { id: NodeId; at: { x: number; y: number } }[];
  const t = triggerOf(model.workflow);

  const buttonProps = (id: NodeId, label: string) => ({
    ref: (el: HTMLButtonElement | null) => registerButton(id, el),
    type: 'button' as const,
    // The enquiry only clears the selection, so it's a plain button; the others toggle (F9).
    'aria-pressed': id === 'lead' ? undefined : selected === id,
    'aria-label': label,
    'aria-disabled': ready ? undefined : true,
    'data-node': id,
    tabIndex: id === stop ? 0 : -1,
    onClick: () => onSelect(id),
    onMouseEnter: () => onPreview(id),
    onMouseLeave: () => onPreview(null),
    onFocus: () => onPreview(id),
    onBlur: () => onPreview(null),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => onKey(e, id),
  });

  const lanePaths = (lane: MapLane, g: WideLane) => {
    const dimmed = step !== null && step !== lane.kind;
    const s = (state: TrackState) => dim(state, dimmed);
    const firstTo = g.rejoin?.to ?? g.endX;
    return (
      <g key={lane.kind}>
        <Track d={branch(layout, g.lineY)} state={s(lane.feed)} />
        <Track d={`M ${layout.laneX} ${g.lineY} H ${g.try1X}`} state={s(lane.toTry1)} />
        <Track d={`M ${g.try1X} ${g.lineY} H ${firstTo}`} state={s(lane.firstPath)} />
        {g.rejoin !== null && g.sidingY !== null && (
          <>
            <Track d={rise(g, g.rejoin.from)} state={s(lane.siding)} />
            <Track d={down(g, g.rejoin.from, g.rejoin.to)} state={s(lane.toEnd)} />
            <Track d={`M ${g.rejoin.to} ${g.lineY} H ${g.endX}`} state={s(lane.toEnd)} />
          </>
        )}
        {signals.keys.has(`feed:${lane.kind}`) && <Signal key={`f${signals.id}`} d={branch(layout, g.lineY)} />}
        {signals.keys.has(`main:${lane.kind}`) && <Signal key={`m${signals.id}`} d={`M ${layout.laneX} ${g.lineY} H ${g.endX}`} />}
        {g.rejoin !== null && signals.keys.has(`siding:${lane.kind}`) && <Signal key={`s${signals.id}`} d={rise(g, g.rejoin.from)} />}
      </g>
    );
  };

  const traceLayer = trace === null ? null : (
    <g>
      {model.lanes.map((lane, i) => {
        const g = layout.lanes[i];
        const tl = trace.lanes.find((x) => x.kind === lane.kind);
        if (!g || !tl) return null;
        const xOf = (a: number) => g.stations.find((st) => st.attempt === a)?.x ?? g.try1X;
        const last = tl.tries.at(-1)?.attempt ?? 1;
        const ink = { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const };
        const scheduled = tl.tries.length === 0;
        return (
          <g key={lane.kind}>
            <path d={branch(layout, g.lineY)} {...ink} strokeWidth={scheduled ? 2.5 : 3} />
            {scheduled ? (
              <path d={`M ${layout.laneX} ${g.lineY} H ${g.endX}`} {...ink} strokeWidth={2.5} strokeDasharray="2 8" />
            ) : (
              <path d={`M ${layout.laneX} ${g.lineY} H ${g.try1X}`} {...ink} />
            )}
            {!scheduled && last === 1 && tl.finished && <path d={`M ${g.try1X} ${g.lineY} H ${g.endX}`} {...ink} />}
            {last > 1 && g.sidingY !== null && <path d={rise(g, xOf(last))} {...ink} strokeDasharray="8 6" />}
            {last > 1 && g.sidingY !== null && tl.finished && <path d={`${down(g, xOf(last), xOf(last) + 110)} H ${g.endX}`} {...ink} />}
            {tl.tries.map((x) => {
              const st = g.stations.find((p) => p.attempt === x.attempt);
              return st ? <Shape key={x.attempt} shape={x.outcome} x={st.x} y={st.y} /> : null;
            })}
            {tl.finished && <Shape shape={lane.endLabel.shape === 'none' ? 'done' : lane.endLabel.shape} x={g.endX} y={g.lineY} />}
            {scheduled && <Shape shape="scheduled" x={g.endX} y={g.lineY} />}
          </g>
        );
      })}
      <circle cx={layout.leadX} cy={layout.leadY} r={8} className="fill-ink" />
    </g>
  );

  return (
    <div className="relative" style={{ width: layout.width, height: layout.height }}>
      <svg width={layout.width} height={layout.height} aria-hidden="true" className="absolute inset-0">
        <defs>
          <filter id="map-glow" filterUnits="userSpaceOnUse" x={0} y={0} width={layout.width} height={layout.height}>
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* The spotlight: 85% teal at its centre keeps muted text at 4.59:1 or more (contrast.test). */}
          <radialGradient id="map-spot">
            <stop offset="0" stopColor="var(--color-glow-teal)" stopOpacity="0.85" />
            <stop offset="0.45" stopColor="var(--color-glow-teal)" stopOpacity="0.7" />
            <stop offset="1" stopColor="var(--color-glow-teal)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {spotsAt.map((s) => <circle key={s.id} cx={s.at.x} cy={s.at.y} r={100} fill="url(#map-spot)" className="map-spot" />)}

        <g opacity={trace === null ? 1 : 0.4}>
          {/* Unlit track first, then the lit route, which draws in again whenever the shown runs change set. */}
          {model.lanes.map((lane, i) => {
            const g = layout.lanes[i];
            if (!g) return null;
            return (
              <g key={lane.kind}>
                <path d={branch(layout, g.lineY)} fill="none" stroke={TRACK} strokeWidth={3} />
                <path d={`M ${layout.laneX} ${g.lineY} H ${g.endX}`} fill="none" stroke={TRACK} strokeWidth={3} strokeDasharray={lane.scheduled ? '2 8' : undefined} />
              </g>
            );
          })}
          <g key={drawKey} className="map-draw">
            {model.lanes.map((lane, i) => {
              const g = layout.lanes[i];
              return g ? lanePaths(lane, g) : null;
            })}
          </g>
          <circle cx={layout.leadX} cy={layout.leadY} r={8} fill={anyRuns ? ROUTE : TRACK} />
          {trace === null && model.lanes.map((lane, i) => {
            const g = layout.lanes[i];
            if (!g) return null;
            const dimmed = step !== null && step !== lane.kind;
            return (
              <g key={lane.kind} opacity={dimmed ? 0.45 : 1}>
                {lane.stations.map((st) => {
                  const p = g.stations.find((x) => x.attempt === st.attempt);
                  return p ? <Shape key={st.attempt} shape={st.shape} x={p.x} y={p.y} /> : null;
                })}
                <Shape shape={lane.endLabel.shape} x={g.endX} y={g.lineY} />
              </g>
            );
          })}
        </g>
        {traceLayer}
        {spotsAt.map((s) => (
          <circle key={s.id} cx={s.at.x} cy={s.at.y} r={19} fill="none" stroke={ROUTE} strokeWidth={4}
            className="map-spot" style={{ filter: 'drop-shadow(0 0 6px rgb(124 207 227 / 0.8))' }} />
        ))}
      </svg>

      <button
        {...buttonProps('lead', `New ${t.one}, ${model.leadSubtitle}. Clears the selection.`)}
        className="absolute flex flex-col items-start justify-end rounded-sm text-left aria-disabled:cursor-default"
        style={{ left: 0, top: layout.leadY - 50, width: 120, height: 44 }}
      >
        <b className="font-display text-md leading-5 font-semibold text-ink">New {t.one}</b>
        <Sep />
        <span className="font-mono text-sm leading-5 text-muted">{ready ? model.leadSubtitle : '—'}</span>
      </button>

      {model.lanes.map((lane, i) => {
        const g = layout.lanes[i];
        if (!g) return null;
        const dimmed = step !== null && step !== lane.kind;
        const tl = trace?.lanes.find((x) => x.kind === lane.kind) ?? null;
        return (
          <div key={lane.kind}>
            <button
              {...buttonProps(lane.id, `${lane.title}. ${stepPurpose(model.workflow, lane.kind)} ${lane.subtitle}. ${lane.end.text}.`)}
              className="absolute flex items-end rounded-sm pb-1 text-left aria-pressed:ring-2 aria-pressed:ring-route aria-disabled:cursor-default"
              style={{ left: layout.laneX, top: g.lineY - 46, height: 44, maxWidth: g.try1X - layout.laneX - 30 }}
            >
              <span className={`font-display text-[18px] leading-6 font-semibold ${dimmed || trace ? 'text-muted' : 'text-ink'}`}>{lane.title}</span>
            </button>

            {trace === null && lane.waits.map((w) => {
              const p = g.waits.find((x) => x.attempt === w.attempt);
              if (!p) return null;
              // Two lines at narrow widths: "waited" over "30.2–31.5 s · 7" (or "waiting now" over its count).
              const [first, second] = w.text.startsWith('waited ')
                ? ['waited', w.text.slice('waited '.length)]
                : [w.text.replace(/ · .*$/, ''), w.text.replace(/^[^·]*· /, '')];
              return (
                <p key={w.attempt} aria-hidden="true" className={`pointer-events-none absolute -translate-x-1/2 -translate-y-full text-center font-mono text-sm whitespace-nowrap ${dimmed ? 'text-muted' : 'text-retry'}`} style={{ left: p.x, top: p.y + 4 }}>
                  {layout.twoLineWaits ? <>{first}<br />{second}</> : w.text}
                </p>
              );
            })}

            {lane.stations.map((st) => {
              const p = g.stations.find((x) => x.attempt === st.attempt);
              if (!p) return null;
              const traced = tl?.tries.find((x) => x.attempt === st.attempt) ?? null;
              return (
                <div key={st.attempt}>
                  <button
                    {...buttonProps(st.id, `${lane.title}, try ${st.attempt}: ${st.words}.`)}
                    className="absolute size-11 -translate-x-1/2 -translate-y-1/2 rounded-full aria-pressed:ring-2 aria-pressed:ring-route aria-disabled:cursor-default"
                    style={{ left: p.x, top: p.y }}
                  />
                  {trace === null && (
                    <p aria-hidden="true" className={labelClass} style={{ left: p.x, top: p.y + 18 }}>
                      <b className={`font-semibold ${dimmed ? 'text-muted' : 'text-ink'}`}>Try {st.attempt}</b>
                      <br />
                      <span className="font-mono text-muted">{ready ? st.words : '—'}</span>
                    </p>
                  )}
                  {traced !== null && (
                    <p aria-hidden="true" className={`${labelClass} rounded-sm bg-panel`} style={{ left: p.x, top: p.y + 18 }}>
                      <b className="font-semibold text-ink">Try {st.attempt}</b>
                      <br />
                      <span className={`font-mono ${traced.outcome === 'sent' ? 'text-ok' : traced.outcome === 'failed' ? 'text-retry' : 'text-muted'}`}>
                        {traced.outcome === 'noresult' ? 'never reported back' : traced.outcome === 'gaveup' ? 'gave up' : traced.outcome} {traced.at}
                      </span>
                    </p>
                  )}
                </div>
              );
            })}

            {tl?.waits.map((w) => {
              const p = g.waits.find((x) => x.attempt === w.afterTry);
              return p ? (
                <p key={w.afterTry} aria-hidden="true" className={`${labelClass} -translate-y-full rounded-sm bg-panel font-mono text-ink`} style={{ left: p.x, top: p.y + 4 }}>
                  {w.text}
                </p>
              ) : null;
            })}

            <p aria-hidden="true" className="pointer-events-none absolute -translate-y-1/2 text-[15px] leading-5" style={{ left: g.endX + 22, top: g.lineY }}>
              <span className={trace || dimmed ? 'text-muted' : 'text-ink'}>{ready ? lane.endLabel.lines[0] : '—'}</span>
              {ready && lane.endLabel.lines[1] !== null && <><br /><span className="text-muted">{lane.endLabel.lines[1]}</span></>}
            </p>

            {lane.scheduled && lane.stations.length === 0 && (
              <p aria-hidden="true" className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-center text-sm text-muted"
                style={{ left: (g.try1X + g.endX) / 2, top: g.lineY - 6 }}>
                runs {delayText(stepSpec(model.workflow, lane.kind).starts_after_s)} after the {t.one}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

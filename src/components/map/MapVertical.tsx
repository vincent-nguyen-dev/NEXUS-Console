// The map on phones and narrow panels (step 5.1c, board C5): its own composition, never the wide map scaled
// down. Each job reads down the screen: try 1 on the line, tries 2+ on an amber siding beside it, the waits
// labelled between them, the end below. Every station is a full-width 44 px row button. A pinned run is drawn
// in ink with its own times, as on the wide map.
import type { KeyboardEvent } from 'react';
import { stepPurpose, type MapModel, type NodeId, type TrackState } from '../../lib/map';
import { verticalLane } from '../../lib/mapGeometry';
import type { Trace } from '../../lib/runTrace';
import type { StepKind } from '../../lib/types';
import { delayText, stepSpec, triggerOf } from '../../lib/workflow';
import { Sep } from '../Sep';
import { dim } from './tracks';
import { Shape, Track } from './MapWide';

interface Props {
  model: MapModel;
  ready: boolean;
  selected: NodeId | null;
  trace: Trace | null;
  drawKey: string;
  reserve: ReadonlySet<StepKind>;
  /** The map's one Tab stop (7.1c, F8). */
  stop: NodeId;
  onSelect: (id: NodeId) => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>, id: NodeId) => void;
  registerButton: (id: NodeId, el: HTMLButtonElement | null) => void;
}

const LINE = 20;
const SIDING = 52;
const rowClass =
  'absolute inset-x-0 flex min-h-11 flex-col justify-center rounded-sm pl-[84px] text-left aria-pressed:bg-raised aria-pressed:ring-2 aria-pressed:ring-inset aria-pressed:ring-route aria-disabled:cursor-default';
const OUTCOME_WORD: Record<string, string> = { noresult: 'never reported back', gaveup: 'gave up' };

export function MapVertical({ model, ready, selected, trace, drawKey, reserve, stop, onSelect, onKey, registerButton }: Props) {
  const t = triggerOf(model.workflow);
  const step = selected === null || selected === 'lead' ? null : selected.split(':')[1];
  // A lane's second line: what the job does, or when a scheduled job runs. The button's name repeats it.
  const laneLine = (kind: StepKind, scheduled: boolean) =>
    scheduled ? `Runs ${delayText(stepSpec(model.workflow, kind).starts_after_s)} after the ${t.one}.` : stepPurpose(model.workflow, kind);
  const props = (id: NodeId, label: string) => ({
    ref: (el: HTMLButtonElement | null) => registerButton(id, el),
    type: 'button' as const,
    'aria-pressed': id === 'lead' ? undefined : selected === id,
    'aria-label': label,
    'aria-disabled': ready ? undefined : true,
    'data-node': id,
    tabIndex: id === stop ? 0 : -1,
    onClick: () => onSelect(id),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => onKey(e, id),
  });

  return (
    <div className="flex flex-col gap-1">
      <button {...props('lead', `New ${t.one} · ${model.leadSubtitle}. Clears the selection.`)}
        className="flex min-h-11 items-center gap-3 rounded-sm px-1 text-left aria-disabled:cursor-default">
        <span aria-hidden="true" className={`size-3 rounded-full ${model.runs > 0 ? 'bg-route' : 'bg-track'}`} />
        <span><b className="font-display text-md font-semibold">New {t.one}</b> <span className="font-mono text-sm text-muted">· {ready ? model.leadSubtitle : '—'}</span></span>
      </button>

      {model.lanes.map((lane) => {
        const v = verticalLane(lane, reserve);
        const dimmed = step !== null && step !== lane.kind;
        const s = (state: TrackState) => dim(trace === null ? state : 'unlit', dimmed);
        const tl = trace?.lanes.find((x) => x.kind === lane.kind) ?? null;
        const first = v.stations[0];
        const ink = { fill: 'none', stroke: 'var(--color-ink)', strokeWidth: 3, strokeLinecap: 'round' as const };
        const yOf = (a: number) => v.stations.find((p) => p.attempt === a)?.y ?? 22;
        const tlLast = tl?.tries.at(-1)?.attempt ?? 1;
        return (
          <section key={lane.kind} aria-label={lane.title} className={`flex flex-col gap-2 border-t border-rule pt-3 ${dimmed ? 'opacity-60' : ''}`}>
            <button {...props(lane.id, `${lane.title}. ${laneLine(lane.kind, lane.scheduled)} ${lane.subtitle}. ${lane.end.text}.`)}
              className="flex min-h-11 flex-col items-start justify-center rounded-sm px-1 text-left aria-pressed:ring-2 aria-pressed:ring-route aria-disabled:cursor-default">
              <b className="font-display text-[20px] leading-6 font-semibold">{lane.title}</b>
              <Sep text=". " />
              <span className="text-sm text-muted">{laneLine(lane.kind, lane.scheduled)}</span>
            </button>

            <div className="relative" style={{ height: v.height }}>
              <svg width="100%" height={v.height} aria-hidden="true" className="absolute inset-0">
                {first && <path d={`M ${LINE} ${first.y} V ${v.end.y}`} fill="none" stroke="var(--color-track)" strokeWidth={3} />}
                <g key={drawKey} className="map-draw">
                  {first && <Track d={`M ${LINE} ${first.y} V ${v.rejoin?.toY ?? v.end.y}`} state={s(lane.firstPath)} lit={false} />}
                  {v.rejoin !== null && (
                    <>
                      <Track d={`M ${LINE} ${first?.y ?? 22} C ${LINE} ${(first?.y ?? 22) + 30} ${SIDING} ${(first?.y ?? 22) + 26} ${SIDING} ${(first?.y ?? 22) + 56} V ${v.rejoin.fromY}`} state={s(lane.siding)} />
                      <Track d={`M ${SIDING} ${v.rejoin.fromY} V ${v.rejoin.fromY + 30} C ${SIDING} ${v.rejoin.fromY + 60} ${LINE} ${v.rejoin.fromY + 56} ${LINE} ${v.rejoin.toY} V ${v.end.y}`} state={s(lane.toEnd)} lit={false} />
                    </>
                  )}
                </g>
                {tl !== null && first && tl.tries.length > 0 && (
                  <g>
                    {tlLast === 1 && tl.finished && <path d={`M ${LINE} ${first.y} V ${v.end.y}`} {...ink} />}
                    {tlLast > 1 && <path d={`M ${LINE} ${first.y} C ${LINE} ${first.y + 30} ${SIDING} ${first.y + 26} ${SIDING} ${first.y + 56} V ${yOf(tlLast)}`} {...ink} strokeDasharray="8 6" />}
                    {tlLast > 1 && tl.finished && <path d={`M ${SIDING} ${yOf(tlLast)} V ${yOf(tlLast) + 30} C ${SIDING} ${yOf(tlLast) + 60} ${LINE} ${yOf(tlLast) + 56} ${LINE} ${yOf(tlLast) + 86} V ${v.end.y}`} {...ink} />}
                  </g>
                )}
                {(tl === null ? lane.stations.map((st) => ({ attempt: st.attempt, shape: st.shape })) : tl.tries.map((x) => ({ attempt: x.attempt, shape: x.outcome }))).map((st) => {
                  const p = v.stations.find((x) => x.attempt === st.attempt);
                  return p ? <Shape key={st.attempt} shape={st.shape} x={p.x} y={p.y} /> : null;
                })}
                <Shape shape={lane.endLabel.shape} x={v.end.x} y={v.end.y} />
              </svg>

              {lane.stations.map((st) => {
                const p = v.stations.find((x) => x.attempt === st.attempt);
                if (!p) return null;
                const traced = tl?.tries.find((x) => x.attempt === st.attempt) ?? null;
                const words = traced === null ? st.words : `${OUTCOME_WORD[traced.outcome] ?? traced.outcome} ${traced.at}`;
                return (
                  <button key={st.attempt} {...props(st.id, `${lane.title}, try ${st.attempt}: ${ready ? words : 'no data yet'}.`)} className={rowClass} style={{ top: p.y - 22 }}>
                    <b className="text-[15px] leading-5 font-semibold">Try {st.attempt}</b>
                    <Sep />
                    <span className={`font-mono text-sm leading-5 ${traced?.outcome === 'failed' ? 'text-retry' : traced?.outcome === 'sent' ? 'text-ok' : 'text-muted'}`}>
                      {ready ? words : '—'}
                    </span>
                  </button>
                );
              })}

              {(tl === null ? lane.waits.map((w) => ({ attempt: w.attempt, text: w.text })) : tl.waits.map((w) => ({ attempt: w.afterTry, text: w.text }))).map((w) => {
                const p = v.waits.find((x) => x.attempt === w.attempt);
                return p ? (
                  <p key={w.attempt} aria-hidden="true" className={`pointer-events-none absolute left-[84px] -translate-y-1/2 font-mono text-sm ${tl ? 'text-ink' : 'text-retry'}`} style={{ top: p.y }}>
                    {w.text}
                  </p>
                ) : null;
              })}

              <p aria-hidden="true" className="pointer-events-none absolute left-[84px] -translate-y-1/2 text-[15px] leading-5" style={{ top: v.end.y }}>
                <b className="font-semibold">{ready ? lane.endLabel.lines[0] : '—'}</b>
                {ready && lane.endLabel.lines[1] !== null && <><br /><span className="text-muted">{lane.endLabel.lines[1]}</span></>}
              </p>
            </div>
          </section>
        );
      })}
    </div>
  );
}

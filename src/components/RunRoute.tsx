// One job's route in the run drawer (step 5.2b, board D5): the map's vertical composition for this one run, read
// only. Try 1 on the line, tries 2+ on an amber siding, the run's own waits and times beside them. The text chain
// (chainText) stays for screen readers, so the drawing is decoration.
import { mapModel } from '../lib/map';
import { verticalLane } from '../lib/mapGeometry';
import { traceOf } from '../lib/runTrace';
import type { Run, StepKind, Workflow } from '../lib/types';
import { Shape, Track } from './map/MapWide';

const LINE = 20;
const SIDING = 52;
const NONE: ReadonlySet<StepKind> = new Set();
const WORD: Record<string, string> = { noresult: 'never reported back', gaveup: 'gave up', running: 'running' };

export function RunRoute({ run, kind, wf }: { run: Run; kind: StepKind; wf: Workflow }) {
  const lane = mapModel([run], wf).lanes.find((l) => l.kind === kind);
  const tl = traceOf(run, wf).lanes.find((l) => l.kind === kind);
  if (!lane || !tl || lane.stations.length === 0) return null;
  const v = verticalLane(lane, NONE);
  const first = v.stations[0];
  if (!first) return null;
  const tone = (o: string) => (o === 'failed' ? 'text-retry' : o === 'sent' ? 'text-ok' : o === 'gaveup' ? 'text-dead' : 'text-muted');
  return (
    <div aria-hidden="true" className="relative" style={{ height: v.height }}>
      <svg width="100%" height={v.height} className="absolute inset-0">
        <path d={`M ${LINE} ${first.y} V ${v.end.y}`} fill="none" stroke="var(--color-track)" strokeWidth={3} />
        <Track d={`M ${LINE} ${first.y} V ${v.rejoin?.toY ?? v.end.y}`} state={lane.firstPath} lit={false} />
        {v.rejoin !== null && (
          <>
            <Track d={`M ${LINE} ${first.y} C ${LINE} ${first.y + 30} ${SIDING} ${first.y + 26} ${SIDING} ${first.y + 56} V ${v.rejoin.fromY}`} state={lane.siding} />
            <Track d={`M ${SIDING} ${v.rejoin.fromY} V ${v.rejoin.fromY + 30} C ${SIDING} ${v.rejoin.fromY + 60} ${LINE} ${v.rejoin.fromY + 56} ${LINE} ${v.rejoin.toY} V ${v.end.y}`} state={lane.toEnd} lit={false} />
          </>
        )}
        {tl.tries.map((t) => {
          const p = v.stations.find((x) => x.attempt === t.attempt);
          return p ? <Shape key={t.attempt} shape={t.outcome} x={p.x} y={p.y} /> : null;
        })}
        <Shape shape={lane.endLabel.shape} x={v.end.x} y={v.end.y} />
      </svg>
      {tl.tries.map((t) => {
        const p = v.stations.find((x) => x.attempt === t.attempt);
        return p ? (
          <p key={t.attempt} className="absolute left-[84px] flex -translate-y-1/2 flex-col leading-5" style={{ top: p.y }}>
            <b className="text-[15px] font-semibold">Try {t.attempt}</b>
            <span className={`font-mono text-sm ${tone(t.outcome)}`}>{WORD[t.outcome] ?? t.outcome} {t.at}</span>
          </p>
        ) : null;
      })}
      {tl.waits.map((w) => {
        const p = v.waits.find((x) => x.attempt === w.afterTry);
        return p ? <p key={w.afterTry} className="absolute left-[84px] -translate-y-1/2 font-mono text-sm text-retry" style={{ top: p.y }}>{w.text}</p> : null;
      })}
      <p className="absolute left-[84px] -translate-y-1/2 text-[15px] leading-5 font-semibold" style={{ top: v.end.y }}>{lane.endLabel.lines[0]}</p>
    </div>
  );
}

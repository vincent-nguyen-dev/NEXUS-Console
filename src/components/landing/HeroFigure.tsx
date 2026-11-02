// The hero's route figure (720 px and wider): the recorded enquiry as three lines, one per job. The
// path the run really took is lit; a retry is an amber loop that rejoins the line. Fixed geometry for the
// recording's three team notification tries (hero.test.ts pins them); the words come from heroModel. Since 5.3a
// it draws only as far as the replay's read head (`frame`, from heroReplay); without one it shows the whole run.
import type { HeroModel } from '../../lib/hero';
import type { HeroFrame } from '../../lib/heroReplay';

const STATIONS = [230, 420, 630];
const TEAM_Y = 112;
const VISITOR_Y = 320;
const DELETION_Y = 444;
const LANE_X = 150;
const END_X = 660;
const NODE = { x: 40, y: 230 };

const branch = (y: number) => `M ${NODE.x} ${NODE.y} L 70 ${NODE.y} C 110 ${NODE.y} 110 ${y} ${LANE_X} ${y}`;
const siding = (from: number, to: number) => `M ${from + 10} ${TEAM_Y + 10} C ${from + 22} ${TEAM_Y + 58} ${to - 22} ${TEAM_Y + 58} ${to - 10} ${TEAM_Y + 10}`;

function RetryStation({ x }: { x: number }) {
  return (
    <g>
      <circle cx={x} cy={TEAM_Y} r="11" className="fill-panel stroke-retry" strokeWidth="2.5" />
      <path transform={`translate(${x - 8} ${TEAM_Y - 8})`} d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" fill="none" className="stroke-retry" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

export function HeroFigure({ model, frame = null }: { model: HeroModel; frame?: HeroFrame | null }) {
  const { tries, waits } = model.team;
  const last = tries.at(-1);
  // What the read head has reached: a try is drawn once it started, labelled once it ended.
  const started = (attempt: number) => frame === null || frame.started.has(attempt);
  const ended = (attempt: number) => frame === null || frame.ended.has(attempt);
  const visitorDone = frame === null || frame.visitor === 'done';
  const lastFailed = Math.max(0, ...tries.filter((t) => t.outcome === 'failed').map((t) => t.attempt));
  return (
    <svg width="100%" viewBox="0 0 680 470" role="img" aria-label={model.summary} className="block">
      <defs>
        <filter id="route-glow" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {waits.map((w, i) => (
          <mask key={w.afterTry} id={`siding-${i}`} maskUnits="userSpaceOnUse">
            <path d={siding(STATIONS[i] ?? 0, STATIONS[i + 1] ?? 0)} pathLength={1} fill="none" stroke="white" strokeWidth="8" className="route-draw-late" />
          </mask>
        ))}
      </defs>

      {/* The enquiry */}
      <g className="font-display">
        <text x="0" y="168" className="fill-ink" fontSize="17" fontWeight="600">New enquiry</text>
      </g>
      {/* Lane titles. Since 5.3a the purposes, the date and the visitor's note are gone (the caption and the card's
          header carry them); the failure note stays, because "nothing was sent" is checkpoint A's S1. */}
      <g className="font-display fill-ink" fontSize="19" fontWeight="600">
        <text x={LANE_X} y="40">{model.titles.team}</text>
        <text x={LANE_X} y="262">{model.titles.visitor}</text>
        <text x={LANE_X} y="392">{model.titles.deletion}</text>
      </g>

      {/* Unlit track */}
      <g className="stroke-track" strokeWidth="3">
        <line x1={LANE_X} y1={TEAM_Y} x2={END_X} y2={TEAM_Y} />
        {/* The visitor confirmation ended on try 1; its line stops there and the label takes the rest. */}
        <line x1={LANE_X} y1={VISITOR_Y} x2={STATIONS[0]} y2={VISITOR_Y} />
        <line x1={LANE_X} y1={DELETION_Y} x2={END_X} y2={DELETION_Y} strokeDasharray="2 8" />
        <path d={branch(DELETION_Y)} fill="none" />
      </g>

      {/* The lit route: what really happened */}
      <g className="stroke-route" strokeWidth="4" fill="none" filter="url(#route-glow)">
        {started(1) && <path d={`${branch(TEAM_Y)} L ${STATIONS[0] ?? 0} ${TEAM_Y}`} pathLength={1} className="route-draw" />}
        {(frame === null || frame.visitor !== 'none') && <path d={`${branch(VISITOR_Y)} L ${STATIONS[0] ?? 0} ${VISITOR_Y}`} pathLength={1} className="route-draw" />}
        {last?.outcome === 'sent' && ended(last.attempt) && (
          <path d={`M ${(STATIONS[2] ?? 0) - 10} ${TEAM_Y + 10} L ${STATIONS[2] ?? 0} ${TEAM_Y} L ${END_X} ${TEAM_Y}`} pathLength={1} className="route-draw-late" />
        )}
      </g>
      <circle cx={NODE.x} cy={NODE.y} r="9" className="fill-route" />

      {/* Retries: Northstar waited, then tried again */}
      {waits.map((w, i) => {
        // A wait is drawn while it runs (faint) and once the next try started.
        const running = frame?.wait?.afterTry === w.afterTry;
        if (!(started(w.afterTry + 1) || running)) return null;
        const from = STATIONS[i] ?? 0;
        const to = STATIONS[i + 1] ?? 0;
        const mid = (from + to) / 2;
        const [first, second] = w.label.split(', ');
        return (
          <g key={w.afterTry} opacity={running ? 0.55 : 1}>
            <path d={siding(from, to)} fill="none" className="stroke-retry" strokeWidth="3" strokeDasharray="8 6" mask={`url(#siding-${i})`} />
            <text x={mid} y="182" textAnchor="middle" className="font-mono fill-retry" fontSize="14">{first},</text>
            <text x={mid} y="200" textAnchor="middle" className="font-mono fill-retry" fontSize="14">{second}</text>
          </g>
        );
      })}
      {/* It names every failed try, so it waits until the last of them has happened. */}
      {model.team.failureNote !== null && ended(lastFailed) && (
        <text x={LANE_X} y="232" className="font-sans fill-ink" fontSize="14">{model.team.failureNote}</text>
      )}

      {/* Team notification tries */}
      {tries.map((t, i) => {
        const x = STATIONS[i] ?? 0;
        const isLast = i === tries.length - 1;
        if (!started(t.attempt)) return null;
        if (!ended(t.attempt)) return <circle key={t.attempt} cx={x} cy={TEAM_Y} r="11" className="fill-panel stroke-ink" strokeWidth="2.5" />;
        return (
          <g key={t.attempt}>
            {t.outcome === 'failed' && <RetryStation x={x} />}
            {t.outcome === 'sent' && (
              <g>
                <circle cx={x} cy={TEAM_Y} r="12" className="fill-ok" />
                <path d={`M ${x - 6} ${TEAM_Y} L ${x - 2} ${TEAM_Y + 5} L ${x + 7} ${TEAM_Y - 5}`} fill="none" className="stroke-bg" strokeWidth="3" />
              </g>
            )}
            {t.outcome === 'other' && <circle cx={x} cy={TEAM_Y} r="11" className="fill-panel stroke-muted" strokeWidth="2.5" />}
            <g className="font-mono" fontSize="14" textAnchor={isLast ? 'end' : 'middle'}>
              <text x={isLast ? 676 : x} y="74" className={t.outcome === 'sent' ? 'fill-ok' : 'fill-ink'}>{t.title}</text>
              <text x={isLast ? 676 : x} y="92" className={t.outcome === 'sent' ? 'fill-ok' : 'fill-muted'}>
                {t.time}{t.outcome === 'sent' && model.team.sentOnce ? ' · sent once' : ''}
              </text>
            </g>
          </g>
        );
      })}

      {/* Visitor confirmation: worked on try 1, simulated */}
      {visitorDone && (
        <>
          <circle cx={STATIONS[0]} cy={VISITOR_Y} r="11" className="fill-panel stroke-ok" strokeWidth="3" />
          <text x={(STATIONS[0] ?? 0) + 24} y={VISITOR_Y + 5} className="font-mono fill-ink" fontSize="14">{model.visitor.label}</text>
        </>
      )}
      {frame !== null && frame.visitor === 'started' && <circle cx={STATIONS[0]} cy={VISITOR_Y} r="11" className="fill-panel stroke-ink" strokeWidth="2.5" />}

      {/* Personal data deletion: scheduled */}
      <text x={END_X} y="414" textAnchor="end" className="font-mono fill-muted" fontSize="14">{model.deletion}</text>
      <g transform={`translate(${(STATIONS[2] ?? 0) - 8} ${DELETION_Y - 8})`}>
        <circle cx="8" cy="8" r="9" className="fill-panel stroke-muted" strokeWidth="2.5" />
        <path d="M8 3.5v4.5l3 2" fill="none" className="stroke-muted" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// The event tape (720 px and wider): the recorded run on two lanes, laid out by replay time, with a read
// head. What the run has done so far is lit; what's still ahead is dimmed. Each shortened wait is an amber
// loop that carries both of its lengths, so the speed-up is never hidden.
import type { Moment, ReplayModel } from '../../lib/replay';

const W = 900;
const LEFT = 30;
const RIGHT = 870;
const TEAM_Y = 78;
const VISITOR_Y = 238;
const AHEAD = 0.35;

const stationShape = (m: Moment, x: number, y: number) => {
  if (m.shape === 'retry') {
    return (
      <>
        <circle cx={x} cy={y} r="11" className="fill-panel stroke-retry" strokeWidth="2.5" />
        <path transform={`translate(${x - 8} ${y - 8})`} d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" fill="none" className="stroke-retry" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  }
  if (m.shape === 'ok') {
    return (
      <>
        <circle cx={x} cy={y} r="12" className="fill-ok" />
        <path d={`M ${x - 6} ${y} L ${x - 2} ${y + 5} L ${x + 7} ${y - 5}`} fill="none" className="stroke-bg" strokeWidth="3" />
      </>
    );
  }
  if (m.shape === 'dead') return <path d={`M ${x - 7} ${y - 7} l 14 14 M ${x + 7} ${y - 7} l -14 14`} className="stroke-dead" strokeWidth="3" strokeLinecap="round" />;
  return <circle cx={x} cy={y} r="11" className="fill-panel stroke-ok" strokeWidth="3" />;
};

/** `mark`: a moment index to ring (beat 3 marks the deciding try). `head`: false for a still, final frame. */
export function Tape({ model, displayS, mark = null, label, head: showHead = true }: {
  model: ReplayModel; displayS: number; mark?: number | null; label: string; head?: boolean;
}) {
  const x = (d: number) => LEFT + (model.totalDisplayS === 0 ? 0 : d / model.totalDisplayS) * (RIGHT - LEFT);
  const head = x(displayS);
  const seen = (m: Moment) => m.displayS <= displayS + 1e-6;
  const results = model.moments.filter((m) => m.lane !== null && m.shape !== 'neutral');
  const team = results.filter((m) => m.lane === 'team');
  const visitor = results.filter((m) => m.lane === 'visitor');
  const visitorEnd = visitor.at(-1);
  const teamFailures = team.filter((m) => m.shape === 'retry');

  return (
    <svg width="100%" viewBox={`0 0 ${W} 270`} role="img" aria-label={label} className="block">
      <defs>
        <clipPath id="tape-done"><rect x="0" y="0" width={head} height="270" /></clipPath>
      </defs>
      <g className="font-display fill-ink" fontSize="18" fontWeight="600">
        <text x={LEFT} y={TEAM_Y - 46}>Team notification</text>
        <text x={LEFT} y={VISITOR_Y - 46}>Visitor confirmation</text>
      </g>

      {/* Unlit lanes, then the same lanes lit up to the read head */}
      <g className="stroke-track" strokeWidth="3">
        <line x1={LEFT} y1={TEAM_Y} x2={RIGHT} y2={TEAM_Y} />
        {visitorEnd && <line x1={LEFT} y1={VISITOR_Y} x2={x(visitorEnd.displayS)} y2={VISITOR_Y} />}
      </g>
      <g clipPath="url(#tape-done)" className="stroke-route" strokeWidth="4">
        <line x1={LEFT} y1={TEAM_Y} x2={RIGHT} y2={TEAM_Y} />
        {visitorEnd && <line x1={LEFT} y1={VISITOR_Y} x2={x(visitorEnd.displayS)} y2={VISITOR_Y} />}
      </g>

      {/* Shortened waits: a loop from each failure to the next try, with its real and replay lengths */}
      {model.waits.map((w, i) => {
        const from = teamFailures[i];
        const to = model.moments.find((m) => m.lane === 'team' && m.attempt === w.afterTry + 1);
        if (!from || !to) return null;
        const x1 = x(from.displayS) + 8;
        const x2 = x(to.displayS) - 4;
        const mid = (x1 + x2) / 2;
        const [real, shown] = w.label.split(' · ');
        return (
          <g key={w.afterTry} opacity={seen(from) ? 1 : AHEAD}>
            <path d={`M ${x1} ${TEAM_Y + 9} C ${x1 + 14} ${TEAM_Y + 52} ${x2 - 14} ${TEAM_Y + 52} ${x2} ${TEAM_Y + 9}`} fill="none" className="stroke-retry" strokeWidth="3" strokeDasharray="8 6" />
            <path d={`M ${mid - 9} ${TEAM_Y + 8} l 6 -16 M ${mid + 1} ${TEAM_Y + 8} l 6 -16`} className="stroke-muted" strokeWidth="2" />
            <text x={mid} y={TEAM_Y + 70} textAnchor="middle" className="font-mono fill-retry" fontSize="14">{real}</text>
            <text x={mid} y={TEAM_Y + 88} textAnchor="middle" className="font-mono fill-muted" fontSize="14">{shown}</text>
          </g>
        );
      })}

      {/* The read head, under the stations so it never hides one */}
      {showHead && <rect x={head - 3} y="44" width="6" height="214" rx="3" className="fill-ink" />}
      <circle cx={LEFT} cy={TEAM_Y} r="7" className="fill-route" />
      <circle cx={LEFT} cy={VISITOR_Y} r="7" className="fill-route" />
      {results.map((m) => {
        const cx = x(m.displayS);
        const cy = m.lane === 'team' ? TEAM_Y : VISITOR_Y;
        const i = model.moments.indexOf(m);
        return (
          <g key={i} opacity={seen(m) ? 1 : AHEAD}>
            {mark === i && <circle cx={cx} cy={cy} r="19" fill="none" className="stroke-route" strokeWidth="2" />}
            {stationShape(m, cx, cy)}
            <text x={cx > RIGHT - 60 ? cx - 16 : cx} y={cy - 22} textAnchor={cx > RIGHT - 60 ? 'end' : 'middle'} className="font-mono fill-ink" fontSize="14">
              try {m.attempt} · {m.time}
            </text>
          </g>
        );
      })}

    </svg>
  );
}

// The event tape on phones: the team notification's lane only, short enough to read at 390 px, with the
// times in HTML under it (as on the 390 board). The waits' two lengths are written out below it.
import type { ReplayModel } from '../../lib/replay';

const LEFT = 8;
const RIGHT = 348;
const Y = 34;

export function TapeCompact({ model, displayS, label }: { model: ReplayModel; displayS: number; label: string }) {
  const x = (d: number) => LEFT + (model.totalDisplayS === 0 ? 0 : d / model.totalDisplayS) * (RIGHT - LEFT);
  const head = x(displayS);
  const team = model.moments.filter((m) => m.lane === 'team' && m.shape !== 'neutral');
  const failures = team.filter((m) => m.shape === 'retry');
  return (
    <svg width="100%" viewBox="0 0 356 80" role="img" aria-label={label} className="block">
      <defs><clipPath id="tape-compact-done"><rect x="0" y="0" width={head} height="80" /></clipPath></defs>
      <line x1={LEFT} y1={Y} x2={RIGHT} y2={Y} className="stroke-track" strokeWidth="3" />
      <line x1={LEFT} y1={Y} x2={RIGHT} y2={Y} className="stroke-route" strokeWidth="4" clipPath="url(#tape-compact-done)" />
      {model.waits.map((w, i) => {
        const from = failures[i];
        const to = model.moments.find((m) => m.lane === 'team' && m.attempt === w.afterTry + 1);
        if (!from || !to) return null;
        const x1 = x(from.displayS) + 6;
        const x2 = x(to.displayS) - 3;
        return (
          <path key={w.afterTry} d={`M ${x1} ${Y + 8} C ${x1 + 10} ${Y + 34} ${x2 - 10} ${Y + 34} ${x2} ${Y + 8}`} fill="none"
            className="stroke-retry" strokeWidth="3" strokeDasharray="7 5" opacity={from.displayS <= displayS + 1e-6 ? 1 : 0.35} />
        );
      })}
      <circle cx={LEFT} cy={Y} r="6" className="fill-route" />
      {team.map((m) => {
        const cx = x(m.displayS);
        const on = m.displayS <= displayS + 1e-6 ? 1 : 0.35;
        return m.shape === 'ok' ? (
          <g key={m.realS} opacity={on}>
            <circle cx={cx} cy={Y} r="10" className="fill-ok" />
            <path d={`M ${cx - 5} ${Y} L ${cx - 1.5} ${Y + 4} L ${cx + 6} ${Y - 4}`} fill="none" className="stroke-bg" strokeWidth="2.5" />
          </g>
        ) : (
          <g key={m.realS} opacity={on}>
            <circle cx={cx} cy={Y} r="10" className={m.shape === 'retry' ? 'fill-panel stroke-retry' : 'fill-panel stroke-dead'} strokeWidth="2.5" />
            <path transform={`translate(${cx - 7} ${Y - 7}) scale(0.875)`} d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" fill="none" className="stroke-retry" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        );
      })}
      <rect x={head - 3} y="6" width="6" height="60" rx="3" className="fill-ink" />
    </svg>
  );
}

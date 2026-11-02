// Planned vs actual waits as bars on one scale (0–35 s): Northstar's setting against what was measured.
import { formatDuration, formatPlanned } from '../../lib/format';
import type { ReplayWait } from '../../lib/replay';

const SCALE_S = 35;
const pct = (s: number) => `${Math.min(100, (s / SCALE_S) * 100)}%`;

export function WaitBars({ waits }: { waits: ReplayWait[] }) {
  // How much later than planned each try started: the pickup, measured, not assumed.
  const lags = [...new Set(waits.map((w) => formatDuration(Math.max(0, w.realS - w.plannedS))))];
  const lag = lags.length === 1 ? `the ${lags[0] ?? ''}` : `the ${lags.join(' and ')}`;
  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-6 rounded-[3px] bg-track" />planned (Northstar&apos;s setting)</span>
        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-6 rounded-[3px] bg-retry" />actual (measured)</span>
      </p>
      <ul className="flex flex-col gap-4">
        {waits.map((w, i) => (
          <li key={w.afterTry} className="flex flex-col gap-1.5">
            <p className="text-base">
              <b className="font-semibold">Wait {i + 1}:</b> planned {formatPlanned(w.plannedS)}, actual {formatDuration(w.realS)}
            </p>
            <div aria-hidden="true" className="flex flex-col gap-1">
              <span className="h-3 rounded-[3px] bg-track" style={{ width: pct(w.plannedS) }} />
              <span className="h-3 rounded-[3px] bg-retry" style={{ width: pct(w.realS) }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Each actual wait runs from the failure to the next try&apos;s start, so it includes {lag} Northstar took to pick the job up
        again.
      </p>
    </div>
  );
}

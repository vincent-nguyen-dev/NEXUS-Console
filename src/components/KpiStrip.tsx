// The numbers, each with "How it's counted" (its rule, the working with this window's numbers, what skews it,
// the source). Below a minimum, a tile shows its progress toward it instead of a placeholder. Pointing at a tile
// (or focusing it) lights the part of the map it counts; the light follows the pointer (step 5.2).
import type { Kpi, Progress } from '../lib/kpis';
import type { Bars } from '../lib/perDay';
import { useCursorLight } from '../hooks/useCursorLight';
import { CountUp } from './CountUp';

function ProgressValue({ p }: { p: Progress }) {
  return (
    <dd className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-raised">
        <span className="block h-full rounded-full bg-route" style={{ width: `${Math.min(100, (p.have / p.need) * 100)}%` }} />
      </span>
      <span className="text-md font-medium">{p.have} of the {p.need} {p.noun} needed</span>
    </dd>
  );
}

/** Bars per day (or hour) across the window: never a line, so a few runs don't read as a trend. */
function Sparkline({ bars }: { bars: Bars }) {
  const w = 180;
  const h = 36;
  const max = Math.max(...bars.counts, 1);
  const bw = w / bars.counts.length;
  return (
    <dd className="flex flex-col gap-1">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Runs per ${bars.unit}, n = ${bars.n}`} className="max-w-full">
        {bars.counts.map((c, i) => {
          const bh = c === 0 ? 1 : Math.max(2, (c / max) * h);
          return (
            <rect key={i} x={i * bw + 1} y={h - bh} width={Math.max(1, bw - 2)} height={bh} rx={1}
              className={c === 0 ? 'fill-track' : 'fill-route'} opacity={c === 0 ? 0.5 : 1} />
          );
        })}
      </svg>
      <span aria-hidden="true" className="text-sm text-muted">per {bars.unit} · n = {bars.n}</span>
    </dd>
  );
}

function HowCounted({ k }: { k: Kpi }) {
  // A tile below its minimum keeps its long lines here, so every tile in the row stays the same shape.
  const extra = [k.progress?.latest ?? null, k.progress?.hint ?? null].filter((p) => p !== null);
  return (
    <dd className="mt-auto">
      <details className="group">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-route hover:underline focus-visible:underline underline-offset-2">
          How it&rsquo;s counted
        </summary>
        <div className="flex flex-col gap-2 pt-1 pb-2 text-sm">
          <p>{k.how.rule}</p>
          <p className="font-mono">{k.how.working}</p>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-muted">
            {[...extra, ...k.how.notes].map((n) => <li key={n}>{n}</li>)}
          </ul>
          <p className="text-muted">{k.how.source}</p>
        </div>
      </details>
    </dd>
  );
}

/** One number (also the bento on /how, fed the recording). */
export function KpiTile({ k, bars, delta, onFocus }: { k: Kpi; bars: Bars | null; delta: string | null; onFocus: ((id: Kpi['id'] | null) => void) | undefined }) {
  const ref = useCursorLight<HTMLDivElement>((on) => onFocus?.(on ? k.id : null));
  return (
    <div ref={ref} className="lit-card flex min-h-48 flex-col gap-1.5 overflow-hidden rounded-md border border-glass bg-panel px-4 pt-4 pb-1">
      <dt className="text-sm text-muted">{k.label}</dt>
      {k.progress !== null
        ? <ProgressValue p={k.progress} />
        : (
          <dd className={k.hasValue ? 'kpi-value font-display text-xl font-semibold' : 'kpi-value text-md font-medium text-muted'}>
            {k.hasValue ? <CountUp value={k.value} /> : k.value}
          </dd>
        )}
      <dd className="text-sm text-muted">{k.note}</dd>
      {k.id === 'runs' && bars !== null && <Sparkline bars={bars} />}
      {k.id === 'runs' && delta !== null && (
        <dd><span className="inline-flex rounded-full border border-route/35 bg-bg px-2.5 text-sm text-route shadow-[0_0_12px_rgb(124_207_227/0.14)]">{delta}</span></dd>
      )}
      <HowCounted k={k} />
    </div>
  );
}

interface Props {
  title: string;
  kpis: Kpi[];
  /** The Runs tile's sparkline, or null (fewer than 2 runs, a partial window, the recording). */
  bars?: Bars | null;
  /** "+1 since you opened this" on the Runs tile, or null. */
  delta?: string | null;
  /** A tile pointed at or focused (its map nodes light up), or null when it's left. */
  onFocus?: (id: Kpi['id'] | null) => void;
}

export function KpiStrip({ title, kpis, bars = null, delta = null, onFocus }: Props) {
  return (
    <section id="numbers" tabIndex={-1} aria-labelledby="kpi-title" className="flex scroll-mt-6 flex-col gap-3 focus:outline-none">
      <div className="flex flex-col gap-1">
        <h2 id="kpi-title" className="font-display text-2xl font-semibold">{title}</h2>
        <p className="text-sm text-muted">Point at a number to light what it counts on the map. &ldquo;How it&rsquo;s counted&rdquo; gives the arithmetic.</p>
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] items-stretch gap-3">
        {kpis.map((k) => <KpiTile key={k.id} k={k} bars={bars} delta={delta} onFocus={onFocus} />)}
      </dl>
    </section>
  );
}

/** Static placeholders while the first answer is on its way. No pulsing: nothing on this page loops. */
export function KpiSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <div className="h-7 w-64 max-w-full rounded-sm bg-raised" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 rounded-md border border-glass bg-panel" />
        ))}
      </div>
    </div>
  );
}

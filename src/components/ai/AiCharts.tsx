// The AI usage view's three charts (step 6.1b, board G1), hand-drawn SVG at their real width: calls per day (bars,
// never a line: a few days with gaps), every answered call's response time (a dot strip with the median and the 95th
// percentile marked), and tokens per day (in above the line, out below). A bar that grows on a poll grows once, from
// its old height (lab pick, 31 Oct); a new window or source draws at once.
import { useState } from 'react';
import type { Bucket } from '../../lib/aiMetrics';
import { formatDuration, formatUtcDay, formatUtcTime } from '../../lib/format';
import { ChartFrame, type ChartRow } from '../charts/ChartFrame';

const PAD = 16;
/** Out tokens: the spine's indigo end, a graphic colour (3:1 or more on raised), never text. */
const OUT_FILL = '#6E6FD8';
const n0 = (n: number) => n.toLocaleString('en-US');

function bucketName(b: Bucket, unit: string): string {
  const iso = new Date(b.startMs).toISOString();
  return unit === 'hour' ? formatUtcTime(iso) : formatUtcDay(iso).replace(/ \d{4}$/, '');
}

/** Index of the bucket under x, for evenly spaced slots. */
const slotAt = (x: number, w: number, n: number) => (n === 0 ? null : Math.max(0, Math.min(n - 1, Math.floor(((x - PAD) / (w - 2 * PAD)) * n))));
const slotX = (i: number, w: number, n: number) => PAD + ((i + 0.5) / n) * (w - 2 * PAD);

/** Bars that grew since the last poll, and the height each grows from (0..1 of its new height). */
function useGrowth(buckets: Bucket[]): Map<number, number> {
  const key = buckets.map((b) => `${b.startMs}:${b.calls}`).join(',');
  const [state, setState] = useState({ key, counts: new Map(buckets.map((b) => [b.startMs, b.calls])), grow: new Map<number, number>() });
  if (state.key !== key) {
    const grow = new Map<number, number>();
    for (const b of buckets) {
      const before = state.counts.get(b.startMs);
      if (before !== undefined && b.calls > before) grow.set(b.startMs, before / b.calls);
    }
    setState({ key, counts: new Map(buckets.map((b) => [b.startMs, b.calls])), grow });
  }
  return state.grow;
}

function axisLabels(buckets: Bucket[], unit: string, w: number, h: number) {
  const n = buckets.length;
  const picks = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
  return picks.map((i, k) => {
    const b = buckets[i];
    if (!b) return null;
    const anchor = k === 0 && picks.length > 1 ? 'start' : k === picks.length - 1 && picks.length > 1 ? 'end' : 'middle';
    const x = anchor === 'start' ? PAD : anchor === 'end' ? w - PAD : slotX(i, w, n);
    return <text key={b.startMs} x={x} y={h - 8} textAnchor={anchor} className="fill-muted font-mono text-sm">{bucketName(b, unit)}</text>;
  });
}

export function ChatsChart({ buckets, unit, peak, peakText, one, many }: { buckets: Bucket[]; unit: string; peak: Bucket | null; peakText: string | null; one: string; many: string }) {
  const grow = useGrowth(buckets);
  const h = 200;
  const n = buckets.length;
  const max = Math.max(1, ...buckets.map((b) => b.calls));
  const top = 40;
  const base = h - 34;
  const rows: ChartRow[] = buckets.map((b) => ({ head: bucketName(b, unit), value: `${b.calls} ${b.calls === 1 ? one : many}` }));
  return (
    <ChartFrame
      label={`${many[0]?.toUpperCase()}${many.slice(1)} per ${unit}`}
      columns={[unit === 'hour' ? 'Hour (UTC)' : 'Day (UTC)', many]}
      rows={rows}
      height={h}
      indexAt={(x, w) => slotAt(x, w, n)}
      pointAt={(i, w) => {
        const b = buckets[i];
        return { x: slotX(i, w, n), y: base - ((b?.calls ?? 0) / max) * (base - top) };
      }}
      draw={(w, active) => {
        const slot = (w - 2 * PAD) / Math.max(1, n);
        const bw = Math.max(2, Math.min(18, slot * 0.62));
        const pi = peak === null ? -1 : buckets.indexOf(peak);
        const px = pi < 0 ? 0 : slotX(pi, w, n);
        const right = px < w / 2;
        return (
          <>
            <line x1={PAD} x2={w - PAD} y1={base} y2={base} className="stroke-track" />
            {buckets.map((b, i) => {
              const x = slotX(i, w, n);
              if (b.calls === 0) return <line key={b.startMs} x1={x} x2={x} y1={base - 2} y2={base + 2} className="stroke-track" />;
              const bh = Math.max(3, (b.calls / max) * (base - top));
              const from = grow.get(b.startMs);
              return (
                <rect
                  key={b.startMs} x={x - bw / 2} y={base - bh} width={bw} height={bh} rx={3}
                  className={`fill-route ${from !== undefined ? 'ai-bar-grow' : ''}`}
                  style={from !== undefined ? ({ '--from': from } as React.CSSProperties) : undefined}
                  opacity={active === i ? 1 : b === peak ? 0.95 : 0.7}
                />
              );
            })}
            {active !== null && <line x1={slotX(active, w, n)} x2={slotX(active, w, n)} y1={top - 10} y2={base} className="stroke-muted" strokeDasharray="3 3" />}
            {/* The callout steps aside while a tooltip shows. */}
            {peak !== null && peakText !== null && w >= 260 && active === null && (
              <g>
                <path d={`M ${px + (right ? 6 : -6)} ${top + 4} L ${px + (right ? 22 : -22)} ${top - 14} L ${px + (right ? 130 : -130)} ${top - 14}`} fill="none" className="stroke-muted" />
                <text x={px + (right ? 26 : -26)} y={top - 19} textAnchor={right ? 'start' : 'end'} className="fill-ink font-mono text-sm">{peakText}</text>
              </g>
            )}
            {axisLabels(buckets, unit, w, h)}
          </>
        );
      }}
    />
  );
}

export function TimesChart({ ms, median, p95 }: { ms: number[]; median: number | null; p95: number | null }) {
  const h = 190;
  const y0 = h - 54;
  const maxS = Math.max(1, Math.ceil(Math.max(0, ...ms) / 1000));
  const X = (v: number, w: number) => PAD + (v / (maxS * 1000)) * (w - 2 * PAD);
  const rows: ChartRow[] = ms.map((v, i) => ({ head: `${i + 1} of ${ms.length}, fastest first`, value: formatDuration(v / 1000) }));
  const place = (w: number) => {
    const seen: { x: number; row: number }[] = [];
    return ms.map((v) => {
      const x = X(v, w);
      let row = 0;
      while (seen.some((s) => s.row === row && Math.abs(s.x - x) < 11)) row += 1;
      seen.push({ x, row });
      return { x, y: y0 - 10 - row * 11 };
    });
  };
  return (
    <ChartFrame
      label="Response time of each answered call"
      columns={['Call', 'Response time']}
      rows={rows}
      height={h}
      indexAt={(x, w) => {
        if (ms.length === 0) return null;
        let best = 0;
        ms.forEach((v, i) => { if (Math.abs(X(v, w) - x) < Math.abs(X(ms[best] ?? 0, w) - x)) best = i; });
        return best;
      }}
      pointAt={(i, w) => place(w)[i] ?? { x: 0, y: 0 }}
      draw={(w, active) => {
        const dots = place(w);
        const mark = (v: number, text: string, anchor: 'start' | 'end') => {
          const x = X(v, w);
          return (
            <g key={text}>
              <line x1={x} x2={x} y1={18} y2={y0 + 2} className="stroke-ink" strokeWidth={1.5} strokeDasharray="3 3" />
              <text x={x + (anchor === 'start' ? 6 : -6)} y={22} textAnchor={anchor} className="fill-ink font-mono text-sm">{text}</text>
            </g>
          );
        };
        return (
          <>
            <line x1={PAD} x2={w - PAD} y1={y0} y2={y0} className="stroke-track" />
            {Array.from({ length: maxS + 1 }, (_, s) => (
              <g key={s}>
                <line x1={X(s * 1000, w)} x2={X(s * 1000, w)} y1={y0 + 4} y2={y0 + 9} className="stroke-track" />
                {(maxS <= 8 || s % 2 === 0) && (
                  <text x={X(s * 1000, w)} y={y0 + 30} textAnchor={s === 0 ? 'start' : s === maxS ? 'end' : 'middle'} className="fill-muted font-mono text-sm">{s} s</text>
                )}
              </g>
            ))}
            {dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={active === i ? 6.5 : 5} className="fill-route" opacity={active === null || active === i ? 0.9 : 0.55} />
            ))}
            {median !== null && mark(median, `median ${formatDuration(median / 1000)}`, 'end')}
            {p95 !== null && mark(p95, `95th ${formatDuration(p95 / 1000)}`, 'start')}
          </>
        );
      }}
    />
  );
}

export function TokensChart({ buckets, unit }: { buckets: Bucket[]; unit: string }) {
  const h = 220;
  const mid = 112;
  const up = 78;
  const down = 64;
  const n = buckets.length;
  const maxIn = Math.max(1, ...buckets.map((b) => b.tokensIn));
  const maxOut = Math.max(1, ...buckets.map((b) => b.tokensOut));
  const rows: ChartRow[] = buckets.map((b) => ({ head: bucketName(b, unit), value: `${n0(b.tokensIn)} in · ${n0(b.tokensOut)} out` }));
  return (
    <ChartFrame
      label={`Tokens per ${unit}, in and out`}
      columns={[unit === 'hour' ? 'Hour (UTC)' : 'Day (UTC)', 'Tokens']}
      rows={rows}
      height={h}
      indexAt={(x, w) => slotAt(x, w, n)}
      pointAt={(i, w) => ({ x: slotX(i, w, n), y: mid - ((buckets[i]?.tokensIn ?? 0) / maxIn) * up })}
      draw={(w, active) => {
        const slot = (w - 2 * PAD) / Math.max(1, n);
        const bw = Math.max(2, Math.min(18, slot * 0.62));
        return (
          <>
            <text x={PAD} y={20} className="fill-muted font-mono text-sm">in, to {n0(maxIn)}</text>
            <text x={PAD} y={h - 8} className="fill-muted font-mono text-sm">out, to {n0(maxOut)}</text>
            <line x1={PAD} x2={w - PAD} y1={mid} y2={mid} className="stroke-track" />
            {buckets.map((b, i) => {
              if (b.calls === 0) return null;
              const x = slotX(i, w, n) - bw / 2;
              const hi = Math.max(2, (b.tokensIn / maxIn) * up);
              const ho = Math.max(2, (b.tokensOut / maxOut) * down);
              const o = active === null || active === i ? 0.9 : 0.6;
              return (
                <g key={b.startMs}>
                  <rect x={x} y={mid - 2 - hi} width={bw} height={hi} rx={3} className="fill-route" opacity={o} />
                  <rect x={x} y={mid + 2} width={bw} height={ho} rx={3} fill={OUT_FILL} opacity={o} />
                </g>
              );
            })}
            {active !== null && <line x1={slotX(active, w, n)} x2={slotX(active, w, n)} y1={28} y2={h - 26} className="stroke-muted" strokeDasharray="3 3" />}
          </>
        );
      }}
    />
  );
}

// A chart's frame on the AI usage and Retries views (steps 6.1b, 6.2b): the raised inset with the 3 % grid, drawn at its real
// width. The pointer or the arrow keys pick one item (a day, a call) and a glass tooltip shows it; a visually hidden
// table holds every value for screen readers, and the picked item is announced. One tab stop per chart.
import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useWidth } from '../../hooks/useWidth';

export interface ChartRow { head: string; value: string }

interface Props {
  /** The chart's name, for its group and its table caption. */
  label: string;
  /** The table's two column names. */
  columns: [string, string];
  rows: ChartRow[];
  height: number;
  /** The SVG's contents at width `w`, with the picked row (or null). */
  draw: (w: number, active: number | null) => ReactNode;
  /** The row under a point (px from the top left), or null. */
  indexAt: (x: number, w: number, y: number) => number | null;
  /** Where the tooltip points for a row (px). */
  pointAt: (i: number, w: number) => { x: number; y: number };
}

export function ChartFrame({ label, columns, rows, height, draw, indexAt, pointAt }: Props) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const last = rows.length - 1;
  const pick = (i: number | null) => setActive(i === null || rows.length === 0 ? null : Math.max(0, Math.min(last, i)));
  const onKey = (e: KeyboardEvent) => {
    const step: Record<string, number | 'home' | 'end'> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: 'home', End: 'end' };
    const s = step[e.key];
    if (s === undefined || rows.length === 0) return;
    e.preventDefault();
    if (s === 'home') pick(0);
    else if (s === 'end') pick(last);
    else pick(active === null ? (s > 0 ? 0 : last) : active + s);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const box = e.currentTarget.getBoundingClientRect();
    pick(indexAt(e.clientX - box.left, w, e.clientY - box.top));
  };
  const tip = active === null || w === 0 ? null : pointAt(active, w);
  const row = active === null ? null : rows[active];
  return (
    <div className="relative">
      <div
        ref={ref}
        role="group"
        tabIndex={0}
        aria-label={`${label}. Use the arrow keys to read each value.`}
        onKeyDown={onKey}
        onFocus={() => active === null && pick(last)}
        onBlur={() => setActive(null)}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        className="chart-inset relative overflow-hidden rounded-sm border border-glass bg-raised outline-none focus-visible:ring-2 focus-visible:ring-route"
        style={{ height }}
      >
        {w > 0 && (
          <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} aria-hidden="true" className="block">
            {draw(w, active)}
          </svg>
        )}
        {tip !== null && row && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 rounded-sm border border-glass bg-panel/95 px-3 py-2 text-sm whitespace-nowrap shadow-lg"
            style={{ left: Math.min(Math.max(8, tip.x - 70), w - 150), top: Math.max(6, tip.y - 58) }}
          >
            <span className="block text-muted">{row.head}</span>
            <span className="block font-mono text-ink">{row.value}</span>
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">{row ? `${row.head}: ${row.value}` : ''}</p>
      {/* The box is hidden, not the table: a table ignores a 1 px width and kept the page scrolling sideways at 320 px (7.1d, F19). */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead><tr><th scope="col">{columns[0]}</th><th scope="col">{columns[1]}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.head}><th scope="row">{r.head}</th><td>{r.value}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

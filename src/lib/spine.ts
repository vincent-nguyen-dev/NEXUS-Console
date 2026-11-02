// The landing pages' spine (step 5.4d, M2, lab picks of 2026-10-30): a route line in the left gutter that bends in to
// a station at each section title and ends in a curve into the CTA band's button. It draws as the visitor scrolls and
// never undraws. DOM-free: the Spine component measures the page and feeds these numbers in. Every y is in the spine
// wrapper's own coordinates (0 = its top).

/** The line's tip sits this far down the window (the lab's 60 %). */
export const SPINE_REACH = 0.6;
/** The line starts this far above the first station. */
export const SPINE_LEAD = 60;
/** Half the height of a bend: the line leaves the gutter this far above a station and is back this far below. */
export const BEND_HALF = 36;
/** The final curve into the button starts this far above the button's middle. */
export const END_RISE = 120;

export interface SpineGeometry {
  /** The gutter line's x, and the x a bend reaches (where the station sits). */
  x: number;
  bend: number;
  /** Each section title's middle, top to bottom. */
  stations: number[];
  /** Where the line ends: just left of the CTA button, at its middle. Null without a button (the line ends at the last station). */
  end: { x: number; y: number } | null;
}

/** Where the line starts and where it finishes, in y. */
export function spineSpan(g: SpineGeometry): { first: number; last: number } | null {
  const top = g.stations[0];
  if (top === undefined) return null;
  const last = g.end?.y ?? g.stations[g.stations.length - 1] ?? top;
  return { first: top - SPINE_LEAD, last };
}

/** The SVG path: straight down the gutter, a bend out to each station and back, then the curve into the button. */
export function spinePath(g: SpineGeometry): string {
  const span = spineSpan(g);
  if (span === null) return '';
  const { x, bend } = g;
  let d = `M ${x} ${span.first}`;
  for (const y of g.stations) {
    d += ` L ${x} ${y - BEND_HALF} C ${x} ${y - 14} ${bend} ${y - 10} ${bend} ${y} C ${bend} ${y + 10} ${x} ${y + 14} ${x} ${y + BEND_HALF}`;
  }
  if (g.end !== null) {
    const lastBend = (g.stations[g.stations.length - 1] ?? span.first) + BEND_HALF;
    const rise = Math.max(lastBend, g.end.y - END_RISE);
    d += ` L ${x} ${rise} C ${x} ${g.end.y - 40} ${x + 40} ${g.end.y} ${g.end.x} ${g.end.y}`;
  }
  return d;
}

/**
 * How much of the line is drawn, 0..1 in y: the tip follows `reach` (the window's 60 % line, in the wrapper's
 * coordinates), never goes back (`prev`), and finishes when the page is scrolled to its end, even if the 60 % line
 * can't reach the button there.
 */
export function spineProgress(reach: number, span: { first: number; last: number }, prev: number, atEnd = false): number {
  if (atEnd) return 1;
  const p = span.last > span.first ? (reach - span.first) / (span.last - span.first) : 1;
  return Math.max(prev, Math.min(1, Math.max(0, p)));
}

/** The y the tip has reached for a progress. */
export const drawnY = (span: { first: number; last: number }, drawn: number) => span.first + drawn * (span.last - span.first);

/** How many stations the tip has passed (each lights as the tip reaches its title). */
export function stationsReached(stations: number[], tipY: number): number {
  return stations.filter((y) => y <= tipY + 1).length;
}

/** A sample of the path: its length so far at a y. Sorted by y, both increasing. */
export interface LengthSample { y: number; len: number }

/**
 * The fraction of the path's length to draw for the tip's y, interpolated between samples. The curve into the
 * button is mostly sideways, so it has no samples inside it: it draws as the tip covers its last 120 px of y.
 */
export function lengthAt(samples: LengthSample[], total: number, y: number): number {
  const firstSample = samples[0];
  const lastSample = samples[samples.length - 1];
  if (firstSample === undefined || lastSample === undefined || total <= 0) return 1;
  if (y <= firstSample.y) return firstSample.len / total;
  if (y >= lastSample.y) return lastSample.len / total;
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((samples[mid]?.y ?? 0) <= y) lo = mid;
    else hi = mid;
  }
  const a = samples[lo] ?? firstSample;
  const b = samples[hi] ?? lastSample;
  const k = b.y > a.y ? (y - a.y) / (b.y - a.y) : 1;
  return (a.len + k * (b.len - a.len)) / total;
}

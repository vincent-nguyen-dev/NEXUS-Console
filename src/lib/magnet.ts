// The CTA band's magnetic button (step 5.4c, F11): it leans toward a fine pointer, at most 6 px, and only while the
// pointer is within 120 px of its edge. DOM-free; the band's hook feeds it the pointer and the button's box.

export const MAGNET_MAX_PX = 6;
export const MAGNET_REACH_PX = 120;

export interface Point { x: number; y: number }
export interface Box { left: number; top: number; width: number; height: number }

/** How far the pointer is from the box's edge (0 inside it). */
export function edgeDistance(p: Point, box: Box): number {
  const dx = Math.max(box.left - p.x, 0, p.x - (box.left + box.width));
  const dy = Math.max(box.top - p.y, 0, p.y - (box.top + box.height));
  return Math.hypot(dx, dy);
}

/**
 * The button's offset toward the pointer: it grows with the distance from the button's centre up to `max` at
 * `reach` px, and is 0 once the pointer is more than `reach` px from the button's edge. Rounded to 0.1 px.
 */
export function magnetOffset(p: Point, box: Box, reach = MAGNET_REACH_PX, max = MAGNET_MAX_PX): Point {
  if (edgeDistance(p, box) > reach) return { x: 0, y: 0 };
  const dx = p.x - (box.left + box.width / 2);
  const dy = p.y - (box.top + box.height / 2);
  const d = Math.hypot(dx, dy);
  if (d === 0) return { x: 0, y: 0 };
  const k = (Math.min(1, d / reach) * max) / d;
  const round = (v: number) => Math.round(v * k * 10) / 10 || 0;
  return { x: round(dx), y: round(dy) };
}

// The landing page's scroll band (step 5.3b): NEXUS's three promises moving slowly, faster while the page scrolls
// (and backwards while it scrolls up), slower while the hero's replay plays. Pure numbers here; ScrollBand runs them
// once a frame. Lab picks (2026-10-30): 40 px/s, a boost of up to 6×, 10 % while the replay plays.
export const BAND_SPEED_PX_S = 40;
export const BAND_BOOST_CAP = 6;
export const BAND_PLAYING = 0.1;
/** Scroll speed (px/s) that adds one more 1× of boost. */
const PX_S_PER_BOOST = 400;
/** Scrolling up faster than this reverses the band. */
const REVERSE_BELOW_PX_S = -40;
/** How fast the speed follows its target (1/s): a spring that settles in about half a second. */
const SPRING = 6;
/** How fast the scroll speed fades once scrolling stops: to 2 % within a second. */
const FADE_PER_S = 0.02;

/** The band's target speed, as a multiple of the base speed: direction from the scroll, boost capped. */
export function velocityToSpeed(scrollPxPerS: number, { cap = BAND_BOOST_CAP, playing = false } = {}): number {
  const v = Number.isFinite(scrollPxPerS) ? scrollPxPerS : 0;
  const boost = 1 + Math.min(cap - 1, Math.abs(v) / PX_S_PER_BOOST);
  const direction = v < REVERSE_BELOW_PX_S ? -1 : 1;
  return direction * boost * (playing ? BAND_PLAYING : 1);
}

/** One spring step from the current speed toward the target over `dtS` seconds (never overshoots). */
export const springStep = (current: number, target: number, dtS: number): number =>
  current + (target - current) * Math.min(1, Math.max(0, dtS) * SPRING);

/** The scroll speed after `dtS` seconds without new scrolling. */
export const fadeScroll = (scrollPxPerS: number, dtS: number): number => scrollPxPerS * FADE_PER_S ** Math.max(0, dtS);

/** The band's offset kept within one copy's width, so the repeated text wraps seamlessly: (-width, 0]. */
export function wrapOffset(x: number, copyWidth: number): number {
  if (!(copyWidth > 0) || !Number.isFinite(x)) return 0;
  const r = x % copyWidth;
  return r > 0 ? r - copyWidth : r === 0 ? 0 : r;
}

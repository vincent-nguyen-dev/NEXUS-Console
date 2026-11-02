// WCAG 2.x contrast, used by the token test so every colour pair is checked in CI.
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance

const HEX = /^#([0-9a-f]{6})$/i;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#RRGGBB` colour, from 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const match = HEX.exec(hex);
  if (!match?.[1]) throw new Error(`expected #RRGGBB, got ${hex}`);
  const n = Number.parseInt(match[1], 16);
  return 0.2126 * channel((n >> 16) & 0xff) + 0.7152 * channel((n >> 8) & 0xff) + 0.0722 * channel(n & 0xff);
}

/** Contrast ratio between two colours, from 1 to 21. Order doesn't matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Reads `--color-<name>: #RRGGBB;` declarations from a stylesheet. */
export function parseColorTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const m of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const [, name, value] = m;
    if (name && value) tokens[name] = value;
  }
  return tokens;
}

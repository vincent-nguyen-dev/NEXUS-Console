import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio, parseColorTokens, relativeLuminance } from './contrast';

// Read from disk: Vitest replaces CSS imports (even ?raw) with an empty string.
const tokensCss = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBe(1);
  });

  it('accepts lower-case hex', () => {
    expect(relativeLuminance('#ffffff')).toBe(1);
  });

  it('rejects anything but #RRGGBB', () => {
    expect(() => relativeLuminance('#FFF')).toThrow();
    expect(() => relativeLuminance('red')).toThrow();
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white, in either order', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21);
  });

  it('is 1 for a colour on itself', () => {
    expect(contrastRatio('#7CCFE3', '#7CCFE3')).toBe(1);
  });

  it('matches the hand-checked v2 values (the v2 tokens in src/styles/tokens.css)', () => {
    expect(contrastRatio('#EEF1F8', '#131A2D')).toBeCloseTo(15.31, 2); // ink on panel
    expect(contrastRatio('#64708F', '#1B2339')).toBeCloseTo(3.16, 2);  // track on raised
    expect(contrastRatio('#0C1120', '#7CCFE3')).toBeCloseTo(10.65, 2); // button text: ground on route
  });
});

describe('design tokens (src/styles/tokens.css)', () => {
  const tokens = parseColorTokens(tokensCss);
  const color = (name: string): string => {
    const value = tokens[name];
    if (value === undefined) throw new Error(`missing token --color-${name}`);
    return value;
  };

  it('defines exactly the 14 v2 colours (deep added in 5.2c; glass is an rgb hairline, not a hex token)', () => {
    expect(Object.keys(tokens).sort()).toEqual(
      ['bg', 'dead', 'deep', 'glow-indigo', 'glow-teal', 'ink', 'muted', 'ok', 'panel', 'raised', 'retry', 'route', 'rule', 'track'],
    );
  });

  // WCAG AA for normal text: 4.5:1 on every surface text can sit on.
  const textColours = ['ink', 'muted', 'route', 'ok', 'retry', 'dead'];
  const surfaces = ['bg', 'panel', 'raised', 'deep'];
  for (const fg of textColours) {
    for (const surface of surfaces) {
      it(`${fg} text on ${surface} is at least 4.5:1`, () => {
        expect(contrastRatio(color(fg), color(surface))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  // Unlit track is a non-text graphic (WCAG 1.4.11, 3:1). v2's track reaches it on every surface
  // (3.81, 3.51, 3.16), so D0's "never on raised" rule is gone.
  for (const surface of surfaces) {
    it(`track on ${surface} is at least 3:1`, () => {
      expect(contrastRatio(color('track'), color(surface))).toBeGreaterThanOrEqual(3);
    });
  }

  // The teal light is decoration, but text can drift over its brightest point: only ink, route, ok
  // and retry may sit there (8.09, 5.18, 5.20, 4.90); muted (4.11) and dead (3.53) never do.
  for (const fg of ['ink', 'route', 'ok', 'retry']) {
    it(`${fg} text on the teal light's peak is at least 4.5:1`, () => {
      expect(contrastRatio(color(fg), color('glow-teal'))).toBeGreaterThanOrEqual(4.5);
    });
  }
  it('muted and dead text fail on the teal light (documents the rule above)', () => {
    expect(contrastRatio(color('muted'), color('glow-teal'))).toBeLessThan(4.5);
    expect(contrastRatio(color('dead'), color('glow-teal'))).toBeLessThan(4.5);
  });

  // The map's spotlight (step 5.1b) is the teal light at 85% over the panel at its centre (MapWide's gradient):
  // the station labels it reaches, muted ones included, stay readable. Blended per channel, rounded.
  const blend = (fg: string, bg: string, a: number) => `#${[1, 3, 5]
    .map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0'))
    .join('')}`;
  const spotPeak = () => blend(color('glow-teal'), color('panel'), 0.85);
  for (const fg of ['ink', 'muted', 'ok', 'retry']) {
    it(`${fg} text under the map's spotlight (85% teal over panel) is at least 4.5:1`, () => {
      expect(contrastRatio(color(fg), spotPeak())).toBeGreaterThanOrEqual(4.5);
    });
  }
  it('the spotlight peak is #1C4655, where muted text holds 4.59:1 (hand-checked)', () => {
    expect(spotPeak().toUpperCase()).toBe('#1C4655');
    expect(contrastRatio(color('muted'), spotPeak())).toBeCloseTo(4.59, 2);
  });

  // The console cards' light (step 5.2, picked in the lab): a 5 % route pool behind a tile's value, an 8 % pool under
  // the pointer and its grid's 8 % white lines. Where all three peak at once, muted and ink text keep AA.
  const litPeak = () => blend('#FFFFFF', blend(color('route'), color('panel'), 0.13), 0.08);
  for (const fg of ['ink', 'muted', 'route']) {
    it(`${fg} text where the value pool, the cursor light and a grid line overlap is at least 4.5:1`, () => {
      expect(contrastRatio(color(fg), litPeak())).toBeGreaterThanOrEqual(4.5);
    });
  }

  // The CTA band (step 5.4c, lab pick): its grid's 6 % white lines over the ground, under the band's line (muted),
  // the email (ink) and the arrow link's label.
  for (const fg of ['ink', 'muted', 'route']) {
    it(`${fg} text on a CTA band grid line (6% white over bg) is at least 4.5:1`, () => {
      expect(contrastRatio(color(fg), blend('#FFFFFF', color('bg'), 0.06))).toBeGreaterThanOrEqual(4.5);
    });
  }
  // The expanding arrow, open: ink label on the 10 % route pill over the panel (the doors and services sit on panel),
  // and the ground's colour for the arrow on the filled ring.
  it('the open arrow keeps its label and arrow at AA', () => {
    expect(contrastRatio(color('ink'), blend(color('route'), color('panel'), 0.1))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(color('bg'), color('route'))).toBeGreaterThanOrEqual(4.5);
  });

  // Phase 6's charts sit on the raised inset. Marks are non-text graphics (3:1): the AI view's out-token bars (the
  // spine's indigo end), the Retries view's hatch lines (amber at 55 %) and a lone wait dot (amber at 60 %,
  // RetriesView's WAIT_DOT_OPACITY). Text over the 8 % amber tint behind the hatching keeps AA.
  it('phase 6 chart marks reach 3:1 on the raised inset, and text over the tint keeps AA', () => {
    const raised = color('raised');
    expect(contrastRatio('#6E6FD8', raised)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(blend(color('retry'), raised, 0.55), raised)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(blend(color('retry'), raised, 0.6), raised)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(blend(color('route'), raised, 0.7), raised)).toBeGreaterThanOrEqual(3);
    for (const fg of ['ink', 'muted']) expect(contrastRatio(color(fg), blend(color('retry'), raised, 0.08))).toBeGreaterThanOrEqual(4.5);
  });

  it('a traced run in ink stands out on the panel and over the dimmed map', () => {
    expect(contrastRatio(color('ink'), color('panel'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(color('ink'), color('track'))).toBeGreaterThanOrEqual(3);
  });
});

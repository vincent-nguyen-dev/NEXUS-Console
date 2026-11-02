import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Rules that live in CSS and config, read from disk (Vitest replaces CSS imports with an empty string). Step 7.1d.
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const netlify = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');

describe('reduced motion', () => {
  // The global rule: everything inside @media (prefers-reduced-motion: reduce) { *, *::before, *::after { … } }.
  const start = css.indexOf('@media (prefers-reduced-motion: reduce) {\n    *,');
  const rule = css.slice(start, css.indexOf('}', start));

  it('zeroes durations and delays, so nothing waits on its first frame and then pops in (F11)', () => {
    expect(start).toBeGreaterThan(-1);
    for (const decl of ['animation-duration: 0s', 'animation-delay: 0s', 'transition-duration: 0s', 'transition-delay: 0s', 'animation-iteration-count: 1']) {
      expect(rule).toContain(`${decl} !important`);
    }
  });
});

describe('netlify.toml', () => {
  it('skips builds for pushes that change only docs, Markdown, notes or CI (7.2b)', () => {
    const line = netlify.split(/\r?\n/).find((l) => l.trim().startsWith('ignore = ')) ?? '';
    expect(line).toContain('git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- .');
    for (const path of ['docs/', '*.md', '.claude/', '.github/']) expect(line).toContain(`':(exclude)${path}'`);
    // Nothing the build reads is excluded.
    for (const path of ['src', 'public', 'index.html', 'package']) expect(line).not.toContain(path);
  });

  it('caches the hashed files in /assets for a year (F15)', () => {
    const block = netlify.slice(netlify.indexOf('for = "/assets/*"'));
    expect(block.slice(0, 200)).toContain('Cache-Control = "public, max-age=31536000, immutable"');
  });
});

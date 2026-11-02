// One word per idea in everything a visitor reads (the project's glossary). This scans the source
// text of src/ for visible strings (literals with a space, and JSX text) and fails on the words we
// chose not to use. It's a heuristic over source text, so it checks itself on a planted fixture too.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NORTHSTAR_WF } from '../test/workflow';

const BANNED: { re: RegExp; use: string }[] = [
  { re: /\battempts?\b/i, use: 'try / tries' },
  { re: /out of tries/i, use: 'gave up' },
  { re: /(?<![-\w])dead(?![-\w])/i, use: 'gave up' },
  { re: /\bworker/i, use: 'never reported back' },
  { re: /\blease\b/i, use: 'never reported back' },
  { re: /\bpurge/i, use: 'personal data deletion' },
  { re: /\bpii\b/i, use: 'personal data' },
  { re: /\bmock\b/i, use: 'simulated' },
  { re: /\bsignals?\b/i, use: 'activity / update' },
  { re: /\bleads?\b/i, use: 'enquiry / enquiries' },
  // The story's name since 3.2 (checkpoint B, C5).
  { re: /guided investigation/i, use: 'the story' },
  // "step" belongs to the story only ("Step 2 of 5", "Investigation steps").
  { re: /\bsteps?\b(?!\s*(\d+\s*)?of\b)(?<!Investigation steps)/i, use: 'job' },
];

/** Comments and class lists aren't visible text. Newlines are kept so line numbers stay right. */
function strip(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[ \t])\/\/.*$/gm, blank)
    .replace(/className=\{`[^`]*`\}/g, blank)
    .replace(/className=\{[^}]*\}/g, blank)
    .replace(/className="[^"]*"/g, blank);
}

export interface Hit {
  line: number;
  text: string;
  use: string;
}

/** Visible-text candidates in one source file, and the banned words in them. */
export function scan(source: string): Hit[] {
  const src = strip(source);
  const lineAt = (index: number) => src.slice(0, index).split('\n').length;
  const texts: { index: number; text: string }[] = [];

  // String and template literals that read like text (they contain a space).
  for (const m of src.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) {
    const text = m[0].slice(1, -1).replace(/\$\{[^}]*\}/g, '');
    if (/ /.test(text.trim())) texts.push({ index: m.index, text });
  }
  // JSX text between tags. A ">" from an arrow or a comparison is followed by code, which is skipped.
  for (const m of src.matchAll(/(?<![=-])>([^<>]*)</g)) {
    const text = (m[1] ?? '').replace(/\{[^{}]*\}/g, ' ');
    // Prose has parentheses; code between tags has ; = && || (a ">" from "=>" is excluded above).
    if (/[;=]|&&|\|\|/.test(text) || !/[a-z]/i.test(text)) continue;
    texts.push({ index: m.index, text });
  }

  return texts.flatMap(({ index, text }) =>
    BANNED.filter((b) => b.re.test(text)).map((b) => ({ line: lineAt(index), text: text.trim(), use: b.use })));
}

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'test' ? [] : sources(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

describe('the scanner (checked on a planted fixture)', () => {
  const fixture = [
    "const a = 'Team notification failed on attempt 2';",
    '<p className="text-dead border-rule">Gave up after 4 tries</p>',
    '// the worker leases each job',
    "if (e.detail === 'lease_expired') return;",
    '<h2>Step {current} of {total}</h2>',
    '<ol aria-label="Investigation steps">',
    "const b = `Lead to last step ${x}`;",
    '{items.map((i) => i.attempt > 1 ? <b>x</b> : null)}',
    '<p>Each lead (from the contact form) starts three jobs.</p>',
  ].join('\n');
  const hits = scan(fixture);

  it('catches banned words in strings and JSX text (prose with parentheses too), with their line', () => {
    expect(hits.map((h) => [h.line, h.use])).toEqual([[1, 'try / tries'], [7, 'enquiry / enquiries'], [7, 'job'], [9, 'enquiry / enquiries']]);
  });

  it('ignores class names, comments, codes without spaces, the tour\'s own "step", and code', () => {
    expect(hits.some((h) => [2, 3, 4, 5, 6, 8].includes(h.line))).toBe(false);
  });
});

describe('every visible string in src/ uses the chosen words', () => {
  it('has no banned word (file:line: text → use instead)', () => {
    const found = sources(SRC).flatMap((file) =>
      scan(readFileSync(file, 'utf8')).map((h) => `${relative(SRC, file)}:${h.line}: "${h.text}" → ${h.use}`));
    expect(found).toEqual([]);
  });
});

describe("the frozen workflow description's words (the feed writes them, the visitor reads them)", () => {
  it('has no banned word in a label, purpose, result, error or flag', () => {
    const wf = NORTHSTAR_WF;
    const texts = [
      wf.trigger.one, wf.trigger.many,
      ...wf.steps.flatMap((s) => [s.label, s.purpose, ...s.results.map((r) => r.label)]),
      ...wf.errors.map((e) => e.label), ...wf.flags.flatMap((f) => [f.label, f.effect]),
    ];
    const found = texts.flatMap((t) => BANNED.filter((b) => b.re.test(t)).map((b) => `"${t}" → ${b.use}`));
    expect(found).toEqual([]);
  });
});

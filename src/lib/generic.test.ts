// Step 4.1's "done when": NEXUS knows no connected system's jobs (and, since 6.1, no model or AI outcome). Northstar's job, result, error and
// flag codes may appear only in its feed, and so in the frozen fixture and the tests, never in the
// app's own code. NEXUS's own ids ("sent" as a question or a fact) are fine; Northstar's result
// codes are caught where code compares a result or detail to them.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

const CODES = [
  /\bnotify_team\b/, /\bconfirm_visitor\b/, /\bpurge_pii\b/, /\bsimulate_outage\b/, /\bpii_deleted\b/,
  /\bsimulated_outage\b/, /\bskipped_cap\b/, /\balready_purged\b/, /\binternal_error\b/, /'purged'/,
  /(?:detail|result)\s*===\s*'(?:sent|mock)'/, /'mock'/,
  // The AI feed's outcome codes and model names (phase 6.1): they come from its description, never from app code.
  /\bprovider_error\b/, /'timeout'/, /outcome\s*===\s*'ok'/, /\bgpt-\d/i,
];

function appFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const path = join(dir, d.name);
    if (d.isDirectory()) return d.name === 'test' || d.name === 'fixtures' ? [] : appFiles(path);
    return /\.tsx?$/.test(d.name) && !/\.test\.ts$/.test(d.name) ? [path] : [];
  });
}

/** Lines of app code that name one of Northstar's codes. */
export function hits(source: string): string[] {
  return source.split('\n').flatMap((line, i) => (CODES.some((re) => re.test(line)) ? [`${i + 1}: ${line.trim()}`] : []));
}

describe('NEXUS knows no connected system by its codes', () => {
  it('finds none of them in the app code (only the feed, the fixture and the tests name them)', () => {
    const found = appFiles(SRC).flatMap((file) => hits(readFileSync(file, 'utf8')).map((h) => `${relative(SRC, file)}:${h}`));
    expect(found).toEqual([]);
  });

  it('would catch one (the scan checks itself)', () => {
    expect(hits("if (step.kind === 'purge_pii') return;\nconst x = e.detail === 'sent';\nconst ok = id === 'sent';")).toEqual([
      "1: if (step.kind === 'purge_pii') return;",
      "2: const x = e.detail === 'sent';",
    ]);
  });

  it('would catch an AI outcome or a model named in app code', () => {
    expect(hits("if (c.outcome === 'ok') n++;\nconst m = 'gpt-4o-mini';\nconst e = 'provider_error';\nconst ok = tone === 'ok';")).toEqual([
      "1: if (c.outcome === 'ok') n++;",
      "2: const m = 'gpt-4o-mini';",
      "3: const e = 'provider_error';",
    ]);
  });
});

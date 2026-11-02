import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUIDED_META, GUIDED_RUN } from './guided';

const raw = readFileSync(new URL('../fixtures/guided-run.json', import.meta.url), 'utf8');

describe('guided fixture', () => {
  it('is the labeled recording of the outage run', () => {
    expect(GUIDED_META.label).toBe('Recorded run, anonymized');
    expect(GUIDED_RUN.run_id).toBe('r_6d15828d95f5');
    expect(GUIDED_RUN.flags).toEqual(['simulate_outage']);
  });

  it('holds no lead reference, email address or personal-data keys', () => {
    expect(raw).not.toMatch(/NS-/);
    expect(raw).not.toMatch(/@/);
    expect(raw).not.toMatch(/"(name|email|message|reference|ip)"\s*:/i);
  });
});

import { describe, expect, it } from 'vitest';
import { parseInstant, secondsBetween } from './time';

describe('parseInstant', () => {
  it('keeps the microseconds Northstar sends', () => {
    const base = Date.parse('2026-10-22T03:07:46Z');
    expect(parseInstant('2026-10-22T03:07:46.373512+00:00')).toBeCloseTo(base + 373.512, 6);
  });

  it('reads Z, offsets, milliseconds and whole seconds', () => {
    const base = Date.parse('2026-10-22T03:07:46Z');
    expect(parseInstant('2026-10-22T03:07:46Z')).toBe(base);
    expect(parseInstant('2026-10-22T03:07:46.5Z')).toBe(base + 500);
    expect(parseInstant('2026-10-22T05:07:46.000+02:00')).toBe(base);
  });

  it('rejects anything without an explicit timezone, and garbage', () => {
    expect(() => parseInstant('2026-10-22T03:07:46')).toThrow();
    expect(() => parseInstant('yesterday')).toThrow();
    expect(() => parseInstant('2026-13-40T99:00:00Z')).toThrow();
  });
});

describe('secondsBetween', () => {
  // Hand-checked against the recorded run: failed 03:07:47.131988 → next start 03:07:57.321989.
  it('measures the recorded first retry wait as 10.190001 s', () => {
    expect(secondsBetween('2026-10-22T03:07:47.131988+00:00', '2026-10-22T03:07:57.321989+00:00'))
      .toBeCloseTo(10.190001, 5);
  });

  it('is negative when the second time is earlier', () => {
    expect(secondsBetween('2026-10-22T03:00:10Z', '2026-10-22T03:00:00Z')).toBe(-10);
  });
});

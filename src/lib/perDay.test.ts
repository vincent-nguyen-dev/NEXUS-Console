import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { MAX_BARS, perDay } from './perDay';

const NOW = Date.parse('2026-10-30T06:14:35.000Z');
const run = (i: number, created: string) => makeRun({ id: `r_${i.toString(16).padStart(12, '0')}`, created });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('perDay: the Runs sparkline', () => {
  it('30 d: 31 UTC days (the window starts part-way into one), and the bars add up to the runs', () => {
    const runs = [
      run(1, '2026-09-30T07:00:00.000Z'), run(2, '2026-10-29T16:07:00.000Z'),
      run(3, '2026-10-29T09:18:00.000Z'), run(4, '2026-10-30T01:00:00.000Z'),
    ];
    const bars = perDay(runs, '30d', NOW);
    expect(bars?.counts).toHaveLength(31);
    expect(bars?.counts[0]).toBe(1);
    expect(bars?.counts.slice(-2)).toEqual([2, 1]);
    expect(sum(bars?.counts ?? [])).toBe(4);
    expect(bars).toMatchObject({ unit: 'day', n: 4 });
  });

  it('24 h: hourly bars, empty hours are zero', () => {
    const bars = perDay([run(1, '2026-10-29T09:18:00.000Z'), run(2, '2026-10-30T06:00:00.000Z')], '24h', NOW);
    expect(bars?.counts).toHaveLength(25);
    expect(bars?.unit).toBe('hour');
    expect(bars?.counts.filter((c) => c > 0)).toEqual([1, 1]);
  });

  it('fewer than 2 runs: no sparkline', () => {
    expect(perDay([], '7d', NOW)).toBeNull();
    expect(perDay([run(1, '2026-10-29T09:18:00.000Z')], '7d', NOW)).toBeNull();
  });

  it('All over a long span widens the buckets so it never draws more than 60 bars', () => {
    const bars = perDay([run(1, '2026-01-01T00:00:00.000Z'), run(2, '2026-10-29T00:00:00.000Z')], 'all', NOW);
    expect(bars?.counts.length).toBeLessThanOrEqual(MAX_BARS);
    expect(bars?.unit).toBe('6 days');
    expect(sum(bars?.counts ?? [])).toBe(2);
  });
});

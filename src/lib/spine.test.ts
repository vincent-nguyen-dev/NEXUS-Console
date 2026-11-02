import { describe, expect, it } from 'vitest';
import { BEND_HALF, END_RISE, SPINE_LEAD, drawnY, lengthAt, spinePath, spineProgress, spineSpan, stationsReached } from './spine';

const G = { x: 8, bend: 30, stations: [200, 900, 1500], end: { x: 520, y: 2100 } };

describe('spineSpan', () => {
  it('starts above the first station and finishes at the button', () => {
    expect(spineSpan(G)).toEqual({ first: 200 - SPINE_LEAD, last: 2100 });
  });
  it('finishes at the last station without a button, and is null without stations', () => {
    expect(spineSpan({ ...G, end: null })).toEqual({ first: 140, last: 1500 });
    expect(spineSpan({ ...G, stations: [] })).toBeNull();
  });
});

describe('spinePath', () => {
  it('bends out to every station and ends at the button', () => {
    const d = spinePath(G);
    expect(d.startsWith('M 8 140')).toBe(true);
    for (const y of G.stations) {
      expect(d).toContain(`L 8 ${y - BEND_HALF}`);
      expect(d).toContain(`30 ${y} C`);
    }
    expect(d).toContain(`L 8 ${2100 - END_RISE}`);
    expect(d.endsWith('520 2100')).toBe(true);
  });
  it('never starts the final curve above the last bend', () => {
    const d = spinePath({ ...G, end: { x: 520, y: 1560 } });
    expect(d).toContain(`L 8 ${1500 + BEND_HALF} C`);
  });
  it('is empty without stations', () => {
    expect(spinePath({ ...G, stations: [] })).toBe('');
  });
});

describe('spineProgress', () => {
  const span = { first: 100, last: 1100 };
  it('follows the reach between the first and last y', () => {
    expect(spineProgress(0, span, 0)).toBe(0);
    expect(spineProgress(600, span, 0)).toBe(0.5);
    expect(spineProgress(5000, span, 0)).toBe(1);
  });
  it('never goes back', () => {
    expect(spineProgress(200, span, 0.5)).toBe(0.5);
    expect(spineProgress(0, span, 1)).toBe(1);
  });
  it('finishes at the end of the page', () => {
    expect(spineProgress(300, span, 0.2, true)).toBe(1);
  });
  it('is finished for a span of no height', () => {
    expect(spineProgress(0, { first: 50, last: 50 }, 0)).toBe(1);
  });
});

describe('stationsReached', () => {
  it('counts the stations at or above the tip', () => {
    const span = spineSpan(G);
    if (span === null) throw new Error('no span');
    expect(stationsReached(G.stations, drawnY(span, 0))).toBe(0);
    expect(stationsReached(G.stations, 200)).toBe(1);
    expect(stationsReached(G.stations, 1490)).toBe(2);
    expect(stationsReached(G.stations, drawnY(span, 1))).toBe(3);
  });
});

describe('lengthAt', () => {
  // A path of 1000 px: 600 px down to y 600, then the sideways curve (400 px) to the button at y 720.
  const samples = [{ y: 0, len: 0 }, { y: 300, len: 300 }, { y: 600, len: 600 }, { y: 720, len: 1000 }];
  it('interpolates the length for a y', () => {
    expect(lengthAt(samples, 1000, 150)).toBe(0.15);
    expect(lengthAt(samples, 1000, 600)).toBe(0.6);
    expect(lengthAt(samples, 1000, 660)).toBeCloseTo(0.8, 6);
  });
  it('clamps outside the samples, and draws everything without them', () => {
    expect(lengthAt(samples, 1000, -10)).toBe(0);
    expect(lengthAt(samples, 1000, 9999)).toBe(1);
    expect(lengthAt([], 1000, 10)).toBe(1);
  });
});

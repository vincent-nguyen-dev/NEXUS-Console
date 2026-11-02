import { describe, expect, it } from 'vitest';
import { BAND_BOOST_CAP, fadeScroll, springStep, velocityToSpeed, wrapOffset } from './band';

describe('velocityToSpeed', () => {
  it('drifts forward at the base speed when nothing scrolls', () => {
    expect(velocityToSpeed(0)).toBe(1);
  });

  it('boosts with scroll speed, capped at 6×', () => {
    expect(velocityToSpeed(400)).toBe(2);
    expect(velocityToSpeed(1200)).toBe(4);
    expect(velocityToSpeed(100_000)).toBe(BAND_BOOST_CAP);
  });

  it('reverses when scrolling up, past a small dead zone', () => {
    expect(velocityToSpeed(-30)).toBeCloseTo(1.075, 3);
    expect(velocityToSpeed(-400)).toBe(-2);
  });

  it('slows to 10 % while the replay plays, boost included', () => {
    expect(velocityToSpeed(0, { playing: true })).toBeCloseTo(0.1, 6);
    expect(velocityToSpeed(400, { playing: true })).toBeCloseTo(0.2, 6);
  });

  it('treats a bad reading as no scroll', () => {
    expect(velocityToSpeed(Number.NaN)).toBe(1);
  });
});

describe('springStep and fadeScroll', () => {
  it('moves toward the target without overshooting, and holds on a zero step', () => {
    expect(springStep(1, 4, 0.1)).toBeCloseTo(2.8, 6);
    expect(springStep(1, 4, 1)).toBe(4);
    expect(springStep(1, 4, 0)).toBe(1);
  });

  it('fades the scroll speed to 2 % in a second', () => {
    expect(fadeScroll(1000, 1)).toBeCloseTo(20, 6);
    expect(fadeScroll(1000, 0)).toBe(1000);
  });
});

describe('wrapOffset', () => {
  it('keeps the offset within one copy, moving left or right', () => {
    expect(wrapOffset(-250, 1000)).toBe(-250);
    expect(wrapOffset(-1250, 1000)).toBe(-250);
    expect(wrapOffset(250, 1000)).toBe(-750);
    expect(wrapOffset(0, 1000)).toBe(0);
    expect(wrapOffset(-1000, 1000)).toBe(0);
  });

  it('stays still before the copy has been measured', () => {
    expect(wrapOffset(-250, 0)).toBe(0);
  });
});

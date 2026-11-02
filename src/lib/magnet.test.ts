import { describe, expect, it } from 'vitest';
import { edgeDistance, magnetOffset, MAGNET_MAX_PX, MAGNET_REACH_PX } from './magnet';

// A 160 × 52 button with its centre at (180, 126).
const BOX = { left: 100, top: 100, width: 160, height: 52 };
const len = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);

describe('edgeDistance', () => {
  it('is 0 inside the box and measures to the nearest edge or corner outside it', () => {
    expect(edgeDistance({ x: 150, y: 120 }, BOX)).toBe(0);
    expect(edgeDistance({ x: 300, y: 126 }, BOX)).toBe(40);
    expect(edgeDistance({ x: 180, y: 50 }, BOX)).toBe(50);
    expect(edgeDistance({ x: 290, y: 192 }, BOX)).toBe(50); // corner: 30 across, 40 down
  });
});

describe('magnetOffset', () => {
  it('is 0 at the centre and beyond 120 px from the edge', () => {
    expect(magnetOffset({ x: 180, y: 126 }, BOX)).toEqual({ x: 0, y: 0 });
    expect(magnetOffset({ x: 260 + MAGNET_REACH_PX + 1, y: 126 }, BOX)).toEqual({ x: 0, y: 0 });
  });

  it('leans toward the pointer', () => {
    const right = magnetOffset({ x: 300, y: 126 }, BOX);
    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBe(0);
    const upLeft = magnetOffset({ x: 60, y: 60 }, BOX);
    expect(upLeft.x).toBeLessThan(0);
    expect(upLeft.y).toBeLessThan(0);
  });

  it('grows with the distance from the centre and never passes 6 px', () => {
    const near = len(magnetOffset({ x: 200, y: 126 }, BOX));
    const far = len(magnetOffset({ x: 360, y: 126 }, BOX));
    expect(near).toBeLessThan(far);
    for (let x = 0; x <= 500; x += 7) {
      for (let y = 0; y <= 300; y += 7) expect(len(magnetOffset({ x, y }, BOX))).toBeLessThanOrEqual(MAGNET_MAX_PX + 0.1);
    }
    expect(len(magnetOffset({ x: 360, y: 126 }, BOX))).toBeCloseTo(MAGNET_MAX_PX, 1);
  });

  it('takes another reach and cap', () => {
    expect(magnetOffset({ x: 300, y: 126 }, BOX, 40, 4)).toEqual({ x: 4, y: 0 });
    expect(magnetOffset({ x: 301, y: 126 }, BOX, 40, 4)).toEqual({ x: 0, y: 0 });
  });
});

import { describe, expect, it } from 'vitest';
import { makeRun, must, type RunSpec } from '../test/runs';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import { mapModel } from './map';
import { minWideWidth, verticalLane, wideLayout } from './mapGeometry';

let n = 0;
const run = (spec: Omit<RunSpec, 'id' | 'created'>) =>
  makeRun({ id: `r_${(n++).toString(16).padStart(12, '0')}`, created: '2026-10-24T06:00:00.000Z', ...spec });
const ok = () => run({});
const outage = () => run({ notify: { attempts: ['fail', 'fail', 'ok'] }, outage: true });
const live = mapModel([ok(), ok(), outage(), outage()], WF);
const none = new Set<string>();

describe('minWideWidth', () => {
  it('three tries need 906 px: 330 to try 1 + 2 × 150 between tries + 110 to rejoin + 150 for the end label + 16', () => {
    expect(minWideWidth(live)).toBe(330 + 2 * 150 + 110 + 150 + 16);
    expect(minWideWidth(live)).toBe(906);
  });

  it('a fourth try needs 150 more (1056), so it goes narrow at 1280 (915 available)', () => {
    expect(minWideWidth(mapModel([run({ notify: { attempts: ['fail', 'fail', 'fail', 'ok'] } })], WF))).toBe(1056);
  });

  it('room for three tries is kept even with none, so the map keeps its shape', () => {
    expect(minWideWidth(mapModel([], WF))).toBe(906);
  });
});

describe('wideLayout', () => {
  it('fills the width: at 1088 the tries are (1088 − 166 − 110 − 330) ÷ 2 = 241 apart', () => {
    const g = wideLayout(live, 1088, none);
    expect(g.width).toBe(1088);
    expect(g.gap).toBe(241);
    expect(g.lanes[0]?.stations.map((s) => s.x)).toEqual([330, 571, 812]);
    expect(g.lanes[0]?.endX).toBe(922);
    expect(g.twoLineWaits).toBe(false);
  });

  it('at the 1280 minimum (915 px) the tries are 154.5 apart and the wait labels take two lines', () => {
    const g = wideLayout(live, 915, none);
    expect(g.gap).toBe(154.5);
    expect(g.twoLineWaits).toBe(true);
  });

  it('caps the space between tries at 260 on a wide screen', () => {
    expect(wideLayout(live, 2200, none).gap).toBe(260);
  });

  it('never draws narrower than its minimum', () => {
    expect(wideLayout(live, 700, none).width).toBe(906);
  });

  it('lanes: tries 2+ on the siding 80 px above the line, the waits labelled between them', () => {
    const team = wideLayout(live, 1088, none).lanes[0];
    expect(team?.lineY).toBe(150);
    expect(team?.sidingY).toBe(70);
    expect(team?.stations.map((s) => [s.attempt, s.y])).toEqual([[1, 150], [2, 70], [3, 70]]);
    expect(team?.waits.map((w) => [w.attempt, w.x])).toEqual([[1, 450.5], [2, 691.5]]);
    expect(team?.rejoin).toEqual({ from: 812, to: 922 });
  });

  it('keeps a lane\'s siding room when told to, so filtering out its retries moves nothing', () => {
    const plain = mapModel([ok(), ok()], WF);
    const reserved = wideLayout(plain, 1088, new Set(['notify_team']));
    const full = wideLayout(live, 1088, none);
    expect(reserved.lanes.map((l) => l.lineY)).toEqual(full.lanes.map((l) => l.lineY));
    expect(reserved.height).toBe(full.height);
    expect(reserved.lanes[0]?.rejoin).toBeNull();
  });

  it('stacks the lanes: 150, then +52 below, 30 between, 34 above each plain lane', () => {
    const g = wideLayout(live, 1088, none);
    expect(g.lanes.map((l) => l.lineY)).toEqual([150, 266, 382]);
    expect(g.height).toBe(382 + 52 + 20);
    expect(g.leadY).toBe((150 + 382) / 2);
  });
});

describe('verticalLane (phones and narrow panels, board C5)', () => {
  const lanes = mapModel([ok(), outage()], WF).lanes;
  const team = lanes[0];
  const visitor = lanes[1];
  const purge = lanes[2];

  it('team notification: try 1 on the line, tries 2 and 3 on the siding beside it, the end below', () => {
    const v = verticalLane(must(team), none);
    expect(v.stations).toEqual([{ attempt: 1, x: 20, y: 22 }, { attempt: 2, x: 52, y: 114 }, { attempt: 3, x: 52, y: 222 }]);
    expect(v.end).toEqual({ x: 20, y: 340 }); // 222 + 118
    expect(v.rejoin).toEqual({ fromY: 222, toY: 308 }); // 222 + 86
    expect(v.waits).toEqual([{ attempt: 1, y: 82 }, { attempt: 2, y: 168 }]); // (22 + 114) / 2 + 14, (114 + 222) / 2
    expect(v.height).toBe(370);
  });

  it('a lane without retries is short: try 1, then the end 64 px below', () => {
    const v = verticalLane(must(visitor), none);
    expect(v.stations).toEqual([{ attempt: 1, x: 20, y: 22 }]);
    expect(v.end).toEqual({ x: 20, y: 86 });
    expect(v.rejoin).toBeNull();
  });

  it('keeps the siding\'s room when told to, so filtering out the retries moves nothing', () => {
    const plain = mapModel([ok()], WF).lanes[0];
    expect(verticalLane(must(plain), new Set(['notify_team'])).end).toEqual({ x: 20, y: 340 });
  });

  it('a job that has not run yet is its end alone', () => {
    expect(verticalLane(must(purge), none).end).toEqual({ x: 20, y: 22 });
  });
});

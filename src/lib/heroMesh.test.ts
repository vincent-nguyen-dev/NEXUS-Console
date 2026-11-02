import { describe, expect, it } from 'vitest';
import { SHOP_WF, shopRun } from '../test/otherWorkflow';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import { GUIDED_RUN } from './guided';
import { bendToward, neighbourEdges, pathwayMesh, randomWalk, seeded, workflowMesh } from './heroMesh';

describe('workflowMesh on the recording', () => {
  // The recording: 1 enquiry, 3 jobs, team notification 3 tries, visitor confirmation 1, the deletion none yet.
  const mesh = workflowMesh(GUIDED_RUN, WF, 70);

  it('has the workflow\'s 8 nodes, then the decorative ones', () => {
    expect(mesh.nodes.filter((n) => n.workflow)).toHaveLength(1 + 3 + 3 + 1);
    expect(mesh.nodes).toHaveLength(8 + 70);
    expect(mesh.nodes.every((n) => n.x >= 0 && n.x <= 1 && n.y >= -0.1 && n.y <= 1.1)).toBe(true);
  });

  it('traces the recorded path: the enquiry, the team notification, then tries 1 → 2 → 3', () => {
    expect(mesh.path).toEqual([[0, 1], [1, 2], [2, 3], [3, 4]]);
    for (const [a, b] of mesh.path) expect(mesh.edges).toContainEqual([a, b]);
  });

  it('never repeats an edge or links a node to itself', () => {
    const keys = mesh.edges.map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join('-'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(mesh.edges.every(([a, b]) => a !== b)).toBe(true);
  });

  it('looks the same on every visit', () => {
    expect(workflowMesh(GUIDED_RUN, WF, 70)).toEqual(mesh);
  });
});

describe('workflowMesh on another workflow', () => {
  it('reads the shop: 1 order, 2 jobs, the card payment\'s 3 tries on the path', () => {
    const mesh = workflowMesh(shopRun('r_000000000002', '2026-10-24T02:00:00.000Z', 2, true), SHOP_WF, 0);
    expect(mesh.nodes.filter((n) => n.workflow)).toHaveLength(1 + 2 + 3 + 1);
    expect(mesh.path).toHaveLength(1 + 3);
  });
});

describe('pathways, walks and the pointer bend', () => {
  it('a pathway mesh has only decorative nodes, linked to their neighbours', () => {
    const p = pathwayMesh(40, 7);
    expect(p.nodes).toHaveLength(40);
    expect(p.nodes.some((n) => n.workflow)).toBe(false);
    expect(p.edges.length).toBeGreaterThanOrEqual(40);
    expect(p.path).toEqual([]);
  });

  it('a walk follows edges and never turns straight back', () => {
    const p = pathwayMesh(30, 3);
    const walk = randomWalk(p, 0, 4, seeded(9));
    walk.forEach(([a, b], i) => {
      expect(p.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))).toBe(true);
      if (i > 0) expect(b).not.toBe(walk[i - 1]?.[0]);
    });
  });

  it('nearest neighbours: each of 3 points on a line links to its closest', () => {
    expect(neighbourEdges([{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 1, y: 0 }], 1)).toEqual([[0, 1], [2, 1]]);
  });

  it('bends toward the pointer, full strength at it, none at the radius', () => {
    expect(bendToward({ x: 0, y: 0 }, null, 260, 40)).toEqual({ dx: 0, dy: 0 });
    expect(bendToward({ x: 0, y: 0 }, { x: 260, y: 0 }, 260, 40)).toEqual({ dx: 0, dy: 0 });
    const half = bendToward({ x: 0, y: 0 }, { x: 130, y: 0 }, 260, 40);
    expect(half.dx).toBeCloseTo(20, 6);
    expect(half.dy).toBe(0);
  });
});

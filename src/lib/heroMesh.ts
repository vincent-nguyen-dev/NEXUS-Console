// The landing page's workflow mesh (step 5.3c): the recorded run's real workflow as a faint network behind the
// hero (the enquiry, its jobs, their tries), among neighbour nodes that only decorate. The "neural pathways"
// behind the other sections use the same mesh with no workflow, fainter. Pure geometry here (deterministic for a
// seed); MeshCanvas draws it. Positions are fractions of the canvas (0..1).
import { traceOf } from './runTrace';
import type { Run, Workflow } from './types';
import { primaryStep } from './workflow';

export interface MeshNode {
  x: number;
  y: number;
  /** Part of the recorded workflow (drawn brighter), or a decorative neighbour. */
  workflow: boolean;
  /** Drift phase, so the nodes don't move in step. */
  phase: number;
}

export interface Mesh {
  nodes: MeshNode[];
  /** Pairs of node indexes. */
  edges: [number, number][];
  /** The path the recorded run took (enquiry → primary job → its tries), as edges in order. */
  path: [number, number][];
}

/** A small deterministic generator (Park–Miller), so a mesh looks the same on every visit. */
export function seeded(seed: number): () => number {
  let s = Math.max(1, Math.floor(seed) % 2147483647);
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Each node links to its `k` nearest neighbours; no edge twice, none to itself. */
export function neighbourEdges(nodes: Pick<MeshNode, 'x' | 'y'>[], k: number, aspect = 1): [number, number][] {
  const edges: [number, number][] = [];
  const has = (a: number, b: number) => edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
  nodes.forEach((n, i) => {
    const near = nodes
      .map((m, j) => ({ j, d: ((m.x - n.x) * aspect) ** 2 + (m.y - n.y) ** 2 }))
      .filter((c) => c.j !== i)
      .sort((a, b) => a.d - b.d || a.j - b.j)
      .slice(0, k);
    for (const { j } of near) if (!has(i, j)) edges.push([i, j]);
  });
  return edges;
}

/**
 * The hero's mesh: the run's workflow where it can be seen around the replay card (which covers the right side of
 * the hero): the enquiry in the gutter, the primary job and its tries along the strip above the card (where the
 * replay's pulses travel), the other jobs down the gutter and along the bottom strip. Plus `extra` neighbours.
 */
export function workflowMesh(run: Run, wf: Workflow, extra: number, seed = 22, aspect = 2): Mesh {
  const rnd = seeded(seed);
  const trace = traceOf(run, wf);
  const primary = primaryStep(wf);
  const nodes: MeshNode[] = [{ x: 0.37, y: 0.1, workflow: true, phase: rnd() * 6.28 }];
  const edges: [number, number][] = [];
  const path: [number, number][] = [];
  const others = trace.lanes.filter((l) => l.kind !== primary);
  for (const lane of trace.lanes) {
    const top = lane.kind === primary;
    const i = others.indexOf(lane);
    // Top strip for the primary job; the others down the gutter (x 0.38), their tries along the bottom strip.
    const at = top ? { x: 0.46, y: 0.03 } : { x: 0.385, y: 0.45 + (0.45 * (i + 1)) / Math.max(1, others.length) };
    const job = nodes.push({ ...at, workflow: true, phase: rnd() * 6.28 }) - 1;
    edges.push([0, job]);
    if (top) path.push([0, job]);
    let prev = job;
    lane.tries.forEach((_, ti) => {
      const pos = top
        ? { x: 0.58 + 0.13 * ti, y: 0.014 + rnd() * 0.02 }
        : { x: 0.46 + 0.12 * ti, y: Math.min(0.985, at.y + 0.03 + rnd() * 0.02) };
      const node = nodes.push({ ...pos, workflow: true, phase: rnd() * 6.28 }) - 1;
      edges.push([prev, node]);
      if (top) path.push([prev, node]);
      prev = node;
    });
  }
  for (let i = 0; i < extra; i++) nodes.push({ x: rnd(), y: rnd(), workflow: false, phase: rnd() * 6.28 });
  for (const e of neighbourEdges(nodes, 2, aspect)) {
    if (!edges.some(([p, q]) => (p === e[0] && q === e[1]) || (p === e[1] && q === e[0]))) edges.push(e);
  }
  return { nodes, edges, path };
}

/** A mesh with no workflow, for the pathways behind other sections. */
export function pathwayMesh(count: number, seed: number, aspect = 3): Mesh {
  const rnd = seeded(seed);
  const nodes: MeshNode[] = Array.from({ length: count }, () => ({ x: rnd(), y: rnd(), workflow: false, phase: rnd() * 6.28 }));
  return { nodes, edges: neighbourEdges(nodes, 2, aspect), path: [] };
}

/** A walk of `length` edges from a node, never back along the edge it came from: an ambient pathway pulse. */
export function randomWalk(mesh: Mesh, start: number, length: number, rnd: () => number): [number, number][] {
  const out: [number, number][] = [];
  let at = start;
  let from = -1;
  for (let i = 0; i < length; i++) {
    const next = mesh.edges.flatMap(([a, b]) => (a === at && b !== from ? [b] : b === at && a !== from ? [a] : []));
    if (next.length === 0) break;
    const to = next[Math.floor(rnd() * next.length)] ?? next[0] ?? at;
    out.push([at, to]);
    from = at;
    at = to;
  }
  return out;
}

/**
 * How far an edge's midpoint bends toward the pointer (px): `strength` at the pointer, fading to 0 at `radius`.
 * Returns the offset to add to the midpoint.
 */
export function bendToward(mid: { x: number; y: number }, pointer: { x: number; y: number } | null, radius: number, strength: number): { dx: number; dy: number } {
  if (pointer === null || radius <= 0 || strength <= 0) return { dx: 0, dy: 0 };
  const dx = pointer.x - mid.x;
  const dy = pointer.y - mid.y;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d >= radius) return { dx: 0, dy: 0 };
  const k = (1 - d / radius) * strength;
  return { dx: (dx / d) * k, dy: (dy / d) * k };
}

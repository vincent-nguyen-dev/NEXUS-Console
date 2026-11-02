// Which part of the map a number counts: hovering or focusing a KPI tile lights those nodes, the same spotlight
// a station gets. Read from the workflow's roles, so no job is named here. Only nodes the map draws are returned.
import type { Kpi } from './kpis';
import type { MapModel, NodeId } from './map';
import { jobFacts } from './metrics';
import type { Run } from './types';
import { measuredSteps, simulatedSteps } from './workflow';

export function kpiFocus(id: Kpi['id'], runs: Run[], model: MapModel): ReadonlySet<NodeId> {
  const wf = model.workflow;
  const ids = new Set<NodeId>();
  if (id === 'runs') ids.add('lead');
  if (id === 'first_try') for (const k of measuredSteps(wf)) ids.add(`try:${k}:1`);
  if (id === 'simulated') for (const k of simulatedSteps(wf)) ids.add(`try:${k}:1`);
  // The try each recovered job succeeded on: try 3 when every recovery took three tries, never a typical try.
  if (id === 'recovered') {
    for (const k of measuredSteps(wf)) {
      for (const run of runs) {
        const f = jobFacts(run, k);
        if (f.status === 'succeeded' && f.failures > 0 && f.succeededAttempt !== null) ids.add(`try:${k}:${f.succeededAttempt}`);
      }
    }
  }
  const drawn = new Set<NodeId>(['lead', ...model.lanes.flatMap((l) => l.stations.map((s) => s.id))]);
  return new Set([...ids].filter((n) => drawn.has(n)));
}

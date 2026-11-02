import { describe, expect, it } from 'vitest';
import { SHOP_WF, shopRun } from '../test/otherWorkflow';
import { makeRun } from '../test/runs';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import { kpiFocus } from './kpiFocus';
import { mapModel } from './map';
import type { Run, Workflow } from './types';

const at = (h: number) => `2026-10-24T${String(h).padStart(2, '0')}:00:00.000Z`;
const id = (i: number) => `r_${i.toString(16).padStart(12, '0')}`;
const ok = (i: number) => makeRun({ id: id(i), created: at(i) });
const outage = (i: number, attempts: ('fail' | 'ok')[]) => makeRun({ id: id(i), created: at(i), notify: { attempts }, outage: true });
const focus = (kpi: Parameters<typeof kpiFocus>[0], runs: Run[], wf: Workflow = WF) =>
  [...kpiFocus(kpi, runs, mapModel(runs, wf))].sort();

describe('kpiFocus: the map nodes a number counts', () => {
  const live = [ok(1), ok(2), outage(3, ['fail', 'fail', 'ok']), outage(4, ['fail', 'fail', 'ok'])];

  it('runs → the enquiry; first try → try 1 of the real job; simulated → try 1 of the simulated job', () => {
    expect(focus('runs', live)).toEqual(['lead']);
    expect(focus('first_try', live)).toEqual(['try:notify_team:1']);
    expect(focus('simulated', live)).toEqual(['try:confirm_visitor:1']);
    expect(focus('completion_p95', live)).toEqual([]);
  });

  it('recovered → the try the recoveries succeeded on: try 3 when they all took three tries, never try 2', () => {
    expect(focus('recovered', live)).toEqual(['try:notify_team:3']);
  });

  it('recovered in a mixed window → every try a recovery succeeded on', () => {
    expect(focus('recovered', [...live, outage(5, ['fail', 'ok'])])).toEqual(['try:notify_team:2', 'try:notify_team:3']);
  });

  it('nothing to point at → nothing, and only drawn nodes are ever named', () => {
    expect(focus('recovered', [ok(1)])).toEqual([]);
    expect(focus('first_try', [])).toEqual([]);
  });

  it('reads another workflow by its roles', () => {
    const shop = [shopRun(id(1), at(1), 0, true), shopRun(id(2), at(2), 2, false)];
    expect(focus('first_try', shop, SHOP_WF)).toEqual(['try:charge_card:1']);
    expect(focus('recovered', shop, SHOP_WF)).toEqual(['try:charge_card:3']);
    expect(focus('simulated', shop, SHOP_WF)).toEqual([]);
  });
});

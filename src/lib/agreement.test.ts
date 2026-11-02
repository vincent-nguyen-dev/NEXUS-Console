// Home's numbers row and the console's KPI tiles count the same window with the same functions (checkpoint B,
// ChatGPT 3): one page fed to both must give the same run count and the same recoveries. Home counts recoveries over
// every immediate job and the console's tile over the team notification, so they agree while only that job fails,
// which is what Northstar's outage switch does.
import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import { runsInWindow } from './filters';
import { buildKpis } from './kpis';
import { landingFacts, landingNumbers } from './landing';
import { parseInstant } from './time';
import type { RunsPage } from './types';

const NOW = '2026-10-31T06:07:00.000000+00:00';
const id = (i: number) => `r_${i.toString(16).padStart(12, '0')}`;
// The shape of the feed read for checkpoint B (31 Oct 06:07 UTC): 19 runs, 9 with the outage switch, all sent.
const outage = (i: number) => makeRun({ id: id(i), created: '2026-10-20T09:18:00Z', outage: true, notify: { attempts: ['fail', 'fail', 'ok'] } });
const clean = (i: number) => makeRun({ id: id(i), created: '2026-10-21T09:18:00Z' });
// One more, older than the 30-day window: neither page may count it.
const old = makeRun({ id: id(99), created: '2026-09-20T09:18:00Z' });
const PAGE: RunsPage = { now: NOW, truncated: false, workflow: WF, runs: [...Array.from({ length: 9 }, (_, i) => outage(i)), ...Array.from({ length: 10 }, (_, i) => clean(i + 10)), old] };

describe('Home and the console agree', () => {
  const facts = landingFacts(PAGE);
  const home = landingNumbers(facts, 'enquiry');
  const kpis = buildKpis(runsInWindow(PAGE.runs, '30d', parseInstant(PAGE.now)), false,
    { win: '30d', source: 'live', fileName: null, asOf: PAGE.now, capturedAt: PAGE.now }, WF);
  const tile = (k: string) => kpis.find((x) => x.id === k);

  it('on the run count', () => {
    expect(home.find((t) => t.label === 'Runs')?.value).toBe('19');
    expect(tile('runs')?.value).toBe('19');
  });

  it('on the recoveries', () => {
    expect(facts.recovered).toEqual({ numerator: 9, denominator: 9 });
    expect(home.find((t) => t.label === 'Failed tries')?.note).toContain('9 of 9 jobs recovered');
    expect(tile('recovered')?.note).toBe('9 of 9 that failed');
  });
});

// Step 4.1's proof: a second, made-up system (a shop: card payment now, receipt an hour later) goes
// through the same code as Northstar and reads sensibly. No "team", no "email", the right lanes.
import { describe, expect, it } from 'vitest';
import { SHOP_WF as WF, shopRun } from '../test/otherWorkflow';
import { must } from '../test/runs';
import { describeEvent } from './format';
import { headline } from './headline';
import { buildKpis } from './kpis';
import { mapModel, selectionNote } from './map';
import { wideLayout } from './mapGeometry';
import { completionSeconds } from './metrics';
import { runSummary } from './runDetail';
import { signalRows } from './signalsFeed';

const created = '2026-10-20T10:00:00.000Z';
// Four orders: two charged at once, one after a 5 s wait (gateway down once), one after 5 s and 60 s.
const runs = [
  shopRun('r_00000000000a', created, 0, true),
  shopRun('r_00000000000b', created, 0, false),
  shopRun('r_00000000000c', created, 1, true),
  shopRun('r_00000000000d', created, 2, false),
];
// What starts a run comes from the feed too ("order"), so not even Northstar's "enquiry" shows.
const NORTHSTAR_WORDS = /team|email|visitor|enquir|personal data/i;
const scope = { win: '30d', source: 'live', fileName: null, asOf: '2026-10-28T00:00:00.000Z', capturedAt: created } as const;

describe('a second workflow through the same code', () => {
  it('draws its own two lanes, with its tries and waits', () => {
    const m = mapModel(runs, WF);
    expect(m.lanes.map((l) => [l.kind, l.title, l.scheduled])).toEqual([['charge_card', 'Card payment', false], ['send_receipt', 'Receipt', true]]);
    expect(m.lanes[0]?.stations.map((s) => s.attempt)).toEqual([1, 2, 3]);
    expect(m.lanes[0]?.end.text).toBe('4 payments sent');
    expect(m.lanes[1]?.subtitle).toBe('2 scheduled · 2 done');
    expect(m.lanes[0]?.waits.map((w) => w.planned)).toEqual(['planned 5 s', 'planned 1 min']);
    expect(wideLayout(m, 1088, new Set()).lanes).toHaveLength(2);
    expect(selectionNote(m, { step: 'send_receipt', attempt: null }, null).body).toBe('Mails the receipt an hour after the order. 2 scheduled · 2 done.');
  });

  it('measures the payment and leaves the receipt out of completion time', () => {
    const k = Object.fromEntries(buildKpis(runs, false, scope, WF).map((x) => [x.id, x]));
    expect(Object.keys(k)).toEqual(['runs', 'first_try', 'recovered', 'completion_p95']); // no simulated job, no simulated tile
    expect(k.first_try?.label).toBe('Card payment · first try');
    expect(k.first_try?.how.working).toBe('4 finished card payments so far; a rate needs 5.');
    expect(k.completion_p95?.how.notes[0]).toBe("Receipt isn't counted: it runs 1 hour later.");
    // 0.2 s pickup + 0.3 s try + (5 s wait + 0.1 s) + 0.3 s = 5.9 s for the order that failed once.
    expect(completionSeconds(must(runs[2]), WF)).toBeCloseTo(5.9, 6);
  });

  it('writes its own words, never Northstar\'s', () => {
    const rows = signalRows(runs, WF);
    const texts = [
      ...rows.map((r) => r.text),
      headline(runs, { win: '30d', source: 'live', partial: false, live: false }, WF).window,
      ...runs.flatMap((r) => r.events.map((e) => describeEvent(e, r, WF))),
    ];
    expect(texts.filter((t) => NORTHSTAR_WORDS.test(t))).toEqual([]);
    expect(rows.map((r) => r.text)).toContain('Card payment recovered on try 3 (payment taken)');
    expect(rows.map((r) => r.text)).toContain('Card payment failed on try 1 (payment gateway down). Retry planned in 5 s');
    expect(rows.map((r) => r.text)).toContain('Receipt succeeded on try 1 (receipt mailed)');
    expect(rows.map((r) => r.text)).toContain('New order: two jobs queued');
  });

  it('summarizes one order in the drawer by its primary job and its flag', () => {
    const run = must(runs[3]);
    const s = runSummary(run, '2026-10-28T00:00:00.000Z', WF);
    expect(s.headline).toBe('The card payment recovered after 2 failed tries: one payment was sent, 1 min 6 s after the order came in.');
    expect(s.lines).toEqual(['Receipt was due on 20 Oct 2026 and hadn\'t run at the last update.']);
    expect(s.facts.map((f) => [f.label, f.value])).toEqual([
      ['Card payment tries', '3 of 3 allowed'], ['Payments sent', '1'], ['Order to last job', '1 min 6 s'],
      ['Test card', 'On (uses a card that fails its first try)'],
    ]);
  });
});

describe('a scheduled job in its own unit', () => {
  it('says "1 hour", not "0 days", for a receipt an hour after the order', () => {
    const run = shopRun('r_00000000000e', '2026-10-28T11:30:00.000Z', 0, false);
    expect(runSummary(run, '2026-10-28T12:00:00.000Z', WF).lines).toEqual(['Receipt is scheduled for 28 Oct 2026, 1 hour after the order.']);
  });
});

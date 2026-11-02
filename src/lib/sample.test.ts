// The downloadable sample (public/sample-feed.json): a made-up shop, so a visitor sees NEXUS isn't
// Northstar-only. It must parse, show every interesting case, fit the default window, and say nothing about
// Northstar.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRunsPage } from './api';
import { readFeedFile } from './fileFeed';
import { SAMPLE_EDITS, applyEdit } from './sampleGuide';
import { runsInWindow } from './filters';
import { buildKpis } from './kpis';
import { completionSeconds, jobFacts } from './metrics';
import { parseInstant } from './time';

const text = readFileSync(new URL('../../public/sample-feed.json', import.meta.url), 'utf8');
const page = parseRunsPage(JSON.parse(text));
const wf = page.workflow;

describe('the sample file', () => {
  it('is a made-up shop with eight orders, none of them Northstar\'s', () => {
    expect(page.runs).toHaveLength(8);
    expect(wf.trigger).toEqual({ one: 'order', many: 'orders' });
    expect(text).not.toMatch(/northstar|enquir|notify_team|confirm_visitor|purge_pii|simulate_outage|team|visitor/i);
  });

  it('fits the default 30-day window counted from its own now', () => {
    expect(runsInWindow(page.runs, '30d', parseInstant(page.now))).toHaveLength(8);
  });

  it('shows every case: first try, recovered after 1 and 2 failures, gave up, receipts mailed, skipped and still scheduled', () => {
    const pay = page.runs.map((r) => jobFacts(r, 'charge_card'));
    expect(pay.filter((f) => f.status === 'succeeded' && f.failures === 0)).toHaveLength(4);
    expect(pay.filter((f) => f.status === 'succeeded' && f.failures > 0).map((f) => f.failures).sort()).toEqual([1, 1, 2]);
    expect(pay.filter((f) => f.status === 'dead')).toHaveLength(1);
    const receipt = page.runs.map((r) => jobFacts(r, 'send_receipt'));
    expect(receipt.map((f) => f.result ?? f.status).sort()).toEqual(['mailed', 'mailed', 'mailed', 'mailed', 'mailed', 'not_paid', 'queued', 'queued']);
  });

  it('has hand-checkable numbers', () => {
    const k = Object.fromEntries(
      buildKpis(page.runs, false, { win: '30d', source: 'file', fileName: 'sample-feed.json', asOf: page.now, capturedAt: page.now }, wf)
        .map((x) => [x.id, x]),
    );
    // First try: 4 of the 8 finished payments (7 succeeded + 1 gave up) succeeded on try 1 = 50%.
    expect(k.first_try).toMatchObject({ value: '50%', note: '4 of 8 succeeded on try 1' });
    // Recovered: 3 of the 4 that failed at least once (one gave up) = 75%, but 4 is below the minimum of 5.
    expect(k.recovered).toMatchObject({ value: 'No rate yet', note: 'A rate needs 5 qualifying failures (demo threshold).' });
    // Completion: the order that failed once took 0.2 + 0.3 + 5.1 + 0.3 = 5.9 s.
    const once = page.runs.find((r) => jobFacts(r, 'charge_card').failures === 1 && r.created_at.startsWith('2026-10-25'));
    expect(once && completionSeconds(once, wf)).toBeCloseTo(5.9, 6);
  });
});

describe('the three-edit guide on /connect', () => {
  const load = (t: string) => readFeedFile(t, { name: 'sample-feed.json', size: t.length });
  const edited = (id: string) => {
    const edit = SAMPLE_EDITS.find((e) => e.id === id);
    const out = edit ? applyEdit(text, edit) : null;
    if (out === null) throw new Error(`the guide's edit ${id} doesn't match the sample`);
    return out;
  };

  it('quotes lines that are really in the sample', () => {
    expect(SAMPLE_EDITS.map((e) => applyEdit(text, e) !== null)).toEqual([true, true, true]);
  });

  it('a renamed job shows its new name', () => {
    const r = load(edited('rename'));
    expect(r.ok && r.page.workflow.steps[0]?.label).toBe('Payment');
  });

  it('a renamed trigger shows the new noun', () => {
    const r = load(edited('trigger'));
    expect(r.ok && r.page.workflow.trigger).toEqual({ one: 'booking', many: 'bookings' });
  });

  it('breaking it on purpose gives the error the guide promises', () => {
    expect(load(edited('break'))).toEqual({
      ok: false, shape: true,
      error: "NEXUS can't read this file: unexpected feed data at workflow.steps[0].max_attempts: expected a whole number 1–10.",
    });
  });
});

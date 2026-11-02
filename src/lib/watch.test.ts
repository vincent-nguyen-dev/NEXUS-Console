import { describe, expect, it } from 'vitest';
import { SHOP_WF, shopRun } from '../test/otherWorkflow';
import { makeRun } from '../test/runs';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import type { FeedStatus } from './feedStatus';
import type { PrefStorage } from './prefs';
import { uniquePrefixes } from './format';
import { parseInstant } from './time';
import {
  WATCH_KEEP_MS, arrivalView, arrivals, checkText, clearWatch, howTo, isCurrent, readWatch, saveWatch, serverNowMs,
  watchingText,
} from './watch';

const ARMED = '2026-10-29T14:02:11.000Z';
const ARMED_MS = parseInstant(ARMED);
const at = (ms: number) => new Date(ARMED_MS + ms).toISOString();
const run = (id: string, created: string, outage = false) =>
  makeRun({ id, created, outage, notify: { attempts: outage ? ['fail'] : ['ok'] } });

function memory(): PrefStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
const broken: PrefStorage = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
};
const live = (ageMs: number, retryInMs: number | null): FeedStatus => ({ kind: 'live', ageMs, retryInMs, error: null });

describe('the server clock', () => {
  it('is the page time plus the time since it arrived (01:00:00.000 + 8 s)', () => {
    expect(serverNowMs('2026-10-29T01:00:00.000Z', 8_000)).toBe(parseInstant('2026-10-29T01:00:08.000Z'));
  });
});

describe('arrivals', () => {
  const before = run('r_00000000000a', at(-1));
  const exact = run('r_00000000000b', ARMED);
  const later = run('r_00000000000c', at(89_000));

  it('counts runs created at or after the start of the watch, newest first', () => {
    expect(arrivals([before, exact, later], ARMED_MS).map((r) => r.run_id)).toEqual(['r_00000000000c', 'r_00000000000b']);
  });

  it('is empty when nothing arrived', () => {
    expect(arrivals([before], ARMED_MS)).toEqual([]);
  });
});

describe('the stored watch', () => {
  it('reads back what was saved, and nothing after clearing', () => {
    const s = memory();
    saveWatch(s, ARMED_MS);
    expect(s.data.get('nexus.watch.since')).toBe(ARMED);
    expect(readWatch(s)).toBe(ARMED_MS);
    clearWatch(s);
    expect(readWatch(s)).toBeNull();
  });

  it('ignores junk and survives a storage that throws', () => {
    const s = memory();
    s.data.set('nexus.watch.since', 'yesterday');
    expect(readWatch(s)).toBeNull();
    expect(readWatch(broken)).toBeNull();
    expect(readWatch(null)).toBeNull();
    expect(() => saveWatch(broken, ARMED_MS)).not.toThrow();
    expect(() => clearWatch(broken)).not.toThrow();
  });

  it('is current for 60 min (3 600 000 ms) on the server clock, then dropped', () => {
    expect(WATCH_KEEP_MS).toBe(3_600_000);
    expect(isCurrent(ARMED_MS, ARMED_MS + 3_600_000)).toBe(true);
    expect(isCurrent(ARMED_MS, ARMED_MS + 3_600_001)).toBe(false);
  });
});

describe('the instructions', () => {
  it('reads Northstar’s description: the switch, the owner’s email, the simulated confirmation', () => {
    expect(howTo(WF)).toEqual([
      "Open Northstar Digital's contact form in a new tab. Any name works, with an address like you@example.com: you don't need real details. Northstar Digital keeps what you type for 7 days, then deletes it. NEXUS never sees it: the feed carries only job events.",
      'Want to see a failure? Tick "Simulate an email outage (demo)" on the form. That\'s the outage switch: it fails team notification tries 1 and 2 on purpose.',
      "The team notification's email really goes to the site's owner. Visitor confirmation is always simulated, so Northstar Digital sends you nothing.",
      "Then come back to this tab. NEXUS checks only while this tab is in view: right away when you're back, then every 30 seconds.",
    ]);
  });
});

describe('while watching', () => {
  it('says since when, on the server clock', () => {
    expect(watchingText(ARMED_MS, WF)).toBe('Watching for a new enquiry since 29 Oct, 14:02 UTC.');
    expect(watchingText(ARMED_MS, SHOP_WF)).toBe('Watching for a new order since 29 Oct, 14:02 UTC.');
  });

  it('says when it last checked and when it checks next (30 − 8 = 22 s)', () => {
    expect(checkText(live(8_000, 22_000))).toBe('Last check 8 s ago, next in 22 s.');
    expect(checkText(live(1_000, null))).toBe('Checking now…');
  });

  it('gives the reason when it is not checking', () => {
    expect(checkText({ kind: 'paused', ageMs: 1_900_000, retryInMs: null, error: null })).toBe('Checks are paused: resume them above.');
    expect(checkText({ kind: 'stale', ageMs: 60_000, retryInMs: 30_000, error: 'network' })).toBe("The last check didn't get an answer. NEXUS keeps trying; the status above says more.");
    expect(checkText({ kind: 'reconnecting', ageMs: 40_000, retryInMs: null, error: null })).toBe('Waiting for Northstar to answer (it may be waking up).');
  });
});

describe('arrived', () => {
  const NOW = at(120_000);
  const one = run('r_7f3a00000001', at(89_000), true);

  it('lists the arrival with its offset, short id, switch and headline (14:03:40 − 14:02:11 = 1 min 29 s)', () => {
    const v = arrivalView([one], ARMED_MS, NOW, WF, uniquePrefixes([one.run_id]));
    expect(v.heading).toBe('1 new enquiry since you started watching');
    expect(v.rows).toEqual([{
      runId: 'r_7f3a00000001',
      line: 'Arrived 1 min 29 s after you started · run 7f3a · outage switch on',
      headline: 'Not finished at the last update: the team notification failed 1 time and was waiting to retry.',
    }]);
    expect(v.more).toBeNull();
  });

  it('shows 3 of 4 arrivals and counts the rest', () => {
    const four = [1, 2, 3, 4].map((i) => run(`r_${i}00000000000`, at(i * 10_000)));
    const v = arrivalView(arrivals(four, ARMED_MS), ARMED_MS, NOW, WF, uniquePrefixes(four.map((r) => r.run_id)));
    expect(v.heading).toBe('4 new enquiries since you started watching');
    expect(v.rows.map((r) => r.runId)).toEqual(['r_400000000000', 'r_300000000000', 'r_200000000000']);
    expect(v.more).toBe('+ 1 more');
  });

  it('uses the shop’s own words and flag', () => {
    const order = shopRun('r_00000000000d', at(5_000), 1, false);
    const v = arrivalView([order], ARMED_MS, NOW, SHOP_WF, uniquePrefixes([order.run_id]));
    expect(v.heading).toBe('1 new order since you started watching');
    expect(v.rows[0]?.line).toBe('Arrived 5.0 s after you started · run 0000 · test card on');
  });
});

describe('another workflow', () => {
  it('leaves out the switch and the simulated job when its description has neither', () => {
    const lines = howTo({ ...SHOP_WF, flags: [] });
    expect(lines).toHaveLength(3);
    expect(lines.join(' ')).not.toMatch(/failure|simulated/);
  });
});

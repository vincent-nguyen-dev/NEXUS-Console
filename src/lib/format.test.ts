import { describe, expect, it } from 'vitest';
import { makeRun, must } from '../test/runs';
import { GUIDED_RUN } from './guided';
import {
  agoFromServer, describeEvent, eventDetail, eventLabel, eventTone, formatAgo, formatDuration, formatOffset, formatPercent,
  formatPlanned, formatUtcDay, formatUtcMinute, formatUtcTime, shortRunId, uniquePrefixes,
} from './format';
import { stepLabel } from './workflow';
import type { RunEvent } from './types';
import { NORTHSTAR_WF as WF } from '../test/workflow';

describe('formatDuration', () => {
  it('shows seconds to 0.1 s below a minute (the recorded run: 10.2 s, 30.2 s, 42.7 s)', () => {
    expect(formatDuration(10.190001)).toBe('10.2 s');
    expect(formatDuration(30.190512)).toBe('30.2 s');
    expect(formatDuration(42.672518)).toBe('42.7 s');
    expect(formatDuration(0)).toBe('0.0 s');
  });

  it('rounds first, so 59.96 s becomes 1 min 0 s, not "60.0 s"', () => {
    expect(formatDuration(59.94)).toBe('59.9 s');
    expect(formatDuration(59.96)).toBe('1 min 0 s');
  });

  it('uses minutes, hours and days for longer spans', () => {
    expect(formatDuration(125)).toBe('2 min 5 s');
    expect(formatDuration(3600)).toBe('1 h 0 min');
    expect(formatDuration(7 * 24 * 3600)).toBe('7 d 0 h');
  });

  it('rejects negative and non-finite input', () => {
    expect(() => formatDuration(-1)).toThrow();
    expect(() => formatDuration(Number.NaN)).toThrow();
  });
});

describe('formatPlanned (configured waits are whole seconds)', () => {
  it('reads like the backoff setting: 10 s, 30 s, 2 min', () => {
    expect(formatPlanned(10)).toBe('10 s');
    expect(formatPlanned(30)).toBe('30 s');
    expect(formatPlanned(120)).toBe('2 min');
    expect(formatPlanned(90)).toBe('1 min 30 s');
  });
});

describe('formatPercent', () => {
  it('rounds to a whole percent', () => {
    expect(formatPercent(2, 3)).toBe('67%');
    expect(formatPercent(1, 8)).toBe('13%'); // 12.5 rounds up
  });

  it('never shows 100% or 0% unless it is exact', () => {
    expect(formatPercent(199, 200)).toBe('99%');
    expect(formatPercent(1, 300)).toBe('1%');
    expect(formatPercent(5, 5)).toBe('100%');
    expect(formatPercent(0, 5)).toBe('0%');
  });

  it('shows a dash with no denominator', () => {
    expect(formatPercent(0, 0)).toBe('–');
  });
});

describe('labels', () => {
  it('names each step in plain language', () => {
    expect(stepLabel(WF, 'notify_team')).toBe('Team notification');
    expect(stepLabel(WF, 'confirm_visitor')).toBe('Visitor confirmation');
    expect(stepLabel(WF, 'purge_pii')).toBe('Personal data deletion');
  });

  it('shortens a run id to its first 4 hex characters', () => {
    expect(shortRunId('r_6d15828d95f5')).toBe('6d15');
  });
});

describe('describeEvent (follows the honesty rules)', () => {
  const text = (e: RunEvent | undefined) => (e ? describeEvent(e, GUIDED_RUN, WF) : 'missing');
  const find = (kind: RunEvent['kind'], event: RunEvent['event'], attempt?: number) =>
    GUIDED_RUN.events.find((e) => e.kind === kind && e.event === event && (attempt === undefined || e.attempt === attempt));

  it('tells the recorded story', () => {
    expect(text(find('notify_team', 'failed', 1))).toBe('Team notification failed on try 1 (simulated outage)');
    expect(text(find('notify_team', 'retry_scheduled', 1))).toBe('Team notification will retry in 10 s');
    expect(text(find('notify_team', 'succeeded'))).toBe('Team notification recovered on try 3 (email sent)');
    expect(text(find('confirm_visitor', 'succeeded'))).toBe('Visitor confirmation worked on try 1 (simulated, never sent)');
    expect(text(find('purge_pii', 'queued'))).toBe('Personal data deletion scheduled');
    expect(text(find('notify_team', 'started', 2))).toBe('Team notification try 2 started');
  });

  it('never claims an email for a capped or mocked notification', () => {
    const capped = makeRun({ id: 'r_a', created: '2026-10-01T00:00:00Z', notify: { attempts: ['ok'], result: 'skipped_cap' } });
    const mocked = makeRun({ id: 'r_b', created: '2026-10-01T00:00:00Z', notify: { attempts: ['ok'], result: 'mock' } });
    const ok = (r: typeof capped) => must(r.events.find((e) => e.kind === 'notify_team' && e.event === 'succeeded'));
    expect(describeEvent(ok(capped), capped, WF)).toBe('Team notification skipped on try 1 (skipped at the daily email cap)');
    expect(describeEvent(ok(mocked), mocked, WF)).toBe('Team notification worked on try 1 (simulated, no email provider)');
  });

  it('says "succeeded on try 2", not "recovered", after a lease expiry without a failure', () => {
    const r = makeRun({ id: 'r_c', created: '2026-10-01T00:00:00Z', notify: { attempts: ['lease', 'ok'] } });
    const ok = must(r.events.find((e) => e.kind === 'notify_team' && e.event === 'succeeded'));
    expect(describeEvent(ok, r, WF)).toBe('Team notification succeeded on try 2 (email sent)');
  });

  it('describes giving up, including a worker timeout', () => {
    const dead = makeRun({ id: 'r_d', created: '2026-10-01T00:00:00Z', notify: { attempts: ['fail', 'fail', 'fail', 'fail_dead'] } });
    const lease = makeRun({ id: 'r_e', created: '2026-10-01T00:00:00Z', notify: { attempts: ['lease_dead'] } });
    const deadEvent = (r: typeof dead) => must(r.events.find((e) => e.kind === 'notify_team' && e.event === 'dead'));
    expect(describeEvent(deadEvent(dead), dead, WF)).toBe('Team notification gave up after 4 tries');
    expect(describeEvent(deadEvent(lease), lease, WF)).toBe('Team notification gave up: try 1 never reported back');
  });
});

describe('formatAgo', () => {
  it('seconds, minutes, hours, days, rounded down', () => {
    expect([0, 999, 12_400, 59_999, 60_000, 240_001, 3_599_999, 3_600_000, 7_500_000, 86_400_000 * 3 + 5].map(formatAgo))
      .toEqual(['0 s', '0 s', '12 s', '59 s', '1 min', '4 min', '59 min', '1 h', '2 h 5 min', '3 d']);
  });
  it('a negative age (clock jitter) reads as 0 s', () => expect(formatAgo(-50)).toBe('0 s'));
});

describe('formatUtcDay', () => {
  it('uses the UTC day, so a run at 03:07 UTC is the 22nd everywhere', () => {
    expect(formatUtcDay('2026-10-22T03:07:46.373512+00:00')).toBe('22 Oct 2026');
    expect(formatUtcDay('2026-10-21T20:07:46-07:00')).toBe('22 Oct 2026');
  });
});

describe('uniquePrefixes', () => {
  it('uses 4 hex while that tells the runs apart', () => {
    const ids = ['r_0f7d032dcb8d', 'r_35cc6645cf2b', 'r_6d15828d95f5'];
    expect([...uniquePrefixes(ids).values()]).toEqual(['0f7d', '35cc', '6d15']);
  });

  it('grows only the prefixes that collide', () => {
    const p = uniquePrefixes(['r_abcd00000001', 'r_abcd10000002', 'r_6d15828d95f5']);
    expect(p.get('r_abcd00000001')).toBe('abcd0');
    expect(p.get('r_abcd10000002')).toBe('abcd1');
    expect(p.get('r_6d15828d95f5')).toBe('6d15');
  });

  it('ignores duplicates of the same id', () => {
    expect(uniquePrefixes(['r_6d15828d95f5', 'r_6d15828d95f5']).get('r_6d15828d95f5')).toBe('6d15');
  });
});

describe('formatOffset', () => {
  it('writes a time after the lead (the recorded run: +0.4 s, +10.9 s, +42.7 s)', () => {
    expect(formatOffset(0.421393)).toBe('+0.4 s');
    expect(formatOffset(10.948477)).toBe('+10.9 s');
    expect(formatOffset(42.672518)).toBe('+42.7 s');
    expect(formatOffset(7 * 86400)).toBe('+7 d 0 h');
  });

  it('marks an earlier time with a minus sign', () => {
    expect(formatOffset(-0.25)).toBe('−0.3 s');
  });
});

describe('formatUtcTime', () => {
  it('shows the UTC day and the time to a tenth', () => {
    expect(formatUtcTime('2026-10-22T03:07:47.131988+00:00')).toBe('22 Oct 2026 03:07:47.1');
    expect(formatUtcTime('2026-10-21T20:07:47.131988-07:00')).toBe('22 Oct 2026 03:07:47.1');
  });

  it('cuts tenths instead of rounding them, so :59.96 stays :59.9', () => {
    expect(formatUtcTime('2026-10-22T03:07:59.96+00:00')).toBe('22 Oct 2026 03:07:59.9');
    expect(formatUtcTime('2026-12-31T23:59:59.999+00:00')).toBe('31 Dec 2026 23:59:59.9');
    expect(formatUtcTime('2026-10-22T03:07:00Z')).toBe('22 Oct 2026 03:07:00.0');
  });
});

describe('formatUtcMinute', () => {
  it('shows the UTC day and minute, whatever offset the time was written in', () => {
    expect(formatUtcMinute('2026-10-22T03:07:46.373512+00:00')).toBe('22 Oct, 03:07 UTC');
    expect(formatUtcMinute('2026-10-21T20:07:46-07:00')).toBe('22 Oct, 03:07 UTC');
  });

  it('cuts the minute instead of rounding it', () => {
    expect(formatUtcMinute('2026-10-27T04:36:59.9+00:00')).toBe('27 Oct, 04:36 UTC');
  });
});

describe('agoFromServer', () => {
  it("measures on the server's clock, plus the age of the answer", () => {
    // The server answered at 06:00:00, 30 s ago; the event was at 05:56:00 → 4 min 30 s → "4 min".
    expect(agoFromServer('2026-10-24T05:56:00Z', '2026-10-24T06:00:00Z', 30_000)).toBe('4 min ago');
    expect(agoFromServer('2026-10-24T05:59:58Z', '2026-10-24T06:00:00Z', 0)).toBe('2 s ago');
  });
});

describe('event columns', () => {
  it('labels events, with the purge queued as scheduled', () => {
    expect(eventLabel(WF, 'notify_team', 'retry_scheduled')).toBe('Retry planned');
    expect(eventLabel(WF, 'notify_team', 'dead')).toBe('Gave up');
    expect(eventLabel(WF, 'purge_pii', 'queued')).toBe('Scheduled');
    expect(eventLabel(WF, 'notify_team', 'queued')).toBe('Queued');
  });

  it('keeps the code and says what it means, never calling a simulated result sent', () => {
    expect(eventDetail(WF, 'notify_team', 'failed', 'simulated_outage')).toEqual({ code: 'simulated_outage', gloss: 'simulated outage' });
    expect(eventDetail(WF, 'notify_team', 'retry_scheduled', '10')).toEqual({ code: null, gloss: 'in 10 s' });
    expect(eventDetail(WF, 'notify_team', 'retry_scheduled', '120')).toEqual({ code: null, gloss: 'in 2 min' });
    expect(eventDetail(WF, 'notify_team', 'succeeded', 'sent')).toEqual({ code: 'sent', gloss: 'email sent' });
    expect(eventDetail(WF, 'notify_team', 'succeeded', 'mock')).toEqual({ code: 'mock', gloss: 'simulated, no email provider' });
    expect(eventDetail(WF, 'confirm_visitor', 'succeeded', 'mock')).toEqual({ code: 'mock', gloss: 'simulated, never sent' });
    expect(eventDetail(WF, 'notify_team', 'succeeded', 'skipped_cap')).toEqual({ code: 'skipped_cap', gloss: 'skipped at the daily email cap' });
    expect(eventDetail(WF, 'notify_team', 'dead', 'lease_expired')).toEqual({ code: 'lease_expired', gloss: 'never reported back' });
    expect(eventDetail(WF, 'purge_pii', 'succeeded', 'purged')).toEqual({ code: 'purged', gloss: 'deleted' });
    expect(eventDetail(WF, 'notify_team', 'started', null)).toEqual({ code: null, gloss: null });
    expect(eventDetail(WF, 'notify_team', 'succeeded', 'weird')).toEqual({ code: 'weird', gloss: null });
  });

  it('gives every event a tone; a skipped send is not a success', () => {
    expect(eventTone({ kind: 'notify_team', event: 'succeeded', detail: 'sent' }, WF)).toBe('ok');
    expect(eventTone({ kind: 'notify_team', event: 'succeeded', detail: 'skipped_cap' }, WF)).toBe('neutral');
    // Simulated results get the ring, never the ✓ that means really sent (checkpoint A's S1).
    expect(eventTone({ kind: 'notify_team', event: 'succeeded', detail: 'mock' }, WF)).toBe('simulated');
    expect(eventTone({ kind: 'confirm_visitor', event: 'succeeded', detail: 'mock' }, WF)).toBe('simulated');
    expect(eventTone({ kind: 'notify_team', event: 'failed', detail: 'simulated_outage' }, WF)).toBe('retry');
    expect(eventTone({ kind: 'notify_team', event: 'dead', detail: null }, WF)).toBe('dead');
    expect(eventTone({ kind: 'notify_team', event: 'started', detail: null }, WF)).toBe('neutral');
  });
});

import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { announcedKind, feedStatus, isLive, newestCreatedAt, newestEnquiryAgo, pillState, type FeedSnapshot, type PillState, type StatusKind } from './feedStatus';

const NOW = 1_000_000_000;
const base: FeedSnapshot = { hasData: true, lastSuccessAt: NOW - 12_000, inFlightSince: null, lastError: null, paused: false, nextAt: NOW + 18_000 };
const noData: FeedSnapshot = { ...base, hasData: false, lastSuccessAt: null };

const rows: [string, FeedSnapshot, StatusKind][] = [
  ['no data, request open 4.9 s', { ...noData, inFlightSince: NOW - 4_900 }, 'connecting'],
  ['no data, request open 5 s', { ...noData, inFlightSince: NOW - 5_000 }, 'waking'],
  ['no data, no answer', { ...noData, lastError: { kind: 'network' } }, 'offline'],
  ['no data, 429', { ...noData, lastError: { kind: 'rate_limited' } }, 'rate_limited'],
  ['no data, 503', { ...noData, lastError: { kind: 'unavailable' } }, 'api_error'],
  ['no data, feed changed shape', { ...noData, lastError: { kind: 'shape' } }, 'api_error'],
  ['no data, a retry is open again', { ...noData, lastError: { kind: 'network' }, inFlightSince: NOW - 1_000 }, 'connecting'],
  ['no data, paused before the first answer', { ...noData, paused: true }, 'paused'],
  ['data, 12 s old', base, 'live'],
  ['data, refresh open 4 s', { ...base, inFlightSince: NOW - 4_000 }, 'live'],
  ['data, refresh open 6 s (Render waking)', { ...base, inFlightSince: NOW - 6_000 }, 'reconnecting'],
  ['data, last refresh failed', { ...base, lastError: { kind: 'network' } }, 'stale'],
  ['data, 4 min old exactly', { ...base, lastSuccessAt: NOW - 240_000 }, 'live'],
  ['data, older than 4 min', { ...base, lastSuccessAt: NOW - 240_001 }, 'stale'],
  ['data, paused (overrides stale)', { ...base, paused: true, lastError: { kind: 'network' } }, 'paused'],
];

describe('feedStatus', () => {
  it.each(rows)('%s → %s', (_, snap, kind) => {
    expect(feedStatus(snap, NOW, 'live').kind).toBe(kind);
  });

  it('guided mode is always the recording, whatever the poller holds', () => {
    expect(feedStatus({ ...noData, lastError: { kind: 'network' } }, NOW, 'recording').kind).toBe('recorded');
  });

  it('reports the data age and the time to the next request', () => {
    expect(feedStatus(base, NOW, 'live')).toMatchObject({ ageMs: 12_000, retryInMs: 18_000, error: null });
    expect(feedStatus({ ...base, nextAt: NOW - 5 }, NOW, 'live').retryInMs).toBe(0);
    expect(feedStatus(noData, NOW, 'live').ageMs).toBeNull();
  });

  it('freshness does not depend on the polling interval: a failed refresh stays stale until a success', () => {
    // Active polling failed at 90 s; going idle (2 min interval) must not turn it back to live.
    const failed = { ...base, lastSuccessAt: NOW - 90_000, lastError: { kind: 'network' as const }, nextAt: NOW + 120_000 };
    expect(feedStatus(failed, NOW, 'live').kind).toBe('stale');
    expect(feedStatus({ ...failed, lastError: null, lastSuccessAt: NOW }, NOW, 'live').kind).toBe('live');
  });
});

describe('newestEnquiryAgo', () => {
  const older = makeRun({ id: 'r_000000000001', created: '2026-10-26T09:18:00Z' });
  const newer = makeRun({ id: 'r_000000000002', created: '2026-10-27T00:00:00Z' });

  it('says nothing without runs', () => {
    expect(newestCreatedAt([])).toBeNull();
    expect(newestEnquiryAgo([], '2026-10-27T12:00:00Z', 0)).toBeNull();
  });

  it('picks the newest run whatever the order', () => {
    expect(newestCreatedAt([newer, older])).toBe('2026-10-27T00:00:00Z');
    expect(newestCreatedAt([older, newer])).toBe('2026-10-27T00:00:00Z');
  });

  it('measures on the server clock plus the answer age, so the client clock never enters', () => {
    // 12:00:00 − 00:00:00 = 12 h, + 30 s since the answer = 12 h 0 min 30 s → "12 h" (rounded down).
    expect(newestEnquiryAgo([older, newer], '2026-10-27T12:00:00Z', 30_000)).toBe('12 h ago');
    // 59 min later the minutes show: 12 h 59 min 30 s → "12 h 59 min".
    expect(newestEnquiryAgo([newer], '2026-10-27T12:59:00Z', 30_000)).toBe('12 h 59 min ago');
  });
});

describe('pillState', () => {
  const kinds: [StatusKind, PillState][] = [
    ['live', 'live'], ['connecting', 'waking'], ['waking', 'waking'], ['reconnecting', 'stale'], ['stale', 'stale'],
    ['paused', 'stale'], ['offline', 'unavailable'], ['rate_limited', 'unavailable'], ['api_error', 'unavailable'], ['preview', 'unavailable'],
    ['recorded', 'static'], ['file', 'static'],
  ];
  it.each(kinds)('%s → %s, and only live data says live', (kind, pill) => {
    const status = { kind, ageMs: null, retryInMs: null, error: null };
    expect(pillState(status)).toBe(pill);
    expect(pillState(status) === 'live').toBe(isLive(status));
  });
});

describe('announcedKind', () => {
  it('keeps a slow poll quiet: "reconnecting" is shown, the last state stays announced', () => {
    expect(announcedKind('live', 'reconnecting')).toBe('live');
    expect(announcedKind('live', 'live')).toBe('live');
    expect(announcedKind('live', 'stale')).toBe('stale');
    expect(announcedKind('stale', 'live')).toBe('live');
    expect(announcedKind('waking', 'live')).toBe('live');
  });
});

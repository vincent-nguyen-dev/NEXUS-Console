import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRun } from '../test/runs';
import { ApiError } from './api';
import { runsInWindow } from './filters';
import { Poller } from './poller';
import { CLOCK_MARGIN_MS, oldestRunMs } from './pollPolicy';
import { parseInstant } from './time';
import type { Run, RunsPage } from './types';
import { NORTHSTAR_WF as WF } from '../test/workflow';

const T0 = Date.parse('2026-10-24T12:00:00.000Z');
const S = 1000;
const MIN = 60 * S;
const DAY = 24 * 60 * MIN;

/** A fake Northstar: answers like the real `since` filter, on its own clock (client − skew). */
function server(runs: Run[] = [], skewMs = 0) {
  const calls: { since: string | null; signal: AbortSignal }[] = [];
  const load = vi.fn(async (since: string | null, signal: AbortSignal): Promise<RunsPage> => {
    calls.push({ since, signal });
    const now = Date.now() - skewMs;
    const kept = since === null ? runs : runs.filter((r) => parseInstant(r.created_at) >= parseInstant(since));
    return { now: new Date(now).toISOString(), truncated: false, workflow: WF, runs: kept };
  });
  return { load, calls };
}

function poller(load: (since: string | null, signal: AbortSignal) => Promise<RunsPage>, win: '24h' | '7d' | '30d' | 'all' = '30d') {
  return new Poller({ load, oldestMs: oldestRunMs, now: () => Date.now(), setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: (h) => clearTimeout(h as number) }, win, true);
}

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('cadence', () => {
  it('asks at once, then every 30 s', async () => {
    const { load } = server();
    const p = poller(load);
    p.start();
    await tick(0);
    expect(load).toHaveBeenCalledTimes(1);
    await tick(30 * S);
    expect(load).toHaveBeenCalledTimes(2);
    await tick(30 * S);
    expect(load).toHaveBeenCalledTimes(3);
    expect(p.getSnapshot()).toMatchObject({ hasData: true, lastError: null, inFlightSince: null, nextAt: T0 + 90 * S });
  });

  it('never has two requests open: a slow answer delays the next one', async () => {
    let resolve: (p: RunsPage) => void = () => {};
    const load = vi.fn(() => new Promise<RunsPage>((r) => { resolve = r; }));
    const p = poller(load);
    p.start();
    await tick(2 * MIN);
    expect(load).toHaveBeenCalledTimes(1);
    expect(p.getSnapshot().inFlightSince).toBe(T0);
    resolve({ now: new Date(Date.now()).toISOString(), truncated: false, workflow: WF, runs: [] });
    await tick(0);
    expect(p.getSnapshot().inFlightSince).toBeNull();
    await tick(30 * S);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('an abandoned visible tab makes 23 requests in 30 min, then pauses and makes none', async () => {
    const { load } = server();
    const p = poller(load);
    p.start();
    await tick(30 * MIN - 1);
    expect(load).toHaveBeenCalledTimes(23);
    await tick(1);
    expect(p.getSnapshot().paused).toBe(true);
    await tick(60 * MIN);
    expect(load).toHaveBeenCalledTimes(23);
  });

  it('input after a pause resumes and asks at once', async () => {
    const { load } = server();
    const p = poller(load);
    p.start();
    await tick(31 * MIN);
    const before = load.mock.calls.length;
    p.noteActivity();
    await tick(0);
    expect(p.getSnapshot().paused).toBe(false);
    expect(load).toHaveBeenCalledTimes(before + 1);
  });

  it('input after 5 idle minutes brings back the 30 s pace (asking at once if the data is 30 s old)', async () => {
    const { load } = server();
    const p = poller(load);
    p.start();
    await tick(7 * MIN + 10 * S); // polls at …, 300 s, 420 s; data is 10 s old
    const before = load.mock.calls.length;
    p.noteActivity();
    await tick(0);
    expect(load).toHaveBeenCalledTimes(before); // only 10 s old: wait
    await tick(20 * S);
    expect(load).toHaveBeenCalledTimes(before + 1); // 30 s after the last answer, not 2 min
  });
});

describe('visibility', () => {
  it('a hidden tab makes no requests; showing it asks at once when the data is ≥ 30 s old', async () => {
    const { load } = server();
    const p = poller(load);
    p.start();
    await tick(0);
    p.setVisible(false);
    await tick(10 * MIN);
    expect(load).toHaveBeenCalledTimes(1);
    p.setVisible(true);
    await tick(0);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('showing the tab again within 30 s waits for the rest of the interval', async () => {
    const { load } = server();
    const p = poller(load);
    p.start();
    await tick(0);
    p.setVisible(false);
    await tick(10 * S);
    p.setVisible(true);
    await tick(19 * S);
    expect(load).toHaveBeenCalledTimes(1);
    await tick(1 * S);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('errors', () => {
  it('stops after a refusal: a preview is refused every time, so it isn\'t retried (7.2a)', async () => {
    const load = vi.fn(async (): Promise<RunsPage> => {
      throw new ApiError('refused', 'preview');
    });
    const p = poller(load);
    p.start();
    await tick(0);
    expect(p.getSnapshot()).toMatchObject({ lastError: { kind: 'refused' }, nextAt: null });
    await tick(30 * MIN);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('backs off 30 → 60 → 120 s, keeps the error until a success, and recovers', async () => {
    let fail = true;
    const load = vi.fn(async (): Promise<RunsPage> => {
      if (fail) throw new ApiError('network', 'down');
      return { now: new Date(Date.now()).toISOString(), truncated: false, workflow: WF, runs: [] };
    });
    const p = poller(load);
    p.start();
    await tick(0);
    expect(p.getSnapshot().lastError?.kind).toBe('network');
    await tick(30 * S); // 2nd at 30 s
    await tick(60 * S); // 3rd at 90 s
    await tick(120 * S); // 4th at 210 s
    expect(load).toHaveBeenCalledTimes(4);
    await tick(119 * S);
    expect(load).toHaveBeenCalledTimes(4);
    fail = false;
    await tick(1 * S); // 5th at 330 s succeeds
    expect(p.getSnapshot()).toMatchObject({ lastError: null, hasData: true, lastSuccessAt: T0 + 330 * S });
  });

  it('a failed refresh keeps the old data and its time; slowing to idle does not refresh them', async () => {
    let fail = false;
    const load = vi.fn(async (): Promise<RunsPage> => {
      if (fail) throw new ApiError('unavailable', 'down', 503);
      return { now: new Date(Date.now()).toISOString(), truncated: false, workflow: WF, runs: [] };
    });
    const p = poller(load);
    p.start();
    await tick(0);
    fail = true;
    await tick(10 * MIN);
    expect(p.getSnapshot()).toMatchObject({ hasData: true, lastSuccessAt: T0 });
    expect(p.getSnapshot().lastError?.kind).toBe('unavailable');
  });

  it('waits as long as a 429 asks, and the Retry button respects it', async () => {
    const load = vi.fn(async (): Promise<RunsPage> => {
      throw new ApiError('rate_limited', 'slow down', 429, 45);
    });
    const p = poller(load);
    p.start();
    await tick(0);
    p.retryNow();
    await tick(0);
    expect(load).toHaveBeenCalledTimes(1);
    await tick(44 * S);
    expect(load).toHaveBeenCalledTimes(1);
    await tick(1 * S);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('Retry asks at once after an ordinary failure', async () => {
    const load = vi.fn(async (): Promise<RunsPage> => {
      throw new ApiError('network', 'down');
    });
    const p = poller(load);
    p.start();
    await tick(0);
    p.retryNow();
    await tick(0);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

const runAgo = (id: number, ago: number) =>
  makeRun({ id: `r_${id.toString(16).padStart(12, '0')}`, created: new Date(T0 - ago).toISOString() });

describe('windows', () => {
  it('narrowing re-filters what is held, with no request', async () => {
    const { load } = server([runAgo(1, 1 * DAY), runAgo(2, 10 * DAY)]);
    const p = poller(load);
    p.start();
    await tick(0);
    p.setWindow('7d');
    await tick(0);
    expect(load).toHaveBeenCalledTimes(1);
    const snap = p.getSnapshot();
    expect(snap.win).toBe('7d');
    expect(snap.page?.runs).toHaveLength(2); // the consumer filters by window
  });

  it('widening drops the held data (never shown under the wider label) and asks again', async () => {
    const { load, calls } = server([runAgo(1, 1 * DAY)]);
    const p = poller(load, '24h');
    p.start();
    await tick(0);
    p.setWindow('all');
    expect(p.getSnapshot()).toMatchObject({ page: null, hasData: false });
    await tick(0);
    expect(calls.at(-1)?.since).toBeNull();
    expect(p.getSnapshot().hasData).toBe(true);
  });

  it('a window change aborts the open request', async () => {
    const signals: AbortSignal[] = [];
    const load = vi.fn((_since: string | null, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<RunsPage>(() => {});
    });
    const p = poller(load, '24h');
    p.start();
    await tick(0);
    p.setWindow('all');
    await tick(0);
    expect(signals[0]?.aborted).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('clock skew', () => {
  // Runs on the server's clock: 30 days ago exactly, 30 days − 1 min, and 30 days + 1 min (outside).
  const edge = (skewMs: number) => {
    const serverNow = T0 - skewMs;
    const at = (ago: number, id: number) =>
      makeRun({ id: `r_${id.toString(16).padStart(12, '0')}`, created: new Date(serverNow - ago).toISOString() });
    return [at(30 * DAY - MIN, 1), at(30 * DAY, 2), at(30 * DAY + MIN, 3)];
  };
  const shown = (page: RunsPage | null) =>
    page === null ? [] : runsInWindow(page.runs, '30d', parseInstant(page.now)).map((r) => r.run_id).sort();

  it('a client 10 min fast: one corrective request, then exactly the server window', async () => {
    const skew = 10 * MIN;
    const { load, calls } = server(edge(skew), skew);
    const p = poller(load);
    p.start();
    await tick(0);
    expect(load).toHaveBeenCalledTimes(2);
    expect(calls[1]?.since).toBe(new Date(T0 - skew - 30 * DAY - CLOCK_MARGIN_MS).toISOString());
    expect(shown(p.getSnapshot().page)).toEqual(['r_000000000001', 'r_000000000002']);
    await tick(30 * S);
    expect(load).toHaveBeenCalledTimes(3); // the offset is learned: no more corrections
  });

  it('a client 10 min slow: no correction needed, and the extra runs are filtered out', async () => {
    const skew = -10 * MIN;
    const { load } = server(edge(skew), skew);
    const p = poller(load);
    p.start();
    await tick(0);
    expect(load).toHaveBeenCalledTimes(1);
    expect(p.getSnapshot().page?.runs).toHaveLength(3);
    expect(shown(p.getSnapshot().page)).toEqual(['r_000000000001', 'r_000000000002']);
  });

  it('a skew inside the 60 s margin needs no correction', async () => {
    const { load } = server(edge(45 * S), 45 * S);
    const p = poller(load);
    p.start();
    await tick(0);
    expect(load).toHaveBeenCalledTimes(1);
    expect(shown(p.getSnapshot().page)).toEqual(['r_000000000001', 'r_000000000002']);
  });
});

describe('stop and start', () => {
  it('stop aborts and makes no more requests, even on input or when the tab is shown again', async () => {
    const { load } = server();
    const p = poller(load);
    p.start();
    await tick(0);
    p.stop();
    p.noteActivity();
    p.setVisible(false);
    p.setVisible(true);
    await tick(10 * MIN);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a restart within 30 s reuses the data; a later one asks at once (guided → live)', async () => {
    const { load } = server();
    const p = poller(load);
    p.start();
    await tick(0);
    p.stop();
    p.start(); // React StrictMode remounts at once
    await tick(0);
    expect(load).toHaveBeenCalledTimes(1);
    p.stop();
    await tick(5 * MIN);
    p.start();
    await tick(0);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('a window widened while stopped is loaded at once on restart, not 30 s later', async () => {
    const { load, calls } = server();
    const p = poller(load, '24h');
    p.start();
    await tick(0);
    p.stop();
    p.setWindow('all');
    await tick(1 * S);
    expect(load).toHaveBeenCalledTimes(1);
    p.start();
    await tick(0);
    expect(load).toHaveBeenCalledTimes(2);
    expect(calls[1]?.since).toBeNull();
  });

  it('a stop while a request is open drops its answer, and the restart asks again', async () => {
    let resolve: (p: RunsPage) => void = () => {};
    const load = vi.fn(() => new Promise<RunsPage>((r) => { resolve = r; }));
    const p = poller(load);
    p.start();
    await tick(0);
    p.stop();
    resolve({ now: new Date(Date.now()).toISOString(), truncated: false, workflow: WF, runs: [] });
    await tick(0);
    expect(p.getSnapshot()).toMatchObject({ hasData: false, inFlightSince: null });
    p.start();
    await tick(0);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

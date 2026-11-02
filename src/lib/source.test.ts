// The visitor's own file as a data source: labelled "your file", static like the recording, with windows
// like live data, and never described as Northstar's.
import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import { feedStatus, type FeedSnapshot } from './feedStatus';
import { headline } from './headline';
import { kpiSource, partialNote } from './kpis';
import { lookupRun } from './runDetail';
import { isStatic, sourceOf, sourceText } from './source';
import { parseUrlState, serializeUrlState, DEFAULT_URL_STATE } from './urlState';

describe('the data source', () => {
  it('comes from the URL, with the old `guided` key still opening the recording', () => {
    expect(['live', 'guided', 'file'].map((m) => sourceOf(parseUrlState(`?mode=${m}`).mode))).toEqual(['live', 'recording', 'file']);
    expect(serializeUrlState({ ...DEFAULT_URL_STATE, mode: 'file' })).toBe('?mode=file');
    expect([isStatic('live'), isStatic('recording'), isStatic('file')]).toEqual([false, true, true]);
  });

  it('a file has its own status, whatever the poller holds', () => {
    const snap: FeedSnapshot = { hasData: true, lastSuccessAt: 0, inFlightSince: null, lastError: null, paused: false, nextAt: null };
    expect(feedStatus(snap, 1_000, 'file').kind).toBe('file');
  });

  it('names the file, never Northstar', () => {
    const file = sourceText('file');
    expect(file.onlyNewest(500)).toBe('Your file holds only the newest 500 runs');
    expect(file.everyEvent).toBe('Every event in your file for these runs');
    expect(partialNote('file')).toBe('Your file holds only the newest 500 runs, and this window has more. Choose a shorter window.');
    expect(Object.values(file).filter((v) => typeof v === 'string' && /northstar/i.test(v))).toEqual([]);
    expect(kpiSource({ win: '30d', source: 'file', fileName: 'shop.json', asOf: '2026-10-28T12:00:00Z', capturedAt: '' }))
      .toBe('Source: your file (shop.json), runs created in the last 30 days, as of its time, 28 Oct, 12:00 UTC.');
  });

  it('never says "right now" for a file, even with a run waiting to retry', () => {
    const retrying = makeRun({ id: 'r_000000000001', created: '2026-10-28T11:00:00Z', notify: { attempts: ['fail'] } });
    const h = headline([retrying], { win: '30d', source: 'file', partial: false, live: true }, WF);
    expect(h.now).toBeNull();
    expect(h.window).toMatch(/^In the last 30 days, /);
  });

  it('says a missing run is missing from your file', () => {
    const page = { now: '2026-10-28T12:00:00Z', truncated: false, workflow: WF, runs: [] };
    expect(lookupRun('r_000000000000', page, { source: 'file', win: 'all' })).toEqual({ kind: 'missing', reason: 'file' });
    expect(lookupRun('r_000000000000', page, { source: 'file', win: '30d' })).toEqual({ kind: 'missing', reason: 'window' });
  });
});

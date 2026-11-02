import { describe, expect, it } from 'vitest';
import { DEFAULT_URL_STATE, historyAction, parseUrlState, serializeUrlState, type UrlState } from './urlState';

const state = (patch: Partial<UrlState>): UrlState => ({ ...DEFAULT_URL_STATE, ...patch });

describe('parseUrlState', () => {
  it('an empty query is the default: overview, live, 30d, nothing selected', () => {
    expect(parseUrlState('')).toEqual({
      view: 'overview', mode: 'live', win: '30d', step: null, attempt: null, event: null, order: 'newest', run: null, flags: null,
    });
    expect(parseUrlState('?')).toEqual(DEFAULT_URL_STATE);
  });

  it('reads every key', () => {
    expect(parseUrlState('?view=events&mode=guided&win=7d&step=notify_team&attempt=3&event=failed&order=oldest&run=r_6d15828d95f5')).toEqual({
      view: 'events', mode: 'guided', win: '7d', step: 'notify_team', attempt: 3, event: 'failed', order: 'oldest', run: 'r_6d15828d95f5', flags: null,
    });
  });

  it('drops values it does not know to the default, one key at a time', () => {
    expect(parseUrlState('?view=nope&mode=demo&win=1y&step=Price!&event=sent&order=asc&run=NS-TEST01')).toEqual(DEFAULT_URL_STATE);
    // A well-formed job id is kept: the feed's description decides later whether it names a job.
    expect(parseUrlState('?step=price').step).toBe('price');
    expect(parseUrlState('?win=24h&mode=demo')).toEqual(state({ win: '24h' }));
  });

  it('falls back to overview for views that are not built yet', () => {
    expect(parseUrlState('?view=retries').view).toBe('retries'); // built in 6.2b
    expect(parseUrlState('?view=nope').view).toBe('overview');
    expect(parseUrlState('?view=events').view).toBe('events');
    expect(parseUrlState('?view=ai').view).toBe('ai'); // built in 6.1b
    expect(serializeUrlState({ ...DEFAULT_URL_STATE, view: 'ai' })).toBe('?view=ai');
  });

  it('accepts only opaque run ids (r_ + 12 lowercase hex)', () => {
    expect(parseUrlState('?run=r_6d15828d95f5').run).toBe('r_6d15828d95f5');
    expect(parseUrlState('?run=r_6D15828D95F5').run).toBeNull();
    expect(parseUrlState('?run=r_6d15').run).toBeNull();
  });

  it('accepts tries 1–10 (the feed contract allows up to 10) as whole numbers, and only with a step', () => {
    expect(parseUrlState('?step=notify_team&attempt=4').attempt).toBe(4);
    expect(parseUrlState('?step=notify_team&attempt=5').attempt).toBe(5);
    expect(parseUrlState('?step=notify_team&attempt=10').attempt).toBe(10);
    for (const bad of ['0', '11', '2.5', '-1', 'x', '', '02']) {
      expect(parseUrlState(`?step=notify_team&attempt=${bad}`).attempt).toBeNull();
    }
    expect(parseUrlState('?attempt=2')).toEqual(DEFAULT_URL_STATE);
  });

  it('reads the test-switch filter: on or off, anything else shows every run', () => {
    expect(parseUrlState('?flags=off').flags).toBe('off');
    expect(parseUrlState('?flags=on').flags).toBe('on');
    for (const bad of ['all', 'yes', '', 'ON']) expect(parseUrlState(`?flags=${bad}`).flags).toBeNull();
    expect(serializeUrlState({ ...DEFAULT_URL_STATE, flags: 'off' })).toBe('?flags=off');
  });

  it('changes the filter in place, like the window (no new history entry)', () => {
    expect(historyAction(DEFAULT_URL_STATE, { ...DEFAULT_URL_STATE, flags: 'on' })).toBe('replace');
  });

  it('ignores the old tour key (the guided story moved to /story in step 3.2)', () => {
    expect(parseUrlState('?mode=guided&tour=4')).toEqual({ ...DEFAULT_URL_STATE, mode: 'guided' });
  });

  it('ignores unknown keys and uses the first of repeated keys', () => {
    expect(parseUrlState('?utm_source=x&win=7d&win=24h')).toEqual(state({ win: '7d' }));
  });
});

describe('serializeUrlState', () => {
  it('leaves defaults out, so the default URL is bare', () => {
    expect(serializeUrlState(DEFAULT_URL_STATE)).toBe('');
  });

  it('writes keys in a fixed order', () => {
    expect(serializeUrlState(state({ run: 'r_6d15828d95f5', attempt: 2, step: 'notify_team', win: 'all', mode: 'guided' })))
      .toBe('?mode=guided&win=all&step=notify_team&attempt=2&run=r_6d15828d95f5');
    expect(serializeUrlState(state({ run: 'r_6d15828d95f5', order: 'oldest', event: 'failed', view: 'events' })))
      .toBe('?view=events&event=failed&order=oldest&run=r_6d15828d95f5');
  });

  it('drops an attempt without a step', () => {
    expect(serializeUrlState(state({ attempt: 2 }))).toBe('');
  });

  it('round-trips through parse, which normalizes junk', () => {
    const s = state({ mode: 'guided', win: '24h', step: 'purge_pii', attempt: 1, run: 'r_000000000abc' });
    expect(parseUrlState(serializeUrlState(s))).toEqual(s);
    expect(serializeUrlState(parseUrlState('?win=30d&mode=live&foo=1&step=X'))).toBe('');
  });
});

describe('historyAction', () => {
  it('pushes for view, mode and run (Back undoes them)', () => {
    expect(historyAction(DEFAULT_URL_STATE, state({ view: 'events' }))).toBe('push');
    expect(historyAction(DEFAULT_URL_STATE, state({ mode: 'guided' }))).toBe('push');
    expect(historyAction(DEFAULT_URL_STATE, state({ run: 'r_000000000abc' }))).toBe('push');
  });

  it('replaces for window, step, attempt, event filter and sort', () => {
    expect(historyAction(DEFAULT_URL_STATE, state({ win: '7d' }))).toBe('replace');
    expect(historyAction(DEFAULT_URL_STATE, state({ event: 'failed' }))).toBe('replace');
    expect(historyAction(DEFAULT_URL_STATE, state({ order: 'oldest' }))).toBe('replace');
    expect(historyAction(DEFAULT_URL_STATE, state({ step: 'notify_team', attempt: 1 }))).toBe('replace');
  });

  it('pushes when a push key changes together with a replace key', () => {
    expect(historyAction(DEFAULT_URL_STATE, state({ mode: 'guided', win: '7d' }))).toBe('push');
  });

  it('does nothing when nothing changed', () => {
    expect(historyAction(DEFAULT_URL_STATE, state({}))).toBe('none');
  });
});

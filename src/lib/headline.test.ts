import { describe, expect, it } from 'vitest';
import { makeRun, type RunSpec } from '../test/runs';
import { GUIDED_RUN } from './guided';
import { headline, type HeadlineContext } from './headline';
import { NORTHSTAR_WF as WF } from '../test/workflow';

const ctx: HeadlineContext = { win: '30d', source: 'live', partial: false, live: true };
let n = 0;
const run = (spec: Omit<RunSpec, 'id' | 'created'>) =>
  makeRun({ id: `r_${(n++).toString(16).padStart(12, '0')}`, created: '2026-10-24T06:00:00.000Z', ...spec });
const ok = () => run({});
const outage = () => run({ notify: { attempts: ['fail', 'fail', 'ok'] }, outage: true });

describe('headline: with the test-switch filter on', () => {
  const off = { ...ctx, filter: 'the outage switch off' };
  it('says which runs it is about', () => {
    expect(headline([ok(), ok()], off, WF).window).toBe('In the last 30 days (runs with the outage switch off), all 2 runs finished on the first try.');
  });
  it('an empty filtered window says what is missing', () => {
    expect(headline([], off, WF).window).toBe('No enquiries with the outage switch off in the last 30 days.');
    expect(headline([], { ...off, win: 'all' }, WF).window).toBe('No enquiries with the outage switch off recorded yet.');
  });
});

describe('headline: the window clause', () => {
  it('the live feed of 24 Oct (3 normal runs, 3 outage runs) → 3 team notifications recovered', () => {
    expect(headline([ok(), ok(), ok(), outage(), outage(), outage()], ctx, WF)).toEqual({
      window: 'In the last 30 days, 3 team notifications recovered after retries, and no job gave up.',
      now: null,
    });
  });

  it('a step that gave up comes first, and is about the window, not now', () => {
    const dead = run({ notify: { attempts: ['fail_dead'] } });
    expect(headline([outage(), dead], ctx, WF).window).toBe('In the last 30 days, 1 team notification gave up.');
  });

  it('mixed jobs are called jobs', () => {
    const a = run({ notify: { attempts: ['fail_dead'] } });
    const b = run({ confirm: { attempts: ['fail_dead'] } });
    expect(headline([a, b], { ...ctx, win: '7d' }, WF).window).toBe('In the last 7 days, 2 jobs gave up.');
  });

  it('all on the first try, with singular and plural', () => {
    expect(headline([ok(), ok()], { ...ctx, win: '24h' }, WF).window).toBe('In the last 24 hours, all 2 runs finished on the first try.');
    expect(headline([ok()], { ...ctx, win: 'all' }, WF).window).toBe('In all recorded runs, the one run finished on the first try.');
  });

  it('runs still going: says what finished, never claims more', () => {
    const going = run({ notify: { attempts: ['running'] } });
    expect(headline([ok(), going], ctx, WF).window).toBe('In the last 30 days, 2 enquiries came in, and every finished job succeeded on its first try.');
    const none = run({ notify: { attempts: ['running'] }, confirm: { attempts: ['running'] } });
    expect(headline([none], ctx, WF).window).toBe('In the last 30 days, 1 enquiry came in, and no job has finished yet.');
  });

  it('empty and partial windows', () => {
    expect(headline([], ctx, WF).window).toBe('No enquiries in the last 30 days.');
    expect(headline([], { ...ctx, win: 'all' }, WF).window).toBe('No enquiries recorded yet.');
    expect(headline([ok()], { ...ctx, partial: true }, WF)).toEqual({ window: 'Showing only the newest 500 runs: this window has more.', now: null });
  });

  it('the guided recording speaks about itself', () => {
    expect(headline([GUIDED_RUN], { ...ctx, source: 'recording' }, WF)).toEqual({
      window: 'In this recorded run, 1 team notification recovered after retries, and no job gave up.',
      now: null,
    });
  });
});

describe('headline: the "Right now" clause', () => {
  const retrying = () => run({ notify: { attempts: ['fail'] } });
  const going = () => run({ notify: { attempts: ['running'] } });

  it('names retries waiting now', () => {
    expect(headline([ok(), retrying()], ctx, WF).now).toBe('Right now: 1 team notification is waiting to retry.');
  });

  it('otherwise names runs in progress', () => {
    expect(headline([going(), going()], ctx, WF).now).toBe('Right now: 2 runs are in progress.');
  });

  it('is left out when the data is not live, or when nothing is running', () => {
    expect(headline([retrying()], { ...ctx, live: false }, WF).now).toBeNull();
    expect(headline([retrying()], { ...ctx, source: 'recording' }, WF).now).toBeNull();
    expect(headline([ok()], ctx, WF).now).toBeNull();
  });
});

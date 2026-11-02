import { describe, expect, it } from 'vitest';
import { SHOP_WF, shopRun } from '../test/otherWorkflow';
import { makeRun } from '../test/runs';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import { applyFlagFilter, filterScope, flagControl, flagPhrase } from './flagFilter';
import type { Workflow } from './types';

const created = '2026-10-24T06:00:00.000Z';
const on = makeRun({ id: 'r_00000000000a', created, outage: true, notify: { attempts: ['fail', 'fail', 'ok'] } });
const off = makeRun({ id: 'r_00000000000b', created });
const NONE: Workflow = { ...WF, flags: [] };
const TWO: Workflow = { ...WF, flags: [...WF.flags, { key: 'slow_mail', label: 'Slow mail', effect: 'delays the email by a minute' }] };

describe('the filter control', () => {
  it('takes its label from the one flag the feed describes', () => {
    expect(flagControl(WF)).toEqual({ label: 'Outage switch', on: 'On', off: 'Off' });
    expect(flagControl(SHOP_WF)).toEqual({ label: 'Test card', on: 'On', off: 'Off' });
  });

  it('is generic with two or more flags, and absent with none', () => {
    expect(flagControl(TWO)).toEqual({ label: 'Test switches', on: 'Any on', off: 'None on' });
    expect(flagControl(NONE)).toBeNull();
  });
});

describe('applying it', () => {
  it('keeps every run without a filter', () => {
    expect(applyFlagFilter([on, off], null)).toEqual([on, off]);
  });

  it('on: runs with a switch on; off: runs with none', () => {
    expect(applyFlagFilter([on, off], 'on').map((r) => r.run_id)).toEqual(['r_00000000000a']);
    expect(applyFlagFilter([on, off], 'off').map((r) => r.run_id)).toEqual(['r_00000000000b']);
  });

  it('works on another workflow\'s flags too (the shop\'s test card)', () => {
    const declined = shopRun('r_00000000000c', created, 1, false);
    const clean = shopRun('r_00000000000d', created, 0, false);
    expect(applyFlagFilter([declined, clean], 'on').map((r) => r.flags)).toEqual([['test_card']]);
    expect(flagPhrase(SHOP_WF, 'on')).toBe('the test card on');
  });

  it('returns the same array when nothing is filtered, so memoised pages stay stable', () => {
    const runs = [on, off];
    expect(applyFlagFilter(runs, null)).toBe(runs);
  });
});

describe('the words', () => {
  it('names the switch the way sentences need it', () => {
    expect(flagPhrase(WF, 'off')).toBe('the outage switch off');
    expect(flagPhrase(WF, 'on')).toBe('the outage switch on');
    expect(flagPhrase(TWO, 'on')).toBe('a test switch on');
    expect(flagPhrase(TWO, 'off')).toBe('no test switch on');
    expect(flagPhrase(WF, null)).toBeNull();
    expect(flagPhrase(NONE, 'on')).toBeNull();
  });

  it('says what the filter covers and what still shows every run', () => {
    expect(filterScope(WF, 'off')).toBe(
      'Filtering the map, numbers, activity, events and retries to runs with the outage switch off. The status line and the watch panel still show every run.',
    );
    expect(filterScope(WF, null)).toBeNull();
  });
});

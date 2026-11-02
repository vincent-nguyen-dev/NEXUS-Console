import { describe, expect, it } from 'vitest';
import { makeRun } from '../test/runs';
import { NORTHSTAR_WF as WF } from '../test/workflow';
import {
  delayText, errorOf, flagsOf, immediateSteps, isScheduled, measuredSteps, numberWord, plannedWaitS, pluralLabel, primaryStep,
  resultOf, scheduledSteps, simulatedOutageOf, simulatedSteps, stepLabel, stepSpec,
} from './workflow';

describe("roles, from Northstar's description (they give today's numbers)", () => {
  it('splits the jobs by what they do, not by name', () => {
    expect(immediateSteps(WF)).toEqual(['notify_team', 'confirm_visitor']); // completion time, as DELIVERY_KINDS did
    expect(scheduledSteps(WF)).toEqual(['purge_pii']); // 604,800 s = 7 × 86,400
    expect(measuredSteps(WF)).toEqual(['notify_team']); // the KPIs' rates, as kpis.ts used ['notify_team']
    expect(simulatedSteps(WF)).toEqual(['confirm_visitor']);
    expect(primaryStep(WF)).toBe('notify_team');
    expect(isScheduled(WF, 'purge_pii')).toBe(true);
    expect(stepLabel(WF, 'confirm_visitor')).toBe('Visitor confirmation');
  });

  it('refuses an undescribed job loudly (the parser never lets one through)', () => {
    expect(() => stepSpec(WF, 'nope')).toThrow(/no description/);
  });
});

describe('what codes mean', () => {
  it('reads result meanings from the description, and keeps an unknown code as itself', () => {
    expect(resultOf(WF, 'notify_team', 'sent')).toEqual({ outcome: 'delivered', label: 'email sent' });
    expect(resultOf(WF, 'notify_team', 'mock')).toEqual({ outcome: 'simulated', label: 'simulated, no email provider' });
    expect(resultOf(WF, 'confirm_visitor', 'mock')).toEqual({ outcome: 'simulated', label: 'simulated, never sent' });
    expect(resultOf(WF, 'purge_pii', 'purged')).toEqual({ outcome: 'done', label: 'deleted' });
    expect(resultOf(WF, 'notify_team', 'bounced')).toEqual({ outcome: 'unknown', label: 'bounced' });
    // A code is only known for the job that describes it.
    expect(resultOf(WF, 'purge_pii', 'sent').outcome).toBe('unknown');
  });

  it('only the outage switch "sends nothing"; an unknown error makes no such claim', () => {
    expect(errorOf(WF, 'simulated_outage')).toEqual({ label: 'simulated outage', sendsNothing: true });
    expect(errorOf(WF, 'internal_error')).toEqual({ label: 'internal error', sendsNothing: false });
    expect(errorOf(WF, 'smtp_timeout')).toEqual({ label: 'smtp timeout', sendsNothing: false });
    expect(errorOf(WF, null)).toEqual({ label: 'no error code', sendsNothing: false });
  });

  it('names the outside service only for a nothing-sent error on a run with a test switch on', () => {
    const outage = makeRun({ id: 'r_000000000001', created: '2026-10-24T06:00:00Z', outage: true });
    const plain = makeRun({ id: 'r_000000000002', created: '2026-10-24T06:00:00Z' });
    expect(simulatedOutageOf(WF, outage, 'notify_team', 'simulated_outage')).toBe('email service');
    expect(simulatedOutageOf(WF, plain, 'notify_team', 'simulated_outage')).toBeNull();
    expect(simulatedOutageOf(WF, outage, 'notify_team', 'internal_error')).toBeNull();
    expect(simulatedOutageOf(WF, outage, 'purge_pii', 'simulated_outage')).toBeNull(); // delivers nothing
  });

  it('lists the described flags with whether each was on', () => {
    const run = makeRun({ id: 'r_000000000003', created: '2026-10-24T06:00:00Z', outage: true });
    expect(flagsOf(WF, run)).toEqual([{ flag: WF.flags[0], on: true }]);
  });
});

describe('policy and words', () => {
  it('plans the waits from the description: 10 s, 30 s, 120 s, then no retry after try 4', () => {
    expect([1, 2, 3, 4].map((t) => plannedWaitS(WF, 'notify_team', t))).toEqual([10, 30, 120, null]);
    expect(plannedWaitS(WF, 'notify_team', 0)).toBeNull();
  });

  it('writes delays in whole units', () => {
    expect(delayText(604_800)).toBe('7 days');
    expect(delayText(86_400)).toBe('1 day');
    expect(delayText(3_600)).toBe('1 hour');
    expect(delayText(5_400)).toBe('90 minutes');
    expect(delayText(90)).toBe('90 seconds');
  });

  it('counts and plurals', () => {
    expect([1, 3, 8, 11].map(numberWord)).toEqual(['one', 'three', 'eight', '11']);
    expect(pluralLabel('team notification')).toBe('team notifications');
    expect(pluralLabel('status')).toBe('status');
  });
});

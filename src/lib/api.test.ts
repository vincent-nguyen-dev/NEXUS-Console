import { describe, expect, it } from 'vitest';
import aiFixture from '../fixtures/ai-page.json';
import fixture from '../fixtures/guided-run.json';
import { must } from '../test/runs';
import { ApiError, aiUrl, fetchAi, fetchRuns, parseAiPage, parseRunsPage, runsUrl } from './api';
import { NORTHSTAR_WF as WF } from '../test/workflow';

const BASE = 'https://northstar-digital-api.onrender.com';

const okJson = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200 });

describe('urls', () => {
  it('encodes `since`, including the + of a timezone offset', () => {
    expect(runsUrl('2026-10-22T03:00:00+00:00', 500)).toBe(
      `${BASE}/api/ops/runs?limit=500&since=2026-10-22T03%3A00%3A00%2B00%3A00`,
    );
    expect(runsUrl(null, 200)).toBe(`${BASE}/api/ops/runs?limit=200`);
    expect(aiUrl('2026-10-22T03:00:00.000Z', 2000)).toBe(
      `${BASE}/api/ops/ai?limit=2000&since=2026-10-22T03%3A00%3A00.000Z`,
    );
  });

  it('rejects limits the server would refuse', () => {
    expect(() => runsUrl(null, 501)).toThrow();
    expect(() => runsUrl(null, 0)).toThrow();
    expect(() => aiUrl(null, 2001)).toThrow();
  });
});

describe('parseRunsPage', () => {
  it('accepts the recorded feed page', () => {
    const page = parseRunsPage(fixture.page);
    expect(page.runs[0]?.run_id).toBe('r_6d15828d95f5');
    expect(page.truncated).toBe(false);
  });

  it('names the path of the first bad field', () => {
    const bad = structuredClone(fixture.page) as { runs: { steps: { status: string }[] }[] };
    must(must(bad.runs[0]).steps[1]).status = 'exploded';
    expect(() => parseRunsPage(bad)).toThrow(/runs\[0\]\.steps\[1\]\.status/);
  });

  it('rejects a run id that is not opaque, and unknown event types', () => {
    const ref = structuredClone(fixture.page) as { runs: { run_id: string }[] };
    must(ref.runs[0]).run_id = 'NS-TEST01'; // a reference's shape, made up
    expect(() => parseRunsPage(ref)).toThrow(/run_id/);
    const ev = structuredClone(fixture.page) as { runs: { events: { event: string }[] }[] };
    must(must(ev.runs[0]).events[0]).event = 'teleported';
    expect(() => parseRunsPage(ev)).toThrow(/events\[0\]\.event/);
  });

  it('rejects non-objects and missing fields', () => {
    expect(() => parseRunsPage(null)).toThrow();
    expect(() => parseRunsPage({ now: '2026-10-22T03:00:00Z', runs: [] })).toThrow(/workflow/);
    expect(() => parseRunsPage({ now: '2026-10-22T03:00:00Z', workflow: WF, runs: [] })).toThrow(/truncated/);
  });
});

describe('the workflow description', () => {
  type Page = { workflow: Record<string, unknown> & { steps: Record<string, unknown>[] }; runs: Record<string, unknown>[] };
  const page = (): Page => structuredClone(fixture.page) as unknown as Page;

  it("parses Northstar's description and keeps every field", () => {
    expect(parseRunsPage(fixture.page).workflow).toEqual(WF);
    expect(WF.steps.map((s) => [s.kind, s.starts_after_s, s.max_attempts, s.backoff_s])).toEqual([
      ['notify_team', 0, 4, [10, 30, 120]], ['confirm_visitor', 0, 4, [10, 30, 120]], ['purge_pii', 604_800, 4, [10, 30, 120]],
    ]);
  });

  it('refuses a version it does not read, saying which', () => {
    const p = page();
    p.workflow.version = 2;
    expect(() => parseRunsPage(p)).toThrow('this feed describes workflow version 2; NEXUS reads version 1');
  });

  it('refuses a run with a job or a flag the description does not list', () => {
    const job = page();
    job.workflow.steps = job.workflow.steps.filter((s) => s.kind !== 'purge_pii');
    expect(() => parseRunsPage(job)).toThrow(/runs\[0\]\.steps\[2\]\.kind: expected a described job/);
    const flag = page();
    flag.workflow.flags = [];
    expect(() => parseRunsPage(flag)).toThrow(/runs\[0\]\.flags\[0\]: expected a described flag/);
  });

  it('refuses a malformed description: duplicate jobs, bad ids, long labels, unknown outcomes', () => {
    const dup = page();
    dup.workflow.steps = [...dup.workflow.steps, dup.workflow.steps[0] ?? {}];
    expect(() => parseRunsPage(dup)).toThrow(/each job described once/);
    const id = page();
    must(id.workflow.steps[0]).kind = 'Notify Team';
    expect(() => parseRunsPage(id)).toThrow(/steps\[0\]\.kind/);
    const long = page();
    must(long.workflow.steps[0]).label = 'x'.repeat(41);
    expect(() => parseRunsPage(long)).toThrow(/steps\[0\]\.label: expected text of 1–40/);
    const outcome = page();
    must(outcome.workflow.steps[0]).results = [{ code: 'sent', outcome: 'teleported', label: 'x' }];
    expect(() => parseRunsPage(outcome)).toThrow(/results\[0\]\.outcome/);
  });

  it('allows a result code the description does not list (systems grow new ones)', () => {
    const p = page();
    must(p.workflow.steps[0]).results = [];
    expect(parseRunsPage(p).runs[0]?.steps[0]?.result).toBe('sent');
  });
});

describe('parseAiPage', () => {
  const live = () => structuredClone(aiFixture.page) as { now: string; truncated: boolean; ai: Record<string, unknown>; calls: Record<string, unknown>[] };
  const call = { at: '2026-10-23T05:34:42.232376+00:00', model: 'gpt-4o-mini', tokens_in: 1203, tokens_out: 52, latency_ms: 2505, outcome: 'ok' };

  it('accepts the live shape, with its description', () => {
    const p = parseAiPage(live());
    expect(p.calls).toHaveLength(25);
    expect(p.ai.call).toEqual({ one: 'chat', many: 'chats' });
    expect(p.ai.outcomes.filter((o) => o.answered).map((o) => o.code)).toEqual(['ok']);
  });

  it('accepts a failed call without tokens (Northstar records them as null)', () => {
    const p = live();
    p.calls = [{ ...call, outcome: 'timeout', tokens_in: null, tokens_out: null, latency_ms: 30001 }];
    expect(parseAiPage(p).calls[0]).toMatchObject({ tokens_in: null, tokens_out: null });
  });

  it('refuses an outcome the description doesn\'t name, and negative counts', () => {
    const p = live();
    p.calls = [{ ...call, outcome: 'meh' }];
    expect(() => parseAiPage(p)).toThrow('unexpected feed data at calls[0].outcome: expected ok | provider_error | timeout');
    p.calls = [{ ...call, tokens_in: -1 }];
    expect(() => parseAiPage(p)).toThrow(/calls\[0\]\.tokens_in/);
  });

  it('refuses a page without a description, another version, or no outcome that answered', () => {
    const p = live();
    Reflect.deleteProperty(p, 'ai');
    expect(() => parseAiPage(p)).toThrow('unexpected feed data at ai: expected an object');
    expect(() => parseAiPage({ ...live(), ai: { ...live().ai, version: 2 } })).toThrow('this feed describes AI version 2; NEXUS reads version 1');
    const none = live();
    none.ai.outcomes = (none.ai.outcomes as { answered: boolean }[]).map((o) => ({ ...o, answered: false }));
    expect(() => parseAiPage(none)).toThrow('unexpected feed data at ai.outcomes: expected at least one outcome that answered');
  });
});

describe('fetchRuns / fetchAi', () => {
  it('sends nothing from an origin that can\'t read the feed (a preview, 7.2a)', async () => {
    let calls = 0;
    const spy = async () => {
      calls++;
      return new Response('{}');
    };
    await expect(fetchRuns({ since: null, fetchFn: spy, reachable: false })).rejects.toMatchObject({ kind: 'refused' });
    await expect(fetchAi({ since: null, fetchFn: spy, reachable: false })).rejects.toMatchObject({ kind: 'refused' });
    expect(calls).toBe(0);
  });

  it('returns a parsed page', async () => {
    const page = await fetchRuns({ since: null, fetchFn: okJson(fixture.page) });
    expect(page.runs).toHaveLength(1);
    const ai = await fetchAi({ since: null, fetchFn: okJson({ ...aiFixture.page, calls: [] }) });
    expect(ai.calls).toEqual([]);
  });

  it('turns 429 and 503 into typed errors with Retry-After', async () => {
    const limited = async () => new Response('{}', { status: 429, headers: { 'Retry-After': '12' } });
    await expect(fetchRuns({ since: null, fetchFn: limited })).rejects.toMatchObject({ kind: 'rate_limited', retryAfterS: 12 });
    const down = async () => new Response('{}', { status: 503 });
    await expect(fetchRuns({ since: null, fetchFn: down })).rejects.toMatchObject({ kind: 'unavailable', retryAfterS: null });
  });

  it('reports other statuses, network failures and bad shapes distinctly', async () => {
    const teapot = async () => new Response('{}', { status: 418 });
    await expect(fetchRuns({ since: null, fetchFn: teapot })).rejects.toMatchObject({ kind: 'http', status: 418 });
    const offline = async () => { throw new TypeError('Failed to fetch'); };
    await expect(fetchRuns({ since: null, fetchFn: offline })).rejects.toMatchObject({ kind: 'network' });
    await expect(fetchRuns({ since: null, fetchFn: okJson({ hello: 1 }) })).rejects.toMatchObject({ kind: 'shape' });
    await expect(fetchRuns({ since: null, fetchFn: okJson({}) })).rejects.toBeInstanceOf(ApiError);
  });

  it('lets an abort pass through untouched', async () => {
    const aborted = async () => { throw new DOMException('aborted', 'AbortError'); };
    await expect(fetchRuns({ since: null, fetchFn: aborted })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

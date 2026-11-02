// The /connect page's contract, checked against the parser in both directions: every field the page
// documents is required by the parser (removing it gives the parser's exact message for that field), every
// field in the real recording is documented, and the limits it quotes are the parser's own.
import { describe, expect, it } from 'vitest';
import aiFixture from '../fixtures/ai-page.json';
import fixture from '../fixtures/guided-run.json';
import {
  AI_MAX_LIMIT, AI_VERSION, LABEL_MAX, MAX_MODELS, MAX_OUTCOMES, MAX_STEPS, MAX_TRIES, MODEL_MAX, PURPOSE_MAX, RUNS_MAX_LIMIT,
  WORKFLOW_VERSION, parseAiPage, parseRunsPage,
} from './api';
import {
  AI_FIELD_GROUPS, AI_LIMITS, FIELD_GROUPS, LIMITS, aiDocumentedPaths, documentedOnly, documentedPaths, firstTryTrace, formatJson,
} from './contract';
import { GUIDED_RUN, GUIDED_WF } from './guided';
import { FETCH_TIMEOUT_MS, POLL_MS } from './pollPolicy';

type Obj = Record<string, unknown>;
const clone = (): Obj => structuredClone(fixture.page) as unknown as Obj;

/** The object at a path like "runs[0].events[0]" ("" is the page). */
function at(root: Obj, path: string): Obj {
  if (path === '') return root;
  return path.split('.').reduce<Obj>((o, part) => {
    const m = /^(\w+)\[(\d+)\]$/.exec(part);
    const next = m ? (o[m[1] ?? ''] as unknown[])[Number(m[2])] : o[part];
    return next as Obj;
  }, root);
}

/** The parser's message for a page, or null when it parses. */
function refusal(page: Obj): string | null {
  try {
    parseRunsPage(page);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/** Fields Northstar still sends for older NEXUS builds; NEXUS ignores them, so the page doesn't document them. */
const LEGACY = new Set(['runs[].simulate_outage', 'runs[].pii_deleted']);

function keyPaths(v: unknown, path = '', out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keyPaths(x, `${path}[]`, out));
  else if (v !== null && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      const p = path === '' ? k : `${path}.${k}`;
      out.add(p);
      keyPaths(x, p, out);
    }
  }
  return out;
}

describe('every documented field is one the parser requires', () => {
  const cases = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => [`${g.at || 'page'}.${f.key}`, g.at, f.key, f.errorPath] as const));

  it.each(cases)('without %s, the parser names it', (_, groupAt, key, errorPath) => {
    const page = clone();
    Reflect.deleteProperty(at(page, groupAt), key);
    const message = refusal(page);
    if (key === 'version') expect(message).toBe(`this feed describes workflow version undefined; NEXUS reads version ${WORKFLOW_VERSION}`);
    else expect(message).toMatch(new RegExp(`^unexpected feed data at ${errorPath.replace(/[[\].]/g, '\\$&')}: expected `));
  });
});

describe('the documentation and the recording agree', () => {
  it('documents every field the recording carries (apart from two legacy ones NEXUS ignores)', () => {
    const undocumented = [...keyPaths(fixture.page)].filter((p) => !documentedPaths().has(p) && !LEGACY.has(p));
    expect(undocumented).toEqual([]);
  });

  it('documents nothing the recording lacks', () => {
    const present = keyPaths(fixture.page);
    expect([...documentedPaths()].filter((p) => !present.has(p))).toEqual([]);
  });

  it('shows an example that parses, with only documented fields', () => {
    const example = documentedOnly(fixture.page as never);
    expect(parseRunsPage(example).runs[0]?.run_id).toBe('r_6d15828d95f5');
    expect([...keyPaths(example)].filter((p) => LEGACY.has(p))).toEqual([]);
    expect(JSON.parse(formatJson(example))).toEqual(example);
  });

  it('quotes the parser\'s own limits', () => {
    expect(LIMITS).toEqual({
      runs: RUNS_MAX_LIMIT, jobs: MAX_STEPS, tries: MAX_TRIES, label: LABEL_MAX, purpose: PURPOSE_MAX,
      version: WORKFLOW_VERSION, pollS: POLL_MS / 1000, waitS: FETCH_TIMEOUT_MS / 1000,
    });
    expect(LIMITS).toMatchObject({ runs: 500, jobs: 8, tries: 10, label: 40, purpose: 140, version: 1, pollS: 30, waitS: 90 });
  });
});

describe('the limits hold at the edge and fail one past it, with the message the page describes', () => {
  type Job = Obj & { kind: string; label: string; purpose: string; max_attempts: number };
  const jobs = (p: Obj) => (p.workflow as Obj).steps as Job[];
  const first = (p: Obj) => jobs(p)[0] as Job;

  it(`${MAX_STEPS} jobs pass, ${MAX_STEPS + 1} are refused`, () => {
    const p = clone();
    const extra = (n: number) => Array.from({ length: n }, (_, i) => ({ ...first(p), kind: `extra_${i}` }));
    (p.workflow as Obj).steps = [...jobs(p), ...extra(MAX_STEPS - jobs(p).length)];
    expect(refusal(p)).toBeNull();
    (p.workflow as Obj).steps = [...jobs(p), ...extra(1).map((j) => ({ ...j, kind: 'one_too_many' }))];
    expect(refusal(p)).toBe(`unexpected feed data at workflow.steps: expected 1–${MAX_STEPS} jobs`);
  });

  it(`labels of ${LABEL_MAX} pass, ${LABEL_MAX + 1} and empty are refused`, () => {
    const p = clone();
    first(p).label = 'x'.repeat(LABEL_MAX);
    expect(refusal(p)).toBeNull();
    first(p).label = 'x'.repeat(LABEL_MAX + 1);
    expect(refusal(p)).toBe(`unexpected feed data at workflow.steps[0].label: expected text of 1–${LABEL_MAX} characters`);
    first(p).label = '  ';
    expect(refusal(p)).toBe(`unexpected feed data at workflow.steps[0].label: expected text of 1–${LABEL_MAX} characters`);
  });

  it(`purposes of ${PURPOSE_MAX} pass, ${PURPOSE_MAX + 1} are refused`, () => {
    const p = clone();
    first(p).purpose = 'x'.repeat(PURPOSE_MAX);
    expect(refusal(p)).toBeNull();
    first(p).purpose = 'x'.repeat(PURPOSE_MAX + 1);
    expect(refusal(p)).toBe(`unexpected feed data at workflow.steps[0].purpose: expected text of 1–${PURPOSE_MAX} characters`);
  });

  it(`1 and ${MAX_TRIES} tries pass; 0 and ${MAX_TRIES + 1} refuse the whole answer`, () => {
    for (const ok of [1, MAX_TRIES]) {
      const p = clone();
      first(p).max_attempts = ok;
      expect(refusal(p)).toBeNull();
    }
    for (const bad of [0, MAX_TRIES + 1]) {
      const p = clone();
      first(p).max_attempts = bad;
      expect(refusal(p)).toBe(`unexpected feed data at workflow.steps[0].max_attempts: expected a whole number 1–${MAX_TRIES}`);
    }
  });

  it(`version ${WORKFLOW_VERSION} passes, 2 is refused by name`, () => {
    const p = clone();
    (p.workflow as Obj).version = 2;
    expect(refusal(p)).toBe('this feed describes workflow version 2; NEXUS reads version 1');
  });
});

describe('one try, traced', () => {
  it("follows the recording's first try from its events to the sentence NEXUS shows", () => {
    const t = firstTryTrace(GUIDED_RUN, GUIDED_WF);
    expect(t.events.map((e) => [e.event, e.attempt, e.detail])).toEqual([
      ['started', 1, null], ['failed', 1, 'simulated_outage'], ['retry_scheduled', 1, '10'],
    ]);
    expect(t.sentence).toBe('Try 1 failed: the email service is down (simulated), so nothing was sent. Northstar plans a retry in 10 s.');
  });
});

describe('the optional AI feed: documented, required, and matching the frozen answer', () => {
  const aiClone = (): Obj => structuredClone(aiFixture.page) as unknown as Obj;
  function aiRefusal(page: Obj): string | null {
    try {
      parseAiPage(page);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }
  const cases = AI_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => [`${g.at || 'page'}.${f.key}`, g.at, f.key, f.errorPath] as const));

  it.each(cases)('without %s, the parser names it', (_, groupAt, key, errorPath) => {
    const page = aiClone();
    Reflect.deleteProperty(at(page, groupAt), key);
    const message = aiRefusal(page);
    if (key === 'version') expect(message).toBe(`this feed describes AI version undefined; NEXUS reads version ${AI_VERSION}`);
    else expect(message).toMatch(new RegExp(`^unexpected feed data at ${errorPath.replace(/[[\].]/g, '\\$&')}: expected `));
  });

  it('documents every field the frozen answer carries, and nothing it lacks', () => {
    const present = keyPaths(aiFixture.page);
    expect([...present].filter((p) => !aiDocumentedPaths().has(p))).toEqual([]);
    expect([...aiDocumentedPaths()].filter((p) => !present.has(p))).toEqual([]);
  });

  it('quotes the parser\'s own limits', () => {
    expect(AI_LIMITS).toEqual({ calls: AI_MAX_LIMIT, outcomes: MAX_OUTCOMES, models: MAX_MODELS, model: MODEL_MAX, label: LABEL_MAX, version: AI_VERSION });
    expect(AI_LIMITS).toMatchObject({ calls: 2000, outcomes: 8, models: 20, model: 80, label: 40, version: 1 });
  });

  it(`${MAX_OUTCOMES} outcomes and ${MAX_MODELS} models pass; one more of each is refused`, () => {
    const p = aiClone();
    const d = p.ai as Obj;
    const first = (d.outcomes as Obj[])[0] as Obj;
    d.outcomes = [first, ...Array.from({ length: MAX_OUTCOMES - 1 }, (_, i) => ({ code: `x_${i}`, label: 'other', answered: false }))];
    d.models = Array.from({ length: MAX_MODELS }, (_, i) => ({ name: `m${i}`, usd_per_m_in: 0, usd_per_m_out: 0, priced_on: null, source: 'test' }));
    (p.calls as Obj[]).forEach((c) => { c.outcome = first.code; });
    expect(aiRefusal(p)).toBeNull();
    d.outcomes = [...(d.outcomes as Obj[]), { code: 'one_more', label: 'other', answered: false }];
    expect(aiRefusal(p)).toBe(`unexpected feed data at ai.outcomes: expected 1–${MAX_OUTCOMES} outcomes`);
    d.outcomes = (d.outcomes as Obj[]).slice(0, MAX_OUTCOMES);
    d.models = [...(d.models as Obj[]), { name: 'one_more', usd_per_m_in: 0, usd_per_m_out: 0, priced_on: null, source: 'test' }];
    expect(aiRefusal(p)).toBe(`unexpected feed data at ai.models: expected at most ${MAX_MODELS} models`);
  });
});

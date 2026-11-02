import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/ai-page.json';
import { callsInWindow } from './aiMetrics';
import { aiView } from './aiText';
import { parseAiPage } from './api';
import { parseInstant } from './time';
import type { AiCall } from './types';

const PAGE = parseAiPage(fixture.page);
const NOW = parseInstant(PAGE.now);
const view = (win: '24h' | '7d' | '30d' | 'all', calls: AiCall[] = callsInWindow(PAGE.calls, win, NOW), partial = false) =>
  aiView(calls, PAGE.ai, { win, asOf: PAGE.now, partial });

describe('the AI usage view on the frozen feed of 31 Oct', () => {
  const v = view('30d');

  it('opens with what happened, in the feed\'s own noun', () => {
    expect(v.headline).toBe('In the last 30 days, the model answered all 25 chats.');
    expect(v.sourceLine).toBe("Northstar's ops feed, AI rows · a row is one question the model was asked to answer · kept 90 days");
    expect(v.windowNote).toBeNull();
  });

  it('counts the chats, with the peak called out', () => {
    expect([v.chats.label, v.chats.value, v.chats.note]).toEqual(['Chats', '25', 'n = 25 · the last 30 days']);
    expect(v.chats.peakText).toBe('16 on 24 Oct');
    expect(v.chats.how.working).toBe('25 = 25 answered + 0 not answered');
  });

  it('gives both response times with their positions, and says the sample is small', () => {
    expect(v.times.value).toBe('2.1 s median · 4.2 s 95th percentile');
    expect(v.times.note).toBe('over 25 answered chats · a small sample: the slowest one or two set the 95th');
    expect(v.times.how.working).toBe('n = 25 → median at position 13 → 2.1 s; 95th at position 24 → 4.2 s');
    expect(v.times.answeredMs).toHaveLength(25);
  });

  it('shows the tokens and the estimate with its arithmetic and its source', () => {
    expect(v.tokens.value).toBe('39,463 tokens');
    expect(v.tokens.note).toBe('37,335 in · 2,128 out · about 1,493 in and 85 out per chat');
    expect([v.tokens.costValue, v.tokens.costNote]).toEqual(['$0.0069', 'at most: assumes no cached tokens']);
    expect(v.tokens.formula).toEqual([
      '37,335 in × $0.15 per 1M + 2,128 out × $0.60 per 1M = $0.0056 + $0.0013 = $0.0069',
      'Prices from the feed: gpt-4o-mini, priced 31 Oct 2026 (https://developers.openai.com/api/docs/models/gpt-4o-mini).',
    ]);
  });

  it('lists every described outcome and the error rate', () => {
    expect([v.outcomes.value, v.outcomes.note]).toEqual(['0 errors', 'error rate 0% · 0 of 25 chats']);
    expect(v.outcomes.rows.map((r) => [r.label, r.n])).toEqual([['answered', 25], ['AI service error', 0], ['timed out', 0]]);
    expect(v.outcomes.how.working).toBe('0 ÷ 25 = 0%');
  });
});

describe('thin, cut-off and unusual windows', () => {
  it('7 days: a median, but no 95th percentile yet', () => {
    const v = view('7d');
    expect(v.times.value).toBe('3.0 s median'); // 2,975 ms
    expect(v.times.note).toBe('over 8 answered chats · a 95th percentile needs 20 (8 so far)');
  });

  it('24 hours: one chat, no median, no rate', () => {
    const v = view('24h');
    expect(v.headline).toBe('In the last 24 hours, the model answered the one chat.');
    expect([v.times.value, v.times.hasValue]).toEqual(['No median yet', false]);
    expect(v.times.how.working).toBe('1 of the 5 answered chats a median needs.');
    expect(v.outcomes.note).toBe('a rate needs 5 chats (demo threshold)');
  });

  it('All says how far back the rows go', () => {
    expect(view('all').windowNote).toBe('All goes back 90 days: Northstar keeps no older chats.');
    expect(view('all').headline).toBe('In the last 90 days, the model answered all 25 chats.');
  });

  it('an empty window says so', () => {
    expect(view('24h', []).headline).toBe('No chats in the last 24 hours.');
  });

  it('a cut-off window keeps counts as lower bounds and withholds the rest', () => {
    const v = view('30d', undefined, true);
    expect(v.headline).toBe('In the last 30 days, the model answered all 25+ chats.');
    expect(v.windowNote).toMatch(/^Northstar returned only the newest 2,000 chats, and this window has more\./);
    expect([v.times.value, v.tokens.costValue, v.tokens.formula]).toEqual(['Withheld', null, []]);
  });

  it('names failures and an unpriced model', () => {
    const base = PAGE.calls.slice(0, 5);
    const calls: AiCall[] = [...base, { ...base[0] as AiCall, outcome: 'timeout', tokens_in: null, tokens_out: null }, { ...base[0] as AiCall, model: 'other-model' }];
    const v = view('30d', calls);
    expect(v.headline).toBe('In the last 30 days, the model answered 6 of 7 chats; 1 failed.');
    expect(v.outcomes.value).toBe('1 error');
    expect(v.tokens.formula.at(-1)).toBe('No price in the feed for 1 chat (model other-model): counted in chats and tokens, left out of the estimate.');
  });
});

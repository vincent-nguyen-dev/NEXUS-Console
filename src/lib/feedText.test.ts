import { describe, expect, it } from 'vitest';
import raw from '../fixtures/guided-run.json';
import { feedFileText, feedLines, lineText, linesShown, TYPE_MS } from './feedText';
import { readFeedFile } from './fileFeed';
import { GUIDED_RUN } from './guided';

describe('feedLines', () => {
  const lines = feedLines(GUIDED_RUN);

  it('is the recorded run as valid JSON: its id, its creation time and all 13 events, one per line', () => {
    expect(lines).toHaveLength(13 + 2);
    const parsed = JSON.parse(lines.map(lineText).join('\n')) as unknown;
    expect(parsed).toEqual({ run_id: GUIDED_RUN.run_id, created_at: GUIDED_RUN.created_at, events: GUIDED_RUN.events });
  });

  it('colours the events: failures and retry plans amber, successes green, the rest plain', () => {
    const kinds = lines.slice(1, -1).map((l) => l.find((t) => t.text.startsWith('"') && ['failed', 'ok', 'text'].includes(t.kind) && l.indexOf(t) > 6)?.kind);
    // queued ×3, started, failed, retry_scheduled, started, succeeded (visitor), started, failed, retry_scheduled, started, succeeded
    expect(kinds).toEqual(['text', 'text', 'text', 'text', 'failed', 'failed', 'text', 'ok', 'text', 'failed', 'failed', 'text', 'ok']);
    expect(lines.flat().filter((t) => t.kind === 'time')).toHaveLength(14);
  });
});

describe('feedFileText (what "Copy the feed" copies)', () => {
  const text = feedFileText(raw.page);

  it('is a whole feed file NEXUS reads under "Your file": one run, the same one', () => {
    const read = readFeedFile(text, { name: 'recorded-run.json', size: text.length });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.page.runs).toHaveLength(1);
    expect(read.page.runs[0]?.run_id).toBe(GUIDED_RUN.run_id);
    expect(read.page.workflow.steps.map((s) => s.kind)).toEqual(['notify_team', 'confirm_visitor', 'purge_pii']);
  });

  it('keeps documented fields only, and no reference or personal field', () => {
    expect(text).not.toMatch(/simulate_outage"\s*:|pii_deleted/);
    expect(text).not.toMatch(/NS-|"(name|email|message|phone)"\s*:/);
  });
});

describe('linesShown (typing once, 3 s)', () => {
  it('types line by line over 3 s, then shows every line', () => {
    expect(TYPE_MS).toBe(3000);
    expect(linesShown(0, 15)).toBe(0);
    expect(linesShown(1, 15)).toBe(1);
    expect(linesShown(1500, 15)).toBe(8); // ceil(7.5)
    expect(linesShown(2999, 15)).toBe(15);
    expect(linesShown(3000, 15)).toBe(15);
    expect(linesShown(60_000, 15)).toBe(15);
  });

  it('shows everything at once with no duration (reduced motion)', () => {
    expect(linesShown(0, 15, 0)).toBe(15);
  });
});

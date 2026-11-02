// The terminal on /how (step 5.4b): one recorded run as NEXUS receives it. `feedLines` gives the run's events as
// JSON lines split into coloured tokens; `feedFileText` is what "Copy the feed" copies, a whole feed file NEXUS can
// read under "Your file" (documented fields only, as on /connect); `linesShown` paces the typing.
import { documentedOnly, type Json } from './contract';
import type { Run } from './types';

/** key: a JSON key · text: a string or number · time: a timestamp · punct: brackets and commas · failed / ok: an event. */
export type TokenKind = 'key' | 'text' | 'time' | 'punct' | 'failed' | 'ok' | 'dead';

export interface Token {
  kind: TokenKind;
  text: string;
}

const EVENT_KIND: Record<string, TokenKind> = { failed: 'failed', retry_scheduled: 'failed', succeeded: 'ok', dead: 'dead' };

const key = (k: string): Token[] => [{ kind: 'key', text: JSON.stringify(k) }, { kind: 'punct', text: ': ' }];
const sep: Token = { kind: 'punct', text: ', ' };

/** The run's id, creation time and events, one event per line, as valid JSON once the lines are joined. */
export function feedLines(run: Run): Token[][] {
  const head: Token[] = [
    { kind: 'punct', text: '{ ' },
    ...key('run_id'), { kind: 'text', text: JSON.stringify(run.run_id) }, sep,
    ...key('created_at'), { kind: 'time', text: JSON.stringify(run.created_at) }, sep,
    ...key('events'), { kind: 'punct', text: '[' },
  ];
  const events = run.events.map((e, i): Token[] => [
    { kind: 'punct', text: '  { ' },
    ...key('kind'), { kind: 'text', text: JSON.stringify(e.kind) }, sep,
    ...key('event'), { kind: EVENT_KIND[e.event] ?? 'text', text: JSON.stringify(e.event) }, sep,
    ...key('attempt'), { kind: 'text', text: JSON.stringify(e.attempt) }, sep,
    ...key('detail'), { kind: 'text', text: JSON.stringify(e.detail) }, sep,
    ...key('at'), { kind: 'time', text: JSON.stringify(e.at) },
    { kind: 'punct', text: i < run.events.length - 1 ? ' },' : ' }' },
  ]);
  return [head, ...events, [{ kind: 'punct', text: '] }' }]];
}

export const lineText = (line: Token[]): string => line.map((t) => t.text).join('');

/** The whole recorded page (its workflow description, the run's jobs and events), indented, documented keys only. */
export const feedFileText = (page: unknown): string => JSON.stringify(documentedOnly(page as Json), null, 2);

/** Typing speed (user, 2026-10-30: 3 s in the lab). */
export const TYPE_MS = 3000;

/** How many of `total` lines are typed `elapsedMs` into a typing of `durationMs`; all of them from the end on. */
export function linesShown(elapsedMs: number, total: number, durationMs = TYPE_MS): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return total;
  if (elapsedMs <= 0) return 0;
  return Math.min(total, Math.ceil((elapsedMs / durationMs) * total));
}

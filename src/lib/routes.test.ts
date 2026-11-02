import { describe, expect, it } from 'vitest';
import { STORY_HREF, STORY_PATH, WATCH_HREF, movedSection, pageFor } from './routes';

describe('pageFor', () => {
  it('opens the landing page at the plain address', () => {
    expect(pageFor('/', '')).toEqual({ page: 'landing', redirect: null });
    expect(pageFor('/index.html', '')).toEqual({ page: 'landing', redirect: null });
  });

  it('opens the console at /console, with or without a query', () => {
    expect(pageFor('/console', '')).toEqual({ page: 'console', redirect: null });
    expect(pageFor('/console', '?view=events&win=7d')).toEqual({ page: 'console', redirect: null });
  });

  it('opens the live console for the watch door, its hash left to the watch panel', () => {
    expect(WATCH_HREF).toBe('/console#watch');
    expect(pageFor('/console', '')).toEqual({ page: 'console', redirect: null });
    expect(movedSection('/console', '', '#watch')).toBeNull();
  });

  it('drops a trailing slash after /console and keeps the query', () => {
    expect(pageFor('/console/', '?mode=guided')).toEqual({ page: 'console', redirect: '/console?mode=guided' });
  });

  it('moves links shared before the landing page existed under /console, query intact', () => {
    expect(pageFor('/', '?mode=guided')).toEqual({ page: 'console', redirect: '/console?mode=guided' });
    expect(pageFor('/', '?view=events&run=r_6d15828d95f5')).toEqual({
      page: 'console', redirect: '/console?view=events&run=r_6d15828d95f5',
    });
    expect(pageFor('/', '?step=notify_team&attempt=2')).toEqual({
      page: 'console', redirect: '/console?step=notify_team&attempt=2',
    });
  });

  it('keeps the landing page for queries the console doesn\'t read (e.g. tracking tags)', () => {
    expect(pageFor('/', '?utm_source=portfolio')).toEqual({ page: 'landing', redirect: null });
  });

  it('opens the developer page at /connect, and drops a trailing slash', () => {
    expect(pageFor('/connect', '')).toEqual({ page: 'connect', redirect: null });
    expect(pageFor('/connect/', '')).toEqual({ page: 'connect', redirect: '/connect' });
    expect(pageFor('/connect/', '?from=landing')).toEqual({ page: 'connect', redirect: '/connect?from=landing' });
  });

  it('opens the guided story at /story, with or without a beat, and drops a trailing slash', () => {
    expect(STORY_HREF).toBe(STORY_PATH);
    expect(pageFor('/story', '')).toEqual({ page: 'story', redirect: null });
    expect(pageFor('/story', '?beat=3')).toEqual({ page: 'story', redirect: null });
    expect(pageFor('/story/', '?beat=3')).toEqual({ page: 'story', redirect: '/story?beat=3' });
  });

  it('sends a link with the test-switch filter to the console', () => {
    expect(pageFor('/', '?flags=off')).toEqual({ page: 'console', redirect: '/console?flags=off' });
  });

  it('keeps old guided links (with the retired tour key) in the console', () => {
    expect(pageFor('/', '?mode=guided&tour=3')).toEqual({ page: 'console', redirect: '/console?mode=guided&tour=3' });
  });

  it('opens How it works at /how and Work with me at /work, and drops a trailing slash', () => {
    expect(pageFor('/how', '')).toEqual({ page: 'how', redirect: null });
    expect(pageFor('/how/', '?utm_source=cv')).toEqual({ page: 'how', redirect: '/how?utm_source=cv' });
    expect(pageFor('/work', '')).toEqual({ page: 'work', redirect: null });
    expect(pageFor('/work/', '')).toEqual({ page: 'work', redirect: '/work' });
  });
});

describe('movedSection', () => {
  it('sends the old "Who built it" link (/#builder) to /work, query intact', () => {
    expect(movedSection('/', '', '#builder')).toBe('/work');
    expect(movedSection('/', '?utm_source=cv', '#builder')).toBe('/work?utm_source=cv');
    expect(movedSection('/index.html', '', '#builder')).toBe('/work');
  });

  it('keeps every other hash, and hashes on other pages', () => {
    expect(movedSection('/', '', '#how')).toBeNull();
    expect(movedSection('/', '', '')).toBeNull();
    expect(movedSection('/connect', '', '#builder')).toBeNull();
  });
});

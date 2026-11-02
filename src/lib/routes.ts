// Which page a URL opens: the landing pages at `/`, `/how` and `/work`, the console at `/console`, the guided
// story at `/story`, the developer page at `/connect`. There is no router; moving between them is a normal link. Links shared before the landing
// page existed (`/?mode=guided`) carry console keys, so they are moved under `/console` instead of opening
// the landing page.

export const CONSOLE_PATH = '/console';
export const STORY_PATH = '/story';
export const CONNECT_PATH = '/connect';
export const HOW_PATH = '/how';
export const WORK_PATH = '/work';

/** The story door on the landing page and in the console. */
export const STORY_HREF = STORY_PATH;

/** "Break it yourself": the live console, scrolled to its watch panel, which takes focus (WatchPanel). */
export const WATCH_HREF = `${CONSOLE_PATH}#watch`;

export type Page = 'landing' | 'how' | 'work' | 'console' | 'story' | 'connect';

/** Every query key the console reads (src/lib/urlState.ts), plus `tour`, retired in step 3.2 but still in old links. */
const CONSOLE_KEYS = ['view', 'mode', 'win', 'step', 'attempt', 'event', 'order', 'run', 'flags', 'tour'];

export interface PageChoice {
  page: Page;
  /** Path and query to replace the current URL with before rendering, or null to keep it. */
  redirect: string | null;
}

/** Pages that live at their own path, and drop a trailing slash (the query stays). */
const PATHS: [string, Page][] = [[CONNECT_PATH, 'connect'], [STORY_PATH, 'story'], [CONSOLE_PATH, 'console'], [HOW_PATH, 'how'], [WORK_PATH, 'work']];

export function pageFor(pathname: string, search: string): PageChoice {
  for (const [path, page] of PATHS) {
    if (pathname === path) return { page, redirect: null };
    if (pathname === `${path}/`) return { page, redirect: `${path}${search}` };
  }
  const q = new URLSearchParams(search);
  if (CONSOLE_KEYS.some((k) => q.has(k))) return { page: 'console', redirect: `${CONSOLE_PATH}${search}` };
  return { page: 'landing', redirect: null };
}

/**
 * Sections that moved off the home page in step 5.4: `/#builder` (the old "Who built it" link) opens `/work`.
 * `/#how` stays: the problem section on the home page keeps that id.
 */
const MOVED: Record<string, string> = { '#builder': WORK_PATH };

/** Where a landing link with a moved section's hash now goes (path + query), or null to keep it. */
export function movedSection(pathname: string, search: string, hash: string): string | null {
  if (pathname !== '/' && pathname !== '/index.html') return null;
  const to = MOVED[hash];
  return to === undefined ? null : `${to}${search}`;
}

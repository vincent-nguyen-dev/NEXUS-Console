// Where the ops feed can be read from (step 7.2a). Northstar's CORS lets only the production site read its answers
// (its ALLOWED_ORIGINS, set in Render's dashboard; checked 1 Nov with an Origin header). Anywhere else (a Netlify
// deploy preview, a branch deploy, `vite preview` on localhost, a fork) the browser drops the answer, but Northstar
// still does the work: a plain GET has no preflight, so each try wakes Render and queries Neon. So from those origins
// NEXUS sends nothing and says why. `npm run dev` reads the feed through Vite's same-origin proxy, so it always can.
// If Northstar's ALLOWED_ORIGINS gains an origin, add it here too (docs/operations.md).
import { SITE_URL } from './credits';

export const FEED_ORIGINS: readonly string[] = [new URL(SITE_URL).origin];

/** The production site's address as words, for the preview messages. */
export const PRODUCTION_HOST = new URL(SITE_URL).host;

/** Whether a page at `origin` can read the feed: the dev server always, a build only from an allowed origin. */
export function feedReachable(origin: string, dev: boolean): boolean {
  return dev || FEED_ORIGINS.includes(origin);
}

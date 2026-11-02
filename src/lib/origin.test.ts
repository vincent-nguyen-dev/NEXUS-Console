import { describe, expect, it } from 'vitest';
import { FEED_ORIGINS, PRODUCTION_HOST, feedReachable } from './origin';

describe('feedReachable', () => {
  it('lets the production site read the feed, and the dev server (through its proxy) from anywhere', () => {
    expect(FEED_ORIGINS).toEqual(['https://nexus-democonsole.netlify.app']);
    expect(PRODUCTION_HOST).toBe('nexus-democonsole.netlify.app');
    expect(feedReachable('https://nexus-democonsole.netlify.app', false)).toBe(true);
    expect(feedReachable('http://localhost:5174', true)).toBe(true);
  });

  it('refuses every other origin of a build: previews, branch deploys, a local preview, http', () => {
    for (const origin of [
      'https://deploy-preview-12--nexus-democonsole.netlify.app',
      'https://dev--nexus-democonsole.netlify.app',
      'http://localhost:4173',
      'http://nexus-democonsole.netlify.app',
      'https://nexus-democonsole.netlify.app.example.com',
      '',
    ]) {
      expect(feedReachable(origin, false), origin).toBe(false);
    }
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREDITS, REPO_PUBLIC, REPO_URL, SITE_URL, mailtoHref, repoLink } from './credits';

// Read from disk: index.html isn't a module.
const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

const meta = (attr: 'name' | 'property', key: string) =>
  new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(indexHtml)?.[1];

describe('credits', () => {
  it('links to the work address with a subject and nothing else', () => {
    expect(CREDITS.email).toMatch(/^[a-z0-9.]+@[a-z0-9.-]+\.[a-z]{2,}$/);
    expect(mailtoHref).toBe('mailto:vincent.cao.nguyen.work@gmail.com?subject=NEXUS%20enquiry');
  });

  it('links to the GitHub profile over https, with no tracking parameters', () => {
    const url = new URL(CREDITS.github);
    expect(url.protocol).toBe('https:');
    expect(url.host).toBe('github.com');
    expect(url.search).toBe('');
  });
});

describe('the repo link', () => {
  it('is hidden while the repo is private, so no page shows a link that 404s', () => {
    expect(REPO_PUBLIC).toBe(false);
    expect(repoLink()).toBeNull();
    expect(repoLink(true)).toBe(REPO_URL);
  });
});

describe('index.html share metadata matches the credits', () => {
  it('names the author', () => {
    expect(meta('name', 'author')).toBe(CREDITS.name);
  });

  it('points og:url at production, and names no canonical (one index.html serves every route, step 7.1d)', () => {
    expect(meta('property', 'og:url')).toBe(SITE_URL);
    expect(indexHtml).not.toContain('rel="canonical"');
  });

  it('carries a title and a description that credits the author', () => {
    expect(meta('property', 'og:title')).toBe('NEXUS · Workflow operations console');
    expect(meta('property', 'og:description')).toMatch(new RegExp(`A portfolio project by ${CREDITS.name}\\.$`));
  });

  it('points the large share image at production, with its size, and the file exists', () => {
    expect(meta('property', 'og:image')).toBe(`${SITE_URL}og.png`);
    expect([meta('property', 'og:image:width'), meta('property', 'og:image:height')]).toEqual(['1200', '630']);
    expect(meta('property', 'og:image:alt')).toBeTruthy();
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(existsSync(new URL('../../public/og.png', import.meta.url))).toBe(true);
  });

  it('links to the NEXUS repository on the same GitHub profile', () => {
    expect(REPO_URL).toBe(`${CREDITS.github}/NEXUS-Console`);
  });
});

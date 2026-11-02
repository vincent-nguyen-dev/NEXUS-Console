// Picks the page from the URL (src/lib/routes.ts) and loads only its code: the landing pages (one chunk for
// all three), the console, the guided story and the developer page are separate chunks.
import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { movedSection, pageFor } from './lib/routes';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

// A section that moved to its own page (`/#builder` → `/work`) is followed first, before any page code runs.
const moved = movedSection(window.location.pathname, window.location.search, window.location.hash);
if (moved !== null) window.history.replaceState(null, '', moved);

const { page, redirect } = pageFor(window.location.pathname, window.location.search);
// Before the console reads the URL, so a link from before the landing page opens the same view.
if (redirect !== null) window.history.replaceState(null, '', `${redirect}${window.location.hash}`);

const LOADERS: Record<typeof page, () => Promise<ComponentType>> = {
  landing: () => import('./components/landing/Landing').then((m) => m.Home),
  how: () => import('./components/landing/Landing').then((m) => m.How),
  work: () => import('./components/landing/Landing').then((m) => m.Work),
  console: () => import('./App').then((m) => m.App),
  story: () => import('./components/story/Story').then((m) => m.Story),
  connect: () => import('./components/connect/ConnectPage').then((m) => m.ConnectPage),
};
const load = LOADERS[page]();

// /work's largest element is the Northstar screenshot, found only once the page's chunk renders: start it now, beside
// that chunk (7.1d, P2). The same srcset and sizes as the <img> in Builder.tsx, so the browser picks the same file.
if (page === 'work') {
  const link = document.createElement('link');
  Object.assign(link, { rel: 'preload', as: 'image', fetchPriority: 'high' });
  link.setAttribute('imagesrcset', '/northstar-640.webp 640w, /northstar.webp 1280w');
  link.setAttribute('imagesizes', '(min-width: 1100px) 480px, (min-width: 720px) calc(100vw - 80px), calc(100vw - 32px)');
  document.head.appendChild(link);
}

void load.then((Page) => {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <Page />
      </ErrorBoundary>
    </StrictMode>,
  );
});

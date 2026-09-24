import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startSession } from '../application/startSession';
import type { SessionConfiguration } from '../application/startSession';
import type { RNG } from '../engine';
import { App } from './App';

/** Same reproducible generator already used throughout the test suite (e.g.
 *  tests/unit/application/session-presentation.test.ts) - not a production algorithm choice, just a
 *  small, fast, seedable stand-in for `startSession`'s own real `crypto.getRandomValues` source. */
function createDeterministicRng(seed: number): RNG {
  let state = seed >>> 0;
  return { next: () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; } };
}

/**
 * Dev-server-only deterministic seed hook (M4→P1 review finding: "the required deterministic browser
 * acceptance suite is missing" - Playwright drives this real entry point via `npm run dev`, and the
 * production RNG otherwise has no seed hook by design, M4-T01). Gated on `import.meta.env.DEV` so Vite
 * dead-code-eliminates this whole branch from the production build (`vite build`) - real players never
 * gain any seed/URL-param surface; only a real `npm run dev` server, as Playwright's own config uses, can
 * ever reach it. Never wired into the Engine/Orchestrator themselves - it only swaps the RNG `startSession`
 * already accepted as an injectable dependency, so every other production code path is unchanged.
 */
function readE2eSeed(): number | null {
  if (!import.meta.env.DEV) return null;
  const raw = new URLSearchParams(window.location.search).get('e2eSeed');
  return raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
}

const e2eSeed = readE2eSeed();

const root = document.getElementById('root');
if (!root) throw new Error('Application root element is missing.');
// `App`'s own `start` prop is optional under `exactOptionalPropertyTypes` - omitted entirely (rather than
// passed as `undefined`) for every real production render, so it keeps its own real default (`startSession`).
createRoot(root).render(
  <StrictMode>
    {e2eSeed === null
      ? <App />
      : <App start={(configuration: SessionConfiguration) => startSession(configuration, { engineRng: createDeterministicRng(e2eSeed) })} />}
  </StrictMode>,
);

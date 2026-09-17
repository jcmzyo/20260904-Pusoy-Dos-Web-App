import { useEffect, useState } from 'react';
import {
  MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX,
  MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX,
} from './layoutThresholds';

/**
 * Which of the M4-T04 frozen viewport categories (thresholds now owned by `layoutThresholds.ts`,
 * this module's own sibling) the current browser window falls into (ui-ux.md §14): `'supported'`
 * landscape gameplay, `'portrait'` (taller than wide, on a device that can actually be physically
 * rotated — "Rotate your device to continue"), or `'undersized'` (landscape but narrower/shorter
 * than the frozen minimum, or a portrait-shaped window that cannot be rotated — resize guidance).
 * Portrait takes priority over the width/height minimums when a viewport is both taller-than-wide
 * and below them (e.g. a narrow phone): orientation is the more fundamental problem, and the frozen
 * matrix's own two unsupported entries never overlap in practice.
 *
 * Imports the exact frozen thresholds from `layoutThresholds.ts` rather than redefining them here —
 * `tests/browser/viewportMatrix.ts` imports the same constants for its own Playwright QA matrix, so
 * this guard and that browser QA contract can never silently drift apart.
 */
export type LayoutCategory = 'supported' | 'portrait' | 'undersized';

/**
 * Whether the browser's primary pointer is coarse (touch-first, as on a phone or tablet) rather than
 * fine (a mouse/trackpad, as on desktop/laptop hardware) — the CSS Pointer Media Queries signal
 * (`pointer: coarse`/`pointer: fine`). Only a coarse-pointer device is one the person could actually
 * pick up and physically rotate, which is what `categorizeLayout` below uses to decide between
 * "Rotate your device" and "Resize your window" guidance for a taller-than-wide viewport (M4-T11
 * follow-up: asking someone to rotate a desktop monitor is not an instruction they can follow).
 *
 * Guarded for environments without `matchMedia` (jsdom's default test environment, and very old
 * browsers): those report `false`, i.e. a fine-pointer/desktop device — the correct default, since a
 * window nobody can rotate should never be told to.
 */
function hasCoarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

export function categorizeLayout(width: number, height: number, isCoarsePointer: boolean = hasCoarsePointer()): LayoutCategory {
  if (height > width) return isCoarsePointer ? 'portrait' : 'undersized';
  if (width < MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX || height < MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX) return 'undersized';
  return 'supported';
}

/**
 * Live viewport category (M4-T11; ui-ux.md §14), re-evaluated on resize/orientation change so rotating
 * or resizing back into a supported layout is reflected without a reload ("returning to landscape
 * restores coherent state"). Reads `window.innerWidth`/`innerHeight` — the same dimensions
 * `viewport-matrix.e2e.ts` already drives via Playwright's `page.setViewportSize` — rather than
 * `visualViewport` or a CSS media query, so this guard and that browser QA contract measure the exact
 * same thing. Pointer capability (`hasCoarsePointer`) is read fresh on every recompute for the same
 * reason: a 2-in-1 device can switch its primary pointer between mouse and touch without a resize.
 */
export function useLayoutSupport(): LayoutCategory {
  const [category, setCategory] = useState<LayoutCategory>(() => categorizeLayout(window.innerWidth, window.innerHeight));

  useEffect(() => {
    function handleChange() {
      setCategory(categorizeLayout(window.innerWidth, window.innerHeight));
    }
    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);
    return () => {
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
    };
  }, []);

  return category;
}

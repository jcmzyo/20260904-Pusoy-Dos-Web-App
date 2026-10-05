import { useEffect, useState } from 'react';
import {
  MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX,
  MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX,
  MINIMUM_SUPPORTED_PORTRAIT_HEIGHT_PX,
  MINIMUM_SUPPORTED_PORTRAIT_WIDTH_PX,
  MINIMUM_TABLET_PORTRAIT_WIDTH_PX,
} from './layoutThresholds';

/**
 * Which frozen viewport class the current browser window falls into (ui-ux.md §14 for landscape,
 * §19.6.2 for portrait and below-minimum guidance; thresholds owned by `layoutThresholds.ts`, which
 * `tests/browser/viewportMatrix.ts` imports too, so production and the browser QA matrix cannot drift).
 *
 * Supported layouts:
 * - `'landscape'`: width > height, at or above 844×390 (§14 unchanged).
 * - `'portrait-phone'` / `'portrait-tablet'`: width <= height (a square counts as portrait), at or above
 *   360×560 whatever the pointer type; tablet from 600px wide.
 *
 * Unsupported layouts carry the guidance the device can actually follow:
 * - `'unsupported-resize'`: a fine-pointer device, which is never told to rotate.
 * - `'unsupported-rotate'`: a coarse-pointer device whose swapped dimensions would be supported.
 * - `'unsupported-too-small'`: a coarse-pointer device supported in neither orientation.
 *
 * Kept as a flat string union so an unchanged class compares equal across renders: consumers key
 * effects (pause) on it, and a supported portrait <-> landscape switch must not look like a new value
 * to anything that only cares whether the layout is supported (`isSupportedLayout`).
 */
export type SupportedLayout = 'landscape' | 'portrait-phone' | 'portrait-tablet';
export type UnsupportedLayout = 'unsupported-rotate' | 'unsupported-resize' | 'unsupported-too-small';
export type LayoutCategory = SupportedLayout | UnsupportedLayout;

export function isSupportedLayout(category: LayoutCategory): category is SupportedLayout {
  return category === 'landscape' || category === 'portrait-phone' || category === 'portrait-tablet';
}

/**
 * Whether the browser's primary pointer is coarse (touch-first, as on a phone or tablet) rather than
 * fine (a mouse/trackpad, as on desktop/laptop hardware) — the CSS Pointer Media Queries signal
 * (`pointer: coarse`/`pointer: fine`). Only a coarse-pointer device is one the person could actually
 * pick up and physically rotate, which is what `categorizeLayout` below uses to decide between rotate
 * guidance and the other two unsupported kinds (M4-T11 follow-up; ui-ux.md §19.6.2).
 *
 * Guarded for environments without `matchMedia` (jsdom's default test environment, and very old
 * browsers): those report `false`, i.e. a fine-pointer/desktop device — the correct default, since a
 * window nobody can rotate should never be told to.
 */
function hasCoarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

function classifySupported(width: number, height: number): SupportedLayout | null {
  if (width > height) {
    return width >= MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX && height >= MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX ? 'landscape' : null;
  }
  if (width < MINIMUM_SUPPORTED_PORTRAIT_WIDTH_PX || height < MINIMUM_SUPPORTED_PORTRAIT_HEIGHT_PX) return null;
  return width >= MINIMUM_TABLET_PORTRAIT_WIDTH_PX ? 'portrait-tablet' : 'portrait-phone';
}

export function categorizeLayout(width: number, height: number, isCoarsePointer: boolean = hasCoarsePointer()): LayoutCategory {
  const supported = classifySupported(width, height);
  if (supported !== null) return supported;
  if (!isCoarsePointer) return 'unsupported-resize';
  return classifySupported(height, width) !== null ? 'unsupported-rotate' : 'unsupported-too-small';
}

/**
 * Live viewport class, re-evaluated on `resize` and `orientationchange` so rotating or resizing is
 * reflected without a reload. Reads `window.innerWidth`/`innerHeight` (the layout viewport) — the same
 * dimensions the Playwright matrix drives via `page.setViewportSize` — and deliberately not `screen.*` or
 * `visualViewport`, so pinch-zoom never reclassifies (ui-ux.md §19.6.2); a mobile toolbar collapsing or
 * expanding is an ordinary resize. Pointer capability is read fresh on every recompute: a 2-in-1 device
 * can switch its primary pointer between mouse and touch without a resize.
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

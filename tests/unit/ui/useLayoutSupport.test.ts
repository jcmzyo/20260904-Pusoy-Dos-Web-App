// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX,
  MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX,
  MINIMUM_SUPPORTED_PORTRAIT_HEIGHT_PX,
  MINIMUM_SUPPORTED_PORTRAIT_WIDTH_PX,
  MINIMUM_TABLET_PORTRAIT_WIDTH_PX,
} from '../../../src/ui/primitives/layoutThresholds';
import { categorizeLayout, isSupportedLayout, useLayoutSupport } from '../../../src/ui/primitives/useLayoutSupport';
import type { LayoutCategory } from '../../../src/ui/primitives/useLayoutSupport';
import { RESIZE_GUIDANCE, ROTATE_GUIDANCE, TOO_SMALL_GUIDANCE, VIEWPORT_MATRIX } from '../../browser/viewportMatrix';
import type { GuidanceHeading } from '../../browser/viewportMatrix';

/**
 * M5-T02 classification (ui-ux.md §19.6.2). The frozen browser matrix (`tests/browser/viewportMatrix.ts`)
 * is checked case-by-case here too, so the pure rule and the Playwright contract cannot drift apart.
 */

const GUIDANCE_CATEGORY: Record<GuidanceHeading, LayoutCategory> = {
  [ROTATE_GUIDANCE]: 'unsupported-rotate',
  [RESIZE_GUIDANCE]: 'unsupported-resize',
  [TOO_SMALL_GUIDANCE]: 'unsupported-too-small',
};

describe('frozen thresholds (M5-T01 approval record)', () => {
  it('pins the approved portrait values and leaves the landscape minimum unchanged', () => {
    expect(MINIMUM_SUPPORTED_PORTRAIT_WIDTH_PX).toBe(360);
    expect(MINIMUM_SUPPORTED_PORTRAIT_HEIGHT_PX).toBe(560);
    expect(MINIMUM_TABLET_PORTRAIT_WIDTH_PX).toBe(600);
    expect(MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX).toBe(844);
    expect(MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX).toBe(390);
  });
});

describe('categorizeLayout against every frozen matrix case', () => {
  for (const spec of VIEWPORT_MATRIX) {
    for (const pointer of ['fine', 'coarse'] as const) {
      const coarse = pointer === 'coarse';
      if (spec.category === 'supported') {
        const expected: LayoutCategory = spec.orientation === 'landscape' ? 'landscape' : `portrait-${spec.portraitClass!}`;
        it(`${spec.name} (${spec.width}x${spec.height}, ${pointer}) is ${expected}`, () => {
          expect(categorizeLayout(spec.width, spec.height, coarse)).toBe(expected);
        });
      } else {
        const heading = spec.guidance?.[pointer];
        if (heading === undefined) continue;
        it(`${spec.name} (${spec.width}x${spec.height}, ${pointer}) shows "${heading}"`, () => {
          expect(categorizeLayout(spec.width, spec.height, coarse)).toBe(GUIDANCE_CATEGORY[heading]);
        });
      }
    }
  }
});

describe('categorizeLayout thresholds and immediately-below cases', () => {
  it.each([true, false])('supports portrait exactly at 360x560 and not 1px below either dimension (coarse: %s)', (coarse) => {
    expect(categorizeLayout(360, 560, coarse)).toBe('portrait-phone');
    expect(isSupportedLayout(categorizeLayout(359, 560, coarse))).toBe(false);
    expect(isSupportedLayout(categorizeLayout(360, 559, coarse))).toBe(false);
  });

  it('splits phone and tablet portrait at 600px wide', () => {
    expect(categorizeLayout(599, 960, true)).toBe('portrait-phone');
    expect(categorizeLayout(600, 960, true)).toBe('portrait-tablet');
  });

  it('treats a square as portrait and only strictly wider-than-tall as landscape', () => {
    expect(categorizeLayout(700, 700, false)).toBe('portrait-tablet');
    expect(categorizeLayout(560, 560, false)).toBe('portrait-phone');
    expect(categorizeLayout(844, 843, false)).toBe('landscape');
    // A square below the portrait height is unsupported, and rotating it would not help.
    expect(categorizeLayout(500, 500, true)).toBe('unsupported-too-small');
  });

  it.each([true, false])('keeps the landscape minimum at exactly 844x390 and not 1px below either dimension (coarse: %s)', (coarse) => {
    expect(categorizeLayout(844, 390, coarse)).toBe('landscape');
    expect(isSupportedLayout(categorizeLayout(843, 390, coarse))).toBe(false);
    expect(isSupportedLayout(categorizeLayout(844, 389, coarse))).toBe(false);
  });

  it('never tells a fine-pointer device to rotate, even when the other orientation would fit', () => {
    expect(categorizeLayout(667, 375, false)).toBe('unsupported-resize');
    expect(categorizeLayout(320, 568, false)).toBe('unsupported-resize');
  });

  it('tells a coarse-pointer device to rotate only when the swapped dimensions are supported', () => {
    // Swaps to a supported portrait.
    expect(categorizeLayout(667, 375, true)).toBe('unsupported-rotate');
    // Swaps to exactly the portrait minimum, and 1px short of it.
    expect(categorizeLayout(560, 360, true)).toBe('unsupported-rotate');
    expect(categorizeLayout(559, 360, true)).toBe('unsupported-too-small');
    // Portrait too narrow for portrait, and its swap is far below the landscape minimum.
    expect(categorizeLayout(320, 568, true)).toBe('unsupported-too-small');
  });
});

describe('useLayoutSupport (live)', () => {
  function resizeWindowTo(width: number, height: number, eventType = 'resize') {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    window.dispatchEvent(new Event(eventType));
  }

  afterEach(() => resizeWindowTo(1024, 768));

  it('re-classifies on resize and on orientationchange from the layout viewport (innerWidth/innerHeight)', () => {
    const { result } = renderHook(() => useLayoutSupport());
    expect(result.current).toBe('landscape');
    act(() => resizeWindowTo(390, 844));
    expect(result.current).toBe('portrait-phone');
    act(() => resizeWindowTo(768, 1024, 'orientationchange'));
    expect(result.current).toBe('portrait-tablet');
    // jsdom has no matchMedia: a fine-pointer device.
    act(() => resizeWindowTo(359, 560));
    expect(result.current).toBe('unsupported-resize');
  });

  it('does not re-classify from the visual viewport (pinch-zoom)', () => {
    const { result } = renderHook(() => useLayoutSupport());
    const visualViewport = window.visualViewport;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: { width: 200, height: 200 } });
    try {
      act(() => resizeWindowTo(1024, 768));
      expect(result.current).toBe('landscape');
    } finally {
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
    }
  });
});

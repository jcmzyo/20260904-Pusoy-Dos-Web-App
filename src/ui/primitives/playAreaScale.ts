import { useEffect, useState } from 'react';

/**
 * Smallest ("design") size of the play area (table plus bottom action bar), in CSS pixels at scale 1
 * (ui-ux.md §14; M4-T14). Every dimension inside the play area is authored in design units, and the
 * play area itself is fluid: it is never laid out smaller than this, and whenever the viewport (at the
 * chosen scale) is larger it simply gets more room, so a desktop window shows the table at natural size
 * with generous spacing. Only when the viewport is smaller than this at scale 1 is the whole area scaled
 * down uniformly (`computePlayAreaScale`), so table, seats, cards, and controls keep the same relative
 * proportions instead of each shrinking independently. The Playwright fit checks
 * (tests/browser/viewport-matrix.e2e.ts, responsive-hardening.e2e.ts) prove the authored content really
 * does fit inside this size.
 */
export const PLAY_AREA_DESIGN_WIDTH_PX = 896;
export const PLAY_AREA_DESIGN_HEIGHT_PX = 656;

/** Largest play area the layout is ever stretched to before the whole area is scaled up instead
 *  (bounded typography, ui-ux.md §14): on a big display the table stops getting emptier and the cards and
 *  text grow with it. Roughly a laptop-sized window. */
export const PLAY_AREA_COMFORT_WIDTH_PX = 1440;
export const PLAY_AREA_COMFORT_HEIGHT_PX = 900;

/** Hard upper bound on scaling up, for very large or ultra-wide displays. */
export const PLAY_AREA_MAX_SCALE = 2;

/**
 * The uniform scale for a viewport (ui-ux.md §14). It is 1 for any viewport between the design size and
 * the comfort size, less than 1 when the viewport is smaller than the design size in either dimension (the
 * tighter one binds: a viewport that is unusually short for its width - a real mobile browser's own
 * address bar/chrome can leave less usable height than an emulated preset assumes - yields a height-fit
 * area instead of one that overflows vertically), and more than 1 (up to `PLAY_AREA_MAX_SCALE`) only when
 * the viewport is larger than the comfort size.
 */
export function computePlayAreaScale(viewportWidth: number, viewportHeight: number): number {
  const fitScale = Math.min(viewportHeight / PLAY_AREA_DESIGN_HEIGHT_PX, viewportWidth / PLAY_AREA_DESIGN_WIDTH_PX);
  const naturalScale = Math.max(1, viewportWidth / PLAY_AREA_COMFORT_WIDTH_PX, viewportHeight / PLAY_AREA_COMFORT_HEIGHT_PX);
  return Math.min(fitScale, naturalScale, PLAY_AREA_MAX_SCALE);
}

/** The play area's own laid-out size in design units (never smaller than the design size, up to rounding)
 *  and the scale that maps it onto the viewport. */
export interface PlayAreaLayout {
  readonly scale: number;
  readonly width: number;
  readonly height: number;
}

export function computePlayAreaLayout(viewportWidth: number, viewportHeight: number): PlayAreaLayout {
  const scale = computePlayAreaScale(viewportWidth, viewportHeight);
  return { scale, width: viewportWidth / scale, height: viewportHeight / scale };
}

/**
 * Live play-area layout, re-evaluated on resize/orientation change. Reads `window.innerWidth`/`innerHeight`
 * for the same reason `useLayoutSupport` does: it is the exact pair Playwright's `page.setViewportSize`
 * drives, so this layout and the browser QA matrix measure the same thing.
 */
export function usePlayAreaLayout(): PlayAreaLayout {
  const [layout, setLayout] = useState(() => computePlayAreaLayout(window.innerWidth, window.innerHeight));

  useEffect(() => {
    function handleChange() {
      setLayout(computePlayAreaLayout(window.innerWidth, window.innerHeight));
    }
    handleChange();
    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);
    return () => {
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
    };
  }, []);

  return layout;
}

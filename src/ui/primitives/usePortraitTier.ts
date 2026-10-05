import { useEffect, useState } from 'react';
import { PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX, PORTRAIT_TABLET_TALL_MIN_HEIGHT_PX } from './layoutThresholds';
import type { SupportedLayout } from './useLayoutSupport';

/** Whether a supported portrait composition is in its tall tier (ui-ux.md §19.6.3): the viewport is at least
 *  that class's tall-tier height. Always false for landscape. Measured from `window.innerHeight` and
 *  re-evaluated on `resize`/`orientationchange`, the same layout-viewport measurement `useLayoutSupport` uses. */
export function isTallPortrait(composition: SupportedLayout, viewportHeight: number): boolean {
  if (composition === 'portrait-phone') return viewportHeight >= PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX;
  if (composition === 'portrait-tablet') return viewportHeight >= PORTRAIT_TABLET_TALL_MIN_HEIGHT_PX;
  return false;
}

export function usePortraitTier(composition: SupportedLayout): boolean {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    function handleChange() {
      setHeight(window.innerHeight);
    }
    handleChange();
    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);
    return () => {
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
    };
  }, []);
  return isTallPortrait(composition, height);
}

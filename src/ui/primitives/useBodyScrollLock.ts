import { useEffect } from 'react';

/**
 * Prevents the page's own body from scrolling behind a full-viewport modal/overlay while one is mounted
 * (the person's own follow-up report: "I can still scroll the background even if the cursor is at the
 * event log. It only happens briefly when initially the cursor is at outside while scrolling and it gets
 * placed in the event scroll") - `.shell`'s own `min-height: 100vh` plus its own padding (App.module.css)
 * always leaves the document a few pixels taller than the viewport, so a wheel/trackpad gesture that
 * starts outside a modal's own scrollable content, before the browser retargets it to the modal, can
 * nudge that small residual body scroll instead of being consumed by the modal. Locks `document.body`'s
 * own `overflow` to `hidden` for exactly as long as the calling component stays mounted, restoring
 * whatever value was already there (rather than assuming it was empty/default) once it unmounts - so
 * nested overlays (Session Summary's own Event Log button opens this same overlay on top of itself) each
 * correctly hand control back to whichever one is still open underneath them, rather than one unlocking
 * scroll a still-open overlay meant to keep locked.
 */
export function useBodyScrollLock(): void {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
}

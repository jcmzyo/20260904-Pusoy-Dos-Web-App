import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Overlay.module.css';
import { useBodyScrollLock } from './useBodyScrollLock';

export interface OverlayProps {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** Overrides the panel's own default width (Overlay.module.css's `.panel`, `width: min(560px, 100%)`)
   *  for a caller whose content has its own narrower natural size - Discard Pile (M4-T10 follow-up; the
   *  person's own follow-up request for a more compact overlay sized to its own fixed-width card rows)
   *  rather than the wider default sized for Event Log's own free-flowing text entries. Still clamped to
   *  the viewport the same way the default is, via the same `min(px, 100%)` pattern. */
  readonly maxWidthPx?: number;
}

/**
 * Shared dismissible overlay shell for Discard Pile and Event Log (M4-T10; ui-ux.md §9.1-§9.2: both
 * "Close/Exit returns to the table"). Closes via an explicit Close button, the Escape key, or a
 * backdrop click - all equivalent to the caller's own `onClose`, which is also what pauses/resumes
 * automatic Turn advancement (App.tsx's `SessionTable`, `SessionPresentation.pause`/`resume`).
 *
 * This is intentionally always dismissible: it is not reused as-is for a later non-dismissible modal
 * (M4-T12's Round Result overlay, ui-ux.md §12, "not dismissible by outside click/Escape") - that is a
 * different contract, not a variant of this one, and building that toggle now would be exactly the kind
 * of speculative abstraction the project's working instructions ask to avoid ("small extension seams
 * only when currently justified").
 */
export function Overlay({ title, onClose, children, maxWidthPx }: OverlayProps) {
  useBodyScrollLock();

  const rootRef = useRef<HTMLDivElement>(null);
  // The element that had focus when this overlay opened, captured during the first render - before the
  // commit that mounts this overlay also makes the table beneath it inert (App.tsx), at which point the
  // browser drops focus from that now-inert opener. Focus returns there on close, so keyboard use of
  // Event Log/Discard Pile/Leave Game is not left at the top of the page each time.
  const [opener] = useState(() => document.activeElement);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // An inert ancestor means this overlay is not what the person is currently interacting with
      // (App.tsx keeps the table, and any open overlay in it, mounted but inert behind the unsupported-
      // layout notice) - Escape there must not close it out from under the notice.
      if (rootRef.current?.closest('[inert]')) return;
      onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => () => {
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  }, [opener]);

  return (
    <div ref={rootRef} className={styles.backdrop} onClick={onClose}>
      <section
        className={styles.panel}
        style={maxWidthPx !== undefined ? { width: `min(${maxWidthPx}px, 100%)` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Stops a click inside the panel from bubbling to the backdrop's own close handler.
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={`Close ${title}`}>
            ×
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </section>
    </div>
  );
}

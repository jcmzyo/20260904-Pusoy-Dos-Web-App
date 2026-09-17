import { Overlay } from './Overlay';
import styles from './LeaveConfirmOverlay.module.css';

export interface LeaveConfirmOverlayProps {
  readonly onStay: () => void;
  readonly onLeave: () => void;
}

/**
 * Leave Game confirmation (M4-T11; ui-ux.md §10): "an application confirmation overlay explaining that
 * progress is not saved, with Yes/Leave Game and Return/Stay actions." Reuses the shared dismissible
 * `Overlay` primitive (Discard Pile/Event Log, M4-T10) rather than a bespoke non-dismissible modal:
 * every way of dismissing it without pressing the explicit "Yes, Leave Game" button — the Close ×,
 * Escape, or a backdrop click — is exactly the safe "Return/Stay" action, so wiring `onClose` straight
 * to `onStay` is correct here, not a shortcut around a stricter contract (unlike M4-T12's later
 * non-dismissible Round Result overlay, which `Overlay`'s own docstring already calls out as a
 * different, not-yet-built contract).
 */
export function LeaveConfirmOverlay({ onStay, onLeave }: LeaveConfirmOverlayProps) {
  return (
    <Overlay title="Leave Game" onClose={onStay}>
      <p className={styles.warning}>Your Session progress is not saved. Leaving now ends this Session for good.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.stay} onClick={onStay}>Stay</button>
        <button type="button" className={styles.leave} onClick={onLeave}>Yes, Leave Game</button>
      </div>
    </Overlay>
  );
}

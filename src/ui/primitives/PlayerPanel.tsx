import styles from './PlayerPanel.module.css';

const PLACEMENT_LABELS: Record<1 | 2 | 3 | 4, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };

export interface PlayerPanelProps {
  readonly name: string;
  readonly cardCount: number;
  readonly score: number;
  readonly isCurrentTurn: boolean;
  readonly passed: boolean;
  readonly done: boolean;
  readonly placement: 1 | 2 | 3 | 4 | null;
}

interface StatusVariant {
  readonly text: string;
  /** Typed `string | undefined` only because the ambient `*.module.css` declaration (vite/client)
   *  types class lookups as an index signature under `noUncheckedIndexedAccess`; every status class
   *  is always defined in PlayerPanel.module.css. Used solely in a className template, so this is safe. */
  readonly className: string | undefined;
}

/**
 * DONE/placement takes precedence over a lingering PASS flag or turn
 * highlight; PASS takes precedence over the turn highlight. This mirrors
 * SessionPresentation's `PresentedSeat` fields (T03) one-to-one so a later
 * task can wire seats through without inventing new vocabulary.
 */
function resolveStatus({ isCurrentTurn, passed, done, placement }: PlayerPanelProps): StatusVariant | null {
  if (done) {
    return { text: placement === null ? 'DONE' : `DONE · ${PLACEMENT_LABELS[placement]}`, className: styles.statusDone };
  }
  if (passed) return { text: 'PASS', className: styles.statusPass };
  if (isCurrentTurn) return { text: 'Turn', className: styles.statusTurn };
  return null;
}

/**
 * Reusable player panel: name, remaining-card count, cumulative score, a
 * turn highlight, and PASS/DONE+placement status. Positioning at a table
 * seat is a layout concern owned by later tasks (M4-T06).
 *
 * The turn highlight is exposed both structurally (`aria-current`) and as
 * a readable "Turn" label, and PASS/DONE use text labels rather than color
 * alone, per ui-ux.md's accessibility expectations.
 */
export function PlayerPanel(props: PlayerPanelProps) {
  const { name, cardCount, score, isCurrentTurn } = props;
  const status = resolveStatus(props);
  return (
    <section
      className={`${styles.panel} ${isCurrentTurn ? styles.active : ''}`}
      aria-label={`${name} panel`}
      aria-current={isCurrentTurn ? 'true' : undefined}
    >
      <p className={styles.name}>{name}</p>
      <p className={styles.meta}>{cardCount} card{cardCount === 1 ? '' : 's'} · {score} pts</p>
      {status !== null && <p className={`${styles.status} ${status.className}`}>{status.text}</p>}
    </section>
  );
}

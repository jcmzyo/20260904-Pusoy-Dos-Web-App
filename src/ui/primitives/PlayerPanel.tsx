import type { ReactNode } from 'react';
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
  /** Shows a small "deciding" spinner alongside the Turn status (M4-T09 slice; ui-ux.md §8's bot
   *  presentation delay). Reserved for a bot's own Turn — the caller is expected to never pass this
   *  true for the human's own seat, since the human already has its own Play/Pass controls rather than
   *  anything actually loading. Purely presentational: never reflects real AI compute time. */
  readonly thinking?: boolean;
  /** Freezes the "deciding" spinner's own CSS animation without hiding it, while a Discard Pile/Event
   *  Log overlay is open (M4-T10 follow-up; ui-ux.md §9.2: "Orchestrator progression is paused"). A CSS
   *  `@keyframes` animation keeps running on its own regardless of React re-renders, so without this the
   *  spinner kept visibly spinning through a pause - reading as "the bot is still deciding" even though
   *  nothing is actually advancing (the person's own follow-up report). Purely presentational, same as
   *  `thinking` itself; has no effect unless `thinking` is also true. */
  readonly paused?: boolean;
  /** This seat's own Play/Pass trail (ui-ux.md §5.4), rendered inside this same panel container
   *  (alongside the status badge/spinner) rather than as a separate element beside it — the person's
   *  own follow-up request. `PlayerPanel` stays agnostic of cards/combinations: the caller renders the
   *  actual trail content (e.g. `App.tsx`'s `SeatPlayTrail`) and passes it through as a slot. */
  readonly playTrail?: ReactNode;
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
 * The panel's own glow (border/box-shadow), separate from the text status above: 1st/2nd/3rd finish
 * each get their own medal-colored glow, and the current Turn gets a cyan glow — kept visually
 * distinct from the gold "finished 1st" glow so the two are never confused at a glance (the person's
 * own follow-up request). A 4th-place finish and an idle seat get no glow.
 */
function resolveGlowClass({ isCurrentTurn, done, placement }: PlayerPanelProps): string | undefined {
  if (done && placement === 1) return styles.glowGold;
  if (done && placement === 2) return styles.glowSilver;
  if (done && placement === 3) return styles.glowBronze;
  if (isCurrentTurn) return styles.glowTurn;
  return undefined;
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
  const { name, cardCount, score, isCurrentTurn, thinking = false, paused = false, playTrail } = props;
  const status = resolveStatus(props);
  const glowClass = resolveGlowClass(props);
  return (
    <section
      className={`${styles.panel} ${glowClass ?? ''}`}
      aria-label={`${name} panel`}
      aria-current={isCurrentTurn ? 'true' : undefined}
    >
      <p className={styles.name}>{name}</p>
      <p className={styles.meta}>{cardCount} card{cardCount === 1 ? '' : 's'} · {score} pts</p>
      {/* Always-rendered, fixed-height slots (below) so an idle seat's missing status badge, or a seat
       *  with no spinner/trail to show, leaves behind an empty box rather than removing that row
       *  entirely — otherwise the remaining rows would shift position/re-center every time PASS/DONE/
       *  Turn or the Play trail appeared or disappeared during a Round (the person's own follow-up
       *  report). */}
      <div className={styles.statusSlot}>
        {status !== null && <p className={`${styles.status} ${status.className}`}>{status.text}</p>}
      </div>
      <div className={styles.trailSlot}>
        {thinking && (
          <span
            className={styles.spinner}
            style={paused ? { animationPlayState: 'paused' } : undefined}
            role="status"
            aria-label={`${name} is deciding`}
          />
        )}
        {!thinking && playTrail}
      </div>
    </section>
  );
}

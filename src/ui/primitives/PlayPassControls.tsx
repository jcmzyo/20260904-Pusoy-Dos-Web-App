import type { Card, Combination, Move, PlayerId } from '../../domain';
import type { SessionPresentationSnapshot } from '../../application/SessionPresentation';
import { canBeat, defaultRuleset, generateLegalResponseMoves, inspectCombination } from '../../engine';
import { describeCombination } from './combinationLabels';
import styles from './PlayPassControls.module.css';

type Center = SessionPresentationSnapshot['center'];

export type PlaySelectionEvaluation =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid'; readonly reason: string }
  | { readonly kind: 'valid'; readonly combination: Combination };

/**
 * Mirrors the Engine's own authoritative Play legality using only the Engine's exported
 * combination-inspection/comparison functions (engine.md §4, §11-12; `inspectCombination`, `canBeat`) —
 * not a UI rule replica of `validateMove` (which is Engine-internal and not part of its public package
 * boundary). Ownership/Turn/session-active facts are guaranteed by the caller: this is only ever
 * evaluated against cards drawn from the human's own authoritative hand while it is genuinely their
 * active Turn (`isMyTurn`), so those checks would be redundant here.
 */
export function evaluatePlaySelection(selected: readonly Card[], center: Center): PlaySelectionEvaluation {
  if (selected.length === 0) return { kind: 'empty' };
  const inspected = inspectCombination(selected, defaultRuleset);
  if (!inspected.valid) {
    return { kind: 'invalid', reason: inspected.error === 'UNSUPPORTED_CARD_COUNT' ? 'Wrong number of cards' : 'Invalid combination' };
  }
  if (center.kind === 'opening' && !selected.some((card) => card.rank === '3' && card.suit === 'clubs')) {
    return { kind: 'invalid', reason: 'Must include 3♣' };
  }
  if (center.kind === 'hand' && !canBeat(inspected.combination, center.combination, defaultRuleset)) {
    return { kind: 'invalid', reason: `Doesn't beat ${describeCombination(center.combination)}` };
  }
  return { kind: 'valid', combination: inspected.combination };
}

/** True only while responding with zero legal Plays left (ui-ux.md §7: "No valid plays"); opening/free
 *  lead always has at least one legal Play for a non-empty hand (createPlayerTurnRequest's own Engine
 *  invariant), so this only ever applies to a response Trick. */
function hasNoValidPlay(center: Center, hand: readonly Card[], playerId: PlayerId): boolean {
  if (center.kind !== 'hand') return false;
  return !generateLegalResponseMoves(hand, playerId, center.combination, defaultRuleset).some((move) => move.kind === 'play');
}

export interface PlayPassControlsProps {
  /** The human player's currently selected cards (HumanHand's presentation-only selection state, T07). */
  readonly selected: readonly Card[];
  readonly center: Center;
  readonly humanHand: readonly Card[];
  readonly playerId: PlayerId;
  /** True only during this player's own active Turn. Play/Pass are otherwise inert; richer stale-input
   *  protection across Turn transitions is M4-T09's job, not this task's. */
  readonly isMyTurn: boolean;
  readonly onSubmit: (move: Move) => void;
}

/**
 * The large Play/Pass controls (ui-ux.md §5.2, §7): Play carries selection feedback (recognized
 * combination or a specific Engine-derived invalid/non-beating reason) and stays disabled until the
 * selection is both recognized and legal for the active Trick. Pass is available only while responding
 * (canonical rule: Pass is illegal during an opening or free-lead Play) and remains available even when
 * a legal beating Play exists — Pass is always a strategic choice, never conditioned on `selected`.
 */
export function PlayPassControls({ selected, center, humanHand, playerId, isMyTurn, onSubmit }: PlayPassControlsProps) {
  const evaluation = evaluatePlaySelection(selected, center);
  const canPlay = isMyTurn && evaluation.kind === 'valid';
  const canPass = isMyTurn && center.kind === 'hand';
  const noValidPlay = isMyTurn && hasNoValidPlay(center, humanHand, playerId);

  // Shown as a smaller second line inside the Play button itself (the person's own follow-up request)
  // rather than as separate text below it; `aria-describedby` on the button keeps it available to
  // screen readers even though the button's own accessible name stays the fixed "Play" (see below).
  const playSubLabel = evaluation.kind === 'invalid' ? evaluation.reason
    : evaluation.kind === 'valid' ? describeCombination(evaluation.combination)
    : null;

  function handlePlay() {
    if (!canPlay || evaluation.kind !== 'valid') return;
    onSubmit({ kind: 'play', playerId, cards: evaluation.combination.cards });
  }

  function handlePass() {
    if (!canPass) return;
    onSubmit({ kind: 'pass', playerId });
  }

  return (
    <div className={styles.controls} role="group" aria-label="Play or Pass">
      <div className={styles.buttons}>
        {/* `aria-label` pins each button's accessible name to the fixed "Play"/"Pass" regardless of the
         *  sub-label text rendered inside it, so the name stays stable for assistive tech and tests alike;
         *  `aria-describedby` still surfaces that sub-label text as the button's accessible description. */}
        <button
          type="button"
          className={styles.play}
          onClick={handlePlay}
          disabled={!canPlay}
          aria-label="Play"
          aria-describedby={playSubLabel !== null ? 'play-sublabel' : undefined}
        >
          <span className={styles.mainLabel}>Play</span>
          {playSubLabel !== null && <span id="play-sublabel" className={styles.subLabel}>{playSubLabel}</span>}
        </button>
        <button
          type="button"
          className={`${styles.pass} ${noValidPlay ? styles.passHighlight : ''}`}
          onClick={handlePass}
          disabled={!canPass}
          aria-label="Pass"
          aria-describedby={noValidPlay ? 'pass-sublabel' : undefined}
        >
          <span className={styles.mainLabel}>Pass</span>
          {noValidPlay && <span id="pass-sublabel" className={styles.subLabel}>No valid plays</span>}
        </button>
      </div>
    </div>
  );
}

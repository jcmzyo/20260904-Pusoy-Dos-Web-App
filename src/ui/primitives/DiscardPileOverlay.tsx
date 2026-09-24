import type { Card, Suit } from '../../domain';
import { CardIndex } from './Card';
import { cardKey, compareBySuit } from './handOrdering';
import { Overlay } from './Overlay';
import styles from './DiscardPileOverlay.module.css';

const SUIT_LABELS: Record<Suit, string> = { clubs: 'Clubs', spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds' };

/** Canonical suit order (ui-ux.md §9.1): Clubs → Spades → Hearts → Diamonds. Every suit always gets its
 *  own row below, regardless of whether any card of that suit has actually been played yet - the
 *  person's own follow-up report that a suit's row disappearing (and the remaining rows shifting up)
 *  made the layout feel unstable mid-Round. An empty row simply has nothing in it. */
const SUIT_ORDER: readonly Suit[] = ['clubs', 'spades', 'hearts', 'diamonds'];

/** Just wide enough for a full 13-card row (the largest a single suit's row can ever hold, since a suit
 *  only has 13 ranks) without wrapping - the person's own follow-up request for a more compact overlay
 *  than the shared default, which is sized for Event Log's own free-flowing text instead: 13 × the fixed
 *  `CardIndex` badge width (22px, Card.module.css) + 12 × the row's own gap (6px,
 *  DiscardPileOverlay.module.css) = 358px of content, plus the Overlay panel's own 20px×2 padding
 *  (Overlay.module.css) = 398px minimum; rounded up for comfortable breathing room rather than a
 *  knife's-edge fit. */
export const PANEL_WIDTH_PX = 420;

export interface DiscardPileOverlayProps {
  /** Every card successfully played so far in the current Round, including the current Trick
   *  (SessionPresentation's `playedCards`, sourced from the Engine's own public view - Pass never
   *  contributes a card, so there is nothing extra to filter out here). */
  readonly cards: readonly Card[];
  readonly onClose: () => void;
}

/**
 * Discard Pile overlay (M4-T10; ui-ux.md §9.1): every card played this Round, grouped
 * Clubs → Spades → Hearts → Diamonds, and within each suit Rank 3 → ... → A → 2 - the same order
 * `compareBySuit` (handOrdering.ts, M4-T07's Sort by Suit) already implements. Uses the compact
 * `CardIndex` corner badge rather than a full `PlayingCard`: this overlay can hold up to a full
 * 52-card Round, the same "more cards in less space" reasoning ui-ux.md §5.6 gives for the center
 * hand-to-beat and each seat's own Play trail, which are the two contexts it names explicitly as
 * corner-only; Discard Pile isn't itself one of those two named contexts, so this is a judgment call
 * documented here rather than a literal reading of §5.6, reported in this task's own completion report.
 *
 * A row's own position (fixed Clubs/Spades/Hearts/Diamonds order, always all four) is what identifies
 * its suit rather than a visible text label per row (the person's own follow-up request: with a row
 * already dedicated to each suit, a repeated "CLUBS"/"SPADES"/... heading above it was redundant). Each
 * row keeps its own `aria-label` for screen readers, since removing only the *visible* text still leaves
 * assistive tech needing a name for an otherwise unlabeled, possibly-empty list.
 */
export function DiscardPileOverlay({ cards, onClose }: DiscardPileOverlayProps) {
  const sorted = [...cards].sort(compareBySuit);
  return (
    <Overlay title="Discard Pile" onClose={onClose} maxWidthPx={PANEL_WIDTH_PX}>
      {cards.length === 0 && <p className={styles.empty}>No cards played yet this Round.</p>}
      {SUIT_ORDER.map((suit) => (
        <div key={suit} className={styles.row} role="list" aria-label={`${SUIT_LABELS[suit]} played this Round`}>
          {sorted.filter((card) => card.suit === suit).map((card) => (
            <span key={cardKey(card)} role="listitem">
              <CardIndex card={card} />
            </span>
          ))}
        </div>
      ))}
    </Overlay>
  );
}

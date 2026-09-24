import type { Rank } from './Rank';
import type { Suit } from './Suit';

/**
 * A Card is a shared domain value representing one physical playing card.
 *
 * The rank/suit pair uniquely identifies a card in the standard deck.
 *
 * A Card must contain only domain information. It must never contain:
 * image paths, CSS classes, screen coordinates, selection state,
 * animation state, ownership, visibility state, or AI evaluation values.
 * Those concerns belong to the subsystem using the Card.
 */
export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}

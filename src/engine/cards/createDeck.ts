import type { Card, Rank, Suit } from '../../domain';

const ranks: readonly Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const suits: readonly Suit[] = ['clubs', 'spades', 'hearts', 'diamonds'];

/** Creates a fresh standard deck in fixed rank-then-suit order, without shuffling. */
export function createDeck(): Card[] {
  return ranks.flatMap((rank) => suits.map((suit) => ({ rank, suit })));
}

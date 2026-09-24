import type { Card, Rank, Suit } from '../../domain';
import { compareRank } from '../cards/cardComparison';
import type { RulesetConfig } from '../config/RulesetConfig';

/** Engine-only strength: compare suit first, then ranks in descending order. */
export interface FlushStrength {
  readonly suit: Suit;
  readonly descendingRanks: readonly Rank[];
}

/** Matches the Flush property in validated cards, including Straight Flushes. */
export function getFlushStrength(
  cards: readonly Card[],
  ruleset: RulesetConfig,
): FlushStrength | null {
  if (cards.length !== 5) return null;
  const suit = cards[0]!.suit;
  if (cards.some((card) => card.suit !== suit)) return null;
  const ranks = cards.map((card) => card.rank);
  if (new Set(ranks).size !== 5) return null;
  return { suit, descendingRanks: ranks.sort((a, b) => compareRank(b, a, ruleset)) };
}

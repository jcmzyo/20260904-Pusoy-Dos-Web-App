import type { Card, Rank, Suit } from '../../domain';
import { compareSuit } from '../cards/cardComparison';
import type { RulesetConfig } from '../config/RulesetConfig';

/** Engine-only strength; pattern order is authoritative, including low A/2. */
export interface StraightStrength {
  readonly patternIndex: number;
  readonly effectiveHighRank: Rank;
  readonly effectiveHighSuit: Suit;
}

/** Matches rank sequences in validated cards, including same-suit sequences. */
export function getStraightStrength(
  cards: readonly Card[],
  ruleset: RulesetConfig,
): StraightStrength | null {
  if (cards.length !== 5) return null;
  const ranks = new Set(cards.map((card) => card.rank));
  if (ranks.size !== 5) return null;
  const patternIndex = ruleset.straightRules.patterns.findIndex(
    (pattern) => pattern.ranks.length === 5 && pattern.ranks.every((rank) => ranks.has(rank)),
  );
  const pattern = ruleset.straightRules.patterns[patternIndex];
  if (!pattern) return null;
  const highCard = cards.find((card) => card.rank === pattern.effectiveHighRank);
  if (!highCard) throw new Error('Straight pattern effective high rank is absent from its cards');
  return { patternIndex, effectiveHighRank: highCard.rank, effectiveHighSuit: highCard.suit };
}

/** Negative means weaker; zero means equal strength. Use the same ruleset for both. */
export function compareStraightStrength(
  a: StraightStrength,
  b: StraightStrength,
  ruleset: RulesetConfig,
): number {
  return a.patternIndex - b.patternIndex ||
    compareSuit(a.effectiveHighSuit, b.effectiveHighSuit, ruleset);
}

import type { Card, Combination } from '../../domain';
import type { RulesetConfig } from '../config/RulesetConfig';
import { getStraightStrength } from './straightStrength';

export type CombinationInspectionResult =
  | { readonly valid: true; readonly combination: Combination }
  | {
      readonly valid: false;
      readonly error:
        | 'INVALID_CARDS'
        | 'UNSUPPORTED_CARD_COUNT'
        | 'INVALID_CARD'
        | 'DUPLICATE_CARD'
        | 'INVALID_COMBINATION';
    };

/**
 * Recognizes Singles, Pairs, Triples, and Straights without checking ownership, Turn,
 * opening requirements, or whether the cards beat the current Trick.
 * Same-suit sequences retain Straight property strength but cannot be ordinary
 * Straights. Straight Flush classification remains unsupported until T10.
 */
export function inspectCombination(
  cards: readonly Card[],
  ruleset: RulesetConfig,
): CombinationInspectionResult {
  if (!Array.isArray(cards)) {
    return { valid: false, error: 'INVALID_CARDS' };
  }
  if (cards.length < 1 || (cards.length > 3 && cards.length !== 5)) {
    return { valid: false, error: 'UNSUPPORTED_CARD_COUNT' };
  }

  const seen = new Set<string>();
  const inspectedCards: Card[] = [];
  for (const card of cards) {
    if (
      typeof card !== 'object' || card === null || Array.isArray(card) ||
      !ruleset.rankOrder.includes(card.rank) ||
      !ruleset.suitOrder.includes(card.suit)
    ) {
      return { valid: false, error: 'INVALID_CARD' };
    }
    const identity = `${card.rank}-${card.suit}`;
    if (seen.has(identity)) {
      return { valid: false, error: 'DUPLICATE_CARD' };
    }
    seen.add(identity);
    inspectedCards.push({ rank: card.rank, suit: card.suit });
  }

  if (inspectedCards.length === 5) {
    const sameSuit = inspectedCards.every((card) => card.suit === inspectedCards[0]?.suit);
    if (sameSuit || !getStraightStrength(inspectedCards, ruleset)) {
      return { valid: false, error: 'INVALID_COMBINATION' };
    }
    return { valid: true, combination: { type: 'straight', cards: inspectedCards } };
  }

  if (inspectedCards.some((card) => card.rank !== inspectedCards[0]?.rank)) {
    return { valid: false, error: 'INVALID_COMBINATION' };
  }

  return {
    valid: true,
    combination: {
      type: cards.length === 1 ? 'single' : cards.length === 2 ? 'pair' : 'triple',
      cards: inspectedCards,
    },
  };
}

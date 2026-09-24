import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../src/domain';
import { defaultRuleset, inspectCombination } from '../../../src/engine';
import { compareRank } from '../../../src/engine/cards/cardComparison';
import { getFourOfAKindStrength } from '../../../src/engine/combinations/fourOfAKindStrength';
import { getFlushStrength } from '../../../src/engine/combinations/flushStrength';
import { compareStraightStrength, getStraightStrength } from '../../../src/engine/combinations/straightStrength';

const ranks: readonly Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const suits: readonly Suit[] = ['clubs', 'spades', 'hearts', 'diamonds'];
const sequences: readonly (readonly Rank[])[] = [
  ['A', '2', '3', '4', '5'], ['2', '3', '4', '5', '6'],
  ['3', '4', '5', '6', '7'], ['4', '5', '6', '7', '8'],
  ['5', '6', '7', '8', '9'], ['6', '7', '8', '9', '10'],
  ['7', '8', '9', '10', 'J'], ['8', '9', '10', 'J', 'Q'],
  ['9', '10', 'J', 'Q', 'K'], ['10', 'J', 'Q', 'K', 'A'],
  ['J', 'Q', 'K', 'A', '2'],
];
const quad = (rank: Rank, kicker: Rank, suit: Suit = 'clubs'): Card[] => [
  ...suits.map((suit) => ({ rank, suit })), { rank: kicker, suit },
];
const suited = (selection: readonly Rank[], suit: Suit = 'clubs'): Card[] => selection.map((rank) => ({ rank, suit }));
function permutations<T>(values: readonly T[]): T[][] {
  if (!values.length) return [[]];
  return values.flatMap((value, i) => permutations(values.filter((_, j) => i !== j)).map((rest) => [value, ...rest]));
}

describe('Four-of-a-Kind and Straight Flush inspection', () => {
  it('recognizes all 624 quad+kicker hands with only quad-rank strength', () => {
    let count = 0;
    for (const rank of ranks) for (const kicker of ranks) for (const suit of suits) {
      if (rank === kicker) continue;
      const cards = quad(rank, kicker, suit);
      for (const ordered of [cards, [...cards].reverse()]) {
        expect(getFourOfAKindStrength(ordered)).toEqual({ quadRank: rank });
        expect(inspectCombination(ordered, defaultRuleset)).toEqual({ valid: true, combination: { type: 'fourOfAKind', cards: ordered } });
      }
      count++;
    }
    expect(count).toBe(624);
  });

  it('supports lower and higher quad strength independently of the kicker with disjoint hands', () => {
    for (const [i, a] of ranks.entries()) for (const [j, b] of ranks.entries()) {
      if (i === j) continue;
      const remaining = ranks.filter((rank) => rank !== a && rank !== b);
      const leftCards = quad(a, remaining[0]!);
      const rightCards = quad(b, remaining[remaining.length - 1]!, 'diamonds');
      expect(leftCards.some((card) => rightCards.some((other) => card.rank === other.rank && card.suit === other.suit))).toBe(false);
      const left = getFourOfAKindStrength(leftCards)!;
      const right = getFourOfAKindStrength(rightCards)!;
      expect(Math.sign(compareRank(left.quadRank, right.quadRank, defaultRuleset))).toBe(Math.sign(i - j));
    }
  });

  it('recognizes all 44 overlaps in all 120 orders with detached cards and special effective highs', () => {
    sequences.forEach((sequence, patternIndex) => {
      for (const suit of suits) for (const ordered of permutations(suited(sequence, suit))) {
        const cards = Object.freeze(ordered.map((card) => Object.freeze(card)));
        expect(getStraightStrength(cards, defaultRuleset)).toEqual({ patternIndex, effectiveHighRank: sequence[4], effectiveHighSuit: suit });
        expect(getFlushStrength(cards, defaultRuleset)).not.toBeNull();
        expect(getFourOfAKindStrength(cards)).toBeNull();
        const result = inspectCombination(cards, defaultRuleset);
        expect(result).toEqual({ valid: true, combination: { type: 'straightFlush', cards } });
        if (!result.valid) throw new Error('Expected Straight Flush');
        expect(result.combination.cards).not.toBe(cards);
        cards.forEach((card, i) => expect(result.combination.cards[i]).not.toBe(card));
      }
    });
  });

  it('uses Straight rank-first strength for disjoint Straight Flushes, including effective-high suit tiebreaks', () => {
    sequences.forEach((a, i) => sequences.forEach((b, j) => {
      for (const [s, aSuit] of suits.entries()) for (const [t, bSuit] of suits.entries()) {
        if (aSuit === bSuit && a.some((rank) => b.includes(rank))) continue;
        const left = getStraightStrength(suited(a, aSuit), defaultRuleset)!;
        const right = getStraightStrength(suited(b, bSuit), defaultRuleset)!;
        expect(Math.sign(compareStraightStrength(left, right, defaultRuleset))).toBe(Math.sign(i - j || s - t));
      }
    }));
  });

  it.each([
    ['K', 'A', '2', '3', '4'], ['Q', 'K', 'A', '2', '3'], ['3', '4', '5', '6', '8'],
  ] as Rank[][])('keeps same-suit invalid sequences as ordinary Flushes: %j', (...selection) => {
    const cards = suited(selection);
    expect(getStraightStrength(cards, defaultRuleset)).toBeNull();
    expect(inspectCombination(cards, defaultRuleset)).toEqual({ valid: true, combination: { type: 'flush', cards } });
  });

  it('requires one suit as well as a sequence and consumes configured category precedence', () => {
    const cards = suited(sequences[0]!);
    const mixed = cards.map((card, i) => ({ ...card, suit: suits[i % 4]! }));
    expect(inspectCombination(mixed, defaultRuleset)).toEqual({ valid: true, combination: { type: 'straight', cards: mixed } });
    const ruleset = { ...defaultRuleset, fiveCardOrder: [...defaultRuleset.fiveCardOrder].reverse() };
    expect(inspectCombination(cards, ruleset)).toEqual({ valid: true, combination: { type: 'straight', cards } });
  });

  it('rejects non-quad structures and missing or extra kickers', () => {
    for (const selection of [
      ['3', '3', '3', '2', '2'], ['3', '3', '3', '4', '2'], ['3', '3', '4', '4', '2'],
      ['3', '3', '3', '3', '3'],
    ] as Rank[][]) {
      expect(getFourOfAKindStrength(selection.map((rank, i) => ({ rank, suit: suits[i % 4]! })))).toBeNull();
    }
    for (const size of [0, 1, 2, 3, 4, 6]) {
      const cards = [...quad('3', '2'), { rank: 'A', suit: 'diamonds' } as const].slice(0, size);
      expect(getFourOfAKindStrength(cards)).toBeNull();
    }
  });

  it('validates duplicate and malformed cards before recognizing the new categories', () => {
    for (const original of [quad('3', '2'), suited(sequences[0]!)]) {
      for (let i = 0; i < 5; i++) {
        const duplicate = original.map((card) => ({ ...card }));
        duplicate[i] = { ...original[(i + 1) % 5]! };
        expect(inspectCombination(duplicate, defaultRuleset)).toEqual({ valid: false, error: 'DUPLICATE_CARD' });
        const malformed = [...original];
        malformed[i] = { rank: 'joker', suit: 'clubs' } as unknown as Card;
        expect(inspectCombination(malformed, defaultRuleset)).toEqual({ valid: false, error: 'INVALID_CARD' });
      }
    }
  });

  it('preserves quad strength and detached frozen cards in every input order', () => {
    for (const ordered of permutations(quad('2', '3'))) {
      const cards = Object.freeze(ordered.map((card) => Object.freeze(card)));
      expect(getFourOfAKindStrength(cards)).toEqual({ quadRank: '2' });
      const result = inspectCombination(cards, defaultRuleset);
      expect(result).toEqual({ valid: true, combination: { type: 'fourOfAKind', cards } });
      if (!result.valid) throw new Error('Expected Four-of-a-Kind');
      expect(result.combination.cards).not.toBe(cards);
      cards.forEach((card, i) => expect(result.combination.cards[i]).not.toBe(card));
    }
  });
});

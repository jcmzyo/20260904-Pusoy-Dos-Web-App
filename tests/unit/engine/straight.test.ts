import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../src/domain';
import { defaultRuleset, inspectCombination } from '../../../src/engine';
import { compareStraightStrength, getStraightStrength } from '../../../src/engine/combinations/straightStrength';

const sequences = [
  ['A', '2', '3', '4', '5'], ['2', '3', '4', '5', '6'],
  ['3', '4', '5', '6', '7'], ['4', '5', '6', '7', '8'],
  ['5', '6', '7', '8', '9'], ['6', '7', '8', '9', '10'],
  ['7', '8', '9', '10', 'J'], ['8', '9', '10', 'J', 'Q'],
  ['9', '10', 'J', 'Q', 'K'], ['10', 'J', 'Q', 'K', 'A'],
  ['J', 'Q', 'K', 'A', '2'],
] as const;
const suits: readonly Suit[] = ['clubs', 'spades', 'hearts', 'diamonds'];
const ranks: readonly Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const hand = (ranks: readonly Rank[]): Card[] => ranks.map((rank, i) => ({ rank, suit: suits[i % 4]! }));
function strength(cards: readonly Card[], ruleset = defaultRuleset) {
  const result = getStraightStrength(cards, ruleset);
  if (!result) throw new Error('Expected Straight strength');
  return result;
}
function subsets<T>(values: readonly T[], size: number): T[][] {
  if (!size) return [[]];
  return values.flatMap((value, i) => subsets(values.slice(i + 1), size - 1).map((rest) => [value, ...rest]));
}
function permutations<T>(values: readonly T[]): T[][] {
  if (!values.length) return [[]];
  return values.flatMap((value, i) => permutations(values.filter((_, j) => i !== j)).map((rest) => [value, ...rest]));
}

describe('house-rule Straights', () => {
  it('recognizes all 11 sequences in all 120 card orders with the correct effective high', () => {
    sequences.forEach((sequence, patternIndex) => {
      const cards = hand(sequence);
      for (const ordered of permutations(cards)) {
        expect(inspectCombination(ordered, defaultRuleset)).toEqual({ valid: true, combination: { type: 'straight', cards: ordered } });
        expect(strength(ordered)).toEqual({ patternIndex, effectiveHighRank: sequence[4], effectiveHighSuit: 'clubs' });
      }
    });
  });

  it('exhausts all 1287 distinct five-rank sets, accepting exactly the 11 house sequences', () => {
    const selections = subsets(ranks, 5);
    expect(selections).toHaveLength(1287);
    let accepted = 0;
    for (const selection of selections) {
      const expected = sequences.some((sequence) => sequence.every((rank) => selection.includes(rank)));
      const cards = hand(selection);
      expect(inspectCombination(cards, defaultRuleset).valid).toBe(expected);
      expect(getStraightStrength(cards, defaultRuleset) !== null).toBe(expected);
      if (expected) accepted++;
    }
    expect(accepted).toBe(11);
  });

  it.each([
    ['K', 'A', '2', '3', '4'], ['Q', 'K', 'A', '2', '3'],
    ['3', '4', '5', '6', '8'], ['3', '4', '5', '6', '6'],
  ] as Rank[][])('rejects invalid wraps, gaps and repeated ranks: %j', (...sequence) => {
    expect(inspectCombination(hand(sequence), defaultRuleset)).toEqual({ valid: false, error: 'INVALID_COMBINATION' });
    expect(getStraightStrength(hand(sequence), defaultRuleset)).toBeNull();
  });

  it('orders every sequence pair from A2345 through JQKA2 before considering suit', () => {
    sequences.forEach((a, i) => sequences.forEach((b, j) => {
      for (const aSuit of suits) for (const bSuit of suits) {
        const left = hand(a); left[4] = { ...left[4]!, suit: aSuit };
        const right = hand(b); right[4] = { ...right[4]!, suit: bSuit };
        const expected = Math.sign(i - j || suits.indexOf(aSuit) - suits.indexOf(bSuit));
        expect(Math.sign(compareStraightStrength(strength(left), strength(right), defaultRuleset))).toBe(expected);
      }
    }));
  });

  it('ignores every non-effective-high suit for all 1024 suit assignments per sequence', () => {
    for (const sequence of sequences) for (let mask = 0; mask < 1024; mask++) {
      const cards = sequence.map((rank, i) => ({ rank, suit: suits[(mask >> (i * 2)) & 3]! }));
      const reference = hand(sequence); reference[4] = { ...reference[4]!, suit: cards[4]!.suit };
      expect(compareStraightStrength(strength(cards), strength(reference), defaultRuleset)).toBe(0);
      const sameSuit = cards.every((card) => card.suit === cards[0]!.suit);
      expect(inspectCombination(cards, defaultRuleset).valid).toBe(!sameSuit);
    }
  });

  it('consumes configured patterns, effective high and suit order', () => {
    const ruleset = {
      ...defaultRuleset,
      suitOrder: [...suits].reverse(),
      straightRules: { patterns: [
        { ranks: sequences[10], effectiveHighRank: 'J' as const },
        { ranks: sequences[0], effectiveHighRank: 'A' as const },
      ] },
    };
    const low = hand(sequences[10]); const high = hand(sequences[0]);
    expect(strength(low, ruleset).effectiveHighRank).toBe('J');
    expect(compareStraightStrength(strength(low, ruleset), strength(high, ruleset), ruleset)).toBeLessThan(0);
    const other = hand(sequences[10]); other[0] = { ...other[0]!, suit: 'diamonds' };
    expect(compareStraightStrength(strength(low, ruleset), strength(other, ruleset), ruleset)).toBeGreaterThan(0);
    expect(inspectCombination(hand(sequences[1]), ruleset).valid).toBe(false);
  });

  it('rejects duplicate physical cards and wrong sizes', () => {
    const cards = hand(sequences[0]); cards[4] = { ...cards[0]! };
    expect(inspectCombination(cards, defaultRuleset)).toEqual({ valid: false, error: 'DUPLICATE_CARD' });
    for (const size of [0, 1, 4, 6]) expect(getStraightStrength(hand(ranks.slice(0, size)), defaultRuleset)).toBeNull();
  });

  it('preserves frozen input and returns detached cards without strength or legality metadata', () => {
    const cards = Object.freeze(hand(sequences[0]).map((card) => Object.freeze(card)));
    const result = inspectCombination(cards, defaultRuleset);
    expect(result).toEqual({ valid: true, combination: { type: 'straight', cards } });
    if (!result.valid) throw new Error('Expected Straight');
    expect(result.combination.cards).not.toBe(cards);
    cards.forEach((card, i) => expect(result.combination.cards[i]).not.toBe(card));
  });
});


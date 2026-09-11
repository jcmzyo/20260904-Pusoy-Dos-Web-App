import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../src/domain';
import { defaultRuleset, inspectCombination } from '../../../src/engine';
import { getFlushStrength } from '../../../src/engine/combinations/flushStrength';
import { getFullHouseStrength } from '../../../src/engine/combinations/fullHouseStrength';

const ranks: readonly Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const suits: readonly Suit[] = ['clubs', 'spades', 'hearts', 'diamonds'];
const sequences = ['3,4,5,A,2', '3,4,5,6,2', '3,4,5,6,7', '4,5,6,7,8', '5,6,7,8,9',
  '6,7,8,9,10', '7,8,9,10,J', '8,9,10,J,Q', '9,10,J,Q,K', '10,J,Q,K,A', 'J,Q,K,A,2'];
function subsets<T>(values: readonly T[], size: number): T[][] {
  if (!size) return [[]];
  return values.flatMap((value, i) => subsets(values.slice(i + 1), size - 1).map((rest) => [value, ...rest]));
}
function permutations<T>(values: readonly T[]): T[][] {
  if (!values.length) return [[]];
  return values.flatMap((value, i) => permutations(values.filter((_, j) => i !== j)).map((rest) => [value, ...rest]));
}
const flush = (selection: readonly Rank[], suit: Suit = 'clubs'): Card[] => selection.map((rank) => ({ rank, suit }));
const fullHouse = (triple: Rank, pair: Rank): Card[] => [
  ...suits.slice(0, 3).map((suit) => ({ rank: triple, suit })),
  ...suits.slice(2).map((suit) => ({ rank: pair, suit })),
];

describe('Flush and Full House inspection', () => {
  it('recognizes all 5148 same-suit properties with descending strength, including all 44 sequence overlaps', () => {
    let properties = 0;
    let ordinary = 0;
    for (const selection of subsets(ranks, 5)) for (const suit of suits) {
      const cards = flush(selection, suit);
      const overlap = sequences.includes(selection.join(','));
      for (const ordered of [cards, [...cards].reverse()]) {
        expect(getFlushStrength(ordered, defaultRuleset)).toEqual({ suit, descendingRanks: [...selection].reverse() });
        expect(inspectCombination(ordered, defaultRuleset)).toEqual(overlap
          ? { valid: true, combination: { type: 'straightFlush', cards: ordered } }
          : { valid: true, combination: { type: 'flush', cards: ordered } });
      }
      properties++;
      if (!overlap) ordinary++;
    }
    expect(properties).toBe(5148);
    expect(ordinary).toBe(5104);
  });

  it('recognizes all 3744 Full Houses with only triple-rank strength, regardless of pair or suits', () => {
    let count = 0;
    for (const triple of ranks) for (const pair of ranks) {
      if (triple === pair) continue;
      for (const tripleSuits of subsets(suits, 3)) for (const pairSuits of subsets(suits, 2)) {
        const cards = [...tripleSuits.map((suit) => ({ rank: triple, suit })), ...pairSuits.map((suit) => ({ rank: pair, suit }))];
        for (const ordered of [cards, [...cards].reverse()]) {
          expect(getFullHouseStrength(ordered)).toEqual({ tripleRank: triple });
          expect(getFlushStrength(ordered, defaultRuleset)).toBeNull();
          expect(inspectCombination(ordered, defaultRuleset)).toEqual({ valid: true, combination: { type: 'fullHouse', cards: ordered } });
        }
        count++;
      }
    }
    expect(count).toBe(3744);
  });

  it.each([
    { cards: flush(['2', '4', 'A', '7', '3']), type: 'flush' },
    { cards: fullHouse('3', '2'), type: 'fullHouse' },
  ])('preserves all 120 input orders and detached frozen values for $type', ({ cards, type }) => {
    const expectedFlush = getFlushStrength(cards, defaultRuleset);
    const expectedHouse = getFullHouseStrength(cards);
    for (const ordered of permutations(cards)) {
      const frozen = Object.freeze(ordered.map((card) => Object.freeze({ ...card })));
      expect(getFlushStrength(frozen, defaultRuleset)).toEqual(expectedFlush);
      expect(getFullHouseStrength(frozen)).toEqual(expectedHouse);
      const result = inspectCombination(frozen, defaultRuleset);
      expect(result).toEqual({ valid: true, combination: { type, cards: frozen } });
      if (!result.valid) throw new Error('Expected valid combination');
      expect(result.combination.cards).not.toBe(frozen);
      frozen.forEach((card, i) => expect(result.combination.cards[i]).not.toBe(card));
    }
  });

  it('retains the suit separately from every descending rank and consumes configured rank order', () => {
    const ruleset = { ...defaultRuleset, rankOrder: [...ranks].reverse(), suitOrder: [...suits].reverse() };
    for (const suit of suits) {
      const cards = flush(['A', '3', '2', '7', '4'], suit);
      expect(getFlushStrength(cards, defaultRuleset)).toEqual({ suit, descendingRanks: ['2', 'A', '7', '4', '3'] });
      expect(getFlushStrength(cards, ruleset)).toEqual({ suit, descendingRanks: ['3', '4', '7', 'A', '2'] });
      expect(inspectCombination(cards, ruleset).valid).toBe(true);
    }
  });

  it.each([
    ['3', '3', '3', '4', '2'],
    ['3', '3', '4', '4', '2'], ['3', '3', '4', '7', '2'], ['3', '4', '6', '8', '2'],
  ] as Rank[][])('rejects non-triple-pair structures and mixed-suit nonsequences: %j', (...selection) => {
    const cards = selection.map((rank, i) => ({ rank, suit: suits[i % 4]! }));
    expect(getFullHouseStrength(cards)).toBeNull();
    expect(getFlushStrength(cards, defaultRuleset)).toBeNull();
    expect(inspectCombination(cards, defaultRuleset)).toEqual({ valid: false, error: 'INVALID_COMBINATION' });
  });

  it('rejects wrong property sizes and validates duplicates before recognizing either category', () => {
    for (const size of [0, 1, 2, 3, 4, 6]) {
      const cards = flush(ranks.slice(0, size));
      expect(getFlushStrength(cards, defaultRuleset)).toBeNull();
      expect(getFullHouseStrength(cards)).toBeNull();
    }
    for (const cards of [flush(['3', '4', '7', 'A', '2']), fullHouse('3', '2')]) {
      cards[1] = { ...cards[0]! };
      expect(inspectCombination(cards, defaultRuleset)).toEqual({ valid: false, error: 'DUPLICATE_CARD' });
    }
  });
});

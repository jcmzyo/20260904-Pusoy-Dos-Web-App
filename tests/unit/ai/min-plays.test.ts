import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../src/domain';
import { createDeck, defaultRuleset, inspectCombination, shuffleDeck } from '../../../src/engine';
import { createHandDecomposer, minPlays } from '../../../src/ai';

const card = (rank: Rank, suit: Suit = 'clubs'): Card => ({ rank, suit });
const mixed = (ranks: readonly Rank[]): Card[] => ranks.map((rank, i) => card(rank, i % 2 ? 'hearts' : 'clubs'));

// No memoization or fixed pivot: enumerate all first Plays and all their continuations.
function reference(hand: readonly Card[]): number {
  if (hand.length === 0) return 0;
  let best = hand.length;
  for (let subset = 1; subset < 2 ** hand.length; subset += 1) {
    const selected = hand.filter((_, i) => (subset & (1 << i)) !== 0);
    if (inspectCombination(selected, defaultRuleset).valid) {
      best = Math.min(best, 1 + reference(hand.filter((_, i) => (subset & (1 << i)) === 0)));
    }
  }
  return best;
}

describe('exact minimum-play decomposition', () => {
  it.each([
    { hand: [], expected: 0 },
    { hand: [card('2')], expected: 1 },
    { hand: mixed(['3', '5', '7', '9']), expected: 4 },
    { hand: [card('3'), card('3', 'hearts')], expected: 1 },
    { hand: [card('3'), card('3', 'hearts'), card('3', 'spades')], expected: 1 },
    { hand: mixed(['A', '2', '3', '4', '5']), expected: 1 },
    { hand: mixed(['2', '3', '4', '5', '6']), expected: 1 },
    { hand: mixed(['J', 'Q', 'K', 'A', '2']), expected: 1 },
    { hand: mixed(['K', 'A', '2', '3', '4']), expected: 5 },
    { hand: mixed(['Q', 'K', 'A', '2', '3']), expected: 5 },
    { hand: ['3', '5', '7', '9', 'J'].map((rank) => card(rank as Rank)), expected: 1 },
    { hand: ['A', '2', '3', '4', '5'].map((rank) => card(rank as Rank)), expected: 1 },
    { hand: [card('3'), card('3', 'spades'), card('3', 'hearts'), card('4'), card('4', 'hearts')], expected: 1 },
    { hand: [card('3'), card('3', 'spades'), card('3', 'hearts'), card('3', 'diamonds')], expected: 2 },
    { hand: [card('3'), card('3', 'spades'), card('3', 'hearts'), card('3', 'diamonds'), card('4')], expected: 1 },
    { hand: [...mixed(['3', '4', '5', '6', '7']), card('J'), card('2', 'spades')], expected: 3 },
  ])('returns $expected for $hand', ({ hand, expected }) => {
    expect(minPlays(hand)).toBe(expected);
    expect(minPlays([...hand].reverse())).toBe(expected);
  });

  it('finds two full houses where a greedy five-card choice requires four Plays', () => {
    const hand = [card('3'), card('3', 'spades'), card('3', 'hearts'), card('4'), card('4', 'spades'),
      card('4', 'hearts'), card('5'), card('5', 'spades'), card('6'), card('6', 'spades')];
    const greedyPlay = hand.slice(0, 5);
    expect(inspectCombination(greedyPlay, defaultRuleset).valid).toBe(true);
    expect(1 + minPlays(hand.slice(5))).toBe(4);
    expect(minPlays(hand)).toBe(2);
    expect(minPlays([...hand, card('7'), card('7', 'spades'), card('7', 'hearts')])).toBe(3);
  });

  it('supports every size through 13 and repeated subset queries with shared memoization', () => {
    const hand = defaultRuleset.rankOrder.map((rank) => card(rank));
    const analyzer = createHandDecomposer(hand);
    for (let size = 0; size <= 13; size += 1) {
      const remaining = hand.slice(0, size);
      const expected = Math.floor(size / 5) + size % 5;
      expect(analyzer.minPlays(remaining)).toBe(expected);
      expect(analyzer.minPlays([...remaining].reverse())).toBe(minPlays(remaining));
    }
    expect(analyzer.minPlays()).toBe(5);
  });

  it('matches exhaustive unoptimized search for every subset of an overlapping small hand', () => {
    const hand = [card('3'), card('3', 'hearts'), card('4'), card('4', 'hearts'), card('5'), card('6'), card('7')];
    const analyzer = createHandDecomposer(hand);
    for (let mask = 0; mask < 1 << hand.length; mask += 1) {
      const subset = hand.filter((_, i) => (mask & (1 << i)) !== 0);
      expect(analyzer.minPlays(subset)).toBe(reference(subset));
    }
  });

  it.each([1, 42, 20260913])('matches exhaustive search on a seven-card hand with seed %s', (seed) => {
    let state = seed;
    const hand = shuffleDeck(createDeck(), { next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    } }).slice(0, 7);
    expect(minPlays(hand)).toBe(reference(hand));
  });

  it('rejects invalid subset queries and isolates the prepared hand from caller mutation', () => {
    const hand = [card('3'), card('3', 'hearts')];
    const analyzer = createHandDecomposer(hand);
    hand.pop();
    expect(analyzer.minPlays()).toBe(1);
    expect(() => analyzer.minPlays([card('4')])).toThrow('outside');
    expect(() => analyzer.minPlays([card('3'), card('3')])).toThrow('duplicate');
    expect(() => analyzer.minPlays([null as unknown as Card])).toThrow('invalid');
    expect(() => analyzer.minPlays(null as unknown as Card[])).toThrow('array');
  });
});

import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../src/domain';
import { defaultRuleset, generateLegalFreeLeadMoves } from '../../../src/engine';
import { prepareCombinationMasks } from '../../../src/ai/decomposition/prepareCombinationMasks';

const card = (rank: Rank, suit: Suit = 'clubs'): Card => ({ rank, suit });
const key = (cards: readonly Card[]) => cards.map((c) => `${c.rank}-${c.suit}`).sort().join(',');

describe('combination-mask preparation', () => {
  it('matches every Engine free-lead combination in a 13-card overlapping hand', () => {
    const hand = [card('3'), card('3', 'spades'), card('3', 'hearts'), card('3', 'diamonds'),
      card('4'), card('4', 'hearts'), card('5'), card('6'), card('7'), card('8'), card('9'), card('A'), card('2')];
    const prepared = prepareCombinationMasks(hand);
    const actual = prepared.combinationMasks.map((mask) => key(prepared.cards.filter((_, i) => (mask & (1 << i)) !== 0)));
    const expected = generateLegalFreeLeadMoves(hand, 'south', defaultRuleset).map((move) => key(move.cards));
    expect(actual.sort()).toEqual(expected.sort());
    expect(new Set(actual).size).toBe(actual.length);
    expect(prepared.fullMask).toBe(8191);
    expect(prepareCombinationMasks([...hand].reverse())).toEqual(prepared);
  });

  it.each<Rank[]>([
    ['A', '2', '3', '4', '5'], ['2', '3', '4', '5', '6'], ['J', 'Q', 'K', 'A', '2'],
  ])('includes special Straight %s exactly once even when same-suit', (...ranks) => {
    const { combinationMasks } = prepareCombinationMasks(ranks.map((rank) => card(rank)));
    expect(combinationMasks.filter((mask) => mask === 31)).toHaveLength(1);
  });

  it('rejects mixed-suit wraparounds and bare four-of-a-kind as Plays', () => {
    expect(prepareCombinationMasks([card('K'), card('A'), card('2'), card('3'), card('4', 'hearts')]).combinationMasks).not.toContain(31);
    expect(prepareCombinationMasks(['clubs', 'spades', 'hearts', 'diamonds'].map((suit) => card('3', suit as Suit))).combinationMasks).not.toContain(15);
  });

  it('supports empty hands without mutating caller cards', () => {
    expect(prepareCombinationMasks([])).toEqual({ cards: [], fullMask: 0, combinationMasks: [] });
    const hand = Object.freeze([Object.freeze(card('2')), Object.freeze(card('3'))]);
    prepareCombinationMasks(hand);
    expect(hand).toEqual([card('2'), card('3')]);
  });

  it('fails diagnostically for invalid input', () => {
    expect(() => prepareCombinationMasks([card('3'), card('3')])).toThrow('duplicate');
    expect(() => prepareCombinationMasks([{ rank: 'invalid', suit: 'clubs' } as unknown as Card])).toThrow('invalid card');
    expect(() => prepareCombinationMasks(Array(14).fill(card('3')))).toThrow('at most 13');
    expect(() => prepareCombinationMasks(null as unknown as Card[])).toThrow('at most 13');
  });
});

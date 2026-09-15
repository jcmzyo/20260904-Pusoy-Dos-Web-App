import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/domain';
import {
  cardKey, compareByRank, compareBySuit, moveKey, reconcileOrder, sortKeysByRank, sortKeysBySuit,
} from '../../../src/ui/primitives/handOrdering';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

describe('cardKey', () => {
  it('is a stable, unique token per physical card', () => {
    expect(cardKey(c('3', 'clubs'))).toBe('3-clubs');
    expect(cardKey(c('3', 'clubs'))).toBe(cardKey(c('3', 'clubs')));
    expect(cardKey(c('3', 'clubs'))).not.toBe(cardKey(c('3', 'spades')));
  });
});

describe('compareByRank (ui-ux.md §6: Rank 3 -> ... -> A -> 2, ties Clubs -> Spades -> Hearts -> Diamonds)', () => {
  it('orders by rank low to high, with 2 as the highest rank', () => {
    expect(compareByRank(c('3', 'clubs'), c('4', 'clubs'))).toBeLessThan(0);
    expect(compareByRank(c('A', 'clubs'), c('2', 'clubs'))).toBeLessThan(0);
    expect(compareByRank(c('2', 'clubs'), c('3', 'clubs'))).toBeGreaterThan(0);
  });

  it('breaks same-rank ties by suit order Clubs -> Spades -> Hearts -> Diamonds', () => {
    expect(compareByRank(c('5', 'clubs'), c('5', 'diamonds'))).toBeLessThan(0);
    expect(compareByRank(c('5', 'hearts'), c('5', 'spades'))).toBeGreaterThan(0);
    expect(compareByRank(c('5', 'clubs'), c('5', 'clubs'))).toBe(0);
  });
});

describe('compareBySuit (ui-ux.md §6: Clubs -> Spades -> Hearts -> Diamonds, within suit Rank 3 -> ... -> A -> 2)', () => {
  it('orders by suit first', () => {
    expect(compareBySuit(c('K', 'clubs'), c('3', 'diamonds'))).toBeLessThan(0);
    expect(compareBySuit(c('3', 'diamonds'), c('K', 'clubs'))).toBeGreaterThan(0);
  });

  it('breaks same-suit ties by rank', () => {
    expect(compareBySuit(c('3', 'hearts'), c('2', 'hearts'))).toBeLessThan(0);
    expect(compareBySuit(c('3', 'hearts'), c('3', 'hearts'))).toBe(0);
  });
});

describe('sortKeysByRank / sortKeysBySuit', () => {
  const hand: readonly Card[] = [c('2', 'hearts'), c('3', 'diamonds'), c('3', 'clubs'), c('A', 'spades')];

  it('produces the canonical Rank order', () => {
    expect(sortKeysByRank(hand)).toEqual(['3-clubs', '3-diamonds', 'A-spades', '2-hearts']);
  });

  it('produces the canonical Suit order', () => {
    expect(sortKeysBySuit(hand)).toEqual(['3-clubs', 'A-spades', '2-hearts', '3-diamonds']);
  });

  it('does not mutate the input array', () => {
    const copy = [...hand];
    sortKeysByRank(hand);
    sortKeysBySuit(hand);
    expect(hand).toEqual(copy);
  });
});

describe('moveKey', () => {
  const order = ['a', 'b', 'c', 'd'];

  it('moves a key to a target index, shifting the rest', () => {
    expect(moveKey(order, 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveKey(order, 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('clamps an out-of-range target index to the bounds', () => {
    expect(moveKey(order, 'a', 99)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveKey(order, 'd', -5)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('is a no-op reordering when the key is already at the target index', () => {
    expect(moveKey(order, 'b', 1)).toEqual(order);
  });
});

describe('reconcileOrder', () => {
  it('returns the same array reference when the key set is unchanged', () => {
    const order = ['a', 'b', 'c'];
    expect(reconcileOrder(order, new Set(order))).toBe(order);
  });

  it('drops keys no longer present while preserving relative order of the rest', () => {
    expect(reconcileOrder(['a', 'b', 'c'], new Set(['c', 'a']))).toEqual(['a', 'c']);
  });

  it('appends newly-seen keys at the end without disturbing existing order', () => {
    expect(reconcileOrder(['b', 'a'], new Set(['a', 'b', 'c']))).toEqual(['b', 'a', 'c']);
  });
});

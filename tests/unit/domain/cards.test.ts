import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/domain/cards/Card';
import type { Rank } from '../../../src/domain/cards/Rank';
import type { Suit } from '../../../src/domain/cards/Suit';

describe('Rank', () => {
  it('represents all 13 canonical rank values', () => {
    const ranks: Rank[] = [
      '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2',
    ];
    expect(ranks).toHaveLength(13);
    expect(new Set(ranks).size).toBe(13);
  });

  it('rejects an unsupported rank value at compile time', () => {
    // @ts-expect-error - 'Joker' is not a valid Rank
    const invalid: Rank = 'Joker';
    void invalid;
  });
});

describe('Suit', () => {
  it('represents all 4 canonical suit values', () => {
    const suits: Suit[] = ['clubs', 'spades', 'hearts', 'diamonds'];
    expect(suits).toHaveLength(4);
    expect(new Set(suits).size).toBe(4);
  });

  it('rejects an unsupported suit value at compile time', () => {
    // @ts-expect-error - 'stars' is not a valid Suit
    const invalid: Suit = 'stars';
    void invalid;
  });
});

describe('Card', () => {
  it('constructs a valid card from a rank and suit', () => {
    const card: Card = { rank: '3', suit: 'clubs' };
    expect(card.rank).toBe('3');
    expect(card.suit).toBe('clubs');
  });

  it('represents 3 of clubs, the canonical lowest card value', () => {
    const threeOfClubs: Card = { rank: '3', suit: 'clubs' };
    expect(threeOfClubs).toEqual({ rank: '3', suit: 'clubs' });
  });

  it('represents 2 of diamonds, the canonical highest card value', () => {
    const twoOfDiamonds: Card = { rank: '2', suit: 'diamonds' };
    expect(twoOfDiamonds).toEqual({ rank: '2', suit: 'diamonds' });
  });

  it('treats card identity as determined solely by rank and suit', () => {
    const a: Card = { rank: 'K', suit: 'hearts' };
    const b: Card = { rank: 'K', suit: 'hearts' };
    const differentSuit: Card = { rank: 'K', suit: 'spades' };
    const differentRank: Card = { rank: 'Q', suit: 'hearts' };

    expect(a).toEqual(b);
    expect(a).not.toEqual(differentSuit);
    expect(a).not.toEqual(differentRank);
  });

  it('exposes only rank and suit, with no UI, ownership, or AI metadata', () => {
    const card: Card = { rank: 'A', suit: 'spades' };
    expect(Object.keys(card).sort()).toEqual(['rank', 'suit']);
  });

  it('rejects a card with an unsupported rank at compile time', () => {
    // @ts-expect-error - 'Z' is not a valid Rank
    const invalid: Card = { rank: 'Z', suit: 'clubs' };
    void invalid;
  });

  it('rejects a card literal carrying extra non-domain fields at compile time', () => {
    // @ts-expect-error - Card must not carry UI/ownership/AI metadata
    const invalid: Card = { rank: '5', suit: 'hearts', selected: true };
    void invalid;
  });

  it('rejects reassigning rank or suit due to readonly fields at compile time', () => {
    const card: Card = { rank: '5', suit: 'hearts' };
    // @ts-expect-error - Card.rank is readonly and cannot be reassigned
    card.rank = '6';
    void card;
  });
});

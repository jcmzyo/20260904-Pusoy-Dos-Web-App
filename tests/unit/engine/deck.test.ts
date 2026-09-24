import { describe, expect, it } from 'vitest';
import { createDeck } from '../../../src/engine';

describe('createDeck', () => {
  it('contains exactly 52 unique cards with every canonical rank and suit once and no jokers', () => {
    const deck = createDeck();
    const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    const suits = ['clubs', 'spades', 'hearts', 'diamonds'];

    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((card) => `${card.rank}-${card.suit}`)).size).toBe(52);
    for (const rank of ranks) {
      for (const suit of suits) {
        expect(deck.filter((card) => card.rank === rank && card.suit === suit)).toEqual([
          { rank, suit },
        ]);
      }
    }
  });

  it('returns the same unshuffled card sequence on repeated construction', () => {
    const deck = createDeck();

    expect(deck[0]).toEqual({ rank: '3', suit: 'clubs' });
    expect(deck[51]).toEqual({ rank: '2', suit: 'diamonds' });
    expect(createDeck()).toEqual(deck);
    expect(createDeck()).toEqual(deck);
  });

  it('creates independent arrays and card objects on each call', () => {
    const first = createDeck();
    const second = createDeck();

    expect(first).not.toBe(second);
    for (let index = 0; index < first.length; index += 1) {
      expect(first[index]).not.toBe(second[index]);
    }
    first.reverse();
    first.pop();

    expect(second).toHaveLength(52);
    expect(createDeck()).toEqual(second);
  });
});

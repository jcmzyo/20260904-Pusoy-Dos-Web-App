import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/domain/cards/Card';
import type { Rank } from '../../../src/domain/cards/Rank';
import type { Suit } from '../../../src/domain/cards/Suit';

/**
 * True type-level exhaustiveness check for `Rank`.
 *
 * Unlike a hand-written literal array, this switch is checked by the
 * TypeScript compiler against the `Rank` union itself: if `Rank` ever
 * gains a member not handled by one of the `case` branches below, the
 * `default` branch's `rank` will no longer be assignable to `never`,
 * and `npm run typecheck` will fail. This catches drift between the
 * `Rank` type and this test suite that a plain array-length assertion
 * cannot detect.
 */
function assertExhaustiveRank(rank: Rank): void {
  switch (rank) {
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
    case '10':
    case 'J':
    case 'Q':
    case 'K':
    case 'A':
    case '2':
      return;
    default: {
      const exhaustiveCheck: never = rank;
      throw new Error(`Unhandled Rank value: ${String(exhaustiveCheck)}`);
    }
  }
}

/**
 * True type-level exhaustiveness check for `Suit`. See
 * `assertExhaustiveRank` above for why this catches type/test drift
 * that a hand-written literal array cannot.
 */
function assertExhaustiveSuit(suit: Suit): void {
  switch (suit) {
    case 'clubs':
    case 'spades':
    case 'hearts':
    case 'diamonds':
      return;
    default: {
      const exhaustiveCheck: never = suit;
      throw new Error(`Unhandled Suit value: ${String(exhaustiveCheck)}`);
    }
  }
}

describe('Rank', () => {
  it('represents all 13 canonical rank values', () => {
    const ranks: Rank[] = [
      '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2',
    ];
    expect(ranks).toHaveLength(13);
    expect(new Set(ranks).size).toBe(13);
  });

  it('has no rank values beyond the 13 canonical ones (type-level exhaustiveness)', () => {
    const ranks: Rank[] = [
      '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2',
    ];
    ranks.forEach((rank) => {
      expect(() => assertExhaustiveRank(rank)).not.toThrow();
    });
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

  it('has no suit values beyond the 4 canonical ones (type-level exhaustiveness)', () => {
    const suits: Suit[] = ['clubs', 'spades', 'hearts', 'diamonds'];
    suits.forEach((suit) => {
      expect(() => assertExhaustiveSuit(suit)).not.toThrow();
    });
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

  it('constructs 3♣, later used by the Engine as the canonical lowest card', () => {
    const threeOfClubs: Card = { rank: '3', suit: 'clubs' };
    expect(threeOfClubs).toEqual({ rank: '3', suit: 'clubs' });
  });

  it('constructs 2♦, later used by the Engine as the canonical highest card', () => {
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

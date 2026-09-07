import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../src/domain';
import { defaultRuleset } from '../../../src/engine/config/defaultRuleset';
import type { RulesetConfig } from '../../../src/engine/config/RulesetConfig';
import { compareRank, compareSingle, compareSuit } from '../../../src/engine/cards/cardComparison';

/**
 * A ruleset with a deliberately different rank/suit order than
 * `defaultRuleset`, used to prove the helpers are driven by the
 * injected `RulesetConfig` rather than a hardcoded assumption
 * (m1-task-breakdown.md T06 acceptance — "helpers use authoritative
 * RulesetConfig semantics").
 */
const reversedRuleset: RulesetConfig = {
  ...defaultRuleset,
  rankOrder: [...defaultRuleset.rankOrder].reverse(),
  suitOrder: [...defaultRuleset.suitOrder].reverse(),
};

function card(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

const allRanks = defaultRuleset.rankOrder;
const allSuits = defaultRuleset.suitOrder;

describe('compareRank', () => {
  it('places 3 as strictly lower than every other rank (requirements.md §2.2)', () => {
    allRanks
      .filter((rank) => rank !== '3')
      .forEach((rank) => {
        expect(compareRank('3', rank, defaultRuleset)).toBeLessThan(0);
        expect(compareRank(rank, '3', defaultRuleset)).toBeGreaterThan(0);
      });
  });

  it('places 2 as strictly higher than every other rank (requirements.md §2.2)', () => {
    allRanks
      .filter((rank) => rank !== '2')
      .forEach((rank) => {
        expect(compareRank('2', rank, defaultRuleset)).toBeGreaterThan(0);
        expect(compareRank(rank, '2', defaultRuleset)).toBeLessThan(0);
      });
  });

  it('returns 0 for equal ranks', () => {
    allRanks.forEach((rank) => {
      expect(compareRank(rank, rank, defaultRuleset)).toBe(0);
    });
  });

  it('orders the full canonical rank chain 3 < 4 < ... < A < 2', () => {
    for (let i = 0; i < allRanks.length - 1; i += 1) {
      const lower = allRanks[i] as Rank;
      const higher = allRanks[i + 1] as Rank;
      expect(compareRank(lower, higher, defaultRuleset)).toBeLessThan(0);
      expect(compareRank(higher, lower, defaultRuleset)).toBeGreaterThan(0);
    }
  });

  it('confirms A < 2 and 10 < J as explicit boundary assertions', () => {
    expect(compareRank('A', '2', defaultRuleset)).toBeLessThan(0);
    expect(compareRank('10', 'J', defaultRuleset)).toBeLessThan(0);
  });

  it('is antisymmetric: swapping arguments negates the result', () => {
    expect(compareRank('5', '9', defaultRuleset)).toBe(-compareRank('9', '5', defaultRuleset));
  });

  it('uses the configured rankOrder rather than a hardcoded order', () => {
    // Under a reversed ruleset, 3 becomes the highest and 2 becomes the lowest.
    expect(compareRank('3', '2', reversedRuleset)).toBeGreaterThan(0);
    expect(compareRank('2', '3', reversedRuleset)).toBeLessThan(0);
  });
});

describe('compareSuit', () => {
  it('orders the full canonical suit chain Clubs < Spades < Hearts < Diamonds (requirements.md §2.2)', () => {
    for (let i = 0; i < allSuits.length - 1; i += 1) {
      const lower = allSuits[i] as Suit;
      const higher = allSuits[i + 1] as Suit;
      expect(compareSuit(lower, higher, defaultRuleset)).toBeLessThan(0);
      expect(compareSuit(higher, lower, defaultRuleset)).toBeGreaterThan(0);
    }
  });

  it('places clubs as strictly lower than every other suit', () => {
    allSuits
      .filter((suit) => suit !== 'clubs')
      .forEach((suit) => {
        expect(compareSuit('clubs', suit, defaultRuleset)).toBeLessThan(0);
      });
  });

  it('places diamonds as strictly higher than every other suit', () => {
    allSuits
      .filter((suit) => suit !== 'diamonds')
      .forEach((suit) => {
        expect(compareSuit('diamonds', suit, defaultRuleset)).toBeGreaterThan(0);
      });
  });

  it('returns 0 for equal suits', () => {
    allSuits.forEach((suit) => {
      expect(compareSuit(suit, suit, defaultRuleset)).toBe(0);
    });
  });

  it('is antisymmetric: swapping arguments negates the result', () => {
    expect(compareSuit('clubs', 'hearts', defaultRuleset)).toBe(
      -compareSuit('hearts', 'clubs', defaultRuleset),
    );
  });

  it('uses the configured suitOrder rather than a hardcoded order', () => {
    // Under a reversed ruleset, clubs becomes the highest and diamonds the lowest.
    expect(compareSuit('clubs', 'diamonds', reversedRuleset)).toBeGreaterThan(0);
    expect(compareSuit('diamonds', 'clubs', reversedRuleset)).toBeLessThan(0);
  });
});

describe('compareSingle', () => {
  it('resolves same-rank Singles by suit (higher suit wins)', () => {
    expect(compareSingle(card('7', 'clubs'), card('7', 'diamonds'), defaultRuleset)).toBeLessThan(0);
    expect(compareSingle(card('7', 'diamonds'), card('7', 'clubs'), defaultRuleset)).toBeGreaterThan(0);
  });

  it('compares by rank first regardless of suit', () => {
    // Higher rank beats lower rank even with the "weakest" suit vs the "strongest" suit.
    expect(compareSingle(card('4', 'clubs'), card('3', 'diamonds'), defaultRuleset)).toBeGreaterThan(0);
  });

  it('confirms 3♣ is the lowest possible Single in the game', () => {
    const threeOfClubs = card('3', 'clubs');
    allRanks.forEach((rank) => {
      allSuits.forEach((suit) => {
        const other = card(rank, suit);
        if (rank === '3' && suit === 'clubs') {
          expect(compareSingle(threeOfClubs, other, defaultRuleset)).toBe(0);
        } else {
          expect(compareSingle(threeOfClubs, other, defaultRuleset)).toBeLessThan(0);
        }
      });
    });
  });

  it('confirms 2♦ is the highest possible Single in the game', () => {
    const twoOfDiamonds = card('2', 'diamonds');
    allRanks.forEach((rank) => {
      allSuits.forEach((suit) => {
        const other = card(rank, suit);
        if (rank === '2' && suit === 'diamonds') {
          expect(compareSingle(twoOfDiamonds, other, defaultRuleset)).toBe(0);
        } else {
          expect(compareSingle(twoOfDiamonds, other, defaultRuleset)).toBeGreaterThan(0);
        }
      });
    });
  });

  it('returns 0 only for an identical rank+suit pair', () => {
    expect(compareSingle(card('K', 'hearts'), card('K', 'hearts'), defaultRuleset)).toBe(0);
  });

  it('is antisymmetric: swapping arguments negates the result', () => {
    const a = card('9', 'spades');
    const b = card('9', 'hearts');
    expect(compareSingle(a, b, defaultRuleset)).toBe(-compareSingle(b, a, defaultRuleset));
  });

  it('uses the configured ruleset rather than a hardcoded suit order for tie-breaking', () => {
    // Under a reversed ruleset, clubs outranks diamonds for same-rank Singles.
    expect(compareSingle(card('7', 'clubs'), card('7', 'diamonds'), reversedRuleset)).toBeGreaterThan(0);
  });
});

describe('cardComparison — invariant safety', () => {
  it('throws on a Rank not present in the configured rankOrder', () => {
    const brokenRuleset: RulesetConfig = {
      ...defaultRuleset,
      rankOrder: defaultRuleset.rankOrder.filter((rank) => rank !== '3'),
    };
    expect(() => compareRank('3', '4', brokenRuleset)).toThrow();
  });

  it('throws on a Suit not present in the configured suitOrder', () => {
    const brokenRuleset: RulesetConfig = {
      ...defaultRuleset,
      suitOrder: defaultRuleset.suitOrder.filter((suit) => suit !== 'clubs'),
    };
    expect(() => compareSuit('clubs', 'spades', brokenRuleset)).toThrow();
  });
});

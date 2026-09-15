import { describe, expect, it } from 'vitest';
import type { Card, Combination } from '../../../src/domain';
import { getDisplayCards } from '../../../src/ui/primitives/combinationLabels';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

/** Builds a `Combination` whose `cards` are in a given (possibly non-canonical) submission order,
 *  the same as `inspectCombination` would produce from a player's/AI's own selection order. */
function combo(type: Combination['type'], cards: readonly Card[]): Combination {
  return { type, cards } as Combination;
}

describe(
  'getDisplayCards (requirements.md §2.4.1 house-rule Straight sequence; person\'s own follow-up request: ' +
    '"instead of 3,4,5,A,2, arrange it as A,2,3,4,5")',
  () => {
    it('leaves non-Straight combination types exactly in their own submission order', () => {
      const single = combo('single', [c('7', 'hearts')]);
      expect(getDisplayCards(single)).toEqual([c('7', 'hearts')]);

      // Submission order deliberately not rank-sorted; every other combination type is unaffected.
      const fullHouse = combo('fullHouse', [c('K', 'clubs'), c('7', 'hearts'), c('K', 'diamonds'), c('7', 'spades'), c('K', 'hearts')]);
      expect(getDisplayCards(fullHouse)).toEqual(fullHouse.cards);
    });

    it('reorders the special low Straight A-2-3-4-5 into its own ascending sequence, not domain Rank order', () => {
      // Domain Rank order (ui-ux.md §6) sorts this same hand as 3,4,5,A,2 - the exact example reported.
      const straight = combo('straight', [c('3', 'clubs'), c('4', 'hearts'), c('5', 'spades'), c('A', 'diamonds'), c('2', 'clubs')]);
      expect(getDisplayCards(straight)).toEqual([
        c('A', 'diamonds'), c('2', 'clubs'), c('3', 'clubs'), c('4', 'hearts'), c('5', 'spades'),
      ]);
    });

    it('reorders the special low Straight Flush 2-3-4-5-6 into its own ascending sequence', () => {
      const straightFlush = combo('straightFlush', [c('5', 'clubs'), c('3', 'clubs'), c('6', 'clubs'), c('2', 'clubs'), c('4', 'clubs')]);
      expect(getDisplayCards(straightFlush)).toEqual([
        c('2', 'clubs'), c('3', 'clubs'), c('4', 'clubs'), c('5', 'clubs'), c('6', 'clubs'),
      ]);
    });

    it('leaves a normal Straight in its own already-ascending order regardless of submission order', () => {
      const straight = combo('straight', [c('9', 'hearts'), c('6', 'clubs'), c('8', 'diamonds'), c('7', 'spades'), c('10', 'clubs')]);
      expect(getDisplayCards(straight)).toEqual([
        c('6', 'clubs'), c('7', 'spades'), c('8', 'diamonds'), c('9', 'hearts'), c('10', 'clubs'),
      ]);
    });

    it('places J-Q-K-A-2 in its own sequence order even though a naive domain Rank sort would scatter A and 2', () => {
      const straightFlush = combo('straightFlush', [c('2', 'diamonds'), c('J', 'diamonds'), c('A', 'diamonds'), c('K', 'diamonds'), c('Q', 'diamonds')]);
      expect(getDisplayCards(straightFlush)).toEqual([
        c('J', 'diamonds'), c('Q', 'diamonds'), c('K', 'diamonds'), c('A', 'diamonds'), c('2', 'diamonds'),
      ]);
    });

    it('throws rather than silently guessing an order for an impossible Straight/Straight Flush combination', () => {
      // Not a valid house-rule sequence (requirements.md §2.4.1 invalid wrap-around) - the Engine
      // guarantees this never actually reaches display, so a mismatch here is a contract violation.
      const impossible = combo('straight', [c('K', 'clubs'), c('A', 'hearts'), c('2', 'spades'), c('3', 'diamonds'), c('4', 'clubs')]);
      expect(() => getDisplayCards(impossible)).toThrow();
    });
  },
);

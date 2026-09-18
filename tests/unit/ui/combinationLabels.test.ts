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
    '"instead of 3,4,5,A,2, arrange it as A,2,3,4,5"; ui-ux.md §5.1 canonical order, M4-T12.5 correction: ' +
    'the combination\'s own power-determining card(s) always display rightmost)',
  () => {
    it('leaves a Single exactly as submitted (there is nothing to reorder)', () => {
      const single = combo('single', [c('7', 'hearts')]);
      expect(getDisplayCards(single)).toEqual([c('7', 'hearts')]);
    });

    it('orders a Pair by Suit low → high regardless of submission order', () => {
      const pair = combo('pair', [c('9', 'diamonds'), c('9', 'clubs')]);
      expect(getDisplayCards(pair)).toEqual([c('9', 'clubs'), c('9', 'diamonds')]);
    });

    it('orders a Triple by Suit low → high regardless of submission order', () => {
      const triple = combo('triple', [c('Q', 'hearts'), c('Q', 'clubs'), c('Q', 'spades')]);
      expect(getDisplayCards(triple)).toEqual([c('Q', 'clubs'), c('Q', 'spades'), c('Q', 'hearts')]);
    });

    it('orders a Flush by Rank low → high regardless of submission order', () => {
      const flush = combo('flush', [c('J', 'hearts'), c('3', 'hearts'), c('9', 'hearts'), c('5', 'hearts'), c('7', 'hearts')]);
      expect(getDisplayCards(flush)).toEqual([
        c('3', 'hearts'), c('5', 'hearts'), c('7', 'hearts'), c('9', 'hearts'), c('J', 'hearts'),
      ]);
    });

    it('orders a Full House as the Pair first, then the Triple (Suit low → high within each) — the Triple’s Rank alone determines Full House power, so it displays rightmost', () => {
      const fullHouse = combo('fullHouse', [c('K', 'clubs'), c('7', 'hearts'), c('K', 'diamonds'), c('7', 'spades'), c('K', 'hearts')]);
      expect(getDisplayCards(fullHouse)).toEqual([
        c('7', 'spades'), c('7', 'hearts'), c('K', 'clubs'), c('K', 'hearts'), c('K', 'diamonds'),
      ]);
    });

    it('orders a Four-of-a-Kind as the kicker first, then the four matching cards (Suit low → high) — the quad’s Rank alone determines Four-of-a-Kind power, so it displays rightmost', () => {
      const fourOfAKind = combo('fourOfAKind', [c('8', 'diamonds'), c('4', 'clubs'), c('8', 'hearts'), c('8', 'spades'), c('8', 'clubs')]);
      expect(getDisplayCards(fourOfAKind)).toEqual([
        c('4', 'clubs'), c('8', 'clubs'), c('8', 'spades'), c('8', 'hearts'), c('8', 'diamonds'),
      ]);
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

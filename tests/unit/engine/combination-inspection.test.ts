import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../src/domain';
import { defaultRuleset, inspectCombination } from '../../../src/engine';

const ranks: readonly Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const suits: readonly Suit[] = ['clubs', 'spades', 'hearts', 'diamonds'];
const deck: Card[] = ranks.flatMap((rank) => suits.map((suit) => ({ rank, suit })));
const clubThree: Card = { rank: '3', suit: 'clubs' };

function subsets(cards: readonly Card[], size: number): Card[][] {
  if (size === 0) return [[]];
  return cards.flatMap((card, index) =>
    subsets(cards.slice(index + 1), size - 1).map((rest) => [card, ...rest]),
  );
}

describe('inspectCombination', () => {
  it.each([
    { size: 1, type: 'single', total: 52, validCount: 52 },
    { size: 2, type: 'pair', total: 1326, validCount: 78 },
    { size: 3, type: 'triple', total: 22100, validCount: 52 },
  ])('classifies every $size-card deck subset, regardless of order', ({ size, type, total, validCount }) => {
    const selections = subsets(deck, size);
    expect(selections).toHaveLength(total);
    let recognized = 0;
    for (const cards of selections) {
      const equalRanks = new Set(cards.map((card) => card.rank)).size === 1;
      if (equalRanks) recognized += 1;
      for (const ordered of [cards, [...cards].reverse()]) {
        const result = inspectCombination(ordered, defaultRuleset);
        expect(result).toEqual(equalRanks
          ? { valid: true, combination: { type, cards: ordered } }
          : { valid: false, error: 'INVALID_COMBINATION' });
      }
    }
    expect(recognized).toBe(validCount);
  });

  it.each([0, 4, 6, 13, 52])('rejects unsupported size %i', (size) => {
    expect(inspectCombination(deck.slice(0, size), defaultRuleset)).toEqual({
      valid: false, error: 'UNSUPPORTED_CARD_COUNT',
    });
  });

  it.each([
    [clubThree, clubThree],
    [clubThree, { ...clubThree }],
    [clubThree, { rank: '3', suit: 'hearts' }, { ...clubThree }],
  ])('rejects duplicate physical cards: %j', (...cards) => {
    expect(inspectCombination(cards as Card[], defaultRuleset)).toEqual({
      valid: false, error: 'DUPLICATE_CARD',
    });
  });

  it.each([
    null, undefined, '3-clubs', 3, {}, [],
    { rank: '3' }, { suit: 'clubs' },
    { rank: 'joker', suit: 'clubs' }, { rank: 3, suit: 'clubs' },
    { rank: '3', suit: 'stars' }, { rank: '3', suit: null },
  ].map((malformed) => ({ malformed })))('rejects malformed card $malformed in every position', ({ malformed }) => {
    for (const size of [1, 2, 3, 5]) {
      for (let index = 0; index < size; index += 1) {
        const cards: unknown[] = deck.slice(0, size);
        cards[index] = malformed;
        expect(inspectCombination(cards as Card[], defaultRuleset)).toEqual({
          valid: false, error: 'INVALID_CARD',
        });
      }
    }
  });

  it.each([null, undefined, {}, '3-clubs', 1, { length: 1, 0: clubThree }])(
    'rejects a non-array collection %j', (cards) => {
      expect(inspectCombination(cards as unknown as Card[], defaultRuleset)).toEqual({
        valid: false, error: 'INVALID_CARDS',
      });
    },
  );

  it('rejects sparse arrays instead of skipping absent cards', () => {
    expect(inspectCombination(new Array<Card>(1), defaultRuleset)).toEqual({
      valid: false, error: 'INVALID_CARD',
    });
  });

  it('accepts frozen input, preserves its order, and returns independent card values', () => {
    const cards = Object.freeze([
      Object.freeze({ rank: '2', suit: 'diamonds' } as const),
      Object.freeze({ rank: '2', suit: 'clubs' } as const),
    ]);
    const result = inspectCombination(cards, defaultRuleset);
    expect(result).toEqual({ valid: true, combination: { type: 'pair', cards } });
    if (!result.valid) throw new Error('Expected a pair');
    expect(result.combination.cards).not.toBe(cards);
    expect(result.combination.cards[0]).not.toBe(cards[0]);
  });

  it('does not change a recognized result when the caller changes its input', () => {
    const cards = [{ rank: 'A', suit: 'hearts' }];
    const result = inspectCombination(cards as Card[], defaultRuleset);
    cards[0]!.rank = '3';
    cards.length = 0;
    expect(result).toEqual({
      valid: true,
      combination: { type: 'single', cards: [{ rank: 'A', suit: 'hearts' }] },
    });
  });

  it('recognizes combinations under a reordered ruleset without comparison or legality metadata', () => {
    const ruleset = {
      ...defaultRuleset,
      rankOrder: [...defaultRuleset.rankOrder].reverse(),
      suitOrder: [...defaultRuleset.suitOrder].reverse(),
    };
    // These selections lack the required opening 3 of clubs, but are valid combinations.
    for (const size of [1, 2, 3]) {
      const cards = suits.slice(0, size).map((suit) => ({ rank: '2' as const, suit }));
      expect(inspectCombination(cards, ruleset)).toEqual({
        valid: true,
        combination: { type: size === 1 ? 'single' : size === 2 ? 'pair' : 'triple', cards },
      });
    }
  });
});

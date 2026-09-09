import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../../src/domain';
import { createDeck, dealDeck, defaultRuleset, generateLegalOpeningMoves, inspectCombination, shuffleDeck } from '../../../src/engine';

const three: Card = { rank: '3', suit: 'clubs' };
const card = (rank: Rank, suit: Suit = 'clubs'): Card => ({ rank, suit });
const key = (cards: readonly Card[]): string => cards.map((value) => `${value.rank}-${value.suit}`).sort().join(',');

function reference(hand: readonly Card[]): string[] {
  const expected: string[] = [];
  for (let mask = 1; mask < 2 ** hand.length; mask += 1) {
    const cards = hand.filter((_, index) => (mask & (1 << index)) !== 0);
    if (cards.some((value) => value.rank === '3' && value.suit === 'clubs') &&
      inspectCombination(cards, defaultRuleset).valid) expected.push(key(cards));
  }
  return expected.sort();
}

describe('generateLegalOpeningMoves', () => {
  it('returns exactly the Single, three Pairs, and three Triples from all four threes', () => {
    const hand = [three, card('3', 'spades'), card('3', 'hearts'), card('3', 'diamonds')];
    const moves = generateLegalOpeningMoves(hand, 'west', defaultRuleset);

    expect(moves).toEqual([
      [hand[0]], [hand[0], hand[1]], [hand[0], hand[2]], [hand[0], hand[3]],
      [hand[0], hand[1], hand[2]], [hand[0], hand[1], hand[3]], [hand[0], hand[2], hand[3]],
    ].map((cards) => ({ kind: 'play', playerId: 'west', cards })));
  });

  it.each([
    { type: 'straight', cards: [three, card('4', 'hearts'), card('5'), card('6'), card('7')] },
    { type: 'straight', cards: [card('A'), card('2', 'diamonds'), three, card('4'), card('5')] },
    { type: 'straight', cards: [card('2'), three, card('4', 'spades'), card('5'), card('6')] },
    { type: 'flush', cards: [three, card('5'), card('8'), card('J'), card('2')] },
    { type: 'fullHouse', cards: [three, card('3', 'spades'), card('3', 'hearts'), card('7'), card('7', 'diamonds')] },
    { type: 'fullHouse', cards: [three, card('3', 'diamonds'), card('7'), card('7', 'spades'), card('7', 'hearts')] },
    { type: 'fourOfAKind', cards: [three, card('3', 'spades'), card('3', 'hearts'), card('3', 'diamonds'), card('2')] },
    { type: 'fourOfAKind', cards: [three, card('7'), card('7', 'spades'), card('7', 'hearts'), card('7', 'diamonds')] },
    { type: 'straightFlush', cards: [three, card('4'), card('5'), card('6'), card('7')] },
    { type: 'straightFlush', cards: [card('A'), card('2'), three, card('4'), card('5')] },
    { type: 'straightFlush', cards: [card('2'), three, card('4'), card('5'), card('6')] },
  ])('includes $type opening $cards exactly once', ({ type, cards }) => {
    const moves = generateLegalOpeningMoves(cards, 'south', defaultRuleset);
    const five = moves.filter((move) => move.cards.length === 5);

    expect(five).toEqual([{ kind: 'play', playerId: 'south', cards }]);
    expect(inspectCombination(five[0]!.cards, defaultRuleset)).toEqual({
      valid: true, combination: { type, cards },
    });
  });

  it.each([
    [card('K'), card('A'), card('2', 'hearts'), three, card('4')],
    [card('Q'), card('K'), card('A'), card('2', 'hearts'), three],
    [three, card('4'), card('5'), card('6'), card('8', 'diamonds')],
  ])('omits invalid five-card combinations %j', (...cards) => {
    expect(generateLegalOpeningMoves(cards, 'west', defaultRuleset)).toEqual([
      { kind: 'play', playerId: 'west', cards: [three] },
    ]);
  });

  it.each([
    [], [card('3', 'spades')], [card('4'), card('5'), card('6'), card('7'), card('8')],
  ])('returns no opening for a hand without 3-clubs %j', (...hand) => {
    expect(generateLegalOpeningMoves(hand, 'east', defaultRuleset)).toEqual([]);
  });

  it.each([0, 1, 15, 4294967295])('matches exhaustive subset enumeration for a dealt hand with seed %s', (seed) => {
    let state = seed;
    const deck = shuffleDeck(createDeck(), { next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    } });
    const dealt = dealDeck(deck, ['west', 'north', 'east', 'south']);
    for (const hand of dealt.hands) {
      const moves = generateLegalOpeningMoves(hand.cards, hand.playerId, defaultRuleset);
      expect(moves.map((move) => key(move.cards)).sort()).toEqual(reference(hand.cards));
      expect(new Set(moves.map((move) => key(move.cards))).size).toBe(moves.length);
      for (const move of moves) {
        expect(move.kind).toBe('play');
        expect(move.playerId).toBe(dealt.startingPlayerId);
        expect(move.cards).toContainEqual(three);
        expect(inspectCombination(move.cards, defaultRuleset).valid).toBe(true);
        for (const value of move.cards) expect(hand.cards).toContainEqual(value);
      }
    }
  });

  it('enumerates a combination-rich 13-card hand completely regardless of input order', () => {
    const hand = [three, card('3', 'spades'), card('3', 'hearts'), card('3', 'diamonds'),
      card('4'), card('4', 'hearts'), card('5'), card('6'), card('7'), card('8'), card('9'), card('A'), card('2')];
    const expected = reference(hand);
    for (let offset = 0; offset < hand.length; offset += 1) {
      const reordered = [...hand.slice(offset), ...hand.slice(0, offset)];
      const moves = generateLegalOpeningMoves(reordered, 'west', defaultRuleset);
      expect(moves.map((move) => key(move.cards)).sort()).toEqual(expected);
      expect(new Set(moves.map((move) => key(move.cards))).size).toBe(moves.length);
    }
  });

  it('is deterministic, accepts frozen inputs, and returns independent card values', () => {
    const hand = Object.freeze([Object.freeze({ ...three }), Object.freeze(card('3', 'hearts'))]);
    const first = generateLegalOpeningMoves(hand, 'west', defaultRuleset);
    const second = generateLegalOpeningMoves(hand, 'west', defaultRuleset);
    expect(first).toEqual(second);
    expect(first[0]!.cards[0]).not.toBe(hand[0]);
    expect(first[0]!.cards[0]).not.toBe(first[1]!.cards[0]);
    expect(first[0]!.cards).not.toBe(second[0]!.cards);
    expect(hand).toEqual([three, card('3', 'hearts')]);
  });

  it('rejects duplicate physical cards instead of generating duplicate Moves', () => {
    expect(() => generateLegalOpeningMoves([three, { ...three }], 'west', defaultRuleset)).toThrow('duplicate card');
  });

  it.each([null, undefined, {}, { rank: 'joker', suit: 'clubs' }, { rank: '3', suit: 'stars' }])(
    'rejects invalid card %j even when it would not be used in an opening', (invalid) => {
      expect(() => generateLegalOpeningMoves([three, invalid] as Card[], 'west', defaultRuleset)).toThrow('invalid card');
    },
  );

  it('rejects oversized, non-array, and sparse hands diagnostically', () => {
    expect(() => generateLegalOpeningMoves(createDeck().slice(0, 14), 'west', defaultRuleset)).toThrow('at most 13');
    expect(() => generateLegalOpeningMoves(null as unknown as Card[], 'west', defaultRuleset)).toThrow('at most 13');
    expect(() => generateLegalOpeningMoves(new Array<Card>(1), 'west', defaultRuleset)).toThrow('invalid card');
  });
});

import { describe, expect, it } from 'vitest';
import type { Card, Combination, Move, Rank, Suit } from '../../../src/domain';
import { canBeat, createDeck, defaultRuleset, generateLegalFreeLeadMoves, generateLegalResponseMoves, inspectCombination, shuffleDeck } from '../../../src/engine';

const card = (rank: Rank, suit: Suit = 'clubs'): Card => ({ rank, suit });
const key = (cards: readonly Card[]): string => cards.map((value) => `${value.rank}-${value.suit}`).sort().join(',');
function combination(cards: readonly Card[]): Combination {
  const result = inspectCombination(cards, defaultRuleset);
  if (!result.valid) throw new Error('Invalid test fixture');
  return result.combination;
}

// Enumerate the entire power set independently of the production size-based recursion.
function reference(hand: readonly Card[]): Combination[] {
  const combinations: Combination[] = [];
  for (let mask = 1; mask < 2 ** hand.length; mask += 1) {
    const cards = hand.filter((_, index) => (mask & (1 << index)) !== 0);
    const result = inspectCombination(cards, defaultRuleset);
    if (result.valid) combinations.push(result.combination);
  }
  return combinations;
}

function check(moves: readonly Move[], hand: readonly Card[], expected: readonly Combination[], passAllowed: boolean): void {
  expect(moves.filter((move) => move.kind === 'pass')).toEqual(passAllowed ? [{ kind: 'pass', playerId: 'west' }] : []);
  const plays = moves.filter((move) => move.kind === 'play');
  const keys = plays.map((move) => key(move.cards));
  expect(keys.sort()).toEqual(expected.map((value) => key(value.cards)).sort());
  expect(new Set(keys).size).toBe(plays.length);
  for (const move of moves) {
    expect(move.playerId).toBe('west');
    if (move.kind === 'play') {
      expect(inspectCombination(move.cards, defaultRuleset).valid).toBe(true);
      for (const value of move.cards) expect(hand).toContainEqual(value);
    }
  }
}

const richHand = [card('3'), card('3', 'spades'), card('3', 'hearts'), card('3', 'diamonds'),
  card('4'), card('4', 'hearts'), card('5'), card('6'), card('7'), card('8'), card('9'), card('A'), card('2')];
const currents = [
  [card('5', 'diamonds')],
  [card('5', 'spades'), card('5', 'diamonds')],
  [card('5', 'spades'), card('5', 'hearts'), card('5', 'diamonds')],
  [card('A', 'spades'), card('2', 'spades'), card('3', 'spades'), card('4', 'spades'), card('5', 'diamonds')],
  [card('3', 'spades'), card('5', 'spades'), card('8', 'spades'), card('J', 'spades'), card('2', 'spades')],
  [card('5', 'spades'), card('5', 'hearts'), card('5', 'diamonds'), card('6', 'hearts'), card('6', 'diamonds')],
  [card('5'), card('5', 'spades'), card('5', 'hearts'), card('5', 'diamonds'), card('6', 'diamonds')],
  [card('A', 'diamonds'), card('2', 'diamonds'), card('3', 'diamonds'), card('4', 'diamonds'), card('5', 'diamonds')],
].map(combination);

describe('complete candidate sets', () => {
  it('includes every category and every alternative kicker, pair, triple, and suit choice', () => {
    const expected = reference(richHand);
    expect(new Set(expected.map((value) => value.type))).toEqual(new Set([
      'single', 'pair', 'triple', 'straight', 'flush', 'fullHouse', 'fourOfAKind', 'straightFlush',
    ]));
    const moves = generateLegalFreeLeadMoves(richHand, 'west', defaultRuleset);
    check(moves, richHand, expected, false);
    expect(expected.filter((value) => value.type === 'fourOfAKind')).toHaveLength(9);
    expect(expected.filter((value) => value.type === 'fullHouse')).toHaveLength(4);
    expect(expected.filter((value) => value.type === 'pair')).toHaveLength(7);
    expect(expected.filter((value) => value.type === 'triple')).toHaveLength(4);
  });

  it.each(currents)('matches the full reference set responding to $type', (current) => {
    const occupied = new Set(current.cards.map((value) => key([value])));
    const hand = richHand.filter((value) => !occupied.has(key([value])));
    const expected = reference(hand).filter((value) => canBeat(value, current, defaultRuleset));
    check(generateLegalResponseMoves(hand, 'west', current, defaultRuleset), hand, expected, true);
  });

  it.each([0, 1, 15, 4294967295])('matches brute enumeration for all four hands and every opponent subset with seed %s', (seed) => {
    let state = seed;
    const deck = shuffleDeck(createDeck(), { next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    } });
    for (let seat = 0; seat < 4; seat += 1) {
      const hand = deck.slice(seat * 13, (seat + 1) * 13);
      const opponent = deck.slice(((seat + 1) % 4) * 13, ((seat + 1) % 4 + 1) * 13);
      const expected = reference(hand);
      check(generateLegalFreeLeadMoves(hand, 'west', defaultRuleset), hand, expected, false);
      for (const current of reference(opponent)) {
        check(generateLegalResponseMoves(hand, 'west', current, defaultRuleset), hand,
          expected.filter((value) => canBeat(value, current, defaultRuleset)), true);
      }
    }
  });

  it('preserves the candidate sets under hand reordering', () => {
    const current = combination([card('J', 'diamonds'), card('Q', 'diamonds'), card('K', 'diamonds'), card('A', 'diamonds'), card('2', 'hearts')]);
    const expected = reference(richHand);
    const beating = expected.filter((value) => canBeat(value, current, defaultRuleset));
    for (const hand of [richHand, [...richHand].reverse(), [...richHand.slice(5), ...richHand.slice(0, 5)]]) {
      check(generateLegalFreeLeadMoves(hand, 'west', defaultRuleset), hand, expected, false);
      check(generateLegalResponseMoves(hand, 'west', current, defaultRuleset), hand, beating, true);
    }
  });

  it('includes every five-card subset of a single-suit 13-card hand exactly once', () => {
    const hand = createDeck().filter((value) => value.suit === 'clubs');
    const moves = generateLegalFreeLeadMoves(hand, 'west', defaultRuleset);
    check(moves, hand, reference(hand), false);
    expect(moves.filter((move) => move.cards.length === 5)).toHaveLength(1287);
    expect(moves).toHaveLength(1300);
  });

  it('has no opening-card restriction and never allows a free-lead Pass', () => {
    const hand = [card('7'), card('7', 'spades'), card('7', 'hearts'), card('7', 'diamonds')];
    const moves = generateLegalFreeLeadMoves(hand, 'west', defaultRuleset);
    check(moves, hand, reference(hand), false);
    expect(moves).toHaveLength(14);
    expect(generateLegalFreeLeadMoves([], 'west', defaultRuleset)).toEqual([]);
    expect(generateLegalFreeLeadMoves([card('2', 'diamonds')], 'west', defaultRuleset)).toEqual([
      { kind: 'play', playerId: 'west', cards: [card('2', 'diamonds')] },
    ]);
  });

  it('returns Pass alone when no response exists and no Moves for an empty hand', () => {
    const current = combination([card('2', 'diamonds')]);
    check(generateLegalResponseMoves(richHand, 'west', current, defaultRuleset), richHand, [], true);
    check(generateLegalResponseMoves([], 'west', current, defaultRuleset), [], [], false);
  });

  it('is deterministic and does not mutate or alias inputs or other candidates', () => {
    const hand = Object.freeze([Object.freeze(card('7')), Object.freeze(card('7', 'hearts'))]);
    const first = generateLegalFreeLeadMoves(hand, 'west', defaultRuleset);
    const second = generateLegalFreeLeadMoves(hand, 'west', defaultRuleset);
    expect(first).toEqual(second);
    expect(first[0]!.cards[0]).not.toBe(hand[0]);
    expect(first[0]!.cards[0]).not.toBe(first[2]!.cards[0]);
    expect(first[0]!.cards).not.toBe(second[0]!.cards);
    expect(hand).toEqual([card('7'), card('7', 'hearts')]);
  });

  it.each([null, undefined, {}, new Array<Card>(1), [card('3'), card('3')], createDeck().slice(0, 14),
    [null], [undefined], [{}], [{ rank: 'joker', suit: 'clubs' }], [{ rank: '3', suit: 'stars' }]])(
    'rejects invalid authoritative hand %j diagnostically', (hand) => {
      expect(() => generateLegalFreeLeadMoves(hand as Card[], 'west', defaultRuleset)).toThrow();
    },
  );
});

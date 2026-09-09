import { describe, expect, it } from 'vitest';
import type { Card, Combination, Rank, Suit } from '../../../src/domain';
import { createDeck, defaultRuleset, generateLegalResponseMoves, inspectCombination } from '../../../src/engine';

const card = (rank: Rank, suit: Suit = 'clubs'): Card => ({ rank, suit });
function combination(cards: readonly Card[]): Combination {
  const result = inspectCombination(cards, defaultRuleset);
  if (!result.valid) throw new Error('Invalid test fixture');
  return result.combination;
}
function responses(hand: readonly Card[], current: readonly Card[]) {
  return generateLegalResponseMoves(hand, 'west', combination(current), defaultRuleset);
}
const pass = { kind: 'pass', playerId: 'west' };
const play = (cards: readonly Card[]) => ({ kind: 'play', playerId: 'west', cards });

describe('generateLegalResponseMoves', () => {
  it('allows voluntary Pass and only strictly stronger Singles by rank then suit', () => {
    const hand = [card('6', 'diamonds'), card('7'), card('7', 'diamonds'), card('8')];
    expect(responses(hand, [card('7', 'hearts')])).toEqual([pass, play([hand[2]!]), play([hand[3]!])]);
  });

  it('uses the highest suit for equal-rank Pairs and excludes other counts', () => {
    const hand = [card('7', 'spades'), card('7', 'diamonds'), card('8'), card('8', 'hearts'), card('8', 'diamonds')];
    expect(responses(hand, [card('7'), card('7', 'hearts')])).toEqual([
      pass, play(hand.slice(0, 2)), play([hand[2]!, hand[3]!]),
      play([hand[2]!, hand[4]!]), play([hand[3]!, hand[4]!]),
    ]);
    expect(responses([card('7'), card('7', 'hearts')], hand.slice(0, 2))).toEqual([pass]);
  });

  it('returns only higher-rank Triples', () => {
    const lower = [card('6'), card('6', 'spades'), card('6', 'hearts')];
    const higher = [card('8'), card('8', 'spades'), card('8', 'hearts')];
    expect(responses([...lower, ...higher], [card('7'), card('7', 'spades'), card('7', 'hearts')])).toEqual([pass, play(higher)]);
  });

  const categories = [
    [card('J'), card('Q'), card('K'), card('A'), card('2', 'hearts')],
    [card('3', 'diamonds'), card('5', 'diamonds'), card('8', 'diamonds'), card('J', 'diamonds'), card('A', 'diamonds')],
    [card('4'), card('4', 'diamonds'), card('4', 'hearts'), card('6'), card('6', 'spades')],
    [card('9'), card('9', 'spades'), card('9', 'hearts'), card('9', 'diamonds'), card('2', 'diamonds')],
    [card('A', 'spades'), card('2', 'spades'), card('3', 'spades'), card('4', 'spades'), card('5', 'spades')],
  ];
  for (let currentIndex = 0; currentIndex < categories.length; currentIndex += 1) {
    for (let candidateIndex = 0; candidateIndex < categories.length; candidateIndex += 1) {
      if (candidateIndex === currentIndex) continue;
      it(`obeys five-card hierarchy from category ${currentIndex} to ${candidateIndex}`, () => {
        const candidate = categories[candidateIndex]!;
        const current = categories[currentIndex]!;
        expect(responses(candidate, current)).toEqual(candidateIndex > currentIndex ? [pass, play(candidate)] : [pass]);
      });
    }
  }

  it.each([
    { weaker: [card('A'), card('2'), card('3'), card('4'), card('5', 'hearts')], stronger: [card('2', 'spades'), card('3', 'spades'), card('4', 'spades'), card('5', 'spades'), card('6', 'diamonds')] },
    { weaker: [card('A'), card('2'), card('3'), card('4'), card('5', 'hearts')], stronger: [card('A', 'spades'), card('2', 'spades'), card('3', 'spades'), card('4', 'spades'), card('5', 'diamonds')] },
    { weaker: [card('3'), card('5'), card('8'), card('A'), card('2')], stronger: [card('3', 'spades'), card('5', 'spades'), card('7', 'spades'), card('9', 'spades'), card('J', 'spades')] },
    { weaker: [card('3'), card('5'), card('7'), card('9'), card('J')], stronger: [card('4'), card('6'), card('8'), card('10'), card('Q')] },
    { weaker: [card('3'), card('3', 'spades'), card('3', 'hearts'), card('2'), card('2', 'spades')], stronger: [card('4'), card('4', 'spades'), card('4', 'hearts'), card('5'), card('5', 'spades')] },
    { weaker: [card('3'), card('3', 'spades'), card('3', 'hearts'), card('3', 'diamonds'), card('2')], stronger: [card('4'), card('4', 'spades'), card('4', 'hearts'), card('4', 'diamonds'), card('5')] },
    { weaker: [card('A', 'diamonds'), card('2', 'diamonds'), card('3', 'diamonds'), card('4', 'diamonds'), card('5', 'diamonds')], stronger: [card('2'), card('3'), card('4'), card('5'), card('6')] },
  ])('uses canonical same-category strength in both directions: $weaker', ({ weaker, stronger }) => {
    expect(combination(weaker).type).toBe(combination(stronger).type);
    expect(responses(stronger, weaker)).toEqual([pass, play(stronger)]);
    expect(responses(weaker, stronger)).toEqual([pass]);
  });

  it('returns only Pass for an unbeatable Single or a hand too short to respond', () => {
    expect(responses(categories[4]!, [card('2', 'diamonds')])).toEqual([pass]);
    expect(responses([card('10')], categories[0]!)).toEqual([pass]);
    expect(responses([], categories[0]!)).toEqual([]);
  });

  it('rejects malformed five-card subsets and does not treat four cards as a bomb', () => {
    expect(responses([card('K'), card('A'), card('2'), card('3'), card('4', 'hearts')], categories[1]!)).toEqual([pass]);
    expect(responses(categories[3]!.slice(0, 4), [card('2'), card('2', 'spades')])).toEqual([pass]);
  });

  it('is deterministic and does not mutate or alias frozen inputs', () => {
    const hand = Object.freeze([Object.freeze(card('8')), Object.freeze(card('9'))]);
    const current = Object.freeze({ type: 'single' as const, cards: Object.freeze([Object.freeze(card('7'))]) });
    const first = generateLegalResponseMoves(hand, 'west', current, defaultRuleset);
    expect(first).toEqual(generateLegalResponseMoves(hand, 'west', current, defaultRuleset));
    expect(first).toEqual([pass, play([card('8')]), play([card('9')])]);
    const move = first[1]!;
    if (move.kind !== 'play') throw new Error('Expected Play');
    expect(move.cards[0]).not.toBe(hand[0]);
  });

  it.each([null, new Array<Card>(1), [card('3'), card('3')], createDeck().slice(0, 14), [{ rank: 'joker', suit: 'clubs' }]])('rejects invalid authoritative hands %j', (hand) => {
    expect(() => responses(hand as Card[], [card('7')])).toThrow();
  });

  it.each([null, { type: 'pair', cards: [card('7')] }, { type: 'pair', cards: [card('7'), card('7')] }, { type: 'single', cards: [] }])('rejects malformed current combinations even with no candidates %j', (current) => {
    expect(() => generateLegalResponseMoves([], 'west', current as Combination, defaultRuleset)).toThrow('valid canonical current combination');
  });

  it('rejects overlap with the current combination instead of manufacturing an equality response', () => {
    expect(() => responses([card('7')], [card('7')])).toThrow('overlaps');
  });
});

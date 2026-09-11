import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/domain';
import { createDeck, dealDeck, shuffleDeck } from '../../../src/engine';

const playerIds = ['west', 'north', 'east', 'south'] as const;

describe('dealDeck', () => {
  it('deals exactly 13 cards to each of four players in round-robin order', () => {
    const deck = createDeck();
    const { hands, startingPlayerId } = dealDeck(deck, playerIds);

    expect(hands).toHaveLength(4);
    expect(hands.map((hand) => hand.playerId)).toEqual(playerIds);
    for (let seat = 0; seat < 4; seat += 1) {
      expect(hands[seat]!.cards).toHaveLength(13);
      for (let round = 0; round < 13; round += 1) {
        expect(hands[seat]!.cards[round]).toBe(deck[round * 4 + seat]);
      }
    }
    expect(startingPlayerId).toBe('west');
  });

  it.each([0, 1, 15, 4294967295])('conserves every card and reproduces a shuffled deal for seed %s', (seed) => {
    function shuffledDeck(): Card[] {
      let state = seed;
      return shuffleDeck(createDeck(), {
        next() {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          return state / 4294967296;
        },
      });
    }
    const deck = shuffledDeck();
    const result = dealDeck(deck, playerIds);
    const cards = result.hands.flatMap((hand) => hand.cards);

    expect(result.hands.map((hand) => hand.cards.length)).toEqual([13, 13, 13, 13]);
    expect(cards).toHaveLength(52);
    expect(new Set(cards.map((card) => `${card.rank}-${card.suit}`)).size).toBe(52);
    for (const card of deck) {
      expect(cards.filter((candidate) => candidate === card)).toHaveLength(1);
    }
    expect(dealDeck(shuffledDeck(), playerIds)).toEqual(result);
    expect(result.hands.filter((hand) => hand.cards.some((card) => card.rank === '3' && card.suit === 'clubs'))
      .map((hand) => hand.playerId)).toEqual([result.startingPlayerId]);
  });

  it.each(Array.from({ length: 52 }, (_, index) => index))('identifies the 3-clubs holder with the card at deck index %s', (index) => {
    const deck = createDeck();
    const threeOfClubs = deck[0]!;
    deck[0] = deck[index]!;
    deck[index] = threeOfClubs;
    const reorderedPlayers = ['south', 'east', 'north', 'west'];

    const result = dealDeck(deck, reorderedPlayers);

    expect(result.startingPlayerId).toBe(reorderedPlayers[index % 4]);
    expect(result.hands.find((hand) => hand.playerId === result.startingPlayerId)!.cards).toContain(threeOfClubs);
  });

  it('accepts frozen inputs without mutation and allocates independent hand arrays', () => {
    const deck = Object.freeze(createDeck().map((card) => Object.freeze(card)));
    const players = Object.freeze([...playerIds]);
    const first = dealDeck(deck, players);
    const second = dealDeck(deck, players);

    expect(deck).toEqual(createDeck());
    expect(players).toEqual(playerIds);
    expect(new Set(first.hands.map((hand) => hand.cards)).size).toBe(4);
    expect(first).toEqual(second);
    for (let seat = 0; seat < 4; seat += 1) {
      expect(first.hands[seat]!.cards).not.toBe(deck);
      expect(first.hands[seat]!.cards).not.toBe(second.hands[seat]!.cards);
    }
  });

  it.each([0, 1, 3, 5])('rejects %s players', (count) => {
    const players = Array.from({ length: count }, (_, index) => `player-${index}`);

    expect(() => dealDeck(createDeck(), players)).toThrow('Deal requires exactly four distinct player IDs.');
  });

  it('rejects duplicate player IDs', () => {
    expect(() => dealDeck(createDeck(), ['west', 'north', 'west', 'south']))
      .toThrow('Deal requires exactly four distinct player IDs.');
  });

  it.each([0, 1, 51, 53])('rejects a deck of %s cards', (count) => {
    const deck = [...createDeck(), createDeck()[0]!].slice(0, count);

    expect(() => dealDeck(deck, playerIds)).toThrow('Deal requires exactly 52 cards.');
  });

  it.each([0, 25, 51])('rejects duplicate physical cards replacing index %s without mutating inputs', (index) => {
    const deck = createDeck();
    deck[index] = { ...deck[1]! };
    const before = deck.map((card) => ({ ...card }));

    expect(() => dealDeck(deck, playerIds)).toThrow('invalid or duplicate card');
    expect(deck).toEqual(before);
    expect(playerIds).toEqual(['west', 'north', 'east', 'south']);
  });

  it('rejects a nonstandard card even when all 52 identities are distinct', () => {
    const deck = createDeck();
    deck[51] = { rank: 'joker', suit: 'clubs' } as unknown as Card;

    expect(() => dealDeck(deck, playerIds)).toThrow('invalid or duplicate card: joker-clubs');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createDeck, shuffleDeck } from '../../../src/engine';
import type { RNG } from '../../../src/engine';

function seededRng(seed: number): RNG {
  let state = seed;
  return {
    next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    },
  };
}

describe('shuffleDeck', () => {
  it('reproduces the same order with the same seed and can differ with another seed', () => {
    const first = shuffleDeck(createDeck(), seededRng(14));

    expect(shuffleDeck(createDeck(), seededRng(14))).toEqual(first);
    expect(shuffleDeck(createDeck(), seededRng(15))).not.toEqual(first);
    expect(first).not.toEqual(createDeck());
  });

  it('uses the injected sequence to produce the expected permutation', () => {
    const deck = createDeck().slice(0, 4);
    const next = vi.fn().mockReturnValueOnce(0.5).mockReturnValueOnce(0).mockReturnValueOnce(0.75);

    expect(shuffleDeck(deck, { next })).toEqual([deck[3], deck[1], deck[0], deck[2]]);
    expect(next).toHaveBeenCalledTimes(3);
  });

  it.each([0, 1, 14, 4294967295])('preserves all 52 card identities and objects for seed %s', (seed) => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck, seededRng(seed));

    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map((card) => `${card.rank}-${card.suit}`)).size).toBe(52);
    for (const card of deck) {
      expect(shuffled.filter((candidate) => candidate === card)).toHaveLength(1);
    }
  });

  it('leaves the input array and cards unchanged and returns a fresh array', () => {
    const deck = Object.freeze(createDeck().map((card) => Object.freeze(card)));
    const shuffled = shuffleDeck(deck, seededRng(14));

    expect(shuffled).not.toBe(deck);
    expect(deck).toEqual(createDeck());
  });

  it('accepts zero and values just below one, including self-swaps', () => {
    const deck = createDeck();
    const next = vi.fn(() => 1 - Number.EPSILON);

    expect(shuffleDeck(deck, { next })).toEqual(deck);
    expect(next).toHaveBeenCalledTimes(51);
    expect(shuffleDeck(deck, { next: () => 0 })).toEqual([...deck.slice(1), deck[0]]);
  });

  it('returns fresh empty and singleton arrays without consuming randomness', () => {
    const next = vi.fn(() => { throw new Error('Unexpected RNG call'); });
    for (const deck of [[], createDeck().slice(0, 1)]) {
      const shuffled = shuffleDeck(deck, { next });
      expect(shuffled).toEqual(deck);
      expect(shuffled).not.toBe(deck);
    }
    expect(next).not.toHaveBeenCalled();
  });

  it.each([-0.01, 1, 2, NaN, Infinity, -Infinity])('rejects invalid RNG value %s without mutating the input', (value) => {
    const deck = createDeck();
    const next = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(value);

    expect(() => shuffleDeck(deck, { next })).toThrow('RNG.next() must return a finite number in [0, 1).');
    expect(deck).toEqual(createDeck());
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('propagates RNG failures without mutating the input', () => {
    const deck = createDeck();
    const error = new Error('RNG exhausted');
    const next = vi.fn().mockReturnValueOnce(0).mockImplementationOnce(() => { throw error; });

    expect(() => shuffleDeck(deck, { next })).toThrow(error);
    expect(deck).toEqual(createDeck());
  });

  it('does not use global Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Uncontrolled randomness'); });
    try {
      expect(shuffleDeck(createDeck(), seededRng(14))).toHaveLength(52);
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });
});

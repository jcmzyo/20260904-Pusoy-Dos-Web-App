import { describe, expect, it } from 'vitest';
import type { Card, Combination, CombinationType, Rank, Suit } from '../../../src/domain';
import { canBeat, defaultRuleset, inspectCombination } from '../../../src/engine';

const suits: readonly Suit[] = ['clubs', 'spades', 'hearts', 'diamonds'];
const suited = (ranks: readonly Rank[], suit: Suit): Card[] => ranks.map((rank) => ({ rank, suit }));
const group = (rank: Rank, selection: readonly Suit[]): Card[] => selection.map((suit) => ({ rank, suit }));
const order = ['straight', 'flush', 'fullHouse', 'fourOfAKind', 'straightFlush'] as const;
const weak: Record<typeof order[number], Card[]> = {
  straight: [...suited(['3', '4', '5', '6'], 'clubs'), { rank: '7', suit: 'spades' }],
  flush: suited(['3', '4', '5', '6', '8'], 'clubs'),
  fullHouse: [...group('3', suits.slice(0, 3)), ...group('4', ['hearts', 'diamonds'])],
  fourOfAKind: [...group('3', suits), { rank: '4', suit: 'clubs' }],
  straightFlush: suited(['3', '4', '5', '6', '7'], 'spades'),
};
const strong: Record<typeof order[number], Card[]> = {
  straight: [...suited(['J', 'Q', 'K', 'A'], 'hearts'), { rank: '2', suit: 'diamonds' }],
  flush: suited(['9', 'J', 'Q', 'A', '2'], 'diamonds'),
  fullHouse: [...group('2', suits.slice(0, 3)), ...group('A', ['spades', 'hearts'])],
  fourOfAKind: [...group('2', suits), { rank: 'K', suit: 'clubs' }],
  straightFlush: suited(['9', '10', 'J', 'Q', 'K'], 'clubs'),
};

function combination(type: CombinationType, cards: readonly Card[]): Combination {
  const result = inspectCombination(cards, defaultRuleset);
  if (!result.valid) throw new Error(`Invalid test fixture: ${result.error}`);
  expect(result.combination.type).toBe(type);
  return Object.freeze({ type, cards: Object.freeze(cards.map((card) => Object.freeze({ ...card }))) });
}

function expectDisjoint(a: Combination, b: Combination): void {
  const cards = [...a.cards, ...b.cards];
  expect(new Set(cards.map((card) => `${card.rank}-${card.suit}`)).size).toBe(cards.length);
}

describe('cross-category response comparison', () => {
  const matchups = order.flatMap((lower, i) => order.slice(i + 1).map((higher) => ({ lower, higher })));

  it.each(matchups)('$higher beats $lower regardless of internal rank and suit strength', ({ lower, higher }) => {
    const current = combination(lower, strong[lower]);
    const candidate = combination(higher, weak[higher]);
    expectDisjoint(candidate, current);
    expect(canBeat(candidate, current, defaultRuleset)).toBe(true);
    expect(canBeat(current, candidate, defaultRuleset)).toBe(false);
    expect(canBeat({ ...candidate, cards: [...candidate.cards].reverse() }, { ...current, cards: [...current.cards].reverse() }, defaultRuleset)).toBe(true);
    expect(candidate.cards).toEqual(weak[higher]);
    expect(current.cards).toEqual(strong[lower]);
  });

  it.each(order)('%s cannot answer a Single, Pair, or Triple in either direction', (type) => {
    const five = combination(type, strong[type]);
    for (const [i, smallType] of (['single', 'pair', 'triple'] as const).entries()) {
      const small = combination(smallType, group('8', suits.slice(0, i + 1)));
      expectDisjoint(five, small);
      expect(canBeat(five, small, defaultRuleset)).toBe(false);
      expect(canBeat(small, five, defaultRuleset)).toBe(false);
    }
  });

  it('does not mix Single, Pair, and Triple responses', () => {
    const hands = [
      combination('single', group('2', ['diamonds'])),
      combination('pair', group('A', ['clubs', 'spades'])),
      combination('triple', group('3', suits.slice(0, 3))),
    ];
    for (const a of hands) for (const b of hands) {
      if (a === b) continue;
      expectDisjoint(a, b);
      expect(canBeat(a, b, defaultRuleset)).toBe(false);
    }
  });

  it('uses the supplied five-card order', () => {
    const straight = combination('straight', strong.straight);
    const flush = combination('flush', weak.flush);
    expectDisjoint(straight, flush);
    const ruleset = { ...defaultRuleset, fiveCardOrder: ['flush', 'straight', 'fullHouse', 'fourOfAKind', 'straightFlush'] as const };
    expect(canBeat(straight, flush, ruleset)).toBe(true);
    expect(canBeat(flush, straight, ruleset)).toBe(false);
  });

  it('rejects malformed or noncanonical combinations before comparing categories or sizes', () => {
    const valid = combination('flush', weak.flush);
    const malformed: Combination[] = [
      { type: 'straightFlush', cards: weak.flush },
      { type: 'straight', cards: weak.straightFlush },
      { type: 'fourOfAKind', cards: group('3', suits) },
      { type: 'single', cards: [] },
      { type: 'pair', cards: group('3', ['clubs', 'clubs']) },
      { type: 'single', cards: [{ rank: 'joker', suit: 'clubs' } as unknown as Card] },
      { type: 'flush', cards: weak.straight },
    ];
    for (const invalid of malformed) {
      expect(() => canBeat(invalid, valid, defaultRuleset)).toThrow('valid canonical combinations');
      expect(() => canBeat(valid, invalid, defaultRuleset)).toThrow('valid canonical combinations');
    }
  });
});

import { describe, expect, it } from 'vitest';
import type { Card, Combination, Rank, Suit } from '../../../src/domain';
import { compareSameCategoryCombinations, defaultRuleset, inspectCombination } from '../../../src/engine';

const ranks: readonly Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const suits: readonly Suit[] = ['clubs', 'spades', 'hearts', 'diamonds'];
const suited = (selection: readonly Rank[], suit: Suit = 'clubs'): Card[] => selection.map((rank) => ({ rank, suit }));
const group = (rank: Rank, selection: readonly Suit[]): Card[] => selection.map((suit) => ({ rank, suit }));
const fullHouse = (rank: Rank, pair: Rank): Card[] => [...group(rank, suits.slice(0, 3)), ...group(pair, suits.slice(2))];
const quad = (rank: Rank, kicker: Rank): Card[] => [...group(rank, suits), { rank: kicker, suit: 'clubs' }];
const sequences: readonly (readonly Rank[])[] = [
  ['A', '2', '3', '4', '5'], ['2', '3', '4', '5', '6'],
  ['3', '4', '5', '6', '7'], ['4', '5', '6', '7', '8'],
  ['5', '6', '7', '8', '9'], ['6', '7', '8', '9', '10'],
  ['7', '8', '9', '10', 'J'], ['8', '9', '10', 'J', 'Q'],
  ['9', '10', 'J', 'Q', 'K'], ['10', 'J', 'Q', 'K', 'A'],
  ['J', 'Q', 'K', 'A', '2'],
];

function combination(cards: readonly Card[]): Combination {
  const result = inspectCombination(cards, defaultRuleset);
  if (!result.valid) throw new Error(`Invalid test fixture: ${result.error}`);
  return result.combination;
}

function disjoint(a: readonly Card[], b: readonly Card[]): boolean {
  return !a.some((left) => b.some((right) => left.rank === right.rank && left.suit === right.suit));
}

function compare(a: readonly Card[], b: readonly Card[], ruleset = defaultRuleset): number {
  expect(disjoint(a, b), 'Opposing combinations must not share physical cards').toBe(true);
  const left = combination(a);
  const right = combination(b);
  const result = Math.sign(compareSameCategoryCombinations(left, right, ruleset));
  expect(Math.sign(compareSameCategoryCombinations({ ...left, cards: [...a].reverse() }, { ...right, cards: [...b].reverse() }, ruleset))).toBe(result);
  return result;
}

describe('same-category combination comparison', () => {
  it.each([1, 2, 3])('compares all ranks for %i-card combinations before suits', (size) => {
    for (const [i, a] of ranks.entries()) for (const [j, b] of ranks.entries()) {
      if (i === j) continue;
      const left = group(a, suits.slice(0, size));
      const right = group(b, suits.slice(0, size));
      expect(compare(left, right)).toBe(Math.sign(i - j));
      if (i !== j) expect(compare(left, group(b, suits.slice(4 - size)))).toBe(Math.sign(i - j));
    }
  });

  it('breaks Single ties by suit and Pair ties by the higher card in either input order', () => {
    for (const [i, a] of suits.entries()) for (const [j, b] of suits.entries()) {
      if (i === j) continue;
      expect(compare(group('7', [a]), group('7', [b]))).toBe(Math.sign(i - j));
    }
    const pairs = suits.flatMap((a, i) => suits.slice(i + 1).map((b) => [a, b]));
    for (const a of pairs) for (const b of pairs) {
      if (a.some((suit) => b.includes(suit))) continue;
      const expected = Math.sign(suits.indexOf(a[1]!) - suits.indexOf(b[1]!));
      expect(compare(group('7', a), group('7', b))).toBe(expected);
      expect(compare(group('7', [...a].reverse()), group('7', [...b].reverse()))).toBe(expected);
    }
    expect(compare(group('7', ['clubs', 'diamonds']), group('7', ['spades', 'hearts']))).toBe(1);
  });

  it('compares different-rank Triples independently of their suit selections', () => {
    for (const absentA of suits) for (const absentB of suits) {
      expect(compare(group('7', suits.filter((suit) => suit !== absentA)), group('6', suits.filter((suit) => suit !== absentB)))).toBe(1);
    }
  });

  it.each(['straight', 'straightFlush'] as const)('compares disjoint %s sequences and effective-high suits', (type) => {
    const hand = (selection: readonly Rank[], suit: Suit): Card[] => selection.map((rank, i) => ({
      rank, suit: type === 'straight' && i === 0 ? suits[(suits.indexOf(suit) + 1) % 4]! : suit,
    }));
    for (const [i, a] of sequences.entries()) for (const [j, b] of sequences.entries()) {
      for (const [s, aSuit] of suits.entries()) for (const [t, bSuit] of suits.entries()) {
        const left = combination(hand(a, aSuit));
        const right = combination(hand(b, bSuit));
        if (!disjoint(left.cards, right.cards)) continue;
        expect(left.type).toBe(type);
        expect(right.type).toBe(type);
        expect(compare(left.cards, right.cards)).toBe(Math.sign(i - j || s - t));
      }
    }
  });

  it('uses effective-high suits over other suits in Straights, including low A and 2', () => {
    for (const sequence of sequences) {
      const left = sequence.map((rank, i) => ({ rank, suit: i === 4 ? 'hearts' as const : 'clubs' as const }));
      const right = sequence.map((rank, i) => ({ rank, suit: i === 4 ? 'spades' as const : 'diamonds' as const }));
      expect(compare(left, right)).toBe(1);
      expect(compare(right, left)).toBe(-1);
    }
  });

  it('compares Flush suits before ranks in both directions', () => {
    for (const [i, a] of suits.entries()) for (const [j, b] of suits.entries()) {
      if (i === j) continue;
      expect(compare(suited(['3', '4', '5', '6', '8'], a), suited(['10', 'J', 'Q', 'A', '2'], b))).toBe(Math.sign(i - j));
    }
  });

  it('compares disjoint same-suit Flushes by highest rank, including 2 above A', () => {
    for (const suit of suits) {
      const stronger = suited(['2', 'K', 'J', '9', '7'], suit);
      const weaker = suited(['A', 'Q', '10', '8', '6'], suit);
      expect(compare(weaker, stronger)).toBe(-1);
      expect(compare(stronger, weaker)).toBe(1);
    }
  });

  it.each(['fullHouse', 'fourOfAKind'] as const)('compares %s by matching rank alone', (type) => {
    const hand = type === 'fullHouse' ? fullHouse : quad;
    for (const [i, a] of ranks.entries()) for (const [j, b] of ranks.entries()) {
      if (i === j) continue;
      const remaining = ranks.filter((rank) => rank !== a && rank !== b);
      expect(compare(hand(a, remaining[0]!), hand(b, remaining[remaining.length - 1]!))).toBe(Math.sign(i - j));
      expect(compare(hand(a, remaining[remaining.length - 1]!), hand(b, remaining[0]!))).toBe(Math.sign(i - j));
    }
  });

  it('compares identical inputs for all categories without modeling opposing plays or mutating frozen inputs', () => {
    const hands = [
      group('2', ['clubs']), group('2', ['clubs', 'diamonds']), group('2', suits.slice(0, 3)),
      sequences[0]!.map((rank, i) => ({ rank, suit: suits[i % 4]! })),
      suited(['2', 'K', 'J', '9', '7']), fullHouse('2', '3'), quad('2', '3'), suited(sequences[0]!),
    ];
    for (const cards of hands) {
      const original = combination(cards);
      const frozen = Object.freeze({ ...original, cards: Object.freeze(original.cards.map((card) => Object.freeze(card))) });
      expect(compareSameCategoryCombinations(frozen, frozen, defaultRuleset)).toBe(0);
      expect(compareSameCategoryCombinations(frozen, combination([...cards].reverse()), defaultRuleset)).toBe(0);
      expect(frozen.cards).toEqual(cards);
    }
  });

  it('consumes configured rank and suit order', () => {
    const ruleset = { ...defaultRuleset, rankOrder: [...ranks].reverse(), suitOrder: [...suits].reverse() };
    expect(compare(group('3', ['clubs', 'spades']), group('2', ['clubs', 'spades']), ruleset)).toBeGreaterThan(0);
    expect(compare(group('7', ['clubs', 'diamonds']), group('7', ['spades', 'hearts']), ruleset)).toBeGreaterThan(0);
    expect(compare(suited(['2', 'K', 'J', '9', '7']), suited(['A', 'Q', '10', '8', '6']), ruleset)).toBeLessThan(0);
  });

  it('rejects mismatched categories and forged combinations diagnostically', () => {
    const single = combination(group('3', ['clubs']));
    const pair = combination(group('3', ['clubs', 'spades']));
    expect(() => compareSameCategoryCombinations(single, pair, defaultRuleset)).toThrow('matching categories');
    expect(() => compareSameCategoryCombinations(combination(suited(sequences[0]!)), combination(suited(['3', '4', '5', '6', '8'])), defaultRuleset)).toThrow('matching categories');
    const malformed: Combination[] = [
      { type: 'pair', cards: single.cards },
      { type: 'pair', cards: [...single.cards, ...single.cards] },
      { type: 'pair', cards: [{ rank: 'joker', suit: 'clubs' } as unknown as Card] },
      { type: 'straight', cards: suited(sequences[0]!) },
      { type: 'triple', cards: [] },
    ];
    for (const invalid of malformed) {
      expect(() => compareSameCategoryCombinations(invalid, pair, defaultRuleset)).toThrow('valid canonical combinations');
      expect(() => compareSameCategoryCombinations(pair, invalid, defaultRuleset)).toThrow('valid canonical combinations');
    }
  });
});

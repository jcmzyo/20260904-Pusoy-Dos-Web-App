import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/domain/cards/Card';
import type { Combination } from '../../../src/domain/combinations/Combination';
import type { CombinationType } from '../../../src/domain/combinations/CombinationType';

/**
 * True type-level exhaustiveness check for `CombinationType`. See
 * `assertExhaustiveRank` in cards.test.ts for why a compiler-checked
 * switch catches type/test drift that a hand-written literal array
 * cannot.
 */
function assertExhaustiveCombinationType(type: CombinationType): void {
  switch (type) {
    case 'single':
    case 'pair':
    case 'triple':
    case 'straight':
    case 'flush':
    case 'fullHouse':
    case 'fourOfAKind':
    case 'straightFlush':
      return;
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unhandled CombinationType value: ${String(exhaustiveCheck)}`);
    }
  }
}

describe('CombinationType', () => {
  it('represents exactly the 8 canonical v1 combination categories', () => {
    const types: CombinationType[] = [
      'single', 'pair', 'triple', 'straight', 'flush', 'fullHouse',
      'fourOfAKind', 'straightFlush',
    ];
    expect(types).toHaveLength(8);
    expect(new Set(types).size).toBe(8);
  });

  it('has no combination values beyond the 8 canonical ones (type-level exhaustiveness)', () => {
    const types: CombinationType[] = [
      'single', 'pair', 'triple', 'straight', 'flush', 'fullHouse',
      'fourOfAKind', 'straightFlush',
    ];
    types.forEach((type) => {
      expect(() => assertExhaustiveCombinationType(type)).not.toThrow();
    });
  });

  it('rejects an unsupported combination type at compile time', () => {
    // @ts-expect-error - 'bomb' is not a valid CombinationType (it is a
    // Competitive scoring term, not a combination category; see
    // requirements.md §1.4)
    const invalid: CombinationType = 'bomb';
    void invalid;
  });
});

describe('Combination', () => {
  const threeOfClubs: Card = { rank: '3', suit: 'clubs' };
  const fourOfClubs: Card = { rank: '4', suit: 'clubs' };

  it('constructs a Combination value from a type and its cards', () => {
    const single: Combination = { type: 'single', cards: [threeOfClubs] };
    expect(single.type).toBe('single');
    expect(single.cards).toEqual([threeOfClubs]);
  });

  it('does not itself imply the cards are a valid/legal combination', () => {
    // domain-model.md §9: constructing this object does not prove
    // validity. A shared Combination is only a description; nothing at
    // this layer rejects a mismatched type/cards pairing, because
    // authoritative detection belongs to the Game Engine.
    const mismatched: Combination = { type: 'pair', cards: [threeOfClubs] };
    expect(mismatched.type).toBe('pair');
    expect(mismatched.cards).toHaveLength(1);
  });

  it('exposes only type and cards, with no engine comparison metadata', () => {
    const combo: Combination = { type: 'pair', cards: [threeOfClubs, fourOfClubs] };
    expect(Object.keys(combo).sort()).toEqual(['cards', 'type']);
  });

  it('rejects a Combination literal carrying engine-only strength metadata at compile time', () => {
    // @ts-expect-error - CombinationStrength/comparison metadata is
    // engine-owned (engine.md §12) and must not leak into the shared
    // domain Combination type (domain-model.md §9.1)
    const invalid: Combination = { type: 'single', cards: [threeOfClubs], strength: 3 };
    void invalid;
  });

  it('rejects reassigning type or cards due to readonly fields at compile time', () => {
    const combo: Combination = { type: 'single', cards: [threeOfClubs] };
    // @ts-expect-error - Combination.type is readonly and cannot be reassigned
    combo.type = 'pair';
    void combo;
  });
});

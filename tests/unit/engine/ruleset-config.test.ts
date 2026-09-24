import { describe, expect, it } from 'vitest';
import type { Rank } from '../../../src/domain';
import { defaultRuleset } from '../../../src/engine/config/defaultRuleset';
import type { RulesetConfig } from '../../../src/engine/config/RulesetConfig';
import type { StraightPattern } from '../../../src/engine/config/StraightRules';

/**
 * The 11 valid house-rule Straights, ordered weakest to strongest, used
 * here as the independent expected fixture for `defaultRuleset`. This is
 * intentionally re-derived from requirements.md §2.4.1 rather than
 * imported from production code, so this test can actually catch a
 * transcription error in `defaultRuleset.ts`.
 */
const expectedStraightSequences: ReadonlyArray<{
  readonly ranks: readonly Rank[];
  readonly effectiveHighRank: Rank;
}> = [
  { ranks: ['A', '2', '3', '4', '5'], effectiveHighRank: '5' },
  { ranks: ['2', '3', '4', '5', '6'], effectiveHighRank: '6' },
  { ranks: ['3', '4', '5', '6', '7'], effectiveHighRank: '7' },
  { ranks: ['4', '5', '6', '7', '8'], effectiveHighRank: '8' },
  { ranks: ['5', '6', '7', '8', '9'], effectiveHighRank: '9' },
  { ranks: ['6', '7', '8', '9', '10'], effectiveHighRank: '10' },
  { ranks: ['7', '8', '9', '10', 'J'], effectiveHighRank: 'J' },
  { ranks: ['8', '9', '10', 'J', 'Q'], effectiveHighRank: 'Q' },
  { ranks: ['9', '10', 'J', 'Q', 'K'], effectiveHighRank: 'K' },
  { ranks: ['10', 'J', 'Q', 'K', 'A'], effectiveHighRank: 'A' },
  { ranks: ['J', 'Q', 'K', 'A', '2'], effectiveHighRank: '2' },
];

const invalidWrapArounds: ReadonlyArray<readonly Rank[]> = [
  ['K', 'A', '2', '3', '4'],
  ['Q', 'K', 'A', '2', '3'],
];

describe('RulesetConfig — rankOrder', () => {
  it('has exactly the 13 canonical ranks, low to high (requirements.md §2.2)', () => {
    expect(defaultRuleset.rankOrder).toEqual([
      '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2',
    ]);
  });

  it('has no duplicate ranks', () => {
    expect(new Set(defaultRuleset.rankOrder).size).toBe(13);
  });

  it('places 3 as the lowest rank and 2 as the highest rank', () => {
    expect(defaultRuleset.rankOrder[0]).toBe('3');
    expect(defaultRuleset.rankOrder[defaultRuleset.rankOrder.length - 1]).toBe('2');
  });
});

describe('RulesetConfig — suitOrder', () => {
  it('has exactly the 4 canonical suits, low to high (requirements.md §2.2)', () => {
    expect(defaultRuleset.suitOrder).toEqual(['clubs', 'spades', 'hearts', 'diamonds']);
  });

  it('has no duplicate suits', () => {
    expect(new Set(defaultRuleset.suitOrder).size).toBe(4);
  });

  it('places clubs as the lowest suit and diamonds as the highest suit', () => {
    expect(defaultRuleset.suitOrder[0]).toBe('clubs');
    expect(defaultRuleset.suitOrder[defaultRuleset.suitOrder.length - 1]).toBe('diamonds');
  });
});

describe('RulesetConfig — fiveCardOrder', () => {
  it('has exactly the 5-card hierarchy, weakest to strongest (requirements.md §2.3)', () => {
    expect(defaultRuleset.fiveCardOrder).toEqual([
      'straight', 'flush', 'fullHouse', 'fourOfAKind', 'straightFlush',
    ]);
  });

  it('excludes single, pair, and triple, which cannot be mixed across type', () => {
    expect(defaultRuleset.fiveCardOrder).not.toContain('single');
    expect(defaultRuleset.fiveCardOrder).not.toContain('pair');
    expect(defaultRuleset.fiveCardOrder).not.toContain('triple');
  });

  it('has no duplicate combination types', () => {
    expect(new Set(defaultRuleset.fiveCardOrder).size).toBe(5);
  });
});

describe('RulesetConfig — straightRules', () => {
  it('has exactly 11 valid Straight patterns', () => {
    expect(defaultRuleset.straightRules.patterns).toHaveLength(11);
  });

  it('matches the full expected weakest-to-strongest sequence exactly (requirements.md §2.4.1)', () => {
    expect(defaultRuleset.straightRules.patterns).toEqual(expectedStraightSequences);
  });

  it('orders A-2-3-4-5 as the weakest Straight with effective high rank 5', () => {
    const weakest = defaultRuleset.straightRules.patterns[0] as StraightPattern;
    expect(weakest.ranks).toEqual(['A', '2', '3', '4', '5']);
    expect(weakest.effectiveHighRank).toBe('5');
  });

  it('orders 2-3-4-5-6 as the second weakest Straight with effective high rank 6', () => {
    const secondWeakest = defaultRuleset.straightRules.patterns[1] as StraightPattern;
    expect(secondWeakest.ranks).toEqual(['2', '3', '4', '5', '6']);
    expect(secondWeakest.effectiveHighRank).toBe('6');
  });

  it('orders J-Q-K-A-2 as the strongest Straight with effective high rank 2', () => {
    const patterns = defaultRuleset.straightRules.patterns;
    const strongest = patterns[patterns.length - 1] as StraightPattern;
    expect(strongest.ranks).toEqual(['J', 'Q', 'K', 'A', '2']);
    expect(strongest.effectiveHighRank).toBe('2');
  });

  it('uses each pattern\'s own last rank as its effective high rank, except the two special low Straights', () => {
    const patterns = defaultRuleset.straightRules.patterns;
    // Patterns at index 0 (A2345) and 1 (23456) are the special low
    // Straights and are asserted separately above; every remaining
    // pattern's effective high rank is simply its own last card.
    patterns.slice(2).forEach((pattern) => {
      const lastRank = pattern.ranks[pattern.ranks.length - 1];
      expect(pattern.effectiveHighRank).toBe(lastRank);
    });
  });

  it('gives every pattern exactly 5 distinct ranks', () => {
    defaultRuleset.straightRules.patterns.forEach((pattern) => {
      expect(pattern.ranks).toHaveLength(5);
      expect(new Set(pattern.ranks).size).toBe(5);
    });
  });

  it('never includes the invalid K-A-2-3-4 or Q-K-A-2-3 wrap-arounds (requirements.md §2.4.1)', () => {
    const patternRankSets = defaultRuleset.straightRules.patterns.map(
      (pattern) => pattern.ranks.join(','),
    );
    invalidWrapArounds.forEach((invalid) => {
      expect(patternRankSets).not.toContain(invalid.join(','));
    });
  });

  it('produces no duplicate Straight patterns', () => {
    const serialized = defaultRuleset.straightRules.patterns.map((pattern) =>
      pattern.ranks.join(','),
    );
    expect(new Set(serialized).size).toBe(serialized.length);
  });
});

describe('RulesetConfig — lightweight rule seam (m1-task-breakdown.md T05 acceptance)', () => {
  it('exposes exactly the 4 documented top-level fields, with no plugin/extension hooks', () => {
    expect(Object.keys(defaultRuleset).sort()).toEqual([
      'fiveCardOrder', 'rankOrder', 'straightRules', 'suitOrder',
    ]);
  });

  it('exposes straightRules as plain data with only a patterns field', () => {
    expect(Object.keys(defaultRuleset.straightRules)).toEqual(['patterns']);
  });

  it('conforms to the RulesetConfig interface (compile-time)', () => {
    const ruleset: RulesetConfig = defaultRuleset;
    expect(ruleset).toBe(defaultRuleset);
  });
});

describe('RulesetConfig — compile-time safety', () => {
  it('rejects reassigning rankOrder due to readonly fields at compile time', () => {
    const ruleset: RulesetConfig = defaultRuleset;
    // @ts-expect-error - RulesetConfig.rankOrder is readonly and cannot be reassigned
    ruleset.rankOrder = [];
    void ruleset;
  });

  it('rejects an invalid rank inside a Straight pattern at compile time', () => {
    const invalid: StraightPattern = {
      // @ts-expect-error - 'Z' is not a valid Rank
      ranks: ['Z', '4', '5', '6', '7'],
      effectiveHighRank: '7',
    };
    void invalid;
  });

  it('rejects an unsupported combination type in fiveCardOrder at compile time', () => {
    const invalid: RulesetConfig = {
      ...defaultRuleset,
      // @ts-expect-error - 'bomb' is not a valid CombinationType (it is a
      // Competitive scoring term, not a combination category; see
      // requirements.md §1.4)
      fiveCardOrder: ['bomb'],
    };
    void invalid;
  });
});

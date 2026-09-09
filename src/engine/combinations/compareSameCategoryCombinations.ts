import type { Combination } from '../../domain';
import { compareRank, compareSingle, compareSuit } from '../cards/cardComparison';
import type { RulesetConfig } from '../config/RulesetConfig';
import { inspectCombination } from './inspectCombination';
import { compareStraightStrength, getStraightStrength } from './straightStrength';
import { getFlushStrength } from './flushStrength';
import { getFullHouseStrength } from './fullHouseStrength';
import { getFourOfAKindStrength } from './fourOfAKindStrength';

/**
 * Negative means candidate is weaker, positive means stronger, and zero means
 * equal strength (not a beating response). Inputs must be valid combinations of
 * the same canonical category under this ruleset; misuse throws diagnostically.
 * This state-independent comparison does not check ownership or Turn legality.
 */
export function compareSameCategoryCombinations(
  candidate: Combination,
  current: Combination,
  ruleset: RulesetConfig,
): number {
  for (const combination of [candidate, current]) {
    const result = inspectCombination(combination.cards, ruleset);
    if (!result.valid || result.combination.type !== combination.type) {
      throw new Error('Same-category comparison requires valid canonical combinations');
    }
  }
  if (candidate.type !== current.type) {
    throw new Error('Same-category comparison requires matching categories');
  }

  const a = candidate.cards;
  const b = current.cards;
  switch (candidate.type) {
    case 'single':
      return compareSingle(a[0]!, b[0]!, ruleset);
    case 'pair': {
      const highA = compareSingle(a[0]!, a[1]!, ruleset) > 0 ? a[0]! : a[1]!;
      const highB = compareSingle(b[0]!, b[1]!, ruleset) > 0 ? b[0]! : b[1]!;
      return compareSingle(highA, highB, ruleset);
    }
    case 'triple':
      // Equal-rank Triples cannot belong to disjoint hands in a standard deck.
      return compareRank(a[0]!.rank, b[0]!.rank, ruleset);
    case 'straight':
    case 'straightFlush':
      return compareStraightStrength(getStraightStrength(a, ruleset)!, getStraightStrength(b, ruleset)!, ruleset);
    case 'flush': {
      const left = getFlushStrength(a, ruleset)!;
      const right = getFlushStrength(b, ruleset)!;
      const suitComparison = compareSuit(left.suit, right.suit, ruleset);
      if (suitComparison !== 0) return suitComparison;
      for (let i = 0; i < left.descendingRanks.length; i++) {
        const rankComparison = compareRank(left.descendingRanks[i]!, right.descendingRanks[i]!, ruleset);
        if (rankComparison !== 0) return rankComparison;
      }
      return 0;
    }
    case 'fullHouse':
      return compareRank(getFullHouseStrength(a)!.tripleRank, getFullHouseStrength(b)!.tripleRank, ruleset);
    case 'fourOfAKind':
      return compareRank(getFourOfAKindStrength(a)!.quadRank, getFourOfAKindStrength(b)!.quadRank, ruleset);
  }
}

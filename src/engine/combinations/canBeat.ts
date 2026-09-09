import type { Combination } from '../../domain';
import type { RulesetConfig } from '../config/RulesetConfig';
import { compareSameCategoryCombinations } from './compareSameCategoryCombinations';
import { inspectCombination } from './inspectCombination';

/**
 * Tests strict response strength without checking ownership, opening, or Turn
 * legality. Inputs must be valid canonical combinations; misuse throws.
 */
export function canBeat(
  candidate: Combination,
  current: Combination,
  ruleset: RulesetConfig,
): boolean {
  if (candidate.type === current.type) {
    return compareSameCategoryCombinations(candidate, current, ruleset) > 0;
  }
  for (const combination of [candidate, current]) {
    const result = inspectCombination(combination.cards, ruleset);
    if (!result.valid || result.combination.type !== combination.type) {
      throw new Error('Response comparison requires valid canonical combinations');
    }
  }
  if (candidate.cards.length !== 5 || current.cards.length !== 5) return false;
  return ruleset.fiveCardOrder.indexOf(candidate.type) > ruleset.fiveCardOrder.indexOf(current.type);
}

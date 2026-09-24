import type { RulesetConfig } from './RulesetConfig';
import type { StraightPattern } from './StraightRules';

/**
 * The 11 valid house-rule Straights, ordered strictly weakest to
 * strongest per requirements.md §2.4.1 and testing-simulation.md §7.10.
 *
 * The two special low Straights (A-2-3-4-5 and 2-3-4-5-6) use A and/or
 * 2 as low cards and carry an `effectiveHighRank` that is NOT their
 * literal highest `Rank` member. Every other pattern's
 * `effectiveHighRank` is simply its own last/highest card. Invalid
 * wrap-arounds such as K-A-2-3-4 and Q-K-A-2-3 are intentionally
 * absent (requirements.md §2.4.1).
 */
const straightPatterns: readonly StraightPattern[] = [
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

/**
 * The canonical v1 house ruleset (requirements.md §2.2-§2.4). This is
 * the single default `RulesetConfig` used by Basic Mode in M1
 * (engine.md §25: "The v1 default must match requirements.md.").
 *
 * M1 has exactly one fixed house ruleset (requirements.md §2, intro
 * note), so no alternate ruleset variants are provided.
 */
export const defaultRuleset: RulesetConfig = {
  rankOrder: ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'],
  suitOrder: ['clubs', 'spades', 'hearts', 'diamonds'],
  fiveCardOrder: ['straight', 'flush', 'fullHouse', 'fourOfAKind', 'straightFlush'],
  straightRules: { patterns: straightPatterns },
};

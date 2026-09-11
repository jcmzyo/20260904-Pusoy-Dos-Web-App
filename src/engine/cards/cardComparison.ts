import type { Card, Rank, Suit } from '../../domain';
import type { RulesetConfig } from '../config/RulesetConfig';

/**
 * Primitive Engine-owned Rank/Suit/Single comparison helpers
 * (m1-task-breakdown.md T06; engine.md §12, §25).
 *
 * These are the lowest-level authoritative comparison primitives. They
 * consume the configured `RulesetConfig` rather than hardcoding rank or
 * suit order, so they remain correct if the ruleset is ever configured
 * differently (m1-task-breakdown.md T06 acceptance — "helpers use
 * authoritative RulesetConfig semantics").
 *
 * Multi-card combination detection/inspection (Pair, Triple, Straight,
 * Flush, etc.) is later M1 work (T07+) and must build on these
 * primitives rather than duplicate rank/suit lookup logic.
 *
 * Comparison convention: each function returns a negative number when
 * `a` is weaker than `b`, a positive number when `a` is stronger than
 * `b`, and `0` when they are equal in that dimension. This matches the
 * standard `Array.prototype.sort` comparator convention.
 */

/**
 * Resolves a Rank's position in the configured `rankOrder`.
 *
 * Throws if the Rank is not present in the ruleset. Because `Rank` is a
 * closed shared-domain union and a well-formed `RulesetConfig` always
 * enumerates all 13 ranks, this should never happen for valid input; it
 * exists to surface a configuration/invariant bug loudly rather than
 * silently treating an unknown Rank as weakest.
 */
function rankIndex(rank: Rank, ruleset: RulesetConfig): number {
  const index = ruleset.rankOrder.indexOf(rank);
  if (index === -1) {
    throw new Error(`Rank "${rank}" is not present in the configured rankOrder`);
  }
  return index;
}

/**
 * Resolves a Suit's position in the configured `suitOrder`.
 *
 * Throws if the Suit is not present in the ruleset, for the same
 * reason documented on {@link rankIndex}.
 */
function suitIndex(suit: Suit, ruleset: RulesetConfig): number {
  const index = ruleset.suitOrder.indexOf(suit);
  if (index === -1) {
    throw new Error(`Suit "${suit}" is not present in the configured suitOrder`);
  }
  return index;
}

/**
 * Compares two Ranks using the configured `rankOrder`
 * (requirements.md §2.2: `3 < 4 < ... < A < 2`).
 */
export function compareRank(a: Rank, b: Rank, ruleset: RulesetConfig): number {
  return rankIndex(a, ruleset) - rankIndex(b, ruleset);
}

/**
 * Compares two Suits using the configured `suitOrder`
 * (requirements.md §2.2: `Clubs < Spades < Hearts < Diamonds`).
 */
export function compareSuit(a: Suit, b: Suit, ruleset: RulesetConfig): number {
  return suitIndex(a, ruleset) - suitIndex(b, ruleset);
}

/**
 * Compares two Cards as Singles: Rank first, and if the Ranks are
 * equal, the Suit of each Card breaks the tie (requirements.md §2.2,
 * §2.4.2 suit-tiebreak precedent; m1-task-breakdown.md T06 — "same-rank
 * singles resolved by suit").
 *
 * This produces the confirmed house-rule ordering where 3♣ is the
 * lowest possible Single and 2♦ is the highest possible Single in the
 * game.
 *
 * This helper compares two individual Cards as a Single. It does not
 * detect whether an arbitrary card set forms a valid Single
 * Combination — that inspection responsibility belongs to T07.
 */
export function compareSingle(a: Card, b: Card, ruleset: RulesetConfig): number {
  const rankComparison = compareRank(a.rank, b.rank, ruleset);
  if (rankComparison !== 0) {
    return rankComparison;
  }
  return compareSuit(a.suit, b.suit, ruleset);
}

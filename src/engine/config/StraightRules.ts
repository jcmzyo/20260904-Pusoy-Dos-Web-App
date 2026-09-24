import type { Rank } from '../../domain';

/**
 * One authoritative house-rule Straight pattern: the exact 5 ranks that
 * form a valid Straight, plus the rank used for Straight strength and
 * suit tiebreak comparison (requirements.md §2.4.1).
 *
 * `effectiveHighRank` is not always the same as the highest value in
 * `ranks` under the shared `Rank` union's own ordering — for the two
 * special low Straights, A and/or 2 act as low cards and the effective
 * high rank is the sequence's own top card (5 for A-2-3-4-5, 6 for
 * 2-3-4-5-6), not A or 2 themselves.
 *
 * This is configuration data only. It does not implement Straight
 * detection or comparison; those algorithms are later Engine work
 * (m1-task-breakdown.md T08, T11-T12) and must consume this data
 * rather than duplicate it.
 */
export interface StraightPattern {
  readonly ranks: readonly Rank[];
  readonly effectiveHighRank: Rank;
}

/**
 * The complete set of authoritative house-rule Straight patterns, used
 * by combination detection/comparison (engine.md §12, §25).
 *
 * `patterns` is ordered strictly weakest to strongest, per the
 * effective ordering confirmed in requirements.md §2.4.1 and
 * testing-simulation.md §7.10:
 *
 *   A2345 < 23456 < 34567 < ... < 10JQKA < JQKA2
 *
 * Only A and/or 2 may act as low cards, and only for the two special
 * low Straights (A-2-3-4-5 and 2-3-4-5-6). Wrap-around sequences such
 * as K-A-2-3-4 or Q-K-A-2-3 are invalid and must never appear here
 * (requirements.md §2.4.1).
 */
export interface StraightRules {
  readonly patterns: readonly StraightPattern[];
}

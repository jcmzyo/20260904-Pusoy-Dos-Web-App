import type { CombinationType, Rank, Suit } from '../../domain';
import type { StraightRules } from './StraightRules';

/**
 * The lightweight Engine-owned rule seam controlling authoritative
 * card/suit/five-card ordering and Straight rules (engine.md §25).
 *
 * `RulesetConfig` is data only. It does not implement algorithms and
 * does not provide plugin-style extension hooks — see
 * m1-task-breakdown.md T05 acceptance: "configuration is a lightweight
 * rule seam, not a plugin framework." Only meaningful rule variation is
 * configurable here; unrelated constants remain ordinary engine logic
 * elsewhere.
 *
 * The referenced value types (`Rank`, `Suit`, `CombinationType`) are
 * shared domain vocabulary (domain-model.md), but this interface
 * itself is Engine-owned configuration, not a shared domain type
 * (domain-model.md §9.1; engine.md §25).
 */
export interface RulesetConfig {
  /** Card rank order, low to high (requirements.md §2.2). */
  readonly rankOrder: readonly Rank[];

  /** Card suit order, low to high (requirements.md §2.2). */
  readonly suitOrder: readonly Suit[];

  /**
   * Strict five-card combination hierarchy, weakest to strongest
   * (requirements.md §2.3). Deliberately excludes `single`, `pair`,
   * and `triple`, which can never be mixed across combination type
   * (requirements.md §2.3: "Combination types cannot be mixed for 1-,
   * 2-, or 3-card tricks.").
   */
  readonly fiveCardOrder: readonly CombinationType[];

  /** Authoritative house-rule Straight patterns (requirements.md §2.4.1). */
  readonly straightRules: StraightRules;
}

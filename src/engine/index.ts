/**
 * Game Engine package boundary.
 *
 * Owned by: engine.md
 *
 * This package holds the authoritative Pusoy Dos rules engine: ruleset
 * configuration, card/deck operations, combination detection/comparison,
 * legal move generation, move validation, turn/trick/round/session state,
 * scoring, views, and engine events.
 *
 * M1-T05 adds the `RulesetConfig` rule seam and the canonical v1 house
 * ruleset (`defaultRuleset`). No rule algorithms (combination detection,
 * comparison, legal move generation, etc.) are implemented yet; those are
 * later M1 tasks that will consume this configuration data.
 *
 * Constraints (see engine.md §4 and requirements.md §5.1):
 * - /engine may depend on /domain.
 * - /engine must not depend on /ui, /ai, /persistence, /simulation, React,
 *   DOM APIs, browser storage, or browser events.
 */
export type { RulesetConfig } from './config/RulesetConfig';
export type { StraightPattern, StraightRules } from './config/StraightRules';
export { defaultRuleset } from './config/defaultRuleset';

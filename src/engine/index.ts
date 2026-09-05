/**
 * Game Engine package boundary.
 *
 * Owned by: engine.md
 *
 * This package will hold the authoritative Pusoy Dos rules engine: ruleset
 * configuration, card/deck operations, combination detection/comparison,
 * legal move generation, move validation, turn/trick/round/session state,
 * scoring, views, and engine events.
 *
 * No gameplay behavior is implemented yet. This file exists only to
 * establish the /engine package boundary for M1-T01 and to give the
 * TypeScript project a compilable module in this directory.
 *
 * Constraints (see engine.md §4 and requirements.md §5.1):
 * - /engine may depend on /domain.
 * - /engine must not depend on /ui, /ai, /persistence, /simulation, React,
 *   DOM APIs, browser storage, or browser events.
 */
export {};

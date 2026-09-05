/**
 * Shared Domain Model package boundary.
 *
 * Owned by: domain-model.md
 *
 * This package will hold implementation-independent Pusoy Dos vocabulary
 * (Card, Rank, Suit, PlayerId, GameMode, CombinationType, Combination, Move).
 *
 * No gameplay types are implemented yet. This file exists only to establish
 * the /domain package boundary for M1-T01 and to give the TypeScript project
 * a compilable module in this directory.
 *
 * Constraints (see domain-model.md §2.2 and requirements.md §5.1):
 * - /domain must not import from /engine, /orchestrator, /ai, /ui,
 *   /persistence, /events-logging, /simulation, browser APIs, or React.
 */
export {};

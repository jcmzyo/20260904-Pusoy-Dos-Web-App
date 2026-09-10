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
 * Exposes ruleset configuration and state-independent combination inspection.
 *
 * Constraints (see engine.md §4 and requirements.md §5.1):
 * - /engine may depend on /domain.
 * - /engine must not depend on /ui, /ai, /persistence, /simulation, React,
 *   DOM APIs, browser storage, or browser events.
 */
export type { RulesetConfig } from './config/RulesetConfig';
export type { StraightPattern, StraightRules } from './config/StraightRules';
export { defaultRuleset } from './config/defaultRuleset';
export { createDeck } from './cards/createDeck';
export { shuffleDeck } from './cards/shuffleDeck';
export { dealDeck } from './cards/dealDeck';
export type { DealResult } from './cards/dealDeck';
export type { RNG } from './rng/RNG';
export { inspectCombination } from './combinations/inspectCombination';
export type { CombinationInspectionResult } from './combinations/inspectCombination';
export { compareSameCategoryCombinations } from './combinations/compareSameCategoryCombinations';
export { canBeat } from './combinations/canBeat';
export { generateLegalOpeningMoves } from './moves/generateLegalOpeningMoves';
export { generateLegalResponseMoves } from './moves/generateLegalResponseMoves';
export { generateLegalFreeLeadMoves } from './moves/generateLegalFreeLeadMoves';
export { createSession, startRound, submitMove } from './GameEngine';
export type { EngineResult, MoveResult } from './GameEngine';
export type { GameEvent } from './events/GameEvent';
export { getPlayerView, getPublicView } from './views/viewFactory';
export type { PlayerView, PublicGameView, PublicTrickView } from './views/PublicGameView';

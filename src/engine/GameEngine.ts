import type { Move, PlayerId } from '../domain';
import type { RulesetConfig } from './config/RulesetConfig';
import { inspectCombination } from './combinations/inspectCombination';
import type { GameEvent } from './events/GameEvent';
import type { MoveValidationError } from './moves/validateMove';
import type { RNG } from './rng/RNG';
import { createBasicSession, resolveBasicSession, startBasicRound } from './sessions/resolveBasicSession';
import type { BasicSessionState } from './sessions/resolveBasicSession';

export interface EngineResult {
  readonly state: BasicSessionState;
  readonly events: readonly GameEvent[];
}

export type MoveResult = EngineResult & (
  | { readonly accepted: true }
  | { readonly accepted: false; readonly error: MoveValidationError }
);

export function createSession(playerIds: readonly PlayerId[]): EngineResult {
  const state = createBasicSession(playerIds);
  return { state, events: [{ type: 'SESSION_STARTED', mode: 'basic', playerIds: [...state.playerIds] }] };
}

export function startRound(previous: BasicSessionState, rng: RNG): EngineResult {
  const state = startBasicRound(previous, rng);
  const round = state.round;
  if (round?.kind !== 'inProgress') throw new Error('Round start requires an active Round.');
  const { roundNumber } = state;
  return { state, events: [
    { type: 'ROUND_STARTED', roundNumber },
    { type: 'CARDS_DEALT', roundNumber, players: round.context.players.map(({ playerId, hand }) => ({ playerId, cardCount: hand.length })) },
    { type: 'TURN_CHANGED', roundNumber, playerId: round.context.currentPlayerId },
  ] };
}

/** Events describe the completed transaction in causal order; rejection emits nothing. */
export function submitMove(previous: BasicSessionState, move: Move, ruleset: RulesetConfig): MoveResult {
  const transition = resolveBasicSession(previous, move, ruleset);
  if (!transition.accepted) return { ...transition, events: [] };
  const { state } = transition;
  const before = previous.round;
  const after = state.round;
  if (before?.kind !== 'inProgress' || !after) throw new Error('Accepted Move requires a Round transition.');
  const { roundNumber } = state;
  const events: GameEvent[] = [];
  if (move.kind === 'play') {
    const inspected = inspectCombination(move.cards, ruleset);
    if (!inspected.valid) throw new Error('Accepted Play requires a canonical combination.');
    events.push({ type: 'CARDS_PLAYED', roundNumber, playerId: move.playerId, combination: {
      type: inspected.combination.type, cards: inspected.combination.cards.map(({ rank, suit }) => ({ rank, suit })),
    } });
  } else {
    events.push({ type: 'PLAYER_PASSED', roundNumber, playerId: move.playerId });
  }
  if (after.finishOrder.length > before.finishOrder.length) {
    const placement = after.finishOrder.length;
    if (placement !== 1 && placement !== 2 && placement !== 3) throw new Error('Finish requires placement 1, 2 or 3.');
    events.push({ type: 'PLAYER_FINISHED', roundNumber, playerId: move.playerId, placement });
  }
  if (after.kind === 'completed' || after.context.trick.kind === 'freeLead') {
    const lastSuccessfulPlayerId = move.kind === 'play' ? move.playerId : before.responseCycle?.lastSuccessfulPlayerId;
    if (lastSuccessfulPlayerId === undefined) throw new Error('Trick end requires a last successful player.');
    events.push({ type: 'TRICK_ENDED', roundNumber, lastSuccessfulPlayerId });
  }
  if (after.kind === 'inProgress') {
    events.push({ type: 'TURN_CHANGED', roundNumber, playerId: after.context.currentPlayerId });
  } else {
    events.push({ type: 'ROUND_ENDED', roundNumber, result: { placements: after.result.placements.map((entry) => ({ ...entry })) } });
    events.push({ type: 'SCORE_CALCULATED', roundNumber,
      result: { placements: after.result.placements.map((entry) => ({ ...entry })) },
      standings: state.standings.map((entry) => ({ ...entry })),
    });
    if (state.result) events.push({ type: 'SESSION_ENDED', roundNumber, result: {
      standings: state.result.standings.map((entry) => ({ ...entry })), winnerIds: [...state.result.winnerIds], decidedBy: state.result.decidedBy,
    } });
  }
  return { ...transition, events };
}

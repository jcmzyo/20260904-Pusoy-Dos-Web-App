import type { Move, PlayerId } from '../../domain';
import { createDeck } from '../cards/createDeck';
import { dealDeck } from '../cards/dealDeck';
import { shuffleDeck } from '../cards/shuffleDeck';
import type { RulesetConfig } from '../config/RulesetConfig';
import type { MoveValidationError } from '../moves/validateMove';
import type { RNG } from '../rng/RNG';
import { resolveBasicRound } from '../rounds/resolveBasicRound';
import type { BasicRoundResult, BasicRoundState } from '../rounds/resolveBasicRound';
import { basicSessionStandings, resolveBasicSessionResult } from './basicSessionResult';
import type { BasicSessionResult, BasicSessionStanding } from './basicSessionResult';

export interface BasicSessionState {
  readonly kind: 'inProgress' | 'completed';
  readonly playerIds: readonly PlayerId[];
  readonly roundNumber: number;
  readonly round: BasicRoundState | null;
  readonly completedRounds: readonly BasicRoundResult[];
  readonly standings: readonly BasicSessionStanding[];
  readonly result: BasicSessionResult | null;
}

export type BasicSessionTransition =
  | { readonly accepted: true; readonly state: BasicSessionState }
  | { readonly accepted: false; readonly state: BasicSessionState; readonly error: MoveValidationError };

export function createBasicSession(playerIds: readonly PlayerId[]): BasicSessionState {
  if (playerIds.length !== 4 || new Set(playerIds).size !== 4) throw new Error('Basic Session requires four distinct players.');
  return {
    kind: 'inProgress', playerIds: [...playerIds], roundNumber: 0, round: null,
    completedRounds: [], standings: basicSessionStandings(playerIds, []), result: null,
  };
}

export function startBasicRound(state: BasicSessionState, rng: RNG): BasicSessionState {
  if (state.kind === 'completed' || state.completedRounds.length >= 5) throw new Error('Cannot start a Round after Basic Session completion.');
  if (state.round?.kind === 'inProgress') throw new Error('Cannot start a Round while another Round is in progress.');
  const deal = dealDeck(shuffleDeck(createDeck(), rng), state.playerIds);
  return {
    ...state, roundNumber: state.completedRounds.length + 1,
    round: {
      kind: 'inProgress', finishOrder: [], responseCycle: null,
      context: {
        sessionActive: true, roundActive: true, currentPlayerId: deal.startingPlayerId, trick: { kind: 'opening' },
        players: deal.hands.map(({ playerId, cards }) => ({ playerId, hand: cards, active: true })),
      },
    },
  };
}

/** Internal Session transaction combining Move, Round, scoring, and Session consequences. */
export function resolveBasicSession(state: BasicSessionState, move: Move, ruleset: RulesetConfig): BasicSessionTransition {
  if (state.kind === 'completed') return { accepted: false, state, error: { code: 'SESSION_NOT_ACTIVE' } };
  if (state.round === null) return { accepted: false, state, error: { code: 'ROUND_NOT_ACTIVE' } };
  const transition = resolveBasicRound(state.round, move, ruleset);
  if (!transition.accepted) return { accepted: false, state, error: transition.error };
  if (transition.state.kind === 'inProgress') return { accepted: true, state: { ...state, round: transition.state } };
  const completedRounds = [...state.completedRounds, transition.state.result];
  if (completedRounds.length > 5) throw new Error('Basic Session cannot contain more than five completed Rounds.');
  const result = completedRounds.length === 5 ? resolveBasicSessionResult(state.playerIds, completedRounds) : null;
  return {
    accepted: true,
    state: {
      ...state, kind: result === null ? 'inProgress' : 'completed', round: transition.state, completedRounds,
      standings: result?.standings ?? basicSessionStandings(state.playerIds, completedRounds), result,
    },
  };
}

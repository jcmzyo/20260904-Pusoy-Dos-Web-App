import { getLegalMoves, getPlayerView, getPublicView } from '../../engine';
import type { EngineResult, RulesetConfig } from '../../engine';
import type { PlayerTurnRequest } from './PlayerTurnRequest';

let requestSequence = 0n;

/** Identities are fresh across Sessions in this execution, without consuming gameplay RNG. */
export function createPlayerTurnRequest(state: EngineResult['state'], ruleset: RulesetConfig): PlayerTurnRequest {
  const publicView = getPublicView(state);
  const playerId = publicView.round?.currentPlayerId;
  if (publicView.status !== 'inProgress' || publicView.round?.status !== 'inProgress' || playerId == null) {
    throw new Error('Controller request requires an active Turn.');
  }
  const view = getPlayerView(state, playerId);
  const legalMoves = getLegalMoves(state, playerId, ruleset);
  if (legalMoves.length === 0) throw new Error(`Controller request requires Engine legal Moves for player ${playerId}.`);
  requestSequence += 1n;
  return { playerId, view, legalMoves, requestId: `turn-request-${requestSequence}` };
}

import type { PlayerId } from '../../domain';
import type { MoveValidationContext, MoveValidationResult } from '../moves/validateMove';

export interface ResponseCycle {
  readonly lastSuccessfulPlayerId: PlayerId;
  readonly passedPlayerIds: readonly PlayerId[];
}

export interface TurnProgression {
  readonly currentPlayerId: PlayerId;
  readonly responseCycle: ResponseCycle;
}

/**
 * Internal component for a Move validated against this context, using players in clockwise seat order.
 * Returns only Turn/Pass facts, not an authoritative post-Move state. The enclosing
 * transaction must resolve Trick reset, finishing and lifecycle before exposing input.
 */
export function resolveTurnAndPass(
  context: MoveValidationContext,
  validation: Extract<MoveValidationResult, { valid: true }>,
  responseCycle: ResponseCycle | null,
): TurnProgression {
  const { players, currentPlayerId } = context;
  if (players.length !== 4 || new Set(players.map((player) => player.playerId)).size !== 4) {
    throw new Error('Turn rotation requires exactly four distinct players in clockwise order.');
  }
  const currentIndex = players.findIndex((player) => player.playerId === currentPlayerId);
  const currentPlayer = players[currentIndex];
  if (!context.sessionActive || !context.roundActive || !currentPlayer?.active || currentPlayer.hand.length === 0) {
    throw new Error('Turn progression requires an active Session, Round and Turn owner.');
  }
  if (context.trick.kind === 'response') {
    if (!responseCycle || !players.some((player) => player.playerId === responseCycle.lastSuccessfulPlayerId)) {
      throw new Error('A response requires a known last successful player.');
    }
    if (new Set(responseCycle.passedPlayerIds).size !== responseCycle.passedPlayerIds.length
      || responseCycle.passedPlayerIds.some((id) => id === responseCycle.lastSuccessfulPlayerId || !players.some((player) => player.playerId === id))) {
      throw new Error('Response-cycle Pass tracking contains invalid player IDs.');
    }
  } else if (responseCycle !== null || validation.kind === 'pass') {
    throw new Error('An opening or free lead requires a Play and no response cycle.');
  }
  if (validation.kind === 'pass' && (responseCycle!.lastSuccessfulPlayerId === currentPlayerId || responseCycle!.passedPlayerIds.includes(currentPlayerId))) {
    throw new Error('Turn progression requires an unresolved response Turn.');
  }

  for (let offset = 1; offset < players.length; offset += 1) {
    const next = players[(currentIndex + offset) % players.length]!;
    if (!next.active || next.hand.length === 0) continue;
    return {
      currentPlayerId: next.playerId,
      responseCycle: validation.kind === 'play'
        ? { lastSuccessfulPlayerId: currentPlayerId, passedPlayerIds: [] }
        : { lastSuccessfulPlayerId: responseCycle!.lastSuccessfulPlayerId, passedPlayerIds: [...responseCycle!.passedPlayerIds, currentPlayerId] },
    };
  }
  throw new Error('Turn progression requires another eligible active player.');
}

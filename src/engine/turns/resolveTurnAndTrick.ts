import type { PlayerId } from '../../domain';
import type { MoveValidationContext, MoveValidationResult } from '../moves/validateMove';
import { resolveTurnAndPass } from './resolveTurnAndPass';
import type { ResponseCycle } from './resolveTurnAndPass';

export type TrickProgression = {
  readonly currentPlayerId: PlayerId;
} & (
  | { readonly trick: { readonly kind: 'freeLead' }; readonly responseCycle: null }
  | { readonly trick: Extract<MoveValidationContext['trick'], { kind: 'response' }>; readonly responseCycle: ResponseCycle }
);

/** Internal Turn/Trick facts only; finishing and lifecycle still belong to the enclosing transaction. */
export function resolveTurnAndTrick(
  context: MoveValidationContext,
  validation: Extract<MoveValidationResult, { valid: true }>,
  responseCycle: ResponseCycle | null,
): TrickProgression {
  const progression = resolveTurnAndPass(context, validation, responseCycle);
  if (validation.kind === 'play') {
    return { ...progression, trick: { kind: 'response', current: validation.combination } };
  }
  if (context.trick.kind !== 'response') {
    throw new Error('A Pass requires a current response combination.');
  }
  const cycle = progression.responseCycle;
  const eligible = context.players.filter((player) => player.active && player.hand.length > 0);
  if (eligible.some((player) => player.playerId === cycle.lastSuccessfulPlayerId)
    && eligible.every((player) => player.playerId === cycle.lastSuccessfulPlayerId || cycle.passedPlayerIds.includes(player.playerId))) {
    return { currentPlayerId: cycle.lastSuccessfulPlayerId, trick: { kind: 'freeLead' }, responseCycle: null };
  }
  return { ...progression, trick: context.trick };
}

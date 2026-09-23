import type { PlayerId } from '../../domain';
import type { RulesetConfig } from '../config/RulesetConfig';
import type { MoveValidationContext, MoveValidationResult } from '../moves/validateMove';
import type { ResponseCycle } from './resolveTurnAndPass';
import { resolveTurnAndTrick } from './resolveTurnAndTrick';
import type { TrickProgression } from './resolveTurnAndTrick';

export type BasicContinuation = {
  readonly players: MoveValidationContext['players'];
  readonly finishOrder: readonly PlayerId[];
} & (
  | { readonly kind: 'continue'; readonly progression: TrickProgression }
  | { readonly kind: 'roundCompletionPending'; readonly remainingPlayerId: PlayerId }
);

/** Internal facts for a validated Move; Round results, scoring and events remain transaction responsibilities. */
export function resolveBasicContinuation(
  context: MoveValidationContext,
  validation: Extract<MoveValidationResult, { valid: true }>,
  responseCycle: ResponseCycle | null,
  finishOrder: readonly PlayerId[],
  ruleset: RulesetConfig,
): BasicContinuation {
  if (new Set(finishOrder).size !== finishOrder.length
    || finishOrder.some((id) => !context.players.some((player) => player.playerId === id))
    || context.players.some((player) => finishOrder.includes(player.playerId)
      ? player.active || player.hand.length !== 0
      : !player.active || player.hand.length === 0)) {
    throw new Error('Basic continuation requires consistent finish order and active hands.');
  }
  const progression = resolveTurnAndTrick(context, validation, responseCycle);
  if (validation.kind === 'pass') {
    if (progression.responseCycle && finishOrder.includes(progression.responseCycle.lastSuccessfulPlayerId)
      && context.players.every((player) => !player.active || progression.responseCycle!.passedPlayerIds.includes(player.playerId))) {
      const lastIndex = context.players.findIndex((player) => player.playerId === progression.responseCycle!.lastSuccessfulPlayerId);
      const next = [1, 2, 3].map((offset) => context.players[(lastIndex + offset) % 4]!).find((player) => player.active)!;
      return { kind: 'continue', players: context.players, finishOrder, progression: { currentPlayerId: next.playerId, trick: { kind: 'freeLead' }, responseCycle: null } };
    }
    return { kind: 'continue', players: context.players, finishOrder, progression };
  }
  const played = new Set(validation.combination.cards.map((card) => `${card.rank}-${card.suit}`));
  const players = context.players.map((player) => {
    if (player.playerId !== context.currentPlayerId) return player;
    const hand = player.hand.filter((card) => !played.has(`${card.rank}-${card.suit}`));
    return { ...player, hand, active: hand.length > 0 };
  });
  const currentIndex = players.findIndex((player) => player.playerId === context.currentPlayerId);
  if (players[currentIndex]!.active) return { kind: 'continue', players, finishOrder, progression };
  const nextFinishOrder = [...finishOrder, context.currentPlayerId];
  const remaining = [1, 2, 3].map((offset) => players[(currentIndex + offset) % 4]!).filter((player) => player.active);
  if (remaining.length === 1) {
    return { kind: 'roundCompletionPending', players, finishOrder: nextFinishOrder, remainingPlayerId: remaining[0]!.playerId };
  }
  // requirements.md §2.5.2 (M4-T12.5): every remaining active player gets an explicit response Turn of
  // their own to the finisher's own final combination, starting with the very next active player in
  // order, rather than the Engine silently searching ahead for whichever remaining player can beat it
  // (or silently reassigning the free lead when none can). A player with no beating Move, or one who
  // simply chooses not to play a beating Move they do have, explicitly Passes on their own Turn; the
  // generic all-Pass-cycle handling above (validation.kind === 'pass') already reassigns the free lead
  // once every remaining active player has, in turn, either played a beating combination or passed.
  return {
    kind: 'continue', players, finishOrder: nextFinishOrder,
    progression: { currentPlayerId: remaining[0]!.playerId, trick: { kind: 'response', current: validation.combination }, responseCycle: { lastSuccessfulPlayerId: context.currentPlayerId, passedPlayerIds: [] } },
  };
}

import type { Move, PlayerId } from '../../domain';
import type { RulesetConfig } from '../config/RulesetConfig';
import { validateMove } from '../moves/validateMove';
import type { MoveValidationContext, MoveValidationError } from '../moves/validateMove';
import { resolveBasicContinuation } from '../turns/resolveBasicContinuation';
import type { ResponseCycle } from '../turns/resolveTurnAndPass';

export interface BasicRoundResult {
  readonly placements: readonly {
    readonly playerId: PlayerId;
    readonly placement: 1 | 2 | 3 | 4;
    readonly points: 5 | 3 | 2 | 0;
  }[];
}

export type BasicRoundState = {
  readonly finishOrder: readonly PlayerId[];
} & (
  | { readonly kind: 'inProgress'; readonly context: MoveValidationContext; readonly responseCycle: ResponseCycle | null }
  | { readonly kind: 'completed'; readonly players: MoveValidationContext['players']; readonly result: BasicRoundResult }
);

export type BasicRoundTransition =
  | { readonly accepted: true; readonly state: BasicRoundState }
  | { readonly accepted: false; readonly state: BasicRoundState; readonly error: MoveValidationError };

/** Internal Round transaction; Session totals and events belong to the enclosing Session transaction. */
export function resolveBasicRound(state: BasicRoundState, move: Move, ruleset: RulesetConfig): BasicRoundTransition {
  if (state.kind === 'completed') return { accepted: false, state, error: { code: 'ROUND_NOT_ACTIVE' } };
  const validation = validateMove(state.context, move, ruleset);
  if (!validation.valid) return { accepted: false, state, error: validation.error };
  const continuation = resolveBasicContinuation(state.context, validation, state.responseCycle, state.finishOrder, ruleset);
  if (continuation.kind === 'continue') {
    return {
      accepted: true,
      state: {
        kind: 'inProgress', finishOrder: continuation.finishOrder,
        context: { ...state.context, players: continuation.players, currentPlayerId: continuation.progression.currentPlayerId, trick: continuation.progression.trick },
        responseCycle: continuation.progression.responseCycle,
      },
    };
  }
  const order = [...continuation.finishOrder, continuation.remainingPlayerId];
  if (continuation.finishOrder.length !== 3 || new Set(order).size !== 4) {
    throw new Error('Basic Round completion requires three distinct finishers and one remaining player.');
  }
  const placements = ([1, 2, 3, 4] as const).map((placement, index) => ({
    playerId: order[index]!, placement, points: ([5, 3, 2, 0] as const)[index]!,
  }));
  return {
    accepted: true,
    state: { kind: 'completed', players: continuation.players, finishOrder: continuation.finishOrder, result: { placements } },
  };
}

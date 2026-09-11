import type { Card, Combination, PlayerId } from '../../domain';
import type { BasicRoundResult } from '../rounds/resolveBasicRound';
import type { BasicSessionResult, BasicSessionStanding } from '../sessions/basicSessionResult';

export type PublicTrickView =
  | { readonly kind: 'opening' | 'freeLead' }
  | { readonly kind: 'response'; readonly current: Combination };

/** Detached public facts; player order is clockwise and playedCards is a set in deck order, not play history. */
export interface PublicGameView {
  readonly mode: 'basic';
  readonly status: 'inProgress' | 'completed';
  readonly playerIds: readonly PlayerId[];
  readonly roundNumber: number;
  readonly round: {
    readonly status: 'inProgress' | 'completed';
    readonly players: readonly {
      readonly playerId: PlayerId;
      readonly cardCount: number;
      readonly finished: boolean;
    }[];
    readonly currentPlayerId: PlayerId | null;
    readonly trick: PublicTrickView | null;
    readonly playedCards: readonly Card[];
    readonly finishOrder: readonly PlayerId[];
  } | null;
  readonly completedRounds: readonly BasicRoundResult[];
  readonly standings: readonly BasicSessionStanding[];
  readonly result: BasicSessionResult | null;
}

/** The requesting participant's hand is empty before the first deal. Round completion does not reveal opponents. */
export interface PlayerView extends PublicGameView {
  readonly playerId: PlayerId;
  readonly hand: readonly Card[];
}

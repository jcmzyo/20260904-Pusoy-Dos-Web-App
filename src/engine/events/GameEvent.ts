import type { Combination, PlayerId } from '../../domain';
import type { BasicRoundResult } from '../rounds/resolveBasicRound';
import type { BasicSessionResult, BasicSessionStanding } from '../sessions/basicSessionResult';

/** Public facts only: dealt cards and remaining hands are never event payloads. */
export type GameEvent =
  | { readonly type: 'SESSION_STARTED'; readonly mode: 'basic'; readonly playerIds: readonly PlayerId[] }
  | ({ readonly roundNumber: number } & (
    | { readonly type: 'ROUND_STARTED' }
    | { readonly type: 'CARDS_DEALT'; readonly players: readonly { readonly playerId: PlayerId; readonly cardCount: number }[] }
    | { readonly type: 'TURN_CHANGED'; readonly playerId: PlayerId }
    | { readonly type: 'CARDS_PLAYED'; readonly playerId: PlayerId; readonly combination: Combination }
    | { readonly type: 'PLAYER_PASSED'; readonly playerId: PlayerId }
    | { readonly type: 'PLAYER_FINISHED'; readonly playerId: PlayerId; readonly placement: 1 | 2 | 3 }
    | { readonly type: 'TRICK_ENDED'; readonly lastSuccessfulPlayerId: PlayerId }
    | { readonly type: 'ROUND_ENDED'; readonly result: BasicRoundResult }
    | { readonly type: 'SCORE_CALCULATED'; readonly result: BasicRoundResult; readonly standings: readonly BasicSessionStanding[] }
    | { readonly type: 'SESSION_ENDED'; readonly result: BasicSessionResult }
  ));

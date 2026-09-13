import type { Move, PlayerId } from '../../domain';
import type { PlayerTurnRequest } from '../requests/PlayerTurnRequest';

/** Supplies player intent; the Engine remains authoritative for Move validation. */
export interface PlayerController {
  readonly playerId: PlayerId;
  chooseMove(request: PlayerTurnRequest): Promise<Move>;
}

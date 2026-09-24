import type { Move, PlayerId } from '../../domain';
import type { PlayerView } from '../../engine';

/** Opaque to controllers; the Orchestrator must assign a fresh identity for each request. */
export type TurnRequestId = string;

/** Carries only detached Engine-approved information, never authoritative state. */
export interface PlayerTurnRequest {
  readonly playerId: PlayerId;
  readonly view: PlayerView;
  readonly legalMoves: readonly Move[];
  readonly requestId: TurnRequestId;
}

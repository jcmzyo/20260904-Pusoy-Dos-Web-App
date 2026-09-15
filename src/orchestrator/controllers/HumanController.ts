import type { Move, PlayerId } from '../../domain';
import type { PlayerTurnRequest, TurnRequestId } from '../requests/PlayerTurnRequest';
import type { PlayerController } from './PlayerController';

interface PendingInput {
  readonly request: PlayerTurnRequest;
  readonly requestId: TurnRequestId;
  readonly resolve: (move: Move) => void;
  readonly reject: (reason: Error) => void;
}

/** Adapts human intent only; pausing this input source does not pause bot execution. */
export class HumanController implements PlayerController {
  private pending: PendingInput | undefined;
  private paused = false;

  constructor(readonly playerId: PlayerId) {}

  async chooseMove(request: PlayerTurnRequest): Promise<Move> {
    if (this.pending) throw new Error('A human Turn request is already pending.');
    if (request.playerId !== this.playerId) throw new Error(`Human controller ${this.playerId} received a request for ${request.playerId}.`);
    return new Promise<Move>((resolve, reject) => {
      this.pending = { request, requestId: request.requestId, resolve, reject };
    });
  }

  getPendingRequest(): PlayerTurnRequest | null {
    return this.pending?.request ?? null;
  }

  /** True means intent was delivered once, not that the Engine accepted the Move. */
  resolveMove(requestId: TurnRequestId, move: Move): boolean {
    const pending = this.pending;
    if (!pending || this.paused || pending.requestId !== requestId || move.playerId !== this.playerId) return false;
    const intent: Move = move.kind === 'play'
      ? { ...move, cards: move.cards.map((card) => ({ ...card })) }
      : { ...move };
    this.pending = undefined;
    pending.resolve(intent);
    return true;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** Cancels only the identified pending input; the caller handles the rejected runner operation. */
  cancelPendingRequest(requestId: TurnRequestId): boolean {
    const pending = this.pending;
    if (!pending || pending.requestId !== requestId) return false;
    this.pending = undefined;
    pending.reject(new Error(`Human input cancelled for request ${requestId}, player ${this.playerId}.`));
    return true;
  }
}

import type { Move, PlayerId } from '../../domain';
import type { PlayerTurnRequest, TurnRequestId } from '../requests/PlayerTurnRequest';
import type { PlayerController } from './PlayerController';

interface PendingInput {
  readonly request: PlayerTurnRequest;
  readonly requestId: TurnRequestId;
  readonly resolve: (move: Move) => void;
  readonly reject: (reason: Error) => void;
}

function cancellationError(requestId: TurnRequestId, playerId: PlayerId): Error {
  return new Error(`Human input cancelled for request ${requestId}, player ${playerId}.`);
}

/** Adapts human intent only; pausing this input source does not pause bot execution. */
export class HumanController implements PlayerController {
  private pending: PendingInput | undefined;
  private paused = false;
  private destroyed = false;

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

  /**
   * True means the Move was delivered to `chooseMove()`'s own Promise, not that the Engine has received
   * (let alone accepted) it - GameRunner's own `commitWhenSubmissionAllowed()` is what actually guards
   * Engine submission against a pause()/destroy() landing before that (M4-P1 review finding). Refusing
   * outright while paused/destroyed here is a separate, narrower concern: it leaves a still-pending
   * request completely untouched (not consumed) while paused, so the same request remains legitimately
   * resolvable once `resume()` lifts the pause, without requiring any retry/queueing behavior of its own.
   */
  resolveMove(requestId: TurnRequestId, move: Move): boolean {
    const pending = this.pending;
    if (!pending || this.paused || this.destroyed || pending.requestId !== requestId || move.playerId !== this.playerId) return false;
    this.pending = undefined;
    const intent: Move = move.kind === 'play'
      ? { ...move, cards: move.cards.map((card) => ({ ...card })) }
      : { ...move };
    pending.resolve(intent);
    return true;
  }

  pause(): void {
    this.paused = true;
  }

  /** Resumes accepting `resolveMove()` once every `pause()` call has been matched by a `resume()`.
   *  A `resume()` with no outstanding `pause()` is a no-op rather than going negative. */
  resume(): void {
    this.paused = false;
  }

  /** Cancels the identified pending request; the caller handles the rejected runner operation. */
  cancelPendingRequest(requestId: TurnRequestId): boolean {
    const pending = this.pending;
    if (!pending || pending.requestId !== requestId) return false;
    this.pending = undefined;
    pending.reject(cancellationError(requestId, this.playerId));
    return true;
  }

  /**
   * Permanently invalidates this input source (M4-P1 review finding: destruction/Leave Game must not
   * leave a pending human request dangling). Rejects a genuinely unresolved pending request so GameRunner's
   * own suspended `await controller.chooseMove()` always settles (by rejecting) instead of hanging forever,
   * and its `executeTurn()` never reaches Engine submission for it. Idempotent; a repeat call is a no-op,
   * and every subsequent `resolveMove()`/`cancelPendingRequest()` for the request rejected here is refused
   * (its `pending` slot is already cleared). `chooseMove()` itself is intentionally left callable
   * afterward - mirroring `SessionPresentation.runTurn()`'s own contract of running an explicit,
   * caller-requested Turn to completion regardless of destroy state - this only guards the request already
   * outstanding when it is called.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const pending = this.pending;
    if (pending) {
      this.pending = undefined;
      pending.reject(cancellationError(pending.requestId, this.playerId));
    }
  }
}

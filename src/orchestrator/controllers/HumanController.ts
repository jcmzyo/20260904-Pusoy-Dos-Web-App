import type { Move, PlayerId } from '../../domain';
import type { PlayerTurnRequest, TurnRequestId } from '../requests/PlayerTurnRequest';
import type { PlayerController } from './PlayerController';

interface PendingInput {
  readonly request: PlayerTurnRequest;
  readonly requestId: TurnRequestId;
  readonly resolve: (move: Move) => void;
  readonly reject: (reason: Error) => void;
}

/** A Move already accepted by `resolveMove()` but not yet delivered to `chooseMove()`'s own Promise -
 *  held here only while `paused` was (or became) true before delivery could happen; see `resolveMove()`. */
interface DeferredDelivery {
  readonly requestId: TurnRequestId;
  readonly move: Move;
  readonly resolve: (move: Move) => void;
  readonly reject: (reason: Error) => void;
}

function cancellationError(requestId: TurnRequestId, playerId: PlayerId): Error {
  return new Error(`Human input cancelled for request ${requestId}, player ${playerId}.`);
}

/** Adapts human intent only; pausing this input source does not pause bot execution. */
export class HumanController implements PlayerController {
  private pending: PendingInput | undefined;
  private deferred: DeferredDelivery | undefined;
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
   * True means intent was accepted for delivery, not that the Engine has received (let alone accepted)
   * the Move yet. Delivery — settling `chooseMove()`'s own Promise, which is what lets GameRunner's
   * suspended `await controller.chooseMove()` continuation resume and reach Engine submission — is
   * deferred by one microtask rather than performed synchronously here (M4-P1 review finding: a
   * `pause()`/`destroy()` call made synchronously right after this method returns, before that
   * continuation ever ran, used to have no way to intercept it — once a Promise's own `resolve` is
   * invoked, its continuations are unconditionally scheduled, so the check has to happen strictly before
   * that call, not after it). The deferred check below always runs after any synchronous code following
   * this call (including a same-tick `pause()`/`destroy()`), so it always observes up-to-date state.
   *
   * If still paused once the deferred check actually runs, the accepted Move is held (not dropped) and
   * only delivered once `resume()` lifts the pause — the authoritative Engine state stays exactly as it
   * was throughout the pause, not merely its outward publication. If destroyed by then, it is dropped and
   * the request rejected instead, identically to an explicit `cancelPendingRequest`.
   */
  resolveMove(requestId: TurnRequestId, move: Move): boolean {
    const pending = this.pending;
    if (!pending || this.paused || this.destroyed || pending.requestId !== requestId || move.playerId !== this.playerId) return false;
    const intent: Move = move.kind === 'play'
      ? { ...move, cards: move.cards.map((card) => ({ ...card })) }
      : { ...move };
    this.pending = undefined;
    const deferred: DeferredDelivery = { requestId, move: intent, resolve: pending.resolve, reject: pending.reject };
    queueMicrotask(() => this.deliver(deferred));
    return true;
  }

  private deliver(deferred: DeferredDelivery): void {
    if (this.destroyed) { deferred.reject(cancellationError(deferred.requestId, this.playerId)); return; }
    if (this.paused) { this.deferred = deferred; return; }
    deferred.resolve(deferred.move);
  }

  pause(): void {
    this.paused = true;
  }

  /** Resumes automatic Turn advancement once every `pause()` call has been matched by a `resume()`.
   *  A `resume()` with no outstanding `pause()` is a no-op rather than going negative. Also delivers a
   *  Move that `resolveMove()` accepted while paused (or that became paused before its own deferred
   *  delivery check ran) — nothing accepted during a pause is ever lost, only delayed until here. */
  resume(): void {
    this.paused = false;
    const deferred = this.deferred;
    if (!deferred) return;
    this.deferred = undefined;
    deferred.resolve(deferred.move);
  }

  /** Cancels the identified input, whether still genuinely unresolved or already `resolveMove()`-accepted
   *  but held back by a pause (see `resolveMove()`); the caller handles the rejected runner operation. */
  cancelPendingRequest(requestId: TurnRequestId): boolean {
    const pending = this.pending;
    if (pending && pending.requestId === requestId) {
      this.pending = undefined;
      pending.reject(cancellationError(requestId, this.playerId));
      return true;
    }
    const deferred = this.deferred;
    if (deferred && deferred.requestId === requestId) {
      this.deferred = undefined;
      deferred.reject(cancellationError(requestId, this.playerId));
      return true;
    }
    return false;
  }

  /**
   * Permanently invalidates this input source (M4-P1 review finding: destruction/Leave Game must not
   * leave a pending human request dangling, nor let a `resolveMove()`-accepted-but-undelivered response
   * reach the Engine afterward). Rejects whatever is currently outstanding — a genuinely unresolved
   * pending request, or an accepted one still held back by a pause — so GameRunner's own suspended
   * `await controller.chooseMove()` always settles (by rejecting) instead of hanging forever, and its
   * `executeTurn()` never reaches Engine submission for it. A Move already delivered before this call is
   * already out of this controller's reach and unaffected. Idempotent; a repeat call is a no-op, and every
   * subsequent `resolveMove()` for the request rejected here is refused (its `pending`/`deferred` slot is
   * already cleared). `chooseMove()` itself is intentionally left callable afterward — mirroring
   * `SessionPresentation.runTurn()`'s own contract of running an explicit, caller-requested Turn to
   * completion regardless of destroy state — this only guards the request(s) already outstanding when it
   * is called.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const pending = this.pending;
    if (pending) {
      this.pending = undefined;
      pending.reject(cancellationError(pending.requestId, this.playerId));
    }
    const deferred = this.deferred;
    if (deferred) {
      this.deferred = undefined;
      deferred.reject(cancellationError(deferred.requestId, this.playerId));
    }
  }
}

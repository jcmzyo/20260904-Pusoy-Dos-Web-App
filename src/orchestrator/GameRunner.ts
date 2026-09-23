import type { Move, PlayerId } from '../domain';
import { assertEngineInvariants, assertMoveInvariants, getCompletedRoundReveal, getPlayerView, getPublicView, startRound, submitMove } from '../engine';
import type { EngineResult, MoveResult, PublicGameView, RNG, RulesetConfig } from '../engine';
import type { PlayerController } from './controllers/PlayerController';
import { createPlayerTurnRequest } from './requests/createPlayerTurnRequest';
import type { TurnRequestId } from './requests/PlayerTurnRequest';
import type { RunnerDiagnostic, RunnerDiagnosticObserver } from './RunnerDiagnostic';

interface PendingTurn {
  readonly requestId: TurnRequestId;
  readonly playerId: PlayerId;
  readonly state: EngineResult['state'];
}

/** Adds request context only to rejections for diagnostics; accepted Engine results pass through unchanged. */
export type ControllerTurnResult =
  | Extract<MoveResult, { accepted: true }>
  | (Extract<MoveResult, { accepted: false }> & {
      readonly context: { readonly requestId: TurnRequestId; readonly playerId: PlayerId };
    });

export type RunnerStatus = 'READY' | 'ROUND_ACTIVE' | 'ROUND_RESULT' | 'SESSION_COMPLETE';

export interface RoundResultCheckpoint {
  readonly status: 'ROUND_RESULT';
  readonly view: PublicGameView;
}

/**
 * Resolves once every currently-queued microtask has drained, no matter how many chained `await`s a
 * caller inserts (M4-P1 review finding, escalated: a fixed number of `queueMicrotask` hops can always be
 * defeated by a caller adding one more `await` before its own `pause()`/`destroy()` call, since whichever
 * continuation was enqueued first in the microtask FIFO queue always runs first). A macrotask boundary has
 * no such bound - the entire microtask queue, however deep, is spec-guaranteed to empty before any queued
 * task runs - so `commitWhenSubmissionAllowed` below re-checks pause/destroy state only after crossing one
 * of these on every iteration, including immediately after a `resumeSubmission()` call, so that a
 * `pause()`/`destroy()` issued synchronously right after a `resume()` is always observed too.
 *
 * A `MessageChannel` round-trip is used rather than `setTimeout(fn, 0)` specifically because both browsers
 * and jsdom clamp a *chain* of nested zero-delay timeouts to a minimum of ~4ms once past a handful of
 * levels of nesting (the HTML nested-timers throttle) - and every Turn in a Session schedules the next
 * link in exactly such a chain here, so that clamp would compound into a visible per-Turn delay across a
 * whole Session. A `MessageChannel` message is still an ordinary queued task (not a microtask - the
 * ordering guarantee above still holds), but is not subject to that throttle.
 */
function yieldToMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(undefined);
  });
}

/** Coordinates Turns and autonomous Rounds against an existing Engine Session.
 * Optional Engine checks cover initialization, Round starts and every Move result, including completion/rejection.
 */
export class GameRunner {
  private state: EngineResult['state'];
  private readonly controllers: ReadonlyMap<PlayerId, PlayerController>;
  private turnPending = false;
  private roundPending = false;
  private continuationPending = false;
  private activeRequest: PendingTurn | undefined;
  private submissionPauseCount = 0;
  private submissionResumeWaiters: (() => void)[] = [];
  private destroyed = false;

  constructor(state: EngineResult['state'], private readonly ruleset: RulesetConfig, controllers: ReadonlyMap<PlayerId, PlayerController>, private readonly checkInvariants = false, private readonly diagnosticObserver?: RunnerDiagnosticObserver) {
    if (this.checkInvariants) assertEngineInvariants(state, this.ruleset);
    const playerIds = getPublicView(state).playerIds;
    const registered = new Map(controllers);
    for (const playerId of playerIds) {
      const controller = registered.get(playerId);
      if (!controller) throw new Error(`Missing controller for player ${playerId}.`);
      if (controller.playerId !== playerId) throw new Error(`Controller mapping for player ${playerId} identifies player ${controller.playerId}.`);
    }
    for (const playerId of registered.keys()) {
      if (!playerIds.includes(playerId)) throw new Error(`Controller registered for non-participant ${playerId}.`);
    }
    this.state = state;
    this.controllers = registered;
  }

  private diagnose(entry: RunnerDiagnostic): void {
    if (this.diagnosticObserver) this.diagnosticObserver(JSON.parse(JSON.stringify(entry)) as RunnerDiagnostic);
  }

  /**
   * Guards authoritative Engine submission itself (orchestrator.md §26: "pending controller input should
   * not be allowed to advance state unless the runner explicitly accepts it after resume"), not merely
   * this runner's own outward results - a controller response already accepted by its own external
   * resolution point (e.g. `HumanController.resolveMove()`) or already decided by a bot's `chooseMove()`
   * must still not reach `submitResponse()` while paused, however many ticks separate that acceptance from
   * this call (M4-P1 review finding, escalated). Reference-counted like `SessionPresentation.pause()`,
   * which this is called from on every one of its own calls; see `resumeSubmission()`/`destroy()` and
   * `commitWhenSubmissionAllowed()` below for how a Turn already in flight is actually held.
   */
  pauseSubmission(): void {
    this.submissionPauseCount += 1;
  }

  /** Resumes Engine submission once every `pauseSubmission()` call has been matched by a `resumeSubmission()`.
   *  A `resumeSubmission()` with no outstanding `pauseSubmission()` is a no-op rather than going negative.
   *  Wakes a Turn currently held in `commitWhenSubmissionAllowed()`'s own wait, which re-checks state after
   *  crossing a fresh macrotask boundary rather than committing immediately here - so a `pauseSubmission()`
   *  or `destroy()` issued synchronously right after this call is still guaranteed to be observed first. */
  resumeSubmission(): void {
    if (this.submissionPauseCount === 0) return;
    this.submissionPauseCount -= 1;
    if (this.submissionPauseCount > 0) return;
    const waiters = this.submissionResumeWaiters.splice(0);
    waiters.forEach((resolve) => resolve());
  }

  /**
   * Permanently cancels this runner (orchestrator.md §28: "pending Turn requests become invalid; late
   * controller responses are ignored; no new engine Move is submitted by the cancelled runner"). A Turn
   * currently held in `commitWhenSubmissionAllowed()`'s own wait - paused or not - is rejected instead of
   * ever reaching `submitResponse()`, regardless of how long ago its controller already decided a Move.
   * Idempotent; a repeat call is a safe no-op. Deliberately does not touch `turnPending`/`activeRequest`
   * itself - the in-flight `executeTurn()` call observes this via `commitWhenSubmissionAllowed()` and clears
   * them itself once its own Promise settles (by rejecting), so no other Turn can start concurrently in
   * the meantime (orchestrator.md §29: "two active controller requests for one Turn").
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const waiters = this.submissionResumeWaiters.splice(0);
    waiters.forEach((resolve) => resolve());
  }

  getStatus(): RunnerStatus {
    const view = getPublicView(this.state);
    if (view.status === 'completed') return 'SESSION_COMPLETE';
    if (view.round?.status === 'completed') return 'ROUND_RESULT';
    return view.round === null ? 'READY' : 'ROUND_ACTIVE';
  }

  getPlayerView(playerId: PlayerId) {
    return getPlayerView(this.state, playerId);
  }

  getCompletedRoundReveal() {
    return getCompletedRoundReveal(this.state);
  }

  /** The final Round checkpoint remains available alongside the official Session result. */
  getRoundResultCheckpoint(): RoundResultCheckpoint | null {
    const view = getPublicView(this.state);
    return view.round?.status === 'completed' ? { status: 'ROUND_RESULT', view } : null;
  }

  /** Starts exactly one next Round; the caller explicitly drives its Turns with runTurn/runRound. */
  continueToNextRound(rng: RNG): EngineResult {
    if (this.continuationPending || this.roundPending || this.turnPending) throw new Error('A controller Turn, Round or continuation is already pending.');
    if (this.getStatus() !== 'ROUND_RESULT') throw new Error('Continuation requires a Round Result checkpoint in an unfinished Session.');
    this.continuationPending = true;
    try {
      this.diagnose({ kind: 'roundStart', state: this.state });
      if (this.checkInvariants) assertEngineInvariants(this.state, this.ruleset);
      const result = startRound(this.state, rng);
      this.diagnose({ kind: 'transaction', result });
      if (this.checkInvariants) assertEngineInvariants(result.state, this.ruleset);
      this.state = result.state;
      return result;
    } finally {
      this.continuationPending = false;
    }
  }

  /** Overlapping calls fail rather than queueing an unintended additional Turn. Deliberately pause/destroy-
   *  immune, like `runRound()`/`continueToNextRound()` - an explicit, caller-requested Turn always runs to
   *  completion (orchestrator.md itself only ever asks pause/cancellation to hold back *automatic*
   *  advancement). `SessionPresentation`'s own automatic Turn-advancement loop uses `runAutoplayTurn()`
   *  below instead, which is the one `pauseSubmission()`/`destroy()` actually guard. */
  async runTurn(): Promise<ControllerTurnResult> {
    if (this.roundPending || this.continuationPending) throw new Error('A controller Round or continuation is already pending.');
    return this.executeTurn(false);
  }

  /**
   * `SessionPresentation`'s own automatic Turn-advancement loop's counterpart to `runTurn()` above (M4-P1
   * review finding, escalated): holds Engine submission itself back while `pauseSubmission()` is active,
   * and rejects instead of submitting once `destroy()`d - see `commitWhenSubmissionAllowed()`. Otherwise
   * identical to `runTurn()`, including its own re-entrancy guards; not for explicit/caller-requested Turns,
   * which must remain pause/destroy-immune (`runTurn()`'s own docstring).
   */
  async runAutoplayTurn(): Promise<ControllerTurnResult> {
    if (this.roundPending || this.continuationPending) throw new Error('A controller Round or continuation is already pending.');
    return this.executeTurn(true);
  }

  /** Runs the active Round; returns the final Engine transaction or stops at the first rejected Move.
   *  Pause/destroy-immune, like `runTurn()` above - used only for explicit/headless play (simulations),
   *  never through `SessionPresentation`'s own paused/destroyed presentation layer. */
  async runRound(): Promise<ControllerTurnResult> {
    if (this.roundPending || this.turnPending || this.continuationPending) throw new Error('A controller Turn, Round or continuation is already pending.');
    const view = getPublicView(this.state);
    if (view.status !== 'inProgress' || view.round?.status !== 'inProgress') {
      throw new Error('Round execution requires an active Round.');
    }
    this.roundPending = true;
    try {
      while (true) {
        const result = await this.executeTurn(false);
        if (!result.accepted || getPublicView(result.state).round?.status === 'completed') return result;
      }
    } finally {
      this.roundPending = false;
    }
  }

  private async executeTurn(guardSubmission: boolean): Promise<ControllerTurnResult> {
    if (this.turnPending) throw new Error('A controller Turn is already pending.');
    this.turnPending = true;
    try {
      this.diagnose({ kind: 'turnStart', state: this.state });
      const request = createPlayerTurnRequest(this.state, this.ruleset);
      this.diagnose({ kind: 'request', state: this.state, request });
      const controller = this.controllers.get(request.playerId);
      if (!controller) throw new Error(`Missing controller for player ${request.playerId}, request ${request.requestId}.`);
      if (controller.playerId !== request.playerId) throw new Error(`Controller mapping for player ${request.playerId} identifies player ${controller.playerId}, request ${request.requestId}.`);
      const pending = { requestId: request.requestId, playerId: request.playerId, state: this.state };
      this.activeRequest = pending;
      let move: Move;
      try {
        move = await controller.chooseMove(request);
        this.diagnose({ kind: 'proposal', move });
      } catch (cause) {
        throw new Error(`Controller failed for request ${pending.requestId}, player ${pending.playerId}.`, { cause });
      }
      if (controller.playerId !== pending.playerId) {
        throw new Error(`Controller mapping changed for request ${pending.requestId}, player ${pending.playerId}.`);
      }
      if (!guardSubmission) return this.submitResponse(pending, move);
      // Awaited deliberately (not a bare `return`): a try/finally's `finally` runs the instant control
      // leaves the try block, before an unawaited returned Promise ever settles - awaiting here is what
      // keeps `turnPending`/`activeRequest` set for this Turn's entire, possibly paused, duration below,
      // so no other Turn can start concurrently while Engine submission is held back.
      return await this.commitWhenSubmissionAllowed(pending, move);
    } finally {
      this.activeRequest = undefined;
      this.turnPending = false;
    }
  }

  /**
   * Holds a controller's already-decided Move here, re-checking pause/destroy state only after crossing a
   * fresh macrotask boundary each time (see `yieldToMacrotask()` above), until it is safe to actually
   * reach `submitResponse()` - the sole path by which this runner's authoritative Engine state advances.
   * Covers every controller uniformly (human or bot): a bot's own decision has no external resolution
   * point for `pauseSubmission()`/`destroy()` to intercept before this, unlike `HumanController`'s own
   * `pause()`/`destroy()`, which additionally hold back a human response's very delivery to `chooseMove()`
   * itself; this is what still catches it, and is also this runner's own, independent line of defense for
   * a human response regardless of that.
   */
  private async commitWhenSubmissionAllowed(pending: PendingTurn, move: Move): Promise<ControllerTurnResult> {
    while (true) {
      await yieldToMacrotask();
      if (this.destroyed) {
        throw new Error(`Controller response for request ${pending.requestId}, player ${pending.playerId} cancelled: runner destroyed before Engine submission.`);
      }
      if (this.submissionPauseCount === 0) return this.submitResponse(pending, move);
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => this.submissionResumeWaiters.push(resolve));
    }
  }

  private submitResponse(pending: PendingTurn, move: Move): ControllerTurnResult {
    const view = getPublicView(this.state);
    // The runner-owned token is single-use and bound to the exact immutable Engine state.
    if (this.activeRequest !== pending || this.state !== pending.state
      || view.status !== 'inProgress' || view.round?.status !== 'inProgress'
      || view.round.currentPlayerId !== pending.playerId) {
      throw new Error(`Stale or consumed controller response for request ${pending.requestId}, player ${pending.playerId}.`);
    }
    this.activeRequest = undefined;
    // Check the intent envelope only; card validity and legality remain Engine-owned.
    if (typeof move !== 'object' || move === null || Array.isArray(move)
      || typeof move.playerId !== 'string' || (move.kind !== 'play' && move.kind !== 'pass')
      || (move.kind === 'play' && !Array.isArray(move.cards))) {
      throw new Error(`Malformed controller response for request ${pending.requestId}, player ${pending.playerId}.`);
    }
    if (move.playerId !== pending.playerId) {
      throw new Error(`Controller response player mismatch for request ${pending.requestId}, player ${pending.playerId}.`);
    }
    // Detached input preserves transition evidence even if an Engine defect mutates its input.
    const previous = this.checkInvariants ? JSON.parse(JSON.stringify(this.state)) as EngineResult['state'] : undefined;
    const result = submitMove(this.state, move, this.ruleset);
    this.diagnose({ kind: 'transaction', result });
    if (previous) assertMoveInvariants(previous, move, result, this.ruleset);
    this.state = result.state;
    return result.accepted ? result : { ...result, context: { requestId: pending.requestId, playerId: pending.playerId } };
  }
}

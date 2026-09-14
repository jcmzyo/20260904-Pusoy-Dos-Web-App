import type { Move, PlayerId } from '../domain';
import { assertEngineInvariants, assertMoveInvariants, getPublicView, startRound, submitMove } from '../engine';
import type { EngineResult, MoveResult, PublicGameView, RNG, RulesetConfig } from '../engine';
import type { PlayerController } from './controllers/PlayerController';
import { createPlayerTurnRequest } from './requests/createPlayerTurnRequest';
import type { TurnRequestId } from './requests/PlayerTurnRequest';

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

  constructor(state: EngineResult['state'], private readonly ruleset: RulesetConfig, controllers: ReadonlyMap<PlayerId, PlayerController>, private readonly checkInvariants = false) {
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

  getStatus(): RunnerStatus {
    const view = getPublicView(this.state);
    if (view.status === 'completed') return 'SESSION_COMPLETE';
    if (view.round?.status === 'completed') return 'ROUND_RESULT';
    return view.round === null ? 'READY' : 'ROUND_ACTIVE';
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
      if (this.checkInvariants) assertEngineInvariants(this.state, this.ruleset);
      const result = startRound(this.state, rng);
      if (this.checkInvariants) assertEngineInvariants(result.state, this.ruleset);
      this.state = result.state;
      return result;
    } finally {
      this.continuationPending = false;
    }
  }

  /** Overlapping calls fail rather than queueing an unintended additional Turn. */
  async runTurn(): Promise<ControllerTurnResult> {
    if (this.roundPending || this.continuationPending) throw new Error('A controller Round or continuation is already pending.');
    return this.executeTurn();
  }

  /** Runs the active Round; returns the final Engine transaction or stops at the first rejected Move. */
  async runRound(): Promise<ControllerTurnResult> {
    if (this.roundPending || this.turnPending || this.continuationPending) throw new Error('A controller Turn, Round or continuation is already pending.');
    const view = getPublicView(this.state);
    if (view.status !== 'inProgress' || view.round?.status !== 'inProgress') {
      throw new Error('Round execution requires an active Round.');
    }
    this.roundPending = true;
    try {
      while (true) {
        const result = await this.executeTurn();
        if (!result.accepted || getPublicView(result.state).round?.status === 'completed') return result;
      }
    } finally {
      this.roundPending = false;
    }
  }

  private async executeTurn(): Promise<ControllerTurnResult> {
    if (this.turnPending) throw new Error('A controller Turn is already pending.');
    this.turnPending = true;
    try {
      const request = createPlayerTurnRequest(this.state, this.ruleset);
      const controller = this.controllers.get(request.playerId);
      if (!controller) throw new Error(`Missing controller for player ${request.playerId}, request ${request.requestId}.`);
      if (controller.playerId !== request.playerId) throw new Error(`Controller mapping for player ${request.playerId} identifies player ${controller.playerId}, request ${request.requestId}.`);
      const pending = { requestId: request.requestId, playerId: request.playerId, state: this.state };
      this.activeRequest = pending;
      let move: Move;
      try {
        move = await controller.chooseMove(request);
      } catch (cause) {
        throw new Error(`Controller failed for request ${pending.requestId}, player ${pending.playerId}.`, { cause });
      }
      if (controller.playerId !== pending.playerId) {
        throw new Error(`Controller mapping changed for request ${pending.requestId}, player ${pending.playerId}.`);
      }
      return this.submitResponse(pending, move);
    } finally {
      this.activeRequest = undefined;
      this.turnPending = false;
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
    if (previous) assertMoveInvariants(previous, move, result, this.ruleset);
    this.state = result.state;
    return result.accepted ? result : { ...result, context: { requestId: pending.requestId, playerId: pending.playerId } };
  }
}

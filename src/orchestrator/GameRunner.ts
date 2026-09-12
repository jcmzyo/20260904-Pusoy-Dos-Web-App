import type { Move, PlayerId } from '../domain';
import { getPublicView, submitMove } from '../engine';
import type { EngineResult, MoveResult, RulesetConfig } from '../engine';
import type { PlayerController } from './controllers/PlayerController';
import { createPlayerTurnRequest } from './requests/createPlayerTurnRequest';
import type { TurnRequestId } from './requests/PlayerTurnRequest';

interface PendingTurn {
  readonly requestId: TurnRequestId;
  readonly playerId: PlayerId;
  readonly state: EngineResult['state'];
}

/** Coordinates explicitly requested single Turns against an existing Engine Session. */
export class GameRunner {
  private state: EngineResult['state'];
  private readonly controllers: ReadonlyMap<PlayerId, PlayerController>;
  private turnPending = false;
  private activeRequest: PendingTurn | undefined;

  constructor(state: EngineResult['state'], private readonly ruleset: RulesetConfig, controllers: ReadonlyMap<PlayerId, PlayerController>) {
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

  /** Overlapping calls fail rather than queueing an unintended additional Turn. */
  async runTurn(): Promise<MoveResult> {
    if (this.turnPending) throw new Error('A controller Turn is already pending.');
    this.turnPending = true;
    try {
      const request = createPlayerTurnRequest(this.state, this.ruleset);
      const controller = this.controllers.get(request.playerId);
      if (!controller) throw new Error(`Missing controller for player ${request.playerId}.`);
      if (controller.playerId !== request.playerId) throw new Error(`Controller mapping for player ${request.playerId} identifies player ${controller.playerId}.`);
      const pending = { requestId: request.requestId, playerId: request.playerId, state: this.state };
      this.activeRequest = pending;
      const move = await controller.chooseMove(request);
      return this.submitResponse(pending, move);
    } finally {
      this.activeRequest = undefined;
      this.turnPending = false;
    }
  }

  private submitResponse(pending: PendingTurn, move: Move): MoveResult {
    const view = getPublicView(this.state);
    // The runner-owned token is single-use and bound to the exact immutable Engine state.
    if (this.activeRequest !== pending || this.state !== pending.state
      || view.status !== 'inProgress' || view.round?.status !== 'inProgress'
      || view.round.currentPlayerId !== pending.playerId) {
      throw new Error(`Stale or consumed controller response for request ${pending.requestId}, player ${pending.playerId}.`);
    }
    this.activeRequest = undefined;
    const result = submitMove(this.state, move, this.ruleset);
    this.state = result.state;
    return result;
  }
}

import type { Move, PlayerId } from '../domain';
import { defaultRuleset } from '../engine';
import type { RulesetConfig } from '../engine';
import type { PlayerController, PlayerTurnRequest } from '../orchestrator';
import { chooseBaselineMove } from './evaluation/evaluateCandidates';

export class BaselineController implements PlayerController {
  constructor(readonly playerId: PlayerId, private readonly ruleset: RulesetConfig = defaultRuleset) {}

  async chooseMove(request: PlayerTurnRequest): Promise<Move> {
    if (request.playerId !== this.playerId) throw new Error(`Baseline controller ${this.playerId} received a request for ${request.playerId}.`);
    return chooseBaselineMove(request, this.ruleset);
  }
}

import type { Move, PlayerId } from '../domain';
import { defaultRuleset } from '../engine';
import type { RulesetConfig } from '../engine';
import type { PlayerController, PlayerTurnRequest } from '../orchestrator';
import { chooseBaselineMove } from './evaluation/evaluateCandidates';
import type { DecisionTrace } from './evaluation/evaluateCandidates';
import type { DecompositionMetrics } from './decomposition/minPlays';

export class BaselineController implements PlayerController {
  constructor(readonly playerId: PlayerId, private readonly ruleset: RulesetConfig = defaultRuleset, private readonly onDecision?: (trace: DecisionTrace) => void, private readonly onDecomposition?: (metrics: DecompositionMetrics) => void) {}

  async chooseMove(request: PlayerTurnRequest): Promise<Move> {
    if (request.playerId !== this.playerId) throw new Error(`Baseline controller ${this.playerId} received a request for ${request.playerId}.`);
    return chooseBaselineMove(request, this.ruleset, this.onDecision, this.onDecomposition);
  }
}

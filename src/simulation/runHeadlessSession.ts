import type { RNG } from '../engine';
import type { ControllerTurnResult, GameRunner } from '../orchestrator';
import { SimulationGuardError } from './SimulationGuards';

/** Drives an already-started Session through the same explicit checkpoints used by application consumers. */
export async function runHeadlessSession(runner: GameRunner, rng: RNG): Promise<ControllerTurnResult> {
  const continueRound = (): void => {
    const checkpoint = runner.getRoundResultCheckpoint();
    if (runner.getStatus() !== 'ROUND_RESULT' || !checkpoint) {
      throw new SimulationGuardError('LIFECYCLE', 'Expected an unfinished Round Result checkpoint.');
    }
    const result = runner.continueToNextRound(rng);
    if (runner.getStatus() !== 'ROUND_ACTIVE' || result.state.roundNumber !== checkpoint.view.roundNumber + 1) {
      throw new SimulationGuardError('LIFECYCLE', 'Round Result checkpoint did not advance to the next active Round.');
    }
  };
  if (runner.getStatus() === 'ROUND_RESULT') continueRound();
  while (true) {
    const result = await runner.runRound();
    if (!result.accepted) return result;
    if (runner.getStatus() === 'SESSION_COMPLETE') {
      if (result.state.kind !== 'completed') throw new SimulationGuardError('LIFECYCLE', 'Runner completed without an authoritative Session result.');
      return result;
    }
    continueRound();
  }
}

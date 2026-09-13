import type { RNG } from '../engine';
import type { ControllerTurnResult, GameRunner } from '../orchestrator';

/** Drives an already-started Session through the same explicit checkpoints used by application consumers. */
export async function runHeadlessSession(runner: GameRunner, rng: RNG): Promise<ControllerTurnResult> {
  if (runner.getStatus() === 'ROUND_RESULT') runner.continueToNextRound(rng);
  while (true) {
    const result = await runner.runRound();
    if (!result.accepted || runner.getStatus() === 'SESSION_COMPLETE') return result;
    runner.continueToNextRound(rng);
  }
}

import { BaselineController } from '../ai';
import { createSession, defaultRuleset, startRound } from '../engine';
import type { RNG } from '../engine';
import { GameRunner } from '../orchestrator';
import type { ControllerTurnResult } from '../orchestrator';
import type { SimulationConfig } from './SimulationConfig';
import { runHeadlessSession } from './runHeadlessSession';

/** Runs one fresh production Session; returns its final transaction, including any rejection unchanged. */
export async function runSimulation(config: SimulationConfig): Promise<ControllerTurnResult> {
  if (!Number.isInteger(config.engineSeed) || config.engineSeed < 0 || config.engineSeed > 0xffffffff) {
    throw new RangeError('Simulation engineSeed must be an unsigned 32-bit integer.');
  }
  if (config.mode !== 'basic' || config.rulesetId !== 'default'
    || config.seats.some((seat) => seat.controller !== 'baseline')) {
    throw new Error('Simulation requires Basic mode, the default ruleset, and Baseline controllers.');
  }
  let seed = config.engineSeed;
  // One LCG stream spans all five deals; never reset it at Round checkpoints.
  const rng: RNG = { next: () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  } };
  const session = createSession(config.seats.map((seat) => seat.playerId));
  const controllers = config.seats.map((seat) => new BaselineController(seat.playerId, defaultRuleset));
  const state = startRound(session.state, rng).state;
  const runner = new GameRunner(state, defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])));
  return runHeadlessSession(runner, rng);
}

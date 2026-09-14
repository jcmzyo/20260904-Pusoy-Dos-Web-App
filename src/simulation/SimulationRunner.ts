import { BaselineController } from '../ai';
import { assertEngineInvariants, createSession, defaultRuleset, startRound } from '../engine';
import type { RNG } from '../engine';
import { GameRunner } from '../orchestrator';
import type { ControllerTurnResult } from '../orchestrator';
import type { SimulationConfig } from './SimulationConfig';
import { runHeadlessSession } from './runHeadlessSession';
import { SimulationDiagnostics } from './SimulationFailure';
import type { SimulationFailure } from './SimulationFailure';

/** Runs one fresh production Session; returns its final transaction, including any rejection unchanged. */
export async function runSimulation(config: SimulationConfig): Promise<ControllerTurnResult> {
  return executeSimulation(config);
}

export type RecordedSimulationResult =
  | { readonly status: 'completed'; readonly config: SimulationConfig; readonly result: ControllerTurnResult }
  | { readonly status: 'failed'; readonly failure: SimulationFailure };

/** Diagnostic entry point: failures retain evidence; successful results omit the verbose trace. */
export async function runRecordedSimulation(config: SimulationConfig, options: { readonly batchIndex?: number; readonly decisionTrace?: boolean } = {}): Promise<RecordedSimulationResult> {
  const recordedConfig = JSON.parse(JSON.stringify(config)) as SimulationConfig;
  const diagnostics = new SimulationDiagnostics(recordedConfig, options.batchIndex);
  try {
    const result = await executeSimulation(recordedConfig, diagnostics, options.decisionTrace);
    return result.accepted ? { status: 'completed', config: recordedConfig, result } :
      { status: 'failed', failure: diagnostics.failure(result.error.code, result.error) };
  } catch (error) {
    return { status: 'failed', failure: diagnostics.failure(error) };
  }
}

async function executeSimulation(config: SimulationConfig, diagnostics?: SimulationDiagnostics, decisionTrace = false): Promise<ControllerTurnResult> {
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
  diagnostics?.observe(JSON.parse(JSON.stringify({ kind: 'transaction', result: session })));
  assertEngineInvariants(session.state, defaultRuleset);
  const controllers = config.seats.map((seat) => new BaselineController(seat.playerId, defaultRuleset, decisionTrace ? diagnostics?.onDecision : undefined));
  diagnostics?.observe(JSON.parse(JSON.stringify({ kind: 'roundStart', state: session.state })));
  const started = startRound(session.state, rng);
  diagnostics?.observe(JSON.parse(JSON.stringify({ kind: 'transaction', result: started })));
  const runner = new GameRunner(started.state, defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])), true, diagnostics?.observe);
  return runHeadlessSession(runner, rng);
}

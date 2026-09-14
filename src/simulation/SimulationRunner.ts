import { BaselineController } from '../ai';
import { assertEngineInvariants, createSession, defaultRuleset, startRound } from '../engine';
import type { RNG } from '../engine';
import { GameRunner } from '../orchestrator';
import type { ControllerTurnResult } from '../orchestrator';
import type { SimulationConfig } from './SimulationConfig';
import { runHeadlessSession } from './runHeadlessSession';
import { SimulationDiagnostics } from './SimulationFailure';
import type { SimulationFailure, SimulationTraceEntry } from './SimulationFailure';
import { SimulationGuards } from './SimulationGuards';
import { SimulationMetricsCollector } from './SimulationMetrics';
import type { SimulationMetrics } from './SimulationMetrics';

/** Runs one fresh production Session; returns its final transaction, including any rejection unchanged. */
export async function runSimulation(config: SimulationConfig): Promise<ControllerTurnResult> {
  return executeSimulation(config);
}

export type RecordedSimulationResult = { readonly metrics?: SimulationMetrics } & (
  | { readonly status: 'completed'; readonly config: SimulationConfig; readonly result: ControllerTurnResult; readonly trace?: readonly SimulationTraceEntry[] }
  | { readonly status: 'failed'; readonly failure: SimulationFailure });

/** Diagnostic entry point: failures retain evidence; successful results omit the verbose trace by default. */
export async function runRecordedSimulation(config: SimulationConfig, options: { readonly batchIndex?: number; readonly decisionTrace?: boolean; readonly trace?: boolean; readonly metrics?: boolean; readonly decompositionMetrics?: boolean; readonly includePrivateHands?: boolean } = {}): Promise<RecordedSimulationResult> {
  const recordedConfig = JSON.parse(JSON.stringify(config)) as SimulationConfig;
  const diagnostics = new SimulationDiagnostics(recordedConfig, options.batchIndex, options.includePrivateHands);
  const metrics = options.metrics || options.decompositionMetrics ? new SimulationMetricsCollector(options.decompositionMetrics) : undefined;
  try {
    const result = await executeSimulation(recordedConfig, diagnostics, options.decisionTrace, metrics, options.decompositionMetrics);
    const measured = metrics ? { metrics: metrics.snapshot() } : {};
    return result.accepted ? { status: 'completed', config: recordedConfig, result, ...measured, ...(options.trace ? { trace: diagnostics.getTrace() } : {}) } :
      { status: 'failed', failure: diagnostics.failure(result.error.code, result.error), ...measured };
  } catch (error) {
    return { status: 'failed', failure: diagnostics.failure(error), ...(metrics ? { metrics: metrics.snapshot() } : {}) };
  }
}

async function executeSimulation(config: SimulationConfig, diagnostics?: SimulationDiagnostics, decisionTrace = false, metrics?: SimulationMetricsCollector, decompositionMetrics = false): Promise<ControllerTurnResult> {
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
  const guards = new SimulationGuards();
  const controllers = config.seats.map((seat) => guards.controller(new BaselineController(seat.playerId, defaultRuleset, decisionTrace ? diagnostics?.onDecision : undefined, decompositionMetrics ? metrics?.onDecomposition : undefined)));
  diagnostics?.observe(JSON.parse(JSON.stringify({ kind: 'roundStart', state: session.state })));
  const started = startRound(session.state, rng);
  metrics?.observe({ kind: 'transaction', result: started });
  diagnostics?.observe(JSON.parse(JSON.stringify({ kind: 'transaction', result: started })));
  const runner = new GameRunner(started.state, defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])), true, (entry) => {
    diagnostics?.observe(entry);
    metrics?.observe(entry);
    guards.observe(entry);
  });
  return runHeadlessSession(runner, rng);
}

import type { SimulationBatchResult } from './SimulationBatch';
import type { SimulationException, SimulationFailure } from './SimulationFailure';
import { mergeDurations } from './SimulationMetrics';
import type { DurationSummary, SimulationMetrics } from './SimulationMetrics';

export interface SimulationBatchMetrics {
  readonly roundsCompleted: number;
  readonly attemptedActions: number;
  readonly acceptedActions: number;
  readonly passes: number;
  readonly passFrequency: number;
  readonly durationMs: number;
  readonly sessionDuration: DurationSummary;
  readonly decisionDuration: DurationSummary;
  readonly decomposition?: NonNullable<SimulationMetrics['decomposition']>;
  readonly failureTypes: Readonly<Record<SimulationFailure['failureType'], number>>;
  readonly invariantCodes: Readonly<Record<string, number>>;
  /** Guard failures can also be classified as controller/exception failures; do not sum the categories. */
  readonly guardCodes: Readonly<Record<string, number>>;
  /** Each reference locates the full artifact at runs[batchIndex].outcome.failure. Duplicate seeds stay distinct. */
  readonly failures: readonly { readonly batchIndex: number; readonly runId: string; readonly engineSeed: number; readonly failureType: SimulationFailure['failureType'] }[];
}

function guardCode(exception: SimulationException | undefined): string | undefined {
  if (!exception) return undefined;
  if (exception.name === 'SimulationGuardError') return exception.message.split(':')[0];
  return guardCode(exception.cause);
}

export function aggregateSimulationMetrics(runs: SimulationBatchResult['runs'], durationMs: number): SimulationBatchMetrics {
  const measurements = runs.map(({ outcome }) => {
    if (!outcome.metrics) throw new Error('Batch reporting requires metrics for every attempted Session.');
    return outcome.metrics;
  });
  const failureTypes = { invariant: 0, controller: 0, rejectedMove: 0, exception: 0 };
  const invariantCodes: Record<string, number> = {};
  const guardCodes: Record<string, number> = {};
  const failures: SimulationBatchMetrics['failures'][number][] = [];
  for (const { batchIndex, outcome } of runs) {
    if (outcome.status !== 'failed') continue;
    const failure = outcome.failure;
    failureTypes[failure.failureType]++;
    if (failure.invariantCode) invariantCodes[failure.invariantCode] = (invariantCodes[failure.invariantCode] ?? 0) + 1;
    const code = guardCode(failure.exception);
    if (code) guardCodes[code] = (guardCodes[code] ?? 0) + 1;
    failures.push({ batchIndex, runId: failure.config.runId, engineSeed: failure.config.engineSeed, failureType: failure.failureType });
  }
  const acceptedActions = measurements.reduce((sum, value) => sum + value.acceptedActions, 0);
  const passes = measurements.reduce((sum, value) => sum + value.passes, 0);
  const instrumented = measurements.flatMap((value) => value.decomposition ? [value.decomposition] : []);
  const decomposition = instrumented.length ? instrumented.reduce((sum, value) => ({
    decisions: sum.decisions + value.decisions, statesVisited: sum.statesVisited + value.statesVisited,
    combinationMasksConsidered: sum.combinationMasksConsidered + value.combinationMasksConsidered,
    cacheHits: sum.cacheHits + value.cacheHits, cacheMisses: sum.cacheMisses + value.cacheMisses,
  }), { decisions: 0, statesVisited: 0, combinationMasksConsidered: 0, cacheHits: 0, cacheMisses: 0 }) : undefined;
  return { roundsCompleted: measurements.reduce((sum, value) => sum + value.roundsCompleted, 0),
    attemptedActions: measurements.reduce((sum, value) => sum + value.attemptedActions, 0), acceptedActions, passes,
    passFrequency: acceptedActions ? passes / acceptedActions : 0, durationMs,
    sessionDuration: mergeDurations(measurements.map((value) => ({ count: 1, totalMs: value.durationMs,
      minMs: value.durationMs, maxMs: value.durationMs, meanMs: value.durationMs }))),
    decisionDuration: mergeDurations(measurements.map((value) => value.decisionDuration)),
    ...(decomposition ? { decomposition } : {}), failureTypes, invariantCodes, guardCodes, failures };
}

/** Compact developer report; richer diagnostics remain attached to the batch's failed runs. */
export function formatSimulationBatchReport(batch: SimulationBatchResult): string {
  const metrics = batch.metrics;
  const duration = (value: DurationSummary): string => value.count
    ? `${value.count} samples, mean ${value.meanMs!.toFixed(2)}ms, min ${value.minMs!.toFixed(2)}ms, max ${value.maxMs!.toFixed(2)}ms`
    : 'no samples';
  const lines = [
    `Batch ${JSON.stringify(batch.config.batchId)}: ${batch.status}; Sessions requested ${batch.config.seeds.length}, attempted ${batch.attempted}, completed ${batch.completed}, failed ${batch.failed}, remaining ${batch.remaining}.`,
    `Rounds completed ${metrics.roundsCompleted}; actions attempted ${metrics.attemptedActions}, accepted ${metrics.acceptedActions}; Passes ${metrics.passes} (${(metrics.passFrequency * 100).toFixed(2)}% of accepted actions).`,
    `Duration ${metrics.durationMs.toFixed(2)}ms; Sessions: ${duration(metrics.sessionDuration)}; resolved AI requests: ${duration(metrics.decisionDuration)}.`,
    `Failure types ${JSON.stringify(metrics.failureTypes)}; invariant codes ${JSON.stringify(metrics.invariantCodes)}; guard codes ${JSON.stringify(metrics.guardCodes)}.`,
    metrics.decomposition ? `Decomposition ${JSON.stringify(metrics.decomposition)}.` : 'Decomposition instrumentation disabled.',
  ];
  for (const failure of metrics.failures) {
    lines.push(`Failure ${failure.batchIndex}: seed ${failure.engineSeed}, run ${JSON.stringify(failure.runId)}, ${failure.failureType}; artifact runs[${failure.batchIndex}].outcome.failure.`);
  }
  return lines.join('\n');
}

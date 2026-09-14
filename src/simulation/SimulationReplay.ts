import type { SimulationFailure, SimulationTraceEntry } from './SimulationFailure';
import { runRecordedSimulation } from './SimulationRunner';
import type { RecordedSimulationResult } from './SimulationRunner';

export interface SimulationReplayMismatch {
  readonly path: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

export type SimulationReplayResult = {
  readonly replay: RecordedSimulationResult;
  /** Compact successful records only support final-result comparison. */
  readonly comparedTrace: boolean;
} & (
  | { readonly status: 'matched' }
  | { readonly status: 'mismatch'; readonly mismatch: SimulationReplayMismatch }
);

/** Reinitializes from recorded configuration; diagnostic snapshots are never execution inputs.
 * A matched failed run is still failed: inspect replay.status and its failure artifact.
 */
export async function replaySimulation(recorded: RecordedSimulationResult, options: { readonly decisionTrace?: boolean } = {}): Promise<SimulationReplayResult> {
  const expected = JSON.parse(JSON.stringify(recorded)) as RecordedSimulationResult;
  const config = expected.status === 'completed' ? expected.config : expected.failure.config;
  const comparedTrace = expected.status === 'failed' || expected.trace !== undefined;
  const replay = await runRecordedSimulation(config, { ...options, trace: true,
    ...(expected.status === 'failed' && expected.failure.batchIndex !== undefined ? { batchIndex: expected.failure.batchIndex } : {}) });
  const mismatch = firstDifference(comparable(expected, comparedTrace), comparable(replay, comparedTrace), '$');
  return mismatch ? { status: 'mismatch', mismatch, replay, comparedTrace } : { status: 'matched', replay, comparedTrace };
}

function comparable(recorded: RecordedSimulationResult, includeTrace: boolean): unknown {
  if (recorded.status === 'completed') {
    return { status: recorded.status, ...(includeTrace ? { trace: comparableTrace(recorded.trace ?? []) } : {}), result: recorded.result };
  }
  const { config, batchIndex, trace, decisionTrace, exception, message, ...failure } = recorded.failure;
  return { status: recorded.status, ...(includeTrace ? { trace: comparableTrace(trace) } : {}), failure: { ...failure,
    message: stableFailureMessage(message, recorded.failure),
    ...(exception ? { exception: { name: exception.name, message: stableFailureMessage(exception.message, recorded.failure),
      ...(exception.cause ? { cause: exceptionCause(exception.cause) } : {}) } } : {}) } };
}

function comparableTrace(trace: readonly SimulationTraceEntry[]): unknown {
  // Decision instrumentation and its extra indices are not authoritative transitions.
  return trace.filter((entry) => entry.kind !== 'decision').map(({ index, ...entry }) => entry);
}

function stableFailureMessage(message: string, failure: SimulationFailure): string {
  // Only normalize known Orchestrator envelopes; retain arbitrary underlying defect messages.
  const match = /^(Controller failed|Controller mapping changed|Stale or consumed controller response|Malformed controller response|Controller response player mismatch) for request turn-request-\d+, player (.*)\.$/.exec(message);
  return match && match[2] === failure.currentPlayer ? `${match[1]} for request action-${failure.actionIndex}, player ${match[2]}.` : message;
}

function exceptionCause(exception: NonNullable<SimulationFailure['exception']>): unknown {
  return { name: exception.name, message: exception.message, ...(exception.cause ? { cause: exceptionCause(exception.cause) } : {}) };
}

function firstDifference(expected: unknown, actual: unknown, path: string): SimulationReplayMismatch | undefined {
  if (expected === actual) return undefined;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    for (let index = 0; index < Math.max(expected.length, actual.length); index++) {
      const difference = firstDifference(expected[index], actual[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return undefined;
  }
  if (expected !== null && actual !== null && typeof expected === 'object' && typeof actual === 'object'
    && !Array.isArray(expected) && !Array.isArray(actual)) {
    const left = expected as Record<string, unknown>;
    const right = actual as Record<string, unknown>;
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      const difference = firstDifference(left[key], right[key], `${path}.${key}`);
      if (difference) return difference;
    }
    return undefined;
  }
  return { path, expected, actual };
}

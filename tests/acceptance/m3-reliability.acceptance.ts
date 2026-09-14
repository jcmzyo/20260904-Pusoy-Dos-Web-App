import { describe, expect, it } from 'vitest';
import { assertEngineInvariants, defaultRuleset } from '../../src/engine';
import { runSimulationBatch } from '../../src/simulation/SimulationBatch';
import type { SimulationBatchConfig, SimulationBatchResult } from '../../src/simulation/SimulationBatch';
import { formatSimulationBatchReport } from '../../src/simulation/SimulationReport';
import { replaySimulation } from '../../src/simulation/SimulationReplay';
import { runRecordedSimulation } from '../../src/simulation/SimulationRunner';

const { log } = (globalThis as typeof globalThis & { console: { log(message: string): void } }).console;

/** M3-T10 acceptance corpus: adjacent low seeds, the existing smoke seed, unsigned
 * boundaries, bit patterns and spread-out values exercise varied production deals.
 * Run separately with npm run test:acceptance:m3; these are acceptance inputs,
 * not historical bug fixtures or a guarantee of exhaustive rule coverage.
 */
const config: SimulationBatchConfig = {
  batchId: 'm3-t10-acceptance-v1',
  seeds: [0, 1, 2, 3, 4, 5, 6, 7, 42, 1713, 20260914, 65535, 65536, 2147483647, 2147483648, 4294967295,
    123456789, 987654321, 305419896, 2271560481, 1431655765, 2863311530, 252645135, 4042322160,
    2654435761, 1013904226, 3668339987, 2027808452, 387276917, 3041712678, 1401181143, 4055616904],
  session: {
    mode: 'basic', rulesetId: 'default',
    seats: [{ playerId: 'south', controller: 'baseline' }, { playerId: 'west', controller: 'baseline' }, { playerId: 'north', controller: 'baseline' }, { playerId: 'east', controller: 'baseline' }],
  },
};

function verifyBatch(batch: SimulationBatchResult): void {
  log(formatSimulationBatchReport(batch));
  for (const { outcome } of batch.runs) {
    if (outcome.status === 'failed') throw new Error(JSON.stringify(outcome.failure));
  }
  expect(batch).toMatchObject({ status: 'completed', attempted: config.seeds.length,
    completed: config.seeds.length, failed: 0, remaining: 0, config: { failFast: true } });
  expect(batch.runs.map(({ batchIndex }) => batchIndex)).toEqual(config.seeds.map((_, index) => index));
  expect(batch.runs.map(({ outcome }) => outcome.status === 'completed' ? outcome.config.engineSeed : undefined)).toEqual(config.seeds);
  expect(batch.metrics.roundsCompleted).toBe(config.seeds.length * 5);
  expect(batch.metrics.failureTypes).toEqual({ invariant: 0, controller: 0, rejectedMove: 0, exception: 0 });
  expect(batch.metrics.invariantCodes).toEqual({});
  expect(batch.metrics.guardCodes).toEqual({});
  expect(batch.metrics.failures).toEqual([]);
  expect(batch.metrics.attemptedActions).toBe(batch.metrics.acceptedActions);
  expect(batch.metrics.decisionDuration.count).toBe(batch.metrics.acceptedActions);
  for (const { outcome } of batch.runs) {
    if (outcome.status !== 'completed') throw new Error('Expected completed Session');
    expect(outcome.trace).toBeUndefined();
    expect(outcome.result.accepted).toBe(true);
    expect(outcome.result.state.kind).toBe('completed');
    expect(outcome.result.state.completedRounds).toHaveLength(5);
    assertEngineInvariants(outcome.result.state, defaultRuleset);
    expect(outcome.metrics!.rounds.map((round) => round.roundNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(outcome.metrics!.rounds.every((round) => round.completed && round.acceptedActions > 0
      && round.attemptedActions === round.acceptedActions)).toBe(true);
  }
}

describe('M3 reliability acceptance', () => {
  it('completes every recorded seed and repeats outcomes and semantic metrics with instrumentation toggled', async () => {
    log(JSON.stringify(config));
    const first = await runSimulationBatch({ ...config, decompositionMetrics: true });
    verifyBatch(first);
    const repeated = await runSimulationBatch(config);
    verifyBatch(repeated);
    expect(first.metrics.decomposition!.decisions).toBe(first.metrics.acceptedActions);
    expect(first.metrics.decomposition!.cacheHits).toBeGreaterThan(0);
    expect(repeated.metrics.decomposition).toBeUndefined();
    expect(repeated.runs.map(({ outcome: { metrics, ...outcome } }) => outcome))
      .toEqual(first.runs.map(({ outcome: { metrics, ...outcome } }) => outcome));
    expect(repeated.runs.map(({ outcome }) => outcome.metrics!.rounds))
      .toEqual(first.runs.map(({ outcome }) => outcome.metrics!.rounds));
    const { durationMs, sessionDuration, decisionDuration, decomposition, ...semantic } = first.metrics;
    const { durationMs: repeatedDuration, sessionDuration: repeatedSessions, decisionDuration: repeatedDecisions, ...repeatedSemantic } = repeated.metrics;
    expect(repeatedSemantic).toEqual(semantic);
  });

  it.each([0, 1713, 0xffffffff])('replays complete authoritative trace for seed %i with AI tracing toggled', async (engineSeed) => {
    const recorded = await runRecordedSimulation({ ...config.session, runId: `m3-t10-replay:${engineSeed}`, engineSeed }, { trace: true, metrics: true });
    if (recorded.status === 'failed') throw new Error(JSON.stringify(recorded.failure));
    expect(recorded.result.state.kind).toBe('completed');
    const events = recorded.trace!.flatMap((entry) => entry.events ?? []);
    expect(events.filter((event) => event.type === 'ROUND_ENDED')).toHaveLength(5);
    expect(events.at(-1)?.type).toBe('SESSION_ENDED');
    const replayed = await replaySimulation(JSON.parse(JSON.stringify(recorded)), { decisionTrace: true });
    expect(replayed.status, JSON.stringify(replayed.status === 'mismatch' ? replayed.mismatch : undefined)).toBe('matched');
    expect(replayed.comparedTrace).toBe(true);
    expect(replayed.replay.status).toBe('completed');
  });
});

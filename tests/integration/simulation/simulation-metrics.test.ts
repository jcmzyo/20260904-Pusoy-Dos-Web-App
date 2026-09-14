import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaselineController } from '../../../src/ai';
import * as engine from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import { runSimulationBatch } from '../../../src/simulation/SimulationBatch';
import type { SimulationBatchConfig } from '../../../src/simulation/SimulationBatch';
import { SimulationGuardError } from '../../../src/simulation/SimulationGuards';
import { aggregateSimulationMetrics, formatSimulationBatchReport } from '../../../src/simulation/SimulationReport';
import { runRecordedSimulation } from '../../../src/simulation/SimulationRunner';

const config: SimulationBatchConfig = {
  batchId: 'metrics', seeds: [1713, 0],
  session: { mode: 'basic', rulesetId: 'default',
    seats: [{ playerId: 'south', controller: 'baseline' }, { playerId: 'west', controller: 'baseline' }, { playerId: 'north', controller: 'baseline' }, { playerId: 'east', controller: 'baseline' }],
  },
};

afterEach(() => vi.restoreAllMocks());

describe('compact reliability metrics', () => {
  it('matches factual events and attempted requests per Round, without changing the authoritative trace or replay', async () => {
    const input = { ...config.session, runId: 'metrics-single', engineSeed: 1713 };
    const plain = await runRecordedSimulation(input, { trace: true });
    const measured = await runRecordedSimulation(input, { trace: true, decompositionMetrics: true });
    if (plain.status !== 'completed' || measured.status !== 'completed') throw new Error('Expected successful fixtures');
    expect(measured.result).toEqual(plain.result);
    expect(measured.trace).toEqual(plain.trace);
    expect(plain.metrics).toBeUndefined();
    const metrics = measured.metrics!;
    const events = measured.trace!.flatMap((entry) => entry.events ?? []);
    const actions = events.filter((event) => event.type === 'CARDS_PLAYED' || event.type === 'PLAYER_PASSED');
    const passes = events.filter((event) => event.type === 'PLAYER_PASSED');
    expect(metrics.roundsCompleted).toBe(5);
    expect(metrics.acceptedActions).toBe(actions.length);
    expect(metrics.attemptedActions).toBe(measured.trace!.filter((entry) => entry.kind === 'request').length);
    expect(metrics.passes).toBe(passes.length);
    expect(metrics.passFrequency).toBe(passes.length / actions.length);
    expect(metrics.rounds).toHaveLength(5);
    for (const round of metrics.rounds) {
      expect(round).toEqual({ roundNumber: round.roundNumber, completed: true,
        attemptedActions: measured.trace!.filter((entry) => entry.kind === 'request' && entry.roundNumber === round.roundNumber).length,
        acceptedActions: actions.filter((event) => 'roundNumber' in event && event.roundNumber === round.roundNumber).length,
        passes: passes.filter((event) => event.roundNumber === round.roundNumber).length });
    }
    expect(metrics.decisionDuration.count).toBe(actions.length);
    expect(metrics.decisionDuration.totalMs).toBeGreaterThanOrEqual(0);
    expect(metrics.durationMs).toBeGreaterThanOrEqual(metrics.decisionDuration.totalMs);
    expect(metrics.decomposition?.decisions).toBe(actions.length);
    expect(metrics.decomposition!.cacheHits).toBeGreaterThan(0);
    expect(metrics.decomposition!.statesVisited).toBe(metrics.decomposition!.cacheHits + metrics.decomposition!.cacheMisses);
    const { replaySimulation } = await import('../../../src/simulation/SimulationReplay');
    expect((await replaySimulation(measured)).status).toBe('matched');
  });

  it('repeats semantic batch metrics, combines totals, and emits only a compact success summary', async () => {
    const first = await runSimulationBatch({ ...config, decompositionMetrics: true });
    const second = await runSimulationBatch({ ...config, decompositionMetrics: true });
    const { durationMs, sessionDuration, decisionDuration, ...semantic } = first.metrics;
    const { durationMs: repeatedDuration, sessionDuration: repeatedSessions, decisionDuration: repeatedDecisions, ...repeated } = second.metrics;
    expect(repeated).toEqual(semantic);
    expect(first.metrics.roundsCompleted).toBe(10);
    expect(first.metrics.acceptedActions).toBe(first.runs.reduce((sum, run) => sum + run.outcome.metrics!.acceptedActions, 0));
    expect(first.metrics.passes).toBe(first.runs.reduce((sum, run) => sum + run.outcome.metrics!.passes, 0));
    expect(first.metrics.passFrequency).toBe(first.metrics.passes / first.metrics.acceptedActions);
    expect(first.metrics.decomposition!.statesVisited).toBe(first.runs.reduce((sum, run) => sum + run.outcome.metrics!.decomposition!.statesVisited, 0));
    expect(sessionDuration.count).toBe(2);
    expect(decisionDuration.count).toBe(first.metrics.acceptedActions);
    expect(repeatedSessions.count).toBe(sessionDuration.count);
    expect(repeatedDecisions.count).toBe(decisionDuration.count);
    expect(durationMs).toBeGreaterThanOrEqual(sessionDuration.totalMs);
    expect(repeatedDuration).toBeGreaterThanOrEqual(repeatedSessions.totalMs);
    const report = formatSimulationBatchReport(first);
    expect(report.split('\n')).toHaveLength(5);
    expect(report).toContain('attempted 2, completed 2, failed 0, remaining 0');
    expect(report).toContain('Rounds completed 10');
    expect(report).not.toMatch(/playerView|developerSnapshots|evaluations/);
    expect(first.runs.every(({ outcome }) => outcome.status === 'completed' && outcome.trace === undefined)).toBe(true);
  });

  it('includes partial Rounds and the failed attempted Turn, and distinguishes nested guards from other failures', async () => {
    const choose = BaselineController.prototype.chooseMove;
    vi.spyOn(BaselineController.prototype, 'chooseMove').mockImplementation(function (this: BaselineController, request) {
      if (request.view.roundNumber === 2) throw new SimulationGuardError('CONTROLLER_TIMEOUT', 'controlled timeout');
      return choose.call(this, request);
    });
    const batch = await runSimulationBatch(config);
    expect(batch).toMatchObject({ attempted: 1, completed: 0, failed: 1, remaining: 1 });
    const metrics = batch.runs[0]!.outcome.metrics!;
    expect(metrics.roundsCompleted).toBe(1);
    expect(metrics.rounds[1]).toEqual({ roundNumber: 2, completed: false, attemptedActions: 1, acceptedActions: 0, passes: 0 });
    expect(metrics.attemptedActions).toBe(metrics.acceptedActions + 1);
    expect(metrics.decisionDuration.count).toBe(metrics.acceptedActions);
    expect(batch.metrics.guardCodes).toEqual({ CONTROLLER_TIMEOUT: 1 });
    expect(batch.metrics.failureTypes).toEqual({ controller: 1, invariant: 0, rejectedMove: 0, exception: 0 });
    expect(metrics.decomposition).toBeUndefined();
    expect(formatSimulationBatchReport(batch)).toContain('artifact runs[0].outcome.failure');
    expect(formatSimulationBatchReport(batch)).toContain('Decomposition instrumentation disabled');
  });

  it('counts invariant failures and duplicate failing seeds without inventing accepted actions or timing samples', async () => {
    vi.spyOn(engine, 'createSession').mockImplementation(() => { throw new engine.EngineInvariantError('TURN_OWNER', 0, 'controlled corruption'); });
    const batch = await runSimulationBatch({ ...config, seeds: [0, 0], failFast: false });
    expect(batch).toMatchObject({ attempted: 2, completed: 0, failed: 2, remaining: 0 });
    expect(batch.metrics).toMatchObject({ roundsCompleted: 0, attemptedActions: 0, acceptedActions: 0, passes: 0, passFrequency: 0,
      invariantCodes: { TURN_OWNER: 2 }, guardCodes: {}, failureTypes: { invariant: 2 },
      decisionDuration: { count: 0, totalMs: 0, minMs: null, maxMs: null, meanMs: null } });
    expect(batch.metrics.failures).toEqual([0, 1].map((batchIndex) => ({ batchIndex, runId: `metrics:${batchIndex}`, engineSeed: 0, failureType: 'invariant' })));
    expect(formatSimulationBatchReport(batch)).toContain('no samples');
    expect(formatSimulationBatchReport(batch)).toContain('runs[1].outcome.failure');
    expect(JSON.parse(JSON.stringify(batch.metrics))).toEqual(batch.metrics);
  });

  it('counts rejected AI Moves separately from exceptions and refuses missing measurements', async () => {
    vi.spyOn(BaselineController.prototype, 'chooseMove').mockImplementation(async (request) => ({ kind: 'pass', playerId: request.playerId }));
    const rejected = await runSimulationBatch({ ...config, seeds: [0] });
    expect(rejected.metrics).toMatchObject({ attemptedActions: 1, acceptedActions: 0, passes: 0, failureTypes: { rejectedMove: 1 } });
    expect(rejected.metrics.decisionDuration.count).toBe(1);
    vi.spyOn(GameRunner.prototype, 'runRound').mockRejectedValue(new Error('controlled exception'));
    const failed = await runSimulationBatch({ ...config, seeds: [0] });
    expect(failed.metrics.failureTypes.exception).toBe(1);
    expect(() => aggregateSimulationMetrics(failed.runs.map(({ batchIndex, outcome: { metrics, ...outcome } }) => ({ batchIndex, outcome })), 0)).toThrow('every attempted Session');
  });
});

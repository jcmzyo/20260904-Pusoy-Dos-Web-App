import { afterEach, describe, expect, it, vi } from 'vitest';
import * as engine from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import { runSimulationBatch } from '../../../src/simulation/SimulationBatch';
import type { SimulationBatchConfig } from '../../../src/simulation/SimulationBatch';
import * as simulation from '../../../src/simulation/SimulationRunner';

const config: SimulationBatchConfig = {
  batchId: 'smoke', seeds: [1713, 0],
  session: {
    mode: 'basic', rulesetId: 'default', softwareVersion: 'fixture',
    seats: [{ playerId: 'south', controller: 'baseline' }, { playerId: 'west', controller: 'baseline' }, { playerId: 'north', controller: 'baseline' }, { playerId: 'east', controller: 'baseline' }],
  },
};

afterEach(() => vi.restoreAllMocks());

describe('configurable seeded batch', () => {
  it('runs independent production Sessions in order and reproduces the complete outcomes', async () => {
    const run = vi.spyOn(simulation, 'runRecordedSimulation');
    const create = vi.spyOn(engine, 'createSession');
    const before = JSON.stringify(config);
    const first = await runSimulationBatch(config);
    expect(first).toMatchObject({ status: 'completed', attempted: 2, completed: 2, failed: 0, remaining: 0, config: { failFast: true } });
    expect(run.mock.calls).toEqual(config.seeds.map((engineSeed, batchIndex) => [
      { ...config.session, engineSeed, runId: `smoke:${batchIndex}` }, { batchIndex, metrics: true },
    ]));
    expect(create).toHaveBeenCalledTimes(2);
    expect(first.runs.map((entry) => entry.batchIndex)).toEqual([0, 1]);
    for (const { outcome } of first.runs) {
      if (outcome.status !== 'completed') throw new Error('Expected completed Session');
      expect(outcome.result.state.kind).toBe('completed');
      expect(outcome.result.state.completedRounds).toHaveLength(5);
      expect(outcome.trace).toBeUndefined();
    }
    const repeated = await runSimulationBatch(JSON.parse(before));
    const { metrics: firstMetrics, runs: firstRuns, ...firstSummary } = first;
    const { metrics: repeatedMetrics, runs: repeatedRuns, ...repeatedSummary } = repeated;
    expect(repeatedSummary).toEqual(firstSummary);
    expect(repeated.runs.map(({ outcome: { metrics, ...outcome } }) => outcome)).toEqual(first.runs.map(({ outcome: { metrics, ...outcome } }) => outcome));
    expect(JSON.stringify(config)).toBe(before);
  });

  it.each([undefined, false])('retains invariant failure and applies failFast=%s only between independent Sessions', async (failFast) => {
    const start = engine.startRound;
    let sessions = 0;
    vi.spyOn(engine, 'startRound').mockImplementation((...args) => {
      if (args[0].roundNumber === 0) sessions++;
      const result = start(...args);
      if (sessions !== 2 || result.state.round?.kind !== 'inProgress') return result;
      return { ...result, state: { ...result.state, round: { ...result.state.round, context: {
        ...result.state.round.context, currentPlayerId: 'unknown',
      } } } };
    });
    const run = vi.spyOn(simulation, 'runRecordedSimulation');
    const input = { ...config, seeds: [1713, 0, 1713], ...(failFast === undefined ? {} : { failFast }) };
    const result = await runSimulationBatch(input);
    const continuing = failFast === false;
    expect(result).toMatchObject({ status: 'failed', attempted: continuing ? 3 : 2,
      completed: continuing ? 2 : 1, failed: 1, remaining: continuing ? 0 : 1 });
    expect(result.metrics.roundsCompleted).toBe(continuing ? 10 : 5);
    expect(result.metrics.invariantCodes).toEqual({ TURN_OWNER: 1 });
    expect(result.metrics.failures).toEqual([{ batchIndex: 1, runId: 'smoke:1', engineSeed: 0, failureType: 'invariant' }]);
    expect(run).toHaveBeenCalledTimes(result.attempted);
    expect(result.runs[1]).toMatchObject({ batchIndex: 1, outcome: { status: 'failed', failure: {
      failureType: 'invariant', invariantCode: 'TURN_OWNER', batchIndex: 1,
      config: { ...config.session, runId: 'smoke:1', engineSeed: 0 }, roundNumber: 1, actionIndex: 0,
    } } });
    if (continuing) {
      expect(result.runs[2]?.outcome.status).toBe('completed');
      const first = result.runs[0]!.outcome;
      const last = result.runs[2]!.outcome;
      if (first.status !== 'completed' || last.status !== 'completed') throw new Error('Expected independent successes');
      expect(last.result).toEqual(first.result);
    }
  });

  it('reports every failing seed, preserves duplicates and snapshots input across awaits', async () => {
    const seeds = [0, 0xffffffff, 0];
    const seats = config.session.seats.map((seat) => ({ ...seat })) as unknown as SimulationBatchConfig['session']['seats'];
    vi.spyOn(GameRunner.prototype, 'runRound').mockImplementation(async () => {
      seeds.splice(0, seeds.length, 999);
      Object.assign(seats[0], { playerId: 'changed' });
      throw new Error('synthetic failure');
    });
    const result = await runSimulationBatch({ ...config, seeds, session: { ...config.session, seats }, failFast: false });
    expect(result).toMatchObject({ status: 'failed', attempted: 3, completed: 0, failed: 3, remaining: 0 });
    expect(result.config.seeds).toEqual([0, 0xffffffff, 0]);
    for (const [batchIndex, entry] of result.runs.entries()) {
      expect(entry).toMatchObject({ batchIndex, outcome: { status: 'failed', failure: {
        batchIndex, message: 'synthetic failure', config: { ...config.session,
          engineSeed: [0, 0xffffffff, 0][batchIndex], runId: `smoke:${batchIndex}` },
      } } });
    }
  });

  it('supports larger explicit lists separately from production smoke execution', async () => {
    vi.spyOn(engine, 'createSession').mockImplementation(() => { throw new Error('controlled setup failure'); });
    const seeds = Array.from({ length: 100 }, (_, index) => index);
    const result = await runSimulationBatch({ ...config, batchId: 'reliability', seeds, failFast: false });
    expect(result).toMatchObject({ attempted: 100, failed: 100, completed: 0, remaining: 0 });
    expect(result.runs.map(({ outcome }) => outcome.status === 'failed' ? outcome.failure.config.engineSeed : undefined)).toEqual(seeds);
  });

  it.each([[], [1713, -1], [0x100000000], [1.5], [NaN], [Infinity], new Array<number>(1)].map((seeds) => ({ seeds })))('rejects invalid seed lists before any Session starts: %j', async ({ seeds }) => {
    const run = vi.spyOn(simulation, 'runRecordedSimulation');
    await expect(runSimulationBatch({ ...config, seeds })).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });

  it.each([{ batchId: '' }, { batchId: '  ' }, { failFast: 'false' }, { decompositionMetrics: 'false' }])('rejects ambiguous batch settings: %j', async (override) => {
    const run = vi.spyOn(simulation, 'runRecordedSimulation');
    await expect(runSimulationBatch({ ...config, ...override } as SimulationBatchConfig)).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });
});

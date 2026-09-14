import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaselineController } from '../../../src/ai';
import type { Move } from '../../../src/domain';
import * as engine from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { SimulationConfig } from '../../../src/simulation/SimulationConfig';
import { SimulationGuards, simulationGuardLimits } from '../../../src/simulation/SimulationGuards';
import { runRecordedSimulation } from '../../../src/simulation/SimulationRunner';

const config: SimulationConfig = {
  runId: 'progress-guards', engineSeed: 1713, mode: 'basic', rulesetId: 'default',
  seats: [{ playerId: 'south', controller: 'baseline' }, { playerId: 'west', controller: 'baseline' }, { playerId: 'north', controller: 'baseline' }, { playerId: 'east', controller: 'baseline' }],
};

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('simulation progress guards', () => {
  it('bounds attempted actions even when successive snapshots differ and records the failure', async () => {
    const guards = new SimulationGuards();
    const state = engine.createSession(config.seats.map((seat) => seat.playerId)).state;
    // Synthetic lifecycle values isolate the counter from repeated-state detection.
    for (let index = 0; index < simulationGuardLimits.actions; index++) {
      guards.observe({ kind: 'turnStart', state: { ...state, roundNumber: index } });
    }
    vi.spyOn(GameRunner.prototype, 'runRound').mockImplementation(async () => {
      guards.observe({ kind: 'turnStart', state });
      throw new Error('Guard did not stop execution');
    });
    const result = await runRecordedSimulation(config, { batchIndex: 3 });
    expect(result).toMatchObject({ status: 'failed', failure: { config, batchIndex: 3,
      exception: { name: 'SimulationGuardError' }, message: `ACTION_LIMIT: Exceeded ${simulationGuardLimits.actions} attempted Session actions.` } });
  });

  it('stops repeated authoritative state at the exact visit limit with reproducible evidence', async () => {
    // Isolate loop detection from the earlier authoritative transition invariant.
    vi.spyOn(engine, 'assertMoveInvariants').mockImplementation(() => {});
    const submit = vi.spyOn(engine, 'submitMove').mockImplementation((state) => ({ accepted: true, state, events: [] }));
    const first = await runRecordedSimulation(config);
    expect(submit).toHaveBeenCalledTimes(simulationGuardLimits.stateVisits);
    expect(first).toMatchObject({ status: 'failed', failure: { config, roundNumber: 1,
      actionIndex: simulationGuardLimits.stateVisits + 1, exception: { name: 'SimulationGuardError' } } });
    if (first.status !== 'failed') throw new Error('Expected failure');
    expect(first.failure.message).toContain('REPEATED_STATE');
    expect(first.failure.developerSnapshots.before?.result).toBeNull();
    expect(first.failure.developerSnapshots.before?.completedRounds).toEqual([]);
    const repeated = await runRecordedSimulation(config);
    if (repeated.status !== 'failed') throw new Error('Expected failure');
    expect(repeated.failure.trace).toEqual(first.failure.trace);
    expect(repeated.failure.message).toEqual(first.failure.message);
  });

  it.each(['resolve', 'reject'] as const)('times out a pending controller and ignores a late %s', async (settlement) => {
    vi.useFakeTimers();
    let resolve!: (move: Move) => void;
    let reject!: (error: Error) => void;
    let move!: Move;
    vi.spyOn(BaselineController.prototype, 'chooseMove').mockImplementation((request) => {
      move = request.legalMoves[0]!;
      return new Promise<Move>((accept, fail) => { resolve = accept; reject = fail; });
    });
    const submit = vi.spyOn(engine, 'submitMove');
    const pending = runRecordedSimulation(config);
    await vi.advanceTimersByTimeAsync(simulationGuardLimits.controllerTimeoutMs - 1);
    expect(submit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;
    expect(result).toMatchObject({ status: 'failed', failure: { config, roundNumber: 1, actionIndex: 1,
      exception: { cause: { name: 'SimulationGuardError', message: expect.stringContaining('CONTROLLER_TIMEOUT') } } } });
    const captured = JSON.stringify(result);
    if (settlement === 'resolve') resolve(move);
    else reject(new Error('late rejection'));
    await vi.advanceTimersByTimeAsync(0);
    expect(submit).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toBe(captured);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fails when continuation returns the completed Round without advancing', async () => {
    const rounds = vi.spyOn(GameRunner.prototype, 'runRound');
    vi.spyOn(GameRunner.prototype, 'continueToNextRound').mockImplementation(function (this: GameRunner) {
      const last = rounds.mock.settledResults.at(-1);
      if (last?.type !== 'fulfilled') throw new Error('Expected completed Round');
      return last.value;
    });
    const result = await runRecordedSimulation(config);
    expect(result).toMatchObject({ status: 'failed', failure: { config, roundNumber: 1,
      exception: { name: 'SimulationGuardError' }, message: expect.stringContaining('LIFECYCLE') } });
    expect(rounds).toHaveBeenCalledTimes(1);
  });

  it('detects an invalid current player before requesting a controller', async () => {
    const start = engine.startRound;
    vi.spyOn(engine, 'startRound').mockImplementation((...args) => {
      const result = start(...args);
      if (result.state.round?.kind !== 'inProgress') throw new Error('Expected active Round');
      return { ...result, state: { ...result.state, round: { ...result.state.round,
        context: { ...result.state.round.context, currentPlayerId: '' } } } };
    });
    const choose = vi.spyOn(BaselineController.prototype, 'chooseMove');
    expect(await runRecordedSimulation(config)).toMatchObject({ status: 'failed', failure: { config,
      failureType: 'invariant', invariantCode: 'TURN_OWNER', actionIndex: 0 } });
    expect(choose).not.toHaveBeenCalled();
  });

  it.each([0, 1713, 0xffffffff])('does not false-trigger or leave timers for valid seed %i', async (engineSeed) => {
    vi.useFakeTimers();
    const result = await runRecordedSimulation({ ...config, engineSeed });
    expect(result.status).toBe('completed');
    if (result.status !== 'completed') throw new Error(result.failure.message);
    expect(result.result.state.completedRounds).toHaveLength(5);
    expect(result.result.state.result).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

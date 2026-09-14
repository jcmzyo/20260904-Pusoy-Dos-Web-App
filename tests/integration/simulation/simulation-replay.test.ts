import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BaselineController } from '../../../src/ai';
import * as engine from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { SimulationConfig } from '../../../src/simulation/SimulationConfig';
import { replaySimulation } from '../../../src/simulation/SimulationReplay';
import { runRecordedSimulation } from '../../../src/simulation/SimulationRunner';
import type { RecordedSimulationResult } from '../../../src/simulation/SimulationRunner';

const config: SimulationConfig = {
  runId: 'replay-session', engineSeed: 1713, mode: 'basic', rulesetId: 'default', softwareVersion: 'fixture',
  seats: [{ playerId: 'south', controller: 'baseline' }, { playerId: 'west', controller: 'baseline' }, { playerId: 'north', controller: 'baseline' }, { playerId: 'east', controller: 'baseline' }],
};

let successful: Extract<RecordedSimulationResult, { status: 'completed' }>;
beforeAll(async () => {
  const recorded = await runRecordedSimulation(config, { trace: true });
  if (recorded.status !== 'completed') throw new Error(recorded.failure.message);
  successful = recorded;
});
afterEach(() => vi.restoreAllMocks());

describe('deterministic single-Session replay', () => {
  it.each([false, true])('replays serialized events, Moves and results through production initialization with decisionTrace=%s', async (decisionTrace) => {
    const create = vi.spyOn(engine, 'createSession');
    const start = vi.spyOn(engine, 'startRound');
    const rounds = vi.spyOn(GameRunner.prototype, 'runRound');
    const choose = vi.spyOn(BaselineController.prototype, 'chooseMove');
    const serialized = JSON.stringify(successful);
    const result = await replaySimulation(JSON.parse(serialized), { decisionTrace });
    expect(result.status).toBe('matched');
    expect(result.comparedTrace).toBe(true);
    expect(create).toHaveBeenCalledExactlyOnceWith(config.seats.map((seat) => seat.playerId));
    expect(start).toHaveBeenCalledTimes(5);
    expect(rounds).toHaveBeenCalledTimes(5);
    expect(choose.mock.calls.length).toBeGreaterThan(0);
    expect(JSON.stringify(successful)).toBe(serialized);
    if (result.replay.status !== 'completed') throw new Error('Expected completed replay');
    expect(result.replay.result).toEqual(successful.result);
    const events = result.replay.trace!.flatMap((entry) => entry.events ?? []);
    expect(events).toEqual(successful.trace!.flatMap((entry) => entry.events ?? []));
    expect(events.filter((event) => event.type === 'ROUND_ENDED')).toHaveLength(5);
    expect(events.at(-1)?.type).toBe('SESSION_ENDED');
    expect(result.replay.trace!.some((entry) => entry.kind === 'decision')).toBe(decisionTrace);
  });

  it('supports compact records while explicitly identifying the absence of sequence evidence', async () => {
    const { trace, ...compact } = successful;
    expect(await replaySimulation(compact)).toMatchObject({ status: 'matched', comparedTrace: false });
  });

  it.each(['event', 'truncated trace', 'result', 'seed'] as const)('reports an explicit mismatch for changed %s evidence', async (change) => {
    const recorded = JSON.parse(JSON.stringify(successful));
    if (change === 'event') recorded.trace[0].events[0].mode = 'corrupt';
    if (change === 'truncated trace') recorded.trace.pop();
    if (change === 'result') recorded.result.state.roundNumber = 99;
    if (change === 'seed') recorded.config.engineSeed = 0;
    const result = await replaySimulation(recorded);
    expect(result.status).toBe('mismatch');
    if (result.status !== 'mismatch') throw new Error('Expected mismatch');
    expect(result.mismatch.path).toContain(change === 'result' ? '$.result.state.roundNumber' : '$.trace[');
    expect(result.mismatch.expected).not.toEqual(result.mismatch.actual);
    expect(result.replay.status).toBe('completed');
  });

  it('reproduces a corrupt transition at the same action with decision instrumentation toggled', async () => {
    const submit = engine.submitMove;
    vi.spyOn(engine, 'submitMove').mockImplementation((...args) => {
      const result = submit(...args);
      if (result.state.round?.kind !== 'inProgress') throw new Error('Expected active fixture');
      return { ...result, state: { ...result.state, round: { ...result.state.round, context: {
        ...result.state.round.context, currentPlayerId: 'unknown',
      } } } };
    });
    const recorded = await runRecordedSimulation(config, { batchIndex: 4, decisionTrace: true });
    expect(recorded.status).toBe('failed');
    const result = await replaySimulation(JSON.parse(JSON.stringify(recorded)));
    expect(result).toMatchObject({ status: 'matched', comparedTrace: true, replay: { status: 'failed', failure: {
      failureType: 'invariant', invariantCode: 'TURN_OWNER', roundNumber: 1, actionIndex: 1, batchIndex: 4,
    } } });
  });

  it('normalizes process-wide controller tokens and stack traces but detects a different underlying failure', async () => {
    const choose = vi.spyOn(BaselineController.prototype, 'chooseMove').mockRejectedValue(new Error('original defect'));
    const recorded = await runRecordedSimulation(config);
    const repeated = await replaySimulation(recorded);
    expect(repeated.status).toBe('matched');
    if (recorded.status !== 'failed' || repeated.replay.status !== 'failed') throw new Error('Expected controller failures');
    expect(repeated.replay.failure.message).not.toBe(recorded.failure.message);
    choose.mockRejectedValue(new Error('different defect'));
    expect(await replaySimulation(recorded)).toMatchObject({ status: 'mismatch', mismatch: {
      path: '$.failure.exception.cause.message', expected: 'original defect', actual: 'different defect',
    } });
  });

  it('reproduces an Engine rejection without treating it as a successful Session', async () => {
    vi.spyOn(BaselineController.prototype, 'chooseMove').mockImplementation(async (request) => ({ kind: 'pass', playerId: request.playerId }));
    const recorded = await runRecordedSimulation(config);
    expect(await replaySimulation(recorded)).toMatchObject({ status: 'matched', replay: { status: 'failed', failure: {
      failureType: 'rejectedMove', actionIndex: 1, rejection: { code: 'PASS_NOT_ALLOWED' },
    } } });
  });

  it('detects a failure moving to a later action while the error message stays the same', async () => {
    const submit = engine.submitMove;
    const spy = vi.spyOn(engine, 'submitMove').mockImplementation(() => { throw new Error('same defect'); });
    const recorded = await runRecordedSimulation(config);
    spy.mockImplementationOnce(submit);
    const result = await replaySimulation(recorded);
    expect(result.status).toBe('mismatch');
    expect(result.replay).toMatchObject({ status: 'failed', failure: { message: 'same defect', actionIndex: 2 } });
  });

  it('reports both a fixed failure and a newly failing successful recording as mismatches', async () => {
    const spy = vi.spyOn(engine, 'createSession').mockImplementation(() => { throw new Error('setup defect'); });
    const failed = await runRecordedSimulation(config);
    expect(await replaySimulation(failed)).toMatchObject({ status: 'matched', replay: { status: 'failed', failure: { actionIndex: 0 } } });
    expect(await replaySimulation(successful)).toMatchObject({ status: 'mismatch', mismatch: {
      path: '$.status', expected: 'completed', actual: 'failed',
    } });
    spy.mockRestore();
    expect(await replaySimulation(failed)).toMatchObject({ status: 'mismatch', mismatch: {
      path: '$.status', expected: 'failed', actual: 'completed',
    } });
  });

  it('replays a progress guard failure through the same guarded production path', async () => {
    // Synthetic no-progress transactions isolate the guard from Engine transition checks.
    vi.spyOn(engine, 'assertMoveInvariants').mockImplementation(() => {});
    vi.spyOn(engine, 'submitMove').mockImplementation((state) => ({ accepted: true, state, events: [] }));
    const recorded = await runRecordedSimulation(config);
    const result = await replaySimulation(recorded);
    expect(result).toMatchObject({ status: 'matched', replay: { status: 'failed', failure: {
      exception: { name: 'SimulationGuardError' }, message: expect.stringContaining('REPEATED_STATE'),
    } } });
  });

  it('compares serialized object values independently of property insertion order', async () => {
    vi.spyOn(engine, 'createSession').mockImplementation(() => { throw new Error('setup defect'); });
    const recorded = await runRecordedSimulation(config);
    const reordered = JSON.parse(JSON.stringify(recorded, (_key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.fromEntries(Object.entries(value).reverse());
      }
      return value;
    }));
    expect(await replaySimulation(reordered)).toMatchObject({ status: 'matched', comparedTrace: true });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaselineController } from '../../../src/ai';
import * as engine from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { SimulationConfig } from '../../../src/simulation/SimulationConfig';
import { runRecordedSimulation, runSimulation } from '../../../src/simulation/SimulationRunner';

const config: SimulationConfig = {
  runId: 'failure-capture', engineSeed: 1713, mode: 'basic', rulesetId: 'default', softwareVersion: 'fixture',
  seats: [{ playerId: 'south', controller: 'baseline' }, { playerId: 'west', controller: 'baseline' }, { playerId: 'north', controller: 'baseline' }, { playerId: 'east', controller: 'baseline' }],
};
afterEach(() => vi.restoreAllMocks());

describe('recorded simulation diagnostics', () => {
  it('captures the first corrupt transition, AI evaluation, safe request and detached before/after evidence', async () => {
    const submit = engine.submitMove;
    const spy = vi.spyOn(engine, 'submitMove').mockImplementation((...args) => {
      const result = submit(...args);
      if (result.state.round?.kind !== 'inProgress') throw new Error('Expected active fixture');
      return { ...result, state: { ...result.state, round: { ...result.state.round, context: {
        ...result.state.round.context, currentPlayerId: 'unknown',
      } } } };
    });
    const recorded = await runRecordedSimulation(config, { batchIndex: 7, decisionTrace: true });
    expect(recorded.status).toBe('failed');
    if (recorded.status !== 'failed') throw new Error('Expected failure');
    const failure = recorded.failure;
    expect(failure).toMatchObject({ failureType: 'invariant', config, batchIndex: 7, roundNumber: 1, actionIndex: 1, invariantCode: 'TURN_OWNER' });
    expect(failure.proposedMove).toEqual(spy.mock.calls[0]![1]);
    expect(failure.legalMoves).toContainEqual(failure.proposedMove);
    expect(failure.playerView?.round?.trick).toEqual({ kind: 'opening' });
    expect(failure.playerView?.round?.players.every((player) => !('hand' in player))).toBe(true);
    expect(failure.decisionTrace?.selectedMove).toEqual(failure.proposedMove);
    expect(failure.decisionTrace?.evaluations[0]?.minPlays).toBeGreaterThan(0);
    expect(failure.developerSnapshots.before).toEqual(spy.mock.calls[0]![0]);
    expect(failure.developerSnapshots.before).not.toBe(spy.mock.calls[0]![0]);
    expect(failure.developerSnapshots.after).toEqual(spy.mock.results[0]!.value.state);
    expect(failure.trace.map((entry) => entry.kind)).toEqual(['transaction', 'transaction', 'request', 'decision', 'proposal', 'transaction']);
    expect(failure.trace.flatMap((entry) => entry.events ?? []).map((event) => event.type)).toContain('CARDS_PLAYED');
    expect(failure.exception?.stack).toContain('EngineInvariantError');
    expect(JSON.parse(JSON.stringify(failure))).toEqual(failure);
    expect(spy).toHaveBeenCalledTimes(1);
    const repeated = await runRecordedSimulation(config, { decisionTrace: true });
    if (repeated.status !== 'failed') throw new Error('Expected failure');
    expect(repeated.failure.trace).toEqual(failure.trace);
  });

  it('captures a controller exception and its cause without a fabricated proposal', async () => {
    vi.spyOn(BaselineController.prototype, 'chooseMove').mockRejectedValue(new Error('synthetic controller failure'));
    const result = await runRecordedSimulation(config);
    if (result.status !== 'failed') throw new Error('Expected failure');
    expect(result.failure).toMatchObject({ failureType: 'controller', actionIndex: 1, roundNumber: 1, config,
      exception: { cause: { message: 'synthetic controller failure' } } });
    expect(result.failure.legalMoves?.length).toBeGreaterThan(0);
    expect(result.failure.proposedMove).toBeUndefined();
    expect(result.failure.decisionTrace).toBeUndefined();
  });

  it('captures Engine exceptions before a transaction exists', async () => {
    vi.spyOn(engine, 'submitMove').mockImplementation(() => { throw new Error('synthetic Engine exception'); });
    const result = await runRecordedSimulation(config);
    if (result.status !== 'failed') throw new Error('Expected failure');
    expect(result.failure).toMatchObject({ failureType: 'exception', actionIndex: 1, roundNumber: 1, message: 'synthetic Engine exception' });
    expect(result.failure.developerSnapshots.before).toBeDefined();
    expect(result.failure.developerSnapshots.after).toBeUndefined();
    expect(result.failure.proposedMove).toBeDefined();
  });

  it('captures rejection codes and stops without retrying', async () => {
    vi.spyOn(BaselineController.prototype, 'chooseMove').mockImplementation(async (request) => ({ kind: 'pass', playerId: request.playerId }));
    const submit = vi.spyOn(engine, 'submitMove');
    const result = await runRecordedSimulation(config);
    if (result.status !== 'failed') throw new Error('Expected failure');
    expect(result.failure).toMatchObject({ failureType: 'rejectedMove', actionIndex: 1, rejection: { code: 'PASS_NOT_ALLOWED' }, message: 'PASS_NOT_ALLOWED' });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it.each([1, 2])('captures a corrupt Round %i deal with no stale decision context', async (roundNumber) => {
    const start = engine.startRound;
    vi.spyOn(engine, 'startRound').mockImplementation((...args) => {
      const result = start(...args);
      if (result.state.roundNumber !== roundNumber || result.state.round?.kind !== 'inProgress') return result;
      return { ...result, state: { ...result.state, round: { ...result.state.round, context: {
        ...result.state.round.context, currentPlayerId: 'unknown',
      } } } };
    });
    const result = await runRecordedSimulation(config);
    if (result.status !== 'failed') throw new Error('Expected failure');
    expect(result.failure).toMatchObject({ failureType: 'invariant', roundNumber, currentPlayer: 'unknown' });
    expect(result.failure.actionIndex).toBe(roundNumber === 1 ? 0 : result.failure.trace.filter((entry) => entry.kind === 'request').length);
    expect(result.failure.playerView).toBeUndefined();
    expect(result.failure.proposedMove).toBeUndefined();
  });

  it('records setup exceptions at action zero', async () => {
    vi.spyOn(engine, 'createSession').mockImplementation(() => { throw new Error('setup failed'); });
    const result = await runRecordedSimulation(config);
    expect(result).toMatchObject({ status: 'failed', failure: { config, actionIndex: 0, roundNumber: 0, failureType: 'exception', message: 'setup failed', trace: [] } });
  });

  it('retains all five deals and causal events at a late failure with the exact attempted action count', async () => {
    const check = engine.assertMoveInvariants;
    const checks = vi.spyOn(engine, 'assertMoveInvariants').mockImplementation((previous, move, result, ruleset) => {
      check(previous, move, result, ruleset);
      if (result.state.kind === 'completed') throw new engine.EngineInvariantError('SYNTHETIC', 5, 'late failure');
    });
    const result = await runRecordedSimulation(config);
    if (result.status !== 'failed') throw new Error('Expected failure');
    expect(result.failure.actionIndex).toBe(checks.mock.calls.length);
    expect(result.failure.roundNumber).toBe(5);
    expect(result.failure.trace.map((entry) => entry.index)).toEqual(result.failure.trace.map((_, index) => index));
    const events = result.failure.trace.flatMap((entry) => entry.events ?? []);
    expect(events.filter((event) => event.type === 'ROUND_STARTED').map((event) => event.roundNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(events.at(-1)?.type).toBe('SESSION_ENDED');
    expect(result.failure.decisionTrace).toBeUndefined();
  });

  it('keeps successful results compact and identical with optional AI tracing', async () => {
    const plain = await runSimulation(config);
    const choose = vi.spyOn(BaselineController.prototype, 'chooseMove');
    for (const decisionTrace of [false, true]) {
      const recorded = await runRecordedSimulation(config, { decisionTrace });
      expect(recorded).toEqual({ status: 'completed', config, result: plain });
    }
    for (const [request] of choose.mock.calls) {
      expect(Object.keys(request).sort()).toEqual(['legalMoves', 'playerId', 'requestId', 'view']);
      expect(request.view.round?.players.every((player) => !('hand' in player))).toBe(true);
    }
  });

  it('prevents diagnostic observer mutations from changing state or selected intent', async () => {
    const state = engine.startRound(engine.createSession(config.seats.map((seat) => seat.playerId)).state, { next: () => 0.5 }).state;
    const controllers = new Map(config.seats.map(({ playerId }) => [playerId, new BaselineController(playerId, engine.defaultRuleset, (trace) => {
      (trace.selectedMove as { playerId: string }).playerId = 'diagnostic mutation';
    })]));
    const runner = new GameRunner(state, engine.defaultRuleset, controllers, true, (entry) => {
      if ('state' in entry) (entry.state as { roundNumber: number }).roundNumber = 99;
      if (entry.kind === 'proposal') (entry.move as { playerId: string }).playerId = 'diagnostic mutation';
      if (entry.kind === 'transaction') (entry.result.state as { roundNumber: number }).roundNumber = 99;
    });
    const result = await runner.runTurn();
    expect(result.accepted).toBe(true);
    expect(result.state.roundNumber).toBe(1);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as engine from '../../../src/engine';
import { BaselineController } from '../../../src/ai';
import { GameRunner } from '../../../src/orchestrator';
import type { SimulationConfig } from '../../../src/simulation/SimulationConfig';
import { runSimulation } from '../../../src/simulation/SimulationRunner';

const config: SimulationConfig = {
  runId: 'invariants', engineSeed: 1713, mode: 'basic', rulesetId: 'default',
  seats: [{ playerId: 'south', controller: 'baseline' }, { playerId: 'west', controller: 'baseline' }, { playerId: 'north', controller: 'baseline' }, { playerId: 'east', controller: 'baseline' }],
};
type State = engine.EngineResult['state'];
function active(state: State) {
  if (state.round?.kind !== 'inProgress') throw new Error('Expected active fixture');
  return state.round;
}
afterEach(() => vi.restoreAllMocks());

describe('simulation runtime invariants', () => {
  it('checks setup, all five deals, every Move and all completion boundaries', async () => {
    const snapshots = vi.spyOn(engine, 'assertEngineInvariants');
    const transitions = vi.spyOn(engine, 'assertMoveInvariants');
    const submit = vi.spyOn(engine, 'submitMove');
    await runSimulation(config);
    expect(snapshots.mock.calls.map(([state]) => state.roundNumber)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
    expect(transitions.mock.calls.length).toBeGreaterThan(100);
    expect(transitions).toHaveBeenCalledTimes(submit.mock.calls.length);
    transitions.mock.calls.forEach(([previous, move, result], index) => {
      expect(previous).toEqual(submit.mock.calls[index]![0]);
      expect(previous).not.toBe(submit.mock.calls[index]![0]);
      expect(move).toBe(submit.mock.calls[index]![1]);
      expect(result).toBe(submit.mock.results[index]!.value);
    });
    expect(transitions.mock.calls.filter(([, , result]) => result.state.round?.kind === 'completed').map(([, , result]) => result.state.roundNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it.each(['duplicate', 'missing', 'owner'] as const)('fails before a controller sees an invalid %s deal', async (kind) => {
    const start = engine.startRound;
    vi.spyOn(engine, 'startRound').mockImplementation((...args) => {
      const result = start(...args);
      const round = active(result.state);
      const players = round.context.players.map((player, index) => index !== 0 ? player : {
        ...player, hand: kind === 'duplicate' ? [round.context.players[1]!.hand[0]!, ...player.hand.slice(1)] : player.hand.slice(1),
      });
      return { ...result, state: { ...result.state, round: { ...round, context: { ...round.context,
        ...(kind === 'owner' ? { currentPlayerId: 'unknown' } : { players }),
      } } } };
    });
    const choose = vi.spyOn(BaselineController.prototype, 'chooseMove');
    await expect(runSimulation(config)).rejects.toMatchObject({ name: 'EngineInvariantError', code: kind === 'duplicate' ? 'CARD_LOCATION' : kind === 'missing' ? 'CARD_CONSERVATION' : 'TURN_OWNER' });
    expect(choose).not.toHaveBeenCalled();
  });

  it.each(['loss', 'finished', 'trick', 'turn', 'illegal', 'mutation'] as const)('stops on the first corrupt %s Move', async (kind) => {
    const submit = engine.submitMove;
    const spy = vi.spyOn(engine, 'submitMove').mockImplementation((state, move, rules) => {
      const result = submit(state, move, rules);
      const round = active(result.state);
      let corrupted = result.state;
      if (kind === 'illegal') return { accepted: true, state, events: [] };
      if (kind === 'mutation') {
        const hand = active(state).context.players.find((player) => player.playerId !== move.playerId)!.hand;
        (hand as unknown as unknown[]).pop();
        return submit(state, move, rules);
      }
      if (kind === 'loss') corrupted = { ...corrupted, round: { ...round, context: { ...round.context, players: round.context.players.map((player) => player.playerId === move.playerId ? player : { ...player, hand: player.hand.slice(1) }) } } };
      if (kind === 'finished') corrupted = { ...corrupted, round: { ...round, finishOrder: [move.playerId] } };
      if (kind === 'trick') corrupted = { ...corrupted, round: { ...round, context: { ...round.context, trick: { kind: 'response', current: { type: 'pair', cards: [{ rank: '3', suit: 'clubs' }] } } } } };
      if (kind === 'turn') corrupted = { ...corrupted, round: { ...round, context: { ...round.context, currentPlayerId: 'unknown' } } };
      return { ...result, state: corrupted };
    });
    if (kind === 'illegal') vi.spyOn(BaselineController.prototype, 'chooseMove').mockImplementation(async (request) => ({ kind: 'pass', playerId: request.playerId }));
    const codes = { loss: 'CARD_CONSERVATION', finished: 'FINISHED_PLAYER', trick: 'TRICK', turn: 'TURN_OWNER', illegal: 'ACCEPTED_MOVE', mutation: 'CARD_CONSERVATION' };
    await expect(runSimulation(config)).rejects.toMatchObject({ name: 'EngineInvariantError', code: codes[kind], roundNumber: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('checks a later Round deal before requesting its first Move', async () => {
    const start = engine.startRound;
    vi.spyOn(engine, 'startRound').mockImplementation((...args) => {
      const result = start(...args);
      if (result.state.roundNumber !== 2) return result;
      const round = active(result.state);
      return { ...result, state: { ...result.state, round: { ...round, context: { ...round.context, currentPlayerId: 'unknown' } } } };
    });
    const submit = vi.spyOn(engine, 'submitMove');
    await expect(runSimulation(config)).rejects.toMatchObject({ name: 'EngineInvariantError', code: 'TURN_OWNER', roundNumber: 2 });
    expect(submit.mock.calls.every(([state]) => state.roundNumber === 1)).toBe(true);
    expect(submit.mock.results.at(-1)!.value.state.round.kind).toBe('completed');
  });

  it.each(['placement', 'score', 'aggregation', 'session'] as const)('detects %s corruption at completion before continuing', async (kind) => {
    const submit = engine.submitMove;
    let injected = false;
    vi.spyOn(engine, 'submitMove').mockImplementation((...args) => {
      if (injected) throw new Error('Progressed after corruption');
      const result = submit(...args);
      const state = result.state;
      if (state.round?.kind !== 'completed' || (kind === 'session' && state.kind !== 'completed')) return result;
      injected = true;
      if (kind === 'session') return { ...result, state: { ...state, kind: 'inProgress' } };
      if (kind === 'aggregation') return { ...result, state: { ...state, standings: state.standings.map((entry) => ({ ...entry, totalScore: 99 })) } };
      const completedRounds = state.completedRounds.map((round) => ({ placements: round.placements.map((entry) => ({ ...entry,
        ...(kind === 'placement' ? { placement: 1 as const } : { points: 0 as const }),
      })) }));
      return { ...result, state: { ...state, completedRounds } };
    });
    const next = vi.spyOn(GameRunner.prototype, 'continueToNextRound');
    await expect(runSimulation(config)).rejects.toMatchObject({ name: 'EngineInvariantError', code: kind === 'session' ? 'SESSION_LIFECYCLE' : kind === 'aggregation' ? 'SESSION_TOTALS' : 'PLACEMENTS' });
    expect(injected).toBe(true);
    expect(next).toHaveBeenCalledTimes(kind === 'session' ? 4 : 0);
  });

  it('checks rejected intent and refuses normal progression at completed checkpoints', async () => {
    const rounds = vi.spyOn(GameRunner.prototype, 'runRound');
    const state = (await runSimulation(config)).state;
    const firstRound = (await rounds.mock.results[0]!.value).state as State;
    const controllers = new Map(config.seats.map(({ playerId }) => [playerId, new BaselineController(playerId, engine.defaultRuleset)]));
    for (const checkpoint of [firstRound, state]) {
      const runner = new GameRunner(checkpoint, engine.defaultRuleset, controllers, true);
      await expect(runner.runRound()).rejects.toThrow('active Round');
      await expect(runner.runTurn()).rejects.toThrow();
      if (checkpoint.kind === 'completed') expect(() => runner.continueToNextRound({ next: () => 0 })).toThrow('unfinished Session');
    }
    vi.restoreAllMocks();
    vi.spyOn(BaselineController.prototype, 'chooseMove').mockImplementation(async (request) => ({ kind: 'pass', playerId: request.playerId }));
    const check = vi.spyOn(engine, 'assertMoveInvariants');
    expect((await runSimulation(config)).accepted).toBe(false);
    expect(check).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Move } from '../../../src/domain';
import * as engine from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';
import { runHeadlessSession } from '../../../src/simulation/runHeadlessSession';

const ids = ['south', 'west', 'north', 'east'];
const rng = () => {
  let seed = 1707;
  return { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; } };
};
const select = (request: PlayerTurnRequest): Move => request.legalMoves.find((move) => move.kind === 'play' && move.cards.length === 1)
  ?? request.legalMoves.find((move) => move.kind === 'pass')!;
const setup = () => {
  const random = rng();
  const chooseMove = vi.fn(async (request: PlayerTurnRequest) => select(request));
  const state = engine.startRound(engine.createSession(ids).state, random).state;
  const runner = new GameRunner(state, engine.defaultRuleset, new Map(ids.map((playerId) => [playerId, { playerId, chooseMove }])));
  return { random, chooseMove, runner };
};

afterEach(() => vi.restoreAllMocks());

describe('five-Round headless Session and checkpoints', () => {
  it('waits at Round 1, exposes detached official results, and starts only one Round per continuation', async () => {
    const { runner, random, chooseMove } = setup();
    expect(runner.getStatus()).toBe('ROUND_ACTIVE');
    expect(runner.getRoundResultCheckpoint()).toBeNull();
    expect(() => runner.continueToNextRound(random)).toThrow('checkpoint');
    const result = await runner.runRound();
    const checkpoint = runner.getRoundResultCheckpoint()!;
    expect(runner.getStatus()).toBe('ROUND_RESULT');
    expect(checkpoint).toEqual({ status: 'ROUND_RESULT', view: engine.getPublicView(result.state) });
    expect(checkpoint.view.completedRounds).toHaveLength(1);
    const calls = chooseMove.mock.calls.length;
    await expect(runner.runTurn()).rejects.toThrow('active Turn');
    await expect(runner.runRound()).rejects.toThrow('active Round');
    expect(chooseMove).toHaveBeenCalledTimes(calls);
    (checkpoint.view.standings as unknown as { totalScore: number }[])[0]!.totalScore = -999;
    expect(runner.getRoundResultCheckpoint()!.view).toEqual(engine.getPublicView(result.state));
    const start = vi.spyOn(engine, 'startRound');
    const next = runner.continueToNextRound(random);
    expect(next).toBe(start.mock.results[0]!.value);
    expect(start.mock.calls[0]![0]).toBe(result.state);
    expect(next.events[0]).toEqual({ type: 'ROUND_STARTED', roundNumber: 2 });
    expect(runner.getStatus()).toBe('ROUND_ACTIVE');
    expect(runner.getRoundResultCheckpoint()).toBeNull();
    expect(chooseMove).toHaveBeenCalledTimes(calls);
    expect(() => runner.continueToNextRound(random)).toThrow('checkpoint');
    expect(start).toHaveBeenCalledTimes(1);
    expect((await runner.runRound()).accepted).toBe(true);
    expect(runner.getRoundResultCheckpoint()!.view.roundNumber).toBe(2);
  });

  it('reproduces exactly five official Rounds through the same continuation seam and never starts Round 6', async () => {
    async function play() {
      const { runner, random, chooseMove } = setup();
      const checkpoints: engine.PublicGameView[] = [];
      const continuation = runner.continueToNextRound.bind(runner);
      const continueSpy = vi.spyOn(runner, 'continueToNextRound').mockImplementation((source) => {
        expect(runner.getStatus()).toBe('ROUND_RESULT');
        checkpoints.push(runner.getRoundResultCheckpoint()!.view);
        return continuation(source);
      });
      const start = vi.spyOn(engine, 'startRound');
      const submit = vi.spyOn(engine, 'submitMove');
      const result = await runHeadlessSession(runner, random);
      checkpoints.push(runner.getRoundResultCheckpoint()!.view);
      expect(result).toBe(submit.mock.results.at(-1)!.value);
      expect(result.accepted).toBe(true);
      expect(checkpoints.map((view) => view.roundNumber)).toEqual([1, 2, 3, 4, 5]);
      for (const view of checkpoints) {
        expect(view.round!.status).toBe('completed');
        expect(view.completedRounds).toHaveLength(view.roundNumber);
        const official = submit.mock.results.find((entry) => entry.value.state.roundNumber === view.roundNumber
          && entry.value.state.round.kind === 'completed')!.value;
        expect(view).toEqual(engine.getPublicView(official.state));
        for (const standing of view.standings) {
          expect(standing.totalScore).toBe(view.completedRounds.reduce((sum, round) => sum
            + round.placements.find((entry) => entry.playerId === standing.playerId)!.points, 0));
        }
      }
      for (const transaction of submit.mock.results) {
        expect(transaction.value.accepted).toBe(true);
        engine.assertEngineInvariants(transaction.value.state, engine.defaultRuleset);
      }
      expect(continueSpy).toHaveBeenCalledTimes(4);
      expect(start.mock.results.map((entry) => entry.value.state.roundNumber)).toEqual([2, 3, 4, 5]);
      expect(runner.getStatus()).toBe('SESSION_COMPLETE');
      const final = runner.getRoundResultCheckpoint()!.view;
      expect(final.result).not.toBeNull();
      expect(result.events.find((event) => event.type === 'SESSION_ENDED')).toEqual({ type: 'SESSION_ENDED', roundNumber: 5, result: final.result });
      const calls = chooseMove.mock.calls.length;
      expect(() => continuation(random)).toThrow('unfinished Session');
      await expect(runner.runTurn()).rejects.toThrow('active Turn');
      await expect(runner.runRound()).rejects.toThrow('active Round');
      await expect(runHeadlessSession(runner, random)).rejects.toThrow('active Round');
      expect(start).toHaveBeenCalledTimes(4);
      expect(chooseMove).toHaveBeenCalledTimes(calls);
      const moves = submit.mock.calls.map((call) => call[1]);
      vi.restoreAllMocks();
      return { checkpoints, moves };
    }
    expect(await play()).toEqual(await play());
  });

  it('can auto-continue an existing checkpoint and stops on a rejected Move without skipping the Round', async () => {
    const { runner, random, chooseMove } = setup();
    await runner.runRound();
    const calls = chooseMove.mock.calls.length;
    chooseMove.mockImplementationOnce(async (request) => ({ kind: 'play', playerId: request.playerId, cards: [] }));
    const result = await runHeadlessSession(runner, random);
    expect(result.accepted).toBe(false);
    if (result.accepted) throw new Error('Expected rejection.');
    expect(result.context.playerId).toBe(chooseMove.mock.calls.at(-1)![0].playerId);
    expect(result.state.roundNumber).toBe(2);
    expect(result.state.completedRounds).toHaveLength(1);
    expect(runner.getStatus()).toBe('ROUND_ACTIVE');
    expect(chooseMove).toHaveBeenCalledTimes(calls + 1);
    expect((await runHeadlessSession(runner, random)).state.kind).toBe('completed');
  });

  it('rejects continuation during a pending Turn and preserves the checkpoint if dealing fails or reenters', async () => {
    const { runner, random, chooseMove } = setup();
    chooseMove.mockImplementationOnce(async (request) => {
      expect(() => runner.continueToNextRound(random)).toThrow('already pending');
      return select(request);
    });
    await runner.runRound();
    const checkpoint = runner.getRoundResultCheckpoint();
    const cause = new Error('RNG failed');
    expect(() => runner.continueToNextRound({ next: () => { throw cause; } })).toThrow(cause);
    expect(runner.getRoundResultCheckpoint()).toEqual(checkpoint);
    const next = runner.continueToNextRound({ next: () => {
      expect(() => runner.continueToNextRound(random)).toThrow('already pending');
      return random.next();
    } });
    expect(next.state.roundNumber).toBe(2);
  });

  it('stops on controller failure and can resume explicitly without an automatic fallback', async () => {
    const { runner, random, chooseMove } = setup();
    chooseMove.mockRejectedValueOnce(new Error('Controller failed'));
    await expect(runHeadlessSession(runner, random)).rejects.toThrow('Controller failed for request');
    expect(chooseMove).toHaveBeenCalledTimes(1);
    expect(runner.getStatus()).toBe('ROUND_ACTIVE');
    expect((await runHeadlessSession(runner, random)).state.kind).toBe('completed');
  });
});

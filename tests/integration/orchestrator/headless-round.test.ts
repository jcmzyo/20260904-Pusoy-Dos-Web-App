import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Move } from '../../../src/domain';
import * as engine from '../../../src/engine';
import type { EngineResult } from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';

const ids = ['south', 'west', 'north', 'east'];
const fixture = () => engine.startRound(engine.createSession(ids).state, { next: () => 0 }).state;
const select = (request: PlayerTurnRequest): Move => request.legalMoves.find((move) => move.kind === 'play' && move.cards.length === 1)
  ?? request.legalMoves.find((move) => move.kind === 'pass')!;
const controllers = (chooseMove: (request: PlayerTurnRequest) => Promise<Move>) => new Map(ids.map((playerId) => [playerId, { playerId, chooseMove }]));

afterEach(() => vi.restoreAllMocks());

describe('autonomous headless Round', () => {
  it('reproduces a complete Round through Engine-current active players and surfaces the official final transaction', async () => {
    async function play() {
      const state = fixture();
      const before = JSON.stringify(state);
      const submit = vi.spyOn(engine, 'submitMove');
      const moves: Move[] = [];
      const requestIds = new Set<string>();
      const finishCounts = new Set<number>();
      const chooseMove = vi.fn(async (request: PlayerTurnRequest) => {
        const current = submit.mock.results.at(-1)?.value?.state ?? state;
        const view = engine.getPublicView(current);
        expect(view.round!.status).toBe('inProgress');
        expect(request.playerId).toBe(view.round!.currentPlayerId);
        expect(view.round!.players.find((player) => player.playerId === request.playerId)!.finished).toBe(false);
        expect(request.view).toEqual(engine.getPlayerView(current, request.playerId));
        expect(request.legalMoves).toEqual(engine.getLegalMoves(current, request.playerId, engine.defaultRuleset));
        expect(requestIds.has(request.requestId)).toBe(false);
        requestIds.add(request.requestId);
        finishCounts.add(view.round!.finishOrder.length);
        // Diagnostic test bound, never a production Round-completion rule.
        expect(moves.length).toBeLessThan(250);
        const move = select(request);
        expect(move).toBeDefined();
        moves.push(move);
        return move;
      });
      const runner = new GameRunner(state, engine.defaultRuleset, controllers(chooseMove));
      const result = await runner.runRound();
      expect(result).toBe(submit.mock.results.at(-1)!.value);
      expect(result.accepted).toBe(true);
      expect(submit).toHaveBeenCalledTimes(moves.length);
      for (const [index, transaction] of submit.mock.results.entries()) {
        expect(transaction.value.accepted).toBe(true);
        expect(submit.mock.calls[index]![1]).toBe(moves[index]);
        engine.assertEngineInvariants(transaction.value.state, engine.defaultRuleset);
      }
      expect([...finishCounts].sort()).toEqual([0, 1, 2]);
      const view = engine.getPublicView(result.state);
      expect(view.round!.status).toBe('completed');
      expect(view.round!.currentPlayerId).toBeNull();
      expect(view.roundNumber).toBe(1);
      expect(view.status).toBe('inProgress');
      expect(view.completedRounds).toHaveLength(1);
      const official = view.completedRounds[0]!;
      expect(official.placements.map((entry) => entry.placement)).toEqual([1, 2, 3, 4]);
      expect(official.placements.map((entry) => entry.points)).toEqual([5, 3, 2, 0]);
      expect(new Set(official.placements.map((entry) => entry.playerId)).size).toBe(4);
      expect(result.events.find((event) => event.type === 'ROUND_ENDED')).toEqual({ type: 'ROUND_ENDED', roundNumber: 1, result: official });
      expect(result.events.find((event) => event.type === 'SCORE_CALCULATED')).toEqual({ type: 'SCORE_CALCULATED', roundNumber: 1, result: official, standings: view.standings });
      expect(JSON.stringify(state)).toBe(before);
      await expect(runner.runRound()).rejects.toThrow('active Round');
      await expect(runner.runTurn()).rejects.toThrow('active Turn');
      expect(chooseMove).toHaveBeenCalledTimes(moves.length);
      expect(submit).toHaveBeenCalledTimes(moves.length);
      submit.mockRestore();
      return { moves, view };
    }
    expect(await play()).toEqual(await play());
  });

  it.each(['runRound', 'runTurn'] as const)('excludes overlapping and reentrant execution while %s awaits a controller', async (method) => {
    let resolve!: (move: Move) => void;
    const chooseMove = vi.fn(async (request: PlayerTurnRequest): Promise<Move> => select(request));
    const runner = new GameRunner(fixture(), engine.defaultRuleset, controllers(chooseMove));
    chooseMove.mockImplementationOnce(async (request) => {
      await expect(runner.runRound()).rejects.toThrow('already pending');
      await expect(runner.runTurn()).rejects.toThrow('already pending');
      return new Promise<Move>((done) => { resolve = done; });
    });
    const pending = runner[method]();
    await expect(runner.runRound()).rejects.toThrow('already pending');
    await expect(runner.runTurn()).rejects.toThrow('already pending');
    expect(chooseMove).toHaveBeenCalledTimes(1);
    resolve(select(chooseMove.mock.calls[0]![0]));
    expect((await pending).accepted).toBe(true);
    if (method === 'runTurn') expect((await runner.runRound()).accepted).toBe(true);
  });

  it('stops on Engine rejection with request context, preserving prior progress and allowing explicit resumption', async () => {
    const chooseMove = vi.fn(async (request: PlayerTurnRequest) => select(request));
    chooseMove.mockImplementationOnce(async (request) => select(request));
    chooseMove.mockImplementationOnce(async (request) => ({ kind: 'play', playerId: request.playerId, cards: [] }));
    const runner = new GameRunner(fixture(), engine.defaultRuleset, controllers(chooseMove));
    const submit = vi.spyOn(engine, 'submitMove');
    const result = await runner.runRound();
    expect(result.accepted).toBe(false);
    if (result.accepted) throw new Error('Expected rejection.');
    expect(result.error).toBe(submit.mock.results[1]!.value.error);
    expect(result.context).toEqual({ playerId: chooseMove.mock.calls[1]![0].playerId, requestId: chooseMove.mock.calls[1]![0].requestId });
    expect(result.state).toBe(submit.mock.results[0]!.value.state);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(chooseMove).toHaveBeenCalledTimes(2);
    engine.assertEngineInvariants(result.state, engine.defaultRuleset);
    expect((await runner.runRound()).accepted).toBe(true);
  });

  it.each(['controller', 'malformed', 'engine'] as const)('stops on %s failure without losing progress or retaining the execution guard', async (failure) => {
    const cause = new Error('Deliberate failure');
    const chooseMove = vi.fn(async (request: PlayerTurnRequest) => select(request));
    const runner = new GameRunner(fixture(), engine.defaultRuleset, controllers(chooseMove));
    const submitMove = engine.submitMove;
    const submit = vi.spyOn(engine, 'submitMove');
    if (failure === 'engine') {
      submit.mockImplementationOnce(submitMove).mockImplementationOnce(() => { throw cause; });
    } else {
      chooseMove.mockImplementationOnce(async (request) => select(request)).mockImplementationOnce(async () => {
        if (failure === 'controller') throw cause;
        return null as unknown as Move;
      });
    }
    const pending = runner.runRound();
    if (failure === 'engine') await expect(pending).rejects.toBe(cause);
    else await expect(pending).rejects.toThrow(failure === 'controller' ? 'Controller failed for request' : 'Malformed controller response for request');
    expect(chooseMove).toHaveBeenCalledTimes(2);
    const previous = submit.mock.results[0]!.value.state as EngineResult['state'];
    engine.assertEngineInvariants(previous, engine.defaultRuleset);
    expect((await runner.runTurn()).accepted).toBe(true);
    expect(chooseMove.mock.calls[2]![0].view).toEqual(engine.getPlayerView(previous, chooseMove.mock.calls[2]![0].playerId));
  });

  it('rejects a Session without a started Round before requesting a controller', async () => {
    const chooseMove = vi.fn(async (request: PlayerTurnRequest) => select(request));
    const runner = new GameRunner(engine.createSession(ids).state, engine.defaultRuleset, controllers(chooseMove));
    await expect(runner.runRound()).rejects.toThrow('active Round');
    expect(chooseMove).not.toHaveBeenCalled();
  });
});

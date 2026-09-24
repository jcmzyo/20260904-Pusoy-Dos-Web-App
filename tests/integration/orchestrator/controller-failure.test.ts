import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Move } from '../../../src/domain';
import * as engine from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';

const ids = ['south', 'west', 'north', 'east'];
const single = (request: PlayerTurnRequest) => request.legalMoves.find((move) => move.kind === 'play' && move.cards.length === 1)!;

function fixture() {
  const state = engine.startRound(engine.createSession(ids).state, { next: () => 0 }).state;
  const playerId = engine.getPublicView(state).round!.currentPlayerId!;
  const chooseMove = vi.fn(async (request: PlayerTurnRequest): Promise<Move> => single(request));
  const mapping = new Map(ids.map((id) => [id, { playerId: id, chooseMove }]));
  const runner = new GameRunner(state, engine.defaultRuleset, mapping);
  const before = JSON.stringify(state);
  const submit = vi.spyOn(engine, 'submitMove');
  const unchanged = () => {
    expect(runner['state']).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
    engine.assertEngineInvariants(state, engine.defaultRuleset);
  };
  return { state, playerId, chooseMove, mapping, runner, submit, unchanged };
}

afterEach(() => vi.restoreAllMocks());

describe('controller failure and invalid-response handling', () => {
  it.each(['throw', 'reject', 'non-Error rejection'] as const)('reports %s with original cause and permits an explicit fresh request', async (kind) => {
    const test = fixture();
    const cause = kind === 'non-Error rejection' ? 'controller unavailable' : new Error('controller unavailable');
    test.chooseMove.mockImplementationOnce(() => {
      if (kind === 'throw') throw cause;
      return Promise.reject(cause);
    });
    const turn = test.runner.runTurn();
    const request = test.chooseMove.mock.calls[0]![0];
    await expect(turn).rejects.toMatchObject({
      message: `Controller failed for request ${request.requestId}, player ${test.playerId}.`, cause,
    });
    test.unchanged();
    expect(test.submit).not.toHaveBeenCalled();
    expect(test.chooseMove).toHaveBeenCalledTimes(1);
    expect((await test.runner.runTurn()).accepted).toBe(true);
    const retry = test.chooseMove.mock.calls[1]![0];
    expect(retry.requestId).not.toBe(request.requestId);
    expect(retry.view).toEqual(request.view);
    expect(test.submit).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null, false, 7, 'pass', [], {}, { kind: 'pass' },
    { kind: 'unknown', playerId: 'current' }, { kind: 'play', playerId: 'current' },
    { kind: 'play', playerId: 'current', cards: null }])('rejects malformed response %j without a substitute or Engine call', async (response) => {
    const test = fixture();
    const move = response && typeof response === 'object' && 'playerId' in response
      ? { ...response, playerId: test.playerId } : response;
    // Deliberately violate the typed controller contract at the runtime boundary.
    test.chooseMove.mockResolvedValueOnce(move as Move);
    const turn = test.runner.runTurn();
    const request = test.chooseMove.mock.calls[0]![0];
    await expect(turn).rejects.toThrow(`Malformed controller response for request ${request.requestId}, player ${test.playerId}.`);
    test.unchanged();
    expect(test.submit).not.toHaveBeenCalled();
    expect(test.chooseMove).toHaveBeenCalledTimes(1);
    expect((await test.runner.runTurn()).accepted).toBe(true);
  });

  it.each(['another participant', 'unknown player'])('rejects intent from %s with request context', async (kind) => {
    const test = fixture();
    test.chooseMove.mockResolvedValueOnce({ kind: 'pass', playerId: kind === 'unknown player' ? 'outsider' : ids.find((id) => id !== test.playerId)! });
    const turn = test.runner.runTurn();
    const request = test.chooseMove.mock.calls[0]![0];
    await expect(turn).rejects.toThrow(`Controller response player mismatch for request ${request.requestId}, player ${test.playerId}.`);
    test.unchanged();
    expect(test.submit).not.toHaveBeenCalled();
    expect(test.chooseMove).toHaveBeenCalledTimes(1);
  });

  it.each(['before request', 'while awaiting'] as const)('detects controller identity changes %s', async (timing) => {
    const test = fixture();
    const controller = test.mapping.get(test.playerId)!;
    let resolve!: (move: Move) => void;
    if (timing === 'before request') controller.playerId = 'wrong';
    else test.chooseMove.mockImplementationOnce(() => new Promise<Move>((done) => { resolve = done; }));
    const turn = test.runner.runTurn();
    const pending = test.runner['activeRequest'];
    if (timing === 'while awaiting') {
      controller.playerId = 'wrong';
      resolve(single(test.chooseMove.mock.calls[0]![0]));
    }
    await expect(turn).rejects.toThrow(new RegExp(`Controller mapping.*${test.playerId}.*`));
    if (pending) await expect(turn).rejects.toThrow(pending.requestId);
    else await expect(turn).rejects.toThrow('request ');
    test.unchanged();
    expect(test.submit).not.toHaveBeenCalled();
    controller.playerId = test.playerId;
    expect((await test.runner.runTurn()).accepted).toBe(true);
  });

  it.each(['opening Pass', 'empty cards', 'invalid card', 'duplicate card'] as const)('preserves Engine rejection for %s with player/request context and no automatic retry', async (kind) => {
    const test = fixture();
    test.chooseMove.mockImplementation(async (request) => {
      const opening = single(request);
      if (opening.kind !== 'play') throw new Error('Expected an opening Play.');
      if (kind === 'opening Pass') return { kind: 'pass', playerId: request.playerId };
      const cards = kind === 'empty cards' ? [] : kind === 'invalid card' ? [null] : [opening.cards[0], opening.cards[0]];
      return { kind: 'play', playerId: request.playerId, cards } as Move;
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await test.runner.runTurn();
      const request = test.chooseMove.mock.calls[attempt]![0];
      const authoritative = test.submit.mock.results[attempt]!.value;
      expect(result.accepted).toBe(false);
      if (result.accepted) throw new Error('Expected rejection.');
      expect(result.context).toEqual({ playerId: test.playerId, requestId: request.requestId });
      expect(result.error).toBe(authoritative.error);
      expect(result.error.code).toBe(kind === 'opening Pass' ? 'PASS_NOT_ALLOWED' : kind === 'duplicate card' ? 'DUPLICATE_CARD' : 'INVALID_COMBINATION');
      expect(result.events).toBe(authoritative.events);
      expect(result.events).toEqual([]);
      expect(result.state).toBe(test.state);
      expect(test.submit.mock.calls[attempt]![1]).toBe(await test.chooseMove.mock.results[attempt]!.value);
      test.unchanged();
      expect(test.chooseMove).toHaveBeenCalledTimes(attempt + 1);
      expect(test.submit).toHaveBeenCalledTimes(attempt + 1);
    }
    expect(test.chooseMove.mock.calls[1]![0].requestId).not.toBe(test.chooseMove.mock.calls[0]![0].requestId);
    test.chooseMove.mockImplementation(async (request) => single(request));
    expect((await test.runner.runTurn()).accepted).toBe(true);
  });

  it('does not relabel unexpected Engine exceptions as controller failures or retry them', async () => {
    const test = fixture();
    const cause = new Error('Engine invariant failure');
    test.submit.mockImplementationOnce(() => { throw cause; });
    await expect(test.runner.runTurn()).rejects.toBe(cause);
    test.unchanged();
    expect(test.chooseMove).toHaveBeenCalledTimes(1);
    expect(test.submit).toHaveBeenCalledTimes(1);
    expect((await test.runner.runTurn()).accepted).toBe(true);
  });
});

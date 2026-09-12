import { describe, expect, it, vi } from 'vitest';
import type { Move } from '../../../src/domain';
import * as engine from '../../../src/engine';
import type { EngineResult } from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';

const ids = ['south', 'west', 'north', 'east'];
const fixture = () => engine.startRound(engine.createSession(ids).state, { next: () => 0 }).state;
const currentPlayer = (state: EngineResult['state']) => engine.getPublicView(state).round!.currentPlayerId!;
const single = (request: PlayerTurnRequest) => request.legalMoves.find((move) => move.kind === 'play' && move.cards.length === 1)!;

function controllers(chooseMove: (request: PlayerTurnRequest) => Promise<Move> = async (request) => single(request)) {
  return new Map(ids.map((playerId) => [playerId, { playerId, chooseMove: vi.fn(chooseMove) }]));
}

function objects(value: unknown): object[] {
  if (value === null || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(objects)];
}

describe('serialized single controller Turn', () => {
  it('routes only to the Engine current player with detached safe information and surfaces the exact Engine result', async () => {
    const state = fixture();
    const before = JSON.stringify(state);
    const playerId = currentPlayer(state);
    const mapping = controllers(async (request) => {
      expect(Object.keys(request).sort()).toEqual(['legalMoves', 'playerId', 'requestId', 'view']);
      expect(request.playerId).toBe(playerId);
      expect(request.view).toEqual(engine.getPlayerView(state, playerId));
      expect(request.legalMoves).toEqual(engine.getLegalMoves(state, playerId, engine.defaultRuleset));
      expect(request.requestId.length).toBeGreaterThan(0);
      for (const player of request.view.round!.players) {
        expect(Object.keys(player).sort()).toEqual(['cardCount', 'finished', 'playerId']);
      }
      const internals = new Set(objects(state));
      expect(objects(request).some((entry) => internals.has(entry))).toBe(false);
      return single(request);
    });
    const runner = new GameRunner(state, engine.defaultRuleset, mapping);
    const submit = vi.spyOn(engine, 'submitMove');
    try {
      const result = await runner.runTurn();
      expect(submit).toHaveBeenCalledTimes(1);
      const request = mapping.get(playerId)!.chooseMove.mock.calls[0]![0];
      expect(submit).toHaveBeenCalledWith(state, single(request), engine.defaultRuleset);
      expect(result).toBe(submit.mock.results[0]!.value);
      expect(result.accepted).toBe(true);
      expect(result.events.map((event) => event.type)).toEqual(['CARDS_PLAYED', 'TURN_CHANGED']);
      expect(engine.getPlayerView(result.state, playerId).hand).toHaveLength(12);
      engine.assertEngineInvariants(result.state, engine.defaultRuleset);
      for (const [id, controller] of mapping) expect(controller.chooseMove).toHaveBeenCalledTimes(id === playerId ? 1 : 0);
      expect(JSON.stringify(state)).toBe(before);
    } finally {
      submit.mockRestore();
    }
  });

  it('waits for input, rejects overlapping calls, then uses the Engine result for the next explicit Turn', async () => {
    const state = fixture();
    const before = JSON.stringify(state);
    const playerId = currentPlayer(state);
    let resolve!: (move: Move) => void;
    let requested!: PlayerTurnRequest;
    const mapping = controllers();
    mapping.get(playerId)!.chooseMove.mockImplementation((request) => {
      requested = request;
      return new Promise<Move>((done) => { resolve = done; });
    });
    const runner = new GameRunner(state, engine.defaultRuleset, mapping);
    const submit = vi.spyOn(engine, 'submitMove');
    try {
      const pending = runner.runTurn();
      await expect(runner.runTurn()).rejects.toThrow('already pending');
      expect(mapping.get(playerId)!.chooseMove).toHaveBeenCalledTimes(1);
      expect(submit).not.toHaveBeenCalled();
      expect(JSON.stringify(state)).toBe(before);
      resolve(single(requested));
      const first = await pending;
      expect(first.accepted).toBe(true);
      expect(submit).toHaveBeenCalledTimes(1);
      const nextPlayer = currentPlayer(first.state);
      expect(nextPlayer).not.toBe(playerId);
      expect(mapping.get(nextPlayer)!.chooseMove).not.toHaveBeenCalled();
      const second = await runner.runTurn();
      expect(second.accepted).toBe(true);
      expect(submit).toHaveBeenCalledTimes(2);
      const nextRequest = mapping.get(nextPlayer)!.chooseMove.mock.calls[0]![0];
      expect(nextRequest.view).toEqual(engine.getPlayerView(first.state, nextPlayer));
      expect(nextRequest.requestId).not.toBe(requested.requestId);
      engine.assertEngineInvariants(second.state, engine.defaultRuleset);
    } finally {
      submit.mockRestore();
    }
  });

  it.each(['missing', 'mismatched', 'extra'] as const)('rejects a %s mapping before invoking any controller or mutating state', (kind) => {
    const state = fixture();
    const before = JSON.stringify(state);
    const mapping = controllers();
    const original = [...mapping.values()];
    const other = ids.find((id) => id !== currentPlayer(state))!;
    if (kind === 'missing') mapping.delete(other);
    if (kind === 'mismatched') mapping.set(other, { playerId: currentPlayer(state), chooseMove: vi.fn() });
    if (kind === 'extra') mapping.set('outsider', { playerId: 'outsider', chooseMove: vi.fn() });
    const error = kind === 'missing' ? `Missing controller for player ${other}`
      : kind === 'mismatched' ? `Controller mapping for player ${other}` : 'non-participant outsider';
    expect(() => new GameRunner(state, engine.defaultRuleset, mapping)).toThrow(error);
    for (const controller of original) expect(controller.chooseMove).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });

  it('owns its mapping snapshot and rejects an acting controller whose identity was changed', async () => {
    const state = fixture();
    const before = JSON.stringify(state);
    const mapping = controllers();
    const controller = mapping.get(currentPlayer(state))!;
    const runner = new GameRunner(state, engine.defaultRuleset, mapping);
    mapping.clear();
    const playerId = controller.playerId;
    controller.playerId = 'wrong';
    await expect(runner.runTurn()).rejects.toThrow(`Controller mapping for player ${playerId}`);
    expect(controller.chooseMove).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
    controller.playerId = playerId;
    expect((await runner.runTurn()).accepted).toBe(true);
  });

  it('forwards an illegal opening Pass to Engine unchanged without substituting or applying it', async () => {
    const state = fixture();
    const before = JSON.stringify(state);
    const move: Move = { kind: 'pass', playerId: currentPlayer(state) };
    const mapping = controllers(async () => move);
    const runner = new GameRunner(state, engine.defaultRuleset, mapping);
    const expected = engine.submitMove(state, move, engine.defaultRuleset);
    const submit = vi.spyOn(engine, 'submitMove');
    try {
      const result = await runner.runTurn();
      expect(result).toEqual(expected);
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(state);
      expect(result.events).toEqual([]);
      expect(submit).toHaveBeenCalledTimes(1);
      expect(submit.mock.calls[0]![1]).toBe(move);
      expect(JSON.stringify(state)).toBe(before);
    } finally {
      submit.mockRestore();
    }
  });

  it('preserves a voluntary Pass even when the Engine offers beating Plays', async () => {
    const initial = fixture();
    const opening = engine.getLegalMoves(initial, currentPlayer(initial), engine.defaultRuleset).find((move) => move.kind === 'play' && move.cards.length === 1)!;
    const state = engine.submitMove(initial, opening, engine.defaultRuleset).state;
    const mapping = controllers(async (request) => {
      expect(request.legalMoves.some((move) => move.kind === 'play')).toBe(true);
      return request.legalMoves.find((move) => move.kind === 'pass')!;
    });
    const result = await new GameRunner(state, engine.defaultRuleset, mapping).runTurn();
    expect(result.accepted).toBe(true);
    expect(result.events[0]).toEqual({ type: 'PLAYER_PASSED', roundNumber: 1, playerId: currentPlayer(state) });
    expect(engine.getPlayerView(result.state, currentPlayer(state)).hand).toEqual(engine.getPlayerView(state, currentPlayer(state)).hand);
    engine.assertEngineInvariants(result.state, engine.defaultRuleset);
  });

  it('keeps authoritative state intact if the controller mutates its request', async () => {
    const state = fixture();
    const before = JSON.stringify(state);
    const mapping = controllers(async (request) => {
      const move = single(request);
      const selected: Move = move.kind === 'play' ? { ...move, cards: move.cards.map((card) => ({ ...card })) } : move;
      for (const entry of objects(request)) {
        for (const key of Object.keys(entry)) Reflect.set(entry, key, null);
      }
      expect(JSON.stringify(state)).toBe(before);
      return selected;
    });
    const result = await new GameRunner(state, engine.defaultRuleset, mapping).runTurn();
    expect(result.accepted).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    engine.assertEngineInvariants(result.state, engine.defaultRuleset);
  });

  it('does not invoke controllers before the Engine has an active Turn', async () => {
    const state = engine.createSession(ids).state;
    const before = JSON.stringify(state);
    const mapping = controllers();
    const runner = new GameRunner(state, engine.defaultRuleset, mapping);
    await expect(runner.runTurn()).rejects.toThrow('active Turn');
    for (const controller of mapping.values()) expect(controller.chooseMove).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });
});

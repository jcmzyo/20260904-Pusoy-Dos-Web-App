import { describe, expect, it, vi } from 'vitest';
import { createSession, defaultRuleset, startRound } from '../../../src/engine';
import { createPlayerTurnRequest, HumanController } from '../../../src/orchestrator';
import type { PlayerController } from '../../../src/orchestrator';

const state = () => startRound(createSession(['south', 'west', 'north', 'east']).state, { next: () => 0 }).state;
const request = () => createPlayerTurnRequest(state(), defaultRuleset);

describe('HumanController input boundary', () => {
  it.each(['play', 'pass'] as const)('waits for explicit %s intent and resolves exactly once through the production contract', async (kind) => {
    const turn = request();
    const human = new HumanController(turn.playerId);
    const controller: PlayerController = human;
    const settled = vi.fn();
    expect(human.getPendingRequest()).toBeNull();
    const result = controller.chooseMove(turn);
    void result.then(settled);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(human.getPendingRequest()).toEqual(turn);
    const move = kind === 'play' ? turn.legalMoves[0]! : { kind, playerId: turn.playerId };
    expect(human.resolveMove(turn.requestId, move)).toBe(true);
    expect(human.getPendingRequest()).toBeNull();
    expect(human.resolveMove(turn.requestId, move)).toBe(false);
    await expect(result).resolves.toEqual(move);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('rejects overlapping requests without replacing the active input', async () => {
    const turn = request();
    const human = new HumanController(turn.playerId);
    const result = human.chooseMove(turn);
    await expect(human.chooseMove(request())).rejects.toThrow('already pending');
    expect(human.getPendingRequest()).toBe(turn);
    human.resolveMove(turn.requestId, turn.legalMoves[0]!);
    await result;
  });

  it('rejects mismatched controller requests and ignores wrong-player or stale input', async () => {
    const turn = request();
    const human = new HumanController(turn.playerId);
    await expect(human.chooseMove({ ...turn, playerId: 'other' })).rejects.toThrow('received a request for other');
    expect(human.getPendingRequest()).toBeNull();
    expect(human.resolveMove(turn.requestId, turn.legalMoves[0]!)).toBe(false);
    const result = human.chooseMove(turn);
    expect(human.resolveMove('obsolete', turn.legalMoves[0]!)).toBe(false);
    expect(human.resolveMove(turn.requestId, { kind: 'pass', playerId: 'other' })).toBe(false);
    expect(human.cancelPendingRequest('obsolete')).toBe(false);
    expect(human.getPendingRequest()).toBe(turn);
    human.resolveMove(turn.requestId, turn.legalMoves[0]!);
    await result;
  });

  it.each(['before request', 'during request'] as const)('suspends input when paused %s without resolving or queueing a Move', async (when) => {
    const turn = request();
    const human = new HumanController(turn.playerId);
    const settled = vi.fn();
    if (when === 'before request') human.pause();
    const result = human.chooseMove(turn);
    void result.then(settled);
    human.pause();
    human.pause();
    expect(human.resolveMove(turn.requestId, turn.legalMoves[0]!)).toBe(false);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(human.getPendingRequest()).toBe(turn);
    human.resume();
    human.resume();
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(human.resolveMove(turn.requestId, turn.legalMoves[0]!)).toBe(true);
    await expect(result).resolves.toEqual(turn.legalMoves[0]);
  });

  it.each(['active', 'paused'] as const)('cancels %s input without producing a Move and protects the next request', async (status) => {
    const turn = request();
    const human = new HumanController(turn.playerId);
    const result = human.chooseMove(turn);
    const rejected = expect(result).rejects.toThrow(`cancelled for request ${turn.requestId}`);
    if (status === 'paused') human.pause();
    expect(human.cancelPendingRequest(turn.requestId)).toBe(true);
    expect(human.getPendingRequest()).toBeNull();
    expect(human.cancelPendingRequest(turn.requestId)).toBe(false);
    await rejected;
    human.resume();
    const next = request();
    const nextResult = human.chooseMove(next);
    expect(next.requestId).not.toBe(turn.requestId);
    expect(human.resolveMove(turn.requestId, turn.legalMoves[0]!)).toBe(false);
    expect(human.cancelPendingRequest(turn.requestId)).toBe(false);
    expect(human.getPendingRequest()).toBe(next);
    human.resolveMove(next.requestId, next.legalMoves[0]!);
    await nextResult;
  });

  it('detaches submitted cards so later UI edits cannot change the delivered intent', async () => {
    const turn = request();
    const human = new HumanController(turn.playerId);
    const result = human.chooseMove(turn);
    const legal = turn.legalMoves.find((move) => move.kind === 'play')!;
    const cards = legal.cards.map((card) => ({ ...card }));
    const expected = { kind: 'play', playerId: turn.playerId, cards: cards.map((card) => ({ ...card })) };
    human.resolveMove(turn.requestId, { kind: 'play', playerId: turn.playerId, cards });
    cards[0]!.rank = cards[0]!.rank === '3' ? '4' : '3';
    cards.length = 0;
    await expect(result).resolves.toEqual(expected);
  });
});

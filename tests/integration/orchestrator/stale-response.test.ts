import { describe, expect, it, vi } from 'vitest';
import type { Move } from '../../../src/domain';
import * as engine from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';

const ids = ['south', 'west', 'north', 'east'];
const fixture = () => engine.startRound(engine.createSession(ids).state, { next: () => 0 }).state;
const single = (request: PlayerTurnRequest) => request.legalMoves.find((move) => move.kind === 'play' && move.cards.length === 1)!;

function deferredTurn() {
  const state = fixture();
  let request!: PlayerTurnRequest;
  let resolve!: (move: Move) => void;
  const chooseMove = vi.fn((input: PlayerTurnRequest) => {
    request = input;
    return new Promise<Move>((done) => { resolve = done; });
  });
  const runner = new GameRunner(state, engine.defaultRuleset, new Map(ids.map((playerId) => [playerId, { playerId, chooseMove }])));
  const turn = runner.runTurn();
  return { runner, state, request, resolve, resolveCurrent: (move: Move) => resolve(move), turn, chooseMove };
}

describe('stale and duplicate controller responses', () => {
  it('accepts the current response once even if its Promise is resolved repeatedly across Turns', async () => {
    const first = deferredTurn();
    const submit = vi.spyOn(engine, 'submitMove');
    try {
      first.resolve(single(first.request));
      first.resolve(single(first.request));
      const result = await first.turn;
      expect(result.accepted).toBe(true);
      expect(submit).toHaveBeenCalledTimes(1);
      const before = JSON.stringify(result.state);
      const nextTurn = first.runner.runTurn();
      first.resolve(single(first.request));
      await Promise.resolve();
      expect(submit).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(first.runner['state'])).toBe(before);
      const nextRequest = first.chooseMove.mock.calls[1]![0];
      expect(nextRequest.requestId).not.toBe(first.request.requestId);
      first.resolveCurrent(single(nextRequest));
      const next = await nextTurn;
      expect(next.accepted).toBe(true);
      expect(submit).toHaveBeenCalledTimes(2);
      engine.assertEngineInvariants(next.state, engine.defaultRuleset);
    } finally {
      submit.mockRestore();
    }
  });

  it.each(['superseded', 'consumed', 'different player', 'same player newer state'] as const)('rejects a %s request before Engine submission', async (kind) => {
    const pending = deferredTurn();
    // Exercise obsolescence internally without adding public restore/cancel lifecycle APIs to T04.
    if (kind === 'superseded') pending.runner['activeRequest'] = { ...pending.runner['activeRequest']!, requestId: 'newer-request' };
    if (kind === 'consumed') pending.runner['activeRequest'] = undefined;
    if (kind === 'different player') {
      pending.runner['state'] = engine.submitMove(pending.state, single(pending.request), engine.defaultRuleset).state;
      expect(engine.getPublicView(pending.runner['state']).round!.currentPlayerId).not.toBe(pending.request.playerId);
    }
    if (kind === 'same player newer state') {
      let state = engine.submitMove(pending.state, single(pending.request), engine.defaultRuleset).state;
      for (let index = 0; index < 3; index += 1) {
        const playerId = engine.getPublicView(state).round!.currentPlayerId!;
        state = engine.submitMove(state, { kind: 'pass', playerId }, engine.defaultRuleset).state;
      }
      expect(engine.getPublicView(state).round!.currentPlayerId).toBe(pending.request.playerId);
      pending.runner['state'] = state;
    }
    const current = pending.runner['state'];
    const before = JSON.stringify(current);
    const submit = vi.spyOn(engine, 'submitMove');
    try {
      pending.resolve(single(pending.request));
      await expect(pending.turn).rejects.toThrow(`request ${pending.request.requestId}, player ${pending.request.playerId}`);
      expect(submit).not.toHaveBeenCalled();
      expect(pending.runner['state']).toBe(current);
      expect(JSON.stringify(current)).toBe(before);
      engine.assertEngineInvariants(current, engine.defaultRuleset);
    } finally {
      submit.mockRestore();
    }
  });

  it.each(['accepted', 'rejected'] as const)('consumes an %s submission token before another response can reuse it', async (outcome) => {
    const pending = deferredTurn();
    const token = pending.runner['activeRequest']!;
    const move: Move = outcome === 'accepted' ? single(pending.request) : { kind: 'pass', playerId: pending.request.playerId };
    const submit = vi.spyOn(engine, 'submitMove');
    try {
      pending.resolve(move);
      const result = await pending.turn;
      expect(result.accepted).toBe(outcome === 'accepted');
      const before = JSON.stringify(result.state);
      expect(() => pending.runner['submitResponse'](token, move)).toThrow('Stale or consumed');
      expect(submit).toHaveBeenCalledTimes(1);
      expect(pending.runner['state']).toBe(result.state);
      expect(JSON.stringify(result.state)).toBe(before);
      const nextTurn = pending.runner.runTurn();
      const nextToken = pending.runner['activeRequest'];
      expect(() => pending.runner['submitResponse'](token, move)).toThrow('Stale or consumed');
      expect(pending.runner['activeRequest']).toBe(nextToken);
      expect(submit).toHaveBeenCalledTimes(1);
      pending.resolveCurrent(single(pending.chooseMove.mock.calls[1]![0]));
      expect((await nextTurn).accepted).toBe(true);
      expect(submit).toHaveBeenCalledTimes(2);
    } finally {
      submit.mockRestore();
    }
  });

  it.each(['player changed', 'Round completed', 'Session completed'] as const)('checks Engine current-turn context independently of the state token: %s', async (context) => {
    const pending = deferredTurn();
    const before = JSON.stringify(pending.state);
    const view = engine.getPublicView(pending.state);
    const publicView = vi.spyOn(engine, 'getPublicView').mockReturnValueOnce({
      ...view,
      status: context === 'Session completed' ? 'completed' : view.status,
      round: {
        ...view.round!,
        status: context === 'Round completed' ? 'completed' : 'inProgress',
        currentPlayerId: context === 'player changed' ? ids.find((id) => id !== pending.request.playerId)! : pending.request.playerId,
      },
    });
    const submit = vi.spyOn(engine, 'submitMove');
    try {
      pending.resolve(single(pending.request));
      await expect(pending.turn).rejects.toThrow('Stale or consumed');
      expect(publicView).toHaveBeenCalledWith(pending.state);
      expect(submit).not.toHaveBeenCalled();
      expect(pending.runner['state']).toBe(pending.state);
      expect(JSON.stringify(pending.state)).toBe(before);
    } finally {
      publicView.mockRestore();
      submit.mockRestore();
    }
  });
});

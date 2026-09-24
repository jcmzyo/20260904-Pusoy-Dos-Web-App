import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Move } from '../../../src/domain';
import { createSession, defaultRuleset, getLegalMoves, getPlayerView, getPublicView, startRound } from '../../../src/engine';
import type { PlayerView } from '../../../src/engine';
import type { PlayerController, PlayerTurnRequest, TurnRequestId } from '../../../src/orchestrator';

function fixture() {
  const state = startRound(createSession(['south', 'west', 'north', 'east']).state, { next: () => 0 }).state;
  const playerId = getPublicView(state).round!.currentPlayerId!;
  const request: PlayerTurnRequest = {
    playerId,
    view: getPlayerView(state, playerId),
    legalMoves: getLegalMoves(state, playerId, defaultRuleset),
    requestId: 'execution-1:request-1',
  };
  return { state, request };
}

describe('PlayerController and PlayerTurnRequest contracts', () => {
  it('supports asynchronously supplied Move intent through the public package', async () => {
    const { request } = fixture();
    const controller: PlayerController = {
      playerId: request.playerId,
      async chooseMove(input) {
        expect(input).toBe(request);
        return input.legalMoves[0]!;
      },
    };
    const result = controller.chooseMove(request);
    expectTypeOf(result).toEqualTypeOf<Promise<Move>>();
    expectTypeOf(request.view).toEqualTypeOf<PlayerView>();
    expectTypeOf(request.requestId).toEqualTypeOf<TurnRequestId>();
    await expect(result).resolves.toEqual(request.legalMoves[0]);
  });

  it('distinguishes requests for identical turn information using caller-assigned identities', () => {
    const { request } = fixture();
    const next: PlayerTurnRequest = { ...request, requestId: 'execution-1:request-2' };
    expect(next.view).toBe(request.view);
    expect(next.playerId).toBe(request.playerId);
    expect(next.requestId).not.toBe(request.requestId);
  });

  it('carries safe player information without an authoritative state reference', () => {
    const { state, request } = fixture();
    expect(Object.keys(request).sort()).toEqual(['legalMoves', 'playerId', 'requestId', 'view']);
    expect(request.view.playerId).toBe(request.playerId);
    expect(request.view.hand).toHaveLength(13);
    expect(request.view.round!.players).toHaveLength(4);
    for (const player of request.view.round!.players) {
      expect(Object.keys(player).sort()).toEqual(['cardCount', 'finished', 'playerId']);
    }
    function objects(value: unknown): object[] {
      if (value === null || typeof value !== 'object') return [];
      return [value, ...Object.values(value).flatMap(objects)];
    }
    const authoritativeObjects = new Set(objects(state));
    expect(objects(request).some((value) => authoritativeObjects.has(value))).toBe(false);
  });

  it('requires asynchronous results and readonly request data at compile time', () => {
    // These negative type assertions are compiled but never mutate a runtime request.
    function check(request: PlayerTurnRequest, controller: PlayerController) {
      // @ts-expect-error - controller identity is readonly
      controller.playerId = 'other';
      // @ts-expect-error - a synchronous Move does not satisfy the async contract
      const synchronous: PlayerController = { playerId: request.playerId, chooseMove: () => request.legalMoves[0]! };
      // @ts-expect-error - request identity is required
      const missingId: PlayerTurnRequest = { playerId: request.playerId, view: request.view, legalMoves: request.legalMoves };
      // @ts-expect-error - player identity is readonly
      request.playerId = 'other';
      // @ts-expect-error - request identity is readonly
      request.requestId = 'other';
      // @ts-expect-error - view reference is readonly
      request.view = request.view;
      // @ts-expect-error - candidate reference is readonly
      request.legalMoves = [];
      // @ts-expect-error - candidate collection is readonly
      request.legalMoves.push({ kind: 'pass', playerId: request.playerId });
      // @ts-expect-error - own hand is readonly
      request.view.hand.pop();
      // @ts-expect-error - card values are readonly
      request.view.hand[0]!.rank = '2';
      // @ts-expect-error - public player facts are readonly
      request.view.round!.players[0]!.cardCount = 0;
      // @ts-expect-error - opponent hands are not exposed
      request.view.round!.players[0]!.hand;
      // @ts-expect-error - Engine-private context is not exposed
      request.view.round!.context;
      // @ts-expect-error - authoritative state is not exposed
      request.state;
      const move = request.legalMoves[0]!;
      // @ts-expect-error - candidate intent is readonly
      move.playerId = 'other';
      if (move.kind === 'play') {
        // @ts-expect-error - candidate cards are readonly
        move.cards.pop();
        // @ts-expect-error - candidate card values are readonly
        move.cards[0]!.rank = '2';
      }
      void synchronous;
      void missingId;
    }
    void check;
  });
});

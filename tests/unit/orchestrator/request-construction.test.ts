import { describe, expect, it } from 'vitest';
import { createSession, defaultRuleset, getLegalMoves, getPlayerView, getPublicView, startRound, submitMove } from '../../../src/engine';
import type { EngineResult } from '../../../src/engine';
import { createPlayerTurnRequest } from '../../../src/orchestrator';

const ids = ['south', 'west', 'north', 'east'];
const fixture = () => startRound(createSession(ids).state, { next: () => 0 }).state;

function objects(value: unknown): object[] {
  if (value === null || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(objects)];
}

function verifyRequest(state: EngineResult['state']) {
  const before = JSON.stringify(state);
  const request = createPlayerTurnRequest(state, defaultRuleset);
  expect(request.playerId).toBe(getPublicView(state).round!.currentPlayerId);
  expect(request.view).toEqual(getPlayerView(state, request.playerId));
  expect(request.legalMoves).toEqual(getLegalMoves(state, request.playerId, defaultRuleset));
  expect(request.legalMoves.length).toBeGreaterThan(0);
  expect(request.legalMoves.every((move) => move.playerId === request.playerId)).toBe(true);
  expect(Object.keys(request).sort()).toEqual(['legalMoves', 'playerId', 'requestId', 'view']);
  for (const player of request.view.round!.players) {
    expect(Object.keys(player).sort()).toEqual(['cardCount', 'finished', 'playerId']);
  }
  const permitted = new Set([...request.view.hand, ...request.view.round!.playedCards].map((card) => `${card.rank}-${card.suit}`));
  for (const entry of objects(request)) {
    if ('rank' in entry && 'suit' in entry) expect(permitted.has(`${entry.rank}-${entry.suit}`)).toBe(true);
  }
  const internals = new Set(objects(state));
  expect(objects(request).some((entry) => internals.has(entry))).toBe(false);
  expect(JSON.stringify(state)).toBe(before);
  return request;
}

describe('safe controller request construction', () => {
  it('uses the Engine acting player and complete legal set for opening, response, and free lead', () => {
    let state = fixture();
    const opening = verifyRequest(state);
    expect(opening.view.round!.trick!.kind).toBe('opening');
    expect(opening.legalMoves.every((move) => move.kind === 'play')).toBe(true);
    const single = opening.legalMoves.find((move) => move.kind === 'play' && move.cards.length === 1)!;
    const played = submitMove(state, single, defaultRuleset);
    expect(played.accepted).toBe(true);
    state = played.state;
    for (let pass = 0; pass < 3; pass += 1) {
      const response = verifyRequest(state);
      expect(response.playerId).not.toBe(opening.playerId);
      expect(response.view.round!.trick!.kind).toBe('response');
      const move = response.legalMoves.find((candidate) => candidate.kind === 'pass');
      expect(move).toBeDefined();
      const result = submitMove(state, move!, defaultRuleset);
      expect(result.accepted).toBe(true);
      state = result.state;
    }
    const lead = verifyRequest(state);
    expect(lead.playerId).toBe(opening.playerId);
    expect(lead.view.round!.trick!.kind).toBe('freeLead');
    expect(lead.legalMoves.every((move) => move.kind === 'play')).toBe(true);
  });

  it('assigns fresh identities across repeated requests and independent Sessions', () => {
    const state = fixture();
    const first = createPlayerTurnRequest(state, defaultRuleset);
    const second = createPlayerTurnRequest(state, defaultRuleset);
    const third = createPlayerTurnRequest(fixture(), defaultRuleset);
    expect(new Set([first.requestId, second.requestId, third.requestId]).size).toBe(3);
    expect(first.requestId.length).toBeGreaterThan(0);
    expect(second.view).toEqual(first.view);
    expect(second.legalMoves).toEqual(first.legalMoves);
  });

  it('isolates controller mutations and filters private metadata from every nested object', () => {
    const state = fixture();
    const clean = verifyRequest(state);
    for (const entry of objects(state)) Reflect.set(entry, 'privateProbe', { rngState: 123, hiddenHand: 'secret' });
    const before = JSON.stringify(state);
    const request = verifyRequest(state);
    expect(request.view).toEqual(clean.view);
    expect(request.legalMoves).toEqual(clean.legalMoves);
    expect(JSON.stringify(request)).not.toContain('privateProbe');
    for (const entry of objects(request)) {
      for (const key of Object.keys(entry)) Reflect.set(entry, key, null);
    }
    expect(JSON.stringify(state)).toBe(before);
    const next = verifyRequest(state);
    expect(next.view).toEqual(clean.view);
    expect(next.legalMoves).toEqual(clean.legalMoves);
  });

  it('does not expose opponent ownership when hidden hands are exchanged', () => {
    const state = fixture();
    if (state.round?.kind !== 'inProgress') throw new Error('Expected active Round');
    const request = verifyRequest(state);
    const opponents = state.round.context.players.filter((player) => player.playerId !== request.playerId);
    const swapped = { ...state, round: { ...state.round, context: { ...state.round.context,
      players: state.round.context.players.map((player) => player.playerId === request.playerId ? player : {
        ...player, hand: [...opponents[(opponents.indexOf(player) + 1) % opponents.length]!.hand].reverse(),
      }),
    } } };
    const next = verifyRequest(swapped);
    expect(next.view).toEqual(request.view);
    expect(next.legalMoves).toEqual(request.legalMoves);
  });

  it('rejects requests before dealing, at each Round checkpoint, and after Session completion', () => {
    let state = createSession(ids).state;
    const rejectRequest = () => {
      const before = JSON.stringify(state);
      expect(() => createPlayerTurnRequest(state, defaultRuleset)).toThrow('active Turn');
      expect(JSON.stringify(state)).toBe(before);
    };
    rejectRequest();
    for (let round = 1; round <= 5; round += 1) {
      state = startRound(state, { next: () => 0 }).state;
      let turns = 0;
      while (getPublicView(state).round!.status === 'inProgress' && turns++ < 400) {
        const request = createPlayerTurnRequest(state, defaultRuleset);
        const move = request.legalMoves.find((candidate) => candidate.kind === 'play' && candidate.cards.length === 1)
          ?? request.legalMoves[0]!;
        const result = submitMove(state, move, defaultRuleset);
        expect(result.accepted).toBe(true);
        state = result.state;
      }
      expect(turns).toBeLessThan(400);
      expect(state.completedRounds).toHaveLength(round);
      rejectRequest();
    }
    expect(state.kind).toBe('completed');
  });

  it('fails diagnostically when an invalid active state supplies no Engine-authorized actions', () => {
    const state = fixture();
    if (state.round?.kind !== 'inProgress') throw new Error('Expected active Round');
    const invalid = { ...state, round: { ...state.round, context: { ...state.round.context, roundActive: false } } };
    const before = JSON.stringify(invalid);
    expect(() => createPlayerTurnRequest(invalid, defaultRuleset)).toThrow(`Engine legal Moves for player ${state.round.context.currentPlayerId}`);
    expect(JSON.stringify(invalid)).toBe(before);
  });
});

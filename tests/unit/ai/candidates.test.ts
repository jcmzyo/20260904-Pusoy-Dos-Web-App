import { describe, expect, it } from 'vitest';
import type { Move } from '../../../src/domain';
import { buildCandidates } from '../../../src/ai';
import { createDeck, createSession, defaultRuleset, startRound, submitMove } from '../../../src/engine';
import { createPlayerTurnRequest } from '../../../src/orchestrator';

const fixture = () => startRound(createSession(['south', 'west', 'north', 'east']).state, { next: () => 0 }).state;
const identity = (move: Move) => move.kind === 'pass' ? 'pass' :
  move.cards.map((card) => `${card.rank}-${card.suit}`).sort().join(',');

describe('deterministic candidate construction', () => {
  it('preserves the complete authorized set across opening, response, and free lead', () => {
    let state = fixture();
    for (let turn = 0; turn <= 4; turn += 1) {
      const request = createPlayerTurnRequest(state, defaultRuleset);
      const before = JSON.stringify(request);
      const candidates = buildCandidates(request);
      expect(candidates.map(({ move }) => identity(move)).sort()).toEqual(request.legalMoves.map(identity).sort());
      expect(candidates.every(({ move }) => move.playerId === request.playerId)).toBe(true);
      expect(request.view.round!.trick!.kind).toBe(turn === 0 ? 'opening' : turn === 4 ? 'freeLead' : 'response');
      expect(candidates.filter(({ move }) => move.kind === 'pass')).toHaveLength(turn > 0 && turn < 4 ? 1 : 0);
      if (turn === 1) expect(candidates.some(({ move }) => move.kind === 'play')).toBe(true);
      if (turn === 4) {
        const singles = candidates.flatMap(({ move }) => move.kind === 'play' && move.cards.length === 1 ? move.cards : []);
        expect(singles).toEqual(createDeck().filter((card) => request.view.hand.some((held) => held.rank === card.rank && held.suit === card.suit)));
        const sizes = candidates.map(({ move }) => move.kind === 'play' ? move.cards.length : 0);
        expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
      }
      for (const { move } of candidates) expect(submitMove(state, move, defaultRuleset).accepted).toBe(true);
      expect(JSON.stringify(request)).toBe(before);
      const move = request.legalMoves.find((move) => turn === 0 ? move.kind === 'play' && move.cards.length === 1 : move.kind === 'pass');
      if (turn < 4) state = submitMove(state, move!, defaultRuleset).state;
    }
  });

  it('orders semantic card identities identically under seeded move, card, and hand permutations', () => {
    const request = createPlayerTurnRequest(fixture(), defaultRuleset);
    const expected = buildCandidates(request);
    expect(expected.length).toBeGreaterThan(10);
    let seed = 20260913;
    function shuffle<T>(items: readonly T[]): T[] {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i -= 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const j = seed % (i + 1);
        [result[i], result[j]] = [result[j]!, result[i]!];
      }
      return result;
    }
    for (let repeat = 0; repeat < 20; repeat += 1) {
      const legalMoves = shuffle(request.legalMoves).map((move): Move => move.kind === 'pass' ? move : { ...move, cards: shuffle(move.cards) });
      expect(buildCandidates({ ...request, requestId: `different-${repeat}`, legalMoves,
        view: { ...request.view, hand: shuffle(request.view.hand) } })).toEqual(expected);
    }
    expect(expected[0]!.move).toEqual({ kind: 'play', playerId: request.playerId, cards: [{ rank: '3', suit: 'clubs' }] });
    expect(expected.every(({ immediateFinish }) => !immediateFinish)).toBe(true);
  });

  it('identifies exact finishing Plays and PASS-only responses through a real Round', () => {
    let state = fixture();
    let finishes = 0;
    let passOnly = 0;
    let turns = 0;
    while (state.round?.kind === 'inProgress' && turns++ < 400) {
      const request = createPlayerTurnRequest(state, defaultRuleset);
      const candidates = buildCandidates(request);
      if (candidates.length === 1 && candidates[0]!.move.kind === 'pass') passOnly += 1;
      for (const candidate of candidates) {
        const result = submitMove(state, candidate.move, defaultRuleset);
        expect(result.accepted).toBe(true);
        const remaining = result.state.round?.kind === 'inProgress'
          ? result.state.round.context.players.find((player) => player.playerId === request.playerId)!.hand.length
          : 0;
        expect(candidate.immediateFinish).toBe(candidate.move.kind === 'play' && remaining === 0);
      }
      const chosen = candidates.find((candidate) => candidate.immediateFinish) ??
        candidates.filter(({ move }) => move.kind === 'play' && move.cards.length === 1).at(-1) ?? candidates[0]!;
      if (chosen.immediateFinish) finishes += 1;
      state = submitMove(state, chosen.move, defaultRuleset).state;
    }
    expect(turns).toBeLessThan(400);
    expect(finishes).toBe(3);
    expect(passOnly).toBeGreaterThan(0);
  });

  it('fails diagnostically for contradictory request context instead of inventing or dropping actions', () => {
    const request = createPlayerTurnRequest(fixture(), defaultRuleset);
    expect(() => buildCandidates({ ...request, legalMoves: [] })).toThrow('Engine-authorized');
    expect(() => buildCandidates({ ...request, playerId: 'other' })).toThrow('active Turn');
    expect(() => buildCandidates({ ...request, legalMoves: [{ kind: 'pass', playerId: request.playerId }, ...request.legalMoves] })).toThrow('PASS availability');
    const state = submitMove(fixture(), request.legalMoves[0]!, defaultRuleset).state;
    const response = createPlayerTurnRequest(state, defaultRuleset);
    expect(() => buildCandidates({ ...response, legalMoves: response.legalMoves.filter((move) => move.kind === 'play') })).toThrow();
    expect(() => buildCandidates({ ...request, legalMoves: [{ ...request.legalMoves[0]!, playerId: 'other' }] })).toThrow('Engine-authorized');
  });
});

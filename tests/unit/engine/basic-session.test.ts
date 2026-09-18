import { describe, expect, it } from 'vitest';
import type { Card, Move } from '../../../src/domain';
import { defaultRuleset, generateLegalFreeLeadMoves, generateLegalOpeningMoves, generateLegalResponseMoves } from '../../../src/engine';
import * as engine from '../../../src/engine';
import type { BasicRoundResult } from '../../../src/engine/rounds/resolveBasicRound';
import { resolveBasicSessionResult } from '../../../src/engine/sessions/basicSessionResult';
import { createBasicSession, resolveBasicSession, startBasicRound } from '../../../src/engine/sessions/resolveBasicSession';

const ids = ['south', 'west', 'north', 'east'];
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function history(orders: number[][]): BasicRoundResult[] {
  return orders.map((order) => ({ placements: order.map((player, index) => ({
    playerId: ids[player]!, placement: ([1, 2, 3, 4] as const)[index]!, points: ([5, 3, 2, 0] as const)[index]!,
  })) }));
}

describe('Basic Session tiebreaks', () => {
  it.each([
    { orders: [[2, 1, 0, 3], [1, 2, 3, 0], [2, 3, 0, 1], [1, 3, 0, 2], [2, 1, 0, 3]], winner: 'north', criterion: 'totalScore' },
    { orders: [[1, 3, 2, 0], [2, 3, 0, 1], [3, 0, 1, 2], [0, 1, 2, 3], [2, 3, 1, 0]], winner: 'north', criterion: 'roundWins' },
    { orders: [[0, 3, 2, 1], [1, 0, 3, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 1, 0, 3]], winner: 'west', criterion: 'averagePlacement' },
  ])('resolves by $criterion using official five-Round results', ({ orders, winner, criterion }) => {
    const rounds = freeze(history(orders));
    const result = resolveBasicSessionResult(ids, rounds);
    expect(result.winnerIds).toEqual([winner]);
    expect(result.decidedBy).toBe(criterion);
    for (const standing of result.standings) {
      const placements = orders.map((order) => order.indexOf(ids.indexOf(standing.playerId)) + 1);
      expect(standing).toEqual({
        playerId: standing.playerId,
        totalScore: placements.reduce((sum, place) => sum + [5, 3, 2, 0][place - 1]!, 0),
        roundWins: placements.filter((place) => place === 1).length,
        averagePlacement: placements.reduce((sum, place) => sum + place, 0) / 5,
        highestRoundScore: Math.max(...placements.map((place) => [5, 3, 2, 0][place - 1]!)),
      });
    }
    expect(resolveBasicSessionResult([...ids].reverse(), rounds).winnerIds).toEqual([winner]);
  });

  it('preserves a genuine tie through highest Round score without a seating tiebreak', () => {
    const rounds = history([[0, 1, 2, 3], [2, 3, 1, 0], [0, 3, 2, 1], [1, 3, 0, 2], [2, 1, 0, 3]]);
    const result = resolveBasicSessionResult(ids, rounds);
    expect(result.decidedBy).toBe('genuineTie');
    expect(result.winnerIds).toEqual(['south', 'north']);
    for (const playerId of result.winnerIds) {
      expect(result.standings.find((entry) => entry.playerId === playerId)).toEqual({ playerId, totalScore: 14, roundWins: 2, averagePlacement: 2.4, highestRoundScore: 5 });
    }
    expect(resolveBasicSessionResult([...ids].reverse(), rounds).winnerIds).toEqual(['north', 'south']);
  });

  describe('official 1st-4th ranking (M4-T13; ui-ux.md §13)', () => {
    it('places every standing 1st-4th with no ties, matching the single-winner tiebreak result', () => {
      // Same fixture as the parameterized "resolves by totalScore" case above.
      const rounds = history([[2, 1, 0, 3], [1, 2, 3, 0], [2, 3, 0, 1], [1, 3, 0, 2], [2, 1, 0, 3]]);
      const result = resolveBasicSessionResult(ids, rounds);
      expect(result.winnerIds).toEqual(['north']);
      expect(result.placements).toEqual([
        { playerId: 'north', placement: 1 }, { playerId: 'west', placement: 2 },
        { playerId: 'east', placement: 3 }, { playerId: 'south', placement: 4 },
      ]);
    });

    it('gives every player tied for the Session win the same placement 1 (standard competition ranking, not a seating tiebreak)', () => {
      const rounds = history([[0, 1, 2, 3], [2, 3, 1, 0], [0, 3, 2, 1], [1, 3, 0, 2], [2, 1, 0, 3]]);
      const result = resolveBasicSessionResult(ids, rounds);
      expect(result.winnerIds).toEqual(['south', 'north']);
      // west/east are not tied with each other (13 vs 9), so they resume normal placements after the
      // two co-1st players - the next distinct placement is 3, not 2 (standard competition ranking).
      expect(result.placements).toEqual([
        { playerId: 'south', placement: 1 }, { playerId: 'north', placement: 1 },
        { playerId: 'west', placement: 3 }, { playerId: 'east', placement: 4 },
      ]);
    });

    it('also applies standard competition ranking to a tie that is NOT for the Session win, skipping the placement it consumes', () => {
      // west wins outright; north and east tie exactly on every criterion (totalScore 13, roundWins 1,
      // averagePlacement 2.4, highestRoundScore 5) for 2nd; south is clearly 4th - the placement after
      // the two-way tie for 2nd is 4, not 3, since two players already occupy placement 2.
      const rounds = history([[1, 2, 0, 3], [3, 2, 0, 1], [0, 1, 3, 2], [2, 3, 1, 0], [1, 3, 2, 0]]);
      const result = resolveBasicSessionResult(ids, rounds);
      expect(result.winnerIds).toEqual(['west']);
      expect(result.decidedBy).toBe('totalScore');
      expect(result.placements).toEqual([
        { playerId: 'west', placement: 1 }, { playerId: 'north', placement: 2 },
        { playerId: 'east', placement: 2 }, { playerId: 'south', placement: 4 },
      ]);
    });
  });

  it('checks all possible five-Round placement profiles: earlier ties imply equal best scores', () => {
    const bestByEarlierCriteria = new Map<string, number>();
    for (let encoded = 0; encoded < 4 ** 5; encoded += 1) {
      const placements = Array.from({ length: 5 }, (_, index) => Math.floor(encoded / 4 ** index) % 4 + 1);
      const scores = placements.map((place) => [5, 3, 2, 0][place - 1]!);
      const key = [scores.reduce((a, b) => a + b, 0), placements.filter((place) => place === 1).length, placements.reduce((a, b) => a + b, 0)].join(',');
      const best = Math.max(...scores);
      if (bestByEarlierCriteria.has(key)) expect(best).toBe(bestByEarlierCriteria.get(key));
      bestByEarlierCriteria.set(key, best);
    }
  });

  it.each([0, 1, 4, 6])('rejects a final result with %i completed Rounds', (count) => {
    expect(() => resolveBasicSessionResult(ids, history(Array.from({ length: count }, () => [0, 1, 2, 3])))).toThrow('exactly five');
  });
});

describe('Basic Session lifecycle', () => {
  it('requires four distinct players and copies participant input', () => {
    expect(() => createBasicSession(ids.slice(1))).toThrow('four distinct');
    expect(() => createBasicSession(['a', 'a', 'b', 'c'])).toThrow('four distinct');
    const players = [...ids];
    const state = createBasicSession(players);
    players.reverse();
    expect(state.playerIds).toEqual(ids);
    expect(state.standings.map((entry) => entry.totalScore)).toEqual([0, 0, 0, 0]);
    expect(state.roundNumber).toBe(0);
    const rejected = resolveBasicSession(freeze(state), { kind: 'pass', playerId: 'south' }, defaultRuleset);
    expect(rejected).toEqual({ accepted: false, state, error: { code: 'ROUND_NOT_ACTIVE' } });
    expect(rejected.state).toBe(state);
    expect(engine).not.toHaveProperty('resolveBasicSession');
  });

  it('completes exactly five fully dealt Rounds, atomically accumulating each result once', () => {
    function run() {
      let seed = 24;
      let calls = 0;
      const rng = { next: () => { calls += 1; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
      let state = createBasicSession(ids);
      for (let roundNumber = 1; roundNumber <= 5; roundNumber += 1) {
        freeze(state);
        state = startBasicRound(state, rng);
        expect(state.roundNumber).toBe(roundNumber);
        expect(calls).toBe(roundNumber * 51);
        expect(state.round?.kind).toBe('inProgress');
        if (state.round?.kind !== 'inProgress') throw new Error('Expected active Round');
        expect(state.round.context.players.map((player) => player.hand.length)).toEqual([13, 13, 13, 13]);
        expect(state.round.finishOrder).toEqual([]);
        expect(state.round.responseCycle).toBeNull();
        expect(state.round.context.trick).toEqual({ kind: 'opening' });
        const openingContext = state.round.context;
        expect(openingContext.players.find((player) => player.playerId === openingContext.currentPlayerId)!.hand).toContainEqual({ rank: '3', suit: 'clubs' });
        expect(() => startBasicRound(state, rng)).toThrow('in progress');
        expect(calls).toBe(roundNumber * 51);
        const invalid = resolveBasicSession(freeze(state), { kind: 'pass', playerId: state.round.context.currentPlayerId }, defaultRuleset);
        expect(invalid.accepted).toBe(false);
        expect(invalid.state).toBe(state);
        const played: Card[] = [];
        let turns = 0;
        while (state.round?.kind === 'inProgress' && turns < 400) {
          const { context } = state.round;
          const hand = context.players.find((player) => player.playerId === context.currentPlayerId)!.hand;
          const moves = context.trick.kind === 'response'
            ? generateLegalResponseMoves(hand, context.currentPlayerId, context.trick.current, defaultRuleset)
            : context.trick.kind === 'opening'
              ? generateLegalOpeningMoves(hand, context.currentPlayerId, defaultRuleset)
              : generateLegalFreeLeadMoves(hand, context.currentPlayerId, defaultRuleset);
          const move: Move = moves.find((candidate) => candidate.kind === 'play' && candidate.cards.length === 1) ?? moves[0]!;
          const previous = freeze(state);
          const transition = resolveBasicSession(previous, move, defaultRuleset);
          expect(transition.accepted).toBe(true);
          state = transition.state;
          if (move.kind === 'play') played.push(...move.cards);
          const players = state.round!.kind === 'inProgress' ? state.round!.context.players : state.round!.players;
          const cards = [...played, ...players.flatMap((player) => player.hand)];
          expect(cards).toHaveLength(52);
          expect(new Set(cards.map((card) => `${card.rank}-${card.suit}`)).size).toBe(52);
          if (state.round?.kind === 'inProgress') {
            expect(state.completedRounds).toBe(previous.completedRounds);
            expect(state.standings).toBe(previous.standings);
          }
          turns += 1;
        }
        expect(state.round?.kind).toBe('completed');
        expect(state.completedRounds).toHaveLength(roundNumber);
        expect(state.kind).toBe(roundNumber === 5 ? 'completed' : 'inProgress');
        expect(state.result === null).toBe(roundNumber !== 5);
        for (const standing of state.standings) {
          expect(standing.totalScore).toBe(state.completedRounds.reduce((sum, round) => sum + round.placements.find((entry) => entry.playerId === standing.playerId)!.points, 0));
        }
        expect(state.standings.reduce((sum, standing) => sum + standing.totalScore, 0)).toBe(roundNumber * 10);
        const rejected = resolveBasicSession(freeze(state), { kind: 'pass', playerId: 'south' }, defaultRuleset);
        expect(rejected).toEqual({ accepted: false, state, error: { code: roundNumber === 5 ? 'SESSION_NOT_ACTIVE' : 'ROUND_NOT_ACTIVE' } });
        expect(rejected.state).toBe(state);
      }
      expect(() => startBasicRound(state, rng)).toThrow('Session completion');
      expect(calls).toBe(255);
      expect(state.result).toEqual(resolveBasicSessionResult(ids, state.completedRounds));
      return state;
    }
    expect(run()).toEqual(run());
  });
});

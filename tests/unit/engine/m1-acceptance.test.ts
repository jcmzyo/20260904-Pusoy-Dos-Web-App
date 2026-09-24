import { describe, expect, it } from 'vitest';
import type { Card, Move } from '../../../src/domain';
import { assertEngineInvariants, assertMoveInvariants, createDeck, createSession, defaultRuleset, generateLegalFreeLeadMoves, generateLegalOpeningMoves, generateLegalResponseMoves, getLegalMoves, getPlayerView, getPublicView, startRound, submitMove } from '../../../src/engine';
import type { GameEvent } from '../../../src/engine';

const ids = ['south', 'west', 'north', 'east'];
const rules = defaultRuleset;
const identity = (card: Card) => `${card.rank}-${card.suit}`;
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

describe('M1 public Engine acceptance', () => {
  it('owns eligibility and complete opening, response and free-lead selection without mutating state', () => {
    const initial = freeze(createSession(ids).state);
    for (const playerId of [...ids, 'unknown']) expect(getLegalMoves(initial, playerId, rules)).toEqual([]);
    let state = freeze(startRound(initial, { next: () => 0 }).state);
    const leader = getPublicView(state).round!.currentPlayerId!;
    const opening = getPlayerView(state, leader);
    const moves = getLegalMoves(state, leader, rules);
    expect(moves).toEqual(generateLegalOpeningMoves(opening.hand, leader, rules));
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      expect(move.kind === 'play' && move.cards.some((card) => identity(card) === '3-clubs')).toBe(true);
      expect(submitMove(state, move, rules).accepted).toBe(true);
    }
    for (const playerId of [...ids.filter((id) => id !== leader), 'unknown']) {
      expect(getLegalMoves(state, playerId, rules)).toEqual([]);
    }
    const single = moves.find((move) => move.kind === 'play' && move.cards.length === 1)!;
    state = freeze(submitMove(state, single, rules).state);
    const responder = getPublicView(state).round!.currentPlayerId!;
    const responseView = getPlayerView(state, responder);
    const trick = responseView.round!.trick!;
    if (trick.kind !== 'response') throw new Error('Expected a response.');
    const responses = getLegalMoves(state, responder, rules);
    expect(responses).toEqual(generateLegalResponseMoves(responseView.hand, responder, trick.current, rules));
    expect(responses.some((move) => move.kind === 'pass')).toBe(true);
    expect(responses.some((move) => move.kind === 'play')).toBe(true);
    for (const move of responses) expect(submitMove(state, move, rules).accepted).toBe(true);
    for (let index = 0; index < 3; index += 1) {
      const playerId = getPublicView(state).round!.currentPlayerId!;
      state = freeze(submitMove(state, { kind: 'pass', playerId }, rules).state);
    }
    expect(getPublicView(state).round!.currentPlayerId).toBe(leader);
    expect(getPublicView(state).round!.trick).toEqual({ kind: 'freeLead' });
    const free = getLegalMoves(state, leader, rules);
    expect(free).toEqual(generateLegalFreeLeadMoves(getPlayerView(state, leader).hand, leader, rules));
    expect(free.some((move) => move.kind === 'pass')).toBe(false);
    for (const move of free) expect(submitMove(state, move, rules).accepted).toBe(true);
    const before = JSON.stringify(state);
    for (const move of free) if (move.kind === 'play') {
      Reflect.set(move.cards[0]!, 'rank', '2');
    }
    expect(JSON.stringify(state)).toBe(before);
    expect(getLegalMoves(state, leader, rules)).toEqual(generateLegalFreeLeadMoves(getPlayerView(state, leader).hand, leader, rules));
  });

  it.each([28, 2801, 2802])('replays five Rounds through public APIs with mixed-size Plays and voluntary Passes (seed %s)', (initialSeed) => {
    function run() {
      let seed = initialSeed;
      let calls = 0;
      const rng = { next: () => { calls += 1; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
      const created = createSession(ids);
      let state = freeze(created.state);
      const events: GameEvent[] = [...created.events];
      const sizes = new Set<number>();
      let voluntaryPasses = 0;
      for (let roundNumber = 1; roundNumber <= 5; roundNumber += 1) {
        const started = startRound(state, rng);
        state = freeze(started.state);
        events.push(...started.events);
        expect(calls).toBe(roundNumber * 51);
        expect(getPublicView(state).round!.players.map((player) => player.cardCount)).toEqual([13, 13, 13, 13]);
        const played = new Set<string>();
        let turns = 0;
        while (getPublicView(state).round!.status === 'inProgress' && turns < 500) {
          assertEngineInvariants(state, rules);
          const publicView = getPublicView(state);
          const playerId = publicView.round!.currentPlayerId!;
          const view = getPlayerView(state, playerId);
          const moves = getLegalMoves(state, playerId, rules);
          expect(moves.length).toBeGreaterThan(0);
          for (const other of ids.filter((id) => id !== playerId)) expect(getLegalMoves(state, other, rules)).toEqual([]);
          const plays = moves.filter((move) => move.kind === 'play');
          const pass = moves.find((move) => move.kind === 'pass');
          const largest = [...plays].sort((a, b) => b.cards.length - a.cards.length)[0];
          const move: Move = turns % 7 === 1 && pass ? pass : largest ?? moves[0]!;
          if (move.kind === 'pass' && plays.length > 0) voluntaryPasses += 1;
          if (move.kind === 'play') {
            sizes.add(move.cards.length);
            for (const card of move.cards) {
              expect(view.hand).toContainEqual(card);
              expect(played.has(identity(card))).toBe(false);
              played.add(identity(card));
            }
          }
          const wrongTurn: Move = { ...move, playerId: ids.find((id) => id !== playerId)! };
          const rejected = submitMove(state, wrongTurn, rules);
          expect(rejected.accepted).toBe(false);
          expect(rejected.state).toBe(state);
          expect(rejected.events).toEqual([]);
          assertMoveInvariants(state, wrongTurn, rejected, rules);
          const result = submitMove(state, move, rules);
          expect(result.accepted).toBe(true);
          assertMoveInvariants(state, move, result, rules);
          events.push(...result.events);
          state = freeze(result.state);
          const after = getPublicView(state);
          expect(new Set(after.round!.playedCards.map(identity))).toEqual(played);
          const held = ids.flatMap((id) => getPlayerView(state, id).hand.map(identity));
          expect([...held, ...played].sort()).toEqual(createDeck().map(identity).sort());
          expect(after.round!.players.reduce((sum, player) => sum + player.cardCount, 0) + played.size).toBe(52);
          turns += 1;
        }
        const checkpoint = getPublicView(state);
        expect(checkpoint.round!.status).toBe('completed');
        expect(checkpoint.completedRounds).toHaveLength(roundNumber);
        expect(checkpoint.completedRounds.at(-1)!.placements.map((entry) => entry.points)).toEqual([5, 3, 2, 0]);
        expect(checkpoint.round!.finishOrder).toHaveLength(3);
        for (const playerId of [...ids, 'unknown']) expect(getLegalMoves(state, playerId, rules)).toEqual([]);
        for (const standing of checkpoint.standings) {
          expect(standing.totalScore).toBe(checkpoint.completedRounds.reduce((sum, round) => sum + round.placements.find((entry) => entry.playerId === standing.playerId)!.points, 0));
        }
        const rejected = submitMove(state, { kind: 'pass', playerId: ids[0]! }, rules);
        expect(rejected).toEqual({ accepted: false, state, events: [], error: { code: roundNumber === 5 ? 'SESSION_NOT_ACTIVE' : 'ROUND_NOT_ACTIVE' } });
      }
      assertEngineInvariants(state, rules);
      expect(getPublicView(state).status).toBe('completed');
      expect(getPublicView(state).result).not.toBeNull();
      expect(() => startRound(state, rng)).toThrow('completion');
      expect(calls).toBe(255);
      expect(sizes.has(5)).toBe(true);
      expect(sizes.size).toBeGreaterThan(1);
      expect(voluntaryPasses).toBeGreaterThan(0);
      for (const type of ['ROUND_STARTED', 'CARDS_DEALT', 'ROUND_ENDED', 'SCORE_CALCULATED']) {
        expect(events.filter((event) => event.type === type)).toHaveLength(5);
      }
      expect(events.filter((event) => event.type === 'PLAYER_FINISHED')).toHaveLength(15);
      expect(events.filter((event) => event.type === 'SESSION_ENDED')).toHaveLength(1);
      expect(events.at(-1)).toEqual({ type: 'SESSION_ENDED', roundNumber: 5, result: getPublicView(state).result });
      return { view: getPublicView(state), events };
    }
    expect(run()).toEqual(run());
  });
});

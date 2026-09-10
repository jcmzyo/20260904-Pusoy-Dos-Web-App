import { describe, expect, it } from 'vitest';
import type { Card, Rank } from '../../../src/domain';
import { createSession, startRound, submitMove, defaultRuleset, generateLegalFreeLeadMoves, generateLegalOpeningMoves, generateLegalResponseMoves } from '../../../src/engine';
import type { GameEvent } from '../../../src/engine';
import type { BasicSessionState } from '../../../src/engine/sessions/resolveBasicSession';

const ids = ['south', 'west', 'north', 'east'];
const card = (rank: Rank): Card => ({ rank, suit: 'clubs' });
const types = (events: readonly GameEvent[]) => events.map((event) => event.type);
function fixture(hands: Card[][]): BasicSessionState {
  return { ...createSession(ids).state, roundNumber: 1, round: {
    kind: 'inProgress', finishOrder: [], responseCycle: null,
    context: { sessionActive: true, roundActive: true, currentPlayerId: 'south', trick: { kind: 'freeLead' },
      players: ids.map((playerId, index) => ({ playerId, hand: hands[index]!, active: true })),
    },
  } };
}

describe('factual Engine events', () => {
  it('reports public setup facts and rejects intent without events or mutation', () => {
    const created = createSession(ids);
    expect(created.events).toEqual([{ type: 'SESSION_STARTED', mode: 'basic', playerIds: ids }]);
    const unstarted = submitMove(created.state, { kind: 'pass', playerId: 'south' }, defaultRuleset);
    expect(unstarted).toEqual({ accepted: false, state: created.state, events: [], error: { code: 'ROUND_NOT_ACTIVE' } });
    const started = startRound(created.state, { next: () => 0 });
    const round = started.state.round;
    if (round?.kind !== 'inProgress') throw new Error('Expected active Round');
    expect(started.events).toEqual([
      { type: 'ROUND_STARTED', roundNumber: 1 },
      { type: 'CARDS_DEALT', roundNumber: 1, players: ids.map((playerId) => ({ playerId, cardCount: 13 })) },
      { type: 'TURN_CHANGED', roundNumber: 1, playerId: round.context.currentPlayerId },
    ]);
    const snapshot = JSON.stringify(started.state);
    for (const move of [
      { kind: 'pass', playerId: round.context.currentPlayerId },
      { kind: 'play', playerId: 'unknown', cards: [card('3')] },
    ] as const) {
      const rejected = submitMove(started.state, move, defaultRuleset);
      expect(rejected.accepted).toBe(false);
      expect(rejected.events).toEqual([]);
      expect(rejected.state).toBe(started.state);
    }
    expect(JSON.stringify(started.state)).toBe(snapshot);
    expect(() => startRound(started.state, { next: () => 0 })).toThrow('in progress');
  });

  it('orders ordinary Play, voluntary Passes and active-leader Trick reset', () => {
    const previous = fixture([[card('3'), card('8')], [card('4')], [card('5')], [card('6')]]);
    const cards = [card('3')];
    const played = submitMove(previous, { kind: 'play', playerId: 'south', cards }, defaultRuleset);
    expect(played.events).toEqual([
      { type: 'CARDS_PLAYED', roundNumber: 1, playerId: 'south', combination: { type: 'single', cards: [card('3')] } },
      { type: 'TURN_CHANGED', roundNumber: 1, playerId: 'west' },
    ]);
    cards[0] = card('2');
    expect(played.events[0]).toMatchObject({ combination: { cards: [card('3')] } });
    let state = played.state;
    for (const playerId of ['west', 'north', 'east']) {
      const result = submitMove(state, { kind: 'pass', playerId }, defaultRuleset);
      expect(types(result.events)).toEqual(playerId === 'east'
        ? ['PLAYER_PASSED', 'TRICK_ENDED', 'TURN_CHANGED'] : ['PLAYER_PASSED', 'TURN_CHANGED']);
      expect(result.events[0]).toEqual({ type: 'PLAYER_PASSED', roundNumber: 1, playerId });
      if (playerId === 'east') expect(result.events.slice(1)).toEqual([
        { type: 'TRICK_ENDED', roundNumber: 1, lastSuccessfulPlayerId: 'south' },
        { type: 'TURN_CHANGED', roundNumber: 1, playerId: 'south' },
      ]);
      state = result.state;
    }
  });

  it.each([false, true])('reports a finished leader and immediate reset=%s without inventing Passes', (unbeatable) => {
    const result = submitMove(fixture([[card('8')], [card('3')], [card(unbeatable ? '4' : '9')], [card('5')]]),
      { kind: 'play', playerId: 'south', cards: [card('8')] }, defaultRuleset);
    expect(types(result.events)).toEqual(unbeatable
      ? ['CARDS_PLAYED', 'PLAYER_FINISHED', 'TRICK_ENDED', 'TURN_CHANGED']
      : ['CARDS_PLAYED', 'PLAYER_FINISHED', 'TURN_CHANGED']);
    expect(result.events[1]).toEqual({ type: 'PLAYER_FINISHED', roundNumber: 1, playerId: 'south', placement: 1 });
    expect(result.events.at(-1)).toEqual({ type: 'TURN_CHANGED', roundNumber: 1, playerId: unbeatable ? 'west' : 'north' });
    if (!unbeatable) {
      let state = result.state;
      for (const playerId of ['north', 'east', 'west']) {
        const passed = submitMove(state, { kind: 'pass', playerId }, defaultRuleset);
        expect(types(passed.events)).toEqual(playerId === 'west'
          ? ['PLAYER_PASSED', 'TRICK_ENDED', 'TURN_CHANGED'] : ['PLAYER_PASSED', 'TURN_CHANGED']);
        if (playerId === 'west') expect(passed.events.at(-1)).toEqual({ type: 'TURN_CHANGED', roundNumber: 1, playerId: 'west' });
        state = passed.state;
      }
    }
  });

  it('reproduces all five Rounds with accurate completion payloads and no hidden cards', () => {
    function run() {
      let seed = 25;
      const rng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
      const created = createSession(ids);
      let state = created.state;
      const history = [...created.events];
      for (let roundNumber = 1; roundNumber <= 5; roundNumber += 1) {
        const started = startRound(state, rng);
        state = started.state;
        history.push(...started.events);
        let turns = 0;
        while (state.round?.kind === 'inProgress' && turns++ < 400) {
          const { context } = state.round;
          const hand = context.players.find((player) => player.playerId === context.currentPlayerId)!.hand;
          const moves = context.trick.kind === 'response'
            ? generateLegalResponseMoves(hand, context.currentPlayerId, context.trick.current, defaultRuleset)
            : context.trick.kind === 'opening'
              ? generateLegalOpeningMoves(hand, context.currentPlayerId, defaultRuleset)
              : generateLegalFreeLeadMoves(hand, context.currentPlayerId, defaultRuleset);
          const move = moves.find((entry) => entry.kind === 'play' && entry.cards.length === 1) ?? moves[0]!;
          const result = submitMove(state, move, defaultRuleset);
          expect(result.accepted).toBe(true);
          expect(submitMove(state, move, defaultRuleset)).toEqual(result);
          state = result.state;
          history.push(...result.events);
          for (const event of result.events) {
            if ('roundNumber' in event) expect(event.roundNumber).toBe(roundNumber);
            if (event.type === 'CARDS_PLAYED') {
              expect(move.kind === 'play' && event.combination.cards).toEqual(move.kind === 'play' && move.cards);
              expect(event.combination.type).toBe('single');
            }
          }
          if (state.round?.kind === 'completed') {
            expect(types(result.events)).toEqual(['CARDS_PLAYED', 'PLAYER_FINISHED', 'TRICK_ENDED', 'ROUND_ENDED', 'SCORE_CALCULATED', ...(roundNumber === 5 ? ['SESSION_ENDED'] : [])]);
            expect(result.events[1]).toEqual({ type: 'PLAYER_FINISHED', roundNumber, playerId: move.playerId, placement: 3 });
            expect(result.events[3]).toEqual({ type: 'ROUND_ENDED', roundNumber, result: state.round.result });
            expect(result.events[4]).toEqual({ type: 'SCORE_CALCULATED', roundNumber, result: state.round.result, standings: state.standings });
            if (roundNumber === 5) expect(result.events[5]).toEqual({ type: 'SESSION_ENDED', roundNumber, result: state.result });
            const score = result.events[4];
            if (score?.type !== 'SCORE_CALCULATED') throw new Error('Expected scores');
            expect(score.standings).not.toBe(state.standings);
            expect(score.result.placements[0]).not.toBe(state.round.result.placements[0]);
          }
        }
        expect(state.round?.kind).toBe('completed');
        const rejected = submitMove(state, { kind: 'pass', playerId: 'south' }, defaultRuleset);
        expect(rejected.events).toEqual([]);
        expect(rejected.state).toBe(state);
      }
      expect(state.kind).toBe('completed');
      expect(history.filter((event) => event.type === 'PLAYER_FINISHED')).toHaveLength(15);
      expect(history.filter((event) => event.type === 'SCORE_CALCULATED')).toHaveLength(5);
      expect(history.filter((event) => event.type === 'SESSION_ENDED')).toHaveLength(1);
      const publicFacts = JSON.stringify(history.filter((event) => event.type !== 'CARDS_PLAYED'));
      for (const privateKey of ['rank', 'suit', 'hand', 'seed', 'rng', 'context', 'responseCycle']) expect(publicFacts).not.toContain(`"${privateKey}"`);
      return history;
    }
    expect(run()).toEqual(run());
  });
});

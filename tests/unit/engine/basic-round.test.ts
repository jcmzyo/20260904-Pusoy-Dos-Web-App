import { describe, expect, it } from 'vitest';
import type { Card, Move, Rank } from '../../../src/domain';
import { createDeck, defaultRuleset, generateLegalFreeLeadMoves, generateLegalOpeningMoves, generateLegalResponseMoves } from '../../../src/engine';
import * as engine from '../../../src/engine';
import { resolveBasicRound } from '../../../src/engine/rounds/resolveBasicRound';
import type { BasicRoundState } from '../../../src/engine/rounds/resolveBasicRound';

const ids = ['south', 'west', 'north', 'east'];
const card = (rank: Rank): Card => ({ rank, suit: 'clubs' });
function round(hands: readonly (readonly Card[])[], currentPlayerId = 'south', finishOrder: readonly string[] = []): BasicRoundState {
  return {
    kind: 'inProgress', finishOrder, responseCycle: null,
    context: { sessionActive: true, roundActive: true, currentPlayerId, trick: { kind: 'freeLead' }, players: ids.map((playerId, index) => ({ playerId, hand: hands[index]!, active: hands[index]!.length > 0 })) },
  };
}
function apply(state: BasicRoundState, move: Move): BasicRoundState {
  const result = resolveBasicRound(state, move, defaultRuleset);
  if (!result.accepted) throw new Error(result.error.code);
  return result.state;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

describe('Basic Round lifecycle and scoring', () => {
  it('assigns every possible finish order exactly once, independent of seating', () => {
    for (const first of ids) for (const second of ids.filter((id) => id !== first)) for (const third of ids.filter((id) => id !== first && id !== second)) {
      const last = ids.find((id) => ![first, second, third].includes(id))!;
      const order = [first, second, third, last];
      let state = round(ids.map((id) => [card((['3', '4', '5', '6'] as const)[order.indexOf(id)]!)]), first);
      for (let index = 0; index < 3; index += 1) {
        while (state.kind === 'inProgress' && state.context.currentPlayerId !== order[index]) {
          state = apply(state, { kind: 'pass', playerId: state.context.currentPlayerId });
        }
        const before = JSON.stringify(state);
        freeze(state);
        const move: Move = { kind: 'play', playerId: order[index]!, cards: [card((['3', '4', '5'] as const)[index]!)] };
        const next = apply(state, move);
        expect(apply(state, move)).toEqual(next);
        expect(JSON.stringify(state)).toBe(before);
        expect(next.finishOrder).toEqual(order.slice(0, index + 1));
        expect(next.kind).toBe(index === 2 ? 'completed' : 'inProgress');
        if (next.kind === 'inProgress') expect(next).not.toHaveProperty('result');
        state = next;
      }
      if (state.kind !== 'completed') throw new Error('Expected completed Round');
      expect(state.result.placements).toEqual(order.map((playerId, index) => ({ playerId, placement: index + 1, points: [5, 3, 2, 0][index] })));
      expect(state.players.find((player) => player.playerId === last)).toEqual({ playerId: last, active: true, hand: [card('6')] });
      expect(state).not.toHaveProperty('context');
      expect(state).not.toHaveProperty('responseCycle');
      freeze(state);
      for (const playerId of ids) for (const kind of ['play', 'pass'] as const) {
        const result = resolveBasicRound(state, kind === 'pass' ? { kind, playerId } : { kind, playerId, cards: [card('6')] }, defaultRuleset);
        expect(result).toEqual({ accepted: false, state, error: { code: 'ROUND_NOT_ACTIVE' } });
        expect(result.state).toBe(state);
      }
    }
  });

  it('does not end on a non-finishing Play or Pass with two players remaining', () => {
    let state = round([[], [], [card('8'), card('9')], [card('3')]], 'north', ['west', 'south']);
    state = apply(state, { kind: 'play', playerId: 'north', cards: [card('8')] });
    state = apply(state, { kind: 'pass', playerId: 'east' });
    expect(state.kind).toBe('inProgress');
    if (state.kind !== 'inProgress') throw new Error('Expected active Round');
    expect(state.context.trick).toEqual({ kind: 'freeLead' });
    expect(state.finishOrder).toEqual(['west', 'south']);
    const completed = apply(state, { kind: 'play', playerId: 'north', cards: [card('9')] });
    expect(completed.kind).toBe('completed');
  });

  it('rejects invalid intent without changing hands, finish order or scores', () => {
    const state = freeze(round([[], [], [card('8')], [card('3')]], 'north', ['south', 'west']));
    for (const move of [{ kind: 'pass', playerId: 'north' }, { kind: 'play', playerId: 'north', cards: [card('9')] }] as const) {
      const result = resolveBasicRound(state, move, defaultRuleset);
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(state);
      expect(result.state.finishOrder).toEqual(['south', 'west']);
    }
    expect(engine).not.toHaveProperty('resolveBasicRound');
  });

  it('completes a deterministic full-deck Round with conservation after every Move', () => {
    const deck = createDeck();
    const hands = ids.map((_, index) => deck.slice(index * 13, (index + 1) * 13));
    let state = round(hands);
    if (state.kind !== 'inProgress') throw new Error('Expected active Round');
    state = { ...state, context: { ...state.context, trick: { kind: 'opening' } } };
    const played: Card[] = [];
    let turns = 0;
    while (state.kind === 'inProgress' && turns < 300) {
      const { context } = state;
      const hand = context.players.find((player) => player.playerId === context.currentPlayerId)!.hand;
      const moves = context.trick.kind === 'response'
        ? generateLegalResponseMoves(hand, context.currentPlayerId, context.trick.current, defaultRuleset)
        : context.trick.kind === 'opening'
          ? generateLegalOpeningMoves(hand, context.currentPlayerId, defaultRuleset)
          : generateLegalFreeLeadMoves(hand, context.currentPlayerId, defaultRuleset);
      const move = moves.find((candidate) => candidate.kind === 'play' && candidate.cards.length === 1) ?? moves[0]!;
      state = apply(state, move);
      if (move.kind === 'play') played.push(...move.cards);
      const players = state.kind === 'completed' ? state.players : state.context.players;
      const cards = [...played, ...players.flatMap((player) => player.hand)];
      expect(cards).toHaveLength(52);
      expect(new Set(cards.map((entry) => `${entry.rank}-${entry.suit}`)).size).toBe(52);
      turns += 1;
    }
    expect(state.kind).toBe('completed');
    if (state.kind !== 'completed') throw new Error('Round failed to terminate');
    expect(state.finishOrder).toHaveLength(3);
    expect(state.result.placements.map((entry) => entry.playerId)).toEqual([...state.finishOrder, state.players.find((player) => player.hand.length > 0)!.playerId]);
    expect(state.result.placements.map((entry) => entry.points)).toEqual([5, 3, 2, 0]);
  });
});

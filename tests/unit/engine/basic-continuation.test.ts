import { describe, expect, it } from 'vitest';
import type { Card, Move, Rank } from '../../../src/domain';
import { createDeck, defaultRuleset } from '../../../src/engine';
import * as engine from '../../../src/engine';
import { validateMove } from '../../../src/engine/moves/validateMove';
import type { MoveValidationContext } from '../../../src/engine/moves/validateMove';
import { resolveBasicContinuation } from '../../../src/engine/turns/resolveBasicContinuation';
import type { ResponseCycle } from '../../../src/engine/turns/resolveTurnAndPass';

const ids = ['south', 'west', 'north', 'east'];
const card = (rank: Rank): Card => ({ rank, suit: 'clubs' });
function context(hands: readonly (readonly Card[])[], currentPlayerId = 'south'): MoveValidationContext {
  return { sessionActive: true, roundActive: true, currentPlayerId, trick: { kind: 'freeLead' }, players: ids.map((playerId, index) => ({ playerId, hand: hands[index]!, active: hands[index]!.length > 0 })) };
}
function resolve(state: MoveValidationContext, finishOrder: readonly string[] = [], cycle: ResponseCycle | null = null, move: Move = { kind: 'play', playerId: state.currentPlayerId, cards: state.players.find((player) => player.playerId === state.currentPlayerId)!.hand }) {
  const validation = validateMove(state, move, defaultRuleset);
  if (!validation.valid) throw new Error(validation.error.code);
  return resolveBasicContinuation(state, validation, cycle, finishOrder, defaultRuleset);
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

describe('Basic finished-player continuation', () => {
  it('finds the first beating player for every seat, active subset and responder subset', () => {
    for (let start = 0; start < 4; start += 1) {
      for (let activeMask = 1; activeMask < 8; activeMask += 1) {
        for (let beatMask = 0; beatMask < 8; beatMask += 1) {
          const hands = ids.map((_, index) => {
            const distance = (index - start + 4) % 4;
            if (distance === 0) return [card('8')];
            if (!(activeMask & (1 << (distance - 1)))) return [];
            return [card(((beatMask & (1 << (distance - 1))) ? ['9', '10', 'J'] : ['3', '4', '5'])[distance - 1] as Rank)];
          });
          const state = freeze(context(hands, ids[start]!));
          const finished = freeze(ids.filter((_, index) => hands[index]!.length === 0));
          const before = JSON.stringify({ state, finished });
          const result = resolve(state, finished);
          expect(resolve(state, finished)).toEqual(result);
          expect(JSON.stringify({ state, finished })).toBe(before);
          expect(result.finishOrder).toEqual([...finished, ids[start]]);
          expect(result.players[start]).toEqual({ playerId: ids[start], active: false, hand: [] });
          const active = [1, 2, 3].filter((distance) => activeMask & (1 << (distance - 1)));
          if (active.length === 1) {
            expect(result.kind).toBe('roundCompletionPending');
            if (result.kind === 'roundCompletionPending') expect(result.remainingPlayerId).toBe(ids[(start + active[0]!) % 4]);
          } else {
            expect(result.kind).toBe('continue');
            if (result.kind !== 'continue') throw new Error('Expected continuation');
            const responder = active.find((distance) => beatMask & (1 << (distance - 1)));
            expect(result.progression.currentPlayerId).toBe(ids[(start + (responder ?? active[0]!)) % 4]);
            expect(result.progression.trick).toEqual(responder ? { kind: 'response', current: { type: 'single', cards: [card('8')] } } : { kind: 'freeLead' });
            expect(result.progression.responseCycle).toEqual(responder ? { lastSuccessfulPlayerId: ids[start], passedPlayerIds: [] } : null);
          }
        }
      }
    }
  });

  it('continues through three consecutive finishers and stops before Round scoring', () => {
    let state = context([[card('3')], [card('4')], [card('5')], [card('6')]]);
    let finished: readonly string[] = [];
    let cycle: ResponseCycle | null = null;
    for (let index = 0; index < 3; index += 1) {
      const result = resolve(state, finished, cycle);
      expect(result.finishOrder).toEqual(ids.slice(0, index + 1));
      if (result.kind === 'continue') {
        state = { ...state, players: result.players, ...result.progression };
        finished = result.finishOrder;
        cycle = result.progression.responseCycle;
        expect(validateMove(state, { kind: 'pass', playerId: ids[index]! }, defaultRuleset)).toEqual({ valid: false, error: { code: 'PLAYER_NOT_ACTIVE' } });
      } else {
        expect(index).toBe(2);
        expect(result.remainingPlayerId).toBe('east');
        expect(result).not.toHaveProperty('scores');
        expect(result).not.toHaveProperty('progression');
      }
    }
  });

  it('uses full legal combination comparison including cross-type five-card responses', () => {
    const straight: Card[] = ['3', '4', '5', '6', '7'].map((rank, index) => ({ rank: rank as Rank, suit: index % 2 ? 'spades' : 'clubs' }));
    const flush: Card[] = ['3', '5', '7', '9', 'J'].map((rank) => ({ rank: rank as Rank, suit: 'hearts' }));
    const result = resolve(context([straight, [card('2')], flush, [{ rank: 'A', suit: 'diamonds' }]]));
    expect(result.kind === 'continue' && result.progression.currentPlayerId).toBe('north');
  });

  it('resets after voluntary Passes against a finished leader without re-entering finished seats', () => {
    const initial = context([[card('8')], [card('3')], [card('9'), card('4')], [card('10')]]);
    const first = resolve(initial);
    if (first.kind !== 'continue') throw new Error('Expected continuation');
    let state = { ...initial, players: first.players, ...first.progression };
    let cycle = first.progression.responseCycle;
    for (const playerId of ['north', 'east', 'west']) {
      expect(state.currentPlayerId).toBe(playerId);
      const result = resolve(state, first.finishOrder, cycle, { kind: 'pass', playerId });
      if (result.kind !== 'continue') throw new Error('Expected continuation');
      state = { ...state, ...result.progression };
      cycle = result.progression.responseCycle;
    }
    expect(state.currentPlayerId).toBe('west');
    expect(state.trick).toEqual({ kind: 'freeLead' });
    expect(cycle).toBeNull();
    expect(validateMove(state, { kind: 'pass', playerId: 'west' }, defaultRuleset)).toEqual({ valid: false, error: { code: 'PASS_NOT_ALLOWED' } });
  });

  it('a non-finishing response removes only played cards and resumes normal reset behavior', () => {
    const initial = context([[card('8')], [card('9'), card('3')], [card('4')], [card('5')]]);
    const first = resolve(initial);
    if (first.kind !== 'continue') throw new Error('Expected continuation');
    const response = resolve({ ...initial, players: first.players, ...first.progression }, first.finishOrder, first.progression.responseCycle, { kind: 'play', playerId: 'west', cards: [card('9')] });
    if (response.kind !== 'continue') throw new Error('Expected continuation');
    expect(response.finishOrder).toEqual(['south']);
    expect(response.players[1]).toEqual({ playerId: 'west', active: true, hand: [card('3')] });
    expect(response.progression.responseCycle).toEqual({ lastSuccessfulPlayerId: 'west', passedPlayerIds: [] });
    let state = { ...initial, players: response.players, ...response.progression };
    let cycle = response.progression.responseCycle;
    for (const playerId of ['north', 'east']) {
      const next = resolve(state, response.finishOrder, cycle, { kind: 'pass', playerId });
      if (next.kind !== 'continue') throw new Error('Expected continuation');
      state = { ...state, ...next.progression };
      cycle = next.progression.responseCycle;
    }
    expect(state.currentPlayerId).toBe('west');
    expect(state.trick).toEqual({ kind: 'freeLead' });
  });

  it('rejects inconsistent finish records and keeps the component internal', () => {
    const state = context([[card('3')], [], [card('4')], [card('5')]]);
    for (const finished of [[], ['west', 'west'], ['unknown'], ['south', 'west']]) {
      expect(() => resolve(state, finished)).toThrow('consistent finish order');
    }
    expect(engine).not.toHaveProperty('resolveBasicContinuation');
  });

  it('an unbeatable final play clears old Passes and permits a different-size free lead', () => {
    const initial = context([[card('2')], [card('4'), { rank: '4', suit: 'spades' }, card('3')], [card('5')], [card('6')]]);
    const state: MoveValidationContext = { ...initial, trick: { kind: 'response', current: { type: 'single', cards: [card('A')] } } };
    const result = resolve(state, [], { lastSuccessfulPlayerId: 'east', passedPlayerIds: ['west', 'north'] });
    if (result.kind !== 'continue') throw new Error('Expected continuation');
    expect(result.progression).toEqual({ currentPlayerId: 'west', trick: { kind: 'freeLead' }, responseCycle: null });
    const next = resolve({ ...state, players: result.players, ...result.progression }, result.finishOrder, null, { kind: 'play', playerId: 'west', cards: initial.players[1]!.hand.slice(0, 2) });
    expect(next.kind === 'continue' && next.progression.trick).toEqual({ kind: 'response', current: { type: 'pair', cards: initial.players[1]!.hand.slice(0, 2) } });
  });

  it('removes the opening card and advances to a response without recording a finish', () => {
    const deck = createDeck();
    const hands = ids.map((_, index) => deck.slice(index * 13, (index + 1) * 13));
    const state: MoveValidationContext = { ...context(hands), trick: { kind: 'opening' } };
    const result = resolve(state, [], null, { kind: 'play', playerId: 'south', cards: [card('3')] });
    expect(hands.map((hand) => hand.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(hands.flat().map((entry) => `${entry.rank}-${entry.suit}`)).size).toBe(52);
    expect(result.finishOrder).toEqual([]);
    expect(result.players[0]).toEqual({ playerId: 'south', active: true, hand: hands[0]!.slice(1) });
    expect(result.players.slice(1)).toEqual(state.players.slice(1));
    expect(result.kind).toBe('continue');
    if (result.kind !== 'continue') throw new Error('Expected continuation');
    expect(result.progression).toEqual({ currentPlayerId: 'west', trick: { kind: 'response', current: { type: 'single', cards: [card('3')] } }, responseCycle: { lastSuccessfulPlayerId: 'south', passedPlayerIds: [] } });
  });
});

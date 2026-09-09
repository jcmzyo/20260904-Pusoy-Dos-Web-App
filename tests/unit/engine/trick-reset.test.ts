import { describe, expect, it } from 'vitest';
import type { Move, Rank } from '../../../src/domain';
import { defaultRuleset, generateLegalFreeLeadMoves } from '../../../src/engine';
import * as engine from '../../../src/engine';
import { validateMove } from '../../../src/engine/moves/validateMove';
import type { MoveValidationContext } from '../../../src/engine/moves/validateMove';
import { resolveTurnAndTrick } from '../../../src/engine/turns/resolveTurnAndTrick';
import type { ResponseCycle } from '../../../src/engine/turns/resolveTurnAndPass';

const ids = ['south', 'west', 'north', 'east'];
function context(leader = 'east'): MoveValidationContext {
  return {
    sessionActive: true, roundActive: true, currentPlayerId: ids[(ids.indexOf(leader) + 1) % 4]!,
    players: ids.map((playerId, index) => ({ playerId, active: true, hand: [{ rank: (['4', '5', '6', '7'] as const)[index]!, suit: 'clubs' }, { rank: '2', suit: (['clubs', 'spades', 'hearts', 'diamonds'] as const)[index]! }] })),
    trick: { kind: 'response', current: { type: 'single', cards: [{ rank: 'A', suit: 'diamonds' }] } },
  };
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function resolve(state: MoveValidationContext, cycle: ResponseCycle | null, move: Move = { kind: 'pass', playerId: state.currentPlayerId }) {
  const validation = validateMove(state, move, defaultRuleset);
  if (!validation.valid) throw new Error(`Invalid test Move: ${validation.error.code}`);
  return resolveTurnAndTrick(state, validation, cycle);
}

describe('internal Trick reset and free lead', () => {
  it.each(ids)('resets only after all three responses and gives %s free lead', (leader) => {
    let state = freeze(context(leader));
    let cycle: ResponseCycle | null = freeze({ lastSuccessfulPlayerId: leader, passedPlayerIds: [] });
    for (let count = 1; count <= 3; count += 1) {
      const before = JSON.stringify({ state, cycle });
      const result = resolve(state, cycle);
      expect(resolve(state, cycle)).toEqual(result);
      expect(JSON.stringify({ state, cycle })).toBe(before);
      if (count < 3) {
        expect(result.trick).toEqual(state.trick);
        expect(result.responseCycle?.passedPlayerIds).toHaveLength(count);
      } else {
        expect(result).toEqual({ currentPlayerId: leader, trick: { kind: 'freeLead' }, responseCycle: null });
      }
      state = freeze({ ...state, ...result });
      cycle = freeze(result.responseCycle);
    }
    expect(validateMove(state, { kind: 'pass', playerId: leader }, defaultRuleset)).toEqual({ valid: false, error: { code: 'PASS_NOT_ALLOWED' } });
    const hand = state.players.find((player) => player.playerId === leader)!.hand;
    expect(generateLegalFreeLeadMoves(hand, leader, defaultRuleset).every((move) => move.kind === 'play')).toBe(true);
    const move: Move = { kind: 'play', playerId: leader, cards: [hand[0]!] };
    const next = resolve(state, cycle, move);
    expect(next.responseCycle).toEqual({ lastSuccessfulPlayerId: leader, passedPlayerIds: [] });
    expect(next.trick).toEqual({ kind: 'response', current: { type: 'single', cards: move.cards } });
    const afterPlay = { ...state, ...next, players: state.players.map((player) => player.playerId === leader ? { ...player, hand: player.hand.slice(1) } : player) };
    expect(resolve(afterPlay, next.responseCycle).responseCycle?.passedPlayerIds).toEqual([next.currentPlayerId]);
  });

  it('counts only eligible opponents for every leader and subset of remaining seats', () => {
    for (const leader of ids) {
      const opponents = ids.filter((id) => id !== leader);
      for (let mask = 1; mask < 8; mask += 1) {
        for (const inactive of ['finished', 'empty', 'inactive'] as const) {
          const initial = context(leader);
          const players = initial.players.map((player) => {
            if (player.playerId === leader || (mask & (1 << opponents.indexOf(player.playerId)))) return player;
            return { ...player, active: inactive === 'empty', hand: inactive === 'inactive' ? player.hand : [] };
          });
          const responders = [1, 2, 3].map((offset) => ids[(ids.indexOf(leader) + offset) % 4]!).filter((id) => players.some((player) => player.playerId === id && player.active && player.hand.length > 0));
          let state = { ...initial, players, currentPlayerId: responders[0]! };
          let cycle: ResponseCycle | null = { lastSuccessfulPlayerId: leader, passedPlayerIds: [] };
          for (let index = 0; index < responders.length; index += 1) {
            expect(state.currentPlayerId).toBe(responders[index]);
            const result = resolve(freeze(state), freeze(cycle));
            expect(result.trick.kind).toBe(index === responders.length - 1 ? 'freeLead' : 'response');
            state = { ...state, ...result };
            cycle = result.responseCycle;
          }
          expect(state.currentPlayerId).toBe(leader);
          expect(cycle).toBeNull();
        }
      }
    }
  });

  it('a beating Play starts a fresh response cycle instead of triggering reset from old Passes', () => {
    const state = context();
    const result = resolve(state, { lastSuccessfulPlayerId: 'east', passedPlayerIds: ['west', 'north'] }, { kind: 'play', playerId: 'south', cards: [state.players[0]!.hand[1]!] });
    expect(result.responseCycle).toEqual({ lastSuccessfulPlayerId: 'south', passedPlayerIds: [] });
    expect(result.trick).toEqual({ kind: 'response', current: { type: 'single', cards: [{ rank: '2', suit: 'clubs' }] } });
  });

  it('free lead permits a different combination size without the opening restriction', () => {
    const initial = context('west');
    const state: MoveValidationContext = { ...initial, currentPlayerId: 'south', players: initial.players.map((player) => player.playerId === 'west' ? { ...player, hand: [{ rank: '5' as Rank, suit: 'clubs' }, { rank: '5' as Rank, suit: 'spades' }, player.hand[1]!] } : player) };
    const reset = resolve(state, { lastSuccessfulPlayerId: 'west', passedPlayerIds: ['north', 'east'] });
    const next = resolve({ ...state, ...reset }, reset.responseCycle, { kind: 'play', playerId: 'west', cards: state.players[1]!.hand.slice(0, 2) });
    expect(next.trick).toEqual({ kind: 'response', current: { type: 'pair', cards: state.players[1]!.hand.slice(0, 2) } });
  });

  it('does not grant free lead to an ineligible last successful player', () => {
    const initial = context();
    const state = { ...initial, currentPlayerId: 'north', players: initial.players.map((player) => player.playerId === 'east' ? { ...player, active: false, hand: [] } : player) };
    const result = resolve(state, { lastSuccessfulPlayerId: 'east', passedPlayerIds: ['south', 'west'] });
    expect(result.currentPlayerId).toBe('south');
    expect(result.trick).toEqual(state.trick);
    expect(result.responseCycle).toEqual({ lastSuccessfulPlayerId: 'east', passedPlayerIds: ['south', 'west', 'north'] });
  });

  it('rejects corrupt cycle inputs and remains internal until finishing/lifecycle are implemented', () => {
    const state = context();
    expect(() => resolve(state, { lastSuccessfulPlayerId: 'east', passedPlayerIds: ['west', 'west'] })).toThrow('invalid player IDs');
    expect(() => resolve(state, { lastSuccessfulPlayerId: 'east', passedPlayerIds: ['south'] })).toThrow('unresolved response');
    expect(() => resolve(state, null)).toThrow('last successful');
    expect(engine).not.toHaveProperty('resolveTurnAndTrick');
    expect(resolve(state, { lastSuccessfulPlayerId: 'east', passedPlayerIds: [] })).not.toHaveProperty('state');
  });
});

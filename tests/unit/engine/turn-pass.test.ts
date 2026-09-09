import { describe, expect, it } from 'vitest';
import type { Card, Move, Rank } from '../../../src/domain';
import { defaultRuleset, generateLegalResponseMoves } from '../../../src/engine';
import * as engine from '../../../src/engine';
import { validateMove } from '../../../src/engine/moves/validateMove';
import type { MoveValidationContext } from '../../../src/engine/moves/validateMove';
import { resolveTurnAndPass } from '../../../src/engine/turns/resolveTurnAndPass';
import type { ResponseCycle } from '../../../src/engine/turns/resolveTurnAndPass';

const card = (rank: Rank): Card => ({ rank, suit: 'clubs' });
const ids = ['south', 'west', 'north', 'east'];
function context(): MoveValidationContext {
  return {
    sessionActive: true, roundActive: true, currentPlayerId: 'south',
    players: ids.map((playerId, index) => ({ playerId, active: true, hand: [card((['4', '5', '6', '7'] as const)[index]!), { rank: '2', suit: (['clubs', 'spades', 'hearts', 'diamonds'] as const)[index]! }] })),
    trick: { kind: 'response', current: { type: 'single', cards: [card('3')] } },
  };
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function resolve(state: MoveValidationContext, move: Move, cycle: ResponseCycle | null) {
  const validation = validateMove(state, move, defaultRuleset);
  if (!validation.valid) throw new Error(`Invalid test Move: ${validation.error.code}`);
  return resolveTurnAndPass(state, validation, cycle);
}

describe('internal Turn rotation and response-cycle Pass tracking', () => {
  it.each(ids)('advances clockwise from %s, including wraparound', (playerId) => {
    const state = context();
    const index = ids.indexOf(playerId);
    const result = resolve({ ...state, currentPlayerId: playerId }, { kind: 'play', playerId, cards: [state.players[index]!.hand[0]!] }, { lastSuccessfulPlayerId: ids[(index + 3) % 4]!, passedPlayerIds: [] });
    expect(result).toEqual({ currentPlayerId: ids[(index + 1) % 4], responseCycle: { lastSuccessfulPlayerId: playerId, passedPlayerIds: [] } });
  });

  it('skips every combination of finished/ineligible seats for both Play and Pass', () => {
    for (let start = 0; start < 4; start += 1) {
      for (let mask = 1; mask < 8; mask += 1) {
        const state = context();
        const players = state.players.map((player, index) => {
          const distance = (index - start + 4) % 4;
          if (distance === 0 || (mask & (1 << (distance - 1)))) return player;
          return distance % 2 === 0 ? { ...player, active: false, hand: [] } : { ...player, hand: [] };
        });
        const playerId = ids[start]!;
        const expected = [1, 2, 3].find((distance) => mask & (1 << (distance - 1)))!;
        for (const kind of ['play', 'pass'] as const) {
          const move: Move = kind === 'pass' ? { kind, playerId } : { kind, playerId, cards: [players[start]!.hand[0]!] };
          const result = resolve({ ...state, players, currentPlayerId: playerId }, move, { lastSuccessfulPlayerId: ids[(start + 3) % 4]!, passedPlayerIds: [] });
          expect(result.currentPlayerId).toBe(ids[(start + expected) % 4]);
          expect(players.filter((player) => player.active && player.hand.length > 0 && player.playerId === result.currentPlayerId)).toHaveLength(1);
        }
      }
    }
  });

  it('tracks voluntary Pass without removing the player or changing the current combination', () => {
    const state = freeze(context());
    const cycle = freeze({ lastSuccessfulPlayerId: 'east', passedPlayerIds: [] });
    const before = JSON.stringify(state);
    if (state.trick.kind !== 'response') throw new Error('Expected response fixture');
    expect(generateLegalResponseMoves(state.players[0]!.hand, 'south', state.trick.current, defaultRuleset).some((move) => move.kind === 'play')).toBe(true);
    const result = resolve(state, freeze({ kind: 'pass', playerId: 'south' }), cycle);
    expect(result).toEqual({ currentPlayerId: 'west', responseCycle: { lastSuccessfulPlayerId: 'east', passedPlayerIds: ['south'] } });
    expect(JSON.stringify(state)).toBe(before);
    expect(cycle.passedPlayerIds).toEqual([]);
    expect(resolve(state, { kind: 'pass', playerId: 'south' }, cycle)).toEqual(result);
  });

  it('accumulates Passes then clears them on a beating Play and lets a previous passer respond again', () => {
    const state = freeze(context());
    const first = resolve(state, { kind: 'pass', playerId: 'south' }, { lastSuccessfulPlayerId: 'east', passedPlayerIds: [] });
    const second = resolve({ ...state, currentPlayerId: first.currentPlayerId }, { kind: 'pass', playerId: 'west' }, first.responseCycle);
    expect(second.responseCycle.passedPlayerIds).toEqual(['south', 'west']);
    const played = resolve({ ...state, currentPlayerId: second.currentPlayerId }, { kind: 'play', playerId: 'north', cards: [card('6')] }, freeze(second.responseCycle));
    expect(played).toEqual({ currentPlayerId: 'east', responseCycle: { lastSuccessfulPlayerId: 'north', passedPlayerIds: [] } });
    const afterPlay: MoveValidationContext = { ...state, currentPlayerId: 'east', players: state.players.map((player) => player.playerId === 'north' ? { ...player, hand: player.hand.slice(1) } : player), trick: { kind: 'response', current: { type: 'single', cards: [card('6')] } } };
    const next = resolve(afterPlay, { kind: 'pass', playerId: 'east' }, played.responseCycle);
    expect(next.currentPlayerId).toBe('south');
    const reentered = resolve({ ...afterPlay, currentPlayerId: next.currentPlayerId }, { kind: 'play', playerId: 'south', cards: [card('2')] }, next.responseCycle);
    expect(reentered.responseCycle).toEqual({ lastSuccessfulPlayerId: 'south', passedPlayerIds: [] });
    expect(second.responseCycle.passedPlayerIds).toEqual(['south', 'west']);
  });

  it.each(['opening', 'freeLead'] as const)('starts a response cycle after a successful %s Play', (kind) => {
    const state = context();
    const lead: MoveValidationContext = { ...state, trick: { kind }, players: state.players.map((player, index) => index === 0 ? { ...player, hand: [card('3'), ...player.hand] } : player) };
    expect(resolve(freeze(lead), { kind: 'play', playerId: 'south', cards: [card('3')] }, null)).toEqual({ currentPlayerId: 'west', responseCycle: { lastSuccessfulPlayerId: 'south', passedPlayerIds: [] } });
    expect(validateMove(lead, { kind: 'pass', playerId: 'south' }, defaultRuleset)).toEqual({ valid: false, error: { code: 'PASS_NOT_ALLOWED' } });
  });

  it('leaves final-Pass reset to the enclosing transaction without exposing a public post-Move state', () => {
    const result = resolve(context(), { kind: 'pass', playerId: 'south' }, { lastSuccessfulPlayerId: 'west', passedPlayerIds: ['north', 'east'] });
    expect(result).toEqual({ currentPlayerId: 'west', responseCycle: { lastSuccessfulPlayerId: 'west', passedPlayerIds: ['north', 'east', 'south'] } });
    expect(result).not.toHaveProperty('state');
    expect(result).not.toHaveProperty('accepted');
    expect(result).not.toHaveProperty('events');
    expect(engine).not.toHaveProperty('resolveTurnAndPass');
    expect(engine).not.toHaveProperty('submitMove');
  });

  it('fails diagnostically on impossible rotation and response-cycle input', () => {
    const state = context();
    const valid = { valid: true, kind: 'pass' } as const;
    const cycle = { lastSuccessfulPlayerId: 'east', passedPlayerIds: [] };
    expect(() => resolveTurnAndPass({ ...state, players: state.players.slice(1) }, valid, cycle)).toThrow('four distinct');
    expect(() => resolveTurnAndPass({ ...state, players: [state.players[0]!, ...state.players.slice(0, 3)] }, valid, cycle)).toThrow('four distinct');
    expect(() => resolveTurnAndPass({ ...state, currentPlayerId: 'missing' }, valid, cycle)).toThrow('Turn owner');
    expect(() => resolveTurnAndPass({ ...state, roundActive: false }, valid, cycle)).toThrow('active Session');
    expect(() => resolveTurnAndPass({ ...state, players: state.players.map((player, index) => index === 0 ? player : { ...player, active: false, hand: [] }) }, valid, cycle)).toThrow('another eligible');
    expect(() => resolveTurnAndPass(state, valid, null)).toThrow('last successful');
    expect(() => resolveTurnAndPass(state, valid, { ...cycle, lastSuccessfulPlayerId: 'missing' })).toThrow('last successful');
    for (const passedPlayerIds of [['west', 'west'], ['missing'], ['east']]) {
      expect(() => resolveTurnAndPass(state, valid, { ...cycle, passedPlayerIds })).toThrow('invalid player IDs');
    }
    expect(() => resolveTurnAndPass(state, valid, { ...cycle, passedPlayerIds: ['south'] })).toThrow('unresolved response');
    expect(() => resolveTurnAndPass(state, valid, { ...cycle, lastSuccessfulPlayerId: 'south' })).toThrow('unresolved response');
    expect(() => resolveTurnAndPass({ ...state, trick: { kind: 'freeLead' } }, valid, null)).toThrow('requires a Play');
  });
});

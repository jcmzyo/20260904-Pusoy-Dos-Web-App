import { describe, expect, it } from 'vitest';
import type { Card, Combination, Move, Rank, Suit } from '../../../src/domain';
import { defaultRuleset, generateLegalFreeLeadMoves, generateLegalOpeningMoves, generateLegalResponseMoves, inspectCombination } from '../../../src/engine';
import { validateMove } from '../../../src/engine/moves/validateMove';
import type { MoveErrorCode, MoveValidationContext } from '../../../src/engine/moves/validateMove';

const card = (rank: Rank, suit: Suit = 'clubs'): Card => ({ rank, suit });
const play = (cards: readonly Card[], playerId = 'south'): Move => ({ kind: 'play', playerId, cards });
const pass: Move = { kind: 'pass', playerId: 'south' };
function combination(cards: readonly Card[]): Combination {
  const result = inspectCombination(cards, defaultRuleset);
  if (!result.valid) throw new Error('Invalid fixture');
  return result.combination;
}
function context(hand: readonly Card[] = [card('3'), card('3', 'diamonds'), card('8')], trick: MoveValidationContext['trick'] = { kind: 'opening' }): MoveValidationContext {
  return {
    sessionActive: true, roundActive: true, currentPlayerId: 'south', trick,
    players: [
      { playerId: 'south', active: true, hand },
      { playerId: 'west', active: true, hand: [card('10', 'hearts')] },
      { playerId: 'north', active: true, hand: [card('J', 'hearts')] },
      { playerId: 'east', active: false, hand: [] },
    ],
  };
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function reject(state: MoveValidationContext, move: Move, code: MoveErrorCode): void {
  const before = JSON.stringify(state);
  const intent = JSON.stringify(move);
  freeze(state);
  freeze(move);
  expect(validateMove(state, move, defaultRuleset)).toEqual({ valid: false, error: { code } });
  expect(JSON.stringify(state)).toBe(before);
  expect(JSON.stringify(move)).toBe(intent);
}

describe('validateMove', () => {
  it.each<Move>([play([card('3')]), pass])('checks Session, Round, player eligibility and Turn for $kind', (move) => {
    reject({ ...context(), sessionActive: false }, move, 'SESSION_NOT_ACTIVE');
    reject({ ...context(), roundActive: false }, move, 'ROUND_NOT_ACTIVE');
    reject(context(), { ...move, playerId: 'missing' }, 'PLAYER_NOT_FOUND');
    reject(context(), { ...move, playerId: 'east' }, 'PLAYER_NOT_ACTIVE');
    reject(context(), { ...move, playerId: 'west' }, 'NOT_YOUR_TURN');
    reject({ ...context(), players: [{ playerId: 'south', active: false, hand: [card('3')] }] }, move, 'PLAYER_NOT_ACTIVE');
    reject(context([]), move, 'PLAYER_NOT_ACTIVE');
  });

  it('rejects unowned, duplicate, malformed, non-beating and opening-violation Plays without partial mutation', () => {
    reject(context(), play([card('3'), card('3', 'hearts')]), 'CARD_NOT_OWNED');
    reject(context(), play([card('3'), { ...card('3') }]), 'DUPLICATE_CARD');
    reject(context(), play([card('3'), card('8')]), 'INVALID_COMBINATION');
    reject(context(), play([card('8')]), 'OPENING_REQUIRES_THREE_OF_CLUBS');
    reject(context([card('6')], { kind: 'response', current: combination([card('7')]) }), play([card('6')]), 'PLAY_DOES_NOT_BEAT_CURRENT');
    reject(context(), pass, 'PASS_NOT_ALLOWED');
    reject(context(undefined, { kind: 'freeLead' }), pass, 'PASS_NOT_ALLOWED');
  });

  it.for([[], [card('3'), card('4'), card('5'), card('6')], [card('K'), card('A'), card('2'), card('3'), card('4', 'spades')]])('rejects invalid owned combinations %j', (cards) => {
    reject(context(cards.length ? cards : undefined, { kind: 'freeLead' }), play(cards), 'INVALID_COMBINATION');
  });

  it.for([null, undefined, {}, 'cards', [null], new Array(1), [{ rank: 'joker', suit: 'clubs' }]])('returns structured errors for malformed card input %j', (cards) => {
    reject(context(), play(cards as Card[]), 'INVALID_COMBINATION');
  });

  it.for([null, undefined, {}, { kind: 'pass' }, { kind: 'unknown', playerId: 'south' }])('does not throw for malformed intent %j', (move) => {
    reject(context(), move as Move, move?.kind === 'unknown' ? 'INVALID_COMBINATION' : 'PLAYER_NOT_FOUND');
  });

  it.for([
    [card('3')],
    [card('3', 'diamonds'), card('3')],
    [card('3', 'diamonds'), card('3'), card('3', 'spades')],
    [card('3'), card('4'), card('5'), card('6'), card('7')],
  ])('recognizes opening combinations without removing cards or returning a post-Move state: %j', (cards) => {
    const state = freeze(context(cards));
    const before = JSON.stringify(state);
    const move = freeze(play(cards));
    const result = validateMove(state, move, defaultRuleset);
    expect(result).toEqual({ valid: true, kind: 'play', combination: combination(cards) });
    expect(JSON.stringify(state)).toBe(before);
    expect(result).not.toHaveProperty('state');
    expect(result).not.toHaveProperty('accepted');
    expect(result).not.toHaveProperty('events');
    if (!result.valid || result.kind !== 'play') throw new Error('Expected valid Play');
    expect(result.combination.cards).not.toBe(cards);
    result.combination.cards.forEach((value, index) => expect(value).not.toBe(cards[index]));
    expect(validateMove(state, move, defaultRuleset)).toEqual(result);
  });

  it('allows voluntary Pass even when a beating Play is available, without changing state', () => {
    const state = freeze(context([card('8')], { kind: 'response', current: combination([card('7')]) }));
    const before = JSON.stringify(state);
    expect(validateMove(state, pass, defaultRuleset)).toEqual({ valid: true, kind: 'pass' });
    expect(validateMove(state, play([card('8')]), defaultRuleset).valid).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    expect(validateMove(context([card('6')], state.trick), pass, defaultRuleset)).toEqual({ valid: true, kind: 'pass' });
  });

  it.for([
    { current: [card('7', 'hearts')], higher: [card('7', 'diamonds')], lower: [card('7', 'spades')] },
    { current: [card('7'), card('7', 'hearts')], higher: [card('7', 'spades'), card('7', 'diamonds')], lower: [card('6'), card('6', 'diamonds')] },
    { current: [card('7'), card('7', 'spades'), card('7', 'hearts')], higher: [card('8'), card('8', 'spades'), card('8', 'hearts')], lower: [card('6'), card('6', 'spades'), card('6', 'hearts')] },
    { current: [card('J'), card('Q'), card('K'), card('A'), card('2', 'spades')], higher: [card('3'), card('5'), card('7'), card('9'), card('2')], lower: [card('3', 'spades'), card('4'), card('5', 'spades'), card('6'), card('7', 'spades')] },
  ])('uses canonical response comparison: $current', ({ current, higher, lower }) => {
    const trick = { kind: 'response' as const, current: combination(current) };
    expect(validateMove(context(higher, trick), play(higher), defaultRuleset)).toEqual({ valid: true, kind: 'play', combination: combination(higher) });
    reject(context(lower, trick), play(lower), 'PLAY_DOES_NOT_BEAT_CURRENT');
    if (higher.length > 1) reject(context(higher, trick), play(higher.slice(0, 1)), 'PLAY_DOES_NOT_BEAT_CURRENT');
  });

  it('does not allow a lower five-card category to answer a stronger category', () => {
    const cards = [card('J'), card('Q'), card('K'), card('A'), card('2', 'spades')];
    const current = combination([card('3'), card('5'), card('7'), card('9'), card('2')]);
    reject(context(cards, { kind: 'response', current }), play(cards), 'PLAY_DOES_NOT_BEAT_CURRENT');
  });

  it('agrees with legal generators for every subset of a representative hand in all lead contexts', () => {
    const hand = [card('3'), card('3', 'spades'), card('3', 'diamonds'), card('4'), card('5'), card('6'), card('7'), card('8')];
    const current = combination([card('3', 'hearts'), card('4', 'hearts'), card('5', 'hearts'), card('6', 'hearts'), card('7', 'spades')]);
    const cases = [
      { trick: { kind: 'opening' as const }, moves: generateLegalOpeningMoves(hand, 'south', defaultRuleset) },
      { trick: { kind: 'freeLead' as const }, moves: generateLegalFreeLeadMoves(hand, 'south', defaultRuleset) },
      { trick: { kind: 'response' as const, current }, moves: generateLegalResponseMoves(hand, 'south', current, defaultRuleset) },
    ];
    const key = (move: Move) => move.kind === 'pass' ? 'pass' : move.cards.map((value) => `${value.rank}-${value.suit}`).sort().join(',');
    for (const entry of cases) {
      const state = freeze(context(hand, entry.trick));
      const legal = new Set(entry.moves.map(key));
      for (let mask = 0; mask < 2 ** hand.length; mask += 1) {
        const move = play(hand.filter((_, index) => (mask & (1 << index)) !== 0));
        expect(validateMove(state, move, defaultRuleset).valid).toBe(legal.has(key(move)));
      }
      expect(validateMove(state, pass, defaultRuleset).valid).toBe(legal.has('pass'));
    }
  });

  it('keeps corrupted authoritative data diagnostic rather than returning plausible legality', () => {
    expect(() => validateMove(context([card('3'), card('3')]), pass, defaultRuleset)).toThrow('duplicate card');
    expect(() => validateMove(context([{ rank: 'joker', suit: 'clubs' } as unknown as Card]), pass, defaultRuleset)).toThrow('valid authoritative hand');
    expect(() => validateMove(context(undefined, { kind: 'response', current: { type: 'pair', cards: [card('7')] } }), pass, defaultRuleset)).toThrow('canonical current combination');
    expect(() => validateMove(context(undefined, { kind: 'response', current: combination([card('3')]) }), pass, defaultRuleset)).toThrow('overlaps');
  });
});

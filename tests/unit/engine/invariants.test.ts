import { describe, expect, it } from 'vitest';
import type { Card, Move } from '../../../src/domain';
import { assertEngineInvariants, assertMoveInvariants, createSession, startRound, submitMove, defaultRuleset, EngineInvariantError, generateLegalFreeLeadMoves, generateLegalOpeningMoves, generateLegalResponseMoves } from '../../../src/engine';
import type { BasicSessionState } from '../../../src/engine/sessions/resolveBasicSession';

const ids = ['south', 'west', 'north', 'east'];
const rules = defaultRuleset;
const card = (rank: Card['rank']): Card => ({ rank, suit: 'clubs' });
const opening = () => startRound(createSession(ids).state, { next: () => 0 }).state;
function active(state: BasicSessionState) {
  if (state.round?.kind !== 'inProgress') throw new Error('Expected active fixture.');
  return state.round;
}
function changeContext(state: BasicSessionState, patch: Partial<ReturnType<typeof active>['context']>): BasicSessionState {
  const round = active(state);
  return { ...state, round: { ...round, context: { ...round.context, ...patch } } };
}
function failure(run: () => void, code: string) {
  expect(run).toThrow(EngineInvariantError);
  expect(run).toThrow(code);
  expect(run).toThrow(/Round \d/);
}
function fixture(hands: Card[][]): BasicSessionState {
  return { ...createSession(ids).state, roundNumber: 1, round: {
    kind: 'inProgress', finishOrder: [], responseCycle: null,
    context: { sessionActive: true, roundActive: true, currentPlayerId: ids[0]!, trick: { kind: 'freeLead' },
      players: ids.map((playerId, index) => ({ playerId, hand: hands[index]!, active: true })),
    },
  } };
}

describe('reusable Engine invariants', () => {
  it('accepts setup and opening without modifying state', () => {
    for (const state of [createSession(ids).state, opening()]) {
      const snapshot = JSON.stringify(state);
      expect(() => assertEngineInvariants(state, rules)).not.toThrow();
      expect(JSON.stringify(state)).toBe(snapshot);
    }
  });

  it('diagnoses missing, duplicate and invalid physical cards without repair', () => {
    const state = opening();
    const { players } = active(state).context;
    const corruptions = [
      { code: 'CARD_CONSERVATION', hand: players[0]!.hand.slice(1) },
      { code: 'CARD_LOCATION', hand: [players[1]!.hand[0]!, ...players[0]!.hand.slice(1)] },
      { code: 'CARD_LOCATION', hand: [players[0]!.hand[1]!, ...players[0]!.hand.slice(1)] },
      { code: 'CARD_IDENTITY', hand: [{ rank: 'invalid', suit: 'clubs' } as unknown as Card, ...players[0]!.hand.slice(1)] },
    ];
    for (const { code, hand } of corruptions) {
      const invalid = changeContext(state, { players: players.map((player, index) => index === 0 ? { ...player, hand } : player) });
      const snapshot = JSON.stringify(invalid);
      failure(() => assertEngineInvariants(invalid, rules), code);
      expect(JSON.stringify(invalid)).toBe(snapshot);
    }
  });

  it('diagnoses participant, Turn-owner, opening and finish-record corruption', () => {
    const state = opening();
    const round = active(state);
    failure(() => assertEngineInvariants({ ...state, playerIds: ids.slice(1) }, rules), 'PLAYERS');
    failure(() => assertEngineInvariants({ ...state, playerIds: ['south', 'south', 'north', 'east'] }, rules), 'PLAYERS');
    failure(() => assertEngineInvariants(changeContext(state, { players: [...round.context.players].reverse() }), rules), 'PLAYERS');
    failure(() => assertEngineInvariants(changeContext(state, { currentPlayerId: 'unknown' }), rules), 'TURN_OWNER');
    failure(() => assertEngineInvariants(changeContext(state, { currentPlayerId: ids.find((id) => id !== round.context.currentPlayerId)! }), rules), 'OPENING');
    failure(() => assertEngineInvariants({ ...state, round: { ...round, finishOrder: ['south', 'south'] } }, rules), 'FINISH_ORDER');
    failure(() => assertEngineInvariants({ ...state, round: { ...round, finishOrder: ['south'] } }, rules), 'FINISHED_PLAYER');
  });

  it('distinguishes ordinary rejected intent from falsely accepted illegal actions', () => {
    const state = opening();
    const round = active(state);
    const player = round.context.players.find((entry) => entry.playerId === round.context.currentPlayerId)!;
    const moves: Move[] = [
      { kind: 'pass', playerId: player.playerId },
      { kind: 'play', playerId: player.playerId, cards: [player.hand.find((entry) => entry.rank !== '3')!] },
      { kind: 'play', playerId: player.playerId, cards: [round.context.players.find((entry) => entry.playerId !== player.playerId)!.hand[0]!] },
      { kind: 'play', playerId: 'unknown', cards: [card('3')] },
    ];
    for (const move of moves) {
      const rejected = submitMove(state, move, rules);
      expect(rejected.accepted).toBe(false);
      expect(() => assertMoveInvariants(state, move, rejected, rules)).not.toThrow();
      failure(() => assertMoveInvariants(state, move, { accepted: true, state, events: [] }, rules), 'ACCEPTED_MOVE');
      failure(() => assertMoveInvariants(state, move, { ...rejected, state: { ...state, roundNumber: 2 } }, rules), 'REJECTED_MOVE');
    }
  });

  it('detects lost, resurrected and transferred cards after an otherwise valid Play', () => {
    const state = fixture([[card('4'), card('8')], [card('5'), card('9')], [card('6')], [card('7')]]);
    const move: Move = { kind: 'play', playerId: 'south', cards: [card('4')] };
    const result = submitMove(state, move, rules);
    expect(() => assertMoveInvariants(state, move, result, rules)).not.toThrow();
    const players = active(result.state).context.players;
    for (const hands of [
      [[card('8')], [card('5')], [card('6')], [card('7')]],
      [[card('8'), card('10')], [card('5'), card('9')], [card('6')], [card('7')]],
      [[card('8'), card('9')], [card('5')], [card('6')], [card('7')]],
    ]) {
      const corrupted = changeContext(result.state, { players: players.map((player, index) => ({ ...player, hand: hands[index]! })) });
      expect(() => assertEngineInvariants(corrupted, rules)).not.toThrow();
      failure(() => assertMoveInvariants(state, move, { ...result, state: corrupted }, rules), 'CARD_CONSERVATION');
    }
  });

  it('detects a falsely accepted weaker response and stale or premature reset', () => {
    const initial = fixture([[card('8'), card('10')], [card('5'), card('9')], [card('6')], [card('7')]]);
    let state = submitMove(initial, { kind: 'play', playerId: 'south', cards: [card('8')] }, rules).state;
    failure(() => assertMoveInvariants(state, { kind: 'play', playerId: 'west', cards: [card('5')] }, { accepted: true, state, events: [] }, rules), 'PLAY_DOES_NOT_BEAT_CURRENT');
    for (const playerId of ['west', 'north', 'east']) {
      const move: Move = { kind: 'pass', playerId };
      const result = submitMove(state, move, rules);
      expect(() => assertMoveInvariants(state, move, result, rules)).not.toThrow();
      const after = active(result.state);
      if (playerId === 'west') {
        const corrupt = { ...result.state, round: { ...after, responseCycle: { lastSuccessfulPlayerId: 'south', passedPlayerIds: [] } } };
        failure(() => assertMoveInvariants(state, move, { ...result, state: corrupt }, rules), 'PASS_RESET');
        const premature = { ...result.state, round: { ...after, responseCycle: null, context: { ...after.context, trick: { kind: 'freeLead' as const } } } };
        failure(() => assertMoveInvariants(state, move, { ...result, state: premature }, rules), 'TRICK');
      }
      if (playerId === 'east') {
        failure(() => assertEngineInvariants({ ...result.state, round: { ...after, responseCycle: { lastSuccessfulPlayerId: 'south', passedPlayerIds: ['west'] } } }, rules), 'PASS_RESET');
      }
      state = result.state;
    }
  });

  it.each([false, true])('accepts finished-leader continuation, immediate reset=%s', (unbeatable) => {
    let state = fixture([[card('8')], [card('4')], [card(unbeatable ? '5' : '9')], [card('6')]]);
    const move: Move = { kind: 'play', playerId: 'south', cards: [card('8')] };
    const result = submitMove(state, move, rules);
    expect(() => assertMoveInvariants(state, move, result, rules)).not.toThrow();
    state = result.state;
    failure(() => assertEngineInvariants(changeContext(state, { currentPlayerId: 'south' }), rules), 'TURN_OWNER');
    if (!unbeatable) {
      for (const playerId of ['north', 'east', 'west']) {
        const pass: Move = { kind: 'pass', playerId };
        const passed = submitMove(state, pass, rules);
        expect(() => assertMoveInvariants(state, pass, passed, rules)).not.toThrow();
        state = passed.state;
      }
      expect(active(state).context.currentPlayerId).toBe('west');
      expect(active(state).context.trick.kind).toBe('freeLead');
    }
  });

  it('diagnoses current-combination corruption, wrong active Turn and Passes carried across a successful response', () => {
    const initial = fixture([[card('4'), card('10')], [card('5'), card('9')], [card('6')], [card('7')]]);
    const first: Move = { kind: 'play', playerId: 'south', cards: [card('4')] };
    const played = submitMove(initial, first, rules);
    const overlap = changeContext(played.state, { trick: { kind: 'response', current: { type: 'single', cards: [card('5')] } } });
    failure(() => assertEngineInvariants(overlap, rules), 'CARD_LOCATION');
    const invalidType = changeContext(played.state, { trick: { kind: 'response', current: { type: 'pair', cards: [card('4')] } } });
    failure(() => assertEngineInvariants(invalidType, rules), 'TRICK');
    const wrongTurn = changeContext(played.state, { currentPlayerId: 'north' });
    expect(() => assertEngineInvariants(wrongTurn, rules)).not.toThrow();
    failure(() => assertMoveInvariants(initial, first, { ...played, state: wrongTurn }, rules), 'TURN_OWNER');
    const passed = submitMove(played.state, { kind: 'pass', playerId: 'west' }, rules);
    const move: Move = { kind: 'play', playerId: 'north', cards: [card('6')] };
    const response = submitMove(passed.state, move, rules);
    expect(() => assertMoveInvariants(passed.state, move, response, rules)).not.toThrow();
    const round = active(response.state);
    const corrupt = { ...response.state, round: { ...round, responseCycle: { lastSuccessfulPlayerId: 'north', passedPlayerIds: ['west'] } } };
    expect(() => assertEngineInvariants(corrupt, rules)).not.toThrow();
    failure(() => assertMoveInvariants(passed.state, move, { ...response, state: corrupt }, rules), 'PASS_RESET');
    for (const passedPlayerIds of [['west', 'west'], ['north'], ['unknown'], ['east']]) {
      failure(() => assertEngineInvariants({ ...response.state, round: { ...round, responseCycle: { lastSuccessfulPlayerId: 'north', passedPlayerIds } } }, rules), 'PASS_RESET');
    }
  });

  it('rejects impossible Round lifecycle and finished-player states', () => {
    const state = opening();
    failure(() => assertEngineInvariants({ ...state, round: null }, rules), 'ROUND_LIFECYCLE');
    failure(() => assertEngineInvariants({ ...state, roundNumber: 2 }, rules), 'ROUND_LIFECYCLE');
    failure(() => assertEngineInvariants({ ...state, kind: 'completed' }, rules), 'SESSION_LIFECYCLE');
    failure(() => assertEngineInvariants(changeContext(state, { roundActive: false }), rules), 'ROUND_LIFECYCLE');
    const empty = fixture([[], [card('4')], [card('5')], [card('6')]]);
    failure(() => assertEngineInvariants(empty, rules), 'FINISHED_PLAYER');
    const round = active(empty);
    const finished = { ...empty, round: { ...round, finishOrder: ['south'], context: {
      ...round.context, currentPlayerId: 'west', players: round.context.players.map((player) => ({ ...player, active: player.hand.length > 0 })),
    } } };
    expect(() => assertEngineInvariants(finished, rules)).not.toThrow();
  });

  it.each([27, 2701])('checks every Move and checkpoint through five deterministic Rounds (seed %s)', (initialSeed) => {
    let seed = initialSeed;
    const rng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
    let state = createSession(ids).state;
    let acceptedCount = 0;
    for (let roundNumber = 1; roundNumber <= 5; roundNumber += 1) {
      state = startRound(state, rng).state;
      assertEngineInvariants(state, rules);
      let turns = 0;
      while (state.round?.kind === 'inProgress' && turns++ < 500) {
        const { context } = state.round;
        const hand = context.players.find((player) => player.playerId === context.currentPlayerId)!.hand;
        const moves = context.trick.kind === 'response'
          ? generateLegalResponseMoves(hand, context.currentPlayerId, context.trick.current, rules)
          : context.trick.kind === 'opening' ? generateLegalOpeningMoves(hand, context.currentPlayerId, rules)
            : generateLegalFreeLeadMoves(hand, context.currentPlayerId, rules);
        const move = moves.find((candidate) => candidate.kind === 'play') ?? moves[0]!;
        const before = JSON.parse(JSON.stringify(state)) as BasicSessionState;
        const result = submitMove(state, move, rules);
        expect(result.accepted).toBe(true);
        assertMoveInvariants(before, move, result, rules);
        expect(state).toEqual(before);
        state = result.state;
        acceptedCount += 1;
      }
      expect(state.round?.kind).toBe('completed');
      expect(state.completedRounds).toHaveLength(roundNumber);
      assertEngineInvariants(state, rules);
      const pass: Move = { kind: 'pass', playerId: 'south' };
      const rejected = submitMove(state, pass, rules);
      expect(rejected.accepted).toBe(false);
      assertMoveInvariants(state, pass, rejected, rules);
      failure(() => assertMoveInvariants(state, pass, { accepted: true, state, events: [] }, rules), 'ACCEPTED_MOVE');
    }
    expect(acceptedCount).toBeGreaterThan(100);
    expect(state.kind).toBe('completed');
    expect(state.standings.reduce((total, entry) => total + entry.totalScore, 0)).toBe(50);
    expect(() => startRound(state, rng)).toThrow('completion');
    failure(() => assertEngineInvariants({ ...state, completedRounds: [...state.completedRounds, state.completedRounds[0]!] }, rules), 'SESSION_LIFECYCLE');
    failure(() => assertEngineInvariants({ ...state, standings: state.standings.map((entry, index) => index === 0 ? { ...entry, totalScore: entry.totalScore + 1 } : entry) }, rules), 'SESSION_TOTALS');
    failure(() => assertEngineInvariants({ ...state, completedRounds: state.completedRounds.map((round, index) => index === 0 ? { placements: round.placements.map((entry) => ({ ...entry, points: 0 as const })) } : round) }, rules), 'PLACEMENTS');
    failure(() => assertEngineInvariants({ ...state, result: { ...state.result!, winnerIds: ['unknown'] } }, rules), 'SESSION_RESULT');
  });
});

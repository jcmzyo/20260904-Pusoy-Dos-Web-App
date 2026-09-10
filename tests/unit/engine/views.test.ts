import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/domain';
import { createSession, startRound, submitMove, getPlayerView, getPublicView, defaultRuleset, generateLegalOpeningMoves, generateLegalFreeLeadMoves, generateLegalResponseMoves } from '../../../src/engine';
import type { PlayerView } from '../../../src/engine';
import type { BasicSessionState } from '../../../src/engine/sessions/resolveBasicSession';

const ids = ['south', 'west', 'north', 'east'];
const identity = (card: Card) => `${card.rank}-${card.suit}`;
function objects(value: unknown): object[] {
  if (value === null || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(objects)];
}
function visibleCards(value: unknown): string[] {
  return objects(value).filter((entry) => 'rank' in entry && 'suit' in entry).map((entry) => identity(entry as Card));
}
function chooseMove(view: PlayerView) {
  const trick = view.round!.trick!;
  const moves = trick.kind === 'response'
    ? generateLegalResponseMoves(view.hand, view.playerId, trick.current, defaultRuleset)
    : trick.kind === 'opening'
      ? generateLegalOpeningMoves(view.hand, view.playerId, defaultRuleset)
      : generateLegalFreeLeadMoves(view.hand, view.playerId, defaultRuleset);
  return moves.find((move) => move.kind === 'play' && move.cards.length === 1) ?? moves[0]!;
}

describe('information-safe Engine views', () => {
  it('projects initial Session progress and rejects unknown participants', () => {
    const state = createSession(ids).state;
    expect(getPublicView(state)).toEqual({
      mode: 'basic', status: 'inProgress', playerIds: ids, roundNumber: 0, round: null,
      completedRounds: [], standings: state.standings, result: null,
    });
    for (const playerId of ids) expect(getPlayerView(state, playerId)).toEqual({ ...getPublicView(state), playerId, hand: [] });
    expect(() => getPlayerView(state, 'unknown')).toThrow('participant');
    const started = startRound(state, { next: () => 0 }).state;
    expect(() => getPlayerView(started, 'unknown')).toThrow('participant');
    if (started.round?.kind !== 'inProgress') throw new Error('Expected active Round');
    const corrupted = { ...started, round: { ...started.round, context: { ...started.round.context, players: started.round.context.players.slice(1) } } };
    expect(() => getPlayerView(corrupted, ids[0]!)).toThrow('current Round');
  });

  it('shows only each owner their hand and is insensitive to opponent ownership and hand ordering', () => {
    const state = startRound(createSession(ids).state, { next: () => 0 }).state;
    if (state.round?.kind !== 'inProgress') throw new Error('Expected active Round');
    const publicView = getPublicView(state);
    expect(visibleCards(publicView)).toEqual([]);
    expect(publicView.round).toEqual({
      status: 'inProgress', players: ids.map((playerId) => ({ playerId, cardCount: 13, finished: false })),
      currentPlayerId: state.round.context.currentPlayerId, trick: { kind: 'opening' }, playedCards: [], finishOrder: [],
    });
    for (const player of state.round.context.players) {
      const view = getPlayerView(state, player.playerId);
      expect(view.hand).toEqual(player.hand);
      expect(visibleCards(view)).toEqual(player.hand.map(identity));
      const opponents = state.round.context.players.filter((entry) => entry.playerId !== player.playerId);
      const swapped: BasicSessionState = { ...state, round: { ...state.round, context: { ...state.round.context,
        players: state.round.context.players.map((entry) => entry.playerId === player.playerId ? entry : {
          ...entry, hand: [...opponents[(opponents.indexOf(entry) + 1) % opponents.length]!.hand].reverse(),
        }),
      } } };
      expect(getPublicView(swapped)).toEqual(publicView);
      expect(getPlayerView(swapped, player.playerId)).toEqual(view);
    }
  });

  it('preserves public played cards across Passes and Trick reset, without changing rejected views', () => {
    let state = startRound(createSession(ids).state, { next: () => 0 }).state;
    const playerId = getPublicView(state).round!.currentPlayerId!;
    const move = chooseMove(getPlayerView(state, playerId));
    if (move.kind !== 'play') throw new Error('Expected opening Play');
    state = submitMove(state, move, defaultRuleset).state;
    expect(getPublicView(state).round!.trick).toEqual({ kind: 'response', current: { type: 'single', cards: move.cards } });
    expect(getPublicView(state).round!.playedCards).toEqual(move.cards);
    const before = getPlayerView(state, playerId);
    const rejected = submitMove(state, move, defaultRuleset);
    expect(rejected.accepted).toBe(false);
    expect(getPlayerView(rejected.state, playerId)).toEqual(before);
    for (let index = 0; index < 3; index += 1) {
      const currentPlayerId = getPublicView(state).round!.currentPlayerId!;
      state = submitMove(state, { kind: 'pass', playerId: currentPlayerId }, defaultRuleset).state;
      expect(getPublicView(state).round!.playedCards).toEqual(move.cards);
    }
    expect(getPublicView(state).round!.trick).toEqual({ kind: 'freeLead' });
    expect(getPublicView(state).round!.currentPlayerId).toBe(playerId);
  });

  it('supports five Rounds using only views for decisions and excludes private data at every lifecycle stage', () => {
    let seed = 26;
    const rng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
    let state = createSession(ids).state;
    const snapshots: BasicSessionState[] = [state];
    for (let roundNumber = 1; roundNumber <= 5; roundNumber += 1) {
      state = startRound(state, rng).state;
      const played = new Set<string>();
      let turns = 0;
      while (getPublicView(state).round!.status === 'inProgress' && turns++ < 400) {
        const view = getPublicView(state);
        expect(view.roundNumber).toBe(roundNumber);
        expect(new Set(view.round!.playedCards.map(identity))).toEqual(played);
        const move = chooseMove(getPlayerView(state, view.round!.currentPlayerId!));
        const result = submitMove(state, move, defaultRuleset);
        expect(result.accepted).toBe(true);
        if (move.kind === 'play') for (const card of move.cards) played.add(identity(card));
        state = result.state;
        const after = getPublicView(state);
        expect(new Set(visibleCards(after))).toEqual(played);
        for (const playerId of ids) {
          const playerView = getPlayerView(state, playerId);
          const round = state.round!;
          const players = round.kind === 'inProgress' ? round.context.players : round.players;
          expect(playerView.hand).toEqual(players.find((player) => player.playerId === playerId)!.hand);
          const allowed = new Set([...played, ...playerView.hand.map(identity)]);
          expect(visibleCards(playerView).every((card) => allowed.has(card))).toBe(true);
          expect(playerView.round!.players).toEqual(players.map((player) => ({
            playerId: player.playerId, cardCount: player.hand.length, finished: round.finishOrder.includes(player.playerId),
          })));
        }
        if (snapshots.length === 1) snapshots.push(state);
      }
      expect(turns).toBeLessThan(400);
      const view = getPublicView(state);
      expect(view.round).toMatchObject({ status: 'completed', currentPlayerId: null, trick: null });
      expect(view.completedRounds).toEqual(state.completedRounds);
      expect(view.completedRounds).toHaveLength(roundNumber);
      expect(view.standings).toEqual(state.standings);
      const last = view.completedRounds.at(-1)!.placements.find((entry) => entry.placement === 4)!.playerId;
      expect(getPlayerView(state, last).hand.length).toBeGreaterThan(0);
      expect(view.round!.players.find((player) => player.playerId === last)!.finished).toBe(false);
      snapshots.push(state);
    }
    expect(getPublicView(state)).toMatchObject({ status: 'completed', result: state.result });
    expect(getPublicView(state).result).not.toBeNull();

    for (const snapshot of snapshots) {
      const baseline = JSON.stringify(snapshot);
      const view = getPlayerView(snapshot, ids[0]!);
      const internals = new Set(objects(snapshot));
      expect(objects(view).some((entry) => internals.has(entry))).toBe(false);
      for (const entry of objects(view)) Reflect.set(entry, 'privateProbe', 'consumer mutation');
      expect(JSON.stringify(snapshot)).toBe(baseline);
      const cleanView = getPlayerView(snapshot, ids[0]!);
      for (const entry of objects(snapshot)) Reflect.set(entry, 'privateProbe', { hiddenHand: ['secret'], rngState: 123 });
      expect(getPlayerView(snapshot, ids[0]!)).toEqual(cleanView);
      expect(JSON.stringify(getPublicView(snapshot))).not.toContain('privateProbe');
    }
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { Card, Move } from '../../../src/domain';
import { SessionPresentation } from '../../../src/application/SessionPresentation';
import type { StartedSession } from '../../../src/application/startSession';
import { createSessionConfiguration, startSession } from '../../../src/application/startSession';
import { createSession, defaultRuleset, getCompletedRoundReveal, getPlayerView, getPublicView, startRound } from '../../../src/engine';
import type { GameEvent } from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerController, PlayerTurnRequest } from '../../../src/orchestrator';

const ids = ['south', 'west', 'north', 'east'];
const identity = (card: Card) => `${card.rank}-${card.suit}`;
function visibleCards(value: unknown): string[] {
  if (value === null || typeof value !== 'object') return [];
  if ('rank' in value && 'suit' in value) return [identity(value as Card)];
  return Object.values(value).flatMap(visibleCards);
}
const singleFirst = (request: PlayerTurnRequest): Move => request.legalMoves.find((move) => move.kind === 'play' && move.cards.length === 1) ?? request.legalMoves[0]!;

function fixture(choose = singleFirst) {
  let seed = 26;
  const engineRng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
  const created = createSession(ids);
  const started = startRound(created.state, engineRng);
  const controllers = ids.map((playerId) => ({ playerId, chooseMove: async (request: PlayerTurnRequest) => choose(request) }));
  const session: StartedSession = {
    runner: new GameRunner(started.state, defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])), true),
    humanController: controllers[0]!, engineRng, initialView: getPublicView(started.state),
    startupEvents: [...created.events, ...started.events], names: { south: 'You', west: 'One', north: 'Two', east: 'Three' },
  };
  return { session, state: started.state, presentation: new SessionPresentation(session) };
}

describe('production Session presentation', () => {
  it('maps startup seats and only the human hand without requesting a controller', () => {
    const chooseMove = vi.fn(singleFirst);
    const { session, state, presentation } = fixture(chooseMove);
    const snapshot = presentation.getSnapshot();
    expect(snapshot.status).toBe('ROUND_ACTIVE');
    expect(snapshot.roundNumber).toBe(1);
    expect(snapshot.center).toEqual({ kind: 'opening' });
    expect(snapshot.currentPlayerId).toBe(getPublicView(state).round!.currentPlayerId);
    expect(snapshot.seats).toEqual(ids.map((playerId) => ({
      seat: playerId, playerId, name: session.names[playerId], cardCount: 13, totalScore: 0,
      isCurrentTurn: playerId === snapshot.currentPlayerId, passed: false, done: false, placement: null,
    })));
    expect(snapshot.humanHand).toEqual(getPlayerView(state, 'south').hand);
    expect(visibleCards(snapshot)).toEqual(snapshot.humanHand.map(identity));
    expect(snapshot.reveal).toBeNull();
    expect(snapshot.roundCheckpoint).toBeNull();
    expect(snapshot.sessionResult).toBeNull();
    expect(snapshot.events).toEqual(session.startupEvents);
    expect(snapshot.roundEvents.map((event) => event.type)).toEqual(['ROUND_STARTED', 'CARDS_DEALT', 'TURN_CHANGED']);
    expect(chooseMove).not.toHaveBeenCalled();
  });

  it('preserves the center through Passes, clears PASS on a Play/reset, and publishes immutable snapshots', async () => {
    let pass = false;
    const { session, presentation } = fixture((request) => pass ? { kind: 'pass', playerId: request.playerId } : singleFirst(request));
    const listener = vi.fn();
    const unsubscribe = presentation.subscribe(listener);
    const initial = presentation.getSnapshot();
    expect(presentation.getSnapshot()).toBe(initial);
    await presentation.runTurn();
    const played = presentation.getSnapshot();
    expect(played.center.kind).toBe('hand');
    expect(played.playedCards).toHaveLength(1);
    pass = true;
    const passer = played.currentPlayerId;
    await presentation.runTurn();
    expect(presentation.getSnapshot().center).toEqual(played.center);
    expect(presentation.getSnapshot().playedCards).toEqual(played.playedCards);
    expect(presentation.getSnapshot().seats.find((seat) => seat.playerId === passer)?.passed).toBe(true);
    pass = false;
    await presentation.runTurn();
    expect(presentation.getSnapshot().seats.every((seat) => !seat.passed)).toBe(true);
    pass = true;
    for (let index = 0; index < 3; index++) await presentation.runTurn();
    expect(presentation.getSnapshot().center).toEqual({ kind: 'freeLead' });
    expect(presentation.getSnapshot().seats.every((seat) => !seat.passed)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(6);
    expect(initial.playedCards).toEqual([]);
    expect(Reflect.set(initial.humanHand[0]!, 'rank', '2')).toBe(false);
    expect(Reflect.set(initial.events[0]!, 'privateProbe', 'secret')).toBe(false);
    expect(presentation.getSnapshot().events.slice(0, session.startupEvents.length)).toEqual(session.startupEvents);
    unsubscribe();
    pass = false;
    await presentation.runTurn();
    expect(listener).toHaveBeenCalledTimes(6);
  });

  it('keeps rejection/failure out of public history and exposes no Engine state in Turn results', async () => {
    let reject = true;
    const { presentation } = fixture((request) => {
      if (!reject) throw new Error('controller failure');
      return { kind: 'pass', playerId: request.playerId };
    });
    const before = presentation.getSnapshot();
    const listener = vi.fn();
    presentation.subscribe(listener);
    expect(await presentation.runTurn()).toMatchObject({ accepted: false, error: { code: 'PASS_NOT_ALLOWED' } });
    expect(presentation.getSnapshot()).toBe(before);
    reject = false;
    await expect(presentation.runTurn()).rejects.toThrow('Controller failed');
    expect(presentation.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('maps all five production Rounds with ordered events and an explicit fourth-hand reveal boundary', async () => {
    const { session, presentation } = fixture();
    const runTurn = vi.spyOn(session.runner, 'runTurn');
    const history: GameEvent[] = [...session.startupEvents];
    let sawDone = false;
    let sawBotReveal = false;
    for (let roundNumber = 1; roundNumber <= 5; roundNumber++) {
      let turns = 0;
      while (presentation.getSnapshot().status === 'ROUND_ACTIVE' && turns++ < 400) {
        expect(presentation.getSnapshot().reveal).toBeNull();
        expect(await presentation.runTurn()).toEqual({ accepted: true });
        const result = await runTurn.mock.results.at(-1)!.value;
        history.push(...result.events);
        const snapshot = presentation.getSnapshot();
        const publicView = getPublicView(result.state);
        expect(snapshot.events).toEqual(history);
        expect(snapshot.roundEvents).toEqual(history.filter((event) => 'roundNumber' in event && event.roundNumber === roundNumber));
        expect(snapshot.playedCards).toEqual(publicView.round!.playedCards);
        expect(snapshot.currentPlayerId).toBe(publicView.round!.currentPlayerId);
        expect(snapshot.standings).toEqual(publicView.standings);
        expect(snapshot.completedRounds).toEqual(publicView.completedRounds);
        for (const seat of snapshot.seats) {
          const player = publicView.round!.players.find((entry) => entry.playerId === seat.playerId)!;
          expect(seat.cardCount).toBe(player.cardCount);
          expect(seat.done).toBe(player.finished);
          expect(seat.totalScore).toBe(publicView.standings.find((entry) => entry.playerId === seat.playerId)!.totalScore);
          if (seat.done) {
            sawDone = true;
            expect(seat.placement).toBe(publicView.round!.finishOrder.indexOf(seat.playerId) + 1);
          }
        }
        const allowed = new Set([...snapshot.humanHand, ...publicView.round!.playedCards, ...(snapshot.reveal?.cards ?? [])].map(identity));
        expect(visibleCards({ ...snapshot, events: snapshot.roundEvents, completedRounds: [] }).every((card) => allowed.has(card))).toBe(true);
        if (publicView.round!.status === 'inProgress') {
          expect(getCompletedRoundReveal(result.state)).toBeNull();
          for (const bot of ids.slice(1)) {
            const visible = new Set(visibleCards({ ...snapshot, events: snapshot.roundEvents }));
            expect(getPlayerView(result.state, bot).hand.some((card) => visible.has(identity(card)))).toBe(false);
          }
        } else {
          const fourth = publicView.completedRounds.at(-1)!.placements.find((entry) => entry.placement === 4)!;
          expect(snapshot.reveal).toEqual({ roundNumber, playerId: fourth.playerId, cards: getPlayerView(result.state, fourth.playerId).hand });
          expect(snapshot.reveal!.cards.length).toBeGreaterThan(0);
          sawBotReveal ||= fourth.playerId !== 'south';
          expect(snapshot.roundCheckpoint).toEqual(session.runner.getRoundResultCheckpoint()!.view.completedRounds.at(-1));
          expect(snapshot.seats.find((seat) => seat.playerId === fourth.playerId)).toMatchObject({ done: false, placement: 4 });
          expect(snapshot.center.kind).toBe('hand');
          expect(snapshot.sessionResult).toEqual(publicView.result);
          expect(new Set(snapshot.playedCards.map(identity)).size + snapshot.reveal!.cards.length).toBe(52);
          const revealed = getCompletedRoundReveal(result.state)!;
          Reflect.set(revealed.cards[0]!, 'rank', 'invalid');
          expect(getCompletedRoundReveal(result.state)).toEqual(snapshot.reveal);
        }
      }
      expect(turns).toBeLessThan(400);
      expect(presentation.getSnapshot().completedRounds).toHaveLength(roundNumber);
      if (roundNumber < 5) {
        expect(presentation.getSnapshot().status).toBe('ROUND_RESULT');
        presentation.continueToNextRound();
        history.push(...presentation.getSnapshot().roundEvents);
        expect(presentation.getSnapshot()).toMatchObject({ roundNumber: roundNumber + 1, reveal: null, roundCheckpoint: null, center: { kind: 'opening' }, playedCards: [] });
        expect(presentation.getSnapshot().seats.every((seat) => !seat.done && !seat.passed && seat.placement === null)).toBe(true);
      }
    }
    expect(sawDone).toBe(true);
    expect(sawBotReveal).toBe(true);
    expect(presentation.getSnapshot().status).toBe('SESSION_COMPLETE');
    expect(presentation.getSnapshot().sessionResult).not.toBeNull();
    const final = presentation.getSnapshot();
    expect(() => presentation.continueToNextRound()).toThrow('Continuation requires');
    expect(presentation.getSnapshot()).toBe(final);
  });

  it('uses the unchanged production Baseline and human controller path', async () => {
    const session = startSession<PlayerController>(createSessionConfiguration(), { engineRng: { next: () => 0 }, humanController: { playerId: 'south', chooseMove: async (request) => singleFirst(request) } });
    const presentation = new SessionPresentation(session);
    for (let index = 0; index < 4; index++) expect(await presentation.runTurn()).toEqual({ accepted: true });
    expect(presentation.getSnapshot().events.length).toBeGreaterThan(session.startupEvents.length);
    expect(presentation.getSnapshot().reveal).toBeNull();
  });

  it('does not offer a reveal before a deal', () => {
    expect(getCompletedRoundReveal(createSession(ids).state)).toBeNull();
  });
});

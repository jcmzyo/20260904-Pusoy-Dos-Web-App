import { describe, expect, it, vi } from 'vitest';
import type { Card, Move } from '../../../src/domain';
import { SessionPresentation } from '../../../src/application/SessionPresentation';
import type { StartedSession } from '../../../src/application/startSession';
import { createSessionConfiguration, startSession } from '../../../src/application/startSession';
import { createSession, defaultRuleset, getCompletedRoundReveal, getPlayerView, getPublicView, startRound } from '../../../src/engine';
import type { GameEvent } from '../../../src/engine';
import { GameRunner, HumanController } from '../../../src/orchestrator';
import type { PlayerController, PlayerTurnRequest } from '../../../src/orchestrator';

const ids = ['south', 'west', 'north', 'east'];
const identity = (card: Card) => `${card.rank}-${card.suit}`;
function visibleCards(value: unknown): string[] {
  if (value === null || typeof value !== 'object') return [];
  if ('rank' in value && 'suit' in value) return [identity(value as Card)];
  return Object.values(value).flatMap(visibleCards);
}
const singleFirst = (request: PlayerTurnRequest): Move => request.legalMoves.find((move) => move.kind === 'play' && move.cards.length === 1) ?? request.legalMoves[0]!;

function fixture(choose = singleFirst, initialSeed = 26) {
  let seed = initialSeed;
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
      lastPlay: null,
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
    let closingPasser: string | null = null;
    for (let index = 0; index < 3; index++) {
      closingPasser = presentation.getSnapshot().currentPlayerId;
      // eslint-disable-next-line no-await-in-loop
      await presentation.runTurn();
    }
    expect(presentation.getSnapshot().center).toEqual({ kind: 'freeLead' });
    // The 3rd of these Passes is what closes the response cycle (GameEngine.submitMove emits
    // PLAYER_PASSED and TRICK_ENDED together in that same Turn) - that seat's own PASS status still
    // shows through the reset (M4-T13 UI refinement follow-up: "the player passed but no Pass
    // indicator on the seat panel"), unlike an ordinary Play/reset which clears it for everyone.
    expect(presentation.getSnapshot().seats.filter((seat) => seat.passed).map((seat) => seat.playerId)).toEqual([closingPasser]);
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

  it('returns null/false, without throwing, for a Controller that offers no pending-request/resolve-move contract (M4-T08)', () => {
    const { presentation } = fixture();
    expect(presentation.getPendingHumanRequest()).toBeNull();
    expect(presentation.resolveHumanMove('anything', { kind: 'pass', playerId: 'south' })).toBe(false);
  });

  it('exposes a real HumanController\'s pending request, resolves it, and self-drives Turns via startAutoPlay (M4-T08)', async () => {
    let seed = 11;
    const engineRng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
    const created = createSession(ids);
    const started = startRound(created.state, engineRng);
    const human = new HumanController('south');
    const bots: readonly PlayerController[] = ids
      .filter((id) => id !== 'south')
      .map((playerId) => ({ playerId, chooseMove: async (request: PlayerTurnRequest) => request.legalMoves[0]! }));
    const controllers = new Map<string, PlayerController>([human, ...bots].map((controller) => [controller.playerId, controller]));
    const session: StartedSession = {
      runner: new GameRunner(started.state, defaultRuleset, controllers, true),
      humanController: human, engineRng, initialView: getPublicView(started.state),
      startupEvents: [...created.events], names: { south: 'You', west: 'W', north: 'N', east: 'E' },
    };
    const presentation = new SessionPresentation(session);

    expect(presentation.getPendingHumanRequest()).toBeNull();
    // Zero delay keeps this deterministic/fast; the delay itself is covered by its own test below.
    presentation.startAutoPlay(0);
    await vi.waitFor(() => expect(presentation.getPendingHumanRequest()).not.toBeNull());
    const request = presentation.getPendingHumanRequest()!;
    const eventsBefore = presentation.getSnapshot().events.length;
    expect(presentation.resolveHumanMove(request.requestId, request.legalMoves[0]!)).toBe(true);
    // A stale/duplicate resolution of the same (now-consumed) request is rejected, matching
    // HumanController.resolveMove's own contract.
    expect(presentation.resolveHumanMove(request.requestId, request.legalMoves[0]!)).toBe(false);
    // Proves startAutoPlay is actually driving Turns end-to-end through the real GameRunner,
    // without asserting who is on the clock next — bots may legally pass all the way back around
    // to South, so which seat plays next is not deterministic and must not be asserted here.
    await vi.waitFor(() => expect(presentation.getSnapshot().events.length).toBeGreaterThan(eventsBefore));
    // A second call is an idempotent no-op rather than a competing driver Turn loop.
    presentation.startAutoPlay();
  });

  it('keeps startAutoPlay driving Turns into the next Round, not only the first (regression: a bot holding 3♣ at the start of Round 2 got stuck indefinitely, because driveTurns exited for good the instant Round 1 ended and nothing ever restarted it)', async () => {
    let seed = 11;
    const engineRng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
    const created = createSession(ids);
    const started = startRound(created.state, engineRng);
    const human = new HumanController('south');
    const preferPlay = (request: PlayerTurnRequest): Move =>
      request.legalMoves.find((move) => move.kind === 'play') ?? request.legalMoves.find((move) => move.kind === 'pass')!;
    const bots: readonly PlayerController[] = ids
      .filter((id) => id !== 'south')
      .map((playerId) => ({ playerId, chooseMove: async (request: PlayerTurnRequest) => preferPlay(request) }));
    const controllers = new Map<string, PlayerController>([human, ...bots].map((controller) => [controller.playerId, controller]));
    const session: StartedSession = {
      runner: new GameRunner(started.state, defaultRuleset, controllers, true),
      humanController: human, engineRng, initialView: getPublicView(started.state),
      startupEvents: [...created.events], names: { south: 'You', west: 'W', north: 'N', east: 'E' },
    };
    const presentation = new SessionPresentation(session);
    // Zero delay keeps this deterministic/fast, same as the fixture above.
    presentation.startAutoPlay(0);

    // Drives Round 1 to its own Result checkpoint exactly as App.tsx does - only ever resolving
    // whichever human input arrives, never calling runTurn() directly - so every bot Turn along the
    // way is genuinely driven by startAutoPlay's own background loop.
    let guard = 0;
    while (presentation.getSnapshot().roundCheckpoint === null && guard++ < 500) {
      await vi.waitFor(() => expect(
        presentation.getPendingHumanRequest() !== null || presentation.getSnapshot().roundCheckpoint !== null,
      ).toBe(true));
      const request = presentation.getPendingHumanRequest();
      if (request) presentation.resolveHumanMove(request.requestId, preferPlay(request));
    }
    expect(guard).toBeLessThan(500);
    expect(presentation.getSnapshot()).toMatchObject({ status: 'ROUND_RESULT', roundNumber: 1 });

    presentation.continueToNextRound();
    expect(presentation.getSnapshot()).toMatchObject({ status: 'ROUND_ACTIVE', roundNumber: 2 });
    // Captured after continueToNextRound() itself (whose own ROUND_STARTED/CARDS_DEALT/TURN_CHANGED
    // publish already moved this count once, on its own, regardless of whether driveTurns is still
    // running) - what this test actually needs is a Turn beyond that, which only driveTurns can cause.
    const eventsAfterContinue = presentation.getSnapshot().events.length;

    // The actual regression: before the fix, nothing above would ever move again - no further public
    // event, and no human request ever surfaced even for a South Turn - because driveTurns' own loop
    // had already returned for good once Round 1 ended.
    await vi.waitFor(() => expect(
      presentation.getPendingHumanRequest() !== null || presentation.getSnapshot().events.length > eventsAfterContinue,
    ).toBe(true));
  });

  it('waits botTurnDelayMs before each bot Turn but never delays the start of the human\'s own Turn (M4-T09 slice)', async () => {
    const { presentation } = fixture();
    // Reach South's Turn with plain manual runTurn() calls first (no delay involved at all, whoever
    // this fixture's Engine seed happens to make the opener) so the fake-timer assertions below only
    // ever have to reason about the one Turn boundary this test actually cares about: South's own Turn
    // (this fixture's `humanController`, `session.humanController.playerId === 'south'`) into the very
    // next (necessarily non-South) bot Turn.
    let guard = 0;
    while (presentation.getSnapshot().currentPlayerId !== 'south' && guard++ < 10) await presentation.runTurn();
    expect(presentation.getSnapshot().currentPlayerId).toBe('south');

    vi.useFakeTimers();
    try {
      presentation.startAutoPlay(500);
      // South's own Turn incurs no delay (a bare Controller fixture resolves synchronously), so it has
      // already resolved and the loop has moved on to gating the next (bot) Turn behind the delay.
      await vi.advanceTimersByTimeAsync(0);
      const afterSouth = presentation.getSnapshot();
      expect(afterSouth.currentPlayerId).not.toBe('south');
      // The next (bot) Turn has not advanced yet - it is waiting out the 500ms presentation delay.
      await vi.advanceTimersByTimeAsync(499);
      expect(presentation.getSnapshot()).toEqual(afterSouth);
      await vi.advanceTimersByTimeAsync(1);
      await vi.waitFor(() => expect(presentation.getSnapshot()).not.toEqual(afterSouth));
    } finally {
      vi.useRealTimers();
    }
  });

  it('tracks each seat\'s own last Play through the response cycle, graying it once beaten, and clears it on free lead (ui-ux.md §5.4)', async () => {
    // Prefers any legal Play over Pass, so a beat is exercised whenever the dealt hands allow one -
    // virtually certain here since an opening Single 3♣ (the lowest possible card) is beaten by almost
    // any other Single.
    const { presentation } = fixture((request) => request.legalMoves.find((move) => move.kind === 'play') ?? request.legalMoves.find((move) => move.kind === 'pass')!);
    const opener = presentation.getSnapshot().currentPlayerId!;
    await presentation.runTurn();
    const afterOpen = presentation.getSnapshot();
    const openCenter = afterOpen.center;
    if (openCenter.kind !== 'hand') throw new Error('Expected the opening Play to produce a current hand.');
    const openerSeat = afterOpen.seats.find((seat) => seat.playerId === opener)!;
    expect(openerSeat.lastPlay).toEqual({ combination: openCenter.combination, beaten: false });
    for (const seat of afterOpen.seats) {
      if (seat.playerId !== opener) expect(seat.lastPlay).toBeNull();
    }

    let sawBeaten = false;
    let turns = 0;
    while (presentation.getSnapshot().center.kind !== 'freeLead' && turns++ < 20) {
      await presentation.runTurn();
      const snapshot = presentation.getSnapshot();
      const center = snapshot.center;
      for (const seat of snapshot.seats) {
        if (!seat.lastPlay) continue;
        // A seat's own trailing Play is beaten exactly when it is no longer the authoritative center hand.
        const isCurrentCenter = center.kind === 'hand' && center.playerId === seat.playerId;
        expect(seat.lastPlay.beaten).toBe(!isCurrentCenter);
        if (seat.lastPlay.beaten) sawBeaten = true;
      }
    }
    expect(presentation.getSnapshot().center.kind).toBe('freeLead');
    expect(sawBeaten).toBe(true);
    // Every per-seat Play trail is cleared once the cycle actually resets to a free lead.
    expect(presentation.getSnapshot().seats.every((seat) => seat.lastPlay === null)).toBe(true);
  });

  it('clears a seat\'s own Play trail the moment that seat itself Passes, replacing it with PASS rather than showing both (ui-ux.md §5.4)', async () => {
    // Once a seat has Played at all, every later request from that same seat prefers Pass (when legal)
    // over playing again - a strategic Pass on a seat that had already Played earlier in the same
    // response cycle, exactly the scenario the person's own follow-up report described.
    const playedOnce = new Set<string>();
    const { presentation } = fixture((request) => {
      if (playedOnce.has(request.playerId)) {
        const passMove = request.legalMoves.find((move) => move.kind === 'pass');
        if (passMove) return passMove;
      }
      const playMove = request.legalMoves.find((move) => move.kind === 'play');
      if (playMove) {
        playedOnce.add(request.playerId);
        return playMove;
      }
      return request.legalMoves.find((move) => move.kind === 'pass')!;
    });

    let turns = 0;
    let sawPlayThenPass = false;
    while (presentation.getSnapshot().center.kind !== 'freeLead' && turns++ < 30) {
      await presentation.runTurn();
      for (const seat of presentation.getSnapshot().seats) {
        // Invariant: a seat that has itself Passed this cycle never also shows a Play trail - its own
        // Pass replaces (rather than joins) any earlier Play indicator from that same cycle.
        if (seat.passed) expect(seat.lastPlay).toBeNull();
        if (seat.passed && playedOnce.has(seat.playerId)) sawPlayThenPass = true;
      }
    }
    // Confirms the scenario actually occurred at least once (a seat that had Played was later seen
    // Passing with its trail already cleared), so the assertion above is not vacuously true.
    expect(sawPlayThenPass).toBe(true);
  });

  it('keeps a seat\'s own cleared Play trail cleared even after a later Play resets `passed` for everyone (M4-T12.5 follow-up: "I passed, but my previous play was still present")', async () => {
    // Same "played once, then Pass" strategy as the test above, but this one specifically drives PAST
    // that seat's own Pass into a later Play by someone else in the same still-open response cycle -
    // the Engine's own `passedPlayerIds` reset (resolveTurnAndPass.ts: a new Play makes every
    // previously-passed player newly eligible to respond again) unconditionally clears
    // SessionPresentation's own `passed` Set too, which used to also let this seat's stale
    // pre-Pass `lastPlaysBySeat` entry (never itself touched by that seat's own Pass) reappear at its
    // seat, reading as though it had just Played again.
    const playedOnce = new Set<string>();
    const { presentation } = fixture((request) => {
      if (playedOnce.has(request.playerId)) {
        const passMove = request.legalMoves.find((move) => move.kind === 'pass');
        if (passMove) return passMove;
      }
      const playMove = request.legalMoves.find((move) => move.kind === 'play');
      if (playMove) {
        playedOnce.add(request.playerId);
        return playMove;
      }
      return request.legalMoves.find((move) => move.kind === 'pass')!;
    });

    let passedAfterPlay: string | null = null;
    // Drives Turns (across as many response cycles as it takes) until some seat that had already
    // Played is observed explicitly Passing (its own trail already cleared, per the invariant the
    // test above covers) with at least one other active seat still left to take a Turn afterward in
    // that same cycle - otherwise there is no later Play left in this cycle to trigger the reset this
    // test targets.
    let guard = 0;
    while (presentation.getSnapshot().status === 'ROUND_ACTIVE' && passedAfterPlay === null && guard++ < 200) {
      await presentation.runTurn();
      const passer = presentation.getSnapshot().seats.find((seat) => seat.passed && playedOnce.has(seat.playerId));
      if (passer) passedAfterPlay = passer.playerId;
    }
    if (passedAfterPlay === null) throw new Error('Expected a seat that had Played to later Pass within the Turn budget.');

    // Continues driving Turns through at least one more Play by someone else (the exact trigger for
    // the Engine's own `passedPlayerIds`/`passed` reset) and asserts the Passed seat's own trail never
    // reappears in the meantime - through this cycle's own free lead, and into the next cycle's Plays,
    // right up until (but not including) this same seat's own next Turn.
    let sawLaterPlay = false;
    while (presentation.getSnapshot().status === 'ROUND_ACTIVE' && !sawLaterPlay && guard++ < 200) {
      const before = presentation.getSnapshot();
      if (before.currentPlayerId === passedAfterPlay) break;
      await presentation.runTurn();
      const after = presentation.getSnapshot();
      if (after.playedCards.length > before.playedCards.length) sawLaterPlay = true;
      const passedSeat = after.seats.find((seat) => seat.playerId === passedAfterPlay)!;
      expect(passedSeat.lastPlay).toBeNull();
    }
    expect(sawLaterPlay).toBe(true);
  });

  it('still shows PASS for the seat whose own Pass closes the response cycle, not only a mid-cycle one (M4-T13 UI refinement follow-up: "the player passed but no Pass indicator on the seat panel ... it doesn\'t happen always")', async () => {
    // Every responder always Passes when Pass is legal (opening a fresh trick never allows Pass, so
    // the current leader is always forced to Play instead) - guaranteed to close the very first
    // response cycle on its 3rd responder's own Pass (GameEngine.submitMove emits PLAYER_PASSED and
    // TRICK_ENDED together in that Pass's own Turn event batch), the exact scenario `project()`'s own
    // passed-Set cleanup used to immediately wipe out again before any snapshot ever showed it.
    const { presentation } = fixture((request) =>
      request.legalMoves.find((move) => move.kind === 'pass') ?? request.legalMoves.find((move) => move.kind === 'play')!);

    let closingPasser: string | null = null;
    let guard = 0;
    while (presentation.getSnapshot().center.kind !== 'freeLead' && guard++ < 20) {
      const before = presentation.getSnapshot();
      await presentation.runTurn();
      const after = presentation.getSnapshot();
      if (before.center.kind !== 'freeLead' && after.center.kind === 'freeLead') {
        // This exact Turn is what closed the cycle - only a responder's own Pass can flip `center`
        // straight from 'hand' to 'freeLead' (the opener's own Play only ever produces 'hand').
        closingPasser = before.currentPlayerId;
        expect(after.seats.find((seat) => seat.playerId === closingPasser)?.passed).toBe(true);
      }
    }
    expect(closingPasser).not.toBeNull();
  });

  it('keeps every seat\'s own Play/Pass trail visible through Round completion itself, only clearing on the next actual Round (round-5 follow-up)', async () => {
    // The Trick that ends the Round (the 3rd-place finisher's own final Play) also always emits a
    // TRICK_ENDED (GameEngine.submitMove), which used to wipe every seat's trail an instant before the
    // person could ever see it - reported as "the last hand played by someone who finished" disappearing
    // right away.
    const { presentation } = fixture((request) => request.legalMoves.find((move) => move.kind === 'play') ?? request.legalMoves.find((move) => move.kind === 'pass')!);
    let turns = 0;
    while (presentation.getSnapshot().status === 'ROUND_ACTIVE' && turns++ < 400) {
      await presentation.runTurn();
    }
    expect(presentation.getSnapshot().status).toBe('ROUND_RESULT');
    const final = presentation.getSnapshot();
    const center = final.center;
    expect(center.kind).toBe('hand');
    if (center.kind !== 'hand') throw new Error('Expected the Round-ending Play to remain the current hand.');
    const finisherSeat = final.seats.find((seat) => seat.playerId === center.playerId)!;
    // The Round-ending Play itself is still visible at its own seat rather than wiped to null - as a
    // retained display, so dimmed like every other finisher's trail (nothing is live on a completed
    // table; `center` merely keeps showing the final hand). The cards themselves are preserved.
    expect(finisherSeat.lastPlay).not.toBeNull();
    expect(finisherSeat.lastPlay!.beaten).toBe(true);
    expect(finisherSeat.lastPlay!.combination).toEqual(center.combination);
    expect(final.seats.every((seat) => seat.lastPlay === null || seat.lastPlay.beaten)).toBe(true);
    // Continuing to the next Round is the actual, deliberate reset boundary.
    presentation.continueToNextRound();
    expect(presentation.getSnapshot().seats.every((seat) => seat.lastPlay === null && !seat.passed)).toBe(true);
  });

  it.each([2, 4])('grays every Play that is no longer the live hand to beat, including a finisher\'s untopped final Play (seed %i)', async (seed) => {
    // Regression: a finisher's final Play stayed at full brightness for the rest of the Round when nobody
    // ever topped it (its `beaten` was frozen from "was it topped?"), but grayed when something did - so
    // the same finisher's trail looked different depending on how its Trick ended, and an untopped one sat
    // beside the live "Current Play" of every later Trick. `beaten` is now simply "not the live hand".
    const { presentation } = fixture((request) => request.legalMoves.find((move) => move.kind === 'play') ?? request.legalMoves.find((move) => move.kind === 'pass')!, seed);
    let staleFinisherSnapshots = 0;
    let turns = 0;
    while (presentation.getSnapshot().status === 'ROUND_ACTIVE' && turns++ < 400) {
      await presentation.runTurn();
      const { center, seats, roundCheckpoint } = presentation.getSnapshot();
      for (const seat of seats) {
        if (!seat.lastPlay) continue;
        // On a completed Round's table `center` only retains the final hand for display - nothing is live.
        const isLiveHand = roundCheckpoint === null && center.kind === 'hand' && center.playerId === seat.playerId;
        expect(seat.lastPlay.beaten, `turn ${turns}: ${seat.playerId}`).toBe(!isLiveHand);
        if (seat.done && !isLiveHand) staleFinisherSnapshots++;
      }
    }
    // The scenario is actually exercised: a finished seat's Play was still showing while it was not the live hand.
    expect(staleFinisherSnapshots).toBeGreaterThan(0);
    // Once the Round has completed nothing is live: every retained trail (the Round-ending finisher's own
    // included, even though `center` still shows that final hand) is dimmed, with its cards preserved.
    const completed = presentation.getSnapshot();
    expect(completed.roundCheckpoint).not.toBeNull();
    const retained = completed.seats.filter((seat) => seat.lastPlay !== null);
    expect(retained.length).toBeGreaterThan(0);
    for (const seat of retained) expect(seat.lastPlay!.beaten, seat.playerId).toBe(true);
    if (completed.center.kind === 'hand') {
      const finisher = completed.seats.find((seat) => seat.playerId === (completed.center as { playerId: string }).playerId)!;
      expect(finisher.lastPlay!.combination).toEqual(completed.center.combination);
    }
  });

  it('keeps a 1st/2nd-place finisher\'s own final Play visible at its seat for the rest of the Round, not only the Round-ending 3rd-place finish (M4-T12.5 follow-up)', async () => {
    // Previously only the Round-ending Trick (the 3rd-place finisher's own final Play, immediately
    // followed by ROUND_ENDED rather than TURN_CHANGED) was exempted from the mid-Round Trick-reset
    // wipe above - an EARLIER finisher's (1st/2nd place) own final Play was wiped the instant that same
    // Trick concluded, reading as if it never happened at all (the person's own follow-up report:
    // inconsistent - "sometimes bots doesn't have their last played hand in their seat panel").
    const { presentation } = fixture((request) => request.legalMoves.find((move) => move.kind === 'play') ?? request.legalMoves.find((move) => move.kind === 'pass')!);
    let turns = 0;
    while (presentation.getSnapshot().status === 'ROUND_ACTIVE' && presentation.getSnapshot().roundEvents.every((event) => event.type !== 'PLAYER_FINISHED') && turns++ < 400) {
      await presentation.runTurn();
    }
    const afterFirstFinish = presentation.getSnapshot();
    const finishedEvent = afterFirstFinish.roundEvents.find((event) => event.type === 'PLAYER_FINISHED');
    if (!finishedEvent || finishedEvent.type !== 'PLAYER_FINISHED') throw new Error('Expected a 1st-place finish within the Turn budget.');
    const finisher = finishedEvent.playerId;
    const finisherSeatNow = afterFirstFinish.seats.find((seat) => seat.playerId === finisher)!;
    expect(finisherSeatNow.lastPlay).not.toBeNull();
    expect(finisherSeatNow.done).toBe(true);

    // Drive further Turns until at least one more full Trick (a fresh free lead) has concluded - the
    // exact mid-Round reset that used to wipe the finisher's own trail.
    let sawFreeLeadAfter = false;
    while (presentation.getSnapshot().status === 'ROUND_ACTIVE' && !sawFreeLeadAfter && turns++ < 400) {
      await presentation.runTurn();
      if (presentation.getSnapshot().center.kind === 'freeLead') sawFreeLeadAfter = true;
    }
    expect(sawFreeLeadAfter).toBe(true);
    const finisherSeatLater = presentation.getSnapshot().seats.find((seat) => seat.playerId === finisher)!;
    // The same combination they actually finished with is still showing - `beaten` itself may have
    // legitimately flipped to true in the meantime (someone else in that same Trick's own continuation
    // topped it before the Trick concluded; finishing is unconditional regardless, requirements.md
    // §2.5.1), which is exactly the frozen, accurate outcome rather than the transient snapshot taken
    // the instant they finished.
    expect(finisherSeatLater.lastPlay).not.toBeNull();
    expect(finisherSeatLater.lastPlay!.combination).toEqual(finisherSeatNow.lastPlay!.combination);
    expect(finisherSeatLater.passed).toBe(false);
  });

  describe('pause/resume (M4-T10; ui-ux.md §9.2: "Orchestrator progression is paused" while an overlay is open)', () => {
    it('pause() halts automatic Turn advancement entirely, and resume() continues from the exact same point', async () => {
      const { presentation } = fixture();
      presentation.startAutoPlay(0);
      // Synchronous, immediately after starting autoplay and before any microtask runs: driveTurns'
      // own first `await` (its pause gate) has not yet resolved, so this is guaranteed to land before
      // the very first automatic Turn - not a race against however many Turns a 0ms-delay loop might
      // otherwise already have completed by the time a `waitFor` polling interval next runs.
      presentation.pause();
      expect(presentation.isPaused()).toBe(true);
      const beforeResume = presentation.getSnapshot();
      // Ample time for the loop to advance if pause were not actually honored (it uses real timers/
      // microtasks with a 0ms configured delay, so anything left unpaused would race far ahead of this).
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(presentation.getSnapshot()).toBe(beforeResume);
      presentation.resume();
      expect(presentation.isPaused()).toBe(false);
      await vi.waitFor(() => expect(presentation.getSnapshot()).not.toBe(beforeResume));
    });

    it('resume() without a prior pause(), and a repeated pause()/resume(), are safe no-ops rather than corrupting the wait queue', async () => {
      const { presentation } = fixture();
      expect(() => presentation.resume()).not.toThrow();
      expect(presentation.isPaused()).toBe(false);
      presentation.pause();
      presentation.pause();
      expect(presentation.isPaused()).toBe(true);
      presentation.resume();
      presentation.resume();
      expect(presentation.isPaused()).toBe(false);
      // The Session still drives normally afterward - pause/resume bookkeeping did not leave it stuck.
      const eventsBefore = presentation.getSnapshot().events.length;
      presentation.startAutoPlay(0);
      await vi.waitFor(() => expect(presentation.getSnapshot().events.length).toBeGreaterThan(eventsBefore));
    });

    it('is reference-counted across independent callers, so one resume() does not unpause a second still-active pause() source (M4-T11: Leave confirmation and the portrait/undersized layout guard can be paused at the same time)', async () => {
      const { presentation } = fixture();
      presentation.startAutoPlay(0);
      presentation.pause(); // e.g. Leave confirmation opens
      presentation.pause(); // e.g. the layout independently becomes unsupported while it is still open
      expect(presentation.isPaused()).toBe(true);
      presentation.resume(); // Leave confirmation closes (Stay)
      // The layout source is still holding it paused - a single idempotent flag (the pre-M4-T11 design)
      // would have incorrectly reported this as unpaused and let the loop run ahead.
      expect(presentation.isPaused()).toBe(true);
      const stillPaused = presentation.getSnapshot();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(presentation.getSnapshot()).toBe(stillPaused);
      presentation.resume(); // the layout becomes supported again
      expect(presentation.isPaused()).toBe(false);
      await vi.waitFor(() => expect(presentation.getSnapshot()).not.toBe(stillPaused));
    });
  });

  describe('destroy (M4-T11 follow-up: Leave Game abandons the Session instead of pausing it forever)', () => {
    it('stops automatic Turn advancement for good, even if resume() is called afterward', async () => {
      const { presentation } = fixture();
      presentation.startAutoPlay(0);
      // Synchronous, immediately after starting autoplay - see the pause/resume tests above for why
      // this ordering is race-free against a 0ms-delay loop's own first pending await.
      presentation.destroy();
      presentation.resume(); // a stray resume (e.g. an in-flight unmount effect) must not resurrect it
      const afterDestroy = presentation.getSnapshot();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(presentation.getSnapshot()).toBe(afterDestroy);
    });

    it('is idempotent and safe to call before startAutoPlay, or more than once', async () => {
      const { presentation } = fixture();
      expect(() => presentation.destroy()).not.toThrow();
      expect(() => presentation.destroy()).not.toThrow();
      // A Session destroyed before it ever started driving Turns never advances one.
      presentation.startAutoPlay(0);
      const afterDestroy = presentation.getSnapshot();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(presentation.getSnapshot()).toBe(afterDestroy);
    });

    it('wakes a driveTurns loop genuinely suspended in pause() and makes it exit for good, rather than leaving it stuck forever', async () => {
      const { presentation } = fixture();
      presentation.pause(); // paused before any Turn ever starts
      presentation.startAutoPlay(0);
      // Lets driveTurns' first waitWhilePaused() actually register its waiter and suspend, rather than
      // racing destroy() against a wait that has not started yet.
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(presentation.isPaused()).toBe(true);
      presentation.destroy();
      // If destroy() only unstuck the wait without making the loop exit, this stray resume() (dropping
      // pauseCount back to 0) would let it continue on and start advancing Turns.
      presentation.resume();
      const afterDestroy = presentation.getSnapshot();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(presentation.getSnapshot()).toBe(afterDestroy);
    });

    it('leaves getSnapshot and an existing subscription safely callable afterward, even though no further updates are published', () => {
      const { presentation } = fixture();
      const listener = vi.fn();
      const unsubscribe = presentation.subscribe(listener);
      presentation.destroy();
      expect(() => presentation.getSnapshot()).not.toThrow();
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('pending human input cannot advance a paused or destroyed Session (M4→P1 review finding, escalated: GameRunner-level Engine submission guard)', () => {
    function humanRequestFixture(botChooseMove?: (request: PlayerTurnRequest) => Promise<Move>) {
      let seed = 11;
      const engineRng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
      const created = createSession(ids);
      const started = startRound(created.state, engineRng);
      const human = new HumanController('south');
      const bots: readonly PlayerController[] = ids
        .filter((id) => id !== 'south')
        .map((playerId) => ({ playerId, chooseMove: botChooseMove ?? (async (request: PlayerTurnRequest) => request.legalMoves[0]!) }));
      const controllers = new Map<string, PlayerController>([human, ...bots].map((controller) => [controller.playerId, controller]));
      const session: StartedSession = {
        runner: new GameRunner(started.state, defaultRuleset, controllers, true),
        humanController: human, engineRng, initialView: getPublicView(started.state),
        startupEvents: [...created.events], names: { south: 'You', west: 'W', north: 'N', east: 'E' },
      };
      return { session, human, presentation: new SessionPresentation(session) };
    }

    // The Engine's own authoritative state, read directly off `GameRunner` rather than through
    // `SessionPresentation`'s own published snapshot - the exact distinction this escalated finding turns
    // on: a fix that only ever suppresses `SessionPresentation`'s own publication could pass every
    // snapshot-only assertion while the underlying Engine Turn had already committed and the current
    // player had already advanced (the finding's own reproduction: "South → West", "North → East").
    // Compared by full serialized content rather than only `currentPlayerId`: with a 0ms-delay autoplay
    // loop still running in the background after a resume(), several further bot Turns can legitimately
    // cycle the current player all the way back around (the existing production fixture test above notes
    // the same thing: "bots may legally pass all the way back around to South") - a bare `currentPlayerId`
    // equality check would then be flaky in exactly the direction that could mask a real regression. The
    // full view can only ever repeat bit-for-bit by returning to a byte-identical game state, which real
    // Card play never does.
    const authoritativeState = (session: StartedSession) => JSON.stringify(session.runner.getPlayerView('south'));

    it.each(['pause', 'destroy'] as const)('ordering 1 - %s called before resolveHumanMove: the pending request is refused outright, left untouched, and authoritative Engine state never advances', async (action) => {
      const { session, human, presentation } = humanRequestFixture();
      presentation.startAutoPlay(0);
      await vi.waitFor(() => expect(presentation.getPendingHumanRequest()).not.toBeNull());
      const request = presentation.getPendingHumanRequest()!;
      const before = presentation.getSnapshot();
      const authBefore = authoritativeState(session);

      presentation[action]();
      // The finding's own reproduction: this used to return `true` and commit the Move regardless.
      expect(presentation.resolveHumanMove(request.requestId, request.legalMoves[0]!)).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(presentation.getSnapshot()).toBe(before);
      expect(authoritativeState(session)).toBe(authBefore);

      if (action === 'pause') {
        // Left genuinely untouched (not consumed/cancelled) - the exact same request is still legitimately
        // resolvable once resumed, rather than requiring any new retry/queueing behavior.
        expect(presentation.getPendingHumanRequest()).toEqual(request);
        presentation.resume();
        expect(presentation.resolveHumanMove(request.requestId, request.legalMoves[0]!)).toBe(true);
        await vi.waitFor(() => expect(presentation.getSnapshot()).not.toBe(before));
        expect(authoritativeState(session)).not.toBe(authBefore);
      } else {
        // Pending-request invalidation: destroy() must not merely refuse the request at the presentation
        // boundary - the underlying HumanController input itself is gone, not left dangling.
        expect(human.getPendingRequest()).toBeNull();
        expect(human.resolveMove(request.requestId, request.legalMoves[0]!)).toBe(false);
        expect(human.cancelPendingRequest(request.requestId)).toBe(false);
        presentation.resume(); // a stray resume after destroy must not resurrect it either
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(presentation.getSnapshot()).toBe(before);
        expect(authoritativeState(session)).toBe(authBefore);
      }
    });

    it.each(['pause', 'destroy'] as const)('reproduction 1 - resolve, then await a microtask tick, then %s: authoritative Engine state still never advances, however many ticks separate acceptance from this call', async (action) => {
      const { session, human, presentation } = humanRequestFixture();
      presentation.startAutoPlay(0);
      await vi.waitFor(() => expect(presentation.getPendingHumanRequest()).not.toBeNull());
      const request = presentation.getPendingHumanRequest()!;
      const before = presentation.getSnapshot();
      const authBefore = authoritativeState(session);

      expect(presentation.resolveHumanMove(request.requestId, request.legalMoves[0]!)).toBe(true);
      // A single fixed microtask hop used to be enough to defeat the prior fix (this escalated finding's
      // own reproduction): GameRunner's own Engine-submission guard re-checks after a macrotask boundary
      // instead, which no number of chained microtask `await`s - this one included - can ever outrun.
      await Promise.resolve();
      presentation[action]();

      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(presentation.getSnapshot()).toBe(before);
      expect(authoritativeState(session)).toBe(authBefore);

      if (action === 'pause') {
        presentation.resume();
        await vi.waitFor(() => expect(presentation.getSnapshot()).not.toBe(before));
        expect(authoritativeState(session)).not.toBe(authBefore);
      } else {
        expect(human.getPendingRequest()).toBeNull();
        presentation.resume();
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(presentation.getSnapshot()).toBe(before);
        expect(authoritativeState(session)).toBe(authBefore);
      }
    });

    it('reproduction 2 - resolve and pause, then resume() immediately followed (same tick) by a fresh pause(): authoritative Engine state still never advances', async () => {
      const { session, presentation } = humanRequestFixture();
      presentation.startAutoPlay(0);
      await vi.waitFor(() => expect(presentation.getPendingHumanRequest()).not.toBeNull());
      const request = presentation.getPendingHumanRequest()!;
      const before = presentation.getSnapshot();
      const authBefore = authoritativeState(session);

      expect(presentation.resolveHumanMove(request.requestId, request.legalMoves[0]!)).toBe(true);
      presentation.pause();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(presentation.getSnapshot()).toBe(before);
      expect(authoritativeState(session)).toBe(authBefore);

      // No `await` between these two calls - the exact race the escalated finding reports: a resume()
      // immediately re-paused before GameRunner's own held Turn ever gets a chance to re-check state.
      presentation.resume();
      presentation.pause();

      await new Promise((resolve) => setTimeout(resolve, 30));
      // Still held - not merely unpublished, the Engine has not committed this Move at all yet.
      expect(presentation.getSnapshot()).toBe(before);
      expect(authoritativeState(session)).toBe(authBefore);

      // A genuine resume (unmatched by any further pause) still lets it through - nothing was lost.
      presentation.resume();
      await vi.waitFor(() => expect(presentation.getSnapshot()).not.toBe(before));
      expect(authoritativeState(session)).not.toBe(authBefore);
    });

    it('reproduction 2 - resolve and pause, then resume() immediately followed (same tick) by destroy(): authoritative Engine state is never committed', async () => {
      const { session, human, presentation } = humanRequestFixture();
      presentation.startAutoPlay(0);
      await vi.waitFor(() => expect(presentation.getPendingHumanRequest()).not.toBeNull());
      const request = presentation.getPendingHumanRequest()!;
      const before = presentation.getSnapshot();
      const authBefore = authoritativeState(session);

      expect(presentation.resolveHumanMove(request.requestId, request.legalMoves[0]!)).toBe(true);
      presentation.pause();
      await new Promise((resolve) => setTimeout(resolve, 30));

      presentation.resume();
      presentation.destroy();

      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(presentation.getSnapshot()).toBe(before);
      expect(authoritativeState(session)).toBe(authBefore);
      expect(human.getPendingRequest()).toBeNull();
      presentation.resume(); // a stray resume must not resurrect a destroyed Session
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(presentation.getSnapshot()).toBe(before);
      expect(authoritativeState(session)).toBe(authBefore);
    });

    it('destroy() while the human request is still genuinely unresolved (nobody ever called resolveHumanMove) invalidates it outright rather than leaving it dangling', async () => {
      const { human, presentation } = humanRequestFixture();
      presentation.startAutoPlay(0);
      await vi.waitFor(() => expect(presentation.getPendingHumanRequest()).not.toBeNull());
      const request = presentation.getPendingHumanRequest()!;

      presentation.destroy();
      expect(human.getPendingRequest()).toBeNull();
      // The identical request the human was about to answer can no longer be resolved or cancelled again -
      // it was actually rejected (invalidating GameRunner's own suspended await), not silently dropped.
      expect(human.resolveMove(request.requestId, request.legalMoves[0]!)).toBe(false);
      expect(human.cancelPendingRequest(request.requestId)).toBe(false);
    });

    // reproduction 3 (escalated finding): a bot's own decision has no `resolveHumanMove`-style external
    // resolution point for pause()/destroy() to intercept before Engine submission - unlike a human
    // response, `HumanController.pause()`/`destroy()` cannot hold this one back at all. GameRunner's own
    // `pauseSubmission()`/`destroy()` (via `commitWhenSubmissionAllowed()`) is what closes this uniformly
    // for every controller instead, so this asserts on authoritative Engine state, not merely publication.
    it.each(['pause', 'destroy'] as const)('reproduction 3 - a bot response held in flight when %s lands must not commit to the Engine, even once its own chooseMove() then resolves', async (action) => {
      // Only the one bot Turn immediately following South's own Move is held - every earlier bot Turn
      // (reaching South's own Turn in the first place requires driving past whichever bots open the
      // Round before South, per seed 11) resolves immediately, exactly like every other test above.
      let delayNextBotMove = false;
      let releaseBotMove: (() => void) | undefined;
      const botDelay = new Promise<void>((resolve) => { releaseBotMove = resolve; });
      const botChooseMove = async (request: PlayerTurnRequest): Promise<Move> => {
        if (delayNextBotMove) { delayNextBotMove = false; await botDelay; }
        return request.legalMoves[0]!;
      };
      const { session, presentation } = humanRequestFixture(botChooseMove);
      presentation.startAutoPlay(0);
      await vi.waitFor(() => expect(presentation.getPendingHumanRequest()).not.toBeNull());
      const request = presentation.getPendingHumanRequest()!;
      delayNextBotMove = true;
      expect(presentation.resolveHumanMove(request.requestId, request.legalMoves[0]!)).toBe(true);
      // South's own Move publishes (exposing the next player already on the clock) well before the next
      // bot's own (held) Turn is even attempted - driveTurns processes Turns strictly one at a time.
      await vi.waitFor(() => expect(presentation.getSnapshot().currentPlayerId).not.toBe(request.playerId));
      const before = presentation.getSnapshot();
      const authBefore = authoritativeState(session);

      // Pauses/destroys while the very next bot's own Turn is still genuinely in flight (its chooseMove()
      // has not resolved yet), then lets it resolve. The finding's own reproduction: "North must not
      // advance to East" - the Engine must not commit this Move at all while paused/destroyed, not merely
      // withhold publishing an already-committed one.
      presentation[action]();
      releaseBotMove!();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(presentation.getSnapshot()).toBe(before);
      expect(authoritativeState(session)).toBe(authBefore);

      if (action === 'pause') {
        presentation.resume();
        await vi.waitFor(() => expect(presentation.getSnapshot()).not.toBe(before));
        expect(authoritativeState(session)).not.toBe(authBefore);
        expect(session.runner.getPlayerView('south').round!.currentPlayerId).toBe(presentation.getSnapshot().currentPlayerId);
      } else {
        presentation.resume(); // a stray resume after destroy must not resurrect it
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(presentation.getSnapshot()).toBe(before);
        expect(authoritativeState(session)).toBe(authBefore);
      }
    });
  });
});

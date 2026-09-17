import type { Card, Combination, Move, PlayerId } from '../domain';
import type { CompletedRoundReveal, GameEvent, PublicGameView } from '../engine';
import type { ControllerTurnResult, PlayerTurnRequest, RunnerStatus, TurnRequestId } from '../orchestrator';
import type { StartedSession } from './startSession';

/**
 * HumanController's own extra (non-`PlayerController`) surface for exposing/resolving pending human
 * input (M4-T02). Duck-typed rather than importing `HumanController` directly so a test's bare
 * `{ playerId, chooseMove }` fixture `humanController` remains a valid `StartedSession` without also
 * implementing these — `getPendingHumanRequest`/`resolveHumanMove` below simply report "no pending
 * request" for such a fixture, which is correct since it never has one.
 */
interface HumanInputExtras {
  readonly getPendingRequest?: () => PlayerTurnRequest | null;
  readonly resolveMove?: (requestId: TurnRequestId, move: Move) => boolean;
}

export interface PresentedSeat {
  readonly seat: 'south' | 'west' | 'north' | 'east';
  readonly playerId: PlayerId;
  readonly name: string;
  readonly cardCount: number;
  readonly totalScore: number;
  readonly isCurrentTurn: boolean;
  readonly passed: boolean;
  readonly done: boolean;
  readonly placement: 1 | 2 | 3 | 4 | null;
  /**
   * This seat's own most recent Play in the active response cycle, and whether it has since been
   * beaten by a later Play (ui-ux.md §5.4: per-seat Play trail). Persists — including once beaten —
   * until the cycle actually resets (a Trick reset/free lead, or a fresh Round), matching `passed`'s
   * own reset boundary for a Trick reset but, unlike `passed`, NOT cleared by every subsequent Play:
   * a beaten Play stays visible (grayed) at that seat until the whole cycle clears. `beaten` is false
   * exactly when this is still the authoritative current hand (`center.kind === 'hand' && center.playerId
   * === this seat`).
   *
   * Also `null` the instant this same seat itself Passes (even on a later Turn within the same cycle,
   * after already Playing once): a seat's own Pass explicitly replaces its own prior Play indicator
   * rather than showing both at once (the person's own follow-up request) — `passed` above is what
   * then drives the PASS label.
   *
   * If the Trick that ends the Round is also the Round's own final Trick (e.g. the 3rd-place finisher's
   * last Play), every seat's trail is deliberately left as-is rather than cleared — otherwise the very
   * Play that ended the Round would disappear an instant before the person ever sees it (round-4 follow-
   * up). It clears normally on the next genuine mid-Round reset, and on the next Round via
   * `continueToNextRound`.
   */
  readonly lastPlay: { readonly combination: Combination; readonly beaten: boolean } | null;
}

export interface SessionPresentationSnapshot {
  readonly status: RunnerStatus;
  readonly roundNumber: number;
  readonly seats: readonly PresentedSeat[];
  readonly humanHand: readonly Card[];
  readonly currentPlayerId: PlayerId | null;
  readonly center: { readonly kind: 'opening' | 'freeLead' | 'empty' }
    | { readonly kind: 'hand'; readonly playerId: PlayerId; readonly combination: Combination };
  readonly playedCards: readonly Card[];
  readonly events: readonly GameEvent[];
  readonly roundEvents: readonly GameEvent[];
  readonly standings: PublicGameView['standings'];
  readonly completedRounds: PublicGameView['completedRounds'];
  readonly roundCheckpoint: PublicGameView['completedRounds'][number] | null;
  readonly sessionResult: PublicGameView['result'];
  readonly reveal: CompletedRoundReveal | null;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Application Turn/continuation boundary: React receives cached safe snapshots, never Engine transactions.
 * Drive this Session through this adapter to retain every public event, including intermediate Turns.
 */
export class SessionPresentation {
  private readonly listeners = new Set<() => void>();
  private snapshot: SessionPresentationSnapshot;
  private autoPlayStarted = false;
  private pauseCount = 0;
  private pauseWaiters: (() => void)[] = [];
  // Woken by `publish()` (every accepted Turn and every `continueToNextRound()`) and by `destroy()`,
  // mirroring `pauseWaiters`' own convention - lets `driveTurns` below block between Rounds without
  // busy-polling instead of exiting outright (see its own docstring for the bug this fixes).
  private roundWaiters: (() => void)[] = [];
  private destroyed = false;

  constructor(private readonly session: StartedSession) {
    this.snapshot = this.project(session.startupEvents);
  }

  readonly getSnapshot = (): SessionPresentationSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  async runTurn(): Promise<{ readonly accepted: true } | Pick<Extract<ControllerTurnResult, { accepted: false }>, 'accepted' | 'error' | 'context'>> {
    const result = await this.session.runner.runTurn();
    if (!result.accepted) return { accepted: false, error: result.error, context: result.context };
    this.publish(result.events);
    return { accepted: true };
  }

  continueToNextRound(): void {
    const result = this.session.runner.continueToNextRound(this.session.engineRng);
    this.publish(result.events);
  }

  /** The pending human input boundary (M4-T02's HumanController), when `humanController` exposes one.
   *  React only needs this at the moment of Play/Pass submission (M4-T08) — whether Play/Pass should be
   *  enabled at all is already derivable from the public snapshot's `status`/`currentPlayerId`. */
  getPendingHumanRequest(): PlayerTurnRequest | null {
    return (this.session.humanController as HumanInputExtras).getPendingRequest?.() ?? null;
  }

  /** Resolves the pending human input through HumanController's own production contract (M4-T02);
   *  returns `false` without throwing if there is no compatible controller or no matching pending
   *  request, so a stray/duplicate submission is always safe. */
  resolveHumanMove(requestId: TurnRequestId, move: Move): boolean {
    return (this.session.humanController as HumanInputExtras).resolveMove?.(requestId, move) ?? false;
  }

  /**
   * Drives the production Turn loop so bot Turns advance without manual polling and the human's Turn
   * naturally becomes reachable — HumanController's Move stays pending until `resolveHumanMove`/its own
   * `resolveMove` is called, so this simply keeps requesting the next Turn once each prior one settles.
   * Idempotent per Session (callers do not need to guard repeat calls, e.g. across React StrictMode).
   *
   * Before starting each bot's Turn, waits `botTurnDelayMs` — a short, tunable presentation pause
   * (ui-ux.md §8, originally "initially around 0.6-1.0 seconds per bot action"; raised to 1.5s and then
   * back down to 0.8s across two follow-up requests once the person could see it in practice — a
   * pending doc amendment covers the current number), separate from and additional to the Baseline's
   * own (effectively instant) computation time, so bot actions read as deliberate turns rather than
   * flashing by instantly. Never delays the
   * human's own Turn (`runTurn()` for the human only registers the pending request and returns once a
   * Move is submitted — delaying that would just delay showing Play/Pass controls). Callers needing a
   * fast/deterministic loop (tests) should pass `0`.
   *
   * Full stale-input protection across Turn transitions beyond this is still M4-T09's job. This exists
   * only so a human Turn is reachable at all outside a test's own manual `runTurn` loop.
   */
  startAutoPlay(botTurnDelayMs: number = 800): void {
    if (this.autoPlayStarted) return;
    this.autoPlayStarted = true;
    void this.driveTurns(botTurnDelayMs);
  }

  /**
   * Pauses automatic Turn advancement (M4-T10; ui-ux.md §9.2: "While either overlay is open,
   * Orchestrator progression is paused so bot actions do not occur unseen"). Only `driveTurns`'s own
   * loop below observes this — a human Turn already sits idle awaiting HumanController's own pending
   * Move regardless of pause state, and `continueToNextRound` (an explicit user action, not automatic
   * advancement) is intentionally unaffected.
   *
   * Reference-counted rather than a single idempotent flag: M4-T11 added independent pause sources
   * (Leave confirmation, and the portrait/undersized layout guard) that can be active at the same time
   * as each other or as an open Discard Pile/Event Log overlay — e.g. the window is resized to an
   * unsupported size while Leave confirmation is already open. Each `pause()` must be matched by exactly
   * one `resume()`; advancement only actually resumes once every caller that paused it has resumed.
   */
  pause(): void {
    this.pauseCount += 1;
  }

  /** Resumes automatic Turn advancement once every `pause()` call has been matched by a `resume()`.
   *  A `resume()` with no outstanding `pause()` is a no-op rather than going negative. */
  resume(): void {
    if (this.pauseCount === 0) return;
    this.pauseCount -= 1;
    if (this.pauseCount > 0) return;
    const waiters = this.pauseWaiters.splice(0);
    waiters.forEach((resolve) => resolve());
  }

  isPaused(): boolean {
    return this.pauseCount > 0;
  }

  /**
   * Permanently abandons this Session's presentation (M4-T11 follow-up: Leave Game). Unlike
   * `pause()`/`resume()` — for temporary interruptions (an open overlay, an unsupported viewport)
   * that resume the SAME Session — leaving the table gives up on the Session outright, so this makes
   * `driveTurns`'s background loop actually exit rather than parking it forever on an unmatched extra
   * `pause()`: a permanent pause would leave that loop suspended on a `pauseWaiters` Promise that never
   * resolves, keeping this object (and its closure over `session`/`listeners`) reachable for as long as
   * anything still holds a reference to it. `destroy()` instead lets the loop return and this instance
   * become eligible for garbage collection once the caller (App.tsx) drops its own reference.
   *
   * Idempotent — a repeat call is a safe no-op — and safe regardless of pause state or whether
   * `startAutoPlay` was ever called at all.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const waiters = this.pauseWaiters.splice(0);
    waiters.forEach((resolve) => resolve());
    const roundWaiters = this.roundWaiters.splice(0);
    roundWaiters.forEach((resolve) => resolve());
    this.listeners.clear();
  }

  private async waitWhilePaused(): Promise<void> {
    while (!this.destroyed && this.pauseCount > 0) {
      await new Promise<void>((resolve) => this.pauseWaiters.push(resolve));
    }
  }

  /** Blocks while a Round is not actually in progress (`'READY'` before the first Round, or
   *  `'ROUND_RESULT'` between Rounds 1-4) without busy-polling, woken by the next `publish()` -
   *  `continueToNextRound()`'s own publish is exactly what starts driving the next Round's Turns again.
   *  Returns immediately once a Round is active or the Session is over; `driveTurns`'s own loop
   *  condition below is what stops advancement for good once `'SESSION_COMPLETE'` is reached. */
  private async waitForRoundActive(): Promise<void> {
    while (!this.destroyed && this.getSnapshot().status !== 'ROUND_ACTIVE' && this.getSnapshot().status !== 'SESSION_COMPLETE') {
      await new Promise<void>((resolve) => this.roundWaiters.push(resolve));
    }
  }

  /**
   * Drives Turns for every Round of the Session, not only the first: after a Round ends, `status`
   * leaves `'ROUND_ACTIVE'` (to `'ROUND_RESULT'` for Rounds 1-4, or straight to `'SESSION_COMPLETE'` for
   * Round 5's own status-collapse) and no further Turn is ever requested until `continueToNextRound()`
   * runs - so this loop must wait for that rather than exiting the instant it first observes a
   * non-active Round. That was the actual bug behind a bot's Turn spinner getting stuck indefinitely
   * from Round 2 onward: the original loop's condition doubled as its own exit condition, so it
   * returned for good the moment Round 1 finished, and nothing was ever driving Turns again afterward
   * even though `continueToNextRound()` had genuinely started a new, otherwise-undriven Round.
   */
  private async driveTurns(botTurnDelayMs: number): Promise<void> {
    while (!this.destroyed && this.getSnapshot().status !== 'SESSION_COMPLETE') {
      await this.waitForRoundActive();
      if (this.destroyed || this.getSnapshot().status !== 'ROUND_ACTIVE') continue;
      await this.waitWhilePaused();
      if (this.destroyed || this.getSnapshot().status !== 'ROUND_ACTIVE') continue;
      const currentPlayerId = this.getSnapshot().currentPlayerId;
      if (botTurnDelayMs > 0 && currentPlayerId !== null && currentPlayerId !== this.session.humanController.playerId) {
        await new Promise((resolve) => setTimeout(resolve, botTurnDelayMs));
      }
      // Re-checked after the presentation delay above: an overlay may have opened (or `destroy()` may
      // have been called) while that delay was in flight, and the actual state-advancing step is the
      // `runTurn()` call below, not the delay itself - this is the gate that must hold pause, not the
      // one above.
      await this.waitWhilePaused();
      if (this.destroyed || this.getSnapshot().status !== 'ROUND_ACTIVE') continue;
      let result: { readonly accepted: boolean };
      try {
        result = await this.runTurn();
      } catch (cause) {
        console.error('Automatic Turn advancement stopped after a Controller failure.', cause);
        return;
      }
      if (!result.accepted) return;
    }
  }

  private publish(events: readonly GameEvent[]): void {
    this.snapshot = this.project([...this.snapshot.events, ...events]);
    this.listeners.forEach((listener) => listener());
    const roundWaiters = this.roundWaiters.splice(0);
    roundWaiters.forEach((resolve) => resolve());
  }

  private project(events: readonly GameEvent[]): SessionPresentationSnapshot {
    const view = this.session.runner.getPlayerView('south');
    const round = view.round;
    const roundEvents = events.filter((event) => 'roundNumber' in event && event.roundNumber === view.roundNumber);
    const passed = new Set<PlayerId>();
    let lastPlay: Extract<GameEvent, { type: 'CARDS_PLAYED' }> | undefined;
    // Per-seat Play trail (ui-ux.md §5.4): unlike `passed`, a seat's own last-played combination is
    // NOT cleared by a later Play — only by the response cycle itself actually ending (Trick reset/free
    // lead), so an already-beaten Play keeps showing (grayed, via `beaten` below) until then.
    const lastPlaysBySeat = new Map<PlayerId, Combination>();
    for (const [index, event] of roundEvents.entries()) {
      if (event.type === 'CARDS_PLAYED') { lastPlay = event; passed.clear(); lastPlaysBySeat.set(event.playerId, event.combination); }
      if (event.type === 'TRICK_ENDED') {
        // GameEngine.submitMove always emits TRICK_ENDED immediately followed, in the same batch, by
        // either TURN_CHANGED (the Round continues into a free lead) or ROUND_ENDED (this same Trick end
        // is also the Round's own completion, e.g. the 3rd-place finisher's final Play). Only the former
        // is an actual mid-Round reset that should clear every seat's trail; the latter would otherwise
        // wipe the very Play that just ended the Round an instant before the End-of-Round reveal/result
        // (still M4-T12) ever gets to show it (the person's own follow-up report) — so this leaves every
        // seat's trail as-is through Round completion, until `continueToNextRound` genuinely starts fresh.
        if (roundEvents[index + 1]?.type !== 'ROUND_ENDED') { passed.clear(); lastPlaysBySeat.clear(); }
      }
      if (event.type === 'PLAYER_PASSED') passed.add(event.playerId);
    }
    let center: SessionPresentationSnapshot['center'] = { kind: 'empty' };
    if (round?.trick?.kind === 'response' || round?.status === 'completed') {
      if (!lastPlay) throw new Error('Current hand presentation requires the public Play history.');
      center = { kind: 'hand', playerId: lastPlay.playerId, combination: round.trick?.kind === 'response' ? round.trick.current : lastPlay.combination };
    } else if (round?.trick) {
      center = { kind: round.trick.kind };
    }
    const roundCheckpoint = round?.status === 'completed' ? view.completedRounds.at(-1)! : null;
    const seats = (['south', 'west', 'north', 'east'] as const).map((seat): PresentedSeat => {
      const player = round?.players.find((entry) => entry.playerId === seat);
      const standing = view.standings.find((entry) => entry.playerId === seat);
      const name = this.session.names[seat];
      if (!view.playerIds.includes(seat) || !standing || name === undefined || (round && !player)) throw new Error(`Missing presentation participant ${seat}.`);
      const finishIndex = round?.finishOrder.indexOf(seat) ?? -1;
      const placement = roundCheckpoint?.placements.find((entry) => entry.playerId === seat)?.placement
        ?? (finishIndex === -1 ? null : (finishIndex + 1) as 1 | 2 | 3);
      const seatLastPlay = lastPlaysBySeat.get(seat);
      const lastPlayPresentation = seatLastPlay === undefined || passed.has(seat) ? null
        : { combination: seatLastPlay, beaten: !(center.kind === 'hand' && center.playerId === seat) };
      return {
        seat, playerId: seat, name, cardCount: player?.cardCount ?? 0, totalScore: standing.totalScore,
        isCurrentTurn: round?.currentPlayerId === seat, passed: passed.has(seat), done: player?.finished ?? false, placement,
        lastPlay: lastPlayPresentation,
      };
    });
    return freeze(structuredClone({
      status: this.session.runner.getStatus(), roundNumber: view.roundNumber, seats, humanHand: view.hand,
      currentPlayerId: round?.currentPlayerId ?? null, center, playedCards: round?.playedCards ?? [],
      events, roundEvents, standings: view.standings, completedRounds: view.completedRounds,
      roundCheckpoint, sessionResult: view.result, reveal: this.session.runner.getCompletedRoundReveal(),
    }));
  }
}

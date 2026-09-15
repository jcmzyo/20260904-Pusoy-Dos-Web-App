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

  private async driveTurns(botTurnDelayMs: number): Promise<void> {
    while (this.getSnapshot().status === 'ROUND_ACTIVE') {
      const currentPlayerId = this.getSnapshot().currentPlayerId;
      if (botTurnDelayMs > 0 && currentPlayerId !== null && currentPlayerId !== this.session.humanController.playerId) {
        await new Promise((resolve) => setTimeout(resolve, botTurnDelayMs));
      }
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

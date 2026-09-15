import type { Card, Combination, PlayerId } from '../domain';
import type { CompletedRoundReveal, GameEvent, PublicGameView } from '../engine';
import type { ControllerTurnResult, RunnerStatus } from '../orchestrator';
import type { StartedSession } from './startSession';

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
    for (const event of roundEvents) {
      if (event.type === 'CARDS_PLAYED') { lastPlay = event; passed.clear(); }
      if (event.type === 'TRICK_ENDED') passed.clear();
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
      return {
        seat, playerId: seat, name, cardCount: player?.cardCount ?? 0, totalScore: standing.totalScore,
        isCurrentTurn: round?.currentPlayerId === seat, passed: passed.has(seat), done: player?.finished ?? false, placement,
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

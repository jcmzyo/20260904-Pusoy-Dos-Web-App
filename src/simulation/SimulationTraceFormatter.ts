import type { Card } from '../domain';
import type { GameEvent } from '../engine';
import type { SimulationTraceEntry } from './SimulationFailure';
import type { RecordedSimulationResult } from './SimulationRunner';

const suits = { clubs: 'C', spades: 'S', hearts: 'H', diamonds: 'D' } as const;

function cards(hand: readonly Card[]): string {
  return hand.map((card) => `${card.rank}${suits[card.suit]}`).join(' ') || '(empty)';
}

/** Consumes public Engine facts only; presentation counts never drive gameplay. */
export class GameplayEventFormatter {
  private readonly counts = new Map<string, number>();

  format(event: GameEvent): string {
    switch (event.type) {
      case 'SESSION_STARTED': return `Session started (${event.mode}): ${event.playerIds.join(', ')}`;
      case 'ROUND_STARTED':
        this.counts.clear();
        return `Round ${event.roundNumber} started`;
      case 'CARDS_DEALT':
        for (const player of event.players) this.counts.set(player.playerId, player.cardCount);
        return `Cards dealt; remaining: ${this.remaining()}`;
      case 'CARDS_PLAYED': {
        const count = this.counts.get(event.playerId);
        if (count === undefined || count < event.combination.cards.length) throw new Error('Gameplay log requires an ordered event stream starting at the deal.');
        this.counts.set(event.playerId, count - event.combination.cards.length);
        return `${event.playerId} Play ${cards(event.combination.cards)} (${event.combination.type}); remaining: ${this.remaining()}`;
      }
      case 'PLAYER_PASSED': return `${event.playerId} Pass; remaining: ${this.remaining()}`;
      case 'TURN_CHANGED': return `Turn: ${event.playerId}`;
      case 'PLAYER_FINISHED': return `${event.playerId} finished, placement ${event.placement}`;
      case 'TRICK_ENDED': return `Trick ended/reset; last successful player: ${event.lastSuccessfulPlayerId}`;
      case 'ROUND_ENDED': return `Round ended; placements: ${event.result.placements.map((player) => `${player.placement}: ${player.playerId}`).join(', ')}`;
      case 'SCORE_CALCULATED': return `Round scores: ${event.result.placements.map((player) => `${player.playerId}=${player.points}`).join(', ')}; Session totals: ${event.standings.map((player) => `${player.playerId}=${player.totalScore}`).join(', ')}`;
      case 'SESSION_ENDED': return `Session results: ${event.result.standings.map((player) => `${player.playerId}=${player.totalScore} (wins ${player.roundWins}, average placement ${player.averagePlacement}, best ${player.highestRoundScore})`).join(', ')}; winners: ${event.result.winnerIds.join(', ')}; decided by: ${event.result.decidedBy}`;
    }
  }

  private remaining(): string {
    return [...this.counts].map(([playerId, count]) => `${playerId}=${count}`).join(', ');
  }
}

/** Default output deliberately ignores requests, proposals, decisions and private snapshots. */
export function formatSimulationTrace(recorded: RecordedSimulationResult, options: { readonly includePrivateHands?: boolean } = {}): string {
  const config = recorded.status === 'completed' ? recorded.config : recorded.failure.config;
  const trace = recorded.status === 'completed' ? recorded.trace : recorded.failure.trace;
  if (!trace) throw new Error('Readable gameplay logging requires a recorded trace.');
  const lines = [`Seed ${config.engineSeed}; run ${config.runId}; mode ${config.mode}; ruleset ${config.rulesetId}`,
    `Seats: ${config.seats.map((seat) => `${seat.playerId}=${seat.controller}`).join(', ')}${config.softwareVersion ? `; software ${config.softwareVersion}` : ''}`,
    'Action numbers are one-based across the Session; action 0 precedes the first turn. Cards: C=clubs S=spades H=hearts D=diamonds.'];
  if (options.includePrivateHands) lines.push('DEVELOPER ONLY: private remaining hands and failure diagnostics included.');
  const formatter = new GameplayEventFormatter();
  transactions: for (const entry of trace) {
    if (entry.kind !== 'transaction') continue;
    const prefix = location(entry);
    for (const event of entry.events ?? []) {
      try {
        lines.push(`${prefix} ${formatter.format(event)}`);
      } catch {
        const message = `${prefix} LOG FORMAT ERROR: inconsistent public event stream; seed=${config.engineSeed}.`;
        if (recorded.status !== 'failed') throw new Error(message);
        lines.push(message);
        break transactions;
      }
    }
    if (options.includePrivateHands && entry.developerHands) {
      lines.push(`${prefix} PRIVATE remaining hands: ${entry.developerHands.map((player) => `${player.playerId}=[${cards(player.hand)}]`).join('; ')}`);
    }
  }
  if (recorded.status === 'failed') {
    const failure = recorded.failure;
    lines.push(`${location(failure)} FAILED seed=${config.engineSeed}; type=${failure.failureType}; player=${failure.currentPlayer ?? '(unavailable)'}; code=${failure.invariantCode ?? failure.rejection?.code ?? '(unavailable)'}`);
    // Arbitrary exception text and rejected proposals can themselves contain hidden cards.
    lines.push('Detailed failure evidence retained by the runner; use --include-private-hands to include developer diagnostics.');
    if (options.includePrivateHands) lines.push(`PRIVATE failure diagnostics: ${JSON.stringify(failure)}`);
  }
  return `${lines.join('\n')}\n`;
}

function location(entry: Pick<SimulationTraceEntry, 'roundNumber' | 'actionIndex'>): string {
  return `[Round ${entry.roundNumber} / action ${entry.actionIndex}]`;
}

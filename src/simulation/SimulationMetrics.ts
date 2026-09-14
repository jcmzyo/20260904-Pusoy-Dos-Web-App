import type { DecompositionMetrics } from '../ai/decomposition/minPlays';
import type { RunnerDiagnostic } from '../orchestrator/RunnerDiagnostic';

// Node provides a monotonic clock; the shared project intentionally uses ES-only types.
export function simulationTime(): number {
  return (globalThis as typeof globalThis & { performance: { now(): number } }).performance.now();
}

export interface DurationSummary {
  readonly count: number;
  readonly totalMs: number;
  readonly minMs: number | null;
  readonly maxMs: number | null;
  readonly meanMs: number | null;
}

export interface RoundMetrics {
  readonly roundNumber: number;
  readonly completed: boolean;
  readonly attemptedActions: number;
  readonly acceptedActions: number;
  readonly passes: number;
}

export interface SimulationMetrics {
  readonly rounds: readonly RoundMetrics[];
  readonly roundsCompleted: number;
  /** Attempted Turns, including a Turn whose request or submission fails. */
  readonly attemptedActions: number;
  readonly acceptedActions: number;
  readonly passes: number;
  /** Accepted Passes / accepted actions; zero when no action was accepted. */
  readonly passFrequency: number;
  readonly durationMs: number;
  /** Resolved controller requests only, from request observation to proposal observation. */
  readonly decisionDuration: DurationSummary;
  readonly decomposition?: Omit<DecompositionMetrics, 'handSize'> & { readonly decisions: number };
}

export function mergeDurations(values: readonly DurationSummary[]): DurationSummary {
  const measured = values.filter((value) => value.count > 0);
  const count = measured.reduce((sum, value) => sum + value.count, 0);
  const totalMs = measured.reduce((sum, value) => sum + value.totalMs, 0);
  return { count, totalMs, minMs: count ? measured.reduce((min, value) => Math.min(min, value.minMs!), Infinity) : null,
    maxMs: count ? measured.reduce((max, value) => Math.max(max, value.maxMs!), -Infinity) : null, meanMs: count ? totalMs / count : null };
}

/** Observational engineering data only; never feeds the Engine or controller requests. */
export class SimulationMetricsCollector {
  private readonly started = simulationTime();
  private readonly rounds = new Map<number, { roundNumber: number; completed: boolean; attemptedActions: number; acceptedActions: number; passes: number }>();
  private decisionStarted: number | undefined;
  private decisionDuration: DurationSummary = mergeDurations([]);
  private readonly decomposition;

  constructor(collectDecomposition = false) {
    this.decomposition = collectDecomposition ? { decisions: 0, statesVisited: 0, combinationMasksConsidered: 0, cacheHits: 0, cacheMisses: 0 } : undefined;
  }

  private round(roundNumber: number) {
    let round = this.rounds.get(roundNumber);
    if (!round) {
      round = { roundNumber, completed: false, attemptedActions: 0, acceptedActions: 0, passes: 0 };
      this.rounds.set(roundNumber, round);
    }
    return round;
  }

  readonly observe = (entry: RunnerDiagnostic): void => {
    if (entry.kind === 'turnStart') this.round(entry.state.roundNumber).attemptedActions++;
    if (entry.kind === 'request') this.decisionStarted = simulationTime();
    if (entry.kind === 'proposal' && this.decisionStarted !== undefined) {
      const elapsed = simulationTime() - this.decisionStarted;
      this.decisionDuration = mergeDurations([this.decisionDuration,
        { count: 1, totalMs: elapsed, minMs: elapsed, maxMs: elapsed, meanMs: elapsed }]);
      this.decisionStarted = undefined;
    }
    if (entry.kind !== 'transaction') return;
    for (const event of entry.result.events) {
      if (event.type === 'ROUND_STARTED') this.round(event.roundNumber);
      if (event.type === 'ROUND_ENDED') this.round(event.roundNumber).completed = true;
      if (event.type === 'CARDS_PLAYED' || event.type === 'PLAYER_PASSED') {
        const round = this.round(event.roundNumber);
        round.acceptedActions++;
        if (event.type === 'PLAYER_PASSED') round.passes++;
      }
    }
  };

  readonly onDecomposition = (metrics: DecompositionMetrics): void => {
    if (!this.decomposition) return;
    this.decomposition.decisions++;
    this.decomposition.statesVisited += metrics.statesVisited;
    this.decomposition.combinationMasksConsidered += metrics.combinationMasksConsidered;
    this.decomposition.cacheHits += metrics.cacheHits;
    this.decomposition.cacheMisses += metrics.cacheMisses;
  };

  snapshot(): SimulationMetrics {
    const rounds = [...this.rounds.values()].map((round) => ({ ...round }));
    const acceptedActions = rounds.reduce((sum, round) => sum + round.acceptedActions, 0);
    const passes = rounds.reduce((sum, round) => sum + round.passes, 0);
    return { rounds, roundsCompleted: rounds.filter((round) => round.completed).length,
      attemptedActions: rounds.reduce((sum, round) => sum + round.attemptedActions, 0), acceptedActions, passes,
      passFrequency: acceptedActions ? passes / acceptedActions : 0, durationMs: simulationTime() - this.started,
      decisionDuration: { ...this.decisionDuration }, ...(this.decomposition ? { decomposition: { ...this.decomposition } } : {}) };
  }
}

import type { PlayerController } from '../orchestrator';
import type { RunnerDiagnostic } from '../orchestrator/RunnerDiagnostic';

// The shared project targets ES-only types; Node supplies these harness timers at runtime.
const timers = globalThis as typeof globalThis & {
  setTimeout(callback: () => void, milliseconds: number): unknown;
  clearTimeout(timer: unknown): void;
};

/** Diagnostic limits only: never determine winners, scores, or legal Moves.
 * 10,000 attempted actions per Session and eight visits to an identical authoritative
 * state allow ample headroom over valid five-Round play. The 60-second request deadline
 * bounds unresolved promises; it cannot preempt synchronous code blocking the event loop.
 */
export const simulationGuardLimits = Object.freeze({ actions: 10_000, stateVisits: 8, controllerTimeoutMs: 60_000 });

export class SimulationGuardError extends Error {
  constructor(readonly code: 'ACTION_LIMIT' | 'REPEATED_STATE' | 'CONTROLLER_TIMEOUT' | 'LIFECYCLE', message: string) {
    super(`${code}: ${message}`);
    this.name = 'SimulationGuardError';
  }
}

/** Observes detached authoritative snapshots without creating a second gameplay loop. */
export class SimulationGuards {
  private actions = 0;
  private readonly visits = new Map<string, number>();

  readonly observe = (entry: RunnerDiagnostic): void => {
    if (entry.kind !== 'turnStart') return;
    if (++this.actions > simulationGuardLimits.actions) {
      throw new SimulationGuardError('ACTION_LIMIT', `Exceeded ${simulationGuardLimits.actions} attempted Session actions.`);
    }
    const key = JSON.stringify(entry.state);
    const count = (this.visits.get(key) ?? 0) + 1;
    this.visits.set(key, count);
    if (count > simulationGuardLimits.stateVisits) {
      throw new SimulationGuardError('REPEATED_STATE', `Exceeded ${simulationGuardLimits.stateVisits} visits to the same authoritative state.`);
    }
  };

  controller(controller: PlayerController): PlayerController {
    return { playerId: controller.playerId, chooseMove: async (request) => {
      let timer: unknown;
      try {
        return await Promise.race([
          new Promise<never>((_, reject) => {
            timer = timers.setTimeout(() => reject(new SimulationGuardError('CONTROLLER_TIMEOUT',
              `Player ${request.playerId} did not resolve within ${simulationGuardLimits.controllerTimeoutMs}ms.`)), simulationGuardLimits.controllerTimeoutMs);
          }),
          controller.chooseMove(request),
        ]);
      } finally {
        timers.clearTimeout(timer);
      }
    } };
  }
}

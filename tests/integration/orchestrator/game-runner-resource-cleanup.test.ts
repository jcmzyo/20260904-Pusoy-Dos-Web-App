import { describe, expect, it, vi } from 'vitest';
import type { Move } from '../../../src/domain';
import * as engine from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';

const ids = ['south', 'west', 'north', 'east'];
const fixture = () => engine.startRound(engine.createSession(ids).state, { next: () => 0 }).state;
const single = (request: PlayerTurnRequest): Move =>
  request.legalMoves.find((move) => move.kind === 'play' && move.cards.length === 1)
  ?? request.legalMoves.find((move) => move.kind === 'pass')!;

function controllers() {
  return new Map(ids.map((playerId) => [playerId, { playerId, chooseMove: vi.fn(async (request: PlayerTurnRequest) => single(request)) }]));
}

describe('GameRunner autoplay Turn resource cleanup (review finding: yieldToMacrotask MessagePort leak)', () => {
  it('closes both MessageChannel ports it opens for every autoplay Turn, including across pause/destroy', async () => {
    // Each `runAutoplayTurn()` crosses `commitWhenSubmissionAllowed`'s own macrotask boundary at least
    // once via `yieldToMacrotask()` (GameRunner.ts), which previously left both of that call's
    // `MessageChannel` ports open indefinitely - retained MessagePort handles that a Node probe showed
    // surviving destruction and forced GC. Spying on the shared `MessagePort.prototype.close` (rather than
    // reconstructing per-instance "closed" state, which the platform does not expose publicly) directly
    // proves the fix: every port opened for this guarded path is explicitly closed once its own yield
    // resolves, not merely left for the platform to reclaim.
    const closeSpy = vi.spyOn(MessagePort.prototype, 'close');
    try {
      const state = fixture();
      const runner = new GameRunner(state, engine.defaultRuleset, controllers());
      let turns = 0;
      // A pause/resume cycle around one Turn (orchestrator.md's own reference-counted contract) still
      // routes through the same guarded `commitWhenSubmissionAllowed` loop and must still close its ports.
      runner.pauseSubmission();
      runner.resumeSubmission();
      for (let i = 0; i < 12; i++) {
        const result = await runner.runAutoplayTurn();
        turns += 1;
        if (!result.accepted || engine.getPublicView(result.state).round?.status === 'completed') break;
      }
      runner.destroy();

      expect(turns).toBeGreaterThan(0);
      // Exactly two ports (`port1`, `port2`) closed per `yieldToMacrotask()` crossing; `commitWhenSubmissionAllowed`
      // crosses it exactly once per Turn while never paused, matching `turns` one-for-one here.
      expect(closeSpy.mock.calls.length).toBe(turns * 2);
    } finally {
      closeSpy.mockRestore();
    }
  });
});

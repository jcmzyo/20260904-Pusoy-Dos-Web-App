import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaselineController } from '../../src/ai';
import { assertEngineInvariants, createSession, defaultRuleset, startRound, submitMove } from '../../src/engine';
import { createPlayerTurnRequest } from '../../src/orchestrator';
import { runSimulationBatch } from '../../src/simulation/SimulationBatch';
import { replaySimulation } from '../../src/simulation/SimulationReplay';
import { runRecordedSimulation } from '../../src/simulation/SimulationRunner';
import { openingPassRegression as fixture } from '../fixtures/regressions/artificial-opening-pass';

afterEach(() => vi.restoreAllMocks());

describe(fixture.id, () => {
  it('protects the owning Baseline component: opening choice is an authorized Play accepted by Engine', async () => {
    const state = startRound(createSession(fixture.config.seats.map((seat) => seat.playerId)).state, { next: () => 0 }).state;
    const request = createPlayerTurnRequest(state, defaultRuleset);
    expect(request.view.round!.trick!.kind).toBe('opening');
    const before = JSON.stringify(request);
    const move = await new BaselineController(request.playerId).chooseMove(request);
    expect(move.kind).toBe('play');
    if (move.kind !== 'play') throw new Error('Expected an opening Play.');
    expect(request.legalMoves.some((legal) => legal.kind === 'play' && legal.playerId === move.playerId
      && legal.cards.length === move.cards.length && legal.cards.every((card) => move.cards.some((chosen) => chosen.rank === card.rank && chosen.suit === card.suit)))).toBe(true);
    expect(JSON.stringify(request)).toBe(before);
    const result = submitMove(state, move, defaultRuleset);
    expect(result.accepted).toBe(true);
    assertEngineInvariants(result.state, defaultRuleset);
  });

  it('captures and reproduces the artificial defect, then replays the original seed and broader batch after correction', async () => {
    // This mutation represents the AI defect; Engine and simulator remain real.
    const mutation = vi.spyOn(BaselineController.prototype, 'chooseMove').mockImplementation(async (request) => ({ kind: 'pass', playerId: request.playerId }));
    const failed = await runRecordedSimulation(fixture.config);
    expect(failed).toMatchObject({ status: 'failed', failure: {
      config: fixture.config, failureType: 'rejectedMove', roundNumber: 1, actionIndex: 1,
      rejection: { code: 'PASS_NOT_ALLOWED' }, proposedMove: { kind: 'pass' },
    } });
    const recorded = JSON.parse(JSON.stringify(failed));
    expect(await replaySimulation(recorded)).toMatchObject({ status: 'matched', replay: { status: 'failed', failure: {
      roundNumber: 1, actionIndex: 1, rejection: { code: 'PASS_NOT_ALLOWED' },
    } } });
    mutation.mockRestore();

    const corrected = await replaySimulation(recorded);
    expect(corrected).toMatchObject({ status: 'mismatch', mismatch: {
      path: '$.status', expected: 'failed', actual: 'completed',
    }, replay: { status: 'completed', config: fixture.config } });
    if (corrected.replay.status !== 'completed') throw new Error('Original seed still fails after correction.');
    expect(corrected.replay.result.state.kind).toBe('completed');
    expect(corrected.replay.result.state.completedRounds).toHaveLength(5);
    expect(await replaySimulation(corrected.replay)).toMatchObject({ status: 'matched', comparedTrace: true, replay: { status: 'completed' } });

    const { runId, engineSeed, ...session } = fixture.config;
    const batch = await runSimulationBatch({ batchId: `${fixture.id}-corrected`, seeds: fixture.broaderSeeds, session });
    expect(batch).toMatchObject({ status: 'completed', attempted: 3, completed: 3, failed: 0, remaining: 0 });
    expect(batch.runs.map(({ outcome }) => outcome.status === 'completed' ? outcome.config.engineSeed : undefined)).toEqual(fixture.broaderSeeds);
  }, 30000);
});

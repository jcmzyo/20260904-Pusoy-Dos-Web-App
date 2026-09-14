import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaselineController } from '../../../src/ai';
import * as engine from '../../../src/engine';
import type { SimulationConfig } from '../../../src/simulation/SimulationConfig';
import { runTraceCommand } from '../../../src/simulation/SimulationTraceCommand';
import { formatSimulationTrace } from '../../../src/simulation/SimulationTraceFormatter';
import { replaySimulation } from '../../../src/simulation/SimulationReplay';
import { runRecordedSimulation } from '../../../src/simulation/SimulationRunner';

const config: SimulationConfig = {
  runId: 'trace-test', engineSeed: 1713, mode: 'basic', rulesetId: 'default',
  seats: [{ playerId: 'south', controller: 'baseline' }, { playerId: 'west', controller: 'baseline' }, { playerId: 'north', controller: 'baseline' }, { playerId: 'east', controller: 'baseline' }],
};
const suits = { clubs: 'C', spades: 'S', hearts: 'H', diamonds: 'D' } as const;
afterEach(() => vi.restoreAllMocks());

describe('readable production simulation trace', () => {
  it('formats every authoritative action/result with accurate counts and unchanged safe controller inputs, outcome and replay', async () => {
    const choose = vi.spyOn(BaselineController.prototype, 'chooseMove');
    const plain = await runRecordedSimulation(config, { trace: true });
    const plainRequests = choose.mock.calls.map(([{ requestId, ...request }]) => request);
    choose.mockClear();
    const privateRun = await runRecordedSimulation(config, { trace: true, includePrivateHands: true });
    if (plain.status !== 'completed' || privateRun.status !== 'completed') throw new Error('Expected completed fixtures');
    expect(privateRun.result).toEqual(plain.result);
    expect(choose.mock.calls.map(([{ requestId, ...request }]) => request)).toEqual(plainRequests);
    for (const [request] of choose.mock.calls) {
      expect(Object.keys(request).sort()).toEqual(['legalMoves', 'playerId', 'requestId', 'view']);
      expect(request.view.round?.players.every((player) => !('hand' in player))).toBe(true);
    }
    expect(plain.trace?.every((entry) => entry.developerHands === undefined)).toBe(true);
    const before = JSON.stringify(privateRun);
    const text = formatSimulationTrace(privateRun);
    expect(text).toBe(formatSimulationTrace(plain));
    expect(text).not.toMatch(/PRIVATE|legalMoves|developerHands|requestId|"hand"/);
    expect(text).toContain('Seed 1713; run trace-test');
    const privateText = formatSimulationTrace(privateRun, { includePrivateHands: true });
    expect(privateText).toContain('DEVELOPER ONLY');
    expect(JSON.stringify(privateRun)).toBe(before);
    const transactions = privateRun.trace!.filter((entry) => entry.kind === 'transaction');
    let actionCount = 0;
    for (const entry of transactions) {
      const prefix = `[Round ${entry.roundNumber} / action ${entry.actionIndex}]`;
      const hands = entry.developerHands;
      if (hands) {
        const expected = hands.map((player) => `${player.playerId}=[${player.hand.map((card) => `${card.rank}${suits[card.suit]}`).join(' ') || '(empty)'}]`).join('; ');
        expect(privateText).toContain(`${prefix} PRIVATE remaining hands: ${expected}`);
      }
      for (const event of entry.events ?? []) {
        if (event.type === 'CARDS_PLAYED' || event.type === 'PLAYER_PASSED') {
          expect(entry.actionIndex).toBe(++actionCount);
          const action = event.type === 'PLAYER_PASSED' ? 'Pass' : `Play ${event.combination.cards.map((card) => `${card.rank}${suits[card.suit]}`).join(' ')} (${event.combination.type})`;
          expect(text).toContain(`${prefix} ${event.playerId} ${action}; remaining: ${hands!.map((player) => `${player.playerId}=${player.hand.length}`).join(', ')}`);
        } else if (event.type === 'PLAYER_FINISHED') {
          expect(text).toContain(`${prefix} ${event.playerId} finished, placement ${event.placement}`);
        } else if (event.type === 'TRICK_ENDED') {
          expect(text).toContain(`${prefix} Trick ended/reset; last successful player: ${event.lastSuccessfulPlayerId}`);
        } else if (event.type === 'ROUND_ENDED') {
          expect(text).toContain(`${prefix} Round ended; placements: ${event.result.placements.map((player) => `${player.placement}: ${player.playerId}`).join(', ')}`);
        } else if (event.type === 'SCORE_CALCULATED') {
          expect(text).toContain(`${prefix} Round scores: ${event.result.placements.map((player) => `${player.playerId}=${player.points}`).join(', ')}`);
        }
      }
    }
    expect(actionCount).toBeGreaterThan(0);
    expect(text.match(/Round scores:/g)).toHaveLength(5);
    expect(text.match(/Session results:/g)).toHaveLength(1);
    expect(text).toContain(`winners: ${privateRun.result.state.result!.winnerIds.join(', ')}; decided by: ${privateRun.result.state.result!.decidedBy}`);
    expect(await replaySimulation(privateRun)).toMatchObject({ status: 'matched', comparedTrace: true });
  });

  it('keeps controller failure seed/location/public context and only exposes exception/private evidence on opt-in', async () => {
    vi.spyOn(BaselineController.prototype, 'chooseMove').mockRejectedValue(new Error('SECRET private hand diagnostic'));
    const recorded = await runRecordedSimulation(config, { includePrivateHands: true });
    if (recorded.status !== 'failed') throw new Error('Expected failure');
    const text = formatSimulationTrace(recorded);
    expect(text).toContain('[Round 1 / action 1] FAILED seed=1713; type=controller; player=south');
    expect(text).toContain('Cards dealt; remaining: south=13, west=13, north=13, east=13');
    expect(text).not.toMatch(/SECRET|PRIVATE|legalMoves|playerView|developerSnapshots/);
    const privateText = formatSimulationTrace(recorded, { includePrivateHands: true });
    expect(privateText).toContain('SECRET private hand diagnostic');
    expect(privateText).toContain('"legalMoves"');
    expect(privateText).toContain('"developerSnapshots"');
    expect(recorded.failure.exception?.cause?.message).toBe('SECRET private hand diagnostic');
  });

  it('reports setup failure at action zero and rejects compact success records without a trace', async () => {
    vi.spyOn(engine, 'createSession').mockImplementation(() => { throw new Error('setup failed'); });
    const failed = await runRecordedSimulation(config);
    expect(formatSimulationTrace(failed)).toContain('[Round 0 / action 0] FAILED seed=1713; type=exception');
    vi.restoreAllMocks();
    const completed = await runRecordedSimulation(config);
    expect(() => formatSimulationTrace(completed)).toThrow('requires a recorded trace');
  });

  it('retains an existing failure even when its public event stream is corrupt', async () => {
    vi.spyOn(BaselineController.prototype, 'chooseMove').mockRejectedValue(new Error('retained diagnostic'));
    const recorded = await runRecordedSimulation(config);
    if (recorded.status !== 'failed') throw new Error('Expected failure');
    // Explicit invalid-event fixture: a Play without its preceding deal.
    const corrupt = { ...recorded, failure: { ...recorded.failure, trace: [{ index: 0, roundNumber: 1, actionIndex: 1, kind: 'transaction' as const,
      events: [{ type: 'CARDS_PLAYED' as const, roundNumber: 1, playerId: 'south', combination: { type: 'single' as const, cards: [{ rank: '3' as const, suit: 'clubs' as const }] } }],
    }] } };
    const text = formatSimulationTrace(corrupt, { includePrivateHands: true });
    expect(text).toContain('[Round 1 / action 1] LOG FORMAT ERROR: inconsistent public event stream; seed=1713.');
    expect(text).toContain('[Round 1 / action 1] FAILED seed=1713; type=controller');
    expect(text).toContain('retained diagnostic');
  });

  it('returns failure status and saves the same diagnostic text for rejected moves without claiming a successful Pass', async () => {
    vi.spyOn(BaselineController.prototype, 'chooseMove').mockImplementation(async (request) => ({ kind: 'pass', playerId: request.playerId }));
    const output = { log: vi.fn(), error: vi.fn(), save: vi.fn(async () => {}) };
    expect(await runTraceCommand(['--seed', '1713', '--output', 'failure.log'], output)).toBe(1);
    const text = output.log.mock.calls[0]![0];
    expect(text).toContain('FAILED seed=1713; type=rejectedMove; player=south; code=PASS_NOT_ALLOWED');
    expect(text).not.toContain('south Pass;');
    expect(output.save).toHaveBeenCalledExactlyOnceWith('failure.log', text);
    expect(output.error).not.toHaveBeenCalled();
  });

  it('reports file-write errors without losing the simulation log', async () => {
    vi.spyOn(engine, 'createSession').mockImplementation(() => { throw new Error('setup failed'); });
    const output = { log: vi.fn(), error: vi.fn(), save: vi.fn(async () => { throw new Error('disk unavailable'); }) };
    expect(await runTraceCommand(['--seed', '1713', '--output', 'failure.log'], output)).toBe(1);
    expect(output.log.mock.calls[0]![0]).toContain('FAILED seed=1713');
    expect(output.error).toHaveBeenCalledWith('Seed 1713: cannot save log to failure.log: disk unavailable');
  });

  it('handles help/invalid arguments before running the Engine or writing files', async () => {
    const create = vi.spyOn(engine, 'createSession');
    const output = { log: vi.fn(), error: vi.fn(), save: vi.fn(async () => {}) };
    expect(await runTraceCommand(['--help'], output)).toBe(0);
    expect(await runTraceCommand([], output)).toBe(2);
    expect(output.error).toHaveBeenCalledWith(expect.stringContaining('explicit --seed'));
    expect(create).not.toHaveBeenCalled();
    expect(output.save).not.toHaveBeenCalled();
  });
});

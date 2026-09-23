import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaselineController } from '../../../src/ai';
import { createSessionConfiguration, startSession } from '../../../src/application/startSession';
import * as engine from '../../../src/engine';
import { createPlayerTurnRequest, GameRunner, HumanController } from '../../../src/orchestrator';
import type { PlayerController } from '../../../src/orchestrator';

const ids = ['south', 'west', 'north', 'east'];

function fixture(responding = false) {
  let state = engine.startRound(engine.createSession(ids).state, { next: () => 0 }).state;
  if (responding) {
    const opening = createPlayerTurnRequest(state, engine.defaultRuleset);
    const single = opening.legalMoves.find((move) => move.kind === 'play' && move.cards.length === 1)!;
    state = engine.submitMove(state, single, engine.defaultRuleset).state;
  }
  const human = new HumanController(engine.getPublicView(state).round!.currentPlayerId!);
  const controllers = new Map<string, PlayerController>(ids.map((id) => [id, id === human.playerId ? human : new BaselineController(id)]));
  const runner = new GameRunner(state, engine.defaultRuleset, controllers, true);
  return { state, human, runner };
}

afterEach(() => vi.restoreAllMocks());

describe('production human Turn execution', () => {
  it.each(['play', 'pass'] as const)('submits a human %s exactly once and keeps bot requests serialized', async (kind) => {
    const { state, human, runner } = fixture(kind === 'pass');
    const submit = vi.spyOn(engine, 'submitMove');
    const bots = vi.spyOn(BaselineController.prototype, 'chooseMove');
    const pending = runner.runTurn();
    const request = human.getPendingRequest()!;
    expect(request.view).toEqual(engine.getPlayerView(state, human.playerId));
    expect(request.legalMoves).toEqual(engine.getLegalMoves(state, human.playerId, engine.defaultRuleset));
    expect(submit).not.toHaveBeenCalled();
    expect(bots).not.toHaveBeenCalled();
    await expect(runner.runTurn()).rejects.toThrow('already pending');
    const move = request.legalMoves.find((candidate) => candidate.kind === kind)!;
    expect(move).toBeDefined();
    expect(human.resolveMove(request.requestId, move)).toBe(true);
    expect(human.resolveMove(request.requestId, move)).toBe(false);
    const result = await pending;
    expect(result.accepted).toBe(true);
    expect(submit).toHaveBeenCalledExactlyOnceWith(state, move, engine.defaultRuleset);
    expect(result.events.some((event) => event.type === (kind === 'play' ? 'CARDS_PLAYED' : 'PLAYER_PASSED'))).toBe(true);
    expect(human.getPendingRequest()).toBeNull();
    const nextPlayer = engine.getPublicView(result.state).round!.currentPlayerId!;
    const next = await runner.runTurn();
    expect(next.accepted).toBe(true);
    expect(bots).toHaveBeenCalledTimes(1);
    expect(bots.mock.calls[0]![0].playerId).toBe(nextPlayer);
    expect(human.resolveMove(request.requestId, move)).toBe(false);
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('lets the Engine reject illegal intent without mutation and accepts a fresh request for the same Turn', async () => {
    const { state, human, runner } = fixture();
    const before = JSON.stringify(state);
    const pending = runner.runTurn();
    const request = human.getPendingRequest()!;
    expect(human.resolveMove(request.requestId, { kind: 'pass', playerId: human.playerId })).toBe(true);
    const rejected = await pending;
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(state);
    expect(JSON.stringify(rejected.state)).toBe(before);
    const retry = runner.runTurn();
    const fresh = human.getPendingRequest()!;
    expect(fresh.playerId).toBe(request.playerId);
    expect(fresh.requestId).not.toBe(request.requestId);
    expect(human.resolveMove(request.requestId, request.legalMoves[0]!)).toBe(false);
    expect(human.cancelPendingRequest(request.requestId)).toBe(false);
    expect(human.resolveMove(fresh.requestId, fresh.legalMoves[0]!)).toBe(true);
    expect((await retry).accepted).toBe(true);
  });

  it('keeps a paused human Turn pending without Engine submission or bot computation', async () => {
    const { state, human, runner } = fixture();
    const before = JSON.stringify(state);
    const submit = vi.spyOn(engine, 'submitMove');
    const bots = vi.spyOn(BaselineController.prototype, 'chooseMove');
    const pending = runner.runRound();
    const request = human.getPendingRequest()!;
    human.pause();
    expect(human.resolveMove(request.requestId, request.legalMoves[0]!)).toBe(false);
    await Promise.resolve();
    human.resume();
    await Promise.resolve();
    expect(submit).not.toHaveBeenCalled();
    expect(bots).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
    expect(human.getPendingRequest()).toBe(request);
    const rejected = expect(pending).rejects.toThrow('Controller failed');
    human.cancelPendingRequest(request.requestId);
    await rejected;
  });

  it('cancels a pending Turn without submission and rejects cancelled input during a later request', async () => {
    const { state, human, runner } = fixture();
    const submit = vi.spyOn(engine, 'submitMove');
    const pending = runner.runTurn();
    const request = human.getPendingRequest()!;
    const rejected = expect(pending).rejects.toMatchObject({ cause: { message: `Human input cancelled for request ${request.requestId}, player ${human.playerId}.` } });
    expect(human.cancelPendingRequest(request.requestId)).toBe(true);
    expect(human.resolveMove(request.requestId, request.legalMoves[0]!)).toBe(false);
    await rejected;
    expect(submit).not.toHaveBeenCalled();
    const retry = runner.runTurn();
    const fresh = human.getPendingRequest()!;
    expect(fresh.view).toEqual(engine.getPlayerView(state, human.playerId));
    expect(human.resolveMove(request.requestId, request.legalMoves[0]!)).toBe(false);
    expect(human.cancelPendingRequest(request.requestId)).toBe(false);
    human.resolveMove(fresh.requestId, fresh.legalMoves[0]!);
    expect((await retry).accepted).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('exposes the default startup HumanController and reaches its input through production bots', async () => {
    const session = startSession(createSessionConfiguration(), { engineRng: { next: () => 0 } });
    expect(session.humanController).toBeInstanceOf(HumanController);
    let playerId = session.initialView.round!.currentPlayerId!;
    for (let count = 0; playerId !== 'south' && count < 4; count++) {
      const result = await session.runner.runTurn();
      expect(result.accepted).toBe(true);
      playerId = engine.getPublicView(result.state).round!.currentPlayerId!;
    }
    expect(playerId).toBe('south');
    const pending = session.runner.runTurn();
    const request = session.humanController.getPendingRequest()!;
    expect(request.playerId).toBe('south');
    session.humanController.resolveMove(request.requestId, request.legalMoves[0]!);
    expect((await pending).accepted).toBe(true);
  });
});

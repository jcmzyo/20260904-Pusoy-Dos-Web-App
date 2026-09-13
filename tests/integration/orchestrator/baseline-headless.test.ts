import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaselineController } from '../../../src/ai';
import type { Move } from '../../../src/domain';
import * as engine from '../../../src/engine';
import { createPlayerTurnRequest, GameRunner } from '../../../src/orchestrator';
import { runHeadlessSession } from '../../../src/simulation/runHeadlessSession';

const ids = ['south', 'west', 'north', 'east'];
const rng = () => {
  let seed = 1713;
  return { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; } };
};
function objects(value: unknown): object[] {
  if (value === null || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(objects)];
}
const moveKey = (move: Move) => JSON.stringify(move.kind === 'pass' ? move : {
  ...move, cards: move.cards.map(({ rank, suit }) => `${rank}-${suit}`).sort(),
});

afterEach(() => vi.restoreAllMocks());

describe('production Baseline headless integration', () => {
  it('maps four Baseline controllers, completes a Round, and reproduces five official Rounds and every Move', async () => {
    async function play() {
      const random = rng();
      const state = engine.startRound(engine.createSession(ids).state, random).state;
      const submit = vi.spyOn(engine, 'submitMove');
      const controllers = ids.map((id) => new BaselineController(id, engine.defaultRuleset));
      const decisions = controllers.map((controller) => vi.spyOn(controller, 'chooseMove'));
      const runner = new GameRunner(state, engine.defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])));
      const round = await runner.runRound();
      expect(round.accepted).toBe(true);
      expect(runner.getStatus()).toBe('ROUND_RESULT');
      expect(round.state.completedRounds).toHaveLength(1);
      const checkpoints: engine.PublicGameView[] = [];
      const continuation = runner.continueToNextRound.bind(runner);
      const next = vi.spyOn(runner, 'continueToNextRound').mockImplementation((source) => {
        expect(runner.getStatus()).toBe('ROUND_RESULT');
        checkpoints.push(runner.getRoundResultCheckpoint()!.view);
        return continuation(source);
      });
      const start = vi.spyOn(engine, 'startRound');
      const result = await runHeadlessSession(runner, random);
      expect(result.accepted).toBe(true);
      expect(result).toBe(submit.mock.results.at(-1)!.value);
      expect(runner.getStatus()).toBe('SESSION_COMPLETE');
      checkpoints.push(runner.getRoundResultCheckpoint()!.view);
      expect(checkpoints.map((view) => view.roundNumber)).toEqual([1, 2, 3, 4, 5]);
      expect(next).toHaveBeenCalledTimes(4);
      expect(start.mock.results.map((entry) => entry.value.state.roundNumber)).toEqual([2, 3, 4, 5]);
      for (const [index, decision] of decisions.entries()) {
        expect(decision.mock.calls.length).toBeGreaterThan(0);
        for (const [request] of decision.mock.calls) {
          expect(request.playerId).toBe(ids[index]);
          expect(request.view.round!.currentPlayerId).toBe(ids[index]);
        }
      }
      expect(decisions.reduce((sum, decision) => sum + decision.mock.calls.length, 0)).toBe(submit.mock.calls.length);
      for (const [index, transaction] of submit.mock.results.entries()) {
        const [previous, move] = submit.mock.calls[index]!;
        expect(transaction.value.accepted).toBe(true);
        expect(engine.getLegalMoves(previous, move.playerId, engine.defaultRuleset).map(moveKey)).toContain(moveKey(move));
        engine.assertEngineInvariants(transaction.value.state, engine.defaultRuleset);
      }
      for (const view of checkpoints) {
        expect(view.completedRounds).toHaveLength(view.roundNumber);
        expect(view.round!.status).toBe('completed');
        expect(view.completedRounds.at(-1)!.placements.map((entry) => entry.points)).toEqual([5, 3, 2, 0]);
        for (const standing of view.standings) {
          expect(standing.totalScore).toBe(view.completedRounds.reduce((sum, completed) => sum +
            completed.placements.find((entry) => entry.playerId === standing.playerId)!.points, 0));
        }
      }
      const final = checkpoints.at(-1)!;
      expect(final.result).not.toBeNull();
      expect(final.result!.winnerIds.length).toBeGreaterThan(0);
      expect(result.events).toContainEqual({ type: 'SESSION_ENDED', roundNumber: 5, result: final.result });
      const calls = submit.mock.calls.length;
      expect(() => continuation(random)).toThrow('unfinished Session');
      await expect(runner.runRound()).rejects.toThrow('active Round');
      await expect(runner.runTurn()).rejects.toThrow('active Turn');
      expect(submit).toHaveBeenCalledTimes(calls);
      expect(start).toHaveBeenCalledTimes(4);
      const moves = submit.mock.calls.map((call) => call[1]);
      const events = submit.mock.results.flatMap((entry) => entry.value.events);
      vi.restoreAllMocks();
      return { checkpoints, moves, events };
    }
    expect(await play()).toEqual(await play());
  });

  it('gives every bot only detached permitted data and survives mutation attempts through a complete Round', async () => {
    const state = engine.startRound(engine.createSession(ids).state, rng()).state;
    const submit = vi.spyOn(engine, 'submitMove');
    const visited = new Set<string>();
    const controllers = ids.map((id) => {
      const controller = new BaselineController(id);
      const choose = controller.chooseMove.bind(controller);
      vi.spyOn(controller, 'chooseMove').mockImplementation(async (request) => {
        const current = submit.mock.results.at(-1)?.value.state ?? state;
        const before = JSON.stringify(current);
        expect(request.view).toEqual(engine.getPlayerView(current, id));
        expect(request.legalMoves).toEqual(engine.getLegalMoves(current, id, engine.defaultRuleset));
        expect(Object.keys(request).sort()).toEqual(['legalMoves', 'playerId', 'requestId', 'view']);
        const permitted = new Set([...request.view.hand, ...request.view.round!.playedCards].map((card) => `${card.rank}-${card.suit}`));
        const internal = new Set(objects(current));
        for (const entry of objects(request)) {
          expect(internal.has(entry)).toBe(false);
          if ('rank' in entry && 'suit' in entry) expect(permitted.has(`${entry.rank}-${entry.suit}`)).toBe(true);
        }
        const copy = JSON.stringify(request);
        const move = await choose(request);
        expect(JSON.stringify(request)).toBe(copy);
        visited.add(id);
        for (const entry of objects(request)) {
          for (const key of Object.keys(entry)) Reflect.set(entry, key, null);
        }
        expect(JSON.stringify(current)).toBe(before);
        return move;
      });
      return controller;
    });
    const runner = new GameRunner(state, engine.defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])));
    const result = await runner.runRound();
    expect(result.accepted).toBe(true);
    expect(runner.getStatus()).toBe('ROUND_RESULT');
    expect([...visited].sort()).toEqual([...ids].sort());
    for (const transaction of submit.mock.results) {
      expect(transaction.value.accepted).toBe(true);
      engine.assertEngineInvariants(transaction.value.state, engine.defaultRuleset);
    }
  });

  it('ignores exchanged hidden opponent hands and rejects requests for another controller', async () => {
    const state = engine.startRound(engine.createSession(ids).state, rng()).state;
    if (state.round?.kind !== 'inProgress') throw new Error('Expected active Round.');
    const request = createPlayerTurnRequest(state, engine.defaultRuleset);
    const opponents = state.round.context.players.filter((player) => player.playerId !== request.playerId);
    const swapped = { ...state, round: { ...state.round, context: { ...state.round.context,
      players: state.round.context.players.map((player) => player.playerId === request.playerId ? player : {
        ...player, hand: [...opponents[(opponents.indexOf(player) + 1) % opponents.length]!.hand].reverse(),
      }),
    } } };
    engine.assertEngineInvariants(swapped, engine.defaultRuleset);
    const other = createPlayerTurnRequest(swapped, engine.defaultRuleset);
    expect(other.view).toEqual(request.view);
    expect(other.legalMoves).toEqual(request.legalMoves);
    const controller = new BaselineController(request.playerId);
    expect(await controller.chooseMove(other)).toEqual(await controller.chooseMove(request));
    await expect(new BaselineController(opponents[0]!.playerId).chooseMove(request)).rejects.toThrow('received a request for');
  });
});

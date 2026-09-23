import { describe, expect, it, vi } from 'vitest';
import { BaselineController } from '../../../src/ai';
import { createSessionConfiguration, startSession } from '../../../src/application/startSession';
import { getPublicView } from '../../../src/engine';
import type { PlayerController } from '../../../src/orchestrator';

function seededRng() {
  let seed = 42;
  return { next: () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  } };
}

describe('application Session startup', () => {
  it('starts the production Basic deal with four players without requesting any controller', () => {
    const choose = vi.spyOn(BaselineController.prototype, 'chooseMove');
    try {
      const session = startSession(createSessionConfiguration(), { engineRng: seededRng() });
      expect(session.runner.getStatus()).toBe('ROUND_ACTIVE');
      expect(session.initialView).toMatchObject({ mode: 'basic', roundNumber: 1, status: 'inProgress', playerIds: ['south', 'west', 'north', 'east'] });
      expect(session.initialView.round?.players.map((player) => player.cardCount)).toEqual([13, 13, 13, 13]);
      expect(session.initialView.round?.players.every((player) => !('hand' in player))).toBe(true);
      expect(session.startupEvents.map((event) => event.type)).toEqual(['SESSION_STARTED', 'ROUND_STARTED', 'CARDS_DEALT', 'TURN_CHANGED']);
      expect(choose).not.toHaveBeenCalled();
      expect(session.names).toEqual({ south: 'You', west: 'West', north: 'North', east: 'East' });
    } finally {
      choose.mockRestore();
    }
  });

  it('connects the supplied human input and three production bots through exactly five Round checkpoints', async () => {
    const human: PlayerController = { playerId: 'south', chooseMove: vi.fn(async (request) => request.legalMoves[0]!) };
    const choose = vi.spyOn(BaselineController.prototype, 'chooseMove');
    try {
      const session = startSession(createSessionConfiguration(() => ['One', 'Two', 'Three']), { engineRng: seededRng(), humanController: human });
      expect(session.names).toEqual({ south: 'You', west: 'One', north: 'Two', east: 'Three' });
      for (let round = 1; round <= 5; round++) {
        const result = await session.runner.runRound();
        expect(result.accepted).toBe(true);
        expect(getPublicView(result.state).completedRounds).toHaveLength(round);
        expect(session.runner.getRoundResultCheckpoint()?.view.roundNumber).toBe(round);
        if (round < 5) {
          expect(session.runner.getStatus()).toBe('ROUND_RESULT');
          session.runner.continueToNextRound(session.engineRng);
        }
      }
      expect(human.chooseMove).toHaveBeenCalled();
      expect(new Set(choose.mock.calls.map(([request]) => request.playerId))).toEqual(new Set(['west', 'north', 'east']));
      expect(session.runner.getStatus()).toBe('SESSION_COMPLETE');
      expect(() => session.runner.continueToNextRound(session.engineRng)).toThrow();
    } finally {
      choose.mockRestore();
    }
  });

  it('creates independent Sessions and repeatable deals with injected RNG', () => {
    const first = startSession(createSessionConfiguration(), { engineRng: seededRng() });
    const second = startSession(createSessionConfiguration(), { engineRng: seededRng() });
    expect(second.runner).not.toBe(first.runner);
    expect(second.initialView).toEqual(first.initialView);
    expect(second.startupEvents).toEqual(first.startupEvents);
  });

  it('rejects a mismatched human controller before consuming randomness', () => {
    const engineRng = { next: vi.fn(() => 0) };
    expect(() => startSession(createSessionConfiguration(), { engineRng, humanController: new BaselineController('west') })).toThrow('South');
    expect(engineRng.next).not.toHaveBeenCalled();
  });
});

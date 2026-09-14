import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaselineController } from '../../../src/ai';
import * as engine from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { SimulationConfig } from '../../../src/simulation/SimulationConfig';
import { runSimulation } from '../../../src/simulation/SimulationRunner';

const config: SimulationConfig = {
  runId: 'known-session', engineSeed: 1713, mode: 'basic', rulesetId: 'default',
  seats: [
    { playerId: 'south', controller: 'baseline' },
    { playerId: 'west', controller: 'baseline' },
    { playerId: 'north', controller: 'baseline' },
    { playerId: 'east', controller: 'baseline' },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe('single seeded production simulation', () => {
  it('reproduces five official Rounds, deals, Moves and events through production components', async () => {
    async function play(input: SimulationConfig) {
      const create = vi.spyOn(engine, 'createSession');
      const start = vi.spyOn(engine, 'startRound');
      const submit = vi.spyOn(engine, 'submitMove');
      const choose = vi.spyOn(BaselineController.prototype, 'chooseMove');
      const rounds = vi.spyOn(GameRunner.prototype, 'runRound');
      const next = vi.spyOn(GameRunner.prototype, 'continueToNextRound');
      const before = JSON.stringify(input);
      const result = await runSimulation(input);
      expect(JSON.stringify(input)).toBe(before);
      expect(create).toHaveBeenCalledExactlyOnceWith(input.seats.map((seat) => seat.playerId));
      expect(rounds).toHaveBeenCalledTimes(5);
      expect(next).toHaveBeenCalledTimes(4);
      expect(start.mock.results.map((entry) => entry.value.state.roundNumber)).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(start.mock.calls.map((call) => call[1])).size).toBe(1);
      expect(new Set(choose.mock.contexts.map((controller) => {
        if (!(controller instanceof BaselineController)) throw new Error('Expected production Baseline controller.');
        return controller.playerId;
      }))).toEqual(new Set(input.seats.map((seat) => seat.playerId)));
      expect(choose.mock.calls.length).toBe(submit.mock.calls.length);
      expect(submit.mock.results.every((entry) => entry.value.accepted)).toBe(true);
      expect(result).toBe(submit.mock.results.at(-1)!.value);
      expect(result.accepted).toBe(true);
      expect(result.state.kind).toBe('completed');
      expect(result.state.completedRounds).toHaveLength(5);
      expect(result.state.result).not.toBeNull();
      expect(result.events).toContainEqual({ type: 'SESSION_ENDED', roundNumber: 5, result: result.state.result });
      for (const round of result.state.completedRounds) {
        expect(round.placements.map((entry) => entry.points)).toEqual([5, 3, 2, 0]);
      }
      const record = {
        result,
        deals: start.mock.results.map((entry) => entry.value),
        moves: submit.mock.calls.map((call) => call[1]),
        events: submit.mock.results.flatMap((entry) => entry.value.events),
      };
      vi.restoreAllMocks();
      return record;
    }
    const first = await play(config);
    expect(await play(JSON.parse(JSON.stringify(config)))).toEqual(first);
    expect(await play({ ...config, runId: 'another-record', softwareVersion: 'test-build' })).toEqual(first);
  });

  it.each([0, 0xffffffff])('uses seed %i and configured clockwise seats for production initialization', async (engineSeed) => {
    const input: SimulationConfig = { ...config, engineSeed, seats: [config.seats[2], config.seats[3], config.seats[0], config.seats[1]] };
    let seed = engineSeed;
    const rng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; } };
    const expected = engine.startRound(engine.createSession(input.seats.map((seat) => seat.playerId)).state, rng);
    const start = vi.spyOn(engine, 'startRound');
    const failure = new Error('Stop after initialization');
    vi.spyOn(GameRunner.prototype, 'runRound').mockRejectedValue(failure);
    await expect(runSimulation(input)).rejects.toBe(failure);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.results[0]!.value).toEqual(expected);
    let otherSeed = 1713;
    const other = engine.startRound(engine.createSession(input.seats.map((seat) => seat.playerId)).state, {
      next: () => { otherSeed = (Math.imul(otherSeed, 1664525) + 1013904223) >>> 0; return otherSeed / 0x100000000; },
    });
    expect(expected.state.round).not.toEqual(other.state.round);
  });

  it('returns the first production rejection without continuing or retrying', async () => {
    vi.spyOn(BaselineController.prototype, 'chooseMove').mockImplementation(async (request) => ({ kind: 'pass', playerId: request.playerId }));
    const submit = vi.spyOn(engine, 'submitMove');
    const next = vi.spyOn(GameRunner.prototype, 'continueToNextRound');
    const result = await runSimulation(config);
    expect(result.accepted).toBe(false);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(result.state).toBe(submit.mock.results[0]!.value.state);
    expect(result.state.completedRounds).toHaveLength(0);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([-1, 0x100000000, 1.5, NaN, Infinity])('rejects invalid seed %s before starting a Session', async (engineSeed) => {
    const create = vi.spyOn(engine, 'createSession');
    await expect(runSimulation({ ...config, engineSeed })).rejects.toThrow('unsigned 32-bit integer');
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    { ...config, mode: 'competitive' },
    { ...config, rulesetId: 'unknown' },
    { ...config, seats: config.seats.map((seat) => ({ ...seat, controller: 'unknown' })) },
  ])('rejects unsupported recorded configuration instead of silently substituting defaults', async (input) => {
    const create = vi.spyOn(engine, 'createSession');
    await expect(runSimulation(input as SimulationConfig)).rejects.toThrow('requires Basic mode');
    expect(create).not.toHaveBeenCalled();
  });

  it('retains Engine validation of duplicate seats', async () => {
    await expect(runSimulation({ ...config, seats: [config.seats[0], config.seats[0], config.seats[2], config.seats[3]] })).rejects.toThrow('four distinct players');
  });
});

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { SimulationConfig, SimulationRunId } from '../../../src/simulation/SimulationConfig';

function fixture(): SimulationConfig {
  return {
    runId: 'run-1',
    engineSeed: 1713,
    mode: 'basic',
    rulesetId: 'default',
    seats: [
      { playerId: 'south', controller: 'baseline' },
      { playerId: 'west', controller: 'baseline' },
      { playerId: 'north', controller: 'baseline' },
      { playerId: 'east', controller: 'baseline' },
    ],
  };
}

describe('simulation configuration and run identity', () => {
  it('compares independently constructed equal values and records them consistently', () => {
    const first = fixture();
    const second = fixture();
    expect(first).not.toBe(second);
    expect(first.seats).not.toBe(second.seats);
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expectTypeOf(first.runId).toEqualTypeOf<SimulationRunId>();
  });

  it('retains seeds, run identities, seat order, and optional software metadata', () => {
    const original = fixture();
    const variants: SimulationConfig[] = [
      { ...original, engineSeed: 0 },
      { ...original, engineSeed: 0xffffffff },
      { ...original, runId: 'run-2' },
      { ...original, seats: [original.seats[1], original.seats[0], original.seats[2], original.seats[3]] },
      { ...original, softwareVersion: 'commit-abc123' },
    ];
    const records = [original, ...variants].map((config) => JSON.stringify(config));
    expect(new Set(records).size).toBe(6);
    for (const config of variants) expect(JSON.parse(JSON.stringify(config))).toEqual(config);
  });

  it('records all reproduction inputs without private state or an AI RNG', () => {
    const record = JSON.parse(JSON.stringify(fixture()));
    expect(record).toEqual({
      runId: 'run-1', engineSeed: 1713, mode: 'basic', rulesetId: 'default',
      seats: [
        { playerId: 'south', controller: 'baseline' },
        { playerId: 'west', controller: 'baseline' },
        { playerId: 'north', controller: 'baseline' },
        { playerId: 'east', controller: 'baseline' },
      ],
    });
  });

  it('restricts the typed contract to readonly Phase 1 reproduction inputs', () => {
    function check(config: SimulationConfig) {
      // @ts-expect-error - an Engine seed is required
      const missingSeed: SimulationConfig = { runId: config.runId, mode: config.mode, rulesetId: config.rulesetId, seats: config.seats };
      // @ts-expect-error - run identity is required
      const missingRun: SimulationConfig = { engineSeed: config.engineSeed, mode: config.mode, rulesetId: config.rulesetId, seats: config.seats };
      // @ts-expect-error - configuration is readonly
      config.engineSeed = 2;
      // @ts-expect-error - exactly four seats are required
      const fewerSeats: SimulationConfig = { ...config, seats: [config.seats[0]] };
      // @ts-expect-error - seat order is readonly
      config.seats.reverse();
      // @ts-expect-error - seat identity is readonly
      config.seats[0].playerId = 'other';
      // @ts-expect-error - only Basic Mode is in scope
      const competitive: SimulationConfig = { ...config, mode: 'competitive' };
      // @ts-expect-error - only the canonical ruleset is supported
      const customRules: SimulationConfig = { ...config, rulesetId: 'custom' };
      // @ts-expect-error - controller behavior is limited to deterministic Baseline
      const otherController: SimulationConfig = { ...config, seats: [{ playerId: 'south', controller: 'random' }, config.seats[1], config.seats[2], config.seats[3]] };
      // @ts-expect-error - authoritative game state is not a configuration input
      const hiddenState: SimulationConfig = { ...config, state: {} };
      // @ts-expect-error - Baseline has no AI RNG seed
      const aiSeed: SimulationConfig = { ...config, aiSeed: 1 };
      // @ts-expect-error - difficulty is deferred
      const difficulty: SimulationConfig = { ...config, difficulty: 'hard' };
      void [missingSeed, missingRun, fewerSeats, competitive, customRules, otherController, hiddenState, aiSeed, difficulty];
    }
    void check;
  });
});

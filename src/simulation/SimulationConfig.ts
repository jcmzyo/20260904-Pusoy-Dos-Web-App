import type { PlayerId } from '../domain';

export type SimulationRunId = string;

export interface SimulationSeatConfig {
  readonly playerId: PlayerId;
  readonly controller: 'baseline';
}

/** Inputs for a fresh Session, not a snapshot of an in-progress game. */
export interface SimulationConfig {
  readonly runId: SimulationRunId;
  /** Initial unsigned 32-bit shuffle/deal seed; the RNG implementation belongs to the software version. */
  readonly engineSeed: number;
  readonly mode: 'basic';
  /** Resolves to the Engine's defaultRuleset for the recorded software version. */
  readonly rulesetId: 'default';
  /** Four distinct players in production clockwise seat order; all use the same ruleset. */
  readonly seats: readonly [SimulationSeatConfig, SimulationSeatConfig, SimulationSeatConfig, SimulationSeatConfig];
  /** Build/version or commit identifier when available; reproduction assumes unchanged software. */
  readonly softwareVersion?: string;
}

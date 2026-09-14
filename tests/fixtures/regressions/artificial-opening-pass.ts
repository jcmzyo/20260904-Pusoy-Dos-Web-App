import type { SimulationConfig } from '../../../src/simulation/SimulationConfig';

/**
 * Failed-seed regression convention (M3-T09)
 *
 * Retain useful reproductions in tests/fixtures/regressions/<defect>.ts with
 * a stable ID, real/artificial provenance, owning production component, symptom,
 * complete SimulationConfig, expected correction, retention reason and test command.
 * Put focused assertions in tests/unit/<owner>/ or tests/regressions/<defect>.test.ts;
 * keep cross-module seed reproduction in tests/regressions/<defect>.test.ts.
 *
 * From a batch failure, preserve its config, location and relevant diagnostic trace.
 * Replay it, isolate the first incorrect transition, then fix its production owner
 * and add a focused regression that fails with the defect present. Do not skip the
 * seed, weaken invariants, alter bot policy or repair state in the simulator.
 * Replay the original config after correction, then rerun an explicit broader batch.
 * replaySimulation compares historical behavior: a fixed failure must mismatch at
 * $.status (failed -> completed), not match the old failure. Assert completion too.
 *
 * Keep seeds only when they add debugging or integration coverage. Prefer a smaller
 * focused fixture when sufficient; do not archive every successful run or freeze
 * incidental AI sequences. Diagnostic private state must never become AI input.
 * Artificial defects live only in scoped test mocks restored before corrected runs.
 */
export const openingPassRegression = {
  id: 'artificial-opening-pass',
  provenance: 'Artificial workflow demonstration; not a discovered production bug.',
  owner: 'src/ai/BaselineController.ts: BaselineController.chooseMove',
  symptom: 'Controller returns Pass on the first opening request; Engine rejects PASS_NOT_ALLOWED at Round 1, action 1.',
  correction: 'Baseline must select an Engine-authorized Play on an opening request. Removing the test-only mutation restores the existing production implementation.',
  retentionReason: 'One seed demonstrates failure capture, unchanged-defect replay, focused owner protection and corrected full-Session replay.',
  command: 'npm test -- tests/regressions/artificial-opening-pass.test.ts',
  broaderSeeds: [1713, 0, 42],
  config: {
    runId: 'artificial-opening-pass', engineSeed: 1713, mode: 'basic', rulesetId: 'default',
    softwareVersion: '04c86d9 (M3-T09 baseline; artificial mutation defined in regression test)',
    seats: [{ playerId: 'south', controller: 'baseline' }, { playerId: 'west', controller: 'baseline' }, { playerId: 'north', controller: 'baseline' }, { playerId: 'east', controller: 'baseline' }],
  } satisfies SimulationConfig,
};

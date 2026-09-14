import type { SimulationConfig } from './SimulationConfig';
import { runRecordedSimulation } from './SimulationRunner';
import type { RecordedSimulationResult } from './SimulationRunner';

export interface SimulationBatchConfig {
  readonly batchId: string;
  /** Ordered explicit seeds; use separate lists for smoke and larger reliability runs. Duplicates are retained. */
  readonly seeds: readonly number[];
  readonly session: Omit<SimulationConfig, 'runId' | 'engineSeed'>;
  /** Defaults to true for every failure, including invariant corruption. */
  readonly failFast?: boolean;
}

export interface SimulationBatchResult {
  readonly status: 'completed' | 'failed';
  readonly config: SimulationBatchConfig;
  readonly attempted: number;
  readonly completed: number;
  readonly failed: number;
  /** Unattempted suffix when fail-fast stops execution; never counted as successful. */
  readonly remaining: number;
  /** batchIndex is zero-based and is also retained in failure artifacts. */
  readonly runs: readonly { readonly batchIndex: number; readonly outcome: RecordedSimulationResult }[];
}

/** Sequential independent Sessions through the existing production diagnostic path. */
export async function runSimulationBatch(config: SimulationBatchConfig): Promise<SimulationBatchResult> {
  if (typeof config.batchId !== 'string' || config.batchId.trim().length === 0) {
    throw new Error('Simulation batchId must be nonempty.');
  }
  if (config.failFast !== undefined && typeof config.failFast !== 'boolean') {
    throw new Error('Simulation failFast must be a boolean.');
  }
  if (!Array.isArray(config.seeds) || config.seeds.length === 0) {
    throw new Error('Simulation batch requires a nonempty seed list.');
  }
  for (const seed of config.seeds) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new RangeError('Simulation batch seeds must be unsigned 32-bit integers.');
    }
  }
  const recordedConfig: SimulationBatchConfig = {
    batchId: config.batchId, seeds: [...config.seeds],
    session: JSON.parse(JSON.stringify(config.session)) as SimulationBatchConfig['session'],
    failFast: config.failFast ?? true,
  };
  const runs: { batchIndex: number; outcome: RecordedSimulationResult }[] = [];
  let completed = 0;
  let failed = 0;
  for (const [batchIndex, engineSeed] of recordedConfig.seeds.entries()) {
    const outcome = await runRecordedSimulation({ ...recordedConfig.session,
      runId: `${recordedConfig.batchId}:${batchIndex}`, engineSeed,
    }, { batchIndex });
    runs.push({ batchIndex, outcome });
    if (outcome.status === 'completed') completed++;
    else {
      failed++;
      if (recordedConfig.failFast) break;
    }
  }
  return { status: failed === 0 ? 'completed' : 'failed', config: recordedConfig,
    attempted: runs.length, completed, failed, remaining: recordedConfig.seeds.length - runs.length, runs };
}

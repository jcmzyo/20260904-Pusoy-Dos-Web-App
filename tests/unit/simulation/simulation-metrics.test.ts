import { describe, expect, it } from 'vitest';
import { mergeDurations } from '../../../src/simulation/SimulationMetrics';

describe('duration summaries', () => {
  it('weights the mean by samples and ignores empty groups when taking extrema', () => {
    expect(mergeDurations([
      { count: 2, totalMs: 12, minMs: 2, maxMs: 10, meanMs: 6 },
      { count: 1, totalMs: 30, minMs: 30, maxMs: 30, meanMs: 30 },
      mergeDurations([]),
    ])).toEqual({ count: 3, totalMs: 42, minMs: 2, maxMs: 30, meanMs: 14 });
    expect(mergeDurations([])).toEqual({ count: 0, totalMs: 0, minMs: null, maxMs: null, meanMs: null });
  });
});

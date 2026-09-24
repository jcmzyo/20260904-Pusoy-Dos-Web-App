/**
 * M1-T02 smoke test.
 *
 * Purpose: prove the Vitest test runner is correctly configured for this
 * project (ESM + TypeScript). This test intentionally contains no game
 * rules or domain/engine logic (see m1-task-breakdown.md T02).
 */
import { describe, expect, it } from 'vitest';

describe('vitest smoke test', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import type { GameMode } from '../../../src/domain/game/GameMode';

/**
 * True type-level exhaustiveness check for `GameMode`. See
 * `assertExhaustiveRank` in cards.test.ts for why a compiler-checked
 * switch catches type/test drift that a hand-written literal array
 * cannot.
 */
function assertExhaustiveGameMode(mode: GameMode): void {
  switch (mode) {
    case 'basic':
    case 'competitive':
      return;
    default: {
      const exhaustiveCheck: never = mode;
      throw new Error(`Unhandled GameMode value: ${String(exhaustiveCheck)}`);
    }
  }
}

describe('GameMode', () => {
  it('represents both v1 game modes: basic and competitive', () => {
    const modes: GameMode[] = ['basic', 'competitive'];
    expect(modes).toHaveLength(2);
    expect(new Set(modes).size).toBe(2);
  });

  it('has no mode values beyond basic/competitive (type-level exhaustiveness)', () => {
    const modes: GameMode[] = ['basic', 'competitive'];
    modes.forEach((mode) => {
      expect(() => assertExhaustiveGameMode(mode)).not.toThrow();
    });
  });

  it('allows competitive as vocabulary without implying Competitive Mode behavior', () => {
    // M1 scope note (m1-task-breakdown.md §3, T04): 'competitive' may
    // remain vocabulary but must not activate Competitive Mode engine
    // behavior. This type is a label only; it carries no behavior.
    const mode: GameMode = 'competitive';
    expect(mode).toBe('competitive');
  });

  it('rejects an unsupported mode value at compile time', () => {
    // @ts-expect-error - 'tournament' is not a valid GameMode
    const invalid: GameMode = 'tournament';
    void invalid;
  });
});

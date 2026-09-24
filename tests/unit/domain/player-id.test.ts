import { describe, expect, it } from 'vitest';
import type { PlayerId } from '../../../src/domain/players/PlayerId';

describe('PlayerId', () => {
  it('accepts a plain string as a valid PlayerId', () => {
    const id: PlayerId = 'player-1';
    expect(id).toBe('player-1');
  });

  it('does not encode controller type (human/AI/network) in its shape', () => {
    // PlayerId is a plain string alias; there is no controller-type
    // field to inspect. This test documents the constraint from
    // domain-model.md §5.1 rather than exercising runtime behavior.
    const humanId: PlayerId = 'human-seat';
    const botId: PlayerId = 'bot-seat';
    expect(typeof humanId).toBe('string');
    expect(typeof botId).toBe('string');
  });
});

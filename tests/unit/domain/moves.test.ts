import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/domain/cards/Card';
import type { Move, PassMove, PlayMove } from '../../../src/domain/moves/Move';

describe('Move discriminated union', () => {
  const threeOfClubs: Card = { rank: '3', suit: 'clubs' };

  it('constructs a PlayMove with kind "play"', () => {
    const move: PlayMove = { kind: 'play', playerId: 'p1', cards: [threeOfClubs] };
    expect(move.kind).toBe('play');
    expect(move.playerId).toBe('p1');
    expect(move.cards).toEqual([threeOfClubs]);
  });

  it('constructs a PassMove with kind "pass" and no cards field', () => {
    const move: PassMove = { kind: 'pass', playerId: 'p1' };
    expect(move.kind).toBe('pass');
    expect(move.playerId).toBe('p1');
    expect(Object.keys(move).sort()).toEqual(['kind', 'playerId']);
  });

  it('narrows a Move to PlayMove via its discriminant at runtime and compile time', () => {
    const move: Move = { kind: 'play', playerId: 'p1', cards: [threeOfClubs] };

    if (move.kind === 'play') {
      // Type-level: `move.cards` is only accessible after narrowing.
      expect(move.cards).toEqual([threeOfClubs]);
    } else {
      throw new Error('expected a PlayMove');
    }
  });

  it('narrows a Move to PassMove via its discriminant at runtime and compile time', () => {
    const move: Move = { kind: 'pass', playerId: 'p1' };

    if (move.kind === 'pass') {
      // Type-level: PassMove has no `cards` field to read.
      expect(move.playerId).toBe('p1');
    } else {
      throw new Error('expected a PassMove');
    }
  });

  it('accepts a heterogeneous array of Play and Pass moves as one Move[]', () => {
    const moves: Move[] = [
      { kind: 'play', playerId: 'p1', cards: [threeOfClubs] },
      { kind: 'pass', playerId: 'p2' },
    ];
    expect(moves).toHaveLength(2);
    expect(moves[0]?.kind).toBe('play');
    expect(moves[1]?.kind).toBe('pass');
  });

  it('rejects an unsupported kind discriminant at compile time', () => {
    // @ts-expect-error - 'fold' is not a valid Move kind
    const invalid: Move = { kind: 'fold', playerId: 'p1' };
    void invalid;
  });

  it('rejects a PassMove literal carrying a cards field at compile time', () => {
    // @ts-expect-error - PassMove must not carry a cards field
    const invalid: PassMove = { kind: 'pass', playerId: 'p1', cards: [threeOfClubs] };
    void invalid;
  });

  it('rejects a PlayMove literal missing its required cards field at compile time', () => {
    // @ts-expect-error - PlayMove requires a cards field
    const invalid: PlayMove = { kind: 'play', playerId: 'p1' };
    void invalid;
  });

  it('rejects reassigning playerId due to readonly fields at compile time', () => {
    const move: PassMove = { kind: 'pass', playerId: 'p1' };
    // @ts-expect-error - PassMove.playerId is readonly and cannot be reassigned
    move.playerId = 'p2';
    void move;
  });
});

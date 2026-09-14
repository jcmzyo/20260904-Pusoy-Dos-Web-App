import { describe, expect, it } from 'vitest';
import { parseTraceArguments } from '../../../src/simulation/SimulationTraceCommand';
import { GameplayEventFormatter } from '../../../src/simulation/SimulationTraceFormatter';
import { resolveBasicSessionResult } from '../../../src/engine/sessions/basicSessionResult';

describe('simulation trace arguments', () => {
  it.each([0, 1713, 4294967295])('accepts explicit seed %i and developer/file options', (seed) => {
    expect(parseTraceArguments(['--output', 'my log.txt', '--seed', String(seed), '--include-private-hands'])).toEqual({ seed, includePrivateHands: true, output: 'my log.txt' });
    expect(parseTraceArguments(['--seed', String(seed)])).toEqual({ seed, includePrivateHands: false });
  });

  it.each([
    [], ['--seed'], ['--seed', '-1'], ['--seed', '1.5'], ['--seed', 'NaN'], ['--seed', 'Infinity'],
    ['--seed', '4294967296'], ['--seed', '1e3'], ['--seed', '0xff'], ['--seed', ''],
    ['--seed', '1', '--seed', '2'], ['--seed', '1', '--output'], ['--seed', '1', '--unknown'],
    ['--seed', '1', '--output', '--include-private-hands'], ['--seed', '1', '--include-private-hands', '--include-private-hands'],
  ].map((args) => ({ args })))('rejects malformed arguments $args', ({ args }) => {
    expect(() => parseTraceArguments(args)).toThrow();
  });
});

describe('public gameplay event formatter', () => {
  it('reports counts after Play and unchanged after Pass, then resets at the next deal', () => {
    const formatter = new GameplayEventFormatter();
    const deal = { type: 'CARDS_DEALT', roundNumber: 1, players: [{ playerId: 'south', cardCount: 13 }, { playerId: 'west', cardCount: 13 }, { playerId: 'north', cardCount: 13 }, { playerId: 'east', cardCount: 13 }] } as const;
    formatter.format(deal);
    expect(formatter.format({ type: 'CARDS_PLAYED', roundNumber: 1, playerId: 'south', combination: { type: 'pair', cards: [{ rank: '3', suit: 'clubs' }, { rank: '3', suit: 'diamonds' }] } })).toBe('south Play 3C 3D (pair); remaining: south=11, west=13, north=13, east=13');
    expect(formatter.format({ type: 'PLAYER_PASSED', roundNumber: 1, playerId: 'west' })).toBe('west Pass; remaining: south=11, west=13, north=13, east=13');
    formatter.format({ type: 'ROUND_STARTED', roundNumber: 2 });
    expect(formatter.format({ ...deal, roundNumber: 2 })).toBe('Cards dealt; remaining: south=13, west=13, north=13, east=13');
  });

  it('fails diagnostically on a play before the deal instead of inventing counts', () => {
    expect(() => new GameplayEventFormatter().format({ type: 'CARDS_PLAYED', roundNumber: 1, playerId: 'south', combination: { type: 'single', cards: [{ rank: '3', suit: 'clubs' }] } })).toThrow('ordered event stream');
  });

  it('displays a genuine Session tie without inventing a unique winner', () => {
    const ids = ['south', 'west', 'north', 'east'];
    const rounds = [[0, 1, 2, 3], [2, 3, 1, 0], [0, 3, 2, 1], [1, 3, 0, 2], [2, 1, 0, 3]].map((order) => ({
      placements: order.map((seat, index) => ({ playerId: ids[seat]!, placement: ([1, 2, 3, 4] as const)[index]!, points: ([5, 3, 2, 0] as const)[index]! })),
    }));
    expect(new GameplayEventFormatter().format({ type: 'SESSION_ENDED', roundNumber: 5, result: resolveBasicSessionResult(ids, rounds) })).toContain('winners: south, north; decided by: genuineTie');
  });
});

import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/domain';
import { createHandDecomposer, minPlays } from '../../../src/ai';
import { defaultRuleset } from '../../../src/engine';

describe('non-semantic decomposition metrics', () => {
  it('counts solver calls, scanned masks and memo lookups with detached snapshots', () => {
    const hand: Card[] = [{ rank: '3', suit: 'clubs' }, { rank: '3', suit: 'hearts' }];
    const analyzer = createHandDecomposer(hand, defaultRuleset, { collectMetrics: true });
    const initial = analyzer.getMetrics();
    expect(initial).toEqual({ handSize: 2, statesVisited: 0, combinationMasksConsidered: 0, cacheHits: 0, cacheMisses: 0 });
    expect(analyzer.minPlays()).toBe(1);
    const cold = analyzer.getMetrics();
    expect(cold).toEqual({ handSize: 2, statesVisited: 4, combinationMasksConsidered: 6, cacheHits: 2, cacheMisses: 2 });
    expect(analyzer.minPlays()).toBe(1);
    expect(analyzer.getMetrics()).toEqual({ handSize: 2, statesVisited: 5, combinationMasksConsidered: 6, cacheHits: 3, cacheMisses: 2 });
    expect(initial?.statesVisited).toBe(0);
    expect(cold?.statesVisited).toBe(4);
    Object.assign(cold!, { cacheHits: -100 });
    expect(analyzer.getMetrics()?.cacheHits).toBe(3);
  });

  it('counts the pre-cached empty subset without expanding it', () => {
    const analyzer = createHandDecomposer([], defaultRuleset, { collectMetrics: true });
    expect(analyzer.minPlays()).toBe(0);
    expect(analyzer.getMetrics()).toEqual({ handSize: 0, statesVisited: 1, combinationMasksConsidered: 0, cacheHits: 1, cacheMisses: 0 });
  });

  it('preserves exact results on/off and cold/warm for every subset of an overlapping hand', () => {
    const hand: Card[] = [
      { rank: '3', suit: 'clubs' }, { rank: '3', suit: 'hearts' },
      { rank: '4', suit: 'clubs' }, { rank: '4', suit: 'hearts' },
      { rank: '5', suit: 'clubs' }, { rank: '6', suit: 'clubs' }, { rank: '7', suit: 'clubs' },
    ];
    const enabled = createHandDecomposer(hand, defaultRuleset, { collectMetrics: true });
    const disabled = createHandDecomposer(hand);
    const repeated = createHandDecomposer([...hand].reverse(), defaultRuleset, { collectMetrics: true });
    for (let mask = 0; mask < 1 << hand.length; mask += 1) {
      const subset = hand.filter((_, index) => (mask & (1 << index)) !== 0);
      const expected = minPlays(subset);
      for (const analyzer of [enabled, disabled, repeated]) {
        expect(analyzer.minPlays(subset)).toBe(expected);
        expect(analyzer.minPlays([...subset].reverse())).toBe(expected);
      }
    }
    expect(disabled.getMetrics()).toBeUndefined();
    expect(enabled.getMetrics()).toEqual(repeated.getMetrics());
  });

  it('rejects invalid queries before collecting solver work', () => {
    const hand: Card[] = [{ rank: '3', suit: 'clubs' }];
    const analyzer = createHandDecomposer(hand, defaultRuleset, { collectMetrics: true });
    const before = analyzer.getMetrics();
    expect(() => analyzer.minPlays([...hand, ...hand])).toThrow('duplicate');
    expect(() => analyzer.minPlays([{ rank: '4', suit: 'clubs' }])).toThrow('outside');
    expect(analyzer.getMetrics()).toEqual(before);
    expect(analyzer.minPlays()).toBe(1);
  });
});

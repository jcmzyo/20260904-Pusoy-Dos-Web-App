import { expect, it } from 'vitest';
import type { Card } from '../../src/domain';
import { createHandDecomposer } from '../../src/ai';
import type { DecompositionMetrics } from '../../src/ai';
import { createDeck, defaultRuleset, generateLegalFreeLeadMoves, shuffleDeck } from '../../src/engine';

// The headless runtime provides these APIs; production targets only the ES2022 library.
const { performance, console } = globalThis as unknown as {
  performance: { now(): number };
  console: { log(message: string): void };
};

const sameSuit: Card[] = defaultRuleset.rankOrder.map((rank) => ({ rank, suit: 'clubs' }));
const repeatedRanks: Card[] = ['3', '4', '5'].flatMap((rank) =>
  defaultRuleset.suitOrder.map((suit) => ({ rank: rank as Card['rank'], suit })));
repeatedRanks.push({ rank: '6', suit: 'clubs' });
let seed = 20260913;
const dealt = shuffleDeck(createDeck(), { next() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
} }).slice(0, 13);
const fixtures = [
  { name: 'same-suit-overlap', hand: sameSuit },
  { name: 'repeated-ranks', hand: repeatedRanks },
  { name: 'seed-20260913', hand: dealt },
  ...[10, 7, 5, 3, 1, 0].map((size) => ({ name: `declining-${size}`, hand: sameSuit.slice(0, size) })),
];

it('measures exact decomposition preparation and cold/warm candidate workloads without a timing SLA', () => {
  const rows = [];
  for (const { name, hand } of fixtures) {
    const moves = generateLegalFreeLeadMoves(hand, 'south', defaultRuleset);
    const queries = [hand, ...moves.map((move) => hand.filter((card) =>
      !move.cards.some((played) => played.rank === card.rank && played.suit === card.suit)))];
    const timings: { preparation: number; cold: number; warm: number }[] = [];
    let previousResults: number[] | undefined;
    let previousMetrics: DecompositionMetrics | undefined;
    for (let sample = 0; sample < 5; sample += 1) {
      const start = performance.now();
      const analyzer = createHandDecomposer(hand, defaultRuleset, { collectMetrics: true });
      const prepared = performance.now();
      const results = queries.map((query) => analyzer.minPlays(query));
      const coldEnd = performance.now();
      const coldMetrics = analyzer.getMetrics()!;
      const warmStart = performance.now();
      const warmResults = queries.map((query) => analyzer.minPlays(query));
      const warmEnd = performance.now();
      const warmMetrics = analyzer.getMetrics()!;
      expect(warmResults).toEqual(results);
      expect(warmMetrics.cacheMisses).toBe(coldMetrics.cacheMisses);
      expect(warmMetrics.combinationMasksConsidered).toBe(coldMetrics.combinationMasksConsidered);
      expect(warmMetrics.cacheHits - coldMetrics.cacheHits).toBe(queries.length);
      expect(coldMetrics.statesVisited).toBe(coldMetrics.cacheHits + coldMetrics.cacheMisses);
      expect(coldMetrics.cacheMisses).toBeLessThan(2 ** hand.length);
      if (previousResults) expect(results).toEqual(previousResults);
      if (previousMetrics) expect(coldMetrics).toEqual(previousMetrics);
      previousResults = results;
      previousMetrics = coldMetrics;
      timings.push({ preparation: prepared - start, cold: coldEnd - prepared, warm: warmEnd - warmStart });
    }
    const uninstrumented = createHandDecomposer(hand);
    expect(queries.map((query) => uninstrumented.minPlays(query))).toEqual(previousResults);
    for (const phase of ['preparation', 'cold', 'warm'] as const) {
      const sorted = timings.map((sample) => sample[phase]).sort((a, b) => a - b);
      rows.push({ fixture: name, phase, samples: timings.length, queries: queries.length, coldMetrics: previousMetrics,
        p50Ms: Number(sorted[2]!.toFixed(3)), maxMs: Number(sorted[4]!.toFixed(3)) });
    }
  }
  // Counters describe the cold workload; warm queries add one hit each and no scans/misses.
  console.log(JSON.stringify(rows, null, 2));
});

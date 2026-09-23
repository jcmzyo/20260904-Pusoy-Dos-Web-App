import { describe, expect, it } from 'vitest';
import { createBotNameProvider, neutralBotNames } from '../../../src/application/botNames';

describe('bot-name providers', () => {
  it('uses the approved neutral seat labels', () => {
    expect(neutralBotNames()).toEqual(['West', 'North', 'East']);
  });

  it('samples without replacement from a detached user pool and resets for each Session', () => {
    const pool = ['One', 'Two', 'Three', 'Four'];
    const provide = createBotNameProvider(pool, { next: () => 0.99 });
    pool[3] = 'Changed';
    expect(provide()).toEqual(['Four', 'Three', 'Two']);
    expect(provide()).toEqual(['Four', 'Three', 'Two']);
  });

  it.each([[], ['One', 'Two'], ['One', 'One', 'Two'], ['One', ' ', 'Two']])('rejects an invalid pool %j', (...names) => {
    expect(() => createBotNameProvider(names, { next: () => 0 })).toThrow('at least three distinct, non-empty names');
  });

  it.each([NaN, Infinity, -0.1, 1])('rejects invalid randomness %s', (value) => {
    expect(createBotNameProvider(['One', 'Two', 'Three'], { next: () => value })).toThrow('RNG');
  });
});

import type { Card } from '../../domain';
import { defaultRuleset, inspectCombination } from '../../engine';
import type { RulesetConfig } from '../../engine';
import { prepareCombinationMasks } from './prepareCombinationMasks';

/** Reuses one hand's combination masks and memoized partitions across candidate remaining hands. */
export function createHandDecomposer(hand: readonly Card[], ruleset: RulesetConfig = defaultRuleset) {
  const { cards, fullMask, combinationMasks } = prepareCombinationMasks(hand, ruleset);
  const indices = new Map(cards.map((card, index) => [`${card.rank}-${card.suit}`, index]));
  const memo = new Map<number, number>([[0, 0]]);

  function solve(mask: number): number {
    const cached = memo.get(mask);
    if (cached !== undefined) return cached;
    const pivot = mask & -mask;
    let best = Infinity;
    // Every partition has exactly one combination containing this card.
    for (const combination of combinationMasks) {
      if ((combination & pivot) !== 0 && (combination & mask) === combination) {
        best = Math.min(best, 1 + solve(mask ^ combination));
      }
    }
    memo.set(mask, best);
    return best;
  }

  return {
    minPlays(remainingHand?: readonly Card[]): number {
      if (remainingHand === undefined) return solve(fullMask);
      if (!Array.isArray(remainingHand)) throw new Error('Remaining hand must be an array of cards.');
      let mask = 0;
      for (const card of remainingHand) {
        if (!inspectCombination([card], ruleset).valid) throw new Error('Remaining hand contains an invalid card.');
        const index = indices.get(`${card.rank}-${card.suit}`);
        if (index === undefined) throw new Error('Remaining hand contains a card outside the original hand.');
        const bit = 1 << index;
        if ((mask & bit) !== 0) throw new Error('Remaining hand contains a duplicate card.');
        mask |= bit;
      }
      return solve(mask);
    },
  };
}

/** Exact structural Play count, ignoring opponents and current Trick/opening restrictions. */
export function minPlays(hand: readonly Card[], ruleset: RulesetConfig = defaultRuleset): number {
  return createHandDecomposer(hand, ruleset).minPlays();
}

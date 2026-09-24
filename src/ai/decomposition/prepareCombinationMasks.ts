import type { Card } from '../../domain';
import { defaultRuleset, inspectCombination } from '../../engine';
import type { RulesetConfig } from '../../engine';

export function prepareCombinationMasks(hand: readonly Card[], ruleset: RulesetConfig = defaultRuleset) {
  if (!Array.isArray(hand) || hand.length > 13) {
    throw new Error('Decomposition requires a hand of at most 13 cards.');
  }
  const identities = new Set<string>();
  for (const card of hand) {
    if (!inspectCombination([card], ruleset).valid) {
      throw new Error('Decomposition hand contains an invalid card.');
    }
    const identity = `${card.rank}-${card.suit}`;
    if (identities.has(identity)) throw new Error(`Decomposition hand contains a duplicate card: ${identity}.`);
    identities.add(identity);
  }
  const cards = hand.map(({ rank, suit }) => ({ rank, suit })).sort((a, b) =>
    ruleset.rankOrder.indexOf(a.rank) - ruleset.rankOrder.indexOf(b.rank) ||
    ruleset.suitOrder.indexOf(a.suit) - ruleset.suitOrder.indexOf(b.suit));
  const fullMask = (1 << cards.length) - 1;
  const combinationMasks: number[] = [];
  for (let mask = 1; mask <= fullMask; mask += 1) {
    const subset = cards.filter((_, index) => (mask & (1 << index)) !== 0);
    if (inspectCombination(subset, ruleset).valid) combinationMasks.push(mask);
  }
  return { cards, fullMask, combinationMasks };
}

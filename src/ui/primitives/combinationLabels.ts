import type { Card, Combination } from '../../domain';
import { defaultRuleset } from '../../engine';

/** Human-readable labels for the canonical combination categories (requirements.md §2.3, domain-model.md §8). */
export const COMBINATION_LABELS: Record<Combination['type'], string> = {
  single: 'Single', pair: 'Pair', triple: 'Triple', straight: 'Straight',
  flush: 'Flush', fullHouse: 'Full House', fourOfAKind: 'Four of a Kind', straightFlush: 'Straight Flush',
};

/**
 * Returns `combination`'s cards in display order for the center table's hand to beat
 * (ui-ux.md §5.1) and each seat's own Play trail (§5.4).
 *
 * Every combination type other than Straight/Straight Flush displays in the same order
 * the Move itself was submitted in (`inspectCombination` preserves input order and never
 * sorts). A Straight or Straight Flush instead displays in its own ascending house-rule
 * sequence (requirements.md §2.4.1) rather than that submission order — for example
 * `A-2-3-4-5` rather than however the player happened to select/hold those cards, most
 * visibly `3,4,5,A,2` (the domain's own Rank order used for held-hand sorting, ui-ux.md
 * §6, places A and 2 after K, which is correct for hand-sorting and Straight *strength*
 * but reads oddly for a Straight's own *sequence*). Normal Straights (`3-4-5-6-7` through
 * `10-J-Q-K-A`) and `J-Q-K-A-2` already match that domain Rank order, so this only ever
 * visibly reorders the two special low Straights, `A-2-3-4-5` and `2-3-4-5-6`.
 *
 * This reuses `defaultRuleset`'s own public `straightRules.patterns` (engine/index.ts) to
 * find the matching sequence rather than reimplementing Straight validity/ordering here —
 * per domain-model.md's caution against another module leaking or duplicating the
 * Engine's own authoritative combination representation. `combination.cards` for a
 * `straight`/`straightFlush` is guaranteed by the Engine to match exactly one configured
 * pattern, so a miss here indicates a genuine Engine/UI contract violation, not a
 * plausible display case to paper over.
 */
export function getDisplayCards(combination: Combination): Card[] {
  if (combination.type !== 'straight' && combination.type !== 'straightFlush') {
    return [...combination.cards];
  }
  const pattern = defaultRuleset.straightRules.patterns.find((candidate) =>
    candidate.ranks.every((rank) => combination.cards.some((card) => card.rank === rank)),
  );
  if (!pattern) {
    throw new Error(
      `${COMBINATION_LABELS[combination.type]} combination's ranks (${combination.cards.map((card) => card.rank).join(',')}) match no configured house-rule Straight sequence.`,
    );
  }
  return pattern.ranks.map((rank) => combination.cards.find((card) => card.rank === rank)!);
}

/**
 * Short reason-text description of a recognized combination, e.g. "Pair of 9s" (ui-ux.md §7's own
 * example reason text: "Doesn't beat Pair of 9s"). Used both as positive Play feedback (M4-T08) and to
 * name the current hand to beat inside a non-beating reason.
 */
export function describeCombination(combination: Combination): string {
  const rank = combination.cards[0]!.rank;
  switch (combination.type) {
    case 'single': return `Single ${rank}`;
    case 'pair': return `Pair of ${rank}s`;
    case 'triple': return `Triple ${rank}s`;
    default: return COMBINATION_LABELS[combination.type];
  }
}

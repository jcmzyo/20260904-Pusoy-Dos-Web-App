import type { Card, Combination } from '../../domain';
import { defaultRuleset } from '../../engine';

/** Human-readable labels for the canonical combination categories (requirements.md §2.3, domain-model.md §8). */
export const COMBINATION_LABELS: Record<Combination['type'], string> = {
  single: 'Single', pair: 'Pair', triple: 'Triple', straight: 'Straight',
  flush: 'Flush', fullHouse: 'Full House', fourOfAKind: 'Four of a Kind', straightFlush: 'Straight Flush',
};

const suitIndex = (card: Card) => defaultRuleset.suitOrder.indexOf(card.suit);
const rankIndex = (card: Card) => defaultRuleset.rankOrder.indexOf(card.rank);
const bySuitLowToHigh = (cards: readonly Card[]) => [...cards].sort((a, b) => suitIndex(a) - suitIndex(b));
const byRankLowToHigh = (cards: readonly Card[]) => [...cards].sort((a, b) => rankIndex(a) - rankIndex(b));

/**
 * Splits a five-card Full House/Four-of-a-Kind's cards into its two same-Rank groups, returning
 * them in the order `sizes` names (e.g. `[2, 3]` returns `[pairCards, tripleCards]`). Counting
 * Rank occurrences here (rather than importing the Engine's own internal `FullHouseStrength`/
 * `FourOfAKindStrength` types, engine.md §12) keeps this UI module from leaking or duplicating
 * Engine-internal comparison representations (domain-model.md's own caution) — this only reads
 * the already-public `Combination.cards` shape to separate two already-Engine-validated groups
 * for display, it does not re-derive combination validity or strength.
 */
function splitByRankCount(cards: readonly Card[], sizes: readonly [number, number]): [Card[], Card[]] {
  const groups = new Map<string, Card[]>();
  for (const card of cards) groups.set(card.rank, [...(groups.get(card.rank) ?? []), card]);
  const values = [...groups.values()];
  return sizes.map((size) => values.find((group) => group.length === size)!) as [Card[], Card[]];
}

/**
 * Returns `combination`'s cards in display order for the center table's hand to beat
 * (ui-ux.md §5.1) and each seat's own Play trail (§5.4).
 *
 * A Single displays unchanged. A Pair or Triple (all cards share one Rank) and a Flush's own
 * Rank-tie-broken Suit group each display ordered by Suit low → high; a Flush overall displays
 * ordered by Rank low → high. A Full House displays its Pair's two cards (Suit low → high) then
 * its Triple's three cards (Suit low → high); a Four-of-a-Kind displays its single kicker card
 * first, then its four matching cards (Suit low → high) last. In every one of these cases, the
 * card(s) whose Rank actually determines that combination type's comparison strength
 * (requirements.md §2.4.2-§2.4.4: a Pair/Triple's shared Rank with ties broken by the highest
 * Suit; a Flush's highest-Rank card; a Full House's Triple only, never its Pair; a
 * Four-of-a-Kind's four matching cards only, never its kicker) end up rightmost — the same
 * "power determiner reads rightmost" convention a Straight/Straight Flush's own ascending
 * sequence (below) already uses, via its own highest/effective-high card landing last.
 *
 * A Straight or Straight Flush instead displays in its own ascending house-rule sequence
 * (requirements.md §2.4.1) rather than submission order — for example `A-2-3-4-5` rather than
 * however the player happened to select/hold those cards, most visibly `3,4,5,A,2` (the domain's
 * own Rank order used for held-hand sorting, ui-ux.md §6, places A and 2 after K, which is correct
 * for hand-sorting and Straight *strength* but reads oddly for a Straight's own *sequence*).
 * Normal Straights (`3-4-5-6-7` through `10-J-Q-K-A`) and `J-Q-K-A-2` already match that domain
 * Rank order, so this only ever visibly reorders the two special low Straights, `A-2-3-4-5` and
 * `2-3-4-5-6`.
 *
 * This reuses `defaultRuleset`'s own public `straightRules.patterns`/`suitOrder`/`rankOrder`
 * (engine/index.ts) rather than reimplementing Straight validity/ordering or comparison strength
 * here — per domain-model.md's caution against another module leaking or duplicating the
 * Engine's own authoritative combination representation. `combination.cards` for a
 * `straight`/`straightFlush` is guaranteed by the Engine to match exactly one configured
 * pattern, so a miss here indicates a genuine Engine/UI contract violation, not a
 * plausible display case to paper over.
 */
export function getDisplayCards(combination: Combination): Card[] {
  switch (combination.type) {
    case 'single':
      return [...combination.cards];
    case 'pair':
    case 'triple':
      return bySuitLowToHigh(combination.cards);
    case 'flush':
      return byRankLowToHigh(combination.cards);
    case 'fullHouse': {
      const [pairCards, tripleCards] = splitByRankCount(combination.cards, [2, 3]);
      return [...bySuitLowToHigh(pairCards), ...bySuitLowToHigh(tripleCards)];
    }
    case 'fourOfAKind': {
      const [kickerCards, quadCards] = splitByRankCount(combination.cards, [1, 4]);
      return [...kickerCards, ...bySuitLowToHigh(quadCards)];
    }
    default: {
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
  }
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

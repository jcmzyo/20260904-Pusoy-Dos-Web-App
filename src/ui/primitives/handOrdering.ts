import type { Card, Rank, Suit } from '../../domain';

/**
 * Pure display-order helpers for the human hand (M4-T07; ui-ux.md §6).
 *
 * These implement the two canonical *display* sort orders the UI is
 * required to offer:
 *
 *   - Sort by Rank: Rank 3 → ... → A → 2; ties broken Clubs → Spades →
 *     Hearts → Diamonds.
 *   - Sort by Suit: Clubs → Spades → Hearts → Diamonds; within a suit,
 *     Rank 3 → ... → A → 2.
 *
 * This intentionally does not reuse the Engine's internal
 * `cardComparison.ts` helpers: those are not part of the Engine's public
 * package boundary (`src/engine/index.ts`), and this module only orders
 * the human player's own cards for on-screen display — it never decides
 * legality, beats, or scoring, which remain entirely Engine-owned. The
 * rank/suit orders below happen to match `defaultRuleset` because both
 * describe the same house rules (requirements.md §2.2), not because this
 * module consumes the ruleset.
 */

const RANK_ORDER: readonly Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUIT_ORDER: readonly Suit[] = ['clubs', 'spades', 'hearts', 'diamonds'];

/** Stable per-card identity for a physical card, used as a React key and a display-order token. */
export function cardKey(card: Card): string {
  return `${card.rank}-${card.suit}`;
}

function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

function suitIndex(suit: Suit): number {
  return SUIT_ORDER.indexOf(suit);
}

/** Sort-by-Rank comparator (ui-ux.md §6): Rank first, Suit breaks ties. */
export function compareByRank(a: Card, b: Card): number {
  const rankDiff = rankIndex(a.rank) - rankIndex(b.rank);
  return rankDiff !== 0 ? rankDiff : suitIndex(a.suit) - suitIndex(b.suit);
}

/** Sort-by-Suit comparator (ui-ux.md §6): Suit first, Rank breaks ties. */
export function compareBySuit(a: Card, b: Card): number {
  const suitDiff = suitIndex(a.suit) - suitIndex(b.suit);
  return suitDiff !== 0 ? suitDiff : rankIndex(a.rank) - rankIndex(b.rank);
}

/** Returns display-order keys for `cards` sorted canonically by Rank. */
export function sortKeysByRank(cards: readonly Card[]): string[] {
  return [...cards].sort(compareByRank).map(cardKey);
}

/** Returns display-order keys for `cards` sorted canonically by Suit. */
export function sortKeysBySuit(cards: readonly Card[]): string[] {
  return [...cards].sort(compareBySuit).map(cardKey);
}

/**
 * Moves `key` out of `order` and reinserts it at `targetIndex` (clamped to
 * the remaining bounds). Used for manual drag reorder: reordering only
 * ever changes this array, never which keys are selected.
 */
export function moveKey(order: readonly string[], key: string, targetIndex: number): string[] {
  const without = order.filter((entry) => entry !== key);
  const clamped = Math.min(Math.max(targetIndex, 0), without.length);
  return [...without.slice(0, clamped), key, ...without.slice(clamped)];
}

/**
 * Reconciles a display-order key array against the current authoritative
 * card set: keeps the existing relative order for cards still present and
 * appends any newly-seen cards at the end. Returns the same array
 * reference when nothing changed, so callers can skip a re-render.
 */
export function reconcileOrder(order: readonly string[], currentKeys: ReadonlySet<string>): string[] {
  const kept = order.filter((key) => currentKeys.has(key));
  const missing = [...currentKeys].filter((key) => !kept.includes(key));
  if (missing.length === 0 && kept.length === order.length) return order as string[];
  return [...kept, ...missing];
}

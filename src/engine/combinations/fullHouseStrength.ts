import type { Card, Rank } from '../../domain';

/** Engine-only strength; pair rank and all suits are irrelevant. */
export interface FullHouseStrength {
  readonly tripleRank: Rank;
}

/** Matches exactly a triple and a separate pair in validated, unique cards. */
export function getFullHouseStrength(cards: readonly Card[]): FullHouseStrength | null {
  if (cards.length !== 5) return null;
  const counts = new Map<Rank, number>();
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  if (counts.size !== 2) return null;
  for (const [rank, count] of counts) {
    if (count === 3) return { tripleRank: rank };
  }
  return null;
}

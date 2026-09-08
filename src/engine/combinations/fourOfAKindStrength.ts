import type { Card, Rank } from '../../domain';

/** Engine-only strength; the kicker does not affect comparison. */
export interface FourOfAKindStrength {
  readonly quadRank: Rank;
}

/** Matches exactly a quad and a separate kicker in validated, unique cards. */
export function getFourOfAKindStrength(cards: readonly Card[]): FourOfAKindStrength | null {
  if (cards.length !== 5) return null;
  const counts = new Map<Rank, number>();
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  if (counts.size !== 2) return null;
  for (const [rank, count] of counts) {
    if (count === 4) return { quadRank: rank };
  }
  return null;
}

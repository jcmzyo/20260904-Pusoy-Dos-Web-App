import type { Card, PlayerId, PlayMove } from '../../domain';
import type { RulesetConfig } from '../config/RulesetConfig';
import { inspectCombination } from '../combinations/inspectCombination';

/** Enumerates opening Plays from an authoritative hand; Round/Turn eligibility is the caller's responsibility. */
export function generateLegalOpeningMoves(
  hand: readonly Card[],
  playerId: PlayerId,
  ruleset: RulesetConfig,
): readonly PlayMove[] {
  if (!Array.isArray(hand) || hand.length > 13) {
    throw new Error('Opening generation requires a hand of at most 13 cards.');
  }
  const seen = new Set<string>();
  for (const card of hand) {
    if (!inspectCombination([card], ruleset).valid) {
      throw new Error('Opening hand contains an invalid card.');
    }
    const identity = `${card.rank}-${card.suit}`;
    if (seen.has(identity)) {
      throw new Error(`Opening hand contains a duplicate card: ${identity}.`);
    }
    seen.add(identity);
  }
  if (!seen.has('3-clubs')) return [];

  const moves: PlayMove[] = [];
  const selected: Card[] = [];
  function enumerate(start: number, size: number): void {
    if (selected.length === size) {
      if (!selected.some((card) => card.rank === '3' && card.suit === 'clubs')) return;
      const result = inspectCombination(selected, ruleset);
      if (result.valid) {
        moves.push({ kind: 'play', playerId, cards: result.combination.cards });
      }
      return;
    }
    for (let index = start; index <= hand.length - (size - selected.length); index += 1) {
      selected.push(hand[index]!);
      enumerate(index + 1, size);
      selected.pop();
    }
  }
  for (const size of [1, 2, 3, 5]) enumerate(0, size);
  return moves;
}

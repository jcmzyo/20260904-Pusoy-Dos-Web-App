import type { Card, PlayerId, PlayMove } from '../../domain';
import type { RulesetConfig } from '../config/RulesetConfig';
import { inspectCombination } from '../combinations/inspectCombination';

/** Enumerates free-lead Plays from an authoritative hand; Round/Turn eligibility is the caller's responsibility. */
export function generateLegalFreeLeadMoves(
  hand: readonly Card[],
  playerId: PlayerId,
  ruleset: RulesetConfig,
): readonly PlayMove[] {
  if (!Array.isArray(hand) || hand.length > 13) {
    throw new Error('Free-lead generation requires a hand of at most 13 cards.');
  }
  const seen = new Set<string>();
  for (const card of hand) {
    if (!inspectCombination([card], ruleset).valid) {
      throw new Error('Free-lead hand contains an invalid card.');
    }
    const identity = `${card.rank}-${card.suit}`;
    if (seen.has(identity)) {
      throw new Error(`Free-lead hand contains a duplicate card: ${identity}.`);
    }
    seen.add(identity);
  }

  const moves: PlayMove[] = [];
  const selected: Card[] = [];
  function enumerate(start: number, size: number): void {
    if (selected.length === size) {
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

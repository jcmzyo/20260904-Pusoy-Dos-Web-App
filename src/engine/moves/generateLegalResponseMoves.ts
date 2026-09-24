import type { Card, Combination, Move, PlayerId } from '../../domain';
import type { RulesetConfig } from '../config/RulesetConfig';
import { canBeat } from '../combinations/canBeat';
import { inspectCombination } from '../combinations/inspectCombination';

/** Enumerates normal responses from an authoritative hand; Round/Turn eligibility is the caller's responsibility. */
export function generateLegalResponseMoves(
  hand: readonly Card[],
  playerId: PlayerId,
  current: Combination,
  ruleset: RulesetConfig,
): readonly Move[] {
  if (!Array.isArray(hand) || hand.length > 13) {
    throw new Error('Response generation requires a hand of at most 13 cards.');
  }
  const seen = new Set<string>();
  for (const card of hand) {
    if (!inspectCombination([card], ruleset).valid) {
      throw new Error('Response hand contains an invalid card.');
    }
    const identity = `${card.rank}-${card.suit}`;
    if (seen.has(identity)) {
      throw new Error(`Response hand contains a duplicate card: ${identity}.`);
    }
    seen.add(identity);
  }
  const inspected = inspectCombination(current?.cards, ruleset);
  if (!inspected.valid || inspected.combination.type !== current.type) {
    throw new Error('Response generation requires a valid canonical current combination.');
  }
  const currentCombination = inspected.combination;
  for (const card of currentCombination.cards) {
    if (seen.has(`${card.rank}-${card.suit}`)) {
      throw new Error('Response hand overlaps the current combination.');
    }
  }
  if (hand.length === 0) return [];

  const moves: Move[] = [{ kind: 'pass', playerId }];
  const selected: Card[] = [];
  const size = currentCombination.cards.length;
  function enumerate(start: number): void {
    if (selected.length === size) {
      const result = inspectCombination(selected, ruleset);
      if (result.valid && canBeat(result.combination, currentCombination, ruleset)) {
        moves.push({ kind: 'play', playerId, cards: result.combination.cards });
      }
      return;
    }
    for (let index = start; index <= hand.length - (size - selected.length); index += 1) {
      selected.push(hand[index]!);
      enumerate(index + 1);
      selected.pop();
    }
  }
  enumerate(0);
  return moves;
}

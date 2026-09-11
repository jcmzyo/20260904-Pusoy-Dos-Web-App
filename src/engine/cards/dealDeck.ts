import type { Card, PlayerId } from '../../domain';
import { createDeck } from './createDeck';

export interface DealResult {
  readonly hands: readonly {
    readonly playerId: PlayerId;
    readonly cards: readonly Card[];
  }[];
  readonly startingPlayerId: PlayerId;
}

/** Deals round-robin in supplied player order, starting at deck index zero, without shuffling or mutating inputs. */
export function dealDeck(deck: readonly Card[], playerIds: readonly PlayerId[]): DealResult {
  if (playerIds.length !== 4 || new Set(playerIds).size !== 4) {
    throw new Error('Deal requires exactly four distinct player IDs.');
  }
  if (deck.length !== 52) {
    throw new Error('Deal requires exactly 52 cards.');
  }

  const remainingCards = new Set(createDeck().map((card) => `${card.rank}-${card.suit}`));
  for (const card of deck) {
    if (!remainingCards.delete(`${card.rank}-${card.suit}`)) {
      throw new Error(`Deal contains an invalid or duplicate card: ${card.rank}-${card.suit}.`);
    }
  }

  const hands = playerIds.map((playerId) => ({ playerId, cards: [] as Card[] }));
  for (let index = 0; index < deck.length; index += 1) {
    hands[index % 4]!.cards.push(deck[index]!);
  }
  const startingHand = hands.find((hand) => hand.cards.some((card) => card.rank === '3' && card.suit === 'clubs'));
  if (!startingHand) {
    throw new Error('Deal is missing the three of clubs.');
  }

  return { hands, startingPlayerId: startingHand.playerId };
}

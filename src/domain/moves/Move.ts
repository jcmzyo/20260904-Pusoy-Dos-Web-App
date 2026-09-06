import type { Card } from '../cards/Card';
import type { PlayerId } from '../players/PlayerId';

/**
 * A Move represents player intent submitted for authoritative
 * processing (domain-model.md §10). It is shared because a Human
 * Controller, an AI Controller, a future Network Controller, and the
 * Game Orchestrator all produce/forward one, and the Game Engine
 * validates it.
 *
 * A Move represents intent, not proof of legality. Only the Game
 * Engine determines whether a submitted Move is legal.
 */
export type Move =
  | PlayMove
  | PassMove;

/**
 * Intent to play one valid card combination from the player's hand.
 */
export interface PlayMove {
  readonly kind: 'play';
  readonly playerId: PlayerId;
  readonly cards: readonly Card[];
}

/**
 * Intent to decline playing cards for the current turn. A Pass does
 * not remove the player from the round (requirements.md §1.4).
 */
export interface PassMove {
  readonly kind: 'pass';
  readonly playerId: PlayerId;
}

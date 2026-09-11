import type { Card } from '../cards/Card';
import type { CombinationType } from './CombinationType';

/**
 * A shared description of a set of cards that the authoritative Game
 * Engine has recognized as a valid combination (domain-model.md §9).
 *
 * Constructing a `Combination` value does not itself prove that the
 * cards form a valid combination. Authoritative creation/validation
 * comes from the Game Engine. Other modules (e.g. UI, AI) may display
 * or inspect an Engine-produced `Combination`, but must not
 * reimplement combination detection merely to construct one.
 *
 * Engine-internal normalized comparison data (`CombinationStrength` in
 * engine.md §12) is intentionally excluded from this shared type — it
 * is an engine implementation detail, not shared domain vocabulary
 * (domain-model.md §9.1).
 */
export interface Combination {
  readonly type: CombinationType;
  readonly cards: readonly Card[];
}

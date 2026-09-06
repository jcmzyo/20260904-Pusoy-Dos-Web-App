/**
 * Canonical valid combination categories in Pusoy Dos
 * (requirements.md §2.3; domain-model.md §8).
 *
 * This type only names the canonical categories. It does not define:
 * - how a combination is detected;
 * - whether a set of cards is valid;
 * - how combinations compare;
 * - whether a combination can currently be played.
 *
 * Those are authoritative Game Engine responsibilities (engine.md §11-12).
 */
export type CombinationType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'flush'
  | 'fullHouse'
  | 'fourOfAKind'
  | 'straightFlush';

/**
 * Canonical card rank values in Pusoy Dos.
 *
 * This type enumerates only the valid rank values. Authoritative rank
 * ordering and comparison behavior belong to the Game Engine's
 * `RulesetConfig`, not to this shared domain type.
 */
export type Rank =
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'
  | '2';

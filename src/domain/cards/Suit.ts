/**
 * Canonical card suit values in Pusoy Dos.
 *
 * This type enumerates only the valid suit values. Authoritative suit
 * ordering belongs to the Game Engine's `RulesetConfig`, not to this
 * shared domain type.
 */
export type Suit =
  | 'clubs'
  | 'spades'
  | 'hearts'
  | 'diamonds';

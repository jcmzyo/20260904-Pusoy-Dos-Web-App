import type { Card, Combination, Move, PlayerId } from '../../domain';
import type { RulesetConfig } from '../config/RulesetConfig';
import { inspectCombination } from '../combinations/inspectCombination';
import { canBeat } from '../combinations/canBeat';

/** Engine-owned facts needed for validation, not a complete Session state. */
export interface MoveValidationContext {
  readonly sessionActive: boolean;
  readonly roundActive: boolean;
  readonly players: readonly {
    readonly playerId: PlayerId;
    readonly active: boolean;
    readonly hand: readonly Card[];
  }[];
  readonly currentPlayerId: PlayerId;
  readonly trick:
    | { readonly kind: 'opening' | 'freeLead' }
    | { readonly kind: 'response'; readonly current: Combination };
}

export type MoveErrorCode =
  | 'SESSION_NOT_ACTIVE'
  | 'ROUND_NOT_ACTIVE'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_NOT_ACTIVE'
  | 'NOT_YOUR_TURN'
  | 'CARD_NOT_OWNED'
  | 'DUPLICATE_CARD'
  | 'INVALID_COMBINATION'
  | 'OPENING_REQUIRES_THREE_OF_CLUBS'
  | 'PLAY_DOES_NOT_BEAT_CURRENT'
  | 'PASS_NOT_ALLOWED';

export interface MoveValidationError {
  readonly code: MoveErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type MoveValidationResult =
  | { readonly valid: true; readonly kind: 'play'; readonly combination: Combination }
  | { readonly valid: true; readonly kind: 'pass' }
  | { readonly valid: false; readonly error: MoveValidationError };

/** Validates intent only; neither success nor rejection applies a state transition. */
export function validateMove(
  context: MoveValidationContext,
  move: Move,
  ruleset: RulesetConfig,
): MoveValidationResult {
  const reject = (code: MoveErrorCode): MoveValidationResult => ({ valid: false, error: { code } });
  if (!context.sessionActive) return reject('SESSION_NOT_ACTIVE');
  if (!context.roundActive) return reject('ROUND_NOT_ACTIVE');
  const player = context.players.find((entry) => entry.playerId === move?.playerId);
  if (!player) return reject('PLAYER_NOT_FOUND');
  if (!player.active || player.hand.length === 0) return reject('PLAYER_NOT_ACTIVE');
  if (player.playerId !== context.currentPlayerId) return reject('NOT_YOUR_TURN');

  const owned = new Set<string>();
  for (const card of player.hand) {
    if (!inspectCombination([card], ruleset).valid) {
      throw new Error('Move validation requires a valid authoritative hand.');
    }
    const identity = `${card.rank}-${card.suit}`;
    if (owned.has(identity)) throw new Error('Authoritative hand contains a duplicate card.');
    owned.add(identity);
  }
  if (context.trick.kind === 'response') {
    const current = inspectCombination(context.trick.current?.cards, ruleset);
    if (!current.valid || current.combination.type !== context.trick.current.type) {
      throw new Error('Move validation requires a canonical current combination.');
    }
    if (current.combination.cards.some((card) => owned.has(`${card.rank}-${card.suit}`))) {
      throw new Error('Authoritative hand overlaps the current combination.');
    }
  }

  if (move.kind === 'pass') {
    return context.trick.kind === 'response' ? { valid: true, kind: 'pass' } : reject('PASS_NOT_ALLOWED');
  }
  if (move.kind !== 'play' || !Array.isArray(move.cards)) return reject('INVALID_COMBINATION');
  const submitted = new Set<string>();
  for (const card of move.cards) {
    if (!inspectCombination([card], ruleset).valid) return reject('INVALID_COMBINATION');
    const identity = `${card.rank}-${card.suit}`;
    if (submitted.has(identity)) return reject('DUPLICATE_CARD');
    if (!owned.has(identity)) return reject('CARD_NOT_OWNED');
    submitted.add(identity);
  }
  const inspected = inspectCombination(move.cards, ruleset);
  if (!inspected.valid) return reject('INVALID_COMBINATION');
  if (context.trick.kind === 'opening' && !submitted.has('3-clubs')) {
    return reject('OPENING_REQUIRES_THREE_OF_CLUBS');
  }
  if (context.trick.kind === 'response' && !canBeat(inspected.combination, context.trick.current, ruleset)) {
    return reject('PLAY_DOES_NOT_BEAT_CURRENT');
  }
  return { valid: true, kind: 'play', combination: inspected.combination };
}

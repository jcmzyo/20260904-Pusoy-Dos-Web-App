import type { Card, Move, PlayerId } from '../domain';
import { createDeck } from './cards/createDeck';
import { inspectCombination } from './combinations/inspectCombination';
import type { RulesetConfig } from './config/RulesetConfig';
import type { MoveResult } from './GameEngine';
import { generateLegalResponseMoves } from './moves/generateLegalResponseMoves';
import { validateMove } from './moves/validateMove';
import type { BasicRoundResult, BasicRoundState } from './rounds/resolveBasicRound';
import { basicSessionStandings, resolveBasicSessionResult } from './sessions/basicSessionResult';
import type { BasicSessionState } from './sessions/resolveBasicSession';

export class EngineInvariantError extends Error {
  constructor(readonly code: string, readonly roundNumber: number, message: string) {
    super(`${code} (Round ${roundNumber}): ${message}`);
    this.name = 'EngineInvariantError';
  }
}

const identity = (card: Card) => `${card.rank}-${card.suit}`;
function same(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => same(entry, right[index]));
  }
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((key) => Object.hasOwn(b, key) && same(a[key], b[key]));
}
const cardsEqual = (left: readonly Card[], right: readonly Card[]) => same(left.map(identity).sort(), right.map(identity).sort());
const playersOf = (round: BasicRoundState) => round.kind === 'inProgress' ? round.context.players : round.players;

function requireInvariant(condition: unknown, state: BasicSessionState, code: string, message: string): asserts condition {
  if (!condition) throw new EngineInvariantError(code, state.roundNumber, message);
}

function assertPlacements(result: BasicRoundResult, state: BasicSessionState): void {
  requireInvariant(result.placements.length === 4 && new Set(result.placements.map((entry) => entry.playerId)).size === 4
    && result.placements.every((entry) => state.playerIds.includes(entry.playerId))
    && [1, 2, 3, 4].every((placement) => result.placements.filter((entry) => entry.placement === placement).length === 1)
    && result.placements.every((entry) => entry.points === [5, 3, 2, 0][entry.placement - 1]),
  state, 'PLACEMENTS', 'Each participant requires one placement with points +5/+3/+2/0.');
}

/** Checks snapshots. Removed cards are the deck complement; use assertMoveInvariants on every Move to prove conservation over time. */
export function assertEngineInvariants(state: BasicSessionState, ruleset: RulesetConfig): void {
  const check = (condition: unknown, code: string, message: string) => requireInvariant(condition, state, code, message);
  check(state.playerIds.length === 4 && new Set(state.playerIds).size === 4, 'PLAYERS', 'A Session requires four distinct participants.');
  const completed = state.completedRounds.length;
  check(completed <= 5 && Number.isInteger(state.roundNumber) && state.roundNumber >= 0 && state.roundNumber <= 5,
    'SESSION_LIFECYCLE', 'Round counts must stay within the five-Round Session.');
  check(state.kind === (completed === 5 ? 'completed' : 'inProgress'), 'SESSION_LIFECYCLE', 'Session completes exactly after five Rounds.');
  for (const result of state.completedRounds) assertPlacements(result, state);
  check(same(state.standings, basicSessionStandings(state.playerIds, state.completedRounds)), 'SESSION_TOTALS', 'Standings must equal authoritative Round results.');
  check(same(state.result, completed === 5 ? resolveBasicSessionResult(state.playerIds, state.completedRounds) : null),
    'SESSION_RESULT', 'Final result must match the five-Round tiebreak.');
  const round = state.round;
  if (!round) {
    check(state.roundNumber === 0 && completed === 0, 'ROUND_LIFECYCLE', 'Only an unstarted Session has no Round.');
    return;
  }
  check(state.roundNumber === completed + (round.kind === 'inProgress' ? 1 : 0), 'ROUND_LIFECYCLE', 'Round number must agree with completed results.');
  const players = playersOf(round);
  check(same(players.map((player) => player.playerId), state.playerIds), 'PLAYERS', 'Round participants must retain Session seat order.');
  const deck = new Set(createDeck().map(identity));
  const held = new Set<string>();
  for (const player of players) {
    check(player.hand.length <= 13, 'CARD_CONSERVATION', `${player.playerId} holds more than 13 cards.`);
    for (const card of player.hand) {
      const key = identity(card);
      check(deck.has(key), 'CARD_IDENTITY', `${player.playerId} holds noncanonical card ${key}.`);
      check(!held.has(key), 'CARD_LOCATION', `${key} occurs in multiple hand locations, including ${player.playerId}.`);
      held.add(key);
    }
  }
  check(new Set(round.finishOrder).size === round.finishOrder.length && round.finishOrder.every((id) => state.playerIds.includes(id)),
    'FINISH_ORDER', 'Finish records must contain distinct participants.');
  for (const player of players) {
    check(round.finishOrder.includes(player.playerId) ? !player.active && player.hand.length === 0 : player.active && player.hand.length > 0,
      'FINISHED_PLAYER', `${player.playerId} has inconsistent hand, active status or finish record.`);
  }
  if (round.kind === 'completed') {
    check(round.finishOrder.length === 3, 'ROUND_LIFECYCLE', 'Completed Basic Round requires exactly three finishers.');
    assertPlacements(round.result, state);
    const order = [...round.finishOrder, ...players.filter((player) => player.active).map((player) => player.playerId)];
    check(order.every((id, index) => round.result.placements.find((entry) => entry.playerId === id)?.placement === index + 1),
      'PLACEMENTS', 'Placements must follow finish order, with the remaining player fourth.');
    check(same(round.result, state.completedRounds.at(-1)), 'ROUND_LIFECYCLE', 'Completed Round must be recorded exactly once.');
    return;
  }
  const { context, responseCycle } = round;
  check(round.finishOrder.length < 3 && context.sessionActive && context.roundActive, 'ROUND_LIFECYCLE', 'Input requires an active Round with at least two active players.');
  check(players.some((player) => player.playerId === context.currentPlayerId && player.active && player.hand.length > 0),
    'TURN_OWNER', 'Turn owner must be an active participant with cards.');
  if (context.trick.kind === 'opening') {
    check(held.size === 52 && players.every((player) => player.hand.length === 13) && round.finishOrder.length === 0,
      'CARD_CONSERVATION', 'Opening requires all 52 unique cards, dealt 13 per player.');
    check(players.find((player) => player.playerId === context.currentPlayerId)!.hand.some((card) => identity(card) === '3-clubs'),
      'OPENING', 'Opening Turn belongs to the holder of 3-clubs.');
  } else {
    check(!held.has('3-clubs'), 'OPENING', '3-clubs must have been played before response or free lead.');
  }
  if (context.trick.kind !== 'response') {
    check(responseCycle === null, 'PASS_RESET', 'Opening and free lead cannot retain response-cycle Passes.');
    return;
  }
  const inspected = inspectCombination(context.trick.current.cards, ruleset);
  check(inspected.valid && inspected.combination.type === context.trick.current.type, 'TRICK', 'Current combination must be canonical.');
  check(context.trick.current.cards.every((card) => !held.has(identity(card))), 'CARD_LOCATION', 'Current combination cards must already be removed from every hand.');
  requireInvariant(responseCycle && state.playerIds.includes(responseCycle.lastSuccessfulPlayerId), state, 'PASS_RESET', 'Response requires a known last successful player.');
  check(new Set(responseCycle.passedPlayerIds).size === responseCycle.passedPlayerIds.length
    && responseCycle.passedPlayerIds.every((id) => id !== responseCycle.lastSuccessfulPlayerId && players.some((player) => player.playerId === id && player.active))
    && context.currentPlayerId !== responseCycle.lastSuccessfulPlayerId && !responseCycle.passedPlayerIds.includes(context.currentPlayerId),
    'PASS_RESET', 'Pass records and current responder must belong to an unresolved response cycle.');
}

/** Pass an unchanged pre-Move snapshot and the actual result, including rejected intent. Never repairs either state. */
export function assertMoveInvariants(previous: BasicSessionState, move: Move, result: MoveResult, ruleset: RulesetConfig): void {
  assertEngineInvariants(previous, ruleset);
  const { state } = result;
  const check = (condition: unknown, code: string, message: string) => requireInvariant(condition, state, code, message);
  const before = previous.round;
  if (!result.accepted) {
    check(same(previous, state) && result.events.length === 0, 'REJECTED_MOVE', 'Rejected intent must preserve state and emit no events.');
    return;
  }
  requireInvariant(previous.kind === 'inProgress' && before?.kind === 'inProgress', state, 'ACCEPTED_MOVE', 'Completed or unstarted gameplay cannot accept a Move.');
  const validation = validateMove(before.context, move, ruleset);
  requireInvariant(validation.valid, state, 'ACCEPTED_MOVE', `Accepted Move violates ${validation.valid ? '' : validation.error.code}.`);
  assertEngineInvariants(state, ruleset);
  const after = state.round;
  requireInvariant(after, state, 'ROUND_LIFECYCLE', 'Accepted Move must retain its Round.');
  check(same(state.playerIds, previous.playerIds) && state.roundNumber === previous.roundNumber, 'ROUND_LIFECYCLE', 'Moves cannot change participants or start another Round.');
  const removed = new Set(move.kind === 'play' ? move.cards.map(identity) : []);
  for (const player of playersOf(before)) {
    const expected = player.playerId === move.playerId ? player.hand.filter((card) => !removed.has(identity(card))) : player.hand;
    check(cardsEqual(playersOf(after).find((entry) => entry.playerId === player.playerId)!.hand, expected),
      'CARD_CONSERVATION', `${player.playerId}: only the accepted submitted cards may leave the actor's hand; no other cards may change location.`);
  }
  const finished = move.kind === 'play' && playersOf(after).find((player) => player.playerId === move.playerId)!.hand.length === 0;
  check(same(after.finishOrder, finished ? [...before.finishOrder, move.playerId] : before.finishOrder), 'FINISH_ORDER', 'Only a newly empty actor is appended to finish order.');
  check(same(state.completedRounds, after.kind === 'completed' ? [...previous.completedRounds, after.result] : previous.completedRounds),
    'SESSION_TOTALS', 'Only a newly completed Round may append one result.');
  if (after.kind === 'completed') return;
  const players = playersOf(after);
  const clockwiseAfter = (id: PlayerId) => {
    const index = players.findIndex((player) => player.playerId === id);
    return [1, 2, 3, 4].map((offset) => players[(index + offset) % 4]!).filter((player) => player.active);
  };
  let leader: PlayerId;
  let passed: readonly PlayerId[];
  let reset: boolean;
  let next: PlayerId;
  if (validation.kind === 'play') {
    leader = move.playerId;
    passed = [];
    const remaining = clockwiseAfter(leader);
    const responder = finished ? remaining.find((player) => generateLegalResponseMoves(player.hand, player.playerId, validation.combination, ruleset).some((candidate) => candidate.kind === 'play')) : remaining[0];
    reset = responder === undefined;
    next = (responder ?? remaining[0])!.playerId;
    if (!reset) check(after.context.trick.kind === 'response' && after.context.trick.current.type === validation.combination.type
      && cardsEqual(after.context.trick.current.cards, validation.combination.cards), 'TRICK', 'Accepted Play must become the current combination.');
  } else {
    requireInvariant(before.responseCycle, state, 'PASS_RESET', 'Accepted Pass requires a response cycle.');
    leader = before.responseCycle.lastSuccessfulPlayerId;
    passed = [...before.responseCycle.passedPlayerIds, move.playerId];
    reset = players.every((player) => !player.active || player.playerId === leader || passed.includes(player.playerId));
    const resetLeader = players.find((player) => player.playerId === leader && player.active) ?? clockwiseAfter(leader)[0]!;
    next = reset ? resetLeader.playerId : clockwiseAfter(move.playerId)[0]!.playerId;
    if (!reset) check(same(after.context.trick, before.context.trick), 'TRICK', 'Pass must preserve the current combination until reset.');
  }
  check(after.context.currentPlayerId === next, 'TURN_OWNER', 'Turn must follow clockwise response/finished-leader rules.');
  check(reset ? after.context.trick.kind === 'freeLead' && after.responseCycle === null
    : after.context.trick.kind === 'response' && after.responseCycle?.lastSuccessfulPlayerId === leader && same(after.responseCycle.passedPlayerIds, passed),
    'PASS_RESET', 'Trick reset and Pass records must reflect only this response cycle.');
}

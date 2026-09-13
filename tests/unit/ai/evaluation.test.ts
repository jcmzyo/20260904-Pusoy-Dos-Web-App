import { describe, expect, it } from 'vitest';
import type { Card } from '../../../src/domain';
import { chooseBaselineMove, evaluateCandidates } from '../../../src/ai';
import { createDeck, createSession, defaultRuleset, generateLegalFreeLeadMoves, generateLegalResponseMoves, inspectCombination, startRound, submitMove } from '../../../src/engine';
import { createPlayerTurnRequest } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';

const c = (rank: Card['rank'], suit: Card['suit'] = 'clubs'): Card => ({ rank, suit });
const same = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;

function request(hand: readonly Card[], currentCards?: readonly Card[]): PlayerTurnRequest {
  const inspected = currentCards && inspectCombination(currentCards, defaultRuleset);
  if (inspected && !inspected.valid) throw new Error('Invalid fixture combination.');
  const current = inspected && inspected.valid ? inspected.combination : undefined;
  const opponents = createDeck().filter((card) => card.rank !== '3' &&
    !hand.some((held) => same(card, held)) && !currentCards?.some((played) => same(card, played))).slice(0, 9);
  const playedCards = createDeck().filter((card) => !hand.some((held) => same(card, held)) && !opponents.some((held) => same(card, held)));
  return {
    requestId: 'evaluation', playerId: 'south',
    legalMoves: current ? generateLegalResponseMoves(hand, 'south', current, defaultRuleset) : generateLegalFreeLeadMoves(hand, 'south', defaultRuleset),
    view: {
      playerId: 'south', hand, mode: 'basic', status: 'inProgress', playerIds: ['south', 'west', 'north', 'east'], roundNumber: 1,
      completedRounds: [], standings: [], result: null,
      round: {
        status: 'inProgress', currentPlayerId: 'south', finishOrder: [], playedCards,
        players: ['south', 'west', 'north', 'east'].map((playerId) => ({ playerId, cardCount: playerId === 'south' ? hand.length : 3, finished: false })),
        trick: current ? { kind: 'response', current } : { kind: 'freeLead' },
      },
    },
  };
}

describe('core Baseline evaluation', () => {
  it('breaks equal Four-of-a-Kind strength by canonical kicker identity under reordered input', () => {
    const input = request([c('6'), c('6', 'spades'), c('6', 'hearts'), c('6', 'diamonds'), c('4'), c('5')],
      [c('3'), c('3', 'spades'), c('3', 'hearts'), c('7'), c('7', 'spades')]);
    const expected = { kind: 'play', playerId: 'south', cards: [c('4'), ...input.view.hand.slice(0, 4)] };
    expect(chooseBaselineMove(input)).toEqual(expected);
    for (let rotation = 0; rotation < input.legalMoves.length; rotation += 1) {
      const legalMoves = [...input.legalMoves.slice(rotation), ...input.legalMoves.slice(0, rotation)].reverse()
        .map((move) => move.kind === 'pass' ? move : { ...move, cards: [...move.cards].reverse() });
      expect(chooseBaselineMove({ ...input, legalMoves, view: { ...input.view, hand: [...input.view.hand].reverse() } })).toEqual(expected);
    }
  });

  it('finishes a special A/2 Straight before any non-finishing alternative', () => {
    const input = request([c('A'), c('2', 'spades'), c('3', 'hearts'), c('4'), c('5', 'diamonds')]);
    const choice = chooseBaselineMove(input);
    expect(choice.kind).toBe('play');
    if (choice.kind !== 'play') throw new Error('Expected finish.');
    expect(choice.cards).toHaveLength(5);
    expect(evaluateCandidates(input)[0]).toMatchObject({ immediateFinish: true, minPlays: 0 });
  });

  it('evaluates a real 13-card opening without mutating request or authoritative state', () => {
    const state = startRound(createSession(['south', 'west', 'north', 'east']).state, { next: () => 0 }).state;
    const input = createPlayerTurnRequest(state, defaultRuleset);
    const before = JSON.stringify({ state, input });
    expect(input.view.hand).toHaveLength(13);
    const choice = chooseBaselineMove(input);
    expect(submitMove(state, choice, defaultRuleset).accepted).toBe(true);
    expect(chooseBaselineMove(input)).toEqual(choice);
    expect(JSON.stringify({ state, input })).toBe(before);
    expect(evaluateCandidates(input).every(({ move }) => move.kind === 'play')).toBe(true);
  });

  it('fails diagnostically for an empty candidate set instead of inventing a Move', () => {
    const input = request([c('4')]);
    expect(() => chooseBaselineMove({ ...input, legalMoves: [] })).toThrow('Engine-authorized');
  });

  it('uses Engine suit-first Flush strength for an economical response, ahead of card identity order', () => {
    const clubs = [c('8'), c('10'), c('Q'), c('K'), c('A')];
    const diamonds = [c('4', 'diamonds'), c('6', 'diamonds'), c('8', 'diamonds'), c('10', 'diamonds'), c('Q', 'diamonds')];
    const input = request([...clubs, ...diamonds], [c('3', 'spades'), c('4', 'spades'), c('5', 'hearts'), c('6', 'spades'), c('7', 'hearts')]);
    expect(chooseBaselineMove(input)).toEqual({ kind: 'play', playerId: 'south', cards: clubs });
    expect(evaluateCandidates(input)[0]).toMatchObject({ minPlays: 1, cardsShed: 5, responseControl: { type: 'flush' } });
  });

  it('strategically passes rather than spend a lone 2 with multiple future Plays left', () => {
    const input = request([c('4'), c('7'), c('2', 'diamonds')], [c('A')]);
    expect(input.legalMoves.some((move) => move.kind === 'play')).toBe(true);
    expect(chooseBaselineMove(input)).toMatchObject({ kind: 'pass' });
    expect(evaluateCandidates(input).find(({ move }) => move.kind === 'play')).toMatchObject({ minPlays: 2, twosSpent: 1, singleTwoReserveCost: 1 });
  });

  it('uses a high 2 to reach a one-Play endgame and on free lead', () => {
    const hand = [c('4'), c('4', 'spades'), c('2', 'diamonds')];
    expect(chooseBaselineMove(request(hand, [c('A')]))).toMatchObject({ kind: 'play', cards: [c('2', 'diamonds')] });
    const freeLead = request([c('4'), c('7'), c('2', 'diamonds')]);
    expect(evaluateCandidates(freeLead).every(({ singleTwoReserveCost }) => singleTwoReserveCost === 0)).toBe(true);
  });

  it('chooses a cheap response without wasting the available 2', () => {
    const input = request([c('7'), c('9'), c('2', 'diamonds')], [c('6')]);
    expect(chooseBaselineMove(input)).toMatchObject({ kind: 'play', cards: [c('7')] });
  });

  it('preserves a five-card structure when a separate Single can respond', () => {
    const input = request([c('4'), c('5', 'spades'), c('6'), c('7', 'hearts'), c('8'), c('Q')], [c('3', 'diamonds')]);
    expect(chooseBaselineMove(input)).toMatchObject({ kind: 'play', cards: [c('Q')] });
    expect(evaluateCandidates(input)[0]!.minPlays).toBe(1);
  });

  it('passes rather than break a five-card structure into multiple Plays', () => {
    const input = request([c('4'), c('5', 'spades'), c('6'), c('7', 'hearts'), c('8')], [c('3', 'diamonds')]);
    expect(chooseBaselineMove(input)).toMatchObject({ kind: 'pass' });
    expect(evaluateCandidates(input)[0]!.minPlays).toBe(1);
  });

  it('sheds five cards over a Single leaving the same minimum future Plays', () => {
    const input = request([c('4'), c('5', 'spades'), c('6'), c('7', 'hearts'), c('8'), c('K')]);
    expect(chooseBaselineMove(input)).toMatchObject({ kind: 'play', cards: input.view.hand.slice(0, 5) });
    expect(evaluateCandidates(input).filter(({ minPlays }) => minPlays === 1).map(({ cardsShed }) => cardsShed)).toEqual([5, 1]);
  });

  it('takes a cheap response over unnecessary PASS even with equal decomposition', () => {
    const input = request([c('6'), c('6', 'spades'), c('4')], [c('5')]);
    expect(chooseBaselineMove(input)).toEqual({ kind: 'play', playerId: 'south', cards: [c('6')] });
    expect(evaluateCandidates(input).find(({ move }) => move.kind === 'pass')).toMatchObject({ minPlays: 2, cardsShed: 0, passOpportunityCost: 1 });
  });

  it('returns a forced PASS without claiming a missed Play opportunity', () => {
    const input = request([c('4')], [c('A')]);
    expect(evaluateCandidates(input)).toMatchObject([{ move: { kind: 'pass' }, cardsShed: 0, passOpportunityCost: 0 }]);
  });

  it('gives a finishing high 2 terminal priority over PASS', () => {
    const input = request([c('2', 'diamonds')], [c('A')]);
    expect(chooseBaselineMove(input)).toEqual({ kind: 'play', playerId: 'south', cards: input.view.hand });
    expect(evaluateCandidates(input)[0]).toMatchObject({ immediateFinish: true, minPlays: 0 });
  });

  it('uses exact decomposition to preserve a Pair instead of splitting it', () => {
    const input = request([c('6'), c('6', 'spades'), c('9')], [c('5')]);
    expect(chooseBaselineMove(input)).toEqual({ kind: 'play', playerId: 'south', cards: [c('9')] });
    expect(evaluateCandidates(input).find(({ move }) => move.kind === 'play' && move.cards[0]!.rank === '6')!.minPlays).toBe(2);
    expect(evaluateCandidates(input)[0]!.minPlays).toBe(1);
  });
});

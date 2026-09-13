import { describe, expect, it, vi } from 'vitest';
import type { Card } from '../../../src/domain';
import { chooseBaselineMove, evaluateCandidates } from '../../../src/ai';
import { assertEngineInvariants, assertMoveInvariants, createDeck, createSession, defaultRuleset, generateLegalFreeLeadMoves, generateLegalResponseMoves, getLegalMoves, inspectCombination, startRound, submitMove } from '../../../src/engine';
import type { BasicSessionState } from '../../../src/engine/sessions/resolveBasicSession';
import { createPlayerTurnRequest } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';
import * as decomposition from '../../../src/ai/decomposition/minPlays';

const c = (rank: Card['rank'], suit: Card['suit'] = 'clubs'): Card => ({ rank, suit });
const same = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;

function request(hand: readonly Card[], currentCards?: readonly Card[], opponentCounts: readonly number[] = [3, 3, 3]): PlayerTurnRequest {
  const inspected = currentCards && inspectCombination(currentCards, defaultRuleset);
  if (inspected && !inspected.valid) throw new Error('Invalid fixture combination.');
  const current = inspected && inspected.valid ? inspected.combination : undefined;
  const opponents = createDeck().filter((card) => card.rank !== '3' &&
    !hand.some((held) => same(card, held)) && !currentCards?.some((played) => same(card, played))).slice(0, opponentCounts.reduce((sum, count) => sum + count, 0));
  const playedCards = createDeck().filter((card) => !hand.some((held) => same(card, held)) && !opponents.some((held) => same(card, held)));
  return {
    requestId: 'evaluation', playerId: 'south',
    legalMoves: current ? generateLegalResponseMoves(hand, 'south', current, defaultRuleset) : generateLegalFreeLeadMoves(hand, 'south', defaultRuleset),
    view: {
      playerId: 'south', hand, mode: 'basic', status: 'inProgress', playerIds: ['south', 'west', 'north', 'east'], roundNumber: 1,
      completedRounds: [], standings: [], result: null,
      round: {
        status: 'inProgress', currentPlayerId: 'south', finishOrder: ['west', 'north', 'east'].filter((_, index) => opponentCounts[index] === 0), playedCards,
        players: ['south', 'west', 'north', 'east'].map((playerId, index) => ({ playerId, cardCount: index === 0 ? hand.length : opponentCounts[index - 1]!, finished: index > 0 && opponentCounts[index - 1] === 0 })),
        trick: current ? { kind: 'response', current } : { kind: 'freeLead' },
      },
    },
  };
}

describe('core Baseline evaluation', () => {
  it.each([1, 2])('contests with a reserved 2 when any active opponent has %i cards', (count) => {
    const hand = [c('4'), c('7'), c('2', 'diamonds')];
    expect(chooseBaselineMove(request(hand, [c('A')]))).toMatchObject({ kind: 'pass' });
    for (let seat = 0; seat < 3; seat += 1) {
      const counts = [3, 3, 3];
      counts[seat] = count;
      const input = request(hand, [c('A')], counts);
      expect(chooseBaselineMove(input)).toEqual({ kind: 'play', playerId: 'south', cards: [c('2', 'diamonds')] });
      expect(evaluateCandidates(input)[0]).toMatchObject({ minPlays: 2, singleTwoReserveCost: 0 });
    }
  });

  it('prefers contesting to preserving 2s at equal decomposition under pressure', () => {
    const hand = [c('2', 'hearts'), c('2', 'diamonds'), c('4'), c('7')];
    expect(chooseBaselineMove(request(hand, [c('A')]))).toMatchObject({ kind: 'pass' });
    const input = request(hand, [c('A')], [2, 3, 3]);
    const evaluations = evaluateCandidates(input);
    expect(evaluations.every(({ minPlays }) => minPlays === 3)).toBe(true);
    expect(chooseBaselineMove(input)).toEqual({ kind: 'play', playerId: 'south', cards: [c('2', 'hearts')] });
  });

  it('does not create pressure from own low count or finished opponents', () => {
    const hand = [c('2', 'hearts'), c('2', 'diamonds')];
    const input = request(hand, [c('A')], [0, 3, 3]);
    expect(chooseBaselineMove(input)).toMatchObject({ kind: 'pass' });
    expect(evaluateCandidates(input).every(({ minPlays }) => minPlays === 1)).toBe(true);
  });

  it('keeps pressure after an opponent PASS whether their private hand could respond or not', () => {
    const inputs: PlayerTurnRequest[] = [];
    for (const canRespond of [false, true]) {
      const state: BasicSessionState = { ...createSession(['south', 'west', 'north', 'east']).state, roundNumber: 1,
        round: { kind: 'inProgress', finishOrder: [], responseCycle: { lastSuccessfulPlayerId: 'north', passedPlayerIds: [] },
          context: { sessionActive: true, roundActive: true, currentPlayerId: 'east',
            trick: { kind: 'response', current: { type: 'single', cards: [c('A')] } },
            players: [
              { playerId: 'south', active: true, hand: [c('4'), c('7'), c('2', 'diamonds')] },
              { playerId: 'west', active: true, hand: [c(canRespond ? '5' : '2'), c('8'), c('9')] },
              { playerId: 'north', active: true, hand: [c('10'), c('J'), c('Q')] },
              { playerId: 'east', active: true, hand: [c(canRespond ? '2' : '5')] },
            ],
          },
        },
      };
      assertEngineInvariants(state, defaultRuleset);
      expect(getLegalMoves(state, 'east', defaultRuleset).some((move) => move.kind === 'play')).toBe(canRespond);
      const pass = { kind: 'pass', playerId: 'east' } as const;
      const result = submitMove(state, pass, defaultRuleset);
      expect(result.accepted).toBe(true);
      assertMoveInvariants(state, pass, result, defaultRuleset);
      expect(result.events).toContainEqual({ type: 'PLAYER_PASSED', roundNumber: 1, playerId: 'east' });
      const input = createPlayerTurnRequest(result.state, defaultRuleset);
      expect(input.playerId).toBe('south');
      expect(input.view.round!.players.find(({ playerId }) => playerId === 'east')).toEqual({ playerId: 'east', cardCount: 1, finished: false });
      expect(input.view.round!.players.every((player) => !('hand' in player))).toBe(true);
      const choice = chooseBaselineMove(input);
      expect(choice).toEqual({ kind: 'play', playerId: 'south', cards: [c('2', 'diamonds')] });
      expect(submitMove(result.state, choice, defaultRuleset).accepted).toBe(true);
      inputs.push(input);
    }
    expect(inputs[0]!.view).toEqual(inputs[1]!.view);
    expect(inputs[0]!.legalMoves).toEqual(inputs[1]!.legalMoves);
  });

  it('keeps structural preservation, cheap commitments, forced PASS and finish priority under pressure', () => {
    const counts = [1, 2, 3];
    expect(chooseBaselineMove(request([c('4'), c('5', 'spades'), c('6'), c('7', 'hearts'), c('8')], [c('3', 'diamonds')], counts))).toMatchObject({ kind: 'pass' });
    expect(chooseBaselineMove(request([c('7'), c('9'), c('2', 'diamonds')], [c('6')], counts))).toMatchObject({ kind: 'play', cards: [c('7')] });
    expect(evaluateCandidates(request([c('4')], [c('A')], counts))).toMatchObject([{ move: { kind: 'pass' }, passOpportunityCost: 0 }]);
    expect(chooseBaselineMove(request([c('2', 'diamonds')], [c('A')], counts))).toMatchObject({ kind: 'play', cards: [c('2', 'diamonds')] });
    const freeLead = request([c('4'), c('7'), c('2', 'diamonds')], undefined, counts);
    expect(chooseBaselineMove(freeLead)).toEqual(chooseBaselineMove(request(freeLead.view.hand)));
  });

  it('locks full decisions across repeated execution, reordered inputs, real cache warmth and metrics on/off', () => {
    const opening = createPlayerTurnRequest(startRound(createSession(['south', 'west', 'north', 'east']).state, { next: () => 0 }).state, defaultRuleset);
    const fixtures = [
      opening,
      request([c('4'), c('7'), c('2', 'diamonds')], [c('A')]),
      request([c('4'), c('7'), c('2', 'diamonds')], [c('A')], [1, 3, 3]),
      request([c('2', 'hearts'), c('2', 'diamonds'), c('4'), c('7')], [c('A')], [2, 3, 3]),
      request([c('A'), c('2', 'spades'), c('3', 'hearts'), c('4'), c('5', 'diamonds')]),
      request([c('4')], [c('A')], [1, 3, 3]),
      request([c('7'), c('9'), c('2', 'diamonds')], [c('6')], [1, 2, 3]),
      request([c('6'), c('6', 'spades'), c('9')], [c('5')], [2, 3, 3]),
      request([c('4'), c('5', 'spades'), c('6'), c('7', 'hearts'), c('8')], [c('3', 'diamonds')], [1, 3, 3]),
      request([c('6'), c('6', 'spades'), c('6', 'hearts'), c('6', 'diamonds'), c('4'), c('5')],
        [c('3'), c('3', 'spades'), c('3', 'hearts'), c('7'), c('7', 'spades')]),
    ];
    const createDecomposer = decomposition.createHandDecomposer;
    for (const input of fixtures) {
      const before = JSON.stringify(input);
      const expected = chooseBaselineMove(input);
      for (const collectMetrics of [false, true]) {
        for (const warm of [false, true]) {
          const analyzer = createDecomposer(input.view.hand, defaultRuleset, { collectMetrics });
          if (warm) {
            for (const move of input.legalMoves) {
              analyzer.minPlays(move.kind === 'pass' ? input.view.hand : input.view.hand.filter((card) => !move.cards.some((played) => same(card, played))));
            }
          }
          const beforeMetrics = analyzer.getMetrics();
          const factory = vi.spyOn(decomposition, 'createHandDecomposer').mockReturnValue(analyzer);
          try {
            for (let repetition = 0; repetition < 3; repetition += 1) {
              expect(chooseBaselineMove(input)).toEqual(expected);
              const legalMoves = [...input.legalMoves.slice(repetition), ...input.legalMoves.slice(0, repetition)].reverse()
                .map((move) => move.kind === 'pass' ? move : { ...move, cards: [...move.cards].reverse() });
              const reordered = { ...input, legalMoves, view: { ...input.view, hand: [...input.view.hand].reverse(),
                round: { ...input.view.round!, players: [...input.view.round!.players].reverse(), playedCards: [...input.view.round!.playedCards].reverse() } } };
              expect(chooseBaselineMove(reordered)).toEqual(expected);
            }
            expect(factory).toHaveBeenCalledTimes(6);
            const afterMetrics = analyzer.getMetrics();
            if (collectMetrics) {
              expect(afterMetrics!.cacheHits).toBeGreaterThan(beforeMetrics!.cacheHits);
              if (warm) expect(afterMetrics!.cacheMisses).toBe(beforeMetrics!.cacheMisses);
              else expect(afterMetrics!.cacheMisses).toBeGreaterThan(beforeMetrics!.cacheMisses);
            } else {
              expect(afterMetrics).toBeUndefined();
            }
          } finally {
            factory.mockRestore();
          }
        }
      }
      expect(JSON.stringify(input)).toBe(before);
    }
  });

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

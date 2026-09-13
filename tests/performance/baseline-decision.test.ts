import { expect, it } from 'vitest';
import type { Card, Move } from '../../src/domain';
import { evaluateCandidates } from '../../src/ai';
import { assertEngineInvariants, assertMoveInvariants, createDeck, createSession, defaultRuleset, inspectCombination, submitMove } from '../../src/engine';
import type { EngineResult } from '../../src/engine';
import { createPlayerTurnRequest } from '../../src/orchestrator';

const { performance, console } = globalThis as unknown as {
  performance: { now(): number };
  console: { log(message: string): void };
};
const ids = ['south', 'west', 'north', 'east'];
const c = (rank: Card['rank'], suit: Card['suit'] = 'clubs'): Card => ({ rank, suit });
const same = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;
const key = (move: Move) => JSON.stringify(move.kind === 'pass' ? move : {
  ...move, cards: move.cards.map(({ rank, suit }) => `${rank}-${suit}`).sort(),
});

function fixture(hand: readonly Card[], responding = false, opponentCount = 3): EngineResult['state'] {
  const current = inspectCombination([c('A')], defaultRuleset);
  if (!current.valid) throw new Error('Invalid benchmark combination.');
  const available = createDeck().filter((card) => !hand.some((held) => same(card, held)) &&
    !same(card, c('3')) && (!responding || !same(card, c('A'))));
  const counts = [opponentCount, 3, 3];
  let offset = 0;
  const opponents = ids.slice(1).map((playerId, index) => {
    const cards = available.slice(offset, offset + counts[index]!);
    offset += counts[index]!;
    return { playerId, active: true, hand: cards };
  });
  const state: EngineResult['state'] = {
    ...createSession(ids).state, roundNumber: 1,
    round: {
      kind: 'inProgress', finishOrder: [],
      responseCycle: responding ? { lastSuccessfulPlayerId: 'east', passedPlayerIds: [] } : null,
      context: {
        sessionActive: true, roundActive: true, currentPlayerId: 'south',
        players: [{ playerId: 'south', active: true, hand }, ...opponents],
        trick: responding ? { kind: 'response', current: current.combination } : { kind: 'freeLead' },
      },
    },
  };
  assertEngineInvariants(state, defaultRuleset);
  return state;
}

it('measures complete Baseline decisions on high-choice and tactical acceptance fixtures without a timing SLA', () => {
  const sameSuit = defaultRuleset.rankOrder.map((rank) => c(rank, 'spades'));
  const repeatedRanks = (['4', '5', '6'] as const).flatMap((rank) => defaultRuleset.suitOrder.map((suit) => c(rank, suit)));
  const fixtures = [
    { name: '13-card-same-suit-free-lead', state: fixture(sameSuit), kind: 'play', size: 5 },
    { name: '13-card-repeated-ranks-free-lead', state: fixture([...repeatedRanks, c('7', 'spades')]), kind: 'play', size: 5 },
    { name: 'strategic-pass', state: fixture([c('4'), c('7'), c('2', 'diamonds')], true), kind: 'pass', size: 0 },
    { name: 'opponent-pressure', state: fixture([c('4'), c('7'), c('2', 'diamonds')], true, 1), kind: 'play', size: 1 },
    { name: 'immediate-finish', state: fixture([c('2', 'diamonds')], true), kind: 'play', size: 1 },
    ...[10, 7, 5, 3, 1].map((size) => ({ name: `declining-${size}`, state: fixture(sameSuit.slice(0, size)), kind: 'play', size: size >= 5 ? 5 : 1 })),
  ];
  const rows = [];
  for (const { name, state, kind, size } of fixtures) {
    const request = createPlayerTurnRequest(state, defaultRuleset);
    const before = JSON.stringify({ state, request });
    const durations: number[] = [];
    let selected: Move | undefined;
    for (let sample = 0; sample < 5; sample += 1) {
      const start = performance.now();
      const evaluations = evaluateCandidates(request);
      durations.push(performance.now() - start);
      const choice = evaluations[0]!.move;
      expect(evaluations).toHaveLength(request.legalMoves.length);
      expect(request.legalMoves.map(key)).toContain(key(choice));
      expect(choice.kind).toBe(kind);
      expect(choice.kind === 'play' ? choice.cards.length : 0).toBe(size);
      if (selected) expect(choice).toEqual(selected);
      selected = choice;
      const result = submitMove(state, choice, defaultRuleset);
      expect(result.accepted).toBe(true);
      assertMoveInvariants(state, choice, result, defaultRuleset);
      if (name === 'immediate-finish') expect(evaluations[0]).toMatchObject({ immediateFinish: true, minPlays: 0 });
    }
    expect(JSON.stringify({ state, request })).toBe(before);
    const plays = request.legalMoves.filter((move) => move.kind === 'play').length;
    if (name.startsWith('13-card')) expect(plays).toBeGreaterThan(100);
    if (request.view.round!.trick!.kind === 'response') {
      expect(plays).toBeGreaterThan(0);
      expect(request.legalMoves.some((move) => move.kind === 'pass')).toBe(true);
    } else expect(plays).toBe(request.legalMoves.length);
    durations.sort((a, b) => a - b);
    rows.push({ fixture: name, handSize: request.view.hand.length, candidates: request.legalMoves.length,
      playCandidates: plays, passAvailable: plays < request.legalMoves.length, samples: durations.length,
      p50Ms: Number(durations[2]!.toFixed(3)), maxMs: Number(durations[4]!.toFixed(3)), selected });
  }
  console.log(JSON.stringify(rows, null, 2));
});

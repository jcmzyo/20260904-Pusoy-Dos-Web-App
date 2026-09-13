import type { Card, Move } from '../../domain';
import { defaultRuleset } from '../../engine';
import type { RulesetConfig } from '../../engine';
import type { PlayerTurnRequest } from '../../orchestrator';

export interface MoveCandidate {
  readonly move: Move;
  readonly immediateFinish: boolean;
}

/** Consumes the complete Engine-authorized set; never generates or revalidates Plays. */
export function buildCandidates(request: PlayerTurnRequest, ruleset: RulesetConfig = defaultRuleset): readonly MoveCandidate[] {
  const { view, playerId, legalMoves } = request;
  const round = view.round;
  if (view.status !== 'inProgress' || round?.status !== 'inProgress' ||
    round.currentPlayerId !== playerId || view.playerId !== playerId || round.trick == null) {
    throw new Error('Candidate construction requires the requesting player active Turn.');
  }
  const responding = round.trick.kind === 'response';
  if (legalMoves.length === 0 || legalMoves.some((move) => move.playerId !== playerId)) {
    throw new Error('Candidate construction requires Engine-authorized actions for the requesting player.');
  }
  if (legalMoves.some((move) => move.kind === 'pass') !== responding) {
    throw new Error('Engine-authorized PASS availability disagrees with the Turn context.');
  }
  const compareCards = (a: Card, b: Card) =>
    ruleset.rankOrder.indexOf(a.rank) - ruleset.rankOrder.indexOf(b.rank) ||
    ruleset.suitOrder.indexOf(a.suit) - ruleset.suitOrder.indexOf(b.suit);
  const candidates: MoveCandidate[] = legalMoves.map((move) => ({
    move: move.kind === 'pass' ? { kind: 'pass', playerId } : {
      kind: 'play', playerId, cards: move.cards.map(({ rank, suit }) => ({ rank, suit })).sort(compareCards),
    },
    immediateFinish: move.kind === 'play' && move.cards.length === view.hand.length,
  }));
  // Identity order only: PLAY before PASS, then size, then rank/suit tuples. This is not strength or preference.
  candidates.sort((a, b) => {
    if (a.move.kind === 'pass') return b.move.kind === 'pass' ? 0 : 1;
    if (b.move.kind === 'pass') return -1;
    const size = a.move.cards.length - b.move.cards.length;
    if (size !== 0) return size;
    for (let i = 0; i < a.move.cards.length; i += 1) {
      const order = compareCards(a.move.cards[i]!, b.move.cards[i]!);
      if (order !== 0) return order;
    }
    return 0;
  });
  return candidates;
}

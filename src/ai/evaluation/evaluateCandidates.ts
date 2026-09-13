import type { Combination, Move } from '../../domain';
import { canBeat, defaultRuleset, inspectCombination } from '../../engine';
import type { RulesetConfig } from '../../engine';
import type { PlayerTurnRequest } from '../../orchestrator';
import { buildCandidates } from '../candidates/buildCandidates';
import type { MoveCandidate } from '../candidates/buildCandidates';
import { createHandDecomposer } from '../decomposition/minPlays';

export interface CandidateEvaluation extends MoveCandidate {
  readonly minPlays: number;
  readonly cardsShed: number;
  readonly passOpportunityCost: number;
  readonly twosSpent: number;
  readonly singleTwoReserveCost: number;
  readonly responseControl: Combination | null;
}

/**
 * PLAY and PASS use the same lexicographic policy: finish, remaining minPlays
 * plus the narrow reserve cost below, fewer 2s spent, then more cards shed.
 * A responding lone 2 leaving multiple future Plays costs one structural step:
 * preserve it over PASS's unchanged hand, but use it to finish or reach one Play.
 * This is a tactical reserve, not a second penalty for breaking hand structure.
 * Pair/five-card damage is represented only by exact decomposition.
 * Then prefer taking an available Play opportunity and, for otherwise equal
 * responses, the weakest Engine-ranked commitment that takes the current Trick.
 * Control is an immediate contest heuristic, never a prediction of winning it.
 * Returns preference order; exact ties retain the canonical candidate order.
 */
export function evaluateCandidates(request: PlayerTurnRequest, ruleset: RulesetConfig = defaultRuleset): readonly CandidateEvaluation[] {
  const candidates = buildCandidates(request, ruleset);
  const decomposer = createHandDecomposer(request.view.hand, ruleset);
  const responding = request.view.round!.trick!.kind === 'response';
  const hasPlay = candidates.some(({ move }) => move.kind === 'play');
  const evaluations = candidates.map((candidate): CandidateEvaluation => {
    const move = candidate.move;
    const remaining = move.kind === 'pass' ? request.view.hand : request.view.hand.filter((card) =>
      !move.cards.some((played) => played.rank === card.rank && played.suit === card.suit));
    const minPlays = decomposer.minPlays(remaining);
    const twosSpent = move.kind === 'pass' ? 0 : move.cards.filter((card) => card.rank === '2').length;
    const singleTwoReserveCost = Number(responding &&
      move.kind === 'play' && move.cards.length === 1 && twosSpent === 1 && minPlays > 1);
    let responseControl: Combination | null = null;
    if (responding && move.kind === 'play') {
      const inspected = inspectCombination(move.cards, ruleset);
      if (!inspected.valid) throw new Error('Evaluation requires Engine-authorized combinations.');
      responseControl = inspected.combination;
    }
    return { ...candidate, minPlays, twosSpent, singleTwoReserveCost, cardsShed: request.view.hand.length - remaining.length,
      passOpportunityCost: Number(move.kind === 'pass' && hasPlay), responseControl };
  });
  return evaluations.sort((a, b) => Number(b.immediateFinish) - Number(a.immediateFinish) ||
    (a.minPlays + a.singleTwoReserveCost) - (b.minPlays + b.singleTwoReserveCost) || a.twosSpent - b.twosSpent ||
    b.cardsShed - a.cardsShed || a.passOpportunityCost - b.passOpportunityCost ||
    (a.responseControl && b.responseControl ? Number(canBeat(a.responseControl, b.responseControl, ruleset)) -
      Number(canBeat(b.responseControl, a.responseControl, ruleset)) : 0));
}

export function chooseBaselineMove(request: PlayerTurnRequest, ruleset: RulesetConfig = defaultRuleset): Move {
  return evaluateCandidates(request, ruleset)[0]!.move;
}

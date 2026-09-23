import type { PlayerId } from '../../domain';
import type { BasicRoundResult } from '../rounds/resolveBasicRound';

export interface BasicSessionStanding {
  readonly playerId: PlayerId;
  readonly totalScore: number;
  readonly roundWins: number;
  readonly averagePlacement: number;
  readonly highestRoundScore: number;
}

export interface BasicSessionResult {
  readonly standings: readonly BasicSessionStanding[];
  readonly winnerIds: readonly PlayerId[];
  readonly decidedBy: 'totalScore' | 'roundWins' | 'averagePlacement' | 'highestRoundScore' | 'genuineTie';
  /** The official final 1st-4th ranking (M4-T13; ui-ux.md §13: "the official final ranking ordered by
   *  final Session result ... Apply the official Basic tiebreak rules here"), ordered best-to-worst.
   *  Every entry below `winnerIds`' own placement is produced by applying that exact same tiebreak
   *  cascade (§2.6.3/engine.md §24: totalScore, then roundWins, then averagePlacement, then
   *  highestRoundScore) to whichever standings remain once the players ahead of them are placed -
   *  requirements.md/engine.md only spell this cascade out for deciding the Session *winner*, but §13
   *  explicitly asks the Session Summary to "apply" it, and this is the one reading that reuses the
   *  rule as written rather than inventing a second one for the rest of the field. Two players share a
   *  `placement` (standard competition ranking, e.g. 1,1,3,4) exactly when they are equal on every one
   *  of those four criteria - the same bar `decidedBy: 'genuineTie'` already uses for the winner slot -
   *  so `placements[0]`'s own player set always matches `winnerIds` exactly. */
  readonly placements: readonly BasicSessionPlacement[];
}

export interface BasicSessionPlacement {
  readonly playerId: PlayerId;
  readonly placement: 1 | 2 | 3 | 4;
}

export function basicSessionStandings(playerIds: readonly PlayerId[], rounds: readonly BasicRoundResult[]): BasicSessionStanding[] {
  return playerIds.map((playerId) => {
    const results = rounds.map((round) => {
      const result = round.placements.find((entry) => entry.playerId === playerId);
      if (!result) throw new Error('Basic Session Round result is missing a participant.');
      return result;
    });
    return {
      playerId,
      totalScore: results.reduce((sum, result) => sum + result.points, 0),
      roundWins: results.filter((result) => result.placement === 1).length,
      averagePlacement: results.length === 0 ? 0 : results.reduce((sum, result) => sum + result.placement, 0) / results.length,
      highestRoundScore: Math.max(0, ...results.map((result) => result.points)),
    };
  });
}

/** The Basic Mode tiebreak cascade (requirements.md §2.6.3, engine.md §24), most-significant first;
 *  `averagePlacement` is the only criterion where lower is better. Shared by the winner-only resolution
 *  below and by `rankBasicSessionStandings`'s own full-field ordering, so both apply the identical rule. */
const TIEBREAK_CRITERIA = ['totalScore', 'roundWins', 'averagePlacement', 'highestRoundScore'] as const;

function isBetter(criterion: typeof TIEBREAK_CRITERIA[number], value: number, best: number): boolean {
  return criterion === 'averagePlacement' ? value < best : value > best;
}

/** Ranks every standing 1st-4th by repeatedly applying the same tiebreak cascade that decides the
 *  Session winner (see `BasicSessionResult.placements`'s own docstring for why this reuses rather than
 *  invents a rule) to whichever players have not yet been placed. Two players land on the same
 *  `placement` (standard competition ranking) exactly when every one of the four criteria ties between
 *  them - never a seating-order guess. */
function rankBasicSessionStandings(standings: readonly BasicSessionStanding[]): BasicSessionPlacement[] {
  const remaining = [...standings];
  const placements: BasicSessionPlacement[] = [];
  let placement = 1;
  while (remaining.length > 0) {
    let tiedGroup = remaining;
    for (const criterion of TIEBREAK_CRITERIA) {
      const best = tiedGroup.reduce((best, entry) => (isBetter(criterion, entry[criterion], best) ? entry[criterion] : best), tiedGroup[0]![criterion]);
      tiedGroup = tiedGroup.filter((entry) => entry[criterion] === best);
    }
    for (const entry of tiedGroup) {
      placements.push({ playerId: entry.playerId, placement: placement as 1 | 2 | 3 | 4 });
      remaining.splice(remaining.indexOf(entry), 1);
    }
    placement += tiedGroup.length;
  }
  return placements;
}

export function resolveBasicSessionResult(playerIds: readonly PlayerId[], rounds: readonly BasicRoundResult[]): BasicSessionResult {
  if (rounds.length !== 5) throw new Error('Basic Session result requires exactly five completed Rounds.');
  const standings = basicSessionStandings(playerIds, rounds);
  const placements = rankBasicSessionStandings(standings);
  let candidates = standings;
  for (const criterion of TIEBREAK_CRITERIA) {
    const values = candidates.map((entry) => entry[criterion]);
    const best = criterion === 'averagePlacement' ? Math.min(...values) : Math.max(...values);
    candidates = candidates.filter((entry) => entry[criterion] === best);
    if (candidates.length === 1) return { standings, winnerIds: candidates.map((entry) => entry.playerId), decidedBy: criterion, placements };
  }
  return { standings, winnerIds: candidates.map((entry) => entry.playerId), decidedBy: 'genuineTie', placements };
}

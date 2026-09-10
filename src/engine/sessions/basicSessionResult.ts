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

export function resolveBasicSessionResult(playerIds: readonly PlayerId[], rounds: readonly BasicRoundResult[]): BasicSessionResult {
  if (rounds.length !== 5) throw new Error('Basic Session result requires exactly five completed Rounds.');
  const standings = basicSessionStandings(playerIds, rounds);
  let candidates = standings;
  for (const criterion of ['totalScore', 'roundWins', 'averagePlacement', 'highestRoundScore'] as const) {
    const values = candidates.map((entry) => entry[criterion]);
    const best = criterion === 'averagePlacement' ? Math.min(...values) : Math.max(...values);
    candidates = candidates.filter((entry) => entry[criterion] === best);
    if (candidates.length === 1) return { standings, winnerIds: candidates.map((entry) => entry.playerId), decidedBy: criterion };
  }
  return { standings, winnerIds: candidates.map((entry) => entry.playerId), decidedBy: 'genuineTie' };
}

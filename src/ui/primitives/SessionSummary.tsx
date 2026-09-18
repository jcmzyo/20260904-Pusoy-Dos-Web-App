import { useState } from 'react';
import type { GameEvent } from '../../engine';
import type { PlayerId } from '../../domain';
import type { BasicRoundResult } from '../../engine/rounds/resolveBasicRound';
import type { BasicSessionResult } from '../../engine/sessions/basicSessionResult';
import { EventLogOverlay } from './EventLogOverlay';
import { HUMAN_PLAYER_ID } from './humanPlayer';
import { useBodyScrollLock } from './useBodyScrollLock';
import styles from './SessionSummary.module.css';

const PLACEMENT_LABELS: Record<1 | 2 | 3 | 4, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };

/** Restrained gold/silver/bronze treatment (ui-ux.md §13), same medal convention/colors as
 *  `PlayerPanel`'s own per-Round glow (`resolveGlowClass`) - keyed by the actual `placement` NUMBER a
 *  row holds, not its row index, so a tie that consumes a placement (e.g. two players sharing 1st)
 *  correctly leaves the next unclaimed number with no medal at all rather than inventing one; see
 *  `basicSessionResult.ts`'s own `BasicSessionResult.placements` docstring for why a tie skips ahead
 *  (1,1,3,4) instead of compacting (1,1,2,3). */
function medalClass(placement: 1 | 2 | 3 | 4): string | undefined {
  if (placement === 1) return styles.gold;
  if (placement === 2) return styles.silver;
  if (placement === 3) return styles.bronze;
  return undefined;
}

/** "Tiebreak explanation when relevant" (ui-ux.md §13). `decidedBy` is `'totalScore'` whenever the
 *  Session winner is already unique on total score alone - the ordinary case, and not itself a
 *  tiebreak - so this only has something to say once a later criterion (or a genuine tie) was actually
 *  needed to separate the top of the standings, matching decidedBy !== 'totalScore'. */
function describeTiebreak(result: BasicSessionResult, nameOf: (playerId: PlayerId) => string): string | null {
  const winners = result.winnerIds.map(nameOf);
  const winnerList = winners.length > 1 ? `${winners.slice(0, -1).join(', ')} and ${winners.at(-1)}` : winners[0];
  switch (result.decidedBy) {
    case 'totalScore':
      return null;
    case 'roundWins':
      return `${winnerList} tied on total score; ${winners.length > 1 ? 'they' : winnerList} won on most Round wins.`;
    case 'averagePlacement':
      return `${winnerList} tied on total score and Round wins; ${winners.length > 1 ? 'they' : winnerList} won on best average placement.`;
    case 'highestRoundScore':
      return `${winnerList} tied on total score, Round wins, and average placement; ${winners.length > 1 ? 'they' : winnerList} won on highest single-Round score.`;
    case 'genuineTie':
      return `${winnerList} are genuinely tied for 1st - every Basic tiebreaker matched exactly.`;
  }
}

export interface SessionSummarySeat {
  readonly playerId: PlayerId;
  readonly name: string;
}

export interface SessionSummaryProps {
  readonly seats: readonly SessionSummarySeat[];
  /** The Basic Session's own official result (SessionPresentation's `sessionResult`, non-null once
   *  Round 5 completes) - official final ranking, scores, and tiebreak facts are Engine-authoritative
   *  (engine.md §24); this component only presents them. */
  readonly result: BasicSessionResult;
  /** All five completed Rounds in order (SessionPresentation's `completedRounds`), for the Round-by-
   *  Round Summary breakdown (ui-ux.md §13: "all five Round results"). */
  readonly completedRounds: readonly BasicRoundResult[];
  /** The whole Session's own public event history (SessionPresentation's `events`), forwarded straight
   *  through to this panel's own Event Log button/popup (ui-ux.md §9.2/§13 follow-up, M4-T13 UI
   *  refinement) - the very same `EventLogOverlay` the live table already uses, not a separate
   *  reimplementation, opened here instead of requiring the person to have kept it open from the table. */
  readonly events: readonly GameEvent[];
  readonly names: Readonly<Record<string, string>>;
  /** Starts a brand-new Session through the same T01 startup boundary as Home's own Start Game -
   *  never a Session-object reset/reuse (ui-ux.md §13; M4-T13's own Definition of Done: "Play Again ...
   *  work[s] without persistence assumptions"). App.tsx owns what this actually does. */
  readonly onPlayAgain: () => void;
  readonly onHome: () => void;
}

/**
 * Session Summary (M4-T13; ui-ux.md §13). Presents as a popup/overlay over the same dimmed completed
 * table Round Result used, replacing that overlay in place once Round 5's own scoring animation settles
 * (§12 follow-up) - `SessionTable` (App.tsx) renders this instead of `RoundResultOverlay` once its own
 * `resultPhase` reaches `'summary'`, rather than App.tsx swapping to an entirely separate full screen.
 * Like Round Result, this is itself a bespoke non-dismissible modal (no Close/Escape/backdrop-dismiss) -
 * the only ways out are its own explicit **Play Again** / **Home** actions. Its own Event Log button
 * opens the ordinary dismissible `EventLogOverlay` on top of it instead (a person's own follow-up
 * report ruled out embedding the log as a permanent side panel here).
 */
export function SessionSummary({ seats, result, completedRounds, events, names, onPlayAgain, onHome }: SessionSummaryProps) {
  useBodyScrollLock();

  const [isLogOpen, setIsLogOpen] = useState(false);
  const nameOf = (playerId: PlayerId): string => seats.find((seat) => seat.playerId === playerId)?.name ?? playerId;
  const standingOf = (playerId: PlayerId) => {
    const standing = result.standings.find((entry) => entry.playerId === playerId);
    if (!standing) throw new Error(`Session Summary is missing a standing for ${playerId}.`);
    return standing;
  };
  const placementCounts = new Map<number, number>();
  for (const entry of result.placements) placementCounts.set(entry.placement, (placementCounts.get(entry.placement) ?? 0) + 1);

  const tiebreakExplanation = describeTiebreak(result, nameOf);

  return (
    <div className={styles.backdrop}>
      <section className={styles.panel} role="dialog" aria-modal="true" aria-label="Session Summary">
        <header className={styles.header}>
          <p className={styles.eyebrow}>SESSION COMPLETE</p>
          <h2>Session Summary</h2>
        </header>

        {tiebreakExplanation !== null && <p className={styles.tiebreak}>{tiebreakExplanation}</p>}

        <table className={styles.rankingTable}>
          <caption className={styles.tableCaption}>Final Ranking</caption>
          <thead>
            <tr>
              <th scope="col">Place</th>
              <th scope="col">Player</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {result.placements.map((entry) => {
              const tied = (placementCounts.get(entry.placement) ?? 0) > 1;
              return (
                <tr key={entry.playerId} className={[medalClass(entry.placement), entry.playerId === HUMAN_PLAYER_ID ? styles.you : undefined].filter(Boolean).join(' ') || undefined}>
                  <td>
                    <span className={styles.placementLabel}>{PLACEMENT_LABELS[entry.placement]}</span>
                    {tied && <span className={styles.tiedNote}> (tied)</span>}
                  </td>
                  <td>{nameOf(entry.playerId)}</td>
                  <td className={styles.numeric}>{standingOf(entry.playerId).totalScore}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <table className={styles.roundsTable}>
          <caption className={styles.tableCaption}>Round-by-Round Summary</caption>
          <thead>
            <tr>
              <th scope="col">Player</th>
              {completedRounds.map((_, index) => <th scope="col" key={index}>R{index + 1}</th>)}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {result.placements.map((entry) => (
              <tr key={entry.playerId} className={entry.playerId === HUMAN_PLAYER_ID ? styles.you : undefined}>
                <td>{nameOf(entry.playerId)}</td>
                {completedRounds.map((round, index) => {
                  const points = round.placements.find((placement) => placement.playerId === entry.playerId)?.points;
                  if (points === undefined) throw new Error(`Round ${index + 1} is missing a result for ${entry.playerId}.`);
                  // Plain point value, no +/- prefix - Basic Mode has no loser deductions to distinguish
                  // a gain from (ui-ux.md §13 follow-up, M4-T13 UI refinement).
                  return <td className={styles.numeric} key={index}>{points}</td>;
                })}
                <td className={styles.numeric}>{standingOf(entry.playerId).totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Event Log, Home, Play Again, in that order (the person's own follow-up request) - Play Again
         *  last/rightmost as the primary/default action. */}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={() => setIsLogOpen(true)}>Event Log</button>
          <button type="button" className={styles.secondaryButton} onClick={onHome}>Home</button>
          <button type="button" className={styles.primaryButton} onClick={onPlayAgain}>Play Again</button>
        </div>
      </section>
      {isLogOpen && <EventLogOverlay events={events} names={names} onClose={() => setIsLogOpen(false)} />}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import type { Card } from '../../domain';
import type { GameEvent } from '../../engine';
import { CardIndex } from './Card';
import { COMBINATION_LABELS, getDisplayCards } from './combinationLabels';
import { Overlay } from './Overlay';
import styles from './EventLogOverlay.module.css';

const PLACEMENT_LABELS: Record<1 | 2 | 3 | 4, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };

export interface EventLogEntry {
  readonly key: number;
  readonly text: string;
  /** The exact cards of a `CARDS_PLAYED` event's own recognized combination, shown as the same compact
   *  `CardIndex` badges the seat's own Play trail already uses (App.tsx's `SeatPlayTrail`) - the person's
   *  own follow-up request to show the hand actually played, not just name it. In the same canonical
   *  display order `getDisplayCards` (combinationLabels.ts) already gives the center table and seat
   *  trails, so a Straight/Straight Flush shows its own ascending sequence rather than submission order.
   *  `null` for every other event category, which has no cards of its own to show. */
  readonly cards: readonly Card[] | null;
}

/**
 * Public, factual, player-facing text for one Round event (ui-ux.md §9.2: "Record useful public
 * gameplay events such as Round start/opener, exact Play + recognized combination, Pass, Trick
 * reset/free lead, and player finish/placement. It is a player-facing factual history, not a debug
 * trace."). `names` maps each `PlayerId` to its seat's display name (App.tsx builds this from the same
 * `SessionPresentationSnapshot.seats` the rest of the table already renders from).
 *
 * Returns `null` for engine-internal bookkeeping events not in that list - `CARDS_DEALT` (would leak
 * exact hand sizes as a discrete "event" rather than the always-visible per-seat count already shown),
 * `TURN_CHANGED` (redundant with the Play/Pass/Trick-reset entries that already explain every Turn
 * transition), `SCORE_CALCULATED` (Round scoring is M4-T12's own Result overlay, not this Round-in-
 * progress log), and `SESSION_STARTED`/`SESSION_ENDED` (outside a single Round's own history, per
 * §9.2's "Round history" scope, and Session completion is M4-T13's own Summary screen).
 *
 * The Round's own completion is reported here via `ROUND_ENDED`'s 4th-place finish specifically:
 * `PLAYER_FINISHED` is only ever emitted for 1st-3rd (`GameEvent`'s own `placement: 1 | 2 | 3`), so
 * without this the 4th-place (last remaining) player's own finish would never appear in the log at all.
 */
export function describeEvent(event: GameEvent, names: Readonly<Record<string, string>>): Omit<EventLogEntry, 'key'> | null {
  switch (event.type) {
    case 'ROUND_STARTED':
      return { text: `Round ${event.roundNumber} started.`, cards: null };
    case 'CARDS_PLAYED':
      // Combination *type* only here (no rank/suit text) - unlike `describeCombination`'s own M4-T08
      // Play/Pass reason text, which still needs the rank/suit spelled out in words since it has no
      // card visuals of its own alongside it. This instead matches the center table's own "played
      // <type>" convention (App.tsx's `CenterTable`, `COMBINATION_LABELS`), since the cards attached
      // below are now the actual rank/suit source; showing the same fact twice in two notations was the
      // person's own follow-up concern once card visuals were added here.
      return {
        text: `${names[event.playerId] ?? event.playerId} played ${COMBINATION_LABELS[event.combination.type]}.`,
        cards: getDisplayCards(event.combination),
      };
    case 'PLAYER_PASSED':
      return { text: `${names[event.playerId] ?? event.playerId} passed.`, cards: null };
    case 'TRICK_ENDED':
      // Past tense, consistent with every other entry ("played", "passed", "finished") - the person's
      // own follow-up report of "You wins the Trick" reading as a grammar mistake. Base text only:
      // `describeEvents` below appends " Free lead!" when this same Trick end genuinely continues the
      // Round, rather than also being the Round's own completion.
      return { text: `${names[event.lastSuccessfulPlayerId] ?? event.lastSuccessfulPlayerId} won the Trick.`, cards: null };
    case 'PLAYER_FINISHED':
      return { text: `${names[event.playerId] ?? event.playerId} finished ${PLACEMENT_LABELS[event.placement]}.`, cards: null };
    case 'ROUND_ENDED': {
      const fourth = event.result.placements.find((placement) => placement.placement === 4);
      return fourth
        ? { text: `${names[fourth.playerId] ?? fourth.playerId} finished 4th — Round ${event.roundNumber} complete.`, cards: null }
        : null;
    }
    default:
      return null;
  }
}

/** Maps `events` (chronological) to their Event Log entries, dropping the internal events `describeEvent`
 *  excludes. Shared by the overlay's own full list and the Event Log button's latest-event preview
 *  (App.tsx) so both always agree on which events actually count as "the latest event". */
export function describeEvents(events: readonly GameEvent[], names: Readonly<Record<string, string>>): readonly EventLogEntry[] {
  const entries: EventLogEntry[] = [];
  events.forEach((event, index) => {
    const described = describeEvent(event, names);
    if (described === null) return;
    // A TRICK_ENDED continues straight into a FREE LEAD for its own winner, unless this same Trick end
    // is also the Round's own completion - GameEngine.submitMove always emits TRICK_ENDED immediately
    // followed, in the same batch, by either TURN_CHANGED (a genuine free lead) or ROUND_ENDED. This
    // mirrors SessionPresentation's own `project()` lookahead, which makes the identical distinction for
    // the same reason (clearing every seat's own Play trail only on a genuine mid-Round reset).
    const text = event.type === 'TRICK_ENDED' && events[index + 1]?.type !== 'ROUND_ENDED'
      ? `${described.text} Free lead!`
      : described.text;
    entries.push({ key: index, text, cards: described.cards });
  });
  return entries;
}

export interface EventLogOverlayProps {
  /** The current Round's own events in chronological order (`SessionPresentationSnapshot.roundEvents`) -
   *  ui-ux.md §9.2 scopes the Event Log to "the chronological public Round history", matching the Task's
   *  own "Include Round start/opener, exact Plays/combinations, Pass, reset/free lead, finishes/
   *  placements" (all Round-scoped facts, none Session-spanning). */
  readonly events: readonly GameEvent[];
  readonly names: Readonly<Record<string, string>>;
  readonly onClose: () => void;
}

/**
 * Event Log overlay (M4-T10; ui-ux.md §9.2): "It initially opens at the newest event; scrolling upward
 * moves toward earlier events and the first event is at the top." Entries render oldest-first, top to
 * bottom (so the very first event is literally at the top of the list, as required), and the scroll
 * container is scrolled to its own bottom on open so the newest event is what is actually in view first -
 * scrolling up from there reaches progressively earlier entries, exactly as specified.
 */
export function EventLogOverlay({ events, names, onClose }: EventLogOverlayProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const entries = describeEvents(events, names);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, []);

  return (
    <Overlay title="Event Log" onClose={onClose}>
      <ol ref={listRef} className={styles.list} aria-label="Round event history">
        {entries.length === 0 && <li className={styles.empty}>No events yet this Round.</li>}
        {entries.map((entry) => (
          <li key={entry.key} className={styles.entry}>
            <span className={styles.entryText}>{entry.text}</span>
            {entry.cards !== null && (
              <span className={styles.entryCards}>
                {entry.cards.map((card) => <CardIndex key={`${card.rank}-${card.suit}`} card={card} />)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </Overlay>
  );
}

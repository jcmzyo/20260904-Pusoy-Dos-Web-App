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
 * Public, factual, player-facing text for one Session event (originally ui-ux.md §9.2: "Record useful
 * public gameplay events such as Round start/opener, exact Play + recognized combination, Pass, Trick
 * reset/free lead, and player finish/placement. It is a player-facing factual history, not a debug
 * trace." - see EventLogOverlay's own docstring below for the follow-up that widened this from a single
 * Round to the whole Session). `names` maps each `PlayerId` to its seat's display name (App.tsx builds
 * this from the same `SessionPresentationSnapshot.seats` the rest of the table already renders from).
 *
 * Returns `null` for engine-internal bookkeeping events not in that list - `CARDS_DEALT` (would leak
 * exact hand sizes as a discrete "event" rather than the always-visible per-seat count already shown),
 * `TURN_CHANGED` (redundant with the Play/Pass/Trick-reset entries that already explain every Turn
 * transition), `SCORE_CALCULATED` (Round scoring is M4-T12's own Result overlay, not this log), and
 * `SESSION_STARTED`/`SESSION_ENDED` (each Round's own `ROUND_STARTED`/`ROUND_ENDED` entry already marks
 * the Session's start/end in practice - the first and last of those - and the official final result
 * remains M4-T13's own Summary screen's job, not a duplicate log line here).
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
 *  excludes. */
export function describeEvents(events: readonly GameEvent[], names: Readonly<Record<string, string>>): readonly EventLogEntry[] {
  const entries: EventLogEntry[] = [];
  events.forEach((event, index) => {
    const described = describeEvent(event, names);
    if (described === null) return;
    // A TRICK_ENDED continues straight into a FREE LEAD for its own winner in the ordinary case -
    // GameEngine.submitMove always emits TRICK_ENDED immediately followed, in the same batch, by either
    // TURN_CHANGED (a genuine free lead) or ROUND_ENDED (this same Trick end is also the Round's own
    // completion). But when the Trick's own winner went out on that very Play (requirements.md §2.5.1:
    // their combination legitimately stood, yet a player who has already emptied their hand cannot take
    // the next lead themselves), the very next active player becomes the new leader instead - the
    // following TURN_CHANGED then names that player, not the Trick's own winner. Appending "Free lead!"
    // to the winner's own line regardless was a genuine bug (the person's own follow-up report): an
    // already-finished player's Trick win, immediately before a different seat's own next Turn, read as
    // if that finished player had somehow taken the table back. Only append it once the very next event
    // actually confirms the winner themselves is who leads next.
    const next = events[index + 1];
    const freeLeadGoesToWinner = event.type === 'TRICK_ENDED'
      && next?.type === 'TURN_CHANGED' && next.playerId === event.lastSuccessfulPlayerId;
    const text = freeLeadGoesToWinner ? `${described.text} Free lead!` : described.text;
    entries.push({ key: index, text, cards: described.cards });
  });
  return entries;
}

export interface EventLogOverlayProps {
  /** The whole Session's own events in chronological order (`SessionPresentationSnapshot.events`), not
   *  only the current Round's (`roundEvents`) - a person's own follow-up report on top of M4-T10/M4-T12:
   *  once a Round ends, the Round Result overlay pauses every other control (including this button)
   *  until the person explicitly continues, and the Event Log itself used to reset to empty on the very
   *  next Round - between those two, an already-finished Round's own history became unreachable again
   *  the moment its own Result overlay closed. Each Round's own `ROUND_STARTED`/`ROUND_ENDED` entries
   *  (`describeEvent` above) now double as this list's own Round-boundary markers, so earlier Rounds
   *  read as one continuous history rather than needing a separate synthetic marker event of their own. */
  readonly events: readonly GameEvent[];
  readonly names: Readonly<Record<string, string>>;
  readonly onClose: () => void;
}

/**
 * Event Log overlay (M4-T10; ui-ux.md §9.2, widened to the whole Session per this component's own
 * `events` docstring above): "It initially opens at the newest event; scrolling upward moves toward
 * earlier events and the first event is at the top." Entries render oldest-first, top to bottom (so the
 * very first event of the whole Session is literally at the top of the list, as required), and the
 * scroll container is scrolled to its own bottom on open so the newest event is what is actually in view
 * first - scrolling up from there reaches progressively earlier entries, exactly as specified.
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
      <ol ref={listRef} className={styles.list} aria-label="Session event history">
        {entries.length === 0 && <li className={styles.empty}>No events yet this Session.</li>}
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

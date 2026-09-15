import { useRef, useState, useSyncExternalStore } from 'react';
import { SessionPresentation } from '../application/SessionPresentation';
import type { PresentedSeat, SessionPresentationSnapshot } from '../application/SessionPresentation';
import { createSessionConfiguration, startSession } from '../application/startSession';
import type { SessionConfiguration, StartedSession } from '../application/startSession';
import type { BotNameProvider } from '../application/botNames';
import type { Combination } from '../domain';
import { CardBack, PlayingCard } from './primitives/Card';
import { HumanHand } from './primitives/HumanHand';
import { PlayerPanel } from './primitives/PlayerPanel';
import styles from './App.module.css';

interface AppProps {
  readonly start?: (configuration: SessionConfiguration) => StartedSession | Promise<StartedSession>;
  readonly botNames?: BotNameProvider;
}

export function App({ start = startSession, botNames }: AppProps) {
  const started = useRef(false);
  const [session, setSession] = useState<SessionPresentation | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (started.current) return;
    started.current = true;
    setStarting(true);
    setError(null);
    try {
      setSession(new SessionPresentation(await start(createSessionConfiguration(botNames))));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      started.current = false;
    } finally {
      setStarting(false);
    }
  }

  if (session) {
    return <SessionTable presentation={session} />;
  }

  return (
    <main className={`${styles.shell} ${styles.home}`}>
      <p className={styles.eyebrow}>THE CLASSIC FOUR-PLAYER CARD GAME</p>
      <h1>Pusoy Dos</h1>
      <p>One table. Three opponents. Five rounds.</p>
      <button className={styles.start} onClick={handleStart} disabled={starting}>
        {starting ? 'Starting…' : 'Start Game'}
      </button>
      {error !== null && <p role="alert">Could not start the Session: {error}</p>}
    </main>
  );
}

/** Human-readable labels for the canonical combination categories (requirements.md §2.3, domain-model.md §8). */
const COMBINATION_LABELS: Record<Combination['type'], string> = {
  single: 'Single', pair: 'Pair', triple: 'Triple', straight: 'Straight',
  flush: 'Flush', fullHouse: 'Full House', fourOfAKind: 'Four of a Kind', straightFlush: 'Straight Flush',
};

/** Typed `string | undefined` for the same ambient `*.module.css` index-signature reason documented in
 *  the primitives (Card.tsx, PlayerPanel.tsx): every seat/status class below is always defined in App.module.css. */
const SEAT_POSITION_CLASS: Record<PresentedSeat['seat'], string | undefined> = {
  north: styles.seatNorth, west: styles.seatWest, east: styles.seatEast, south: styles.seatSouth,
};

/** Bot hands render as overlapping face-down cards plus the PlayerPanel's numeric count; per ui-ux.md §4
 *  the UI never reveals bot card faces during active play, so only `CardBack` is used here. */
function BotHand({ cardCount }: { readonly cardCount: number }) {
  return (
    <div className={styles.botHand} aria-hidden="true">
      {Array.from({ length: cardCount }, (_, index) => <CardBack key={index} widthPx={40} />)}
    </div>
  );
}

function Seat({ seat }: { readonly seat: PresentedSeat }) {
  return (
    <div className={`${styles.seat} ${SEAT_POSITION_CLASS[seat.seat]}`}>
      {seat.seat !== 'south' && <BotHand cardCount={seat.cardCount} />}
      <PlayerPanel
        name={seat.name} cardCount={seat.cardCount} score={seat.totalScore}
        isCurrentTurn={seat.isCurrentTurn} passed={seat.passed} done={seat.done} placement={seat.placement}
      />
    </div>
  );
}

/** Center table per ui-ux.md §5.1: a Discard Pile button (the overlay itself is M4-T10) plus the current
 *  hand to beat (cards/type/player), an explicit FREE LEAD, or the Opening Move's distinct 3♣ requirement.
 *  The current hand remains visible through Passes until authoritative beat/reset (SessionPresentation, T03). */
function CenterTable({ center, seats }: { readonly center: SessionPresentationSnapshot['center']; readonly seats: readonly PresentedSeat[] }) {
  return (
    <div className={styles.center}>
      <button type="button" className={styles.discardButton}>Discard Pile</button>
      <div className={styles.currentHand}>
        {center.kind === 'freeLead' && <p className={styles.freeLead}>FREE LEAD</p>}
        {center.kind === 'opening' && <p className={styles.opening}>OPENING · 3♣ required</p>}
        {center.kind === 'hand' && (() => {
          const player = seats.find((seat) => seat.playerId === center.playerId);
          if (!player) throw new Error(`Current hand presentation references an unknown seat ${center.playerId}.`);
          return (
            <div className={styles.handInfo}>
              <p className={styles.handMeta}>{player.name} played {COMBINATION_LABELS[center.combination.type]}</p>
              <div className={styles.handCards}>
                {center.combination.cards.map((card) => <PlayingCard key={`${card.rank}-${card.suit}`} card={card} widthPx={48} />)}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export function SessionTable({ presentation }: { readonly presentation: SessionPresentation }) {
  const snapshot = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot);
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1>Pusoy Dos</h1>
        <p>Basic · Round {snapshot.roundNumber} of 5</p>
      </header>
      <section className={styles.table} aria-label="Game Table">
        {snapshot.seats.map((seat) => <Seat key={seat.playerId} seat={seat} />)}
        <CenterTable center={snapshot.center} seats={snapshot.seats} />
      </section>
      {/* Human hand selection/sorting/overlap/manual reorder (M4-T07; ui-ux.md §5.2, §6). Play/Pass
       *  submission from the selected cards is M4-T08's job, not this task's. */}
      <HumanHand cards={snapshot.humanHand} />
    </main>
  );
}

import { useRef, useState, useSyncExternalStore } from 'react';
import { SessionPresentation } from '../application/SessionPresentation';
import type { PresentedSeat, SessionPresentationSnapshot } from '../application/SessionPresentation';
import { createSessionConfiguration, startSession } from '../application/startSession';
import type { SessionConfiguration, StartedSession } from '../application/startSession';
import type { BotNameProvider } from '../application/botNames';
import type { Card, Move } from '../domain';
import { CardBack, CardIndex, PlayingCard } from './primitives/Card';
import { COMBINATION_LABELS, getDisplayCards } from './primitives/combinationLabels';
import { HumanHand } from './primitives/HumanHand';
import { PlayerPanel } from './primitives/PlayerPanel';
import { PlayPassControls } from './primitives/PlayPassControls';
import styles from './App.module.css';

/** Fixed Phase 1 human seat (requirements.md §1, ui-ux.md §4: "Human South"). */
const HUMAN_PLAYER_ID = 'south';

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
      const presentation = new SessionPresentation(await start(createSessionConfiguration(botNames)));
      // Drives bot Turns automatically so a human Turn actually becomes reachable; presentation
      // pacing/stale-input safety across Turn transitions remains M4-T09's job (SessionPresentation
      // docstring on startAutoPlay).
      presentation.startAutoPlay();
      setSession(presentation);
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

/** Typed `string | undefined` for the same ambient `*.module.css` index-signature reason documented in
 *  the primitives (Card.tsx, PlayerPanel.tsx): every seat/status class below is always defined in App.module.css. */
const SEAT_POSITION_CLASS: Record<PresentedSeat['seat'], string | undefined> = {
  north: styles.seatNorth, west: styles.seatWest, east: styles.seatEast, south: styles.seatSouth,
};

/** Bot hands render as overlapping face-down cards plus the PlayerPanel's numeric count; per ui-ux.md §4
 *  the UI never reveals bot card faces during active play, so only `CardBack` is used here. West/East
 *  render each card rotated 90° (`rotated`): their hands already stack lengthwise/vertically (ui-ux.md
 *  §5.3), and an unrotated upright card stacked that way reads as nobody actually holding cards this
 *  way, per the person's own T08 follow-up request. Every seat uses the same `widthPx={40}` card so
 *  West/East cards are the same physical size as North/South's (the person's own follow-up report) -
 *  `.rotatedCard` (App.module.css) reserves the swapped 40x56 → 56x40 footprint the rotation produces. */
function BotHand({ cardCount, rotated = false }: { readonly cardCount: number; readonly rotated?: boolean }) {
  return (
    <div className={styles.botHand} aria-hidden="true">
      {Array.from({ length: cardCount }, (_, index) => (
        rotated
          ? <div key={index} className={styles.rotatedCard}><CardBack widthPx={40} /></div>
          : <CardBack key={index} widthPx={40} />
      ))}
    </div>
  );
}

/** This seat's own Play trail (ui-ux.md §5.4): once a seat has Played in the active response cycle, its
 *  own combination stays visible at its seat, dimming once beaten, until the whole cycle clears
 *  (SessionPresentation's `lastPlay`, computed from public Play/Pass/Trick-reset events; already `null`
 *  once this seat itself Passes). Renders inside `PlayerPanel`'s own container (its `playTrail` slot)
 *  rather than beside it, per the person's own follow-up request. Uses the compact `CardIndex` corner
 *  badge rather than a shrunk `PlayingCard` — a full mini card reads as illegibly "shrunk," and the
 *  badge's smaller footprint also keeps a 5-card trail from growing past its own panel into the center
 *  table's own space. */
function SeatPlayTrail({ lastPlay }: { readonly lastPlay: PresentedSeat['lastPlay'] }) {
  if (!lastPlay) return null;
  return (
    <div
      className={`${styles.lastPlay} ${lastPlay.beaten ? styles.lastPlayBeaten : ''}`}
      role="group"
      aria-label={lastPlay.beaten ? 'Previous Play, now beaten' : 'Current Play'}
    >
      {getDisplayCards(lastPlay.combination).map((card) => <CardIndex key={`${card.rank}-${card.suit}`} card={card} />)}
    </div>
  );
}

function Seat({ seat }: { readonly seat: PresentedSeat }) {
  const rotated = seat.seat === 'west' || seat.seat === 'east';
  // Only a bot's own Turn shows a "deciding" indicator; the human's Turn immediately has its own
  // Play/Pass controls, so a spinner there would misleadingly suggest something is loading (M4-T09
  // slice, per the person's own follow-up request; full stale-input/pacing scope stays M4-T09's).
  const thinking = seat.isCurrentTurn && seat.seat !== HUMAN_PLAYER_ID;
  return (
    <div className={`${styles.seat} ${SEAT_POSITION_CLASS[seat.seat]}`}>
      {seat.seat !== 'south' && <BotHand cardCount={seat.cardCount} rotated={rotated} />}
      <PlayerPanel
        name={seat.name} cardCount={seat.cardCount} score={seat.totalScore}
        isCurrentTurn={seat.isCurrentTurn} passed={seat.passed} done={seat.done} placement={seat.placement}
        thinking={thinking}
        // Hidden while the "deciding" spinner shows (the person's own follow-up request): about to be
        // replaced by this seat's next decision anyway, so showing its old Play/Pass trail underneath
        // the spinner just adds noise.
        playTrail={thinking ? null : <SeatPlayTrail lastPlay={seat.lastPlay} />}
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
      <div className={styles.currentHand} role="region" aria-label="Current hand to beat">
        {center.kind === 'freeLead' && <p className={styles.freeLead}>FREE LEAD</p>}
        {center.kind === 'opening' && <p className={styles.opening}>OPENING · 3♣ required</p>}
        {center.kind === 'hand' && (() => {
          const player = seats.find((seat) => seat.playerId === center.playerId);
          if (!player) throw new Error(`Current hand presentation references an unknown seat ${center.playerId}.`);
          return (
            <div className={styles.handInfo}>
              <p className={styles.handMeta}>{player.name} played {COMBINATION_LABELS[center.combination.type]}</p>
              <div className={styles.handCards}>
                {getDisplayCards(center.combination).map((card) => <PlayingCard key={`${card.rank}-${card.suit}`} card={card} widthPx={48} />)}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/** The current Trick's exact card count while responding, or up to 5 for a free Play (opening/free
 *  lead) — the human can never usefully select more cards than the Engine could ever accept for the
 *  active Trick (requirements.md §2.3: combinations are 1, 2, 3 or 5 cards; a response must match the
 *  current combination's own length). This is a UI selection convenience, not a legality replica: the
 *  Engine still authoritatively decides whether a within-cap selection is actually legal (M4-T08). */
const FREE_PLAY_MAX_CARDS = 5;

function maxSelectableCards(center: SessionPresentationSnapshot['center']): number {
  return center.kind === 'hand' ? center.combination.cards.length : FREE_PLAY_MAX_CARDS;
}

export function SessionTable({ presentation }: { readonly presentation: SessionPresentation }) {
  const snapshot = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot);
  const [selectedCards, setSelectedCards] = useState<readonly Card[]>([]);
  const isMyTurn = snapshot.status === 'ROUND_ACTIVE' && snapshot.currentPlayerId === HUMAN_PLAYER_ID;

  function handleSubmit(move: Move) {
    const pending = presentation.getPendingHumanRequest();
    if (!pending || pending.playerId !== move.playerId) return;
    presentation.resolveHumanMove(pending.requestId, move);
  }

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
      {/* Three aligned containers (App.module.css's `.bottomBar`, round-4 follow-up): left (Event
       *  Log/Leave Game placeholders - their actual behavior is M4-T10/T11 scope), middle (the human
       *  hand plus Sort Rank/Sort Suit, M4-T07; ui-ux.md §5.2, §6), right (Play/Pass, M4-T08). */}
      <div className={styles.bottomBar}>
        <div className={styles.bottomLeft}>
          <button type="button" className={styles.sideButton}>Event Log</button>
          <button type="button" className={styles.sideButton}>Leave Game</button>
        </div>
        <HumanHand cards={snapshot.humanHand} maxSelectable={maxSelectableCards(snapshot.center)} onSelectionChange={setSelectedCards} />
        <PlayPassControls
          selected={selectedCards}
          center={snapshot.center}
          humanHand={snapshot.humanHand}
          playerId={HUMAN_PLAYER_ID}
          isMyTurn={isMyTurn}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}

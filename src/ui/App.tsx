import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SessionPresentation } from '../application/SessionPresentation';
import type { PresentedSeat, SessionPresentationSnapshot } from '../application/SessionPresentation';
import { createSessionConfiguration, startSession } from '../application/startSession';
import type { SessionConfiguration, StartedSession } from '../application/startSession';
import type { BotNameProvider } from '../application/botNames';
import type { Card, Move } from '../domain';
import { CardBack, CardIndex, PlayingCard } from './primitives/Card';
import { COMBINATION_LABELS, getDisplayCards } from './primitives/combinationLabels';
import { DiscardPileOverlay } from './primitives/DiscardPileOverlay';
import { EventLogOverlay } from './primitives/EventLogOverlay';
import { HumanHand } from './primitives/HumanHand';
import { LeaveConfirmOverlay } from './primitives/LeaveConfirmOverlay';
import { PlayerPanel } from './primitives/PlayerPanel';
import { PlayPassControls } from './primitives/PlayPassControls';
import { useLayoutSupport } from './primitives/useLayoutSupport';
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
  const layout = useLayoutSupport();

  // Portrait/undersized layouts pause live progression the same way an open overlay does (M4-T11;
  // ui-ux.md §14: "Portrait ... pause/prevent interaction"). This is a second, independent pause source
  // from SessionTable's own overlay/Leave-confirm pausing below — both can be active together (e.g. the
  // window shrinks below the supported size while Leave confirmation is already open) — which is exactly
  // why `SessionPresentation.pause`/`resume` are reference-counted rather than a single shared flag.
  // Nothing to pause before a Session exists (Home has no progression).
  useEffect(() => {
    if (!session || layout === 'supported') return;
    session.pause();
    return () => session.resume();
  }, [session, layout]);

  // Best-effort browser unload warning while a Session is unfinished (M4-T11; ui-ux.md §10: "Browser
  // refresh/tab/window close uses supported unload warnings where available; browser wording is not
  // guaranteed"). Modern browsers ignore any custom message and show their own fixed wording; setting
  // `returnValue` (rather than relying on the return value alone) is what actually triggers the prompt
  // across the widest range of browsers.
  useEffect(() => {
    if (!session) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session]);

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

  // Confirmed Leave Game (M4-T11; ui-ux.md §10). Progress is not saved, so this abandons the Session
  // outright via `destroy()` — which stops its background Turn-advancement loop for good and lets it be
  // garbage-collected — rather than leaving it running unseen (or merely parked forever) once the person
  // has navigated away from it, and re-arms Start Game for a fresh Session the same way Home's own
  // initial state does.
  function handleLeave() {
    session?.destroy();
    setSession(null);
    started.current = false;
  }

  // Replaces Home/the table outright rather than overlaying it (M4-T11; ui-ux.md §14): unlike Discard
  // Pile/Event Log/Leave confirmation, there is nothing safely showable underneath at these dimensions.
  if (layout !== 'supported') {
    return <UnsupportedLayoutNotice category={layout} />;
  }

  if (session) {
    return <SessionTable presentation={session} onLeave={handleLeave} />;
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

/** Portrait/undersized-landscape guidance (M4-T11; ui-ux.md §14). `category` is never `'supported'` —
 *  callers only render this once `useLayoutSupport` has already left that case. */
function UnsupportedLayoutNotice({ category }: { readonly category: 'portrait' | 'undersized' }) {
  return (
    <main className={`${styles.shell} ${styles.unsupportedLayout}`}>
      <h1>{category === 'portrait' ? 'Rotate your device to continue' : 'Resize your window to continue'}</h1>
      <p>Pusoy Dos needs a wider landscape view to stay playable.</p>
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

function Seat({ seat, overlayOpen }: { readonly seat: PresentedSeat; readonly overlayOpen: boolean }) {
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
        thinking={thinking} paused={overlayOpen}
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
function CenterTable({ center, seats, onOpenDiscardPile }: { readonly center: SessionPresentationSnapshot['center']; readonly seats: readonly PresentedSeat[]; readonly onOpenDiscardPile: () => void }) {
  return (
    <div className={styles.center}>
      {/* "Check Discard Pile" rather than bare "Discard Pile" (the person's own follow-up request): the
       *  noun phrase alone read as if clicking it would discard the player's own pile of cards, rather
       *  than opening the overlay to inspect it. The overlay's own title (below) stays "Discard Pile" -
       *  a heading naming what is inside it, with no action-verb ambiguity once it is already open. */}
      <button type="button" className={styles.discardButton} onClick={onOpenDiscardPile}>Check Discard Pile</button>
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

/** Which overlay (M4-T10; Leave confirmation, M4-T11) is currently open, if any. Discard Pile, Event
 *  Log, and Leave confirmation are all opened from one piece of UI state rather than independent
 *  booleans, so at most one is ever open at a time - matching typical single-modal UX and keeping the
 *  pause effect below simple (one open/closed transition to react to). This is purely a same-component
 *  mutual-exclusivity convenience, not what makes composing with App.tsx's own independent
 *  layout-guard pause source safe - `SessionPresentation.pause`/`resume` are reference-counted for that. */
type OverlayKind = 'none' | 'discardPile' | 'eventLog' | 'leaveConfirm';

export function SessionTable({
  presentation,
  // Optional, defaulting to a no-op, so the many existing tests that render `SessionTable` directly to
  // exercise unrelated M4-T06/T07/T08/T10 behavior (and never click Leave Game) do not all need a prop
  // they don't care about; App.tsx's own real usage always passes its actual `handleLeave`.
  onLeave = () => {},
}: { readonly presentation: SessionPresentation; readonly onLeave?: () => void }) {
  const snapshot = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot);
  const [selectedCards, setSelectedCards] = useState<readonly Card[]>([]);
  const [overlay, setOverlay] = useState<OverlayKind>('none');
  const isMyTurn = snapshot.status === 'ROUND_ACTIVE' && snapshot.currentPlayerId === HUMAN_PLAYER_ID;
  const overlayOpen = overlay !== 'none';

  // Opening either overlay pauses automatic Turn advancement; closing (including via unmount) resumes
  // from the exact same point (ui-ux.md §9.2; SessionPresentation.pause/resume).
  useEffect(() => {
    if (!overlayOpen) return;
    presentation.pause();
    return () => presentation.resume();
  }, [overlayOpen, presentation]);

  function handleSubmit(move: Move) {
    const pending = presentation.getPendingHumanRequest();
    if (!pending || pending.playerId !== move.playerId) return;
    presentation.resolveHumanMove(pending.requestId, move);
  }

  function closeOverlay() {
    setOverlay('none');
  }

  const names = Object.fromEntries(snapshot.seats.map((seat) => [seat.playerId, seat.name]));

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1>Pusoy Dos</h1>
        <p>Basic · Round {snapshot.roundNumber} of 5</p>
      </header>
      <section className={styles.table} aria-label="Game Table">
        {snapshot.seats.map((seat) => <Seat key={seat.playerId} seat={seat} overlayOpen={overlayOpen} />)}
        <CenterTable center={snapshot.center} seats={snapshot.seats} onOpenDiscardPile={() => setOverlay('discardPile')} />
      </section>
      {/* Three aligned containers (App.module.css's `.bottomBar`, round-4 follow-up): left (Event Log,
       *  M4-T10; Leave Game, M4-T11), middle (the human hand plus Sort Rank/Sort Suit, M4-T07; ui-ux.md
       *  §5.2, §6), right (Play/Pass, M4-T08). */}
      <div className={styles.bottomBar}>
        <div className={styles.bottomLeft}>
          {/* No latest-event preview line (M4-T10 follow-up; the person's own follow-up request): the
           *  center table's own current hand to beat already shows the latest Play, and a variable-length
           *  preview line was changing this button's own height as events came in. */}
          <button type="button" className={styles.sideButton} onClick={() => setOverlay('eventLog')}>Event Log</button>
          <button type="button" className={styles.sideButton} onClick={() => setOverlay('leaveConfirm')}>Leave Game</button>
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
      {overlay === 'discardPile' && <DiscardPileOverlay cards={snapshot.playedCards} onClose={closeOverlay} />}
      {overlay === 'eventLog' && <EventLogOverlay events={snapshot.roundEvents} names={names} onClose={closeOverlay} />}
      {overlay === 'leaveConfirm' && <LeaveConfirmOverlay onStay={closeOverlay} onLeave={onLeave} />}
    </main>
  );
}

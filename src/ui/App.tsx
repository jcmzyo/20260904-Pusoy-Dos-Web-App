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
import { cardKey, compareByRank } from './primitives/handOrdering';
import { HumanHand } from './primitives/HumanHand';
import { LeaveConfirmOverlay } from './primitives/LeaveConfirmOverlay';
import { PlayerPanel } from './primitives/PlayerPanel';
import { PlayPassControls } from './primitives/PlayPassControls';
import { RoundResultOverlay } from './primitives/RoundResultOverlay';
import { useLayoutSupport } from './primitives/useLayoutSupport';
import styles from './App.module.css';

/** Fixed Phase 1 human seat (requirements.md §1, ui-ux.md §4: "Human South"). */
const HUMAN_PLAYER_ID = 'south';

/** How long the 4th-place reveal shows before the Round Result overlay appears, absent an earlier
 *  click/tap skip (M4-T12; ui-ux.md §11: "roughly 1.5-2 seconds"). Tests pass 0 for a deterministic/
 *  instant transition, mirroring `SessionPresentation.startAutoPlay`'s own tunable-delay convention. */
const ROUND_REVEAL_DURATION_MS = 1750;

/** Default per-stage delay for the Round Result overlay's own scoring-reveal animation (ui-ux.md §12);
 *  see `RoundResultOverlay`'s own `stageDelayMs` for the sequence this paces. */
const ROUND_RESULT_STAGE_DELAY_MS = 650;

/** How long the Round-start transition screen (dim + "Round X") shows once "Next Round" is clicked,
 *  before the next Round's own opening Turn actually starts, absent an earlier click/tap skip - a
 *  person's own follow-up request on top of M4-T12, not part of its own original Definition of Done.
 *  Short, matching the reveal's own "roughly 1.5-2 seconds" convention above rather than a longer
 *  ceremony. Tests pass 0 for a deterministic/instant transition, same convention as every other
 *  presentation-timing constant here. */
const ROUND_TRANSITION_DURATION_MS = 1300;

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
    return <SessionTable presentation={session} onLeave={handleLeave} showInitialTransition />;
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

/** The 4th-place finisher's remaining hand, revealed face-up sorted by Rank at their own seat once the
 *  Round is authoritative-complete (M4-T12; ui-ux.md §11: "reveal the 4th-place player's remaining
 *  cards in that player's normal table position, sorted by Rank"). Only ever rendered for a bot seat —
 *  the human's own hand is never hidden from the human in the first place, so `SessionTable`'s own
 *  `isRevealing` gate never passes this for South. Reuses `.botHand`'s own layout (including its
 *  West/East rotation wrapper) so the reveal does not change that seat's own reserved footprint
 *  (App.module.css's own table/panel dimension-stability contract, §5.7). Unlike `BotHand`'s decorative
 *  face-down cards, these are real face-up cards now public information, so this is not `aria-hidden`. */
function RevealedHand({ cards, rotated = false }: { readonly cards: readonly Card[]; readonly rotated?: boolean }) {
  const sorted = [...cards].sort(compareByRank);
  return (
    <div className={styles.botHand}>
      {sorted.map((card) => (
        rotated
          ? <div key={cardKey(card)} className={styles.rotatedCard}><PlayingCard card={card} widthPx={40} /></div>
          : <PlayingCard key={cardKey(card)} card={card} widthPx={40} />
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

function Seat({ seat, overlayOpen, revealedCards }: { readonly seat: PresentedSeat; readonly overlayOpen: boolean; readonly revealedCards?: readonly Card[] }) {
  const rotated = seat.seat === 'west' || seat.seat === 'east';
  // Only a bot's own Turn shows a "deciding" indicator; the human's Turn immediately has its own
  // Play/Pass controls, so a spinner there would misleadingly suggest something is loading (M4-T09
  // slice, per the person's own follow-up request; full stale-input/pacing scope stays M4-T09's).
  const thinking = seat.isCurrentTurn && seat.seat !== HUMAN_PLAYER_ID;
  return (
    <div className={`${styles.seat} ${SEAT_POSITION_CLASS[seat.seat]}`}>
      {seat.seat !== 'south' && (
        revealedCards
          ? <RevealedHand cards={revealedCards} rotated={rotated} />
          : <BotHand cardCount={seat.cardCount} rotated={rotated} />
      )}
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
  // Optional, defaulting to a no-op — Session Summary itself is M4-T13 scope. Round 5's Round Result
  // overlay already needs its own distinct "View Session Results" continuation action now (M4-T12's own
  // Definition of Done: "R5 uses View Session Results"), so this is the seam that action calls; for now
  // it is an inert placeholder, the same established pattern this codebase already uses for a control
  // that exists ahead of the task that gives it real behavior (Discard Pile's button before M4-T10;
  // Event Log/Leave Game's before M4-T10/M4-T11) — reported in this task's own completion report.
  onSessionComplete = () => {},
  // Test-only presentation-timing overrides (both mirror `SessionPresentation.startAutoPlay`'s own
  // "pass 0 for a deterministic/instant sequence" convention); App.tsx's real usage always leaves both
  // at their production defaults (`ROUND_REVEAL_DURATION_MS`, `ROUND_RESULT_STAGE_DELAY_MS`).
  revealDurationMs = ROUND_REVEAL_DURATION_MS,
  resultStageDelayMs = ROUND_RESULT_STAGE_DELAY_MS,
  // Test-only override, same convention as the two props above; App.tsx's real usage leaves it at
  // `ROUND_TRANSITION_DURATION_MS`.
  roundTransitionDurationMs = ROUND_TRANSITION_DURATION_MS,
  // Shows the same Round-start transition screen for this component's own very first mount (person's own
  // follow-up report: Round 1 got no "dim, then Round X, then lit" treatment, only Rounds 2+ did). Defaults
  // to false so the many existing tests that render `SessionTable` directly and expect it immediately
  // interactive - never having clicked any "Start Game" flow of their own - are unaffected; App.tsx's real
  // usage passes `true` here, exactly once, right when a freshly started Session first renders.
  showInitialTransition = false,
}: {
  readonly presentation: SessionPresentation;
  readonly onLeave?: () => void;
  readonly onSessionComplete?: () => void;
  readonly revealDurationMs?: number;
  readonly resultStageDelayMs?: number;
  readonly roundTransitionDurationMs?: number;
  readonly showInitialTransition?: boolean;
}) {
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

  // End-of-Round presentation (M4-T12; ui-ux.md §11-§12): `roundCheckpoint` is set exactly while the
  // current Round is authoritative-complete (SessionPresentation's own projection, independent of
  // `status` — which for Round 5 skips straight to `SESSION_COMPLETE` without ever passing through
  // `ROUND_RESULT`, since the Basic Session's own official result becomes available in that same Engine
  // transaction; `roundCheckpoint`/`reveal` stay populated regardless, so this gate covers Round 5 too).
  const roundComplete = snapshot.roundCheckpoint !== null;
  const [resultPhase, setResultPhase] = useState<'reveal' | 'result'>('reveal');
  const [handledRound, setHandledRound] = useState<number | null>(null);

  // A newly-completed Round always restarts at the reveal phase. This runs during render, not a
  // useEffect, on purpose: an effect-based reset fires one render *after* the render where `roundComplete`
  // first flips true for the new Round, and on that first render `resultPhase` is still whatever a
  // PREVIOUS Round's own settled state left it at ('result') - which briefly (but visibly, and reported:
  // "the previous result window pops for a second") opens that Round's own Result overlay before the
  // effect corrects it a moment later. This is reproducible at every Round boundary from Round 2 onward
  // (Round 1 has no earlier settled phase to leak from). Adjusting state during render - React's own
  // documented pattern for exactly this "reset when an id changes" case - lands the reset in the very
  // same commit, so the stale phase is never actually painted.
  if (roundComplete && handledRound !== snapshot.roundNumber) {
    setHandledRound(snapshot.roundNumber);
    setResultPhase('reveal');
  } else if (!roundComplete && handledRound !== null) {
    setHandledRound(null);
  }

  // The reveal has nothing to show (no reveal yet) or nothing worth revealing (the human's own 4th-place
  // hand was never hidden from the human to begin with) - move straight to the Round Result overlay.
  // Otherwise, auto-advance after `revealDurationMs` absent an earlier click/tap skip.
  useEffect(() => {
    if (!roundComplete || resultPhase !== 'reveal') return;
    if (snapshot.reveal === null || snapshot.reveal.playerId === HUMAN_PLAYER_ID) { setResultPhase('result'); return; }
    const timer = setTimeout(() => setResultPhase('result'), revealDurationMs);
    return () => clearTimeout(timer);
  }, [roundComplete, resultPhase, snapshot.reveal, revealDurationMs]);

  // Round-start transition (person's own follow-up request: "a good or simple round transition aside
  // from the score board... dim the table initially then Round X then lit the game to make it playable
  // again"): once "Next Round" is clicked, this holds the upcoming Round's own number while a brief
  // dim-and-label screen shows. `continueToNextRound()` itself now runs immediately in `handleContinue`
  // below, before this screen even opens - not deferred until the screen's own timer/skip ends. It used
  // to be deferred, on the theory that dealing early would let the fresh Round "flash into view
  // underneath the transition screen" - but deferring it instead left the *previous* Round's own
  // leftover cards (whatever remained in each hand when it ended) sitting dimmed underneath for the
  // whole transition, which then visibly swapped for the freshly dealt Round the instant the screen
  // cleared (a further follow-up report). Dealing early means the dimmed table already shows the fresh
  // Round throughout the transition, so lifting the dim only ever brightens it rather than replacing
  // anything - `isTableInert` below (via `startingRound !== null`) is exactly what keeps that already-
  // dealt Round hidden/inert until this screen's own timer or an explicit skip ends it. Round 5 has no
  // next Round to transition into, so `handleContinue` below never sets this for it - `onSessionComplete`
  // still fires immediately.
  //
  // `showInitialTransition` extends the exact same screen to Round 1's own very first start (a further
  // follow-up report: the person expected the same "dim, then Round X, then lit" treatment there too,
  // not only between Rounds). That case has no prior Round Result to continue from at all - Round 1 is
  // already dealt and live the moment this component mounts - so it sets `startingRound` directly below
  // rather than through `handleContinue`, and never calls `continueToNextRound()`.
  const [startingRound, setStartingRound] = useState<number | null>(() => (showInitialTransition ? snapshot.roundNumber : null));

  // Unlike the between-Rounds case (already inert - `driveTurns` only ever runs while `status` is
  // `ROUND_ACTIVE`, and a completed Round's own status stays `ROUND_RESULT` until `continueToNextRound`
  // actually runs), Round 1 is genuinely live and auto-playing the moment this component mounts - so the
  // initial transition needs its own explicit pause, the same reference-counted pause/resume every other
  // overlay here already uses, rather than relying on Round-completion status to do it implicitly.
  const isTransitioning = startingRound !== null;
  useEffect(() => {
    if (!isTransitioning) return;
    presentation.pause();
    return () => presentation.resume();
  }, [isTransitioning, presentation]);

  useEffect(() => {
    if (startingRound === null) return;
    const timer = setTimeout(() => setStartingRound(null), roundTransitionDurationMs);
    return () => clearTimeout(timer);
  }, [startingRound, roundTransitionDurationMs]);

  // `continueToNextRound()` now runs immediately in `handleContinue` (see `startingRound`'s own
  // docstring above), so `roundComplete` is already false for the entire round-start transition, not
  // only once it ends - `startingRound === null` below is what actually keeps the Round Result overlay
  // from rendering during that transition; `roundComplete` alone would already be false by then anyway,
  // this just keeps the condition explicit/self-documenting rather than relying on that ordering.
  const isRevealing = roundComplete && resultPhase === 'reveal' && snapshot.reveal !== null && snapshot.reveal.playerId !== HUMAN_PLAYER_ID;
  const isResultOverlayOpen = roundComplete && resultPhase === 'result' && startingRound === null;
  // Once the 4th-place player's own hand has been revealed, it stays revealed through the Result
  // overlay too (person's own follow-up report: it was flipping back to face-down the instant the
  // Result overlay/scoreboard opened, reading as if the reveal never happened at all). Distinct from
  // `isRevealing` above (which only gates the timed reveal *phase* itself, e.g. the skip button) -
  // this instead covers the seat's own revealed-cards display across both `resultPhase` values, only
  // clearing once the round-start transition to the next Round actually begins.
  const isHandRevealed = roundComplete && snapshot.reveal !== null && snapshot.reveal.playerId !== HUMAN_PLAYER_ID && startingRound === null;
  const isTableInert = isResultOverlayOpen || startingRound !== null;

  function skipReveal() {
    setResultPhase('result');
  }

  function skipRoundTransition() {
    if (startingRound === null) return;
    setStartingRound(null);
  }

  function handleContinue() {
    // Round 5's Round Result has no next Round to continue to - the Basic Session's own official result
    // (`sessionResult`) is exactly what distinguishes it, rather than a hardcoded "roundNumber === 5".
    if (snapshot.sessionResult !== null) { onSessionComplete(); return; }
    // Deals the next Round now, before the transition screen even opens (see that screen's own
    // docstring above) - `snapshot` here is still this render's own pre-continuation value, so
    // `snapshot.roundNumber + 1` is exactly the Round `continueToNextRound()` just started.
    presentation.continueToNextRound();
    setStartingRound(snapshot.roundNumber + 1);
  }

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
      {/* Dimmed while the Round Result overlay or the Round-start transition screen below is showing
       *  (ui-ux.md §12: "a modal/overlay over the dimmed completed table"; the transition screen extends
       *  the same treatment to its own brief window) - `pointer-events: none` also keeps every control
       *  underneath (Play/Pass, Discard Pile/Event Log/Leave Game, hand selection) inert while either is
       *  up, matching the Result overlay's own non-dismissible, explicit-continuation-only contract. */}
      <div className={isTableInert ? styles.tableDimmed : undefined}>
        <section className={styles.table} aria-label="Game Table">
          {snapshot.seats.map((seat) => (
            <Seat
              key={seat.playerId}
              seat={seat}
              overlayOpen={overlayOpen}
              {...(isHandRevealed && snapshot.reveal!.playerId === seat.playerId ? { revealedCards: snapshot.reveal!.cards } : {})}
            />
          ))}
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
      </div>
      {/* Full-screen click/tap-to-skip control for the 4th-hand reveal (ui-ux.md §11: "A click/tap may
       *  finish the reveal immediately") - a real (keyboard-reachable) button rather than a decorative
       *  click-catcher div, so the same skip is available without a mouse/touch. This only ever advances
       *  the local reveal→result phase, never `onContinue`/`continueToNextRound` - "the same input must
       *  not accidentally activate the next result action" (ui-ux.md §11): it is a convenience on top of
       *  the reveal's own timed auto-advance, not the only way to proceed. */}
      {isRevealing && (
        <button type="button" className={styles.revealSkipLayer} onClick={skipReveal} aria-label="Skip reveal" />
      )}
      {overlay === 'discardPile' && <DiscardPileOverlay cards={snapshot.playedCards} onClose={closeOverlay} />}
      {/* Whole-Session history (the person's own follow-up report: the Round Result overlay pauses every
       *  other control, so a Round's own Event Log entries were otherwise unreachable again once that
       *  Round ended) - `snapshot.events`, not `snapshot.roundEvents`; see EventLogOverlay's own updated
       *  docstring for the full scope change. */}
      {overlay === 'eventLog' && <EventLogOverlay events={snapshot.events} names={names} onClose={closeOverlay} />}
      {overlay === 'leaveConfirm' && <LeaveConfirmOverlay onStay={closeOverlay} onLeave={onLeave} />}
      {isResultOverlayOpen && snapshot.roundCheckpoint && (
        <RoundResultOverlay
          roundNumber={snapshot.roundNumber}
          seats={snapshot.seats}
          placements={snapshot.roundCheckpoint.placements}
          isFinalRound={snapshot.sessionResult !== null}
          onContinue={handleContinue}
          stageDelayMs={resultStageDelayMs}
        />
      )}
      {startingRound !== null && <RoundTransitionOverlay roundNumber={startingRound} onSkip={skipRoundTransition} />}
    </main>
  );
}

/**
 * Round-start transition (person's own follow-up request on top of M4-T12: "a good or simple round
 * transition... dim the table initially then Round X then lit the game to make it playable again"),
 * shown for `roundTransitionDurationMs` between the previous Round's own Result overlay closing and the
 * next Round's own opening Turn actually becoming visible/interactive. A full-screen click/tap-to-skip
 * button, same interaction as the reveal's own skip layer above - clicking anywhere ends the transition
 * immediately rather than waiting out the full duration.
 */
function RoundTransitionOverlay({ roundNumber, onSkip }: { readonly roundNumber: number; readonly onSkip: () => void }) {
  return (
    <button type="button" className={styles.roundTransition} onClick={onSkip} aria-label={`Starting Round ${roundNumber}`}>
      <span className={styles.roundTransitionText}>Round {roundNumber}</span>
    </button>
  );
}

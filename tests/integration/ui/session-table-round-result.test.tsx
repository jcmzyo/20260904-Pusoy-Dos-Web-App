// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Move, Suit } from '../../../src/domain';
import { SessionPresentation } from '../../../src/application/SessionPresentation';
import type { StartedSession } from '../../../src/application/startSession';
import { createSession, defaultRuleset, getPublicView, startRound } from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';
import { compareByRank } from '../../../src/ui/primitives/handOrdering';
import { SessionTable } from '../../../src/ui/App';

/**
 * End-to-end proof that the real production `SessionPresentation` drives `SessionTable` through the
 * approved End-of-Round presentation (M4-T12; ui-ux.md §11-§12): the 4th-place reveal, then the Round
 * Result overlay's own scoring sequence and explicit continuation - not a UI state replica standing in
 * for it. Every seat prefers a legal Play over a Pass so Rounds actually finish within a bounded number
 * of Turns.
 *
 * Also covers two person-reported follow-ups layered on top of M4-T12: the Round-start transition screen
 * ("dim the table initially then Round X then lit the game to make it playable again") that now sits
 * between "Next Round" and the next Round's own opening Turn, and the Event Log's own widening from a
 * per-Round to a whole-Session history (see `EventLogOverlay`'s own updated docstring).
 */

const ids = ['south', 'west', 'north', 'east'];
const SUIT_LABELS: Record<Suit, string> = { clubs: 'Clubs', spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds' };

function fixture(seed: number) {
  let state = seed;
  const engineRng = { next: () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; } };
  const created = createSession(ids);
  const started = startRound(created.state, engineRng);
  const preferPlay = (request: PlayerTurnRequest): Move =>
    request.legalMoves.find((move) => move.kind === 'play') ?? request.legalMoves.find((move) => move.kind === 'pass')!;
  const controllers = ids.map((playerId) => ({ playerId, chooseMove: async (request: PlayerTurnRequest) => preferPlay(request) }));
  const session: StartedSession = {
    runner: new GameRunner(started.state, defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])), true),
    humanController: controllers[0]!, engineRng, initialView: getPublicView(started.state),
    startupEvents: [...created.events, ...started.events], names: { south: 'You', west: 'Ana', north: 'Bo', east: 'Cy' },
  };
  return new SessionPresentation(session);
}

async function driveToRoundEnd(presentation: SessionPresentation): Promise<void> {
  let turns = 0;
  while (presentation.getSnapshot().status === 'ROUND_ACTIVE' && turns++ < 400) {
    await presentation.runTurn();
  }
  if (turns >= 400) throw new Error('Round did not complete within the expected Turn budget.');
}

/** Deterministically finds a fixture whose 4th-place finisher is a bot - both to exercise the actual
 *  face-up reveal (the human's own hand is never hidden, so a South 4th-place has nothing to reveal;
 *  App.tsx's own `isRevealing` gate skips it) and because it is the more common/representative case. */
async function fixtureWithBotFourthPlace(): Promise<SessionPresentation> {
  for (let seed = 1; seed < 500; seed++) {
    const presentation = fixture(seed);
    await driveToRoundEnd(presentation);
    const reveal = presentation.getSnapshot().reveal;
    if (reveal && reveal.playerId !== 'south') return presentation;
  }
  throw new Error('No seed within range produced a bot 4th-place finish - fixture drive logic likely broken.');
}

afterEach(cleanup);

describe('End-of-Round reveal and Round Result overlay (M4-T12; ui-ux.md §11-§12)', () => {
  it('reveals the 4th-place bot hand face-up sorted by Rank, skippable by click, before the Round Result overlay appears', async () => {
    const presentation = await fixtureWithBotFourthPlace();
    const reveal = presentation.getSnapshot().reveal!;
    const sortedLabels = [...reveal.cards].sort(compareByRank).map((card) => `${card.rank} of ${SUIT_LABELS[card.suit]}`);

    // A long revealDurationMs proves the transition below is the click, not a coincidental auto-advance.
    render(<SessionTable presentation={presentation} revealDurationMs={20_000} resultStageDelayMs={0} />);

    for (const label of sortedLabels) {
      expect(screen.getByRole('img', { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Skip reveal' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    // Skipping the reveal only reached the Round Result overlay - it did not also continue to the next
    // Round (ui-ux.md §11: "the same input must not accidentally activate the next result action").
    expect(presentation.getSnapshot().roundNumber).toBe(reveal.roundNumber);
    // Person's own follow-up report: the revealed hand was flipping back to face-down the instant the
    // Round Result overlay opened - it must instead stay visible (dimmed behind the overlay, same as
    // the rest of the table) for as long as that same Round's own Result overlay is showing.
    for (const label of sortedLabels) {
      expect(screen.getByRole('img', { name: label })).toBeTruthy();
    }
  });

  it('moves straight to the Round Result overlay, with nothing to reveal, when the human finishes 4th', async () => {
    for (let seed = 1; seed < 500; seed++) {
      const presentation = fixture(seed);
      await driveToRoundEnd(presentation);
      const reveal = presentation.getSnapshot().reveal;
      if (!reveal || reveal.playerId !== 'south') continue;
      render(<SessionTable presentation={presentation} revealDurationMs={20_000} resultStageDelayMs={0} />);
      expect(screen.queryByRole('button', { name: 'Skip reveal' })).toBeNull();
      expect(await screen.findByRole('dialog')).toBeTruthy();
      return;
    }
    throw new Error('No seed within range produced a human 4th-place finish - nothing exercised this case.');
  });

  it('auto-advances from the reveal to the Round Result overlay after revealDurationMs elapses, absent a skip', async () => {
    vi.useFakeTimers();
    try {
      const presentation = await fixtureWithBotFourthPlace();
      render(<SessionTable presentation={presentation} revealDurationMs={1000} resultStageDelayMs={0} />);
      expect(screen.queryByRole('dialog')).toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(999); });
      expect(screen.queryByRole('dialog')).toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(screen.getByRole('dialog')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the Round\'s own authoritative placements/points and continues via the explicit Next Round action for Rounds 1-4', async () => {
    const presentation = fixture(3);
    await driveToRoundEnd(presentation);
    expect(presentation.getSnapshot().status).toBe('ROUND_RESULT');
    const checkpoint = presentation.getSnapshot().roundCheckpoint!;
    const roundBefore = presentation.getSnapshot().roundNumber;

    render(<SessionTable presentation={presentation} revealDurationMs={0} resultStageDelayMs={0} roundTransitionDurationMs={0} />);
    await screen.findByRole('dialog');
    // Waits through the overlay's own scoring-animation stages (real 0ms-delay timers) until this
    // Round's own authoritative points have actually appeared, rather than asserting on whichever stage
    // happened to be showing the instant the dialog itself first mounted.
    for (const entry of checkpoint.placements) {
      await screen.findByText(`+${entry.points}`);
    }
    expect(screen.getByRole('button', { name: 'Next Round' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View Session Results' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Next Round' }));
    // "Next Round" first opens the Round-start transition screen (person's own follow-up request on top
    // of M4-T12) rather than continuing immediately - the dialog closes right away, but `continueToNextRound`
    // itself is deferred until that screen's own (here, 0ms) timer elapses.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByRole('button', { name: `Starting Round ${roundBefore + 1}` })).toBeTruthy();
    await screen.findByText(`Basic · Round ${roundBefore + 1} of 5`);
    expect(presentation.getSnapshot().roundNumber).toBe(roundBefore + 1);
    expect(presentation.getSnapshot().roundCheckpoint).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the Round-start transition after "Next Round", dims the table for its own duration, then lights it back up exactly once continueToNextRound actually runs (person\'s own follow-up request on top of M4-T12)', async () => {
    vi.useFakeTimers();
    try {
      const presentation = fixture(3);
      await driveToRoundEnd(presentation);
      const roundBefore = presentation.getSnapshot().roundNumber;
      const continueToNextRoundSpy = vi.spyOn(presentation, 'continueToNextRound');

      render(<SessionTable presentation={presentation} revealDurationMs={0} resultStageDelayMs={0} roundTransitionDurationMs={1000} />);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      fireEvent.click(screen.getByRole('button', { name: 'Next Round' }));

      const transition = screen.getByRole('button', { name: `Starting Round ${roundBefore + 1}` });
      expect(transition.textContent).toBe(`Round ${roundBefore + 1}`);
      // `continueToNextRound` already ran the instant "Next Round" was clicked (person's own follow-up
      // report: deferring it until the transition's own timer ended left the *previous* Round's own
      // leftover cards sitting dimmed underneath, which then visibly swapped for the freshly dealt Round
      // the instant this screen cleared) - the fresh Round is already dealt, just still dimmed/inert.
      expect(continueToNextRoundSpy).toHaveBeenCalledOnce();
      expect(presentation.getSnapshot().roundNumber).toBe(roundBefore + 1);
      // The fresh 13-card deal for every seat is already the underlying data throughout the dimmed
      // transition, not only once it lifts - nothing is left to swap once the screen clears.
      expect(presentation.getSnapshot().humanHand).toHaveLength(13);
      expect(presentation.getSnapshot().seats.every((seat) => seat.cardCount === 13)).toBe(true);
      const dimmedWrapper = screen.getByRole('region', { name: 'Game Table' }).parentElement!;
      expect(dimmedWrapper.className).toContain('tableDimmed');

      await act(async () => { await vi.advanceTimersByTimeAsync(999); });
      expect(continueToNextRoundSpy).toHaveBeenCalledOnce();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });

      // The timer only ever lifts the dim now - it never calls `continueToNextRound` a second time.
      expect(continueToNextRoundSpy).toHaveBeenCalledOnce();
      expect(presentation.getSnapshot().roundNumber).toBe(roundBefore + 1);
      expect(screen.queryByRole('button', { name: `Starting Round ${roundBefore + 1}` })).toBeNull();
      expect(dimmedWrapper.className).not.toContain('tableDimmed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('the Round-start transition is skippable by click/tap, continuing immediately without also waiting out its own timer or double-invoking continueToNextRound', async () => {
    vi.useFakeTimers();
    try {
      const presentation = fixture(3);
      await driveToRoundEnd(presentation);
      const roundBefore = presentation.getSnapshot().roundNumber;
      const continueToNextRoundSpy = vi.spyOn(presentation, 'continueToNextRound');

      render(<SessionTable presentation={presentation} revealDurationMs={0} resultStageDelayMs={0} roundTransitionDurationMs={5000} />);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      fireEvent.click(screen.getByRole('button', { name: 'Next Round' }));
      fireEvent.click(screen.getByRole('button', { name: `Starting Round ${roundBefore + 1}` }));

      expect(continueToNextRoundSpy).toHaveBeenCalledOnce();
      expect(presentation.getSnapshot().roundNumber).toBe(roundBefore + 1);
      expect(screen.queryByRole('button', { name: `Starting Round ${roundBefore + 1}` })).toBeNull();

      // The now-cancelled timer must never also fire and continue a second time.
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      expect(continueToNextRoundSpy).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('showInitialTransition shows the same dim-and-label screen for Round 1\'s own very first start, pausing Turn advancement while it shows, without ever calling continueToNextRound (there is no prior Round to continue from)', async () => {
    vi.useFakeTimers();
    try {
      const presentation = fixture(1);
      const continueToNextRoundSpy = vi.spyOn(presentation, 'continueToNextRound');
      const pauseSpy = vi.spyOn(presentation, 'pause');
      const resumeSpy = vi.spyOn(presentation, 'resume');

      render(<SessionTable presentation={presentation} revealDurationMs={0} resultStageDelayMs={0} roundTransitionDurationMs={1000} showInitialTransition />);

      expect(screen.getByRole('button', { name: 'Starting Round 1' })).toBeTruthy();
      expect(pauseSpy).toHaveBeenCalledOnce();
      const dimmedWrapper = screen.getByRole('region', { name: 'Game Table' }).parentElement!;
      expect(dimmedWrapper.className).toContain('tableDimmed');

      await act(async () => { await vi.advanceTimersByTimeAsync(999); });
      expect(screen.getByRole('button', { name: 'Starting Round 1' })).toBeTruthy();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });

      expect(screen.queryByRole('button', { name: 'Starting Round 1' })).toBeNull();
      expect(dimmedWrapper.className).not.toContain('tableDimmed');
      expect(resumeSpy).toHaveBeenCalledOnce();
      // No prior Round Result to continue from - Round 1 was already dealt and live the moment this
      // component mounted; the transition here is purely presentational.
      expect(continueToNextRoundSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not show any Round-start transition on mount when showInitialTransition is left at its default (false) - every other SessionTable render in this suite, and App.tsx\'s own mid-Session re-renders, expect the table immediately interactive', () => {
    const presentation = fixture(1);
    render(<SessionTable presentation={presentation} revealDurationMs={0} resultStageDelayMs={0} />);
    expect(screen.queryByRole('button', { name: 'Starting Round 1' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Game Table' }).parentElement!.className).not.toContain('tableDimmed');
  });

  it("keeps a prior Round's own Event Log entries visible after transitioning into the next Round (person's own follow-up report: the log used to reset every Round, making an already-finished Round's history unreachable again)", async () => {
    const presentation = fixture(3);
    await driveToRoundEnd(presentation);
    const roundBefore = presentation.getSnapshot().roundNumber;

    render(<SessionTable presentation={presentation} revealDurationMs={0} resultStageDelayMs={0} roundTransitionDurationMs={0} />);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Next Round' }));
    await screen.findByText(`Basic · Round ${roundBefore + 1} of 5`);
    expect(presentation.getSnapshot().roundNumber).toBe(roundBefore + 1);

    fireEvent.click(screen.getByRole('button', { name: 'Event Log' }));
    expect(screen.getByText(`Round ${roundBefore} started.`)).toBeTruthy();
    expect(screen.getByText(`Round ${roundBefore + 1} started.`)).toBeTruthy();
  });

  // 45000ms (M4-T15/PR#92 acceptance fix): this test's own probe loop drives up to two full Rounds
  // twice over (once to find a seed with two consecutive bot 4th-place finishes, once again through the
  // mounted component) via `presentation.runTurn()`, which calls `GameRunner.runTurn()` -
  // `executeTurn(false)` submits straight to `submitResponse()` and never reaches
  // `commitWhenSubmissionAllowed()`/`yieldToMacrotask()`; that macrotask-boundary guard exists solely on
  // the `runAutoplayTurn()` path production's `driveTurns` uses (see GameRunner.ts), so this test crosses
  // no macrotask at all. The actual cost is ordinary CPU-bound work - AI candidate/decomposition search
  // plus Engine state transitions - repeated across many real Turns; under full-suite CPU contention the
  // single-threaded process simply gets fewer timeslices, so the same synchronous/microtask work takes
  // longer in wall-clock time. This file's three heaviest tests here had no explicit timeout at all and
  // were silently relying on Vitest's 5000ms default, which that contention alone can exceed even though
  // each test still passes 15/15 in an uncontended, isolated run. Reproduced directly under six
  // CPU-saturating background processes on this two-core sandbox: this test completed in ~11.6s worst
  // case across three repeated runs - deterministic, never hung. 45000ms reuses the same already-measured
  // bound applied to the sibling full-Session tests (a different, macrotask-bound cost - see
  // `session-summary.test.tsx`), keeping generous headroom without masking a genuine hang.
  it('never flashes a new Round\'s Result overlay open using the previous Round\'s own leftover settled phase before that new Round\'s own reveal actually runs (person\'s own follow-up report: "the previous result window pops for a second")', async () => {
    vi.useFakeTimers();
    try {
      // Needs two consecutive Rounds that each end with a bot 4th-place finish: Round 1 so its own
      // settle leaves `resultPhase` at 'result' behind it, Round 2 so it has its own reveal to show
      // first - the exact condition under which the bug flashed Round 2's own Result overlay open for
      // one render before correctly falling back to the reveal screen.
      let seedWithTwoBotFourths: number | null = null;
      for (let seed = 1; seed < 500; seed++) {
        const probe = fixture(seed);
        // eslint-disable-next-line no-await-in-loop
        await driveToRoundEnd(probe);
        const round1Reveal = probe.getSnapshot().reveal;
        if (!round1Reveal || round1Reveal.playerId === 'south') continue;
        probe.continueToNextRound();
        // eslint-disable-next-line no-await-in-loop
        await driveToRoundEnd(probe);
        const round2Reveal = probe.getSnapshot().reveal;
        if (round2Reveal && round2Reveal.playerId !== 'south') { seedWithTwoBotFourths = seed; break; }
      }
      if (seedWithTwoBotFourths === null) {
        throw new Error('No seed within range produced two consecutive bot 4th-place finishes - fixture drive logic likely broken.');
      }

      const presentation = fixture(seedWithTwoBotFourths);
      const { container } = render(
        <SessionTable presentation={presentation} revealDurationMs={500} resultStageDelayMs={0} roundTransitionDurationMs={0} />,
      );

      // A React passive effect (the old buggy reset lived in one) does not block the browser's next
      // paint - a wrong intermediate render genuinely reaches the screen for a moment even though a
      // React Testing Library `act()` call flushes the very next corrective render/effect pass before
      // returning, hiding the flash from a plain post-`act()` assertion. A MutationObserver instead sees
      // every individual DOM commit, the same way a person watching the real page would - matching this
      // codebase's own established convention of checking DOM/class state directly for something jsdom's
      // higher-level query helpers cannot otherwise observe.
      const dialogLabelsSeen: string[] = [];
      const observer = new MutationObserver(() => {
        const label = container.querySelector('[role="dialog"]')?.getAttribute('aria-label');
        if (label) dialogLabelsSeen.push(label);
      });
      observer.observe(container, { childList: true, subtree: true, attributes: true });

      // Drive and fully settle Round 1 through the mounted component, exactly as a person would, so
      // `resultPhase` is left at Round 1's own settled 'result' once Round 1 closes.
      let turns = 0;
      while (presentation.getSnapshot().status === 'ROUND_ACTIVE' && turns++ < 400) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => { await presentation.runTurn(); });
      }
      await act(async () => { await vi.advanceTimersByTimeAsync(500); });
      expect(screen.getByRole('dialog')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Next Round' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(presentation.getSnapshot().roundNumber).toBe(2);
      expect(screen.queryByRole('dialog')).toBeNull();
      dialogLabelsSeen.length = 0;

      // Drive Round 2 to its own finish, one Turn at a time, through the same mounted component.
      turns = 0;
      while (presentation.getSnapshot().status === 'ROUND_ACTIVE' && turns++ < 400) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => { await presentation.runTurn(); });
      }
      expect(presentation.getSnapshot().roundCheckpoint).not.toBeNull();

      // The regression itself: Round 2's own Result overlay ("Round 2 Result") must never have been
      // mounted at all yet - Round 2 has its own bot 4th-place reveal to show first, and no time has
      // passed (revealDurationMs is still pending) - not even for one transient render that a plain
      // post-`act()` DOM check would miss.
      expect(dialogLabelsSeen).not.toContain('Round 2 Result');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Skip reveal' })).toBeTruthy();

      await act(async () => { await vi.advanceTimersByTimeAsync(500); });
      expect(screen.getByRole('dialog')).toBeTruthy();
      observer.disconnect();
    } finally {
      vi.useRealTimers();
    }
  }, 45000);

  // 45000ms (M4-T15/PR#92 acceptance fix): this drives a full five-Round Session end to end via
  // `driveToRoundEnd`'s own `presentation.runTurn()` calls - the same non-macrotask, plain CPU-bound cost
  // (AI decomposition search + Engine transitions across many real Turns) documented above the first fix
  // in this file, not the `yieldToMacrotask` cost `session-summary.test.tsx`'s full-Session tests actually
  // cross (those go through the production autoplay path; this test does not). Same justification for the
  // bound (measured worst case under CPU contention, generous headroom, no masked hang), different cause.
  it('shows no continuation button once the Basic Session\'s own official result exists, and automatically replaces itself with Session Summary rather than continuing (ui-ux.md §12/§13 follow-up: M4-T13 UI refinement)', async () => {
    const presentation = fixture(5);
    for (let round = 1; round <= 5; round++) {
      await driveToRoundEnd(presentation);
      if (round < 5) presentation.continueToNextRound();
    }
    expect(presentation.getSnapshot().status).toBe('SESSION_COMPLETE');
    expect(presentation.getSnapshot().sessionResult).not.toBeNull();
    expect(presentation.getSnapshot().roundCheckpoint).not.toBeNull();

    const continueToNextRoundSpy = vi.spyOn(presentation, 'continueToNextRound');
    render(
      <SessionTable
        presentation={presentation}
        revealDurationMs={0}
        resultStageDelayMs={0}
        summaryAutoAdvanceDelayMs={0}
      />,
    );

    expect(await screen.findByRole('dialog', { name: 'Round 5 Result' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View Session Results' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next Round' })).toBeNull();

    // No click required - the settled overlay replaces itself with Session Summary on its own.
    expect(await screen.findByRole('dialog', { name: 'Session Summary' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Round 5 Result' })).toBeNull();
    expect(continueToNextRoundSpy).not.toHaveBeenCalled();
  }, 45000);
});

async function seedWithBotFourthPlace(): Promise<number> {
  for (let seed = 1; seed < 500; seed++) {
    const presentation = fixture(seed);
    await driveToRoundEnd(presentation);
    const reveal = presentation.getSnapshot().reveal;
    if (reveal && reveal.playerId !== 'south') return seed;
  }
  throw new Error('No seed within range produced a bot 4th-place finish.');
}

describe('Reveal and result isolation, and presentation timers under blocked layout (review fixes)', () => {
  it('stops table interaction during the 4th-hand reveal without dimming it, then dims it once the Round Result opens', async () => {
    const presentation = await fixtureWithBotFourthPlace();
    render(<SessionTable presentation={presentation} revealDurationMs={20_000} resultStageDelayMs={0} />);
    const playContent = screen.getByRole('region', { name: 'Game Table' }).parentElement!;
    expect(playContent.hasAttribute('inert')).toBe(true);
    // Revealed cards must stay fully visible, so no dimming filter during the reveal itself.
    expect(playContent.className).not.toContain('tableDimmed');

    fireEvent.click(screen.getByRole('button', { name: 'Skip reveal' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(playContent.hasAttribute('inert')).toBe(true);
    expect(playContent.className).toContain('tableDimmed');
  });

  // 45000ms (M4-T15/PR#92 acceptance fix): drives one full Round one Turn at a time via
  // `presentation.runTurn()` - the same non-macrotask, plain CPU-bound cost documented above the first fix
  // in this file (not `yieldToMacrotask`, which this call path never reaches). Same justification, same
  // value.
  it('keeps a Round Result that opens behind an Event Log from receiving input, so Next Round cannot start the next Round beneath it (reviewer repro)', async () => {
    const presentation = fixture(await seedWithBotFourthPlace());
    render(<SessionTable presentation={presentation} revealDurationMs={0} resultStageDelayMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Event Log' }));
    expect(screen.getByRole('dialog', { name: 'Event Log' })).toBeTruthy();

    // The Round finishes while the Event Log is open (e.g. a Turn that was already in flight when it opened).
    // One act() per Turn: a whole Round of published snapshots inside a single act() exceeds React's nested-update cap.
    for (let turns = 0; presentation.getSnapshot().status === 'ROUND_ACTIVE' && turns < 400; turns++) {
      await act(async () => { await presentation.runTurn(); });
    }
    const result = await screen.findByRole('dialog', { name: 'Round 1 Result' });
    expect(result.closest('[inert]')).not.toBeNull();
    expect(screen.getByRole('dialog', { name: 'Event Log' }).closest('[inert]')).toBeNull();

    // `fireEvent` ignores `inert`, standing in for any activation that still reaches the handler.
    fireEvent.click(screen.getByRole('button', { name: 'Next Round' }));
    expect(presentation.getSnapshot().roundNumber).toBe(1);
    expect(presentation.getSnapshot().status).toBe('ROUND_RESULT');

    fireEvent.click(screen.getByRole('button', { name: 'Close Event Log' }));
    expect(screen.getByRole('dialog', { name: 'Round 1 Result' }).closest('[inert]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next Round' }));
    expect(presentation.getSnapshot().roundNumber).toBe(2);
  }, 45000);

  it('freezes the reveal timer while presentationPaused, then finishes the interrupted reveal once it clears', async () => {
    vi.useFakeTimers();
    try {
      const presentation = await fixtureWithBotFourthPlace();
      const { rerender } = render(<SessionTable presentation={presentation} revealDurationMs={1000} resultStageDelayMs={0} presentationPaused />);
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(screen.getByRole('button', { name: 'Skip reveal' })).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();

      rerender(<SessionTable presentation={presentation} revealDurationMs={1000} resultStageDelayMs={0} presentationPaused={false} />);
      await act(async () => { await vi.advanceTimersByTimeAsync(999); });
      expect(screen.queryByRole('dialog')).toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(screen.getByRole('dialog')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('freezes the Round-start transition timer while presentationPaused, and keeps that screen up until it clears', async () => {
    vi.useFakeTimers();
    try {
      const presentation = fixture(3);
      const { rerender } = render(<SessionTable presentation={presentation} showInitialTransition roundTransitionDurationMs={1000} presentationPaused />);
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(screen.getByRole('button', { name: 'Starting Round 1' })).toBeTruthy();

      rerender(<SessionTable presentation={presentation} showInitialTransition roundTransitionDurationMs={1000} presentationPaused={false} />);
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(screen.queryByRole('button', { name: 'Starting Round 1' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionConfiguration, startSession } from '../../../src/application/startSession';
import type { StartedSession } from '../../../src/application/startSession';
import { SessionPresentation } from '../../../src/application/SessionPresentation';
import { createSession, defaultRuleset, getPublicView, startRound } from '../../../src/engine';
import type { Move } from '../../../src/domain';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerController, PlayerTurnRequest } from '../../../src/orchestrator';
import { App, SessionTable } from '../../../src/ui/App';

const AUTOPLAY_IDS = ['south', 'west', 'north', 'east'];

/** A fully-automatic `StartedSession` (every seat, including South, resolves its own Turn the same way
 *  a bot does - `session-summary.test.tsx`'s own `buildAutomaticSession` proved this out first) so a
 *  whole five-Round Session can be driven end-to-end through `<App>` itself without a human UI to click
 *  through - used below to reach `sessionResult !== null` for the unload-warning follow-up test. */
function buildAutomaticSession(seed: number): StartedSession {
  let state = seed;
  const engineRng = { next: () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; } };
  const created = createSession(AUTOPLAY_IDS);
  const started = startRound(created.state, engineRng);
  const preferPlay = (request: PlayerTurnRequest): Move =>
    request.legalMoves.find((move) => move.kind === 'play') ?? request.legalMoves.find((move) => move.kind === 'pass')!;
  const controllers = AUTOPLAY_IDS.map((playerId) => ({ playerId, chooseMove: async (request: PlayerTurnRequest) => preferPlay(request) }));
  return {
    runner: new GameRunner(started.state, defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])), true),
    humanController: controllers[0]!, engineRng, initialView: getPublicView(started.state),
    startupEvents: [...created.events, ...started.events], names: { south: 'You', west: 'Ana', north: 'Bo', east: 'Cy' },
  };
}

/** Waits for, and clicks through, every Round Result overlay in turn until Session Summary itself
 *  appears - `session-summary.test.tsx`'s own `clickThroughRoundResult` proved this exact polling
 *  approach out first (Rounds 1-4 need an explicit click; Round 5 replaces itself with Session Summary
 *  entirely on its own, with no button of its own to click). */
async function driveToSessionSummary(): Promise<void> {
  for (let guard = 0; guard < 5; guard++) {
    const outcome = await waitFor(() => {
      const nextRoundButton = screen.queryByRole('button', { name: 'Next Round' });
      if (nextRoundButton) return { kind: 'more' as const, button: nextRoundButton };
      const summary = screen.queryByRole('dialog', { name: 'Session Summary' });
      if (summary) return { kind: 'done' as const };
      throw new Error('Neither the Next Round button nor Session Summary has appeared yet.');
    }, { timeout: 10000 });
    if (outcome.kind === 'done') return;
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { fireEvent.click(outcome.button); });
  }
  throw new Error('Session Summary was not reached within the expected number of Rounds.');
}

afterEach(cleanup);

/** Simulates a browser resize/orientation change for `useLayoutSupport` (M4-T11): jsdom's own default
 *  window is 1024x768 (the T04 matrix's `tablet-landscape` entry - comfortably supported), so every
 *  other test file's rendering is unaffected; only tests that call this exercise the guard. */
function resizeWindowTo(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

afterEach(() => resizeWindowTo(1024, 768));

/** Simulates a touch/coarse-pointer device (a phone or tablet) for `useLayoutSupport`'s pointer-based
 *  rotate-vs-resize guidance (M4-T11 follow-up): jsdom has no `window.matchMedia` at all by default,
 *  which the hook already treats as a fine-pointer/desktop device, so every other test exercises that
 *  default without needing this. Restored (deleted) after every test so it never leaks between them. */
function mockCoarsePointer() {
  window.matchMedia = ((query: string) => ({
    matches: query === '(pointer: coarse)',
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

afterEach(() => {
  // @ts-expect-error - deleting back to jsdom's own default (no matchMedia at all).
  delete window.matchMedia;
});

describe('Home and immediate Session startup', () => {
  it('subscribes the table to safe production snapshots across Round continuation', async () => {
    const session = startSession<PlayerController>(createSessionConfiguration(), {
      engineRng: { next: () => 0 }, humanController: { playerId: 'south', chooseMove: async (request) => request.legalMoves[0]! },
    });
    const presentation = new SessionPresentation(session);
    const { unmount } = render(<StrictMode><SessionTable presentation={presentation} /></StrictMode>);
    expect(screen.getByText('Basic · Round 1 of 5')).toBeTruthy();
    await act(async () => {
      let turns = 0;
      while (presentation.getSnapshot().status === 'ROUND_ACTIVE' && turns++ < 400) await presentation.runTurn();
      expect(presentation.getSnapshot().status).toBe('ROUND_RESULT');
      presentation.continueToNextRound();
    });
    expect(screen.getByText('Basic · Round 2 of 5')).toBeTruthy();
    unmount();
  });

  it('shows only Start Game on Home and does not start during StrictMode mounting', () => {
    const start = vi.fn();
    render(<StrictMode><App start={start} /></StrictMode>);
    expect(screen.getByRole('heading', { name: 'Pusoy Dos' })).toBeTruthy();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Start Game']);
    expect(start).not.toHaveBeenCalled();
  });

  it('opens a production Session table directly and ignores rapid activation before rerender', async () => {
    const start = vi.fn((configuration) => startSession(configuration, { engineRng: { next: () => 0 } }));
    render(<StrictMode><App start={start} /></StrictMode>);
    const button = screen.getByRole('button', { name: 'Start Game' });
    act(() => {
      button.click();
      button.click();
    });
    expect(await screen.findByRole('region', { name: 'Game Table' })).toBeTruthy();
    expect(screen.getByText('Basic · Round 1 of 5')).toBeTruthy();
    expect(start).toHaveBeenCalledExactlyOnceWith({ mode: 'basic', botNames: ['West', 'North', 'East'] });
    for (const name of ['You', 'West', 'North', 'East']) {
      expect(screen.getByRole('region', { name: `${name} panel` })).toBeTruthy();
    }
    // Round 1 gets the same brief dim-and-label transition as every later Round (person's own follow-up
    // report on top of M4-T12); skip it here via its own click/tap-to-skip control (same convention as
    // the reveal's own skip) so the table underneath is actually interactive for the assertion below,
    // rather than waiting out the real production `ROUND_TRANSITION_DURATION_MS`.
    fireEvent.click(screen.getByRole('button', { name: 'Starting Round 1' }));
    expect(screen.queryByRole('button', { name: 'Starting Round 1' })).toBeNull();
    // "Check Discard Pile" (M4-T10 follow-up), not bare "Discard Pile" - the person's own follow-up
    // report that the noun phrase alone read as if clicking it would discard the player's own cards. It
    // now sits in the bottom bar's left container between Event Log and Leave Game (M4-T14).
    expect(screen.getAllByRole('button').map((button) => button.textContent))
      .toEqual(['Event Log', 'Check Discard Pile', 'Leave Game', 'Sort Rank', 'Sort Suit', 'Play', 'Pass']);
  });

  it('guards pending asynchronous startup and samples names only once', async () => {
    let resolve!: (session: StartedSession) => void;
    const start = vi.fn(() => new Promise<StartedSession>((done) => { resolve = done; }));
    const botNames = vi.fn(() => ['One', 'Two', 'Three'] as const);
    render(<App start={start} botNames={botNames} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    const pending = screen.getByRole('button', { name: 'Starting…' });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(pending);
    await act(async () => { resolve(startSession({ mode: 'basic', botNames: ['One', 'Two', 'Three'] }, { engineRng: { next: () => 0 } })); });
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ mode: 'basic', botNames: ['One', 'Two', 'Three'] });
    expect(botNames).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Game Table' })).toBeTruthy();
  });

  it('starts with the browser composition and default name provider', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    expect(await screen.findByRole('region', { name: 'Game Table' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['throw', 'reject'])('surfaces a startup %s and permits an explicit retry', async (failure) => {
    const session = startSession(createSessionConfiguration(), { engineRng: { next: () => 0 } });
    const start = vi.fn<() => StartedSession | Promise<StartedSession>>()
      .mockImplementationOnce(() => {
        if (failure === 'throw') throw new Error('Startup failed');
        return Promise.reject(new Error('Startup failed'));
      }).mockReturnValue(session);
    render(<App start={start} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Startup failed');
    expect(screen.queryByRole('region', { name: 'Game Table' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    expect(await screen.findByRole('region', { name: 'Game Table' })).toBeTruthy();
    expect(start).toHaveBeenCalledTimes(2);
  });
});

describe('Portrait/undersized layout guidance (M4-T11; ui-ux.md §14)', () => {
  it('replaces Home with rotate guidance in a portrait viewport on a touch device, and with resize guidance in an undersized landscape viewport', () => {
    mockCoarsePointer(); // a phone/tablet - the only kind of device that can actually be rotated
    render(<App />);
    expect(screen.getByRole('button', { name: 'Start Game' })).toBeTruthy();

    // Portrait: matches the T04 matrix's own `portrait-unsupported` entry (390x844).
    act(() => resizeWindowTo(390, 844));
    expect(screen.getByText('Rotate your device to continue')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start Game' })).toBeNull();

    // Back to a supported size restores Home.
    act(() => resizeWindowTo(1024, 768));
    expect(screen.getByRole('button', { name: 'Start Game' })).toBeTruthy();

    // Undersized landscape: matches the T04 matrix's own `undersized-landscape` entry (560x320).
    act(() => resizeWindowTo(560, 320));
    expect(screen.getByText(/resize/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start Game' })).toBeNull();
  });

  it('shows resize guidance, not rotate, for a portrait-shaped window on a fine-pointer (mouse/trackpad) desktop device (M4-T11 follow-up)', () => {
    // No mockCoarsePointer() here: jsdom's default (no matchMedia at all) is already treated as a
    // fine-pointer/desktop device - the person cannot physically rotate a desktop monitor, so asking
    // them to would be an impossible instruction.
    render(<App />);
    act(() => resizeWindowTo(390, 844)); // same portrait-shaped dimensions as the touch-device test above
    expect(screen.getByText('Resize your window to continue')).toBeTruthy();
    expect(screen.queryByText('Rotate your device to continue')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start Game' })).toBeNull();
  });

  it('preserves a live Session across an unsupported-layout interruption and shows it again once supported', async () => {
    mockCoarsePointer(); // simulates an actual phone being rotated, matching this test's own intent
    const start = vi.fn((configuration) => startSession(configuration, { engineRng: { next: () => 0 } }));
    render(<App start={start} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    expect(await screen.findByRole('region', { name: 'Game Table' })).toBeTruthy();
    expect(screen.getByText('Basic · Round 1 of 5')).toBeTruthy();

    act(() => resizeWindowTo(390, 844));
    expect(screen.getByText('Rotate your device to continue')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Game Table' })).toBeNull();

    act(() => resizeWindowTo(1024, 768));
    expect(await screen.findByRole('region', { name: 'Game Table' })).toBeTruthy();
    // Still the same Round of the same Session, not a fresh restart.
    expect(screen.getByText('Basic · Round 1 of 5')).toBeTruthy();
  });

  it('keeps the hand arrangement, selection, open overlay and started-Round state across an unsupported-layout interruption (review fix)', async () => {
    mockCoarsePointer();
    // A seeded LCG rather than `next: () => 0`: that constant deals an already fully sorted hand, which
    // would make the Sort buttons below indistinguishable from a fresh mount.
    let seed = 26;
    const engineRng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
    const start = vi.fn((configuration) => startSession(configuration, { engineRng }));
    render(<App start={start} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    await screen.findByRole('region', { name: 'Game Table' });
    fireEvent.click(screen.getByRole('button', { name: 'Starting Round 1' }));

    const handKeys = () => Array.from(document.querySelectorAll('[data-card-key]')).map((slot) => slot.getAttribute('data-card-key'));
    const selectedKeys = () => Array.from(document.querySelectorAll('[data-card-key][data-selected="true"]')).map((slot) => slot.getAttribute('data-card-key'));
    const dealt = handKeys();
    // Sort by suit and by rank: whichever differs from the dealt order proves a real, non-default arrangement.
    fireEvent.click(screen.getByRole('button', { name: 'Sort Suit' }));
    const suitSorted = handKeys();
    fireEvent.click(screen.getByRole('button', { name: 'Sort Rank' }));
    const rankSorted = handKeys();
    expect(rankSorted).not.toEqual(suitSorted);
    fireEvent.click(screen.getByRole('button', { name: 'Sort Suit' }));
    expect(handKeys()).toEqual(suitSorted);
    expect(suitSorted.length).toBe(dealt.length);

    fireEvent.click(document.querySelectorAll('[data-card-key]')[2]!);
    const selectionBefore = selectedKeys();
    expect(selectionBefore).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Event Log' }));
    expect(screen.getByRole('dialog', { name: 'Event Log' })).toBeTruthy();

    act(() => resizeWindowTo(390, 844));
    expect(screen.getByText('Rotate your device to continue')).toBeTruthy();
    // Nothing of the table (including the open Event Log) is reachable behind the notice, and Escape
    // does not close an overlay the person cannot currently see.
    expect(screen.queryByRole('region', { name: 'Game Table' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Event Log' })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });

    act(() => resizeWindowTo(1024, 768));
    expect(screen.getByRole('region', { name: 'Game Table' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Event Log' })).toBeTruthy();
    expect(handKeys()).toEqual(suitSorted);
    expect(selectedKeys()).toEqual(selectionBefore);
    // Not a fresh mount: the Round-start transition is not replayed.
    expect(screen.queryByRole('button', { name: 'Starting Round 1' })).toBeNull();
  });

  it('freezes the Round Result scoring animation while the layout is unsupported and resumes the interrupted stage afterwards (review fix)', async () => {
    vi.useFakeTimers();
    try {
      const start = vi.fn(() => buildAutomaticSession(5));
      render(<App start={start} botTurnDelayMs={1} revealDurationMs={0} roundTransitionDurationMs={0} resultStageDelayMs={100_000} />);
      fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
      let guard = 0;
      while (!screen.queryByRole('dialog', { name: 'Round 1 Result' }) && guard++ < 200) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => { await vi.advanceTimersByTimeAsync(50); });
      }
      const roundPoints = () => within(screen.getByRole('dialog', { name: 'Round 1 Result' })).getAllByRole('row').slice(1)
        .map((row) => within(row).getAllByRole('cell')[2]!.textContent);
      // First stage: nothing scored yet.
      expect(roundPoints()).toEqual(['—', '—', '—', '—']);

      act(() => resizeWindowTo(560, 320));
      expect(screen.getByText(/resize/i)).toBeTruthy();
      // Far longer than every remaining stage delay put together: unpaused, the whole sequence would finish here.
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000_000); });
      act(() => resizeWindowTo(1024, 768));
      expect(roundPoints()).toEqual(['—', '—', '—', '—']);

      // Still runs to completion afterwards, one full stage delay at a time.
      await act(async () => { await vi.advanceTimersByTimeAsync(100_000); });
      expect(roundPoints().every((points) => points !== '—')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the table inert behind an unsupported-layout notice and the notice itself visible', async () => {
    const start = vi.fn((configuration) => startSession(configuration, { engineRng: { next: () => 0 } }));
    render(<App start={start} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    const table = await screen.findByRole('region', { name: 'Game Table' });
    fireEvent.click(screen.getByRole('button', { name: 'Starting Round 1' }));
    expect(table.closest('[inert]')).toBeNull();
    act(() => resizeWindowTo(560, 320));
    expect(screen.getByText(/resize/i)).toBeTruthy();
    // `hidden: true` because a hidden subtree is (correctly) excluded from the accessible role queries.
    expect(screen.getByRole('region', { name: 'Game Table', hidden: true }).closest('[inert]')).not.toBeNull();
    expect(screen.getByRole('region', { name: 'Game Table', hidden: true }).closest('[hidden]')).not.toBeNull();
    expect(screen.getByText(/resize/i).closest('[inert], [hidden]')).toBeNull();
    act(() => resizeWindowTo(1024, 768));
    expect(table.closest('[inert]')).toBeNull();
    expect(table.closest('[hidden]')).toBeNull();
  });

  it('pauses automatic Turn advancement while the layout is unsupported, and resumes it once supported again', async () => {
    const pauseSpy = vi.spyOn(SessionPresentation.prototype, 'pause');
    const resumeSpy = vi.spyOn(SessionPresentation.prototype, 'resume');
    const start = vi.fn((configuration) => startSession(configuration, { engineRng: { next: () => 0 } }));
    render(<App start={start} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    await screen.findByRole('region', { name: 'Game Table' });
    const pauseCallsBeforeResize = pauseSpy.mock.calls.length;
    const resumeCallsBeforeResize = resumeSpy.mock.calls.length;

    act(() => resizeWindowTo(390, 844));
    expect(pauseSpy.mock.calls.length).toBeGreaterThan(pauseCallsBeforeResize);

    act(() => resizeWindowTo(1024, 768));
    expect(resumeSpy.mock.calls.length).toBeGreaterThan(resumeCallsBeforeResize);

    pauseSpy.mockRestore();
    resumeSpy.mockRestore();
  });

  it('does not pause anything on Home, where there is no Session yet', () => {
    const pauseSpy = vi.spyOn(SessionPresentation.prototype, 'pause');
    render(<App />);
    act(() => resizeWindowTo(390, 844));
    expect(pauseSpy).not.toHaveBeenCalled();
    pauseSpy.mockRestore();
  });
});

describe('Best-effort browser unload warning (M4-T11; ui-ux.md §10)', () => {
  it('warns before unload while a Session is active, and does not before one has started', async () => {
    const start = vi.fn((configuration) => startSession(configuration, { engineRng: { next: () => 0 } }));
    render(<App start={start} />);

    const beforeStart = new Event('beforeunload', { cancelable: true });
    expect(window.dispatchEvent(beforeStart)).toBe(true); // not prevented: nothing to lose yet

    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    await screen.findByRole('region', { name: 'Game Table' });

    const duringSession = new Event('beforeunload', { cancelable: true });
    expect(window.dispatchEvent(duringSession)).toBe(false); // prevented: unfinished Session progress
  });

  it('stops warning once the Session\'s own official result exists (M4-T13 UI refinement follow-up: no more unload warning once Session Summary is reachable)', async () => {
    const start = vi.fn(() => buildAutomaticSession(5));
    render(<App start={start} botTurnDelayMs={1} revealDurationMs={0} resultStageDelayMs={0} roundTransitionDurationMs={0} summaryAutoAdvanceDelayMs={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    await screen.findByRole('region', { name: 'Game Table' });

    // Retried rather than a single immediate dispatch (M4-T15 stabilization round): the Game Table
    // region and the `beforeunload` listener's own attachment (App.tsx's `[session, sessionResult]`
    // effect) commit together in the same render in every case this was traced, but nothing about
    // `findByRole` itself is a documented guarantee that a *different* effect off the same commit has
    // already flushed - only that this particular query has stopped throwing. `waitFor` keeps the exact
    // same final expectation (still strictly `false`); it only tolerates a startup instant where that
    // has not yet landed, by dispatching a fresh Event each retry.
    await waitFor(() => {
      const duringSession = new Event('beforeunload', { cancelable: true });
      expect(window.dispatchEvent(duringSession)).toBe(false); // still prevented: Round 1 in progress
    });

    await driveToSessionSummary();

    const afterSummary = new Event('beforeunload', { cancelable: true });
    expect(window.dispatchEvent(afterSummary)).toBe(true); // no longer prevented: nothing left to lose
    // 45000ms (M4-T15 stabilization round): `driveToSessionSummary` drives a real, fully-automatic
    // five-Round Session end to end - the same inherent per-Turn cost `session-summary.test.tsx`'s own
    // two full-Session tests document and measure (their own comment has the full reasoning and the
    // measured worst case under synthetic full-suite-level CPU contention). Same justification, same value.
  }, 45000);
});

describe('Leave Game abandons the Session (M4-T11 follow-up)', () => {
  it('destroys the underlying SessionPresentation and returns to Home once Leave is confirmed', async () => {
    const destroySpy = vi.spyOn(SessionPresentation.prototype, 'destroy');
    const start = vi.fn((configuration) => startSession(configuration, { engineRng: { next: () => 0 } }));
    render(<App start={start} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    await screen.findByRole('region', { name: 'Game Table' });

    fireEvent.click(screen.getByRole('button', { name: 'Leave Game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Leave Game' }));

    expect(destroySpy).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Start Game' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Game Table' })).toBeNull();

    destroySpy.mockRestore();
  });
});

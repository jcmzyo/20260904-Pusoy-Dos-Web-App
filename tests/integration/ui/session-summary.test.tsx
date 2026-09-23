// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Move } from '../../../src/domain';
import type { StartedSession } from '../../../src/application/startSession';
import { createSession, defaultRuleset, getPublicView, startRound } from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';
import { App } from '../../../src/ui/App';

afterEach(cleanup);

const ids = ['south', 'west', 'north', 'east'];

/**
 * Builds a fully-automatic `StartedSession` - every seat, including South, resolves its own Turn via
 * the same production `GameRunner`/`PlayerController` contract a bot uses, preferring any legal Play
 * over a Pass so a Session actually finishes within a bounded number of Turns (the identical technique
 * `session-table-round-result.test.tsx`'s own `fixture()` already proved out for driving a real Round to
 * completion without a human UI to click through). Used here, through `<App>`'s own injectable `start`
 * prop, so a whole five-Round Session can be driven end-to-end at the `<App>` level itself - the level
 * Session Summary/Play Again/Home actually live at (M4-T13) - deterministically and without waiting out
 * any real bot/animation pacing (paired with a minimal `botTurnDelayMs={1}` and `revealDurationMs`/
 * `resultStageDelayMs`/`roundTransitionDurationMs={0}` below). `botTurnDelayMs` is kept at `1` rather
 * than `0`: `driveTurns` (`SessionPresentation.ts`) intentionally never waits before a bot-turn-delay
 * for the seat that happens to equal `humanController.playerId` (South here, though this fixture's own
 * South is an auto-player, not a real blocking human) - at `0`, every seat's Turn (all four, every Trick,
 * across the whole Session) publishes a fresh snapshot with no macrotask yield between any of them,
 * which starves React of any chance to actually flush a commit in between and trips its own nested-
 * update safety limit ("Maximum update depth exceeded"). A minimal real delay restores a macrotask
 * boundary between West/North/East's own Turns (every South Turn still sits between at least one such
 * boundary), which is enough for React to flush normally while remaining effectively instant in test time.
 */
function buildAutomaticSession(seed: number): StartedSession {
  let state = seed;
  const engineRng = { next: () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; } };
  const created = createSession(ids);
  const started = startRound(created.state, engineRng);
  const preferPlay = (request: PlayerTurnRequest): Move =>
    request.legalMoves.find((move) => move.kind === 'play') ?? request.legalMoves.find((move) => move.kind === 'pass')!;
  const controllers = ids.map((playerId) => ({ playerId, chooseMove: async (request: PlayerTurnRequest) => preferPlay(request) }));
  return {
    runner: new GameRunner(started.state, defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])), true),
    humanController: controllers[0]!, engineRng, initialView: getPublicView(started.state),
    startupEvents: [...created.events, ...started.events], names: { south: 'You', west: 'Ana', north: 'Bo', east: 'Cy' },
  };
}

/** Drives the mounted `<App>` through every screen between a live Round and the next: the (near-instant,
 *  `revealDurationMs`/`resultStageDelayMs`/`roundTransitionDurationMs` all `0`) 4th-place reveal, Round
 *  Result overlay, and round-start transition all resolve on their own. Rounds 1-4 still require an
 *  explicit "Next Round" click; Round 5 no longer shows any continuation button at all (ui-ux.md §12
 *  follow-up, M4-T13 UI refinement) - once its own scoring animation settles, it replaces itself with
 *  Session Summary on its own after `summaryAutoAdvanceDelayMs` (kept at `0` below for test speed). This
 *  helper first WAITS (real Turns take real, if minimal, async time to resolve - `botTurnDelayMs={1}`
 *  above) for either the next Round's "Next Round" button or the Session Summary dialog to actually
 *  appear, rather than checking synchronously, then clicks the button when there is one. */
async function clickThroughRoundResult(): Promise<'more' | 'done'> {
  const outcome = await waitFor(() => {
    const nextRoundButton = screen.queryByRole('button', { name: 'Next Round' });
    if (nextRoundButton) return { kind: 'more' as const, button: nextRoundButton };
    const summary = screen.queryByRole('dialog', { name: 'Session Summary' });
    if (summary) return { kind: 'done' as const };
    throw new Error('Neither the Next Round button nor Session Summary has appeared yet.');
  }, { timeout: 10000 });
  if (outcome.kind === 'more') {
    await act(async () => { fireEvent.click(outcome.button); });
    return 'more';
  }
  return 'done';
}

describe('Session Summary reachable and actionable from <App> (M4-T13; ui-ux.md §3/§13)', () => {
  it('reaches Session Summary after Round 5, and Play Again starts a genuinely fresh Session through the same startup boundary as Home\'s own Start Game', async () => {
    // Driving a real, fully-automatic five-Round Session through <App> (many Turns across five Tricks
    // per Round) genuinely takes longer than Vitest's 5000ms default test timeout; the sub-`findByRole`
    // calls below already have their own generous 10000ms timeout, so the test itself needs at least as
    // much room to let them actually resolve rather than being aborted first by the outer test timeout.
    // 45000ms (M4-T15 stabilization round): every autoplay Turn crosses one genuinely real, deliberately
    // un-fake-timer-mockable macrotask (`GameRunner`'s own `yieldToMacrotask`, orchestrator.md's own
    // approved lifecycle guard) - across the many Turns a five-Round Session needs, that real per-Turn
    // cost is bounded but stretches under CPU contention from a full parallel test run. Reproduced
    // directly: under six CPU-saturating background processes on this two-core sandbox (a synthetic load
    // well beyond anything a real full-suite run creates, since that run itself only ever spawns about
    // one worker per core), this exact test still completed - deterministically, never hung - in ~35s;
    // 45000ms keeps meaningful headroom above that measured worst case without masking a genuine hang.
    const start = vi.fn()
      .mockImplementationOnce(() => buildAutomaticSession(5))
      .mockImplementationOnce(() => buildAutomaticSession(11));
    render(
      <App
        start={start} botTurnDelayMs={1} revealDurationMs={0} resultStageDelayMs={0}
        roundTransitionDurationMs={0} summaryAutoAdvanceDelayMs={0}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    expect(await screen.findByRole('region', { name: 'Game Table' })).toBeTruthy();

    for (let round = 1; round <= 5; round++) {
      // eslint-disable-next-line no-await-in-loop
      const outcome = await clickThroughRoundResult();
      expect(outcome).toBe(round === 5 ? 'done' : 'more');
    }

    expect(await screen.findByRole('dialog', { name: 'Session Summary' })).toBeTruthy();
    // Session Summary replaces the Round Result overlay in place, over the same dimmed Game Table
    // (ui-ux.md §13 follow-up, M4-T13 UI refinement) - it is not a separate full screen, so the table
    // itself is still in the DOM underneath, merely inert while the overlay is open.
    expect(screen.getByRole('region', { name: 'Game Table' })).toBeTruthy();
    expect(start).toHaveBeenCalledOnce();

    // Play Again: a second, independent Session through the identical `start` boundary Home's own Start
    // Game uses - never a reset/replay of the just-finished one.
    fireEvent.click(screen.getByRole('button', { name: 'Play Again' }));
    expect(await screen.findByRole('region', { name: 'Game Table' })).toBeTruthy();
    expect(screen.getByText('Basic · Round 1 of 5')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Session Summary' })).toBeNull();
    expect(start).toHaveBeenCalledTimes(2);
  }, 45000);

  it('Home returns Session Summary to the Home screen, abandoning the finished Session', async () => {
    const start = vi.fn(() => buildAutomaticSession(5));
    render(
      <App
        start={start} botTurnDelayMs={1} revealDurationMs={0} resultStageDelayMs={0}
        roundTransitionDurationMs={0} summaryAutoAdvanceDelayMs={0}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    await screen.findByRole('region', { name: 'Game Table' });
    for (let round = 1; round <= 5; round++) {
      // eslint-disable-next-line no-await-in-loop
      await clickThroughRoundResult();
    }
    await screen.findByRole('dialog', { name: 'Session Summary' });

    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: 'Start Game' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Session Summary' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Game Table' })).toBeNull();
    expect(start).toHaveBeenCalledOnce();
  }, 45000);
});

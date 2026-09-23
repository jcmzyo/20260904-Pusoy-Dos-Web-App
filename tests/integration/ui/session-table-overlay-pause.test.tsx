// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Move } from '../../../src/domain';
import { SessionPresentation } from '../../../src/application/SessionPresentation';
import type { StartedSession } from '../../../src/application/startSession';
import { createSession, defaultRuleset, getPublicView, startRound } from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';
import { SessionTable } from '../../../src/ui/App';

/**
 * End-to-end proof that opening/closing the Discard Pile and Event Log overlays from the real rendered
 * table actually pauses/resumes the production `SessionPresentation`'s own automatic Turn-advancement
 * loop (M4-T10; ui-ux.md §9.2: "While either overlay is open, Orchestrator progression is paused ...
 * Closing resumes from the same execution point") - not a UI state replica standing in for it. Every
 * seat (including South) always picks its own first legal Move, so the Session advances continuously
 * once `startAutoPlay` is running, making "did it actually stop/continue" directly observable via the
 * public snapshot's own event count.
 */

const ids = ['south', 'west', 'north', 'east'];

function fixture() {
  let seed = 3;
  const engineRng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
  const created = createSession(ids);
  const started = startRound(created.state, engineRng);
  const controllers = ids.map((playerId) => ({ playerId, chooseMove: async (request: PlayerTurnRequest): Promise<Move> => request.legalMoves[0]! }));
  const session: StartedSession = {
    runner: new GameRunner(started.state, defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])), true),
    humanController: controllers[0]!, engineRng, initialView: getPublicView(started.state),
    startupEvents: [...created.events], names: { south: 'You', west: 'Ana', north: 'Bo', east: 'Cy' },
  };
  return new SessionPresentation(session);
}

afterEach(cleanup);

describe('Discard Pile / Event Log overlays pause and resume real Turn advancement (M4-T10)', () => {
  it('Discard Pile: pauses progression while open and resumes it from the same point once closed', async () => {
    const presentation = fixture();
    render(<SessionTable presentation={presentation} />);
    // Starts autoplay and opens the overlay back-to-back, synchronously, before any microtask lets the
    // 0ms-delay driveTurns loop actually run a Turn - `fireEvent.click` (like `act`) flushes the
    // resulting `useEffect` synchronously, so `presentation.pause()` is guaranteed to land before that
    // loop's own first pending await resolves. This sidesteps racing a real 0ms-delay loop, which could
    // otherwise finish advancing arbitrarily far (even a full Round) before any `waitFor` next polls.
    act(() => { presentation.startAutoPlay(0); });
    fireEvent.click(screen.getByRole('button', { name: 'Check Discard Pile' }));
    expect(presentation.isPaused()).toBe(true);
    const pausedSnapshot = presentation.getSnapshot();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(presentation.getSnapshot()).toBe(pausedSnapshot);

    fireEvent.click(screen.getByRole('button', { name: 'Close Discard Pile' }));
    expect(presentation.isPaused()).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(presentation.getSnapshot()).not.toBe(pausedSnapshot));
  });

  it('Event Log: pauses progression while open and resumes it from the same point once closed', async () => {
    const presentation = fixture();
    render(<SessionTable presentation={presentation} />);
    // See the Discard Pile case above for why this is synchronous rather than awaiting any prior progress.
    act(() => { presentation.startAutoPlay(0); });
    fireEvent.click(screen.getByRole('button', { name: 'Event Log' }));
    expect(presentation.isPaused()).toBe(true);
    const pausedSnapshot = presentation.getSnapshot();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(presentation.getSnapshot()).toBe(pausedSnapshot);

    fireEvent.click(screen.getByRole('button', { name: 'Close Event Log' }));
    expect(presentation.isPaused()).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(presentation.getSnapshot()).not.toBe(pausedSnapshot));
  });
});

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
 * End-to-end proof, mirroring `session-table-overlay-pause.test.tsx` (M4-T10), that opening/closing the
 * Leave Game confirmation from the real rendered table actually pauses/resumes the production
 * `SessionPresentation`'s own automatic Turn-advancement loop (M4-T11; ui-ux.md §10: "The confirmation
 * pauses progression") - not a UI state replica standing in for it.
 */

const ids = ['south', 'west', 'north', 'east'];

function fixture() {
  let seed = 11;
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

describe('Leave Game confirmation pauses and resumes real Turn advancement (M4-T11)', () => {
  it('pauses progression while open and resumes it from the same point once Stay is pressed', async () => {
    const presentation = fixture();
    render(<SessionTable presentation={presentation} />);
    // See session-table-overlay-pause.test.tsx for why this is synchronous rather than awaiting any
    // prior progress: `fireEvent.click` flushes the resulting `useEffect` before the 0ms-delay
    // `driveTurns` loop's own first pending await can resolve.
    act(() => { presentation.startAutoPlay(0); });
    fireEvent.click(screen.getByRole('button', { name: 'Leave Game' }));
    expect(presentation.isPaused()).toBe(true);
    const pausedSnapshot = presentation.getSnapshot();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(presentation.getSnapshot()).toBe(pausedSnapshot);

    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(presentation.isPaused()).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(presentation.getSnapshot()).not.toBe(pausedSnapshot));
  });
});

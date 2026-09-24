// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Card } from '../../../src/domain';
import { SessionPresentation } from '../../../src/application/SessionPresentation';
import type { StartedSession } from '../../../src/application/startSession';
import { createSession, defaultRuleset, getPublicView, startRound } from '../../../src/engine';
import type { PlayerTurnRequest } from '../../../src/orchestrator';
import { GameRunner, HumanController } from '../../../src/orchestrator';
import type { PlayerController } from '../../../src/orchestrator';
import { SessionTable } from '../../../src/ui/App';

/**
 * End-to-end proof that Play/Pass in the rendered table actually resolves the production
 * HumanController and advances the real Engine/GameRunner (M4-T08) — not a UI rule replica standing
 * in for it. Every non-human seat always picks its own first legal Move (Pass first while responding,
 * per generateLegalResponseMoves), so whichever seat first holds 3♣ keeps leading until its hand
 * empties; South is reachable either as that opener or, more likely, as a responder to it, giving
 * coverage of Play/Pass without hand-authoring a specific deal.
 */

const ids = ['south', 'west', 'north', 'east'];

function fixture() {
  let seed = 7;
  const engineRng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
  const created = createSession(ids);
  const started = startRound(created.state, engineRng);
  const human = new HumanController('south');
  const bots: readonly PlayerController[] = ids
    .filter((id) => id !== 'south')
    .map((playerId) => ({ playerId, chooseMove: async (request: PlayerTurnRequest) => request.legalMoves[0]! }));
  const controllers = new Map<string, PlayerController>([human, ...bots].map((controller) => [controller.playerId, controller]));
  const runner = new GameRunner(started.state, defaultRuleset, controllers, true);
  const session: StartedSession = {
    runner, humanController: human, engineRng, initialView: getPublicView(started.state),
    startupEvents: [...created.events], names: { south: 'You', west: 'Ana', north: 'Bo', east: 'Cy' },
  };
  return { presentation: new SessionPresentation(session), human };
}

function slotFor(card: Card): HTMLElement {
  const suitLabel = card.suit[0]!.toUpperCase() + card.suit.slice(1);
  return within(screen.getByRole('group', { name: 'Your hand' }))
    .getByRole('img', { name: `${card.rank} of ${suitLabel}` })
    .closest('[data-card-key]') as HTMLElement;
}

afterEach(cleanup);

/**
 * Drives bot Turns one at a time (each resolves synchronously via the fixture's
 * legalMoves[0]-picking controllers) until South is on the clock, without ever calling
 * runTurn() for South itself — that call would hang on HumanController's pending Promise until
 * a Move is submitted, which is exactly the moment this test needs to control precisely.
 */
async function driveToSouthsTurn(presentation: SessionPresentation): Promise<void> {
  while (presentation.getSnapshot().currentPlayerId !== 'south') {
    await presentation.runTurn();
  }
}

describe('Play/Pass submission reaches the production Engine (M4-T08)', () => {
  it('resolves a valid Play (or, lacking one, a Pass) through HumanController and advances the Turn', async () => {
    const { presentation, human } = fixture();
    render(<SessionTable presentation={presentation} />);
    await driveToSouthsTurn(presentation);

    // Starts South's Turn (populating HumanController's pending request) without awaiting it —
    // the returned Promise only resolves once the UI submits a Move below, which is the point.
    const turnResult = presentation.runTurn();
    await waitFor(() => expect(human.getPendingRequest()).not.toBeNull());

    const request = human.getPendingRequest()!;
    const playMove = request.legalMoves.find((move) => move.kind === 'play');
    const handSizeBefore = presentation.getSnapshot().humanHand.length;

    if (playMove && playMove.kind === 'play') {
      for (const card of playMove.cards) fireEvent.click(slotFor(card));
      const playButton = screen.getByRole('button', { name: 'Play' });
      await waitFor(() => expect((playButton as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(playButton);
      expect(human.getPendingRequest()).toBeNull();
      expect(await turnResult).toEqual({ accepted: true });
      // No further Turn has run since (this test never called startAutoPlay), so the Engine's
      // resulting state is observed exactly as this Turn left it — no race with later Turns.
      const snapshot = presentation.getSnapshot();
      expect(snapshot.humanHand.length).toBe(handSizeBefore - playMove.cards.length);
      expect(snapshot.center.kind === 'hand' && snapshot.center.playerId === 'south').toBe(true);
    } else {
      const passButton = screen.getByRole('button', { name: 'Pass' });
      expect((passButton as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(passButton);
      expect(human.getPendingRequest()).toBeNull();
      expect(await turnResult).toEqual({ accepted: true });
      expect(presentation.getSnapshot().currentPlayerId).not.toBe('south');
    }
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Move } from '../../../src/domain';
import { SessionPresentation } from '../../../src/application/SessionPresentation';
import type { StartedSession } from '../../../src/application/startSession';
import { createSession, defaultRuleset, getPublicView, startRound } from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';
import { SessionTable } from '../../../src/ui/App';

const ids = ['south', 'west', 'north', 'east'];
const singleFirst = (request: PlayerTurnRequest): Move =>
  request.legalMoves.find((move) => move.kind === 'play' && move.cards.length === 1) ?? request.legalMoves[0]!;

/** Mirrors the fixture in tests/unit/application/session-presentation.test.ts: a deterministic shuffle
 *  seed drives a real production Session so seat/center rendering is checked against authoritative state. */
function fixture(choose = singleFirst) {
  let seed = 26;
  const engineRng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
  const created = createSession(ids);
  const started = startRound(created.state, engineRng);
  const controllers = ids.map((playerId) => ({ playerId, chooseMove: async (request: PlayerTurnRequest) => choose(request) }));
  const session: StartedSession = {
    runner: new GameRunner(started.state, defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])), true),
    humanController: controllers[0]!, engineRng, initialView: getPublicView(started.state),
    startupEvents: [...created.events], names: { south: 'You', west: 'Ana', north: 'Bo', east: 'Cy' },
  };
  return new SessionPresentation(session);
}

afterEach(cleanup);

describe('SessionTable seats and center (M4-T06)', () => {
  it('renders every fixed seat with a readable panel, hides bot hands behind overlapping face-down counts, and offers Discard Pile, Event Log, and Leave Game', () => {
    const presentation = fixture();
    render(<SessionTable presentation={presentation} />);
    const snapshot = presentation.getSnapshot();
    expect(snapshot.seats.map((seat) => seat.seat)).toEqual(['south', 'west', 'north', 'east']);
    for (const seat of snapshot.seats) {
      const panel = screen.getByRole('region', { name: `${seat.name} panel` });
      const seatContainer = panel.parentElement!;
      // BotHand is intentionally aria-hidden (PlayerPanel's numeric count already announces the total,
      // so 13 redundant "Face-down card" landmarks would be screen-reader noise); `hidden: true` looks
      // through that to verify the actual DOM structure/count and that no card face ever leaks, hidden or not.
      const backs = within(seatContainer).queryAllByRole('img', { name: 'Face-down card', hidden: true });
      // South is the human seat: its own cards are not yet rendered here (T07 owns the interactive human hand);
      // bot seats render exactly `cardCount` face-down backs and never a rank/suit label.
      expect(backs).toHaveLength(seat.seat === 'south' ? 0 : seat.cardCount);
      expect(within(seatContainer).queryAllByRole('img', { name: /of (Clubs|Spades|Hearts|Diamonds)/, hidden: true })).toHaveLength(0);
    }
    // "Check Discard Pile" (M4-T10 follow-up), not bare "Discard Pile" - the person's own follow-up
    // report that the noun phrase alone read as if clicking it would discard the player's own cards.
    expect(screen.getByRole('button', { name: 'Check Discard Pile' })).toBeTruthy();
    // Leave Game is still an inert placeholder (round-4 follow-up): its own confirmation behavior
    // remains M4-T11 scope.
    expect(screen.getByRole('button', { name: 'Event Log' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leave Game' })).toBeTruthy();
  });

  it('highlights the current Turn and shows the Opening state before any Play', () => {
    const presentation = fixture();
    render(<SessionTable presentation={presentation} />);
    const snapshot = presentation.getSnapshot();
    expect(snapshot.center).toEqual({ kind: 'opening' });
    const current = snapshot.seats.find((seat) => seat.isCurrentTurn)!;
    for (const seat of snapshot.seats) {
      const panel = screen.getByRole('region', { name: `${seat.name} panel` });
      expect(panel.getAttribute('aria-current')).toBe(seat === current ? 'true' : null);
    }
    expect(screen.getByText('OPENING · 3♣ required')).toBeTruthy();
    expect(screen.queryByText('FREE LEAD')).toBeNull();
  });

  it('shows the current hand to beat with its recognized type, cards, and player once a Play is made', async () => {
    const presentation = fixture();
    render(<SessionTable presentation={presentation} />);
    await act(async () => { await presentation.runTurn(); });
    const snapshot = presentation.getSnapshot();
    const center = snapshot.center;
    if (center.kind !== 'hand') throw new Error('Expected the first opening Play to produce a current hand.');
    const player = snapshot.seats.find((seat) => seat.playerId === center.playerId)!;
    // Scoped to the center region specifically: the same card also renders at the player's own seat
    // (M4-T08's per-seat Play trail, ui-ux.md §5.4), so an unscoped query would match twice.
    const centerRegion = screen.getByRole('region', { name: 'Current hand to beat' });
    expect(within(centerRegion).getByText(`${player.name} played Single`)).toBeTruthy();
    const [card] = center.combination.cards;
    expect(within(centerRegion).getByRole('img', { name: `${card!.rank} of ${card!.suit[0]!.toUpperCase()}${card!.suit.slice(1)}` })).toBeTruthy();
  });

  it('preserves the current hand through a Pass, then shows FREE LEAD once every other active player passes', async () => {
    let pass = false;
    const presentation = fixture((request) => (pass ? { kind: 'pass', playerId: request.playerId } : singleFirst(request)));
    render(<SessionTable presentation={presentation} />);
    await act(async () => { await presentation.runTurn(); });
    const played = presentation.getSnapshot();
    pass = true;
    const passer = played.currentPlayerId;
    await act(async () => { await presentation.runTurn(); });
    const afterPass = presentation.getSnapshot();
    expect(afterPass.center).toEqual(played.center);
    const passerSeat = afterPass.seats.find((seat) => seat.playerId === passer)!;
    expect(within(screen.getByRole('region', { name: `${passerSeat.name} panel` })).getByText('PASS')).toBeTruthy();
    await act(async () => {
      await presentation.runTurn();
      await presentation.runTurn();
    });
    expect(presentation.getSnapshot().center).toEqual({ kind: 'freeLead' });
    expect(screen.getByText('FREE LEAD')).toBeTruthy();
    expect(screen.queryByText(/played Single/)).toBeNull();
  });

  it('shows a Play at the player\'s own seat too, grays it once beaten, and clears it on free lead (M4-T08 follow-up; ui-ux.md §5.4)', async () => {
    // Prefers any legal Play over Pass, so a beat is exercised whenever the dealt hands allow one.
    const presentation = fixture((request) => request.legalMoves.find((move) => move.kind === 'play') ?? request.legalMoves.find((move) => move.kind === 'pass')!);
    render(<SessionTable presentation={presentation} />);
    const opener = presentation.getSnapshot().currentPlayerId!;
    await act(async () => { await presentation.runTurn(); });
    const openerName = presentation.getSnapshot().seats.find((seat) => seat.playerId === opener)!.name;
    // The trail renders inside the panel's own container (PlayerPanel's `playTrail` slot), not beside
    // it, per the person's own follow-up request.
    const openerPanel = screen.getByRole('region', { name: `${openerName} panel` });
    expect(within(openerPanel).getByRole('group', { name: 'Current Play' })).toBeTruthy();

    let turns = 0;
    while (presentation.getSnapshot().center.kind !== 'freeLead' && turns++ < 20) {
      await act(async () => { await presentation.runTurn(); });
    }
    expect(presentation.getSnapshot().center.kind).toBe('freeLead');
    // Every per-seat Play trail is cleared once the cycle resets to a free lead - none of the four
    // seats retains either a "Current Play" or "Previous Play, now beaten" landmark.
    expect(screen.queryAllByRole('group', { name: 'Current Play' })).toHaveLength(0);
    expect(screen.queryAllByRole('group', { name: 'Previous Play, now beaten' })).toHaveLength(0);
  });
});

describe('Leave Game confirmation (M4-T11; ui-ux.md §10)', () => {
  it('opens a confirmation naming that progress is not saved; Stay closes it without leaving', () => {
    const presentation = fixture();
    const onLeave = vi.fn();
    render(<SessionTable presentation={presentation} onLeave={onLeave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave Game' }));
    expect(screen.getByRole('dialog', { name: 'Leave Game' })).toBeTruthy();
    expect(screen.getByText(/progress is not saved/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onLeave).not.toHaveBeenCalled();
    // The table itself is still there, unaffected by the cancelled Leave attempt.
    expect(screen.getByRole('region', { name: 'Game Table' })).toBeTruthy();
  });

  it('confirming Leave calls the onLeave callback exactly once', () => {
    const presentation = fixture();
    const onLeave = vi.fn();
    render(<SessionTable presentation={presentation} onLeave={onLeave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave Game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Leave Game' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('Escape and a backdrop click both behave as Stay, not as Leave', () => {
    const presentation = fixture();
    const onLeave = vi.fn();
    render(<SessionTable presentation={presentation} onLeave={onLeave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave Game' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('defaults to a safe no-op onLeave for callers (existing tests) that render SessionTable without one', () => {
    const presentation = fixture();
    render(<SessionTable presentation={presentation} />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave Game' }));
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Yes, Leave Game' }))).not.toThrow();
  });
});

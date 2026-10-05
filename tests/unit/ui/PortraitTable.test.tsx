// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Card, Move } from '../../../src/domain';
import { SessionPresentation } from '../../../src/application/SessionPresentation';
import { createSessionConfiguration, startSession } from '../../../src/application/startSession';
import type { StartedSession } from '../../../src/application/startSession';
import { createSession, defaultRuleset, getPublicView, startRound } from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerTurnRequest } from '../../../src/orchestrator';
import { SessionTable } from '../../../src/ui/App';
import { describeCombination } from '../../../src/ui/primitives/combinationLabels';
import type { SupportedLayout } from '../../../src/ui/primitives/useLayoutSupport';
import { PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX, PORTRAIT_TABLET_TALL_MIN_HEIGHT_PX } from '../../../src/ui/primitives/layoutThresholds';

/**
 * M5-T03 (ui-ux.md §19.6.3-§19.6.5): the supported-portrait table composition. Layout geometry, sizing, and
 * contrast need a real layout engine (tests/browser/portrait-table.e2e.ts); this covers what each portrait
 * class renders, that every piece of gameplay-critical information stays present, that Play/Pass feedback is
 * still the Engine-derived feedback, and that switching composition keeps the same elements and hand state.
 */

const ids = ['south', 'west', 'north', 'east'];
const LONG_NAMES = { south: 'You', west: 'Maximiliana Montgomery-Featherstonehaugh', north: 'Bo', east: 'Cy' };

function seededRng(initial: number) {
  let seed = initial;
  return { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
}

/** Every seat is automatic and driven explicitly with `runTurn`, as in SessionTable.test.tsx's own fixture. */
function automaticTable(choose: (request: PlayerTurnRequest) => Move, names: Readonly<Record<string, string>> = LONG_NAMES) {
  const engineRng = seededRng(26);
  const created = createSession(ids);
  const started = startRound(created.state, engineRng);
  const controllers = ids.map((playerId) => ({ playerId, chooseMove: async (request: PlayerTurnRequest) => choose(request) }));
  const session: StartedSession = {
    runner: new GameRunner(started.state, defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])), true),
    humanController: controllers[0]!, engineRng, initialView: getPublicView(started.state),
    startupEvents: [...created.events], names,
  };
  return new SessionPresentation(session);
}

const firstPlay = (request: PlayerTurnRequest): Move =>
  request.legalMoves.find((move) => move.kind === 'play') ?? request.legalMoves.find((move) => move.kind === 'pass')!;

/** A production Session (real HumanController for South) whose seeded deal has East open, so South's first
 *  Turn is a response - the same deal as SessionTable.test.tsx's `respondingHumanTable`. */
async function respondingHumanTable(composition: SupportedLayout) {
  const presentation = new SessionPresentation(startSession(createSessionConfiguration(), { engineRng: seededRng(26) }));
  render(<SessionTable presentation={presentation} composition={composition} />);
  presentation.startAutoPlay(0);
  await waitFor(() => {
    expect(presentation.getSnapshot().currentPlayerId).toBe('south');
    expect(presentation.getPendingHumanRequest()).not.toBeNull();
  });
  return presentation;
}

function slotFor(card: Card): HTMLElement {
  const suitLabel = card.suit[0]!.toUpperCase() + card.suit.slice(1);
  return within(screen.getByRole('listbox', { name: 'Your hand' }))
    .getByRole('img', { name: `${card.rank} of ${suitLabel}` })
    .closest('[data-card-key]') as HTMLElement;
}

const panel = (name: string) => screen.getByRole('region', { name: `${name} panel` });
const faceDownCards = (name: string) => within(panel(name).parentElement!).queryAllByRole('img', { name: 'Face-down card', hidden: true });
const description = (button: HTMLElement) => {
  const id = button.getAttribute('aria-describedby');
  return id === null ? null : document.getElementById(id)?.textContent ?? null;
};

const originalHeight = window.innerHeight;

/** The portrait height tier follows `window.innerHeight` (usePortraitTier.ts); jsdom's default is 768. */
function setViewportHeight(height: number) {
  act(() => {
    window.innerHeight = height;
    window.dispatchEvent(new Event('resize'));
  });
}

afterEach(() => {
  cleanup();
  window.innerHeight = originalHeight;
});

describe('Phone portrait opponents and status (ui-ux.md §19.6.3)', () => {
  it('shows each opponent as a compact panel with name, card count, score, and status, without a card fan (short tier) or Play trail', async () => {
    window.innerHeight = PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX - 1;
    const presentation = automaticTable(firstPlay);
    render(<SessionTable presentation={presentation} composition="portrait-phone" />);
    await act(async () => { await presentation.runTurn(); });
    const snapshot = presentation.getSnapshot();
    const opener = snapshot.seats.find((seat) => seat.lastPlay !== null)!;
    for (const seat of snapshot.seats.filter((entry) => entry.seat !== 'south')) {
      const region = panel(seat.name);
      // The full name stays in the panel's accessible name and text even though a long one is shortened visually.
      expect(within(region).getByText(seat.name)).toBeTruthy();
      expect(within(region).getByText(`${seat.cardCount} card${seat.cardCount === 1 ? '' : 's'}`)).toBeTruthy();
      expect(within(region).getByText(`${seat.totalScore} pts`)).toBeTruthy();
      expect(faceDownCards(seat.name)).toHaveLength(0);
      expect(within(region).queryByRole('group', { name: /Play/ })).toBeNull();
    }
    // The current hand and who played it are in the center instead of a per-seat trail.
    const center = screen.getByRole('region', { name: 'Current hand to beat' });
    const combination = snapshot.center.kind === 'hand' ? snapshot.center.combination : null;
    expect(combination).not.toBeNull();
    expect(within(center).getByText('played', { exact: false, selector: 'p' }).textContent).toMatch(new RegExp(`^${opener.name} played `));
    expect(within(center).getAllByRole('img')).toHaveLength(combination!.cards.length);
  });

  it('keeps Turn, PASS, DONE with placement, and the "deciding" indicator as text in the compact panel', async () => {
    let pass = false;
    const presentation = automaticTable((request) => (pass ? { kind: 'pass', playerId: request.playerId } : firstPlay(request)));
    render(<SessionTable presentation={presentation} composition="portrait-phone" />);
    const current = presentation.getSnapshot().seats.find((seat) => seat.isCurrentTurn)!;
    // A bot's Turn shows both the Turn label and its "deciding" indicator.
    if (current.seat !== 'south') {
      expect(within(panel(current.name)).getByText('Turn')).toBeTruthy();
      expect(within(panel(current.name)).getByRole('status', { name: `${current.name} is deciding` })).toBeTruthy();
      expect(panel(current.name).getAttribute('aria-current')).toBe('true');
    }
    await act(async () => { await presentation.runTurn(); });
    pass = true;
    const passer = presentation.getSnapshot().seats.find((seat) => seat.isCurrentTurn)!;
    await act(async () => { await presentation.runTurn(); });
    expect(within(panel(passer.name)).getByText('PASS')).toBeTruthy();
    // Drive to the first finish so a DONE-with-placement status is rendered in portrait.
    pass = false;
    for (let turn = 0; turn < 200 && !presentation.getSnapshot().seats.some((seat) => seat.done); turn++) {
      await act(async () => { await presentation.runTurn(); });
    }
    const finished = presentation.getSnapshot().seats.find((seat) => seat.done)!;
    expect(finished.placement).toBe(1);
    expect(within(panel(finished.name)).getByText('DONE · 1st')).toBeTruthy();
    expect(within(panel(finished.name)).getByText(finished.seat === 'south' ? `0 cards · ${finished.totalScore} pts` : '0 cards')).toBeTruthy();
    // 20000ms (M5-T03 review): driving to the first finish runs up to 200 real Turns, each crossing the same
    // real per-Turn macrotask that session-summary.test.tsx's full-Session tests document. It took ~1.4s in
    // isolation and ~2.6s under synthetic full-suite CPU contention (four CPU-saturating processes on a
    // two-core sandbox), and it timed out at Vitest's 5000ms default in two consecutive full-suite runs on
    // the reviewer's machine; 20000ms keeps meaningful headroom without masking a genuine hang.
  }, 20000);

  it.each([PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX - 1, PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX])('keeps the human\'s own name, count, score, and status visible at height %ipx', async (height) => {
    window.innerHeight = height;
    const presentation = await respondingHumanTable('portrait-phone');
    const you = panel('You');
    expect(you.getAttribute('aria-current')).toBe('true');
    expect(within(you).getByText('You')).toBeTruthy();
    expect(within(you).getByText(`${presentation.getSnapshot().humanHand.length} cards · 0 pts`)).toBeTruthy();
    expect(within(you).getByText('Turn')).toBeTruthy();
  });

  it('shows the face-down fan in the tall tier, and switches tier on resize without remounting or losing hand state', async () => {
    window.innerHeight = PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX;
    const presentation = automaticTable(firstPlay);
    render(<SessionTable presentation={presentation} composition="portrait-phone" />);
    await act(async () => { await presentation.runTurn(); });
    const bots = presentation.getSnapshot().seats.filter((entry) => entry.seat !== 'south');
    for (const seat of bots) expect(faceDownCards(seat.name)).toHaveLength(seat.cardCount);
    const table = screen.getByRole('region', { name: 'Game Table' });
    fireEvent.click(screen.getByRole('button', { name: 'Sort Suit' }));
    fireEvent.click(document.querySelectorAll('[data-card-key]')[3]!);
    const order = Array.from(document.querySelectorAll('[data-card-key]')).map((slot) => slot.getAttribute('data-card-key'));
    setViewportHeight(PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX - 1);
    for (const seat of bots) expect(faceDownCards(seat.name)).toHaveLength(0);
    setViewportHeight(PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX);
    for (const seat of bots) expect(faceDownCards(seat.name)).toHaveLength(seat.cardCount);
    expect(screen.getByRole('region', { name: 'Game Table' })).toBe(table);
    expect(Array.from(document.querySelectorAll('[data-card-key]')).map((slot) => slot.getAttribute('data-card-key'))).toEqual(order);
    expect(document.querySelectorAll('[data-card-key][data-selected="true"]')).toHaveLength(1);
  });

  it('shows the "deciding" indicator on its own row below the Turn status, as in the full panel', () => {
    render(<SessionTable presentation={automaticTable(firstPlay)} composition="portrait-phone" />);
    const current = screen.getAllByRole('region').find((region) => region.getAttribute('aria-current') === 'true')!;
    const spinner = within(current).getByRole('status');
    expect(spinner.parentElement).not.toBe(within(current).getByText('Turn').parentElement);
  });

  it('shows FREE LEAD once every other active player passes, and the Round context', async () => {
    let pass = false;
    const presentation = automaticTable((request) => (pass ? { kind: 'pass', playerId: request.playerId } : firstPlay(request)));
    render(<SessionTable presentation={presentation} composition="portrait-phone" />);
    expect(screen.getByText('Basic · Round 1 of 5')).toBeTruthy();
    await act(async () => { await presentation.runTurn(); });
    pass = true;
    for (let turn = 0; turn < 3; turn++) await act(async () => { await presentation.runTurn(); });
    expect(presentation.getSnapshot().center).toEqual({ kind: 'freeLead' });
    expect(within(screen.getByRole('region', { name: 'Current hand to beat' })).getByText('FREE LEAD')).toBeTruthy();
  });
});

describe('Tablet portrait opponents (ui-ux.md §19.6.3)', () => {
  it('keeps the numeric count, the face-down fan (tall tier), and the per-seat Play trail', async () => {
    window.innerHeight = PORTRAIT_TABLET_TALL_MIN_HEIGHT_PX;
    const presentation = automaticTable(firstPlay);
    render(<SessionTable presentation={presentation} composition="portrait-tablet" />);
    await act(async () => { await presentation.runTurn(); });
    const snapshot = presentation.getSnapshot();
    for (const seat of snapshot.seats.filter((entry) => entry.seat !== 'south')) {
      expect(within(panel(seat.name)).getByText(`${seat.cardCount} cards · ${seat.totalScore} pts`)).toBeTruthy();
      expect(faceDownCards(seat.name)).toHaveLength(seat.cardCount);
    }
    const opener = snapshot.seats.find((seat) => seat.lastPlay !== null)!;
    expect(within(panel(opener.name)).getByRole('group', { name: 'Current Play' })).toBeTruthy();
  });
});

describe('Portrait Play/Pass feedback reuses the Engine-derived feedback (ui-ux.md §7, §19.6.4)', () => {
  // This deal's first human Turn answers East's opening single 3♣, which every held single beats: Pass is the
  // strategic kind (no "No valid plays"). Illegal-selection reasons and "No valid plays" in the row layout
  // are covered deterministically in PlayPassControls.test.tsx.
  it.each(['portrait-phone', 'portrait-tablet'] as const)('%s: a strategic Pass is available without "No valid plays", and an unavailable Play does nothing', async (composition) => {
    const presentation = await respondingHumanTable(composition);
    const request = presentation.getPendingHumanRequest()!;
    expect(request.legalMoves.some((move) => move.kind === 'play')).toBe(true);
    const play = screen.getByRole('button', { name: 'Play' });
    const pass = screen.getByRole('button', { name: 'Pass' });
    expect(pass.getAttribute('aria-disabled')).toBe('false');
    expect(description(pass)).toBeNull();
    expect(play.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(play);
    expect(presentation.getPendingHumanRequest()).toBe(request);
    fireEvent.click(pass);
    expect(presentation.getPendingHumanRequest()).toBeNull();
  });

  it('enables Play for a legal selection, names it, and submits it from the portrait layout', async () => {
    const presentation = await respondingHumanTable('portrait-phone');
    const request = presentation.getPendingHumanRequest()!;
    const legal = request.legalMoves.find((move) => move.kind === 'play');
    if (!legal || legal.kind !== 'play') throw new Error('Expected this deal to offer a legal Play.');
    for (const card of legal.cards) fireEvent.click(slotFor(card));
    const play = screen.getByRole('button', { name: 'Play' });
    await waitFor(() => expect(play.getAttribute('aria-disabled')).toBe('false'));
    const center = presentation.getSnapshot().center;
    if (center.kind !== 'hand') throw new Error('Expected a response Turn.');
    expect(description(play)).toBe(describeCombination({ type: center.combination.type, cards: legal.cards }));
    fireEvent.click(play);
    expect(presentation.getPendingHumanRequest()).toBeNull();
  });
});

describe('Portrait controls and composition switches (ui-ux.md §19.6.2-§19.6.4)', () => {
  it.each(['portrait-phone', 'portrait-tablet'] as const)('%s: every control is present in portrait Tab order (utility, Sort, Pass, Play), with Play/Pass focusable while unavailable', (composition) => {
    render(<SessionTable presentation={automaticTable(firstPlay)} composition={composition} />);
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? button.textContent))
      .toEqual(['Event Log', 'Check Discard Pile', 'Leave Game', 'Sort Rank', 'Sort Suit', 'Pass', 'Play']);
    // The hand sits between Leave Game and Sort Rank in document order.
    const hand = screen.getByRole('listbox', { name: 'Your hand' });
    expect(screen.getByRole('button', { name: 'Leave Game' }).compareDocumentPosition(hand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hand.compareDocumentPosition(screen.getByRole('button', { name: 'Sort Rank' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const name of ['Play', 'Pass']) {
      const button = screen.getByRole('button', { name });
      expect(button.hasAttribute('disabled')).toBe(false);
      button.focus();
      expect(document.activeElement).toBe(button);
    }
  });

  it('renders the portrait play area unscaled and switches composition without remounting the table or losing hand state', () => {
    const presentation = automaticTable(firstPlay);
    const { rerender } = render(<SessionTable presentation={presentation} composition="landscape" />);
    const table = screen.getByRole('region', { name: 'Game Table' });
    const area = table.closest('[data-play-area-scale]') as HTMLElement;
    expect(area.style.transform).toMatch(/^scale\(/);
    fireEvent.click(screen.getByRole('button', { name: 'Sort Suit' }));
    fireEvent.click(document.querySelectorAll('[data-card-key]')[4]!);
    const order = () => Array.from(document.querySelectorAll('[data-card-key]')).map((slot) => slot.getAttribute('data-card-key'));
    const selected = () => Array.from(document.querySelectorAll('[data-card-key][data-selected="true"]')).map((slot) => slot.getAttribute('data-card-key'));
    const arranged = order();
    const selection = selected();
    const hand = screen.getByRole('listbox', { name: 'Your hand' });

    for (const composition of ['portrait-phone', 'portrait-tablet', 'landscape', 'portrait-phone'] as const) {
      rerender(<SessionTable presentation={presentation} composition={composition} />);
      expect(screen.getByRole('region', { name: 'Game Table' })).toBe(table);
      expect(table.closest('[data-play-area-scale]')).toBe(area);
      // The hand is the same element in every composition, not remounted.
      expect(screen.getByRole('listbox', { name: 'Your hand' })).toBe(hand);
      if (composition === 'landscape') {
        expect(area.style.transform).toMatch(/^scale\(/);
      } else {
        expect(area.style.transform).toBe('');
        expect(area.dataset.playAreaScale).toBe('1');
      }
      expect(order()).toEqual(arranged);
      expect(selected()).toEqual(selection);
    }
  });
});

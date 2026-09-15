// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card, Combination, Move } from '../../../src/domain';
import type { SessionPresentationSnapshot } from '../../../src/application/SessionPresentation';
import { PlayPassControls } from '../../../src/ui/primitives/PlayPassControls';

type Center = SessionPresentationSnapshot['center'];

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

const OPENING: Center = { kind: 'opening' };
const FREE_LEAD: Center = { kind: 'freeLead' };

function handOf(combination: Combination): Center {
  return { kind: 'hand', playerId: 'west', combination };
}

function renderControls(overrides: Partial<Parameters<typeof PlayPassControls>[0]> = {}) {
  const onSubmit = vi.fn<(move: Move) => void>();
  const { container } = render(
    <PlayPassControls
      selected={[]}
      center={FREE_LEAD}
      humanHand={[]}
      playerId="south"
      isMyTurn={true}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return {
    onSubmit, container,
    play: () => screen.getByRole('button', { name: 'Play' }),
    pass: () => screen.getByRole('button', { name: 'Pass' }),
  };
}

afterEach(cleanup);

describe('Play feedback and legality (M4-T08)', () => {
  it('keeps Play disabled with no reason text when nothing is selected', () => {
    const { play, container } = renderControls({ selected: [], center: OPENING });
    expect((play() as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('p')).toBeNull();
  });

  it('shows "Invalid combination" for a selection the Engine does not recognize', () => {
    const { play } = renderControls({ selected: [c('3', 'clubs'), c('5', 'hearts')], center: FREE_LEAD });
    expect((play() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Invalid combination')).toBeTruthy();
  });

  it('shows "Wrong number of cards" for an unsupported card count', () => {
    const { play } = renderControls({ selected: [c('3', 'clubs'), c('4', 'clubs'), c('5', 'clubs'), c('6', 'clubs')], center: FREE_LEAD });
    expect((play() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Wrong number of cards')).toBeTruthy();
  });

  it('shows a specific non-beating reason naming the current hand to beat', () => {
    const current: Combination = { type: 'single', cards: [c('9', 'hearts')] };
    const { play } = renderControls({ selected: [c('5', 'clubs')], center: handOf(current) });
    expect((play() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Doesn't beat Single 9")).toBeTruthy();
  });

  it('requires 3♣ while opening, and accepts a recognized combination once it is included', () => {
    const withoutThreeClubs = renderControls({ selected: [c('5', 'clubs')], center: OPENING });
    expect((withoutThreeClubs.play() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Must include 3♣')).toBeTruthy();
    cleanup();
    const withThreeClubs = renderControls({ selected: [c('3', 'clubs')], center: OPENING });
    expect((withThreeClubs.play() as HTMLButtonElement).disabled).toBe(false);
  });

  it('enables Play and shows the recognized combination for a valid legal selection, and submits it', () => {
    const { play, onSubmit } = renderControls({ selected: [c('5', 'clubs'), c('5', 'hearts')], center: FREE_LEAD, playerId: 'south' });
    expect(screen.getByText('Pair of 5s')).toBeTruthy();
    expect((play() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(play());
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ kind: 'play', playerId: 'south', cards: [c('5', 'clubs'), c('5', 'hearts')] });
  });

  it('does nothing on Play/Pass when it is not this player\'s Turn', () => {
    const { play, pass, onSubmit } = renderControls({
      selected: [c('5', 'clubs'), c('5', 'hearts')], center: handOf({ type: 'single', cards: [c('4', 'hearts')] }), isMyTurn: false,
    });
    expect((play() as HTMLButtonElement).disabled).toBe(true);
    expect((pass() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(play());
    fireEvent.click(pass());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('Pass availability (M4-T08)', () => {
  it('allows a strategic Pass while responding even though a legal beating Play exists, and submits it', () => {
    const current: Combination = { type: 'single', cards: [c('4', 'hearts')] };
    const { pass, onSubmit } = renderControls({ center: handOf(current), humanHand: [c('9', 'clubs')], playerId: 'south' });
    expect((pass() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText('No valid plays')).toBeNull();
    fireEvent.click(pass());
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ kind: 'pass', playerId: 'south' });
  });

  it('shows "No valid plays" while responding with zero legal Plays left, but keeps Pass enabled', () => {
    const current: Combination = { type: 'single', cards: [c('2', 'hearts')] };
    const { pass } = renderControls({ center: handOf(current), humanHand: [c('3', 'clubs')] });
    expect(screen.getByText('No valid plays')).toBeTruthy();
    expect((pass() as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables Pass during a free lead (and during the Opening Move)', () => {
    const freeLead = renderControls({ center: FREE_LEAD });
    expect((freeLead.pass() as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    const opening = renderControls({ center: OPENING });
    expect((opening.pass() as HTMLButtonElement).disabled).toBe(true);
  });
});

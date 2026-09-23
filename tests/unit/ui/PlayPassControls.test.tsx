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

  // A bare "Doesn't beat Full House" would read as if a Full House could never beat another one, so a
  // five-card hand to beat says what is missing instead (the Play button's sub-label has room for two lines).
  describe('non-beating reason when the hand to beat is a five-card hand', () => {
    const straight = [c('3', 'clubs'), c('4', 'hearts'), c('5', 'spades'), c('6', 'diamonds'), c('7', 'clubs')];
    const fullHouse: Combination = { type: 'fullHouse', cards: [c('9', 'clubs'), c('9', 'spades'), c('9', 'hearts'), c('4', 'clubs'), c('4', 'spades')] };

    it('asks for a higher hand of the same category when the selection is the same category but lower', () => {
      const lowerFullHouse = [c('5', 'clubs'), c('5', 'spades'), c('5', 'hearts'), c('6', 'clubs'), c('6', 'spades')];
      const { play } = renderControls({ selected: lowerFullHouse, center: handOf(fullHouse) });
      expect((play() as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText('Needs a higher Full House')).toBeTruthy();
    });

    it('says the selection is weaker when it is a lower five-card category', () => {
      const { play } = renderControls({ selected: straight, center: handOf(fullHouse) });
      expect((play() as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText('Weaker than Full House')).toBeTruthy();
    });

    it('says a five-card hand is needed when the selection has a different card count', () => {
      const { play } = renderControls({ selected: [c('A', 'clubs'), c('A', 'hearts')], center: handOf(fullHouse) });
      expect((play() as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText('Needs a 5-card hand')).toBeTruthy();
    });

    it('uses the category name for every five-card category, including a Flush that only loses on Suit', () => {
      const flush: Combination = { type: 'flush', cards: [c('3', 'hearts'), c('5', 'hearts'), c('7', 'hearts'), c('9', 'hearts'), c('K', 'hearts')] };
      const lowerSuitFlush = [c('3', 'spades'), c('4', 'spades'), c('6', 'spades'), c('8', 'spades'), c('K', 'spades')];
      renderControls({ selected: lowerSuitFlush, center: handOf(flush) });
      expect(screen.getByText('Needs a higher Flush')).toBeTruthy();
      cleanup();
      const fourOfAKind: Combination = { type: 'fourOfAKind', cards: [c('3', 'clubs'), c('9', 'clubs'), c('9', 'spades'), c('9', 'hearts'), c('9', 'diamonds')] };
      renderControls({ selected: straight, center: handOf(fourOfAKind) });
      expect(screen.getByText('Weaker than Four of a Kind')).toBeTruthy();
      cleanup();
      const straightFlush: Combination = { type: 'straightFlush', cards: [c('5', 'hearts'), c('6', 'hearts'), c('7', 'hearts'), c('8', 'hearts'), c('9', 'hearts')] };
      renderControls({ selected: straight, center: handOf(straightFlush) });
      expect(screen.getByText('Weaker than Straight Flush')).toBeTruthy();
    });

    it('keeps the rank-naming reason for a Pair and a Triple to beat', () => {
      renderControls({ selected: [c('4', 'clubs'), c('4', 'hearts')], center: handOf({ type: 'pair', cards: [c('9', 'clubs'), c('9', 'hearts')] }) });
      expect(screen.getByText("Doesn't beat Pair of 9s")).toBeTruthy();
      cleanup();
      renderControls({ selected: [c('4', 'clubs'), c('4', 'hearts'), c('4', 'spades')], center: handOf({ type: 'triple', cards: [c('9', 'clubs'), c('9', 'hearts'), c('9', 'spades')] }) });
      expect(screen.getByText("Doesn't beat Triple 9s")).toBeTruthy();
    });
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

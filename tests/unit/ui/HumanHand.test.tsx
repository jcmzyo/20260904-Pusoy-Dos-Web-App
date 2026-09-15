// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Card } from '../../../src/domain';
import { HumanHand } from '../../../src/ui/primitives/HumanHand';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });
const hand: readonly Card[] = [c('2', 'hearts'), c('3', 'diamonds'), c('3', 'clubs'), c('A', 'spades'), c('7', 'clubs')];

function cardOf(rank: string, suitLabel: string) {
  return screen.getByRole('img', { name: `${rank} of ${suitLabel}` });
}

function slotOf(rank: string, suitLabel: string): HTMLElement {
  return cardOf(rank, suitLabel).closest('[data-card-key]') as HTMLElement;
}

function orderedKeys(): string[] {
  return within(screen.getByRole('group', { name: 'Your hand' }))
    .getAllByRole('img')
    .map((img) => img.closest('[data-card-key]')!.getAttribute('data-card-key')!);
}

afterEach(cleanup);

describe('HumanHand rendering (M4-T07)', () => {
  it('renders every card face-up on one baseline plus the always-visible Sort controls', () => {
    render(<HumanHand cards={hand} />);
    expect(screen.getByRole('group', { name: 'Your hand' })).toBeTruthy();
    for (const card of hand) {
      expect(cardOf(card.rank, card.suit[0]!.toUpperCase() + card.suit.slice(1))).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Sort Rank' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sort Suit' })).toBeTruthy();
  });
});

describe('Selection (M4-T07)', () => {
  it('toggles a single card on click without affecting the others, and empty-area clicks change nothing', () => {
    render(<HumanHand cards={hand} />);
    const target = slotOf('3', 'Clubs');
    expect(target.dataset.selected).toBe('false');
    fireEvent.click(target);
    expect(target.dataset.selected).toBe('true');
    expect(slotOf('A', 'Spades').dataset.selected).toBe('false');
    fireEvent.click(target);
    expect(target.dataset.selected).toBe('false');

    fireEvent.click(target);
    fireEvent.click(screen.getByRole('group', { name: 'Your hand' }));
    expect(target.dataset.selected).toBe('true');
  });

  it('supports selecting several cards independently', () => {
    render(<HumanHand cards={hand} />);
    fireEvent.click(slotOf('3', 'Clubs'));
    fireEvent.click(slotOf('7', 'Clubs'));
    expect(slotOf('3', 'Clubs').dataset.selected).toBe('true');
    expect(slotOf('7', 'Clubs').dataset.selected).toBe('true');
    expect(slotOf('A', 'Spades').dataset.selected).toBe('false');
    expect(slotOf('2', 'Hearts').dataset.selected).toBe('false');
  });
});

describe('Sorting (M4-T07)', () => {
  it('Sort Rank applies the canonical Rank order (3 -> ... -> A -> 2, ties by suit)', () => {
    render(<HumanHand cards={hand} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort Rank' }));
    expect(orderedKeys()).toEqual(['3-clubs', '3-diamonds', '7-clubs', 'A-spades', '2-hearts']);
  });

  it('Sort Suit applies the canonical Suit order (Clubs -> Spades -> Hearts -> Diamonds, within suit by Rank)', () => {
    render(<HumanHand cards={hand} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort Suit' }));
    expect(orderedKeys()).toEqual(['3-clubs', '7-clubs', 'A-spades', '2-hearts', '3-diamonds']);
  });

  it('preserves the current selection across a Sort by Rank', () => {
    render(<HumanHand cards={hand} />);
    fireEvent.click(slotOf('3', 'Clubs'));
    fireEvent.click(slotOf('2', 'Hearts'));
    fireEvent.click(screen.getByRole('button', { name: 'Sort Rank' }));
    expect(slotOf('3', 'Clubs').dataset.selected).toBe('true');
    expect(slotOf('2', 'Hearts').dataset.selected).toBe('true');
    expect(slotOf('A', 'Spades').dataset.selected).toBe('false');
    expect(slotOf('7', 'Clubs').dataset.selected).toBe('false');
  });

  it('preserves the current selection across a Sort by Suit', () => {
    render(<HumanHand cards={hand} />);
    fireEvent.click(slotOf('A', 'Spades'));
    fireEvent.click(screen.getByRole('button', { name: 'Sort Suit' }));
    expect(slotOf('A', 'Spades').dataset.selected).toBe('true');
    expect(slotOf('3', 'Clubs').dataset.selected).toBe('false');
  });

  it('remains usable (re-clickable) even when the hand already matches the requested order', () => {
    render(<HumanHand cards={hand} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort Rank' }));
    const firstPass = orderedKeys();
    fireEvent.click(screen.getByRole('button', { name: 'Sort Rank' }));
    expect(orderedKeys()).toEqual(firstPass);
  });
});

describe('Drag reorder does not affect selection (M4-T07)', () => {
  it('a pointer gesture that moves past the drag threshold does not toggle selection, and the trailing click it produces is suppressed', () => {
    render(<HumanHand cards={hand} />);
    const dragged = slotOf('3', 'Clubs');
    const neighbor = slotOf('A', 'Spades');
    fireEvent.pointerDown(dragged, { pointerId: 1, clientX: 100, button: 0 });
    fireEvent.pointerMove(dragged, { pointerId: 1, clientX: 260 });
    fireEvent.pointerUp(dragged, { pointerId: 1, clientX: 260 });
    // A real browser fires a trailing `click` after pointerup; HumanHand must swallow exactly that one.
    fireEvent.click(dragged);
    expect(dragged.dataset.selected).toBe('false');
    expect(neighbor.dataset.selected).toBe('false');
    // Selection still works normally on the very next tap.
    fireEvent.click(dragged);
    expect(dragged.dataset.selected).toBe('true');
  });

  it('a small pointer movement under the drag threshold still allows the click through', () => {
    render(<HumanHand cards={hand} />);
    const target = slotOf('7', 'Clubs');
    fireEvent.pointerDown(target, { pointerId: 2, clientX: 100, button: 0 });
    fireEvent.pointerMove(target, { pointerId: 2, clientX: 101 });
    fireEvent.pointerUp(target, { pointerId: 2, clientX: 101 });
    fireEvent.click(target);
    expect(target.dataset.selected).toBe('true');
  });

  it('moving a neighboring card never changes an already-selected card\'s selection', () => {
    render(<HumanHand cards={hand} />);
    fireEvent.click(slotOf('2', 'Hearts'));
    expect(slotOf('2', 'Hearts').dataset.selected).toBe('true');
    const neighbor = slotOf('7', 'Clubs');
    fireEvent.pointerDown(neighbor, { pointerId: 3, clientX: 50, button: 0 });
    fireEvent.pointerMove(neighbor, { pointerId: 3, clientX: 220 });
    fireEvent.pointerUp(neighbor, { pointerId: 3, clientX: 220 });
    expect(slotOf('2', 'Hearts').dataset.selected).toBe('true');
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '../../../src/domain';
import { DiscardPileOverlay, PANEL_WIDTH_PX } from '../../../src/ui/primitives/DiscardPileOverlay';

afterEach(cleanup);

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

describe('DiscardPileOverlay (M4-T10)', () => {
  it('groups played cards Clubs → Spades → Hearts → Diamonds, and within each suit Rank 3 → ... → A → 2', () => {
    // Deliberately out of order/interleaved, including the two special-order ranks (A, 2), to prove
    // this is an actual sort rather than an accidental pass-through of insertion order.
    const cards: readonly Card[] = [
      card('2', 'diamonds'), card('3', 'hearts'), card('A', 'clubs'), card('4', 'clubs'),
      card('K', 'spades'), card('3', 'clubs'), card('9', 'diamonds'),
    ];
    render(<DiscardPileOverlay cards={cards} onClose={() => {}} />);
    const badges = screen.getAllByRole('img', { name: /of (Clubs|Spades|Hearts|Diamonds)/ });
    expect(badges.map((badge) => badge.getAttribute('aria-label'))).toEqual([
      '3 of Clubs', '4 of Clubs', 'A of Clubs',
      'K of Spades',
      '3 of Hearts',
      '9 of Diamonds', '2 of Diamonds',
    ]);
  });

  it('renders no cards for an empty Discard Pile and shows an explanatory message instead', () => {
    render(<DiscardPileOverlay cards={[]} onClose={() => {}} />);
    expect(screen.queryAllByRole('img', { hidden: true })).toHaveLength(0);
    expect(screen.getByText('No cards played yet this Round.')).toBeTruthy();
  });

  it('is dismissible via its own Close control, Escape, and a backdrop click, each invoking onClose', () => {
    const onCloseViaButton = vi.fn();
    const { unmount } = render(<DiscardPileOverlay cards={[]} onClose={onCloseViaButton} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close Discard Pile' }));
    expect(onCloseViaButton).toHaveBeenCalledTimes(1);
    unmount();

    const onCloseViaEscape = vi.fn();
    render(<DiscardPileOverlay cards={[]} onClose={onCloseViaEscape} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseViaEscape).toHaveBeenCalledTimes(1);
    cleanup();

    const onCloseViaBackdrop = vi.fn();
    render(<DiscardPileOverlay cards={[]} onClose={onCloseViaBackdrop} />);
    const dialog = screen.getByRole('dialog', { name: 'Discard Pile' });
    fireEvent.click(dialog.parentElement!);
    expect(onCloseViaBackdrop).toHaveBeenCalledTimes(1);
    // Clicking inside the panel itself must not also close it.
    fireEvent.click(dialog);
    expect(onCloseViaBackdrop).toHaveBeenCalledTimes(1);
  });

  it('always renders all four suit rows, even for a suit with no cards played yet (the person\'s own follow-up request)', () => {
    render(<DiscardPileOverlay cards={[card('3', 'clubs')]} onClose={() => {}} />);
    for (const suit of ['Clubs', 'Spades', 'Hearts', 'Diamonds']) {
      expect(screen.getByRole('list', { name: `${suit} played this Round` })).toBeTruthy();
    }
    expect(within(screen.getByRole('list', { name: 'Spades played this Round' })).queryAllByRole('listitem')).toHaveLength(0);
    expect(within(screen.getByRole('list', { name: 'Clubs played this Round' })).queryAllByRole('listitem')).toHaveLength(1);
  });

  it('never renders a card for a Pass (Discard Pile only ever receives actually-played cards)', () => {
    // SessionPresentation's `playedCards` is Engine-derived and never includes a Pass's own cards
    // (Pass has none) - this simply proves the overlay renders exactly what it is given, nothing more.
    const cards: readonly Card[] = [card('3', 'clubs')];
    render(<DiscardPileOverlay cards={cards} onClose={() => {}} />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    within(screen.getByRole('dialog')).getByRole('img', { name: '3 of Clubs' });
  });

  it('sizes its own panel to just fit a full 13-card row, narrower than the shared Overlay default (the person\'s own follow-up request for a more compact overlay)', () => {
    render(<DiscardPileOverlay cards={[]} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Discard Pile' }).style.width).toBe(`min(${PANEL_WIDTH_PX}px, 100%)`);
  });
});

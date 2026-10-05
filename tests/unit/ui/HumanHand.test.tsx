// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '../../../src/domain';
import { HumanHand } from '../../../src/ui/primitives/HumanHand';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });
const hand: readonly Card[] = [c('2', 'hearts'), c('3', 'diamonds'), c('3', 'clubs'), c('A', 'spades'), c('7', 'clubs')];
/** None of the pre-existing (T07) scenarios below exercise more than two simultaneous selections, so a
 *  permissive free-Play cap keeps their behavior unchanged; the cap itself is covered separately below
 *  (M4-T08). */
const FREE_PLAY_CAP = 5;

function cardOf(rank: string, suitLabel: string) {
  return screen.getByRole('img', { name: `${rank} of ${suitLabel}` });
}

function slotOf(rank: string, suitLabel: string): HTMLElement {
  return cardOf(rank, suitLabel).closest('[data-card-key]') as HTMLElement;
}

function orderedKeys(): string[] {
  return within(screen.getByRole('listbox', { name: 'Your hand' }))
    .getAllByRole('img')
    .map((img) => img.closest('[data-card-key]')!.getAttribute('data-card-key')!);
}

afterEach(cleanup);

describe('M5-T04 keyboard, focus, and gesture safety', () => {
  it.each([0, 1, 13])('exposes %i cards with one roving Tab stop when nonempty', (count) => {
    const ranks: Card['rank'][] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
    render(<HumanHand cards={ranks.slice(0, count).map((rank) => c(rank, 'clubs'))} maxSelectable={5} />);
    const list = screen.getByRole('listbox', { name: 'Your hand' });
    expect(list.getAttribute('aria-multiselectable')).toBe('true');
    expect(list.getAttribute('aria-orientation')).toBe('horizontal');
    expect(within(list).queryAllByRole('option')).toHaveLength(count);
    expect(list.querySelectorAll('[tabindex="0"]')).toHaveLength(count ? 1 : 0);
    expect(document.getElementById(list.getAttribute('aria-describedby')!)?.textContent).toBe('← → choose · Space select · Shift+← → move');
  });

  it('navigates without wrapping and selects with Space/Enter without submitting or repeating', () => {
    render(<HumanHand cards={hand} maxSelectable={1} />);
    const first = slotOf('2', 'Hearts');
    const last = slotOf('7', 'Clubs');
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'End' });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: ' ' });
    fireEvent.keyDown(last, { key: ' ', repeat: true });
    expect(last.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(last, { key: 'Home' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(first.getAttribute('aria-selected')).toBe('false');
    fireEvent.keyDown(last, { key: 'Enter' });
    expect(last.getAttribute('aria-selected')).toBe('false');
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(slotOf('3', 'Diamonds'));
  });

  it.each([false, true])('reorders a selected=%s card at all keyboard boundaries, preserving identity and focus through both sorts', (selected) => {
    render(<HumanHand cards={hand} maxSelectable={5} />);
    const target = slotOf('3', 'Clubs');
    act(() => target.focus());
    if (selected) fireEvent.keyDown(target, { key: ' ' });
    fireEvent.keyDown(target, { key: 'ArrowLeft', shiftKey: true });
    expect(orderedKeys()[1]).toBe('3-clubs');
    fireEvent.keyDown(target, { key: 'ArrowRight', shiftKey: true });
    expect(orderedKeys()[2]).toBe('3-clubs');
    for (const key of ['Home', 'ArrowLeft', 'Home']) fireEvent.keyDown(target, { key, shiftKey: true });
    expect(orderedKeys()[0]).toBe('3-clubs');
    for (const key of ['End', 'ArrowRight', 'End']) fireEvent.keyDown(target, { key, shiftKey: true });
    expect(orderedKeys().at(-1)).toBe('3-clubs');
    for (const name of ['Sort Rank', 'Sort Suit']) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(document.activeElement).toBe(target);
      expect(target.getAttribute('aria-selected')).toBe(String(selected));
      expect(new Set(orderedKeys()).size).toBe(hand.length);
    }
  });

  it('recovers focus at the same index, clamps to the last card, then uses Sort Rank when empty', () => {
    const report = vi.fn();
    const { rerender } = render(<HumanHand cards={hand} maxSelectable={5} onSelectionChange={report} />);
    const target = slotOf('3', 'Clubs');
    act(() => target.focus());
    fireEvent.keyDown(target, { key: ' ' });
    rerender(<HumanHand cards={hand.filter((card) => card.rank !== '3')} maxSelectable={5} onSelectionChange={report} />);
    expect(document.activeElement).toBe(slotOf('7', 'Clubs'));
    expect(report.mock.calls.every(([cards]) => cards.every((card: Card | undefined) => card !== undefined))).toBe(true);
    rerender(<HumanHand cards={[hand[0]!]} maxSelectable={5} />);
    expect(document.activeElement).toBe(slotOf('2', 'Hearts'));
    rerender(<HumanHand cards={[]} maxSelectable={5} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sort Rank' }));
  });

  it('does not steal focus from another control when cards leave', () => {
    const { rerender } = render(<HumanHand cards={hand} maxSelectable={5} />);
    act(() => slotOf('2', 'Hearts').focus());
    const sort = screen.getByRole('button', { name: 'Sort Suit' });
    act(() => sort.focus());
    rerender(<HumanHand cards={hand.slice(1)} maxSelectable={5} />);
    expect(document.activeElement).toBe(sort);
  });

  it.each([6, 10, 12])('keeps a touch tap with %ipx jitter separate from drag', (delta) => {
    render(<HumanHand cards={hand} maxSelectable={5} />);
    const target = slotOf('3', 'Clubs');
    const before = orderedKeys();
    fireEvent.pointerDown(target, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 100 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 100 + delta });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 100 + delta });
    fireEvent.click(target);
    expect(target.dataset.selected).toBe('true');
    expect(orderedKeys()).toEqual(before);
  });

  it('cancels on capture loss and ignores a second pointer during drag', () => {
    render(<HumanHand cards={hand} maxSelectable={5} />);
    const target = slotOf('3', 'Clubs');
    const before = orderedKeys();
    fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: 100 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 300 });
    fireEvent.pointerDown(slotOf('7', 'Clubs'), { pointerId: 2, button: 0, clientX: 100 });
    fireEvent.lostPointerCapture(target, { pointerId: 1 });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 300 });
    expect(orderedKeys()).toEqual(before);
    expect(target.style.transform).toBe('');
    fireEvent.click(target);
    expect(target.dataset.selected).toBe('true');
  });

  it('does not drop a gesture against a changed authoritative card set', () => {
    const { rerender } = render(<HumanHand cards={hand} maxSelectable={5} />);
    const target = slotOf('3', 'Clubs');
    fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: 100 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 300 });
    rerender(<HumanHand cards={hand.slice(1)} maxSelectable={5} />);
    fireEvent.pointerUp(target, { pointerId: 1, clientX: 300 });
    fireEvent.click(target);
    expect(orderedKeys()).toEqual(['3-diamonds', '3-clubs', 'A-spades', '7-clubs']);
    expect(target.dataset.selected).toBe('false');
  });

  it('blocks synthetic keyboard, sort and pointer input behind an inert surface', () => {
    render(<div inert><HumanHand cards={hand} maxSelectable={5} /></div>);
    const target = document.querySelector('[data-card-key]') as HTMLElement;
    fireEvent.keyDown(target, { key: 'Enter' });
    fireEvent.keyDown(target, { key: 'End', shiftKey: true });
    fireEvent.click(target);
    fireEvent.click(screen.getByText('Sort Rank'));
    expect(target.dataset.selected).toBe('false');
    expect(document.querySelector('[data-card-key]')).toBe(target);
  });
});

describe('HumanHand rendering (M4-T07)', () => {
  it('renders every card face-up on one baseline plus the always-visible Sort controls', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    expect(screen.getByRole('listbox', { name: 'Your hand' })).toBeTruthy();
    for (const card of hand) {
      expect(cardOf(card.rank, card.suit[0]!.toUpperCase() + card.suit.slice(1))).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Sort Rank' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sort Suit' })).toBeTruthy();
  });

  it('draws the center suit pip on the player\'s own held cards (round-4 follow-up)', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    const card = cardOf('7', 'Clubs');
    const suitLeafCount = Array.from(card.querySelectorAll('span')).filter((span) => span.textContent === '♣' && span.children.length === 0).length;
    // 2 corner suit glyphs + 1 center pip, unlike the corner-only cards used elsewhere (Card.tsx).
    expect(suitLeafCount).toBe(3);
  });
});

describe('Selection (M4-T07)', () => {
  it('toggles a single card on click without affecting the others, and empty-area clicks change nothing', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    const target = slotOf('3', 'Clubs');
    expect(target.dataset.selected).toBe('false');
    fireEvent.click(target);
    expect(target.dataset.selected).toBe('true');
    expect(slotOf('A', 'Spades').dataset.selected).toBe('false');
    fireEvent.click(target);
    expect(target.dataset.selected).toBe('false');

    fireEvent.click(target);
    fireEvent.click(screen.getByRole('listbox', { name: 'Your hand' }));
    expect(target.dataset.selected).toBe('true');
  });

  it('supports selecting several cards independently', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
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
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort Rank' }));
    expect(orderedKeys()).toEqual(['3-clubs', '3-diamonds', '7-clubs', 'A-spades', '2-hearts']);
  });

  it('Sort Suit applies the canonical Suit order (Clubs -> Spades -> Hearts -> Diamonds, within suit by Rank)', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort Suit' }));
    expect(orderedKeys()).toEqual(['3-clubs', '7-clubs', 'A-spades', '2-hearts', '3-diamonds']);
  });

  it('preserves the current selection across a Sort by Rank', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    fireEvent.click(slotOf('3', 'Clubs'));
    fireEvent.click(slotOf('2', 'Hearts'));
    fireEvent.click(screen.getByRole('button', { name: 'Sort Rank' }));
    expect(slotOf('3', 'Clubs').dataset.selected).toBe('true');
    expect(slotOf('2', 'Hearts').dataset.selected).toBe('true');
    expect(slotOf('A', 'Spades').dataset.selected).toBe('false');
    expect(slotOf('7', 'Clubs').dataset.selected).toBe('false');
  });

  it('preserves the current selection across a Sort by Suit', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    fireEvent.click(slotOf('A', 'Spades'));
    fireEvent.click(screen.getByRole('button', { name: 'Sort Suit' }));
    expect(slotOf('A', 'Spades').dataset.selected).toBe('true');
    expect(slotOf('3', 'Clubs').dataset.selected).toBe('false');
  });

  it('remains usable (re-clickable) even when the hand already matches the requested order', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort Rank' }));
    const firstPass = orderedKeys();
    fireEvent.click(screen.getByRole('button', { name: 'Sort Rank' }));
    expect(orderedKeys()).toEqual(firstPass);
  });
});

describe('Drag reorder does not affect selection (M4-T07)', () => {
  it('a pointer gesture that moves past the drag threshold does not toggle selection, and the trailing click it produces is suppressed', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
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
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    const target = slotOf('7', 'Clubs');
    fireEvent.pointerDown(target, { pointerId: 2, clientX: 100, button: 0 });
    fireEvent.pointerMove(target, { pointerId: 2, clientX: 101 });
    fireEvent.pointerUp(target, { pointerId: 2, clientX: 101 });
    fireEvent.click(target);
    expect(target.dataset.selected).toBe('true');
  });

  it('moving a neighboring card never changes an already-selected card\'s selection', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    fireEvent.click(slotOf('2', 'Hearts'));
    expect(slotOf('2', 'Hearts').dataset.selected).toBe('true');
    const neighbor = slotOf('7', 'Clubs');
    fireEvent.pointerDown(neighbor, { pointerId: 3, clientX: 50, button: 0 });
    fireEvent.pointerMove(neighbor, { pointerId: 3, clientX: 220 });
    fireEvent.pointerUp(neighbor, { pointerId: 3, clientX: 220 });
    expect(slotOf('2', 'Hearts').dataset.selected).toBe('true');
  });

  it('a cancelled drag neither reorders the hand nor swallows the next, unrelated click (review fix)', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    const orderBefore = orderedKeys();
    const dragged = slotOf('3', 'Clubs');
    fireEvent.pointerDown(dragged, { pointerId: 4, clientX: 100, button: 0 });
    fireEvent.pointerMove(dragged, { pointerId: 4, clientX: 400 });
    expect(dragged.style.transform).not.toBe('');
    fireEvent.pointerCancel(dragged, { pointerId: 4, clientX: 400 });
    // Cleanup without a drop: same order, visual offset gone, and drag state cleared.
    expect(orderedKeys()).toEqual(orderBefore);
    expect(dragged.style.transform).toBe('');
    expect(dragged.className).not.toContain('dragging');
    // A cancelled gesture never produces a click, so the very next real click on any card must register.
    const other = slotOf('7', 'Clubs');
    fireEvent.click(other);
    expect(other.dataset.selected).toBe('true');
    fireEvent.click(dragged);
    expect(dragged.dataset.selected).toBe('true');
  });

  it('a pointercancel from a different pointer than the active drag is ignored', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    const dragged = slotOf('3', 'Clubs');
    fireEvent.pointerDown(dragged, { pointerId: 5, clientX: 100, button: 0 });
    fireEvent.pointerMove(dragged, { pointerId: 5, clientX: 400 });
    fireEvent.pointerCancel(dragged, { pointerId: 99 });
    expect(dragged.style.transform).not.toBe('');
    fireEvent.pointerUp(dragged, { pointerId: 5, clientX: 400 });
    expect(dragged.style.transform).toBe('');
  });
});

describe('A resize or orientation change during a drag cancels it (M5-T02; ui-ux.md §19.6.2)', () => {
  it.each(['resize', 'orientationchange'])('%s mid-drag drops nothing, keeps the order, and the release neither reorders nor selects', (eventType) => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    const orderBefore = orderedKeys();
    const dragged = slotOf('3', 'Clubs');
    fireEvent.pointerDown(dragged, { pointerId: 20, clientX: 100, button: 0 });
    fireEvent.pointerMove(dragged, { pointerId: 20, clientX: 400 });
    expect(dragged.style.transform).not.toBe('');

    fireEvent(window, new Event(eventType));
    expect(dragged.style.transform).toBe('');
    expect(dragged.className).not.toContain('dragging');

    // The pointer is still down: further movement and the release are ignored, and the click the release
    // produces on the same card does not turn the cancelled drag into a selection.
    fireEvent.pointerMove(dragged, { pointerId: 20, clientX: 500 });
    expect(dragged.style.transform).toBe('');
    fireEvent.pointerUp(dragged, { pointerId: 20, clientX: 500 });
    fireEvent.click(dragged);
    expect(orderedKeys()).toEqual(orderBefore);
    expect(dragged.dataset.selected).toBe('false');

    // Nothing extra is swallowed afterwards.
    fireEvent.click(dragged);
    expect(dragged.dataset.selected).toBe('true');
  });

  it('a layout-cancelled press that never became a drag still releases as an ordinary tap', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    const target = slotOf('A', 'Spades');
    fireEvent.pointerDown(target, { pointerId: 21, clientX: 100, button: 0 });
    fireEvent(window, new Event('resize'));
    fireEvent.pointerUp(target, { pointerId: 21, clientX: 100 });
    fireEvent.click(target);
    expect(target.dataset.selected).toBe('true');
  });

  it('a layout-cancelled drag released over a different card swallows nothing there', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    const orderBefore = orderedKeys();
    const dragged = slotOf('3', 'Clubs');
    const other = slotOf('7', 'Clubs');
    fireEvent.pointerDown(dragged, { pointerId: 22, clientX: 100, button: 0 });
    fireEvent.pointerMove(dragged, { pointerId: 22, clientX: 400 });
    fireEvent(window, new Event('resize'));
    // Released over another card: a browser sends no click to either card for that gesture.
    fireEvent.pointerUp(other, { pointerId: 22, clientX: 400 });
    expect(orderedKeys()).toEqual(orderBefore);
    fireEvent.click(other);
    expect(other.dataset.selected).toBe('true');
  });

  it('a resize with no drag in progress changes nothing', () => {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    const orderBefore = orderedKeys();
    fireEvent(window, new Event('resize'));
    const target = slotOf('2', 'Hearts');
    fireEvent.click(target);
    expect(target.dataset.selected).toBe('true');
    expect(orderedKeys()).toEqual(orderBefore);
  });
});

describe('Drag under a scaled play area (M4-T14)', () => {
  /** jsdom performs no layout: give the dragged slot a layout width (`offsetWidth`, unaffected by
   *  transforms) and a rendered rect (`getBoundingClientRect`, affected by the play area's own scale)
   *  whose ratio is the play-area scale, and the hand row a rect wide enough not to clamp. */
  function dragOnScaledArea(layoutWidth: number, renderedWidth: number, pointerDelta: number): string {
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    const dragged = slotOf('3', 'Clubs');
    Object.defineProperty(dragged, 'offsetWidth', { configurable: true, value: layoutWidth });
    dragged.getBoundingClientRect = () => ({ left: 100, right: 100 + renderedWidth, width: renderedWidth, top: 0, bottom: 40, height: 40, x: 100, y: 0, toJSON() {} });
    screen.getByRole('listbox', { name: 'Your hand' }).getBoundingClientRect = () => ({ left: 0, right: 1000, width: 1000, top: 0, bottom: 40, height: 40, x: 0, y: 0, toJSON() {} });
    fireEvent.pointerDown(dragged, { pointerId: 10, clientX: 100, button: 0 });
    fireEvent.pointerMove(dragged, { pointerId: 10, clientX: 100 + pointerDelta });
    const transform = dragged.style.transform;
    fireEvent.pointerUp(dragged, { pointerId: 10, clientX: 100 + pointerDelta });
    return transform;
  }

  it('compensates the pointer delta for a play area scaled below 1 so the card tracks the pointer', () => {
    // scale = 28 / 56 = 0.5: the card must move 120 layout px to travel 60 screen px.
    expect(dragOnScaledArea(56, 28, 60)).toBe('translateX(120px)');
  });

  it('compensates for a play area scaled above 1', () => {
    // scale = 112 / 56 = 2: 60 screen px is only 30 layout px.
    expect(dragOnScaledArea(56, 112, 60)).toBe('translateX(30px)');
  });

  it('applies the delta unchanged at scale 1, and when no layout width is available (scale falls back to 1)', () => {
    expect(dragOnScaledArea(56, 56, 60)).toBe('translateX(60px)');
    cleanup();
    expect(dragOnScaledArea(0, 56, 60)).toBe('translateX(60px)');
  });

  it('keeps the bounded-drag clamp in screen space: it can never leave the hand row, at any scale', () => {
    // Row right edge 1000, card right edge 100 + 28 = 128 -> at most 872 screen px = 1744 layout px at scale 0.5.
    expect(dragOnScaledArea(56, 28, 5000)).toBe('translateX(1744px)');
  });
});

describe('Selection cap (M4-T08)', () => {
  it('blocks selecting beyond maxSelectable while leaving existing selections and other cards clickable', () => {
    render(<HumanHand cards={hand} maxSelectable={2} />);
    fireEvent.click(slotOf('3', 'Clubs'));
    fireEvent.click(slotOf('A', 'Spades'));
    expect(slotOf('3', 'Clubs').dataset.selected).toBe('true');
    expect(slotOf('A', 'Spades').dataset.selected).toBe('true');
    // A third selection attempt is a no-op: it neither selects the new card nor disturbs the existing two.
    fireEvent.click(slotOf('7', 'Clubs'));
    expect(slotOf('7', 'Clubs').dataset.selected).toBe('false');
    expect(slotOf('3', 'Clubs').dataset.selected).toBe('true');
    expect(slotOf('A', 'Spades').dataset.selected).toBe('true');
    // Deselecting first frees a slot back up.
    fireEvent.click(slotOf('3', 'Clubs'));
    fireEvent.click(slotOf('7', 'Clubs'));
    expect(slotOf('3', 'Clubs').dataset.selected).toBe('false');
    expect(slotOf('7', 'Clubs').dataset.selected).toBe('true');
  });

  it('trims an existing selection down to a newly-lowered cap, keeping the earliest-order cards', () => {
    const { rerender } = render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} />);
    fireEvent.click(slotOf('3', 'Clubs'));
    fireEvent.click(slotOf('A', 'Spades'));
    fireEvent.click(slotOf('7', 'Clubs'));
    expect(slotOf('3', 'Clubs').dataset.selected).toBe('true');
    expect(slotOf('A', 'Spades').dataset.selected).toBe('true');
    expect(slotOf('7', 'Clubs').dataset.selected).toBe('true');
    // The current hand-to-beat shrank to a single card between Turns: only the first (in display order)
    // previously-selected card remains selected.
    rerender(<HumanHand cards={hand} maxSelectable={1} />);
    expect(slotOf('3', 'Clubs').dataset.selected).toBe('true');
    expect(slotOf('A', 'Spades').dataset.selected).toBe('false');
    expect(slotOf('7', 'Clubs').dataset.selected).toBe('false');
  });

  it('reports the current selection, as Card values in display order, to onSelectionChange', () => {
    const onSelectionChange = vi.fn();
    render(<HumanHand cards={hand} maxSelectable={FREE_PLAY_CAP} onSelectionChange={onSelectionChange} />);
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(slotOf('A', 'Spades'));
    expect(onSelectionChange).toHaveBeenLastCalledWith([{ rank: 'A', suit: 'spades' }]);
    fireEvent.click(slotOf('3', 'Clubs'));
    expect(onSelectionChange).toHaveBeenLastCalledWith([{ rank: '3', suit: 'clubs' }, { rank: 'A', suit: 'spades' }]);
    fireEvent.click(slotOf('A', 'Spades'));
    expect(onSelectionChange).toHaveBeenLastCalledWith([{ rank: '3', suit: 'clubs' }]);
  });
});

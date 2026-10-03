// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RoundResultOverlay } from '../../../src/ui/primitives/RoundResultOverlay';
import { PlayerPanel } from '../../../src/ui/primitives/PlayerPanel';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function motion(initial: boolean) {
  const listeners = new Set<() => void>();
  const query = { matches: initial, addEventListener: (_: string, listener: () => void) => listeners.add(listener), removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) };
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  return { change: (value: boolean) => act(() => { query.matches = value; listeners.forEach((listener) => listener()); }), listeners };
}

const seats = [
  { playerId: 'south', name: 'You', totalScore: 5 },
  { playerId: 'west', name: 'West', totalScore: 3 },
  { playerId: 'north', name: 'North', totalScore: 2 },
  { playerId: 'east', name: 'East', totalScore: 0 },
];
const placements = [
  { playerId: 'south', placement: 1, points: 5 },
  { playerId: 'west', placement: 2, points: 3 },
  { playerId: 'north', placement: 3, points: 2 },
  { playerId: 'east', placement: 4, points: 0 },
] as const;

it('opens settled with points and totals, focuses the heading, consumes skips, and requires deliberate continuation', () => {
  motion(true);
  vi.useFakeTimers();
  const onContinue = vi.fn();
  render(<RoundResultOverlay seats={seats} placements={placements} roundNumber={1} isFinalRound={false} onContinue={onContinue} />);
  const heading = screen.getByRole('heading');
  expect(document.activeElement).toBe(heading);
  expect(screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual([
    ['You', '0', '+5', '5'], ['West', '0', '+3', '3'], ['North', '0', '+2', '2'], ['East', '0', '+0', '0'],
  ]);
  expect(screen.getByRole('columnheader', { name: 'Round' }).className).not.toContain('settledHidden');
  fireEvent.keyDown(heading, { key: 'Enter' });
  fireEvent.keyDown(heading, { key: ' ', repeat: true });
  fireEvent.click(heading);
  act(() => vi.advanceTimersByTime(10000));
  expect(onContinue).not.toHaveBeenCalled();
  fireEvent.keyDown(heading, { key: 'Tab' });
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next Round' }));
  fireEvent.click(document.activeElement!);
  expect(onContinue).toHaveBeenCalledTimes(1);
});

it('settles a live preference change without replaying or hiding scores when changed back, and removes its listener', () => {
  const preference = motion(false);
  const { unmount } = render(<RoundResultOverlay seats={seats} placements={placements} roundNumber={1} isFinalRound={false} onContinue={vi.fn()} stageDelayMs={100000} />);
  expect(screen.queryByText('+5')).toBeNull();
  preference.change(true);
  expect(screen.getByText('+5')).toBeTruthy();
  preference.change(false);
  expect(screen.getByText('+5')).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Round' }).className).not.toContain('settledHidden');
  unmount();
  expect(preference.listeners.size).toBe(0);
});

it('keeps the Round 5 timer and pause gate under reduced motion; a skip does not advance it', () => {
  motion(true);
  vi.useFakeTimers();
  const onContinue = vi.fn();
  const props = { seats, placements, roundNumber: 5, isFinalRound: true, onContinue, autoAdvanceDelayMs: 900 };
  const { rerender } = render(<RoundResultOverlay {...props} paused />);
  fireEvent.keyDown(screen.getByRole('heading'), { key: ' ' });
  act(() => vi.advanceTimersByTime(10000));
  expect(onContinue).not.toHaveBeenCalled();
  expect(screen.queryByRole('button')).toBeNull();
  rerender(<RoundResultOverlay {...props} paused={false} />);
  expect(onContinue).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(900));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

it('replaces the deciding ring with text on live reduced-motion changes', () => {
  const preference = motion(false);
  render(<PlayerPanel name="West" cardCount={13} score={0} isCurrentTurn thinking passed={false} done={false} placement={null} />);
  expect(screen.getByRole('status').textContent).toBe('');
  preference.change(true);
  expect(screen.getByRole('status').textContent).toBe('deciding');
  preference.change(false);
  expect(screen.getByRole('status').textContent).toBe('');
});

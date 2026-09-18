// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoundResultOverlay } from '../../../src/ui/primitives/RoundResultOverlay';
import type { RoundResultPlacement, RoundResultSeatInput } from '../../../src/ui/primitives/RoundResultOverlay';

afterEach(cleanup);

/**
 * Fixture chosen so pre-Round and post-Round standings orders genuinely differ (a real reorder to
 * exercise, not a no-op): previous totals (`totalScore - points`) are West 10, North 7, South 5, East 3;
 * this Round's placements/points give South 1st (+5), West 2nd (+3), North 3rd (+2), East 4th (+0);
 * cumulative totals become West 13, South 10, North 9, East 3 — South and North swap relative order.
 */
const seats: readonly RoundResultSeatInput[] = [
  { playerId: 'south', name: 'You', totalScore: 10 },
  { playerId: 'west', name: 'Ana', totalScore: 13 },
  { playerId: 'north', name: 'Bo', totalScore: 9 },
  { playerId: 'east', name: 'Cy', totalScore: 3 },
];

const placements: readonly RoundResultPlacement[] = [
  { playerId: 'south', placement: 1, points: 5 },
  { playerId: 'west', placement: 2, points: 3 },
  { playerId: 'north', placement: 3, points: 2 },
  { playerId: 'east', placement: 4, points: 0 },
];

/** Player | Previous | Round | Total - always exactly these four cells, in this order, at every stage
 *  including settled (person's own explicit follow-up request: settling hides Previous/Round in place
 *  rather than removing them, so the table's own layout never shortens/reflows). Cell indices are
 *  therefore stable across every stage, unlike the single-column-relabeling design this replaced. */
function rowNames(): (string | null)[] {
  return screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0]!.textContent);
}
function rowPrevious(): (string | null)[] {
  return screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[1]!.textContent);
}
function rowRoundPoints(): (string | null)[] {
  return screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[2]!.textContent);
}
function rowTotals(): (string | null)[] {
  return screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[3]!.textContent);
}

/** Real `visibility: hidden` is a Playwright/real-browser concern (round-result.e2e.ts already covers
 *  it) - CSS Modules rules are never actually applied in jsdom, so a unit test can only observe that the
 *  settled-hidden class was applied, the same way other jsdom tests here check CSS-driven state (e.g.
 *  App.test.tsx's own `.tableDimmed` className checks) rather than a real computed style. */
function isMarkedSettledHidden(columnIndex: 1 | 2): boolean {
  const header = screen.getAllByRole('columnheader')[columnIndex]!;
  return header.className.includes('settledHidden');
}

describe('RoundResultOverlay (M4-T12; ui-ux.md §12)', () => {
  it('runs the pre-Round-order/points/updated-totals/reorder sequence in order, then stays settled', () => {
    vi.useFakeTimers();
    try {
      const onContinue = vi.fn();
      render(
        <RoundResultOverlay roundNumber={3} seats={seats} placements={placements} isFinalRound={false} onContinue={onContinue} stageDelayMs={500} />,
      );

      // Stage 1: rows appear arranged by standings before this Round's score. Previous already shows
      // each seat's own pre-Round total; Round/Total have nothing to show yet.
      expect(rowNames()).toEqual(['Ana', 'Bo', 'You', 'Cy']);
      expect(rowPrevious()).toEqual(['10', '7', '5', '3']);
      expect(rowRoundPoints()).toEqual(['—', '—', '—', '—']);
      expect(rowTotals()).toEqual(['—', '—', '—', '—']);
      expect(screen.getByRole('columnheader', { name: 'Previous' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Round' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Total' })).toBeTruthy();
      expect(screen.queryByText('+5')).toBeNull();
      // Always 4 columns, from the very first stage - settling later only ever hides Previous/Round in
      // place, never removes/adds a column (person's own follow-up request: no size adjustment at all).
      expect(screen.getAllByRole('row')[1]!.querySelectorAll('td')).toHaveLength(4);

      // Stage 2: this Round's own points (+5/+3/+2/+0) appear in Round; Previous/order unchanged; Total
      // still has nothing to show.
      act(() => { vi.advanceTimersByTime(500); });
      expect(rowNames()).toEqual(['Ana', 'Bo', 'You', 'Cy']);
      expect(rowPrevious()).toEqual(['10', '7', '5', '3']);
      expect(rowRoundPoints()).toEqual(['+3', '+2', '+5', '+0']);
      expect(rowTotals()).toEqual(['—', '—', '—', '—']);

      // Stage 3: Total reveals the new cumulative value (Previous + Round), still in pre-Round order.
      act(() => { vi.advanceTimersByTime(500); });
      expect(rowNames()).toEqual(['Ana', 'Bo', 'You', 'Cy']);
      expect(rowPrevious()).toEqual(['10', '7', '5', '3']);
      expect(rowRoundPoints()).toEqual(['+3', '+2', '+5', '+0']);
      expect(rowTotals()).toEqual(['13', '9', '10', '3']);

      // Stage 4: rows reorder by the new cumulative total; Previous/Round become hidden in place - still
      // 4 columns/cells, nothing shortens (person's own follow-up request) - only Player/Total actually
      // read as meaningful now.
      act(() => { vi.advanceTimersByTime(500); });
      expect(rowNames()).toEqual(['Ana', 'You', 'Bo', 'Cy']);
      expect(rowTotals()).toEqual(['13', '10', '9', '3']);
      expect(screen.getAllByRole('row')[1]!.querySelectorAll('td')).toHaveLength(4);
      expect(isMarkedSettledHidden(1)).toBe(true);
      expect(isMarkedSettledHidden(2)).toBe(true);

      // Settled is terminal: no further auto-advance, and never an automatic continuation.
      act(() => { vi.advanceTimersByTime(10_000); });
      expect(rowNames()).toEqual(['Ana', 'You', 'Bo', 'Cy']);
      expect(onContinue).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a click/tap anywhere in the modal skips straight to the settled state without calling onContinue (ui-ux.md §12)', () => {
    const onContinue = vi.fn();
    render(
      <RoundResultOverlay roundNumber={1} seats={seats} placements={placements} isFinalRound={false} onContinue={onContinue} stageDelayMs={10_000} />,
    );
    // A long stageDelayMs proves this is the click doing it, not a coincidental auto-advance.
    fireEvent.click(screen.getByRole('dialog'));
    expect(rowNames()).toEqual(['Ana', 'You', 'Bo', 'Cy']);
    expect(rowTotals()).toEqual(['13', '10', '9', '3']);
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeTruthy();
    expect(isMarkedSettledHidden(1)).toBe(true);
    expect(isMarkedSettledHidden(2)).toBe(true);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('keeps tied totals in the given relative seat order rather than inventing a ranking (ui-ux.md §12)', () => {
    const tiedSeats: readonly RoundResultSeatInput[] = [
      { playerId: 'south', name: 'You', totalScore: 5 },
      { playerId: 'west', name: 'Ana', totalScore: 5 },
      { playerId: 'north', name: 'Bo', totalScore: 5 },
      { playerId: 'east', name: 'Cy', totalScore: 0 },
    ];
    const tiedPlacements: readonly RoundResultPlacement[] = [
      { playerId: 'south', placement: 1, points: 5 },
      { playerId: 'west', placement: 1, points: 5 },
      { playerId: 'north', placement: 1, points: 5 },
      { playerId: 'east', placement: 4, points: 0 },
    ];
    render(
      <RoundResultOverlay roundNumber={1} seats={tiedSeats} placements={tiedPlacements} isFinalRound={false} onContinue={vi.fn()} stageDelayMs={0} />,
    );
    // South/West/North are tied (all 0 before, all 5 after) - the given seat order is preserved.
    expect(rowNames()).toEqual(['You', 'Ana', 'Bo', 'Cy']);
  });

  it('shows "Next Round" for an ordinary Round and calls onContinue only from that explicit button', () => {
    const onContinue = vi.fn();
    render(
      <RoundResultOverlay roundNumber={4} seats={seats} placements={placements} isFinalRound={false} onContinue={onContinue} stageDelayMs={0} />,
    );
    expect(screen.getByRole('button', { name: 'Next Round' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View Session Results' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next Round' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('shows no continuation button once isFinalRound is set (Round 5, ui-ux.md §12 follow-up: M4-T13 UI refinement) and instead calls onContinue automatically once settled', () => {
    vi.useFakeTimers();
    try {
      const onContinue = vi.fn();
      render(
        // A long stageDelayMs plus an explicit skip click (rather than waiting out the 4-stage
        // animation's own chained timers) isolates this test to the new settled->auto-advance behavior
        // itself, independent of the animation-sequencing mechanics the earlier tests already cover.
        <RoundResultOverlay roundNumber={5} seats={seats} placements={placements} isFinalRound onContinue={onContinue} stageDelayMs={10_000} autoAdvanceDelayMs={500} />,
      );
      expect(screen.queryByRole('button', { name: 'View Session Results' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Next Round' })).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();

      fireEvent.click(screen.getByRole('dialog'));
      expect(onContinue).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(499); });
      expect(onContinue).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1); });
      expect(onContinue).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('an ordinary Round (isFinalRound false) never auto-advances, regardless of autoAdvanceDelayMs', () => {
    vi.useFakeTimers();
    try {
      const onContinue = vi.fn();
      render(
        <RoundResultOverlay roundNumber={1} seats={seats} placements={placements} isFinalRound={false} onContinue={onContinue} stageDelayMs={0} autoAdvanceDelayMs={0} />,
      );
      act(() => { vi.advanceTimersByTime(10_000); });
      expect(onContinue).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Next Round' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('highlights the human player\'s own seat (South) but no other row (ui-ux.md §13 follow-up: M4-T13 UI refinement)', () => {
    render(
      <RoundResultOverlay roundNumber={1} seats={seats} placements={placements} isFinalRound={false} onContinue={vi.fn()} stageDelayMs={0} />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    const southRow = rows.find((row) => within(row).getAllByRole('cell')[0]!.textContent === 'You')!;
    expect(southRow.className).toContain('you');
    for (const row of rows) {
      if (row !== southRow) expect(row.className).not.toContain('you');
    }
  });

  it('is not dismissible: no Close control, and Escape neither closes it nor continues', () => {
    const onContinue = vi.fn();
    render(
      <RoundResultOverlay roundNumber={1} seats={seats} placements={placements} isFinalRound={false} onContinue={onContinue} stageDelayMs={0} />,
    );
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onContinue).not.toHaveBeenCalled();
  });
});

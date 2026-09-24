// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BasicRoundResult } from '../../../src/engine/rounds/resolveBasicRound';
import { resolveBasicSessionResult } from '../../../src/engine/sessions/basicSessionResult';
import type { GameEvent } from '../../../src/engine';
import { SessionSummary } from '../../../src/ui/primitives/SessionSummary';
import type { SessionSummarySeat } from '../../../src/ui/primitives/SessionSummary';

afterEach(cleanup);

const ids = ['south', 'west', 'north', 'east'];
const seats: readonly SessionSummarySeat[] = [
  { playerId: 'south', name: 'You' }, { playerId: 'west', name: 'Ana' },
  { playerId: 'north', name: 'Bo' }, { playerId: 'east', name: 'Cy' },
];
const NAMES = { south: 'You', west: 'Ana', north: 'Bo', east: 'Cy' };

/** Minimal but real public Session history (M4-T13 follow-up: the Event Log button/popup) - a Round
 *  start, one South Play, and one bot Play, enough to exercise both "You" highlighting and an ordinary
 *  entry once the popup is opened. */
const sampleEvents: readonly GameEvent[] = [
  { type: 'ROUND_STARTED', roundNumber: 1 },
  { type: 'CARDS_PLAYED', roundNumber: 1, playerId: 'south', combination: { type: 'single', cards: [{ rank: '3', suit: 'clubs' }] } },
  { type: 'PLAYER_PASSED', roundNumber: 1, playerId: 'west' },
];

function history(orders: readonly number[][]): BasicRoundResult[] {
  return orders.map((order) => ({ placements: order.map((player, index) => ({
    playerId: ids[player]!, placement: ([1, 2, 3, 4] as const)[index]!, points: ([5, 3, 2, 0] as const)[index]!,
  })) }));
}

/** North 1st (18), West 2nd (16), East 3rd (8), South 4th (8) - no ties anywhere, `decidedBy: 'totalScore'`
 *  (the same fixture already verified numerically in basic-session.test.ts). */
const clearRounds = history([[2, 1, 0, 3], [1, 2, 3, 0], [2, 3, 0, 1], [1, 3, 0, 2], [2, 1, 0, 3]]);

/** South and North genuinely tied for 1st (14 each, every tiebreak criterion equal); West 3rd (13);
 *  East 4th (9) - same fixture already verified in basic-session.test.ts's own tiebreak tests. */
const tiedRounds = history([[0, 1, 2, 3], [2, 3, 1, 0], [0, 3, 2, 1], [1, 3, 0, 2], [2, 1, 0, 3]]);

function renderSummary(result: ReturnType<typeof resolveBasicSessionResult>, rounds: readonly BasicRoundResult[], overrides: Partial<Parameters<typeof SessionSummary>[0]> = {}) {
  return render(
    <SessionSummary
      seats={seats} result={result} completedRounds={rounds} events={sampleEvents} names={NAMES}
      onPlayAgain={vi.fn()} onHome={vi.fn()} {...overrides}
    />,
  );
}

function rankingRows() {
  const table = screen.getByRole('table', { name: 'Final Ranking' });
  return within(table).getAllByRole('row').slice(1); // drop the header row
}

describe('SessionSummary (M4-T13; ui-ux.md §13)', () => {
  it('presents as a non-dismissible popup/overlay (ui-ux.md §13 follow-up: M4-T13 UI refinement)', () => {
    const result = resolveBasicSessionResult(ids, clearRounds);
    renderSummary(result, clearRounds);
    expect(screen.getByRole('dialog', { name: 'Session Summary' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
  });

  it('shows the official final ranking ordered 1st-4th with explicit placement text and final scores', () => {
    const result = resolveBasicSessionResult(ids, clearRounds);
    renderSummary(result, clearRounds);

    expect(screen.getByRole('heading', { name: 'Session Summary' })).toBeTruthy();
    const rows = rankingRows();
    expect(rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual([
      ['1st', 'Bo', '18'], ['2nd', 'Ana', '16'], ['3rd', 'Cy', '8'], ['4th', 'You', '8'],
    ]);
    // Ordinary (non-tiebreak) win: no tiebreak explanation is shown at all.
    expect(screen.queryByText(/tied/i)).toBeNull();
    expect(screen.queryByText(/tiebreak/i)).toBeNull();
  });

  it('gives 1st/2nd/3rd a distinct medal treatment (restrained gold/silver/bronze) and leaves 4th unmarked', () => {
    const result = resolveBasicSessionResult(ids, clearRounds);
    renderSummary(result, clearRounds);
    const rows = rankingRows();
    expect(rows[0]!.className).toContain('gold');
    expect(rows[1]!.className).toContain('silver');
    expect(rows[2]!.className).toContain('bronze');
    expect(rows[3]!.className).not.toMatch(/gold|silver|bronze/);
  });

  it("highlights the human player's own row in both tables, via each row's own name cell only, not the whole row (the person's own follow-up report: \"only the text color should glow cyan and not the background\")", () => {
    const result = resolveBasicSessionResult(ids, clearRounds);
    renderSummary(result, clearRounds);

    const rankingRow = rankingRows().find((row) => within(row).getAllByRole('cell')[1]!.textContent === 'You')!;
    expect(rankingRow.className).toContain('you');

    const roundsTable = screen.getByRole('table', { name: 'Round-by-Round Summary' });
    const roundsRow = within(roundsTable).getAllByRole('row').slice(1).find((row) => within(row).getAllByRole('cell')[0]?.textContent === 'You')!;
    expect(roundsRow.className).toContain('you');
  });

  it('marks a genuine Session-win tie with the same placement (not a fabricated 1st/2nd split), an explanatory note, and correctly skips to the next real placement', () => {
    const result = resolveBasicSessionResult(ids, tiedRounds);
    renderSummary(result, tiedRounds);

    const rows = rankingRows();
    // South and North both hold 1st (both gold, both "(tied)") - the placement after a 2-way tie for
    // 1st is 3, not 2, since two players already occupy 1st (standard competition ranking).
    expect(rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual([
      ['1st (tied)', 'You', '14'], ['1st (tied)', 'Bo', '14'], ['3rd', 'Ana', '13'], ['4th', 'Cy', '9'],
    ]);
    expect(rows[0]!.className).toContain('gold');
    expect(rows[0]!.className).toContain('you');
    expect(rows[1]!.className).toContain('gold');
    expect(rows[2]!.className).toContain('bronze');
    expect(rows[3]!.className).not.toMatch(/gold|silver|bronze/);
    // Explicit tiebreak explanation (ui-ux.md §13: "tiebreak explanation when relevant").
    expect(screen.getByText(/You and Bo are genuinely tied for 1st/)).toBeTruthy();
  });

  it('shows all five Round results per player alongside the final total, as plain point values with no +/- prefix (ui-ux.md §13 follow-up: M4-T13 UI refinement, Basic Mode has no loser deductions)', () => {
    const result = resolveBasicSessionResult(ids, clearRounds);
    renderSummary(result, clearRounds);
    const table = screen.getByRole('table', { name: 'Round-by-Round Summary' });
    // Player + 5 Round columns + Total = 7 header cells.
    expect(within(table).getAllByRole('columnheader')).toHaveLength(7);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    // Bo (north) finishes 1st in Rounds 1, 3 and 5 (5pts), 2nd in Round 2 (3pts), and 4th in Round 4
    // (0pts), totaling 18 (per the same `orders` fixture `basic-session.test.ts` verifies numerically).
    const boRow = rows.find((row) => within(row).getAllByRole('cell')[0]!.textContent === 'Bo')!;
    expect(within(boRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Bo', '5', '3', '5', '0', '5', '18']);
  });

  it('opens the whole Session\'s own Event Log, oldest-first, from its own button - not embedded as a permanent side panel (the person\'s own follow-up report: "it\'s still a button that when clicked, pops up the same window as the regular event log")', () => {
    const result = resolveBasicSessionResult(ids, clearRounds);
    renderSummary(result, clearRounds);

    // Not open by default - no embedded log column of its own.
    expect(screen.queryByRole('list', { name: 'Session event history' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Event Log' }));
    const dialog = screen.getByRole('dialog', { name: 'Event Log' });
    const log = within(dialog).getByRole('list', { name: 'Session event history' });
    const items = within(log).getAllByRole('listitem');
    // The played Single's own exact card shows as a visual badge alongside its entry, the same as the
    // live table's own Event Log (ui-ux.md §13 follow-up: "the card icons must be present too").
    expect(items.map((item) => item.textContent)).toEqual(['Round 1 started.', 'You played Single.3♣', 'Ana passed.']);
    expect(within(items[1]!).getAllByRole('img').map((badge) => badge.getAttribute('aria-label'))).toEqual(['3 of Clubs']);

    // Exitable, per the same follow-up report - its own ordinary dismissible-overlay Close control.
    fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog', { name: 'Event Log' })).toBeNull();
    // Session Summary itself is still open underneath - closing the log does not also leave the Summary.
    expect(screen.getByRole('dialog', { name: 'Session Summary' })).toBeTruthy();
  });

  it('makes the Summary\'s own actions inert while its Event Log is open, so Home/Play Again are not reachable underneath it', () => {
    const result = resolveBasicSessionResult(ids, clearRounds);
    renderSummary(result, clearRounds);
    const summary = screen.getByRole('dialog', { name: 'Session Summary' });
    expect(summary.hasAttribute('inert')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Event Log' }));
    expect(summary.hasAttribute('inert')).toBe(true);
    // The log's own dialog is a sibling of the Summary's panel, not inside the inert subtree.
    expect(screen.getByRole('dialog', { name: 'Event Log' }).closest('[inert]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close Event Log' }));
    expect(summary.hasAttribute('inert')).toBe(false);
  });

  it('shows a placeholder for an empty Event Log rather than an empty list', () => {
    const result = resolveBasicSessionResult(ids, clearRounds);
    renderSummary(result, clearRounds, { events: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Event Log' }));
    const log = screen.getByRole('list', { name: 'Session event history' });
    expect(within(log).getByText('No events yet this Session.')).toBeTruthy();
  });

  it('calls onPlayAgain and onHome from their own explicit buttons only', () => {
    const result = resolveBasicSessionResult(ids, clearRounds);
    const onPlayAgain = vi.fn();
    const onHome = vi.fn();
    renderSummary(result, clearRounds, { onPlayAgain, onHome });

    fireEvent.click(screen.getByRole('button', { name: 'Play Again' }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
    expect(onHome).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onHome).toHaveBeenCalledOnce();
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('orders its own actions Event Log, Home, Play Again (the person\'s own follow-up request)', () => {
    const result = resolveBasicSessionResult(ids, clearRounds);
    renderSummary(result, clearRounds);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Event Log', 'Home', 'Play Again']);
  });
});

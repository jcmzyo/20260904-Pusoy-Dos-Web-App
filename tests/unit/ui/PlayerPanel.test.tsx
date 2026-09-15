// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlayerPanel } from '../../../src/ui/primitives/PlayerPanel';

afterEach(cleanup);

describe('PlayerPanel status variants', () => {
  it('shows name, remaining count, and score with no status badge while idle', () => {
    render(<PlayerPanel name="West" cardCount={11} score={0} isCurrentTurn={false} passed={false} done={false} placement={null} />);
    const panel = screen.getByRole('region', { name: 'West panel' });
    expect(panel.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('11 cards · 0 pts')).toBeTruthy();
    expect(screen.queryByText(/PASS|DONE|Turn/)).toBeNull();
  });

  it('renders singular "card" for exactly one remaining card', () => {
    render(<PlayerPanel name="West" cardCount={1} score={0} isCurrentTurn={false} passed={false} done={false} placement={null} />);
    expect(screen.getByText('1 card · 0 pts')).toBeTruthy();
  });

  it('highlights the active turn with both a semantic marker and a readable label', () => {
    render(<PlayerPanel name="North" cardCount={13} score={5} isCurrentTurn passed={false} done={false} placement={null} />);
    const panel = screen.getByRole('region', { name: 'North panel' });
    expect(panel.getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('Turn')).toBeTruthy();
  });

  it('shows PASS for a player who passed this response cycle', () => {
    render(<PlayerPanel name="East" cardCount={9} score={2} isCurrentTurn={false} passed done={false} placement={null} />);
    expect(screen.getByText('PASS')).toBeTruthy();
  });

  it('shows DONE with ordinal placement once a player has finished the Round', () => {
    render(<PlayerPanel name="You" cardCount={0} score={5} isCurrentTurn={false} passed={false} done placement={1} />);
    expect(screen.getByText('DONE · 1st')).toBeTruthy();
  });

  it.each([
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
  ] as const)('formats placement %s as %s', (placement, label) => {
    render(<PlayerPanel name="Bot" cardCount={0} score={0} isCurrentTurn={false} passed={false} done placement={placement} />);
    expect(screen.getByText(`DONE · ${label}`)).toBeTruthy();
  });

  it('shows DONE without an ordinal when finished but not yet placed', () => {
    render(<PlayerPanel name="You" cardCount={0} score={0} isCurrentTurn={false} passed={false} done placement={null} />);
    expect(screen.getByText('DONE')).toBeTruthy();
  });

  it('prioritizes DONE over a lingering PASS flag and the turn highlight', () => {
    render(<PlayerPanel name="You" cardCount={0} score={5} isCurrentTurn passed done placement={1} />);
    expect(screen.getByText('DONE · 1st')).toBeTruthy();
    expect(screen.queryByText('PASS')).toBeNull();
    expect(screen.queryByText('Turn')).toBeNull();
  });

  it('prioritizes PASS over the turn highlight', () => {
    render(<PlayerPanel name="You" cardCount={5} score={0} isCurrentTurn passed done={false} placement={null} />);
    expect(screen.getByText('PASS')).toBeTruthy();
    expect(screen.queryByText('Turn')).toBeNull();
  });

  it('shows a "deciding" indicator only when thinking is explicitly passed (M4-T09 slice)', () => {
    render(<PlayerPanel name="West" cardCount={11} score={0} isCurrentTurn passed={false} done={false} placement={null} />);
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();
    render(<PlayerPanel name="West" cardCount={11} score={0} isCurrentTurn passed={false} done={false} placement={null} thinking />);
    expect(screen.getByRole('status', { name: 'West is deciding' })).toBeTruthy();
  });

  it('gives the panel a distinct glow for the current Turn and for each of 1st/2nd/3rd place, but not for an unplaced 4th finish (the person\'s own follow-up request)', () => {
    function classFor(overrides: { readonly isCurrentTurn?: boolean; readonly done?: boolean; readonly placement?: 1 | 2 | 3 | 4 | null }): string {
      render(
        <PlayerPanel
          name="X" cardCount={5} score={0} passed={false}
          isCurrentTurn={overrides.isCurrentTurn ?? false} done={overrides.done ?? false} placement={overrides.placement ?? null}
        />,
      );
      const panelClass = screen.getByRole('region', { name: 'X panel' }).className;
      cleanup();
      return panelClass;
    }
    const idle = classFor({});
    const turn = classFor({ isCurrentTurn: true });
    const gold = classFor({ done: true, placement: 1 });
    const silver = classFor({ done: true, placement: 2 });
    const bronze = classFor({ done: true, placement: 3 });
    const fourth = classFor({ done: true, placement: 4 });
    // Five genuinely distinct visual states...
    expect(new Set([idle, turn, gold, silver, bronze]).size).toBe(5);
    // ...and an unplaced/4th finish gets no special glow (same look as idle).
    expect(fourth).toBe(idle);
  });
});

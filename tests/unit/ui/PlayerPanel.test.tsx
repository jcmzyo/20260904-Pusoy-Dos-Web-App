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
});

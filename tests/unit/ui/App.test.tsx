// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionConfiguration, startSession } from '../../../src/application/startSession';
import type { StartedSession } from '../../../src/application/startSession';
import { SessionPresentation } from '../../../src/application/SessionPresentation';
import type { PlayerController } from '../../../src/orchestrator';
import { App, SessionTable } from '../../../src/ui/App';

afterEach(cleanup);

describe('Home and immediate Session startup', () => {
  it('subscribes the table to safe production snapshots across Round continuation', async () => {
    const session = startSession<PlayerController>(createSessionConfiguration(), {
      engineRng: { next: () => 0 }, humanController: { playerId: 'south', chooseMove: async (request) => request.legalMoves[0]! },
    });
    const presentation = new SessionPresentation(session);
    const { unmount } = render(<StrictMode><SessionTable presentation={presentation} /></StrictMode>);
    expect(screen.getByText('Basic · Round 1 of 5')).toBeTruthy();
    await act(async () => {
      let turns = 0;
      while (presentation.getSnapshot().status === 'ROUND_ACTIVE' && turns++ < 400) await presentation.runTurn();
      expect(presentation.getSnapshot().status).toBe('ROUND_RESULT');
      presentation.continueToNextRound();
    });
    expect(screen.getByText('Basic · Round 2 of 5')).toBeTruthy();
    unmount();
  });

  it('shows only Start Game on Home and does not start during StrictMode mounting', () => {
    const start = vi.fn();
    render(<StrictMode><App start={start} /></StrictMode>);
    expect(screen.getByRole('heading', { name: 'Pusoy Dos' })).toBeTruthy();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Start Game']);
    expect(start).not.toHaveBeenCalled();
  });

  it('opens a production Session table directly and ignores rapid activation before rerender', async () => {
    const start = vi.fn((configuration) => startSession(configuration, { engineRng: { next: () => 0 } }));
    render(<StrictMode><App start={start} /></StrictMode>);
    const button = screen.getByRole('button', { name: 'Start Game' });
    act(() => {
      button.click();
      button.click();
    });
    expect(await screen.findByRole('region', { name: 'Game Table' })).toBeTruthy();
    expect(screen.getByText('Basic · Round 1 of 5')).toBeTruthy();
    expect(start).toHaveBeenCalledExactlyOnceWith({ mode: 'basic', botNames: ['West', 'North', 'East'] });
    for (const name of ['You', 'West', 'North', 'East']) {
      expect(screen.getByRole('region', { name: `${name} panel` })).toBeTruthy();
    }
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Discard Pile', 'Event Log', 'Leave Game', 'Sort Rank', 'Sort Suit', 'Play', 'Pass']);
  });

  it('guards pending asynchronous startup and samples names only once', async () => {
    let resolve!: (session: StartedSession) => void;
    const start = vi.fn(() => new Promise<StartedSession>((done) => { resolve = done; }));
    const botNames = vi.fn(() => ['One', 'Two', 'Three'] as const);
    render(<App start={start} botNames={botNames} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    const pending = screen.getByRole('button', { name: 'Starting…' });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(pending);
    await act(async () => { resolve(startSession({ mode: 'basic', botNames: ['One', 'Two', 'Three'] }, { engineRng: { next: () => 0 } })); });
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ mode: 'basic', botNames: ['One', 'Two', 'Three'] });
    expect(botNames).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Game Table' })).toBeTruthy();
  });

  it('starts with the browser composition and default name provider', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    expect(await screen.findByRole('region', { name: 'Game Table' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['throw', 'reject'])('surfaces a startup %s and permits an explicit retry', async (failure) => {
    const session = startSession(createSessionConfiguration(), { engineRng: { next: () => 0 } });
    const start = vi.fn<() => StartedSession | Promise<StartedSession>>()
      .mockImplementationOnce(() => {
        if (failure === 'throw') throw new Error('Startup failed');
        return Promise.reject(new Error('Startup failed'));
      }).mockReturnValue(session);
    render(<App start={start} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Startup failed');
    expect(screen.queryByRole('region', { name: 'Game Table' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));
    expect(await screen.findByRole('region', { name: 'Game Table' })).toBeTruthy();
    expect(start).toHaveBeenCalledTimes(2);
  });
});

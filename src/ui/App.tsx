import { useRef, useState } from 'react';
import { createSessionConfiguration, startSession } from '../application/startSession';
import type { SessionConfiguration, StartedSession } from '../application/startSession';
import type { BotNameProvider } from '../application/botNames';
import styles from './App.module.css';

interface AppProps {
  readonly start?: (configuration: SessionConfiguration) => StartedSession | Promise<StartedSession>;
  readonly botNames?: BotNameProvider;
}

export function App({ start = startSession, botNames }: AppProps) {
  const started = useRef(false);
  const [session, setSession] = useState<StartedSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (started.current) return;
    started.current = true;
    setStarting(true);
    setError(null);
    try {
      setSession(await start(createSessionConfiguration(botNames)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      started.current = false;
    } finally {
      setStarting(false);
    }
  }

  if (session) {
    return (
      <main className={styles.shell}>
        <header className={styles.header}>
          <h1>Pusoy Dos</h1>
          <p>Basic · Round {session.initialView.roundNumber} of 5</p>
        </header>
        <section className={styles.table} aria-label="Game Table">
          <h2>Session started</h2>
          <p>Four players. Five rounds.</p>
          <ul className={styles.players}>
            {session.initialView.playerIds.map((id) => <li key={id}>{session.names[id]}</li>)}
          </ul>
        </section>
      </main>
    );
  }

  return (
    <main className={`${styles.shell} ${styles.home}`}>
      <p className={styles.eyebrow}>THE CLASSIC FOUR-PLAYER CARD GAME</p>
      <h1>Pusoy Dos</h1>
      <p>One table. Three opponents. Five rounds.</p>
      <button className={styles.start} onClick={handleStart} disabled={starting}>
        {starting ? 'Starting…' : 'Start Game'}
      </button>
      {error !== null && <p role="alert">Could not start the Session: {error}</p>}
    </main>
  );
}

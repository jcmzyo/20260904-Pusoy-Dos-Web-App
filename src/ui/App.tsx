import { useRef, useState, useSyncExternalStore } from 'react';
import { SessionPresentation } from '../application/SessionPresentation';
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
  const [session, setSession] = useState<SessionPresentation | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (started.current) return;
    started.current = true;
    setStarting(true);
    setError(null);
    try {
      setSession(new SessionPresentation(await start(createSessionConfiguration(botNames))));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      started.current = false;
    } finally {
      setStarting(false);
    }
  }

  if (session) {
    return <SessionTable presentation={session} />;
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

export function SessionTable({ presentation }: { readonly presentation: SessionPresentation }) {
  const snapshot = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot);
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1>Pusoy Dos</h1>
        <p>Basic · Round {snapshot.roundNumber} of 5</p>
      </header>
      <section className={styles.table} aria-label="Game Table">
        <h2>Session started</h2>
        <p>Four players. Five rounds.</p>
        <ul className={styles.players}>
          {snapshot.seats.map((seat) => <li key={seat.playerId}>{seat.name}</li>)}
        </ul>
      </section>
    </main>
  );
}

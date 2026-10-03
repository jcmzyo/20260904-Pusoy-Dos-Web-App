import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createSessionConfiguration, startSession } from '../../../src/application/startSession';
import { SessionPresentation } from '../../../src/application/SessionPresentation';
import type { PlayerController } from '../../../src/orchestrator';
import { EventLogOverlay } from '../../../src/ui/primitives/EventLogOverlay';
import { DiscardPileOverlay } from '../../../src/ui/primitives/DiscardPileOverlay';
import { LeaveConfirmOverlay } from '../../../src/ui/primitives/LeaveConfirmOverlay';
import { SessionSummary } from '../../../src/ui/primitives/SessionSummary';
import '../../../src/ui/App.module.css';

// Genuine public history from a reproducible production Round, including physically unique discards.
let seed = 8;
const presentation = new SessionPresentation(startSession<PlayerController>(createSessionConfiguration(), {
  engineRng: { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } },
  humanController: { playerId: 'south', chooseMove: async (request) => request.legalMoves.find((move) => move.kind === 'play') ?? request.legalMoves[0]! },
}));
const showSummary = new URLSearchParams(location.search).has('summary');
for (let round = 0; round < (showSummary ? 5 : 1); round++) {
  if (round > 0) presentation.continueToNextRound();
  for (let turn = 0; presentation.getSnapshot().status === 'ROUND_ACTIVE'; turn++) {
    if (turn >= 400) throw new Error('Portrait dialog fixture exceeded its Round turn budget.');
    const result = await presentation.runTurn();
    if (!result.accepted) throw new Error('Portrait dialog fixture Turn rejected.');
  }
}
const snapshot = presentation.getSnapshot();
presentation.destroy();
const names = Object.fromEntries(snapshot.seats.map((seat) => [seat.playerId, seat.name]));

function Fixture() {
  const [dialog, setDialog] = useState('');
  const close = () => setDialog('');
  return <>
    <main inert={dialog !== ''}>
      {['Event Log', 'Discard Pile', 'Leave Game'].map((title) => <button key={title} onClick={() => setDialog(title)}>{title}</button>)}
    </main>
    {dialog === 'Event Log' && <EventLogOverlay events={snapshot.events} names={names} onClose={close} />}
    {dialog === 'Discard Pile' && <DiscardPileOverlay cards={snapshot.playedCards} onClose={close} />}
    {dialog === 'Leave Game' && <LeaveConfirmOverlay onStay={close} onLeave={close} />}
  </>;
}

createRoot(document.getElementById('root')!).render(showSummary && snapshot.sessionResult
  ? <SessionSummary seats={snapshot.seats} result={snapshot.sessionResult} completedRounds={snapshot.completedRounds} events={snapshot.events} names={names} onHome={() => {}} onPlayAgain={() => {}} />
  : <Fixture />);

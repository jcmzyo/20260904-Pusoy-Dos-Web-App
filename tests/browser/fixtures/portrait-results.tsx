import { createRoot } from 'react-dom/client';
import { SessionPresentation } from '../../../src/application/SessionPresentation';
import { createSession, defaultRuleset, getPublicView, startRound } from '../../../src/engine';
import { GameRunner } from '../../../src/orchestrator';
import type { PlayerController } from '../../../src/orchestrator';
import { SessionTable } from '../../../src/ui/App';
import { isSupportedLayout, useLayoutSupport } from '../../../src/ui/primitives/useLayoutSupport';

let seed = 8;
const engineRng = { next: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; } };
const ids = ['south', 'west', 'north', 'east'];
const created = createSession(ids);
const started = startRound(created.state, engineRng);
const passiveSeat = new URLSearchParams(location.search).get('seat') ?? 'west';
// One passive seat retains a substantial reveal; every intention still comes from Engine legal Moves.
const controllers: PlayerController[] = ids.map((playerId) => ({ playerId, chooseMove: async (request) =>
  request.legalMoves.find((move) => move.kind === (playerId === passiveSeat ? 'pass' : 'play')) ?? request.legalMoves[0]! }));
const presentation = new SessionPresentation({
  runner: new GameRunner(started.state, defaultRuleset, new Map(controllers.map((controller) => [controller.playerId, controller])), true),
  humanController: controllers[0]!, engineRng, initialView: getPublicView(started.state),
  startupEvents: [...created.events, ...started.events], names: { south: 'You', west: 'West', north: 'North', east: 'East' },
});
const final = new URLSearchParams(location.search).has('final');
for (let round = 0; round < (final ? 5 : 1); round++) {
  if (round > 0) presentation.continueToNextRound();
  for (let turn = 0; presentation.getSnapshot().status === 'ROUND_ACTIVE'; turn++) {
    if (turn >= 400) throw new Error('Result fixture exceeded its Round turn budget.');
    const result = await presentation.runTurn();
    if (!result.accepted) throw new Error('Result fixture Turn rejected.');
  }
}

function Fixture() {
  const layout = useLayoutSupport();
  if (!isSupportedLayout(layout)) throw new Error('Result fixture requires a supported viewport.');
  return <SessionTable presentation={presentation} composition={layout} revealDurationMs={60000} resultStageDelayMs={60000} roundTransitionDurationMs={100} />;
}

createRoot(document.getElementById('root')!).render(<Fixture />);

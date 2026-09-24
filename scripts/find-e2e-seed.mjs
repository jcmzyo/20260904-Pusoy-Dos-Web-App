import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * Searches `?e2eSeed=` values (main.tsx's dev-server-only deterministic-RNG hook) for one that makes a
 * bot - not the human seat - finish 4th in Round 1 under tests/browser/round-result.e2e.ts's own minimal
 * human strategy (always Pass while responding; lead the single lowest legal card when forced), and
 * confirms that same seed also completes a full five-Round Session cleanly (used by
 * responsive-hardening.e2e.ts's own five-Round-completion scenario). Exists purely to justify the
 * `E2E_SEED`/`FIVE_ROUND_E2E_SEED` constants those two files hard-code (M4-P1 review finding: the
 * required deterministic browser acceptance suite was missing) - it is not itself part of any test run.
 *
 * Usage: node scripts/find-e2e-seed.mjs [seedCount]
 */

const sourceRoot = new URL('../src/', import.meta.url).href;

// The existing source uses extensionless/directory imports and parameter properties, same loader as
// scripts/simulation-trace.mjs.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith(sourceRoot)) {
      const base = new URL(specifier, context.parentURL).href;
      for (const suffix of ['.ts', '/index.ts']) {
        if (existsSync(new URL(base + suffix))) return { url: base + suffix, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && url.endsWith('.ts')) {
      return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        fileName: fileURLToPath(url), compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText };
    }
    return nextLoad(url, context);
  },
});

const { createSession, startRound, defaultRuleset, getPublicView } = await import('../src/engine/index.ts');
const { GameRunner } = await import('../src/orchestrator/index.ts');
const { BaselineController } = await import('../src/ai/index.ts');

// Mirrors main.tsx's own `createDeterministicRng` exactly.
function makeRng(seed) {
  let state = seed >>> 0;
  return { next: () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; } };
}

// Mirrors the human hand's own default "Sort by Rank" display order (ui/primitives/handOrdering.ts),
// which is what `hand.getByRole('img').first()` picks in the real browser test.
const RANK_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUIT_ORDER = ['clubs', 'spades', 'hearts', 'diamonds'];
const compareByRank = (a, b) => {
  const rank = RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
  return rank !== 0 ? rank : SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
};

/** Mirrors round-result.e2e.ts's/responsive-hardening.e2e.ts's own `driveRoundToResult`/
 *  `driveUnderFakeClock` human strategy exactly: Pass whenever legal, otherwise lead a single card (the
 *  opening's own required 3♣, or the lowest-ranked single otherwise). */
function chooseHumanMove(request) {
  const passMove = request.legalMoves.find((move) => move.kind === 'pass');
  if (passMove) return passMove;
  const singles = request.legalMoves.filter((move) => move.kind === 'play' && move.cards.length === 1);
  if (singles.length === 0) throw new Error('Expected at least one legal single-card lead.');
  const openingThreeClubs = singles.find((move) => move.cards[0].rank === '3' && move.cards[0].suit === 'clubs');
  return openingThreeClubs ?? [...singles].sort((a, b) => compareByRank(a.cards[0], b.cards[0]))[0];
}

function startSimulation(seed) {
  const rng = makeRng(seed);
  const ids = ['south', 'west', 'north', 'east'];
  const created = createSession(ids);
  const started = startRound(created.state, rng);
  const controllers = new Map([
    ['south', { playerId: 'south', chooseMove: async (request) => chooseHumanMove(request) }],
    ...['west', 'north', 'east'].map((id) => [id, new BaselineController(id)]),
  ]);
  return { runner: new GameRunner(started.state, defaultRuleset, controllers, true), rng };
}

async function simulateFullSession(seed, turnBudget) {
  const { runner, rng } = startSimulation(seed);
  const rounds = [];
  for (let turn = 0; turn < turnBudget; turn++) {
    const result = await runner.runTurn();
    if (!result.accepted) throw new Error(`Rejected Move at turn ${turn + 1} for seed ${seed}: ${JSON.stringify(result.error)}`);
    const publicView = getPublicView(result.state);
    if (publicView.round?.status !== 'completed') continue;
    const fourth = publicView.completedRounds.at(-1).placements.find((placement) => placement.placement === 4);
    rounds.push({ roundNumber: publicView.roundNumber, fourthPlace: fourth.playerId, turnsSoFar: turn + 1 });
    if (publicView.status === 'completed') return rounds;
    runner.continueToNextRound(rng);
  }
  throw new Error(`Session did not complete within ${turnBudget} turns for seed ${seed}.`);
}

const seedCount = Number(process.argv[2] ?? 300);
const candidates = [];
for (let seed = 1; seed <= seedCount; seed++) {
  // eslint-disable-next-line no-await-in-loop
  const rounds = await simulateFullSession(seed, 2000);
  if (rounds[0].fourthPlace !== 'south') candidates.push({ seed, round1FourthPlace: rounds[0].fourthPlace, totalTurns: rounds.at(-1).turnsSoFar });
}

console.log(`${candidates.length} / ${seedCount} seeds make a bot finish 4th in Round 1 (and all complete a full five-Round Session):`);
console.log(candidates.slice(0, 10));

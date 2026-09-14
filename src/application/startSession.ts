import { BaselineController } from '../ai';
import { createSession, defaultRuleset, getPublicView, startRound } from '../engine';
import type { GameEvent, PublicGameView, RNG } from '../engine';
import { GameRunner } from '../orchestrator';
import type { PlayerController } from '../orchestrator';
import { neutralBotNames } from './botNames';
import type { BotNameProvider, BotNames } from './botNames';

export interface SessionConfiguration {
  readonly mode: 'basic';
  readonly botNames: BotNames;
}

export function createSessionConfiguration(names: BotNameProvider = neutralBotNames): SessionConfiguration {
  return { mode: 'basic', botNames: names() };
}

export interface StartedSession {
  readonly runner: GameRunner;
  readonly engineRng: RNG;
  readonly initialView: PublicGameView;
  readonly startupEvents: readonly GameEvent[];
  readonly names: Readonly<Record<string, string>>;
}

interface StartupDependencies {
  readonly engineRng?: RNG;
  readonly humanController?: PlayerController;
}

/** Initializes the production execution; Turn driving and human input are connected separately. */
export function startSession(configuration: SessionConfiguration, dependencies: StartupDependencies = {}): StartedSession {
  if (configuration.mode !== 'basic') throw new Error('Only Basic Sessions are supported.');
  if (configuration.botNames.length !== 3 || configuration.botNames.some((name) => name.trim().length === 0)) {
    throw new Error('Session startup requires three non-empty bot names.');
  }
  const human = dependencies.humanController ?? {
    playerId: 'south',
    async chooseMove(): Promise<never> { throw new Error('Human input must be connected before driving Turns.'); },
  };
  if (human.playerId !== 'south') throw new Error('The human controller must represent South.');
  const engineRng = dependencies.engineRng ?? { next: () => crypto.getRandomValues(new Uint32Array(1))[0]! / 0x100000000 };
  const bots = ['west', 'north', 'east'].map((id) => new BaselineController(id));
  const controllers = new Map([human, ...bots].map((controller) => [controller.playerId, controller]));
  const created = createSession(['south', 'west', 'north', 'east']);
  const started = startRound(created.state, engineRng);
  return {
    runner: new GameRunner(started.state, defaultRuleset, controllers),
    engineRng,
    initialView: getPublicView(started.state),
    startupEvents: [...created.events, ...started.events],
    names: { south: 'You', west: configuration.botNames[0], north: configuration.botNames[1], east: configuration.botNames[2] },
  };
}

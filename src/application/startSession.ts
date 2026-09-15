import { BaselineController } from '../ai';
import { createSession, defaultRuleset, getPublicView, startRound } from '../engine';
import type { GameEvent, PublicGameView, RNG } from '../engine';
import { GameRunner, HumanController } from '../orchestrator';
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

export interface StartedSession<T extends PlayerController = PlayerController> {
  readonly runner: GameRunner;
  readonly humanController: T;
  readonly engineRng: RNG;
  readonly initialView: PublicGameView;
  readonly startupEvents: readonly GameEvent[];
  readonly names: Readonly<Record<string, string>>;
}

interface StartupDependencies<T extends PlayerController> {
  readonly engineRng?: RNG;
  readonly humanController?: T;
}

/** Initializes the production execution and human input; the caller drives Turns explicitly. */
export function startSession<T extends PlayerController = HumanController>(configuration: SessionConfiguration, dependencies: StartupDependencies<T> = {}): StartedSession<T | HumanController> {
  if (configuration.mode !== 'basic') throw new Error('Only Basic Sessions are supported.');
  if (configuration.botNames.length !== 3 || configuration.botNames.some((name) => name.trim().length === 0)) {
    throw new Error('Session startup requires three non-empty bot names.');
  }
  const human = dependencies.humanController ?? new HumanController('south');
  if (human.playerId !== 'south') throw new Error('The human controller must represent South.');
  const engineRng = dependencies.engineRng ?? { next: () => crypto.getRandomValues(new Uint32Array(1))[0]! / 0x100000000 };
  const bots = ['west', 'north', 'east'].map((id) => new BaselineController(id));
  const controllers = new Map([human, ...bots].map((controller) => [controller.playerId, controller]));
  const created = createSession(['south', 'west', 'north', 'east']);
  const started = startRound(created.state, engineRng);
  return {
    runner: new GameRunner(started.state, defaultRuleset, controllers),
    humanController: human,
    engineRng,
    initialView: getPublicView(started.state),
    startupEvents: [...created.events, ...started.events],
    names: { south: 'You', west: configuration.botNames[0], north: configuration.botNames[1], east: configuration.botNames[2] },
  };
}

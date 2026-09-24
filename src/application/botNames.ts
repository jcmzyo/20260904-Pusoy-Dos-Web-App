import type { RNG } from '../engine';

export type BotNames = readonly [string, string, string];
export type BotNameProvider = () => BotNames;

export const neutralBotNames: BotNameProvider = () => ['West', 'North', 'East'];

export function createBotNameProvider(pool: readonly string[], rng: RNG): BotNameProvider {
  const names = [...pool];
  if (names.length < 3 || names.some((name) => name.trim().length === 0) || new Set(names).size !== names.length) {
    throw new Error('Bot-name pool requires at least three distinct, non-empty names.');
  }
  return () => {
    const remaining = [...names];
    const pick = (): string => {
      const value = rng.next();
      if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Bot-name RNG must return a value in [0, 1).');
      return remaining.splice(Math.floor(value * remaining.length), 1)[0]!;
    };
    return [pick(), pick(), pick()];
  };
}

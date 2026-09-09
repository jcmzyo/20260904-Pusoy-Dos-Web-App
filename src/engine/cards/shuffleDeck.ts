import type { Card } from '../../domain';
import type { RNG } from '../rng/RNG';

/** Fisher-Yates shuffle of a copy; consumes one RNG value per card after the first. */
export function shuffleDeck(deck: readonly Card[], rng: RNG): Card[] {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = rng.next();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('RNG.next() must return a finite number in [0, 1).');
    }
    const swapIndex = Math.floor(value * (index + 1));
    const card = shuffled[index]!;
    shuffled[index] = shuffled[swapIndex]!;
    shuffled[swapIndex] = card;
  }

  return shuffled;
}

export interface RNG {
  /** Returns a finite value in [0, 1); uniform values yield an unbiased shuffle. */
  next(): number;
}

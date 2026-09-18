/**
 * Deterministic random source used by generated conformance tests
 */
export interface Random {
  /**
   * Return the next floating-point value in the range [0, 1)
   */
  next(): number

  /**
   * Return an integer in the range [0, maxExclusive)
   */
  int(maxExclusive: number): number

  /**
   * Return a deterministic boolean value
   */
  bool(): boolean
}

/**
 * Create a deterministic pseudo-random generator from a numeric seed
 *
 * The generator intentionally avoids runtime randomness so failing property
 * cases can be reproduced exactly from the same seed.
 *
 * **Parameters**
 * - `seed` – Unsigned seed used to initialize the generator state
 */
export function createRandom(seed: number): Random {
  let state = seed >>> 0

  const next = (): number => {
    // Advance the state with a compact integer mixing sequence
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int(maxExclusive) {
      return Math.floor(next() * maxExclusive)
    },
    bool() {
      return next() >= 0.5
    },
  }
}

/**
 * Pick one deterministic value from a non-empty readonly collection
 *
 * **Parameters**
 * - `random` – Deterministic random source
 * - `values` – Candidate values to choose from
 */
export function pick<T>(random: Random, values: readonly T[]): T {
  return values[random.int(values.length)]!
}

import type { Random } from "./random";
import { createRandom } from "./random";

export interface GeneratedCasesOptions<Value> {
  /** Stable seed written in the test so failures can always be reproduced. */
  seed: number;
  /** Number of generated cases to execute. */
  cases: number;
  /** Creates one input from the deterministic random source. */
  generate: (random: Random, index: number) => Value;
  /** Verifies the generated input. */
  check: (value: Value, index: number) => void;
}

/**
 * Executes a deterministic generated-property loop.
 *
 * Keep generation and assertion separate so a failing seed/index can be
 * reproduced without changing the helper or introducing a property library.
 */
export function checkGeneratedCases<Value>(
  options: GeneratedCasesOptions<Value>,
): number {
  const random = createRandom(options.seed);

  for (let index = 0; index < options.cases; index++) {
    options.check(options.generate(random, index), index);
  }

  return options.cases;
}

/** Runs one assertion repeatedly without duplicating loop boilerplate. */
export function repeatCases(
  count: number,
  check: (index: number) => void,
): number {
  for (let index = 0; index < count; index++) check(index);
  return count;
}

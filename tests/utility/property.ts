import type { Random } from "./random"
import { createRandom } from "./random"

/**
 * Configuration for a deterministic generated fuzz pass
 */
export interface GeneratedCasesOptions<Value> {
  /**
   * Stable seed used to reproduce generated cases
   */
  seed: number

  /**
   * Number of generated cases to execute
   */
  cases: number

  /**
   * Create one case from the deterministic random source
   */
  generate: (random: Random, index: number) => Value

  /**
   * Verify one generated case
   */
  check: (value: Value, index: number) => void
}

/**
 * Execute a deterministic generated-property loop
 *
 * Generation and assertion stay separate so a failing seed and case index can
 * be reproduced without introducing a separate fuzzing framework.
 *
 * **Parameters**
 * - `options` – Seed, case count, generator, and assertion callback
 */
export function checkGeneratedCases<Value>(options: GeneratedCasesOptions<Value>): number {
  const random = createRandom(options.seed)

  for (let index = 0; index < options.cases; index++) {
    options.check(options.generate(random, index), index)
  }

  return options.cases
}

/**
 * Execute one assertion repeatedly without duplicating loop boilerplate
 *
 * **Parameters**
 * - `count` – Number of iterations to execute
 * - `check` – Assertion callback invoked with the current index
 */
export function repeatCases(count: number, check: (index: number) => void): number {
  for (let index = 0; index < count; index++) check(index)
  return count
}

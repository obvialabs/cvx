import { expect } from "bun:test"

/**
 * Compare the same inputs against a current implementation and a reference
 *
 * **Parameters**
 * - `inputs` – Inputs shared by both implementations
 * - `current` – CVX implementation under test
 * - `reference` – Reference implementation used for differential validation
 *
 * **Returns**
 * - Number of comparisons executed
 */
export function expectParity<Input, Output>(
  inputs: Iterable<Input>,
  current: (input: Input) => Output,
  reference: (input: Input) => Output,
): number {
  let comparisons = 0

  for (const input of inputs) {
    expect(current(input)).toBe(reference(input))
    comparisons++
  }

  return comparisons
}

/**
 * Compare argument-tuple fixtures against two variadic implementations
 *
 * The call signatures remain intentionally broad because the compared
 * libraries model rest arguments differently while the fixtures stay strongly
 * typed at their declaration sites.
 *
 * **Parameters**
 * - `cases` – Variadic argument tuples to replay
 * - `current` – CVX implementation under test
 * - `reference` – Reference implementation used for differential validation
 */
export function expectCallParity<Output>(
  cases: readonly (readonly unknown[])[],
  current: (...args: any[]) => Output,
  reference: (...args: any[]) => Output,
): number {
  return expectParity(
    cases,
    (args) => current(...args),
    (args) => reference(...args),
  )
}

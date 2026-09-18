import { expect } from "bun:test";

/**
 * Runs the same input through a current implementation and a reference.
 *
 * The helper deliberately accepts an input adapter instead of assuming
 * variadic arguments so it works for class utilities, variant resolvers and
 * internal engines with the same small API.
 */
export function expectParity<Input, Output>(
  inputs: Iterable<Input>,
  current: (input: Input) => Output,
  reference: (input: Input) => Output,
): number {
  let comparisons = 0;

  for (const input of inputs) {
    expect(current(input)).toBe(reference(input));
    comparisons++;
  }

  return comparisons;
}

/**
 * Compares argument-tuple fixtures against two variadic implementations.
 *
 * The call signatures are intentionally broad: individual libraries model
 * their rest arguments differently (mutable arrays, readonly tuples, union
 * arrays), while the fixture itself remains strongly typed at the call site.
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
  );
}

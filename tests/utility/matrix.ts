/**
 * Extract the member type produced by one cartesian axis
 */
export type AxisValue<Axis> = Axis extends readonly (infer Value)[] ? Value : never

/**
 * Map a tuple of cartesian axes to the tuple yielded for each generated case
 */
export type CartesianValues<Axes extends readonly (readonly unknown[])[]> = {
  [Index in keyof Axes]: AxisValue<Axes[Index]>
}

/**
 * Visit every cartesian combination without allocating the complete product
 *
 * Large parity suites can exercise tens of thousands of combinations. Walking
 * the matrix incrementally keeps those suites readable without creating a
 * second in-memory copy of the entire product.
 *
 * **Parameters**
 * - `axes` – Ordered value collections that define the cartesian dimensions
 * - `visit` – Callback invoked with each combination and its zero-based index
 *
 * **Returns**
 * - Number of generated combinations
 */
export function forEachCartesian<const Axes extends readonly (readonly unknown[])[]>(
  axes: Axes,
  visit: (values: CartesianValues<Axes>, index: number) => void,
): number {
  if (axes.length === 0) {
    visit([] as unknown as CartesianValues<Axes>, 0)
    return 1
  }

  const current = new Array<unknown>(axes.length)
  let count = 0

  const walk = (depth: number): void => {
    // Emit a copy only when all axes have a selected value
    if (depth === axes.length) {
      visit(current.slice() as CartesianValues<Axes>, count++)
      return
    }

    // Reuse the working tuple while traversing the current axis
    for (const value of axes[depth]!) {
      current[depth] = value
      walk(depth + 1)
    }
  }

  walk(0)
  return count
}

/**
 * Visit a fixed case list and return the number of executed cases
 *
 * **Parameters**
 * - `cases` – Cases to execute in their declared order
 * - `visit` – Callback invoked for each case
 */
export function forEachCase<const Case>(
  cases: readonly Case[],
  visit: (value: Case, index: number) => void,
): number {
  for (let index = 0; index < cases.length; index++) {
    visit(cases[index]!, index)
  }

  return cases.length
}

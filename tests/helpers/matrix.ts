/** Extracts the member type produced by one cartesian axis. */
export type AxisValue<Axis> = Axis extends readonly (infer Value)[] ? Value : never;

/** Maps a tuple of cartesian axes to the tuple of values yielded per case. */
export type CartesianValues<
  Axes extends readonly (readonly unknown[])[],
> = {
  [Index in keyof Axes]: AxisValue<Axes[Index]>;
};

/**
 * Visits every cartesian combination without allocating the complete product.
 *
 * This keeps large parity matrices readable while avoiding a giant temporary
 * array in tests that may exercise tens of thousands of combinations.
 */
export function forEachCartesian<
  const Axes extends readonly (readonly unknown[])[],
>(
  axes: Axes,
  visit: (values: CartesianValues<Axes>, index: number) => void,
): number {
  if (axes.length === 0) {
    visit([] as unknown as CartesianValues<Axes>, 0);
    return 1;
  }

  const current = new Array<unknown>(axes.length);
  let count = 0;

  const walk = (depth: number): void => {
    if (depth === axes.length) {
      visit(current.slice() as CartesianValues<Axes>, count++);
      return;
    }

    for (const value of axes[depth]!) {
      current[depth] = value;
      walk(depth + 1);
    }
  };

  walk(0);
  return count;
}

/** Visits a fixed case list and returns how many cases were executed. */
export function forEachCase<const Case>(
  cases: readonly Case[],
  visit: (value: Case, index: number) => void,
): number {
  for (let index = 0; index < cases.length; index++) {
    visit(cases[index]!, index);
  }

  return cases.length;
}

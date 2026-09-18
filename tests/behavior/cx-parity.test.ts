import { describe, expect, test } from "bun:test";
import { cx as legacyCx } from "class-variance-authority";
import { cx as betaCx } from "cva";
import { clsx } from "clsx";

import { cx } from "../../src/index";
import { expectCallParity } from "../helpers";

const cases = [
  ["button", "active", "px-4"],
  ["button", false, null, undefined, "visible"],
  ["button", ["nested", ["deep"]], { active: true, hidden: false }],
  [{ a: true, b: 1, c: 0 }, "tail"],
  ["a", 1, 2, [3, { four: true }]],
] as const;

describe("cx behavior parity", () => {
  test("matches clsx across supported class-value shapes", () => {
    expectCallParity(
      cases,
      (...values) => cx(...values),
      (...values) => clsx(...values),
    );
  });

  test("matches both CVA class composers", () => {
    expectCallParity(
      cases,
      (...values) => cx(...values),
      (...values) => legacyCx(...values),
    );
    expectCallParity(
      cases,
      (...values) => cx(...values),
      (...values) => betaCx(...values),
    );
  });

  test("keeps CVX bigint support as an intentional superset", () => {
    expect(cx("a", 2n, [3n])).toBe("a 2 3");
  });
});

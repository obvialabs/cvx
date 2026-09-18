import { describe, expect, test } from "bun:test";

import {
  checkGeneratedCases,
  createRandom,
  expectParity,
  forEachCartesian,
  forEachCase,
  generateClassValue,
  generateUtility,
  median,
  repeatCases,
} from "../helpers";

describe("test helpers", () => {
  test("cartesian traversal preserves axis order and reports case count", () => {
    const seen: string[] = [];
    const count = forEachCartesian(
      [
        ["a", "b"],
        [1, 2, 3],
      ] as const,
      ([letter, number]) => seen.push(`${letter}${number}`),
    );

    expect(count).toBe(6);
    expect(seen).toEqual(["a1", "a2", "a3", "b1", "b2", "b3"]);
  });

  test("case traversal keeps original values and indices", () => {
    const seen: string[] = [];
    expect(forEachCase(["a", "b"], (value, index) => seen.push(`${index}:${value}`))).toBe(2);
    expect(seen).toEqual(["0:a", "1:b"]);
  });

  test("generated checks are deterministic for the same seed", () => {
    const first: number[] = [];
    const second: number[] = [];

    const run = (target: number[]) =>
      checkGeneratedCases({
        seed: 0x12345678,
        cases: 32,
        generate: (random) => random.int(1_000),
        check: (value) => target.push(value),
      });

    expect(run(first)).toBe(32);
    expect(run(second)).toBe(32);
    expect(first).toEqual(second);
  });

  test("repeatCases executes the requested number of assertions", () => {
    let calls = 0;
    expect(repeatCases(25, (index) => {
      expect(index).toBe(calls++);
    })).toBe(25);
    expect(calls).toBe(25);
  });

  test("parity helper returns the number of compared inputs", () => {
    expect(expectParity([1, 2, 3], (value) => value * 2, (value) => value + value)).toBe(3);
  });

  test("fixture generators remain reproducible", () => {
    const left = createRandom(0xbeef);
    const right = createRandom(0xbeef);

    for (let index = 0; index < 100; index++) {
      expect(generateUtility(left)).toBe(generateUtility(right));
      expect(generateClassValue(left)).toEqual(generateClassValue(right));
    }
  });

  test("median uses a sorted copy and returns the middle sample", () => {
    const input = [9, 1, 5, 3, 7];
    expect(median(input)).toBe(5);
    expect(input).toEqual([9, 1, 5, 3, 7]);
  });
});

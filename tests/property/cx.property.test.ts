import { describe, expect, test } from "bun:test";
import { clsx } from "clsx";

import { cx } from "../../src/index";
import type { ClassValue } from "../../src/cx/types";
import {
  checkGeneratedCases,
  classWords,
  generateClassValue,
  pick,
} from "../helpers";

describe("cx properties", () => {
  test("matches clsx for thousands of generated supported inputs", () => {
    const comparisons = checkGeneratedCases({
      seed: 0xc0ffee,
      cases: 5_000,
      generate: (random) =>
        Array.from({ length: random.int(8) }, () => generateClassValue(random)),
      check: (inputs) => {
        expect(cx(...inputs)).toBe(clsx(...(inputs as Parameters<typeof clsx>)));
      },
    });

    expect(comparisons).toBe(5_000);
  });

  test("variadic and nested-array forms are equivalent", () => {
    checkGeneratedCases({
      seed: 0xabc123,
      cases: 3_000,
      generate: (random) =>
        Array.from({ length: random.int(10) }, () => generateClassValue(random)),
      check: (inputs) => {
        expect(cx(...inputs)).toBe(cx(inputs));
      },
    });
  });

  test("inserting falsy values never changes output", () => {
    checkGeneratedCases({
      seed: 0x515151,
      cases: 2_000,
      generate: (random) => [pick(random, classWords), pick(random, classWords)] as const,
      check: ([left, right]) => {
        const expected = cx(left, right);
        expect(cx(left, false, null, undefined, "", 0, 0n, right)).toBe(expected);
      },
    });
  });

  test("repeated evaluation is deterministic", () => {
    checkGeneratedCases({
      seed: 0x777777,
      cases: 1_000,
      generate: (random) =>
        Array.from({ length: random.int(8) }, () => generateClassValue(random)),
      check: (inputs) => {
        const first = cx(...inputs);
        expect(cx(...inputs)).toBe(first);
        expect(cx(...inputs)).toBe(first);
      },
    });
  });

  test("top-level object ordering is preserved", () => {
    checkGeneratedCases({
      seed: 0x818181,
      cases: 1_000,
      generate: (random) => {
        const keys = Array.from({ length: 1 + random.int(5) }, () => pick(random, classWords));
        const object: Record<string, boolean> = {};
        for (const key of keys) object[key] = true;
        return object;
      },
      check: (object) => {
        expect(cx(object)).toBe(clsx(object));
      },
    });
  });
});

import { describe, expect, test } from "bun:test";
import { clsx } from "clsx";

import { cx, type ClassValue } from "../../src/index";
import { createRandom, pick, type Random } from "../helpers/random";

const words = ["alpha", "beta", "gamma", "delta", "px-2", "text-sm"] as const;

function generateValue(random: Random, depth = 0): ClassValue {
  const leaf = () => {
    switch (random.int(7)) {
      case 0:
        return pick(random, words);
      case 1:
        return random.int(6);
      case 2:
        return random.bool();
      case 3:
        return null;
      case 4:
        return undefined;
      case 5:
        return { [pick(random, words)]: random.bool() };
      default:
        return "";
    }
  };

  if (depth >= 3 || random.int(4) !== 0) return leaf();
  return Array.from({ length: random.int(5) }, () =>
    generateValue(random, depth + 1),
  );
}

describe("cx properties", () => {
  test("matches clsx for thousands of generated supported inputs", () => {
    const random = createRandom(0xc0ffee);

    for (let caseIndex = 0; caseIndex < 5_000; caseIndex++) {
      const inputs = Array.from({ length: random.int(8) }, () =>
        generateValue(random),
      );

      expect(cx(...inputs)).toBe(clsx(...(inputs as Parameters<typeof clsx>)));
    }
  });

  test("variadic and nested-array forms are equivalent", () => {
    const random = createRandom(0xabc123);

    for (let caseIndex = 0; caseIndex < 3_000; caseIndex++) {
      const inputs = Array.from({ length: random.int(10) }, () =>
        generateValue(random),
      );

      expect(cx(...inputs)).toBe(cx(inputs));
    }
  });

  test("inserting falsy values never changes output", () => {
    const random = createRandom(0x515151);

    for (let caseIndex = 0; caseIndex < 2_000; caseIndex++) {
      const left = pick(random, words);
      const right = pick(random, words);
      const expected = cx(left, right);

      expect(cx(left, false, null, undefined, "", 0, 0n, right)).toBe(
        expected,
      );
    }
  });

  test("repeated evaluation is deterministic", () => {
    const random = createRandom(0x777777);

    for (let caseIndex = 0; caseIndex < 1_000; caseIndex++) {
      const inputs = Array.from({ length: 6 }, () => generateValue(random));
      const expected = cx(...inputs);

      expect(cx(...inputs)).toBe(expected);
      expect(cx(...inputs)).toBe(expected);
    }
  });
});

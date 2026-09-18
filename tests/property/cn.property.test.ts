import { describe, expect, test } from "bun:test";
import { clsx } from "clsx";
import { twMerge as baselineTwMerge } from "tailwind-merge";

import { cn } from "../../src/index";
import type { ClassValue } from "../../src/cx/types";
import {
  checkGeneratedCases,
  generateUtility,
  pick,
  utilityGroups,
} from "../helpers";

describe("cn properties", () => {
  test("matches clsx + tailwind-merge for generated utility sequences", () => {
    const comparisons = checkGeneratedCases({
      seed: 0xdeadbeef,
      cases: 8_000,
      generate: (random) => {
        const length = 1 + random.int(10);
        const inputs: ClassValue[] = [];

        for (let index = 0; index < length; index++) {
          const utility = generateUtility(random);
          switch (random.int(4)) {
            case 0:
              inputs.push(utility);
              break;
            case 1:
              inputs.push([utility]);
              break;
            case 2:
              inputs.push({ [utility]: true });
              break;
            default:
              inputs.push(random.bool() && utility);
          }
        }

        return inputs;
      },
      check: (inputs) => {
        expect(cn(...inputs)).toBe(
          baselineTwMerge(clsx(...(inputs as Parameters<typeof clsx>))),
        );
      },
    });

    expect(comparisons).toBe(8_000);
  });

  test("merge output is idempotent", () => {
    checkGeneratedCases({
      seed: 0x10203040,
      cases: 5_000,
      generate: (random) =>
        Array.from({ length: 1 + random.int(12) }, () => generateUtility(random)),
      check: (utilities) => {
        const once = cn(...utilities);
        expect(cn(once)).toBe(once);
        expect(cn(once, once)).toBe(once);
      },
    });
  });

  test("adding a later member of one conflict group matches baseline replacement", () => {
    checkGeneratedCases({
      seed: 0x42424242,
      cases: 3_000,
      generate: (random) => {
        const stable = generateUtility(random);
        const group = pick(random, utilityGroups);
        return [stable, pick(random, group), pick(random, group)] as const;
      },
      check: (inputs) => {
        expect(cn(...inputs)).toBe(baselineTwMerge(clsx(...inputs)));
      },
    });
  });
});

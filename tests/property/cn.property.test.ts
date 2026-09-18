import { describe, expect, test } from "bun:test";
import { clsx } from "clsx";
import { twMerge as baselineTwMerge } from "tailwind-merge";

import { cn } from "../../src/index";
import type { ClassValue } from "../../src/cx/types";
import { createRandom, pick } from "../helpers/random";

const utilityPools = [
  ["p-0", "p-1", "p-2", "p-4", "p-8"],
  ["px-0", "px-2", "px-4", "px-8"],
  ["py-0", "py-2", "py-4", "py-8"],
  ["m-0", "m-2", "m-4", "-m-2", "mx-auto"],
  ["text-xs", "text-sm", "text-base", "text-lg", "text-xl"],
  ["text-red-500", "text-blue-500", "text-green-500"],
  ["bg-red-500", "bg-blue-500", "bg-green-500"],
  ["rounded-none", "rounded-sm", "rounded-lg", "rounded-full"],
  ["border-0", "border", "border-2", "border-4"],
  ["w-[10px]", "w-[20px]", "w-[calc(100%-1rem)]"],
  ["opacity-0", "opacity-50", "opacity-100"],
] as const;

const modifiers = ["", "hover:", "focus:", "md:", "dark:", "md:hover:"] as const;

function randomUtility(random: ReturnType<typeof createRandom>): string {
  const base = pick(random, pick(random, utilityPools));
  const modifier = pick(random, modifiers);
  return `${modifier}${base}`;
}

describe("cn properties", () => {
  test("matches clsx + tailwind-merge for generated utility sequences", () => {
    const random = createRandom(0xdeadbeef);

    for (let caseIndex = 0; caseIndex < 8_000; caseIndex++) {
      const length = 1 + random.int(10);
      const inputs: ClassValue[] = [];

      for (let index = 0; index < length; index++) {
        const utility = randomUtility(random);
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

      expect(cn(...inputs)).toBe(baselineTwMerge(clsx(...(inputs as Parameters<typeof clsx>))));
    }
  });

  test("merge output is idempotent", () => {
    const random = createRandom(0x10203040);

    for (let caseIndex = 0; caseIndex < 5_000; caseIndex++) {
      const utilities = Array.from({ length: 1 + random.int(12) }, () =>
        randomUtility(random),
      );
      const once = cn(...utilities);

      expect(cn(once)).toBe(once);
      expect(cn(once, once)).toBe(once);
    }
  });

  test("adding a later member of one conflict group matches baseline replacement", () => {
    const random = createRandom(0x42424242);

    for (let caseIndex = 0; caseIndex < 3_000; caseIndex++) {
      const stable = randomUtility(random);
      const group = pick(random, utilityPools);
      const first = pick(random, group);
      const second = pick(random, group);
      const inputs = [stable, first, second] as const;

      expect(cn(...inputs)).toBe(baselineTwMerge(clsx(...inputs)));
    }
  });
});

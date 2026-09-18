import { describe, expect, test } from "bun:test";
import { clsx } from "clsx";
import {
  extendTailwindMerge as baselineExtendTailwindMerge,
  twMerge as baselineTwMerge,
} from "tailwind-merge";

import { cn } from "../../src/index";
import { createCn, createTwMerge } from "../../src/cn/internal/configuration";

const utilities = [
  "p-0",
  "p-2",
  "p-4",
  "px-3",
  "py-5",
  "m-2",
  "-m-4",
  "mx-auto",
  "text-xs",
  "text-sm",
  "text-lg",
  "text-red-500",
  "text-blue-600",
  "bg-red-500",
  "bg-blue-500",
  "rounded-sm",
  "rounded-xl",
  "border",
  "border-2",
  "border-red-500",
  "hover:p-2",
  "hover:p-4",
  "focus:p-6",
  "md:text-sm",
  "md:text-xl",
  "dark:bg-black",
  "w-[10px]",
  "w-[20px]",
  "h-[calc(100%-1rem)]",
  "text-[length:12px]",
  "text-[color:red]",
  "[mask-type:luminance]",
  "[mask-type:alpha]",
  "!m-2",
  "!m-4",
  "leading-6",
  "text-lg/7",
] as const;

describe("cn differential parity", () => {
  test("matches clsx + tailwind-merge across a broad utility matrix", () => {
    let comparisons = 0;

    for (let a = 0; a < utilities.length; a++) {
      for (let b = 0; b < utilities.length; b++) {
        for (let c = 0; c < utilities.length; c += 4) {
          const inputs = [
            utilities[a],
            a % 2 === 0 && utilities[b],
            [utilities[c], { "font-semibold": b % 2 === 0 }],
          ] as const;

          expect(cn(...inputs)).toBe(baselineTwMerge(clsx(...inputs)));
          comparisons++;
        }
      }
    }

    expect(comparisons).toBeGreaterThan(10_000);
  });

  test("matches arbitrary modifier/property conflict behavior", () => {
    const cases = [
      ["[color:red]", "[color:blue]"],
      ["w-[10px]", "w-[calc(100%-2rem)]"],
      ["hover:[color:red]", "hover:[color:blue]"],
      ["md:hover:p-2", "hover:md:p-4"],
      ["text-lg/6", "text-sm/7"],
      ["!p-2", "!p-8", "p-4"],
      ["before:content-['a']", "before:content-['b']"],
      ["data-[state=open]:p-2", "data-[state=open]:p-4"],
    ] as const;

    for (const values of cases) {
      expect(cn(...values)).toBe(baselineTwMerge(clsx(...values)));
    }
  });

  test("custom cn config matches tailwind-merge extension semantics", () => {
    const extension = {
      extend: {
        classGroups: {
          "font-size": [{ text: ["hero", "tiny", "display"] }],
        },
      },
    } as const;

    const current = createCn(extension);
    const baseline = baselineExtendTailwindMerge(extension);

    const cases = [
      ["text-sm", "text-hero"],
      ["text-hero", "text-lg"],
      ["hover:text-tiny", "hover:text-hero"],
      ["p-2", "p-4", "text-display"],
      ["md:text-display", "md:text-tiny"],
    ] as const;

    for (const values of cases) {
      expect(current(...values)).toBe(baseline(...values));
    }
  });

  test("custom twMerge-compatible function matches tailwind-merge extension", () => {
    const extension = {
      extend: {
        classGroups: {
          shadow: [{ shadow: ["soft", "hard"] }],
        },
      },
    } as const;

    const current = createTwMerge(extension);
    const baseline = baselineExtendTailwindMerge(extension);
    const cases = [
      ["shadow-sm", "shadow-soft"],
      ["shadow-soft", "shadow-hard"],
      ["hover:shadow-soft", "hover:shadow-hard"],
    ] as const;

    for (const values of cases) {
      expect(current(...values)).toBe(baseline(...values));
    }
  });
});

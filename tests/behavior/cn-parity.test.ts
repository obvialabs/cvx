import { describe, expect, test } from "bun:test";
import { clsx } from "clsx";
import {
  extendTailwindMerge as baselineExtendTailwindMerge,
  twMerge as baselineTwMerge,
} from "tailwind-merge";

import { cn } from "../../src/index";
import { createConfiguredCn, createConfiguredMerge } from "../../src/cn/internal/factory";
import { expectCallParity, forEachCartesian } from "../helpers";

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
    const indexes = utilities.map((_, index) => index);
    const sampledIndexes = indexes.filter((index) => index % 4 === 0);
    const comparisons = forEachCartesian(
      [indexes, indexes, sampledIndexes] as const,
      ([a, b, c]) => {
        const inputs = [
          utilities[a],
          a % 2 === 0 && utilities[b],
          [utilities[c], { "font-semibold": b % 2 === 0 }],
        ] as const;

        expect(cn(...inputs)).toBe(baselineTwMerge(clsx(...inputs)));
      },
    );

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

    expectCallParity(
      cases,
      (...values) => cn(...values),
      (...values) => baselineTwMerge(clsx(...values)),
    );
  });

  test("custom cn config matches tailwind-merge extension semantics", () => {
    const extension = {
      extend: {
        classGroups: {
          "font-size": [{ text: ["hero", "tiny", "display"] }],
        },
      },
    } as const;

    const current = createConfiguredCn(extension);
    const baseline = baselineExtendTailwindMerge(extension);

    const cases = [
      ["text-sm", "text-hero"],
      ["text-hero", "text-lg"],
      ["hover:text-tiny", "hover:text-hero"],
      ["p-2", "p-4", "text-display"],
      ["md:text-display", "md:text-tiny"],
    ] as const;

    expectCallParity(cases, current, baseline);
  });

  test("custom twMerge-compatible function matches tailwind-merge extension", () => {
    const extension = {
      extend: {
        classGroups: {
          shadow: [{ shadow: ["soft", "hard"] }],
        },
      },
    } as const;

    const current = createConfiguredMerge(extension);
    const baseline = baselineExtendTailwindMerge(extension);
    const cases = [
      ["shadow-sm", "shadow-soft"],
      ["shadow-soft", "shadow-hard"],
      ["hover:shadow-soft", "hover:shadow-hard"],
    ] as const;

    expectCallParity(cases, current, baseline);
  });
});

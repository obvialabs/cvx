import { describe, expect, test } from "bun:test";
import { extendTailwindMerge as baselineExtend } from "tailwind-merge";

import { createConfiguredCn } from "../../src/cn/internal/factory";
import { expectCallParity, repeatCases } from "../helpers";

describe("custom configuration behavior parity", () => {
  test("prefix handling matches tailwind-merge", () => {
    const extension = { prefix: "tw" } as const;
    const current = createConfiguredCn(extension);
    const baseline = baselineExtend(extension);
    const cases = [
      ["tw:p-2", "tw:p-4"],
      ["tw:hover:p-2", "tw:hover:p-4"],
      ["p-2", "p-4", "tw:p-2", "tw:p-4"],
    ] as const;

    expectCallParity(cases, current, baseline);
  });

  test("cache size changes storage policy, not observable merge semantics", () => {
    const uncached = createConfiguredCn({ cacheSize: 0 });
    const cached = createConfiguredCn({ cacheSize: 100 });
    const cases = [
      ["p-2", "p-4"],
      ["text-sm", "text-lg", "font-bold"],
      ["hover:p-2", "hover:p-4", "md:text-xl"],
      ["w-[10px]", "w-[30px]"],
    ] as const;

    repeatCases(20, () => {
      expectCallParity(cases, cached, uncached);
    });
  });
});

import { describe, expect, test } from "bun:test";

import { defaultConfig } from "../../src/cn/internal/factory";
import { compileToTables } from "../../src/cn/internal/compiler/index";
import { createEngine } from "../../src/cn/internal/engine/index";
import {
  composeClassValues,
  joinMergeInputs,
  wrapComposer,
} from "../../src/cn/internal/engine/compose";

describe("cn runtime engine", () => {
  const build = (cacheSize: number) => {
    const { tables, validatorImpls, prefix } = compileToTables(defaultConfig());
    return createEngine(tables, validatorImpls, { cacheSize, prefix });
  };

  test("cached and uncached engines have identical merge semantics", () => {
    const cached = build(64);
    const uncached = build(0);
    const cases = [
      "p-2 p-4",
      "text-sm text-lg font-bold",
      "hover:p-2 hover:p-4 md:text-xl",
      "w-[10px] w-[30px]",
      "[color:red] [color:blue]",
      "!m-2 !m-4 m-1",
    ];

    for (const input of cases) {
      expect(cached.mergeString(input)).toBe(uncached.mergeString(input));
      expect(cached.mergeUncached(input)).toBe(uncached.mergeUncached(input));
    }
  });

  test("seenBefore records whole-string sightings", () => {
    const engine = build(8);
    const input = "p-2 p-4 text-sm";

    expect(engine.seenBefore(input)).toBe(false);
    expect(engine.seenBefore(input)).toBe(true);
  });

  test("merge accepts nested twMerge-compatible arrays", () => {
    const engine = build(8);

    expect(engine.merge("p-2", ["p-4", ["text-sm", "text-lg"]])).toBe(
      "p-4 text-lg",
    );
  });

  test("engine composition modes keep object and merge-input behavior distinct", () => {
    expect(composeClassValues("a", { b: true, c: false }, ["d"])).toBe("a b d");
    expect(joinMergeInputs("a", ["b", ["c"]])).toBe("a b c");
  });

  test("composition wrapper handles string identity hot paths without changing semantics", () => {
    const merge = wrapComposer((value) => value.toUpperCase());

    expect(merge("a", "b")).toBe("A B");
    expect(merge("a", "b")).toBe("A B");
    expect(merge(["a", { b: true }])).toBe("A B");
  });
});

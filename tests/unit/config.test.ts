import { describe, expect, test } from "bun:test";

import {
  createConfiguredCn,
  createConfiguredMerge,
  defaultConfig,
  fromTheme,
  mergeConfigs,
  validators,
} from "../../src/cn/internal/factory";

describe("custom cn configuration", () => {
  test("createConfiguredCn extends class groups", () => {
    const merge = createConfiguredCn({
      extend: {
        classGroups: {
          "font-size": [{ text: ["hero", "tiny"] }],
        },
      },
    });

    expect(merge("text-sm", "text-hero")).toBe("text-hero");
    expect(merge("text-tiny", "text-lg")).toBe("text-lg");
  });

  test("createConfiguredMerge exposes string/nested-array merge semantics", () => {
    const merge = createConfiguredMerge();

    expect(merge("p-2", ["p-4", "text-sm"], "text-lg")).toBe(
      "p-4 text-lg",
    );
  });

  test("supports transform-based custom configuration", () => {
    const merge = createConfiguredCn((config) =>
      mergeConfigs(config, {
        extend: {
          classGroups: {
            "font-size": [{ text: ["display"] }],
          },
        },
      }),
    );

    expect(merge("text-sm", "text-display")).toBe("text-display");
  });

  test("defaultConfig produces an independent mutable config object", () => {
    const first = defaultConfig();
    const second = defaultConfig();

    expect(first).not.toBe(second);
    expect(first.classGroups).not.toBe(second.classGroups);
  });

  test("fromTheme and validator markers use compiler-recognized forms", () => {
    expect(fromTheme("spacing")).toEqual({ $t: "spacing" });
    expect(validators.isNumber).toEqual({ $v: "isNumber" });
    expect(validators.isArbitraryLength).toEqual({ $v: "isArbitraryLength" });
  });
});

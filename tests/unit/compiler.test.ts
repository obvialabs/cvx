import { describe, expect, test } from "bun:test";

import { defaultConfig } from "../../src/config";
import {
  compileStats,
  compileToSource,
  compileToTables,
  mergeConfigs,
  subsetConfig,
  type CnConfig,
} from "../../src/cn/internal/compiler";

describe("cn compiler", () => {
  test("compiles the default model to dense engine tables", () => {
    const config = defaultConfig();
    const compiled = compileToTables(config);
    const stats = compileStats(config);

    expect(compiled.tables.GROUP_COUNT).toBe(stats.groups);
    expect(compiled.tables.edgeStart.length).toBeGreaterThan(1);
    expect(compiled.tables.labelText.length).toBeGreaterThan(100);
    expect(compiled.tables.nodeGroup.length).toBeGreaterThan(1);
    expect(stats.groups).toBeGreaterThan(100);
    expect(stats.nodes).toBeGreaterThan(100);
    expect(stats.edges).toBeGreaterThan(100);
  });

  test("subsets unused groups while preserving groups needed by a token corpus", () => {
    const config = defaultConfig();
    const subset = subsetConfig(config, [
      "p-2",
      "p-4",
      "text-sm",
      "text-lg",
      "bg-red-500",
      "hover:p-4",
    ]);

    expect(subset.usedGroups).toBeGreaterThan(0);
    expect(subset.totalGroups).toBeGreaterThan(subset.usedGroups);
    expect(Object.keys(subset.config.classGroups).length).toBeGreaterThan(0);
    expect(Object.keys(subset.config.classGroups).length).toBeLessThan(
      Object.keys(config.classGroups).length,
    );
  });

  test("mergeConfigs extends and overrides without mutating the base config", () => {
    const base = defaultConfig();
    const originalFontSize = [...base.classGroups["font-size"]!];
    const merged = mergeConfigs(base, {
      prefix: "tw",
      override: {
        orderSensitiveModifiers: ["before", "after"],
      },
      extend: {
        classGroups: {
          "font-size": [{ text: ["hero"] }],
        },
        conflictingClassGroups: {
          p: ["px"],
        },
      },
    });

    expect(merged).not.toBe(base);
    expect(merged.prefix).toBe("tw");
    expect(merged.orderSensitiveModifiers).toEqual(["before", "after"]);
    expect(merged.classGroups["font-size"]!.length).toBe(
      originalFontSize.length + 1,
    );
    expect(base.classGroups["font-size"]).toEqual(originalFontSize);
  });

  test("emits JavaScript and TypeScript table modules", () => {
    const config = defaultConfig();
    const js = compileToSource(config, { banner: "// generated-test" });
    const ts = compileToSource(config, { lang: "ts" });

    expect(js).toContain("// generated-test");
    expect(js).toContain("export default");
    expect(ts).toContain("Int32Array");
    expect(ts).toContain("export default");
  });

  test("rejects source emission for non-serializable custom validators", () => {
    const config = defaultConfig();
    const custom: CnConfig = {
      ...config,
      classGroups: {
        ...config.classGroups,
        custom: [{ custom: [(value: string) => value === "ok"] }],
      },
    };

    expect(() => compileToSource(custom)).toThrow(/custom validator functions/i);
  });
});

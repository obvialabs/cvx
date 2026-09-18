import { describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import {
  type CnConfig,
  compileStats,
  compileToSource,
  compileToTables,
  mergeConfigs,
  subsetConfig,
} from "../src/cn/internal/compiler"
import { createEngine } from "../src/cn/internal/engine"
import {
  createConfiguredCn,
  defaultConfig,
} from "../src/cn/internal/factory"

const toArray = (value: ArrayLike<number>): number[] => Array.from(value)

describe("compiler", () => {
  test("default configuration compiles into a structurally complete model", () => {
    const config = defaultConfig()
    const compiled = compileToTables(config)
    const stats = compileStats(config)

    expect(compiled.tables.GROUP_COUNT).toBe(stats.groups)
    expect(compiled.tables.edgeStart.length).toBeGreaterThan(1)
    expect(compiled.tables.labelText.length).toBeGreaterThan(100)
    expect(compiled.tables.nodeGroup.length).toBeGreaterThan(1)
    expect(stats.groups).toBeGreaterThan(100)
    expect(stats.nodes).toBeGreaterThan(100)
    expect(stats.edges).toBeGreaterThan(100)
  })

  test("table source emission reconstructs the same compiled data", async () => {
    const config = defaultConfig()
    const expected = compileToTables(config).tables
    const directory = mkdtempSync(join(tmpdir(), "cvx-tables-"))
    const file = join(directory, "tables.mjs")

    try {
      writeFileSync(file, compileToSource(config))

      const generated = (await import(`${pathToFileURL(file).href}?v=${Date.now()}`)).default

      expect(generated.GROUP_COUNT).toBe(expected.GROUP_COUNT)
      expect(toArray(generated.edgeStart)).toEqual(toArray(expected.edgeStart))
      expect(toArray(generated.labelStart)).toEqual(toArray(expected.labelStart))
      expect(generated.labelText).toBe(expected.labelText)
      expect(toArray(generated.edgeTarget)).toEqual(toArray(expected.edgeTarget))
      expect(toArray(generated.nodeGroup)).toEqual(toArray(expected.nodeGroup))
      expect(toArray(generated.nodeVlist)).toEqual(toArray(expected.nodeVlist))
      expect(toArray(generated.vlistPat)).toEqual(toArray(expected.vlistPat))
      expect(toArray(generated.vlistOps)).toEqual(toArray(expected.vlistOps))
      expect(toArray(generated.vlistRef)).toEqual(toArray(expected.vlistRef))
      expect(toArray(generated.vlistGroup)).toEqual(toArray(expected.vlistGroup))
      expect(toArray(generated.litAnchor)).toEqual(toArray(expected.litAnchor))
      expect(toArray(generated.litGroup)).toEqual(toArray(expected.litGroup))
      expect(toArray(generated.litPool)).toEqual(toArray(expected.litPool))
      expect(toArray(generated.poolOffsets)).toEqual(toArray(expected.poolOffsets))
      expect(generated.poolText).toBe(expected.poolText)
      expect(toArray(generated.adjGid)).toEqual(toArray(expected.adjGid))
      expect(toArray(generated.adjStart)).toEqual(toArray(expected.adjStart))
      expect(toArray(generated.adjTgt)).toEqual(toArray(expected.adjTgt))
      expect(toArray(generated.patGid)).toEqual(toArray(expected.patGid))
      expect(toArray(generated.patTgt)).toEqual(toArray(expected.patTgt))
      expect(toArray(generated.postfixLookupGroups)).toEqual(
        toArray(expected.postfixLookupGroups),
      )
      expect(generated.orderSensitiveModifiers).toBe(
        expected.orderSensitiveModifiers,
      )
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("subsetting removes unused groups without mutating the source configuration", () => {
    const config = defaultConfig()
    const sourceGroups = Object.keys(config.classGroups)
    const subset = subsetConfig(config, [
      "p-2",
      "p-4",
      "text-sm",
      "text-lg",
      "bg-red-500",
      "hover:p-4",
    ])

    expect(subset.usedGroups).toBeGreaterThan(0)
    expect(subset.totalGroups).toBe(sourceGroups.length)
    expect(Object.keys(subset.config.classGroups).length).toBeLessThan(
      sourceGroups.length,
    )
    expect(Object.keys(config.classGroups)).toEqual(sourceGroups)
  })

  test("configuration extensions preserve untouched base data", () => {
    const base = defaultConfig()
    const originalFontSize = [...base.classGroups["font-size"]!]
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
    })

    expect(merged).not.toBe(base)
    expect(merged.prefix).toBe("tw")
    expect(merged.orderSensitiveModifiers).toEqual(["before", "after"])
    expect(merged.classGroups["font-size"]!.length).toBe(
      originalFontSize.length + 1,
    )
    expect(base.classGroups["font-size"]).toEqual(originalFontSize)
  })

  test("custom validator functions are rejected by standalone source emission", () => {
    const config = defaultConfig()
    const custom: CnConfig = {
      ...config,
      classGroups: {
        ...config.classGroups,
        custom: [{ custom: [(value: string) => value === "ok"] }],
      },
    }

    expect(() => compileToSource(custom)).toThrow(/custom validator functions/i)
  })

  test("cached and uncached engines remain observationally equivalent", () => {
    const { tables, validatorImpls, prefix } = compileToTables(defaultConfig())
    const cached = createEngine(tables, validatorImpls, { cacheSize: 64, prefix })
    const uncached = createEngine(tables, validatorImpls, { cacheSize: 0, prefix })
    const inputs = [
      "p-2 p-4",
      "text-sm text-lg font-bold",
      "hover:p-2 hover:p-4 md:text-xl",
      "w-[10px] w-[30px]",
      "[color:red] [color:blue]",
      "!m-2 !m-4 m-1",
    ]

    for (const input of inputs) {
      expect(cached.mergeString(input)).toBe(uncached.mergeString(input))
      expect(cached.mergeUncached(input)).toBe(uncached.mergeUncached(input))
    }
  })

  test("configured compiler extensions remain executable after compilation", () => {
    const merge = createConfiguredCn({
      extend: {
        classGroups: {
          "font-size": [{ text: ["hero", "display"] }],
        },
      },
    })

    expect(merge("text-sm", "text-hero")).toBe("text-hero")
    expect(merge("text-display", "text-lg")).toBe("text-lg")
  })
})

import { describe, expect, test } from "bun:test"

import { defaultConfig } from "../src/cn/internal/factory"
import { compileToTables } from "../src/cn/internal/compiler"
import { createEngine } from "../src/cn/internal/engine"
import {
  composeClassValues,
  joinMergeInputs,
  wrapComposer,
} from "../src/cn/internal/engine/compose"
import type { CnConfig } from "../src/cn/internal/compiler"

describe("cn engine", () => {
  test("normalizes low-level and full class-value grammars independently", () => {
    expect(joinMergeInputs("a", ["b", ["c"]], false, null)).toBe("a b c")
    expect(joinMergeInputs({ active: true } as any)).toBe("")

    expect(
      composeClassValues(
        "a",
        ["b", { c: true, skipped: false }],
        2,
        3n,
      ),
    ).toBe("a b c 2 3")
  })

  test("executes custom validators and rejects engines missing their implementations", () => {
    const base = defaultConfig()
    const custom: CnConfig = {
      ...base,
      classGroups: {
        ...base.classGroups,
        custom: [
          {
            custom: [
              // Custom validators remain runtime functions instead of compiler opcodes.
              (value: string) => value === "accepted",
            ],
          },
        ],
      },
    }
    const compiled = compileToTables(custom)

    expect(compiled.tables.customValidatorNames?.length).toBeGreaterThan(0)
    expect(() => createEngine(compiled.tables)).toThrow(/missing validator/i)

    const engine = createEngine(compiled.tables, compiled.validatorImpls)
    expect(engine.mergeString("custom-accepted custom-accepted")).toBe(
      "custom-accepted",
    )
    expect(engine.mergeString("custom-rejected custom-accepted")).toBe(
      "custom-rejected custom-accepted",
    )
  })

  test("treats unicode whitespace as token boundaries without changing merge semantics", () => {
    const { tables, validatorImpls, prefix } = compileToTables(defaultConfig())
    const engine = createEngine(tables, validatorImpls, { prefix })

    expect(engine.mergeString("p-2\u00a0p-4")).toBe("p-4")
    expect(engine.mergeString("text-sm\ttext-lg\nfont-bold")).toBe(
      "text-lg font-bold",
    )
  })

  test("composer prediction paths stay equivalent across repeated larger tuples", () => {
    const merge = wrapComposer((value) => value)
    const a = ["a", "b", "c", "d"] as const
    const b = ["a", "b", "x", "y"] as const

    // Repeating an A → B sequence exercises successor prediction for 4+ inputs.
    for (let index = 0; index < 4; index++) {
      expect(merge(...a)).toBe("a b c d")
      expect(merge(...b)).toBe("a b x y")
    }
  })
})

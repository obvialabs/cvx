import { describe, expect, test } from "bun:test"
import { clsx } from "clsx"

import { cx } from "../src"
import { appendClassValue } from "../src/cx/compose"

describe("cx", () => {
  test("matches clsx for supported class-value shapes", () => {
    const cases = [
      ["root", "active"],
      ["root", false, null, undefined, "active"],
      [["root", ["active", ["rounded"]]]],
      [{ active: true, disabled: false }],
      ["root", 2, 3n, ["nested", { active: true }]],
      [{ third: 1, first: true, skipped: 0, second: "yes" }],
    ] as const

    for (const values of cases) {
      expect(cx(...(values as any))).toBe(clsx(...(values as any)))
    }
  })

  test("ignores inherited object properties", () => {
    const inherited = { inherited: true }
    const value = Object.create(inherited) as Record<string, unknown>
    value.own = true

    expect(cx(value)).toBe("own")
  })

  test("preserves deeply nested array order", () => {
    expect(cx([[[[["a"]]]], ["b", [["c"]]]])).toBe("a b c")
  })

  test("incremental composition does not introduce separator drift", () => {
    let output = ""
    output = appendClassValue(output, "a")
    output = appendClassValue(output, [false, "b"])
    output = appendClassValue(output, { c: true })

    expect(output).toBe("a b c")
  })

  test("repeated evaluation remains deterministic", () => {
    const input = ["a", ["b", { c: true, d: false }], 4] as const
    const expected = cx(...input)

    for (let index = 0; index < 10_000; index++) {
      expect(cx(...input)).toBe(expected)
    }
  })
})

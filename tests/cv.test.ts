import { describe, expect, test } from "bun:test"

import { cv } from "../src"
import { createCvRuntime } from "../src/cv/internal/runtime"

describe("cv", () => {
  test("resolves base, defaults, compounds, booleans, numbers, and overrides", () => {
    const button = cv({
      base: "button",
      variants: {
        intent: {
          primary: "intent-primary",
          secondary: "intent-secondary",
          danger: "intent-danger",
        },
        size: { sm: "size-sm", md: "size-md", lg: "size-lg" },
        disabled: { true: "disabled", false: "enabled" },
        level: { 0: "level-zero", 1: "level-one" },
      },
      defaults: {
        intent: "primary",
        size: "md",
        disabled: false,
        level: 1,
      },
      compounds: [
        { intent: "danger", size: ["sm", "lg"], class: "danger-sized" },
        { disabled: true, level: 0, className: "disabled-zero" },
        {
          intent: ["primary", "secondary", "danger"],
          size: ["sm", "md", "lg"],
          disabled: false,
          level: [0, 1],
          class: "wide-selector",
        },
      ],
    })

    expect(button()).toBe(
      "button intent-primary size-md enabled level-one wide-selector",
    )
    expect(
      button({
        intent: "danger",
        size: "lg",
        disabled: true,
        level: 0,
        className: "custom",
      }),
    ).toBe(
      "button intent-danger size-lg disabled level-zero danger-sized disabled-zero custom",
    )
  })

  test("falls back to defaults for undefined, null, and empty selections", () => {
    const component = cv({
      variants: { tone: { soft: "soft", hard: "hard" } },
      defaults: { tone: "soft" },
    })

    expect(component({ tone: undefined })).toBe("soft")
    expect(component({ tone: null as never })).toBe("soft")
    expect(component({ tone: "" as never })).toBe("soft")
  })

  test("unknown values do not corrupt other resolved axes", () => {
    const component = cv({
      base: "base",
      variants: {
        tone: { a: "tone-a", b: "tone-b" },
        size: { sm: "small", lg: "large" },
      },
      defaults: { tone: "a", size: "sm" },
    })

    expect(
      component({
        tone: "missing" as "a",
        size: "lg",
      }),
    ).toBe("base large")
  })

  test("component preparation snapshots authored runtime data", () => {
    const config: any = {
      base: "before",
      variants: { tone: { a: "a" } },
      defaults: { tone: "a" },
      compounds: [{ tone: "a", class: "compound" }],
    }
    const component = cv(config)

    config.base = "after"
    config.variants.tone.a = "changed"
    config.compounds[0].class = "changed-compound"

    expect(component()).toBe("before a compound")
  })

  test("composition inherits variants and allows parent defaults to retune them", () => {
    const tone = cv({
      base: "tone",
      variants: { intent: { primary: "primary", danger: "danger" } },
      defaults: { intent: "primary" },
    })
    const size = cv({
      base: "size",
      variants: { size: { sm: "sm", lg: "lg" } },
      defaults: { size: "sm" },
    })
    const button = cv({
      composes: [tone, size],
      base: "button",
      defaults: { intent: "danger", size: "lg" },
      compounds: [
        { intent: "danger", size: "lg", class: "danger-large" },
      ],
    })

    expect(button()).toBe("tone danger size lg button danger-large")
    expect(button({ intent: "primary", size: "sm" })).toBe(
      "tone primary size sm button",
    )
  })

  test("nested composition keeps inherited variants executable", () => {
    const a = cv({
      base: "a",
      variants: { x: { one: "a1", two: "a2" } },
    })
    const b = cv({ composes: a, base: "b", defaults: { x: "one" } })
    const c = cv({ composes: b, base: "c", defaults: { x: "two" } })
    const d = cv({ composes: c, base: "d" })

    expect(d()).toBe("a a2 b c d")
    expect(d({ x: "one" })).toBe("a a1 b c d")
  })

  test("foreign composed components receive resolved variant props only", () => {
    const calls: Record<string, unknown>[] = []
    const foreign = Object.assign(
      (props: Record<string, unknown> = {}) => {
        calls.push(props)
        return `foreign-${String(props.tone ?? "none")}`
      },
      {
        config: {
          variants: { tone: { a: "a", b: "b" } },
          defaults: { tone: "a" },
        },
      },
    )
    const component = cv({
      composes: foreign,
      base: "local",
      defaults: { tone: "b" },
    } as any)

    expect(component({ className: "extra" })).toBe("foreign-b local extra")
    expect(calls.at(-1)).toEqual({ tone: "b" })
  })

  test("dense and general execution paths produce identical output", () => {
    const compiled = createCvRuntime({ compileLimit: 512 })
    const general = createCvRuntime({ compileLimit: 0 })
    const config = {
      base: "base",
      variants: {
        a: { x: "ax", y: "ay", z: "az" },
        b: { x: "bx", y: "by" },
      },
      defaults: { a: "x", b: "y" },
      compounds: [{ a: "y", b: "x", class: "hit" }],
    } as const
    const fast = compiled(config)
    const slow = general(config)

    for (const a of [undefined, "x", "y", "z", "bad"] as const) {
      for (const b of [undefined, "x", "y", "bad"] as const) {
        const props = { a: a as never, b: b as never }
        expect(fast(props)).toBe(slow(props))
      }
    }
  })
})

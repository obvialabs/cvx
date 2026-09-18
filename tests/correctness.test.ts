import { describe, expect, test } from "bun:test"
import { cva as legacyCva, cx as legacyCx } from "class-variance-authority"
import { clsx } from "clsx"
import { cva as betaCva, cx as betaCx } from "cva"
import {
  extendTailwindMerge as baselineExtend,
  extendTailwindMerge as baselineExtendTailwindMerge,
  twMerge as baselineTwMerge,
} from "tailwind-merge"
import { createConfiguredCn, createConfiguredMerge } from "../src/cn/internal/factory"
import { cn, cv, cx } from "../src"
import { expectCallParity, forEachCartesian, repeatCases } from "./utility"

describe("cn", () => {
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
  ] as const
  test("matches clsx + tailwind-merge across a broad utility matrix", () => {
    const indexes = utilities.map((_, index) => index)
    const sampledIndexes = indexes.filter((index) => index % 4 === 0)
    const comparisons = forEachCartesian([indexes, indexes, sampledIndexes] as const, ([a, b, c]) => {
      const inputs = [
        utilities[a],
        a % 2 === 0 && utilities[b],
        [utilities[c], { "font-semibold": b % 2 === 0 }],
      ] as const
      expect(cn(...inputs)).toBe(baselineTwMerge(clsx(...inputs)))
    })
    expect(comparisons).toBeGreaterThan(10000)
  })
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
    ] as const
    expectCallParity(cases, (...values) => cn(...values), (...values) => baselineTwMerge(clsx(...values)))
  })
  test("custom cn config matches tailwind-merge extension semantics", () => {
    const extension = {
      extend: {
        classGroups: {
          "font-size": [{ text: ["hero", "tiny", "display"] }],
        },
      },
    } as const
    const current = createConfiguredCn(extension)
    const baseline = baselineExtendTailwindMerge(extension)
    const cases = [
      ["text-sm", "text-hero"],
      ["text-hero", "text-lg"],
      ["hover:text-tiny", "hover:text-hero"],
      ["p-2", "p-4", "text-display"],
      ["md:text-display", "md:text-tiny"],
    ] as const
    expectCallParity(cases, current, baseline)
  })
  test("custom twMerge-compatible function matches tailwind-merge extension", () => {
    const extension = {
      extend: {
        classGroups: {
          shadow: [{ shadow: ["soft", "hard"] }],
        },
      },
    } as const
    const current = createConfiguredMerge(extension)
    const baseline = baselineExtendTailwindMerge(extension)
    const cases = [
      ["shadow-sm", "shadow-soft"],
      ["shadow-soft", "shadow-hard"],
      ["hover:shadow-soft", "hover:shadow-hard"],
    ] as const
    expectCallParity(cases, current, baseline)
  })
  test("prefix handling matches tailwind-merge", () => {
    const extension = { prefix: "tw" } as const
    const current = createConfiguredCn(extension)
    const baseline = baselineExtend(extension)
    const cases = [
      ["tw:p-2", "tw:p-4"],
      ["tw:hover:p-2", "tw:hover:p-4"],
      ["p-2", "p-4", "tw:p-2", "tw:p-4"],
    ] as const
    expectCallParity(cases, current, baseline)
  })
  test("cache size changes storage policy, not observable merge semantics", () => {
    const uncached = createConfiguredCn({ cacheSize: 0 })
    const cached = createConfiguredCn({ cacheSize: 100 })
    const cases = [
      ["p-2", "p-4"],
      ["text-sm", "text-lg", "font-bold"],
      ["hover:p-2", "hover:p-4", "md:text-xl"],
      ["w-[10px]", "w-[30px]"],
    ] as const
    repeatCases(20, () => {
      expectCallParity(cases, cached, uncached)
    })
  })
  test("keeps unrelated utilities instead of treating every Tailwind token as a conflict", () => {
    expect(cn("flex", "p-2", "text-sm", "bg-red-500")).toBe("flex p-2 text-sm bg-red-500")
  })
  test("does not merge conflicts across different modifier scopes", () => {
    expect(cn("p-2", "hover:p-2", "focus:p-4", "md:p-6")).toBe("p-2 hover:p-2 focus:p-4 md:p-6")
  })
  test("preserves unknown classes instead of dropping unrecognized input", () => {
    expect(cn("component-root", "plugin:state", "p-2", "p-4")).toBe("component-root plugin:state p-4")
  })
})
describe("cv", () => {
  const betaReference = betaCva as (config: any) => any
  const legacyReference = legacyCva as (base: any, options?: any) => any
  const betaConfig = {
    base: ["button", { root: true, skip: false }],
    variants: {
      intent: {
        primary: "p",
        secondary: ["s", { secondary: true }],
        danger: "d",
      },
      size: { small: "sm", medium: "md", large: "lg" },
      disabled: { true: "off", false: "on" },
      level: { 0: "zero", 1: "one" },
    },
    defaultVariants: {
      intent: "primary",
      size: "medium",
      disabled: false,
      level: 1,
    },
    compoundVariants: [
      { intent: "primary", size: "medium", class: "pm" },
      {
        intent: ["danger", "secondary"],
        disabled: false,
        className: ["active-danger", { compound: true }],
      },
      { level: 0, disabled: true, class: "zero-off" },
      {
        intent: ["primary", "secondary", "danger"],
        size: ["small", "medium", "large"],
        class: "all-intents-and-sizes",
      },
    ],
  } as const
  test("matches a broad variant/default/compound matrix", () => {
    const upstream = betaReference(betaConfig)
    const current = cv({
      base: betaConfig.base,
      variants: betaConfig.variants,
      defaults: betaConfig.defaultVariants,
      compounds: betaConfig.compoundVariants,
    })
    const intents = [
      undefined,
      "primary",
      "secondary",
      "danger",
      "unknown",
      null,
    ] as const
    const sizes = [
      undefined,
      "small",
      "medium",
      "large",
      "bad",
      null,
    ] as const
    const disabled = [undefined, true, false, null] as const
    const levels = [undefined, 0, 1, 9, null] as const
    const count = forEachCartesian([intents, sizes, disabled, levels, [false, true] as const] as const, ([intent, size, disabledValue, level, override]) => {
      const props: Record<string, unknown> = {
        intent,
        size,
        disabled: disabledValue,
        level,
      }
      if (override)
        props.className = ["extra", { x: true }]
      expect(current(props as never)).toBe(upstream(props as never))
    })
    expect(count).toBe(1440)
  })
  test("matches composition, inherited defaults and parent compounds", () => {
    const upstreamTone = betaReference({
      base: "tone",
      variants: { tone: { a: "a", b: "b", c: "c" } },
      defaultVariants: { tone: "a" },
    })
    const upstreamSize = betaReference({
      base: "size",
      variants: { size: { s: "s", m: "m", l: "l" } },
      defaultVariants: { size: "s" },
    })
    const upstream = betaReference({
      composes: [upstreamTone, upstreamSize],
      base: "parent",
      defaultVariants: { tone: "b", size: "l" },
      compoundVariants: [
        { tone: "b", size: "l", class: "hit" },
        { tone: ["a", "c"], size: ["s", "m"], className: "matrix" },
      ],
    })
    const tone = cv({
      base: "tone",
      variants: { tone: { a: "a", b: "b", c: "c" } },
      defaults: { tone: "a" },
    })
    const size = cv({
      base: "size",
      variants: { size: { s: "s", m: "m", l: "l" } },
      defaults: { size: "s" },
    })
    const current = cv({
      composes: [tone, size],
      base: "parent",
      defaults: { tone: "b", size: "l" },
      compounds: [
        { tone: "b", size: "l", class: "hit" },
        { tone: ["a", "c"], size: ["s", "m"], className: "matrix" },
      ],
    })
    forEachCartesian([
      [undefined, "a", "b", "c"],
      [undefined, "s", "m", "l"],
      [undefined, "override"],
    ] as const, ([tone, size, className]) => {
      const props = { tone, size, className }
      expect(current(props)).toBe(upstream(props))
    })
  })
  test("matches nested composition semantics", () => {
    const upstreamA = betaReference({
      base: "a",
      variants: { x: { one: "a1", two: "a2" } },
      defaultVariants: { x: "one" },
    })
    const upstreamB = betaReference({ base: "b", composes: upstreamA })
    const upstreamC = betaReference({
      base: "c",
      composes: upstreamB,
      defaultVariants: { x: "two" },
    })
    const currentA = cv({
      base: "a",
      variants: { x: { one: "a1", two: "a2" } },
      defaults: { x: "one" },
    })
    const currentB = cv({ base: "b", composes: currentA })
    const currentC = cv({
      base: "c",
      composes: currentB,
      defaults: { x: "two" },
    })
    expect(currentC()).toBe(upstreamC())
    expect(currentC({ x: "one" })).toBe(upstreamC({ x: "one" }))
    expect(currentC({ x: "two", className: "tail" })).toBe(upstreamC({ x: "two", className: "tail" }))
  })
  test("matches legacy semantics where the feature surfaces overlap", () => {
    const options = {
      variants: {
        intent: { primary: "p", danger: "d" },
        size: { sm: "sm", lg: "lg" },
        disabled: { true: "off", false: "on" },
      },
      defaultVariants: { intent: "primary", size: "sm", disabled: false },
      compoundVariants: [
        { intent: "danger", size: ["sm", "lg"], className: "danger-size" },
        { intent: "primary", disabled: false, class: "ready" },
      ],
    } as const
    const upstream = legacyReference("button", options)
    const current = cv({
      base: "button",
      variants: options.variants,
      defaults: options.defaultVariants,
      compounds: options.compoundVariants,
    })
    // CVA 0.7 treats explicit `null` differently. Null/default semantics are
    // covered against the current cva beta above; this matrix stays on the
    // behavior genuinely shared by both generations.
    forEachCartesian([
      [undefined, "primary", "danger"],
      [undefined, "sm", "lg"],
      [undefined, true, false],
    ] as const, ([intent, size, disabled]) => {
      const props = { intent, size, disabled }
      expect(current(props as never)).toBe(upstream(props as never))
    })
  })
  test("does not apply compounds when any selector requirement differs", () => {
    const component = cv({
      variants: {
        intent: { primary: "primary", danger: "danger" },
        size: { sm: "small", lg: "large" },
      },
      compounds: [{ intent: "danger", size: "lg", class: "danger-large" }],
    })
    expect(component({ intent: "danger", size: "sm" })).toBe("danger small")
    expect(component({ intent: "primary", size: "lg" })).toBe("primary large")
    expect(component({ intent: "danger", size: "lg" })).toBe("danger large danger-large")
  })
  test("does not fall back to a default when an explicit unknown value is provided at runtime", () => {
    const component = cv({
      variants: { tone: { soft: "soft", hard: "hard" } },
      defaults: { tone: "soft" },
    })
    expect(component({ tone: "missing" as never })).toBe("")
  })
})
describe("cx", () => {
  const cases = [
    ["button", "active", "px-4"],
    ["button", false, null, undefined, "visible"],
    ["button", ["nested", ["deep"]], { active: true, hidden: false }],
    [{ a: true, b: 1, c: 0 }, "tail"],
    ["a", 1, 2, [3, { four: true }]],
  ] as const
  test("matches clsx across supported class-value shapes", () => {
    expectCallParity(cases, (...values) => cx(...values), (...values) => clsx(...values))
  })
  test("matches both CVA class composers", () => {
    expectCallParity(cases, (...values) => cx(...values), (...values) => legacyCx(...values))
    expectCallParity(cases, (...values) => cx(...values), (...values) => betaCx(...values))
  })
  test("keeps CVX bigint support as an intentional superset", () => {
    expect(cx("a", 2n, [3n])).toBe("a 2 3")
  })
  test("does not resolve Tailwind conflicts because conflict handling belongs to cn", () => {
    expect(cx("p-2", "p-4", "text-sm", "text-lg")).toBe("p-2 p-4 text-sm text-lg")
  })
  test("does not emit falsy values or inherited object keys", () => {
    const inherited = { inherited: true }
    const value = Object.assign(Object.create(inherited), { own: true, skipped: false })
    expect(cx("a", false, null, undefined, "", 0, value, "b")).toBe("a own b")
  })
})

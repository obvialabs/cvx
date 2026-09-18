import { describe, expect, test } from "bun:test"
import { clsx } from "clsx"
import { twMerge as baselineTwMerge } from "tailwind-merge"
import { createCvRuntime } from "../src/cv/internal/runtime"
import type { ClassValue } from "../src/cx/types"
import { cn, cx } from "../src"
import { classWords, generateClassValue, generateUtility, utilityGroups } from "./fixtures"
import { checkGeneratedCases, forEachCartesian, pick, repeatCases } from "./utility"

describe("cn", () => {
  test("matches clsx + tailwind-merge for generated utility sequences", () => {
    const comparisons = checkGeneratedCases({
      seed: 0xdeadbeef,
      cases: 8000,
      generate: (random) => {
        const length = 1 + random.int(10)
        const inputs: ClassValue[] = []
        for (let index = 0; index < length; index++) {
          const utility = generateUtility(random)
          switch (random.int(4)) {
            case 0:
              inputs.push(utility)
              break
            case 1:
              inputs.push([utility])
              break
            case 2:
              inputs.push({ [utility]: true })
              break
            default:
              inputs.push(random.bool() && utility)
          }
        }
        return inputs
      },
      check: (inputs) => {
        expect(cn(...inputs)).toBe(baselineTwMerge(clsx(...(inputs as Parameters<typeof clsx>))))
      },
    })
    expect(comparisons).toBe(8000)
  })
  test("merge output is idempotent", () => {
    checkGeneratedCases({
      seed: 0x10203040,
      cases: 5000,
      generate: (random) => Array.from({ length: 1 + random.int(12) }, () => generateUtility(random)),
      check: (utilities) => {
        const once = cn(...utilities)
        expect(cn(once)).toBe(once)
        expect(cn(once, once)).toBe(once)
      },
    })
  })
  test("adding a later member of one conflict group matches baseline replacement", () => {
    checkGeneratedCases({
      seed: 0x42424242,
      cases: 3000,
      generate: (random) => {
        const stable = generateUtility(random)
        const group = pick(random, utilityGroups)
        return [stable, pick(random, group), pick(random, group)] as const
      },
      check: (inputs) => {
        expect(cn(...inputs)).toBe(baselineTwMerge(clsx(...inputs)))
      },
    })
  })
})
describe("cv", () => {
  const config = {
    base: "root",
    variants: {
      intent: { primary: "i-p", secondary: "i-s", danger: "i-d" },
      size: { xs: "s-xs", sm: "s-sm", md: "s-md", lg: "s-lg" },
      disabled: { true: "disabled", false: "enabled" },
      level: { 0: "l0", 1: "l1", 2: "l2" },
    },
    defaults: {
      intent: "primary",
      size: "md",
      disabled: false,
      level: 1,
    },
    compounds: [
      { intent: "danger", disabled: false, class: "danger-ready" },
      { intent: ["primary", "secondary"], size: ["sm", "md"], class: "common" },
      { level: [0, 1, 2], disabled: true, className: "disabled-level" },
      {
        intent: ["primary", "secondary", "danger"],
        size: ["xs", "sm", "md", "lg"],
        disabled: [true, false],
        level: [0, 1, 2],
        class: "all-known",
      },
    ],
  } as const
  const intents = [undefined, "primary", "secondary", "danger", "unknown", null] as const
  const sizes = [undefined, "xs", "sm", "md", "lg", "unknown", null] as const
  const disabled = [undefined, true, false, null] as const
  const levels = [undefined, 0, 1, 2, 99, null] as const
  test("dense compilation is observationally equivalent to the uncached path", () => {
    const compiled = createCvRuntime({ compileLimit: 1024 })(config)
    const uncached = createCvRuntime({ compileLimit: 0 })(config)
    checkGeneratedCases({
      seed: 0x13572468,
      cases: 20000,
      generate: (random) => ({
        intent: pick(random, intents) as never,
        size: pick(random, sizes) as never,
        disabled: pick(random, disabled) as never,
        level: pick(random, levels) as never,
        className: random.int(4) === 0 ? `extra-${random.int(8)}` : undefined,
      }),
      check: (props) => {
        expect(compiled(props)).toBe(uncached(props))
      },
    })
  })
  test("repeated cache hits never change output", () => {
    const component = createCvRuntime({ compileLimit: 1024 })(config)
    const props = { intent: "danger", size: "lg", disabled: false, level: 2 } as const
    const expected = component(props)
    repeatCases(20000, () => {
      expect(component(props)).toBe(expected)
    })
  })
  test("class overrides affect only the suffix, not variant resolution", () => {
    const component = createCvRuntime({ compileLimit: 1024 })(config)
    checkGeneratedCases({
      seed: 0x24681357,
      cases: 5000,
      generate: (random, index) => ({
        props: {
          intent: pick(random, intents) as never,
          size: pick(random, sizes) as never,
          disabled: pick(random, disabled) as never,
          level: pick(random, levels) as never,
        },
        extra: `extra-${index % 7}`,
      }),
      check: ({ props, extra }) => {
        const core = component(props)
        expect(component({ ...props, className: extra })).toBe(core ? `${core} ${extra}` : extra)
      },
    })
  })
  test("nested composition stays equivalent between compiled and uncached engines", () => {
    const make = (compileLimit: number) => {
      const engine = createCvRuntime({ compileLimit })
      const tone = engine({
        base: "tone",
        variants: { tone: { calm: "calm", loud: "loud" } },
        defaults: { tone: "calm" },
      })
      const size = engine({
        base: "size",
        variants: { size: { sm: "sm", lg: "lg" } },
        defaults: { size: "sm" },
      })
      const middle = engine({ composes: [tone, size], base: "middle" })
      return engine({
        composes: middle,
        base: "root",
        defaults: { tone: "loud", size: "lg" },
        compounds: [{ tone: "loud", size: "lg", class: "hit" }],
      })
    }
    const compiled = make(512)
    const uncached = make(0)
    const comparisons = forEachCartesian([
      [undefined, "calm", "loud"],
      [undefined, "sm", "lg"],
    ] as const, ([tone, size]) => {
      expect(compiled({ tone, size })).toBe(uncached({ tone, size }))
    })
    expect(comparisons).toBe(9)
  })
  test("many independently created components do not share mutable result state", () => {
    const components = Array.from({ length: 64 }, (_, index) => createCvRuntime({ compileLimit: index % 2 === 0 ? 512 : 0 })({
      base: `component-${index}`,
      variants: { tone: { a: `a-${index}`, b: `b-${index}` } },
      defaults: { tone: index % 2 === 0 ? "a" : "b" },
    }))
    checkGeneratedCases({
      seed: 0x90909090,
      cases: 5000,
      generate: (random) => ({
        index: random.int(components.length),
        tone: random.bool() ? ("a" as const) : ("b" as const),
      }),
      check: ({ index, tone }) => {
        expect(components[index]!({ tone })).toBe(`component-${index} ${tone}-${index}`)
      },
    })
  })
})
describe("cx", () => {
  test("matches clsx for thousands of generated supported inputs", () => {
    const comparisons = checkGeneratedCases({
      seed: 0xc0ffee,
      cases: 5000,
      generate: (random) => Array.from({ length: random.int(8) }, () => generateClassValue(random)),
      check: (inputs) => {
        expect(cx(...inputs)).toBe(clsx(...(inputs as Parameters<typeof clsx>)))
      },
    })
    expect(comparisons).toBe(5000)
  })
  test("variadic and nested-array forms are equivalent", () => {
    checkGeneratedCases({
      seed: 0xabc123,
      cases: 3000,
      generate: (random) => Array.from({ length: random.int(10) }, () => generateClassValue(random)),
      check: (inputs) => {
        expect(cx(...inputs)).toBe(cx(inputs))
      },
    })
  })
  test("inserting falsy values never changes output", () => {
    checkGeneratedCases({
      seed: 0x515151,
      cases: 2000,
      generate: (random) => [pick(random, classWords), pick(random, classWords)] as const,
      check: ([left, right]) => {
        const expected = cx(left, right)
        expect(cx(left, false, null, undefined, "", 0, 0n, right)).toBe(expected)
      },
    })
  })
  test("repeated evaluation is deterministic", () => {
    checkGeneratedCases({
      seed: 0x777777,
      cases: 1000,
      generate: (random) => Array.from({ length: random.int(8) }, () => generateClassValue(random)),
      check: (inputs) => {
        const first = cx(...inputs)
        expect(cx(...inputs)).toBe(first)
        expect(cx(...inputs)).toBe(first)
      },
    })
  })
  test("top-level object ordering is preserved", () => {
    checkGeneratedCases({
      seed: 0x818181,
      cases: 1000,
      generate: (random) => {
        const keys = Array.from({ length: 1 + random.int(5) }, () => pick(random, classWords))
        const object: Record<string, boolean> = {}
        for (const key of keys)
          object[key] = true
        return object
      },
      check: (object) => {
        expect(cx(object)).toBe(clsx(object))
      },
    })
  })
})

import { describe, expect, test } from "bun:test"
import { clsx } from "clsx"
import { extendTailwindMerge, twMerge } from "tailwind-merge"

import { cn, cv } from "../src"
import { createConfiguredCn } from "../src/cn/internal/factory"
import { createCvRuntime } from "../src/cv/internal/runtime"

describe("hardening", () => {
  test("large arbitrary-property group counts do not alias conflict state", () => {
    const utilities: string[] = []

    for (let index = 0; index < 9_000; index++) {
      utilities.push(
        `hover:[p${index}:x]`,
        `focus:[p${index}:x]`,
      )
    }

    const input = utilities.join(" ")

    expect(cn(input)).toBe(twMerge(input))
  })

  test("wide custom conflict fan-out matches tailwind-merge", () => {
    const classGroups: Record<string, string[]> = {
      big: ["big"],
    }
    const targets: string[] = []

    for (let index = 0; index < 128; index++) {
      const name = `t${index}`
      classGroups[name] = [name]
      targets.push(name)
    }

    const extension = {
      extend: {
        classGroups,
        conflictingClassGroups: {
          big: targets,
        },
      },
    }
    const current = createConfiguredCn(extension)
    const reference = extendTailwindMerge(extension)
    const input = Array.from(
      { length: 96 },
      (_, index) => `v${index}:big`,
    ).join(" ")

    expect(current(input)).toBe(reference(input))
  })

  test("cache churn does not change previously resolved results", () => {
    const stable = [
      "p-2 p-4 text-sm text-lg",
      "hover:m-2 hover:m-4 focus:px-2",
      "w-[10px] w-[20px] md:text-sm md:text-xl",
      "[color:red] [color:blue] bg-red-500",
    ]
    const expected = stable.map((input) => twMerge(input))

    for (let index = 0; index < 20_000; index++) {
      cn(
        `w-[${index}px] p-${index % 12} text-sm`,
        `w-[${index + 1}px] p-${(index + 1) % 12} text-lg`,
      )
    }

    for (let index = 0; index < stable.length; index++) {
      expect(cn(stable[index]!)).toBe(expected[index]!)
    }
  })

  test("dense cv tables stay equivalent after heavy repeated access", () => {
    const config = {
      base: "root",
      variants: {
        a: { a0: "a0", a1: "a1", a2: "a2" },
        b: { b0: "b0", b1: "b1", b2: "b2" },
        c: { c0: "c0", c1: "c1", c2: "c2" },
        d: { d0: "d0", d1: "d1", d2: "d2" },
      },
      defaults: {
        a: "a0",
        b: "b0",
        c: "c0",
        d: "d0",
      },
      compounds: Array.from({ length: 96 }, (_, index) => ({
        a: ["a0", "a1", "a2"] as const,
        b: index % 2 === 0 ? "b1" as const : "b2" as const,
        c: ["c0", "c1", "c2"] as const,
        d: index % 3 === 0 ? "d1" as const : "d2" as const,
        class: `compound-${index}`,
      })),
    } as const
    const fast = createCvRuntime({ compileLimit: 512 })(config)
    const slow = createCvRuntime({ compileLimit: 0 })(config)
    const props = [
      { a: "a0", b: "b1", c: "c2", d: "d1" },
      { a: "a1", b: "b2", c: "c0", d: "d2" },
      { a: "a2", b: "b1", c: "c1", d: "d2" },
    ] as const

    for (let index = 0; index < 25_000; index++) {
      const value = props[index % props.length]!
      expect(fast(value)).toBe(slow(value))
    }
  })

  test("end-to-end cv plus cn remains reference-equivalent under rotation", () => {
    const component = cv({
      base: "inline-flex p-2 text-sm",
      variants: {
        tone: {
          primary: "bg-blue-500 text-white",
          danger: "bg-red-500 text-white",
        },
        size: {
          sm: "px-2 py-1",
          lg: "px-6 py-3",
        },
      },
      defaults: {
        tone: "primary",
        size: "sm",
      },
    })
    const cases = [
      [{ tone: "primary", size: "sm" } as const, "p-4 text-lg"],
      [{ tone: "danger", size: "lg" } as const, "px-8 bg-black"],
    ] as const

    for (let index = 0; index < 5_000; index++) {
      const [props, override] = cases[index % cases.length]!
      const resolved = component(props)

      expect(cn(resolved, override)).toBe(twMerge(clsx(resolved, override)))
    }
  })
})

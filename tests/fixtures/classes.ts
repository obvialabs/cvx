import type { ClassValue } from "../../src/cx/types"
import type { Random } from "../utility"
import { pick } from "../utility"

/**
 * Tailwind utility groups used by deterministic conflict-resolution tests
 */
export const utilityGroups = [
  ["p-0", "p-1", "p-2", "p-4", "p-8"],
  ["px-0", "px-2", "px-4", "px-8"],
  ["py-0", "py-2", "py-4", "py-8"],
  ["m-0", "m-2", "m-4", "-m-2", "mx-auto"],
  ["text-xs", "text-sm", "text-base", "text-lg", "text-xl"],
  ["text-red-500", "text-blue-500", "text-green-500"],
  ["bg-red-500", "bg-blue-500", "bg-green-500"],
  ["rounded-none", "rounded-sm", "rounded-lg", "rounded-full"],
  ["border-0", "border", "border-2", "border-4"],
  ["w-[10px]", "w-[20px]", "w-[calc(100%-1rem)]"],
  ["opacity-0", "opacity-50", "opacity-100"],
] as const

/**
 * Variant modifiers applied to generated Tailwind utilities
 */
export const utilityModifiers = ["", "hover:", "focus:", "md:", "dark:", "md:hover:"] as const

/**
 * Generic class tokens used by generated class-value grammar fixtures
 */
export const classWords = ["alpha", "beta", "gamma", "delta", "px-2", "text-sm"] as const

/**
 * Generate one deterministic Tailwind utility from the shared fixture corpus
 *
 * **Parameters**
 * - `random` – Deterministic random source used by generated conformance tests
 */
export const generateUtility = (random: Random): string => {
  const base = pick(random, pick(random, utilityGroups))
  const modifier = pick(random, utilityModifiers)
  return `${modifier}${base}`
}

/**
 * Generate the complete nested class-value grammar accepted by `cx` and `cn`
 *
 * **Parameters**
 * - `random` – Deterministic random source used by generated conformance tests
 * - `depth` – Current recursion depth used to bound nested arrays
 *
 * @default depth 0
 */
export const generateClassValue = (random: Random, depth = 0): ClassValue => {
  const leaf = (): ClassValue => {
    switch (random.int(7)) {
      case 0:
        return pick(random, classWords)
      case 1:
        return random.int(6)
      case 2:
        return random.bool()
      case 3:
        return null
      case 4:
        return undefined
      case 5:
        return { [pick(random, classWords)]: random.bool() }
      default:
        return ""
    }
  }

  // Stop recursion early for most cases so generated inputs remain realistic
  if (depth >= 3 || random.int(4) !== 0) return leaf()

  return Array.from({ length: random.int(5) }, () => generateClassValue(random, depth + 1))
}

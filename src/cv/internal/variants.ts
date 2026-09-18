import type { ClassValue } from "../../cx/types"
import type { CVComponentShape, VariantShape } from "../types"

/**
 * Shared immutable empty object used while merging variant metadata
 */
const EMPTY_OBJECT: Readonly<Record<string, never>> = Object.freeze({})

/**
 * Normalize a runtime variant value to the key representation used by authored maps
 *
 * **Parameters**
 * - `value` – Runtime variant value supplied by props or defaults
 *
 * **Returns**
 * - `unknown` – Normalized value compatible with authored variant-map keys
 */
export function normalizeVariantKey(value: unknown): unknown {
  // Convert boolean selections to the string keys used by authored objects
  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  // Preserve numeric zero as the explicit authored key `"0"`
  if (value === 0) {
    return "0"
  }

  // Return every other value unchanged
  return value
}

/**
 * Restore primitive variant values while preparing dense lookup dimensions
 *
 * **Parameters**
 * - `key` – Authored object key from a variant map
 *
 * **Returns**
 * - `unknown` – Runtime representation of the authored variant key
 */
export function toVariantPropValue(key: string): unknown {
  // Restore authored boolean keys to their runtime primitive values
  if (key === "true") {
    return true
  }

  if (key === "false") {
    return false
  }

  // Parse numeric-looking keys only when the conversion is lossless
  const number = Number(key)

  if (
      Number.isFinite(number) &&
      String(number) === key
  ) {
    return number
  }

  // Preserve non-primitive keys exactly as authored
  return key
}

/**
 * Copy an authored variant map into a plain data object detached from prototypes
 *
 * **Parameters**
 * - `source` – Variant map to copy
 *
 * **Returns**
 * - `ClassValue` – Independent plain-object copy of the variant map
 */
export function copyVariantMap(
    source: Record<string, ClassValue> | undefined,
): Record<string, ClassValue> {
  const output: Record<string, ClassValue> = {}

  // Return an empty map when the authored variant axis is missing
  if (!source) {
    return output
  }

  // Copy only the source object's own enumerable variant keys
  for (const key of Object.keys(source)) {
    output[key] = source[key]
  }

  return output
}

/**
 * Merge composed resolver metadata with a local variant definition
 *
 * **Parameters**
 * - `childComponents` – Resolvers whose variants and defaults should be inherited
 * - `definition` – Local configuration applied after inherited metadata
 *
 * **Returns**
 * - `VariantShape` – Merged variant maps and defaults used by the prepared runtime program
 */
export function mergeVariantMetadata(
    childComponents: readonly CVComponentShape[],
    definition: Record<string, any>,
): {
  variants: VariantShape
  defaults: Record<string, unknown>
} {
  const variants: VariantShape = {}
  let defaults: Record<string, unknown> = {}

  /**
   * Merge one configuration source into the accumulated metadata
   *
   * **Parameters**
   * - `source` – Component or local configuration whose metadata should be applied
   *
   * **Returns**
   * - `void` – Mutates the local metadata accumulators without returning a value
   */
  const mergeOne = (
      source: Record<string, any> | undefined,
  ): void => {
    // Ignore missing metadata sources
    if (!source) {
      return
    }

    const sourceVariants = source.variants as VariantShape | undefined

    // Merge every source variant axis independently
    if (sourceVariants) {
      for (const key of Object.keys(sourceVariants)) {
        variants[key] = {
          ...(variants[key] ?? EMPTY_OBJECT),
          ...sourceVariants[key],
        }
      }
    }

    // Apply source defaults after previously inherited defaults
    if (source.defaults) {
      defaults = {
        ...defaults,
        ...source.defaults,
      }
    }
  }

  // Inherit metadata from composed components in declaration order
  for (let index = 0; index < childComponents.length; index++) {
    mergeOne(
        childComponents[index].config as Record<string, any>,
    )
  }

  // Apply the local definition last so it can override inherited metadata
  mergeOne(definition)

  return {
    variants,
    defaults,
  }
}

/**
 * Resolve the class payload for one variant selection
 *
 * **Parameters**
 * - `map` – Prepared class map for one variant axis
 * - `raw` – Runtime selection supplied by the caller
 * - `fallback` – Default selection for the same variant axis
 *
 * **Returns**
 * - `ClassValue` – Class payload associated with the resolved variant selection, or `undefined` when no matching selection exists
 */
export function resolveVariantClass(
    map: Record<string, ClassValue>,
    raw: unknown,
    fallback: unknown,
): ClassValue {
  // Prefer an explicit runtime selection and use the default only when omitted
  const value =
      raw === undefined
          ? fallback
          : raw

  // Normalize primitive values to the object-key representation used by the map
  const key = normalizeVariantKey(value)

  // Nullish and empty selections fall back to the configured default
  if (
      key === null ||
      key === "" ||
      key === undefined
  ) {
    const fallbackKey = normalizeVariantKey(fallback)

    // Return no class when the fallback is also empty or unavailable
    if (
        fallbackKey == null ||
        fallbackKey === ""
    ) {
      return undefined
    }

    // Resolve the normalized fallback selection from the prepared map
    return map[String(fallbackKey)]
  }

  // Resolve the explicit normalized selection from the prepared map
  return map[String(key)]
}
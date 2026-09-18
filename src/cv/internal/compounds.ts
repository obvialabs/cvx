import type { ClassValue } from "../../cx/types"
import type { ClassProp } from "../types"
import type { CompoundSelector, PreparedCompound } from "./model"

/**
 * Shared immutable empty compound collection
 */
const EMPTY_COMPOUNDS: readonly PreparedCompound[] = Object.freeze([])

/**
 * Read-key count below which direct linear lookup avoids Map setup overhead
 */
const LINEAR_READ_KEY_LIMIT = 8

/**
 * Prepare authored compound rules for repeated runtime matching
 *
 * **Parameters**
 * - `compounds` – Authored compound rules from the `cv` configuration
 * - `readKeys` – Mutable variant-key list shared with the runtime program
 *
 * **Returns**
 * - `PreparedCompound[]` – Prepared compound rules, or a shared empty collection when no compounds are defined
 */
export function prepareCompounds(
    compounds: readonly (ClassProp & Record<string, unknown>)[] | undefined,
    readKeys: string[],
): readonly PreparedCompound[] {
  // Reuse the shared empty collection when no compound rules are configured
  if (!compounds?.length) {
    return EMPTY_COMPOUNDS
  }

  // Allocate the exact output size once because every authored compound
  // produces one prepared runtime rule
  const prepared = new Array<PreparedCompound>(compounds.length)

  // Small variant sets are cheaper to scan directly than to materialize a Map.
  // Promote to indexed lookup only when the shared key set grows large enough
  // for repeated linear scans to become more expensive than the allocation.
  let keyIndex: Map<string, number> | undefined

  if (readKeys.length >= LINEAR_READ_KEY_LIMIT) {
    keyIndex = new Map<string, number>()

    for (let index = 0; index < readKeys.length; index++) {
      keyIndex.set(readKeys[index], index)
    }
  }

  // Prepare every authored compound rule independently
  for (let index = 0; index < compounds.length; index++) {
    const compound = compounds[index]
    const indexes: number[] = []
    const selectors: CompoundSelector[] = []

    // Convert each compound condition into an indexed runtime selector
    for (const key of Object.keys(compound)) {
      // Class output fields do not participate in selector matching
      if (
          key === "class" ||
          key === "className"
      ) {
        continue
      }

      // Reuse an existing read index when the variant key is already known.
      // Tiny key sets stay allocation-free and use a short linear scan.
      let readIndex = keyIndex
          ? keyIndex.get(key)
          : readKeys.indexOf(key)

      if (readIndex === undefined || readIndex < 0) {
        // Extend the shared read-key collection for previously unseen selectors
        readIndex = readKeys.length
        readKeys.push(key)

        if (keyIndex) {
          keyIndex.set(key, readIndex)
        } else if (readKeys.length >= LINEAR_READ_KEY_LIMIT) {
          // Promote once when the collection crosses the adaptive threshold
          keyIndex = new Map<string, number>()

          for (let keyOffset = 0; keyOffset < readKeys.length; keyOffset++) {
            keyIndex.set(readKeys[keyOffset], keyOffset)
          }
        }
      }

      // Store the resolved read index in the same order as its selector
      indexes.push(readIndex)

      const value = compound[key]

      if (Array.isArray(value)) {
        // Use a set for larger selector collections to avoid repeated linear scans
        if (value.length >= 5) {
          selectors.push({
            kind: "set",
            values: new Set(value),
          })
        } else {
          // Preserve small collections as arrays because linear scans are cheaper
          // than allocating and probing a set for very small selector lists
          selectors.push({
            kind: "list",
            values: value.slice(),
          })
        }
      } else {
        // Store scalar selectors without introducing an unnecessary collection
        selectors.push({
          kind: "single",
          value,
        })
      }
    }

    // Store prepared selectors together with their authored class outputs
    prepared[index] = {
      indexes,
      selectors,
      classValue: compound.class as ClassValue,
      classNameValue: compound.className as ClassValue,
    }
  }

  // Return the complete prepared rule collection for repeated runtime matching
  return prepared
}

/**
 * Test one resolved variant value against a prepared compound selector
 *
 * **Parameters**
 * - `selector` – Prepared single, list, or set selector
 * - `value` – Resolved runtime value for the referenced variant axis
 *
 * **Returns**
 * - `boolean` – `true` when the resolved value satisfies the selector, otherwise `false`
 */
export function matchesCompoundSelector(
    selector: CompoundSelector,
    value: unknown,
): boolean {
  // Compare scalar selectors directly without allocating intermediate state
  if (selector.kind === "single") {
    return selector.value === value
  }

  // Use set membership for selectors prepared from larger value collections
  if (selector.kind === "set") {
    return selector.values.has(value)
  }

  // Scan small selector lists in declaration order
  for (let index = 0; index < selector.values.length; index++) {
    if (selector.values[index] === value) {
      return true
    }
  }

  // No selector value matched the resolved runtime value
  return false
}
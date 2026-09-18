import type { DenseDimension, DenseTable, VariantProgram } from "./model"
import { toVariantPropValue } from "./variants"

/**
 * Build a bounded dense lookup layout for a prepared variant program
 *
 * **Parameters**
 * - `program` – Prepared variant program eligible for dense compilation
 *
 * **Returns**
 * - `DenseTable` – Prepared dense lookup table, or `undefined` when the program must use the general execution path
 */
export function buildDenseTable(
    program: VariantProgram,
): DenseTable | undefined {
  // Disable dense compilation when the configured combination limit is disabled
  // or when foreign components require runtime execution
  if (
      program.runtime.compileLimit <= 0 ||
      program.foreignChildren.length
  ) {
    return undefined
  }

  // Collect every variant key required by the current program
  const required = new Set<string>(program.readKeys)

  // Include variant keys read by composed child programs
  for (let index = 0; index < program.children.length; index++) {
    for (const key of program.children[index].readKeys) {
      required.add(key)
    }
  }

  // Convert the required key set into stable dense dimension order
  const keys = [...required]

  // Programs without runtime-readable variants do not need a dense table
  if (!keys.length) {
    return undefined
  }

  const dimensions: DenseDimension[] = []
  let combinations = 1

  // Build one lookup dimension for every required variant key
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index]
    const variant = program.mergedVariants[key]

    // Fall back when the required key does not have a known variant definition
    if (!variant) {
      return undefined
    }

    const values: unknown[] = []
    const slots = new Map<unknown, number>()

    // Convert authored variant keys into their runtime prop representations
    for (const variantKey of Object.keys(variant)) {
      const value = toVariantPropValue(variantKey)

      // Preserve only the first slot assigned to each runtime value
      if (!slots.has(value)) {
        slots.set(value, values.length)
        values.push(value)
      }
    }

    // Include the default value so omitted props can resolve through the dense table
    const defaultValue = program.defaults[key]

    if (!slots.has(defaultValue)) {
      slots.set(defaultValue, values.length)
      values.push(defaultValue)
    }

    // A dimension without any known values cannot participate in dense resolution
    if (!values.length) {
      return undefined
    }

    // Track the complete Cartesian combination count before allocating outputs
    combinations *= values.length

    // Fall back when dense compilation would exceed the configured limit
    if (combinations > program.runtime.compileLimit) {
      return undefined
    }

    // Store the dimension with a placeholder stride calculated in the next pass
    dimensions.push({
      key,
      slots,
      values,
      stride: 1,
    })
  }

  let stride = 1

  // Calculate row-major strides from the last dimension to the first
  for (let index = dimensions.length - 1; index >= 0; index--) {
    dimensions[index] = {
      ...dimensions[index],
      stride,
    }

    stride *= dimensions[index].values.length
  }

  // Return the prepared table with empty output and last-resolution caches
  return {
    dimensions,
    outputs: new Array<string | undefined>(combinations),
    lastValues: new Array<unknown>(dimensions.length),
    lastIndex: 0,
    hasLast: false,
  }
}

/**
 * Resolve runtime props to a dense lookup slot
 *
 * **Parameters**
 * - `dense` – Prepared dense lookup table
 * - `props` – Runtime variant selections
 * - `defaults` – Defaults used when a runtime selection is omitted
 *
 * **Returns**
 * - `number` – Resolved output index, or `-1` when an unknown value requires the general execution path
 */
export function resolveDenseIndex(
    dense: DenseTable,
    props: Record<string, unknown>,
    defaults: Readonly<Record<string, unknown>>,
): number {
  // Assume the previous lookup can be reused until a dimension value differs
  let same = dense.hasLast

  // Resolve the effective runtime value for every dense dimension
  for (let index = 0; index < dense.dimensions.length; index++) {
    const dimension = dense.dimensions[index]
    const raw = props[dimension.key]
    const value =
        raw === undefined
            ? defaults[dimension.key]
            : raw

    // Invalidate the fast path when any dimension differs from the previous call
    if (
        same &&
        dense.lastValues[index] !== value
    ) {
      same = false
    }

    // Store the resolved value for either cache reuse or index calculation
    dense.lastValues[index] = value
  }

  // Reuse the previous dense index when every dimension remains unchanged
  if (same) {
    return dense.lastIndex
  }

  let resolved = 0

  // Convert each resolved dimension value into its numeric dense slot
  for (let index = 0; index < dense.dimensions.length; index++) {
    const dimension = dense.dimensions[index]
    const slot = dimension.slots.get(dense.lastValues[index])

    // Unknown runtime values cannot be represented by the prepared dense table
    if (slot === undefined) {
      dense.hasLast = false
      return -1
    }

    // Combine the dimension slot with its precomputed row-major stride
    resolved += slot * dimension.stride
  }

  // Cache the successful lookup so identical consecutive calls can return immediately
  dense.hasLast = true
  dense.lastIndex = resolved

  return resolved
}
import type { DenseDimension, DenseTable, VariantProgram } from "./model";
import { toVariantPropValue } from "./variants";

/**
 * Creates a bounded dense lookup layout for fully-known variant dimensions.
 * The table is populated lazily so component creation stays inexpensive.
 */
export function buildDenseTable(program: VariantProgram): DenseTable | undefined {
  if (program.runtime.compileLimit <= 0 || program.foreignChildren.length) {
    return undefined;
  }

  const required = new Set<string>(program.readKeys);
  for (let index = 0; index < program.children.length; index++) {
    for (const key of program.children[index].readKeys) required.add(key);
  }

  const keys = [...required];
  if (!keys.length) return undefined;

  const dimensions: DenseDimension[] = [];
  let combinations = 1;

  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    const variant = program.mergedVariants[key];
    if (!variant) return undefined;

    const values: unknown[] = [];
    const slots = new Map<unknown, number>();
    for (const variantKey of Object.keys(variant)) {
      const value = toVariantPropValue(variantKey);
      if (!slots.has(value)) {
        slots.set(value, values.length);
        values.push(value);
      }
    }

    const defaultValue = program.defaults[key];
    if (!slots.has(defaultValue)) {
      slots.set(defaultValue, values.length);
      values.push(defaultValue);
    }

    if (!values.length) return undefined;
    combinations *= values.length;
    if (combinations > program.runtime.compileLimit) return undefined;

    dimensions.push({ key, slots, values, stride: 1 });
  }

  let stride = 1;
  for (let index = dimensions.length - 1; index >= 0; index--) {
    dimensions[index] = { ...dimensions[index], stride };
    stride *= dimensions[index].values.length;
  }

  return {
    dimensions,
    outputs: new Array<string | undefined>(combinations),
    lastValues: new Array<unknown>(dimensions.length),
    lastIndex: 0,
    hasLast: false,
  };
}

/** Resolves props into a dense table slot, returning -1 for unknown values. */
export function resolveDenseIndex(
  dense: DenseTable,
  props: Record<string, unknown>,
  defaults: Readonly<Record<string, unknown>>,
): number {
  let same = dense.hasLast;

  for (let index = 0; index < dense.dimensions.length; index++) {
    const dimension = dense.dimensions[index];
    const raw = props[dimension.key];
    const value = raw === undefined ? defaults[dimension.key] : raw;
    if (same && dense.lastValues[index] !== value) same = false;
    dense.lastValues[index] = value;
  }

  if (same) return dense.lastIndex;

  let resolved = 0;
  for (let index = 0; index < dense.dimensions.length; index++) {
    const dimension = dense.dimensions[index];
    const slot = dimension.slots.get(dense.lastValues[index]);
    if (slot === undefined) {
      dense.hasLast = false;
      return -1;
    }
    resolved += slot * dimension.stride;
  }

  dense.hasLast = true;
  dense.lastIndex = resolved;
  return resolved;
}

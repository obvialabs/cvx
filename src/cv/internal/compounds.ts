/**
 * Compound-variant preparation and matching for the `cv` domain.
 *
 * @internal
 */

import type { ClassValue } from "../../cx/types.js";
import type { ClassProp } from "../types.js";
import type { CompoundSelector, PreparedCompound } from "./model.js";

const EMPTY_COMPOUNDS: readonly PreparedCompound[] = Object.freeze([]);

/**
 * Precompiles authored compound selectors into index-based checks.
 * Larger selector arrays become sets to keep membership checks bounded.
 */
export function prepareCompounds(
  compounds: readonly (ClassProp & Record<string, unknown>)[] | undefined,
  readKeys: string[],
): readonly PreparedCompound[] {
  if (!compounds?.length) return EMPTY_COMPOUNDS;

  const prepared = new Array<PreparedCompound>(compounds.length);
  const keyIndex = new Map<string, number>();
  for (let index = 0; index < readKeys.length; index++) {
    keyIndex.set(readKeys[index], index);
  }

  for (let index = 0; index < compounds.length; index++) {
    const compound = compounds[index];
    const indexes: number[] = [];
    const selectors: CompoundSelector[] = [];

    for (const key of Object.keys(compound)) {
      if (key === "class" || key === "className") continue;

      let readIndex = keyIndex.get(key);
      if (readIndex === undefined) {
        readIndex = readKeys.length;
        readKeys.push(key);
        keyIndex.set(key, readIndex);
      }

      indexes.push(readIndex);
      const value = compound[key];
      if (Array.isArray(value)) {
        selectors.push(
          value.length >= 5
            ? { kind: "set", values: new Set(value) }
            : { kind: "list", values: value.slice() },
        );
      } else {
        selectors.push({ kind: "single", value });
      }
    }

    prepared[index] = {
      indexes,
      selectors,
      classValue: compound.class as ClassValue,
      classNameValue: compound.className as ClassValue,
    };
  }

  return prepared;
}

/** Tests a resolved variant value against a precompiled compound selector. */
export function matchesCompoundSelector(
  selector: CompoundSelector,
  value: unknown,
): boolean {
  if (selector.kind === "single") return selector.value === value;
  if (selector.kind === "set") return selector.values.has(value);

  for (let index = 0; index < selector.values.length; index++) {
    if (selector.values[index] === value) return true;
  }
  return false;
}

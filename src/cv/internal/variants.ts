/**
 * Variant normalization and metadata composition for the `cv` domain.
 *
 * @internal
 */

import type { ClassValue } from "../../cx/types.js";
import type { CVComponentShape, VariantShape } from "../types.js";

const EMPTY_OBJECT: Readonly<Record<string, never>> = Object.freeze({});

/** Normalizes runtime values to the string-key representation used by variant maps. */
export function normalizeVariantKey(value: unknown): unknown {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === 0) return "0";
  return value;
}

/** Restores primitive variant keys while preparing dense lookup dimensions. */
export function toVariantPropValue(key: string): unknown {
  if (key === "true") return true;
  if (key === "false") return false;

  const number = Number(key);
  return Number.isFinite(number) && String(number) === key ? number : key;
}

/** Copies user-authored maps into plain data objects detached from prototypes. */
export function copyVariantMap(
  source: Record<string, ClassValue> | undefined,
): Record<string, ClassValue> {
  const output: Record<string, ClassValue> = {};
  if (!source) return output;

  for (const key of Object.keys(source)) output[key] = source[key];
  return output;
}

/**
 * Combines composed component metadata with the local definition.
 * Later definitions win, matching normal composition expectations.
 */
export function mergeVariantMetadata(
  childComponents: readonly CVComponentShape[],
  definition: Record<string, any>,
): { variants: VariantShape; defaults: Record<string, unknown> } {
  const variants: VariantShape = {};
  let defaults: Record<string, unknown> = {};

  const mergeOne = (source: Record<string, any> | undefined) => {
    if (!source) return;

    const sourceVariants = source.variants as VariantShape | undefined;
    if (sourceVariants) {
      for (const key of Object.keys(sourceVariants)) {
        variants[key] = {
          ...(variants[key] ?? EMPTY_OBJECT),
          ...sourceVariants[key],
        };
      }
    }

    if (source.defaults) {
      defaults = { ...defaults, ...source.defaults };
    }
  };

  for (let index = 0; index < childComponents.length; index++) {
    mergeOne(childComponents[index].config as Record<string, any>);
  }
  mergeOne(definition);

  return { variants, defaults };
}

/** Resolves one variant class while preserving the runtime falsy-selection semantics. */
export function resolveVariantClass(
  map: Record<string, ClassValue>,
  raw: unknown,
  fallback: unknown,
): ClassValue {
  const value = raw === undefined ? fallback : raw;
  const key = normalizeVariantKey(value);

  if (key === null || key === "" || key === undefined) {
    const fallbackKey = normalizeVariantKey(fallback);
    return fallbackKey == null || fallbackKey === ""
      ? undefined
      : map[String(fallbackKey)];
  }

  return map[String(key)];
}

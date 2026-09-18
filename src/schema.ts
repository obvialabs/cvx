/**
 * Portions of this file are derived from Class Variance Authority / cva.
 * Copyright 2022-present Joe Bell and contributors. Licensed under Apache-2.0.
 * Modifications Copyright 2026 Selçuk Çukur / Obvia.
 */

import type {
  CVComponentShape,
  InternalVariantKey,
  StringToBoolean,
  VariantShape,
} from "./types";

type SchemaEntry<Variants, Variant extends keyof Variants, Default> = {
  values: ReadonlyArray<StringToBoolean<keyof Variants[Variant]>>;
} & ([Default] extends [undefined]
  ? {}
  : { defaultValue: Readonly<StringToBoolean<Default>> });

export type Schema<Component extends CVComponentShape> =
  Component["config"] extends {
    variants?: infer Variants extends VariantShape;
    defaultVariants?: infer Defaults;
  }
    ? {
        [Variant in keyof Variants as Variant extends InternalVariantKey
          ? never
          : Variant]: SchemaEntry<
          Variants,
          Variant,
          Variant extends keyof Defaults ? Defaults[Variant] : undefined
        >;
      }
    : {};

export function getSchema<Component extends CVComponentShape>(
  component: Component,
): Schema<Component> {
  const variants = component.config?.variants as VariantShape | undefined;
  if (!variants) return {} as Schema<Component>;
  const defaults = (component.config?.defaultVariants || {}) as Record<
    string,
    unknown
  >;
  const result: Record<string, any> = {};

  for (const key of Object.keys(variants)) {
    if (key.startsWith("_")) continue;
    const values = Object.keys(variants[key]).map((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      const number = Number(value);
      return Number.isFinite(number) && String(number) === value
        ? number
        : value;
    });
    if (!values.length && defaults[key] === undefined) continue;
    result[key] =
      defaults[key] === undefined
        ? { values }
        : { values, defaultValue: defaults[key] };
  }

  return result as Schema<Component>;
}

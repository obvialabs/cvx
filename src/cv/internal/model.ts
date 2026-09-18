/**
 * Executable data model shared by the CV compiler and render paths.
 *
 * @internal
 */

import type { ClassValue } from "../../cx/types.js";
import type { CVComponentShape, VariantShape } from "../types.js";

/** Runtime tuning that remains private to the CV engine. */
export interface VariantRuntime {
  compileLimit: number;
}

/** Precompiled selector used by a compound variant. */
export type CompoundSelector =
  | { kind: "single"; value: unknown }
  | { kind: "list"; values: readonly unknown[] }
  | { kind: "set"; values: ReadonlySet<unknown> };

/** Compact compound representation used during rendering. */
export interface PreparedCompound {
  indexes: readonly number[];
  selectors: readonly CompoundSelector[];
  classValue: ClassValue;
  classNameValue: ClassValue;
}

/** One axis of a dense variant lookup table. */
export interface DenseDimension {
  key: string;
  slots: ReadonlyMap<unknown, number>;
  values: readonly unknown[];
  stride: number;
}

/** Lazily populated lookup table for bounded variant combinations. */
export interface DenseTable {
  dimensions: readonly DenseDimension[];
  outputs: (string | undefined)[];
  lastValues: unknown[];
  lastIndex: number;
  hasLast: boolean;
}

/** Fully prepared executable representation of one `cv` definition. */
export interface VariantProgram {
  runtime: VariantRuntime;
  children: readonly VariantProgram[];
  foreignChildren: readonly CVComponentShape[];
  base: ClassValue;
  localVariantKeys: readonly string[];
  localVariantMaps: readonly Record<string, ClassValue>[];
  readKeys: readonly string[];
  compounds: readonly PreparedCompound[];
  defaults: Readonly<Record<string, unknown>>;
  mergedVariants: VariantShape;
  dense?: DenseTable | null;
  staticOutput?: string;
  render(
    props: Record<string, unknown>,
    inheritedDefaults?: Readonly<Record<string, unknown>>,
    includeClassProps?: boolean,
  ): string;
}

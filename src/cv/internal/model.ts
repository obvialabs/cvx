import type { ClassValue } from "../../cx/types"
import type { CVComponentShape, VariantShape } from "../types"

/**
 * Internal runtime tuning shared by every program created from one CV factory.
 */
export interface VariantRuntime {
  /**
   * Maximum bounded variant-space size eligible for dense lookup compilation.
   *
   * @default 512
   */
  compileLimit: number
}

/**
 * Precompiled selector used by a compound rule.
 */
export type CompoundSelector =
  | { kind: "single"; value: unknown }
  | { kind: "list"; values: readonly unknown[] }
  | { kind: "set"; values: ReadonlySet<unknown> }

/**
 * Compact compound rule consumed by the render loop.
 */
export interface PreparedCompound {
  /**
   * Numeric indexes into the program's shared resolved-value array
   */
  indexes: readonly number[]

  /**
   * Prepared selectors aligned with `indexes`
   */
  selectors: readonly CompoundSelector[]

  /**
   * Class payload authored through the `class` property
   */
  classValue: ClassValue

  /**
   * Class payload authored through the `className` property
   */
  classNameValue: ClassValue
}

/**
 * One axis of a dense variant lookup table.
 */
export interface DenseDimension {
  /**
   * Variant key resolved by this dimension
   */
  key: string

  /**
   * Runtime variant values mapped to their local slot indexes
   */
  slots: ReadonlyMap<unknown, number>

  /**
   * Runtime values represented by the dimension
   */
  values: readonly unknown[]

  /**
   * Row-major multiplier used to calculate the final dense table index
   */
  stride: number
}

/**
 * Lazily populated lookup table for bounded variant combinations.
 */
export interface DenseTable {
  /**
   * Variant dimensions participating in the dense lookup
   */
  dimensions: readonly DenseDimension[]

  /**
   * Cached class outputs indexed by the resolved dense combination
   */
  outputs: (string | undefined)[]

  /**
   * Last resolved runtime values used by the single-entry hot cache
   */
  lastValues: unknown[]

  /**
   * Dense output index associated with `lastValues`
   */
  lastIndex: number

  /**
   * Whether `lastValues` contains a valid previous resolution
   */
  hasLast: boolean
}

/**
 * Fully prepared executable representation of one `cv` definition.
 */
export interface VariantProgram {
  /**
   * Runtime settings shared by the program and its dense lookup builder
   */
  runtime: VariantRuntime

  /**
   * Child CVX programs that can execute without wrapper calls
   */
  children: readonly VariantProgram[]

  /**
   * Composed callable components that do not expose a prepared CVX program
   */
  foreignChildren: readonly CVComponentShape[]

  /**
   * Base class payload emitted before local variant classes
   */
  base: ClassValue

  /**
   * Local variant keys in the same order as `localVariantMaps`
   */
  localVariantKeys: readonly string[]

  /**
   * Prepared class maps aligned with `localVariantKeys`
   */
  localVariantMaps: readonly Record<string, ClassValue>[]

  /**
   * Variant keys required by local classes, compounds, and child programs
   */
  readKeys: readonly string[]

  /**
   * Prepared compound rules evaluated by the general render path
   */
  compounds: readonly PreparedCompound[]

  /**
   * Effective defaults after composition and local overrides
   */
  defaults: Readonly<Record<string, unknown>>

  /**
   * Effective variant map after composition and local overrides
   */
  mergedVariants: VariantShape

  /**
   * Dense lookup state, `null` when unsupported, or `undefined` before compilation
   */
  dense?: DenseTable | null

  /**
   * Fully static class output for definitions with no runtime variant work
   */
  staticOutput?: string

  /**
   * Render the program for one runtime selection
   *
   * **Parameters**
   * - `props` – Runtime variant selections and optional class overrides
   * - `inheritedDefaults` – Defaults inherited from a parent composition
   * - `includeClassProps` – Whether runtime `class` and `className` overrides should be appended
   */
  render(
    props: Record<string, unknown>,
    inheritedDefaults?: Readonly<Record<string, unknown>>,
    includeClassProps?: boolean,
  ): string
}

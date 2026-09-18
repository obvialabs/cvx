import type { ClassValue } from "../../cx/types"

/**
 * Packed lookup tables consumed by the Tailwind conflict engine
 */
export interface Tables {
  /**
   * Number of statically compiled conflict groups
   */
  GROUP_COUNT: number

  /**
   * CSR offsets mapping each radix node to its outgoing edge range
   */
  edgeStart: Int32Array

  /**
   * CSR offsets mapping each edge to its label range inside `labelText`
   */
  labelStart: Int32Array

  /**
   * Concatenated radix-edge label characters
   */
  labelText: string

  /**
   * Target radix node for each edge
   */
  edgeTarget: Int32Array

  /**
   * Conflict group assigned to each node, offset by one so zero means none
   */
  nodeGroup: Int32Array

  /**
   * Validator-list identifier assigned to each node, or -1 when absent
   */
  nodeVlist: Int32Array

  /**
   * CSR offsets mapping validator patterns to opcode ranges
   */
  vlistPat: Int32Array

  /**
   * Compiled validator opcodes
   */
  vlistOps: Int32Array

  /**
   * Validator-list to shared opcode-pattern references
   */
  vlistRef: Int32Array

  /**
   * Flat conflict-group identifiers associated with validator lists
   */
  vlistGroup: Int32Array

  /**
   * Anchor radix node for each lifted literal entry
   */
  litAnchor: Int32Array

  /**
   * Conflict group for each lifted literal entry
   */
  litGroup: Int32Array

  /**
   * String-pool reference for each lifted literal entry
   */
  litPool: Int32Array

  /**
   * Offset and length pairs for strings stored in `poolText`
   */
  poolOffsets: Int32Array

  /**
   * Deduplicated literal-tail text pool
   */
  poolText: string

  /**
   * Source conflict-group identifier for each adjacency row
   */
  adjGid: Int32Array

  /**
   * CSR offsets mapping adjacency rows to overridden group ranges
   */
  adjStart: Int32Array

  /**
   * Conflict groups overridden by adjacency rows
   */
  adjTgt: Int32Array

  /**
   * Source groups participating in postfix-specific conflicts
   */
  patGid: Int32Array

  /**
   * Target groups participating in postfix-specific conflicts
   */
  patTgt: Int32Array

  /**
   * Groups requiring a second lookup when a postfix modifier is present
   */
  postfixLookupGroups: Int32Array

  /**
   * Custom validator names that could not be compiled into built-in opcodes
   */
  customValidatorNames: string[]

  /**
   * Space-delimited modifier names whose order affects semantic meaning
   */
  orderSensitiveModifiers: string

  /**
   * Optional Tailwind CSS v4 class prefix encoded by the table set
   */
  prefix?: string
}

/**
 * Runtime options accepted when creating a conflict engine
 */
export interface EngineOptions {
  /**
   * Whole-string result cache size
   *
   * @default implementation-defined
   */
  cacheSize?: number

  /**
   * Tailwind CSS v4 prefix overriding the prefix encoded by compiled tables
   */
  prefix?: string
}

/**
 * Runtime implementations for custom validators referenced by compiled tables
 */
export type ValidatorImpls = Record<string, (value: string) => boolean>

/**
 * Minimal input grammar accepted by the low-level string merge engine
 */
export type MergeInput =
  | MergeInputArray
  | string
  | null
  | undefined
  | 0
  | 0n
  | false

/**
 * Nested merge-input collection
 */
export type MergeInputArray = readonly MergeInput[]

/**
 * Executable Tailwind conflict engine
 */
export interface Engine {
  /**
   * Merge variadic low-level inputs with conflict resolution
   */
  merge: (...inputs: MergeInput[]) => string

  /**
   * Merge one already-composed class string
   */
  mergeString: (input: string) => string

  /**
   * Record a freshly composed string and report whether it was seen previously
   */
  seenBefore: (input: string) => boolean

  /**
   * Merge one class string while bypassing the whole-string result cache
   */
  mergeUncached: (input: string) => string
}

/**
 * Cache hooks consumed by the class-value composition wrapper
 */
export type FreshMergeEngine = Pick<Engine, "seenBefore" | "mergeUncached">

/**
 * Internal callable shape used by conflict-aware class composition
 */
export type CnFunction = (...inputs: ClassValue[]) => string

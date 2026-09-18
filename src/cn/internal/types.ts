import type { ClassValue } from "../../cx/types"

export type { ClassValue } from "../../cx/types"

/**
 * Compiled lookup tables consumed by the conflict engine. The representation
 * uses flat typed arrays and pooled strings so runtime classification can stay
 * allocation-light.
 */
export interface Tables {
  /** number of static conflict groups */
  GROUP_COUNT: number
  /** CSR: node → [start,end) range into edge arrays */
  edgeStart: Int32Array
  /** CSR: edge → [start,end) range into labelText */
  labelStart: Int32Array
  /** radix-edge label characters, concatenated */
  labelText: string
  /** edge → target node */
  edgeTarget: Int32Array
  /** node → group id (0 = none) offset by 1 */
  nodeGroup: Int32Array
  /** node → validator-list id (-1 = none) */
  nodeVlist: Int32Array
  /** CSR: validator-list pattern → [start,end) into vlistOps */
  vlistPat: Int32Array
  /** validator opcodes */
  vlistOps: Int32Array
  /** validator-list → op pattern id */
  vlistRef: Int32Array
  /** flat per-list group ids (delta-coded at generation) */
  vlistGroup: Int32Array
  /** lifted-literal entry → anchor node */
  litAnchor: Int32Array
  /** lifted-literal entry → group id */
  litGroup: Int32Array
  /** lifted-literal entry → pool string id */
  litPool: Int32Array
  /** pool string id → (offset, length) pairs into poolText */
  poolOffsets: Int32Array
  /** deduplicated literal tail text */
  poolText: string
  /** conflict adjacency: row → source group id */
  adjGid: Int32Array
  /** CSR: row → [start,end) into adjTgt */
  adjStart: Int32Array
  /** overridden group ids */
  adjTgt: Int32Array
  /** postfix-extra conflict pairs (conflictingClassGroupModifiers) */
  patGid: Int32Array
  patTgt: Int32Array
  /** groups participating in postfix re-lookup (postfixLookupClassGroups) */
  postfixLookupGroups: Int32Array
  /** names of validators not compiled to span opcodes (custom configs) */
  customValidatorNames: string[]
  /** space-separated order-sensitive variant names */
  orderSensitiveModifiers: string
  /** optional Tailwind v4 prefix baked into the tables */
  prefix?: string
}

export interface EngineOptions {
  /** Whole-string result cache size; `0` disables caching. */
  cacheSize?: number
  /** Tailwind v4 prefix (`tw` matches `tw:hover:p-4`); overrides tables */
  prefix?: string
}

/** Implementations for validators named in `Tables.customValidatorNames`. */
export type ValidatorImpls = Record<string, (value: string) => boolean>

/** Minimal string/array grammar accepted by the low-level merge engine. */
export type MergeInput =
  MergeInputArray | string | null | undefined | 0 | 0n | false
export type MergeInputArray = readonly MergeInput[]

export interface Engine {
  /** Merges variadic string/array inputs with conflict resolution. */
  merge: (...inputs: MergeInput[]) => string
  /** merge one already-joined class string */
  mergeString: (input: string) => string
  /**
   * doorkeeper probe for a string that was just built: records this
   * sighting and reports whether an earlier one exists. A first sighting
   * is best merged with `mergeUncached` and not cached anywhere.
   */
  seenBefore: (input: string) => boolean
  /** merge one string, bypassing the whole-string cache */
  mergeUncached: (input: string) => string
}

/** Cache hooks used by the class-value composition wrapper. */
export type FreshMergeEngine = Pick<Engine, "seenBefore" | "mergeUncached">

/** Internal callable shape used by the conflict-aware `cn` wrapper. */
export type CnFunction = (...inputs: ClassValue[]) => string

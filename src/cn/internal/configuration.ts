/**
 * Internal configuration bridge for the `cn` domain.
 *
 * CVX does not expose configuration helpers publicly. These factories exist so
 * generated tables, differential tests, and future build-time tooling can share
 * one compiler contract without expanding the npm API surface.
 *
 * @internal
 */

import {
  compileToTables,
  mergeConfigs,
  type CnConfig,
  type ClassGroupDef,
  type ConfigExtension,
  type CreateCnInput,
} from "./compiler.js"
import { getDefaultCnConfig } from "./generated/default-config.js"
import { createEngine, wrapClsx } from "./engine.js"
import type { CnFunction, Engine } from "./types.js"

export { getDefaultCnConfig as defaultConfig }
export { mergeConfigs }
export type { CnConfig, ClassGroupDef, ConfigExtension, CreateCnInput }
export type {
  DefaultClassGroupIds,
  DefaultThemeGroupIds,
} from "./generated/default-config.js"

/** Reference a theme scale from a class-group definition. */
export const fromTheme = (key: string): { $t: string } => ({ $t: key })

/**
 * Marker-form validators for custom class groups (compiled to allocation-free
 * span opcodes — prefer these over passing tailwind-merge's validator
 * functions, which run as slower custom validators).
 */
export const validators = {
  isAny: { $v: "isAny" },
  isAnyNonArbitrary: { $v: "isAnyNonArbitrary" },
  isArbitraryValue: { $v: "isArbitraryValue" },
  isArbitraryVariable: { $v: "isArbitraryVariable" },
  isFraction: { $v: "isFraction" },
  isNumber: { $v: "isNumber" },
  isInteger: { $v: "isInteger" },
  isPercent: { $v: "isPercent" },
  isTshirtSize: { $v: "isTshirtSize" },
  isNamedContainerQuery: { $v: "isNamedContainerQuery" },
  isArbitraryLength: { $v: "isArbitraryLength" },
  isArbitraryNumber: { $v: "isArbitraryNumber" },
  isArbitraryWeight: { $v: "isArbitraryWeight" },
  isArbitraryFamilyName: { $v: "isArbitraryFamilyName" },
  isArbitraryPosition: { $v: "isArbitraryPosition" },
  isArbitrarySize: { $v: "isArbitrarySize" },
  isArbitraryImage: { $v: "isArbitraryImage" },
  isArbitraryShadow: { $v: "isArbitraryShadow" },
  isArbitraryVariableLength: { $v: "isArbitraryVariableLength" },
  isArbitraryVariableFamilyName: { $v: "isArbitraryVariableFamilyName" },
  isArbitraryVariablePosition: { $v: "isArbitraryVariablePosition" },
  isArbitraryVariableSize: { $v: "isArbitraryVariableSize" },
  isArbitraryVariableImage: { $v: "isArbitraryVariableImage" },
  isArbitraryVariableShadow: { $v: "isArbitraryVariableShadow" },
  isArbitraryVariableWeight: { $v: "isArbitraryVariableWeight" },
} as const

const isFullConfig = (input: object): input is CnConfig =>
  "classGroups" in input &&
  "theme" in input &&
  "conflictingClassGroups" in input

const resolveConfig = (
  input?: CreateCnInput
): { config: CnConfig; cacheSize?: number } => {
  if (input === undefined) return { config: getDefaultCnConfig() }
  if (typeof input === "function")
    return { config: input(getDefaultCnConfig()) }
  if (isFullConfig(input)) return { config: input }
  return {
    config: mergeConfigs(getDefaultCnConfig(), input),
    cacheSize: input.cacheSize,
  }
}

const buildEngine = (input?: CreateCnInput): Engine => {
  const { config, cacheSize } = resolveConfig(input)
  const { tables, validatorImpls, prefix } = compileToTables(config)
  return createEngine(tables, validatorImpls, { cacheSize, prefix })
}

/**
 * Creates an isolated conflict-aware composer for internal verification and
 * tooling. Compilation is lazy and never participates in the public root API.
 *
 * @internal
 */
export const createCn = (input?: CreateCnInput): CnFunction => {
  let engine: Engine | null = null
  const getEngine = (): Engine => engine ?? (engine = buildEngine(input))
  return wrapClsx((s: string) => getEngine().mergeString(s), {
    seenBefore: (s: string) => getEngine().seenBefore(s),
    mergeUncached: (s: string) => getEngine().mergeUncached(s),
  })
}

/**
 * Creates the lower-level string merge form used by differential tests.
 *
 * @internal
 */
export const createTwMerge = (input?: CreateCnInput): Engine["merge"] => {
  let engine: Engine | null = null
  return function (): string {
    if (engine === null) engine = buildEngine(input)

    return engine.merge.apply(null, arguments as never)
  } as Engine["merge"]
}

/** @internal Compatibility alias retained only inside the `cn` domain. */
export const extendTailwindMerge = createTwMerge

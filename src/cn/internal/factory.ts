import { compileToTables } from "./compiler"
import {
  mergeConfigs,
  type CnConfig,
  type ClassGroupDefinition,
  type CnConfigExtension,
  type CnConfigurationInput,
} from "./compiler"
import { getDefaultCnConfig } from "./generated/default-config"
import { createEngine } from "./engine"
import { wrapComposer } from "./engine/compose"
import type { CnFunction, Engine } from "./types"

export { getDefaultCnConfig as defaultConfig }
export { mergeConfigs }
export type {
  CnConfig,
  ClassGroupDefinition,
  CnConfigExtension,
  CnConfigurationInput,
}
export type {
  DefaultClassGroupIds,
  DefaultThemeGroupIds,
} from "./generated/default-config"

/**
 * Create an internal theme-scale reference for a class-group definition
 *
 * **Parameters**
 * - `key` – Theme scale name referenced by the class-group definition
 */
export const fromTheme = (key: string): { $t: string } => ({ $t: key })

/**
 * Validator markers understood by the internal conflict compiler
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

/**
 * Determine whether a configuration input is already a complete compiler config
 */
const isFullConfig = (input: object): input is CnConfig =>
  "classGroups" in input &&
  "theme" in input &&
  "conflictingClassGroups" in input

/**
 * Normalize an internal configuration input into a complete compiler config
 */
const resolveConfig = (
  input?: CnConfigurationInput,
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

/**
 * Compile one internal configuration and create its executable merge engine
 */
const buildEngine = (input?: CnConfigurationInput): Engine => {
  const { config, cacheSize } = resolveConfig(input)
  const { tables, validatorImpls, prefix } = compileToTables(config)
  return createEngine(tables, validatorImpls, { cacheSize, prefix })
}

/**
 * Create an isolated conflict-aware class composer from internal configuration
 *
 * Compilation is deferred until the first call so tests that only inspect the
 * factory do not pay table-construction cost. This function is not part of the
 * public package surface.
 *
 * **Parameters**
 * - `input` – Full config, incremental extension, or config transform
 *
 * **Returns**
 * - `*` - A `cn`-compatible class composer backed by the configured conflict engine
 */
export const createConfiguredCn = (
  input?: CnConfigurationInput,
): CnFunction => {
  let engine: Engine | null = null
  const getEngine = (): Engine => engine ?? (engine = buildEngine(input))
  return wrapComposer((s: string) => getEngine().mergeString(s), {
    seenBefore: (s: string) => getEngine().seenBefore(s),
    mergeUncached: (s: string) => getEngine().mergeUncached(s),
  })
}

/**
 * Create an isolated low-level merge function from internal configuration
 *
 * **Parameters**
 * - `input` – Full config, incremental extension, or config transform
 *
 * **Returns**
 * - `*` - A low-level merge function accepting the engine's string/array grammar
 */
export const createConfiguredMerge = (
  input?: CnConfigurationInput,
): Engine["merge"] => {
  let engine: Engine | null = null
  return function (): string {
    if (engine === null) engine = buildEngine(input)

    return engine.merge.apply(null, arguments as never)
  } as Engine["merge"]
}


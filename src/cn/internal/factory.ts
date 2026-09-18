/**
 * Internal factory layer for the `cn` domain.
 *
 * CVX does not expose configuration helpers publicly. These factories connect configuration compilation to the runtime engine for
 * differential tests and internal tooling without expanding the npm API
 * surface.
 *
 * @internal
 */

import { compileToTables } from "./compiler/index.js"
import {
  mergeConfigs,
  type CnConfig,
  type ClassGroupDefinition,
  type CnConfigExtension,
  type CnConfigurationInput,
} from "./compiler/config.js"
import { getDefaultCnConfig } from "./generated/default-config.js"
import { createEngine } from "./engine/index.js"
import { wrapComposer } from "./engine/compose.js"
import type { CnFunction, Engine } from "./types.js"

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
} from "./generated/default-config.js"

/** Reference a theme scale from a class-group definition. */
export const fromTheme = (key: string): { $t: string } => ({ $t: key })

/**
 * Marker-form validators for custom class groups. Known markers compile to
 * allocation-free span opcodes; function validators remain available to
 * internal tooling when a custom predicate is unavoidable.
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
  input?: CnConfigurationInput
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

const buildEngine = (input?: CnConfigurationInput): Engine => {
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
 * Creates the lower-level string merge form used by differential tests.
 *
 * @internal
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


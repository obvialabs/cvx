/**
 * One class-group definition consumed by the conflict compiler
 */
export type ClassGroupDefinition =
    | string
    | { $v: string }
    | { $t: string }
    | ((value: string) => boolean)
    | { [key: string]: readonly ClassGroupDefinition[] }

/**
 * Complete conflict configuration compiled into runtime lookup tables
 */
export interface CnConfig {
  /**
   * Theme scales referenced by class-group definitions
   */
  theme: Record<string, ClassGroupDefinition[]>

  /**
   * Class groups used to classify Tailwind utility tokens
   */
  classGroups: Record<string, ClassGroupDefinition[]>

  /**
   * Class groups overridden by another class group
   */
  conflictingClassGroups: Record<string, readonly string[]>

  /**
   * Additional conflicts activated by postfix modifiers
   */
  conflictingClassGroupModifiers: Record<string, readonly string[]>

  /**
   * Variant modifiers whose order changes semantic meaning
   */
  orderSensitiveModifiers: string[]

  /**
   * Groups that must be reclassified when a postfix modifier is present
   */
  postfixLookupClassGroups?: readonly string[]

  /**
   * Optional Tailwind CSS v4 class prefix
   */
  prefix?: string
}

/**
 * Configuration collections that can be overridden or extended independently
 */
type CnConfigExtensionGroups = {
  /**
   * Theme scales referenced by class-group definitions
   */
  theme: Record<string, readonly ClassGroupDefinition[]>

  /**
   * Class groups used to classify Tailwind utility tokens
   */
  classGroups: Record<string, readonly ClassGroupDefinition[]>

  /**
   * Class groups overridden by another class group
   */
  conflictingClassGroups: Record<string, readonly string[]>

  /**
   * Additional conflicts activated by postfix modifiers
   */
  conflictingClassGroupModifiers: Record<string, readonly string[]>

  /**
   * Variant modifiers whose order changes semantic meaning
   */
  orderSensitiveModifiers: readonly string[]
}

/**
 * Internal extension shape used by compiler tests and tooling
 */
export interface CnConfigExtension {
  /**
   * Optional Tailwind CSS v4 class prefix
   */
  prefix?: string

  /**
   * Whole-string cache size used by the runtime engine
   */
  cacheSize?: number

  /**
   * Configuration groups replaced before compilation
   */
  override?: Partial<CnConfigExtensionGroups>

  /**
   * Configuration groups appended before compilation
   */
  extend?: Partial<CnConfigExtensionGroups>
}

/**
 * Configuration input accepted by the internal conflict compiler
 */
export type CnConfigurationInput =
    | CnConfigExtension
    | ((config: CnConfig) => CnConfig)
    | CnConfig

/**
 * Clone a conflict configuration into independently mutable collections
 *
 * **Parameters**
 * - `config` – Conflict configuration to clone
 *
 * **Returns**
 * - `CnConfig` – Independent mutable copy of the supplied configuration
 */
export const cloneConfig = (
    config: CnConfig,
): CnConfig => ({
  // Preserve scalar and optional configuration fields
  ...config,

  // Clone theme groups so compiler mutations never affect the source object
  theme: {
    ...config.theme,
  },

  // Clone class groups for independent normalization and subsetting
  classGroups: {
    ...config.classGroups,
  },

  // Clone ordinary conflict relationships
  conflictingClassGroups: {
    ...config.conflictingClassGroups,
  },

  // Clone postfix-specific conflict relationships
  conflictingClassGroupModifiers: {
    ...config.conflictingClassGroupModifiers,
  },

  // Clone ordered modifiers because their sequence is semantically significant
  orderSensitiveModifiers: [
    ...config.orderSensitiveModifiers,
  ],

  // Normalize an omitted postfix lookup collection to an independent empty array
  postfixLookupClassGroups: [
    ...(config.postfixLookupClassGroups ?? []),
  ],
})

/**
 * Merge a configuration extension into a cloned base configuration
 *
 * **Parameters**
 * - `base` – Base conflict configuration to clone before applying changes
 * - `extension` – Prefix, override, and extension values to apply
 *
 * **Returns**
 * - `CnConfig` – New conflict configuration containing the merged extension
 */
export const mergeConfigs = (
    base: CnConfig,
    extension: CnConfigExtension,
): CnConfig => {
  // Clone first so extension processing never mutates the caller's configuration
  const config = cloneConfig(base)

  // Replace the optional Tailwind prefix only when the extension provides one
  if (extension.prefix !== undefined) {
    config.prefix = extension.prefix
  }

  /**
   * Replace explicitly supplied properties on one configuration collection
   *
   * **Parameters**
   * - `target` – Mutable destination collection receiving replacement values
   * - `source` – Optional collection containing values that should replace the target
   *
   * **Returns**
   * - `void` – Mutates the destination collection without returning a value
   */
  const overrideProps = <Value>(
      target: Record<string, Value>,
      source?: Record<string, Value>,
  ): void => {
    // Leave the destination unchanged when no override collection was supplied
    if (!source) {
      return
    }

    // Replace only explicitly provided keys and preserve every untouched group
    for (const key in source) {
      const value = source[key]

      if (value !== undefined) {
        target[key] = value
      }
    }
  }

  const override = extension.override

  if (override) {
    // Replace modifier ordering as one complete sequence when explicitly overridden
    if (override.orderSensitiveModifiers) {
      config.orderSensitiveModifiers = [
        ...override.orderSensitiveModifiers,
      ]
    }

    // Apply collection overrides independently so unspecified groups remain intact
    overrideProps(
        config.theme,
        override.theme,
    )

    overrideProps(
        config.classGroups,
        override.classGroups,
    )

    overrideProps(
        config.conflictingClassGroups,
        override.conflictingClassGroups,
    )

    overrideProps(
        config.conflictingClassGroupModifiers,
        override.conflictingClassGroupModifiers,
    )
  }

  /**
   * Append extension values to one collection of ordered array groups
   *
   * Existing values retain their original order and extension values are added
   * after them so authored precedence remains predictable.
   *
   * **Parameters**
   * - `target` – Mutable destination collection containing existing groups
   * - `source` – Optional collection containing values to append
   *
   * **Returns**
   * - `void` – Mutates the destination collection without returning a value
   */
  const extendArrays = <Value>(
      target: Record<string, readonly Value[]>,
      source?: Record<string, readonly Value[]>,
  ): void => {
    // Leave the destination unchanged when no extension collection was supplied
    if (!source) {
      return
    }

    // Append extension values without changing the ordering of existing groups
    for (const key in source) {
      const values = source[key]

      if (values) {
        target[key] = (
            target[key] ?? []
        ).concat(values)
      }
    }
  }

  const extend = extension.extend

  if (extend) {
    // Append order-sensitive modifiers after the existing authored sequence
    if (extend.orderSensitiveModifiers) {
      config.orderSensitiveModifiers = [
        ...config.orderSensitiveModifiers,
        ...extend.orderSensitiveModifiers,
      ]
    }

    // Append theme definitions to their corresponding existing groups
    extendArrays(
        config.theme,
        extend.theme,
    )

    // Append class-group definitions while preserving existing declaration order
    extendArrays(
        config.classGroups,
        extend.classGroups,
    )

    // Append ordinary conflict targets for each extended source group
    extendArrays(
        config.conflictingClassGroups,
        extend.conflictingClassGroups,
    )

    // Append postfix-specific conflict targets for each extended source group
    extendArrays(
        config.conflictingClassGroupModifiers,
        extend.conflictingClassGroupModifiers,
    )
  }

  // Return the independently merged configuration for subsequent compilation
  return config
}
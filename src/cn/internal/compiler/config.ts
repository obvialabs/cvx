/**
 * Internal configuration model for the `cn` compiler.
 *
 * Configuration is intentionally isolated from the runtime engine so the
 * published hot path never carries authoring/extension machinery.
 *
 * @internal
 */

export type ClassGroupDefinition =
  | string
  | { $v: string }
  | { $t: string }
  | ((value: string) => boolean)
  | { [key: string]: readonly ClassGroupDefinition[] }

export interface CnConfig {
  theme: Record<string, ClassGroupDefinition[]>
  classGroups: Record<string, ClassGroupDefinition[]>
  conflictingClassGroups: Record<string, readonly string[]>
  conflictingClassGroupModifiers: Record<string, readonly string[]>
  orderSensitiveModifiers: string[]
  postfixLookupClassGroups?: readonly string[]
  prefix?: string
}

type CnConfigExtensionGroups = {
  theme: Record<string, readonly ClassGroupDefinition[]>
  classGroups: Record<string, readonly ClassGroupDefinition[]>
  conflictingClassGroups: Record<string, readonly string[]>
  conflictingClassGroupModifiers: Record<string, readonly string[]>
  orderSensitiveModifiers: readonly string[]
}

export interface CnConfigExtension {
  prefix?: string
  cacheSize?: number
  override?: Partial<CnConfigExtensionGroups>
  extend?: Partial<CnConfigExtensionGroups>
}

/** Internal configuration input accepted by the table compiler. */
export type CnConfigurationInput =
  CnConfigExtension | ((config: CnConfig) => CnConfig) | CnConfig


export const cloneConfig = (config: CnConfig): CnConfig => ({
  ...config,
  theme: { ...config.theme },
  classGroups: { ...config.classGroups },
  conflictingClassGroups: { ...config.conflictingClassGroups },
  conflictingClassGroupModifiers: { ...config.conflictingClassGroupModifiers },
  orderSensitiveModifiers: [...config.orderSensitiveModifiers],
  postfixLookupClassGroups: [...(config.postfixLookupClassGroups ?? [])],
})

export const mergeConfigs = (
  base: CnConfig,
  extension: CnConfigExtension
): CnConfig => {
  const config = cloneConfig(base)
  if (extension.prefix !== undefined) config.prefix = extension.prefix

  const overrideProps = <V>(
    target: Record<string, V>,
    src?: Record<string, V>
  ) => {
    if (!src) return
    for (const key in src) {
      if (src[key] !== undefined) target[key] = src[key]
    }
  }
  const ov = extension.override
  if (ov) {
    if (ov.orderSensitiveModifiers)
      config.orderSensitiveModifiers = [...ov.orderSensitiveModifiers]
    overrideProps(config.theme, ov.theme)
    overrideProps(config.classGroups, ov.classGroups)
    overrideProps(config.conflictingClassGroups, ov.conflictingClassGroups)
    overrideProps(
      config.conflictingClassGroupModifiers,
      ov.conflictingClassGroupModifiers
    )
  }

  const extendArrays = <V>(
    target: Record<string, readonly V[]>,
    src?: Record<string, readonly V[]>
  ) => {
    if (!src) return
    for (const key in src) {
      const add = src[key]
      if (add) target[key] = (target[key] ?? []).concat(add)
    }
  }
  const ex = extension.extend
  if (ex) {
    if (ex.orderSensitiveModifiers) {
      config.orderSensitiveModifiers = [
        ...config.orderSensitiveModifiers,
        ...ex.orderSensitiveModifiers,
      ]
    }
    extendArrays(config.theme, ex.theme)
    extendArrays(config.classGroups, ex.classGroups)
    extendArrays(config.conflictingClassGroups, ex.conflictingClassGroups)
    extendArrays(
      config.conflictingClassGroupModifiers,
      ex.conflictingClassGroupModifiers
    )
  }
  return config
}


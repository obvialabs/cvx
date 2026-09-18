import type { ClassValue } from "../cx/types.js"

/** Map of variant names to their allowed values and emitted classes. */
export type VariantShape<T extends ClassValue = ClassValue> = Record<
  string,
  Record<string, T>
>

/** Variant names prefixed with `_` stay callable but are omitted from `VariantProps`. */
export type InternalVariantKey = `_${string}`

/** Converts authored string booleans into ergonomic runtime booleans. */
type RuntimeVariantValue<Key> = Key extends "true" | "false" ? boolean : Key

type Defined<T> = Exclude<T, undefined>

type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never

type PreferRight<Left, Right> = {
  [Key in keyof Left | keyof Right]: Key extends keyof Right
    ? Right[Key]
    : Key extends keyof Left
      ? Left[Key]
      : never
}

/** Runtime variant selections inferred from an authored variant map. */
export type VariantSelection<Variants> = {
  [Name in keyof Variants]?: RuntimeVariantValue<keyof Variants[Name]> | undefined
}

/** Runtime class override accepted by every generated component. */
export type ClassProp<T extends ClassValue = ClassValue> =
  | { class?: T; className?: never }
  | { class?: never; className?: T }

type CompoundSelector<Variants> = {
  [Name in keyof Variants]?:
    | RuntimeVariantValue<keyof Variants[Name]>
    | readonly RuntimeVariantValue<keyof Variants[Name]>[]
    | undefined
}

/** One compound selector and the class value emitted when it matches. */
export type CompoundVariant<Variants, T extends ClassValue = ClassValue> =
  CompoundSelector<Variants> & ClassProp<T>

/** Callable result produced by `cv`. */
export interface CVComponent<Config, Variants, T extends ClassValue = ClassValue> {
  (
    props?: Variants extends VariantShape
      ? VariantSelection<Variants> & ClassProp<T>
      : ClassProp<T>,
  ): string
  readonly config: Config
}

/** Structural component contract used by the internal composition runtime. */
export type CVComponentShape = CVComponent<any, any, any>

type CompositionTuple<
  Single extends CVComponentShape | undefined,
  List extends readonly CVComponentShape[],
> = [Single] extends [CVComponentShape] ? [Single] : List

type ComponentVariants<Component> = Component extends {
  config: { variants?: infer Variants extends VariantShape }
}
  ? Variants
  : never

type CompositionVariants<Components extends readonly unknown[]> =
  UnionToIntersection<ComponentVariants<Components[number]>>

type ComponentDefaults<Component> = Component extends {
  config: { defaultVariants?: infer Defaults }
}
  ? Defaults extends undefined
    ? {}
    : Defaults
  : {}

type CompositionDefaults<Components extends readonly unknown[]> =
  Components extends readonly [infer Head, ...infer Tail]
    ? PreferRight<ComponentDefaults<Head>, CompositionDefaults<Tail>>
    : {}

type EffectiveVariants<
  LocalVariants,
  Single extends CVComponentShape | undefined,
  List extends readonly CVComponentShape[],
> = [Single] extends [undefined]
  ? [List] extends [readonly []]
    ? LocalVariants
    : LocalVariants & CompositionVariants<List>
  : LocalVariants & CompositionVariants<CompositionTuple<Single, List>>

type LocalDefaults<Config> = Config extends { defaultVariants?: infer Defaults }
  ? Defaults
  : {}

/** Authoring shape accepted by the variant factory. */
export type CVConfig<
  Config,
  Variants,
  Single extends CVComponentShape | undefined = undefined,
  List extends readonly CVComponentShape[] = [],
  T extends ClassValue = ClassValue,
  CombinedVariants = EffectiveVariants<Variants, Single, List>,
> = Config & {
  base?: T
  variants?: Variants extends Record<string, Record<string, T>>
    ? Variants & { __proto__?: never }
    : never
  composes?: Single | readonly [...List]
} & ([keyof CombinedVariants] extends [never]
    ? { defaultVariants?: never; compoundVariants?: never }
    : {
        defaultVariants?: VariantSelection<CombinedVariants>
        compoundVariants?: readonly CompoundVariant<CombinedVariants, T>[]
      })

/** Internal callable factory contract implemented by `createCvRuntime`. */
export interface CV<T extends ClassValue = ClassValue> {
  <
    Config,
    Variants,
    Single extends CVComponentShape | undefined = undefined,
    List extends readonly CVComponentShape[] = [],
  >(
    config: CVConfig<Config, Variants, Single, List, T>,
  ): CVComponent<
    Omit<Config, "defaultVariants"> & {
      variants: EffectiveVariants<Variants, Single, List>
      defaultVariants: Omit<
        CompositionDefaults<CompositionTuple<Single, List>>,
        keyof LocalDefaults<Config>
      > &
        LocalDefaults<Config>
    },
    EffectiveVariants<Variants, Single, List>,
    T
  >
}

/**
 * Extracts the public variant selections from a component created by `cv`.
 * Runtime class overrides and underscore-prefixed internal variants are removed.
 */
export type VariantProps<Component extends (...args: any) => any> = Omit<
  Defined<Parameters<Component>[0]>,
  "class" | "className" | InternalVariantKey
>

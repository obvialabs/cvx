import type {
    ClassComposerResult,
    ClassInput,
    ClassResolver,
    ClassValue,
} from "../cx/types"

/**
 * Map variant names to the values they accept and the classes those values emit
 *
 * **Templates**
 * - `T` – Class value type emitted by authored variant values
 */
export type VariantShape<T extends ClassValue = ClassValue> = Record<
    string,
    Record<string, T>
>

/**
 * Variant key reserved for internal selections
 */
export type InternalVariantKey = `_${string}`

/**
 * Convert authored string booleans into ergonomic runtime boolean values
 *
 * **Templates**
 * - `Key` – Authored variant key to convert to its runtime representation
 */
type RuntimeVariantValue<Key> = Key extends "true" | "false"
    ? boolean
    : Key

/**
 * Remove `undefined` from an inferred type
 *
 * **Templates**
 * - `T` – Type whose `undefined` member should be removed
 */
type Defined<T> = Exclude<T, undefined>

/**
 * Convert a union into an intersection
 *
 * **Templates**
 * - `Union` – Union whose members should be combined into an intersection
 */
type UnionToIntersection<Union> = (
    Union extends unknown
        ? (value: Union) => void
        : never
    ) extends (value: infer Intersection) => void
    ? Intersection
    : never

/**
 * Merge two object shapes while preferring values from the right-hand shape
 *
 * **Templates**
 * - `Left` – Base object shape
 * - `Right` – Object shape whose overlapping values should take precedence
 */
type PreferRight<Left, Right> = {
    [Key in keyof Left | keyof Right]: Key extends keyof Right
        ? Right[Key]
        : Key extends keyof Left
            ? Left[Key]
            : never
}

/**
 * Runtime variant selections inferred from an authored variant map
 *
 * **Templates**
 * - `Variants` – Authored variant map used to infer accepted runtime values
 */
export type VariantSelection<Variants> = {
    [Name in keyof Variants]?:
    | RuntimeVariantValue<keyof Variants[Name]>
    | undefined
}

/**
 * Static class property shape used by authored CV rules
 *
 * **Templates**
 * - `T` – Static class value type accepted by the authored rule
 */
export type ClassProp<T extends ClassValue = ClassValue> =
    | {
    class?: T
    className?: never
}
    | {
    class?: never
    className?: T
}

/**
 * Runtime class override accepted by a resolver created with `cv`
 *
 * Unlike authored base, variant, and compound values, runtime overrides may
 * be state-aware callbacks so headless component libraries can pass their
 * native `className(state)` contract through `cv` without adaptation.
 *
 * **Templates**
 * - `Input` – Static class value or state-aware class resolver
 */
export type RuntimeClassProp<
    Input extends ClassInput<any> = ClassValue,
> =
    | {
    class?: Input
    className?: never
}
    | {
    class?: never
    className?: Input
}

/**
 * Variant selector accepted by a compound rule
 *
 * **Templates**
 * - `Variants` – Variant map used to infer valid compound selector values
 */
type CompoundSelector<Variants> = {
    [Name in keyof Variants]?:
    | RuntimeVariantValue<keyof Variants[Name]>
    | readonly RuntimeVariantValue<keyof Variants[Name]>[]
    | undefined
}

/**
 * Define one compound rule emitted when all authored selectors match
 *
 * **Templates**
 * - `Variants` – Variant map used to infer valid selector values
 * - `T` – Class value type emitted by the compound
 */
export type CompoundVariant<
    Variants,
    T extends ClassValue = ClassValue,
> = CompoundSelector<Variants> & ClassProp<T>

/**
 * Callable resolver produced by `cv`
 *
 * **Templates**
 * - `Config` – Prepared configuration metadata retained by the resolver
 * - `Variants` – Effective variant map accepted by the resolver
 * - `T` – Static class value type accepted by authored base, variant, and compound definitions
 *
 * **Parameters**
 * - `props` – Variant selections and an optional runtime `class` or `className` override
 *
 * **Returns**
 * - `string | ClassResolver` – Immediate class string for static overrides, or a state-aware resolver when a runtime override requires state
 */
export interface CVComponent<
    Config,
    Variants,
    T extends ClassValue = ClassValue,
> {
    <const Input extends ClassInput<any> = T>(
        props?: Variants extends VariantShape
            ? VariantSelection<Variants> & RuntimeClassProp<Input>
            : RuntimeClassProp<Input>,
    ): ClassComposerResult<[Input]>

    /**
     * Prepared configuration metadata retained for composition and type inference
     *
     * The metadata exposes effective variants and defaults to composed CV
     * components without requiring the original authored configuration.
     */
    readonly config: Config
}

/**
 * Structural resolver contract used by the internal composition runtime
 */
export interface CVComponentShape {
    (props?: any): string | ClassResolver<any>
    readonly config: any
}

/**
 * Normalize single and tuple composition forms into one tuple representation
 *
 * **Templates**
 * - `Single` – Optional single composed component
 * - `List` – Optional tuple of composed components
 */
type CompositionTuple<
    Single extends CVComponentShape | undefined,
    List extends readonly CVComponentShape[],
> = [Single] extends [CVComponentShape]
    ? [Single]
    : List

/**
 * Extract variant metadata from a composed resolver
 *
 * **Templates**
 * - `Component` – Resolver whose prepared variant metadata should be inferred
 */
type ComponentVariants<Component> = Component extends {
        config: {
            variants?: infer Variants extends VariantShape
        }
    }
    ? Variants
    : never

/**
 * Merge the variant maps exposed by every composed resolver
 *
 * **Templates**
 * - `Components` – Tuple or readonly collection of composed resolvers
 */
type CompositionVariants<Components extends readonly unknown[]> =
    UnionToIntersection<ComponentVariants<Components[number]>>

/**
 * Extract default selections from a composed resolver
 *
 * **Templates**
 * - `Component` – Resolver whose prepared defaults should be inferred
 */
type ComponentDefaults<Component> = Component extends {
        config: {
            defaults?: infer Defaults
        }
    }
    ? Defaults extends undefined
        ? {}
        : Defaults
    : {}

/**
 * Merge inherited defaults from left to right
 *
 * **Templates**
 * - `Components` – Ordered tuple of composed resolvers
 */
type CompositionDefaults<Components extends readonly unknown[]> =
    Components extends readonly [infer Head, ...infer Tail]
        ? PreferRight<
            ComponentDefaults<Head>,
            CompositionDefaults<Tail>
        >
        : {}

/**
 * Resolve the final variant map exposed by local and composed definitions
 *
 * **Templates**
 * - `LocalVariants` – Variants declared by the current configuration
 * - `Single` – Optional single composed resolver
 * - `List` – Optional tuple of composed resolvers
 */
type EffectiveVariants<
    LocalVariants,
    Single extends CVComponentShape | undefined,
    List extends readonly CVComponentShape[],
> = [Single] extends [undefined]
    ? [List] extends [readonly []]
        ? LocalVariants
        : LocalVariants & CompositionVariants<List>
    : LocalVariants &
    CompositionVariants<
        CompositionTuple<Single, List>
    >

/**
 * Extract locally authored defaults from a configuration shape
 *
 * **Templates**
 * - `Config` – Authored configuration whose default selections should be inferred
 */
type LocalDefaults<Config> = Config extends {
        defaults?: infer Defaults
    }
    ? Defaults
    : {}

/**
 * Authorable fields accepted by a `cv` configuration
 *
 * **Templates**
 * - `Variants` – Locally authored variant map
 * - `Single` – Optional single composed resolver
 * - `List` – Optional tuple of composed resolvers
 * - `T` – Class value type accepted by the configuration
 * - `CombinedVariants` – Effective variant map after composition
 */
type CVConfigFields<
    Variants,
    Single extends CVComponentShape | undefined,
    List extends readonly CVComponentShape[],
    T extends ClassValue,
    CombinedVariants = EffectiveVariants<
        Variants,
        Single,
        List
    >,
> = {
    /**
     * Base classes emitted for every resolver call
     */
    base?: T

    /**
     * Variant axes and the classes emitted by each variant value
     */
    variants?: Variants extends Record<
            string,
            Record<string, T>
        >
        ? Variants & {
        __proto__?: never
    }
        : never

    /**
     * Resolver or resolver tuple whose variants and defaults are composed
     */
    composes?: Single | readonly [...List]
} & ([keyof CombinedVariants] extends [never]
    ? {
        /**
         * Defaults are unavailable when the effective configuration has no variants
         */
        defaults?: never

        /**
         * Compounds are unavailable when the effective configuration has no variants
         */
        compounds?: never
    }
    : {
        /**
         * Default selections used when a runtime variant prop is omitted
         */
        defaults?: VariantSelection<CombinedVariants>

        /**
         * Conditional class rules evaluated against the resolved variant state
         */
        compounds?: readonly CompoundVariant<
            CombinedVariants,
            T
        >[]
    })

/**
 * Authoring shape accepted by the `cv` factory
 *
 * **Templates**
 * - `Config` – Inferred authored configuration shape
 * - `Variants` – Locally authored variant map
 * - `Single` – Optional single composed resolver
 * - `List` – Optional tuple of composed resolvers
 * - `T` – Class value type accepted by the configuration
 * - `Fields` – Valid configuration fields derived from the inferred variants
 */
export type CVConfig<
    Config,
    Variants,
    Single extends CVComponentShape | undefined = undefined,
    List extends readonly CVComponentShape[] = [],
    T extends ClassValue = ClassValue,
    Fields = CVConfigFields<
        Variants,
        Single,
        List,
        T
    >,
> = Config &
    Fields & {
    [Key in Exclude<
        keyof Config,
        keyof Fields
    >]?: never
}

/**
 * Callable factory contract implemented by the internal CV runtime
 *
 * **Templates**
 * - `T` – Static class value type accepted by authored definitions
 *
 * **Parameters**
 * - `config` – Authored CV configuration containing base classes, variants, defaults, compounds, and optional composition
 *
 * **Returns**
 * - `CVComponent` – Typed callable resolver with effective variant and default metadata
 */
export interface CV<T extends ClassValue = ClassValue> {
    <
        Config,
        Variants,
        Single extends CVComponentShape | undefined = undefined,
        List extends readonly CVComponentShape[] = [],
    >(
        config: CVConfig<
            Config,
            Variants,
            Single,
            List,
            T
        >,
    ): CVComponent<
        Omit<Config, "defaults"> & {
        variants: EffectiveVariants<
            Variants,
            Single,
            List
        >
        defaults: Omit<
            CompositionDefaults<
                CompositionTuple<Single, List>
            >,
            keyof LocalDefaults<Config>
        > &
            LocalDefaults<Config>
    },
        EffectiveVariants<
            Variants,
            Single,
            List
        >,
        T
    >
}

/**
 * Extract public variant props from a resolver created with `cv`
 *
 * **Templates**
 * - `Component` – Resolver type returned by `cv`
 *
 * **Returns**
 * - `object` – Public variant-prop shape accepted by the resolver
 *
 * **Usage**
 * ```ts
 * const button = cv({
 *   variants: {
 *     intent: {
 *       primary: "bg-blue-600",
 *       secondary: "bg-white"
 *     },
 *     size: {
 *       sm: "h-8 px-3",
 *       md: "h-10 px-4"
 *     }
 *   },
 *   defaults: {
 *     intent: "primary"
 *   }
 * })
 *
 * type ButtonVariants = VariantProps<typeof button>
 * ```
 */
export type VariantProps<
    Component extends (...args: any) => any,
> = Omit<
    Defined<Parameters<Component>[0]>,
    "class" | "className" | InternalVariantKey
>
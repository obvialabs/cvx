/**
 * Static class value accepted by `cx`, `cn`, and generated `cv` components.
 */
export type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | ClassDictionary
  | readonly ClassValue[]

/**
 * Conditional class dictionary.
 */
export type ClassDictionary = Readonly<Record<string, unknown>>

/**
 * Nested list of static class values.
 */
export type ClassArray = readonly ClassValue[]

/**
 * State-aware class resolver accepted by `cx` and `cn`.
 *
 * Resolver inputs are evaluated only when the composed resolver is called,
 * which keeps integrations such as Base UI's `className(state)` contract
 * compatible without turning functions into ordinary class values.
 */
export type ClassResolver<State> = (state: State) => ClassValue

/**
 * Class input accepted by state-aware `cx` and `cn` composition.
 */
export type ClassInput<State = unknown> = ClassValue | ClassResolver<State>

/**
 * Extract the state accepted by one resolver input.
 *
 * @internal
 */
type ResolverState<T> = T extends ClassResolver<infer State> ? State : never

/**
 * Select only resolver members from one class-input union.
 *
 * @internal
 */
type ResolverMember<T> = Extract<T, ClassResolver<any>>

/**
 * Convert a union of resolver state requirements into one compatible state.
 *
 * When several resolvers are composed they receive the same state object, so
 * that state must satisfy every resolver rather than only one of them.
 *
 * @internal
 */
type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never

/**
 * Resolve the shared state required by all resolver inputs.
 *
 * @internal
 */
type ResolverInputState<Inputs extends readonly unknown[]> =
  UnionToIntersection<ResolverState<ResolverMember<Inputs[number]>>>

/**
 * Determine whether an input tuple contains a resolver on every possible path.
 *
 * A union such as `string | ((state) => string)` is intentionally not treated
 * as a guaranteed resolver because the runtime value can still be static.
 *
 * @internal
 */
type HasRequiredResolver<Inputs extends readonly unknown[]> =
  Inputs extends readonly [infer Head, ...infer Tail]
    ? [Head] extends [ClassResolver<any>]
      ? true
      : HasRequiredResolver<Tail>
    : false

/**
 * Return type produced by a class composer for one input tuple.
 *
 * Static inputs resolve immediately to a string. Definite resolver inputs
 * produce a state callback, while union inputs preserve both runtime outcomes.
 *
 * @internal
 */
export type ClassComposerResult<Inputs extends readonly unknown[]> =
  [ResolverMember<Inputs[number]>] extends [never]
    ? string
    : HasRequiredResolver<Inputs> extends true
      ? (state: ResolverInputState<Inputs>) => string
      : string | ((state: ResolverInputState<Inputs>) => string)

/**
 * Callable class composer shared by `cx` and `cn`.
 */
export interface ClassComposer {
  <const Inputs extends readonly ClassInput<any>[]>(
    ...inputs: Inputs
  ): ClassComposerResult<Inputs>
}

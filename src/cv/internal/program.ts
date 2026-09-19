import { appendClassValue, cx } from "../../cx/compose"
import type { ClassInput, ClassResolver, ClassValue } from "../../cx/types"
import type { CVComponentShape, VariantShape } from "../types"
import { matchesCompoundSelector, prepareCompounds } from "./compounds"
import { buildDenseTable, resolveDenseIndex } from "./dense"
import type { VariantProgram, VariantRuntime } from "./model"
import {
  copyVariantMap,
  mergeVariantMetadata,
  resolveVariantClass,
} from "./variants"

/**
 * Shared immutable empty component collection
 */
const EMPTY_COMPONENTS: readonly CVComponentShape[] = Object.freeze([])

/**
 * Prepared programs associated with generated CV component resolvers
 */
const programs = new WeakMap<Function, VariantProgram>()

/**
 * Programs that completed one general render before dense compilation
 *
 * Keeping this state outside `VariantProgram.dense` preserves the monomorphic
 * dense-table hot path while still allowing one-shot components to skip compile work.
 */
const deferredDensePrograms = new WeakSet<VariantProgram>()

/**
 * Prepare dense lookup only after a program is observed for the second time
 *
 * The first call records reuse intent and returns `null` only for that render.
 * Keeping this cold decision outside the renderer preserves its steady-state
 * branch structure once a dense table has been compiled.
 *
 * **Parameters**
 * - `program` – Prepared variant program considered for dense promotion
 *
 * **Returns**
 * - `DenseTable | null` – Compiled table on reuse, otherwise `null` for the current render
 */
function prepareDenseOnReuse(
    program: VariantProgram,
): ReturnType<typeof buildDenseTable> | null {
  // Record the first render without compiling a table for a one-shot component
  if (!deferredDensePrograms.has(program)) {
    deferredDensePrograms.add(program)
    return null
  }

  // Promote exactly once when the same prepared program is rendered again
  deferredDensePrograms.delete(program)

  const dense = buildDenseTable(program) ?? null
  program.dense = dense

  return dense
}

/**
 * Associate a generated resolver with its prepared executable program
 *
 * **Parameters**
 * - `component` – Resolver returned by the CV runtime
 * - `program` – Prepared executable program backing the resolver
 *
 * **Returns**
 * - `void` – Stores the program association internally without returning a value
 */
export function registerProgram(
    component: Function,
    program: VariantProgram,
): void {
  // Store the prepared program without exposing runtime metadata on the resolver
  programs.set(component, program)
}

/**
 * Join prepared class values without allocating an intermediate flattening tree
 *
 * **Parameters**
 * - `values` – Prepared class values to append in declaration order
 *
 * **Returns**
 * - `string` – Normalized class string containing every supported class value
 */
function joinPrepared(values: readonly ClassValue[]): string {
  let output = ""

  // Append each class value directly to the accumulated output
  for (let index = 0; index < values.length; index++) {
    output = appendClassValue(output, values[index])
  }

  return output
}

/**
 * Render one variant state through the general execution path
 *
 * **Parameters**
 * - `program` – Prepared variant program to execute
 * - `props` – Runtime variant selections and class overrides
 * - `defaults` – Effective defaults inherited by the current program
 *
 * **Returns**
 * - `string` – Normalized class string produced for the current variant state
 */
function renderUncached(
    program: VariantProgram,
    props: Record<string, unknown>,
    defaults: Readonly<Record<string, unknown>>,
): string {
  // Append directly into the final string so uncached renders avoid allocating
  // an intermediate class-value collection before normalization.
  let output = ""

  // Render composed CV programs using the same runtime props and inherited defaults
  for (let index = 0; index < program.children.length; index++) {
    const rendered = program.children[index].render(props, defaults, false) as string

    // Append child output only when the child produced classes
    if (rendered) {
      output = appendClassValue(output, rendered)
    }
  }

  // Forward compatible variant props to composed foreign components
  if (program.foreignChildren.length) {
    const forwarded: Record<string, unknown> = { ...defaults }

    // Preserve explicit runtime values while excluding class overrides
    for (const key of Object.keys(props)) {
      if (
          key !== "class" &&
          key !== "className" &&
          props[key] !== undefined
      ) {
        forwarded[key] = props[key]
      }
    }

    // Execute each foreign component using an isolated props object
    for (let index = 0; index < program.foreignChildren.length; index++) {
      const rendered = program.foreignChildren[index]({ ...forwarded }) as unknown as string

      // Append foreign output only when the component produced classes
      if (rendered) {
        output = appendClassValue(output, rendered)
      }
    }
  }

  // Append the local base class before resolving local variants
  if (program.base !== undefined) {
    output = appendClassValue(output, program.base)
  }

  // Resolve every locally declared variant against runtime props and defaults
  for (let index = 0; index < program.localVariantKeys.length; index++) {
    const key = program.localVariantKeys[index]
    const value = resolveVariantClass(
        program.localVariantMaps[index],
        props[key],
        defaults[key],
    )

    // Append only variants that resolve to a defined class value
    if (value !== undefined) {
      output = appendClassValue(output, value)
    }
  }

  // Evaluate prepared compound rules only when the program declares compounds
  if (program.compounds.length) {
    const resolved = new Array<unknown>(program.readKeys.length)

    // Resolve every key used by compound selectors once for this render
    for (let index = 0; index < program.readKeys.length; index++) {
      const key = program.readKeys[index]

      resolved[index] =
          props[key] === undefined
              ? defaults[key]
              : props[key]
    }

    // Evaluate each compound until one of its selectors fails
    compound: for (
        let index = 0;
        index < program.compounds.length;
        index++
    ) {
      const candidate = program.compounds[index]

      // Reject the candidate immediately when any selector does not match
      for (
          let selectorIndex = 0;
          selectorIndex < candidate.indexes.length;
          selectorIndex++
      ) {
        if (
            !matchesCompoundSelector(
                candidate.selectors[selectorIndex],
                resolved[candidate.indexes[selectorIndex]],
            )
        ) {
          continue compound
        }
      }

      // Preserve the authored `class` compound value when present
      if (candidate.classValue !== undefined) {
        output = appendClassValue(output, candidate.classValue)
      }

      // Preserve the authored `className` compound value when present
      if (candidate.classNameValue !== undefined) {
        output = appendClassValue(output, candidate.classNameValue)
      }
    }
  }

  // Return the incrementally normalized class string
  return output
}

/**
 * Convert authored configuration into the executable program reused by every call
 *
 * **Parameters**
 * - `runtime` – Shared CV runtime configuration
 * - `config` – Authored variant configuration
 *
 * **Returns**
 * - `VariantProgram` – Prepared executable program reused by the generated resolver
 */
export function createProgram(
    runtime: VariantRuntime,
    config: Record<string, any>,
): VariantProgram {
  // Normalize the authored composition value into a component collection
  const composes = config.composes
  const childComponents: readonly CVComponentShape[] =
      composes == null
          ? EMPTY_COMPONENTS
          : Array.isArray(composes)
              ? composes.slice()
              : [composes]

  const children: VariantProgram[] = []
  const foreignChildren: CVComponentShape[] = []

  // Separate native CV programs from compatible foreign components
  for (let index = 0; index < childComponents.length; index++) {
    const child = childComponents[index]
    const program = programs.get(child)

    if (program) {
      children.push(program)
    } else {
      foreignChildren.push(child)
    }
  }

  // Merge inherited variant metadata before preparing the local configuration
  const merged = mergeVariantMetadata(childComponents, config)

  // Read locally authored variants from the configuration
  const localVariants = config.variants as VariantShape | undefined

  // Preserve local variant declaration order for predictable class resolution
  const localVariantKeys = localVariants ? Object.keys(localVariants) : []

  // Copy authored maps so prepared runtime data is isolated from user configuration
  const localVariantMaps = localVariantKeys.map((key) =>
      copyVariantMap(localVariants![key]),
  )

  // Start compound read dependencies with locally declared variant keys
  const readKeys = localVariantKeys.slice()

  // Precompile authored compound selectors against their read-key indexes
  const compounds = prepareCompounds(config.compounds, readKeys)

  // Include every variant key required by composed child programs
  for (let index = 0; index < children.length; index++) {
    for (const key of children[index].readKeys) {
      // Add inherited read keys only once
      if (!readKeys.includes(key)) {
        readKeys.push(key)
      }
    }
  }

  // Create the reusable executable program shared by every resolver call
  const program: VariantProgram = {
    runtime,
    children,
    foreignChildren,
    base: config.base as ClassValue,
    localVariantKeys,
    localVariantMaps,
    readKeys,
    compounds,
    defaults: Object.freeze(merged.defaults),
    mergedVariants: merged.variants,
    render: undefined as never,
  }

  // Precompute completely static programs that have no runtime-dependent state
  if (
      !readKeys.length &&
      !foreignChildren.length &&
      !children.length
  ) {
    program.staticOutput = joinPrepared([program.base])
    program.dense = null
  }

  /**
   * Render the prepared program for one runtime props object
   *
   * The renderer prefers static or dense cached output when possible and falls
   * back to the general execution path only when the current state cannot be
   * represented by prepared lookup data.
   *
   * **Parameters**
   * - `props` – Runtime variant selections and class overrides
   * - `inheritedDefaults` – Effective defaults inherited from the parent program
   * - `includeClassProps` – Include runtime `class` and `className` overrides
   *
   * **Returns**
   * - `string` – Normalized class string for the resolved variant state
   */
  program.render = (
      props: Record<string, unknown>,
      inheritedDefaults = program.defaults,
      includeClassProps = true,
  ): string | ClassResolver<any> => {
    let core: string

    // Reuse static output when the program has no runtime-dependent state
    if (program.staticOutput !== undefined) {
      core = program.staticOutput
    } else {
      let dense = program.dense

      // Defer dense compilation until the component proves it will be reused
      if (dense === undefined) {
        dense = prepareDenseOnReuse(program)
      }

      if (dense) {
        // Resolve the current runtime state to its dense lookup index
        const index = resolveDenseIndex(
            dense,
            props,
            inheritedDefaults,
        )

        if (index >= 0) {
          // Read previously rendered output for this exact dense combination
          const cached = dense.outputs[index]

          if (cached !== undefined) {
            // Reuse the prepared output without running variant resolution again
            core = cached
          } else {
            // Render the combination once because it is not cached yet
            core = renderUncached(
                program,
                props,
                inheritedDefaults,
            )

            // Cache the rendered result for subsequent calls using the same state
            dense.outputs[index] = core
          }
        } else {
          // Fall back when runtime values cannot be represented by the dense table
          core = renderUncached(
              program,
              props,
              inheritedDefaults,
          )
        }
      } else {
        // Execute the general path before promotion or when dense compilation
        // is unavailable for the current program.
        core = renderUncached(
            program,
            props,
            inheritedDefaults,
        )
      }
    }

    // Return only program-generated classes for nested composition renders
    if (!includeClassProps) {
      return core
    }

    // Read supported runtime class overrides from the component props
    const classValue = props.class as ClassInput<any>
    const classNameValue = props.className as ClassInput<any>

    // Return the prepared output directly when no runtime override was provided
    if (
        classValue === undefined &&
        classNameValue === undefined
    ) {
      return core
    }

    // Merge runtime class overrides with the prepared program output
    return cx(core, classValue, classNameValue)
  }

  // Return the fully prepared program for registration and repeated execution
  return program
}
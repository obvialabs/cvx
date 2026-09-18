import { appendClassValue, cx } from "../../cx/compose"
import type { ClassValue } from "../../cx/types"
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
  // Collect prepared class values before joining them into the final output
  const output: ClassValue[] = []

  // Render composed CV programs using the same runtime props and inherited defaults
  for (let index = 0; index < program.children.length; index++) {
    const rendered = program.children[index].render(props, defaults, false)

    // Append child output only when the child produced classes
    if (rendered) {
      output.push(rendered)
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
      const rendered = program.foreignChildren[index]({ ...forwarded })

      // Append foreign output only when the component produced classes
      if (rendered) {
        output.push(rendered)
      }
    }
  }

  // Append the local base class before resolving local variants
  if (program.base !== undefined) {
    output.push(program.base)
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
      output.push(value)
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
        output.push(candidate.classValue)
      }

      // Preserve the authored `className` compound value when present
      if (candidate.classNameValue !== undefined) {
        output.push(candidate.classNameValue)
      }
    }
  }

  // Normalize all prepared values into the final class string
  return joinPrepared(output)
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
    defaults: Object.freeze({ ...merged.defaults }),
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
  ): string => {
    let core: string

    // Reuse static output when the program has no runtime-dependent state
    if (program.staticOutput !== undefined) {
      core = program.staticOutput
    } else {
      let dense = program.dense

      // Build the dense lookup table lazily on the first eligible render
      if (dense === undefined) {
        dense = buildDenseTable(program) ?? null
        program.dense = dense
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
        // Execute the general path when dense compilation is unavailable
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
    const classValue = props.class as ClassValue
    const classNameValue = props.className as ClassValue

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
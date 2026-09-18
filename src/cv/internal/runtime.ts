import { cx } from "../../cx"
import type { ClassValue } from "../../cx/types"
import type { CV, CVComponentShape, CVConfig } from "../types"
import type { VariantRuntime } from "./model"
import { createProgram, registerProgram } from "./program"

/**
 * Shared immutable empty configuration object
 *
 * Used when no authored configuration is provided so the runtime can reuse one
 * allocation-free object instead of creating a new empty definition.
 */
const EMPTY_OBJECT: Readonly<Record<string, never>> = Object.freeze({})

/**
 * Default maximum number of variant combinations eligible for dense compilation
 */
const DEFAULT_COMPILE_LIMIT = 512

/**
 * Internal runtime options used when creating an isolated CV engine
 */
export interface CreateCvRuntimeOptions {
  /**
   * Maximum number of bounded variant combinations eligible for dense lookup
   *
   * Set to `0` to disable dense compilation and force the general execution path.
   *
   * @default 512
   */
  compileLimit?: number
}

/**
 * Create an isolated **cv** runtime
 *
 * **Parameters**
 * - `options` – Internal runtime configuration
 *    - `compileLimit` – Maximum dense variant-space size before falling back to the general execution path
 *
 * **Returns**
 * - `CV` – A `cv`-compatible factory backed by an isolated runtime configuration
 */
export function createCvRuntime(
    options: CreateCvRuntimeOptions = {},
): CV {
  // Normalize runtime tuning once so generated resolvers never repeat option handling
  const runtime: VariantRuntime = {
    compileLimit:
        options.compileLimit === undefined
            ? DEFAULT_COMPILE_LIMIT
            : Math.max(0, options.compileLimit | 0),
  }

  // Return a typed CV factory bound to the isolated runtime configuration
  return (<
      Config,
      Variants,
      Single extends CVComponentShape | undefined = undefined,
      List extends readonly CVComponentShape[] = [],
  >(
      authored: CVConfig<Config, Variants, Single, List>,
  ) => {
    // Normalize an omitted configuration to the shared immutable empty object
    const definition = (authored || EMPTY_OBJECT) as Record<string, any>

    // Convert the authored definition into the executable program reused by every call
    const program = createProgram(runtime, definition)

    // Create the most direct resolver supported by the prepared program
    const component = (
        program.staticOutput !== undefined
            ? (input?: Record<string, unknown> | null) => {
              // Return static output immediately when no runtime props were provided
              if (
                  !input ||
                  typeof input !== "object"
              ) {
                return program.staticOutput!
              }

              // Read supported runtime class overrides from the input object
              const classValue = input.class as ClassValue
              const classNameValue = input.className as ClassValue

              // Return static output directly when no class override was provided
              if (
                  classValue === undefined &&
                  classNameValue === undefined
              ) {
                return program.staticOutput!
              }

              // Merge runtime class overrides with the prepared static output
              return cx(
                  program.staticOutput!,
                  classValue,
                  classNameValue,
              )
            }
            : (input?: Record<string, unknown> | null) => {
              // Normalize invalid or omitted runtime input to the shared empty object
              const props =
                  input &&
                  typeof input === "object"
                      ? input
                      : EMPTY_OBJECT

              // Render the prepared program against the normalized runtime props
              return program.render(props)
            }
    ) as CVComponentShape

    // Preserve prepared metadata for composition and compile-time inference
    Object.defineProperty(component, "config", {
      enumerable: true,
      configurable: false,
      writable: false,
      value: Object.freeze({
        ...definition,
        variants: Object.freeze({ ...program.mergedVariants }),
        defaults: program.defaults,
      }),
    })

    // Associate the resolver with its prepared program so CVX compositions avoid wrapper calls
    registerProgram(component, program)

    // Return the fully prepared callable component resolver
    return component
  }) as CV
}
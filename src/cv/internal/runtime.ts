/**
 * Factory boundary for executable `cv` components.
 *
 * @internal
 */

import { cx } from "../../cx/compose"
import type { ClassValue } from "../../cx/types"
import type { CV, CVComponentShape, CVConfig } from "../types"
import type { VariantRuntime } from "./model"
import { createProgram, registerProgram } from "./program"

const EMPTY_OBJECT: Readonly<Record<string, never>> = Object.freeze({})
const DEFAULT_COMPILE_LIMIT = 512

/** Private runtime options used by tests and internal tuning only. */
export interface CreateCvRuntimeOptions {
  compileLimit?: number
}

/**
 * Creates an isolated CV engine. This is intentionally internal: applications
 * use the singleton `cv` export while tests can compare compiled/general paths.
 */
export function createCvRuntime(options: CreateCvRuntimeOptions = {}): CV {
  const runtime: VariantRuntime = {
    compileLimit:
      options.compileLimit === undefined
        ? DEFAULT_COMPILE_LIMIT
        : Math.max(0, options.compileLimit | 0),
  }

  return (<
    Config,
    Variants,
    Single extends CVComponentShape | undefined = undefined,
    List extends readonly CVComponentShape[] = [],
  >(
    authored: CVConfig<Config, Variants, Single, List>,
  ) => {
    const definition = (authored || EMPTY_OBJECT) as Record<string, any>
    const program = createProgram(runtime, definition)

    const component = (
      program.staticOutput !== undefined
        ? (input?: Record<string, unknown> | null) => {
            if (!input || typeof input !== "object") return program.staticOutput!

            const classValue = input.class as ClassValue
            const classNameValue = input.className as ClassValue
            return classValue === undefined && classNameValue === undefined
              ? program.staticOutput!
              : cx(program.staticOutput!, classValue, classNameValue)
          }
        : (input?: Record<string, unknown> | null) =>
            program.render(input && typeof input === "object" ? input : EMPTY_OBJECT)
    ) as CVComponentShape

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

    registerProgram(component, program)
    return component
  }) as CV
}

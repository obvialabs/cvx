/**
 * Program preparation and rendering for compiled variant components.
 *
 * This module coordinates already-specialized helpers; parsing and type-level
 * authoring concerns live elsewhere in the `cv` domain.
 *
 * @internal
 */

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

const EMPTY_COMPONENTS: readonly CVComponentShape[] = Object.freeze([])
const programs = new WeakMap<Function, VariantProgram>()

/** Registers a component with its executable program for zero-wrapper composition. */
export function registerProgram(component: Function, program: VariantProgram): void {
  programs.set(component, program)
}

/** Joins already-prepared class values without allocating an intermediate flatten tree. */
function joinPrepared(values: readonly ClassValue[]): string {
  let output = ""
  for (let index = 0; index < values.length; index++) {
    output = appendClassValue(output, values[index])
  }
  return output
}

/** Executes the general path when a dense result is unavailable. */
function renderUncached(
  program: VariantProgram,
  props: Record<string, unknown>,
  defaults: Readonly<Record<string, unknown>>,
): string {
  const output: ClassValue[] = []

  for (let index = 0; index < program.children.length; index++) {
    const rendered = program.children[index].render(props, defaults, false)
    if (rendered) output.push(rendered)
  }

  if (program.foreignChildren.length) {
    const forwarded: Record<string, unknown> = { ...defaults }
    for (const key of Object.keys(props)) {
      if (key !== "class" && key !== "className" && props[key] !== undefined) {
        forwarded[key] = props[key]
      }
    }

    for (let index = 0; index < program.foreignChildren.length; index++) {
      const rendered = program.foreignChildren[index]({ ...forwarded })
      if (rendered) output.push(rendered)
    }
  }

  if (program.base !== undefined) output.push(program.base)

  for (let index = 0; index < program.localVariantKeys.length; index++) {
    const key = program.localVariantKeys[index]
    const value = resolveVariantClass(
      program.localVariantMaps[index],
      props[key],
      defaults[key],
    )
    if (value !== undefined) output.push(value)
  }

  if (program.compounds.length) {
    const resolved = new Array<unknown>(program.readKeys.length)
    for (let index = 0; index < program.readKeys.length; index++) {
      const key = program.readKeys[index]
      resolved[index] = props[key] === undefined ? defaults[key] : props[key]
    }

    compound: for (let index = 0; index < program.compounds.length; index++) {
      const candidate = program.compounds[index]
      for (let selectorIndex = 0; selectorIndex < candidate.indexes.length; selectorIndex++) {
        if (
          !matchesCompoundSelector(
            candidate.selectors[selectorIndex],
            resolved[candidate.indexes[selectorIndex]],
          )
        ) {
          continue compound
        }
      }

      if (candidate.classValue !== undefined) output.push(candidate.classValue)
      if (candidate.classNameValue !== undefined) output.push(candidate.classNameValue)
    }
  }

  return joinPrepared(output)
}

/**
 * Converts authored configuration into the executable representation reused by
 * every component call. Expensive shape work happens once at creation time.
 */
export function createProgram(
  runtime: VariantRuntime,
  config: Record<string, any>,
): VariantProgram {
  const composes = config.composes
  const childComponents: readonly CVComponentShape[] =
    composes == null
      ? EMPTY_COMPONENTS
      : Array.isArray(composes)
        ? composes.slice()
        : [composes]

  const children: VariantProgram[] = []
  const foreignChildren: CVComponentShape[] = []
  for (let index = 0; index < childComponents.length; index++) {
    const child = childComponents[index]
    const program = programs.get(child)
    if (program) children.push(program)
    else foreignChildren.push(child)
  }

  const merged = mergeVariantMetadata(childComponents, config)
  const localVariants = config.variants as VariantShape | undefined
  const localVariantKeys = localVariants ? Object.keys(localVariants) : []
  const localVariantMaps = localVariantKeys.map((key) => copyVariantMap(localVariants![key]))
  const readKeys = localVariantKeys.slice()
  const compounds = prepareCompounds(config.compounds, readKeys)

  for (let index = 0; index < children.length; index++) {
    for (const key of children[index].readKeys) {
      if (!readKeys.includes(key)) readKeys.push(key)
    }
  }

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

  if (!readKeys.length && !foreignChildren.length && !children.length) {
    program.staticOutput = joinPrepared([program.base])
    program.dense = null
  }

  program.render = (
    props: Record<string, unknown>,
    inheritedDefaults = program.defaults,
    includeClassProps = true,
  ): string => {
    let core: string

    if (program.staticOutput !== undefined) {
      core = program.staticOutput
    } else {
      let dense = program.dense
      if (dense === undefined) {
        dense = buildDenseTable(program) ?? null
        program.dense = dense
      }

      if (dense) {
        const index = resolveDenseIndex(dense, props, inheritedDefaults)
        if (index >= 0) {
          const cached = dense.outputs[index]
          if (cached !== undefined) {
            core = cached
          } else {
            core = renderUncached(program, props, inheritedDefaults)
            dense.outputs[index] = core
          }
        } else {
          core = renderUncached(program, props, inheritedDefaults)
        }
      } else {
        core = renderUncached(program, props, inheritedDefaults)
      }
    }

    if (!includeClassProps) return core

    const classValue = props.class as ClassValue
    const classNameValue = props.className as ClassValue
    return classValue === undefined && classNameValue === undefined
      ? core
      : cx(core, classValue, classNameValue)
  }

  return program
}

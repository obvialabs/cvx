/**
 * Tailwind-aware class conflict resolution for `@obvia/cvx`.
 *
 * The public function is intentionally tiny: all parsing, conflict tables,
 * caching, and merge state stay private to the `cn` domain.
 */
import tables from "./internal/generated/tables"
import { createEngine } from "./internal/engine/index"
import { wrapComposer } from "./internal/engine/compose"

import type { ClassComposer } from "../cx/types"

const engine = /* @__PURE__ */ createEngine(tables)

/**
 * Composes class values and resolves Tailwind CSS utility conflicts.
 *
 * `cn` accepts the same nested arrays, dictionaries, primitives, and falsy
 * values as `cx`. After composition, utilities that belong to the same
 * Tailwind conflict group are resolved with last-one-wins semantics.
 *
 * @example
 * ```ts
 * cn("px-2", condition && "px-4", { "text-sm": true })
 * // => "px-4 text-sm"
 * ```
 */
export const cn: ClassComposer = /* @__PURE__ */ wrapComposer(
  engine.mergeString,
  engine,
) as ClassComposer

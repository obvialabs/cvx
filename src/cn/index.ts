import type { ClassComposer } from "../cx/types"

import { wrapComposer } from "./internal/engine/compose"
import { createEngine } from "./internal/engine"
import tables from "./internal/generated/tables"

// Create the default Tailwind conflict engine once for the public singleton
const engine = /* @__PURE__ */ createEngine(tables)

/**
 * Compose class values and resolve Tailwind CSS utility conflicts
 *
 * State-aware resolver inputs produce a callback compatible with component
 * libraries that expose `className(state)`. Static-only calls continue to
 * resolve immediately to a string.
 *
 * **Parameters**
 * - `inputs` – Static class values or state-aware class resolvers to compose and merge
 *
 * **Usage**
 * ```ts
 * // "px-4 text-lg"
 * cn("px-2 text-sm", condition && "px-4", { "text-lg": true })
 *
 * // (state) => "px-4 opacity-50"
 * cn("px-2", (state: { disabled: boolean }) =>
 *   state.disabled && "px-4 opacity-50"
 * )
 * ```
 */
export const cn: ClassComposer = /* @__PURE__ */ wrapComposer(
  engine.mergeString,
  engine,
) as ClassComposer

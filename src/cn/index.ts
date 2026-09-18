import type { ClassComposer } from "../cx/types"

import { wrapComposer } from "./internal/engine/compose"
import { createEngine } from "./internal/engine"
import tables from "./internal/generated/tables"

// Create the default Tailwind conflict engine once for the public singleton
const engine = /* @__PURE__ */ createEngine(tables)

/**
 * Compose class values and resolve Tailwind CSS utility conflicts
 *
 * **Parameters**
 * - `inputs` – Class values to normalize, concatenate, and merge
 *
 * **Usage**
 * ```ts
 * // "px-4 text-lg"
 * cn("px-2 text-sm", condition && "px-4", { "text-lg": true })
 * ```
 */
export const cn: ClassComposer = /* @__PURE__ */ wrapComposer(
  engine.mergeString,
  engine,
) as ClassComposer

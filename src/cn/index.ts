/**
 * Tailwind-aware class conflict resolution for `@obvia/cvx`.
 *
 * The packed lookup engine is derived from MIT-licensed work in the `cn` /
 * `tailwind-merge` ecosystem. Attribution is preserved in the repository
 * notices while the implementation remains private to this domain.
 */
import tables from "./internal/generated/tables.js";
import { createEngine, wrapClsx } from "./internal/engine.js";

import type { ClassComposer } from "../cx/types.js";

const engine = /* @__PURE__ */ createEngine(tables);

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
export const cn: ClassComposer = /* @__PURE__ */ wrapClsx(
  engine.mergeString,
  engine,
) as ClassComposer;

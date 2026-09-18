/**
 * Tailwind-aware class-name merging for @obvia/cv.
 *
 * The merge engine is derived from the MIT-licensed `cn` project by shadcn
 * and contributors. See NOTICE.md for attribution.
 */
import tables from "./internal/generated/tables.js";
import {
  createEngine,
  twJoin,
  wrapClsx,
} from "./internal/engine.js";

import type { CX } from "../types.js";

const engine = /* @__PURE__ */ createEngine(tables);

/**
 * Compose clsx-style class values and resolve Tailwind CSS conflicts.
 *
 * Unlike `cx`, `cn` is conflict-aware: later utilities in the same Tailwind
 * conflict group win while non-conflicting utilities are preserved.
 */
export const cn: CX = /* @__PURE__ */ wrapClsx(
  engine.mergeString,
  engine,
) as CX;

/** Tailwind-merge-compatible string/nested-array merger. */
export const twMerge = engine.merge;

export { twJoin };

/**
 * Public package boundary for `@obvia/cvx`.
 *
 * Everything outside these four exports is an implementation detail and may
 * evolve without becoming part of the package contract.
 */
export { cn } from "./cn/index.js"
export { cv } from "./cv/index.js"
export { cx } from "./cx/index.js"
export type { VariantProps } from "./cv/types.js"

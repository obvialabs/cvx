import { createCvRuntime } from "./internal/runtime"

/**
 * Create a typed class-variant component
 *
 * **Parameters**
 * - `config` – Variant configuration used to create the component
 *    - `base` – Base class value applied to every resolved variant state
 *    - `variants` – Named variant axes and their associated class values
 *    - `defaults` – Default selections used when variant props are omitted
 *    - `compounds` – Conditional class values applied when multiple variant selections match
 *    - `composes` – Existing CV components whose variants and defaults should be inherited
 *
 * **Returns**
 * - `CVComponentShape` – Callable class resolver with inferred variant props and prepared runtime metadata
 *
 * **Usage**
 * ```ts
 * const button = cv({
 *   base: "inline-flex items-center",
 *   variants: {
 *     intent: {
 *       primary: "bg-blue-600 text-white",
 *       danger: "bg-red-600 text-white"
 *     },
 *     size: {
 *       sm: "h-8 px-3",
 *       md: "h-10 px-4"
 *     }
 *   },
 *   defaults: {
 *     intent: "primary",
 *     size: "md"
 *   },
 *   compounds: [
 *     {
 *       intent: "danger",
 *       size: "sm",
 *       class: "font-medium"
 *     }
 *   ]
 * })
 *
 * button()
 * button({ intent: "danger" })
 * button({ size: "sm", class: "rounded-md" })
 * ```
 */
export const cv = /* @__PURE__ */ createCvRuntime()
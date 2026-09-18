import { createCvRuntime } from "./internal/runtime.js";

/**
 * Creates a typed class-variant component.
 *
 * Variant definitions are prepared once and reused across calls. Small bounded
 * variant spaces are compiled into lazy dense lookup tables while larger or
 * dynamic shapes automatically use the general execution path.
 */
export const cv = /* @__PURE__ */ createCvRuntime();

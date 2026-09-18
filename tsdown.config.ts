import { defineConfig } from "tsdown"

/**
 * Build CVX for ESM and CommonJS consumers without bundling internal modules
 */
export default defineConfig({
  // Expose only the package root as the public build entrypoint
  entry: {
    index: "src/index.ts",
  },

  // Preserve paths relative to the source directory in unbundle mode
  root: "src",

  // Write distributable artifacts into the package output directory
  outDir: "dist",

  // Compile every referenced source module independently instead of bundling
  unbundle: true,

  // Support both modern ESM consumers and CommonJS environments
  format: ["esm", "cjs"],

  // Keep generated modules independent from environment-specific assumptions
  platform: "neutral",

  // Remove stale artifacts before every build
  clean: true,

  // Emit syntax compatible with the package's minimum JavaScript target
  target: "es2022",

  // Generate source maps for compiled runtime modules
  sourcemap: true,

  // Emit TypeScript declarations with matching declaration source maps
  dts: {
    sourcemap: true,
  },

  // Remove unreachable and unused code during compilation
  treeshake: true,
})
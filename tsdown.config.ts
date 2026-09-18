import { defineConfig } from "tsdown"

/**
 * Builds the publishable package while preserving the source module structure.
 */
export default defineConfig({
  // Package entry points.
  entry     : {
    index     : "src/index.ts",
    config    : "src/config.ts",
    schema    : "src/schema.ts",
  },

  // Resolve modules relative to the source directory.
  root      : "src",

  // Write all generated artifacts to the distribution directory.
  outDir    : "dist",

  // Emit both ESM and CommonJS runtimes.
  format    : ["esm", "cjs"],

  // Keep the output runtime-neutral.
  platform  : "neutral",

  // Clean previous build artifacts before generating a new distribution.
  clean     : true,

  // Target ECMAScript version.
  target    : "es2022",

  // Generate source maps for JavaScript files.
  sourcemap : true,

  // Generate TypeScript declarations and declaration source maps.
  dts       : {
    sourcemap: true,
  },

  // Remove unused code from the output.
  treeshake : true,

  // Copy CSS file to the distribution directory.
  copy      : {
    from  : "src/tailwindcss.css",
    to    : "dist"
  }
})

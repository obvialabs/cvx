import { defineConfig } from "tsdown"

/**
 * Builds the single public CVX entrypoint for both modern ESM consumers and
 * CommonJS environments. Internal domain boundaries remain implementation
 * details and are bundled behind `@obvia/cvx`.
 */
export default defineConfig({
  entry     : {
    index: "src/index.ts",
  },
  root      : "src",
  outDir    : "dist",
  format    : ["esm", "cjs"],
  platform  : "neutral",
  clean     : true,
  target    : "es2022",
  sourcemap : true,
  dts       : {
    sourcemap: true,
  },
  treeshake : true,
})

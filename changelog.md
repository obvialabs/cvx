# Changelog

## v0.1.0 - 2026-09-18

Initial public foundation for **@obvia/cvx**, a zero-runtime-dependency class toolkit that combines compiled variants, class-value composition, and Tailwind-aware conflict resolution.

* `cv` with typed variants, defaults, compound variants, composition, boolean/numeric variants, runtime class overrides, and internal dense lookup compilation
* `cx` with recursive class-value composition across strings, numbers, bigints, arrays, dictionaries, and conditional values
* `cn` with the same class-value grammar plus packed Tailwind conflict resolution
* `VariantProps` for extracting the public variant contract of a `cv` component
* one public package entrypoint with no exposed compiler, configuration, schema, merge-engine, generated-table, or stylesheet subpaths
* domain-oriented source layout separating class composition, variant execution, conflict compilation, conflict runtime, and generated data
* runtime dependency count of zero
* Bun-first development, testing, benchmarking, and package management
* `tsdown` builds for ESM and CommonJS with declarations and source maps
* behavior, unit, property, guard, type, coverage, and performance regression suites
* differential behavior checks against `cva`, `class-variance-authority`, `clsx`, and `tailwind-merge`
* GitHub Actions workflows for validation, coverage, benchmarking, and npm publishing with provenance

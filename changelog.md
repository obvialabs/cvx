# Changelog

## v0.1.0 - 2026-09-18

Initial public foundation for **@obvia/cv** (CVX) a zero-runtime-dependency class toolkit 
that combines compiled variants, class-value composition, and Tailwind-aware conflict resolution.

* `cv` compiled variant engine with defaults, compound variants, composition, boolean/numeric variants, class overrides, dense lookup compilation, and schema introspection
* `cx` allocation-conscious class-value composition compatible with the established clsx/CVA value grammar, plus bigint support
* `cn` compiled Tailwind conflict engine with pre-generated lookup tables and advanced custom configuration through `@obvia/cv/config`
* Separate `cv`, `cx`, and `cn` semantics in one package rather than aliases or separate packages
* Runtime dependency count of zero
* Bun-first development, test, benchmark, and package-management workflow
* `tsdown` builds preserving the configured ESM and CommonJS outputs, declarations, source maps, and Tailwind CSS entry
* Dedicated behavior, unit, property, guard, type, coverage, and deterministic performance regression suites
* Differential behavior checks against `cva`, `class-variance-authority`, `clsx`, and `tailwind-merge`
* GitHub Actions workflows dedicated to CVX validation, coverage, benchmarking, and npm publishing with provenance

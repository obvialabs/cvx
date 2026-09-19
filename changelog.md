# Changelog

## 0.1.1 - 2026-09-19

### Added

- Add state-aware class resolvers to `cx` and `cn`, allowing callback-based `className` APIs such as Base UI to be composed directly
- Add type inference that preserves `string` results for static inputs and returns state resolvers only when dynamic class inputs require them
- Add support for combining multiple state-aware resolvers while inferring their shared state requirements
- Add runtime and compile-time coverage for static, dynamic, mixed, and Base UI-compatible class composition

### Changed

* Optimize common one-to-three string `cx` calls with allocation-light fast paths to preserve flat composition performance
* Document state-aware `cx` and `cn` usage, including callback-based `className` integration

### Fixed

- *

## v0.1.0 - 2026-09-19

### Added

* Add `cv` for type-safe class variants with base classes, defaults, compound variants, boolean and numeric variants, runtime class overrides, component composition, and inferred `VariantProps` ([b81e762](https://github.com/obvialabs/cvx/commit/b81e762), [daeba45](https://github.com/obvialabs/cvx/commit/daeba45))
* Add `cn` for class composition with Tailwind-aware conflict resolution, including modifiers, arbitrary values, arbitrary properties, logical utilities, animation utilities, prefixes, and custom merge configuration ([f3de5a0](https://github.com/obvialabs/cvx/commit/f3de5a0), [8b05885](https://github.com/obvialabs/cvx/commit/8b05885))
* Add `cx` for `clsx`-compatible class composition across strings, numbers, arrays, nested values, objects, and conditional inputs ([7c6318b](https://github.com/obvialabs/cvx/commit/7c6318b), [19c37c7](https://github.com/obvialabs/cvx/commit/19c37c7))
* Add a single public package entrypoint exposing `cv`, `cn`, `cx`, and the supported public type surface ([e375228](https://github.com/obvialabs/cvx/commit/e375228))
* Add Tailwind CSS v4 conflict definitions and generated lookup tables for fast runtime resolution ([338516b](https://github.com/obvialabs/cvx/commit/338516b), [4c93a21](https://github.com/obvialabs/cvx/commit/4c93a21))
* Add deterministic correctness, differential parity, property, fuzz, hardening, type-contract, architecture, and performance regression tests ([38b68a7](https://github.com/obvialabs/cvx/commit/38b68a7))
* Add real-repository corpus verification covering **58 open source repositories and 144,265 captured calls**, with every measured `cn()` result matching `clsx + tailwind-merge` ([38b68a7](https://github.com/obvialabs/cvx/commit/38b68a7))
* Add reproducible GitHub Actions benchmarks for `cx`, `cv`, `cn`, integration workloads, and real-repository corpus replay ([85b7919](https://github.com/obvialabs/cvx/commit/85b7919), [b309067](https://github.com/obvialabs/cvx/commit/b309067))
* Add validated npm publishing with package provenance, ESM and CommonJS outputs, declarations, and a minimal publish payload ([09d9003](https://github.com/obvialabs/cvx/commit/09d9003), [f00b6b9](https://github.com/obvialabs/cvx/commit/f00b6b9))
* Document installation, public APIs, advanced variant behavior, Tailwind conflict semantics, performance methodology, contribution guidelines, and security policy ([1512ba9](https://github.com/obvialabs/cvx/commit/1512ba9), [34e7bd4](https://github.com/obvialabs/cvx/commit/34e7bd4))

### Changed

* Refactor the runtime into focused `cx`, `cv`, and `cn` domains while preserving one minimal public API ([0e320f3](https://github.com/obvialabs/cvx/commit/0e320f3), [35692f0](https://github.com/obvialabs/cvx/commit/35692f0), [ce35e9c](https://github.com/obvialabs/cvx/commit/ce35e9c))
* Change the `cv` configuration API to concise `defaults` and `compounds` keys while preserving typed variant resolution and composition behavior ([daeba45](https://github.com/obvialabs/cvx/commit/daeba45))
* Improve `cv` preparation with adaptive execution so short-lived components avoid unnecessary dense-table preparation while repeated calls retain the optimized hot path ([82845d6](https://github.com/obvialabs/cvx/commit/82845d6))
* Improve runtime hardening and upstream compatibility across class composition, variant resolution, Tailwind conflict handling, cache behavior, and generated lookup execution ([8b05885](https://github.com/obvialabs/cvx/commit/8b05885))
* Change benchmark and verification workflows to keep synthetic workloads, cache behavior, integration paths, and real-repository measurements independently reproducible ([b309067](https://github.com/obvialabs/cvx/commit/b309067))

### Fixed

* Fix Tailwind animation conflict classification so built-in animation utilities conflict correctly without collapsing unrelated custom `animate-*` utilities ([8b05885](https://github.com/obvialabs/cvx/commit/8b05885))
* Fix deprecated gradient alias handling to match `tailwind-merge` behavior ([8b05885](https://github.com/obvialabs/cvx/commit/8b05885))
* Fix logical and physical spacing conflict relationships, including interactions between logical edges and axis utilities ([8b05885](https://github.com/obvialabs/cvx/commit/8b05885))
* Fix `cx` bigint handling to preserve `clsx` runtime parity ([8b05885](https://github.com/obvialabs/cvx/commit/8b05885))
* Fix dense and general `cv` execution paths to remain observationally equivalent across repeated, composed, and compound-heavy workloads ([8b05885](https://github.com/obvialabs/cvx/commit/8b05885))

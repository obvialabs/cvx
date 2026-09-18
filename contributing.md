# Contributing to @obvia/cvx

Thank you for contributing to CVX. The project is intentionally small at the package boundary and specialized internally, so changes should preserve both properties.

## Development requirements

CVX uses Bun for dependency management and test orchestration, TypeScript for static contracts, and tsdown for package builds.

```bash
bun install --frozen-lockfile
bun run check
bun run test
bun run build
```

Run performance regression tests and the comparison benchmark when a change touches a hot path:

```bash
bun run test:performance
bun run bench
```

## Source architecture

The runtime is organized by responsibility:

```text
src/
├── cn/
│   ├── index.ts
│   └── internal/
│       ├── compiler/     config → model → tables → source emission
│       ├── engine/       input composition, hashing, conflict runtime
│       ├── generated/    checked-in lookup data
│       ├── factory.ts    internal compiler/runtime bridge
│       ├── types.ts
│       └── validators.ts
├── cv/
│   ├── index.ts
│   ├── types.ts
│   └── internal/         variants, compounds, dense lookup, program runtime
├── cx/                   canonical class-value grammar and composition
└── index.ts              public package boundary
```

Keep domain-specific implementation inside its domain. Shared behavior has one owner instead of being copied between domains: `cx` owns the canonical class-value grammar, `cv` owns variant compilation/execution, and `cn` owns Tailwind-aware conflict resolution.

Generated conflict data lives under `src/cn/internal/generated` and must not be edited manually. Compiler authoring machinery remains internal and is tree-shaken from the normal package entrypoint.

## Public API policy

The public npm surface is deliberately limited to:

```ts
import { cn, cv, cx, type VariantProps } from "@obvia/cvx"
```

Do not add package subpath exports or expose compiler/configuration internals as a convenience change. A new public export is a long-lived API commitment and should be proposed explicitly.

## Tests

Changes should be covered at the appropriate level:

- **unit** for isolated runtime and compiler behavior
- **behavior** for differential compatibility against reference libraries
- **property** for generated invariants and cross-path equivalence
- **guard** for package, architecture, and workflow boundaries
- **type** for positive and negative TypeScript contracts
- **performance** for broad regression budgets on hot paths

Run everything, including performance guards, with:

```bash
bun run test:all
```

## Performance changes

Do not optimize by narrowing supported behavior. Performance work should preserve observable semantics and be accompanied by behavior/property coverage.

Treat nanosecond benchmarks as comparative measurements rather than guarantees. Keep benchmark inputs representative, consume results so work cannot be optimized away, and compare equivalent semantics.

## Pull requests

Keep pull requests focused. Explain behavioral changes, include tests, and call out any measurable performance or bundle-size impact. Avoid unrelated formatting churn in generated or performance-sensitive files.

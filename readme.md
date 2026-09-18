# @obvia/cv

[![tests](https://github.com/obvialabs/cvx/actions/workflows/tests.yml/badge.svg)](https://github.com/obvialabs/cvx/actions/workflows/tests.yml)
[![coverage](https://github.com/obvialabs/cvx/actions/workflows/coverage.yml/badge.svg)](https://github.com/obvialabs/cvx/actions/workflows/coverage.yml)
[![benchmark](https://github.com/obvialabs/cvx/actions/workflows/benchmark.yml/badge.svg)](https://github.com/obvialabs/cvx/actions/workflows/benchmark.yml)

> Three primitives. One package. Compiled variants, lightweight class composition, and Tailwind-aware conflict resolution.

`@obvia/cv` brings `cv`, `cx`, and `cn` together in one deeply typed, zero-runtime-dependency package for modern TypeScript applications. It keeps class composition predictable, variant evaluation fast, and Tailwind CSS conflict resolution available without maintaining separate runtime utilities.

- **`cv` for variants** — compiled variants, defaults, compound variants, composition, class overrides, internal variants, and schema introspection.
- **`cx` for composition** — lightweight class-value normalization for strings, numbers, bigint values, nested arrays, and conditional object syntax.
- **`cn` for Tailwind** — the same ergonomic class-value input with compiled Tailwind CSS conflict resolution.
- **Deep TypeScript support** — variant props, defaults, composition, configuration, and schema contracts remain strongly typed.
- **Measured performance** — dedicated Bun benchmarks compare equivalent workloads against `class-variance-authority`, `cva`, `clsx`, and `tailwind-merge`.
- **Comprehensive verification** — behavior, unit, property, guard, type, coverage, and performance regression suites exercise the public API and internal invariants.
- **Zero runtime dependencies** — dual ESM/CommonJS builds, bundled declarations, source maps, Tailwind CSS entry, and Bun-first runtime verification.

## Installation

There is only one package to install: **use `cx()` for composition, `cn()` when Tailwind conflicts must be resolved, and `cv()` when classes depend on variants.**

```bash
bun add @obvia/cv
```

## Quick start

There are three primitives to learn, all exported from the same package.

```ts
import { cn, cv, cx } from "@obvia/cv"

cx("p-2", "p-4")
// "p-2 p-4"

cn("p-2", "p-4")
// "p-4"

const button = cv({
    base: "inline-flex items-center rounded-md font-medium",
    variants: {
        intent: {
            primary: "bg-black text-white",
            secondary: "bg-white text-black",
        },
        size: {
            sm: "h-8 px-3",
            md: "h-10 px-4",
        },
    },
    defaultVariants: {
        intent: "primary",
        size: "md",
    },
    compoundVariants: [
        {
            intent: "primary",
            size: "md",
            class: "font-semibold",
        },
    ],
})

button({ intent: "secondary" })
```

`cv` supports base classes, typed variants, default variants, compound variants, component composition, `class` / `className`, internal variants, booleans, numeric variants, custom class composers, and schema introspection.

`cx` only normalizes and concatenates class values, so authored utilities are never interpreted or removed:

```ts
cx("text-sm", "text-lg")
// "text-sm text-lg"
```

`cn` resolves Tailwind conflicts while preserving unrelated utilities, modifiers, arbitrary values, and conditional class inputs:

```ts
cn(
    "rounded-md p-2 text-sm",
    true && "p-4",
    { "text-lg": true },
)
// "rounded-md p-4 text-lg"
```

The class pipelines can also be configured independently. Passing `cn` as the `cx` implementation makes a configured `cv` runtime conflict-aware without changing the default `cv` semantics:

```ts
import { cn, configure } from "@obvia/cv"

const { cv } = configure({ cx: cn })

const button = cv({
    base: "p-2 p-4",
})

button()
// "p-4"
```

Advanced Tailwind merge configuration is available from `@obvia/cv/config`, schema introspection from `@obvia/cv/schema`, and the optional Tailwind CSS v4 stylesheet entry from `@obvia/cv/tailwindcss`.


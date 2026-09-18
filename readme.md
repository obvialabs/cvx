# @obvia/cvx

[![tests](https://github.com/obvialabs/cvx/actions/workflows/tests.yml/badge.svg)](https://github.com/obvialabs/cvx/actions/workflows/tests.yml)
[![coverage](https://github.com/obvialabs/cvx/actions/workflows/coverage.yml/badge.svg)](https://github.com/obvialabs/cvx/actions/workflows/coverage.yml)
[![benchmark](https://github.com/obvialabs/cvx/actions/workflows/benchmark.yml/badge.svg)](https://github.com/obvialabs/cvx/actions/workflows/benchmark.yml)

> Three functions. One type helper. Compiled variants and Tailwind-aware class composition without runtime dependencies.

`@obvia/cvx` combines typed class variants, general class-value composition, and Tailwind CSS conflict resolution behind one intentionally small public API.

- **`cv` for variants** — typed variants, defaults, compound variants, composition, boolean/numeric values, and runtime class overrides.
- **`cn` for Tailwind classes** — accepts the same class-value grammar as `cx` and resolves conflicting Tailwind utilities.
- **`cx` for composition** — fast recursive class-value normalization without Tailwind conflict resolution.
- **`VariantProps` for inference** — extracts the public variant props of a `cv` component.
- **Compiled hot paths** — bounded variant spaces are prepared once and resolved through lazy dense lookup tables when profitable.
- **Zero runtime dependencies** — the published package ships its own runtime implementation with ESM and CommonJS builds.
- **One public entrypoint** — no configuration, schema, compiler, or Tailwind stylesheet subpath APIs.

## Installation

```bash
bun add @obvia/cvx
```

The package can also be installed with another npm-compatible package manager.

## Quick start

```ts
import { cn, cv, cx, type VariantProps } from "@obvia/cvx"

const button = cv({
    base: "inline-flex items-center rounded-md font-medium",
    variants: {
        intent: {
            primary: "bg-blue-600 text-white",
            secondary: "bg-white text-slate-900",
        },
        size: {
            sm: "h-8 px-3 text-sm",
            md: "h-10 px-4",
            lg: "h-12 px-6 text-lg",
        },
        disabled: {
            true: "cursor-not-allowed opacity-50",
            false: "cursor-pointer",
        },
    },
    defaultVariants: {
        intent: "primary",
        size: "md",
        disabled: false,
    },
})

type ButtonVariants = VariantProps<typeof button>

button({ intent: "secondary", size: "lg" })
cn("px-2", "px-4")
cx("button", true && "active", { disabled: false })
```

## Advanced

### Public API

CVX intentionally exposes only one package entrypoint:

```ts
import { cn, cv, cx, type VariantProps } from "@obvia/cvx"
```

There are no public `/config`, `/schema`, `/tailwindcss`, compiler, merge-engine, or generated-table entrypoints. Those concerns are implementation details and may evolve without expanding the application-facing API.

### `cx`: class-value composition

`cx()` normalizes class values into one space-delimited string. It does not understand Tailwind conflict groups.

```ts
import { cx } from "@obvia/cvx"

cx("button", "active")
// "button active"

cx("button", false && "hidden", null, undefined)
// "button"

cx(["button", ["active", ["rounded"]]])
// "button active rounded"

cx({ active: true, disabled: false })
// "active"
```

Strings, numbers, bigints, booleans, nested arrays, conditional dictionaries, `null`, and `undefined` are accepted. Falsy class values are ignored.

```ts
cx("item", 2, 3n, { selected: true })
// "item 2 3 selected"
```

Use `cx` when order should be preserved exactly and conflicting utility classes must remain untouched:

```ts
cx("px-2", "px-4")
// "px-2 px-4"
```

### `cn`: Tailwind-aware composition

`cn()` accepts the same application-facing class-value grammar as `cx`, then resolves Tailwind utility conflicts.

```ts
import { cn } from "@obvia/cvx"

cn("px-2", "px-4")
// "px-4"

cn("text-sm", "font-semibold", "text-lg")
// "font-semibold text-lg"
```

Conditional and nested values can be mixed directly:

```ts
cn(
    "rounded-md px-2",
    active && "bg-blue-600",
    ["px-4", { "opacity-50": disabled }],
)
```

#### Modifiers

Conflicts are scoped by their modifier context:

```ts
cn("p-2", "hover:p-2", "hover:p-4")
// "p-2 hover:p-4"

cn("md:text-sm", "lg:text-lg", "md:text-xl")
// "lg:text-lg md:text-xl"
```

#### Important utilities

Important utilities are resolved independently from ordinary utilities:

```ts
cn("p-2", "!p-2", "!p-4")
// "p-2 !p-4"
```

#### Arbitrary values and properties

```ts
cn("w-[10px]", "w-[24px]")
// "w-[24px]"

cn("[color:red]", "[color:blue]")
// "[color:blue]"
```

The Tailwind conflict model is packaged internally. Applications do not need to import a stylesheet or configure a second merge library for the default `cn` behavior.

### `cv`: variant definitions

`cv()` creates a callable component-class resolver from one definition.

```ts
import { cv } from "@obvia/cvx"

const badge = cv({
    base: "inline-flex rounded-full",
    variants: {
        tone: {
            neutral: "bg-slate-100 text-slate-900",
            success: "bg-green-100 text-green-900",
            danger: "bg-red-100 text-red-900",
        },
        size: {
            sm: "px-2 py-0.5 text-xs",
            md: "px-3 py-1 text-sm",
        },
    },
})

badge({ tone: "success", size: "sm" })
```

### Base classes

`base` is emitted before variant and compound classes:

```ts
const card = cv({
    base: "rounded-xl border bg-white",
})

card()
// "rounded-xl border bg-white"
```

Base values use the same class-value grammar as `cx`, so arrays and dictionaries are valid:

```ts
const item = cv({
    base: ["item", { interactive: true }],
})
```

### Default variants

Defaults apply when a variant is omitted:

```ts
const text = cv({
    variants: {
        tone: {
            normal: "text-slate-900",
            muted: "text-slate-500",
        },
    },
    defaultVariants: {
        tone: "normal",
    },
})

text()
// "text-slate-900"
```

An `undefined`, `null`, or empty-string runtime selection falls back to the configured default where applicable.

### Boolean variants

String keys `true` and `false` become boolean props:

```ts
const control = cv({
    variants: {
        disabled: {
            true: "opacity-50",
            false: "opacity-100",
        },
    },
})

control({ disabled: true })
```

### Numeric variants

Numeric-looking keys can be selected with numbers:

```ts
const depth = cv({
    variants: {
        level: {
            0: "shadow-none",
            1: "shadow-sm",
            2: "shadow-md",
        },
    },
})

depth({ level: 2 })
```

### Compound variants

Compound variants emit classes only when every selector matches:

```ts
const button = cv({
    variants: {
        intent: {
            primary: "bg-blue-600",
            danger: "bg-red-600",
        },
        size: {
            sm: "h-8",
            lg: "h-12",
        },
    },
    compoundVariants: [
        {
            intent: "danger",
            size: "lg",
            class: "ring-2 ring-red-300",
        },
    ],
})
```

A selector can match several values:

```ts
compoundVariants: [
    {
        intent: ["primary", "danger"],
        size: ["sm", "lg"],
        className: "font-semibold",
    },
]
```

Both `class` and `className` are accepted in authored compound variants.

### Runtime class overrides

Generated components accept a final `class` or `className` value:

```ts
button({
    intent: "primary",
    className: "w-full",
})
```

These values are appended after the generated variant output. `cv` itself uses composition semantics rather than Tailwind conflict removal; use `cn()` at the application boundary when a final conflict-aware merge is desired:

```ts
cn(button({ intent: "primary" }), "bg-black")
```

### Composition

A `cv` component can compose another component or a tuple of components:

```ts
const typography = cv({
    variants: {
        weight: {
            normal: "font-normal",
            bold: "font-bold",
        },
    },
    defaultVariants: {
        weight: "normal",
    },
})

const spacing = cv({
    variants: {
        size: {
            sm: "px-2 py-1",
            lg: "px-5 py-3",
        },
    },
    defaultVariants: {
        size: "sm",
    },
})

const button = cv({
    composes: [typography, spacing],
    base: "inline-flex items-center",
    defaultVariants: {
        weight: "bold",
        size: "lg",
    },
})
```

Composed variants remain available on the resulting component, and parent defaults can retune child defaults.

### Nested composition

Composition can be nested without manually forwarding variant props:

```ts
const base = cv({
    variants: {
        tone: { calm: "text-slate-700", loud: "text-black" },
    },
})

const middle = cv({ composes: base, base: "font-medium" })
const final = cv({ composes: middle, base: "tracking-tight" })

final({ tone: "loud" })
```

CVX recognizes its own composed components internally and executes their prepared programs directly instead of stacking unnecessary public wrappers.

### Internal variants

Variant names beginning with `_` can participate in runtime resolution while being omitted from `VariantProps`:

```ts
const component = cv({
    variants: {
        tone: {
            primary: "text-blue-600",
            danger: "text-red-600",
        },
        _density: {
            compact: "gap-1",
            comfortable: "gap-3",
        },
    },
})

type Props = VariantProps<typeof component>
// Props contains `tone`, but not `_density`.
```

This is useful for composition details that should remain implementation-specific to a component family.

### `VariantProps`

Use `VariantProps` to derive the public variant API from a `cv` component:

```ts
import { cv, type VariantProps } from "@obvia/cvx"

const button = cv({
    variants: {
        intent: {
            primary: "bg-blue-600",
            secondary: "bg-white",
        },
        size: {
            sm: "h-8",
            md: "h-10",
        },
    },
})

type ButtonVariants = VariantProps<typeof button>
```

`VariantProps` excludes `class`, `className`, and `_`-prefixed internal variants so component-level props stay focused on the public variant contract.

### TypeScript inference

Variant keys and values are inferred from the definition:

```ts
const button = cv({
    variants: {
        size: {
            sm: "text-sm",
            md: "text-base",
        },
    },
})

button({ size: "sm" })
// button({ size: "xl" }) // TypeScript error
```

Boolean and numeric variant keys keep their ergonomic runtime types, and composed components merge their variant contracts.

### Runtime architecture

CVX keeps implementation details out of the public API but uses specialized internal paths:

- `cx` owns the canonical class-value grammar and allocation-conscious composition path.
- `cn` owns a packed Tailwind conflict engine backed by generated lookup tables.
- `cv` prepares variant metadata, compound selectors, composition relationships, and dense lookup dimensions when a component is created.
- Small bounded variant spaces can use lazy dense result slots after preparation.
- Larger or dynamic shapes fall back to the general prepared executor without changing observable behavior.
- Generated Tailwind tables and compiler/configuration utilities remain package-private.

There are no public performance tuning knobs. CVX selects its execution path internally so application code does not depend on compiler or cache implementation details.

### Module formats

The package is built with `tsdown` and publishes both ESM and CommonJS runtime outputs from the same root entrypoint.

ESM:

```ts
import { cn, cv, cx } from "@obvia/cvx"
```

CommonJS:

```js
const { cn, cv, cx } = require("@obvia/cvx")
```

## Performance

The benchmark suite compares equivalent workloads instead of presenting one synthetic headline number. It includes class composition, defaults and compounds, explicit and rotating variants, compound-heavy definitions, and Tailwind conflict merging.

A recent Bun run produced:

| Workload | @obvia/cvx | Baseline | Relative |
| --- | ---: | ---: | ---: |
| class composition | **44.32 ns/op** | class-variance-authority 0.7.1: 68.89 ns/op | **1.55x faster** |
| class composition | **44.32 ns/op** | cva 1.0 beta: 103.79 ns/op | **2.34x faster** |
| defaults + compounds | **39.39 ns/op** | class-variance-authority 0.7.1: 978.98 ns/op | **24.85x faster** |
| defaults + compounds | **39.39 ns/op** | cva 1.0 beta: 169.75 ns/op | **4.31x faster** |
| explicit variants | **28.54 ns/op** | class-variance-authority 0.7.1: 1420.33 ns/op | **49.76x faster** |
| explicit variants | **28.54 ns/op** | cva 1.0 beta: 267.36 ns/op | **9.37x faster** |
| rotating variants | **47.34 ns/op** | class-variance-authority 0.7.1: 1234.81 ns/op | **26.08x faster** |
| rotating variants | **47.34 ns/op** | cva 1.0 beta: 251.33 ns/op | **5.31x faster** |
| compound-heavy | **27.84 ns/op** | class-variance-authority 0.7.1: 12875.12 ns/op | **462.54x faster** |
| compound-heavy | **27.84 ns/op** | cva 1.0 beta: 1097.36 ns/op | **39.42x faster** |
| Tailwind merge: stable | **37.76 ns/op** | clsx + tailwind-merge: 166.18 ns/op | **4.40x faster** |
| Tailwind merge: rotating | **9.86 ns/op** | clsx + tailwind-merge: 137.59 ns/op | **13.96x faster** |

Performance depends on Bun/runtime version, CPU, workload shape, cache state, and class/variant distributions. These values are reference measurements, not duration guarantees.

Run the same checked-in comparison locally:

```bash
bun run bench
```

Performance regression tests are separate from the comparison benchmark:

```bash
bun run test:performance
```

## Contributing

The **@obvia/cvx** project welcomes focused contributions that preserve the small public API, behavioral parity, type safety, and measured performance characteristics.

- **[Contributing Guide](contributing.md)**

## Security

If you believe you have discovered a security vulnerability, report it privately before public disclosure.

- **[Security Policy](security.md)**

## License

The project is published under the **[MIT License](license.md)**.

- **[MIT License](license.md)**

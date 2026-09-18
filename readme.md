# @obvia/cvx

[![tests](https://github.com/obvialabs/cvx/actions/workflows/tests.yml/badge.svg)](https://github.com/obvialabs/cvx/actions/workflows/tests.yml)
[![coverage](https://github.com/obvialabs/cvx/actions/workflows/coverage.yml/badge.svg)](https://github.com/obvialabs/cvx/actions/workflows/coverage.yml)
[![benchmark](https://github.com/obvialabs/cvx/actions/workflows/benchmark.yml/badge.svg)](https://github.com/obvialabs/cvx/actions/workflows/benchmark.yml)

> Three functions. One type helper. Compiled variants and Tailwind-aware class composition without runtime dependencies.

`@obvia/cvx` combines typed class variants, general class-value composition, and Tailwind CSS conflict resolution behind one intentionally small public API.

- **`cv` for variants** — typed variants, defaults, compounds, composition, boolean/numeric values, and runtime class overrides.
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
    defaults: {
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

### Defaults

Defaults apply when a variant is omitted:

```ts
const text = cv({
    variants: {
        tone: {
            normal: "text-slate-900",
            muted: "text-slate-500",
        },
    },
    defaults: {
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

### Compounds

Compounds emit classes only when every selector matches:

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
    compounds: [
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
compounds: [
    {
        intent: ["primary", "danger"],
        size: ["sm", "lg"],
        className: "font-semibold",
    },
]
```

Both `class` and `className` are accepted in authored compounds.

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
    defaults: {
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
    defaults: {
        size: "sm",
    },
})

const button = cv({
    composes: [typography, spacing],
    base: "inline-flex items-center",
    defaults: {
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

CVX benchmarks equivalent public workloads instead of deriving one speed claim from a single hot loop. The checked-in suite covers:

- flat and nested `cx` composition against `clsx`;
- hot `cv` defaults, explicit variants, and rotating variant selections;
- compound scaling at 4, 16, and 64 rules;
- component creation and creation + first call, where preparation cost cannot be hidden by hot reuse;
- `cn` stable cache hits, a 32-entry working set, and a 32K cache-hostile working set;
- arbitrary values with stacked modifiers;
- an end-to-end `cv + cn` application path.

Every workload is warmed first, calibrated to a target sample duration, then measured with interleaved candidate ordering. The report includes median (`p50`) and `p95` nanoseconds per operation, throughput, relative standard deviation, and the workload-specific ratio versus CVX. CI also stores the raw sample arrays and runner metadata as benchmark artifacts.

Cache-sensitive workloads are labelled explicitly. A cache-hit result is not presented as an uncached parser result, and the benchmark does not calculate an aggregate speedup across unrelated workloads.

Run the same checked-in suite locally:

```bash
bun run bench
```

The GitHub benchmark workflow records the exact Bun version, runner architecture, CPU information, relevant dependency versions, text output, and machine-readable JSON for each run. Use those measured artifacts when quoting performance numbers rather than copying an old benchmark table into documentation.

## Contributing

The **@obvia/cvx** project welcomes contributions from the community.

Whether you want to report a bug, suggest a new feature, improve the
documentation, or submit code changes, your contributions are greatly appreciated.

You can find detailed information about the contribution process by visiting the link below.

- **[Contributing Guide](contributing.md)**

## Security

The **@obvia/cvx** project takes security vulnerabilities seriously.

If you believe you have discovered a security vulnerability, please report it
responsibly by contacting **Selçuk Çukur** at **<hello@selcukcukur.me>**.

Please do not disclose security vulnerabilities publicly until they have been
reviewed and addressed.

You can find detailed information about the security policy by visiting the link below.

- **[Security Policy](security.md)**

## License

The **@obvia/cvx** project is published as open source software under the **[MIT License](license.md)**,
which is one of the most widely used open source licenses.

You can find detailed information about the license terms by visiting the link below.

- **[MIT License](license.md)**

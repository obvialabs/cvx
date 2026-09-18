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

## Advanced

The default API is intentionally small, but each primitive can be used independently or combined into a more specialized class pipeline.

### `cx` — class-value composition

`cx` is the lowest-level primitive. It normalizes class values and concatenates them in author order without interpreting CSS or resolving conflicts.

```ts
import { cx } from "@obvia/cv"

cx(
    "inline-flex",
    ["items-center", ["gap-2"]],
    { "opacity-50": false, "cursor-pointer": true },
    42,
    10n,
)
// "inline-flex items-center gap-2 cursor-pointer 42 10"
```

Supported values include strings, numbers, bigint values, nested arrays, conditional object maps, booleans, `null`, and `undefined`. Falsy control values are ignored while truthy object keys are emitted as classes.

Unlike `cn`, `cx` never tries to understand Tailwind utility relationships:

```ts
cx("p-2", "p-4", "text-sm", "text-lg")
// "p-2 p-4 text-sm text-lg"
```

Use `cx` when authored class order must be preserved exactly or when the input is not Tailwind-specific.

### `cn` — Tailwind-aware composition

`cn` accepts the same ergonomic class-value inputs as `cx`, then resolves conflicting Tailwind utilities so the later applicable utility wins.

```ts
import { cn } from "@obvia/cv"

cn(
    "rounded-md p-2 text-sm",
    ["hover:p-3", { "p-4": true }],
    "text-lg",
)
// "rounded-md hover:p-3 p-4 text-lg"
```

Non-conflicting utilities are retained, while conflicting utilities are reduced according to Tailwind-aware class groups, modifiers, arbitrary values, important modifiers, and related conflict rules.

```ts
cn("px-2", "py-4")
// "px-2 py-4"

cn("p-2", "p-4")
// "p-4"

cn("hover:p-2", "hover:p-4", "focus:p-3")
// "hover:p-4 focus:p-3"
```

Use `cn` at component boundaries where consumer-provided Tailwind classes should be able to override authored defaults.

### `twJoin` and `twMerge`

The root entry also exports lower-level helpers for migration and interoperability.

```ts
import { twJoin, twMerge } from "@obvia/cv"

twJoin("p-2", ["p-4", ["text-sm"]])
// "p-2 p-4 text-sm"

twMerge("p-2", ["p-4", "text-sm"], "text-lg")
// "p-4 text-lg"
```

`twJoin` joins Tailwind-shaped string / nested-array input without conflict resolution. `twMerge` performs conflict resolution for already Tailwind-shaped input. For normal application code, prefer `cx` and `cn`; these helpers exist for lower-level use and migration paths.

### `cv` — compiled variants

`cv` creates a reusable class component from a static definition. The definition is prepared once and the runtime selects the classes required for each call.

```ts
import { cv } from "@obvia/cv"

const badge = cv({
    base: "inline-flex items-center rounded-full font-medium",
    variants: {
        tone: {
            neutral: "bg-zinc-100 text-zinc-900",
            success: "bg-emerald-100 text-emerald-900",
            danger: "bg-red-100 text-red-900",
        },
        size: {
            sm: "h-5 px-2 text-xs",
            md: "h-6 px-2.5 text-sm",
        },
    },
    defaultVariants: {
        tone: "neutral",
        size: "md",
    },
})

badge()
badge({ tone: "success" })
```

The returned component is callable and also exposes its normalized configuration through the read-only `config` property.

```ts
badge.config.variants
badge.config.defaultVariants
```

### Base classes

`base` is emitted before variant and compound classes.

```ts
const card = cv({
    base: "rounded-xl border bg-white shadow-sm",
})

card()
// "rounded-xl border bg-white shadow-sm"
```

Static components without variants use a dedicated fast path. Runtime `class` or `className` values can still be appended when the component is called.

### Variants

Variant keys and values are inferred directly from the configuration.

```ts
const button = cv({
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
})

button({ intent: "primary", size: "sm" })
```

Boolean and numeric variant values are supported without forcing string values at the call site.

```ts
const item = cv({
    variants: {
        active: {
            true: "font-semibold",
            false: "opacity-70",
        },
        columns: {
            1: "grid-cols-1",
            2: "grid-cols-2",
            3: "grid-cols-3",
        },
    },
})

item({ active: true, columns: 2 })
```

### Default variants

`defaultVariants` provides values used when a call does not explicitly select a variant.

```ts
const button = cv({
    variants: {
        size: {
            sm: "h-8",
            md: "h-10",
        },
    },
    defaultVariants: {
        size: "md",
    },
})

button()
// "h-10"
```

Explicit props override defaults. Composed components also inherit defaults from their parents, with the nearest authored default taking precedence.

### Compound variants

`compoundVariants` adds classes when several selections match at the same time.

```ts
const button = cv({
    variants: {
        intent: {
            primary: "bg-black",
            secondary: "bg-white",
        },
        size: {
            sm: "h-8",
            md: "h-10",
        },
    },
    compoundVariants: [
        {
            intent: "primary",
            size: "md",
            class: "shadow-md",
        },
    ],
})
```

A compound selector can also match more than one value by using an array.

```ts
compoundVariants: [
    {
        intent: ["primary", "secondary"],
        size: "md",
        class: "font-semibold",
    },
]
```

Both `class` and `className` are understood by compound definitions.

### Runtime `class` and `className`

Every component accepts one runtime class override property. TypeScript intentionally models `class` and `className` as mutually exclusive inputs.

```ts
button({
    intent: "primary",
    className: "w-full",
})
```

The default `cv` pipeline uses `cx`, so these classes are appended without Tailwind conflict removal. To make runtime overrides conflict-aware, configure `cv` to use `cn`.

### Composition

Components can compose one component or a tuple of components through `composes`. Variants and defaults are merged into the resulting component and remain typed at the call site.

```ts
const tone = cv({
    variants: {
        tone: {
            neutral: "text-zinc-900",
            danger: "text-red-700",
        },
    },
    defaultVariants: {
        tone: "neutral",
    },
})

const size = cv({
    variants: {
        size: {
            sm: "text-sm",
            lg: "text-lg",
        },
    },
})

const heading = cv({
    composes: [tone, size],
    base: "font-semibold tracking-tight",
    defaultVariants: {
        size: "lg",
    },
})

heading({ tone: "danger", size: "sm" })
```

Composition can be nested. CVX-created components are internally composed as prepared programs, while compatible foreign callable components can still participate through the general composition path.

### Internal variants

Variant names beginning with `_` are treated as internal variants for public type extraction and schema introspection.

```ts
const component = cv({
    variants: {
        tone: {
            normal: "text-zinc-900",
            muted: "text-zinc-500",
        },
        _density: {
            compact: "gap-1",
            roomy: "gap-4",
        },
    },
    defaultVariants: {
        _density: "compact",
    },
})
```

The component itself can use `_density`, but `VariantProps<typeof component>` and `getSchema(component)` intentionally omit it. This is useful for implementation-level variant state that should not become part of a component's exported consumer contract.

### Extracting variant props

Use `VariantProps` to derive only the consumer-facing variant selection from a component.

```ts
import { cv, type VariantProps } from "@obvia/cv"

const button = cv({
    variants: {
        intent: {
            primary: "bg-black",
            secondary: "bg-white",
        },
        disabled: {
            true: "opacity-50",
            false: "",
        },
    },
})

type ButtonVariants = VariantProps<typeof button>
```

`VariantProps` removes `class`, `className`, and `_`-prefixed internal variants from the extracted public type.


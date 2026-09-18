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

### Configuring the runtime

`configure()` creates an isolated `{ cv, cx, cn }` set without mutating the default exports.

```ts
import { cn, configure } from "@obvia/cv"

const ui = configure({
    cx: cn,
    compileLimit: 1024,
})

ui.cv({
    base: "p-2 p-4",
})()
// "p-4"
```

The available options are:

- **`cx`** — class composer used internally by the configured `cv` and returned as the configured `cx`.
- **`cn`** — conflict-aware merger returned as the configured `cn`.
- **`compileLimit`** — maximum dense variant combination count that CVX may lazily compile for the configured engine. The default is `512`; set it to `0` to disable dense-table compilation.

`cx` and `cn` are independent. Replacing one does not implicitly replace the other.

### Dense variant compilation

The default engine can lazily compile bounded variant spaces into a dense lookup table. This is an implementation optimization and does not change component semantics.

```ts
const fast = configure({ compileLimit: 1024 }).cv
const general = configure({ compileLimit: 0 }).cv
```

`compileLimit` caps the number of possible combinations eligible for dense compilation. Configurations that exceed the limit, require unsupported lookup shapes, or use foreign composition automatically remain on the general evaluation path.

This option is primarily useful for benchmarking, diagnostics, or highly specialized runtimes; application code normally does not need to change it.

### Custom Tailwind merge configuration

Advanced Tailwind configuration lives under `@obvia/cv/config` so the default root bundle does not need to pull the configuration compiler into the normal import graph.

```ts
import { createCn } from "@obvia/cv/config"

const cn = createCn({
    extend: {
        classGroups: {
            "font-size": [
                {
                    text: ["hero", "tiny"],
                },
            ],
        },
    },
})

cn("text-sm", "text-hero")
// "text-hero"
```

Custom configuration is compiled lazily on first use and then reuses the compiled merge engine.

### `createCn`

`createCn()` creates a class-value-aware `cn` function with a custom merge configuration.

It accepts:

- a Tailwind-merge-style extension object,
- a function that receives the default configuration and returns a configuration,
- or a complete configuration object.

```ts
import { createCn } from "@obvia/cv/config"

const withDefaultConfig = createCn((config) => ({
    ...config,
    prefix: "tw-",
}))

const withLargerCache = createCn({
    cacheSize: 1000,
})
```

### Extending, overriding, prefixes, and cache size

Custom merge configuration supports `extend`, `override`, `prefix`, and `cacheSize`.

```ts
import { createCn } from "@obvia/cv/config"

const cn = createCn({
    prefix: "tw-",
    cacheSize: 1000,
    extend: {
        classGroups: {
            "font-size": [{ text: ["hero"] }],
        },
    },
})
```

Use `extend` to append to the default Tailwind model and `override` when a group should replace the default definition. `prefix` configures prefixed Tailwind utility recognition, while `cacheSize` controls the custom merge engine's result cache.

### `createTwMerge` and `extendTailwindMerge`

Use `createTwMerge()` when you specifically need the lower-level `twMerge`-compatible variadic API.

```ts
import {
    createTwMerge,
    extendTailwindMerge,
} from "@obvia/cv/config"

const merge = createTwMerge({
    extend: {
        classGroups: {
            "font-size": [{ text: ["hero"] }],
        },
    },
})

merge("text-sm", "text-hero")
```

`extendTailwindMerge` is an alias of `createTwMerge` for familiar migration semantics.

### Theme references and validators

`fromTheme()` and `validators` provide compiler-recognized markers for custom class-group definitions.

```ts
import {
    createCn,
    fromTheme,
    validators,
} from "@obvia/cv/config"

const cn = createCn({
    extend: {
        classGroups: {
            spacing: [{ gap: [fromTheme("spacing")] }],
            "font-size": [
                {
                    text: ["hero", validators.isArbitraryLength],
                },
            ],
        },
    },
})
```

Marker validators are preferred for custom groups because the merge compiler can convert them into its optimized internal representation.

### Configuration utilities

The config entry also exports `defaultConfig` and `mergeConfigs` for tooling or advanced configuration composition.

```ts
import {
    defaultConfig,
    mergeConfigs,
} from "@obvia/cv/config"

const config = mergeConfigs(defaultConfig(), {
    extend: {
        classGroups: {
            "font-size": [{ text: ["hero"] }],
        },
    },
})
```

These APIs are intended for advanced integration code. Most applications only need the root `cn` export or `createCn()`.

### Schema introspection

`@obvia/cv/schema` exposes a typed schema representation of public variants.

```ts
import { cv } from "@obvia/cv"
import { getSchema } from "@obvia/cv/schema"

const button = cv({
    variants: {
        size: {
            sm: "h-8",
            md: "h-10",
        },
        disabled: {
            true: "opacity-50",
            false: "",
        },
        _internal: {
            on: "internal-on",
            off: "internal-off",
        },
    },
    defaultVariants: {
        size: "md",
        disabled: false,
        _internal: "off",
    },
})

getSchema(button)
// {
//     size: { values: ["sm", "md"], defaultValue: "md" },
//     disabled: { values: [true, false], defaultValue: false },
// }
```

Schema values preserve boolean and numeric variant semantics rather than exposing every key as a string. Internal `_`-prefixed variants are excluded.

### Tailwind CSS v4 entry

The optional stylesheet entry can be imported when the package's Tailwind v4 custom variant is useful to the application.

```css
@import "@obvia/cv/tailwindcss";
```

This entry defines the `base` custom variant and is published as side-effectful CSS separately from the JavaScript API.

### Package entry points

CVX intentionally keeps the default import surface compact while advanced functionality lives behind subpath exports.

```ts
import { cn, cv, cx, configure, twJoin, twMerge } from "@obvia/cv"
import { createCn, createTwMerge } from "@obvia/cv/config"
import { getSchema } from "@obvia/cv/schema"
```

Available package entry points are:

- **`@obvia/cv`** — `cv`, `cx`, `cn`, `configure`, `twJoin`, `twMerge`, and public types.
- **`@obvia/cv/config`** — custom Tailwind merge configuration and configuration types.
- **`@obvia/cv/schema`** — typed variant schema introspection.
- **`@obvia/cv/tailwindcss`** — optional Tailwind CSS v4 stylesheet entry.

### ESM and CommonJS

The package publishes both ESM and CommonJS JavaScript builds together with generated TypeScript declarations and source maps. The package manager and verification workflow are Bun-first, while the distributed JavaScript entry points are not restricted to Bun-only consumption.

## Performance

The benchmark suite is built to produce comparable workload-level numbers rather than one blended marketing estimate. It uses Bun-based microbenchmarks and keeps class composition, defaults, explicit variants, rotating variants, compound-heavy definitions, stable Tailwind merging, and rotating Tailwind merging as separate scenarios.

The latest recorded local benchmark run measured:

| Workload | @obvia/cv | Equivalent baseline | Relative |
| --- | ---: | ---: | ---: |
| Class composition | **44.32 ns/op** | `class-variance-authority@0.7.1`: 68.89 ns/op | **1.55x faster** |
| Class composition | **44.32 ns/op** | `cva@1 beta`: 103.79 ns/op | **2.34x faster** |
| Defaults + compounds | **39.39 ns/op** | `class-variance-authority@0.7.1`: 978.98 ns/op | **24.85x faster** |
| Defaults + compounds | **39.39 ns/op** | `cva@1 beta`: 169.75 ns/op | **4.31x faster** |
| Explicit variants | **28.54 ns/op** | `class-variance-authority@0.7.1`: 1420.33 ns/op | **49.76x faster** |
| Explicit variants | **28.54 ns/op** | `cva@1 beta`: 267.36 ns/op | **9.37x faster** |
| Rotating variants | **47.34 ns/op** | `class-variance-authority@0.7.1`: 1234.81 ns/op | **26.08x faster** |
| Rotating variants | **47.34 ns/op** | `cva@1 beta`: 251.33 ns/op | **5.31x faster** |
| Compound-heavy | **27.84 ns/op** | `class-variance-authority@0.7.1`: 12875.12 ns/op | **462.54x faster** |
| Compound-heavy | **27.84 ns/op** | `cva@1 beta`: 1097.36 ns/op | **39.42x faster** |
| Tailwind merge: stable | **37.76 ns/op** | `clsx + tailwind-merge`: 166.18 ns/op | **4.40x faster** |
| Tailwind merge: rotating | **9.86 ns/op** | `clsx + tailwind-merge`: 137.59 ns/op | **13.96x faster** |

Variant comparisons use equivalent feature scenarios. `cn` is compared against `clsx + tailwind-merge` rather than a concatenation-only helper, and stable calls remain separate from rotating calls so cache-hot behavior is not presented as universal runtime performance.

The repository also maintains dedicated behavior, unit, property, guard, type, coverage, and deterministic performance regression suites. Run the full correctness suite with `bun run test`, include performance guards with `bun run test:all`, or execute the raw comparison benchmark with `bun run bench`.

> Performance varies by Bun version, CPU, operating system, workload shape, cache state, and authored configuration. These are measured reference results, not duration or speedup guarantees. Run `bun run bench` to reproduce the comparison on your own machine or CI runner.

## Contributing

The **CVX** project welcomes contributions from the community.

Whether you want to report a bug, suggest a new feature, improve the
documentation, strengthen tests, optimize a hot path, or submit code changes, your contributions are greatly appreciated.

You can find detailed information about the contribution process by visiting the link below.

- **[Contributing Guide](contributing.md)**

## Security

The **CVX** project takes security vulnerabilities seriously.

If you believe you have discovered a security vulnerability, please report it
responsibly by contacting **Selçuk Çukur** at **<hello@selcukcukur.me>**.

Please do not disclose security vulnerabilities publicly until they have been
reviewed and addressed.

You can find detailed information about the security policy by visiting the link below.

- **[Security Policy](security.md)**

## License

The **CVX** project is published as open source software under the **[MIT License](license.md)**,
which is one of the most widely used open source licenses.

The project also includes code and behavior derived from or informed by third-party open source projects. Attribution and license details are available in the included notice files.

- **[MIT License](license.md)**
- **[Notice](NOTICE.md)**
- **[Third-Party Notices](THIRD_PARTY_NOTICES.md)**

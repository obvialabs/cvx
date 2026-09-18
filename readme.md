<div align="center">

[![Version](https://img.shields.io/npm/v/@obvia/cvx?style=for-the-badge\&logo=npm\&labelColor=ff2949\&color=e93146\&logoColor=white\&label=Version)](https://www.npmjs.com/package/@obvia/cvx)
[![TypeScript](https://img.shields.io/static/v1?message=TypeScript\&style=for-the-badge\&logo=typescript\&labelColor=1886c9\&color=0A66C2\&logoColor=white\&label=Language)](https://www.typescriptlang.org/)
[![Benchmarks](https://img.shields.io/github/actions/workflow/status/obvialabs/cvx/benchmark.yml?style=for-the-badge\&logo=githubactions\&labelColor=161717\&color=0f0f0f\&logoColor=white\&label=Benchmarks)](https://github.com/obvialabs/cvx/actions/workflows/benchmark.yml)
[![License](https://img.shields.io/static/v1?message=MIT\&style=for-the-badge\&logo=opensourceinitiative\&labelColor=25D366\&color=20bd5b\&logoColor=white\&label=License)](license.md)

</div>

> Class composition, variants, and Tailwind conflict resolution — 34× faster across 144K+ real-world calls.

Welcome to **cvx** — a focused toolkit for building and resolving class names without spreading class composition, variant 
logic, and Tailwind conflict handling across different libraries. 

* **Class composition** → Compose strings, arrays, objects, and conditional class values with `cx`
* **Typed variants** → Define defaults, compounds, composition, and inferred variant props with `cv`
* **Tailwind resolution** → Compose classes and resolve conflicting Tailwind utilities with `cn`
* **Behavioral compatibility** → Preserve the expected semantics of `clsx`, CVA, and `tailwind-merge` where their feature surfaces overlap
* **Performance-focused** → Optimized hot paths backed by synthetic benchmarks and real repository corpus testing

**cvx** is designed to stay focused rather than grow into a 
general-purpose utility library. Each API has a clear responsibility, while the internals are optimized around correctness, 
compatibility, and fast repeated execution.

## Installation

Install **cvx** as a single package.

```bash
bun add @obvia/cvx
```

It has **zero runtime dependencies** and exposes one public package entrypoint.

## Quick start

Create variants with `cv`, resolve Tailwind conflicts with `cn`, and compose ordinary class values with `cx`.

```ts
import { cn, cv, cx, type VariantProps } from "@obvia/cvx"

const button = cv({
    // Applied to every resolved state
    base: "inline-flex items-center rounded-md font-medium",

    // Variant props are inferred directly from these keys
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

    // Used when a variant prop is omitted
    defaults: {
        intent: "primary",
        size: "md",
        disabled: false,
    },
})

// Derive the public variant contract
type ButtonVariants = VariantProps<typeof button>

// Resolve one component state
button({
    intent: "secondary",
    size: "lg",
})

// Resolve Tailwind conflicts
cn("px-2", "px-4")
// "px-4"

// Compose conditional class values without conflict removal
cx("button", true && "active", {
    disabled: false,
})
// "button active"
```

## Usage

Each API has a distinct responsibility. They can be used independently or together depending on how much class-processing behavior a component requires.

### Variants with `cv`

The `cv` function creates a reusable class resolver from a declarative variant definition.

A component can define base classes, variant axes, defaults, compound conditions, composition, and runtime overrides while keeping its public variant contract inferred by TypeScript.

#### Base classes

Use `base` for classes that should be included in every resolved state.

```ts
import { cv } from "@obvia/cvx"

const button = cv({
    // Always emitted before variant and compound classes
    base: "inline-flex items-center rounded-md font-medium",
})

button()
// "inline-flex items-center rounded-md font-medium"
```

`base` accepts the same class-value shapes used throughout **cvx**, so it can also contain arrays or conditional dictionaries.

```ts
const button = cv({
    // Class values are normalized when the component is prepared
    base: [
        "inline-flex items-center",
        "rounded-md",
        {
            "select-none": true,
        },
    ],
})

button()
// "inline-flex items-center rounded-md select-none"
```

#### Variant definitions

Use `variants` to define named variant axes and the classes emitted by each possible value.

```ts
const button = cv({
    base: "inline-flex items-center rounded-md",

    variants: {
        // `intent` becomes a typed runtime prop
        intent: {
            primary: "bg-blue-600 text-white",
            secondary: "bg-white text-slate-900",
            danger: "bg-red-600 text-white",
        },

        // `size` becomes another independent variant prop
        size: {
            sm: "h-8 px-3 text-sm",
            md: "h-10 px-4",
            lg: "h-12 px-6 text-lg",
        },
    },
})

button({
    intent: "primary",
    size: "sm",
})
// "inline-flex items-center rounded-md bg-blue-600 text-white h-8 px-3 text-sm"
```

Variant values are inferred directly from the authored definition.

```ts
button({
    // ✓ "primary" | "secondary" | "danger"
    intent: "danger",

    // ✓ "sm" | "md" | "lg"
    size: "lg",
})
```

Invalid authored values are rejected by TypeScript.

```ts
button({
    // TypeScript error: "ghost" is not part of the intent variant
    intent: "ghost",
})
```

#### Default variants

Use `defaults` to select values when variant props are omitted.

```ts
const badge = cv({
    variants: {
        tone: {
            neutral: "bg-slate-100 text-slate-900",
            success: "bg-green-100 text-green-900",
        },

        size: {
            sm: "px-2 py-0.5 text-xs",
            md: "px-2.5 py-1 text-sm",
        },
    },

    defaults: {
        // Used whenever `tone` is not provided
        tone: "neutral",

        // Used whenever `size` is not provided
        size: "md",
    },
})

badge()
// "bg-slate-100 text-slate-900 px-2.5 py-1 text-sm"

badge({
    // Only the explicitly provided axis changes
    tone: "success",
})
// "bg-green-100 text-green-900 px-2.5 py-1 text-sm"
```

At runtime, missing-like `undefined`, `null`, and empty selections fall back to the configured default.

An explicit unknown value does not silently fall back to that default. The invalid axis simply emits no variant class while other valid axes continue resolving normally.

```ts
const component = cv({
    base: "base",

    variants: {
        tone: {
            soft: "tone-soft",
            hard: "tone-hard",
        },

        size: {
            sm: "size-sm",
            lg: "size-lg",
        },
    },

    defaults: {
        tone: "soft",
        size: "sm",
    },
})

// Dynamic or untyped data can still reach the runtime.
// The unknown `tone` value does not replace itself with "soft".
component({
    tone: "unknown" as "soft",
    size: "lg",
})
// "base size-lg"
```

#### Boolean variants

Variant keys authored as `true` and `false` are exposed as booleans at runtime.

```ts
const control = cv({
    variants: {
        disabled: {
            // Runtime value: true
            true: "cursor-not-allowed opacity-50",

            // Runtime value: false
            false: "cursor-pointer opacity-100",
        },
    },

    defaults: {
        // The runtime API uses a boolean rather than the string "false"
        disabled: false,
    },
})

control({
    disabled: true,
})
// "cursor-not-allowed opacity-50"

control({
    disabled: false,
})
// "cursor-pointer opacity-100"
```

This keeps boolean variants ergonomic without requiring string values at call sites.

#### Numeric variants

Numeric keys can be selected with numeric runtime values.

```ts
const surface = cv({
    variants: {
        elevation: {
            // Runtime value: 0
            0: "shadow-none",

            // Runtime value: 1
            1: "shadow-sm",

            // Runtime value: 2
            2: "shadow-md",
        },
    },

    defaults: {
        elevation: 0,
    },
})

surface({
    elevation: 2,
})
// "shadow-md"
```

Boolean and numeric variants can be mixed with ordinary string variants in the same component.

#### Compound variants

Use `compounds` when a class should be emitted only when several resolved variant selections match together.

```ts
const button = cv({
    variants: {
        intent: {
            primary: "bg-blue-600",
            danger: "bg-red-600",
        },

        size: {
            sm: "h-8 px-3",
            lg: "h-11 px-5",
        },
    },

    compounds: [
        {
            // This class is emitted only when both selectors match
            intent: "danger",
            size: "lg",
            class: "font-semibold ring-2 ring-red-300",
        },
    ],
})

button({
    intent: "danger",
    size: "lg",
})
// "bg-red-600 h-11 px-5 font-semibold ring-2 ring-red-300"

button({
    intent: "danger",
    size: "sm",
})
// "bg-red-600 h-8 px-3"
```

Every selector in a compound rule must match before the rule is emitted.

#### Multiple compound values

A compound selector can accept an array when the same rule should match several values.

```ts
const button = cv({
    variants: {
        intent: {
            primary: "bg-blue-600",
            secondary: "bg-slate-100",
            danger: "bg-red-600",
        },

        size: {
            sm: "h-8",
            md: "h-10",
            lg: "h-12",
        },
    },

    compounds: [
        {
            // Match either primary or danger
            intent: ["primary", "danger"],

            // But only when size is small
            size: "sm",

            class: "text-xs font-semibold",
        },
    ],
})

button({
    intent: "primary",
    size: "sm",
})
// "bg-blue-600 h-8 text-xs font-semibold"

button({
    intent: "danger",
    size: "sm",
})
// "bg-red-600 h-8 text-xs font-semibold"
```

Arrays can be used on more than one selector to describe a larger matching matrix without duplicating rules.

```ts
const item = cv({
    variants: {
        tone: {
            neutral: "tone-neutral",
            success: "tone-success",
            danger: "tone-danger",
        },

        size: {
            sm: "size-sm",
            md: "size-md",
            lg: "size-lg",
        },
    },

    compounds: [
        {
            // Any tone in this list...
            tone: ["success", "danger"],

            // ...combined with any size in this list matches
            size: ["sm", "md"],

            class: "font-medium",
        },
    ],
})
```

#### Runtime class overrides

Every resolver accepts a final `class` or `className` value.

```ts
const button = cv({
    base: "inline-flex rounded-md",

    variants: {
        intent: {
            primary: "bg-blue-600 text-white",
            secondary: "bg-white text-slate-900",
        },
    },
})

button({
    intent: "primary",

    // Appended after the resolved component classes
    class: "w-full justify-center",
})
// "inline-flex rounded-md bg-blue-600 text-white w-full justify-center"
```

`className` provides the equivalent API for environments where that naming is preferred.

```ts
button({
    intent: "secondary",

    // Equivalent runtime override using `className`
    className: "shadow-sm",
})
```

`class` and `className` are mutually exclusive in the inferred TypeScript contract, preventing ambiguous double overrides.

```ts
button({
    // Use one or the other
    class: "w-full",

    // TypeScript rejects supplying both together
    className: "shadow-sm",
})
```

Runtime overrides affect only the final emitted classes. They do not change variant selection or compound matching.

#### Component composition

Use `composes` to combine existing `cv` components while inheriting their variants and defaults.

```ts
const tone = cv({
    base: "transition-colors",

    variants: {
        intent: {
            primary: "bg-blue-600 text-white",
            danger: "bg-red-600 text-white",
        },
    },

    defaults: {
        intent: "primary",
    },
})

const size = cv({
    variants: {
        size: {
            sm: "h-8 px-3",
            md: "h-10 px-4",
        },
    },

    defaults: {
        size: "sm",
    },
})

const button = cv({
    // Both components contribute their classes, variants, and defaults
    composes: [tone, size],

    // Local classes are emitted after composed component output
    base: "inline-flex items-center rounded-md",
})

button()
// "transition-colors bg-blue-600 text-white h-8 px-3 inline-flex items-center rounded-md"

button({
    // Both inherited variant props remain available
    intent: "danger",
    size: "md",
})
```

A single component can be passed directly without wrapping it in an array.

```ts
const action = cv({
    // Single-component composition is supported
    composes: button,

    base: "font-semibold",
})
```

#### Overriding inherited defaults

A composed component can retune defaults inherited from its parents.

```ts
const button = cv({
    composes: [tone, size],

    base: "inline-flex items-center rounded-md",

    defaults: {
        // Override the default inherited from `tone`
        intent: "danger",

        // Override the default inherited from `size`
        size: "md",
    },
})

button()
// Resolves with intent="danger" and size="md"
```

Local defaults take precedence over inherited defaults without removing the inherited variant definitions.

#### Compounds over composed variants

Compound rules can target variants inherited through composition.

```ts
const button = cv({
    composes: [tone, size],

    base: "inline-flex items-center",

    defaults: {
        intent: "danger",
        size: "md",
    },

    compounds: [
        {
            // Both selectors come from composed components
            intent: "danger",
            size: "md",
            class: "ring-2 ring-red-300",
        },
    ],
})

button()
// Includes the compound because the inherited variants resolve to danger + md
```

This allows composition to behave as one effective variant surface instead of several disconnected resolvers.

#### Nested composition

Composition can be nested without losing inherited variant types or defaults.

```ts
const base = cv({
    base: "base",

    variants: {
        tone: {
            soft: "bg-slate-100",
            strong: "bg-slate-900 text-white",
        },
    },

    defaults: {
        tone: "soft",
    },
})

const panel = cv({
    // Inherits `tone` from base
    composes: base,

    base: "rounded-lg",
})

const dialog = cv({
    // `tone` is still available through the nested composition chain
    composes: panel,

    base: "shadow-xl",

    defaults: {
        // Retune the inherited default at the outermost level
        tone: "strong",
    },
})

dialog()
// "base bg-slate-900 text-white rounded-lg shadow-xl"

dialog({
    tone: "soft",
})
// "base bg-slate-100 rounded-lg shadow-xl"
```

Composition is resolved in authored order, followed by the local component and its final runtime override.

#### Configuration snapshots

A `cv` component snapshots its authored runtime configuration when it is created.

Later mutations to the original object do not change the component's behavior.

```ts
const config = {
    base: "before",

    variants: {
        tone: {
            soft: "tone-soft",
        },
    },

    defaults: {
        tone: "soft",
    },
}

const component = cv(config)

// Mutating the authored object afterwards does not rewrite the component
config.base = "after"
config.variants.tone.soft = "changed"

component()
// "before tone-soft"
```

This keeps prepared components deterministic after creation.

#### Prepared configuration

Every `cv` component exposes its effective prepared configuration through `config`.

```ts
const button = cv({
    variants: {
        size: {
            sm: "h-8",
            md: "h-10",
        },
    },

    defaults: {
        size: "md",
    },
})

// Effective variant metadata retained by the component
button.config.variants

// Effective defaults retained by the component
button.config.defaults
```

This metadata is primarily used to preserve type information and composition behavior between `cv` components.

### Variant types with `VariantProps`

Use `VariantProps` to extract the public variant contract from a resolver created with `cv`.

```ts
import {
    cv,
    type VariantProps,
} from "@obvia/cvx"

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

        disabled: {
            true: "opacity-50",
            false: "opacity-100",
        },
    },

    defaults: {
        intent: "primary",
        disabled: false,
    },
})

// Extract only the public variant selections
type ButtonVariants = VariantProps<typeof button>
```

The inferred type is equivalent to:

```ts
type ButtonVariants = {
    intent?: "primary" | "secondary"
    size?: "sm" | "md"
    disabled?: boolean
}
```

Runtime `class`, `className`, and internal variant metadata are excluded from `VariantProps`.

This makes the type suitable for component props without duplicating the variant contract.

```ts
type ButtonProps = ButtonVariants & {
    children: React.ReactNode
}
```

### Tailwind conflict resolution with `cn`

The `cn` function combines ordinary class composition with Tailwind-aware conflict resolution.

Inputs are normalized first, then conflicting Tailwind utilities are resolved while unrelated and unknown classes are preserved.

#### Basic conflicts

When two recognized utilities belong to the same Tailwind conflict group, the later applicable utility wins.

```ts
import { cn } from "@obvia/cvx"

cn(
    "px-2",
    "px-4",
)
// "px-4"
```

Multiple independent groups are resolved separately.

```ts
cn(
    "px-2",
    "py-1",
    "text-sm",
    "px-4",
    "text-lg",
)
// "py-1 px-4 text-lg"
```

#### Conditional class values

`cn` accepts the same class-value shapes as `cx`.

```ts
cn(
    // Plain strings
    "flex items-center",

    // Conditional expressions
    active && "font-medium",

    // Nested arrays
    [
        "px-2",
        compact && "py-1",
    ],

    // Conditional dictionaries
    {
        "opacity-50": disabled,
        "cursor-pointer": !disabled,
    },

    // This conflicts with the earlier px-2
    "px-4",
)
```

Composition happens before Tailwind conflict resolution.

#### Modifier scopes

Tailwind conflicts are resolved only inside the relevant modifier scope.

```ts
cn(
    // Base scope
    "p-2",

    // Hover scope
    "hover:p-2",
    "hover:p-4",

    // Focus scope
    "focus:p-6",

    // Responsive scope
    "md:p-8",
)
// "p-2 hover:p-4 focus:p-6 md:p-8"
```

A base utility does not remove a responsive or state-specific utility simply because they share the same underlying class group.

#### Stacked modifiers

Stacked modifier combinations follow Tailwind merge semantics.

```ts
cn(
    // Both represent the same effective modifier scope
    "md:hover:p-2",
    "hover:md:p-4",
)
// "hover:md:p-4"
```

This applies to responsive, state, data, and other supported modifier combinations.

#### Arbitrary values

Arbitrary Tailwind values participate in normal conflict resolution.

```ts
cn(
    // Both belong to the width group
    "w-[10px]",
    "w-[calc(100%-2rem)]",
)
// "w-[calc(100%-2rem)]"
```

Typed arbitrary values are resolved according to their Tailwind group.

```ts
cn(
    "text-[length:12px]",
    "text-lg",
)
```

#### Arbitrary properties

Arbitrary CSS properties conflict with later values for the same property.

```ts
cn(
    "[color:red]",
    "[color:blue]",
)
// "[color:blue]"
```

Different arbitrary properties remain independent.

```ts
cn(
    "[color:red]",
    "[mask-type:luminance]",
)
```

#### Arbitrary and data modifiers

Arbitrary modifiers retain their own conflict scope.

```ts
cn(
    "data-[state=open]:p-2",
    "data-[state=open]:p-4",
    "data-[state=closed]:p-6",
)
// "data-[state=open]:p-4 data-[state=closed]:p-6"
```

Only utilities under the same modifier scope are compared as conflicts.

#### Important utilities

Important utilities follow the same conflict rules within their matching scope.

```ts
cn(
    "!p-2",
    "!p-8",
    "p-4",
)
// "!p-8 p-4"
```

Important and non-important utilities are not collapsed into one another when their effective conflict semantics differ.

#### Slash modifiers

Utilities that use slash modifiers are parsed as part of Tailwind conflict resolution.

```ts
cn(
    "text-lg/6",
    "text-sm/7",
)
// "text-sm/7"
```

#### Logical and physical utilities

Logical and physical spacing relationships follow Tailwind merge behavior.

```ts
cn(
    "ps-2",
    "pe-2",

    // The later physical x-axis utility replaces the applicable logical values
    "px-4",
)
```

The same behavior applies to supported margin and scroll-spacing relationships.

#### Animation utilities

Built-in Tailwind animation utilities resolve according to their known animation group.

```ts
cn(
    "animate-spin",
    "animate-pulse",
)
// "animate-pulse"
```

Unknown or custom animation names are not incorrectly collapsed just because they begin with `animate-`.

```ts
cn(
    // Custom animation utilities are preserved when Tailwind does not
    // classify them as members of the same known conflict group
    "animate-fade-out",
    "animate-slide-out-down",
)
```

This distinction is important for ecosystems that build additional animation utilities on top of Tailwind.

#### Unknown and custom classes

Classes that are not recognized as conflicting Tailwind utilities are preserved.

```ts
cn(
    // Application-specific classes remain untouched
    "component-root",
    "plugin:state",

    // Known Tailwind utilities still resolve normally
    "p-2",
    "p-4",
)
// "component-root plugin:state p-4"
```

`cn` therefore does not treat every class-like token as a Tailwind utility.

#### When to use `cn`

Use `cn` when both of these behaviors are required:

```ts
// 1. Compose conditional class values
// 2. Resolve Tailwind conflicts in the resulting class string
cn(
    "button px-2",
    active && "button-active",
    large && "px-6",
)
```

If conflict resolution is not wanted, use `cx` instead.

### Class composition with `cx`

The `cx` function normalizes and combines class values without interpreting them as Tailwind utilities.

It is the lowest-level composition API exposed by **cvx**.

#### Strings

Plain strings are appended in authored order.

```ts
import { cx } from "@obvia/cvx"

cx(
    "button",
    "rounded-md",
    "font-medium",
)
// "button rounded-md font-medium"
```

#### Conditional values

Falsy conditional expressions are ignored.

```ts
cx(
    "button",

    // Included only when active is truthy
    active && "button-active",

    // Included only when disabled is truthy
    disabled && "button-disabled",
)
```

The boolean sentinel `true` itself is not emitted as a class.

```ts
cx(
    "button",
    true,
)
// "button"
```

#### Arrays

Arrays are flattened recursively while preserving their original order.

```ts
cx(
    "button",

    [
        "rounded-md",

        // Nested arrays can be arbitrarily deep
        [
            active && "button-active",
            [
                compact && "button-compact",
            ],
        ],
    ],
)
```

No temporary flattened array is required at the API level.

#### Objects

Object keys are emitted when their corresponding values are truthy.

```ts
cx({
    // Included
    "font-medium": true,

    // Included only when disabled is truthy
    "opacity-50": disabled,

    // Omitted
    "pointer-events-none": false,
})
```

Only the object's own enumerable properties are considered.

Inherited properties are ignored.

```ts
const inherited = {
    inherited: true,
}

const classes = Object.create(inherited)
classes.own = true

cx(classes)
// "own"
```

#### Numbers

Numeric class values are supported and converted to strings.

```ts
cx(
    "item",
    1,
    2,
)
// "item 1 2"
```

This preserves compatibility with established class-composition behavior.

#### Falsy values

Falsy values are omitted from the result.

```ts
cx(
    "button",
    false,
    null,
    undefined,
    0,
    "",
)
// "button"
```

`bigint` values are also ignored to preserve `clsx` runtime parity.

#### Ordering

`cx` preserves authored class order.

```ts
cx(
    "first",
    ["second", "third"],
    {
        fourth: true,
    },
)
// "first second third fourth"
```

Repeated evaluation of the same values remains deterministic.

#### No Tailwind conflict resolution

`cx` never removes classes simply because Tailwind would consider them conflicting.

```ts
cx(
    "px-2",
    "px-4",
)
// "px-2 px-4"
```

This is the fundamental difference between `cx` and `cn`.

```ts
// Composition only
cx("px-2", "px-4")
// "px-2 px-4"

// Composition + Tailwind conflict resolution
cn("px-2", "px-4")
// "px-4"
```

### Choosing an API

Use `cv` when class output depends on a reusable typed component state.

```ts
// Reusable typed variants
const button = cv({
    variants: {
        size: {
            sm: "h-8",
            md: "h-10",
        },
    },
})
```

Use `cn` when class values are composed dynamically and Tailwind conflicts should be resolved.

```ts
// Dynamic classes + Tailwind conflict resolution
cn(
    "px-2",
    large && "px-6",
)
```

Use `cx` when values should only be composed and preserved as authored.

```ts
// Dynamic classes without Tailwind interpretation
cx(
    "px-2",
    large && "px-6",
)
```

The three APIs are intentionally separate so class composition, variant resolution, and Tailwind conflict handling can be used independently instead of forcing every call through the same abstraction.

## Performance

The **cvx** project is designed with performance as a first-class concern across class composition, variant
resolution, and Tailwind conflict handling.

| Scenario                            | Baseline                      |  Baseline |       CVX |    Relative |
| ----------------------------------- | ----------------------------- | --------: | --------: | ----------: |
| `cx` flat composition               | `clsx`                        |  18.86 ns |  24.46 ns |       0.77× |
| `cx` nested + conditional           | `clsx`                        | 170.75 ns | 126.70 ns |   **1.35×** |
| `cv` hot explicit variants          | `cva` 1.0 beta                | 264.49 ns |  39.05 ns |   **6.77×** |
| `cv` · 64 compound rules            | `cva` 1.0 beta                |   4.02 µs |  34.66 ns | **115.96×** |
| `cv` creation + first call          | `cva` 1.0 beta                |   1.43 µs |   1.54 µs |       0.93× |
| `cn` · 32-entry working set         | `clsx + tailwind-merge`       | 163.94 ns |  20.50 ns |   **8.00×** |
| `cn` · arbitrary values + modifiers | `clsx + tailwind-merge`       | 199.83 ns |  19.35 ns |  **10.33×** |
| `cv + cn` end-to-end                | `cva + clsx + tailwind-merge` | 693.14 ns |  88.25 ns |   **7.85×** |

`cv` performs more work while preparing a component so that repeated resolutions can use a significantly 
cheaper hot path. For this reason, short-lived component creation and repeated component resolution are 
measured separately.

Synthetic benchmarks are complemented by a corpus benchmark that replays every captured `cn()` call from
**58 open source repositories**, covering **144,265 calls** in total.

You can find the latest benchmark results and complete per-repository measurements by visiting the link 
below.

* **[Benchmark Workflow](https://github.com/obvialabs/cvx/actions/workflows/benchmark.yml)**

## Contributing

The **cvx** project welcomes contributions from the community.

Whether you want to report a bug, suggest a new feature, improve the
documentation, or submit code changes, your contributions are greatly appreciated.

You can find detailed information about the contribution process by visiting the link below.

* **[Contributing Guide](contributing.md)**

## Security

The **cvx** project takes security vulnerabilities seriously.

If you believe you have discovered a security vulnerability, please report it
responsibly by contacting **Selçuk Çukur** at **[hello@selcukcukur.me](mailto:hello@selcukcukur.me)**.

Please do not disclose security vulnerabilities publicly until they have been
reviewed and addressed.

You can find detailed information about the security policy by visiting the link below.

* **[Security Policy](security.md)**

## License

The **cvx** project is published as open source software under the **[MIT License](license.md)**,
which is one of the most widely used open source licenses.

You can find detailed information about the license terms by visiting the link below.

* **[MIT License](license.md)**

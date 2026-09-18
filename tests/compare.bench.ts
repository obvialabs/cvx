import { cva as legacyCva } from "class-variance-authority"
import { clsx } from "clsx"
import { cva as betaCva } from "cva"
import { twMerge } from "tailwind-merge"

import { cn, cv, cx } from "../src"
import {
  rotatingVariantProps,
  standardBetaCvConfig,
  standardCompounds,
  standardCvConfig,
  standardDefaults,
  standardVariants,
} from "./fixtures"
import {
  createRotatingOperation,
  formatBenchmarkReport,
  runBenchmarks,
  type BenchmarkCase,
} from "./utility/benchmark"
import {
  formatCorpusReplayReport,
  runCorpusReplayBenchmarks,
} from "./utility/corpus"

const legacyReference = legacyCva as (base: any, options?: any) => any
const betaReference = betaCva as (config: any) => any

const legacyOptions = {
  variants: standardVariants,
  defaultVariants: standardDefaults,
  compoundVariants: standardCompounds,
}

const legacyComponent = legacyReference(
  standardCvConfig.base,
  legacyOptions,
)
const betaComponent = betaReference(standardBetaCvConfig)
const currentComponent = cv(standardCvConfig)

/**
 * Build a deterministic compound collection for scaling benchmarks
 *
 * **Parameters**
 * - `count` – Number of compound rules to generate
 *
 * **Returns**
 * - `object[]` – Compound rules shared by equivalent CV implementations
 */
const createCompounds = (
  count: number,
): {
  intent: "danger" | readonly ["danger", "primary"]
  size: "md" | readonly ["sm", "md", "lg"]
  disabled: false | readonly [true, false]
  className: string
}[] =>
  Array.from({ length: count }, (_, index) => ({
    intent:
      index % 3 === 0
        ? (["danger", "primary"] as const)
        : "danger",
    size:
      index % 2 === 0
        ? "md"
        : (["sm", "md", "lg"] as const),
    disabled:
      index % 4 === 0
        ? ([true, false] as const)
        : false,
    className: `compound-${index}`,
  }))

/**
 * Create equivalent legacy, beta, and CVX components for one compound count
 *
 * **Parameters**
 * - `count` – Number of compound rules included in each component
 *
 * **Returns**
 * - `object` – Equivalent component resolvers for all compared implementations
 */
const createCompoundComponents = (
  count: number,
) => {
  const compounds = createCompounds(count)

  return {
    legacy: legacyReference(
      standardCvConfig.base,
      {
        variants: standardVariants,
        defaultVariants: standardDefaults,
        compoundVariants: compounds,
      },
    ),
    beta: betaReference({
      base: standardCvConfig.base,
      variants: standardVariants,
      defaultVariants: standardDefaults,
      compoundVariants: compounds,
    }),
    current: cv({
      base: standardCvConfig.base,
      variants: standardVariants,
      defaults: standardDefaults,
      compounds: compounds as any,
    }),
  }
}

const compounds4 = createCompoundComponents(4)
const compounds16 = createCompoundComponents(16)
const compounds64 = createCompoundComponents(64)

const explicitProps = {
  intent: "danger",
  size: "md",
  disabled: true,
} as const

const compoundProps = {
  intent: "danger",
  size: "md",
  disabled: false,
} as const

const nestedClassInput = [
  "button",
  ["inline-flex", ["items-center", { active: true, disabled: false }]],
  2,
  null,
  undefined,
] as const

const stableMergeInput = [
  "inline-flex items-center rounded-md p-2 text-sm",
  "p-4",
  { "text-lg": true },
] as const

const mergeWorkingSet = Array.from(
  { length: 32 },
  (_, index) => [
    `w-[${index + 10}px] p-2 text-sm bg-red-500`,
    `w-[${index + 20}px] p-4 text-lg`,
  ] as const,
)

// Exceed both current and previous result-cache generations so this stream
// measures parsing/conflict work instead of a tiny repeated-cache workload.
const mergeCacheHostileSet = Array.from(
  { length: 32_768 },
  (_, index) => [
    `w-[${index + 1}px] p-2 text-sm hover:px-2`,
    `w-[${index + 2}px] p-4 text-lg hover:px-4`,
  ] as const,
)

const modifierMergeSet = Array.from(
  { length: 128 },
  (_, index) => [
    `md:hover:w-[${index + 10}px] md:text-sm focus:p-2`,
    `md:hover:w-[${index + 20}px] md:text-xl focus:p-6`,
  ] as const,
)

const endToEndProps = rotatingVariantProps.map((props, index) => ({
  props,
  override: `p-${(index + 1) * 2} text-xl`,
}))

/**
 * Create one CV benchmark case with legacy, beta, and CVX candidates
 *
 * **Parameters**
 * - `name` – Workload name
 * - `legacy` – Legacy CVA operation
 * - `beta` – CVA v1 beta operation
 * - `current` – CVX operation
 * - `note` – Optional workload methodology note
 *
 * **Returns**
 * - `BenchmarkCase` – Comparable CV workload consumed by the benchmark harness
 */
const cvCase = (
  name: string,
  legacy: () => unknown,
  beta: () => unknown,
  current: () => unknown,
  note?: string,
): BenchmarkCase => ({
  group: "cv",
  name,
  note,
  candidates: [
    {
      name: "class-variance-authority 0.7",
      run: legacy,
    },
    {
      name: "cva 1.0 beta",
      run: beta,
    },
    {
      name: "@obvia/cvx cv",
      run: current,
      current: true,
    },
  ],
})

/**
 * Create one Tailwind-aware merge benchmark case
 *
 * **Parameters**
 * - `name` – Workload name
 * - `baseline` – Equivalent `clsx + tailwind-merge` operation
 * - `current` – Equivalent CVX `cn` operation
 * - `note` – Optional workload methodology note
 *
 * **Returns**
 * - `BenchmarkCase` – Comparable CN workload consumed by the benchmark harness
 */
const cnCase = (
  name: string,
  baseline: () => unknown,
  current: () => unknown,
  note?: string,
): BenchmarkCase => ({
  group: "cn",
  name,
  note,
  candidates: [
    {
      name: "clsx + tailwind-merge",
      run: baseline,
    },
    {
      name: "@obvia/cvx cn",
      run: current,
      current: true,
    },
  ],
})

const benchmarks: BenchmarkCase[] = [
  {
    group: "cx",
    name: "flat class composition",
    candidates: [
      {
        name: "clsx",
        run: () => clsx("button", "active", "px-4"),
      },
      {
        name: "@obvia/cvx cx",
        run: () => cx("button", "active", "px-4"),
        current: true,
      },
    ],
  },
  {
    group: "cx",
    name: "nested and conditional composition",
    candidates: [
      {
        name: "clsx",
        run: () => clsx(...nestedClassInput),
      },
      {
        name: "@obvia/cvx cx",
        run: () => cx(...nestedClassInput),
        current: true,
      },
    ],
  },
  cvCase(
    "hot defaults + compounds",
    () => legacyComponent({}),
    () => betaComponent({}),
    () => currentComponent({}),
    "components are created before measurement; this isolates repeated resolver cost",
  ),
  cvCase(
    "hot explicit variants",
    () => legacyComponent(explicitProps),
    () => betaComponent(explicitProps),
    () => currentComponent(explicitProps),
  ),
  cvCase(
    "rotating variants",
    createRotatingOperation(rotatingVariantProps, (props) => legacyComponent(props)),
    createRotatingOperation(rotatingVariantProps, (props) => betaComponent(props)),
    createRotatingOperation(rotatingVariantProps, (props) => currentComponent(props)),
    "independent cursors rotate through the same prop corpus for every implementation",
  ),
  cvCase(
    "compound scaling · 4 rules",
    () => compounds4.legacy(compoundProps),
    () => compounds4.beta(compoundProps),
    () => compounds4.current(compoundProps),
  ),
  cvCase(
    "compound scaling · 16 rules",
    () => compounds16.legacy(compoundProps),
    () => compounds16.beta(compoundProps),
    () => compounds16.current(compoundProps),
  ),
  cvCase(
    "compound scaling · 64 rules",
    () => compounds64.legacy(compoundProps),
    () => compounds64.beta(compoundProps),
    () => compounds64.current(compoundProps),
  ),
  cvCase(
    "component creation",
    () => legacyReference(standardCvConfig.base, legacyOptions),
    () => betaReference(standardBetaCvConfig),
    () => cv(standardCvConfig),
    "measures repeated factory cost after runtime/JIT warmup; each operation creates a fresh component",
  ),
  cvCase(
    "creation + first call",
    () => legacyReference(standardCvConfig.base, legacyOptions)(explicitProps),
    () => betaReference(standardBetaCvConfig)(explicitProps),
    () => cv(standardCvConfig)(explicitProps),
    "captures short-lived component use where preparation cost cannot be amortized across hot calls",
  ),
  cnCase(
    "stable cache-hit composition",
    () => twMerge(clsx(...stableMergeInput)),
    () => cn(...stableMergeInput),
    "stable input identities intentionally measure each library's warmed public cache path",
  ),
  cnCase(
    "32-entry working set",
    createRotatingOperation(
      mergeWorkingSet,
      ([left, right]) => twMerge(clsx(left, right)),
    ),
    createRotatingOperation(
      mergeWorkingSet,
      ([left, right]) => cn(left, right),
    ),
    "small repeated corpus exercises realistic component-level cache locality without a single-value loop",
  ),
  cnCase(
    "cache-hostile 32K working set",
    createRotatingOperation(
      mergeCacheHostileSet,
      ([left, right]) => twMerge(clsx(left, right)),
    ),
    createRotatingOperation(
      mergeCacheHostileSet,
      ([left, right]) => cn(left, right),
    ),
    "32,768 distinct strings exceed result-cache generations and keep parser/conflict work visible",
  ),
  cnCase(
    "arbitrary values + stacked modifiers",
    createRotatingOperation(
      modifierMergeSet,
      ([left, right]) => twMerge(clsx(left, right)),
    ),
    createRotatingOperation(
      modifierMergeSet,
      ([left, right]) => cn(left, right),
    ),
    "covers arbitrary values plus responsive, state, and focus modifier parsing",
  ),
  {
    group: "integration",
    name: "variant resolution + Tailwind merge",
    note: "end-to-end application path combines a resolved component string with a runtime override",
    candidates: [
      {
        name: "cva beta + clsx + twMerge",
        run: createRotatingOperation(
          endToEndProps,
          ({ props, override }) => twMerge(clsx(betaComponent(props), override)),
        ),
      },
      {
        name: "@obvia/cvx cv + cn",
        run: createRotatingOperation(
          endToEndProps,
          ({ props, override }) => cn(currentComponent(props), override),
        ),
        current: true,
      },
    ],
  },
]

const report = runBenchmarks(benchmarks)
const corpus = runCorpusReplayBenchmarks()

console.log(
  formatBenchmarkReport(report),
)
console.log(
  "\n" + formatCorpusReplayReport(corpus),
)

// CI can request the complete raw sample set without changing local benchmark output
const jsonPath = process.env.CVX_BENCHMARK_JSON

if (jsonPath) {
  await Bun.write(
    jsonPath,
    JSON.stringify(
      {
        ...report,
        corpus,
      },
      null,
      2,
    ) + "\n",
  )
}

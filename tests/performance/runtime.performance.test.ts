import { describe, expect, test } from "bun:test";
import { cva as betaCva, cx as betaCx } from "cva";
import { clsx } from "clsx";
import { twMerge as baselineTwMerge } from "tailwind-merge";

import { cn, cv, cx } from "../../src/index";
import { createCvRuntime } from "../../src/cv/internal/runtime";
import { measureNanoseconds } from "../helpers/measure";

let sink = "";
let cursor = 0;

function expectRatio(
  label: string,
  current: number,
  baseline: number,
  maximumRatio: number,
): void {
  const ratio = current / baseline;
  console.log(
    `${label}: current=${current.toFixed(2)}ns baseline=${baseline.toFixed(2)}ns ratio=${ratio.toFixed(3)}`,
  );
  expect(Number.isFinite(ratio)).toBe(true);
  expect(ratio).toBeLessThanOrEqual(maximumRatio);
}

const variants = {
  intent: {
    primary: "bg-blue-500 text-white",
    secondary: "bg-white text-gray-900",
    danger: "bg-red-500 text-white",
  },
  size: { sm: "text-sm p-2", md: "text-base p-4", lg: "text-lg p-6" },
  disabled: { true: "opacity-50", false: "opacity-100" },
} as const;

const defaults = { intent: "primary", size: "md", disabled: false } as const;

const standardConfig = {
  base: "button",
  variants,
  defaultVariants: defaults,
  compoundVariants: [
    { intent: "danger", size: "lg", class: "danger-large" },
    { intent: ["primary", "secondary"], size: "md", class: "common-medium" },
  ],
} as const;

const rotatingProps = [
  { intent: "primary", size: "sm", disabled: false },
  { intent: "secondary", size: "md", disabled: false },
  { intent: "danger", size: "lg", disabled: true },
  { intent: "danger", size: "md", disabled: false },
] as const;

const mergeRotations = [
  ["p-2 text-sm bg-red-500", "p-4 text-lg"],
  ["px-2 py-3 rounded-sm", "px-6 rounded-xl"],
  ["hover:p-2 md:text-sm", "hover:p-8 md:text-xl"],
  ["w-[10px] m-2", "w-[24px] m-4"],
] as const;

describe("performance guards", () => {
  test("cx stays within the direct-composition hot-path budget", () => {
    const baseline = measureNanoseconds(() => {
      sink = betaCx("button", ["active", { disabled: false }], "px-4");
    });
    const current = measureNanoseconds(() => {
      sink = cx("button", ["active", { disabled: false }], "px-4");
    });

    expectRatio("cx shallow", current, baseline, 1.25);
  });

  test("cx keeps nested class-value traversal competitive", () => {
    const input = [
      "button",
      ["rounded", ["shadow", { active: true, disabled: false }]],
      { visible: true, hidden: false },
      "px-4",
    ] as const;

    const baseline = measureNanoseconds(() => {
      sink = betaCx(...input);
    });
    const current = measureNanoseconds(() => {
      sink = cx(...input);
    });

    expectRatio("cx nested", current, baseline, 1.5);
  });

  test("default cv calls retain a material advantage over cva beta", () => {
    const baselineComponent = betaCva(standardConfig);
    const currentComponent = cv(standardConfig);

    const baseline = measureNanoseconds(() => {
      sink = baselineComponent({});
    });
    const current = measureNanoseconds(() => {
      sink = currentComponent({});
    });

    expectRatio("cv defaults", current, baseline, 0.95);
  });

  test("explicit cv variants retain a material advantage over cva beta", () => {
    const baselineComponent = betaCva(standardConfig);
    const currentComponent = cv(standardConfig);
    const props = { intent: "danger", size: "lg", disabled: true } as const;

    const baseline = measureNanoseconds(() => {
      sink = baselineComponent(props);
    });
    const current = measureNanoseconds(() => {
      sink = currentComponent(props);
    });

    expectRatio("cv explicit", current, baseline, 0.9);
  });

  test("rotating cv variants stay ahead without relying on one last-value hit", () => {
    const baselineComponent = betaCva(standardConfig);
    const currentComponent = cv(standardConfig);
    let baselineCursor = 0;
    let currentCursor = 0;

    const baseline = measureNanoseconds(() => {
      sink = baselineComponent(rotatingProps[baselineCursor++ & 3]!);
    });
    const current = measureNanoseconds(() => {
      sink = currentComponent(rotatingProps[currentCursor++ & 3]!);
    });

    expectRatio("cv rotating", current, baseline, 0.95);
  });

  test("compound-heavy cv path retains a strong advantage over cva beta", () => {
    const compounds = Array.from({ length: 24 }, (_, index) => ({
      intent: index % 3 === 0 ? (["danger", "secondary"] as const) : "danger",
      size: index % 2 === 0 ? "md" : (["sm", "md", "lg"] as const),
      disabled: index % 4 === 0 ? ([true, false] as const) : false,
      className: `compound-${index}`,
    }));
    const config = {
      base: "button",
      variants,
      defaultVariants: defaults,
      compoundVariants: compounds,
    } as const;
    const baselineComponent = betaCva(config);
    const currentComponent = cv(config as any) as any;
    const props = { intent: "danger", size: "md", disabled: false } as const;

    const baseline = measureNanoseconds(
      () => {
        sink = baselineComponent(props);
      },
      { iterations: 60_000 },
    );
    const current = measureNanoseconds(
      () => {
        sink = currentComponent(props);
      },
      { iterations: 60_000 },
    );

    expectRatio("cv compound-heavy", current, baseline, 0.75);
  });

  test("same-runtime composition keeps the composed hot path competitive", () => {
    const betaTone = betaCva({
      base: "tone",
      variants: { tone: { normal: "text-zinc-900", danger: "text-red-600" } },
      defaultVariants: { tone: "normal" },
    });
    const betaSize = betaCva({
      base: "size",
      variants: { size: { sm: "text-sm", lg: "text-lg" } },
      defaultVariants: { size: "sm" },
    });
    const betaComponent = betaCva({
      composes: [betaTone, betaSize],
      base: "button",
      compoundVariants: [{ tone: "danger", size: "lg", class: "alert" }],
    });

    const tone = cv({
      base: "tone",
      variants: { tone: { normal: "text-zinc-900", danger: "text-red-600" } },
      defaultVariants: { tone: "normal" },
    });
    const size = cv({
      base: "size",
      variants: { size: { sm: "text-sm", lg: "text-lg" } },
      defaultVariants: { size: "sm" },
    });
    const currentComponent = cv({
      composes: [tone, size],
      base: "button",
      compoundVariants: [{ tone: "danger", size: "lg", class: "alert" }],
    });
    const props = { tone: "danger", size: "lg" } as const;

    const baseline = measureNanoseconds(() => {
      sink = betaComponent(props);
    });
    const current = measureNanoseconds(() => {
      sink = currentComponent(props);
    });

    expectRatio("cv composition", current, baseline, 1.1);
  });

  test("cn stays materially faster than clsx + tailwind-merge on a hot merge", () => {
    const inputs = [
      "inline-flex items-center rounded-md p-2 text-sm",
      "p-4",
      { "text-lg": true },
    ] as const;
    const baseline = measureNanoseconds(() => {
      sink = baselineTwMerge(clsx(...inputs));
    });
    const current = measureNanoseconds(() => {
      sink = cn(...inputs);
    });

    expectRatio("cn stable", current, baseline, 0.9);
  });

  test("cn rotating calls stay ahead across distinct cached class sequences", () => {
    let baselineCursor = 0;
    let currentCursor = 0;

    const baseline = measureNanoseconds(() => {
      const values = mergeRotations[baselineCursor++ & 3]!;
      sink = baselineTwMerge(clsx(values[0], values[1]));
    });
    const current = measureNanoseconds(() => {
      const values = mergeRotations[currentCursor++ & 3]!;
      sink = cn(values[0], values[1]);
    });

    expectRatio("cn rotating", current, baseline, 0.95);
  });

  test("cn arbitrary values and modifiers stay within the merge budget", () => {
    const inputs = [
      "md:hover:p-2 text-[length:12px] w-[10px] [mask-type:luminance]",
      "hover:md:p-4 text-[length:18px] w-[calc(100%-2rem)] [mask-type:alpha]",
    ] as const;

    const baseline = measureNanoseconds(() => {
      sink = baselineTwMerge(clsx(...inputs));
    });
    const current = measureNanoseconds(() => {
      sink = cn(...inputs);
    });

    expectRatio("cn arbitrary", current, baseline, 1.05);
  });

  test("cn non-conflicting passthrough does not pay disproportionate merge overhead", () => {
    const inputs = [
      "inline-flex items-center rounded-md border shadow-sm",
      "font-semibold tracking-tight select-none cursor-pointer",
    ] as const;

    const baseline = measureNanoseconds(() => {
      sink = baselineTwMerge(clsx(...inputs));
    });
    const current = measureNanoseconds(() => {
      sink = cn(...inputs);
    });

    expectRatio("cn passthrough", current, baseline, 1.25);
  });

  test("dense compilation remains faster than the same CVX config with compilation disabled", () => {
    const config = {
      base: "button",
      variants,
      defaultVariants: defaults,
      compoundVariants: [
        { intent: "danger", size: "lg", disabled: false, class: "hit" },
        { intent: ["primary", "secondary"], size: "md", class: "common" },
      ],
    } as const;
    const compiled = createCvRuntime({ compileLimit: 512 })(config);
    const uncached = createCvRuntime({ compileLimit: 0 })(config);
    const props = { intent: "danger", size: "lg", disabled: false } as const;

    const baseline = measureNanoseconds(() => {
      sink = uncached(props);
    });
    const current = measureNanoseconds(() => {
      sink = compiled(props);
    });

    expectRatio("cv dense", current, baseline, 0.9);
  });

  test("uncached general cv path remains competitive with cva beta", () => {
    const baselineComponent = betaCva(standardConfig);
    const currentComponent = createCvRuntime({ compileLimit: 0 })(standardConfig);
    const props = { intent: "secondary", size: "lg", disabled: false } as const;

    const baseline = measureNanoseconds(() => {
      sink = baselineComponent(props);
    });
    const current = measureNanoseconds(() => {
      sink = currentComponent(props);
    });

    // This explicitly protects the prepared general engine rather than allowing
    // dense-table caching to hide a regression in its fallback implementation.
    expectRatio("cv general", current, baseline, 1.5);
  });

  test("component creation does not regress catastrophically versus cva beta", () => {
    const config = { base: "button", variants, defaultVariants: defaults } as const;
    const baseline = measureNanoseconds(
      () => {
        sink = betaCva(config)();
      },
      { iterations: 10_000, warmup: 2_000 },
    );
    const current = measureNanoseconds(
      () => {
        sink = cv(config)();
      },
      { iterations: 10_000, warmup: 2_000 },
    );

    // Creation does more preparation by design. Keep this budget intentionally
    // broad: it catches accidental explosions without turning CI into a micro-
    // benchmark lottery.
    expectRatio("cv creation", current, baseline, 20);
  });

  test("creation plus first call stays bounded for cold-ish component use", () => {
    const config = {
      base: "button",
      variants,
      defaultVariants: defaults,
      compoundVariants: [{ intent: "danger", size: "lg", class: "hit" }],
    } as const;
    const props = { intent: "danger", size: "lg", disabled: false } as const;

    const baseline = measureNanoseconds(
      () => {
        sink = betaCva(config)(props);
      },
      { iterations: 8_000, warmup: 1_000 },
    );
    const current = measureNanoseconds(
      () => {
        sink = cv(config)(props);
      },
      { iterations: 8_000, warmup: 1_000 },
    );

    expectRatio("cv cold-ish", current, baseline, 20);
  });
});

// Keep the benchmarked values observable to the runtime/JIT.
if (!sink) process.stdout.write("");
void cursor;

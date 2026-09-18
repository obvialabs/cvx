import { describe, test } from "bun:test";
import { cva as betaCva, cx as betaCx } from "cva";

const betaReference = betaCva as (config: any) => any;
import { clsx } from "clsx";
import { twMerge as baselineTwMerge } from "tailwind-merge";

import { cn, cv, cx } from "../../src/index";
import { createCvRuntime } from "../../src/cv/internal/runtime";
import {
  expectPerformanceBudget,
  rotatingMergeInputs,
  rotatingVariantProps,
  standardBetaCvConfig,
  standardCvConfig,
  standardDefaults,
  standardVariants,
} from "../helpers";

let sink = "";
let cursor = 0;

const variants = standardVariants;
const defaults = standardDefaults;
const betaStandardConfig = standardBetaCvConfig;
const standardConfig = standardCvConfig;
const rotatingProps = rotatingVariantProps;
const mergeRotations = rotatingMergeInputs;

describe("performance guards", () => {
  test("cx stays within the direct-composition hot-path budget", () => {
    expectPerformanceBudget({
      label: "cx shallow",
      maximumRatio: 1.25,
      baseline: () => { sink = betaCx("button", ["active", { disabled: false }], "px-4"); },
      current: () => { sink = cx("button", ["active", { disabled: false }], "px-4"); },
    });
  });

  test("cx keeps nested class-value traversal competitive", () => {
    const input = [
      "button",
      ["rounded", ["shadow", { active: true, disabled: false }]],
      { visible: true, hidden: false },
      "px-4",
    ] as const;

    expectPerformanceBudget({
      label: "cx nested",
      maximumRatio: 1.5,
      baseline: () => { sink = betaCx(...input); },
      current: () => { sink = cx(...input); },
    });
  });

  test("default cv calls retain a material advantage over cva beta", () => {
    const baselineComponent = betaReference(betaStandardConfig);
    const currentComponent = cv(standardConfig);

    expectPerformanceBudget({
      label: "cv defaults",
      maximumRatio: 0.95,
      baseline: () => { sink = baselineComponent({}); },
      current: () => { sink = currentComponent({}); },
    });
  });

  test("explicit cv variants retain a material advantage over cva beta", () => {
    const baselineComponent = betaReference(betaStandardConfig);
    const currentComponent = cv(standardConfig);
    const props = { intent: "danger", size: "lg", disabled: true } as const;

    expectPerformanceBudget({
      label: "cv explicit",
      maximumRatio: 0.9,
      baseline: () => { sink = baselineComponent(props); },
      current: () => { sink = currentComponent(props); },
    });
  });

  test("rotating cv variants stay ahead without relying on one last-value hit", () => {
    const baselineComponent = betaReference(betaStandardConfig);
    const currentComponent = cv(standardConfig);
    let baselineCursor = 0;
    let currentCursor = 0;

    expectPerformanceBudget({
      label: "cv rotating",
      maximumRatio: 0.95,
      baseline: () => { sink = baselineComponent(rotatingProps[baselineCursor++ & 3]!); },
      current: () => { sink = currentComponent(rotatingProps[currentCursor++ & 3]!); },
    });
  });

  test("compound-heavy cv path retains a strong advantage over cva beta", () => {
    const compounds = Array.from({ length: 24 }, (_, index) => ({
      intent: index % 3 === 0 ? (["danger", "secondary"] as const) : "danger",
      size: index % 2 === 0 ? "md" : (["sm", "md", "lg"] as const),
      disabled: index % 4 === 0 ? ([true, false] as const) : false,
      className: `compound-${index}`,
    }));
    const betaConfig = {
      base: "button",
      variants,
      defaultVariants: defaults,
      compoundVariants: compounds,
    } as const;
    const config = {
      base: "button",
      variants,
      defaults,
      compounds,
    } as const;
    const baselineComponent = betaReference(betaConfig);
    const currentComponent = cv(config as any) as any;
    const props = { intent: "danger", size: "md", disabled: false } as const;

    expectPerformanceBudget({
      label: "cv compound-heavy",
      maximumRatio: 0.75,
      iterations: 60_000,
      baseline: () => { sink = baselineComponent(props); },
      current: () => { sink = currentComponent(props); },
    });
  });

  test("same-runtime composition keeps the composed hot path competitive", () => {
    const betaTone = betaReference({
      base: "tone",
      variants: { tone: { normal: "text-zinc-900", danger: "text-red-600" } },
      defaultVariants: { tone: "normal" },
    });
    const betaSize = betaReference({
      base: "size",
      variants: { size: { sm: "text-sm", lg: "text-lg" } },
      defaultVariants: { size: "sm" },
    });
    const betaComponent = betaReference({
      composes: [betaTone, betaSize],
      base: "button",
      compoundVariants: [{ tone: "danger", size: "lg", class: "alert" }],
    });

    const tone = cv({
      base: "tone",
      variants: { tone: { normal: "text-zinc-900", danger: "text-red-600" } },
      defaults: { tone: "normal" },
    });
    const size = cv({
      base: "size",
      variants: { size: { sm: "text-sm", lg: "text-lg" } },
      defaults: { size: "sm" },
    });
    const currentComponent = cv({
      composes: [tone, size],
      base: "button",
      compounds: [{ tone: "danger", size: "lg", class: "alert" }],
    });
    const props = { tone: "danger", size: "lg" } as const;

    expectPerformanceBudget({
      label: "cv composition",
      maximumRatio: 1.1,
      baseline: () => { sink = betaComponent(props); },
      current: () => { sink = currentComponent(props); },
    });
  });

  test("cn stays materially faster than clsx + tailwind-merge on a hot merge", () => {
    const inputs = [
      "inline-flex items-center rounded-md p-2 text-sm",
      "p-4",
      { "text-lg": true },
    ] as const;
    expectPerformanceBudget({
      label: "cn stable",
      maximumRatio: 0.9,
      baseline: () => { sink = baselineTwMerge(clsx(...inputs)); },
      current: () => { sink = cn(...inputs); },
    });
  });

  test("cn rotating calls stay ahead across distinct cached class sequences", () => {
    let baselineCursor = 0;
    let currentCursor = 0;

    expectPerformanceBudget({
      label: "cn rotating",
      maximumRatio: 0.95,
      baseline: () => {
        const values = mergeRotations[baselineCursor++ & 3]!;
        sink = baselineTwMerge(clsx(values[0], values[1]));
      },
      current: () => {
        const values = mergeRotations[currentCursor++ & 3]!;
        sink = cn(values[0], values[1]);
      },
    });
  });

  test("cn arbitrary values and modifiers stay within the merge budget", () => {
    const inputs = [
      "md:hover:p-2 text-[length:12px] w-[10px] [mask-type:luminance]",
      "hover:md:p-4 text-[length:18px] w-[calc(100%-2rem)] [mask-type:alpha]",
    ] as const;

    expectPerformanceBudget({
      label: "cn arbitrary",
      maximumRatio: 1.05,
      baseline: () => { sink = baselineTwMerge(clsx(...inputs)); },
      current: () => { sink = cn(...inputs); },
    });
  });

  test("cn non-conflicting passthrough does not pay disproportionate merge overhead", () => {
    const inputs = [
      "inline-flex items-center rounded-md border shadow-sm",
      "font-semibold tracking-tight select-none cursor-pointer",
    ] as const;

    expectPerformanceBudget({
      label: "cn passthrough",
      maximumRatio: 1.25,
      baseline: () => { sink = baselineTwMerge(clsx(...inputs)); },
      current: () => { sink = cn(...inputs); },
    });
  });

  test("dense compilation remains faster than the same CVX config with compilation disabled", () => {
    const config = {
      base: "button",
      variants,
      defaults,
      compounds: [
        { intent: "danger", size: "lg", disabled: false, class: "hit" },
        { intent: ["primary", "secondary"], size: "md", class: "common" },
      ],
    } as const;
    const compiled = createCvRuntime({ compileLimit: 512 })(config);
    const uncached = createCvRuntime({ compileLimit: 0 })(config);
    const props = { intent: "danger", size: "lg", disabled: false } as const;

    expectPerformanceBudget({
      label: "cv dense",
      maximumRatio: 0.9,
      baseline: () => { sink = uncached(props); },
      current: () => { sink = compiled(props); },
    });
  });

  test("uncached general cv path remains competitive with cva beta", () => {
    const baselineComponent = betaReference(betaStandardConfig);
    const currentComponent = createCvRuntime({ compileLimit: 0 })(standardConfig);
    const props = { intent: "secondary", size: "lg", disabled: false } as const;

    // This explicitly protects the prepared general engine rather than allowing
    // dense-table caching to hide a regression in its fallback implementation.
    expectPerformanceBudget({
      label: "cv general",
      maximumRatio: 1.5,
      baseline: () => { sink = baselineComponent(props); },
      current: () => { sink = currentComponent(props); },
    });
  });

  test("component creation does not regress catastrophically versus cva beta", () => {
    const betaConfig = { base: "button", variants, defaultVariants: defaults } as const;
    const config = { base: "button", variants, defaults } as const;
    // Creation does more preparation by design. Keep this budget intentionally
    // broad: it catches accidental explosions without turning CI into a micro-
    // benchmark lottery.
    expectPerformanceBudget({
      label: "cv creation",
      maximumRatio: 20,
      iterations: 10_000,
      warmup: 2_000,
      baseline: () => { sink = betaReference(betaConfig)(); },
      current: () => { sink = cv(config)(); },
    });
  });

  test("creation plus first call stays bounded for cold-ish component use", () => {
    const betaConfig = {
      base: "button",
      variants,
      defaultVariants: defaults,
      compoundVariants: [{ intent: "danger", size: "lg", class: "hit" }],
    } as const;
    const config = {
      base: "button",
      variants,
      defaults,
      compounds: [{ intent: "danger", size: "lg", class: "hit" }],
    } as const;
    const props = { intent: "danger", size: "lg", disabled: false } as const;

    expectPerformanceBudget({
      label: "cv cold-ish",
      maximumRatio: 20,
      iterations: 8_000,
      warmup: 1_000,
      baseline: () => { sink = betaReference(betaConfig)(props); },
      current: () => { sink = cv(config)(props); },
    });
  });
});

// Keep the benchmarked values observable to the runtime/JIT.
if (!sink) process.stdout.write("");
void cursor;

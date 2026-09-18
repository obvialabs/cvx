import {
  cva as legacyCva,
  cx as legacyCx,
} from "class-variance-authority";
import { cva as betaCva, cx as betaCx } from "cva";
import { clsx as baselineClsx } from "clsx";
import { twMerge as baselineTwMerge } from "tailwind-merge";

import { cn, cv, cx } from "../src/index";

const betaReference = betaCva as (config: any) => any;
const legacyReference = legacyCva as (base: any, options?: any) => any;

const base = "button font-semibold border rounded";
const variants = {
  intent: {
    primary:
        "button--primary bg-blue-500 text-white border-transparent hover:bg-blue-600",
    secondary:
        "button--secondary bg-white text-gray-800 border-gray-400 hover:bg-gray-100",
    warning:
        "button--warning bg-yellow-500 border-transparent hover:bg-yellow-600",
    danger: "button--danger bg-red-500 text-white hover:bg-red-600",
  },
  disabled: {
    true: "button--disabled opacity-50 cursor-not-allowed",
    false: "button--enabled cursor-pointer",
  },
  size: {
    small: "button--small text-sm py-1 px-2",
    medium: "button--medium text-base py-2 px-4",
    large: "button--large text-lg py-2.5 px-4",
  },
} as const;

const compounds = [
  { intent: "primary", size: "medium", className: "primary-medium" },
  { intent: "warning", disabled: false, className: "warning-enabled" },
  { intent: "warning", disabled: true, className: "warning-disabled" },
  { intent: ["warning", "danger"], className: "warning-danger" },
] as const;

const defaults = {
  disabled: false,
  intent: "primary",
  size: "medium",
} as const;

const legacy = legacyReference(base, {
  variants,
  compoundVariants: compounds,
  defaultVariants: defaults,
});
const beta = betaReference({
  base,
  variants,
  compoundVariants: compounds,
  defaultVariants: defaults,
});
const obvia = cv({
  base,
  variants,
  compounds,
  defaults,
});

const heavyCompounds = Array.from({ length: 24 }, (_, index) => ({
  intent: index % 3 === 0 ? (["danger", "warning"] as const) : "danger",
  size:
      index % 2 === 0
          ? "medium"
          : (["small", "medium", "large"] as const),
  disabled: index % 4 === 0 ? ([true, false] as const) : false,
  className: `compound-${index}`,
}));

const legacyHeavy = legacyReference(base, {
  variants,
  compoundVariants: heavyCompounds,
  defaultVariants: defaults,
});
const betaHeavy = betaReference({
  base,
  variants,
  compoundVariants: heavyCompounds,
  defaultVariants: defaults,
});
const obviaHeavy = cv({
  base,
  variants,
  compounds: heavyCompounds as any,
  defaults,
});

const rotatingProps = [
  { intent: "primary", size: "small", disabled: false },
  { intent: "secondary", size: "medium", disabled: false },
  { intent: "warning", size: "large", disabled: true },
  { intent: "danger", size: "medium", disabled: false },
] as const;

let sink = "";
let cursor = 0;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function measure(fn: () => void, iterations: number): number {
  for (let index = 0; index < 100_000; index++) fn();

  const samples: number[] = [];
  for (let sample = 0; sample < 7; sample++) {
    const start = performance.now();
    for (let index = 0; index < iterations; index++) fn();
    samples.push(((performance.now() - start) * 1e6) / iterations);
  }
  return median(samples);
}

function report(
    name: string,
    legacyFn: () => void,
    betaFn: () => void,
    obviaFn: () => void,
    iterations = 300_000,
): void {
  const legacyNs = measure(legacyFn, iterations);
  const betaNs = measure(betaFn, iterations);
  const obviaNs = measure(obviaFn, iterations);

  console.log(`\n${name}`);
  console.log(
      `  class-variance-authority 0.7.1  ${legacyNs.toFixed(2)} ns/op  ${(legacyNs / obviaNs).toFixed(2)}x`,
  );
  console.log(
      `  cva 1.0 beta                    ${betaNs.toFixed(2)} ns/op  ${(betaNs / obviaNs).toFixed(2)}x`,
  );
  console.log(
      `  @obvia/cvx                      ${obviaNs.toFixed(2)} ns/op  1.00x`,
  );
}
function reportMerge(
    name: string,
    baselineFn: () => void,
    obviaFn: () => void,
    iterations = 500_000,
): void {
  const baselineNs = measure(baselineFn, iterations);
  const obviaNs = measure(obviaFn, iterations);

  console.log(`\n${name}`);
  console.log(
      `  clsx + tailwind-merge             ${baselineNs.toFixed(2)} ns/op  ${(baselineNs / obviaNs).toFixed(2)}x`,
  );
  console.log(
      `  @obvia/cvx cn                     ${obviaNs.toFixed(2)} ns/op  1.00x`,
  );
}

report(
    "class composition",
    () => {
      sink = legacyCx("button", ["active", { disabled: false }], "px-4");
    },
    () => {
      sink = betaCx("button", ["active", { disabled: false }], "px-4");
    },
    () => {
      sink = cx("button", ["active", { disabled: false }], "px-4");
    },
    750_000,
);

report(
    "defaults + compounds",
    () => {
      sink = legacy({});
    },
    () => {
      sink = beta({});
    },
    () => {
      sink = obvia({});
    },
);

report(
    "explicit variants",
    () => {
      sink = legacy({ intent: "warning", size: "medium", disabled: true });
    },
    () => {
      sink = beta({ intent: "warning", size: "medium", disabled: true });
    },
    () => {
      sink = obvia({ intent: "warning", size: "medium", disabled: true });
    },
);

report(
    "rotating variants",
    () => {
      const props = rotatingProps[cursor++ & 3];
      sink = legacy(props);
    },
    () => {
      const props = rotatingProps[cursor++ & 3];
      sink = beta(props);
    },
    () => {
      const props = rotatingProps[cursor++ & 3];
      sink = obvia(props);
    },
);

report(
    "compound-heavy",
    () => {
      sink = legacyHeavy({ intent: "danger", size: "medium", disabled: false });
    },
    () => {
      sink = betaHeavy({ intent: "danger", size: "medium", disabled: false });
    },
    () => {
      sink = obviaHeavy({ intent: "danger", size: "medium", disabled: false });
    },
    120_000,
);

reportMerge(
    "Tailwind merge: stable component call",
    () => {
      sink = baselineTwMerge(
          baselineClsx(
              "inline-flex items-center rounded-md p-2 text-sm",
              "p-4",
              { "text-lg": true },
          ),
      );
    },
    () => {
      sink = cn(
          "inline-flex items-center rounded-md p-2 text-sm",
          "p-4",
          { "text-lg": true },
      );
    },
);

const mergeRotations = [
  ["p-2 text-sm bg-red-500", "p-4 text-lg"],
  ["px-2 py-3 rounded-sm", "px-6 rounded-xl"],
  ["hover:p-2 md:text-sm", "hover:p-8 md:text-xl"],
  ["w-[10px] m-2", "w-[24px] m-4"],
] as const;

reportMerge(
    "Tailwind merge: rotating calls",
    () => {
      const values = mergeRotations[cursor++ & 3];
      sink = baselineTwMerge(baselineClsx(values[0], values[1]));
    },
    () => {
      const values = mergeRotations[cursor++ & 3];
      sink = cn(values[0], values[1]);
    },
);

if (!sink) process.stdout.write("");

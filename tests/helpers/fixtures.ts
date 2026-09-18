import type { ClassValue } from "../../src/cx/types";
import type { Random } from "./random";
import { pick } from "./random";

/** Shared Tailwind utility groups used by behavior/property/performance tests. */
export const utilityGroups = [
  ["p-0", "p-1", "p-2", "p-4", "p-8"],
  ["px-0", "px-2", "px-4", "px-8"],
  ["py-0", "py-2", "py-4", "py-8"],
  ["m-0", "m-2", "m-4", "-m-2", "mx-auto"],
  ["text-xs", "text-sm", "text-base", "text-lg", "text-xl"],
  ["text-red-500", "text-blue-500", "text-green-500"],
  ["bg-red-500", "bg-blue-500", "bg-green-500"],
  ["rounded-none", "rounded-sm", "rounded-lg", "rounded-full"],
  ["border-0", "border", "border-2", "border-4"],
  ["w-[10px]", "w-[20px]", "w-[calc(100%-1rem)]"],
  ["opacity-0", "opacity-50", "opacity-100"],
] as const;

export const utilityModifiers = [
  "",
  "hover:",
  "focus:",
  "md:",
  "dark:",
  "md:hover:",
] as const;

export const classWords = [
  "alpha",
  "beta",
  "gamma",
  "delta",
  "px-2",
  "text-sm",
] as const;

/** Generates one deterministic Tailwind utility from the shared corpus. */
export function generateUtility(random: Random): string {
  const base = pick(random, pick(random, utilityGroups));
  const modifier = pick(random, utilityModifiers);
  return `${modifier}${base}`;
}

/** Generates class-value grammar accepted by cx/cn, including nested arrays. */
export function generateClassValue(random: Random, depth = 0): ClassValue {
  const leaf = (): ClassValue => {
    switch (random.int(7)) {
      case 0:
        return pick(random, classWords);
      case 1:
        return random.int(6);
      case 2:
        return random.bool();
      case 3:
        return null;
      case 4:
        return undefined;
      case 5:
        return { [pick(random, classWords)]: random.bool() };
      default:
        return "";
    }
  };

  if (depth >= 3 || random.int(4) !== 0) return leaf();
  return Array.from({ length: random.int(5) }, () =>
    generateClassValue(random, depth + 1),
  );
}

/** Shared representative CV configuration for parity/performance tests. */
export const standardVariants = {
  intent: {
    primary: "bg-blue-500 text-white",
    secondary: "bg-white text-gray-900",
    danger: "bg-red-500 text-white",
  },
  size: { sm: "text-sm p-2", md: "text-base p-4", lg: "text-lg p-6" },
  disabled: { true: "opacity-50", false: "opacity-100" },
} as const;

export const standardDefaults = {
  intent: "primary",
  size: "md",
  disabled: false,
} as const;

export const standardCompounds = [
  { intent: "danger", size: "lg", class: "danger-large" },
  { intent: ["primary", "secondary"], size: "md", class: "common-medium" },
] as const;

export const standardCvConfig = {
  base: "button",
  variants: standardVariants,
  defaults: standardDefaults,
  compounds: standardCompounds,
} as const;

export const standardBetaCvConfig = {
  base: "button",
  variants: standardVariants,
  defaultVariants: standardDefaults,
  compoundVariants: standardCompounds,
} as const;

export const rotatingVariantProps = [
  { intent: "primary", size: "sm", disabled: false },
  { intent: "secondary", size: "md", disabled: false },
  { intent: "danger", size: "lg", disabled: true },
  { intent: "danger", size: "md", disabled: false },
] as const;

export const rotatingMergeInputs = [
  ["p-2 text-sm bg-red-500", "p-4 text-lg"],
  ["px-2 py-3 rounded-sm", "px-6 rounded-xl"],
  ["hover:p-2 md:text-sm", "hover:p-8 md:text-xl"],
  ["w-[10px] m-2", "w-[24px] m-4"],
] as const;

/**
 * Representative variant map shared by behavior, property, and benchmark workloads
 */
export const standardVariants = {
  intent: {
    primary: "bg-blue-500 text-white",
    secondary: "bg-white text-gray-900",
    danger: "bg-red-500 text-white",
  },
  size: { sm: "text-sm p-2", md: "text-base p-4", lg: "text-lg p-6" },
  disabled: { true: "opacity-50", false: "opacity-100" },
} as const

/**
 * Representative default selections shared by CV parity fixtures
 */
export const standardDefaults = {
  intent: "primary",
  size: "md",
  disabled: false,
} as const

/**
 * Representative compound rules shared by CV parity fixtures
 */
export const standardCompounds = [
  { intent: "danger", size: "lg", class: "danger-large" },
  { intent: ["primary", "secondary"], size: "md", class: "common-medium" },
] as const

/**
 * Canonical CVX configuration used by reusable test fixtures
 */
export const standardCvConfig = {
  base: "button",
  variants: standardVariants,
  defaults: standardDefaults,
  compounds: standardCompounds,
} as const

/**
 * Equivalent `cva@1` configuration used for differential conformance tests
 */
export const standardBetaCvConfig = {
  base: "button",
  variants: standardVariants,
  defaultVariants: standardDefaults,
  compoundVariants: standardCompounds,
} as const

/**
 * Small rotating prop set used to exercise repeated variant call patterns
 */
export const rotatingVariantProps = [
  { intent: "primary", size: "sm", disabled: false },
  { intent: "secondary", size: "md", disabled: false },
  { intent: "danger", size: "lg", disabled: true },
  { intent: "danger", size: "md", disabled: false },
] as const

/**
 * Small rotating class-input set used by conflict-merge benchmarks
 */
export const rotatingMergeInputs = [
  ["p-2 text-sm bg-red-500", "p-4 text-lg"],
  ["px-2 py-3 rounded-sm", "px-6 rounded-xl"],
  ["hover:p-2 md:text-sm", "hover:p-8 md:text-xl"],
  ["w-[10px] m-2", "w-[24px] m-4"],
] as const

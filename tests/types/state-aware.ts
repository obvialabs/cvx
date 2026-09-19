import { cn, cv, cx, type VariantProps } from "../../src"

interface ButtonState {
  disabled: boolean
  focusVisible: boolean
}

type BaseUiClassName =
  | string
  | ((state: ButtonState) => string | undefined)
  | undefined

interface BaseUiButtonProps {
  className?: BaseUiClassName
}

declare const baseUiClassName: BaseUiClassName

// Static inputs must preserve the ordinary immediate-string contract.
const staticCx: string = cx("button", "rounded")
const staticCn: string = cn("px-2", "px-4")

// A definite resolver input must produce a state callback rather than a union.
const statefulCx: (state: ButtonState) => string = cx(
  "button",
  (state: ButtonState) => state.disabled && "opacity-50",
)
const statefulCn: (state: ButtonState) => string = cn(
  "px-2",
  (state: ButtonState) => (state.disabled ? "px-4" : undefined),
)

// Base UI exposes className as string | resolver | undefined. CVX preserves
// both possible runtime outcomes while retaining the resolver's state type.
const baseUiCompatible: BaseUiClassName = cn("button", baseUiClassName)

// Mirror the wrapper shape that motivated state-aware composition. Variant
// resolution stays inside cv while Base UI's native className contract flows
// through cn without narrowing it to string.
const buttonVariants = cv({
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      outline: "border-border bg-background",
    },
    size: {
      default: "h-8 px-2.5",
      sm: "h-7 px-2",
    },
  },
  defaults: {
    variant: "default",
    size: "default",
  },
})

type ButtonProps = BaseUiButtonProps & VariantProps<typeof buttonVariants>

const resolveButtonClassName = ({
  className,
  variant = "default",
  size = "default",
}: ButtonProps): BaseUiClassName =>
  cn(
    buttonVariants({ variant, size }),
    className,
  )

// Multiple resolvers share one state value, so their state requirements are
// intersected rather than widened to an unsafe union.
const combinedState: (state: { open: boolean } & { disabled: boolean }) => string =
  cn(
    (state: { open: boolean }) => state.open && "open",
    (state: { disabled: boolean }) => state.disabled && "disabled",
  )

// Keep the declarations live so noUnusedLocals can be enabled later without
// turning this type-contract fixture into maintenance noise.
void staticCx
void staticCn
void statefulCx
void statefulCn
void baseUiCompatible
void resolveButtonClassName
void combinedState

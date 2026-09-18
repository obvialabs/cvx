import * as cvx from "../../src/index";
import { cn, cv, cx, type VariantProps } from "../../src/index";

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;
type Not<T extends boolean> = T extends true ? false : true;

// Runtime package surface is intentionally only three functions.
type _RuntimeSurface = Expect<Equal<keyof typeof cvx, "cn" | "cv" | "cx">>;

const button = cv({
  base: ["button", { active: true }],
  variants: {
    intent: { primary: "p", secondary: "s" },
    size: { 0: "zero", 1: "one" },
    disabled: { true: "disabled", false: "enabled" },
    _density: { compact: "compact", roomy: "roomy" },
  },
  defaults: {
    intent: "primary",
    size: 0,
    disabled: false,
    _density: "compact",
  },
  compounds: [
    { intent: ["primary", "secondary"], disabled: false, class: "ready" },
  ],
});

button();
button({ intent: "secondary", size: 1, disabled: true, _density: "roomy" });
button({ className: ["extra", { active: true }] });
button({ class: 2n });

// @ts-expect-error invalid variant value
button({ intent: "danger" });
// @ts-expect-error invalid numeric variant value
button({ size: 2 });
// @ts-expect-error class and className are mutually exclusive in authored props
button({ class: "a", className: "b" });

type Props = VariantProps<typeof button>;
type _HasIntent = Expect<HasKey<Props, "intent">>;
type _HasSize = Expect<HasKey<Props, "size">>;
type _HasDisabled = Expect<HasKey<Props, "disabled">>;
type _NoClass = Expect<Not<HasKey<Props, "class">>>;
type _NoClassName = Expect<Not<HasKey<Props, "className">>>;
type _NoInternal = Expect<Not<HasKey<Props, "_density">>>;

const className: string = cn("button", ["active", { disabled: false }]);
const expression: string = cx("button", 2, 3n, { active: true });
void className;
void expression;

// CVX 0.1.0 intentionally uses concise authoring keys with no legacy aliases.
// @ts-expect-error use `defaults`
cv({ variants: { tone: { soft: "soft" } }, defaultVariants: { tone: "soft" } });
// @ts-expect-error use `compounds`
cv({ variants: { tone: { soft: "soft" } }, compoundVariants: [{ tone: "soft", class: "x" }] });

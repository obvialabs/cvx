import { describe, expect, test } from "bun:test";

import { createCvRuntime } from "../../src/cv/internal/runtime";
import { createRandom, pick } from "../helpers/random";

const config = {
  base: "root",
  variants: {
    intent: { primary: "i-p", secondary: "i-s", danger: "i-d" },
    size: { xs: "s-xs", sm: "s-sm", md: "s-md", lg: "s-lg" },
    disabled: { true: "disabled", false: "enabled" },
    level: { 0: "l0", 1: "l1", 2: "l2" },
  },
  defaultVariants: {
    intent: "primary",
    size: "md",
    disabled: false,
    level: 1,
  },
  compoundVariants: [
    { intent: "danger", disabled: false, class: "danger-ready" },
    { intent: ["primary", "secondary"], size: ["sm", "md"], class: "common" },
    { level: [0, 1, 2], disabled: true, className: "disabled-level" },
    {
      intent: ["primary", "secondary", "danger"],
      size: ["xs", "sm", "md", "lg"],
      disabled: [true, false],
      level: [0, 1, 2],
      class: "all-known",
    },
  ],
} as const;

const intents = [undefined, "primary", "secondary", "danger", "unknown", null] as const;
const sizes = [undefined, "xs", "sm", "md", "lg", "unknown", null] as const;
const disabled = [undefined, true, false, null] as const;
const levels = [undefined, 0, 1, 2, 99, null] as const;

describe("cv properties", () => {
  test("dense compilation is observationally equivalent to the uncached path", () => {
    const compiled = createCvRuntime({ compileLimit: 1_024 })(config);
    const uncached = createCvRuntime({ compileLimit: 0 })(config);
    const random = createRandom(0x13572468);

    for (let caseIndex = 0; caseIndex < 20_000; caseIndex++) {
      const props = {
        intent: pick(random, intents) as never,
        size: pick(random, sizes) as never,
        disabled: pick(random, disabled) as never,
        level: pick(random, levels) as never,
        className: random.int(4) === 0 ? `extra-${random.int(8)}` : undefined,
      };

      expect(compiled(props)).toBe(uncached(props));
    }
  });

  test("repeated cache hits never change output", () => {
    const component = createCvRuntime({ compileLimit: 1_024 })(config);
    const props = { intent: "danger", size: "lg", disabled: false, level: 2 } as const;
    const expected = component(props);

    for (let index = 0; index < 20_000; index++) {
      expect(component(props)).toBe(expected);
    }
  });

  test("class overrides affect only the suffix, not variant resolution", () => {
    const component = createCvRuntime({ compileLimit: 1_024 })(config);
    const random = createRandom(0x24681357);

    for (let caseIndex = 0; caseIndex < 5_000; caseIndex++) {
      const props = {
        intent: pick(random, intents) as never,
        size: pick(random, sizes) as never,
        disabled: pick(random, disabled) as never,
        level: pick(random, levels) as never,
      };
      const core = component(props);
      const extra = `extra-${caseIndex % 7}`;

      expect(component({ ...props, className: extra })).toBe(
        core ? `${core} ${extra}` : extra,
      );
    }
  });

  test("nested composition stays equivalent between compiled and uncached engines", () => {
    const make = (compileLimit: number) => {
      const engine = createCvRuntime({ compileLimit });
      const tone = engine({
        base: "tone",
        variants: { tone: { calm: "calm", loud: "loud" } },
        defaultVariants: { tone: "calm" },
      });
      const size = engine({
        base: "size",
        variants: { size: { sm: "sm", lg: "lg" } },
        defaultVariants: { size: "sm" },
      });
      const middle = engine({ composes: [tone, size], base: "middle" });
      return engine({
        composes: middle,
        base: "root",
        defaultVariants: { tone: "loud", size: "lg" },
        compoundVariants: [{ tone: "loud", size: "lg", class: "hit" }],
      });
    };

    const compiled = make(512);
    const uncached = make(0);

    for (const tone of [undefined, "calm", "loud"] as const) {
      for (const size of [undefined, "sm", "lg"] as const) {
        expect(compiled({ tone, size })).toBe(uncached({ tone, size }));
      }
    }
  });

  test("many independently created components do not share mutable result state", () => {
    const random = createRandom(0x90909090);
    const components = Array.from({ length: 64 }, (_, index) =>
      createCvRuntime({ compileLimit: index % 2 === 0 ? 512 : 0 })({
        base: `component-${index}`,
        variants: { tone: { a: `a-${index}`, b: `b-${index}` } },
        defaultVariants: { tone: index % 2 === 0 ? "a" : "b" },
      }),
    );

    for (let caseIndex = 0; caseIndex < 5_000; caseIndex++) {
      const index = random.int(components.length);
      const tone = random.bool() ? "a" : "b";
      expect(components[index]!({ tone })).toBe(
        `component-${index} ${tone}-${index}`,
      );
    }
  });
});

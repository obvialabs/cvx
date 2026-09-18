import { describe, expect, test } from "bun:test";

import { createCvRuntime } from "../../src/cv/internal/runtime";
import {
  checkGeneratedCases,
  forEachCartesian,
  pick,
  repeatCases,
} from "../helpers";

const config = {
  base: "root",
  variants: {
    intent: { primary: "i-p", secondary: "i-s", danger: "i-d" },
    size: { xs: "s-xs", sm: "s-sm", md: "s-md", lg: "s-lg" },
    disabled: { true: "disabled", false: "enabled" },
    level: { 0: "l0", 1: "l1", 2: "l2" },
  },
  defaults: {
    intent: "primary",
    size: "md",
    disabled: false,
    level: 1,
  },
  compounds: [
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

    checkGeneratedCases({
      seed: 0x13572468,
      cases: 20_000,
      generate: (random) => ({
        intent: pick(random, intents) as never,
        size: pick(random, sizes) as never,
        disabled: pick(random, disabled) as never,
        level: pick(random, levels) as never,
        className: random.int(4) === 0 ? `extra-${random.int(8)}` : undefined,
      }),
      check: (props) => {
        expect(compiled(props)).toBe(uncached(props));
      },
    });
  });

  test("repeated cache hits never change output", () => {
    const component = createCvRuntime({ compileLimit: 1_024 })(config);
    const props = { intent: "danger", size: "lg", disabled: false, level: 2 } as const;
    const expected = component(props);

    repeatCases(20_000, () => {
      expect(component(props)).toBe(expected);
    });
  });

  test("class overrides affect only the suffix, not variant resolution", () => {
    const component = createCvRuntime({ compileLimit: 1_024 })(config);

    checkGeneratedCases({
      seed: 0x24681357,
      cases: 5_000,
      generate: (random, index) => ({
        props: {
          intent: pick(random, intents) as never,
          size: pick(random, sizes) as never,
          disabled: pick(random, disabled) as never,
          level: pick(random, levels) as never,
        },
        extra: `extra-${index % 7}`,
      }),
      check: ({ props, extra }) => {
        const core = component(props);
        expect(component({ ...props, className: extra })).toBe(
          core ? `${core} ${extra}` : extra,
        );
      },
    });
  });

  test("nested composition stays equivalent between compiled and uncached engines", () => {
    const make = (compileLimit: number) => {
      const engine = createCvRuntime({ compileLimit });
      const tone = engine({
        base: "tone",
        variants: { tone: { calm: "calm", loud: "loud" } },
        defaults: { tone: "calm" },
      });
      const size = engine({
        base: "size",
        variants: { size: { sm: "sm", lg: "lg" } },
        defaults: { size: "sm" },
      });
      const middle = engine({ composes: [tone, size], base: "middle" });
      return engine({
        composes: middle,
        base: "root",
        defaults: { tone: "loud", size: "lg" },
        compounds: [{ tone: "loud", size: "lg", class: "hit" }],
      });
    };

    const compiled = make(512);
    const uncached = make(0);

    const comparisons = forEachCartesian(
      [
        [undefined, "calm", "loud"],
        [undefined, "sm", "lg"],
      ] as const,
      ([tone, size]) => {
        expect(compiled({ tone, size })).toBe(uncached({ tone, size }));
      },
    );

    expect(comparisons).toBe(9);
  });

  test("many independently created components do not share mutable result state", () => {
    const components = Array.from({ length: 64 }, (_, index) =>
      createCvRuntime({ compileLimit: index % 2 === 0 ? 512 : 0 })({
        base: `component-${index}`,
        variants: { tone: { a: `a-${index}`, b: `b-${index}` } },
        defaults: { tone: index % 2 === 0 ? "a" : "b" },
      }),
    );

    checkGeneratedCases({
      seed: 0x90909090,
      cases: 5_000,
      generate: (random) => ({
        index: random.int(components.length),
        tone: random.bool() ? ("a" as const) : ("b" as const),
      }),
      check: ({ index, tone }) => {
        expect(components[index]!({ tone })).toBe(
          `component-${index} ${tone}-${index}`,
        );
      },
    });
  });
});

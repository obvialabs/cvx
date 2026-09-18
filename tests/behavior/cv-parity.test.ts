import { describe, expect, test } from "bun:test";
import { cva as legacyCva } from "class-variance-authority";
import { cva as betaCva } from "cva";

const betaReference = betaCva as (config: any) => any;
const legacyReference = legacyCva as (base: any, options?: any) => any;

import { cv } from "../../src/index";

const betaConfig = {
  base: ["button", { root: true, skip: false }],
  variants: {
    intent: {
      primary: "p",
      secondary: ["s", { secondary: true }],
      danger: "d",
    },
    size: { small: "sm", medium: "md", large: "lg" },
    disabled: { true: "off", false: "on" },
    level: { 0: "zero", 1: "one" },
  },
  defaultVariants: {
    intent: "primary",
    size: "medium",
    disabled: false,
    level: 1,
  },
  compoundVariants: [
    { intent: "primary", size: "medium", class: "pm" },
    {
      intent: ["danger", "secondary"],
      disabled: false,
      className: ["active-danger", { compound: true }],
    },
    { level: 0, disabled: true, class: "zero-off" },
    {
      intent: ["primary", "secondary", "danger"],
      size: ["small", "medium", "large"],
      class: "all-intents-and-sizes",
    },
  ],
} as const;

describe("cva@1 beta behavior parity", () => {
  test("matches a broad variant/default/compound matrix", () => {
    const upstream = betaReference(betaConfig);
    const current = cv({
      base: betaConfig.base,
      variants: betaConfig.variants,
      defaults: betaConfig.defaultVariants,
      compounds: betaConfig.compoundVariants,
    });
    const intents = [
      undefined,
      "primary",
      "secondary",
      "danger",
      "unknown",
      null,
    ] as const;
    const sizes = [
      undefined,
      "small",
      "medium",
      "large",
      "bad",
      null,
    ] as const;
    const disabled = [undefined, true, false, null] as const;
    const levels = [undefined, 0, 1, 9, null] as const;
    let count = 0;

    for (const intent of intents) {
      for (const size of sizes) {
        for (const disabledValue of disabled) {
          for (const level of levels) {
            for (const override of [false, true] as const) {
              const props: Record<string, unknown> = {
                intent,
                size,
                disabled: disabledValue,
                level,
              };
              if (override) {
                props.className = ["extra", { x: true }];
              }

              expect(current(props as never)).toBe(upstream(props as never));
              count++;
            }
          }
        }
      }
    }

    expect(count).toBe(1_440);
  });

  test("matches composition, inherited defaults and parent compounds", () => {
    const upstreamTone = betaReference({
      base: "tone",
      variants: { tone: { a: "a", b: "b", c: "c" } },
      defaultVariants: { tone: "a" },
    });
    const upstreamSize = betaReference({
      base: "size",
      variants: { size: { s: "s", m: "m", l: "l" } },
      defaultVariants: { size: "s" },
    });
    const upstream = betaReference({
      composes: [upstreamTone, upstreamSize],
      base: "parent",
      defaultVariants: { tone: "b", size: "l" },
      compoundVariants: [
        { tone: "b", size: "l", class: "hit" },
        { tone: ["a", "c"], size: ["s", "m"], className: "matrix" },
      ],
    });

    const tone = cv({
      base: "tone",
      variants: { tone: { a: "a", b: "b", c: "c" } },
      defaults: { tone: "a" },
    });
    const size = cv({
      base: "size",
      variants: { size: { s: "s", m: "m", l: "l" } },
      defaults: { size: "s" },
    });
    const current = cv({
      composes: [tone, size],
      base: "parent",
      defaults: { tone: "b", size: "l" },
      compounds: [
        { tone: "b", size: "l", class: "hit" },
        { tone: ["a", "c"], size: ["s", "m"], className: "matrix" },
      ],
    });

    for (const toneValue of [undefined, "a", "b", "c"] as const) {
      for (const sizeValue of [undefined, "s", "m", "l"] as const) {
        for (const className of [undefined, "override"] as const) {
          const props = { tone: toneValue, size: sizeValue, className };
          expect(current(props)).toBe(upstream(props));
        }
      }
    }
  });

  test("matches nested composition semantics", () => {
    const upstreamA = betaReference({
      base: "a",
      variants: { x: { one: "a1", two: "a2" } },
      defaultVariants: { x: "one" },
    });
    const upstreamB = betaReference({ base: "b", composes: upstreamA });
    const upstreamC = betaReference({
      base: "c",
      composes: upstreamB,
      defaultVariants: { x: "two" },
    });

    const currentA = cv({
      base: "a",
      variants: { x: { one: "a1", two: "a2" } },
      defaults: { x: "one" },
    });
    const currentB = cv({ base: "b", composes: currentA });
    const currentC = cv({
      base: "c",
      composes: currentB,
      defaults: { x: "two" },
    });

    expect(currentC()).toBe(upstreamC());
    expect(currentC({ x: "one" })).toBe(upstreamC({ x: "one" }));
    expect(currentC({ x: "two", className: "tail" })).toBe(
      upstreamC({ x: "two", className: "tail" }),
    );
  });
});

describe("class-variance-authority 0.7 behavior parity", () => {
  test("matches legacy semantics where the feature surfaces overlap", () => {
    const options = {
      variants: {
        intent: { primary: "p", danger: "d" },
        size: { sm: "sm", lg: "lg" },
        disabled: { true: "off", false: "on" },
      },
      defaultVariants: { intent: "primary", size: "sm", disabled: false },
      compoundVariants: [
        { intent: "danger", size: ["sm", "lg"], className: "danger-size" },
        { intent: "primary", disabled: false, class: "ready" },
      ],
    } as const;

    const upstream = legacyReference("button", options);
    const current = cv({
      base: "button",
      variants: options.variants,
      defaults: options.defaultVariants,
      compounds: options.compoundVariants,
    });

    // CVA 0.7 treats explicit `null` differently. Null/default semantics are
    // covered against the current cva beta above; this matrix stays on the
    // behavior genuinely shared by both generations.
    for (const intent of [undefined, "primary", "danger"] as const) {
      for (const size of [undefined, "sm", "lg"] as const) {
        for (const disabled of [undefined, true, false] as const) {
          const props = { intent, size, disabled };
          expect(current(props as never)).toBe(upstream(props as never));
        }
      }
    }
  });
});

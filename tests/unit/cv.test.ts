import { describe, expect, test } from "bun:test";

import { cv } from "../../src/index";
import { createCvRuntime } from "../../src/cv/internal/runtime";

const createButton = () =>
  cv({
    base: "button",
    variants: {
      intent: {
        primary: "intent-primary",
        secondary: "intent-secondary",
        danger: "intent-danger",
      },
      size: { sm: "size-sm", md: "size-md", lg: "size-lg" },
      disabled: { true: "disabled", false: "enabled" },
      level: { 0: "level-zero", 1: "level-one" },
    },
    defaultVariants: {
      intent: "primary",
      size: "md",
      disabled: false,
      level: 1,
    },
    compoundVariants: [
      { intent: "danger", size: ["sm", "lg"], class: "danger-sized" },
      { disabled: true, level: 0, className: "disabled-zero" },
      {
        intent: ["primary", "secondary", "danger"],
        size: ["sm", "md", "lg"],
        disabled: false,
        level: [0, 1],
        class: "wide-selector",
      },
    ],
  });

describe("cv", () => {
  test("resolves base, defaults, compounds and class overrides", () => {
    const button = createButton();

    expect(button()).toBe(
      "button intent-primary size-md enabled level-one wide-selector",
    );
    expect(
      button({
        intent: "danger",
        size: "lg",
        disabled: true,
        level: 0,
        className: "custom",
      }),
    ).toBe(
      "button intent-danger size-lg disabled level-zero danger-sized disabled-zero custom",
    );
  });

  test("normalizes boolean and numeric variant values", () => {
    const component = cv({
      variants: {
        visible: { true: "visible", false: "hidden" },
        level: { 0: "zero", 1: "one" },
      },
    });

    expect(component({ visible: true, level: 0 })).toBe("visible zero");
    expect(component({ visible: false, level: 1 })).toBe("hidden one");
  });

  test("uses defaults for undefined, null, and empty-string selections", () => {
    const component = cv({
      variants: { tone: { soft: "soft", hard: "hard" } },
      defaultVariants: { tone: "soft" },
    });

    expect(component({ tone: undefined })).toBe("soft");
    expect(component({ tone: null as never })).toBe("soft");
    expect(component({ tone: "" as never })).toBe("soft");
  });

  test("ignores unknown runtime variant values without corrupting other output", () => {
    const component = cv({
      base: "base",
      variants: {
        tone: { a: "tone-a", b: "tone-b" },
        size: { sm: "small", lg: "large" },
      },
      defaultVariants: { tone: "a", size: "sm" },
    });

    expect(component({ tone: "missing" as "a", size: "lg" })).toBe(
      "base large",
    );
  });

  test("supports class and className at runtime without caching them", () => {
    const component = cv({ base: "base" });

    expect(component({ class: "one" })).toBe("base one");
    expect(component({ className: "two" })).toBe("base two");
    expect(component({ class: "three" })).toBe("base three");
  });

  test("keeps authored configuration snapshot behavior stable", () => {
    const config: {
      base: string;
      variants: { tone: { a: string } };
      defaultVariants: { tone: "a" };
      compoundVariants: { tone: "a"; class: string }[];
    } = {
      base: "before",
      variants: { tone: { a: "a" } },
      defaultVariants: { tone: "a" },
      compoundVariants: [{ tone: "a", class: "compound" }],
    };
    const component = cv(config);

    config.base = "after";
    config.variants.tone.a = "changed";
    config.defaultVariants.tone = "a";
    config.compoundVariants[0]!.class = "changed-compound";

    expect(component()).toBe("before a compound");
  });

  test("composes child variants and allows parent defaults to retune them", () => {
    const tone = cv({
      base: "tone",
      variants: { intent: { primary: "primary", danger: "danger" } },
      defaultVariants: { intent: "primary" },
    });
    const size = cv({
      base: "size",
      variants: { size: { sm: "sm", lg: "lg" } },
      defaultVariants: { size: "sm" },
    });
    const button = cv({
      composes: [tone, size],
      base: "button",
      defaultVariants: { intent: "danger", size: "lg" },
      compoundVariants: [
        { intent: "danger", size: "lg", class: "danger-large" },
      ],
    });

    expect(button()).toBe("tone danger size lg button danger-large");
    expect(button({ intent: "primary", size: "sm" })).toBe(
      "tone primary size sm button",
    );
  });

  test("supports deeply nested composition", () => {
    const a = cv({ base: "a", variants: { x: { one: "a1", two: "a2" } } });
    const b = cv({ base: "b", composes: a, defaultVariants: { x: "one" } });
    const c = cv({ base: "c", composes: b, defaultVariants: { x: "two" } });
    const d = cv({ base: "d", composes: c });

    expect(d()).toBe("a a2 b c d");
    expect(d({ x: "one" })).toBe("a a1 b c d");
  });

  test("forwards resolved props to foreign composed components", () => {
    const calls: Record<string, unknown>[] = [];
    const foreign = Object.assign(
      (props: Record<string, unknown> = {}) => {
        calls.push(props);
        return `foreign-${String(props.tone ?? "none")}`;
      },
      {
        config: {
          variants: { tone: { a: "a", b: "b" } },
          defaultVariants: { tone: "a" },
        },
      },
    );

    const component = cv({
      composes: foreign,
      base: "local",
      defaultVariants: { tone: "b" },
    } as any);

    expect(component({ className: "extra" })).toBe("foreign-b local extra");
    expect(calls.at(-1)).toEqual({ tone: "b" });
  });

  test("compiled and uncompiled engines produce identical output", () => {
    const fast = createCvRuntime({ compileLimit: 512 });
    const slow = createCvRuntime({ compileLimit: 0 });
    const config = {
      base: "base",
      variants: {
        a: { x: "ax", y: "ay", z: "az" },
        b: { x: "bx", y: "by" },
      },
      defaultVariants: { a: "x", b: "y" },
      compoundVariants: [{ a: "y", b: "x", class: "hit" }],
    } as const;
    const compiled = fast(config);
    const uncached = slow(config);

    for (const a of [undefined, "x", "y", "z", "bad"] as const) {
      for (const b of [undefined, "x", "y", "bad"] as const) {
        const props = { a: a as never, b: b as never };
        expect(compiled(props)).toBe(uncached(props));
      }
    }
  });

});

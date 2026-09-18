import { describe, expect, test } from "bun:test";

import { cv } from "../../src/index";
import { getSchema } from "../../src/schema";

describe("schema", () => {
  test("returns an empty schema for variant-free components", () => {
    expect(getSchema(cv({ base: "base" }))).toEqual({});
  });

  test("omits internal variants", () => {
    const component = cv({
      variants: {
        public: { a: "a", b: "b" },
        _private: { on: "on", off: "off" },
      },
      defaultVariants: { public: "b", _private: "on" },
    });

    expect(getSchema(component)).toEqual({
      public: { values: ["a", "b"], defaultValue: "b" },
    });
  });

  test("normalizes canonical booleans and numbers", () => {
    const component = cv({
      variants: {
        active: { true: "yes", false: "no" },
        integer: { 0: "zero", 2: "two", "01": "leading" },
        decimal: { "1.5": "decimal", "1.50": "preserved" },
      },
      defaultVariants: { active: false, integer: 2, decimal: 1.5 },
    } as any);

    expect(getSchema(component)).toEqual({
      active: { values: [true, false], defaultValue: false },
      integer: { values: [0, 2, "01"], defaultValue: 2 },
      decimal: { values: [1.5, "1.50"], defaultValue: 1.5 },
    });
  });

  test("does not emit defaultValue when no default exists", () => {
    const component = cv({ variants: { size: { sm: "sm", lg: "lg" } } });

    expect(getSchema(component)).toEqual({
      size: { values: ["sm", "lg"] },
    });
  });
});

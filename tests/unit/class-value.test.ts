import { describe, expect, test } from "bun:test";

import { appendClassValue, cx } from "../../src/class-value";

describe("cx / class-value", () => {
  test("composes strings, numbers, bigints, arrays and dictionaries", () => {
    expect(
      cx(
        "root",
        2,
        3n,
        ["nested", ["deep", { active: true, disabled: false }]],
      ),
    ).toBe("root 2 3 nested deep active");
  });

  test("ignores clsx-compatible falsy values", () => {
    expect(cx("a", "", 0, 0n, false, true, null, undefined, "b")).toBe(
      "a b",
    );
  });

  test("preserves insertion order for truthy dictionary keys", () => {
    expect(cx({ third: 1, first: true, skipped: 0, second: "yes" })).toBe(
      "third first second",
    );
  });

  test("ignores inherited dictionary properties", () => {
    const inherited = { inherited: true };
    const value = Object.create(inherited) as Record<string, unknown>;
    value.own = true;

    expect(cx(value)).toBe("own");
  });

  test("handles deeply nested arrays without changing order", () => {
    expect(cx([[[[["a"]]]], ["b", [["c"]]]])).toBe("a b c");
  });

  test("appendClassValue composes incrementally without separator drift", () => {
    let output = "";
    output = appendClassValue(output, "a");
    output = appendClassValue(output, [false, "b"]);
    output = appendClassValue(output, { c: true });

    expect(output).toBe("a b c");
  });

  test("is deterministic across repeated calls", () => {
    const input = ["a", ["b", { c: true, d: false }], 4] as const;
    const expected = cx(...input);

    for (let index = 0; index < 1_000; index++) {
      expect(cx(...input)).toBe(expected);
    }
  });
});

import { describe, expect, test } from "bun:test";

import { cn, twJoin, twMerge } from "../../src/cn";

describe("cn", () => {
  test("resolves same-group utilities with last-one-wins semantics", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
    expect(cn("rounded-sm", "rounded-xl")).toBe("rounded-xl");
  });

  test("keeps unrelated utilities", () => {
    expect(cn("flex", "p-4", "text-lg", "bg-red-500")).toBe(
      "flex p-4 text-lg bg-red-500",
    );
  });

  test("scopes conflicts by modifiers", () => {
    expect(cn("p-2", "hover:p-2", "hover:p-4")).toBe("p-2 hover:p-4");
    expect(cn("md:text-sm", "lg:text-lg", "md:text-xl")).toBe(
      "lg:text-lg md:text-xl",
    );
  });

  test("handles important modifiers independently", () => {
    expect(cn("p-2", "!p-2", "!p-4")).toBe("p-2 !p-4");
  });

  test("handles arbitrary values and arbitrary properties", () => {
    expect(cn("w-[10px]", "w-[24px]")).toBe("w-[24px]");
    expect(cn("[color:red]", "[color:blue]")).toBe("[color:blue]");
  });

  test("supports the complete cx input grammar before merging", () => {
    expect(
      cn("p-2", 2, 3n, ["p-4", ["text-sm"]], { "text-lg": true }),
    ).toBe("2 3 p-4 text-lg");
  });

  test("twJoin joins but deliberately does not resolve conflicts", () => {
    expect(twJoin("p-2", ["p-4", ["text-sm"]])).toBe("p-2 p-4 text-sm");
  });

  test("twMerge resolves conflicts for already-tailwind-shaped inputs", () => {
    expect(twMerge("p-2", ["p-4", "text-sm"], "text-lg")).toBe(
      "p-4 text-lg",
    );
  });
});

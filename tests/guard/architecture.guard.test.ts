import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";

const rootEntries = (await readdir("src", { withFileTypes: true }))
  .map((entry) => entry.name)
  .sort();

describe("source architecture guard", () => {
  test("keeps the source root domain-oriented", () => {
    expect(rootEntries).toEqual(["cn", "cv", "cx", "index.ts"]);
  });

  test("keeps generated Tailwind data inside the cn domain", async () => {
    const generated = (await readdir("src/cn/internal/generated"))
      .filter((entry) => entry.endsWith(".ts"))
      .sort();

    expect(generated).toEqual(["default-config.ts", "tables.ts"]);
  });
});

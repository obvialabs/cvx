import { describe, expect, test } from "bun:test"
import { readdir } from "node:fs/promises"

const names = async (path: string): Promise<string[]> =>
  (await readdir(path, { withFileTypes: true }))
    .map((entry) => entry.name)
    .sort()

describe("source architecture guard", () => {
  test("keeps the source root domain-oriented", async () => {
    expect(await names("src")).toEqual(["cn", "cv", "cx", "index.ts"])
  })

  test("keeps cx focused on class-value composition", async () => {
    expect(await names("src/cx")).toEqual(["compose.ts", "index.ts", "types.ts"])
  })

  test("keeps cv runtime concerns separated", async () => {
    expect(await names("src/cv")).toEqual(["index.ts", "internal", "types.ts"])
    expect(await names("src/cv/internal")).toEqual([
      "compounds.ts",
      "dense.ts",
      "model.ts",
      "program.ts",
      "runtime.ts",
      "variants.ts",
    ])
  })

  test("keeps cn authoring, generated data, composition and runtime concerns separated", async () => {
    expect(await names("src/cn")).toEqual(["index.ts", "internal"])
    expect(await names("src/cn/internal")).toEqual([
      "compiler",
      "engine",
      "factory.ts",
      "generated",
      "types.ts",
      "validators.ts",
    ])
    expect(await names("src/cn/internal/compiler")).toEqual([
      "config.ts",
      "index.ts",
    ])
    expect(await names("src/cn/internal/engine")).toEqual([
      "compose.ts",
      "hash.ts",
      "index.ts",
    ])
  })

  test("keeps generated conflict data isolated from handwritten runtime code", async () => {
    expect(await names("src/cn/internal/generated")).toEqual([
      "default-config.ts",
      "tables.ts",
    ])
  })
})

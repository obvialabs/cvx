import { describe, expect, test } from "bun:test";

const files = ["tests.yml", "coverage.yml", "benchmark.yml", "publish.yml"];

describe("workflow guard", () => {
  test("contains no stale package or Collections references", async () => {
    for (const file of files) {
      const source = await Bun.file(`.github/workflows/${file}`).text();
      expect(source.match(/@obvia\/cv(?!x)/g)).toBeNull();
      expect(source).not.toContain("@obvia/collections");
      expect(source).not.toContain("Collections");
    }
  });

  test("targets the repository main branch where branch filters exist", async () => {
    for (const file of ["tests.yml", "coverage.yml", "benchmark.yml"]) {
      const source = await Bun.file(`.github/workflows/${file}`).text();
      expect(source).toContain("- main");
      expect(source).not.toContain("- master");
    }
  });
});

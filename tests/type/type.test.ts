import { expect, test } from "bun:test";

const decoder = new TextDecoder();

test("public TypeScript contracts compile with all expected errors consumed", () => {
  const result = Bun.spawnSync([
    process.execPath,
    "x",
    "tsc",
    "-p",
    "tests/type/tsconfig.json",
    "--pretty",
    "false",
  ]);

  if (result.exitCode !== 0) {
    const stdout = decoder.decode(result.stdout);
    const stderr = decoder.decode(result.stderr);
    console.error([stdout, stderr].filter(Boolean).join("\n"));
  }

  expect(result.exitCode).toBe(0);
});

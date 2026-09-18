import { describe, expect, test } from "bun:test";

const packageJson = await Bun.file("package.json").json();

describe("package contract guard", () => {
  test("publishes under the CVX package identity", () => {
    expect(packageJson.name).toBe("@obvia/cvx");
    expect(packageJson.repository.url).toBe("git+https://github.com/obvialabs/cvx.git");
  });

  test("has one public package entrypoint", () => {
    expect(Object.keys(packageJson.exports)).toEqual(["."]);
    expect(packageJson.exports["."].types).toBe("./dist/index.d.ts");
    expect(packageJson.exports["."].import).toBe("./dist/index.js");
    expect(packageJson.exports["."].require).toBe("./dist/index.cjs");
  });

  test("keeps the runtime dependency-free", () => {
    expect(packageJson.dependencies).toBeUndefined();
    expect(packageJson.peerDependencies).toBeUndefined();
    expect(packageJson.optionalDependencies).toBeUndefined();
  });

  test("publishes only runtime artifacts and project documentation", () => {
    expect(packageJson.files).toEqual(["dist", "license.md", "readme.md"]);
  });

  test("keeps Bun and tsdown as the project toolchain", () => {
    expect(packageJson.packageManager).toStartWith("bun@");
    expect(packageJson.scripts.build).toBe("tsdown");
    expect(packageJson.devDependencies.tsdown).toBeDefined();
  });
});

import { describe, expect, test } from "bun:test"
import * as cvx from "../src"

const packageJson = await Bun.file("package.json").json()
describe("package", () => {
  test("exposes only the intended runtime API", () => {
    expect(Object.keys(cvx).sort()).toEqual(["cn", "cv", "cx"])
    expect(typeof cvx.cn).toBe("function")
    expect(typeof cvx.cv).toBe("function")
    expect(typeof cvx.cx).toBe("function")
  })
  test("publishes one dependency-free package entrypoint", () => {
    expect(packageJson.name).toBe("@obvia/cvx")
    expect(Object.keys(packageJson.exports)).toEqual(["."])
    expect(packageJson.dependencies).toBeUndefined()
    expect(packageJson.peerDependencies).toBeUndefined()
    expect(packageJson.optionalDependencies).toBeUndefined()
  })
  test("keeps the release payload limited to build output and project docs", () => {
    expect(packageJson.files).toEqual(["dist", "license.md", "readme.md"])
    expect(packageJson.scripts.build).toBe("tsdown")
    expect(packageJson.packageManager).toStartWith("bun@")
  })
})

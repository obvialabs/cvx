import { describe, expect, test } from "bun:test";

import * as cvx from "../../src/index";

describe("public API guard", () => {
  test("exports only the three runtime functions", () => {
    expect(Object.keys(cvx).sort()).toEqual(["cn", "cv", "cx"]);
    expect(typeof cvx.cv).toBe("function");
    expect(typeof cvx.cn).toBe("function");
    expect(typeof cvx.cx).toBe("function");
  });

  test("does not leak implementation helpers", () => {
    const surface = cvx as Record<string, unknown>;

    for (const key of [
      "configure",
      "createConfiguredCn",
      "createConfiguredMerge",
      "getSchema",
      "twJoin",
      "twMerge",
      "validators",
    ]) {
      expect(surface[key]).toBeUndefined();
    }
  });
});

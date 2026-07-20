import { describe, expect, it } from "vitest";

import { resolveRuntimeRequestUrl } from "./runtime";

describe("resolveRuntimeRequestUrl", () => {
  it("keeps browser proxy requests relative", () => {
    expect(resolveRuntimeRequestUrl("/atlas-api/nice/NA/war", false))
      .toBe("/atlas-api/nice/NA/war");
  });

  it("rewrites an allowed Atlas path on Android", () => {
    expect(resolveRuntimeRequestUrl("/atlas-api/nice/NA/war?lang=en", true))
      .toBe("https://api.atlasacademy.io/nice/NA/war?lang=en");
  });

  it("rejects paths outside the Atlas allowlist", () => {
    expect(() => resolveRuntimeRequestUrl("/atlas-api/admin", true))
      .toThrow("Atlas 请求路径不在允许范围内");
  });

  it("does not rewrite unrelated requests", () => {
    expect(resolveRuntimeRequestUrl("https://example.com/data", true))
      .toBe("https://example.com/data");
  });
});

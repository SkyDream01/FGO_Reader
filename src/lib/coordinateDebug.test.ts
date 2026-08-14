import { describe, expect, it } from "vitest";
import { isCoordinateDebugEnabled } from "./coordinateDebug";

describe("coordinate debug environment flag", () => {
  it("enables only for explicit truthy values", () => {
    expect(isCoordinateDebugEnabled("true")).toBe(true);
    expect(isCoordinateDebugEnabled("  ON ")).toBe(true);
    expect(isCoordinateDebugEnabled("1")).toBe(true);
    expect(isCoordinateDebugEnabled("false")).toBe(false);
    expect(isCoordinateDebugEnabled("0")).toBe(false);
    expect(isCoordinateDebugEnabled(undefined)).toBe(false);
  });
});

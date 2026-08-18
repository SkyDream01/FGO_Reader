import { describe, expect, it } from "vitest";
import { blurFilterCss } from "./blurFilter";

describe("blurFilterCss", () => {
  it("uses the supplied intensity as the CSS pixel radius", () => {
    expect(blurFilterCss(1.25)).toBe("blur(1.25px)");
    expect(blurFilterCss(0)).toBe("blur(0px)");
  });

  it("falls back safely for missing or invalid values", () => {
    expect(blurFilterCss(undefined)).toBe("none");
    expect(blurFilterCss(null)).toBe("none");
    expect(blurFilterCss("2")).toBe("none");
    expect(blurFilterCss(Number.NaN)).toBe("none");
    expect(blurFilterCss(Number.POSITIVE_INFINITY)).toBe("none");
    expect(blurFilterCss(-1)).toBe("none");
  });
});

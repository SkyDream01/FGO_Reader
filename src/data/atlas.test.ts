import { describe, expect, it } from "vitest";
import { characterTextureUrl, characterUrl } from "./atlas";

describe("characterUrl", () => {
  it("uses Atlas Academy's merged face sheet for character composition", () => {
    expect(characterUrl("JP", "1098255100")).toBe(
      "https://static.atlasacademy.io/JP/CharaFigure/1098255100/1098255100_merged.png",
    );
    expect(characterTextureUrl("JP", "1098255100")).toBe(
      "https://static.atlasacademy.io/JP/CharaFigure/1098255100/1098255100.png",
    );
  });
});

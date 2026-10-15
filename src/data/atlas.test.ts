import { describe, expect, it } from "vitest";
import { backgroundUrl, characterTextureUrl, characterUrl, imageUrl, pictureFrameUrl } from "./atlas";

describe("image resources", () => {
  it("uses Atlas's resource directory for images and masks", () => {
    expect(imageUrl("JP", "cut359_mask16")).toBe("https://static.atlasacademy.io/JP/Image/cut359_mask16/cut359_mask16.png");
    expect(imageUrl("JP", "Image/back10000")).toBe("https://static.atlasacademy.io/JP/Image/back10000/back10000.png");
    expect(imageUrl("JP", "back10000/back10000.png")).toBe("https://static.atlasacademy.io/JP/Image/back10000/back10000.png");
  });

  it("uses the cinema frame's full screen variant", () => {
    expect(pictureFrameUrl("JP", "cut063_cinema", true)).toBe("https://static.atlasacademy.io/JP/Image/cut063_cinema_fs/cut063_cinema_fs.png");
    expect(pictureFrameUrl("JP", "cut063_cinema")).toBe("https://static.atlasacademy.io/JP/Image/cut063_cinema/cut063_cinema.png");
    expect(pictureFrameUrl("JP", "other_frame", true)).toBe(imageUrl("JP", "other_frame"));
  });
});

describe("backgroundUrl", () => {
  it("selects Atlas's wide background only for full screen scripts", () => {
    expect(backgroundUrl("JP", "293500")).toBe("https://static.atlasacademy.io/JP/Back/back293500.png");
    expect(backgroundUrl("JP", "Back/back293500", true)).toBe("https://static.atlasacademy.io/JP/Back/back293500_1344_626.png");
    expect(backgroundUrl("CN", "123", true)).toBe("https://static.atlasacademy.io/CN/Back/back00123_1344_626.png");
    expect(backgroundUrl("JP", null, true)).toBe("");
  });
});

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

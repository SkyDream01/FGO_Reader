import { describe, expect, it } from "vitest";
import {
  STAGE_CALIBRATION_RATIOS,
  stageCoordinateToScreenOffset,
  stageRatioToViewport,
  stageCoordinateToViewport,
} from "./stageCoordinates";

describe("stage coordinates", () => {
  it("keeps the horizontal axis centered with positive values to the right", () => {
    expect(stageCoordinateToScreenOffset(-120, "x")).toBe(-120);
    expect(stageCoordinateToScreenOffset(120, "x")).toBe(120);
  });

  it("flips the vertical axis for CSS while keeping positive stage values upward", () => {
    expect(stageCoordinateToScreenOffset(120, "y")).toBe(-120);
    expect(stageCoordinateToScreenOffset(-120, "y")).toBe(120);
  });

  it("uses the original 1024x576 stage dimensions for viewport scaling", () => {
    expect(stageCoordinateToViewport(512, "x")).toBe("50vw");
    expect(stageCoordinateToViewport(288, "y")).toBe("-50dvh");
  });

  it("converts normalized screen and character offsets by their reference", () => {
    expect(stageRatioToViewport(0.5, "x", "screen")).toBe("50vw");
    expect(stageRatioToViewport(0.5, "y", "screen")).toBe("-50dvh");
    expect(stageRatioToViewport(0.5, "x", "character")).toBe("50vw");
  });

  it("keeps the production calibration in the renderer coordinate module", () => {
    expect(STAGE_CALIBRATION_RATIOS).toEqual({
      screen: { x: 0, y: -0.25 },
      character: { x: 0, y: 0.1 },
    });
  });
});

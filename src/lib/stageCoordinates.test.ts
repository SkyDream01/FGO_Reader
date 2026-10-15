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

  it("uses a shared scale for both axes of the native canvas", () => {
    expect(stageCoordinateToViewport(512, "x")).toBe("calc(512 * var(--adv-unit))");
    expect(stageCoordinateToViewport(288, "y")).toBe("calc(-288 * var(--adv-unit))");
  });

  it("converts normalized screen and character offsets by their reference", () => {
    expect(stageRatioToViewport(0.5, "x", "screen")).toBe("calc(672 * var(--adv-unit))");
    expect(stageRatioToViewport(0.5, "y", "screen")).toBe("calc(-288 * var(--adv-unit))");
    expect(stageRatioToViewport(0.5, "x", "character")).toBe("calc(512 * var(--adv-unit))");
  });

  it("keeps the production calibration in the renderer coordinate module", () => {
    expect(STAGE_CALIBRATION_RATIOS).toEqual({
      screen: { x: 0, y: 0 },
      character: { x: 0, y: 0 },
    });
  });
});

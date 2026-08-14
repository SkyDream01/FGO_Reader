import { describe, expect, it } from "vitest";
import {
  stageCoordinateToScreenOffset,
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
});

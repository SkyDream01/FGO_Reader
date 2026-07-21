import { describe, expect, it } from "vitest";
import type { CharacterFigureMetadata } from "../data/atlas";
import {
  resolveCharacterBaselineTop,
  resolveCharacterBodyHeight,
  resolveCharacterFaceRegion,
} from "./characterFigure";

const metadata: CharacterFigureMetadata = {
  id: 1098255100,
  faceX: 388,
  faceY: 160,
  offsetX: -5,
  offsetY: 152,
  extendData: {},
};

describe("resolveCharacterFaceRegion", () => {
  it("uses the merged image's body baseline instead of a fixed viewport cut", () => {
    const standardBodyHeight = resolveCharacterBodyHeight(1024, metadata);
    const tallBodyHeight = resolveCharacterBodyHeight(1200, {
      ...metadata,
      extendData: { faceSizeRect: [512, 320] },
    });

    expect(standardBodyHeight).toBe(768);
    expect(tallBodyHeight).toBe(1200);
    expect(resolveCharacterBaselineTop(standardBodyHeight) + standardBodyHeight).toBe(768);
    expect(resolveCharacterBaselineTop(tallBodyHeight) + tallBodyHeight).toBe(768);
  });

  it("locates standard 256px face differences in the merged sheet", () => {
    expect(resolveCharacterFaceRegion(14, 1024, metadata)).toEqual({
      sourceX: 256,
      sourceY: 1536,
      width: 256,
      height: 256,
    });
  });

  it("does not overlay a face when the script selects face zero", () => {
    expect(resolveCharacterFaceRegion(0, 1024, metadata)).toBeNull();
  });

  it("uses rectangular face metadata for nonstandard sheets", () => {
    expect(resolveCharacterFaceRegion(5, 1200, {
      ...metadata,
      extendData: { faceSizeRect: [512, 256] },
    })).toEqual({
      sourceX: 0,
      sourceY: 2224,
      width: 512,
      height: 256,
    });
  });
});

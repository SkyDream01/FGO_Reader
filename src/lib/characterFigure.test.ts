import { describe, expect, it } from "vitest";
import type { CharacterFigureMetadata } from "../data/atlas";
import {
  resolveCharacterBaselineTop,
  resolveCharacterAlphaContentRect,
  resolveCharacterCenterCorrection,
  resolveCharacterCanvasSize,
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

describe("character figure helpers", () => {
  it("finds visible content while ignoring transparent pixels", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    const setPixel = (x: number, y: number, alpha: number) => {
      data[(y * 4 + x) * 4 + 3] = alpha;
    };
    data[0] = 255;
    data[1] = 64;
    data[2] = 32;
    setPixel(0, 0, 0);
    setPixel(1, 1, 0);
    setPixel(2, 1, 128);
    setPixel(3, 3, 255);

    expect(resolveCharacterAlphaContentRect(data, 4, 4)).toEqual({
      left: 2,
      top: 1,
      width: 2,
      height: 3,
    });
    expect(resolveCharacterAlphaContentRect(data, 4, 4, 200)).toEqual({
      left: 3,
      top: 3,
      width: 1,
      height: 1,
    });
  });

  it("returns no content when every pixel is transparent", () => {
    const data = new Uint8ClampedArray(2 * 3 * 4);
    expect(resolveCharacterAlphaContentRect(data, 2, 3)).toBeNull();
  });

  it("calculates the center from a proportional content rectangle", () => {
    expect(resolveCharacterCenterCorrection({
      left: 1,
      top: 2,
      width: 4,
      height: 4,
    }, 8)).toEqual({
      x: 0.125,
      y: 0,
    });
  });

  it("keeps wide Atlas canvases intact", () => {
    expect(resolveCharacterCanvasSize(1024, 1024)).toBe(1024);
    expect(resolveCharacterCanvasSize(2048, 1024)).toBe(2048);
  });

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

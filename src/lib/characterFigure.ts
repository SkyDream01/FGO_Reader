import type { CharacterFigureMetadata } from "../data/atlas";

const FACE_PAGE_SIZE = 1024;
const DEFAULT_FACE_SIZE = 256;
const DEFAULT_FIGURE_HEIGHT = 1024;
const DEFAULT_FIGURE_BASELINE = 768;

export interface CharacterFaceRegion {
  sourceX: number;
  sourceY: number;
  width: number;
  height: number;
}

export interface CharacterContentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CharacterCenterCorrection {
  x: number;
  y: number;
}

/**
 * Finds the smallest rectangle containing pixels whose alpha channel is above
 * the supplied threshold. Pixels with RGB data but zero alpha are ignored.
 */
export function resolveCharacterAlphaContentRect(
  data: ArrayLike<number>,
  width: number,
  height: number,
  alphaThreshold = 0,
): CharacterContentRect | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return null;
  }

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if ((data[rowStart + x * 4 + 3] ?? 0) <= alphaThreshold) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < left || bottom < top) return null;
  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

/**
 * Calculates a normalized correction from a proportional character content
 * rectangle. The rectangle describes the non-transparent figure area without
 * inspecting individual pixels; 1 means 100% of the square figure canvas.
 */
export function resolveCharacterCenterCorrection(
  content: CharacterContentRect,
  stageSize = 1024,
): CharacterCenterCorrection {
  const contentCenterX = content.left + content.width / 2;
  const contentCenterY = content.top + content.height / 2;

  return {
    x: (stageSize / 2 - contentCenterX) / stageSize,
    y: (contentCenterY - stageSize / 2) / stageSize,
  };
}

/**
 * Atlas occasionally stores a story figure on a canvas wider than the
 * standard 1024px stage canvas. Keep the complete source canvas so the
 * renderer can scale it down instead of cropping its sides.
 */
export function resolveCharacterCanvasSize(figureWidth: number, figureHeight: number) {
  return Math.max(FACE_PAGE_SIZE, figureWidth, figureHeight);
}

export function resolveCharacterBodyHeight(
  figureHeight: number,
  metadata: CharacterFigureMetadata | null,
) {
  const faceHeight = metadata?.extendData.faceSizeRect?.[1]
    ?? metadata?.extendData.faceSize
    ?? DEFAULT_FACE_SIZE;
  return faceHeight === DEFAULT_FACE_SIZE && figureHeight === DEFAULT_FIGURE_HEIGHT
    ? figureHeight - faceHeight
    : figureHeight;
}

export function resolveCharacterBaselineTop(
  bodyHeight: number,
  baseline = DEFAULT_FIGURE_BASELINE,
) {
  return baseline - bodyHeight;
}

export function resolveCharacterFaceRegion(
  face: number,
  figureHeight: number,
  metadata: CharacterFigureMetadata,
): CharacterFaceRegion | null {
  if (!Number.isInteger(face) || face <= 0) return null;

  const width = metadata.extendData.faceSizeRect?.[0]
    ?? metadata.extendData.faceSize
    ?? DEFAULT_FACE_SIZE;
  const height = metadata.extendData.faceSizeRect?.[1]
    ?? metadata.extendData.faceSize
    ?? DEFAULT_FACE_SIZE;
  if (width <= 0 || height <= 0) return null;

  const perRow = Math.max(1, Math.floor(FACE_PAGE_SIZE / width));
  const faceIndex = face - 1;
  const column = faceIndex % perRow;
  const row = Math.floor(faceIndex / perRow);
  const page = Math.floor(row / perRow);
  const rowInPage = row % perRow;

  return {
    sourceX: column * width,
    sourceY: height === DEFAULT_FACE_SIZE && figureHeight === DEFAULT_FIGURE_HEIGHT
      ? DEFAULT_FIGURE_HEIGHT - DEFAULT_FACE_SIZE + height * row
      : figureHeight + FACE_PAGE_SIZE * page + rowInPage * height,
    width,
    height,
  };
}

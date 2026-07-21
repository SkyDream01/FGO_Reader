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

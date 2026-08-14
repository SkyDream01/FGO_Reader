export const STAGE_WIDTH = 1024;
export const STAGE_HEIGHT = 576;

/**
 * Production coordinate calibration. These values are part of the renderer,
 * not a debug preference: screen and character placement always include them.
 */
export const STAGE_CALIBRATION_RATIOS = {
  screen: { x: 0, y: -0.25 },
  character: { x: 0, y: 0.1 },
} as const;

export type StageAxis = "x" | "y";
export type StageCoordinateReference = "screen" | "character";

/**
 * Converts a stage-space coordinate into the screen-space direction used by
 * CSS. The authored stage coordinate system is centered on (0, 0), with X
 * increasing to the right and Y increasing upward.
 */
export function stageCoordinateToScreenOffset(value: number, axis: StageAxis) {
  return axis === "y" ? -value : value;
}

export function stageCoordinateToViewport(value: number, axis: StageAxis) {
  const dimension = axis === "x" ? STAGE_WIDTH : STAGE_HEIGHT;
  const viewportUnit = axis === "x" ? "vw" : "dvh";
  return `${stageCoordinateToScreenOffset(value, axis) * (100 / dimension)}${viewportUnit}`;
}

/**
 * Converts a normalized offset into viewport space. Screen ratios use the
 * screen axis dimensions; character ratios use the square 1024-unit figure
 * canvas for both axes.
 */
export function stageRatioToViewport(
  value: number,
  axis: StageAxis,
  reference: StageCoordinateReference = "screen",
) {
  const dimension = reference === "character"
    ? STAGE_WIDTH
    : axis === "x"
      ? STAGE_WIDTH
      : STAGE_HEIGHT;
  return stageCoordinateToViewport(value * dimension, axis);
}

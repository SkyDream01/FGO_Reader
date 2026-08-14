export const STAGE_WIDTH = 1024;
export const STAGE_HEIGHT = 576;

export type StageAxis = "x" | "y";

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

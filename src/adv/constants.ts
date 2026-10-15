/** RenderTexture dimensions, composition.md §2 and scene-cameras.md. */
export const STAGE_WIDTH = 1344;
export const STAGE_HEIGHT = 576;
export const LOGICAL_WIDTH = 1024;
export const STAGE_WIDTH_21_9 = 1346;
export const DEFAULT_FADE_TIME = 0.5;
export const CHARA_MAX = 26;
export const POSITION_LIST = [[-256, 0], [0, 0], [256, 0], [-438, 0], [-512, 0], [438, 0], [512, 0]] as const;
export const POSITION_X = POSITION_LIST.map(([x]) => x);
export const POSITION_SIDE_X = 96;
export const OFF_STAGE_X = STAGE_WIDTH / 2;
export const ReturnCode = { Normal: 0, Continue: 1, ReturnFalse: 2 } as const;
export type ReturnCode = typeof ReturnCode[keyof typeof ReturnCode];
export const StartMode = { None: "none", ClearBlack: "clear_black", ClearWhite: "clear_white", Black: "black", White: "white", Through: "through" } as const;
export type StartMode = typeof StartMode[keyof typeof StartMode];
export function startModeFromId(id: number | null | undefined): StartMode {
  if ([1, 12].includes(id ?? 0)) return StartMode.ClearBlack;
  if ([2, 13].includes(id ?? 0)) return StartMode.ClearWhite;
  if ([3, 6, 10].includes(id ?? 0)) return StartMode.Black;
  if ([4, 7, 11].includes(id ?? 0)) return StartMode.White;
  return StartMode.None;
}

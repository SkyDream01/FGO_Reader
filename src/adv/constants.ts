/**
 * Engine constants mirrored from the FGO client reverse engineering summary
 * (docs/FGO_Story_Reader_Standard.md §8 常量与枚举总表).
 */

/** Virtual stage canvas: 1024 × 576 (16:9), origin at the screen center. */
export const STAGE_WIDTH = 1024;
export const STAGE_HEIGHT = 576;

/** 21:9 ultra-wide extension width (PICTURE_FRAME_SPRITE_WIDTH_21_9). */
export const STAGE_WIDTH_21_9 = 1346;

/** Engine default fade duration in seconds (DEFAULT_FADE_TIME). */
export const DEFAULT_FADE_TIME = 0.5;

/** Maximum character slots (CHARA_MAX); slots are named A-Z. */
export const CHARA_MAX = 26;

/**
 * ScriptPosition.positionList — the seven authored placement slots.
 * `[charaSet A 98001000 0 マシュ]` resolves index 0 to (-256, 0).
 */
export const POSITION_LIST: ReadonlyArray<readonly [number, number]> = [
  [-256, 0],
  [0, 0],
  [256, 0],
  [-438, 0],
  [-512, 0],
  [438, 0],
  [512, 0],
];

/**
 * Reader-side classification boundaries kept from the previous pipeline so the
 * DOM renderer (and the e2e suite) see the same left/center/right semantics.
 * Values beyond ±OFF_STAGE_X are treated as off-stage staging positions.
 */
export const POSITION_X: readonly number[] = POSITION_LIST.map(([x]) => x);
export const OFF_STAGE_X = 1000;
export const POSITION_SIDE_X = 96;

/**
 * ScriptCommandExecuteReturnCode — the engine dispatcher return codes.
 * Continue keeps consuming instructions in the same frame (same-frame burst);
 * Normal suspends execution until the wait resolves.
 */
export const ReturnCode = {
  Normal: 0,
  Continue: 1,
  ReturnFalse: 2,
} as const;
export type ReturnCode = (typeof ReturnCode)[keyof typeof ReturnCode];

/** ScriptManager.State (17 states; reader implements the playback subset). */
export const ExecutorState = {
  Idle: "idle",
  Execute: "execute",
  Wait: "wait",
  WaitSkip: "wait_skip",
  Exit: "exit",
  Ended: "ended",
} as const;
export type ExecutorState = (typeof ExecutorState)[keyof typeof ExecutorState];

/**
 * StartMode (17 values; reader implements the visual subset that the story
 * corpus exercises). CLEAR_* start covered and auto-reveal; *_CLEAR/BLACK
 * variants stay covered until the script's own fade command reveals them.
 */
export const StartMode = {
  None: "none",
  ClearBlack: "clear_black",
  ClearWhite: "clear_white",
  Black: "black",
  White: "white",
  Through: "through",
} as const;
export type StartMode = (typeof StartMode)[keyof typeof StartMode];

export function startModeFromId(id: number | null | undefined): StartMode {
  switch (id) {
    case 1:
    case 12:
      return StartMode.ClearBlack;
    case 2:
    case 13:
      return StartMode.ClearWhite;
    case 3:
    case 6:
    case 10:
      return StartMode.Black;
    case 4:
    case 7:
    case 11:
      return StartMode.White;
    case 0:
    case 5:
    case 9:
    case 14:
    case 15:
    case 16:
    case 17:
      return StartMode.None;
    default:
      return StartMode.None;
  }
}

/** PlaySpeed — skip mode maps to FAST; option dialogs pause. */
export const PlaySpeed = {
  Normal: "normal",
  Fast: "fast",
  Pause: "pause",
} as const;
export type PlaySpeed = (typeof PlaySpeed)[keyof typeof PlaySpeed];

/** CharaData.Kind — the five slot content kinds sharing the A-Z pool. */
export const CharaKind = {
  Figure: "figure",
  Equip: "equip",
  Image: "image",
  VerticalImage: "vertical_image",
  HorizontalImage: "horizontal_image",
} as const;
export type CharaKind = (typeof CharaKind)[keyof typeof CharaKind];

/** UIScriptChara.ChangeKind — expression swap transition styles. */
export const ChangeKind = {
  None: "none",
  Normal: "normal",
  Fade: "fade",
  Blink: "blink",
  CrossFade: "cross_fade",
} as const;
export type ChangeKind = (typeof ChangeKind)[keyof typeof ChangeKind];

/**
 * Figure IDs the previous pipeline flagged as effect-only anchors. They exist
 * on stage but must not be rendered as character sprites.
 */
export const EFFECT_ONLY_CHARACTER_IDS: ReadonlySet<string> = new Set([
  "98014000",
  "98109200",
  "98115000",
]);

export const EFFECT_ONLY_NAME =
  /^(?:エフェクト用|特效用|特效专用|特效專用|이펙트용|effect\s*(?:only|anchor|use)?)(?:[\s_-]*(?:dummy|ダミー|더미))?$/i;

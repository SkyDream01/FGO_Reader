/**
 * The coordinate tools are opt-in and compile-time controlled. Vite exposes
 * only variables prefixed with VITE_ to the browser bundle.
 */
const DEBUG_ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export function isCoordinateDebugEnabled(value: unknown) {
  return typeof value === "string"
    && DEBUG_ENABLED_VALUES.has(value.trim().toLowerCase());
}

export const COORDINATE_DEBUG_ENABLED = isCoordinateDebugEnabled(
  import.meta.env.VITE_COORDINATE_DEBUG,
);

/**
 * DEBUG ONLY.
 *
 * All offsets are normalized ratios: 1 means 100% of the reference axis.
 * Positive X moves right and positive Y moves up. The character 0,0 marker
 * stays at the screen-origin offset plus the authored character coordinate;
 * the character image additionally receives this local origin ratio. Keep
 * this block isolated so it can be removed together with its call sites after
 * calibration.
 */
export interface CoordinateDebugOffset {
  /** Normalized ratio; 1 means 100% of the relevant reference axis. */
  x: number;
  y: number;
}

export interface CoordinateDebugSettings {
  screenOrigin: CoordinateDebugOffset;
  characterOrigin: CoordinateDebugOffset;
  showScreenOrigin: boolean;
  showCharacterOrigin: boolean;
}

export const DEBUG_COORDINATE_OFFSETS = {
  // Production calibration lives in stageCoordinates.ts. These are only
  // temporary session-local additions from the debug panel.
  screenOrigin: { x: 0, y: 0 },
  characterOrigin: { x: 0, y: 0 },
  showScreenOrigin: true,
  showCharacterOrigin: true,
} satisfies CoordinateDebugSettings;

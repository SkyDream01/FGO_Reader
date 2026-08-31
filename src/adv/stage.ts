import type { CharacterPosition } from "../types";
import {
  EFFECT_ONLY_CHARACTER_IDS,
  EFFECT_ONLY_NAME,
  POSITION_SIDE_X,
} from "./constants";

/**
 * Live stage state (docs/FGO_Story_Reader_Standard.md S-R2 合成层栈).
 *
 * The executor mutates this state directly; commands launch tweens against it
 * and the renderer receives an immutable snapshot each version bump.
 * L0 background / L1 characters / L2 effects / L3 transitions / L4 picture
 * frame / L5 message window / L6 system UI (the last one lives in React).
 */

export interface CharacterSlotState {
  slot: string;
  id: string;
  name: string;
  face: number;
  /** Fade visibility (engine isWaitTalkMoveAlpha equivalent). */
  visible: boolean;
  onStage: boolean;
  position: CharacterPosition;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  silhouette: boolean;
  shadow: boolean;
  layer: "main" | "sub";
  depth: number | null;
  effectOnly: boolean;
}

export interface StageLayerSlotState {
  slot: string;
  id: string;
  source: "background" | "image";
  visible: boolean;
  onStage: boolean;
  position: CharacterPosition;
  x: number;
  y: number;
  scale: number;
  layer: "main" | "sub";
  depth: number | null;
}

export interface CameraState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  filter: string | null;
}

export interface BackgroundState {
  /** Back buffer A — the visible scene id. */
  current: string | null;
  /** Back buffer B — the scene being cross-faded away from. */
  previous: string | null;
  /** Cross-fade progress 0..1 (buffer B is fully gone at 1). */
  crossfade: number;
  /** Cross-fade duration in seconds; 0 means a hard cut. */
  crossfadeDuration: number;
  /** Bumped on every scene change so React remounts the image. */
  seq: number;
  /** Last transition requested alongside a scene change. */
  transition: "fade" | "wipe" | "none";
}

export interface FadeOverlayState {
  color: string | null;
  /** 0 → transparent, 1 → fully covered (meshFadeBase alpha). */
  alpha: number;
  /** Bumped whenever a new fade starts; React keys the overlay animation on it. */
  seq: number;
  direction: "in" | "out" | "move";
  duration: number;
}

export interface WipeOverlayState {
  color: string | null;
  seq: number;
  kind: "in" | "out" | "filter" | "ex";
  duration: number;
}

export interface FlashState {
  color: string | null;
  seq: number;
  duration: number;
}

export interface ShakeState {
  seq: number;
  amplitudeX: number;
  amplitudeY: number;
  cycle: number;
  duration: number;
}

export interface StageAudioState {
  bgm: string | null;
  bgmVolume: number | null;
}

export interface StageEffectState {
  effectName: string | null;
  overlaySeq: number;
}

export function isEffectOnlyCharacter(id: string, name: string): boolean {
  return EFFECT_ONLY_CHARACTER_IDS.has(id) || EFFECT_ONLY_NAME.test(name);
}

/**
 * Resolves a placement token: either a slot-table index (0-6), an explicit
 * `X,Y` coordinate, or a raw coordinate value. Returns the stage-space
 * position plus the reader's left/center/right classification.
 */
export function resolvePlacement(token?: string): {
  position: CharacterPosition;
  onStage: boolean;
  x: number;
  y: number;
} {
  let x = 0;
  let y = 0;
  if (token?.includes(",")) {
    const [rawX, rawY] = token.split(",", 2);
    x = Number.parseFloat(rawX);
    y = Number.parseFloat(rawY);
  } else {
    const index = Number.parseInt(token ?? "1", 10);
    x = Number.isFinite(index) ? resolveSlotIndex(Number.isFinite(index) ? index : 1) : 0;
  }
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(y)) y = 0;

  if (Math.abs(x) >= 1000) {
    return { position: x < 0 ? "left" : "right", onStage: false, x, y };
  }
  if (x < -POSITION_SIDE_X) return { position: "left", onStage: true, x, y };
  if (x > POSITION_SIDE_X) return { position: "right", onStage: true, x, y };
  return { position: "center", onStage: true, x, y };
}

function resolveSlotIndex(index: number): number {
  // Slot table per docs §8; out-of-range indexes fall back to 0 (engine).
  const table = [-256, 0, 256, -438, -512, 438, 512];
  return table[index] ?? table[0];
}

export function parseCoordinateToken(token?: string): { x: number; y: number } | null {
  if (!token?.includes(",")) return null;
  const [rawX, rawY] = token.split(",", 2);
  const x = Number.parseFloat(rawX);
  const y = Number.parseFloat(rawY);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function parseBlurIntensity(args: readonly string[], typeIndex: number): number | null {
  // `blur` is `[blur type intensity ...]`; `subBlur`/`subBlur2` add a layer
  // argument before the type.
  const token = args[typeIndex + 1]?.trim();
  if (!token) return null;
  const intensity = Number(token);
  return Number.isFinite(intensity) && intensity >= 0 ? intensity : null;
}

export class Stage {
  background: BackgroundState = {
    current: null,
    previous: null,
    crossfade: 1,
    crossfadeDuration: 0,
    seq: 0,
    transition: "none",
  };

  characters = new Map<string, CharacterSlotState>();
  layers = new Map<string, StageLayerSlotState>();
  camera: CameraState = { x: 0, y: 0, scale: 1, rotation: 0, filter: null };

  /** L5 message window visibility ([messageOff]/[messageOn]). */
  messageVisible = true;
  /** Sub-render layer visibility ([charaTalk depthOn]/[subRenderOn]/[subCameraOn]). */
  subRenderVisible = false;
  /** Active speaker slots (＠ talkName matching + [charaTalk A,B]). */
  talkSlots: string[] = [];

  blur: number | null = null;
  screenEffect: StageEffectState = { effectName: null, overlaySeq: 0 };
  pictureFrame: string | null = null;
  movie: string | null = null;

  fade: FadeOverlayState = { color: null, alpha: 0, seq: 0, direction: "in", duration: 0.5 };
  wipe: WipeOverlayState = { color: null, seq: 0, kind: "in", duration: 0.5 };
  flash: FlashState = { color: null, seq: 0, duration: 0.3 };
  shake: ShakeState = { seq: 0, amplitudeX: 0, amplitudeY: 0, cycle: 0, duration: 0 };

  audio: StageAudioState = { bgm: null, bgmVolume: null };

  /** Bumped on every visible mutation; the snapshot cache keys off it. */
  version = 0;

  touch(): void {
    this.version += 1;
  }

  getStageSlot(slot: string): CharacterSlotState | StageLayerSlotState | undefined {
    return this.characters.get(slot) ?? this.layers.get(slot);
  }

  /**
   * Applies a placement token to any stage slot; shared by charaPut/charaMove/
   * charaFadein/overlayFadein families.
   */
  applyPlacement(
    target: CharacterSlotState | StageLayerSlotState,
    token?: string,
    visible?: boolean,
  ): void {
    const placement = resolvePlacement(token);
    target.position = placement.position;
    target.onStage = placement.onStage;
    target.x = placement.x;
    target.y = placement.y;
    if (visible !== undefined) target.visible = visible;
    this.touch();
  }

  /** Reveals a slot at a position; both an omitted token and `1` resolve center. */
  applyFadein(
    target: CharacterSlotState | StageLayerSlotState,
    token?: string,
  ): void {
    this.applyPlacement(target, token, true);
  }

  requestFade(options: Partial<FadeOverlayState> & { color?: string | null }): void {
    this.fade = {
      color: options.color ?? this.fade.color,
      alpha: options.alpha ?? this.fade.alpha,
      seq: this.fade.seq + 1,
      direction: options.direction ?? this.fade.direction,
      duration: options.duration ?? this.fade.duration,
    };
    this.touch();
  }

  requestFlash(color: string | null, duration = 0.3): void {
    this.flash = { color, seq: this.flash.seq + 1, duration };
    this.touch();
  }

  requestWipe(options: { color?: string | null; kind?: WipeOverlayState["kind"]; duration?: number }): void {
    this.wipe = {
      color: options.color ?? this.wipe.color,
      seq: this.wipe.seq + 1,
      kind: options.kind ?? this.wipe.kind,
      duration: options.duration ?? this.wipe.duration,
    };
    this.touch();
  }

  requestShake(amplitudeX = 0, amplitudeY = 0, cycle = 0, duration = 0): void {
    this.shake = { seq: this.shake.seq + 1, amplitudeX, amplitudeY, cycle, duration };
    this.touch();
  }

  setScene(id: string | null, transition: "fade" | "wipe" | "none", crossfadeDuration: number): void {
    if (this.background.current === id) {
      // Same id re-request: still refresh the transition beat if animated.
      if (transition !== "none" && crossfadeDuration > 0) {
        this.background = { ...this.background, transition, seq: this.background.seq + 1 };
        this.touch();
      }
      return;
    }
    this.background = {
      previous: crossfadeDuration > 0 ? this.background.current : null,
      current: id,
      crossfade: crossfadeDuration > 0 ? 0 : 1,
      crossfadeDuration,
      seq: this.background.seq + 1,
      transition,
    };
    this.touch();
  }

  setBgm(name: string | null, volume: number | null): void {
    this.audio = { bgm: name, bgmVolume: volume };
    this.touch();
  }

  setScreenEffect(name: string | null): void {
    this.screenEffect = {
      effectName: name,
      overlaySeq: name ? this.screenEffect.overlaySeq + 1 : this.screenEffect.overlaySeq,
    };
    this.touch();
  }
}

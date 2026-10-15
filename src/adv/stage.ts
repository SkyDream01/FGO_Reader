import type { CharacterPosition } from "../types";
import { POSITION_LIST } from "./constants";

export interface TransformState { x: number; y: number; scale: number; rotation: number }
export interface CameraState extends TransformState { filter: string | null; pivot: { x: number; y: number } }
export interface CharacterSlotState extends TransformState {
  slot: string;
  id: string;
  name: string;
  face: number;
  kind: "figure" | "background" | "image";
  position: CharacterPosition;
  alpha: number;
  visible: boolean;
  silhouette: boolean;
  shadow: boolean;
  filter: string | null;
  color: string | null;
  layer: "main" | "sub";
  group: string;
  depth: number;
  mode: string;
  shakeX: number;
  shakeY: number;
  basePosition: { x: number; y: number };
  rollAxis: { x: number; y: number; z: number; stopAngle: number; wait: boolean };
  pivot: { x: number; y: number };
  cut: { name: string; progress: number; paused: boolean; duration: number; level: number } | null;
  change: { id: string; face: number; progress: number } | null;
  maskInteraction: "none" | "inside" | "outside";
  fullScreenScale: string;
  alphaLoop: { infinite: boolean; last: number } | null;
  relativeLoopOrigin: { x: number; y: number } | null;
}
export type StageLayerSlotState = CharacterSlotState;
export interface SubLayerState extends TransformState {
  key: string;
  camera: CameraState;
  cameraEnabled: boolean;
  visible: boolean;
  alpha: number;
  depth: number;
  blur: number | null;
  mask: string | null;
  maskEdge: { width: number; color: string } | null;
  shakeX: number;
  shakeY: number;
  stretch: TransformState;
  blurKind: string;
}
export interface FadeOverlayState { color: string | null; alpha: number; seq: number }
export interface WipeOverlayState extends FadeOverlayState { kind: string; name: string; progress: number; level: number }
export interface FlashState extends FadeOverlayState { mode: string; slot?: string }
export interface ShakeState { seq: number; x: number; y: number }
export interface EffectInstance {
  id: number; container: string; name: string; assetName: string; x: number; y: number;
  flip: string; status: "loading" | "paused" | "start" | "loop" | "end";
  loading: boolean; busy: boolean; progress: number; opacity: number; elapsed: number;
  preset: "particles" | "slash" | "rays" | "smoke" | "rain" | "noise" | "ring";
  color: string; markKey?: string;
  parameters: Record<string, string>;
  duration: number;
  range: number;
}
export interface CommunicationState {
  svtId: string; limitCount: number; face: number; x: number; y: number; depth: number;
  noiseKind: number; loop: boolean; loaded: boolean; busy: boolean; opacity: number; elapsed: number;
}
export interface InsertionState extends TransformState { name: string; active: boolean; loading: boolean; phase: "ready" | "in" | "out"; progress: number; images: string[] }
export interface FsmState { assetName: string; objectName: string; loading: boolean; playing: boolean; state: string; events: string[]; variables: Record<string, boolean | number | string>; x: number; y: number; layer: string }
export interface MovieState { name: string; blocking: boolean; elapsed: number; duration: number; bgmPause: boolean; sePause: boolean; voicePause: boolean; ready: boolean }
export const homeTransform = (): TransformState => ({ x: 0, y: 0, scale: 1, rotation: 0 });
export const homeCamera = (): CameraState => ({ ...homeTransform(), filter: null, pivot: { x: 0, y: 0 } });
export const positionKind = (x: number): CharacterPosition => x < -96 ? "left" : x > 96 ? "right" : "center";

export function resolvePlacement(token = "1") {
  const pair = token.includes(",") ? token.split(",").map(Number) : POSITION_LIST[Number(token)] ?? POSITION_LIST[0];
  const x = Number.isFinite(pair[0]) ? pair[0] : 0, y = Number.isFinite(pair[1]) ? pair[1] : 0;
  return { x, y, position: positionKind(x), onStage: true };
}
export function parseCoordinateToken(token?: string): { x: number; y: number } | null {
  if (!token?.includes(",")) return null;
  const [x, y] = token.split(",").map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}
export function parseBlurIntensity(args: readonly string[], typeIndex: number): number | null {
  const n = Number(args[typeIndex + 1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Unity figure/background/image kinds share a single A–Z slot pool. */
export class Stage {
  slots = new Map<string, CharacterSlotState>();
  subLayers = new Map<string, SubLayerState>();
  background = { current: null as string | null, previous: null as string | null, crossfade: 1, seq: 0, mode: "DEFAULT" };
  camera = homeCamera();
  fullScreen = false;
  messageVisible = true;
  messageFont = 29;
  messageFontAlign: "top" | "center" | "bottom" | undefined = undefined;
  messageAlign: "left" | "center" | "right" = "left";
  talkSlots: string[] = [];
  talkDepth = true;
  talkMask = true;
  blur: number | null = null;
  pictureFrame: string | null = null;
  pictureFrameTop = false;
  movie: MovieState | null = null;
  audio = { bgm: null as string | null, bgmVolume: null as number | null, fade: 0.9, keepSubBgm: 0 };
  audioStopAtEnd = false;
  effects = new Map<number, EffectInstance>();
  effectSequence = 0;
  communication: CommunicationState | null = null;
  fsm = new Map<string, FsmState>();
  insertions = new Map<string, InsertionState>();
  adv = { setup: false, name: "", object: "", actors: new Map<string, { visible: boolean; goNext: boolean; trigger: string }>() };
  backColor: string | null = "#000";
  capture: { slots: CharacterSlotState[]; subLayers: SubLayerState[]; background: string | null; camera: CameraState; effects: EffectInstance[]; communication: CommunicationState | null; blur: number | null; stretch: TransformState; fade: FadeOverlayState; mask: FadeOverlayState; wipe: WipeOverlayState; flash: FlashState } | null = null;
  simpleMeshFigures: string[] = [];
  spriteMask: string | null = null;
  distortion = { enabled: false, centerX: 0, centerY: 0, strength: 0, range: 0, coefficient: 0 };
  stretch = homeTransform();
  subStretch = true;
  blurKind = "GaussianBlur";
  messageStyle = { verticalAlign: "top" as "top" | "center" | "bottom", lineHeight: null as number | null, font: "normal", skin: "normal", nameBack: null as string | null, shake: { x: 0, y: 0 }, screen: null as { background: boolean; x: number; y: number; width: number; height: number } | null, speedForcedNormal: false, turnPageDisabled: false, turnPageForce: false, scrollStop: false };
  policy = { skip: false, tapSkipLabel: null as string | null, tapSkipFade: null as string | null, dontResetPress: false, backLog: true, backlogOnly: false, hideAuto: false, hideLog: false, selectionCentering: true, reward: true };
  notification: { title: string; text: string } | null = null;
  endFade: "clear" | "black" | "white" = "clear";
  screenEffect: string | null = null;
  screenEffectSeq = 0;
  fade: FadeOverlayState = { color: null, alpha: 0, seq: 0 };
  mask: FadeOverlayState = { color: null, alpha: 0, seq: 0 };
  wipe: WipeOverlayState = { color: null, alpha: 0, seq: 0, kind: "in", name: "", progress: 1, level: 1 };
  flash: FlashState = { color: null, alpha: 0, seq: 0, mode: "once" };
  shake: ShakeState = { seq: 0, x: 0, y: 0 };
  version = 0;
  touch(): void { this.version++; }
  reset(): void {
    const version = this.version + 1;
    Object.assign(this, new Stage());
    this.version = version;
  }
  getStageSlot(slot: string): CharacterSlotState | undefined { return this.slots.get(slot); }
  subLayer(key = "#A"): SubLayerState {
    let group = this.subLayers.get(key);
    if (!group) {
      // Setting up a camera or assigning sprites must not expose its window
      // before the script's first subRenderFadein.
      group = { ...homeTransform(), key, camera: homeCamera(), cameraEnabled: true, visible: false, alpha: 0, depth: 1, blur: null, mask: null, maskEdge: null, shakeX: 0, shakeY: 0, stretch: homeTransform(), blurKind: "GaussianBlurThrough" };
      this.subLayers.set(key, group);
    }
    return group;
  }
  setSlot(slot: string, id: string, kind: CharacterSlotState["kind"], placement = "1", name = "", mode = "1"): CharacterSlotState | null {
    if (!/^[A-Z]$/.test(slot)) return null;
    const point = resolvePlacement(placement);
    const state: CharacterSlotState = { ...homeTransform(), ...point, slot, id, kind, name, face: 0, alpha: 0, visible: false, silhouette: false, shadow: false, filter: null, color: null, layer: "main", group: "#A", depth: 0, mode, shakeX: 0, shakeY: 0, basePosition: { x: point.x, y: point.y }, rollAxis: { x: 0, y: 0, z: 1, stopAngle: 0, wait: false }, pivot: { x: 0, y: 0 }, cut: null, change: null, maskInteraction: "none", fullScreenScale: "0", alphaLoop: null, relativeLoopOrigin: null };
    this.slots.set(slot, state);
    this.touch();
    return state;
  }
  applyPlacement(target: CharacterSlotState, token?: string, visible?: boolean): void {
    Object.assign(target, resolvePlacement(token));
    if (visible !== undefined) { target.visible = visible; target.alpha = visible ? 1 : 0; }
    this.touch();
  }
}

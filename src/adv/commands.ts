import type { AudioIntent } from "./audio";
import type { Instruction } from "./instruction";
import { DEFAULT_FADE_TIME } from "./constants";
import { EMPTY_COMMANDS, FONT_SIZES } from "./spec";
import { backgroundId } from "./resources";
import { homeCamera, homeTransform, positionKind, resolvePlacement, type CharacterSlotState, type TransformState, type Stage } from "./stage";
import { lerp, type TweenService } from "./tween";
import { executePresentationCommand } from "./presentation";
import { sideOffset, unquote } from "./motion";
import { executeSoundCommand } from "./soundCommands";

export interface CommandContext {
  stage: Stage;
  tweens: TweenService;
  masterGender: "male" | "female";
  fastForward: boolean;
  reduceMotion: boolean;
  aspectRatio: number;
  emitAudio: (intent: AudioIntent) => void;
  onUnhandled: (tag: string) => void;
  diagnose: (tag: string, reason: string) => void;
  requestWait: (type: string, target?: string) => void;
  retryNextFrame: () => void;
}
const number = (value: string | undefined, fallback = 0) => {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) ? parsed : fallback;
};
const positive = (value: string | undefined, fallback = DEFAULT_FADE_TIME) => Math.max(0, number(value, fallback));
export function cssColor(value = "black"): string {
  if (value === "black") return "#000";
  if (value === "white") return "#fff";
  if (value === "clear") return "#00000000";
  if (/^#?[\da-fA-F]{6}(?:[\da-fA-F]{2})?$/.test(value)) return `#${value.replace(/^#/, "")}`;
  return "#000";
}

function animate(ctx: CommandContext, owner: string, target: object, values: Record<string, number>, seconds: number, easing?: string, complete?: () => void): void {
  const record = target as Record<string, number>;
  const from = Object.fromEntries(Object.keys(values).map((key) => [key, record[key]]));
  ctx.tweens.add({ owner, duration: ctx.fastForward || ctx.reduceMotion ? 0 : seconds, easing,
    onUpdate: (progress) => { for (const key of Object.keys(values)) record[key] = lerp(from[key], values[key], progress); ctx.stage.touch(); }, onComplete: complete });
}

function withSide(point: { x: number; y: number }, tag: string, ctx: CommandContext) {
  if (!/FS(?:L|R|SideL|SideR)/.test(tag)) return point;
  return { x: point.x + sideOffset(tag, ctx.aspectRatio), y: point.y };
}

function shake(ctx: CommandContext, owner: string, target: { x: number; y: number }, duration: number, cycle: number, x: number, y: number): void {
  ctx.tweens.cancel(owner);
  target.x = 0; target.y = 0;
  if (ctx.fastForward || ctx.reduceMotion || !duration) return;
  ctx.tweens.add({ owner, duration, onUpdate: (t) => {
    const sample = Math.floor(t * duration / Math.max(0.001, cycle));
    // Native InvokeRepeating chooses independent uniform offsets each cycle.
    // A deterministic seed makes reconstructed frames reproducible on back/resume.
    const random = (seed: number) => {
      let value = (sample + 1) ^ seed;
      value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
      value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
      return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff * 2 - 1;
    };
    target.x = random(0x1234) * x; target.y = random(0x5678) * y; ctx.stage.touch();
  }, onComplete: () => { target.x = 0; target.y = 0; ctx.stage.touch(); } });
}

/** Presentation commands return whether the browser implements their behavior. */
export function executeStageCommand(instruction: Instruction, ctx: CommandContext): boolean {
  const { stage, tweens } = ctx, { tag, pd } = instruction, p = instruction.params.map(unquote);
  const base = tag.replace(/FS(?:Side[LR]|[LR])(?:NotNotch)?$/, "");
  const slot = stage.getStageSlot(p[0]);
  const subKey = p[0]?.startsWith("#") ? p[0] : "#A";
  const subArgs = p[0]?.startsWith("#") ? p.slice(1) : p;
  if (EMPTY_COMMANDS.has(tag)) return true;
  if (tag === "enableFullScreen") { stage.fullScreen = true; stage.touch(); return true; }
  if (executePresentationCommand(instruction, ctx)) return true;
  if (executeSoundCommand(instruction, ctx)) return true;

  if (/^(?:chara|figure|equip|scene|image|verticalImage|horizontalImage)(?:Set|Change|CrossFade)$/.test(tag) || /^master(?:Set|Change|ImageSet|ImageChange|VerticalImageSet|VerticalImageChange|HorizontalImageSet|HorizontalImageChange)$/.test(tag)) {
    const master = tag.startsWith("master"), offset = master ? (ctx.masterGender === "female" ? 2 : 1) : 1;
    const id = p[offset];
    if (!id) { ctx.diagnose(tag, "parameter error"); return true; }
    const kind: CharacterSlotState["kind"] = tag === "sceneSet" ? "background" : /(?:[Ii]mage)/.test(tag) ? "image" : "figure";
    const old = stage.slots.get(p[0]);
    const placement = p[master ? 3 : 2] ?? "1";
    if (/Change|CrossFade/.test(tag) && old) {
      old.change = /CrossFade/.test(tag) ? { id: old.id, face: old.face, progress: 0 } : null;
      old.id = id; old.face = 0; old.kind = kind;
      if (old.change) {
        animate(ctx, `chara:${old.slot}:change`, old.change, { progress: 1 }, positive(p[2]), undefined, () => { old.change = null; stage.touch(); });
        ctx.requestWait("charaChange", old.slot);
      }
    } else {
      tweens.cancelByPrefix(`chara:${p[0]}:`);
      for (const effect of stage.effects.values()) if (effect.container.startsWith(`chara:${p[0]}:`)) { tweens.cancelByPrefix(`effect:${effect.id}:`); stage.effects.delete(effect.id); }
      const created = stage.setSlot(p[0], kind === "background" ? backgroundId(id) : id, kind, placement, p[master ? 4 : 3] ?? "", /verticalImage/i.test(tag) ? "vertical" : /horizontalImage/i.test(tag) ? "horizontal" : "normal");
      if (!created) { ctx.diagnose(tag, "parameter error"); return true; }
      if (kind !== "figure") created.fullScreenScale = p[master ? 4 : 3] ?? "0";
      if (tag === "equipSet" || tag === "equipChange") created.mode = "equip";
      // Four anomalous authored imageSet lines put an explicit coordinate in the mode field.
      if (kind !== "figure" && p[2]?.includes(",")) stage.applyPlacement(created, p[2]);
    }
    if (tag.startsWith("equip")) { const equip = stage.slots.get(p[0]); if (equip) equip.mode = "equip"; ctx.diagnose(tag, "CharaGraph 以普通卡面显示，渐变和裁切为近似"); }
    stage.touch(); return true;
  }
  if (tag === "scene" || tag === "bScene" || tag === "masterScene") {
    const master = tag === "masterScene";
    const id = p[master && ctx.masterGender === "female" ? 1 : 0];
    const duration = positive(p[master ? 2 : 1], 0);
    stage.background = { current: id ? backgroundId(id) : null, previous: stage.background.current, crossfade: 0, seq: stage.background.seq + 1, mode: p[master ? 3 : 2] ?? "DEFAULT" };
    animate(ctx, "scene", stage.background, { crossfade: 1 }, duration, undefined, () => { stage.background.previous = null; stage.touch(); });
    return true;
  }
  if (tag === "charaTalk") {
    if (p[0] === "depthOn" || p[0] === "depthOff") stage.talkDepth = p[0] === "depthOn";
    else if (p[0] === "off" || p[0] === "on") stage.talkMask = p[0] === "on";
    else stage.talkSlots = p.join(",").split(",").filter((part) => /^[A-Z]$/.test(part));
    stage.touch(); return true;
  }
  if (tag === "charaClear") {
    tweens.cancelByPrefix(`chara:${p[0]}:`); stage.slots.delete(p[0]);
    for (const effect of stage.effects.values()) if (effect.container.startsWith(`chara:${p[0]}:`)) { tweens.cancelByPrefix(`effect:${effect.id}:`); stage.effects.delete(effect.id); }
    stage.touch(); return true;
  }
  if (tag.startsWith("chara") || tag === "overlayFadein") {
    if (!slot) return true;
    const owner = `chara:${slot.slot}:`;
    switch (base) {
      case "charaFace": slot.face = Math.max(0, number(p[1])); break;
      case "charaFaceFade": {
        slot.change = { id: slot.id, face: slot.face, progress: 0 }; slot.face = Math.max(0, number(p[1]));
        animate(ctx, owner + "change", slot.change, { progress: 1 }, positive(p[2]), undefined, () => { slot.change = null; stage.touch(); });
        ctx.requestWait("charaChange", slot.slot); break;
      }
      case "charaPut": case "charaRelativePut": {
        const point = withSide(resolvePlacement(p[1]), tag, ctx);
        if (base === "charaRelativePut") { point.x += slot.x; point.y += slot.y; }
        if (base === "charaPut") slot.visible = true;
        tweens.cancel(owner + "move"); Object.assign(slot, point); slot.position = positionKind(slot.x); break;
      }
      case "charaFadein": case "overlayFadein":
        slot.visible = true;
        if (p[2] !== undefined) Object.assign(slot, withSide(resolvePlacement(p[2]), tag, ctx));
        slot.position = positionKind(slot.x);
        animate(ctx, owner + "alpha", slot, { alpha: 1 }, positive(p[1])); break;
      case "charaFadeout":
        animate(ctx, owner + "alpha", slot, { alpha: 0 }, positive(p[1]), undefined, () => { slot.visible = false; stage.touch(); }); break;
      case "charaFadeTime": {
        const alpha = Math.max(0, Math.min(1, number(p[2], 1)));
        if (alpha > 0) slot.visible = true;
        animate(ctx, owner + "alpha", slot, { alpha }, positive(p[1]), undefined, () => { if (alpha === 0) slot.visible = false; stage.touch(); }); break;
      }
      case "charaMove": case "charaMoveEase": case "charaMoveReturn": case "charaMoveReturnEase": {
        const ease = base.includes("Ease"), returns = base.includes("Return");
        const spacedPair = ease && !p[1]?.includes(",") && p.length >= 5;
        const point = withSide(resolvePlacement(spacedPair ? `${p[1]},${p[2]}` : p[1]), tag, ctx);
        const durationIndex = spacedPair ? 3 : 2;
        const original = { x: slot.x, y: slot.y };
        animate(ctx, owner + "move", slot, point, positive(p[durationIndex], 0), ease ? p[durationIndex + 1] : undefined, () => {
          slot.position = positionKind(slot.x);
          if (returns) animate(ctx, owner + "move", slot, original, positive(p[durationIndex + (ease ? 2 : 1)], positive(p[durationIndex], 0)), ease ? p[durationIndex + 3] : undefined);
        }); break;
      }
      case "charaMoveScale": case "charaMoveScaleEase": animate(ctx, owner + "scale", slot, { scale: number(p[1], 1) }, positive(p[2]), p[3]); break;
      case "charaScale": tweens.cancel(owner + "scale"); slot.scale = number(p[1], 1); break;
      case "charaRoll": slot.rotation = number(p[1]); if (p[2]) { const point = resolvePlacement(p[2]); slot.pivot = { x: point.x, y: point.y }; } break;
      case "charaRollMove": case "charaRollMoveEx": animate(ctx, owner + "roll", slot, { rotation: number(p[1]) }, positive(p[2])); break;
      case "charaFilter": slot.filter = p[1] ?? null; slot.silhouette = p[1] === "silhouette"; slot.color = p[2] ? cssColor(p[2]) : null; break;
      case "charaShadow": slot.shadow = p[1] === "true" || p[1] === "on"; break;
      case "charaDepth": slot.depth = number(p[1]); break;
      case "charaLayer": slot.layer = p[1] === "sub" ? "sub" : "main"; slot.group = p[2] ?? "#A"; if (slot.layer === "sub") stage.subLayer(slot.group); break;
      case "charaRelativeLoopMove": case "charaRelativeLoopMoveEase": {
        const point = resolvePlacement(p[1]);
        const initial = { x: slot.x, y: slot.y };
        tweens.add({ owner: owner + "move", duration: positive(p[2]), loop: true, easing: p[3], onUpdate: (t) => { slot.x = initial.x + point.x * Math.sin(t * Math.PI * 2); slot.y = initial.y + point.y * Math.sin(t * Math.PI * 2); stage.touch(); } }); break;
      }
      case "charaRelativeLoopMoveStop": tweens.cancel(owner + "move"); if (slot.relativeLoopOrigin) { Object.assign(slot, slot.relativeLoopOrigin); slot.relativeLoopOrigin = null; } break;
      case "charaShake": {
        const proxy = { get x() { return slot.shakeX; }, set x(value: number) { slot.shakeX = value; }, get y() { return slot.shakeY; }, set y(value: number) { slot.shakeY = value; } };
        shake(ctx, owner + "shake", proxy, positive(p[1], 0), positive(p[2], 0.05), number(p[3]), number(p[4])); break;
      }
      case "charaShakeStop": tweens.cancel(owner + "shake"); slot.shakeX = 0; slot.shakeY = 0; break;
      default: ctx.onUnhandled(tag); return false;
    }
    stage.touch(); return true;
  }
  if (/^(?:subCamera|subRender|subBlur)/.test(tag)) {
    const group = stage.subLayer(subKey), a = subArgs, prefix = `sub:${subKey}:`;
    const camera = tag.startsWith("subCamera") ? group.camera : group;
    switch (base) {
      case "subCameraOn": {
        const count = Math.min(4, Math.max(1, number(a[0], 1)));
        for (let i = 0; i < count; i++) stage.subLayer(`#${String.fromCharCode(65 + i)}`).cameraEnabled = true;
        group.cameraEnabled = true; break;
      }
      case "subCameraOff": group.cameraEnabled = false; break;
      case "subCameraHome": animate(ctx, prefix + "camera", group.camera, { ...homeTransform() }, positive(a[0], 0)); break;
      case "subCameraMove": case "subCameraMoveEase": {
        const ease = base.endsWith("Ease"), point = resolvePlacement(a[ease ? 0 : 1]);
        animate(ctx, prefix + "camera", camera, { x: point.x, y: point.y, scale: number(a[ease ? 3 : 2], 1) }, positive(a[ease ? 1 : 0]), ease ? a[2] : undefined); break;
      }
      case "subCameraRoll": camera.rotation = number(a[0]); if (a[1]) { const point = resolvePlacement(a[1]); group.camera.pivot = { x: point.x, y: point.y }; } break;
      case "subCameraRollMove": animate(ctx, prefix + "roll", camera, { rotation: number(a[0]) }, positive(a[1])); break;
      case "subCameraFilter": {
        group.camera.filter = a[0] === "through" || a[0] === "normal" ? null : a[0]; group.mask = a[1] ?? null;
        const rgba = a[3]?.split(",").map(Number);
        group.maskEdge = a[0] === "maskEdge" ? {
          width: Math.max(0, number(a[2])),
          color: rgba?.length === 4 && rgba.every(Number.isFinite) ? `rgba(${rgba.slice(0, 3).map(c => Math.max(0, Math.min(255, c))).join(",")},${Math.max(0, Math.min(255, rgba[3])) / 255})` : "#000",
        } : null;
        break;
      }
      case "subRenderFadein": group.visible = true; if (a[1]) Object.assign(group, withSide(resolvePlacement(a[1]), tag, ctx)); animate(ctx, prefix + "alpha", group, { alpha: 1 }, positive(a[0])); break;
      case "subRenderFadeout": animate(ctx, prefix + "alpha", group, { alpha: 0 }, positive(a[0]), undefined, () => { group.visible = false; stage.touch(); }); break;
      case "subRenderMove": case "subRenderMoveEase": animate(ctx, prefix + "move", group, withSide(resolvePlacement(a[0]), tag, ctx), positive(a[1]), a[2]); break;
      case "subRenderScale": group.scale = number(a[0], 1); break;
      case "subRenderMoveScale": case "subRenderMoveScaleEase": animate(ctx, prefix + "scale", group, { scale: number(a[0], 1) }, positive(a[1]), a[2]); break;
      case "subRenderDepth": group.depth = Math.min(5, Math.max(1, number(a[0], 1))); break;
      case "subBlur": case "subBlur2": group.blur = number(a[1]); group.blurKind = ({ lens: "GaussianBlurThrough", motion: "MotionBlurThrough", glass: "FrostedGlassThrough" }[a[0]] ?? "GaussianBlurThrough"); ctx.diagnose(tag, "自制 SVG/CSS 滤镜近似原生 shader"); break;
      case "subBlurOff": case "subBlur2Off": group.blur = null; break;
      case "subRenderShake": {
        const proxy = { get x() { return group.shakeX; }, set x(value: number) { group.shakeX = value; }, get y() { return group.shakeY; }, set y(value: number) { group.shakeY = value; } };
        shake(ctx, prefix + "shake", proxy, positive(a[0], 0), positive(a[1], 0.05), number(a[2]), number(a[3])); break;
      }
      case "subRenderShakeStop": tweens.cancel(prefix + "shake"); group.shakeX = 0; group.shakeY = 0; break;
      default: ctx.onUnhandled(tag); return false;
    }
    stage.touch(); return true;
  }
  if (tag.startsWith("camera")) {
    switch (tag) {
      case "cameraHome": animate(ctx, "camera", stage.camera, { ...homeTransform() }, positive(p[0], 0)); break;
      case "cameraMove": {
        const values = pd.filter((_, index) => index % 2 === 0);
        animate(ctx, "camera", stage.camera, { x: number(values[1]), y: number(values[2]), scale: number(values[3], stage.camera.scale) }, positive(values[0], 0)); break;
      }
      case "cameraMoveEase": {
        const values = pd.filter((_, index) => index % 2 === 0);
        animate(ctx, "camera", stage.camera, { x: number(values[0]), y: number(values[1]), scale: number(values[4], stage.camera.scale) }, positive(values[2], 0), values[3]); break;
      }
      case "cameraFilter": stage.camera.filter = p[0] === "normal" ? null : p[0] ?? null; break;
      case "cameraRoll": stage.camera.rotation = number(p[0]); if (p[1]) { const point = resolvePlacement(p[1]); stage.camera.pivot = { x: point.x, y: point.y }; } break;
      case "cameraRollMove": animate(ctx, "camera:roll", stage.camera, { rotation: number(p[1]) }, positive(p[0])); break;
      default: ctx.onUnhandled(tag); return false;
    }
    stage.touch(); return true;
  }
  if (tag === "fadein" || tag === "fadeout" || tag === "fadeMove" || tag === "maskin" || tag === "maskout") {
    const family = tag.startsWith("mask") ? "mask" : "fade", overlay = stage[family];
    if (p[0] === "clear") { tweens.cancel(family); overlay.alpha = 0; stage.touch(); return true; }
    overlay.color = cssColor(p[0]); overlay.seq++;
    const incoming = tag.endsWith("in");
    if (incoming && overlay.alpha === 0) overlay.alpha = 1;
    animate(ctx, family, overlay, { alpha: tag === "fadeMove" ? number(p[2], 1) : incoming ? 0 : 1 }, positive(p[1]));
    return true;
  }
  if (tag === "fadeOff" || tag === "maskOff") {
    const family = tag === "fadeOff" ? "fade" : "mask";
    tweens.cancel(family); stage[family].alpha = 0; stage.touch(); return true;
  }
  if (/^wipe(?:in|out|Filter)(?:Ex)?$/.test(tag)) {
    stage.wipe = { color: "#000", alpha: tag.startsWith("wipein") ? 1 : 0, seq: stage.wipe.seq + 1, name: p[0] ?? "", kind: tag.startsWith("wipein") ? "in" : tag.startsWith("wipeout") ? "out" : "filter", progress: 0, level: number(p[2], 1) };
    animate(ctx, "wipe", stage.wipe, { progress: 1, alpha: stage.wipe.kind === "in" ? 0 : 1 }, positive(p[1])); return true;
  }
  if (tag === "wipeOff") { tweens.cancel("wipe"); stage.wipe.alpha = 0; stage.touch(); return true; }
  if (tag === "flashin" || tag === "flashinDep") {
    const rgba = (value: string) => { const hex = cssColor(value).replace("#", ""); const expanded = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex; return [0, 2, 4].map(i => parseInt(expanded.slice(i, i + 2), 16)).concat(expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1); };
    const mode = p[0] ?? "once", first = positive(p[1], 0.1), second = positive(p[2], 0.1), total = first + second;
    const a = rgba(p[3] ?? "white"), b = rgba(p[4] ?? "clear");
    stage.flash = { color: cssColor(p[3] ?? "white"), alpha: 0, seq: stage.flash.seq + 1, mode, slot: tag === "flashinDep" ? p[5] : undefined };
    tweens.add({ owner: "flash", duration: ctx.fastForward || ctx.reduceMotion ? 0 : Math.max(0.001, total) * (mode === "pingpong" ? 2 : 1), loop: mode !== "once" && !ctx.fastForward && !ctx.reduceMotion, onUpdate: progress => {
      const time = (mode === "pingpong" ? 1 - Math.abs(progress * 2 - 1) : progress) * total;
      const rate = time <= first ? first ? time / first : 1 : second ? (time - first) / second : 1;
      const from = time <= first ? [a[0], a[1], a[2], 0] : a, to = time <= first ? a : b, color = from.map((value, i) => lerp(value, to[i], rate));
      stage.flash.color = `rgb(${color.slice(0, 3).map(Math.round).join(" ")})`; stage.flash.alpha = color[3]; stage.touch();
    }, onComplete: () => { stage.flash.alpha = 0; stage.touch(); } }); return true;
  }
  if (tag === "flashout" || tag === "flashoutDep" || tag === "flashOff" || tag === "flashOffDep") {
    animate(ctx, "flash", stage.flash, { alpha: 0 }, tag.startsWith("flashout") ? positive(p[0]) : 0); return true;
  }
  if (tag === "shake") { stage.shake.seq++; shake(ctx, "shake", stage.shake, positive(p[0], 0), positive(p[1], 0.05), number(p[2]), number(p[3])); return true; }
  if (tag === "shakeStop") { tweens.cancel("shake"); stage.shake.x = 0; stage.shake.y = 0; stage.touch(); return true; }
  if (tag === "messageOff" || tag === "messageOn") { stage.messageVisible = tag === "messageOn"; stage.touch(); return true; }
  if (tag === "f" || tag === "font" || tag === "fontSize") { stage.messageFont = FONT_SIZES[p[0] ?? "-"] ?? 29; stage.touch(); return true; }
  if (tag === "blur" || tag === "blurOff") { stage.blur = tag === "blurOff" ? null : number(p[1]); stage.blurKind = ({ lens: "GaussianBlur", motion: "MotionBlur", glass: "FrostedGlass" }[p[0]] ?? "GaussianBlur"); if (tag === "blur") ctx.diagnose(tag, "自制 SVG/CSS 滤镜近似原生 shader"); stage.touch(); return true; }
  if (tag === "pictureFrame" || tag === "pictureFrameTop") { stage.pictureFrame = p[0] ?? null; stage.pictureFrameTop = tag === "pictureFrameTop"; stage.touch(); return true; }
  if (tag === "bgm" || tag === "subBgm") {
    if (tag === "bgm") { stage.audio.bgm = p[0] ?? null; stage.audio.bgmVolume = p[1] === undefined ? null : Math.max(0, Math.min(1, number(p[1]))); stage.touch(); }
    else ctx.emitAudio({ kind: "play", channel: "subBgm", name: p[0], loop: true, volume: number(p[1], 1) });
    return true;
  }
  if (tag === "bgmStop" || tag === "bgmStopEnd" || tag === "subBgmStop") {
    if (tag === "subBgmStop") ctx.emitAudio({ kind: "stop", channel: "subBgm" });
    else { stage.audio.bgm = null; stage.touch(); }
    return true;
  }
  if (/^soundStopAll/.test(tag)) { stage.audio.bgm = null; ctx.emitAudio({ kind: "stopAll" }); stage.touch(); return true; }
  if (["se", "seLoop", "seContinue", "voice", "tVoice", "tVoiceUser", "jingle"].includes(tag)) {
    const se = tag.startsWith("se");
    ctx.emitAudio({ kind: "play", channel: tag === "jingle" ? "jingle" : /[vV]oice/.test(tag) ? "voice" : "se", name: p[0], loop: tag === "seLoop" || tag === "seContinue", volume: se ? p[2] === undefined ? undefined : number(p[2], 1) : p[1] === undefined ? undefined : number(p[1], 1), fadeIn: se ? positive(p[1], 0) : undefined }); return true;
  }
  if (["seStop", "seContinueStop", "voiceStop", "jingleStop"].includes(tag)) {
    ctx.emitAudio({ kind: "stop", channel: tag === "jingleStop" ? "jingle" : tag === "voiceStop" ? "voice" : "se", name: p[0] }); return true;
  }
  if (["seVolume", "seContinueVolume", "voiceVolume"].includes(tag)) {
    const channel = tag === "voiceVolume" ? "voice" : "se";
    ctx.emitAudio({ kind: "volume", channel, name: p[0], volume: number(p[2], 1), duration: positive(p[1], 0) }); return true;
  }
  // Unity shaders, PlayMaker graphs and prefabs need original assets. Recognition
  // remains exact; these commands have no fabricated browser visual equivalent.
  ctx.onUnhandled(tag);
  return false;
}

import type { Instruction } from "./instruction";
import type { CommandContext } from "./commands";
import { cssColor } from "./commands";
import { move, nativeValues, numeric as n, seconds as sec, shakeTarget, sideOffset, unquote } from "./motion";
import { homeTransform, resolvePlacement, type EffectInstance, type TransformState } from "./stage";
import { FONT_SIZES } from "./spec";
import { resolveEasing } from "./easings";

/** Original, local vector substitutes. Numeric Talk ids deliberately use a neutral
 * particle preset; they are never interpreted as commands to remove a character. */
function effectPreset(name: string): EffectInstance["preset"] {
  if (/slash|cutting|shot|arrow/i.test(name)) return "slash";
  if (/rain|snow|blood_splash/i.test(name)) return "rain";
  if (/noise/i.test(name)) return "noise";
  if (/smoke|fog|haboob|atomization|sepia/i.test(name)) return "smoke";
  if (/charge|aura|edgeblur|appearance/i.test(name)) return "ring";
  if (/quickmove|impact|explosion|flash|thunder|lightning/i.test(name)) return "rays";
  return "particles";
}
function effectColor(name: string): string {
  return /red|blood|fire/i.test(name) ? "#ff745b" : /gold|or\b/i.test(name) ? "#ffdb87" : /black|dark|_bk/i.test(name) ? "#64748c" : /ppl|purple/i.test(name) ? "#c7a5ff" : "#a6e7ff";
}
const effectKey = (name: string) => unquote(name).replace(/^(?:Effect\/)?(?:Talk\/)?/, "");
const effectOwner = (id: number) => `effect:${id}:`;
function loopEffect(ctx: CommandContext, effect: EffectInstance): void {
  // A completed one-shot must not become a permanent overlay during seek or
  // reduced-motion playback. Persistent effects still survive reconstruction.
  if (effect.parameters.oneShot === "true" && (ctx.fastForward || ctx.reduceMotion)) {
    ctx.stage.effects.delete(effect.id); ctx.stage.touch(); return;
  }
  effect.status = "loop"; effect.busy = false; effect.opacity = 1;
  if (!ctx.fastForward && !ctx.reduceMotion) ctx.tweens.add({ owner: effectOwner(effect.id) + "loop", duration: effect.parameters.oneShot === "true" ? 0.6 : 2, loop: effect.parameters.oneShot !== "true", onUpdate: t => { effect.elapsed = t * 2; if (effect.parameters.oneShot === "true") effect.opacity = 1 - t; ctx.stage.touch(); }, onComplete: () => { ctx.stage.effects.delete(effect.id); ctx.stage.touch(); } });
  ctx.stage.touch();
}
function matchingEffects(ctx: CommandContext, container: string, name?: string): EffectInstance[] {
  return [...ctx.stage.effects.values()].filter(e => e.container === container && (!name || e.name === effectKey(name)));
}
function controlEffects(ctx: CommandContext, container: string, action: string, name?: string, markKey?: string): void {
  const effects = matchingEffects(ctx, container, name);
  if (effects.some(e => e.loading)) { ctx.retryNextFrame(); return; }
  for (const effect of effects) {
    const owner = effectOwner(effect.id);
    ctx.tweens.cancelByPrefix(owner);
    if (action === "Start") {
      if (effect.status === "paused" && !ctx.fastForward) { effect.status = "start"; effect.busy = true; move(ctx, owner + "start", effect, { opacity: 1, progress: 1 }, effect.duration, () => loopEffect(ctx, effect)); }
      else loopEffect(ctx, effect);
    }
    else if (action === "Destroy" || action === "ForceStop") ctx.stage.effects.delete(effect.id);
    else {
      effect.status = "end"; effect.busy = true; effect.markKey = markKey;
      move(ctx, owner + "end", effect, { opacity: 0, progress: 1 }, 0.25, () => { ctx.stage.effects.delete(effect.id); ctx.stage.touch(); });
    }
  }
  ctx.stage.touch();
}
function createEffect(ctx: CommandContext, container: string, name: string, x: number, y: number, flip = "", paused = false, options: { duration?: number; color?: string; range?: number; parameters?: Record<string, string> } = {}): void {
  name = effectKey(name);
  if (ctx.fastForward && /bit_shot_/.test(name) && (container === "effect" || container.endsWith(":effect"))) return;
  const effect: EffectInstance = { id: ++ctx.stage.effectSequence, container, name, assetName: `Effect/Talk/${name}`, x, y, flip, status: paused ? "paused" : "start", loading: false, busy: !paused, opacity: 0, progress: 0, elapsed: 0, preset: effectPreset(name), color: options.color ?? effectColor(name), parameters: options.parameters ?? {}, duration: options.duration ?? 0.35, range: options.range ?? 1 };
  if (/shot|slash|explosion|sparks|impact|cutting/i.test(name)) effect.parameters.oneShot = "true";
  ctx.stage.effects.set(effect.id, effect);
  ctx.diagnose(container.startsWith("chara:") ? (container.endsWith(":specialEffect") ? "charaSpecialEffect" : container.endsWith(":backEffect") ? "charaBackEffect" : "charaEffect") : container, `使用自制矢量演出替代 ${effect.assetName}，视觉为近似`);
  if (paused) effect.opacity = 0;
  else move(ctx, effectOwner(effect.id) + "start", effect, { opacity: 1, progress: 1 }, effect.duration, () => loopEffect(ctx, effect));
  ctx.stage.touch();
}

function stretchTarget(direction: string, scale: number): TransformState & { scaleX: number; scaleY: number } {
  const horizontal = direction.startsWith("horizontally"), vertical = direction.startsWith("vertical");
  return { ...homeTransform(), scaleX: vertical ? 1 : scale, scaleY: horizontal ? 1 : scale,
    x: direction.endsWith("Left") ? -512 * (scale - 1) : direction.endsWith("Right") ? 512 * (scale - 1) : 0,
    y: direction.endsWith("Up") ? 288 * (scale - 1) : direction.endsWith("Down") ? -288 * (scale - 1) : 0 };
}

/** Returns false only for commands handled by the base stage or executor. */
export function executePresentationCommand(ins: Instruction, ctx: CommandContext): boolean {
  const { stage: s, tweens: t } = ctx, { tag, params: original, pd } = ins;
  const p = original.map(unquote), v = nativeValues(pd), slot = s.slots.get(p[0]);
  const error = (unnecessary = false) => { ctx.diagnose(tag, unnecessary ? "parameter be unnecessary" : "parameter error"); return true; };
  const base = tag.replace(/FS(?:Side[LR]|[LR])(?:NotNotch)?$/, "");

  if (["seLoop", "se", "wait", "seStop", "seContinue", "seContinueStop", "seContinueVolume", "effectmessageStop", "seVolume"].includes(tag)) controlEffects(ctx, "effectmessage", "Stop");
  const fx = /^(charaSpecialEffect|charaBackEffect|charaEffect|specialEffect|fowardEffect|backEffect|effectmessage|effect)(ForceStop|Destroy|Stop|Start|Pause|Puase)?$/.exec(tag);
  if (fx) {
    const family = fx[1], chara = family.startsWith("chara"), familyName = chara ? family.slice(5).replace(/^./, c => c.toLowerCase()) : family;
    if (chara && !slot) return true;
    const container = chara ? `chara:${p[0]}:${familyName}` : family;
    if (["Start", "Stop", "ForceStop", "Destroy"].includes(fx[2])) controlEffects(ctx, container, fx[2], p[chara ? 1 : 0], p[chara ? 2 : 1]);
    else {
      const offset = chara ? 1 : 0;
      if (!v[offset]) return error();
      const parameters: Record<string, string> = {};
      for (const value of p.slice(offset + 1)) { const split = value.indexOf("="); if (split > 0) parameters[value.slice(0, split)] = value.slice(split + 1); else if (value === "continueSilhouette") parameters.continueSilhouette = "true"; }
      const special = family === "specialEffect", charaSpecial = family === "charaSpecialEffect";
      createEffect(ctx, container, v[offset], charaSpecial ? 0 : n(v[offset + 1]), charaSpecial ? 0 : n(v[offset + 2]), special || charaSpecial ? "" : v[offset + 3], /(?:Pause|Puase)$/.test(tag), { parameters, ...(special ? { duration: sec(v[3], 0.35), color: v[4] ? cssColor(v[4]) : undefined, range: n(v[5], 1) } : family === "effectmessage" ? { duration: sec(v[3], 0.35), parameters: { repeat: v[4] ?? "1" } } : {}) });
    }
    return true;
  }
  if (/^charaEffectEdgeBlur(?:Pause|Start|Stop|Destroy)?$/.test(tag)) {
    if (!slot) return true;
    const container = `chara:${p[0]}:edgeBlur`;
    if (/Start$/.test(tag)) controlEffects(ctx, container, "Start");
    else if (/Stop$/.test(tag)) controlEffects(ctx, container, "Stop");
    else {
      controlEffects(ctx, container, "Destroy");
      if (!tag.endsWith("Destroy")) { createEffect(ctx, container, "bit_talk_edgeblur_light", 0, 0, "", tag.endsWith("Pause"), { color: p[1] ? cssColor(p[1]) : undefined, parameters: { particleColor: p[2] ? cssColor(p[2]) : cssColor(p[1] ?? "white"), level: p[3] ?? "4", thick: p[4] ?? "1.5" } }); }
    }
    return true;
  }
  if (tag.startsWith("communicationChara")) {
    if (tag === "communicationChara" || tag === "communicationCharaLoop") {
      if (!p[0] || !Number.isFinite(Number(p[0]))) return error();
      const encoded = Math.trunc(Number(p[0])), point = resolvePlacement(p[1]);
      const state = s.communication = { svtId: String(Math.floor(encoded / 10)), limitCount: encoded % 10, face: Math.min(10, Math.max(0, n(p[4]))), x: point.x, y: point.y, depth: -n(p[2], 5) * 10, noiseKind: n(p[3]), loop: tag.endsWith("Loop") || ctx.fastForward, loaded: true, busy: !tag.endsWith("Loop") && !ctx.fastForward, opacity: tag.endsWith("Loop") ? 1 : 0, elapsed: 0 };
      t.cancelByPrefix("communication:");
      move(ctx, "communication:entry", state, { opacity: 1 }, state.loop ? 0 : 0.35, () => { state.busy = false; s.touch(); });
      if (!ctx.fastForward && !ctx.reduceMotion) t.add({ owner: "communication:noise", duration: 2, loop: true, onUpdate: progress => { state.elapsed = progress * 2; s.touch(); } });
      ctx.diagnose(tag, "通讯窗口使用自制边框及扫描噪声资源");
      ctx.requestWait("communicationCharaLoad");
    } else if (tag === "communicationCharaFace") { if (s.communication) s.communication.face = Math.min(10, Math.max(0, n(p[0]))); }
    else if (tag === "communicationCharaClear") { t.cancelByPrefix("communication:"); s.communication = null; }
    else if (tag === "communicationCharaStop" && s.communication) {
      const state = s.communication; state.busy = true;
      move(ctx, "communication:entry", state, { opacity: 0 }, 0.25, () => { s.communication = null; t.cancelByPrefix("communication:"); s.touch(); });
    }
    s.touch(); return true;
  }
  if (["charaCutin", "charaCutinPause", "charaCutinStart", "charaCutout", "charaCutStop", "charaAttack"].includes(tag)) {
    if (!slot) return true;
    const owner = `chara:${slot.slot}:cut`;
    if (tag === "charaAttack") {
      if (pd.length !== 9 || v[1] !== "normal") return error();
      move(ctx, `chara:${slot.slot}:move`, slot, { x: n(v[2]), y: n(v[3]) }, sec(v[4], 0.5));
    } else if (tag === "charaCutStop") { t.cancel(owner); slot.cut = null; controlEffects(ctx, `chara:${slot.slot}:specialEffect`, "Destroy"); }
    else if (tag === "charaCutout") {
      if (slot.cut) move(ctx, owner, slot.cut, { progress: 0 }, sec(p[1]), () => { slot.cut = null; s.touch(); });
    } else {
      if (tag !== "charaCutinStart") slot.cut = { name: p[1] ?? "upToDown", progress: 0, duration: sec(p[2]), level: n(p[3]), paused: tag.endsWith("Pause") };
      if (slot.cut && tag !== "charaCutinPause") { slot.cut.paused = false; move(ctx, owner, slot.cut, { progress: 1 }, slot.cut.duration); }
      ctx.diagnose(tag, "使用自制方向性划像遮罩近似 Wipe shader");
    }
    s.touch(); return true;
  }
  if (["charaFadeSpeed", "charaFadeTimeLoop", "charaFadeTimeLoopStop", "charaReturn", "charaRollAxisLoopStop", "charaRollAxis", "charaRollMoveEx", "charaRelativeLoopMove", "charaRelativeLoopMoveEase", "charaPosition"].includes(base)) {
    if (!slot) return true;
    const owner = `chara:${slot.slot}:`;
    if (base === "charaFadeSpeed") {
      if (pd.length !== 5) return error();
      const speed = Math.abs(n(p[1])); move(ctx, owner + "alpha", slot, { alpha: n(p[2], 1) }, speed ? Math.abs(n(p[2], 1) - slot.alpha) * 0.015 / speed : 0); ctx.diagnose(tag, "UNIT_SPEED 到时长的换算使用推断公式，需真机校准");
    } else if (base === "charaFadeTimeLoopStop") { t.cancel(owner + "alphaLoop"); if (slot.alphaLoop) slot.alpha = slot.alphaLoop.last; slot.alphaLoop = null; }
    else if (base === "charaFadeTimeLoop") {
      const count = Math.trunc(n(v[1]));
      if (count < 1 || pd.length !== 4 * count + 5 || pd.some((value, i) => i % 2 === 1 && value !== " ")) return error();
      const durations = Array.from({ length: count }, (_, i) => sec(v[2 + i * 2], 0)), values = durations.map((_, i) => Math.max(0, Math.min(1, n(v[3 + i * 2]))));
      const loops = Math.max(0, Math.trunc(n(v.at(-1)))), total = durations.reduce((a, b) => a + b, 0), initial = slot.alpha;
      slot.alphaLoop = { infinite: loops === 0, last: values.at(-1)! };
      if (ctx.fastForward || ctx.reduceMotion || total === 0) { slot.alpha = values.at(-1)!; slot.alphaLoop = null; }
      else t.add({ owner: owner + "alphaLoop", duration: total * (loops || 1), loop: loops === 0, onUpdate: progress => {
        const absolute = progress * total * (loops || 1); let time = absolute % total, from = absolute >= total ? values.at(-1)! : initial;
        if (progress === 1) { slot.alpha = values.at(-1)!; s.touch(); return; }
        for (let i = 0; i < count; i++) { if (time <= durations[i]) { slot.alpha = durations[i] ? from + (values[i] - from) * time / durations[i] : values[i]; break; } time -= durations[i]; from = values[i]; } s.touch();
      }, onComplete: () => { slot.alphaLoop = null; s.touch(); } });
    } else if (base === "charaReturn") move(ctx, owner + "move", slot, { ...slot.basePosition }, sec(p[1]));
    else if (base === "charaPosition") { const point = resolvePlacement(p[1]); Object.assign(slot, point); slot.basePosition = { x: point.x, y: point.y }; }
    else if (base === "charaRollAxisLoopStop") { t.cancel(owner + "axis"); if (slot.rollAxis.wait) move(ctx, owner + "roll", slot, { rotation: slot.rollAxis.stopAngle }, 0.2); }
    else if (base === "charaRollMoveEx") { const point = resolvePlacement(p[3] ?? "0,0"); slot.pivot = { x: point.x, y: point.y }; move(ctx, owner + "roll", slot, { rotation: n(p[2]) }, sec(p[1])); }
    else if (base === "charaRollAxis") {
      const axis = p[1]?.toLowerCase(), pair = p[1]?.split(",").map(Number);
      slot.rollAxis = { x: axis === "x" ? 1 : pair?.length === 3 ? pair[0] : 0, y: axis === "y" ? 1 : pair?.length === 3 ? pair[1] : 0, z: axis === "z" || !["x", "y"].includes(axis) && pair?.length !== 3 ? 1 : pair?.[2] ?? 0, stopAngle: n(p[6]), wait: p[5] === "true" || p[5] === "1" };
      if (["true", "1"].includes(p[4]) && !ctx.fastForward && !ctx.reduceMotion) {
        const initial = slot.rotation; t.add({ owner: owner + "axis", duration: Math.max(0.001, sec(p[3])), loop: true, onUpdate: progress => { slot.rotation = initial + n(p[2], 360) * progress; s.touch(); } });
      } else move(ctx, owner + "roll", slot, { rotation: slot.rotation + n(p[2]) }, sec(p[3], 0));
    } else {
      const count = Math.trunc(n(v[1]));
      // Corpus: slot, N, N coordinate pairs, N durations, loop count.
      if (count < 1 || pd.length < 6 * count + 5) return error();
      const points = Array.from({ length: count }, (_, i) => ({ x: n(v[2 + i * 2]), y: n(v[3 + i * 2]), duration: sec(v[2 + count * 2 + i], 0) }));
      const total = points.reduce((sum, point) => sum + point.duration, 0), loops = Math.max(0, Math.trunc(n(v[2 + count * 3]))), origin = { x: slot.x, y: slot.y };
      slot.relativeLoopOrigin = origin;
      if (total && !ctx.fastForward && !ctx.reduceMotion) t.add({ owner: owner + "move", duration: total * (loops || 1), loop: loops === 0, onUpdate: progress => {
        let time = progress * total * (loops || 1) % total, from = { x: 0, y: 0 };
        for (const point of points) { if (time <= point.duration) { const rate = resolveEasing(base.endsWith("Ease") ? p.at(-1) : undefined)(point.duration ? time / point.duration : 1); slot.x = origin.x + from.x + (point.x - from.x) * rate; slot.y = origin.y + from.y + (point.y - from.y) * rate; break; } time -= point.duration; from = point; } s.touch();
      } });
    }
    s.touch(); return true;
  }
  if (tag.startsWith("fsmObj")) {
    if (tag === "fsmObjSet") {
      if (p.length !== 3) return error();
      s.fsm.set(p[0], { assetName: p[1], objectName: p[2], loading: false, playing: false, state: "", events: [], variables: {}, x: 0, y: 0, layer: "" });
      ctx.requestWait("fsmObjSet", p[0]); ctx.diagnose(tag, "未提供离线 FSM 图，保留变量和事件状态并立即完成资源等待");
    } else if (tag === "fsmObjDestroy") { t.cancel(`fsm:${p[0]}`); s.fsm.delete(p[0]); }
    else {
      const fsm = s.fsm.get(p[0]); if (!fsm) return true;
      if (tag === "fsmObjSetBool") { if (/^(true|false)$/i.test(p[2])) fsm.variables[p[1]] = p[2].toLowerCase() === "true"; }
      else if (tag === "fsmObjSetFloat") { if (Number.isFinite(Number(p[2]))) fsm.variables[p[1]] = Number(p[2]); }
      else if (tag === "fsmObjSetString") fsm.variables[p[1]] = p[2];
      else if (tag === "fsmObjLayer") { if (p[1] !== "ui") return error(); fsm.layer = "ui"; Object.assign(fsm, resolvePlacement(p[2] ?? "0,0")); }
      else { fsm.events.push("SKIP"); if (tag === "fsmObjSetState") fsm.state = p[1]; else fsm.events.push(p[1]); fsm.playing = false; }
    }
    s.touch(); return true;
  }
  if (tag.startsWith("insertionAnimation")) {
    const name = p[0]; if (!name) return error();
    if (base === "insertionAnimationSet") {
      const point = resolvePlacement(p[1] ?? "0,0");
      s.insertions.set(name, { ...homeTransform(), ...point, x: point.x + sideOffset(tag, ctx.aspectRatio), scale: n(v[3], 1), name, active: false, loading: false, phase: "ready", progress: 0, images: [] });
      ctx.requestWait("insertionAnimationSet", name);
      ctx.diagnose(tag, "插入动画使用自制三角展开资源，时长为 0.4 秒近似");
    } else {
      const object = s.insertions.get(name); if (!object) return true;
      object.phase = tag.endsWith("End") ? "out" : "in"; object.images = p.slice(1); object.active = true; object.progress = 0;
      move(ctx, `insertion:${name}`, object, { progress: 1 }, 0.4, () => { object.active = false; if (object.phase === "out") s.insertions.delete(name); s.touch(); });
    }
    s.touch(); return true;
  }
  if (["advSet", "advPrepare", "advRelease", "advActorShow", "advActorHide", "advPlayAnimator"].includes(tag)) {
    if (tag === "advSet") { s.adv.setup = true; s.adv.name = p[0] ?? ""; ctx.requestWait("advSet"); }
    else if (tag === "advPrepare") s.adv.object = p[0] ?? "";
    else if (tag === "advRelease") { s.adv.setup = false; s.adv.actors.clear(); }
    else { const actor = s.adv.actors.get(p[0]) ?? { visible: false, goNext: true, trigger: "" }; if (tag === "advPlayAnimator") actor.trigger = p[1]; else actor.visible = tag === "advActorShow"; s.adv.actors.set(p[0], actor); }
    ctx.diagnose(tag, "未提供转换后的 3D ADV 资源，记录状态后继续"); s.touch(); return true;
  }
  if (tag === "movie" || tag === "criMovie") {
    if (ctx.fastForward) return true;
    if (!p.length) return error();
    s.movie = { name: p[0].replace(/^(?:Movie\/)?(.*?)(?:\.(?:usm|mp4|webm))?$/, "$1"), blocking: !p.includes("false"), elapsed: 0, duration: 3, bgmPause: p.includes("bgmStop"), sePause: p.includes("seStop"), voicePause: p.includes("voiceStop"), ready: false };
    ctx.diagnose(tag, "无转码影片时显示可跳过的自制占位画面（3 秒）");
    if (s.movie.blocking) ctx.requestWait("movie"); s.touch(); return true;
  }
  if (tag === "backCameraColor") { if (p[0] && p[0] !== "false" && !/^#?[\da-fA-F]{6}$/.test(p[0])) return error(); s.backColor = p[0] === "false" ? null : cssColor(p[0] ?? "black"); s.touch(); return true; }
  if (tag === "capture" || tag === "captureRelease") {
    if (p.length) return error(true);
    s.capture = tag === "captureRelease" ? null : { slots: structuredClone([...s.slots.values()]), subLayers: structuredClone([...s.subLayers.values()]), background: s.background.current, camera: { ...s.camera }, effects: structuredClone([...s.effects.values()]), communication: s.communication ? { ...s.communication } : null, blur: s.blur, stretch: { ...s.stretch }, fade: { ...s.fade }, mask: { ...s.mask }, wipe: { ...s.wipe }, flash: { ...s.flash } };
    s.touch(); return true;
  }
  if (tag === "useSimpleMeshFigure") { s.simpleMeshFigures = v; return true; }
  if (/^distortion(?:start|stop|loop)$/.test(tag)) {
    if (pd.length !== (tag === "distortionstart" ? 11 : tag === "distortionloop" ? 13 : 1)) return error();
    const target = s.distortion, loop = tag === "distortionloop", off = tag === "distortionstop", offset = loop ? 2 : 1;
    const to = { centerX: off ? target.centerX : n(v[offset]), centerY: off ? target.centerY : n(v[offset + 1]), strength: off ? 0 : n(v[offset + 2]), range: off ? 0 : n(v[offset + 3]), coefficient: off ? target.coefficient : n(v[offset + 4]) };
    target.enabled = true;
    if (loop && !ctx.fastForward && !ctx.reduceMotion) {
      const count = Math.max(0, Math.trunc(n(v[1]))), from = { ...target }, duration = Math.max(0.001, sec(v[0]));
      t.add({ owner: "distortion", duration: duration * (count || 1), loop: count === 0, onUpdate: progress => { const rate = 1 - Math.abs((progress * (count || 1) % 1) * 2 - 1); for (const key of Object.keys(to) as Array<keyof typeof to>) target[key] = from[key] + (to[key] - from[key]) * rate; s.touch(); } });
    } else move(ctx, "distortion", target, to, sec(v[0]), () => { target.enabled = !off; s.touch(); });
    ctx.diagnose(tag, "畸变使用自制 SVG 位移滤镜近似"); s.touch(); return true;
  }
  if (tag === "spriteMaskSet" || tag === "spriteMaskOff" || tag === "charaMask") {
    if (tag === "spriteMaskSet") { s.spriteMask = p[0] ?? null; ctx.requestWait("spriteMaskSet"); ctx.diagnose(tag, "缺少原始遮罩时使用自制柔边椭圆遮罩"); }
    else if (tag === "spriteMaskOff") s.spriteMask = null;
    else if (slot) slot.maskInteraction = p[1] === "inside" || p[1] === "outside" ? p[1] : "none";
    s.touch(); return true;
  }
  if (["stretchin", "stretchout", "stretchOff", "subStretch", "subStretchin", "subStretchout"].includes(tag)) {
    if (tag === "subStretch") { s.subStretch = p[0] === "on"; s.touch(); return true; }
    const sub = tag.startsWith("sub"), group = sub ? s.subLayers.get(p[0]) : undefined;
    if (sub && !group) return true;
    const target = group?.stretch ?? s.stretch, args = sub ? p.slice(1) : p;
    if (tag === "stretchOff") { t.cancel("stretch"); Object.assign(target, homeTransform(), { scaleX: 1, scaleY: 1 }); }
    else {
      if (!["horizontally", "horizontallyLeft", "horizontallyRight", "vertical", "verticalUp", "verticalDown", "full"].includes(args[0])) return error();
      if (t.isActive(sub ? `sub:${p[0]}:stretch` : "stretch")) return true;
      Object.assign(target, { scaleX: (target as { scaleX?: number }).scaleX ?? 1, scaleY: (target as { scaleY?: number }).scaleY ?? 1 });
      const scale = n(args[sub ? 1 : 2], 1.15), destination = tag.endsWith("out") ? { ...homeTransform(), scaleX: 1, scaleY: 1 } : stretchTarget(args[0], scale);
      move(ctx, sub ? `sub:${p[0]}:stretch` : "stretch", target, destination, sec(args[sub ? 2 : 1]));
      ctx.diagnose(tag, "拉伸静态预设未公开，使用自制平移及分轴缩放");
    }
    s.touch(); return true;
  }
  if (tag === "messageShake") { if (pd.length < 7) return error(); shakeTarget(ctx, "message:shake", s.messageStyle.shake, sec(v[0], 0), n(v[1]), n(v[2]), sec(v[3], 0)); return true; }
  if (tag === "messageShakeStop") { t.cancel("message:shake"); s.messageStyle.shake = { x: 0, y: 0 }; s.touch(); return true; }
  if (tag === "betweenHeight" || tag === "l") { s.messageStyle.lineHeight = !p.length || p[0] === "-" || n(p[0], -1) < 0 ? null : n(p[0]); s.touch(); return true; }
  if (tag === "messageAlign") { s.messageStyle.verticalAlign = p[0] === "center" || p[0] === "bottom" ? p[0] : "top"; s.touch(); return true; }
  if (tag === "messageChange") { Object.assign(s.messageStyle, { skin: p[0] || "normal", lineHeight: null, verticalAlign: "top" }); s.messageFont = 29; s.messageFontAlign = undefined; s.messageAlign = "left"; if (p[0]) ctx.diagnose(tag, "消息窗口使用自制 cinema 样式"); s.touch(); return true; }
  if (tag === "fontType") { s.messageStyle.font = p[0] || "normal"; if (p[0] && p[0] !== "normal") ctx.diagnose(tag, "缺少原始字体，使用系统衬线/无衬线字体替代"); s.touch(); return true; }
  if (tag === "talkNameBack") { s.messageStyle.nameBack = p[0] || null; if (p[0]) ctx.diagnose(tag, "名牌使用本地图片或自制边框"); s.touch(); return true; }
  if (tag === "messageStart") return true;
  if (tag === "messageSpeedForcedNormal") { s.messageStyle.speedForcedNormal = p[0] === "on"; s.touch(); return true; }
  if (tag === "screen") { if (pd.length !== 9) return error(); s.messageStyle.screen = { background: v[0] === "true", x: n(v[1]), y: n(v[2]), width: Math.max(0, n(v[3])), height: Math.max(0, n(v[4])) }; s.touch(); return true; }
  if (tag === "turnPageOn" || tag === "turnPageOff") { s.messageStyle.turnPageDisabled = tag === "turnPageOff"; s.messageStyle.turnPageForce = p[0] === "f"; s.touch(); return true; }
  if (tag === "scrollStop") { if (p.length) return error(true); s.messageStyle.scrollStop = true; return true; }
  if (tag === "f" || tag === "font" || tag === "fontSize") { s.messageFont = FONT_SIZES[p[0] ?? "-"] ?? 29; s.messageFontAlign = p[1] === "top" || p[1] === "center" || p[1] === "bottom" ? p[1] : undefined; return true; }
  if (tag === "selectionCentering") { s.policy.selectionCentering = p[0] === "true"; s.touch(); return true; }
  if (tag === "rewardSwitch") { if (p[0] === "true" || p[0] === "false") s.policy.reward = p[0] === "true"; return true; }
  if (tag === "endFade") { if (!["clear", "black", "white"].includes(p[0])) return error(); s.endFade = p[0] as typeof s.endFade; return true; }
  if (tag.startsWith("war") || tag === "charaFaceIcon" || tag === "faceTalkScreen") { ctx.diagnose(tag, "需要战棋盘面及消息数据，已跳过且不阻塞剧情"); return true; }
  return false;
}

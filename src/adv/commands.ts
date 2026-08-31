import type { AudioIntent } from "./audio";
import type { Instruction } from "./instruction";
import {
  parseBlurIntensity,
  parseCoordinateToken,
  resolvePlacement,
  Stage,
  isEffectOnlyCharacter,
} from "./stage";
import { resolveEasing } from "./easings";
import type { TweenService } from "./tween";

/**
 * Stage command registry — the runtime descendant of the old projector's
 * `applyCommand`. Every stage-facing command family executes against the live
 * Stage; wait-type commands (wait/wt/twt/tdelay/end/choice/message) are
 * handled by the executor itself and never reach this registry.
 *
 * Return value: all stage commands are instant presentations, so execution
 * continues with the next instruction in the same frame (S-E1 Continue).
 */

export interface CommandContext {
  stage: Stage;
  masterGender: "male" | "female";
  masterName: string;
  /** Tween service for timed presentations (fades, scene crossfades). */
  tweens: TweenService;
  /** Fast-forward runs complete every tween immediately. */
  fastForward: boolean;
  /** Audio intent sink (S-A channel model); ReaderView bridges to elements. */
  emitAudio: (intent: AudioIntent) => void;
  /** Aggregates `unknown_command`-style diagnostics by command name. */
  onUnhandled: (tag: string) => void;
}

const BGM_STOP_TAGS = new Set([
  "bgmstop",
  "bgmstopend",
  "soundstopall",
  "soundstopallend",
  "soundstopallfade",
]);

const EFFECT_TAGS = new Set([
  "effect",
  "fowardeffect",
  "forwardeffect",
  "backeffect",
  "specialeffect",
  "effectmessage",
]);

const EFFECT_STOP_TAGS = new Set([
  "effectstop",
  "effectdestroy",
  "effectforcestop",
  "effectstart",
  "effectpause",
  "effectmessagestop",
  "fowardeffectstop",
  "fowardeffectdestroy",
  "fowardeffectstart",
  "fowardeffectpause",
  "backeffectstop",
  "backeffectdestroy",
]);

const ROLL_TAGS = new Set(["chararoll", "chararollaxis", "chararollmove", "chararollmoveex"]);

const SPECIALEFFECT_ERASURE = new Set([
  "appearancereverse",
  "darkerasure",
  "darkenemyerasure",
  "erasure",
  "enemyerasure",
  "erasurereverse",
  "flasherasure",
]);

function parseNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFace(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBool(value: string | undefined): boolean {
  const normalized = value?.toLowerCase();
  return normalized === "true" || normalized === "on" || normalized === "1";
}

function newCharacterState(
  slot: string,
  id: string,
  name: string,
  face: number,
) {
  return {
    slot,
    id,
    name,
    face,
    // charaSet/equipSet only preload a figure; charaFadein/charaPut reveal it
    // (corpus convention: every entrance carries an explicit fadein).
    visible: false,
    onStage: true,
    position: "center" as const,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    silhouette: false,
    shadow: false,
    layer: "main" as const,
    depth: null,
    effectOnly: isEffectOnlyCharacter(id, name),
  };
}

function newLayerState(
  slot: string,
  id: string,
  source: "background" | "image",
  visible: boolean,
) {
  return {
    slot,
    id,
    source,
    visible,
    onStage: true,
    position: "center" as const,
    x: 0,
    y: 0,
    scale: 1,
    layer: "main" as const,
    depth: null,
  };
}

/**
 * Cancels in-flight slot tweens before a direct reposition/hide so a later
 * stage command always wins over an earlier animation (old reader semantics).
 */
function cancelSlotTweens(ctx: CommandContext, slot: string): void {
  ctx.tweens.cancel(`chara:${slot}:move`);
  ctx.tweens.cancel(`chara:${slot}:scale`);
}

function namedColorToCss(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("#")) return value;
  if (value === "black") return "#000";
  if (value === "white") return "#fff";
  return `#${value}`;
}

/**
 * Executes one stage command. Unknown tags are reported through
 * `ctx.onUnhandled` and skipped (S-P7 容错).
 */
export function executeStageCommand(
  instruction: Instruction,
  ctx: CommandContext,
): void {
  const { stage } = ctx;
  const name = instruction.tag;
  const args = instruction.params;

  switch (true) {
    case name === "sceneset": {
      const slot = args[0];
      if (!slot || !args[1]) return;
      stage.characters.delete(slot);
      stage.layers.set(slot, newLayerState(slot, args[1], "background", false));
      stage.touch();
      return;
    }

    case name === "imageset" || name === "verticalimageset" || name === "horizontalimageset": {
      const slot = args[0];
      if (!slot || !args[1]) return;
      stage.characters.delete(slot);
      stage.layers.set(slot, newLayerState(slot, args[1], "image", false));
      stage.touch();
      return;
    }

    case name === "imagechange": {
      const layer = stage.layers.get(args[0]);
      if (layer) {
        layer.id = args[1];
      } else {
        stage.layers.set(args[0], newLayerState(args[0], args[1], "image", false));
      }
      stage.touch();
      return;
    }

    case name === "masterimageset": {
      if (!args[0]) return;
      const id = ctx.masterGender === "female" ? args[2] : args[1];
      if (!id) return;
      stage.characters.delete(args[0]);
      stage.layers.set(args[0], newLayerState(args[0], id, "image", false));
      stage.touch();
      return;
    }

    case name === "image": {
      if (!args[0]) return;
      const slot = `image:${instruction.line}:${instruction.column}`;
      stage.layers.set(slot, newLayerState(slot, args[0], "image", true));
      stage.touch();
      return;
    }

    case name === "equipset": {
      const [slot, id, rawFace] = args;
      if (!slot || !id) return;
      const face = parseFace(rawFace);
      if (face === null) return;
      const name2 = args.slice(3).join(" ").trim();
      stage.layers.delete(slot);
      stage.characters.set(slot, newCharacterState(slot, id, name2, face));
      stage.touch();
      return;
    }

    case name === "charaset" || name === "masterset": {
      if (!args[0]) return;
      const id = name === "masterset"
        ? (ctx.masterGender === "female" ? args[2] : args[1])
        : args[1];
      const faceToken = name === "masterset" ? args[3] : args[2];
      const face = parseFace(faceToken);
      if (!id || face === null) return;
      const characterName = name === "masterset"
        ? ctx.masterName
        : args.slice(3).join(" ").trim();
      stage.layers.delete(args[0]);
      stage.characters.set(args[0], newCharacterState(args[0], id, characterName, face));
      stage.touch();
      return;
    }

    case name === "charachange" || name === "characrossfade": {
      const [slot, id, rawFace] = args;
      if (!slot || !id) return;
      const current = stage.characters.get(slot);
      const face = parseFace(rawFace) ?? current?.face ?? 0;
      stage.layers.delete(slot);
      stage.characters.set(slot, {
        ...newCharacterState(slot, id, current?.name ?? "", face),
        visible: current?.visible ?? false,
        onStage: current?.onStage ?? true,
        position: current?.position ?? "center",
        x: current?.x ?? 0,
        y: current?.y ?? 0,
        scale: current?.scale ?? 1,
        layer: current?.layer ?? "main",
        depth: current?.depth ?? null,
        silhouette: current?.silhouette ?? false,
        rotation: current?.rotation ?? 0,
        shadow: current?.shadow ?? false,
      });
      stage.touch();
      return;
    }

    case name === "charaface" || name === "charafacefade": {
      const character = stage.characters.get(args[0]);
      const face = parseFace(args[1]);
      if (character && face !== null) {
        character.face = face;
        stage.touch();
      }
      return;
    }

    case name === "charafadetime": {
      const character = stage.characters.get(args[0]);
      const opacity = parseNumber(args[2]);
      if (character && opacity !== null) {
        character.visible = opacity > 0;
        stage.touch();
      }
      return;
    }

    case name === "charatalk": {
      const mode = args[0]?.toLowerCase();
      if (mode === "depthon") {
        stage.subRenderVisible = true;
      } else if (mode === "depthoff") {
        stage.subRenderVisible = false;
      } else if (mode === "off") {
        stage.talkSlots = [];
      } else if (mode && mode !== "on") {
        stage.talkSlots = args[0].split(",").map((slot) => slot.trim()).filter(Boolean);
      } else {
        stage.touch();
        return;
      }
      stage.touch();
      return;
    }

    case name === "charascale" || name.startsWith("charamovescale"): {
      const target = stage.getStageSlot(args[0]);
      const scale = parseNumber(args[1]);
      if (!target || scale === null || scale <= 0) return;
      if (name === "charascale") {
        target.scale = scale;
        stage.touch();
        return;
      }
      // [charaMoveScale 槽 倍率 时长 (缓动)] — tweened zoom.
      const duration = Math.max(0, parseNumber(args[2]) ?? 0);
      const easing = resolveEasing(name.endsWith("ease") ? args[3] : undefined);
      const from = target.scale;
      if (duration > 0 && !ctx.fastForward) {
        ctx.tweens.add({
          owner: `chara:${args[0]}:scale`,
          duration,
          easing,
          onUpdate: (t) => {
            target.scale = from + (scale - from) * t;
            stage.touch();
          },
        });
      } else {
        target.scale = scale;
      }
      stage.touch();
      return;
    }

    case name === "charalayer": {
      const target = stage.getStageSlot(args[0]);
      if (target) {
        target.layer = args[1]?.toLowerCase().startsWith("sub") ? "sub" : "main";
        stage.touch();
      }
      return;
    }

    case name === "charadepth": {
      const target = stage.getStageSlot(args[0]);
      const depth = parseNumber(args[1]);
      if (target && depth !== null) {
        target.depth = depth;
        stage.touch();
      }
      return;
    }

    case name === "charashadow": {
      const character = stage.characters.get(args[0]);
      if (character) {
        character.shadow = toBool(args[1]);
        stage.touch();
      }
      return;
    }

    case ROLL_TAGS.has(name): {
      const character = stage.characters.get(args[0]);
      const angleToken = name === "chararoll" ? args[1] : args[2];
      const angle = parseNumber(angleToken ?? "0");
      if (character && angle !== null) {
        character.rotation = angle;
        stage.touch();
      }
      return;
    }

    case name.startsWith("charafadein"): {
      const target = stage.getStageSlot(args[0]);
      if (target) {
        cancelSlotTweens(ctx, args[0]);
        if (name === "charafadein") stage.applyFadein(target, args[2]);
        else stage.applyPlacement(target, args[2], true);
      }
      return;
    }

    case name.startsWith("charaput"): {
      const target = stage.getStageSlot(args[0]);
      if (target) {
        cancelSlotTweens(ctx, args[0]);
        stage.applyPlacement(target, args[1], true);
      }
      return;
    }

    case name.startsWith("charamove") && !name.startsWith("charamovescale"): {
      const target = stage.getStageSlot(args[0]);
      if (!target || !args[1]) return;
      const duration = Math.max(0, parseNumber(args[2]) ?? 0);
      const easing = name.endsWith("ease") ? resolveEasing(args[3]) : resolveEasing(undefined);
      const dest = resolvePlacement(args[1]);
      const fromX = target.x;
      const fromY = target.y;
      // Classification (left/center/right) applies to the destination.
      stage.applyPlacement(target, args[1]);
      if (duration > 0 && !ctx.fastForward) {
        ctx.tweens.add({
          owner: `chara:${args[0]}:move`,
          duration,
          easing,
          onUpdate: (t) => {
            target.x = fromX + (dest.x - fromX) * t;
            target.y = fromY + (dest.y - fromY) * t;
            stage.touch();
          },
        });
      }
      return;
    }

    case name === "chararelativeloopmove": {
      const target = stage.characters.get(args[0]);
      const endpoint = parseCoordinateToken(args[3]);
      if (target && endpoint) {
        target.x += endpoint.x;
        target.y += endpoint.y;
        stage.applyPlacement(target, `${target.x},${target.y}`);
      }
      return;
    }

    case name === "characlearall": {
      stage.characters.clear();
      stage.layers.clear();
      stage.talkSlots = [];
      stage.subRenderVisible = false;
      stage.touch();
      return;
    }

    case name === "charafadeoutall" || name === "charahideall": {
      for (const character of stage.characters.values()) character.visible = false;
      for (const layer of stage.layers.values()) layer.visible = false;
      stage.touch();
      return;
    }

    case name.startsWith("charafadeout"): {
      const target = stage.getStageSlot(args[0]);
      if (target) {
        cancelSlotTweens(ctx, args[0]);
        target.visible = false;
        stage.touch();
      }
      return;
    }

    case name === "characlear" || name === "charadelete": {
      stage.characters.delete(args[0]);
      stage.layers.delete(args[0]);
      if (stage.talkSlots.includes(args[0])) stage.talkSlots = [];
      stage.touch();
      return;
    }

    case name === "charahide": {
      const target = stage.getStageSlot(args[0]);
      if (target) {
        cancelSlotTweens(ctx, args[0]);
        target.visible = false;
        stage.touch();
      }
      return;
    }

    case name === "charafilter": {
      const character = stage.characters.get(args[0]);
      const mode = args.find((arg) => ["silhouette", "normal"].includes(arg.toLowerCase()));
      if (character && mode) {
        character.silhouette = mode.toLowerCase() === "silhouette";
        stage.touch();
      }
      return;
    }

    case name === "characutin" || name === "characutinpause": {
      const target = stage.getStageSlot(args[0]);
      if (target) {
        target.visible = true;
        stage.touch();
      }
      return;
    }

    case name === "characutout": {
      const target = stage.getStageSlot(args[0]);
      if (target) {
        target.visible = false;
        stage.touch();
      }
      return;
    }

    case name === "charaspecialeffect": {
      const character = stage.characters.get(args[0]);
      const effect = args[1]?.toLowerCase();
      if (character && effect) {
        if (SPECIALEFFECT_ERASURE.has(effect)) character.visible = false;
        if (effect === "appearance") character.visible = true;
        stage.touch();
      }
      return;
    }

    case name === "scene" || name === "masterscene": {
      const id = name === "masterscene"
        ? (ctx.masterGender === "female" ? args[1] : args[0])
        : args[0];
      if (!id) return;
      const crossfadeDuration = parseNumber(name === "masterscene" ? args[2] : args[1]) ?? 0;
      stage.setScene(id, crossfadeDuration > 0 ? "fade" : "none", crossfadeDuration);
      if (crossfadeDuration > 0) {
        // L0 double-buffer crossfade (S-R4): buffer B fades out over duration.
        ctx.tweens.add({
          owner: "sceneCrossfade",
          duration: crossfadeDuration,
          onUpdate: (t) => {
            stage.background.crossfade = t;
          },
          onComplete: () => {
            stage.background.crossfade = 1;
            stage.background.previous = null;
            stage.touch();
          },
        });
      }
      return;
    }

    case name === "bgm": {
      if (!args[0]) return;
      const volume = parseNumber(args[1]);
      stage.setBgm(args[0], volume === null ? null : Math.max(0, Math.min(1, volume)));
      return;
    }

    case BGM_STOP_TAGS.has(name): {
      stage.setBgm(null, null);
      ctx.emitAudio({ kind: "stopAll" });
      return;
    }

    case name === "se" || name === "cuese": {
      if (args[0]) ctx.emitAudio({ kind: "play", channel: "se", name: args[0] });
      return;
    }

    case name === "sestop" || name === "cuesestop": {
      ctx.emitAudio({ kind: "stop", channel: "se", ...(args[0] ? { name: args[0] } : {}) });
      return;
    }

    case name === "voice" || name === "tvoice": {
      if (args[0]) ctx.emitAudio({ kind: "play", channel: "voice", name: args[0] });
      return;
    }

    case name === "voicestop": {
      ctx.emitAudio({ kind: "stop", channel: "voice" });
      return;
    }

    case name === "jingle": {
      if (args[0]) ctx.emitAudio({ kind: "play", channel: "jingle", name: args[0] });
      return;
    }

    case name === "jinglestop": {
      ctx.emitAudio({ kind: "stop", channel: "jingle" });
      return;
    }

    case name === "subbgm": {
      if (args[0]) ctx.emitAudio({ kind: "play", channel: "subBgm", name: args[0], loop: true });
      return;
    }

    case name === "subbgmstop": {
      ctx.emitAudio({ kind: "stop", channel: "subBgm" });
      return;
    }

    case name === "fadein" || name === "fadeout" || name === "fademove": {
      const duration = Math.max(0, parseNumber(args[1]) ?? 0.5);
      const toColor = namedColorToCss(args[0]);
      const isOut = name === "fadeout";
      const from = stage.fade.alpha;
      const to = isOut ? 1 : 0;
      stage.requestFade({
        color: toColor,
        direction: isOut ? "out" : "in",
        duration,
      });
      // R9.1: the fade mesh is a tweened alpha — fadeout covers the screen,
      // fadein reveals it. [wait fade] suspends until the tween completes.
      ctx.tweens.add({
        owner: "fade",
        duration,
        onUpdate: (t) => {
          stage.fade.alpha = from + (to - from) * t;
        },
        onComplete: () => {
          stage.fade.alpha = to;
          stage.touch();
        },
      });
      if (args.some((arg) => arg.toLowerCase() === "white")) {
        stage.requestFlash("#fff", 0.3);
      }
      return;
    }

    case name === "wipein" || name === "wipeout" || name === "wipefilter": {
      stage.requestWipe({
        color: namedColorToCss(args[0]),
        kind: name === "wipefilter" ? "filter" : name === "wipeout" ? "out" : "in",
        duration: parseNumber(args[1]) ?? 0.5,
      });
      return;
    }

    case name === "wipeoff":
    case name === "flashoff":
    case name === "messageshakestop":
    case name === "shakestop":
    case name === "messagechange":
    case name === "messagealign":
    case name === "talknameback":
    case name === "skip":
    case name === "tapskip":
    case name === "selectionuse":
    case name === "clear":
      return;

    case name === "flashin" || name === "flashout": {
      stage.requestFlash(namedColorToCss(args[2] ?? "white"), 0.3);
      return;
    }

    case name === "distortionstart": {
      stage.setScreenEffect("distortion");
      return;
    }

    case name === "distortionstop": {
      stage.setScreenEffect(null);
      return;
    }

    case name === "subcameraon":
    case name === "subrenderon":
    case name.startsWith("subrenderfadein"): {
      stage.subRenderVisible = true;
      stage.touch();
      return;
    }

    case name === "subcameraoff"
      || name === "subrenderoff"
      || name === "subrenderdestroy"
      || name.startsWith("subrenderfadeout"): {
      stage.subRenderVisible = false;
      stage.touch();
      return;
    }

    case name === "subcamerafilter": {
      stage.camera.filter = args.find((arg) => !arg.startsWith("#")) ?? null;
      stage.touch();
      return;
    }

    case name === "subrenderscale": {
      const scale = parseNumber(args[1]);
      if (scale !== null && scale > 0) {
        for (const layer of stage.layers.values()) {
          if (layer.layer === "sub") layer.scale = scale;
        }
        stage.touch();
      }
      return;
    }

    case name.startsWith("mask") || name.startsWith("stretch"): {
      const from = stage.fade.alpha;
      stage.requestFade({
        color: namedColorToCss(args[0]),
        direction: "out",
        duration: 0.5,
      });
      ctx.tweens.add({
        owner: "fade",
        duration: 0.5,
        onUpdate: (t) => {
          stage.fade.alpha = from + (1 - from) * t;
        },
      });
      return;
    }

    case name === "messageoff" || name === "messageon": {
      stage.messageVisible = name === "messageon";
      stage.touch();
      return;
    }

    case name === "messageshake" || name === "shake" || name === "quake" || name === "vibrate": {
      stage.requestShake();
      return;
    }

    case name === "cameramove" || name === "cameramoveease": {
      const eased = name === "cameramoveease";
      const dest = parseCoordinateToken(eased ? args[0] : args[1]) ?? { x: 0, y: 0 };
      const scale = parseNumber(eased ? args[3] : args[2]);
      const duration = Math.max(0, parseNumber(eased ? args[1] : args[0]) ?? 0);
      const easing = resolveEasing(eased ? args[2] : undefined);
      const from = { x: stage.camera.x, y: stage.camera.y, scale: stage.camera.scale };
      const toScale = scale !== null && scale > 0 ? scale : from.scale;
      if (duration > 0 && !ctx.fastForward) {
        ctx.tweens.add({
          owner: "camera",
          duration,
          easing,
          onUpdate: (t) => {
            stage.camera.x = from.x + (dest.x - from.x) * t;
            stage.camera.y = from.y + (dest.y - from.y) * t;
            stage.camera.scale = from.scale + (toScale - from.scale) * t;
            stage.touch();
          },
        });
      } else {
        stage.camera.x = dest.x;
        stage.camera.y = dest.y;
        stage.camera.scale = toScale;
      }
      stage.touch();
      return;
    }

    case name === "camerahome": {
      stage.camera.x = 0;
      stage.camera.y = 0;
      stage.camera.scale = 1;
      stage.camera.rotation = 0;
      stage.touch();
      return;
    }

    case name === "cameraroll" || name === "camerarollmove": {
      const angle = parseNumber(name === "cameraroll" ? args[0] : args[1]);
      if (angle !== null) {
        stage.camera.rotation = angle;
        stage.touch();
      }
      return;
    }

    case name === "camerafilter": {
      stage.camera.filter = args[0] ?? null;
      stage.touch();
      return;
    }

    case name === "backcameracolor": {
      stage.camera.filter = null;
      stage.touch();
      return;
    }

    case name === "blur" || name === "subblur" || name === "subblur2": {
      stage.blur = parseBlurIntensity(args, name === "blur" ? 0 : 1);
      stage.touch();
      return;
    }

    case name === "bluroff" || name === "subbluroff" || name === "subblur2off": {
      stage.blur = null;
      stage.touch();
      return;
    }

    case name === "pictureframe" || name === "pictureframetop": {
      stage.pictureFrame = args[0] ?? null;
      stage.touch();
      return;
    }

    case name === "crimovie" || name === "movie": {
      stage.movie = args[0] ?? null;
      stage.touch();
      return;
    }

    case EFFECT_TAGS.has(name): {
      stage.setScreenEffect(args[0] ?? name);
      return;
    }

    case EFFECT_STOP_TAGS.has(name): {
      stage.setScreenEffect(null);
      return;
    }

    case name === "overlayfadein": {
      const layer = stage.getStageSlot(args[0]);
      if (layer) stage.applyPlacement(layer, args[2], true);
      return;
    }

    case name.startsWith("subrender"): {
      if (name.includes("shake")) stage.requestShake();
      return;
    }

    case name === "charaattack" || name === "cameramovereturn": {
      stage.requestShake();
      return;
    }

    case name === "se": {
      // A handful of SE ids double as impact effects in the corpus.
      if (args[0]?.toLowerCase().startsWith("ad9")) stage.requestShake();
      return;
    }

    default: {
      // Corpus heuristics kept from the previous pipeline: unknown names that
      // clearly describe a shake still produce one; everything else is skipped.
      const unknown = name;
      if (
        (unknown.includes("shake") && !unknown.endsWith("stop"))
        || unknown.includes("quake")
        || unknown.includes("vibrate")
      ) {
        stage.requestShake();
        return;
      }
      ctx.onUnhandled(unknown);
      return;
    }
  }
}

import type {
  CharacterPosition,
  CharacterState,
  FrameEffect,
  FrameTransition,
  ScriptDiagnostic,
  StoryFrame,
} from "../types";
import type {
  ScriptChoiceNode,
  ScriptCommandNode,
  ScriptDocument,
  ScriptInlineNode,
  ScriptNode,
  SourceSpan,
} from "./scriptSyntax";
import { SCRIPT_PARSER_VERSION } from "./scriptParserVersion";

interface CharacterDefinition {
  slot: string;
  id: string;
  name: string;
  face: number;
  visible: boolean;
  onStage: boolean;
  position: CharacterPosition;
  layer: "main" | "sub";
  depth: number | null;
  effectOnly: boolean;
  silhouette: boolean;
}

interface SceneLayerDefinition {
  slot: string;
  visible: boolean;
  onStage: boolean;
  position: CharacterPosition;
  layer: "main" | "sub";
  depth: number | null;
}

interface ProjectionState {
  scene: string | null;
  scenePending: boolean;
  sceneAnchor: SourceSpan | null;
  bgm: string | null;
  talkSlot: string | null;
  subRenderVisible: boolean;
  characters: Map<string, CharacterDefinition>;
  sceneLayers: Map<string, SceneLayerDefinition>;
  animationPending: boolean;
  animationAnchor: SourceSpan | null;
  animationBaseline: string | null;
  nextEffect: FrameEffect;
  nextTransition: FrameTransition;
}

export interface ProjectScriptOptions {
  masterName: string;
  masterGender: "male" | "female";
  maxFrames: number;
}

export interface ProjectScriptResult {
  frames: StoryFrame[];
  diagnostics: ScriptDiagnostic[];
  frameCount: number;
  choiceCount: number;
  characterCount: number;
  sceneCount: number;
  bgmCount: number;
}

interface ProjectionContext {
  scriptId: string;
  options: ProjectScriptOptions;
  diagnostics: ScriptDiagnostic[];
  idOrdinals: Map<string, number>;
  frameCount: number;
  choiceCount: number;
  characters: Set<string>;
  scenes: Set<string>;
  bgms: Set<string>;
  stopped: boolean;
}

const EFFECT_ONLY_CHARACTER_IDS = new Set(["98014000", "98109200", "98115000"]);
const EFFECT_ONLY_NAME = /^(?:エフェクト用|特效用|特效专用|特效專用|이펙트용|effect\s*(?:only|anchor|use)?)(?:[\s_-]*(?:dummy|ダミー|더미))?$/i;
const POSITION_X = [-256, 0, 256, -438, -512, 438, 512];
const OFF_STAGE_X = 1000;

function initialState(): ProjectionState {
  return {
    scene: null,
    scenePending: false,
    sceneAnchor: null,
    bgm: null,
    talkSlot: null,
    subRenderVisible: false,
    characters: new Map(),
    sceneLayers: new Map(),
    animationPending: false,
    animationAnchor: null,
    animationBaseline: null,
    nextEffect: "none",
    nextTransition: "none",
  };
}

function cloneState(state: ProjectionState): ProjectionState {
  return {
    ...state,
    sceneAnchor: state.sceneAnchor ? { ...state.sceneAnchor } : null,
    animationAnchor: state.animationAnchor ? { ...state.animationAnchor } : null,
    characters: new Map(
      [...state.characters].map(([slot, character]) => [slot, { ...character }]),
    ),
    sceneLayers: new Map(
      [...state.sceneLayers].map(([slot, layer]) => [slot, { ...layer }]),
    ),
  };
}

function isEffectOnlyCharacter(id: string, name: string) {
  return EFFECT_ONLY_CHARACTER_IDS.has(id) || EFFECT_ONLY_NAME.test(name);
}

function placementFromToken(token?: string): {
  position: CharacterPosition;
  onStage: boolean;
} {
  let x = 0;
  if (token?.includes(",")) {
    x = Number.parseFloat(token.split(",", 1)[0]);
  } else {
    const index = Number.parseInt(token ?? "1", 10);
    x = POSITION_X[index] ?? index;
  }
  if (!Number.isFinite(x)) x = 0;

  if (Math.abs(x) >= OFF_STAGE_X) {
    return { position: x < 0 ? "left" : "right", onStage: false };
  }
  if (x < -96) return { position: "left", onStage: true };
  if (x > 96) return { position: "right", onStage: true };
  return { position: "center", onStage: true };
}

function normalizeRenderedText(value: string, masterName: string) {
  return value
    .replace(/\{0\}/g, masterName)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderInlineNodes(
  nodes: ScriptInlineNode[],
  options: Pick<ProjectScriptOptions, "masterName" | "masterGender">,
  onCommand?: (command: ScriptCommandNode) => void,
): string {
  let output = "";
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        output += node.value;
        break;
      case "newline":
        output += "\n";
        break;
      case "masterName":
        output += options.masterName;
        break;
      case "line":
        output += "——";
        break;
      case "ruby":
        output += renderInlineNodes(node.text, options, onCommand);
        break;
      case "gender":
        output += renderInlineNodes(
          options.masterGender === "female" ? node.female : node.male,
          options,
          onCommand,
        );
        break;
      case "servantName":
        output += node.text;
        break;
      case "command":
        onCommand?.(node);
        break;
      case "format":
        break;
    }
  }
  return normalizeRenderedText(output, options.masterName);
}

export function renderScriptText(
  nodes: ScriptInlineNode[],
  masterName = "御主",
  masterGender: "male" | "female" = "male",
) {
  return renderInlineNodes(nodes, { masterName, masterGender });
}

function makeFrameId(
  context: ProjectionContext,
  kind: "d" | "a" | "c" | "s",
  span: SourceSpan,
) {
  const key = `${kind}:${span.startLine}:${span.startColumn}`;
  const ordinal = context.idOrdinals.get(key) ?? 0;
  context.idOrdinals.set(key, ordinal + 1);
  return `${context.scriptId}@v${SCRIPT_PARSER_VERSION}:${kind}:${span.startLine}:${span.startColumn}:${ordinal}`;
}

function addDiagnostic(
  context: ProjectionContext,
  command: ScriptCommandNode | SourceSpan,
  code: string,
  message: string,
  severity: "warning" | "error" = "warning",
) {
  const span = "span" in command ? command.span : command;
  context.diagnostics.push({
    severity,
    code,
    message,
    line: span.startLine,
    column: span.startColumn,
    ...(command && "name" in command ? { command: command.name } : {}),
  });
}

function snapshotCharacters(
  state: ProjectionState,
  speaker: string,
  explicitSlots?: string[],
  useTalkSlot = true,
): CharacterState[] {
  const uniqueByName = [...state.characters.values()].filter(
    (character) => character.name === speaker,
  );
  const validExplicitSlots = (explicitSlots ?? []).filter((slot) => state.characters.has(slot));
  const talkSlots = useTalkSlot
    ? (state.talkSlot ?? "")
      .split(",")
      .map((slot) => slot.trim())
      .filter((slot) => state.characters.has(slot))
    : [];
  const activeSlots = new Set(
    validExplicitSlots.length
      ? validExplicitSlots
      : talkSlots.length
        ? talkSlots
        : uniqueByName.length === 1
          ? [uniqueByName[0].slot]
          : [],
  );
  const occludingDepths = [...state.sceneLayers.values()]
    .filter((layer) => (
      layer.visible
      && layer.onStage
      && layer.layer === "main"
      && layer.depth !== null
    ))
    .map((layer) => layer.depth as number);
  const occludingDepth = occludingDepths.length
    ? Math.max(...occludingDepths)
    : null;

  return [...state.characters.values()]
    .filter(
      (character) =>
        character.visible
        && character.onStage
        && !character.effectOnly
        && (
          character.layer === "sub"
            ? state.subRenderVisible
            : occludingDepth === null || (character.depth ?? 0) > occludingDepth
        ),
    )
    .map((character) => ({
      slot: character.slot,
      id: character.id,
      name: character.name,
      face: character.face,
      visible: character.visible,
      position: character.position,
      silhouette: character.silhouette,
      active: activeSlots.has(character.slot),
    }));
}

function animationSnapshotKey(state: ProjectionState) {
  return JSON.stringify({
    scene: state.scene,
    characters: snapshotCharacters(state, "", [], false).map((character) => ({
      slot: character.slot,
      id: character.id,
      face: character.face,
      position: character.position,
      silhouette: character.silhouette,
    })),
  });
}

function resetPendingAnimation(state: ProjectionState) {
  state.animationPending = false;
  state.animationAnchor = null;
  state.animationBaseline = null;
}

function trackAnimationMutation(
  state: ProjectionState,
  before: string,
  span: SourceSpan,
) {
  const after = animationSnapshotKey(state);
  if (before === after) return;
  if (!state.animationPending) {
    state.animationPending = true;
    state.animationAnchor = { ...span };
    state.animationBaseline = before;
  }
}

function consumePresentationState(state: ProjectionState) {
  const presentation = {
    effect: state.nextEffect,
    transition: state.nextTransition,
  };
  state.nextEffect = "none";
  state.nextTransition = "none";
  return presentation;
}

function pushFrame(
  target: StoryFrame[],
  frame: StoryFrame,
  context: ProjectionContext,
  span: SourceSpan,
) {
  if (context.stopped) return false;
  if (context.frameCount >= context.options.maxFrames) {
    context.stopped = true;
    addDiagnostic(
      context,
      span,
      "frame_limit",
      `展开后的剧情帧超过 ${context.options.maxFrames} 条限制`,
      "error",
    );
    return false;
  }
  target.push(frame);
  context.frameCount += 1;
  if (frame.type === "choice") context.choiceCount += 1;
  if (frame.scene) context.scenes.add(frame.scene);
  if (frame.bgm) context.bgms.add(frame.bgm);
  for (const character of frame.characters) context.characters.add(character.id);
  return true;
}

function flushPendingAnimation(
  state: ProjectionState,
  target: StoryFrame[],
  context: ProjectionContext,
  fallbackSpan: SourceSpan,
) {
  if (!state.animationPending || context.stopped) return;
  const baseline = state.animationBaseline;
  const current = animationSnapshotKey(state);
  const span = state.animationAnchor ?? fallbackSpan;
  resetPendingAnimation(state);
  if (baseline === current) return;

  const presentation = consumePresentationState(state);
  pushFrame(target, {
    id: makeFrameId(context, "a", span),
    type: "animation",
    speaker: "",
    text: "",
    scene: state.scene,
    bgm: state.bgm,
    characters: snapshotCharacters(state, "", [], false),
    ...presentation,
  }, context, span);
  state.scenePending = false;
  state.sceneAnchor = null;
}

function flushPendingScene(
  state: ProjectionState,
  target: StoryFrame[],
  context: ProjectionContext,
) {
  if (!state.scenePending || state.scene === null || context.stopped) return;
  const span = state.sceneAnchor ?? {
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: 1,
  };
  const presentation = consumePresentationState(state);
  pushFrame(target, {
    id: makeFrameId(context, "s", span),
    type: "dialogue",
    speaker: "旁白",
    text: "",
    scene: state.scene,
    bgm: state.bgm,
    characters: snapshotCharacters(state, "", [], false),
    ...presentation,
  }, context, span);
  resetPendingAnimation(state);
  state.scenePending = false;
}

function requireArgs(
  command: ScriptCommandNode,
  count: number,
  context: ProjectionContext,
) {
  if (command.args.length >= count) return true;
  addDiagnostic(
    context,
    command,
    "invalid_command_arguments",
    `命令 ${command.name} 缺少参数`,
  );
  return false;
}

function applyPlacement(
  target: CharacterDefinition | SceneLayerDefinition,
  token?: string,
  visible?: boolean,
) {
  const placement = placementFromToken(token);
  target.position = placement.position;
  target.onStage = placement.onStage;
  if (visible !== undefined) target.visible = visible;
}

function getStageSlot(state: ProjectionState, slot: string) {
  return state.characters.get(slot) ?? state.sceneLayers.get(slot);
}

function applyCommand(
  command: ScriptCommandNode,
  state: ProjectionState,
  target: StoryFrame[],
  context: ProjectionContext,
) {
  const name = command.normalizedName;
  const args = command.args;

  if (name === "end" || name === "endfade" || name === "interruption") {
    if (name === "endfade") state.nextTransition = "fade";
    flushPendingScene(state, target, context);
    return true;
  }

  if (name === "sceneset") {
    if (!args[0]) return;
    const slot = args[0];
    state.characters.delete(slot);
    state.sceneLayers.set(slot, {
      slot,
      visible: false,
      onStage: true,
      position: "center",
      layer: "main",
      depth: null,
    });
    return;
  }

  if (
    [
      "imageset",
      "imagechange",
      "verticalimageset",
      "horizontalimageset",
      "equipset",
      "masterimageset",
    ].includes(name)
  ) {
    if (args[0]) {
      state.characters.delete(args[0]);
      state.sceneLayers.delete(args[0]);
    }
    return;
  }

  if (name === "charaset" || name === "masterset") {
    if (!requireArgs(command, 4, context)) return;
    const [slot, rawId, rawFace, ...rawName] = args;
    const id = name === "masterset"
      ? (context.options.masterGender === "female" ? args[2] : args[1])
      : rawId;
    const faceToken = name === "masterset" ? args[3] : rawFace;
    const nameParts = name === "masterset" ? [] : rawName;
    const face = Number.parseInt(faceToken, 10);
    const characterName = name === "masterset"
      ? context.options.masterName
      : nameParts.join(" ").trim();
    if (!Number.isFinite(face)) {
      addDiagnostic(context, command, "invalid_character_face", "角色表情编号无效");
      return;
    }
    state.sceneLayers.delete(slot);
    state.characters.set(slot, {
      slot,
      id,
      name: characterName,
      face,
      // charaSet/masterSet only preload a figure. The numeric argument is the
      // initial face, not a visibility flag; stage commands reveal it later.
      visible: false,
      onStage: true,
      position: "center",
      layer: "main",
      depth: null,
      effectOnly: isEffectOnlyCharacter(id, characterName),
      silhouette: false,
    });
    return;
  }

  if (name === "charachange" || name === "characrossfade") {
    if (!requireArgs(command, 3, context)) return;
    const [slot, id, rawFace] = args;
    const current = state.characters.get(slot);
    const face = Number.parseInt(rawFace, 10);
    const characterName = current?.name ?? "";
    state.sceneLayers.delete(slot);
    state.characters.set(slot, {
      slot,
      id,
      name: characterName,
      face: Number.isFinite(face) ? face : current?.face ?? 0,
      visible: current?.visible ?? false,
      onStage: current?.onStage ?? true,
      position: current?.position ?? "center",
      layer: current?.layer ?? "main",
      depth: current?.depth ?? null,
      effectOnly: isEffectOnlyCharacter(id, characterName),
      silhouette: current?.silhouette ?? false,
    });
    return;
  }

  if (name === "charaface" || name === "charafacefade") {
    if (!requireArgs(command, 2, context)) return;
    const character = state.characters.get(args[0]);
    const face = Number.parseInt(args[1], 10);
    if (character && Number.isFinite(face)) character.face = face;
    else if (!Number.isFinite(face)) {
      addDiagnostic(context, command, "invalid_character_face", "角色表情编号无效");
    }
    return;
  }

  if (name === "charafadetime") {
    if (!requireArgs(command, 3, context)) return;
    const character = state.characters.get(args[0]);
    const opacity = Number.parseFloat(args[2]);
    if (character && Number.isFinite(opacity)) character.visible = opacity > 0;
    return;
  }

  if (name === "charatalk") {
    if (!requireArgs(command, 1, context)) return;
    if (["on", "off", "depthon", "depthoff"].includes(args[0].toLowerCase())) {
      state.talkSlot = null;
    } else {
      state.talkSlot = args[0];
    }
    return;
  }

  if (name === "charalayer") {
    if (!requireArgs(command, 2, context)) return;
    const target = getStageSlot(state, args[0]);
    if (target) target.layer = args[1].toLowerCase().startsWith("sub") ? "sub" : "main";
    return;
  }

  if (name === "charadepth") {
    if (!requireArgs(command, 2, context)) return;
    const target = getStageSlot(state, args[0]);
    const depth = Number.parseFloat(args[1]);
    if (target && Number.isFinite(depth)) target.depth = depth;
    return;
  }

  if (name.startsWith("charafadein")) {
    if (!requireArgs(command, 1, context)) return;
    const target = getStageSlot(state, args[0]);
    if (target) applyPlacement(target, args[2], true);
    return;
  }

  if (name.startsWith("charaput")) {
    if (!requireArgs(command, 1, context)) return;
    const target = getStageSlot(state, args[0]);
    if (target) applyPlacement(target, args[1], true);
    return;
  }

  if (name.startsWith("charamove") && !name.startsWith("charamovescale")) {
    if (!requireArgs(command, 1, context)) return;
    const target = getStageSlot(state, args[0]);
    if (target && args[1]) applyPlacement(target, args[1]);
    return;
  }

  if (name === "characlearall") {
    state.characters.clear();
    state.sceneLayers.clear();
    state.talkSlot = null;
    state.subRenderVisible = false;
    return;
  }

  if (["charafadeoutall", "charahideall"].includes(name)) {
    for (const character of state.characters.values()) character.visible = false;
    for (const layer of state.sceneLayers.values()) layer.visible = false;
    return;
  }

  if (name.startsWith("charafadeout")) {
    const target = getStageSlot(state, args[0]);
    if (target) target.visible = false;
    return;
  }

  if (name === "characlear" || name === "charadelete") {
    state.characters.delete(args[0]);
    state.sceneLayers.delete(args[0]);
    if (
      state.talkSlot
      && state.talkSlot.split(",").map((slot) => slot.trim()).includes(args[0])
    ) state.talkSlot = null;
    return;
  }

  if (name === "charahide") {
    const target = getStageSlot(state, args[0]);
    if (target) target.visible = false;
    return;
  }

  if (name === "charafilter") {
    if (!requireArgs(command, 2, context)) return;
    const character = state.characters.get(args[0]);
    const mode = args.find((arg) => ["silhouette", "normal"].includes(arg.toLowerCase()));
    if (character && mode) character.silhouette = mode.toLowerCase() === "silhouette";
    return;
  }

  if (name === "characutin") {
    const target = getStageSlot(state, args[0]);
    if (target) target.visible = true;
    return;
  }

  if (name === "characutout") {
    const target = getStageSlot(state, args[0]);
    if (target) target.visible = false;
    return;
  }

  if (name === "charaspecialeffect") {
    const character = state.characters.get(args[0]);
    if (
      character
      && [
        "appearancereverse",
        "darkerasure",
        "darkenemyerasure",
        "erasure",
        "enemyerasure",
        "erasurereverse",
        "flasherasure",
      ].includes(args[1]?.toLowerCase())
    ) character.visible = false;
    if (character && args[1]?.toLowerCase() === "appearance") character.visible = true;
    return;
  }

  if (name === "scene" || name === "masterscene") {
    if (!requireArgs(command, name === "masterscene" ? 2 : 1, context)) return;
    const scene = name === "masterscene"
      ? (context.options.masterGender === "female" ? args[1] : args[0])
      : args[0];
    if (state.scene !== null && state.scene !== scene) flushPendingScene(state, target, context);
    state.scene = scene;
    state.scenePending = true;
    state.sceneAnchor = command.span;
    return;
  }

  if (name === "bgm") {
    if (!requireArgs(command, 1, context)) return;
    state.bgm = args[0];
    return;
  }

  if (
    [
      "bgmstop",
      "bgmstopend",
      "soundstopall",
      "soundstopallend",
      "soundstopallfade",
    ].includes(name)
  ) {
    state.bgm = null;
    return;
  }

  if (name === "fadein" || name === "fadeout" || name === "fademove") {
    state.nextTransition = "fade";
    if (args.some((arg) => arg.toLowerCase() === "white")) state.nextEffect = "flash";
    return;
  }

  if (name === "wipein" || name === "wipeout" || name === "wipefilter") {
    state.nextTransition = "wipe";
    return;
  }

  if (name === "wipeoff") return;

  if (name === "flashin" || name === "flashout") {
    state.nextEffect = "flash";
    return;
  }

  if (name === "flashoff") return;

  if (
    name.startsWith("subrenderfadein")
    || name === "subrenderon"
  ) {
    state.subRenderVisible = true;
    return;
  }

  if (
    name.startsWith("subrenderfadeout")
    || name === "subrenderoff"
    || name === "subrenderdestroy"
    || name === "subcameraoff"
  ) {
    state.subRenderVisible = false;
    return;
  }

  if (name.startsWith("mask") || name.startsWith("stretch")) {
    state.nextTransition = "fade";
    return;
  }

  if (
    (name.includes("shake") && !name.endsWith("stop"))
    || name.includes("quake")
    || name.includes("vibrate")
    || name === "charaattack"
    || name === "cameramovereturn"
    || (name === "se" && args[0]?.toLowerCase().startsWith("ad9"))
  ) {
    state.nextEffect = "shake";
  }
  return false;
}

function characterEquals(
  left: CharacterDefinition | undefined,
  right: CharacterDefinition | undefined,
) {
  if (!left || !right) return left === right;
  return left.slot === right.slot
    && left.id === right.id
    && left.name === right.name
    && left.face === right.face
    && left.visible === right.visible
    && left.onStage === right.onStage
    && left.position === right.position
    && left.layer === right.layer
    && left.depth === right.depth
    && left.effectOnly === right.effectOnly
    && left.silhouette === right.silhouette;
}

function sceneLayerEquals(
  left: SceneLayerDefinition | undefined,
  right: SceneLayerDefinition | undefined,
) {
  if (!left || !right) return left === right;
  return left.slot === right.slot
    && left.visible === right.visible
    && left.onStage === right.onStage
    && left.position === right.position
    && left.layer === right.layer
    && left.depth === right.depth;
}

function mergeChoiceStates(
  base: ProjectionState,
  branches: ProjectionState[],
  choice: ScriptChoiceNode,
  context: ProjectionContext,
) {
  if (!branches.length) return cloneState(base);
  const result = cloneState(base);
  let divergent = false;

  for (const field of ["scene", "bgm", "talkSlot"] as const) {
    const first = branches[0][field];
    if (branches.every((branch) => branch[field] === first)) result[field] = first;
    else divergent = true;
  }
  const firstSubRenderVisible = branches[0].subRenderVisible;
  if (branches.every((branch) => branch.subRenderVisible === firstSubRenderVisible)) {
    result.subRenderVisible = firstSubRenderVisible;
  } else {
    divergent = true;
  }

  const slots = new Set([
    ...base.characters.keys(),
    ...branches.flatMap((branch) => [...branch.characters.keys()]),
  ]);
  for (const slot of slots) {
    const first = branches[0].characters.get(slot);
    if (branches.every((branch) => characterEquals(branch.characters.get(slot), first))) {
      if (first) result.characters.set(slot, { ...first });
      else result.characters.delete(slot);
    } else {
      divergent = true;
    }
  }

  const sceneLayerSlots = new Set([
    ...base.sceneLayers.keys(),
    ...branches.flatMap((branch) => [...branch.sceneLayers.keys()]),
  ]);
  for (const slot of sceneLayerSlots) {
    const first = branches[0].sceneLayers.get(slot);
    if (branches.every((branch) => sceneLayerEquals(branch.sceneLayers.get(slot), first))) {
      if (first) result.sceneLayers.set(slot, { ...first });
      else result.sceneLayers.delete(slot);
    } else {
      divergent = true;
    }
  }

  result.scenePending = false;
  result.sceneAnchor = null;
  result.animationPending = false;
  result.animationAnchor = null;
  result.animationBaseline = null;
  result.nextEffect = "none";
  result.nextTransition = "none";
  if (divergent) {
    addDiagnostic(
      context,
      choice.span,
      "divergent_choice_state",
      "选项分支结束状态不一致；共享剧情将对分歧字段沿用选项前状态",
    );
  }
  return result;
}

function projectNodes(
  nodes: ScriptNode[],
  initial: ProjectionState,
  context: ProjectionContext,
) {
  const frames: StoryFrame[] = [];
  let state = initial;

  for (const node of nodes) {
    if (context.stopped) break;
    if (node.type === "command") {
      if (
        ["wait", "wt", "twt", "end", "endfade", "interruption"].includes(
          node.normalizedName,
        )
      ) {
        flushPendingAnimation(state, frames, context, node.span);
      }
      const before = animationSnapshotKey(state);
      const shouldStop = applyCommand(node, state, frames, context) === true;
      trackAnimationMutation(state, before, node.span);
      if (shouldStop) break;
      continue;
    }

    if (node.type === "dialogue") {
      const speaker = renderInlineNodes(node.speaker.name, context.options) || "旁白";
      const text = renderInlineNodes(node.body, context.options, (command) => {
        applyCommand(command, state, frames, context);
      });
      const explicitSlots = node.speaker.spots?.length
        ? node.speaker.spots
        : node.speaker.slot
          ? [node.speaker.slot]
          : [];
      if (explicitSlots.some((slot) => state.characters.has(slot))) {
        state.talkSlot = explicitSlots.join(",");
      }
      const presentation = consumePresentationState(state);
      pushFrame(frames, {
        id: makeFrameId(context, "d", node.span),
        type: "dialogue",
        speaker,
        text,
        scene: state.scene,
        bgm: state.bgm,
        characters: snapshotCharacters(state, speaker, explicitSlots),
        ...presentation,
      }, context, node.span);
      resetPendingAnimation(state);
      state.scenePending = false;
      continue;
    }

    resetPendingAnimation(state);
    state.scenePending = false;
    state.sceneAnchor = null;
    const presentation = consumePresentationState(state);
    const branchBase = cloneState(state);
    const parsedBranches = node.options.map((option) => {
      const parsed = projectNodes(option.body, cloneState(branchBase), context);
      return {
        label: renderInlineNodes(option.label, context.options),
        frames: parsed.frames,
        state: parsed.state,
      };
    });

    pushFrame(frames, {
      id: makeFrameId(context, "c", node.span),
      type: "choice",
      speaker: "CHOICE",
      text: "选择回应",
      scene: state.scene,
      bgm: state.bgm,
      characters: snapshotCharacters(state, "", []),
      options: parsedBranches.map((branch) => ({
        label: branch.label,
        frames: branch.frames,
      })),
      ...presentation,
    }, context, node.span);
    state = mergeChoiceStates(
      branchBase,
      parsedBranches.map((branch) => branch.state),
      node,
      context,
    );
  }

  const endSpan = nodes[nodes.length - 1]?.span ?? {
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: 1,
  };
  flushPendingAnimation(state, frames, context, endSpan);
  flushPendingScene(state, frames, context);
  return { frames, state };
}

export function projectScriptDocument(
  document: ScriptDocument,
  scriptId: string,
  options: ProjectScriptOptions,
): ProjectScriptResult {
  const context: ProjectionContext = {
    scriptId,
    options,
    diagnostics: [],
    idOrdinals: new Map(),
    frameCount: 0,
    choiceCount: 0,
    characters: new Set(),
    scenes: new Set(),
    bgms: new Set(),
    stopped: false,
  };
  const projected = projectNodes(document.nodes, initialState(), context);
  return {
    frames: projected.frames,
    diagnostics: context.diagnostics,
    frameCount: context.frameCount,
    choiceCount: context.choiceCount,
    characterCount: context.characters.size,
    sceneCount: context.scenes.size,
    bgmCount: context.bgms.size,
  };
}

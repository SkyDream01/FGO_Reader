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

interface CharacterDefinition {
  slot: string;
  id: string;
  name: string;
  face: number;
  visible: boolean;
  onStage: boolean;
  position: CharacterPosition;
  layer: "main" | "sub";
  effectOnly: boolean;
  silhouette: boolean;
}

interface ProjectionState {
  scene: string | null;
  scenePending: boolean;
  sceneAnchor: SourceSpan | null;
  bgm: string | null;
  talkSlot: string | null;
  characters: Map<string, CharacterDefinition>;
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

const EFFECT_ONLY_CHARACTER_IDS = new Set(["98115000"]);
const EFFECT_ONLY_NAME = /^(?:エフェクト用|特效用|特效专用|特效專用|이펙트용|effect\s*(?:only|anchor|use)?)$/i;
const POSITION_X = [-256, 0, 256, -438, -512, 438, 512];
const OFF_STAGE_X = 1000;

function initialState(): ProjectionState {
  return {
    scene: null,
    scenePending: false,
    sceneAnchor: null,
    bgm: null,
    talkSlot: null,
    characters: new Map(),
    nextEffect: "none",
    nextTransition: "none",
  };
}

function cloneState(state: ProjectionState): ProjectionState {
  return {
    ...state,
    sceneAnchor: state.sceneAnchor ? { ...state.sceneAnchor } : null,
    characters: new Map(
      [...state.characters].map(([slot, character]) => [slot, { ...character }]),
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
  kind: "d" | "c" | "s",
  span: SourceSpan,
) {
  const key = `${kind}:${span.startLine}:${span.startColumn}`;
  const ordinal = context.idOrdinals.get(key) ?? 0;
  context.idOrdinals.set(key, ordinal + 1);
  return `${context.scriptId}@v2:${kind}:${span.startLine}:${span.startColumn}:${ordinal}`;
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
  explicitSlot?: string,
  useTalkSlot = true,
): CharacterState[] {
  const uniqueByName = [...state.characters.values()].filter(
    (character) => character.name === speaker,
  );
  const activeSlot = explicitSlot && state.characters.has(explicitSlot)
    ? explicitSlot
    : useTalkSlot && state.talkSlot && state.characters.has(state.talkSlot)
      ? state.talkSlot
      : uniqueByName.length === 1
        ? uniqueByName[0].slot
        : null;

  return [...state.characters.values()]
    .filter(
      (character) =>
        character.visible
        && character.onStage
        && character.layer === "main"
        && !character.effectOnly,
    )
    .map((character) => ({
      slot: character.slot,
      id: character.id,
      name: character.name,
      face: character.face,
      visible: character.visible,
      position: character.position,
      silhouette: character.silhouette,
      active: character.slot === activeSlot,
    }));
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
    characters: snapshotCharacters(state, "", undefined, false),
    ...presentation,
  }, context, span);
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

function applyPlacement(character: CharacterDefinition, token?: string, visible?: boolean) {
  const placement = placementFromToken(token);
  character.position = placement.position;
  character.onStage = placement.onStage;
  if (visible !== undefined) character.visible = visible;
}

function applyCommand(
  command: ScriptCommandNode,
  state: ProjectionState,
  target: StoryFrame[],
  context: ProjectionContext,
) {
  const name = command.normalizedName;
  const args = command.args;

  if (["imageset", "verticalimageset", "horizontalimageset", "equipset", "sceneset"].includes(name)) {
    if (args[0]) state.characters.delete(args[0]);
    return;
  }

  if (name === "charaset") {
    if (!requireArgs(command, 4, context)) return;
    const [slot, id, rawFace, ...rawName] = args;
    const face = Number.parseInt(rawFace, 10);
    const characterName = rawName.join(" ").trim();
    if (!Number.isFinite(face)) {
      addDiagnostic(context, command, "invalid_character_face", "角色表情编号无效");
      return;
    }
    state.characters.set(slot, {
      slot,
      id,
      name: characterName,
      face,
      visible: false,
      onStage: true,
      position: "center",
      layer: "main",
      effectOnly: isEffectOnlyCharacter(id, characterName),
      silhouette: false,
    });
    return;
  }

  if (name === "charachange" || name === "characrossfade") {
    if (!requireArgs(command, 3, context)) return;
    const [slot, id, rawFace] = args;
    const face = Number.parseInt(rawFace, 10);
    const current = state.characters.get(slot);
    const characterName = current?.name ?? "";
    state.characters.set(slot, {
      slot,
      id,
      name: characterName,
      face: Number.isFinite(face) ? face : current?.face ?? 0,
      visible: current?.visible ?? false,
      onStage: current?.onStage ?? true,
      position: current?.position ?? "center",
      layer: current?.layer ?? "main",
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
    const character = state.characters.get(args[0]);
    if (character) character.layer = args[1].toLowerCase().startsWith("sub") ? "sub" : "main";
    return;
  }

  if (name.startsWith("charafadein")) {
    if (!requireArgs(command, 1, context)) return;
    const character = state.characters.get(args[0]);
    if (character) applyPlacement(character, args[2], true);
    return;
  }

  if (name === "charaput" || name === "charaputfsr" || name === "charaputfsl") {
    if (!requireArgs(command, 1, context)) return;
    const character = state.characters.get(args[0]);
    if (character) applyPlacement(character, args[1], true);
    return;
  }

  if (name.startsWith("charamove")) {
    if (!requireArgs(command, 1, context)) return;
    const character = state.characters.get(args[0]);
    if (character && args[1]) applyPlacement(character, args[1]);
    if (name.includes("return")) state.nextEffect = "shake";
    return;
  }

  if (["charafadeoutall", "characlearall", "charahideall"].includes(name)) {
    for (const character of state.characters.values()) character.visible = false;
    return;
  }

  if (name.startsWith("charafadeout")) {
    const character = state.characters.get(args[0]);
    if (character) character.visible = false;
    return;
  }

  if (["characlear", "charahide", "charadelete"].includes(name)) {
    const character = state.characters.get(args[0]);
    if (character) character.visible = false;
    return;
  }

  if (name === "charafilter") {
    if (!requireArgs(command, 2, context)) return;
    const character = state.characters.get(args[0]);
    if (character) character.silhouette = args[1].toLowerCase() === "silhouette";
    return;
  }

  if (name === "charaspecialeffect") {
    const character = state.characters.get(args[0]);
    if (
      character
      && ["appearancereverse", "enemyerasure", "flasherasure"].includes(args[1]?.toLowerCase())
    ) character.visible = false;
    return;
  }

  if (name === "scene") {
    if (!requireArgs(command, 1, context)) return;
    const scene = args[0];
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

  if (["bgmstop", "bgmstopend", "soundstopall", "soundstopallend"].includes(name)) {
    state.bgm = null;
    return;
  }

  if (name === "fadein" || name === "fadeout") {
    state.nextTransition = "fade";
    if (args.some((arg) => arg.toLowerCase() === "white")) state.nextEffect = "flash";
    return;
  }

  if (name.startsWith("wipe")) {
    state.nextTransition = "wipe";
    return;
  }

  if (name.startsWith("flash")) {
    state.nextEffect = "flash";
    return;
  }

  if (
    name.includes("shake")
    || name.includes("quake")
    || name.includes("vibrate")
    || name === "cameramovereturn"
    || (name === "se" && args[0]?.toLowerCase().startsWith("ad9"))
  ) {
    state.nextEffect = "shake";
  }
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
    && left.effectOnly === right.effectOnly
    && left.silhouette === right.silhouette;
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

  result.scenePending = false;
  result.sceneAnchor = null;
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
      applyCommand(node, state, frames, context);
      continue;
    }

    if (node.type === "dialogue") {
      const speaker = renderInlineNodes(node.speaker.name, context.options) || "旁白";
      const text = renderInlineNodes(node.body, context.options, (command) => {
        applyCommand(command, state, frames, context);
      });
      if (node.speaker.slot && state.characters.has(node.speaker.slot)) {
        state.talkSlot = node.speaker.slot;
      }
      const presentation = consumePresentationState(state);
      pushFrame(frames, {
        id: makeFrameId(context, "d", node.span),
        type: "dialogue",
        speaker,
        text,
        scene: state.scene,
        bgm: state.bgm,
        characters: snapshotCharacters(state, speaker, node.speaker.slot),
        ...presentation,
      }, context, node.span);
      state.scenePending = false;
      continue;
    }

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
      characters: snapshotCharacters(state, ""),
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

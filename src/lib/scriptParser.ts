import type {
  CharacterPosition,
  CharacterState,
  FrameEffect,
  FrameTransition,
  ParsedScript,
  StoryFrame,
} from "../types";

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

interface ParserState {
  scene: string | null;
  bgm: string | null;
  talkSlot: string | null;
  characters: Map<string, CharacterDefinition>;
  nextEffect: FrameEffect;
  nextTransition: FrameTransition;
}

interface ParseContext {
  masterName: string;
  nextId: () => string;
}

function cloneState(state: ParserState): ParserState {
  return {
    ...state,
    characters: new Map(
      [...state.characters].map(([slot, character]) => [slot, { ...character }]),
    ),
  };
}

const EFFECT_ONLY_CHARACTER_IDS = new Set(["98115000"]);
const EFFECT_ONLY_NAME = /^(?:エフェクト用|特效用|特效专用|特效專用|이펙트용|effect\s*(?:only|anchor|use)?)$/i;
const OFF_STAGE_X = 1000;

function isEffectOnlyCharacter(id: string, name: string) {
  return EFFECT_ONLY_CHARACTER_IDS.has(id) || EFFECT_ONLY_NAME.test(name);
}

function placementFromToken(token?: string): {
  position: CharacterPosition;
  onStage: boolean;
} {
  const rawX = token?.includes(",") ? token.split(",")[0] : token;
  const x = Number.parseFloat(rawX ?? "1");

  if (Number.isFinite(x) && Math.abs(x) >= OFF_STAGE_X) {
    return { position: x < 0 ? "left" : "right", onStage: false };
  }

  if (token?.includes(",")) {
    if (x < -96) return { position: "left", onStage: true };
    if (x > 96) return { position: "right", onStage: true };
    return { position: "center", onStage: true };
  }

  const numeric = Number.parseInt(token ?? "1", 10);
  if (numeric <= 0) return { position: "left", onStage: true };
  if (numeric >= 2) return { position: "right", onStage: true };
  return { position: "center", onStage: true };
}

function normalizeName(value: string) {
  return value.trim().replace(/^['\"]|['\"]$/g, "");
}

function applyCommand(commandText: string, state: ParserState) {
  const command = commandText.trim();
  const lower = command.toLowerCase();

  let match = command.match(/^(?:imageSet|sceneSet)\s+(\S+)/i);
  if (match) {
    // Script slots can be reused by non-character presentation assets.
    state.characters.delete(match[1]);
    return;
  }

  match = command.match(/^charaSet\s+(\S+)\s+(-?\d+)\s+\S+\s+(.+)$/i);
  if (match) {
    const [, slot, id, rawName] = match;
    const name = normalizeName(rawName);
    state.characters.set(slot, {
      slot,
      id,
      name,
      face: 0,
      visible: false,
      onStage: true,
      position: "center",
      layer: "main",
      effectOnly: isEffectOnlyCharacter(id, name),
      silhouette: false,
    });
    return;
  }

  match = command.match(/^charaFace\s+(\S+)\s+(-?\d+)/i);
  if (match) {
    const character = state.characters.get(match[1]);
    if (character) character.face = Number(match[2]);
    return;
  }

  match = command.match(/^charaTalk\s+(\S+)/i);
  if (match) {
    const slot = match[1];
    if (/^(off|on)$/i.test(slot)) state.talkSlot = null;
    else if (!/^depth(?:off|on)$/i.test(slot)) state.talkSlot = slot;
    return;
  }

  match = command.match(/^charaLayer\s+(\S+)\s+(\S+)/i);
  if (match) {
    const character = state.characters.get(match[1]);
    if (character) character.layer = /^sub/i.test(match[2]) ? "sub" : "main";
    return;
  }

  match = command.match(/^charaFadein\s+(\S+)\s+\S+\s+(\S+)/i);
  if (match) {
    const character = state.characters.get(match[1]);
    if (character) {
      const placement = placementFromToken(match[2]);
      character.visible = true;
      character.position = placement.position;
      character.onStage = placement.onStage;
    }
    return;
  }

  match = command.match(/^charaPut\s+(\S+)\s+(\S+)/i);
  if (match) {
    const character = state.characters.get(match[1]);
    if (character) {
      const placement = placementFromToken(match[2]);
      character.visible = true;
      character.position = placement.position;
      character.onStage = placement.onStage;
    }
    return;
  }

  match = command.match(/^charaMove\s+(\S+)\s+(\S+)/i);
  if (match) {
    const character = state.characters.get(match[1]);
    if (character) {
      const placement = placementFromToken(match[2]);
      character.position = placement.position;
      character.onStage = placement.onStage;
    }
    return;
  }

  match = command.match(/^charaFadeout\s+(\S+)/i);
  if (match) {
    const character = state.characters.get(match[1]);
    if (character) character.visible = false;
    return;
  }

  if (/^(charaFadeoutAll|charaClearAll|charaHideAll)/i.test(command)) {
    for (const character of state.characters.values()) character.visible = false;
    return;
  }

  match = command.match(/^chara(?:Clear|Hide|Delete)\s+(\S+)/i);
  if (match) {
    const character = state.characters.get(match[1]);
    if (character) character.visible = false;
    return;
  }

  match = command.match(/^charaFilter\s+(\S+)\s+(\S+)/i);
  if (match) {
    const character = state.characters.get(match[1]);
    if (character) character.silhouette = match[2].toLowerCase() === "silhouette";
    return;
  }

  match = command.match(/^scene\s+(\d+)/i);
  if (match) {
    state.scene = match[1];
    return;
  }

  match = command.match(/^bgm\s+(\S+)/i);
  if (match) {
    state.bgm = match[1];
    return;
  }

  if (/^(bgmStop|soundStopAll)/i.test(command)) {
    state.bgm = null;
    return;
  }

  if (/^(fadein|fadeout)/i.test(command)) {
    state.nextTransition = "fade";
    if (/white/i.test(command)) state.nextEffect = "flash";
    return;
  }

  if (/^(wipein|wipeout|wipeFilter)/i.test(command)) {
    state.nextTransition = "wipe";
    return;
  }

  if (
    /quake|shake|vibrate|charaMoveReturn|cameraMoveReturn/i.test(command) ||
    lower.startsWith("se ad9")
  ) {
    state.nextEffect = "shake";
  }
}

function applyCommandsFromLine(line: string, state: ParserState) {
  for (const match of line.matchAll(/\[([^\[\]]+)\]/g)) {
    applyCommand(match[1], state);
  }
}

export function cleanScriptText(value: string, masterName = "御主") {
  return value
    .replace(/\[(?:r|sr|csr)\]/gi, "\n")
    .replace(/\[line\s+\d+\]/gi, "——")
    .replace(/\[#([^:\]]+):[^\]]+\]/g, "$1")
    .replace(/\[&([^:\]]+):[^\]]+\]/g, "$1")
    .replace(/\[%1\]/g, masterName)
    .replace(/\[(?:k|page|wt|wait|messageOff)(?:\s+[^\]]+)?\]/gi, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\{0\}/g, masterName)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function snapshotCharacters(state: ParserState, speaker: string): CharacterState[] {
  const byName = [...state.characters.values()].find(
    (character) => character.name === speaker,
  );
  const activeSlot = byName?.slot ?? state.talkSlot;

  return [...state.characters.values()]
    .filter(
      (character) =>
        character.visible &&
        character.onStage &&
        character.layer === "main" &&
        !character.effectOnly,
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

function consumePresentationState(state: ParserState) {
  const presentation = {
    effect: state.nextEffect,
    transition: state.nextTransition,
  };
  state.nextEffect = "none";
  state.nextTransition = "none";
  return presentation;
}

function isChoiceHeader(line: string) {
  return /^？\d+[：:]/.test(line.trim());
}

function parseChoiceHeader(line: string) {
  const match = line.trim().match(/^？\d+[：:](.*)$/);
  return match?.[1] ?? "";
}

function parseBlock(
  lines: string[],
  initialState: ParserState,
  context: ParseContext,
): { frames: StoryFrame[]; state: ParserState } {
  const frames: StoryFrame[] = [];
  let state = initialState;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (isChoiceHeader(trimmed)) {
      const branches: Array<{ label: string; lines: string[] }> = [];
      let cursor = index;
      let current: { label: string; lines: string[] } | null = null;

      for (; cursor < lines.length; cursor += 1) {
        const branchLine = lines[cursor];
        if (isChoiceHeader(branchLine)) {
          if (current) branches.push(current);
          current = { label: parseChoiceHeader(branchLine), lines: [] };
          continue;
        }
        if (/^？！/.test(branchLine.trim())) {
          if (current) branches.push(current);
          break;
        }
        current?.lines.push(branchLine);
      }

      const choiceState = cloneState(state);
      const parsedBranches = branches.map((branch) => {
        const parsed = parseBlock(branch.lines, cloneState(choiceState), context);
        return {
          label: cleanScriptText(branch.label, context.masterName),
          frames: parsed.frames,
          finalState: parsed.state,
        };
      });

      const presentation = consumePresentationState(state);
      frames.push({
        id: context.nextId(),
        type: "choice",
        speaker: "CHOICE",
        text: "选择回应",
        scene: state.scene,
        bgm: state.bgm,
        characters: snapshotCharacters(state, ""),
        options: parsedBranches.map(({ label, frames: branchFrames }) => ({
          label,
          frames: branchFrames,
        })),
        ...presentation,
      });

      if (parsedBranches[0]) state = cloneState(parsedBranches[0].finalState);
      index = cursor;
      continue;
    }

    applyCommandsFromLine(rawLine, state);

    if (trimmed.startsWith("＠")) {
      const rawSpeaker = cleanScriptText(trimmed.slice(1), context.masterName) || "旁白";
      const slottedSpeaker = rawSpeaker.match(/^(\S{1,3})[：:](.+)$/);
      const speaker = slottedSpeaker?.[2]?.trim() || rawSpeaker;
      if (slottedSpeaker && state.characters.has(slottedSpeaker[1])) {
        state.talkSlot = slottedSpeaker[1];
      }
      const dialogueLines: string[] = [];

      for (index += 1; index < lines.length; index += 1) {
        const dialogueLine = lines[index];
        applyCommandsFromLine(dialogueLine, state);
        dialogueLines.push(dialogueLine);
        if (/\[(?:k|page)(?:\s+[^\]]+)?\]/i.test(dialogueLine)) break;
      }

      const text = cleanScriptText(dialogueLines.join("\n"), context.masterName);
      if (text) {
        const presentation = consumePresentationState(state);
        frames.push({
          id: context.nextId(),
          type: "dialogue",
          speaker,
          text,
          scene: state.scene,
          bgm: state.bgm,
          characters: snapshotCharacters(state, speaker),
          ...presentation,
        });
      }
      continue;
    }
  }

  return { frames, state };
}

export function parseFgoScript(
  source: string,
  scriptId: string,
  masterName = "御主",
): ParsedScript {
  let frameId = 0;
  const context: ParseContext = {
    masterName,
    nextId: () => `${scriptId}-${frameId++}`,
  };
  const initialState: ParserState = {
    scene: null,
    bgm: null,
    talkSlot: null,
    characters: new Map(),
    nextEffect: "none",
    nextTransition: "none",
  };
  const parsed = parseBlock(source.replace(/^\uFEFF/, "").split(/\r?\n/), initialState, context);
  const scenes = new Set(parsed.frames.map((frame) => frame.scene).filter(Boolean));
  const bgms = new Set(parsed.frames.map((frame) => frame.bgm).filter(Boolean));
  const characters = new Set(
    parsed.frames.flatMap((frame) => frame.characters.map((character) => character.id)),
  );

  return {
    scriptId,
    frames: parsed.frames,
    sceneCount: scenes.size,
    bgmCount: bgms.size,
    characterCount: characters.size,
  };
}

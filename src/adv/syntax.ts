import type { Region, ScriptDiagnostic } from "../types";
import { DEFAULT_MARKERS, isCommand, type ScriptMarkers } from "./spec";

export interface SourceSpan {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface ScriptNode {
  type: "command" | "text" | "speaker" | "choice" | "choiceEnd";
  name: string;
  args: string[];
  pd: string[];
  text: string;
  raw: string;
  span: SourceSpan;
}

export interface ScriptDocument {
  header: string | null;
  nodes: ScriptNode[];
  markers: ScriptMarkers;
  diagnostics: ScriptDiagnostic[];
  characterSlotCount: number;
}

export interface ParseScriptDocumentOptions {
  region?: Region;
  markers?: Partial<ScriptMarkers>;
  maxChoiceOptions?: number;
  maxCharacterSlots?: number;
}

/** Quotes are retained; quoted separators/brackets are literal. No escapes. */
export function splitOutside(value: string, separators: string): string[] {
  const pieces: string[] = [];
  let start = 0, depth = 0, quoted = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '"') quoted = !quoted;
    if (quoted) continue;
    if (char === "[") depth++;
    else if (char === "]") depth--;
    else if (depth === 0 && separators.includes(char)) {
      pieces.push(value.slice(start, i), char);
      start = i + 1;
    }
  }
  pieces.push(value.slice(start));
  return pieces;
}

export function parseCommandParameters(value: string): string[] {
  return splitOutside(value.trim(), " \t").filter((piece) => piece !== " " && piece !== "\t" && piece !== "");
}

export function parseNativeParameters(value: string): string[] {
  const pieces = splitOutside(value.trim(), " \t,=");
  const result: string[] = [];
  for (const piece of pieces) {
    const normalized = piece === "\t" ? " " : piece;
    if (!normalized || (normalized === " " && result.at(-1) === " ")) continue;
    result.push(normalized);
  }
  return result;
}

export function closingBracket(text: string, start: number): number {
  let depth = 0, quoted = false;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '"') quoted = !quoted;
    if (quoted) continue;
    if (text[i] === "[") depth++;
    else if (text[i] === "]" && --depth === 0) return i;
  }
  return -1;
}

export function standaloneCommand(text: string): { name: string; args: string[]; pd: string[] } | null {
  if (!text.startsWith("[") || closingBracket(text, 0) !== text.length - 1) return null;
  const content = text.slice(1, -1), args = parseCommandParameters(content);
  const name = args.shift() ?? "";
  if (!isCommand(name)) return null;
  return { name, args, pd: parseNativeParameters(content.slice(name.length)) };
}

/** Flat source records preserve authored flow, including every entry label. */
export function parseScriptDocument(source: string, options: ParseScriptDocumentOptions = {}): ScriptDocument {
  const markers = { ...DEFAULT_MARKERS, ...options.markers };
  if (Object.values(markers).some((marker) => !marker)) throw new Error("脚本控制符不能为空");
  const nodes: ScriptNode[] = [], diagnostics: ScriptDiagnostic[] = [];
  const slots = new Set<string>();
  let header: string | null = null, choices = 0;
  const lines = source.replace(/^\uFEFF/, "").replace(/\r/g, "").split(/[\uBBBF\uFEFF\uFFFE\n]/);
  lines.forEach((raw, index) => {
    const text = raw.trim();
    if (!text || text.startsWith(markers.comment) || text.startsWith("//") || text.startsWith("#")) return;
    const span = { startLine: index + 1, startColumn: raw.indexOf(text) + 1, endLine: index + 1, endColumn: raw.length + 1 };
    const node: ScriptNode = { type: "text", name: "", args: [], pd: [], text, raw, span };
    if (text.startsWith(markers.choiceEnd)) {
      node.type = "choiceEnd";
      choices = 0;
    } else if (text.startsWith(markers.choice) && text.includes(markers.choiceSplit)) {
      node.type = "choice";
      node.text = text.slice(markers.choice.length);
      choices++;
      if (choices > (options.maxChoiceOptions ?? 9)) diagnostics.push({ severity: "error", code: "choice_limit", message: "选项数量超过限制", line: index + 1, column: span.startColumn });
    } else if (text.startsWith(markers.talk)) {
      node.type = "speaker";
      node.text = text.slice(markers.talk.length);
    } else {
      const control = ([ [markers.label, "label"], [markers.scene, "scene"], [markers.voice, "voice"], [markers.insert, "insertionAnimationSet"], [markers.return, "end"] ] as const)
        .find(([marker]) => text.startsWith(marker));
      const command = control
        ? { name: control[1], args: parseCommandParameters(text.slice(control[0].length)), pd: parseNativeParameters(text.slice(control[0].length)) }
        : standaloneCommand(text);
      if (command) {
        Object.assign(node, { type: "command", ...command });
        if (command.name === "switchCase") { node.type = "choice"; node.text = command.args.join(" "); choices++; }
        if (command.name === "switchCaseEnd") { node.type = "choiceEnd"; choices = 0; }
        if (command.name === "label" && header === null) header = command.args[0] ?? "";
        if (/^(?:charaSet|masterSet|imageSet|sceneSet|figureSet|equipSet|verticalImageSet|horizontalImageSet)$/.test(command.name)) slots.add(command.args[0] ?? "A");
      }
    }
    nodes.push(node);
  });
  if (slots.size > Math.min(26, options.maxCharacterSlots ?? 26)) diagnostics.push({ severity: "error", code: "character_slot_limit", message: "角色槽位超过 26 个限制", line: 1, column: 1 });
  return { header, nodes, markers, diagnostics, characterSlotCount: slots.size };
}

import type { Region, ScriptDiagnostic } from "../types";

export interface SourceSpan {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export type ScriptCommandKind =
  | "asset"
  | "character"
  | "background"
  | "bgm"
  | "transition"
  | "effect"
  | "audio"
  | "flow"
  | "presentation"
  | "unknown";

export interface ScriptCommandNode {
  type: "command";
  kind: ScriptCommandKind;
  name: string;
  normalizedName: string;
  args: string[];
  raw: string;
  span: SourceSpan;
}

export type ScriptInlineNode =
  | { type: "text"; value: string; span: SourceSpan }
  | { type: "newline"; span: SourceSpan }
  | { type: "masterName"; span: SourceSpan }
  | { type: "line"; length: number; span: SourceSpan }
  | { type: "ruby"; text: ScriptInlineNode[]; ruby: string; span: SourceSpan }
  | { type: "gender"; male: ScriptInlineNode[]; female: ScriptInlineNode[]; span: SourceSpan }
  | { type: "servantName"; text: string; span: SourceSpan }
  | { type: "format"; name: string; value?: string; span: SourceSpan }
  | ScriptCommandNode;

export interface ScriptSpeakerNode {
  slot?: string;
  name: ScriptInlineNode[];
  rawName: string;
  spots?: string[];
  span: SourceSpan;
}

export interface ScriptDialogueNode {
  type: "dialogue";
  speaker: ScriptSpeakerNode;
  body: ScriptInlineNode[];
  span: SourceSpan;
}

export interface ScriptChoiceRouteInfo {
  route?: number;
  saveCollection: boolean;
  routeType: "none" | "true" | "bad";
}

export interface ScriptChoiceOptionNode {
  id: number;
  label: ScriptInlineNode[];
  body: ScriptNode[];
  routeInfo?: ScriptChoiceRouteInfo;
  span: SourceSpan;
}

export interface ScriptChoiceNode {
  type: "choice";
  options: ScriptChoiceOptionNode[];
  span: SourceSpan;
}

export type ScriptNode = ScriptCommandNode | ScriptDialogueNode | ScriptChoiceNode;

export interface ScriptDocument {
  nodes: ScriptNode[];
  diagnostics: ScriptDiagnostic[];
  characterSlotCount: number;
}

export interface ParseScriptDocumentOptions {
  region?: Region;
  maxChoiceOptions?: number;
  maxCharacterSlots?: number;
}

interface LineRecord {
  content: string;
  line: number;
}

interface TextSegment {
  type: "text";
  value: string;
  span: SourceSpan;
}

interface BracketSegment {
  type: "bracket";
  content: string;
  raw: string;
  span: SourceSpan;
}

type LineSegment = TextSegment | BracketSegment;

class DiagnosticCollector {
  private entries: ScriptDiagnostic[] = [];
  private unknownCommands = new Map<string, ScriptDiagnostic>();

  add(diagnostic: ScriptDiagnostic) {
    if (diagnostic.code === "unknown_command" && diagnostic.command) {
      const key = diagnostic.command.toLowerCase();
      const existing = this.unknownCommands.get(key);
      if (existing) {
        existing.count = (existing.count ?? 1) + 1;
        return;
      }
      const entry = { ...diagnostic, count: 1 };
      this.unknownCommands.set(key, entry);
      this.entries.push(entry);
      return;
    }
    this.entries.push(diagnostic);
  }

  values() {
    return this.entries;
  }
}

const ASSET_COMMANDS = new Set([
  "charaset",
  "charachange",
  "characrossfade",
  "imageset",
  "imagechange",
  "verticalimageset",
  "horizontalimageset",
  "equipset",
  "sceneset",
  "masterset",
  "masterimageset",
]);

const CHARACTER_COMMANDS = new Set([
  "charatalk",
  "charaface",
  "charafacefade",
  "charafilter",
  "charafadetime",
  "charaput",
  "charaputfsr",
  "charaputfsl",
  "charaputfssidel",
  "charaputfssider",
  "charascale",
  "charadepth",
  "charalayer",
  "characutin",
  "characutinpause",
  "characutout",
  "charaattack",
  "charabackeffect",
  "charabackeffectstop",
  "charabackeffectdestroy",
  "charaeffect",
  "charaeffectstop",
  "charaeffectdestroy",
  "charaeffectpause",
  "charaeffectstart",
  "charaeffectedgeblur",
  "charaeffectedgeblurdestroy",
  "charaeffectedgeblurstop",
  "charaeffectedgeblurpause",
  "charaeffectedgeblurstart",
  "charaspecialeffect",
  "charaspecialeffectstop",
  "charashadow",
  "chararoll",
  "chararollaxis",
  "chararollmove",
  "chararollmoveex",
  "characlear",
  "charahide",
  "charadelete",
  "characlearall",
  "charahideall",
  "charafadeoutall",
]);

const BACKGROUND_COMMANDS = new Set([
  "scene",
  "masterscene",
  "pictureframe",
  "pictureframetop",
  "enablefullscreen",
]);

const BGM_COMMANDS = new Set([
  "bgm",
  "bgmstop",
  "bgmstopend",
  "soundstopall",
  "soundstopallend",
  "soundstopallfade",
]);

const TRANSITION_COMMANDS = new Set([
  "fadein",
  "fadeout",
  "fademove",
  "endfade",
  "wipein",
  "wipeout",
  "wipefilter",
  "wipeoff",
  "flashin",
  "flashout",
  "flashoff",
  "maskin",
  "maskout",
  "stretchin",
  "stretchout",
]);

const EFFECT_COMMANDS = new Set([
  "effect",
  "effectstop",
  "effectdestroy",
  "effectforcestop",
  "effectstart",
  "effectpause",
  "effectmessage",
  "effectmessagestop",
  "shake",
  "shakestop",
  "messageshake",
  "messageshakestop",
  "charashake",
  "charashakestop",
  "quake",
  "vibrate",
  "distortionstart",
  "distortionstop",
  "specialeffect",
]);

const AUDIO_COMMANDS = new Set([
  "se",
  "sestop",
  "seloop",
  "sevolume",
  "secontinue",
  "secontinuestop",
  "secontinuevolume",
  "cuese",
  "cuesestop",
  "cuesevolume",
  "cuesecontinue",
  "cuesecontinuestop",
  "cuesecontinuevolume",
  "voice",
  "voicestop",
  "tvoice",
  "tvoiceuser",
  "jingle",
]);

const FLOW_COMMANDS = new Set([
  "label",
  "branch",
  "branchquestclear",
  "branchquestnotclear",
  "branchmaterial",
  "branchrouteselect",
  "branchnotrouteselect",
  "branchrouteselectcount",
  "branchsetgrandsvtcount",
  "masterbranch",
  "input",
  "skip",
  "tapskip",
  "ifclear",
  "else",
  "endif",
  "flag",
  "wait",
  "wt",
  "twt",
  "messageoff",
  "messageon",
  "selectionuse",
  "end",
  "interruption",
  "clear",
]);

const PRESENTATION_PREFIXES = [
  "camera",
  "subcamera",
  "subrender",
  "overlay",
  "backeffect",
  "fowardeffect",
  "forwardeffect",
  "blur",
  "scroll",
];

const PRESENTATION_COMMANDS = new Set([
  "autoandbacklog",
  "backcameracolor",
  "backlogstart",
  "backlogend",
  "capture",
  "capturerelease",
  "communicationchara",
  "communicationcharaclear",
  "communicationcharaface",
  "communicationcharaloop",
  "communicationcharastop",
  "crimovie",
  "enablewaitloadassetwhenresume",
  "fsmobjdestroy",
  "fsmobjlayer",
  "fsmobjsendevent",
  "fsmobjset",
  "fsmobjsetstate",
  "image",
  "insertionanimationend",
  "insertionanimationsetfssider",
  "insertionanimationstart",
  "masternamewidth",
  "messagealign",
  "messagechange",
  "messagespeedforcednormal",
  "movie",
  "substretch",
  "talknameback",
  "traidshortname",
  "turnpageoff",
  "turnpageon",
  "usesimplemeshfigure",
]);

function classifyCommand(normalizedName: string): ScriptCommandKind {
  if (ASSET_COMMANDS.has(normalizedName)) return "asset";
  if (
    CHARACTER_COMMANDS.has(normalizedName)
    || normalizedName.startsWith("charafadein")
    || normalizedName.startsWith("charafadeout")
    || normalizedName.startsWith("charamove")
    || normalizedName.startsWith("chararelativeloopmove")
  ) return "character";
  if (BACKGROUND_COMMANDS.has(normalizedName)) return "background";
  if (BGM_COMMANDS.has(normalizedName)) return "bgm";
  if (TRANSITION_COMMANDS.has(normalizedName)) return "transition";
  if (EFFECT_COMMANDS.has(normalizedName)) return "effect";
  if (AUDIO_COMMANDS.has(normalizedName)) return "audio";
  if (FLOW_COMMANDS.has(normalizedName)) return "flow";
  if (PRESENTATION_PREFIXES.some((prefix) => normalizedName.startsWith(prefix))) {
    return "presentation";
  }
  if (PRESENTATION_COMMANDS.has(normalizedName)) return "presentation";
  return "unknown";
}

function spanForText(line: number, startColumn: number, value: string): SourceSpan {
  return {
    startLine: line,
    startColumn,
    endLine: line,
    endColumn: startColumn + value.length,
  };
}

function scanSegments(
  text: string,
  line: number,
  diagnostics: DiagnosticCollector,
  baseColumn = 1,
): LineSegment[] {
  const segments: LineSegment[] = [];
  let textStart = 0;
  let cursor = 0;

  const pushText = (end: number) => {
    if (end <= textStart) return;
    const value = text.slice(textStart, end);
    segments.push({
      type: "text",
      value,
      span: spanForText(line, baseColumn + textStart, value),
    });
  };

  while (cursor < text.length) {
    if (text[cursor] !== "[") {
      cursor += 1;
      continue;
    }

    pushText(cursor);
    const start = cursor;
    let depth = 1;
    let quote: string | null = null;
    cursor += 1;

    for (; cursor < text.length && depth > 0; cursor += 1) {
      const character = text[cursor];
      if (quote) {
        if (character === "\\") cursor += 1;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
      } else if (character === "[") {
        depth += 1;
      } else if (character === "]") {
        depth -= 1;
      }
    }

    if (depth !== 0) {
      const raw = text.slice(start);
      diagnostics.add({
        severity: "error",
        code: "unclosed_bracket",
        message: "方括号命令未闭合",
        line,
        column: baseColumn + start,
      });
      segments.push({
        type: "text",
        value: raw,
        span: spanForText(line, baseColumn + start, raw),
      });
      return segments;
    }

    const raw = text.slice(start, cursor);
    segments.push({
      type: "bracket",
      raw,
      content: raw.slice(1, -1),
      span: spanForText(line, baseColumn + start, raw),
    });
    textStart = cursor;
  }

  pushText(text.length);
  return segments;
}

export function parseCommandParameters(content: string) {
  const parameters: string[] = [];
  let token = "";
  let quote: string | null = null;
  let bracketDepth = 0;

  const pushToken = () => {
    if (!token) return;
    parameters.push(token);
    token = "";
  };

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quote) {
      if (character === "\\" && index + 1 < content.length) {
        token += content[index + 1];
        index += 1;
      } else if (character === quote) {
        quote = null;
      } else {
        token += character;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "[") {
      bracketDepth += 1;
      token += character;
    } else if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      token += character;
    } else if (/\s/.test(character) && bracketDepth === 0) {
      pushToken();
    } else {
      token += character;
    }
  }
  pushToken();
  return parameters;
}

function splitColonAware(value: string): [string, string] {
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "[") depth += 1;
    else if (character === "]") depth = Math.max(0, depth - 1);
    else if ((character === ":" || character === "：") && depth === 0) {
      return [value.slice(0, index), value.slice(index + 1)];
    }
  }
  return [value, ""];
}

interface SyntaxContext {
  diagnostics: DiagnosticCollector;
  definedCharacterSlots: Set<string>;
  maxChoiceOptions: number;
  maxCharacterSlots: number;
}

function commandFromSegment(
  segment: BracketSegment,
  context: SyntaxContext,
): ScriptCommandNode | null {
  const parameters = parseCommandParameters(segment.content.trim());
  const name = parameters.shift();
  if (!name) return null;
  const normalizedName = name.toLowerCase();
  const kind = classifyCommand(normalizedName);
  const command: ScriptCommandNode = {
    type: "command",
    kind,
    name,
    normalizedName,
    args: parameters,
    raw: segment.raw,
    span: segment.span,
  };

  if ((normalizedName === "charaset" || normalizedName === "masterset") && parameters[0]) {
    context.definedCharacterSlots.add(parameters[0]);
    if (context.definedCharacterSlots.size > context.maxCharacterSlots) {
      context.diagnostics.add({
        severity: "error",
        code: "character_slot_limit",
        message: `角色槽位超过 ${context.maxCharacterSlots} 个限制`,
        line: segment.span.startLine,
        column: segment.span.startColumn,
        command: name,
      });
    }
  }

  if (kind === "unknown") {
    context.diagnostics.add({
      severity: "warning",
      code: "unknown_command",
      message: `未支持的脚本命令：${name}`,
      line: segment.span.startLine,
      column: segment.span.startColumn,
      command: name,
    });
  }
  return command;
}

interface ParsedInlineLine {
  nodes: ScriptInlineNode[];
  terminatesDialogue: boolean;
  parts: Array<{
    nodes: ScriptInlineNode[];
    terminated: boolean;
    endSpan?: SourceSpan;
  }>;
}

function parseInlineText(
  text: string,
  line: number,
  context: SyntaxContext,
  baseColumn = 1,
): ParsedInlineLine {
  const parts: ParsedInlineLine["parts"] = [{ nodes: [], terminated: false }];
  let nodes = parts[0].nodes;
  let terminatesDialogue = false;

  for (const segment of scanSegments(text, line, context.diagnostics, baseColumn)) {
    if (segment.type === "text") {
      if (segment.value) nodes.push(segment);
      continue;
    }

    const rawContent = segment.content;
    const content = rawContent.trim();
    const normalized = content.toLowerCase();
    if (!content) continue;

    if (["r", "sr", "csr"].includes(normalized)) {
      nodes.push({ type: "newline", span: segment.span });
      continue;
    }
    if (["k", "page", "q"].includes(normalized.split(/\s+/, 1)[0])) {
      terminatesDialogue = true;
      parts[parts.length - 1].terminated = true;
      parts[parts.length - 1].endSpan = segment.span;
      parts.push({ nodes: [], terminated: false });
      nodes = parts[parts.length - 1].nodes;
      continue;
    }
    if (/^%\d+$/.test(normalized)) {
      if (normalized === "%1" || normalized === "%5") {
        nodes.push({ type: "masterName", span: segment.span });
      }
      continue;
    }

    const lineMatch = content.match(/^line\s*(\d+)/i);
    if (lineMatch) {
      nodes.push({ type: "line", length: Number(lineMatch[1]), span: segment.span });
      continue;
    }

    if (content.startsWith("#")) {
      const [textPart, ruby] = splitColonAware(content.slice(1));
      nodes.push({
        type: "ruby",
        text: parseInlineText(
          textPart,
          line,
          context,
          segment.span.startColumn + 2,
        ).nodes,
        ruby,
        span: segment.span,
      });
      continue;
    }

    if (content.startsWith("&")) {
      const [male, female] = splitColonAware(content.slice(1));
      nodes.push({
        type: "gender",
        male: parseInlineText(male, line, context, segment.span.startColumn + 2).nodes,
        female: parseInlineText(female, line, context, segment.span.startColumn + 2 + male.length).nodes,
        span: segment.span,
      });
      continue;
    }

    const parameters = parseCommandParameters(content);
    const marker = parameters[0]?.toLowerCase();
    if (marker === "servantname") {
      const [, hiddenName = "", trueName = ""] = content.split(":");
      nodes.push({
        type: "servantName",
        text: hiddenName || trueName,
        span: segment.span,
      });
      continue;
    }
    if ((marker === "image" && parameters.length === 1) || marker === "i") {
      nodes.push({ type: "format", name: marker, span: segment.span });
      continue;
    }
    if (
      marker === "-"
      || marker === "f"
      || marker === "font"
      || marker === "fontsize"
      || marker === "align"
      || marker === "s"
      || marker === "speed"
      || /^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(marker ?? "")
      || /^[a-z](?:,[a-z])+$/i.test(marker ?? "")
    ) {
      nodes.push({
        type: "format",
        name: marker ?? "format",
        value: parameters[1],
        span: segment.span,
      });
      continue;
    }

    const command = commandFromSegment(segment, context);
    if (command) nodes.push(command);
  }

  if (!parts.at(-1)?.terminated && parts.at(-1)?.nodes.length === 0 && parts.length > 1) {
    parts.pop();
  }
  return {
    nodes: parts.flatMap((part) => part.nodes),
    terminatesDialogue,
    parts,
  };
}

function firstNonWhitespaceColumn(value: string) {
  return value.length - value.trimStart().length + 1;
}

function parseSpeaker(record: LineRecord, context: SyntaxContext): ScriptSpeakerNode {
  const trimmed = record.content.trimStart();
  const markerColumn = firstNonWhitespaceColumn(record.content);
  let rawName = trimmed.slice(1).trim();
  let slot: string | undefined;
  let spots: string[] | undefined;
  const colonIndex = [...rawName].findIndex((character) => character === ":" || character === "：");
  if (colonIndex >= 0) {
    const candidate = rawName.slice(0, colonIndex).trim();
    if (candidate && !/\s/.test(candidate)) {
      slot = candidate;
      rawName = rawName.slice(colonIndex + 1).trim();
    }
  }

  const spotMatch = rawName.match(/=spot(?:\[([^\]]*)\]|\(([^)]*)\))\s*$/i);
  if (spotMatch) {
    spots = (spotMatch[1] ?? spotMatch[2] ?? "")
      .split(",")
      .map((spot) => spot.trim())
      .filter(Boolean);
    rawName = rawName.slice(0, spotMatch.index).trim();
  }

  return {
    ...(slot ? { slot } : {}),
    name: parseInlineText(rawName, record.line, context, markerColumn + 1).nodes,
    rawName,
    ...(spots?.length ? { spots } : {}),
    span: spanForText(record.line, markerColumn, trimmed),
  };
}

interface ParsedChoiceHeader {
  id: number;
  labelText: string;
  routeInfo?: ScriptChoiceRouteInfo;
  column: number;
}

function parseChoiceHeader(record: LineRecord): ParsedChoiceHeader | null {
  const trimmed = record.content.trimStart();
  if (trimmed[0] !== "？" && trimmed[0] !== "?") return null;
  if (trimmed[1] === "！" || trimmed[1] === "!") return null;

  let colonIndex = -1;
  for (let index = 1; index < trimmed.length; index += 1) {
    if (trimmed[index] === ":" || trimmed[index] === "：") {
      colonIndex = index;
      break;
    }
  }
  if (colonIndex < 0) return null;

  const routeDetail = trimmed.slice(1, colonIndex).trim();
  const routeParts = routeDetail.split(",").map((part) => part.trim());
  const id = Number.parseInt(routeParts[0], 10);
  if (!Number.isInteger(id)) return null;

  let routeInfo: ScriptChoiceRouteInfo | undefined;
  if (routeParts.length > 1) {
    const route = Number.parseInt(routeParts[1], 10);
    routeInfo = {
      ...(Number.isInteger(route) ? { route } : {}),
      saveCollection: routeParts[2] === "saveCollection",
      routeType: routeParts[3] === "trueRoute"
        ? "true"
        : routeParts[3] === "badRoute"
          ? "bad"
          : "none",
    };
  }

  return {
    id,
    labelText: trimmed.slice(colonIndex + 1),
    ...(routeInfo ? { routeInfo } : {}),
    column: firstNonWhitespaceColumn(record.content),
  };
}

function isChoiceEnd(record: LineRecord) {
  return /^[？?][！!]/.test(record.content.trimStart());
}

function parseSequence(records: LineRecord[], context: SyntaxContext): ScriptNode[] {
  const nodes: ScriptNode[] = [];
  let index = 0;

  while (index < records.length) {
    const record = records[index];
    const trimmed = record.content.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("＄")) {
      index += 1;
      continue;
    }

    const choiceHeader = parseChoiceHeader(record);
    if (choiceHeader) {
      const options: ScriptChoiceOptionNode[] = [];
      const choiceStart = record;
      let cursor = index;
      let ended = false;
      let endRecord = record;

      while (cursor < records.length) {
        const headerRecord = records[cursor];
        const header = parseChoiceHeader(headerRecord);
        if (!header) break;

        const bodyStart = cursor + 1;
        let bodyEnd = bodyStart;
        while (bodyEnd < records.length) {
          if (parseChoiceHeader(records[bodyEnd]) || isChoiceEnd(records[bodyEnd])) break;
          bodyEnd += 1;
        }
        const bodyRecords = records.slice(bodyStart, bodyEnd);
        const nextHeader = bodyEnd < records.length
          ? parseChoiceHeader(records[bodyEnd])
          : null;
        if (nextHeader && nextHeader.id <= header.id) {
          context.diagnostics.add({
            severity: "error",
            code: "nested_choice",
            message: "不支持嵌套选项；请先结束当前选项组",
            line: records[bodyEnd].line,
            column: nextHeader.column,
          });
        }
        if (!header.labelText.trim()) {
          context.diagnostics.add({
            severity: "error",
            code: "empty_choice_label",
            message: "选项文字不能为空",
            line: headerRecord.line,
            column: header.column,
          });
        }
        const optionEnd = bodyRecords.at(-1) ?? headerRecord;
        options.push({
          id: header.id,
          label: parseInlineText(
            header.labelText,
            headerRecord.line,
            context,
            header.column + headerRecord.content.trimStart().indexOf(header.labelText),
          ).nodes,
          body: parseSequence(bodyRecords, context),
          ...(header.routeInfo ? { routeInfo: header.routeInfo } : {}),
          span: {
            startLine: headerRecord.line,
            startColumn: header.column,
            endLine: optionEnd.line,
            endColumn: optionEnd.content.length + 1,
          },
        });

        cursor = bodyEnd;
        if (cursor < records.length && isChoiceEnd(records[cursor])) {
          ended = true;
          endRecord = records[cursor];
          cursor += 1;
          break;
        }
      }

      if (options.length > context.maxChoiceOptions) {
        context.diagnostics.add({
          severity: "error",
          code: "choice_option_limit",
          message: `一组选项超过 ${context.maxChoiceOptions} 个限制`,
          line: choiceStart.line,
          column: choiceHeader.column,
        });
      }
      if (!ended) {
        context.diagnostics.add({
          severity: "error",
          code: "unclosed_choice",
          message: "选项组缺少结束标记？！",
          line: choiceStart.line,
          column: choiceHeader.column,
        });
        endRecord = records[Math.max(index, cursor - 1)] ?? choiceStart;
      }

      nodes.push({
        type: "choice",
        options,
        span: {
          startLine: choiceStart.line,
          startColumn: choiceHeader.column,
          endLine: endRecord.line,
          endColumn: endRecord.content.length + 1,
        },
      });
      index = Math.max(cursor, index + 1);
      continue;
    }

    if (isChoiceEnd(record)) {
      context.diagnostics.add({
        severity: "warning",
        code: "unexpected_choice_end",
        message: "忽略了没有对应选项组的结束标记",
        line: record.line,
        column: firstNonWhitespaceColumn(record.content),
      });
      index += 1;
      continue;
    }

    const leftTrimmed = record.content.trimStart();
    if (leftTrimmed.startsWith("＠") || leftTrimmed.startsWith("@")) {
      const speaker = parseSpeaker(record, context);
      let body: ScriptInlineNode[] = [];
      let cursor = index + 1;
      let emittedDialogue = false;
      let bodyStart = record;
      let endRecord = record;

      while (cursor < records.length) {
        const bodyRecord = records[cursor];
        const bodyTrimmed = bodyRecord.content.trimStart();
        if (
          bodyTrimmed.startsWith("＠")
          || bodyTrimmed.startsWith("@")
          || parseChoiceHeader(bodyRecord)
          || isChoiceEnd(bodyRecord)
        ) break;

        if (!bodyRecord.content.trim()) {
          if (body.length) {
            body.push({
              type: "newline",
              span: spanForText(bodyRecord.line, 1, ""),
            });
          }
          cursor += 1;
          continue;
        }

        const parsedLine = parseInlineText(bodyRecord.content, bodyRecord.line, context);
        const onlyStandaloneCommands = !parsedLine.terminatesDialogue
          && parsedLine.nodes.some((node) => node.type === "command")
          && parsedLine.nodes.every(
            (node) => node.type === "command"
              || (node.type === "text" && !node.value.trim()),
          );
        if (onlyStandaloneCommands && body.length === 0) {
          nodes.push(
            ...parsedLine.nodes.filter(
              (node): node is ScriptCommandNode => node.type === "command",
            ),
          );
          endRecord = bodyRecord;
          cursor += 1;
          continue;
        }

        for (const part of parsedLine.parts) {
          if (!body.length && part.nodes.length) {
            bodyStart = emittedDialogue ? bodyRecord : record;
          }
          body.push(...part.nodes);
          if (!part.terminated) continue;

          const partEnd = part.endSpan ?? spanForText(
            bodyRecord.line,
            bodyRecord.content.length + 1,
            "",
          );
          nodes.push({
            type: "dialogue",
            speaker,
            body,
            span: {
              startLine: bodyStart.line,
              startColumn: emittedDialogue
                ? firstNonWhitespaceColumn(bodyStart.content)
                : firstNonWhitespaceColumn(record.content),
              endLine: partEnd.endLine,
              endColumn: partEnd.endColumn,
            },
          });
          body = [];
          emittedDialogue = true;
          bodyStart = bodyRecord;
        }

        endRecord = bodyRecord;
        cursor += 1;
        if (body.length) {
          body.push({
            type: "newline",
            span: spanForText(bodyRecord.line, bodyRecord.content.length + 1, ""),
          });
        }
      }

      if (body.length || !emittedDialogue) {
        context.diagnostics.add({
          severity: "warning",
          code: "unclosed_dialogue",
          message: "对话缺少 [k]、[page] 或 [q]，已在下一结构处自动结束",
          line: record.line,
          column: firstNonWhitespaceColumn(record.content),
        });
        nodes.push({
          type: "dialogue",
          speaker,
          body,
          span: {
            startLine: bodyStart.line,
            startColumn: emittedDialogue
              ? firstNonWhitespaceColumn(bodyStart.content)
              : firstNonWhitespaceColumn(record.content),
            endLine: endRecord.line,
            endColumn: endRecord.content.length + 1,
          },
        });
      }
      index = Math.max(cursor, index + 1);
      continue;
    }

    const parsed = parseInlineText(record.content, record.line, context);
    const commands = parsed.nodes.filter((node): node is ScriptCommandNode => node.type === "command");
    nodes.push(...commands);
    const orphanText = parsed.nodes.some(
      (node) => node.type === "text" && node.value.trim().length > 0,
    );
    if (orphanText) {
      context.diagnostics.add({
        severity: "warning",
        code: "orphan_text",
        message: "忽略了说话人标记之外的文本",
        line: record.line,
        column: firstNonWhitespaceColumn(record.content),
      });
    }
    index += 1;
  }

  return nodes;
}

export function parseScriptDocument(
  source: string,
  options: ParseScriptDocumentOptions = {},
): ScriptDocument {
  const diagnostics = new DiagnosticCollector();
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const records = normalized.split("\n").map((content, index) => ({
    content,
    line: index + 1,
  }));
  const context: SyntaxContext = {
    diagnostics,
    definedCharacterSlots: new Set(),
    maxChoiceOptions: options.maxChoiceOptions ?? 9,
    maxCharacterSlots: options.maxCharacterSlots ?? 64,
  };

  return {
    nodes: parseSequence(records, context),
    diagnostics: diagnostics.values(),
    characterSlotCount: context.definedCharacterSlots.size,
  };
}

export function parseInlineScriptText(value: string) {
  const diagnostics = new DiagnosticCollector();
  const context: SyntaxContext = {
    diagnostics,
    definedCharacterSlots: new Set(),
    maxChoiceOptions: Number.MAX_SAFE_INTEGER,
    maxCharacterSlots: Number.MAX_SAFE_INTEGER,
  };
  return {
    nodes: parseInlineText(value.replace(/\r\n?/g, "\n"), 1, context).nodes,
    diagnostics: diagnostics.values(),
  };
}

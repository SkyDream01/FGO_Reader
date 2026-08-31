import type { ScriptDiagnostic } from "../types";
import type {
  ChoiceOptionIns,
  ChoiceRecord,
  CompileOptions,
  Instruction,
  MessageRecord,
  MessageToken,
  ScriptProgram,
  SpeakerInfo,
} from "./instruction";
import { SCRIPT_PARSER_VERSION } from "../lib/scriptParserVersion";
import type {
  ScriptChoiceNode,
  ScriptCommandNode,
  ScriptDocument,
  ScriptInlineNode,
  ScriptNode,
  ScriptSpeakerNode,
  SourceSpan,
} from "../lib/scriptSyntax";

/**
 * ② Compiler (docs/FGO_Story_Reader_Standard.md §1.1 / S-P6).
 *
 * Lowers the syntax AST into a flat instruction array with control-flow
 * indexes. The executor consumes the array with a cursor; jump and branch
 * instructions rewrite the cursor at runtime. Labels are resolved at compile
 * time; unresolved targets degrade to linear playback (S-P7).
 */

const NARRATOR_NAME = "旁白";
const MAX_INSTRUCTIONS = 100_000;

const HEX_COLOR = /^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

interface PendingJump {
  index: number;
  label: string;
}

interface IfFrame {
  /** The conditional branch instruction that needs an else/endif target. */
  branchIndex: number;
  /** A pending else-jump that resolves at endif. */
  elseJumpIndex: number | null;
}

interface CompileContext {
  options: CompileOptions;
  diagnostics: ScriptDiagnostic[];
  instructions: Instruction[];
  labels: Map<string, number>;
  pendingJumps: PendingJump[];
  ifStack: IfFrame[];
  idOrdinals: Map<string, number>;
  messages: MessageRecord[];
  choices: ChoiceRecord[];
  characterIds: Set<string>;
  sceneIds: Set<string>;
  bgmNames: Set<string>;
  stopped: boolean;
}

function spanOf(line: number, column: number): SourceSpan {
  return { startLine: line, startColumn: column, endLine: line, endColumn: column };
}

function addDiagnostic(
  context: CompileContext,
  span: SourceSpan,
  code: string,
  message: string,
  severity: "warning" | "error" = "warning",
  command?: string,
) {
  context.diagnostics.push({
    severity,
    code,
    message,
    line: span.startLine,
    column: span.startColumn,
    ...(command ? { command } : {}),
  });
}

function normalizeRenderedText(value: string) {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pushTextToken(tokens: MessageToken[], value: string) {
  if (!value) return;
  const previous = tokens.at(-1);
  if (previous?.type === "text") previous.value += value;
  else tokens.push({ type: "text", value });
}

/**
 * Lowers inline AST nodes into the message token stream. Master-dependent
 * nodes ({0}, gender branches) resolve here so the runtime never needs
 * session options (S-P8 implementation hint: keep text/markup pairing).
 */
export function compileInlineNodes(
  nodes: ScriptInlineNode[],
  options: CompileOptions,
): { tokens: MessageToken[]; hoisted: ScriptCommandNode[] } {
  const tokens: MessageToken[] = [];
  const hoisted: ScriptCommandNode[] = [];

  const walk = (node: ScriptInlineNode) => {
    switch (node.type) {
      case "text":
        pushTextToken(tokens, node.value.replace(/\{0\}/g, options.masterName));
        return;
      case "masterName":
        pushTextToken(tokens, options.masterName);
        return;
      case "newline":
        tokens.push({ type: "newline" });
        return;
      case "line":
        tokens.push({ type: "line", length: Math.max(1, node.length) });
        return;
      case "ruby":
        tokens.push({
          type: "ruby",
          base: renderInlinePlain(node.text, options),
          ruby: node.ruby,
        });
        return;
      case "gender":
        for (const inner of (options.masterGender === "female" ? node.female : node.male)) {
          walk(inner);
        }
        return;
      case "servantName":
        pushTextToken(tokens, node.text);
        return;
      case "command":
        hoisted.push(node);
        return;
      case "format":
        compileFormatNode(node.name, node.value, tokens);
        return;
    }
  };

  for (const node of nodes) walk(node);
  return { tokens: normalizeMessageTokens(tokens), hoisted };
}

function compileFormatNode(
  name: string,
  value: string | undefined,
  tokens: MessageToken[],
) {
  if (name === "-") {
    tokens.push({ type: "color", color: null });
    return;
  }
  if (HEX_COLOR.test(name)) {
    tokens.push({ type: "color", color: `#${name}` });
    return;
  }
  if (name === "align") {
    const align = value?.toLowerCase();
    tokens.push({
      type: "align",
      align: align === "center" || align === "right" ? align : "left",
    });
    return;
  }
  if (name === "s" || name === "speed") {
    const speed = Number(value);
    if (Number.isFinite(speed) && speed > 0) {
      tokens.push({ type: "speed", charsPerSecond: speed });
    }
    return;
  }
  // `f`/`font`/`fontsize` and glyph-group markers only restyle engine glyphs;
  // the reader keeps its own typography.
}

function renderInlinePlain(
  nodes: ScriptInlineNode[],
  options: CompileOptions,
): string {
  let output = "";
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        output += node.value.replace(/\{0\}/g, options.masterName);
        break;
      case "masterName":
        output += options.masterName;
        break;
      case "newline":
        output += "\n";
        break;
      case "line":
        output += "—".repeat(Math.max(1, node.length));
        break;
      case "ruby":
        output += renderInlinePlain(node.text, options);
        break;
      case "gender":
        output += renderInlinePlain(node.male, options);
        break;
      case "servantName":
        output += node.text;
        break;
      case "command":
      case "format":
        break;
    }
  }
  return output;
}

export function renderTokensPlain(tokens: MessageToken[]): string {
  let output = "";
  for (const token of tokens) {
    switch (token.type) {
      case "text":
        output += token.value;
        break;
      case "newline":
        output += "\n";
        break;
      case "ruby":
        output += token.base;
        break;
      case "line":
        output += "—".repeat(token.length);
        break;
      case "color":
      case "align":
      case "speed":
        break;
    }
  }
  return normalizeRenderedText(output);
}

/**
 * Reproduces the old renderer's text normalization at compile time: merge
 * adjacent text, split runs on newlines, drop spaces before newlines, and
 * collapse 3+ blank lines so display output stays identical.
 */
function normalizeMessageTokens(tokens: MessageToken[]): MessageToken[] {
  const merged: MessageToken[] = [];
  for (const token of tokens) {
    if (token.type === "text") {
      pushTextToken(merged, token.value);
      continue;
    }
    merged.push(token);
  }

  const split: MessageToken[] = [];
  for (const token of merged) {
    if (token.type !== "text") {
      split.push(token);
      continue;
    }
    const pieces = token.value.split("\n");
    pieces.forEach((piece, index) => {
      if (index > 0) split.push({ type: "newline" });
      const cleaned = piece.replace(/[ \t]+$/g, "");
      if (cleaned) pushTextToken(split, cleaned);
    });
  }

  const collapsed: MessageToken[] = [];
  let newlineRun = 0;
  for (const token of split) {
    if (token.type === "newline") {
      newlineRun += 1;
      if (newlineRun > 2) continue;
    } else {
      newlineRun = 0;
    }
    collapsed.push(token);
  }

  while (collapsed.length && collapsed[0].type === "newline") collapsed.shift();
  while (collapsed.length && collapsed.at(-1)!.type === "newline") collapsed.pop();
  if (collapsed[0]?.type === "text") {
    collapsed[0] = { type: "text", value: collapsed[0].value.replace(/^[ \t]+/, "") };
  }
  const last = collapsed.at(-1);
  if (last?.type === "text") {
    collapsed[collapsed.length - 1] = { type: "text", value: last.value.replace(/[ \t]+$/, "") };
  }
  return collapsed;
}

function makeStableKey(
  context: CompileContext,
  kind: "m" | "c",
  span: SourceSpan,
) {
  const key = `${kind}:${span.startLine}:${span.startColumn}`;
  const ordinal = context.idOrdinals.get(key) ?? 0;
  context.idOrdinals.set(key, ordinal + 1);
  return `${context.options.scriptId}@v${SCRIPT_PARSER_VERSION}:${kind}:${span.startLine}:${span.startColumn}:${ordinal}`;
}

function compileSpeaker(
  speaker: ScriptSpeakerNode,
  context: CompileContext,
): SpeakerInfo {
  const name = renderInlinePlain(speaker.name, context.options).trim();
  return {
    name: name || NARRATOR_NAME,
    ...(speaker.slot ? { slot: speaker.slot } : {}),
    ...(speaker.spots?.length ? { spots: speaker.spots } : {}),
  };
}

function truthyParam(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
}

function resolveLabelTarget(
  context: CompileContext,
  label: string,
): number {
  const known = context.labels.get(label);
  if (known !== undefined) return known;
  // Unresolved now; the label may be defined later in the script.
  context.pendingJumps.push({ index: context.instructions.length, label });
  return -1;
}

function resolvePendingJumps(context: CompileContext, label: string) {
  context.pendingJumps = context.pendingJumps.filter((pending) => {
    if (pending.label !== label) return true;
    const instruction = context.instructions[pending.index];
    if (instruction) instruction.targetIndex = context.labels.get(label) ?? -1;
    return false;
  });
}

/** S-P7: a branch without a target label degrades to linear playback. */
function degradeUnresolvedJump(context: CompileContext, pending: PendingJump) {
  const instruction = context.instructions[pending.index];
  if (instruction) instruction.targetIndex = pending.index + 1;
}

/** Command tags whose second/third argument selects the master-gender asset. */
function masterDependentId(
  args: readonly string[],
  context: CompileContext,
): string | null {
  const index = context.options.masterGender === "female" ? 2 : 1;
  return args[index] ?? null;
}

function collectCommandResources(
  command: ScriptCommandNode,
  context: CompileContext,
) {
  const name = command.normalizedName;
  const args = command.args;
  const stripBack = (value: string | null | undefined) =>
    value ? value.replace(/^back/i, "") : null;

  switch (name) {
    case "charaset":
      if (args[1]) context.characterIds.add(args[1]);
      break;
    case "masterset":
      if (masterDependentId(args, context)) context.characterIds.add(masterDependentId(args, context)!);
      break;
    case "charachange":
    case "equipset":
      if (args[1]) context.characterIds.add(args[1]);
      break;
    case "scene":
      if (args[0]) context.sceneIds.add(args[0]);
      break;
    case "masterscene":
      if (masterDependentId(args, context)) context.sceneIds.add(masterDependentId(args, context)!);
      break;
    case "sceneset":
    case "imageset":
    case "verticalimageset":
    case "horizontalimageset":
    case "imagechange":
    case "masterimageset":
    case "image": {
      const raw = name === "image" ? args[0] : name === "masterimageset" ? masterDependentId(args, context) : args[1];
      const id = stripBack(raw);
      if (id) context.sceneIds.add(id);
      break;
    }
    case "bgm":
      if (args[0]) context.bgmNames.add(args[0]);
      break;
    default:
      break;
  }
}

function emitInstruction(
  context: CompileContext,
  instruction: Instruction,
): boolean {
  if (context.stopped) return false;
  if (context.instructions.length >= MAX_INSTRUCTIONS) {
    context.stopped = true;
    addDiagnostic(
      context,
      spanOf(instruction.line, instruction.column),
      "instruction_limit",
      `编译后的指令超过 ${MAX_INSTRUCTIONS} 条限制`,
      "error",
    );
    return false;
  }
  context.instructions.push(instruction);
  return true;
}

function commandInstruction(command: ScriptCommandNode, tag = command.normalizedName): Instruction {
  return {
    tag,
    params: command.args,
    line: command.span.startLine,
    column: command.span.startColumn,
    raw: command.raw,
    isMessage: false,
  };
}

function emitCommandNode(
  command: ScriptCommandNode,
  context: CompileContext,
): void {
  const name = command.normalizedName;
  const args = command.args;
  const span = command.span;
  collectCommandResources(command, context);

  switch (name) {
    case "label": {
      const label = args[0];
      if (!label) {
        addDiagnostic(context, span, "invalid_command_arguments", "命令 label 缺少标签名", "warning", name);
        return;
      }
      context.labels.set(label, context.instructions.length);
      resolvePendingJumps(context, label);
      emitInstruction(context, commandInstruction(command));
      return;
    }

    case "jump": {
      const label = args[0];
      if (!label) {
        addDiagnostic(context, span, "invalid_command_arguments", "命令 jump 缺少标签名", "warning", name);
        return;
      }
      const instruction = commandInstruction(command);
      instruction.targetIndex = resolveLabelTarget(context, label);
      emitInstruction(context, instruction);
      return;
    }

    case "branch": {
      const label = args[0];
      if (!label) return;
      const instruction = commandInstruction(command);
      instruction.targetIndex = resolveLabelTarget(context, label);
      instruction.branch = args.length >= 3
        ? { kind: "flag", name: args[1], value: truthyParam(args[2]) }
        : { kind: "always" };
      emitInstruction(context, instruction);
      return;
    }

    case "branchquestclear":
    case "branchquestnotclear": {
      const label = args[0];
      const questId = args[1];
      if (!label || !questId) {
        addDiagnostic(context, span, "invalid_command_arguments", `命令 ${name} 缺少参数`, "warning", name);
        return;
      }
      const instruction = commandInstruction(command);
      instruction.targetIndex = resolveLabelTarget(context, label);
      instruction.branch = {
        kind: name === "branchquestclear" ? "questClear" : "questNotClear",
        questId,
      };
      emitInstruction(context, instruction);
      return;
    }

    case "branchrouteselect":
    case "branchnotrouteselect": {
      const label = args[0];
      if (!label) return;
      const instruction = commandInstruction(command);
      instruction.targetIndex = resolveLabelTarget(context, label);
      instruction.branch = {
        kind: "routeSelect",
        questId: args[1] ?? "",
        param: args[2] ?? "",
        inverted: name === "branchnotrouteselect",
      };
      emitInstruction(context, instruction);
      return;
    }

    // Material and count based conditions depend on player collection state
    // the reader cannot know; degrade to linear playback (S-P7).
    case "branchmaterial":
    case "branchrouteselectcount":
    case "branchsetgrandsvtcount":
      emitInstruction(context, commandInstruction(command));
      return;

    case "ifclear": {
      const questId = args[0];
      if (!questId) {
        addDiagnostic(context, span, "invalid_command_arguments", "命令 ifClear 缺少任务ID", "warning", name);
        return;
      }
      const instruction = commandInstruction(command, "branch");
      instruction.targetIndex = -1;
      instruction.branch = { kind: "questNotClear", questId };
      emitInstruction(context, instruction);
      context.ifStack.push({ branchIndex: context.instructions.length - 1, elseJumpIndex: null });
      return;
    }

    case "else": {
      const frame = context.ifStack.at(-1);
      if (!frame) {
        addDiagnostic(context, span, "unexpected_else", "忽略了没有对应条件块的 else", "warning", name);
        return;
      }
      // Condition failed → land on the first instruction after [else].
      context.instructions[frame.branchIndex].targetIndex = context.instructions.length + 1;
      const jump = commandInstruction(command, "jump");
      jump.targetIndex = -1;
      emitInstruction(context, jump);
      frame.elseJumpIndex = context.instructions.length - 1;
      return;
    }

    case "endif": {
      const frame = context.ifStack.pop();
      if (!frame) {
        addDiagnostic(context, span, "unexpected_endif", "忽略了没有对应条件块的 endIf", "warning", name);
        return;
      }
      const end = context.instructions.length + 1;
      if (frame.elseJumpIndex !== null) {
        context.instructions[frame.elseJumpIndex].targetIndex = end;
      } else {
        // No else branch: the conditional target lands right after endIf.
        context.instructions[frame.branchIndex].targetIndex = end;
      }
      return;
    }

    case "flag": {
      const instruction = commandInstruction(command);
      if (args[0]) {
        instruction.params = [args[0], truthyParam(args[1]) ? "true" : "false"];
      }
      emitInstruction(context, instruction);
      return;
    }

    default:
      emitInstruction(context, commandInstruction(command));
      return;
  }
}

function emitDialogueNode(
  node: Extract<ScriptNode, { type: "dialogue" }>,
  context: CompileContext,
): void {
  const speaker = compileSpeaker(node.speaker, context);
  const { tokens, hoisted } = compileInlineNodes(node.body, context.options);
  for (const command of hoisted) emitCommandNode(command, context);

  const key = makeStableKey(context, "m", node.span);
  const messageIndex = context.instructions.length;
  if (!emitInstruction(context, {
    tag: "talkname",
    params: [],
    line: node.span.startLine,
    column: node.span.startColumn,
    raw: node.speaker.rawName,
    isMessage: true,
    speaker,
    messageKey: key,
  })) return;
  if (!emitInstruction(context, {
    tag: "message",
    params: [],
    line: node.span.startLine,
    column: node.span.startColumn,
    raw: "",
    isMessage: true,
    tokens,
    messageKey: key,
  })) return;

  context.messages.push({
    key,
    speaker: speaker.name || NARRATOR_NAME,
    text: renderTokensPlain(tokens),
    instructionIndex: messageIndex,
  });
}

function emitChoiceNode(
  node: ScriptChoiceNode,
  context: CompileContext,
): void {
  const key = makeStableKey(context, "c", node.span);
  const choiceIndex = context.instructions.length;
  // Placeholder first: the choice instruction must precede its bodies so the
  // executor reaches it before any body code. Body indexes are patched below.
  emitInstruction(context, {
    tag: "choice",
    params: [],
    line: node.span.startLine,
    column: node.span.startColumn,
    raw: "",
    isMessage: false,
    options: [],
    choiceKey: key,
  });

  const exitPatchIndexes: number[] = [];
  const options: ChoiceOptionIns[] = [];

  for (const option of node.options) {
    const bodyIndex = context.instructions.length;
    // Lower the option body inline; it ends with a jump to the shared exit.
    compileNodes(option.body, context);
    const exitJump: Instruction = {
      tag: "jump",
      params: [],
      line: option.span.startLine,
      column: option.span.startColumn,
      raw: "",
      isMessage: false,
      targetIndex: -1,
    };
    emitInstruction(context, exitJump);
    exitPatchIndexes.push(context.instructions.length - 1);
    options.push({
      id: option.id,
      label: renderInlinePlain(option.label, context.options).trim(),
      labelTokens: compileInlineNodes(option.label, context.options).tokens,
      ...(option.routeInfo ? { routeInfo: option.routeInfo } : {}),
      bodyIndex,
    });
  }

  const exitIndex = context.instructions.length;
  for (const index of exitPatchIndexes) {
    context.instructions[index].targetIndex = exitIndex;
  }
  context.instructions[choiceIndex].options = options;

  context.choices.push({
    key,
    options: options.map((option) => ({ label: option.label })),
    instructionIndex: choiceIndex,
  });
}

function compileNodes(nodes: ScriptNode[], context: CompileContext): void {
  for (const node of nodes) {
    if (context.stopped) return;
    switch (node.type) {
      case "command":
        emitCommandNode(node, context);
        break;
      case "dialogue":
        emitDialogueNode(node, context);
        break;
      case "choice":
        emitChoiceNode(node, context);
        break;
    }
  }
}

export function compileScriptDocument(
  document: ScriptDocument,
  options: CompileOptions,
): ScriptProgram {
  const context: CompileContext = {
    options,
    diagnostics: [],
    instructions: [],
    labels: new Map(),
    pendingJumps: [],
    ifStack: [],
    idOrdinals: new Map(),
    messages: [],
    choices: [],
    characterIds: new Set(),
    sceneIds: new Set(),
    bgmNames: new Set(),
    stopped: false,
  };

  compileNodes(document.nodes, context);

  // Close dangling if-blocks and resolve whatever labels never appeared.
  while (context.ifStack.length) {
    const frame = context.ifStack.pop()!;
    const end = context.instructions.length + 1;
    if (frame.elseJumpIndex !== null) {
      context.instructions[frame.elseJumpIndex].targetIndex = end;
    } else {
      context.instructions[frame.branchIndex].targetIndex = end;
    }
    addDiagnostic(
      context,
      spanOf(1, 1),
      "unclosed_condition_block",
      "条件块缺少 endIf，已自动闭合",
    );
  }
  for (const pending of context.pendingJumps) {
    degradeUnresolvedJump(context, pending);
    addDiagnostic(
      context,
      spanOf(context.instructions[pending.index]?.line ?? 1, 1),
      "unresolved_label",
      `标签 ${pending.label} 不存在；分支已退化为顺序播放`,
    );
  }

  return {
    scriptId: options.scriptId,
    header: null,
    instructions: context.instructions,
    labels: context.labels,
    messageCatalog: context.messages,
    choiceCatalog: context.choices,
    characterIds: [...context.characterIds],
    sceneIds: [...context.sceneIds],
    bgmNames: [...context.bgmNames],
    diagnostics: context.diagnostics,
  };
}

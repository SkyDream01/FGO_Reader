import type { ScriptDiagnostic } from "../types";
import { SCRIPT_PARSER_VERSION } from "../lib/scriptParserVersion";
import type { CompileOptions, Instruction, MessageRecord, MessageToken, ScriptAsset, ScriptProgram } from "./instruction";
import { parseMarkup, parseSpeaker, renderTokensPlain } from "./markup";
import { commandAssets, resourcePath } from "./resources";
import type { ScriptDocument, ScriptNode } from "./syntax";
import { unquote } from "./motion";

export { renderTokensPlain } from "./markup";

/** Compile native flat records; branch bodies are never relocated or hoisted. */
export function compileScriptDocument(document: ScriptDocument, options: CompileOptions): ScriptProgram {
  const instructions: Instruction[] = [], labels = new Map<string, number>();
  const messageCatalog: MessageRecord[] = [], assets = new Map<string, ScriptAsset>();
  const diagnostics: ScriptDiagnostic[] = [...document.diagnostics];
  const program: ScriptProgram = { scriptId: options.scriptId, header: document.header, instructions, labels, messageCatalog, choiceCatalog: [], characterIds: [], sceneIds: [], bgmNames: [], assets: [], diagnostics };
  let speaker = "旁白", speakerLine = 0, message: MessageRecord | null = null;
  const currentMessage = (): MessageRecord | null => message;
  let choice: { index: number; exits: number[] } | null = null;
  const conditions: Array<{ ifIndex: number; elseIndex?: number }> = [];
  const key = (kind: string, line: number) => `${options.scriptId}@v${SCRIPT_PARSER_VERSION}:${kind}:${line}`;
  const diagnostic = (node: ScriptNode, code: string, text: string) => diagnostics.push({ severity: "warning", code, message: text, line: node.span.startLine, column: node.span.startColumn });
  const addAssets = (tag: string, params: readonly string[]) => {
    for (const asset of commandAssets(tag, params, options.masterGender)) assets.set(asset.path, asset);
  };
  const emit = (node: ScriptNode, tag: string, fields: Partial<Instruction> = {}) => {
    const instruction: Instruction = { tag, params: node.args, pd: node.pd, raw: node.raw, line: node.span.startLine, column: node.span.startColumn, isMessage: false, ...fields };
    instructions.push(instruction);
    return instruction;
  };
  const emitMessage = (node: ScriptNode, tokens: MessageToken[]) => {
    if (!tokens.length) return;
    if (!message) {
      message = { key: key("m", speakerLine || node.span.startLine), speaker, text: "", instructionIndex: instructions.length };
      // Multiple messages with the same speaker get distinct source positions.
      if (messageCatalog.some((entry) => entry.key === message!.key)) message.key = key("m", node.span.startLine) + `:${instructions.length}`;
      messageCatalog.push(message);
    } else if (message.text) {
      tokens = [{ type: "newline" }, ...tokens];
    }
    for (const token of tokens) {
      if (token.type === "command") addAssets(token.tag, token.params);
      if (token.type === "image") {
        const asset: ScriptAsset = { kind: "image", name: token.name, path: resourcePath("image", token.name) };
        assets.set(asset.path, asset);
      }
    }
    message.text += renderTokensPlain(tokens);
    emit(node, "$message", { tokens, messageKey: message.key, isMessage: true });
  };

  for (const node of document.nodes) {
    if (node.type === "speaker") {
      message = null;
      const info = parseSpeaker(node.text, options);
      speaker = info.name || "旁白";
      speakerLine = node.span.startLine;
      emit(node, "$speaker", { speaker: { ...info, name: speaker } });
    } else if (node.type === "text") {
      const parts = parseMarkup(node.text, options);
      let tokens: MessageToken[] = [];
      for (const token of parts) {
        if (token.type === "input") {
          emitMessage(node, tokens);
          emit(node, "k", { params: [], pd: [], messageKey: currentMessage()?.key });
          tokens = []; message = null; speakerLine = 0;
        } else tokens.push(token);
      }
      emitMessage(node, tokens);
    } else if (node.type === "choice") {
      message = null;
      const split = node.text.indexOf(document.markers.choiceSplit);
      const rawId = node.text.slice(0, split).split(",");
      let label = node.text.slice(split + document.markers.choiceSplit.length);
      const hidden = label.indexOf(document.markers.hidden);
      const hiddenFlag = hidden >= 0 ? label.slice(hidden + document.markers.hidden.length).trim() : undefined;
      if (hidden >= 0) label = label.slice(0, hidden);
      if (!choice) {
        choice = { index: instructions.length, exits: [] };
        emit(node, "$choice", { options: [], choiceKey: key("c", node.span.startLine) });
      } else {
        choice.exits.push(instructions.length);
        emit(node, "$choiceExit");
      }
      const labelTokens = parseMarkup(label.trim(), options);
      if (instructions[choice.index].options!.some((option) => option.id === Number(rawId[0]))) diagnostics.push({ severity: "error", code: "duplicate_choice", message: "选项序号重复或存在嵌套选项", line: node.span.startLine, column: node.span.startColumn });
      instructions[choice.index].options!.push({ id: Number(rawId[0]) || 1, label: renderTokensPlain(labelTokens), labelTokens, bodyIndex: instructions.length, hiddenFlag,
        routeInfo: { route: rawId[1] ? Number(rawId[1]) : undefined, saveMaterial: rawId.includes("saveMaterial"), routeType: "none" } });
    } else if (node.type === "choiceEnd") {
      message = null;
      if (choice) {
        instructions[choice.index].endIndex = instructions.length;
        for (const exit of choice.exits) instructions[exit].targetIndex = instructions.length;
        choice = null;
      }
      emit(node, "$choiceEnd");
    } else {
      let tag = node.name;
      if (tag === "wt" || tag === "twt") {
        emit(node, "wait", { params: [tag === "twt" ? "rtime" : "time", node.pd[0] ?? "0"], pd: [tag === "twt" ? "rtime" : "time", " ", node.pd[0] ?? "0"] });
        continue;
      }
      if (tag === "k" || tag === "q" || tag === "page" || tag === "clear") {
        if (node.args.length) diagnostic(node, "unexpected_parameters", `${tag} 命令必须不带参数`);
        emit(node, tag, { messageKey: currentMessage()?.key });
        message = null; speakerLine = 0;
        continue;
      }
      if (tag === "menu") {
        message = null; speakerLine = 0;
        const pairs: Array<{ label: string; text: string }> = [];
        for (let i = 0; i < node.pd.length; i++) {
          if (node.pd[i + 1] !== "=" || node.pd[i + 2] === undefined) continue;
          pairs.push({ label: unquote(node.pd[i]), text: unquote(node.pd[i + 2]) }); i += 2;
        }
        if (!pairs.length) diagnostic(node, "invalid_menu", "menu 需要 label=text 形式的选项");
        emit(node, "$choice", { choiceKey: key("c", node.span.startLine), choiceMode: "menu", options: pairs.map((pair, i) => ({ id: i + 1, label: renderTokensPlain(parseMarkup(pair.text, options)), labelTokens: parseMarkup(pair.text, options), targetLabel: pair.label, bodyIndex: -1 })) });
        continue;
      }
      addAssets(tag, node.args);
      const index = instructions.length;
      if (tag === "label") {
        const name = unquote(node.args[0] ?? "");
        if (labels.has(name)) diagnostic(node, "duplicate_label", `跳转标签重复：${name}`);
        labels.set(name, index);
      }
      emit(node, tag);
      if (tag === "ifClear") conditions.push({ ifIndex: index });
      if (tag === "else") {
        const frame = conditions.at(-1);
        if (frame) { instructions[frame.ifIndex].targetIndex = index + 1; frame.elseIndex = index; }
        else diagnostic(node, "unmatched_else", "else 缺少 ifClear");
      }
      if (tag === "endIf") {
        const frame = conditions.pop();
        if (frame) instructions[frame.elseIndex ?? frame.ifIndex].targetIndex = index + 1;
        else diagnostic(node, "unmatched_end_if", "endIf 缺少 ifClear");
      }
    }
  }
  if (currentMessage() && document.nodes.length) emit(document.nodes.at(-1)!, "k", { params: [], pd: [], messageKey: currentMessage()!.key });
  if (choice) {
    diagnostics.push({ severity: "error", code: "unclosed_choice", message: "选项块缺少 ？！", line: instructions[choice.index].line, column: 1 });
    instructions[choice.index].endIndex = instructions.length;
    for (const exit of choice.exits) instructions[exit].targetIndex = instructions.length;
  }
  for (const frame of conditions) {
    instructions[frame.elseIndex ?? frame.ifIndex].targetIndex = instructions.length;
    diagnostics.push({ severity: "error", code: "unclosed_if", message: "ifClear 缺少 endIf", line: instructions[frame.ifIndex].line, column: 1 });
  }
  instructions.forEach((instruction, index) => {
    if (instruction.tag === "$choice") program.choiceCatalog.push({ key: instruction.choiceKey!, options: instruction.options!, instructionIndex: index });
    if (instruction.tag === "selectionUse") instruction.endIndex = instructions.findIndex((item, next) => next > index && item.tag === "$choiceEnd");
    if (/^(?:branch|jump|masterBranch)/.test(instruction.tag)) {
      const label = unquote(instruction.params[instruction.tag === "masterBranch" && options.masterGender === "female" ? 1 : 0]);
      if (label && labels.has(label)) instruction.targetIndex = labels.get(label);
      else if (label) diagnostics.push({ severity: "warning", code: "unresolved_label", message: `跳转标签不存在：${label}`, line: instruction.line, column: instruction.column, command: instruction.tag });
    }
    if (instruction.tag === "masterNameWidth" || instruction.tag === "revivalBranch") {
      instruction.targetList = instruction.params.slice(instruction.tag === "masterNameWidth" ? 2 : 0).map(label => labels.get(unquote(label)));
      instruction.targetList.forEach((target, i) => { if (target === undefined) diagnostics.push({ severity: "warning", code: "unresolved_label", message: `跳转标签不存在：${instruction.params[(instruction.tag === "masterNameWidth" ? 2 : 0) + i]}`, line: instruction.line, column: instruction.column, command: instruction.tag }); });
    }
    if (instruction.choiceMode === "menu") for (const option of instruction.options ?? []) {
      const target = labels.get(option.targetLabel!); option.bodyIndex = target ?? index + 1;
      if (target === undefined) diagnostics.push({ severity: "warning", code: "unresolved_label", message: `跳转标签不存在：${option.targetLabel}`, line: instruction.line, column: instruction.column, command: "menu" });
    }
  });
  program.assets = [...assets.values()];
  program.characterIds = program.assets.filter((item) => item.kind === "figure").map((item) => item.name);
  program.sceneIds = program.assets.filter((item) => item.kind === "background").map((item) => item.name);
  program.bgmNames = program.assets.filter((item) => item.kind === "bgm").map((item) => item.name);
  return program;
}

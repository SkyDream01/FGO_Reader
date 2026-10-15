import type { CompileOptions, MessageToken, SpeakerInfo } from "./instruction";
import { FONT_SIZES, isCommand } from "./spec";
import { closingBracket, parseCommandParameters, parseNativeParameters, splitOutside } from "./syntax";

const defaults: CompileOptions = { scriptId: "inline", masterName: "御主", masterGender: "male" };
const sanitize = (value: string) => value.replace(/\[/g, "［").replace(/\]/g, "］");

export function renderTokensPlain(tokens: readonly MessageToken[]): string {
  return tokens.map((token) => {
    switch (token.type) {
      case "text": return token.value;
      case "emphasis": return token.value;
      case "ruby": return token.base;
      case "line": return "—".repeat(token.length);
      case "newline": return "\n";
      case "image": return token.alt;
      default: return "";
    }
  }).join("");
}

/** Evidence: supplement-markup.md §§2–7. Unknown markers remain literal. */
export function parseMarkup(value: string, options: CompileOptions = defaults, depth = 0): MessageToken[] {
  if (depth > 32) return [{ type: "text", value }];
  const tokens: MessageToken[] = [];
  const text = (part: string) => {
    if (!part) return;
    const previous = tokens.at(-1);
    if (previous?.type === "text") previous.value += part;
    else tokens.push({ type: "text", value: part });
  };
  let quoted = false;
  for (let i = 0; i < value.length;) {
    if (value[i] === '"') { quoted = !quoted; text(value[i++]); continue; }
    if (value[i] === "\n") { tokens.push({ type: "newline" }); i++; continue; }
    if (quoted || value[i] !== "[") { text(value[i++]); continue; }
    const end = closingBracket(value, i);
    if (end < 0) { text(value.slice(i)); break; }
    const raw = value.slice(i, end + 1), content = raw.slice(1, -1);
    i = end + 1;
    if (/^[\da-fA-F]{6}(?:[\da-fA-F]{2})?$/.test(content)) {
      tokens.push({ type: "color", color: `#${content}` });
    } else if (content === "-") {
      tokens.push({ type: "color", color: null });
    } else if (content === "r") {
      tokens.push({ type: "newline" });
    } else if (content.startsWith("&")) {
      const parts = splitOutside(content.slice(1), ":");
      const chosen = options.masterGender === "female" ? parts[2] ?? "" : parts[0];
      tokens.push(...parseMarkup(chosen, options, depth + 1));
    } else if (content.startsWith("#")) {
      const parts = splitOutside(content.slice(1), ":");
      const base = renderTokensPlain(parseMarkup(parts[0], options, depth + 1));
      if (parts.length > 1) tokens.push({ type: "ruby", base, ruby: parts.slice(2).join("") });
      else tokens.push({ type: "emphasis", value: base });
    } else if (/^%\d+$/.test(content)) {
      const id = Number(content.slice(1));
      text(sanitize(id === 1 ? options.masterName : options.variables?.[id] ?? ""));
      tokens.push({ type: "color", color: null });
    } else if (["align", "align center", "align right"].includes(content)) {
      tokens.push({ type: "align", align: content === "align center" ? "center" : content === "align right" ? "right" : "left" });
    } else {
      const [tag, ...params] = parseCommandParameters(content);
      if (tag === "line" && Number.isFinite(Number(params[0]))) {
        tokens.push({ type: "line", length: Math.max(0, Math.min(256, Math.trunc(Number(params[0])))) });
      } else if (tag === "image" || tag === "i") {
        const parts = splitOutside(content.slice(tag.length).trim(), ":");
        tokens.push({ type: "image", name: parts[0], alt: parts[2] ?? "", icon: tag === "i", ...(parts[4] && Number.isFinite(Number(parts[4])) ? { scale: Math.max(0, Number(parts[4])) } : {}) });
      } else if (tag === "f" || tag === "font" || tag === "fontSize") {
        tokens.push({ type: "font", size: FONT_SIZES[params[0] ?? "-"] ?? 29, ...(["top", "center", "bottom"].includes(params[1]) ? { verticalAlign: params[1] as "top" | "center" | "bottom" } : {}) });
      } else if (["servantName", "tRoute", "tFlag", "tRaidShortName"].includes(tag)) {
        text(sanitize(options.textReplacements?.(tag, params) ?? params.at(-1) ?? ""));
      } else if (tag === "s" || tag === "speed") {
        tokens.push({ type: "speed", charsPerSecond: params[0] === "-" ? null : Math.max(0, Number(params[0]) || 0) });
      } else if (tag === "wt" || tag === "twt") {
        const number = Number(parseNativeParameters(params.join(" "))[0]);
        tokens.push({ type: "wait", seconds: Number.isFinite(number) ? Math.max(0, number) : 0, clock: tag === "twt" ? "real" : "game" });
      } else if (tag === "k" || tag === "q") {
        tokens.push({ type: "input" });
      } else if (isCommand(tag) || tag === "effectmessage") {
        tokens.push({ type: "command", tag, params, pd: parseNativeParameters(content.slice(tag.length)) });
      } else {
        text(raw);
      }
    }
  }
  return tokens;
}

export function parseSpeaker(value: string, options: CompileOptions): SpeakerInfo {
  let name = value;
  let slot: string | undefined;
  const match = /^([A-Z])[:：](.*)$/.exec(name);
  if (match) { slot = match[1]; name = match[2]; }
  const spot = /=spot\[([A-Z,]+)\]$/.exec(name);
  if (spot) name = name.slice(0, spot.index);
  const tokens = parseMarkup(name, options);
  return { name: renderTokensPlain(tokens), tokens, slot, spots: spot?.[1].split(",") };
}


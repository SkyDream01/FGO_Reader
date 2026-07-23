import type { ParsedScript, Region, ScriptDiagnostic } from "../types";
import { projectScriptDocument, renderScriptText } from "./scriptProjector";
import { SCRIPT_PARSER_VERSION } from "./scriptParserVersion";
import { parseInlineScriptText, parseScriptDocument } from "./scriptSyntax";

export interface ScriptParseLimits {
  maxFrames?: number;
  maxChoiceOptions?: number;
  maxCharacterSlots?: number;
}

export interface ParseFgoScriptOptions {
  region?: Region;
  masterName?: string;
  masterGender?: "male" | "female";
  limits?: ScriptParseLimits;
}

function normalizeOptions(
  value: string | ParseFgoScriptOptions | undefined,
): Required<Omit<ParseFgoScriptOptions, "limits">> & { limits: Required<ScriptParseLimits> } {
  const options = typeof value === "string" ? { masterName: value } : value ?? {};
  return {
    region: options.region ?? "JP",
    masterName: options.masterName ?? "御主",
    masterGender: options.masterGender ?? "male",
    limits: {
      maxFrames: options.limits?.maxFrames ?? 10_000,
      maxChoiceOptions: options.limits?.maxChoiceOptions ?? 9,
      maxCharacterSlots: options.limits?.maxCharacterSlots ?? 64,
    },
  };
}

function mergeDiagnostics(...groups: ScriptDiagnostic[][]) {
  const merged: ScriptDiagnostic[] = [];
  const aggregated = new Map<string, ScriptDiagnostic>();
  for (const diagnostic of groups.flat()) {
    if (diagnostic.code === "unknown_command" && diagnostic.command) {
      const key = `${diagnostic.code}:${diagnostic.command.toLowerCase()}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.count = (existing.count ?? 1) + (diagnostic.count ?? 1);
        continue;
      }
      const entry = { ...diagnostic };
      aggregated.set(key, entry);
      merged.push(entry);
      continue;
    }
    merged.push(diagnostic);
  }
  return merged;
}

export function cleanScriptText(
  value: string,
  masterName = "御主",
  masterGender: "male" | "female" = "male",
) {
  const parsed = parseInlineScriptText(value);
  return renderScriptText(parsed.nodes, masterName, masterGender);
}

export function parseFgoScript(
  source: string,
  scriptId: string,
  options?: string | ParseFgoScriptOptions,
): ParsedScript {
  const normalized = normalizeOptions(options);
  const document = parseScriptDocument(source, {
    region: normalized.region,
    maxChoiceOptions: normalized.limits.maxChoiceOptions,
    maxCharacterSlots: normalized.limits.maxCharacterSlots,
  });
  const projected = projectScriptDocument(document, scriptId, {
    masterName: normalized.masterName,
    masterGender: normalized.masterGender,
    maxFrames: normalized.limits.maxFrames,
  });

  return {
    scriptId,
    parserVersion: SCRIPT_PARSER_VERSION,
    frames: projected.frames,
    frameCount: projected.frameCount,
    choiceCount: projected.choiceCount,
    characterCount: projected.characterCount,
    sceneCount: projected.sceneCount,
    bgmCount: projected.bgmCount,
    diagnostics: mergeDiagnostics(document.diagnostics, projected.diagnostics),
  };
}

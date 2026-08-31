import type { Region, ScriptDiagnostic } from "../types";
import { compileInlineNodes, compileScriptDocument, renderTokensPlain } from "../adv/compiler";
import type { ScriptProgram } from "../adv/instruction";
import { SCRIPT_PARSER_VERSION } from "./scriptParserVersion";
import { parseInlineScriptText, parseScriptDocument } from "./scriptSyntax";

export interface ScriptParseLimits {
  maxChoiceOptions?: number;
  maxCharacterSlots?: number;
}

export interface CompileFgoScriptOptions {
  region?: Region;
  masterName?: string;
  masterGender?: "male" | "female";
  limits?: ScriptParseLimits;
}

function normalizeOptions(
  value: string | CompileFgoScriptOptions | undefined,
): Required<Omit<CompileFgoScriptOptions, "limits">> & { limits: Required<ScriptParseLimits> } {
  const options = typeof value === "string" ? { masterName: value } : value ?? {};
  return {
    region: options.region ?? "JP",
    masterName: options.masterName ?? "御主",
    masterGender: options.masterGender ?? "male",
    limits: {
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

/** Renders an inline fragment for previews (search snippets, import notes). */
export function cleanScriptText(
  value: string,
  masterName = "御主",
  masterGender: "male" | "female" = "male",
) {
  const parsed = parseInlineScriptText(value);
  const { tokens } = compileInlineNodes(parsed.nodes, {
    scriptId: "inline-preview",
    masterName,
    masterGender,
  });
  return renderTokensPlain(tokens);
}

/**
 * ① Parser + ② Compiler (docs/FGO_Story_Reader_Standard.md §1.1).
 * Returns the compiled program ready for the runtime executor.
 */
export function compileFgoScript(
  source: string,
  scriptId: string,
  options?: string | CompileFgoScriptOptions,
): ScriptProgram {
  const normalized = normalizeOptions(options);
  const document = parseScriptDocument(source, {
    region: normalized.region,
    maxChoiceOptions: normalized.limits.maxChoiceOptions,
    maxCharacterSlots: normalized.limits.maxCharacterSlots,
  });
  const program = compileScriptDocument(document, {
    scriptId,
    masterName: normalized.masterName,
    masterGender: normalized.masterGender,
  });
  program.diagnostics = mergeDiagnostics(document.diagnostics, program.diagnostics);
  return program;
}

export { SCRIPT_PARSER_VERSION };

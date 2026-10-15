import type { Region } from "../types";
import { compileScriptDocument } from "../adv/compiler";
import type { ScriptProgram } from "../adv/instruction";
import { parseMarkup, renderTokensPlain } from "../adv/markup";
import { parseScriptDocument } from "../adv/syntax";
import type { ScriptMarkers } from "../adv/spec";

export interface ScriptParseLimits { maxChoiceOptions?: number; maxCharacterSlots?: number }
export interface CompileFgoScriptOptions {
  region?: Region;
  masterName?: string;
  masterGender?: "male" | "female";
  limits?: ScriptParseLimits;
  markers?: Partial<ScriptMarkers>;
  variables?: Readonly<Record<number, string>>;
  textReplacements?: (tag: string, params: readonly string[]) => string | undefined;
}

export function cleanScriptText(value: string, masterName = "御主", masterGender: "male" | "female" = "male"): string {
  return renderTokensPlain(parseMarkup(value, { scriptId: "preview", masterName, masterGender }));
}

/** Public entry point; docs/out supplements and closure evidence are normative. */
export function compileFgoScript(source: string, scriptId: string, value?: string | CompileFgoScriptOptions): ScriptProgram {
  const options = typeof value === "string" ? { masterName: value } : value ?? {};
  const document = parseScriptDocument(source, { region: options.region, markers: options.markers, maxChoiceOptions: options.limits?.maxChoiceOptions, maxCharacterSlots: options.limits?.maxCharacterSlots });
  return compileScriptDocument(document, { scriptId, masterName: options.masterName ?? "御主", masterGender: options.masterGender ?? "male", variables: options.variables, textReplacements: options.textReplacements });
}

export { SCRIPT_PARSER_VERSION } from "./scriptParserVersion";

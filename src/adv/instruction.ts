import type { ScriptDiagnostic } from "../types";

export type MessageToken =
  | { type: "text"; value: string }
  | { type: "newline" }
  | { type: "ruby"; base: string; ruby: string }
  | { type: "emphasis"; value: string }
  | { type: "line"; length: number }
  | { type: "image"; name: string; alt: string; icon: boolean; scale?: number }
  | { type: "color"; color: string | null }
  | { type: "align"; align: "left" | "center" | "right" }
  | { type: "font"; size: number; verticalAlign?: "top" | "center" | "bottom" }
  | { type: "speed"; charsPerSecond: number | null }
  | { type: "command"; tag: string; params: string[]; pd: string[] }
  | { type: "wait"; seconds: number; clock: "game" | "real" }
  | { type: "input" };

export interface SpeakerInfo {
  name: string;
  slot?: string;
  spots?: string[];
  tokens?: MessageToken[];
}

export interface ChoiceRouteInfo {
  route?: number;
  saveMaterial: boolean;
  routeType: "none" | "true" | "bad";
}

export interface ChoiceOptionIns {
  id: number;
  label: string;
  labelTokens: MessageToken[];
  hiddenFlag?: string;
  routeInfo?: ChoiceRouteInfo;
  bodyIndex: number;
  targetLabel?: string;
}

export interface Instruction {
  /** Original command spelling; $-prefixed tags are compiler operations. */
  tag: string;
  params: string[];
  /** Native AnalysParam: values alternate with space/comma/= delimiters. */
  pd: string[];
  line: number;
  column: number;
  raw: string;
  isMessage: boolean;
  speaker?: SpeakerInfo;
  tokens?: MessageToken[];
  messageKey?: string;
  options?: ChoiceOptionIns[];
  choiceKey?: string;
  targetIndex?: number;
  targetList?: Array<number | undefined>;
  choiceMode?: "menu";
  endIndex?: number;
}

export interface MessageRecord {
  key: string;
  speaker: string;
  text: string;
  instructionIndex: number;
}

export interface ChoiceRecord {
  key: string;
  options: Array<{ label: string }>;
  instructionIndex: number;
}

export interface ScriptAsset {
  kind: "background" | "figure" | "equip" | "image" | "bgm" | "audio" | "effect" | "movie" | "wipe";
  name: string;
  path: string;
  optional?: boolean;
}

export interface ScriptProgram {
  scriptId: string;
  /** First entry label, also present in labels and instructions. */
  header: string | null;
  instructions: Instruction[];
  labels: Map<string, number>;
  messageCatalog: MessageRecord[];
  choiceCatalog: ChoiceRecord[];
  characterIds: string[];
  sceneIds: string[];
  bgmNames: string[];
  assets: ScriptAsset[];
  diagnostics: ScriptDiagnostic[];
}

export interface CompileOptions {
  scriptId: string;
  masterName: string;
  masterGender: "male" | "female";
  /** %5 is servant count, not player name. */
  variables?: Readonly<Record<number, string>>;
  textReplacements?: (tag: string, params: readonly string[]) => string | undefined;
}

import type { ScriptDiagnostic } from "../types";

/**
 * Compiled instruction model (docs/FGO_Story_Reader_Standard.md §1.2 / S-P6).
 *
 * The compiler lowers the syntax AST into a flat instruction array that the
 * executor consumes with a cursor. Every instruction keeps its source line and
 * column so progress, backlog and diagnostics can point back at the script.
 */

/** Rich inline token stream preserved for message instructions (S-P8 hint). */
export type MessageToken =
  | { type: "text"; value: string }
  | { type: "newline" }
  | { type: "ruby"; base: string; ruby: string }
  | { type: "line"; length: number }
  | { type: "color"; color: string | null }
  | { type: "align"; align: "left" | "center" | "right" }
  | { type: "speed"; charsPerSecond: number };

export interface SpeakerInfo {
  /** Speaker display name with inline markers resolved. */
  name: string;
  /** Explicit `＠槽位:显示名` slot, when authored. */
  slot?: string;
  /** `＠显示名=spot[A,B]` multi-character co-performance slots. */
  spots?: string[];
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
  routeInfo?: ChoiceRouteInfo;
  /** Instruction index where the option body starts (points at the body or the exit jump). */
  bodyIndex: number;
}

export interface Instruction {
  /**
   * Normalized (lowercase) command tag. Special tags produced by the compiler:
   * `talkname`, `message`, `choice`. Everything else is the command as authored.
   */
  tag: string;
  params: string[];
  /** Source line (1-based) — the engine's executeOrgLineList. */
  line: number;
  column: number;
  /** Original raw text — the engine's executeDataList. */
  raw: string;
  /** Whether this instruction belongs to message flow (engine IsMessage). */
  isMessage: boolean;
  /** Message payload: speaker block (tag === "talkname"). */
  speaker?: SpeakerInfo;
  /** Message payload: inline token stream (tag === "message"). */
  tokens?: MessageToken[];
  /** Stable id shared by the message instruction and its boundary instruction. */
  messageKey?: string;
  /** Choice payload (tag === "choice"). */
  options?: ChoiceOptionIns[];
  choiceKey?: string;
  /** Pre-resolved jump/branch target index (labels resolved at compile time). */
  targetIndex?: number;
  /** Branch payload: condition descriptor consumed by the executor. */
  branch?: BranchCondition;
}

export type BranchCondition =
  | { kind: "always" }
  | { kind: "flag"; name: string; value: boolean }
  | { kind: "questClear"; questId: string }
  | { kind: "questNotClear"; questId: string }
  | { kind: "routeSelect"; questId: string; param: string; inverted: boolean };

/** A readable message in path order, produced by execution (translation unit). */
export interface MessageRecord {
  key: string;
  speaker: string;
  text: string;
  /** Index of the message instruction (or choice instruction) in the program. */
  instructionIndex: number;
}

export interface ChoiceRecord {
  key: string;
  options: Array<{ label: string }>;
  instructionIndex: number;
}

/** The stage flags a condition can consult at runtime. */
export interface BranchFlags {
  flags: Map<string, boolean>;
  questClear: ReadonlySet<string>;
}

export interface ScriptProgram {
  scriptId: string;
  /** ＄ scene header raw text (recorded, never executed). */
  header: string | null;
  instructions: Instruction[];
  /** label name → instruction index. */
  labels: Map<string, number>;
  /** Readable messages in program order (path-independent catalog). */
  messageCatalog: MessageRecord[];
  /** Choices in program order. */
  choiceCatalog: ChoiceRecord[];
  characterIds: string[];
  sceneIds: string[];
  bgmNames: string[];
  diagnostics: ScriptDiagnostic[];
}

/** Parse-time compilation options (mirrors the reader session options). */
export interface CompileOptions {
  scriptId: string;
  masterName: string;
  masterGender: "male" | "female";
}

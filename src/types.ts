export type Region = "CN" | "JP" | "NA" | "TW" | "KR";

export interface BasicWar {
  id: number;
  age: string;
  name: string;
  longName: string;
  flags: string[];
  eventId: number;
  eventName: string;
}

export interface ScriptReference {
  scriptId: string;
  script: string;
}

export interface QuestPhaseScripts {
  phase: number;
  scripts: ScriptReference[];
}

export interface StoryQuest {
  id: number;
  name: string;
  originalName?: string;
  type: string;
  spotName: string;
  warId: number;
  warLongName: string;
  chapterId: number;
  chapterSubId: number;
  chapterSubStr: string;
  phases: number[];
  phaseScripts: QuestPhaseScripts[];
  priority: number;
}

export interface WarSpot {
  id: number;
  name: string;
  quests: StoryQuest[];
}

export interface WarDetail extends BasicWar {
  originalName?: string;
  originalLongName?: string;
  banner?: string;
  headerImage?: string;
  priority?: number;
  spots: WarSpot[];
  questSelections?: Array<{
    quest: StoryQuest;
    priority: number;
  }>;
}

export interface BgmEntry {
  id: number;
  name: string;
  originalName: string;
  fileName: string;
  audioAsset?: string;
  notReleased: boolean;
}

export interface ScriptSearchResult {
  scriptId: string;
  script: string;
  score: number;
  snippets: string[];
}

export type CharacterPosition = "left" | "center" | "right";

/** Camera state for the composed game world (S-R6 镜头). */
export interface StoryCameraState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  filter: string | null;
}

export interface CharacterState {
  slot: string;
  id: string;
  name: string;
  face: number;
  visible: boolean;
  position: CharacterPosition;
  /** Stage-space X offset from the center; negative is left, positive is right. */
  x: number;
  /** Stage-space Y offset from the center; positive is up, negative is down. */
  y: number;
  /** Script-authored scale multiplier. */
  scale: number;
  silhouette: boolean;
  active: boolean;
  rotation?: number;
  shadow?: boolean;
}

export type ScriptDiagnosticSeverity = "warning" | "error";

export interface ScriptDiagnostic {
  severity: ScriptDiagnosticSeverity;
  code: string;
  message: string;
  line: number;
  column: number;
  command?: string;
  count?: number;
}

/** A resolved choice, addressed by the parser's stable choice-frame id. */
export interface ChoiceDecision {
  choiceId: string;
  optionIndex: number;
}

/** Ordered decisions needed to reconstruct a branching story path. */
export type ChoiceTrail = ChoiceDecision[];

export interface ReaderSettings {
  textSpeed: number;
  bgmVolume: number;
  skipUnread: boolean;
  reduceMotion: boolean;
  masterName: string;
}

export interface Bookmark {
  scriptId: string;
  scriptUrl: string;
  title: string;
  subtitle?: string;
  frameIndex: number;
  savedAt: number;
  region: Region;
  sequence?: StorySequenceItem[];
  sequenceIndex?: number;
  choiceTrail?: ChoiceTrail;
}

export interface LastObservation {
  scriptId: string;
  scriptUrl: string;
  title: string;
  subtitle?: string;
  frameIndex: number;
  updatedAt: number;
  region: Region;
  sequence?: StorySequenceItem[];
  sequenceIndex?: number;
  choiceTrail?: ChoiceTrail;
}

export interface StorySequenceItem {
  scriptId: string;
  scriptUrl: string;
  title: string;
  subtitle?: string;
  region: Region;
}

export interface StoryLaunch extends StorySequenceItem {
  startIndex?: number;
  sequence?: StorySequenceItem[];
  sequenceIndex?: number;
  choiceTrail?: ChoiceTrail;
}

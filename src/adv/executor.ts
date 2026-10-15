import type { CharacterPosition, ChoiceDecision, StoryCameraState } from "../types";
import type { TranslatableStep } from "../lib/translation";
import type { AudioIntent } from "./audio";
import { executeStageCommand, type CommandContext } from "./commands";
import { StartMode } from "./constants";
import type { ChoiceOptionIns, Instruction, MessageToken, ScriptProgram, SpeakerInfo } from "./instruction";
import { MessageWindow, sliceMessageLines, type MessageLineView } from "./message";
import { Stage, type SubLayerState } from "./stage";
import { TweenService } from "./tween";
import { FONT_SIZES } from "./spec";
import { nativeValues, numeric, unquote } from "./motion";
import { compareCount, routeCount, type GameStateProvider } from "./gameState";
import { parseMarkup } from "./markup";
import { executePresentationCommand } from "./presentation";

export type ExecutorPhase = "idle" | "message" | "wait" | "choice" | "ended";
export interface LogEntry { key: string; speaker: string; text: string }
export interface UpcomingUnit extends LogEntry { kind: "message" | "choice"; optionLabels?: string[]; optionIndices?: number[] }
export interface CharacterView {
  slot: string; id: string; name: string; face: number; position: CharacterPosition;
  x: number; y: number; scale: number; rotation: number; silhouette: boolean; shadow: boolean; active: boolean;
  alpha: number; layer: "main" | "sub"; group: string; depth: number; color: string | null;
  rollAxis?: Stage["slots"] extends Map<string, infer S> ? S extends { rollAxis: infer R } ? R : never : never;
  pivot?: { x: number; y: number };
  cut?: { name: string; progress: number; paused: boolean; duration: number; level: number } | null;
  change?: { id: string; face: number; progress: number } | null;
  maskInteraction?: "none" | "inside" | "outside";
  mode?: string;
  dimmed?: boolean;
}
export interface StageLayerView {
  slot: string; id: string; source: "background" | "image"; position: CharacterPosition;
  x: number; y: number; scale: number; layer: "main" | "sub"; depth: number; group: string; alpha: number; rotation: number;
  fullScreenScale?: string;
  change?: CharacterView["change"];
  mode?: string;
}
export interface MessageSnapshot {
  key: string; speaker: string; lines: MessageLineView[]; revealed: number; total: number; complete: boolean;
  align: "left" | "center" | "right";
}
export interface ChoiceSnapshot { key: string; options: Array<{ label: string; id: number }>; selected: number | null }
export interface StageSnapshot {
  version: number; phase: ExecutorPhase;
  fullScreen: boolean;
  background: { id: string | null; previousId: string | null; crossfade: number; seq: number; transition: "fade" | "wipe" | "none"; mode: string };
  characters: CharacterView[]; stageLayers: StageLayerView[]; subLayers: SubLayerState[];
  camera: StoryCameraState; blur: number | null; screenEffect: string | null; screenEffectSeq: number;
  pictureFrame: string | null; pictureFrameTop: boolean; movie: Stage["movie"];
  fade: Stage["fade"]; mask: Stage["mask"]; wipe: Stage["wipe"]; flash: Stage["flash"]; shake: Stage["shake"];
  waitKind: "input" | "timer" | "completion" | "choice" | null;
  message: MessageSnapshot | null; choice: ChoiceSnapshot | null; log: LogEntry[];
  bgm: { name: string; volume: number | null; fade: number } | null;
  position: number; messageOrdinal: number; messageTotal: number; boundaryCount: number;
  diagnostics: Array<{ tag: string; line: number; reason: string }>;
  choiceTrail: ChoiceDecision[];
  presentation: {
    effects: Array<Stage["effects"] extends Map<number, infer E> ? E : never>;
    communication: Stage["communication"]; insertions: Array<Stage["insertions"] extends Map<string, infer I> ? I : never>;
    backColor: Stage["backColor"]; capture: Stage["capture"]; spriteMask: Stage["spriteMask"];
    distortion: Stage["distortion"]; stretch: Stage["stretch"]; subStretch: boolean; blurKind: string;
  };
  messageStyle: Stage["messageStyle"];
  policy: Stage["policy"];
  notification: Stage["notification"];
}
export interface ExecutorTraceEvent {
  index: number; tag: string; line: number; phase: ExecutorPhase; status: "continue" | "wait" | "end" | "unknown";
}
export interface ExecutorOptions {
  masterName: string; masterGender: "male" | "female"; textSpeedMs: number; reduceMotion?: boolean;
  questClear?: ReadonlySet<string>;
  gameState?: GameStateProvider;
  randomSeed?: number;
  nameWidthScale?: number;
  measureName?: (name: string, size: number) => number;
  initialBgm?: { name: string; volume?: number | null };
}
export interface ExecutorStartOptions { startIndex?: number; choiceTrail?: ChoiceDecision[]; startMode?: StartMode }
interface WaitState {
  kind: "input" | "timer" | "completion" | "choice";
  remaining: number;
  clock: "game" | "real" | "frame";
  type?: string;
  target?: string;
  skippable?: boolean;
}
const STEP_LIMIT = 20_000;

/** Cursor + explicit waits. Presentation starts asynchronously in the same burst. */
export class ScriptExecutor {
  readonly stage = new Stage();
  readonly tweens = new TweenService();
  readonly unknownCommands = new Map<string, number>();
  readonly runtimeDiagnostics: StageSnapshot["diagnostics"] = [];
  onTrace: ((event: ExecutorTraceEvent) => void) | null = null;
  /** Optional asset backend completion probe, including real audio playback. */
  isExternalBusy: ((type: string, target?: string) => boolean | undefined) | null = null;
  onAudioTick: ((gameMs: number, realMs: number) => void) | null = null;
  private audioListener: ((intent: AudioIntent) => void) | null = null;
  private audioQueue: AudioIntent[] = [];
  private window = new MessageWindow();
  private cursor = 0;
  private position = 0;
  private phase: ExecutorPhase = "idle";
  private wait: WaitState | null = null;
  private speaker: SpeakerInfo = { name: "旁白" };
  private activeChoice: Instruction | null = null;
  private choiceOptions: ChoiceOptionIns[] = [];
  private log: LogEntry[] = [];
  private boundaries: number[] = [];
  private flags = new Map<string, string>();
  private decisions: ChoiceDecision[] = [];
  private restored: ChoiceDecision[] = [];
  private drained = 0;
  private timeScale = 1;
  private aspectRatio = 16 / 9;
  private replaying = false;
  private fastPlay = false;
  private retryInstruction: Instruction | null = null;
  private waitResumesMessage = false;
  private randomVisits = new Map<number, number>();
  private choiceEnds: number[] = [];
  private listeners = new Set<() => void>();
  private revision = 0;
  private snapshot: StageSnapshot | null = null;
  private delayed = new Map<string, { remaining: number; clock: "game" | "real"; start: number; end: number }>();
  private translationCache: { signature: string; steps: TranslatableStep[] } | null = null;

  constructor(private readonly program: ScriptProgram, private readonly options: ExecutorOptions) {
    this.window.textSpeedMs = options.textSpeedMs;
  }
  set onAudioIntent(listener: ((intent: AudioIntent) => void) | null) {
    this.audioListener = listener;
    if (listener) for (const intent of this.audioQueue.splice(0)) listener(intent);
  }
  get onAudioIntent() { return this.audioListener; }
  private emitAudio = (intent: AudioIntent) => {
    if (this.replaying) return;
    if (this.audioListener) this.audioListener(intent);
    else { this.audioQueue.push(intent); if (this.audioQueue.length > 64) this.audioQueue.shift(); }
  };
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private changed(): void { this.revision++; this.snapshot = null; for (const listener of this.listeners) listener(); }
  get changeCount(): number { return this.revision; }
  get messageCount(): number { return this.log.length; }
  getFlag(name: string): string | undefined { return this.flags.get(name); }
  setTextSpeed(value: number): void { this.window.textSpeedMs = Math.max(0, value); }
  setTimeScale(value: number): void { this.timeScale = Number.isFinite(value) ? Math.max(0, Math.min(64, value)) : 1; }
  setReduceMotion(value: boolean): void { this.options.reduceMotion = value; }
  setFastPlay(value: boolean): void { this.fastPlay = value; if (value && this.stage.movie) this.finishMovie(); }
  setViewportAspect(value: number): void { if (Number.isFinite(value) && value > 0) this.aspectRatio = value; }

  start(options: ExecutorStartOptions = {}): void {
    this.emitAudio({ kind: "stopAll", preserveContinue: true });
    this.stage.reset(); this.tweens.clear(); this.window.close(); this.cursor = 0; this.position = 0;
    if (this.options.initialBgm) { this.stage.audio.bgm = this.options.initialBgm.name; this.stage.audio.bgmVolume = this.options.initialBgm.volume ?? null; }
    this.window.setDefaultSpeed(null);
    this.window.forcedNormal = false; this.retryInstruction = null; this.waitResumesMessage = false; this.randomVisits.clear();
    this.phase = "idle"; this.wait = null; this.activeChoice = null; this.choiceOptions = [];
    this.speaker = { name: "旁白" }; this.log = []; this.boundaries = []; this.flags.clear();
    this.decisions = []; this.drained = 0; this.restored = [...(options.choiceTrail ?? [])];
    this.translationCache = null;
    this.choiceEnds = []; this.delayed.clear(); this.runtimeDiagnostics.length = 0; this.unknownCommands.clear();
    const mode = options.startMode ?? StartMode.None;
    if (mode === StartMode.Black || mode === StartMode.ClearBlack || mode === StartMode.White || mode === StartMode.ClearWhite) {
      this.stage.fade = { color: mode === StartMode.White || mode === StartMode.ClearWhite ? "#fff" : "#000", alpha: 1, seq: 1 };
      if (mode === StartMode.ClearBlack || mode === StartMode.ClearWhite) this.tweens.add({ owner: "fade", duration: this.options.reduceMotion ? 0 : 0.5, onUpdate: (t) => { this.stage.fade.alpha = 1 - t; this.stage.touch(); } });
    }
    const target = Math.max(0, Math.min(this.program.instructions.length - 1, options.startIndex ?? 0));
    if (target > 0) this.replayTo(target);
    else this.run();
    this.changed();
  }

  private context(instruction?: Instruction): CommandContext {
    return { stage: this.stage, tweens: this.tweens, masterGender: this.options.masterGender, fastForward: this.replaying || this.fastPlay || this.stage.policy.skip, reduceMotion: !!this.options.reduceMotion, aspectRatio: this.aspectRatio, emitAudio: this.emitAudio,
      onUnhandled: (tag) => this.unsupported(tag, "浏览器尚未实现该命令或缺少原始 Unity 资源"), diagnose: this.reportDiagnostic,
      requestWait: (type, target) => { this.executeWait([type, ...(target ? [target] : [])]); },
      retryNextFrame: () => { if (!instruction) return; this.retryInstruction = instruction; this.wait = { kind: "timer", remaining: 1, clock: "frame" }; this.phase = "wait"; } };
  }
  reportDiagnostic = (tag: string, reason: string): void => {
    if (!this.runtimeDiagnostics.some(item => item.tag === tag && item.reason === reason)) this.runtimeDiagnostics.push({ tag, line: this.program.instructions[this.position]?.line ?? 1, reason });
  };
  private unsupported(tag: string, reason: string): void {
    this.unknownCommands.set(tag, (this.unknownCommands.get(tag) ?? 0) + 1);
    if (!this.runtimeDiagnostics.some((item) => item.tag === tag && item.reason === reason)) this.runtimeDiagnostics.push({ tag, line: this.program.instructions[this.position]?.line ?? 1, reason });
  }

  tick(dtMs: number): void {
    if (this.phase === "ended") return;
    const real = Math.max(0, Number.isFinite(dtMs) ? dtMs : 0), game = real * this.timeScale;
    const version = this.stage.version;
    this.onAudioTick?.(game, real);
    this.tweens.update(game / 1000, real / 1000);
    if (this.stage.movie) {
      const movie = this.stage.movie;
      if (!movie.ready) movie.elapsed += real / 1000;
      if (!movie.ready && movie.elapsed >= movie.duration) this.finishMovie(false);
      else this.stage.touch();
    }
    for (const [key, job] of [...this.delayed]) {
      job.remaining -= job.clock === "real" ? real : game;
      if (job.remaining > 0) continue;
      this.delayed.delete(key);
      for (let i = job.start; i < job.end; i++) {
        const instruction = this.program.instructions[i];
        if (!instruction.tag.startsWith("$") && instruction.tag !== "wait") executeStageCommand(instruction, this.context(instruction));
      }
    }
    let changed = this.stage.version !== version;
    if (this.phase === "message" && !this.wait) {
      changed = this.window.tick(game, real, this.inlineAction) || changed;
      if (this.window.complete) { this.run(); changed = true; }
    } else if (this.wait && this.wait.kind !== "input" && this.wait.kind !== "choice") {
      const wait = this.wait;
      if (wait.kind === "timer") wait.remaining -= wait.clock === "real" ? real : wait.clock === "frame" ? 1 : game;
      if ((wait.kind === "timer" && wait.remaining <= 0) || (wait.kind === "completion" && !this.busy(wait.type!, wait.target))) {
        this.wait = null;
        const retry = this.retryInstruction; this.retryInstruction = null;
        if (retry) executeStageCommand(retry, this.context(retry));
        if (!this.wait) this.continueAfterWait(); changed = true;
      }
    }
    if (changed) this.changed();
  }

  private inlineAction = (token: MessageToken) => {
    if (token.type === "command") {
      const instruction = { tag: token.tag, params: token.params, pd: token.pd, line: this.program.instructions[this.position]?.line ?? 1, column: 1, raw: "", isMessage: false };
      if (token.tag === "wait") { executePresentationCommand(instruction, this.context(instruction)); this.executeWait(token.params); }
      else executeStageCommand(instruction, this.context(instruction));
      this.window.forcedNormal = this.stage.messageStyle.speedForcedNormal;
      if (this.wait) { this.waitResumesMessage = true; return true; }
    }
    return false;
  };
  private continueAfterWait(): void {
    if (this.waitResumesMessage) {
      this.waitResumesMessage = false; this.window.resumeCommands(); this.phase = "message";
      this.window.tick(0, 0, this.inlineAction, this.replaying);
      if (this.window.complete) this.run();
    } else this.run();
  }
  tap(): void {
    if (this.phase === "choice" || this.phase === "ended") return;
    if (this.stage.notification) { this.stage.notification = null; this.wait = null; this.run(); this.changed(); return; }
    if (this.stage.policy.tapSkipLabel && this.program.labels.has(this.stage.policy.tapSkipLabel)) {
      const label = this.stage.policy.tapSkipLabel; this.stage.policy.tapSkipLabel = null;
      this.wait = null; this.jump(this.program.labels.get(label)!); this.run(); this.changed(); return;
    }
    if (this.phase === "message" && !this.window.complete && !this.wait) {
      this.window.revealAll(); this.window.tick(0, 0, this.inlineAction);
      if (this.window.complete) this.run();
    } else if (this.wait?.kind === "input" || (this.wait?.kind === "timer" && this.wait.skippable)) {
      this.wait = null; this.continueAfterWait();
    }
    this.changed();
  }
  selectChoice(index: number): void {
    const instruction = this.activeChoice, option = this.choiceOptions[index];
    if (!instruction || !option || this.phase !== "choice") return;
    const originalIndex = instruction.options!.indexOf(option);
    const decision = { choiceId: instruction.choiceKey!, optionIndex: originalIndex };
    this.decisions.push(decision);
    // Native flags use the stable authored ordinal even when earlier choices hide.
    if (instruction.choiceMode !== "menu") {
      this.flags.set("INPUT_SELECT_BRANCH", String(option.id));
      this.flags.set(`INPUT_SELECT_BRANCH_${option.id}`, "true");
    }
    if (instruction.endIndex !== undefined) this.choiceEnds.push(instruction.endIndex);
    this.cursor = option.bodyIndex; this.activeChoice = null; this.choiceOptions = []; this.wait = null;
    this.run(); this.changed();
  }
  takeNewDecisions(): ChoiceDecision[] { const next = this.decisions.slice(this.drained); this.drained = this.decisions.length; return next; }

  private boundary(index: number): void {
    if (this.boundaries.at(-1) !== index) this.boundaries.push(index);
  }
  private run(stopAt?: number): void {
    if (this.phase === "ended") return;
    this.phase = "idle";
    for (let step = 0; step < STEP_LIMIT; step++) {
      if (this.cursor >= this.program.instructions.length) { this.phase = "ended"; this.wait = null; return; }
      const index = this.cursor;
      if (stopAt !== undefined && index === stopAt && this.decisions.length >= this.restored.length) return;
      const instruction = this.program.instructions[this.cursor++];
      this.position = index;
      const suspended = this.execute(instruction, index);
      this.onTrace?.({ index, tag: instruction.tag, line: instruction.line, phase: this.currentPhase(), status: this.currentPhase() === "ended" ? "end" : suspended ? "wait" : this.unknownCommands.has(instruction.tag) ? "unknown" : "continue" });
      if (this.currentPhase() === "ended") return;
      if (suspended && !this.replaying) return;
      if (suspended && this.replaying) {
        if (this.currentPhase() === "choice") return; // A missing decision must remain visible.
        this.window.tick(0, 0, this.inlineAction, true); this.tweens.finishAll(); this.wait = null;
        this.waitResumesMessage = false;
      }
    }
    this.unsupported("control_flow", "同一帧指令超过限制，已停止循环跳转"); this.phase = "ended"; this.wait = null;
  }
  private currentPhase(): ExecutorPhase { return this.phase; }
  private execute(instruction: Instruction, index: number): boolean {
    const { tag } = instruction, p = instruction.params.map(unquote);
    switch (tag) {
      case "$speaker":
      case "talkName": {
        this.speaker = instruction.speaker ?? { name: p.join(" ") || "旁白" };
        this.stage.talkSlots = this.speaker.spots ?? (this.speaker.slot ? [this.speaker.slot] : [...this.stage.slots.values()].filter((slot) => slot.name === this.speaker.name).map((slot) => slot.slot));
        this.stage.touch(); return false;
      }
      case "$message": {
        const existing = this.window.key === instruction.messageKey;
        if (existing) this.window.append(instruction.tokens ?? []);
        else {
          this.window.open(instruction.messageKey!, this.speaker.name, [{ type: "font", size: this.stage.messageFont, verticalAlign: this.stage.messageFontAlign }, { type: "align", align: this.stage.messageAlign }, ...(instruction.tokens ?? [])], !!this.options.reduceMotion || this.replaying || this.fastPlay || this.stage.policy.skip || this.stage.messageStyle.scrollStop);
          this.stage.messageStyle.scrollStop = false;
          this.boundary(index);
          const catalog = this.program.messageCatalog.find((entry) => entry.key === instruction.messageKey);
          this.log.push({ key: instruction.messageKey!, speaker: this.speaker.name, text: catalog?.text ?? "" });
        }
        this.stage.messageVisible = true;
        this.window.forcedNormal = this.stage.messageStyle.speedForcedNormal;
        this.phase = "message";
        this.window.tick(0, 0, this.inlineAction, this.replaying);
        return !this.window.complete;
      }
      case "k": case "q":
        if (this.stage.policy.skip || this.stage.policy.backlogOnly) return false;
        this.wait = { kind: "input", remaining: 0, clock: "game" }; this.phase = this.window.key && this.stage.messageVisible ? "message" : "wait"; return true;
      case "page": case "clear":
        if (p.length) { this.reportDiagnostic(tag, "parameter be unnecessary"); return false; }
        this.window.close(); this.wait = { kind: "input", remaining: 0, clock: "game" }; this.phase = "wait"; return true;
      case "$choice": {
        const options = instruction.options!.filter((option) => !option.hiddenFlag || this.flags.get(option.hiddenFlag) !== "true");
        if (!options.length) { this.cursor = instruction.endIndex ?? this.cursor; return false; }
        this.activeChoice = instruction; this.choiceOptions = options; this.boundary(index);
        const next = this.restored[this.decisions.length];
        const restore = this.replaying && next?.choiceId === instruction.choiceKey ? next : undefined;
        const option = restore ? instruction.options![restore.optionIndex] : undefined;
        if (restore && option && options.includes(option)) {
          this.decisions.push(restore);
          if (instruction.choiceMode !== "menu") { this.flags.set("INPUT_SELECT_BRANCH", String(option.id)); this.flags.set(`INPUT_SELECT_BRANCH_${option.id}`, "true"); }
          if (instruction.endIndex !== undefined) this.choiceEnds.push(instruction.endIndex); this.cursor = option.bodyIndex; this.activeChoice = null; return false;
        }
        this.phase = "choice"; this.wait = { kind: "choice", remaining: 0, clock: "game" }; return true;
      }
      case "$choiceExit": this.cursor = instruction.targetIndex ?? this.cursor; return false;
      case "$choiceEnd": this.choiceEnds.pop(); return false;
      case "label": case "talkEnd": case "talkStart": case "input": return false;
      case "flag": this.flags.set(p[0], p[1] ?? "true"); return false;
      case "flagRandom": {
        if (p.length !== 3) { this.reportDiagnostic(tag, "parameter error"); return false; }
        const convert = (value: string) => /^(true|on)$/.test(value) ? 1 : /^(false|off)$/.test(value) ? 0 : Math.trunc(numeric(value));
        const lo = convert(p[1]), hi = convert(p[2]); if (hi < lo) { this.reportDiagnostic(tag, "parameter error"); return false; }
        const visit = this.randomVisits.get(index) ?? 0; this.randomVisits.set(index, visit + 1);
        let seed = this.options.randomSeed ?? 2166136261;
        for (const char of `${this.program.scriptId}:${index}:${visit}`) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
        seed = Math.imul(seed ^ seed >>> 16, 0x45d9f3b); const random = ((seed ^ seed >>> 16) >>> 0) / 0x100000000;
        this.flags.set(p[0], String(lo + Math.floor(random * (hi - lo + 1)))); return false;
      }
      case "branch": case "jump": case "masterBranch": {
        const flagValue = (value: string) => /^(true|on)$/.test(value) ? "1" : /^(false|off)$/.test(value) ? "0" : Number.isFinite(Number(value)) ? String(Number(value)) : value;
        const accepts = tag !== "branch" || p.length < 2 || flagValue(this.flags.get(p[1]) ?? "false") === flagValue(p[2] ?? "true");
        if (accepts && instruction.targetIndex !== undefined) this.jump(instruction.targetIndex);
        return false;
      }
      case "branchQuestClear": case "branchQuestNotClear": {
        const value = this.options.gameState?.questPhaseClear?.(Number(p[1]), p[2] === undefined ? undefined : Number(p[2])) ?? this.options.questClear?.has(p[1]);
        if (value === undefined) this.reportDiagnostic(tag, "未注入任务状态，按未完成处理");
        const clear = value ?? false;
        if ((tag === "branchQuestClear" ? clear : !clear) && instruction.targetIndex !== undefined) this.jump(instruction.targetIndex);
        return false;
      }
      case "branchMaterial": case "branchNotMaterial": case "branchHaveSvtEquip": case "branchNotHaveSvtEquip":
      case "branchRouteSelect": case "branchNotRouteSelect": case "branchRouteSelectCount": case "branchNotRouteSelectCount": case "branchSetGrandSvtCount": {
        const game = this.options.gameState;
        let value: boolean | undefined;
        if (tag.endsWith("Material")) value = game?.isCollection ?? false;
        else if (tag.endsWith("HaveSvtEquip")) value = game?.svtEquipHaving?.(Number(p[1]));
        else if (tag.endsWith("RouteSelect")) value = game?.routeSelected?.(Number(p[1]), Number(p[2]));
        else if (tag.endsWith("RouteSelectCount")) value = routeCount(game, (p[3] ?? "").split(",").map(Number), (p[4] ?? "").split(",").map(Number), Number(p[1]), p[2]);
        else if (game?.grandSvtCount !== undefined) value = compareCount(Number(p[1]), game.grandSvtCount, p[2]);
        if (value === undefined) this.reportDiagnostic(tag, "未注入游戏数据，按不可判定的 Not 侧处理");
        if ((tag.startsWith("branchNot") ? !value : value === true) && instruction.targetIndex !== undefined) this.jump(instruction.targetIndex);
        return false;
      }
      case "masterNameWidth": {
        const size = FONT_SIZES[p[0]] ?? 29;
        let width = this.options.measureName?.(this.options.masterName, size);
        if (width === undefined && typeof document !== "undefined") { const context = document.createElement("canvas").getContext("2d"); if (context) { context.font = `${size}px sans-serif`; width = context.measureText(this.options.masterName).width; } }
        width ??= Array.from(this.options.masterName).length * size;
        const target = instruction.targetList?.[width * (this.options.nameWidthScale ?? 1) < numeric(p[1]) ? 0 : 1];
        if (target !== undefined) this.jump(target); return false;
      }
      case "revivalBranch": {
        const game = this.options.gameState, route = game?.isCollection && p.length === 3 ? 2 : !game?.isCollection && game?.isRevival && p.length >= 2 ? 1 : 0;
        const target = instruction.targetList?.[route]; if (target !== undefined) this.jump(target); return false;
      }
      case "questMessageOverwrite": {
        const text = this.options.gameState?.questMessageOverwrite?.(p[0]);
        if (text) { this.window.open(`quest:${p[0]}`, this.speaker.name, parseMarkup(text, { scriptId: this.program.scriptId, masterName: this.options.masterName, masterGender: this.options.masterGender })); this.stage.messageVisible = true; }
        else this.reportDiagnostic(tag, "未注入任务替换文本，继续使用原文"); return false;
      }
      case "notification":
        if (!p[1]) return false;
        this.stage.notification = { title: p[0], text: p.slice(1).join(" ") }; this.wait = { kind: "input", remaining: 0, clock: "game" }; this.phase = "wait"; return true;
      case "ifClear": if (this.flags.get(p[0]) !== "true") this.cursor = instruction.targetIndex ?? this.cursor; return false;
      case "else": this.cursor = instruction.targetIndex ?? this.cursor; return false;
      case "endIf": return false;
      case "selectionUse": {
        const accepts = p[0] === "masterMale" ? this.options.masterGender === "male" : p[0] === "masterFemale" ? this.options.masterGender === "female" : p[0] !== "cancel";
        if (!accepts && instruction.endIndex !== undefined && instruction.endIndex >= 0) this.cursor = instruction.endIndex;
        return false;
      }
      case "wait": executePresentationCommand(instruction, this.context(instruction)); return this.executeWait(p);
      case "delay": case "tdelay": {
        let depth = 1, end = -1;
        for (let i = index + 1; i < this.program.instructions.length; i++) { const name = this.program.instructions[i].tag; if (name === "delay" || name === "tdelay") depth++; if (name === "delayEnd" && --depth === 0) { end = i; break; } }
        if (end < 0) { this.unsupported(tag, "延迟块缺少 delayEnd"); return false; }
        if (this.program.instructions.slice(index + 1, end).some(item => item.tag.startsWith("$") || ["wait", "delay", "tdelay", "branch", "jump"].includes(item.tag))) this.reportDiagnostic(tag, "延迟块中的嵌套、文本及控制流尚未执行，当前调度演出命令子集");
        this.delayed.set(p[0], { remaining: Math.max(0, Number(p[1]) || 0) * 1000, clock: tag === "tdelay" ? "real" : "game", start: index + 1, end }); this.cursor = end + 1; return false;
      }
      case "delayStop": this.delayed.delete(p[0]); return false;
      case "delayStopAll": this.delayed.clear(); return false;
      case "speed": case "s": this.window.setDefaultSpeed(p[0] === "-" ? null : Number(p[0]) || 0); return false;
      case "end": case "interruption": {
        const color = p[0] === "white" || p[0] === "black" ? p[0] : this.stage.endFade;
        this.stage.audio.keepSubBgm = 0;
        if (this.stage.audioStopAtEnd) this.stage.audio.bgm = null;
        this.emitAudio({ kind: "scriptEnd" });
        if (color !== "clear" && !this.replaying) {
          const from = this.stage.fade.alpha; this.stage.fade.color = color === "white" ? "#fff" : "#000";
          this.tweens.add({ owner: "endFade", duration: this.options.reduceMotion ? 0 : 0.5, onUpdate: t => { this.stage.fade.alpha = from + (1 - from) * t; this.stage.touch(); }, onComplete: () => { this.phase = "ended"; this.wait = null; } });
          if (this.currentPhase() !== "ended") { this.phase = "wait"; this.wait = { kind: "completion", remaining: 0, clock: "game", type: "endFade" }; } return true;
        }
        this.phase = "ended"; this.wait = null; return true;
      }
      case "skip": if (["true", "false", "allFalse"].includes(p[0])) { this.stage.policy.skip = p[0] === "true"; this.stage.policy.tapSkipFade = null; } else this.reportDiagnostic(tag, "parameter error"); return false;
      case "tapSkip": this.stage.policy.tapSkipLabel = p[0] ?? null; this.stage.policy.dontResetPress = p.includes("dontResetPress"); this.stage.policy.tapSkipFade = p.find((value, i) => i > 0 && value !== "dontResetPress") ?? null; return false;
      case "backlogStart": case "backlogEnd": this.stage.policy.backlogOnly = tag === "backlogStart"; return false;
      case "autoAndBackLog": if (this.stage.policy.backLog) { this.stage.policy.hideAuto = p[0] === "false"; this.stage.policy.hideLog = p[0] === "false"; } return false;
      default: executeStageCommand(instruction, this.context(instruction)); return this.wait !== null;
    }
  }

  private jump(target: number): void {
    // Native labels reset switch state; literal control flow remains in place.
    this.choiceEnds = []; this.cursor = target;
  }
  private executeWait(p: string[]): boolean {
    const type = p[0] ?? "";
    if (!type) { this.reportDiagnostic("wait", "parameter error"); return false; }
    if (type === "touch") { this.wait = { kind: "input", remaining: 0, clock: "game" }; this.phase = "wait"; return true; }
    if (["time", "rtime", "skippableTime", "frame"].includes(type)) {
      const value = Number(p[1]) || 0;
      if (value <= 0) return false;
      if (this.stage.policy.skip || this.fastPlay && type === "skippableTime") return false;
      this.wait = { kind: "timer", remaining: type === "frame" ? value : value * 1000, clock: type === "rtime" ? "real" : type === "frame" ? "frame" : "game", skippable: type === "skippableTime" };
    } else {
      if (!this.busy(type, p[1])) return false;
      this.wait = { kind: "completion", remaining: 0, clock: "game", type, target: p[1] };
    }
    this.phase = "wait"; return true;
  }
  private busy(type: string, target?: string): boolean {
    if (["tVoice", "tVoiceUser", "cueVoice"].includes(type)) type = "voice";
    if (type === "cueSe") type = "se";
    if (type === "movie") return !!this.stage.movie?.blocking;
    if (type === "endFade") return this.tweens.isActive("endFade");
    if (type === "communicationCharaLoad") return !!this.stage.communication && !this.stage.communication.loaded;
    if (type === "communicationChara" || type === "communicatioChara") return !!this.stage.communication?.busy;
    if (type === "insertionAnimationSet") return [...this.stage.insertions.values()].some(object => object.loading);
    if (type === "insertionAnimationStart" || type === "insertionAnimationEnd") return !!this.stage.insertions.get(target ?? "")?.active;
    if (type === "fsmObjSet" || type === "fsmObjFinished") { const fsm = this.stage.fsm.get(target ?? ""); return type === "fsmObjSet" ? !!fsm?.loading : !!fsm?.playing; }
    if (["advSet", "advPlayAnimator", "spriteMaskSet", "fastPlayDraw"].includes(type)) return false;
    const fxType = type.replace(/Start$/, ""), fx = /^(charaSpecialEffect|charaBackEffect|charaEffectEdgeBlur|charaEffect|specialEffect|fowardEffect|backEffect|effectmessage|effect)$/.exec(fxType);
    if (fx) {
      const chara = fxType.startsWith("chara"), family = fxType === "charaEffectEdgeBlur" ? "edgeBlur" : chara ? fxType.slice(5).replace(/^./, c => c.toLowerCase()) : fxType;
      return [...this.stage.effects.values()].some(effect => (chara ? effect.container === `chara:${target}:${family}` : effect.container === family && (!target || effect.name === target.replace(/^(?:Effect\/)?Talk\//, ""))) && (effect.loading || effect.busy));
    }
    const fixed: Record<string, string> = { fade: "fade", wipe: "wipe", mask: "mask", flash: "flash", camera: "camera", cameraRoll: "camera:roll", scene: "scene", shake: "shake" };
    if (fixed[type]) return this.tweens.isActiveByPrefix(fixed[type]);
    if (type === "charaFadeTimeLoop" && target && this.stage.slots.get(target)?.alphaLoop?.infinite) return false;
    const track = /^(?:chara(?:Change|CrossFade|CutStart|Cut|Attack|FadeTimeLoop|Fade|Move.*|Return|Roll.*|Set)|(?:master|figure|equip|horizontalImage|verticalImage|image|scene).*(?:Set|Change))$/.test(type);
    if (track) {
      const family = /Change|CrossFade/.test(type) ? "change" : /Cut/.test(type) ? "cut" : /FadeTimeLoop/.test(type) ? "alphaLoop" : /Fade/.test(type) ? "alpha" : /Scale/.test(type) ? "scale" : /Roll/.test(type) ? "roll" : /Move|Return|Attack/.test(type) ? "move" : "load";
      return target ? this.tweens.isActive(`chara:${target}:${family}`) : [...this.stage.slots.keys()].some(slot => this.tweens.isActive(`chara:${slot}:${family}`));
    }
    if (type.startsWith("sub")) return this.tweens.isActiveByPrefix(target ? `sub:${target}:` : "sub:");
    if (type === "delay") return this.delayed.size > 0;
    const external = this.isExternalBusy?.(type, target);
    if (external !== undefined) return external;
    if (["se", "voice", "jingle", "subBgm"].includes(type)) { this.reportDiagnostic(`wait ${type}`, "音频后端不可用，立即完成等待"); return false; }
    this.unsupported(`wait ${type}`, "缺少此等待条件的资源后端，已继续脚本"); return false;
  }

  finishMovie(resume = true): void { if (!this.stage.movie) return; this.stage.movie = null; this.stage.touch(); if (resume && this.wait?.type === "movie") { this.wait = null; this.run(); } this.changed(); }
  updateMovie(name: string, elapsed: number, duration: number): void { const movie = this.stage.movie; if (movie?.name !== name) return; movie.ready = true; movie.elapsed = elapsed; if (Number.isFinite(duration) && duration > 0) movie.duration = duration; this.changed(); }

  private replayTo(target: number): void {
    this.replaying = true;
    try {
      this.run(target);
      this.tweens.finishAll();
    } finally { this.replaying = false; }
    if (this.phase !== "choice" && this.phase !== "ended") { this.wait = null; this.run(); }
  }
  fastForwardTo(target: number): void { this.replayTo(Math.max(0, target)); this.changed(); }
  goBackOneBoundary(): void {
    if (this.boundaries.length < 2) return;
    const target = this.boundaries[this.boundaries.length - 2];
    const trail = [...this.decisions]; this.start({ startIndex: target, choiceTrail: trail });
  }
  jumpToMessage(key: string): void { const index = this.getInstructionIndex(key); if (index !== null) this.start({ startIndex: index, choiceTrail: [...this.decisions] }); }
  getInstructionIndex(key: string): number | null {
    return this.program.messageCatalog.find((entry) => entry.key === key)?.instructionIndex ?? this.program.choiceCatalog.find((entry) => entry.key === key)?.instructionIndex ?? null;
  }
  getSceneStateHash(): string { return JSON.stringify({ background: this.stage.background.current, camera: this.stage.camera, slots: [...this.stage.slots], subLayers: [...this.stage.subLayers] }); }
  enumerateUpcomingMessages(count: number): UpcomingUnit[] {
    const probe = new ScriptExecutor(this.program, { ...this.options, reduceMotion: true });
    probe.start({ startIndex: this.position, choiceTrail: [...this.decisions, ...this.restored] });
    const result: UpcomingUnit[] = [], seen = new Set<string>();
    for (let steps = 0; steps < 1000 && result.length < count; steps++) {
      const state = probe.getSnapshot();
      if (state.choice) {
        result.push({ key: state.choice.key, kind: "choice", speaker: "选择", text: state.choice.options.map((option) => option.label).join("\n"), optionLabels: state.choice.options.map((option) => option.label), optionIndices: state.choice.options.map((option) => option.id - 1) }); break;
      }
      if (state.message && !seen.has(state.message.key)) {
        const record = this.program.messageCatalog.find((entry) => entry.key === state.message!.key);
        if (record) { result.push({ ...record, kind: "message" }); seen.add(record.key); }
      }
      if (state.phase === "ended") break;
      probe.tap(); probe.tick(120_000);
    }
    return result;
  }
  currentTranslationSteps(count: number): TranslatableStep[] {
    const signature = `${this.position}:${this.decisions.length}:${this.phase === "choice"}:${count}`;
    if (this.translationCache?.signature === signature) return this.translationCache.steps;
    const steps: TranslatableStep[] = this.enumerateUpcomingMessages(count).map((unit) => unit.kind === "choice" ? { key: unit.key, kind: "choice", speaker: "选择", text: "", optionLabels: unit.optionLabels, optionIndices: unit.optionIndices } : { key: unit.key, kind: "message", speaker: unit.speaker, text: unit.text });
    this.translationCache = { signature, steps };
    return steps;
  }

  getSnapshot = (): StageSnapshot => {
    if (this.snapshot) return this.snapshot;
    const stage = this.stage;
    const characters: CharacterView[] = [], stageLayers: StageLayerView[] = [];
    for (const slot of stage.slots.values()) {
      if (!slot.visible) continue;
      const active = stage.talkSlots.includes(slot.slot), common = { slot: slot.slot, id: slot.id, position: slot.position, x: slot.x + slot.shakeX, y: slot.y + slot.shakeY, scale: slot.scale, rotation: slot.rotation, alpha: slot.alpha, layer: slot.layer, group: slot.group, depth: slot.depth + (stage.talkDepth && active ? 1 : 0), change: slot.change ? { ...slot.change } : null };
      if (slot.kind === "figure") characters.push({ ...common, name: slot.name, face: slot.face, silhouette: slot.silhouette, shadow: slot.shadow, color: slot.color, active, dimmed: stage.talkMask && stage.talkSlots.length > 0 && !active, rollAxis: { ...slot.rollAxis }, pivot: { ...slot.pivot }, cut: slot.cut ? { ...slot.cut } : null, maskInteraction: slot.maskInteraction, mode: slot.mode });
      else stageLayers.push({ ...common, source: slot.kind, fullScreenScale: slot.fullScreenScale, mode: slot.mode });
    }
    this.snapshot = {
      version: this.revision, phase: this.phase,
      fullScreen: stage.fullScreen,
      background: { id: stage.background.current, previousId: stage.background.previous, crossfade: stage.background.crossfade, seq: stage.background.seq, transition: stage.background.previous ? "fade" : "none", mode: stage.background.mode },
      characters, stageLayers, subLayers: [...stage.subLayers.values()].map((layer) => ({ ...layer, camera: { ...layer.camera } })), camera: { ...stage.camera }, blur: stage.blur, screenEffect: stage.screenEffect, screenEffectSeq: stage.screenEffectSeq,
      pictureFrame: stage.pictureFrame, pictureFrameTop: stage.pictureFrameTop, movie: stage.movie ? { ...stage.movie } : null,
      fade: { ...stage.fade }, mask: { ...stage.mask }, wipe: { ...stage.wipe }, flash: { ...stage.flash }, shake: { ...stage.shake },
      waitKind: this.wait?.kind ?? null,
      message: this.window.key && stage.messageVisible ? { key: this.window.key, speaker: this.window.speaker, lines: sliceMessageLines(this.window.layout, this.window.revealed), revealed: this.window.revealed, total: this.window.textLength, complete: this.window.complete, align: this.window.layout.align } : null,
      choice: this.activeChoice && this.phase === "choice" ? { key: this.activeChoice.choiceKey!, options: this.choiceOptions.map((option) => ({ label: option.label, id: option.id })), selected: null } : null,
      log: this.log.map((entry) => ({ ...entry })), bgm: stage.audio.bgm ? { name: stage.audio.bgm, volume: stage.audio.bgmVolume, fade: stage.audio.fade } : null,
      position: this.window.key && this.phase === "message" ? this.program.messageCatalog.find((entry) => entry.key === this.window.key)?.instructionIndex ?? this.position : this.position,
      messageOrdinal: this.log.length, messageTotal: this.program.messageCatalog.length, boundaryCount: this.boundaries.length,
      diagnostics: this.runtimeDiagnostics.map((entry) => ({ ...entry })),
      choiceTrail: this.decisions.map((entry) => ({ ...entry })),
      presentation: { effects: [...stage.effects.values()].map(effect => ({ ...effect })), communication: stage.communication ? { ...stage.communication } : null, insertions: [...stage.insertions.values()].map(object => ({ ...object, images: [...object.images] })), backColor: stage.backColor, capture: stage.capture, spriteMask: stage.spriteMask, distortion: { ...stage.distortion }, stretch: { ...stage.stretch }, subStretch: stage.subStretch, blurKind: stage.blurKind },
      messageStyle: { ...stage.messageStyle, shake: { ...stage.messageStyle.shake }, screen: stage.messageStyle.screen ? { ...stage.messageStyle.screen } : null }, policy: { ...stage.policy }, notification: stage.notification ? { ...stage.notification } : null,
    };
    return this.snapshot;
  };
}

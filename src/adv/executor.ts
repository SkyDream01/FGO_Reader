import type { StoryCameraState, CharacterPosition, ChoiceDecision } from "../types";
import { ExecutorState, ReturnCode, StartMode, type StartMode as StartModeValue } from "./constants";
import { executeStageCommand } from "./commands";
import { MessageWindow, sliceMessageLines, type MessageLineView } from "./message";
import { Stage, type CharacterSlotState, type StageLayerSlotState } from "./stage";
import type { AudioIntent } from "./audio";
import { TweenService } from "./tween";
import type { Instruction, MessageToken, ScriptProgram } from "./instruction";
import type { TranslatableStep } from "../lib/translation";

/**
 * ③ Executor (docs/FGO_Story_Reader_Standard.md §3 执行标准 S-E).
 *
 * A cursor walks the compiled instruction array. The main loop keeps consuming
 * instructions while they return `Continue` — instant presentations burst in
 * the same frame (S-E1/E8: bgm + scene + charaSet×6 + fadein all start at
 * once) — and suspends on `Normal` waits: message boundaries, timers, and
 * transition completion flags. Control flow (jump/branch/flag/ifClear/choice)
 * rewrites the cursor at runtime (S-E6).
 */

export type ExecutorPhase = "idle" | "message" | "wait" | "choice" | "ended";

export interface LogEntry {
  key: string;
  speaker: string;
  text: string;
}

/** A readable unit produced by lookahead enumeration. */
export interface UpcomingUnit {
  key: string;
  kind: "message" | "choice";
  speaker: string;
  text: string;
  optionLabels?: string[];
}

export interface CharacterView {
  slot: string;
  id: string;
  name: string;
  face: number;
  position: CharacterPosition;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  silhouette: boolean;
  shadow: boolean;
  active: boolean;
}

export interface StageLayerView {
  slot: string;
  id: string;
  source: "background" | "image";
  position: CharacterPosition;
  x: number;
  y: number;
  scale: number;
  layer: "main" | "sub";
  depth: number | null;
}

export interface MessageSnapshot {
  key: string;
  speaker: string;
  lines: MessageLineView[];
  revealed: number;
  total: number;
  complete: boolean;
  align: "left" | "center" | "right";
}

export interface ChoiceSnapshot {
  key: string;
  options: Array<{ label: string }>;
  selected: number | null;
}

export interface StageSnapshot {
  version: number;
  phase: ExecutorPhase;
  background: {
    id: string | null;
    previousId: string | null;
    crossfade: number;
    seq: number;
    transition: "fade" | "wipe" | "none";
  };
  characters: CharacterView[];
  stageLayers: StageLayerView[];
  camera: StoryCameraState;
  blur: number | null;
  screenEffect: string | null;
  screenEffectSeq: number;
  pictureFrame: string | null;
  movie: string | null;
  fade: { seq: number; color: string | null; alpha: number };
  wipe: { seq: number; kind: string; color: string | null };
  flash: { seq: number; color: string | null };
  shake: { seq: number };
  /** What the executor is waiting on, when suspended (null otherwise). */
  waitKind: "input" | "timer" | "completion" | "choice" | null;
  message: MessageSnapshot | null;
  choice: ChoiceSnapshot | null;
  log: LogEntry[];
  bgm: { name: string; volume: number | null } | null;
  /** Cursor position — the persisted progress unit (docs §7 进度=指令索引). */
  position: number;
  /** Completed readable messages; the denominator is the message catalog. */
  messageOrdinal: number;
  messageTotal: number;
  /** User-input boundaries passed (back navigation depth). */
  boundaryCount: number;
}

export interface ExecutorOptions {
  masterName: string;
  masterGender: "male" | "female";
  /** Typing speed in milliseconds per character. */
  textSpeedMs: number;
  /** Opens messages fully revealed from the first frame (reduce-motion). */
  reduceMotion?: boolean;
}

export interface ExecutorStartOptions {
  /** Instruction index to fast-forward to (persisted progress, docs §7). */
  startIndex?: number;
  /** Decisions replayed when choices are hit during fast-forward. */
  choiceTrail?: ChoiceDecision[];
  startMode?: StartModeValue;
}

interface WaitState {
  kind: "input" | "timer" | "completion" | "choice";
  /** Remaining timer wait in ms (timer waits only). */
  remainingMs: number | null;
  /** The completion-flag family, e.g. "fade" ([wait fade]). */
  completionType?: string;
}

const MAX_WAIT_MS = 120_000;
/** Guards against scripts with self-jumping control flow hanging the reader. */
const MAX_BURST_STEPS = 100_000;

export class ScriptExecutor {
  private readonly program: ScriptProgram;
  private readonly options: ExecutorOptions;
  private readonly messageTextByKey = new Map<string, string>();

  readonly stage = new Stage();
  readonly tweens = new TweenService();
  private readonly messageWindow = new MessageWindow();

  private state: string = ExecutorState.Idle;
  private phase: ExecutorPhase = "idle";
  private cursor = 0;
  private wait: WaitState | null = null;
  private flags = new Map<string, boolean>();
  private switchSelections = new Map<number, number>();
  private decisions: ChoiceDecision[] = [];
  private decisionIndex = 0;
  private restoredTrail: ChoiceDecision[] = [];
  private log: LogEntry[] = [];
  /** Instruction indexes of user-input boundaries (messages + choices). */
  private boundaries: number[] = [];
  private currentSpeaker = { name: "", slots: [] as string[] };
  private fastForwarding = false;
  /** Global animation clock multiplier (reduce-motion compresses waits). */
  private timeScale = 1;
  /** Reduce-motion opens messages fully revealed (old reader pacing). */
  private reduceMotion = false;
  private dirty = true;
  private snapshotCache: StageSnapshot | null = null;
  private listeners = new Set<() => void>();
  private changeVersion = 0;
  /** S-A audio intents emitted by commands; ReaderView bridges to elements. */
  onAudioIntent: ((intent: AudioIntent) => void) | null = null;

  constructor(program: ScriptProgram, options: ExecutorOptions) {
    this.program = program;
    this.options = options;
    this.reduceMotion = options.reduceMotion ?? false;
    this.messageWindow.baseStepMs = Math.max(4, options.textSpeedMs);
    for (const record of program.messageCatalog) {
      this.messageTextByKey.set(record.key, record.text);
    }
  }

  // ---------------------------------------------------------------- lifecycle

  /** Resets execution and fast-forwards to the requested start position. */
  start(options: ExecutorStartOptions = {}): void {
    this.decisions = [...(options.choiceTrail ?? [])];
    this.restoredTrail = [...(options.choiceTrail ?? [])];
    this.decisionIndex = 0;
    const target = Math.max(
      0,
      Math.min(options.startIndex ?? 0, this.program.instructions.length),
    );
    if (target > 0) {
      this.fastForwardTo(target);
      return;
    }
    this.resetState();
    this.state = ExecutorState.Execute;
    this.applyStartMode(options.startMode ?? StartMode.None);
    this.runBurst();
  }

  private resetState(): void {
    this.tweens.clear();
    this.stage.characters.clear();
    this.stage.layers.clear();
    this.stage.camera = { x: 0, y: 0, scale: 1, rotation: 0, filter: null };
    this.stage.background = {
      current: null,
      previous: null,
      crossfade: 1,
      crossfadeDuration: 0,
      seq: 0,
      transition: "none",
    };
    this.stage.messageVisible = true;
    this.stage.subRenderVisible = false;
    this.stage.talkSlots = [];
    this.stage.blur = null;
    this.stage.setScreenEffect(null);
    this.stage.pictureFrame = null;
    this.stage.movie = null;
    this.stage.fade = { color: null, alpha: 0, seq: 0, direction: "in", duration: 0.5 };
    this.stage.wipe = { color: null, seq: 0, kind: "in", duration: 0.5 };
    this.stage.flash = { color: null, seq: 0, duration: 0.3 };
    this.stage.shake = { seq: 0, amplitudeX: 0, amplitudeY: 0, cycle: 0, duration: 0 };
    this.stage.setBgm(null, null);
    this.messageWindow.close();
    this.cursor = 0;
    this.wait = null;
    this.flags.clear();
    this.switchSelections.clear();
    this.log = [];
    this.boundaries = [];
    this.currentSpeaker = { name: "", slots: [] };
    this.fastForwarding = false;
    this.markDirty();
  }

  /** S-E5: initial screen state before the script's own fades run. */
  private applyStartMode(mode: StartModeValue): void {
    switch (mode) {
      case StartMode.ClearBlack:
      case StartMode.ClearWhite: {
        const color = mode === StartMode.ClearBlack ? "#000" : "#fff";
        this.stage.fade = {
          color,
          alpha: 1,
          seq: this.stage.fade.seq + 1,
          direction: "out",
          duration: 1,
        };
        this.tweens.add({
          owner: "fade",
          duration: 1,
          onUpdate: (t) => {
            this.stage.fade.alpha = 1 - t;
            this.markDirty();
          },
        });
        this.markDirty();
        break;
      }
      case StartMode.Black:
      case StartMode.White: {
        const color = mode === StartMode.Black ? "#000" : "#fff";
        this.stage.fade = {
          color,
          alpha: 1,
          seq: this.stage.fade.seq + 1,
          direction: "out",
          duration: 0.5,
        };
        this.markDirty();
        break;
      }
      default:
        break;
    }
  }

  // ------------------------------------------------------------------ driving

  /**
   * Advances the executor by dtMs: tweens progress, the typewriter reveals,
   * timer waits elapse, and — when nothing blocks — the instruction loop runs.
   */
  tick(dtMs: number): void {
    if (this.phase === "ended" || this.phase === "idle") return;
    const scaledMs = Math.max(0, dtMs) * this.timeScale;
    const dtSeconds = scaledMs / 1000;
    if (this.tweens.isAnyActive()) {
      this.tweens.update(dtSeconds);
      this.markDirty();
    }
    if (this.phase === "message") {
      if (this.messageWindow.tick(dtMs)) this.markDirty();
      return;
    }
    if (this.phase === "wait" && this.wait?.kind === "timer") {
      const remaining = (this.wait.remainingMs ?? 0) - scaledMs;
      if (remaining <= 0) {
        this.wait = null;
        this.runBurst();
      } else {
        this.wait.remainingMs = remaining;
      }
      return;
    }
    // [wait fade] releases itself once the fade family finishes (S-E3).
    if (this.phase === "wait" && this.wait?.kind === "completion") {
      if (!this.isCompletionBusy(this.wait.completionType ?? "")) {
        this.wait = null;
        this.runBurst();
      }
    }
  }

  /**
   * Player input: completes the typewriter first, then releases the current
   * wait. During waits it interrupts timers/completion flags (reader behavior).
   */
  tap(): void {
    if (this.phase === "message") {
      if (!this.messageWindow.complete) {
        this.messageWindow.revealAll();
        this.markDirty();
        return;
      }
      this.releaseWaitAndContinue();
      return;
    }
    if (this.phase === "wait") {
      this.releaseWaitAndContinue();
    }
  }

  /** Selects the option of the blocking choice instruction. */
  selectChoice(optionIndex: number): void {
    if (this.phase !== "choice") return;
    const instruction = this.program.instructions[this.cursor];
    if (instruction?.tag !== "choice") return;
    const option = instruction.options?.[optionIndex];
    if (!option) return;
    this.recordDecision({ choiceId: instruction.choiceKey ?? "", optionIndex });
    this.switchSelections.set(instruction.line, optionIndex);
    // The boundary trail needs the choice even when selectChoice jumps
    // straight into the body (restore path skips executeInstruction).
    if (this.boundaries.at(-1) !== this.cursor) this.boundaries.push(this.cursor);
    this.cursor = option.bodyIndex;
    this.phase = "wait";
    this.wait = null;
    this.markDirty();
    this.runBurst();
  }

  /**
   * Re-runs the script from the beginning and stops at `targetIndex` — the
   * resume path for persisted progress and backlog navigation (docs §7).
   * Choices along the way consume the recorded decision trail.
   */
  fastForwardTo(targetIndex: number): void {
    this.resetState();
    this.state = ExecutorState.Execute;
    // A previous run may have ended; the loop aborts on a stale ended phase.
    this.phase = "wait";
    this.fastForwarding = true;
    this.runLoop(targetIndex);
    this.fastForwarding = false;
    this.tweens.finishAll();
    this.markDirty();
  }

  /**
   * Enumerates the next readable units from the current execution state
   * without touching live presentation state — the translation prefetch
   * lookahead.
   */
  enumerateUpcomingMessages(count: number): UpcomingUnit[] {
    const control = {
      cursor: this.cursor,
      flags: new Map(this.flags),
      decisionIndex: this.decisionIndex,
      speaker: this.currentSpeaker.name || "旁白",
    };
    const collected: UpcomingUnit[] = [];
    const instructions = this.program.instructions;

    while (control.cursor < instructions.length && collected.length < count) {
      const instruction = instructions[control.cursor];
      switch (instruction.tag) {
        case "message":
          collected.push({
            key: instruction.messageKey ?? `m:${control.cursor}`,
            kind: "message",
            speaker: control.speaker,
            text: this.messageTextByKey.get(instruction.messageKey ?? "")
              ?? textOfTokens(instruction.tokens ?? []),
          });
          control.cursor += 1;
          continue;
        case "talkname":
          control.speaker = instruction.speaker?.name || "旁白";
          control.cursor += 1;
          continue;
        case "choice": {
          collected.push({
            key: instruction.choiceKey ?? `c:${control.cursor}`,
            kind: "choice",
            speaker: "CHOICE",
            text: "",
            optionLabels: (instruction.options ?? []).map((option) => option.label),
          });
          const decision = this.decisions[control.decisionIndex];
          control.decisionIndex += 1;
          const option = decision
            ? instruction.options?.[decision.optionIndex]
            : undefined;
          if (option) {
            control.cursor = option.bodyIndex;
            continue;
          }
          return collected;
        }
        case "jump":
          control.cursor = instruction.targetIndex ?? control.cursor + 1;
          continue;
        case "branch":
          control.cursor = this.evaluateBranch(instruction, control.flags)
            ? instruction.targetIndex ?? control.cursor + 1
            : control.cursor + 1;
          continue;
        case "flag":
          if (instruction.params[0]) {
            control.flags.set(instruction.params[0], instruction.params[1] === "true");
          }
          control.cursor += 1;
          continue;
        case "end":
        case "endfade":
        case "interruption":
          return collected;
        default:
          control.cursor += 1;
          continue;
      }
    }
    return collected;
  }

  // ------------------------------------------------------------------ streams

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): StageSnapshot => {
    if (!this.snapshotCache || this.dirty) {
      this.snapshotCache = this.buildSnapshot();
      this.dirty = false;
    }
    return this.snapshotCache;
  };

  /** Monotonic change counter for polling consumers. */
  get changeCount(): number {
    return this.changeVersion;
  }

  get messageCount(): number {
    return this.program.messageCatalog.length;
  }

  setTextSpeed(ms: number): void {
    this.messageWindow.baseStepMs = Math.max(4, ms);
  }

  /** Multiplies the animation clock (reduce-motion compresses waits/transitions). */
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(1, scale);
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on;
  }

  /** Decisions made (or changed) this run beyond the restored trail. */
  takeNewDecisions(): ChoiceDecision[] {
    return this.decisions.filter((decision) => {
      const restored = this.restoredTrail.find(
        (entry) => entry.choiceId === decision.choiceId,
      );
      return !restored || restored.optionIndex !== decision.optionIndex;
    });
  }

  /** The current readable step plus up to `count` upcoming ones. */
  currentTranslationSteps(count: number): TranslatableStep[] {
    const current = this.currentMessageStep();
    const upcoming = this.enumerateUpcomingMessages(count);
    return current ? [current, ...upcoming] : upcoming;
  }

  private currentMessageStep(): TranslatableStep | null {
    if (this.phase === "message" && this.messageWindow.key) {
      const key = this.messageWindow.key;
      return {
        key,
        kind: "message",
        speaker: this.messageWindow.speaker,
        text: this.messageTextByKey.get(key) ?? "",
      };
    }
    if (this.phase === "choice") {
      const instruction = this.program.instructions[this.cursor];
      if (instruction?.tag === "choice") {
        return {
          key: instruction.choiceKey ?? `c:${this.cursor}`,
          kind: "choice",
          speaker: "CHOICE",
          text: "",
          optionLabels: (instruction.options ?? []).map((option) => option.label),
        };
      }
    }
    return null;
  }

  /** Re-presents a user-input boundary (← back navigation).
   *  From the ended state, "返回最后一句" re-presents the LAST boundary;
   *  otherwise navigation steps back one boundary from the current one. */
  goBackOneBoundary(): void {
    if (this.boundaries.length === 0) return;
    const target = this.phase === "ended"
      ? this.boundaries[this.boundaries.length - 1]
      : this.boundaries[this.boundaries.length - 2];
    if (target === undefined) return;
    this.fastForwardTo(target);
  }

  /** Jumps to a specific message/choice by its stable key. */
  jumpToMessage(key: string): void {
    const index = this.getInstructionIndex(key);
    if (index !== null) this.fastForwardTo(index);
  }

  /** Instruction index of a message/choice key, for backlog jumps. */
  getInstructionIndex(key: string): number | null {
    const message = this.program.messageCatalog.find((record) => record.key === key);
    if (message) return message.instructionIndex;
    const choice = this.program.choiceCatalog.find((record) => record.key === key);
    if (choice) return choice.instructionIndex;
    return null;
  }

  private markDirty(): void {
    this.changeVersion += 1;
    this.dirty = true;
    for (const listener of this.listeners) listener();
  }

  private releaseWaitAndContinue(): void {
    this.wait = null;
    this.phase = "wait";
    this.markDirty();
    this.runBurst();
  }

  // ------------------------------------------------------------- instructions

  /**
   * S-E1: consumes instructions while they return Continue; a Normal wait
   * suspends the loop until tick/tap release it.
   */
  private runBurst(): void {
    this.runLoop(undefined);
  }

  private runLoop(stopAt: number | undefined): void {
    this.state = ExecutorState.Execute;
    const instructions = this.program.instructions;
    let steps = 0;
    while (true) {
      if (stopAt !== undefined && this.cursor >= stopAt) {
        this.enterPostFastForwardWait();
        return;
      }
      if (this.cursor >= instructions.length) {
        this.phase = "ended";
        this.state = ExecutorState.Exit;
        this.markDirty();
        return;
      }
      if (++steps > MAX_BURST_STEPS) {
        // Pathological control flow (self-jump); degrade to ended.
        this.phase = "ended";
        this.markDirty();
        return;
      }
      const instruction = instructions[this.cursor];
      const code = this.executeInstruction(instruction);
      if (this.phase === "ended") return;
      if (code === ReturnCode.Normal) return;
      // Continue: same-frame burst keeps consuming (S-E8 节奏特征).
    }
  }

  /**
   * After fast-forwarding to a stored position the executor must present the
   * message the reader stopped at, waiting for input exactly like a live run.
   */
  private enterPostFastForwardWait(): void {
    const instructions = this.program.instructions;
    const index = Math.min(this.cursor, instructions.length - 1);
    const instruction = instructions[index];
    if (instruction?.tag === "choice") {
      this.phase = "choice";
      this.markDirty();
      return;
    }
    if (instruction?.tag === "message") {
      this.restoreMessage(index);
      return;
    }
    for (let back = index; back >= 0; back -= 1) {
      if (instructions[back].tag === "message") {
        this.restoreMessage(back);
        return;
      }
    }
    this.phase = "ended";
    this.markDirty();
  }

  /** Re-presents a completed message for a boundary restore (goBack/jump). */
  private restoreMessage(messageIndex: number): void {
    const instructions = this.program.instructions;
    const talk = instructions[messageIndex - 1];
    if (talk?.tag === "talkname" && talk.speaker) {
      this.applyTalkName(talk);
    }
    const key = instructions[messageIndex].messageKey ?? `m:${messageIndex}`;
    // Resume AFTER the restored message: the next tap advances instead of
    // replaying it.
    this.cursor = messageIndex + 1;
    this.openMessage(instructions[messageIndex], true, false);
    // Keep the restored message itself navigable: without re-registering the
    // boundary, the next goBack would skip straight past it.
    if (!this.boundaries.includes(messageIndex)) {
      const insertAt = this.boundaries.findIndex((b) => b > messageIndex);
      if (insertAt === -1) this.boundaries.push(messageIndex);
      else this.boundaries.splice(insertAt, 0, messageIndex);
    }
    // A boundary restore may target a message that the fast-forward pass
    // stopped before; it must still appear in the backlog.
    if (!this.log.some((entry) => entry.key === key)) {
      this.log.push({
        key,
        speaker: this.currentSpeaker.name || "旁白",
        text: this.messageTextByKey.get(key) ?? "",
      });
    }
    this.phase = "message";
    this.wait = { kind: "input", remainingMs: null };
    this.markDirty();
  }

  private executeInstruction(instruction: Instruction): number {
    switch (instruction.tag) {
      case "label":
        this.cursor += 1;
        return ReturnCode.Continue;

      case "jump":
        this.cursor = instruction.targetIndex ?? this.cursor + 1;
        return ReturnCode.Continue;

      case "branch":
        this.cursor = this.evaluateBranch(instruction, this.flags)
          ? instruction.targetIndex ?? this.cursor + 1
          : this.cursor + 1;
        return ReturnCode.Continue;

      case "flag":
        if (instruction.params[0]) {
          this.flags.set(instruction.params[0], instruction.params[1] === "true");
        }
        this.cursor += 1;
        return ReturnCode.Continue;

      case "talkname":
        this.applyTalkName(instruction);
        this.cursor += 1;
        this.markDirty();
        return ReturnCode.Continue;

      case "message":
        if (this.boundaries.at(-1) !== this.cursor) this.boundaries.push(this.cursor);
        this.cursor += 1;
        this.openMessage(instruction, this.fastForwarding);
        if (this.fastForwarding) return ReturnCode.Continue;
        this.phase = "message";
        this.wait = { kind: "input", remainingMs: null };
        this.markDirty();
        return ReturnCode.Normal;

      case "choice":
        // The cursor stays on the choice until selectChoice rewrites it.
        if (this.boundaries.at(-1) !== this.cursor) this.boundaries.push(this.cursor);
        return this.executeChoice(instruction);

      case "wait":
      case "wt":
      case "twt":
        return this.executeWait(instruction);

      case "tdelay":
        // Delayed jumps belong to battle interruption flows the reader
        // replays linearly; treat as an instant no-op (old pipeline parity).
        this.cursor += 1;
        return ReturnCode.Continue;

      case "end":
      case "endfade":
      case "interruption":
        this.executeEnd(instruction);
        return ReturnCode.Normal;

      default:
        executeStageCommand(instruction, {
          stage: this.stage,
          masterGender: this.options.masterGender,
          masterName: this.options.masterName,
          tweens: this.tweens,
          fastForward: this.fastForwarding,
          emitAudio: (intent) => {
            if (!this.fastForwarding) this.onAudioIntent?.(intent);
          },
          onUnhandled: () => undefined,
        });
        this.cursor += 1;
        if (this.fastForwarding) this.tweens.finishAll();
        this.markDirty();
        return ReturnCode.Continue;
    }
  }

  private applyTalkName(instruction: Instruction): void {
    const speaker = instruction.speaker;
    if (!speaker) return;
    this.currentSpeaker = { name: speaker.name, slots: [] };
    const explicit = speaker.spots?.length
      ? speaker.spots
      : speaker.slot
        ? [speaker.slot]
        : [];
    if (explicit.some((slot) => this.stage.characters.has(slot))) {
      this.currentSpeaker.slots = explicit.filter((slot) => this.stage.characters.has(slot));
    }
  }

  private openMessage(instruction: Instruction, revealAll: boolean, pushLog = true): void {
    const key = instruction.messageKey ?? `m:${this.cursor}`;
    const speaker = this.currentSpeaker.name || "旁白";
    this.messageWindow.open(key, speaker, instruction.tokens ?? [], revealAll || this.reduceMotion);
    // A new dialogue reopens the window even after [messageOff] (corpus form).
    this.stage.messageVisible = true;
    if (pushLog) {
      // Backlog entries carry the full text from the moment the message
      // opens, matching the old frame-based log semantics.
      this.log.push({
        key,
        speaker,
        text: this.messageTextByKey.get(key) ?? textOfTokens(instruction.tokens ?? []),
      });
    }
    this.markDirty();
  }

  private executeChoice(instruction: Instruction): number {
    // A recorded decision auto-resolves its choice. The LATEST decision for
    // the choice wins: fast-forward traverses recorded paths, and re-choosing
    // after back navigation replaces the entry (recordDecision).
    const decision = this.latestDecisionFor(instruction.choiceKey);
    if (decision) {
      const option = instruction.options?.[decision.optionIndex];
      if (option) {
        this.switchSelections.set(instruction.line, decision.optionIndex);
        this.cursor = option.bodyIndex;
        return ReturnCode.Continue;
      }
    }
    this.phase = "choice";
    this.wait = { kind: "choice", remainingMs: null };
    this.markDirty();
    return ReturnCode.Normal;
  }

  private latestDecisionFor(choiceKey: string | undefined): ChoiceDecision | undefined {
    if (!choiceKey) return undefined;
    for (let index = this.decisions.length - 1; index >= 0; index -= 1) {
      if (this.decisions[index].choiceId === choiceKey) return this.decisions[index];
    }
    return undefined;
  }

  private executeWait(instruction: Instruction): number {
    this.cursor += 1;
    if (this.fastForwarding) {
      return ReturnCode.Continue;
    }
    const tag = instruction.tag;
    if (tag === "wt" || tag === "twt") {
      const seconds = Number.parseFloat(instruction.params[0] ?? "");
      const duration = Number.isFinite(seconds) && seconds >= 0
        ? Math.min(MAX_WAIT_MS, Math.round(seconds * 1000))
        : 0;
      if (duration <= 0) {
        return ReturnCode.Continue;
      }
      this.phase = "wait";
      this.wait = { kind: "timer", remainingMs: duration };
      this.markDirty();
      return ReturnCode.Normal;
    }
    // [wait type…] — completion-flag waits (S-E3). Only families with tracked
    // in-flight state block; unknown types fall through like the engine when
    // their completion flag is already clear.
    const type = instruction.params[0]?.toLowerCase() ?? "";
    if (this.isCompletionBusy(type)) {
      this.phase = "wait";
      this.wait = { kind: "completion", remainingMs: null, completionType: "fade" };
      this.markDirty();
      return ReturnCode.Normal;
    }
    return ReturnCode.Continue;
  }

  private isCompletionBusy(type: string): boolean {
    return type === "fade"
      && (this.tweens.isActive("fade") || this.tweens.isActive("sceneCrossfade"));
  }

  private executeEnd(instruction: Instruction): void {
    if (instruction.tag === "endfade" && instruction.params[0] && !this.fastForwarding) {
      const color = instruction.params[0];
      const cssColor = color.startsWith("#")
        ? color
        : color === "black"
          ? "#000"
          : color === "white"
            ? "#fff"
            : `#${color}`;
      this.stage.requestFade({
        color: cssColor,
        direction: "out",
        duration: 0.5,
      });
      const from = this.stage.fade.alpha;
      this.tweens.add({
        owner: "fade",
        duration: 0.5,
        onUpdate: (t) => {
          this.stage.fade.alpha = from + (1 - from) * t;
          this.markDirty();
        },
      });
    }
    this.phase = "ended";
    this.state = ExecutorState.Exit;
    this.markDirty();
  }

  private evaluateBranch(
    instruction: Instruction,
    flags: Map<string, boolean>,
  ): boolean {
    const condition = instruction.branch;
    if (!condition) return true;
    switch (condition.kind) {
      case "always":
        return true;
      case "flag":
        return (flags.get(condition.name) ?? false) === condition.value;
      case "questClear":
        // The reader assumes a first-read experience: quest-gated content
        // follows the not-clear path.
        return false;
      case "questNotClear":
        return true;
      case "routeSelect":
        // Route selections persist through the choice trail, not the flag
        // table; the not-selected path is the safe default.
        return condition.inverted;
      default:
        return false;
    }
  }

  private recordDecision(decision: ChoiceDecision): void {
    // Re-choosing after back navigation replaces the earlier decision.
    const existing = this.decisions.findIndex(
      (entry) => entry.choiceId === decision.choiceId,
    );
    if (existing >= 0) this.decisions[existing] = decision;
    else this.decisions.push(decision);
    this.decisionIndex = this.decisions.length;
  }

  // ---------------------------------------------------------------- rendering

  private buildSnapshot(): StageSnapshot {
    const stage = this.stage;
    const messageSnapshot = this.phase === "message"
      ? this.buildMessageSnapshot()
      : null;

    return {
      version: this.changeVersion,
      phase: this.phase,
      background: {
        id: stage.background.current,
        previousId: stage.background.previous,
        crossfade: stage.background.crossfade,
        seq: stage.background.seq,
        transition: stage.background.transition,
      },
      characters: this.visibleCharacters().map((character) => ({
        slot: character.slot,
        id: character.id,
        name: character.name,
        face: character.face,
        position: character.position,
        x: character.x,
        y: character.y,
        scale: character.scale,
        rotation: character.rotation,
        silhouette: character.silhouette,
        shadow: character.shadow,
        active: this.activeSlots().has(character.slot),
      })),
      stageLayers: this.visibleLayers(),
      camera: { ...stage.camera },
      blur: stage.blur,
      screenEffect: stage.screenEffect.effectName,
      screenEffectSeq: stage.screenEffect.overlaySeq,
      pictureFrame: stage.pictureFrame,
      movie: stage.movie,
      fade: { seq: stage.fade.seq, color: stage.fade.color, alpha: stage.fade.alpha },
      wipe: { seq: stage.wipe.seq, kind: stage.wipe.kind, color: stage.wipe.color },
      flash: { seq: stage.flash.seq, color: stage.flash.color },
      shake: { seq: stage.shake.seq },
      waitKind: this.wait?.kind ?? null,
      message: messageSnapshot,
      choice: this.phase === "choice" ? this.buildChoiceSnapshot() : null,
      log: this.log,
      bgm: stage.audio.bgm
        ? { name: stage.audio.bgm, volume: stage.audio.bgmVolume }
        : null,
      /** Restore anchor: the message/choice instruction while suspended. */
      position: this.phase === "message" ? Math.max(0, this.cursor - 1) : this.cursor,
      messageOrdinal: this.log.length,
      messageTotal: this.program.messageCatalog.length,
      boundaryCount: this.boundaries.length,
    };
  }

  private buildMessageSnapshot(): MessageSnapshot | null {
    const window = this.messageWindow;
    if (!window.key) return null;
    return {
      key: window.key,
      speaker: window.speaker,
      lines: sliceMessageLines(window.layout, window.revealed),
      revealed: window.revealed,
      total: window.textLength,
      complete: window.complete,
      align: window.layout.align,
    };
  }

  private buildChoiceSnapshot(): ChoiceSnapshot | null {
    const instruction = this.program.instructions[this.cursor];
    if (instruction?.tag !== "choice") return null;
    const decision = this.decisions[this.decisionIndex];
    return {
      key: instruction.choiceKey ?? `c:${this.cursor}`,
      options: (instruction.options ?? []).map((option) => ({ label: option.label })),
      selected: decision && decision.choiceId === instruction.choiceKey
        ? decision.optionIndex
        : null,
    };
  }

  /**
   * Speaker highlight resolution: explicit ＠ slots win, then [charaTalk]
   * slots, then a unique display-name match (old snapshotCharacters order).
   */
  private activeSlots(): Set<string> {
    const explicit = this.currentSpeaker.slots;
    if (explicit.length) return new Set(explicit);
    const talkSlots = this.stage.talkSlots.filter((slot) => this.stage.characters.has(slot));
    if (talkSlots.length) return new Set(talkSlots);
    const named = [...this.stage.characters.values()]
      .filter((character) => character.name === this.currentSpeaker.name);
    return named.length === 1 ? new Set([named[0].slot]) : new Set();
  }

  private occludingDepth(): number | null {
    const depths: number[] = [];
    for (const layer of this.stage.layers.values()) {
      if (layer.visible && layer.onStage && layer.layer === "main" && layer.depth !== null) {
        depths.push(layer.depth);
      }
    }
    return depths.length ? Math.max(...depths) : null;
  }

  private visibleCharacters(): CharacterSlotState[] {
    const occluding = this.occludingDepth();
    const result: CharacterSlotState[] = [];
    for (const character of this.stage.characters.values()) {
      if (!character.visible || !character.onStage || character.effectOnly) continue;
      if (character.layer === "sub") {
        if (!this.stage.subRenderVisible) continue;
      } else if (occluding !== null && (character.depth ?? 0) <= occluding) {
        continue;
      }
      result.push(character);
    }
    return result;
  }

  private visibleLayers(): StageLayerSlotState[] {
    const result: StageLayerSlotState[] = [];
    for (const layer of this.stage.layers.values()) {
      if (!layer.visible || !layer.onStage) continue;
      if (layer.layer === "sub" && !this.stage.subRenderVisible) continue;
      result.push(layer);
    }
    return result;
  }
}

function textOfTokens(tokens: MessageToken[]): string {
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
      default:
        break;
    }
  }
  return output;
}

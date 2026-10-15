import type { MessageToken } from "./instruction";

export interface MessageSpanView {
  text: string;
  color: string | null;
  ruby: string | null;
  emphasis?: boolean;
  fontSize?: number;
  verticalAlign?: "top" | "center" | "bottom";
  image?: { name: string; alt: string; icon: boolean; scale?: number };
}
export interface MessageLineView { spans: MessageSpanView[]; align: "left" | "center" | "right" }
export interface MessageChar extends MessageSpanView { char: string; align: MessageLineView["align"]; run: number }
export interface MessageLayout {
  chars: MessageChar[];
  events: Array<{ offset: number; token: MessageToken }>;
  align: MessageLineView["align"];
}

export function flattenTokens(tokens: readonly MessageToken[]): MessageLayout {
  const chars: MessageChar[] = [], events: MessageLayout["events"] = [];
  let color: string | null = null, align: MessageLineView["align"] = "left", fontSize = 29, verticalAlign: MessageSpanView["verticalAlign"] = undefined, run = 0;
  const add = (value: string, style: Partial<MessageChar> = {}) => {
    run++;
    for (const char of Array.from(value)) chars.push({ char, text: char, color, ruby: null, align, fontSize, verticalAlign, run, ...style });
  };
  for (const token of tokens) {
    switch (token.type) {
      case "text": add(token.value); break;
      case "emphasis": add(token.value, { emphasis: true }); break;
      case "ruby": add(token.base, { ruby: token.ruby }); break;
      case "newline": add("\n"); break;
      case "line": add("—".repeat(token.length)); break;
      case "image": add("\uFFFC", { image: { name: token.name, alt: token.alt, icon: token.icon, scale: token.scale } }); break;
      case "color": color = token.color; break;
      case "align": align = token.align; break;
      case "font": fontSize = token.size; verticalAlign = token.verticalAlign; break;
      default: events.push({ offset: chars.length, token });
    }
  }
  return { chars, events, align };
}
export function plainLength(layout: MessageLayout): number { return layout.chars.length; }

export function sliceMessageLines(layout: MessageLayout, revealed: number): MessageLineView[] {
  const lines: MessageLineView[] = [];
  let line: MessageLineView = { spans: [], align: layout.chars[0]?.align ?? layout.align };
  let span: MessageSpanView | null = null, run = -1;
  for (const char of layout.chars.slice(0, revealed)) {
    if (char.char === "\n") { lines.push(line); line = { spans: [], align: char.align }; span = null; continue; }
    line.align = char.align;
    if (!span || run !== char.run) {
      span = { text: char.image ? char.image.alt : char.char, color: char.color, ruby: char.ruby, emphasis: char.emphasis, fontSize: char.fontSize, verticalAlign: char.verticalAlign, image: char.image };
      line.spans.push(span); run = char.run;
    } else span.text += char.char;
  }
  lines.push(line);
  return lines;
}

/** Typewriter events execute at their authored glyph offset, never at open(). */
export class MessageWindow {
  key = "";
  speaker = "";
  tokens: MessageToken[] = [];
  layout: MessageLayout = { chars: [], events: [], align: "left" };
  revealed = 0;
  textSpeedMs = 28;
  forcedNormal = false;
  private eventIndex = 0;
  private typingElapsed = 0;
  private overrideSpeed: number | null = null;
  private defaultSpeed: number | null = null;
  private pause: { remaining: number; clock: "game" | "real" } | null = null;
  private revealRequested = false;
  private commandPaused = false;
  get complete(): boolean { return this.revealed >= this.layout.chars.length && this.eventIndex >= this.layout.events.length && !this.pause && !this.commandPaused; }
  get textLength(): number { return this.layout.chars.length; }
  get waiting(): boolean { return !!this.pause; }
  open(key: string, speaker: string, tokens: MessageToken[], revealAll = false): void {
    this.close(); this.key = key; this.speaker = speaker; this.tokens = [...tokens];
    this.layout = flattenTokens(this.tokens); this.revealRequested = revealAll; this.overrideSpeed = this.defaultSpeed;
  }
  append(tokens: MessageToken[]): void {
    this.tokens.push(...tokens); this.layout = flattenTokens(this.tokens);
  }
  close(): void {
    this.key = ""; this.speaker = ""; this.tokens = []; this.layout = { chars: [], events: [], align: "left" };
    this.revealed = 0; this.eventIndex = 0; this.typingElapsed = 0; this.overrideSpeed = null; this.pause = null; this.revealRequested = false; this.commandPaused = false;
  }
  revealAll(): void { this.revealRequested = true; }
  applySpeedToken(value: number | null): void { this.overrideSpeed = value; }
  setDefaultSpeed(value: number | null): void { this.defaultSpeed = value; this.overrideSpeed = value; }
  resumeCommands(): void { this.commandPaused = false; }
  tick(gameMs: number, realMs = gameMs, handle: (token: MessageToken) => boolean | void = () => undefined, replay = false): boolean {
    if (this.commandPaused && !replay) return false;
    const before = `${this.revealed}:${this.eventIndex}:${this.pause?.remaining}`;
    let game = Math.max(0, gameMs), real = Math.max(0, realMs);
    const ratio = realMs > 0 ? gameMs / realMs : 0;
    for (let steps = 0; steps < 100_000 && !this.complete; steps++) {
      if (this.pause) {
        const budget = this.pause.clock === "real" ? real : game;
        const used = replay ? this.pause.remaining : Math.min(budget, this.pause.remaining);
        this.pause.remaining -= used;
        if (this.pause.clock === "real") { real = Math.max(0, real - used); game = Math.max(0, game - used * ratio); }
        else { game = Math.max(0, game - used); real = Math.max(0, real - (ratio ? used / ratio : 0)); }
        if (this.pause.remaining > 0) break;
        this.pause = null;
      }
      const event = this.layout.events[this.eventIndex];
      if (event && event.offset <= this.revealed) {
        this.eventIndex++;
        if (event.token.type === "wait") this.pause = { remaining: event.token.seconds * 1000, clock: event.token.clock };
        else if (event.token.type === "speed") this.overrideSpeed = event.token.charsPerSecond;
        else if (handle(event.token) === true && !replay) { this.commandPaused = true; break; }
        continue;
      }
      if (this.revealed >= this.layout.chars.length) break;
      const delay = this.forcedNormal ? 28 : this.overrideSpeed === null ? this.textSpeedMs : this.overrideSpeed > 0 ? 1000 / this.overrideSpeed : 0;
      if (!this.revealRequested && !replay && delay > 0) {
        const used = Math.min(game, delay - this.typingElapsed);
        this.typingElapsed += used; game -= used; real = Math.max(0, real - (ratio ? used / ratio : 0));
        if (this.typingElapsed < delay) break;
      }
      this.typingElapsed = 0; this.revealed++;
    }
    return before !== `${this.revealed}:${this.eventIndex}:${this.pause?.remaining}`;
  }
}

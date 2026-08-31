import type { MessageToken } from "./instruction";

/**
 * Message window state machine (docs/FGO_Story_Reader_Standard.md S-R7 /
 * S-R9.9). The message token stream flattens into per-character runs so the
 * typewriter reveal can step char by char while colors and ruby stay attached.
 */

export interface MessageChar {
  char: string;
  color: string | null;
  /** Ruby annotation attached to this base character, when present. */
  ruby: string | null;
}

export interface MessageLayout {
  chars: MessageChar[];
  align: "left" | "center" | "right";
}

export interface MessageSpanView {
  text: string;
  color: string | null;
  /** Ruby annotation for the run (single ruby runs only, renderer merges). */
  ruby: string | null;
}

export interface MessageLineView {
  spans: MessageSpanView[];
  align: "left" | "center" | "right";
}

const LONG_PAUSE_CHARS = /[。！？!?]/;
const SHORT_PAUSE_CHARS = /[，、；,;]/;

export function flattenTokens(tokens: MessageToken[]): MessageLayout {
  const chars: MessageChar[] = [];
  let color: string | null = null;
  let align: MessageLayout["align"] = "left";

  for (const token of tokens) {
    switch (token.type) {
      case "text":
        for (const char of Array.from(token.value)) {
          chars.push({ char, color, ruby: null });
        }
        break;
      case "newline":
        chars.push({ char: "\n", color: null, ruby: null });
        break;
      case "ruby":
        for (const char of Array.from(token.base)) {
          chars.push({ char, color, ruby: token.ruby || null });
        }
        break;
      case "line":
        for (let index = 0; index < token.length; index += 1) {
          chars.push({ char: "—", color, ruby: null });
        }
        break;
      case "color":
        color = token.color;
        break;
      case "align":
        align = token.align;
        break;
      case "speed":
        break;
    }
  }

  return { chars, align };
}

export function plainLength(layout: MessageLayout): number {
  return layout.chars.length;
}

/** Groups revealed characters into styled spans and lines for rendering. */
export function sliceMessageLines(
  layout: MessageLayout,
  revealed: number,
): MessageLineView[] {
  const lines: MessageLineView[] = [];
  let current: MessageLineView = { spans: [], align: layout.align };
  let span: MessageSpanView | null = null;

  const pushSpan = () => {
    if (span && span.text) current.spans.push(span);
    span = null;
  };

  const total = Math.min(revealed, layout.chars.length);
  for (let index = 0; index < total; index += 1) {
    const char = layout.chars[index];
    if (char.char === "\n") {
      pushSpan();
      lines.push(current);
      current = { spans: [], align: layout.align };
      continue;
    }
    if (
      !span
      || span.color !== char.color
      || span.ruby !== char.ruby
    ) {
      pushSpan();
      span = { text: char.char, color: char.color, ruby: char.ruby };
    } else {
      span.text += char.char;
    }
  }
  pushSpan();
  lines.push(current);
  return lines;
}

/** Extra dwell after punctuation, mirroring the previous reader behavior. */
export function punctuationDelayMs(char: string | undefined): number {
  if (!char) return 0;
  if (LONG_PAUSE_CHARS.test(char)) return 125;
  if (SHORT_PAUSE_CHARS.test(char)) return 55;
  return 0;
}

/**
 * Typewriter pacing: the delay before the NEXT character appears depends on
 * the character just revealed.
 */
export class MessageWindow {
  key: string | null = null;
  speaker = "";
  layout: MessageLayout = { chars: [], align: "left" };
  revealed = 0;
  /** Seconds per character from reader settings (textSpeed ms). */
  baseStepMs = 28;
  /** `[s N]` overrides the step time for the current message. */
  stepOverrideMs: number | null = null;
  private accumulated = 0;

  get complete(): boolean {
    return this.revealed >= this.layout.chars.length;
  }

  get textLength(): number {
    return this.layout.chars.length;
  }

  /** Starts a new message; `revealAll` is used by skip/fast-forward paths. */
  open(key: string, speaker: string, tokens: MessageToken[], revealAll: boolean): void {
    this.key = key;
    this.speaker = speaker;
    this.layout = flattenTokens(tokens);
    this.revealed = revealAll ? this.layout.chars.length : 0;
    this.stepOverrideMs = null;
    this.accumulated = 0;
  }

  close(): void {
    this.key = null;
    this.speaker = "";
    this.layout = { chars: [], align: "left" };
    this.revealed = 0;
    this.stepOverrideMs = null;
    this.accumulated = 0;
  }

  revealAll(): void {
    this.revealed = this.layout.chars.length;
    this.accumulated = 0;
  }

  applySpeedToken(charsPerSecond: number): void {
    if (charsPerSecond > 0) {
      this.stepOverrideMs = Math.max(8, Math.round(1000 / charsPerSecond));
    }
  }

  private stepDelayMs(): number {
    const base = this.stepOverrideMs ?? this.baseStepMs;
    const previous = this.layout.chars[this.revealed - 1]?.char;
    return base + punctuationDelayMs(previous);
  }

  /** Advances the typewriter by dtMs; returns true when the reveal changed. */
  tick(dtMs: number): boolean {
    if (this.complete) return false;
    const before = this.revealed;
    this.accumulated += Math.max(0, dtMs);
    while (!this.complete && this.accumulated >= this.stepDelayMs()) {
      this.accumulated -= this.stepDelayMs();
      this.revealed += 1;
    }
    return this.revealed !== before;
  }
}

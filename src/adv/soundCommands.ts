import type { Instruction } from "./instruction";
import type { CommandContext } from "./commands";
import { numeric as n, seconds as sec, unquote } from "./motion";

/** CRI cues share the same channels, matching keys, fades and continuation pool. */
export function executeSoundCommand(ins: Instruction, ctx: CommandContext): boolean {
  const { tag } = ins, p = ins.params.map(unquote), state = ctx.stage.audio;
  if (tag === "keepSubBgmOn" || tag === "keepSubBgmOff") { state.keepSubBgm = Math.max(0, state.keepSubBgm + (tag.endsWith("On") ? 1 : -1)); return true; }
  if (tag === "bgm" || tag === "subBgm") {
    const volume = p.length >= 3 ? n(p[2], 1) : n(p[1], 1), fade = p.length >= 3 ? sec(p[1], 0) : 0;
    if (tag === "bgm") { state.bgm = p[0] ?? null; state.bgmVolume = p.length > 1 ? volume : null; state.fade = fade; ctx.stage.touch(); }
    else ctx.emitAudio({ kind: "play", channel: "subBgm", name: p[0], volume, fadeIn: fade, loop: true });
    return true;
  }
  if (/^(?:bgmStop|bgmStopEnd|subBgmStop)$/.test(tag)) {
    if (tag === "subBgmStop") { if (!state.keepSubBgm) ctx.emitAudio({ kind: "stop", channel: "subBgm", fadeOut: sec(p[0], 0) }); }
    else if (tag === "bgmStopEnd") { state.fade = sec(p[0], 0); ctx.stage.audioStopAtEnd = true; }
    else { state.bgm = null; state.fade = sec(p[0], 0); ctx.stage.touch(); }
    return true;
  }
  if (tag.startsWith("soundStopAll")) {
    if (tag.endsWith("End")) { ctx.stage.audioStopAtEnd = true; for (const channel of ["se", "voice", "jingle", "subBgm"] as const) if (channel !== "subBgm" || !state.keepSubBgm) ctx.emitAudio({ kind: "stop", channel, atEnd: true, fadeOut: sec(p[0], 0) }); }
    else { state.bgm = null; state.fade = sec(p[0], 0); ctx.emitAudio({ kind: "stopAll", fadeOut: sec(p[0], 0), keepSubBgm: state.keepSubBgm > 0 }); ctx.stage.touch(); }
    return true;
  }
  const match = /^(cueSe|se|cueVoice|voice|tVoice|tVoiceUser|jingle)(Loop|ContinueVolume|ContinueStop|Continue|Stop|Volume)?$/.exec(tag);
  if (!match) return false;
  const family = match[1], action = match[2] ?? "", cue = family.startsWith("cue"), se = /[sS]e$/.test(family), channel = family === "jingle" ? "jingle" : se ? "se" : "voice";
  if (action === "Stop" || action === "ContinueStop") {
    ctx.emitAudio({ kind: "stop", channel, name: p[0], fadeOut: sec(p[1], 0), continueOnly: action === "ContinueStop", ...(action === "ContinueStop" && p[2] !== undefined ? { continueId: n(p[2]) } : {}) });
  } else if (action === "Volume" || action === "ContinueVolume") {
    ctx.emitAudio({ kind: "volume", channel, name: p[0], duration: sec(p[1], 0), volume: n(p[2], 1), continueOnly: action === "ContinueVolume", ...(action === "ContinueVolume" && p[3] !== undefined ? { continueId: n(p[3]) } : {}) });
  } else {
    const continuation = action === "Continue", offset = cue ? 1 : 0, args = p.slice(offset + 1, continuation ? -1 : undefined);
    const volume = args.length >= 2 ? n(args[1], 1) : n(args[0], 1), fade = args.length >= 2 ? sec(args[0], 0) : 0;
    if (!p[offset]) { ctx.diagnose(tag, "parameter error"); return true; }
    ctx.emitAudio({ kind: "play", channel, name: p[offset], ...(cue ? { sheet: p[0] } : {}), ...(continuation ? { continueId: n(p.at(-1)) } : {}), loop: action === "Loop", volume, fadeIn: fade });
  }
  return true;
}

import type { Region } from "../types";
import { TweenService, lerp } from "./tween";

export type AudioChannel = "subBgm" | "se" | "voice" | "jingle";
export type AudioIntent =
  | { kind: "play"; channel: AudioChannel; name: string; sheet?: string; continueId?: number; loop?: boolean; volume?: number; fadeIn?: number }
  | { kind: "stop"; channel: AudioChannel; name?: string; continueId?: number; continueOnly?: boolean; fadeOut?: number; atEnd?: boolean }
  | { kind: "volume"; channel: AudioChannel; name?: string; continueId?: number; continueOnly?: boolean; volume: number; duration?: number }
  | { kind: "stopAll"; fadeOut?: number; preserveContinue?: boolean; keepSubBgm?: boolean }
  | { kind: "scriptEnd" };
export type AudioAssetResolver = (region: Region, channel: AudioChannel, name: string) => string | null;
interface PlayingEntry { id: number; name: string; element: HTMLAudioElement; volume: number; continueId?: number; stopAtEnd?: boolean; stopFade?: number }
export class AudioContinuationPool {
  enabled = true;
  unlocked = false;
  muted = false;
  entries: PlayingEntry[] = [];
  clear(): void { for (const entry of this.entries) { entry.element.pause(); entry.element.onended = entry.element.onerror = null; } this.entries = []; }
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Audio waits observe real element lifecycle; no synthetic fixed sound lengths. */
export class AudioChannels {
  private playing = new Map<AudioChannel, PlayingEntry[]>();
  private currentEntries = new Map<AudioChannel, PlayingEntry | null>();
  private fades = new TweenService();
  private unlocked = false;
  private muted = false;
  private baseVolume = 1;
  private sequence = 0;
  private pausedChannels = new Set<AudioChannel>();
  constructor(private readonly region: Region, private readonly resolve: AudioAssetResolver = () => null, private readonly diagnostic: (name: string) => void = () => undefined) {}
  restoreContinuations(pool: AudioContinuationPool): void {
    for (const entry of pool.entries.splice(0)) {
      entry.id = ++this.sequence;
      const entries = this.playing.get("se") ?? []; entries.push(entry); this.playing.set("se", entries);
      entry.element.onended = () => this.remove(entry);
      entry.element.onerror = () => { this.diagnostic(entry.name); this.remove(entry); };
      this.applyVolume(entry);
    }
  }
  saveContinuations(pool: AudioContinuationPool): void {
    pool.clear();
    if (!pool.enabled) return;
    pool.unlocked = this.unlocked; pool.muted = this.muted;
    for (const entry of this.playing.get("se") ?? []) if (entry.continueId !== undefined && !entry.element.ended) {
      this.fades.cancel(`audio:${entry.id}`); pool.entries.push(entry);
    }
    this.playing.set("se", (this.playing.get("se") ?? []).filter(entry => !pool.entries.includes(entry)));
  }
  setPaused(channels: ReadonlySet<AudioChannel>): void {
    this.pausedChannels = new Set(channels);
    for (const [channel, entries] of this.playing) for (const entry of entries) {
      if (channels.has(channel)) entry.element.pause();
      else if (this.unlocked) void entry.element.play().catch(() => this.remove(entry));
    }
  }
  setUnlocked(value: boolean): void {
    this.unlocked = value;
    for (const [channel, entries] of this.playing) for (const entry of entries) {
      if (value && !this.pausedChannels.has(channel)) void entry.element.play().catch(() => this.remove(entry));
      else entry.element.pause();
    }
  }
  setMuted(value: boolean): void { this.muted = value; this.applyVolumes(); }
  setBaseVolume(value: number): void { this.baseVolume = clamp(value); this.applyVolumes(); }
  tick(gameMs: number, realMs = gameMs): void { this.fades.update(gameMs / 1000, realMs / 1000); }
  isBusy(channel: AudioChannel, name?: string): boolean {
    return (this.playing.get(channel) ?? []).some((entry) => (name === undefined || entry.name === name) && !entry.element.ended);
  }
  isScriptBusy(channel: AudioChannel, name?: string): boolean {
    if (name) return (this.playing.get(channel) ?? []).some(entry => entry.continueId === undefined && entry.name === name && !entry.element.ended);
    const entry = this.currentEntries.get(channel);
    return !!entry && !entry.element.ended;
  }
  handle(intent: AudioIntent): void {
    if (intent.kind === "stopAll") {
      for (const [channel, entries] of this.playing) for (const entry of [...entries]) {
        if (intent.keepSubBgm && channel === "subBgm" || intent.preserveContinue && entry.continueId !== undefined) continue;
        this.fadeStop(entry, intent.fadeOut ?? 0);
      } return;
    }
    if (intent.kind === "scriptEnd") { for (const entries of this.playing.values()) for (const entry of [...entries]) if (entry.stopAtEnd) this.fadeStop(entry, entry.stopFade ?? 0); return; }
    if (intent.kind === "stop") {
      for (const entry of [...(this.playing.get(intent.channel) ?? [])]) {
        if (!this.matches(entry, intent)) continue;
        if (intent.atEnd) { entry.stopAtEnd = true; entry.stopFade = intent.fadeOut; }
        else this.fadeStop(entry, intent.fadeOut ?? 0);
      } return;
    }
    if (intent.kind === "volume") {
      for (const entry of this.playing.get(intent.channel) ?? []) {
        if (!this.matches(entry, intent)) continue;
        const original = entry.volume;
        this.fades.add({ owner: `audio:${entry.id}`, duration: intent.duration ?? 0, onUpdate: (t) => { entry.volume = lerp(original, clamp(intent.volume), t); this.applyVolume(entry); } });
      }
      return;
    }
    if (intent.continueId !== undefined) {
      for (const entry of [...(this.playing.get(intent.channel) ?? [])]) if (entry.continueId === intent.continueId) this.remove(entry);
    } else this.currentEntries.set(intent.channel, null);
    const candidates = intent.sheet ? [`Se/${intent.sheet}/${intent.name}`, `Se/${intent.name}`, intent.name] : [intent.name];
    let url: string | null = null;
    for (const name of candidates) { url = this.resolve(this.region, intent.channel, name); if (url) break; }
    if (!url) { this.diagnostic(intent.sheet ? `${intent.sheet}/${intent.name}` : intent.name); return; }
    if (intent.channel !== "se") this.stop(intent.channel);
    const element = new Audio(url);
    element.loop = intent.loop ?? false;
    const targetVolume = clamp(intent.volume ?? 1);
    const entry: PlayingEntry = { id: ++this.sequence, name: intent.name, element, volume: intent.fadeIn ? 0 : targetVolume, continueId: intent.continueId };
    if (intent.continueId === undefined) this.currentEntries.set(intent.channel, entry);
    const entries = this.playing.get(intent.channel) ?? [];
    entries.push(entry); this.playing.set(intent.channel, entries);
    element.onended = () => this.remove(entry);
    element.onerror = () => { this.diagnostic(intent.name); this.remove(entry); };
    this.applyVolume(entry);
    if (intent.fadeIn) this.fades.add({ owner: `audio:${entry.id}`, duration: intent.fadeIn, onUpdate: (t) => { entry.volume = targetVolume * t; this.applyVolume(entry); } });
    if (this.unlocked && !this.pausedChannels.has(intent.channel)) void element.play().catch(() => this.remove(entry));
  }
  private matches(entry: PlayingEntry, intent: { name?: string; continueId?: number; continueOnly?: boolean }): boolean {
    return intent.continueId !== undefined ? entry.continueId === intent.continueId : (!intent.name || entry.name === intent.name) && (!intent.continueOnly || entry.continueId !== undefined);
  }
  private fadeStop(entry: PlayingEntry, duration: number): void {
    const from = entry.volume;
    this.fades.add({ owner: `audio:${entry.id}`, duration, onUpdate: t => { entry.volume = from * (1 - t); this.applyVolume(entry); }, onComplete: () => this.remove(entry) });
  }
  private applyVolume(entry: PlayingEntry): void { entry.element.volume = this.muted ? 0 : clamp(entry.volume * this.baseVolume); }
  private applyVolumes(): void { for (const entries of this.playing.values()) for (const entry of entries) this.applyVolume(entry); }
  private remove(entry: PlayingEntry): void {
    this.fades.cancel(`audio:${entry.id}`);
    entry.element.pause(); entry.element.onended = null; entry.element.onerror = null;
    for (const [channel, entries] of this.playing) this.playing.set(channel, entries.filter((item) => item !== entry));
    for (const [channel, current] of this.currentEntries) if (current === entry) this.currentEntries.set(channel, null);
  }
  private stop(channel: AudioChannel, name?: string): void {
    for (const entry of [...(this.playing.get(channel) ?? [])]) if (name === undefined || name === entry.name) this.remove(entry);
  }
  stopAll(): void { this.fades.clear(); for (const channel of this.playing.keys()) this.stop(channel); }
  dispose(): void { this.stopAll(); this.playing.clear(); }
}

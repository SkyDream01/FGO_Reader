import type { Region } from "../types";

/**
 * Audio channel model (docs/FGO_Story_Reader_Standard.md §5 音声与视频标准 S-A).
 *
 * Channel layout mirrors the engine: BGM(1) + SubBGM(1) + SE(multi) +
 * Voice(1) + Jingle(1). BGM crossfade playback lives in useBgm (it needs the
 * unlock gate and volume settings); this controller drives the remaining
 * channels from executor intents.
 *
 * 素材策略 (docs §6): when no asset mapping resolves a name, the intent is
 * dropped silently — playback never blocks on missing resources.
 */

export type AudioChannel = "subBgm" | "se" | "voice" | "jingle";

export type AudioIntent =
  | { kind: "play"; channel: AudioChannel; name: string; loop?: boolean; volume?: number }
  | { kind: "stop"; channel: AudioChannel; name?: string }
  | { kind: "stopAll" };

export type AudioAssetResolver = (
  region: Region,
  channel: AudioChannel,
  name: string,
) => string | null;

interface PlayingEntry {
  name: string;
  element: HTMLAudioElement;
  loop: boolean;
}

const CHANNEL_CAPACITY: Record<AudioChannel, number> = {
  subBgm: 1,
  se: 6,
  voice: 1,
  jingle: 1,
};

export class AudioChannels {
  private readonly playing = new Map<AudioChannel, PlayingEntry[]>();
  private unlocked = false;
  private muted = false;
  private baseVolume = 1;

  constructor(
    private readonly region: Region,
    private readonly resolve: AudioAssetResolver = () => null,
  ) {
    for (const channel of Object.keys(CHANNEL_CAPACITY) as AudioChannel[]) {
      this.playing.set(channel, []);
    }
  }

  setUnlocked(unlocked: boolean): void {
    this.unlocked = unlocked;
    if (!unlocked) this.pauseAll();
    else this.resumeAll();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumes();
  }

  setBaseVolume(volume: number): void {
    this.baseVolume = Math.max(0, Math.min(1, volume));
    this.applyVolumes();
  }

  handle(intent: AudioIntent): void {
    switch (intent.kind) {
      case "play":
        this.play(intent.channel, intent.name, intent);
        return;
      case "stop":
        this.stop(intent.channel, intent.name);
        return;
      case "stopAll":
        this.stopAll();
        return;
    }
  }

  private play(
    channel: AudioChannel,
    name: string,
    options: { loop?: boolean; volume?: number },
  ): void {
    const url = this.resolve(this.region, channel, name);
    if (!url || !this.unlocked) return;
    const entries = this.playing.get(channel) ?? [];
    const existing = entries.find((entry) => entry.name === name);
    if (existing) return;

    const element = new Audio();
    element.src = url;
    element.loop = options.loop ?? false;
    element.volume = this.volumeFor(options.volume);
    const entry: PlayingEntry = { name, element, loop: element.loop };
    element.play().catch(() => {
      // Playback can fail after policy changes; drop silently.
      this.remove(channel, entry);
    });
    entries.push(entry);
    // Respect the channel capacity by evicting the oldest one-shot.
    while (entries.length > CHANNEL_CAPACITY[channel]) {
      const evicted = entries.shift();
      if (evicted && evicted !== entry) {
        evicted.element.pause();
      }
    }
    this.playing.set(channel, entries);
  }

  private stop(channel: AudioChannel, name?: string): void {
    const entries = this.playing.get(channel) ?? [];
    const remaining = entries.filter((entry) => {
      if (name !== undefined && entry.name !== name) return true;
      entry.element.pause();
      return false;
    });
    this.playing.set(channel, remaining);
  }

  stopAll(): void {
    for (const channel of this.playing.keys()) this.stop(channel);
  }

  dispose(): void {
    this.stopAll();
    this.playing.clear();
  }

  private remove(channel: AudioChannel, entry: PlayingEntry): void {
    const entries = this.playing.get(channel) ?? [];
    this.playing.set(channel, entries.filter((candidate) => candidate !== entry));
  }

  private volumeFor(override?: number): number {
    if (this.muted) return 0;
    const base = override !== undefined ? Math.max(0, Math.min(1, override)) : this.baseVolume;
    return base;
  }

  private applyVolumes(): void {
    for (const entries of this.playing.values()) {
      for (const entry of entries) {
        entry.element.volume = this.muted ? 0 : this.baseVolume;
      }
    }
  }

  private pauseAll(): void {
    for (const entries of this.playing.values()) {
      for (const entry of entries) entry.element.pause();
    }
  }

  private resumeAll(): void {
    for (const entries of this.playing.values()) {
      for (const entry of entries) {
        void entry.element.play().catch(() => undefined);
      }
    }
  }
}

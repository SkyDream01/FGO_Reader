import { resolveEasing, type Easing } from "./easings";

export interface TweenOptions {
  owner: string;
  duration: number;
  easing?: Easing | string;
  clock?: "game" | "real";
  loop?: boolean;
  onUpdate: (t: number) => void;
  onComplete?: () => void;
}
interface Track extends TweenOptions { elapsed: number; curve: Easing }

/** Named tracks are the completion flags used by native wait keywords. */
export class TweenService {
  private tracks = new Map<string, Track>();
  add(options: TweenOptions): void {
    const duration = Number.isFinite(options.duration) ? Math.max(0, options.duration) : 0;
    this.cancel(options.owner);
    if (!duration) { options.onUpdate(1); options.onComplete?.(); return; }
    this.tracks.set(options.owner, { ...options, duration, elapsed: 0, curve: typeof options.easing === "function" ? options.easing : resolveEasing(options.easing) });
    options.onUpdate(0);
  }
  update(gameSeconds: number, realSeconds = gameSeconds): void {
    for (const track of [...this.tracks.values()]) {
      if (this.tracks.get(track.owner) !== track) continue;
      track.elapsed += Math.max(0, track.clock === "real" ? realSeconds : gameSeconds);
      const progress = track.elapsed / track.duration;
      track.onUpdate(track.curve(track.loop ? progress % 1 : Math.min(1, progress)));
      if (!track.loop && progress >= 1) {
        this.tracks.delete(track.owner);
        track.onComplete?.();
      }
    }
  }
  cancel(owner: string): void { this.tracks.delete(owner); }
  cancelByPrefix(prefix: string): void {
    for (const owner of this.tracks.keys()) if (owner.startsWith(prefix)) this.tracks.delete(owner);
  }
  isActive(owner: string): boolean { return this.tracks.has(owner); }
  isActiveByPrefix(prefix: string): boolean { return [...this.tracks.keys()].some((owner) => owner.startsWith(prefix)); }
  isAnyActive(): boolean { return this.tracks.size > 0; }
  /** Settle finite animation on replay without recursively spinning loop tracks. */
  finishAll(): void {
    for (let pass = 0; pass < 16; pass++) {
      const finite = [...this.tracks.values()].filter((track) => !track.loop);
      if (!finite.length) break;
      for (const track of finite) {
        if (this.tracks.get(track.owner) !== track) continue;
        this.tracks.delete(track.owner);
        track.onUpdate(1);
        track.onComplete?.();
      }
    }
  }
  clear(): void { this.tracks.clear(); }
}
export const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;

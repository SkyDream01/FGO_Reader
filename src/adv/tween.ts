import { resolveEasing, type Easing } from "./easings";

/**
 * Unified tween service (S-R9.10): frame-rate independent value interpolation
 * shared by movement, scaling, rotation, alpha, camera work and transition
 * meshes. Durations are seconds; the executor supplies scaled delta time so
 * skip mode can accelerate and fast-forward can complete instantly.
 */

export interface TweenOptions {
  /** Owner key — starting a new tween for the same owner cancels the old one. */
  owner: string;
  /** Duration in seconds; 0 completes on the next update. */
  duration: number;
  easing?: Easing | string;
  onUpdate: (t: number) => void;
  onComplete?: () => void;
}

interface ActiveTween {
  owner: string;
  duration: number;
  elapsed: number;
  easing: Easing;
  onUpdate: (t: number) => void;
  onComplete?: () => void;
}

export class TweenService {
  private tweens: ActiveTween[] = [];
  /** Completed this frame and awaiting their onComplete callbacks. */
  private completing: ActiveTween[] = [];

  add(options: TweenOptions): void {
    this.cancel(options.owner);
    this.tweens.push({
      owner: options.owner,
      duration: Math.max(0, options.duration),
      elapsed: 0,
      easing: typeof options.easing === "string"
        ? resolveEasing(options.easing)
        : options.easing ?? resolveEasing(undefined),
      onUpdate: options.onUpdate,
      onComplete: options.onComplete,
    });
  }

  cancel(owner: string): void {
    this.tweens = this.tweens.filter((tween) => tween.owner !== owner);
  }

  cancelByPrefix(prefix: string): void {
    this.tweens = this.tweens.filter((tween) => !tween.owner.startsWith(prefix));
  }

  update(dtSeconds: number): void {
    if (!this.tweens.length) return;
    const dt = Math.max(0, dtSeconds);
    const remaining: ActiveTween[] = [];
    for (const tween of this.tweens) {
      tween.elapsed += dt;
      const progress = tween.duration <= 0
        ? 1
        : Math.min(1, tween.elapsed / tween.duration);
      tween.onUpdate(tween.easing(progress));
      if (progress >= 1) this.completing.push(tween);
      else remaining.push(tween);
    }
    this.tweens = remaining;
    // onComplete may start new tweens; drain outside the iteration above.
    while (this.completing.length) {
      const tween = this.completing.shift()!;
      tween.onComplete?.();
    }
  }

  /** Jumps every tween to its final value; used by fast-forward resume. */
  finishAll(): void {
    const pending = this.tweens;
    this.tweens = [];
    for (const tween of pending) {
      tween.onUpdate(tween.easing(1));
      this.completing.push(tween);
    }
    while (this.completing.length) {
      const tween = this.completing.shift()!;
      tween.onComplete?.();
    }
  }

  isActive(owner: string): boolean {
    return this.tweens.some((tween) => tween.owner === owner);
  }

  isActiveByPrefix(prefix: string): boolean {
    return this.tweens.some((tween) => tween.owner.startsWith(prefix));
  }

  isAnyActive(): boolean {
    return this.tweens.length > 0;
  }

  clear(): void {
    this.tweens = [];
    this.completing = [];
  }
}

/** Interpolates a numeric range with an eased progress value. */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

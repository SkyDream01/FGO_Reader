import type { CommandContext } from "./commands";
import { lerp } from "./tween";

export const numeric = (value: string | undefined, fallback = 0): number => value !== undefined && Number.isFinite(Number(value)) ? Number(value) : fallback;
export const seconds = (value: string | undefined, fallback = 0.3): number => Math.max(0, numeric(value, fallback));
export const unquote = (value = ""): string => value.replace(/^"(.*)"$/, "$1");
export const nativeValues = (pd: readonly string[]): string[] => pd.filter((_, i) => i % 2 === 0).map(unquote);
export function move(ctx: CommandContext, owner: string, target: object, values: Record<string, number>, duration: number, done?: () => void, easing?: string): void {
  const record = target as Record<string, number>;
  const from = Object.fromEntries(Object.keys(values).map(key => [key, record[key]]));
  ctx.tweens.add({ owner, duration: ctx.fastForward || ctx.reduceMotion ? 0 : duration, easing,
    onUpdate: t => { for (const key of Object.keys(values)) record[key] = lerp(from[key], values[key], t); ctx.stage.touch(); }, onComplete: done });
}
/** The native shake samples independent offsets once per cycle. */
export function shakeTarget(ctx: CommandContext, owner: string, target: { x: number; y: number }, cycle: number, x: number, y: number, duration: number): void {
  ctx.tweens.cancel(owner); target.x = target.y = 0;
  if (ctx.fastForward || ctx.reduceMotion || duration <= 0) { ctx.stage.touch(); return; }
  ctx.tweens.add({ owner, duration, onUpdate: t => {
    const sample = Math.floor(t * duration / (cycle > 0 ? cycle : 1 / 60));
    const random = (seed: number) => { let n = Math.imul((sample + 1) ^ seed, 0x45d9f3b); n = Math.imul(n ^ n >>> 16, 0x45d9f3b); return ((n ^ n >>> 16) >>> 0) / 0xffffffff * 2 - 1; };
    target.x = random(0x1234) * x; target.y = random(0x5678) * y; ctx.stage.touch();
  }, onComplete: () => { target.x = target.y = 0; ctx.stage.touch(); } });
}
/** Insets use the native 576-unit reference; safe area is supplied by the host. */
export function sideOffset(tag: string, aspect: number, notch = 0): number {
  const left = /FS(?:Side)?L/.test(tag);
  if (!/FS(?:Side)?[LR]/.test(tag)) return 0;
  const extent = aspect < 16 / 9 ? 0.5 : (Math.min(aspect, 7 / 3) - 16 / 9) * 288;
  if (!/FSSide/.test(tag) && aspect <= 2) return 0;
  const safe = tag.endsWith("NotNotch") ? 0 : notch;
  const value = /FSSide/.test(tag) ? extent + safe : extent - 80 + safe;
  return left ? -Math.floor(value) : Math.ceil(value);
}

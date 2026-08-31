import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ChoiceDecision } from "../types";
import { ScriptExecutor, type StageSnapshot } from "./executor";
import type { ScriptProgram } from "./instruction";

/**
 * React bridge for the runtime executor: a rAF tick loop, an
 * external-store subscription for the stage snapshot, and the player actions
 * (tap / select / back / jump). Playback pacing lives in the executor; this
 * hook only supplies wall-clock time and session settings.
 */

export interface UseExecutorOptions {
  program: ScriptProgram;
  masterName: string;
  masterGender: "male" | "female";
  /** Persisted resume position (instruction index, docs §7). */
  startIndex: number;
  choiceTrail: ChoiceDecision[];
  /** Typing speed in ms per character (reader settings). */
  textSpeedMs: number;
  /** Animation clock multiplier (reduce-motion compresses waits). */
  timeScale?: number;
  /** Opens messages fully revealed (reduce-motion pacing). */
  reduceMotion?: boolean;
  /** Maximum dt clamp per tick; guards against suspended background tabs. */
  maxTickMs?: number;
}

export function useExecutor({
  program,
  masterName,
  masterGender,
  startIndex,
  choiceTrail,
  textSpeedMs,
  timeScale = 1,
  reduceMotion = false,
  // Generous clamp: heavy canvas work can make rAF intervals exceed 100ms,
  // which would dilate every wait timer. 1s only matters after tab suspension.
  maxTickMs = 1000,
}: UseExecutorOptions) {
  const executor = useMemo(
    () => new ScriptExecutor(program, { masterName, masterGender, textSpeedMs, reduceMotion }),
    // reduceMotion intentionally excluded: the constructor takes the initial
    // value; the setter effect below handles runtime changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [program, masterName, masterGender, textSpeedMs],
  );

  useEffect(() => {
    executor.start({ startIndex, choiceTrail });
    // Start once per executor instance; resume trails are captured at start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executor]);

  useEffect(() => {
    executor.setTextSpeed(textSpeedMs);
  }, [executor, textSpeedMs]);

  useEffect(() => {
    executor.setTimeScale(timeScale);
  }, [executor, timeScale]);

  useEffect(() => {
    executor.setReduceMotion(reduceMotion);
  }, [executor, reduceMotion]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(maxTickMs, Math.max(0, now - last));
      last = now;
      executor.tick(dt);
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [executor, maxTickMs]);

  const snapshot = useSyncExternalStore(executor.subscribe, executor.getSnapshot);

  const tap = useCallback(() => executor.tap(), [executor]);
  const selectChoice = useCallback(
    (optionIndex: number) => executor.selectChoice(optionIndex),
    [executor],
  );

  /**
   * Re-presents the previous input boundary — the prior message, or the
   * choice that led here — mirroring the old one-frame back navigation.
   */
  const goBack = useCallback(() => {
    const current = executor.getSnapshot();
    if (current.boundaryCount < 2) return;
    executor.goBackOneBoundary();
  }, [executor]);

  /** Jumps back to a specific log entry (BackLog click). */
  const jumpToMessage = useCallback((key: string) => {
    executor.jumpToMessage(key);
  }, [executor]);

  /** Restarts from the beginning with a clean decision trail. */
  const replay = useCallback(() => {
    executor.start({ startIndex: 0, choiceTrail: [] });
  }, [executor]);

  return {
    executor,
    snapshot,
    tap,
    selectChoice,
    goBack,
    jumpToMessage,
    replay,
  };
}

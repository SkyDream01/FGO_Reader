import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ChoiceDecision } from "../types";
import type { ScriptProgram } from "./instruction";
import { ScriptExecutor } from "./executor";
import type { GameStateProvider } from "./gameState";

export interface UseExecutorOptions {
  program: ScriptProgram;
  masterName: string;
  masterGender: "male" | "female";
  startIndex: number;
  choiceTrail: ChoiceDecision[];
  textSpeedMs: number;
  timeScale?: number;
  reduceMotion?: boolean;
  maxTickMs?: number;
  gameState?: GameStateProvider;
  initialBgm?: { name: string; volume?: number | null };
  configureExecutor?: (executor: ScriptExecutor) => void;
}

/** React supplies the real clock; pacing and completion live in the runtime. */
export function useExecutor({ program, masterName, masterGender, startIndex, choiceTrail, textSpeedMs, timeScale = 1, reduceMotion = false, maxTickMs = 1000, gameState, initialBgm, configureExecutor }: UseExecutorOptions) {
  // Runtime preferences must not recreate the interpreter and reset progress.
  const executor = useMemo(() => new ScriptExecutor(program, { masterName, masterGender, textSpeedMs, reduceMotion, gameState, initialBgm }), [program, masterName, masterGender, gameState]);
  useEffect(() => {
    configureExecutor?.(executor);
    executor.setTimeScale(timeScale);
    executor.setReduceMotion(reduceMotion);
    executor.setViewportAspect(window.innerWidth / Math.max(1, window.innerHeight));
    executor.start({ startIndex, choiceTrail });
  }, [executor]);
  useEffect(() => { executor.setTextSpeed(textSpeedMs); }, [executor, textSpeedMs]);
  useEffect(() => { executor.setTimeScale(timeScale); }, [executor, timeScale]);
  useEffect(() => { executor.setReduceMotion(reduceMotion); }, [executor, reduceMotion]);
  useEffect(() => {
    let raf = 0, last = performance.now();
    const viewport = () => executor.setViewportAspect(window.innerWidth / Math.max(1, window.innerHeight));
    viewport(); window.addEventListener("resize", viewport);
    const loop = (now: number) => {
      executor.tick(Math.min(maxTickMs, Math.max(0, now - last)));
      last = now; raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => { window.cancelAnimationFrame(raf); window.removeEventListener("resize", viewport); };
  }, [executor, maxTickMs]);
  const snapshot = useSyncExternalStore(executor.subscribe, executor.getSnapshot);
  const tap = useCallback(() => executor.tap(), [executor]);
  const selectChoice = useCallback((index: number) => executor.selectChoice(index), [executor]);
  const goBack = useCallback(() => executor.goBackOneBoundary(), [executor]);
  const jumpToMessage = useCallback((key: string) => executor.jumpToMessage(key), [executor]);
  const replay = useCallback(() => executor.start({ startIndex: 0, choiceTrail: [] }), [executor]);
  return { executor, snapshot, tap, selectChoice, goBack, jumpToMessage, replay };
}

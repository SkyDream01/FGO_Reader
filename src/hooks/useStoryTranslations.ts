import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  chunkTranslationUnits,
  createTranslationFrameLookahead,
  fetchTranslationServerConfig,
  frameTranslationUnits,
  loadPersistentTranslations,
  providerConfigFromSettings,
  providerIsReady,
  requestTranslations,
  savePersistentTranslations,
  translationForUnit,
  translationNamespace,
  translationUnitSourceHash,
  TRANSLATION_AHEAD_FRAME_COUNT,
  TranslationRequestError,
  type CachedTranslation,
  type TranslationServerConfig,
  type TranslationSettings,
  type TranslationUnit,
} from "../lib/translation";
import type { StoryFrame } from "../types";

interface UseStoryTranslationsOptions {
  scriptId: string;
  frames: StoryFrame[];
  frameIndex: number;
  eligible: boolean;
  settings: TranslationSettings;
  manualActive: boolean;
  manualTranslations: Record<string, CachedTranslation>;
}

interface CurrentTranslationError {
  detail: string;
  retryable: boolean;
}

type TranslationRunResult = "success" | "failed" | "deferred";

const MAX_CONCURRENT_BATCHES = 2;
const RETRY_DELAY_MS = 1_000;

function uniqueFrameUnits(frame: StoryFrame | null | undefined) {
  if (!frame) return [];
  const unique = new Map<string, TranslationUnit>();
  for (const unit of frameTranslationUnits(frame)) {
    const key = `${unit.id}:${translationUnitSourceHash(unit)}`;
    if (!unique.has(key)) unique.set(key, unit);
  }
  return [...unique.values()];
}

function frameHasTranslations(
  translations: Record<string, CachedTranslation>,
  frame: StoryFrame,
) {
  return frameTranslationUnits(frame)
    .every((unit) => Boolean(translationForUnit(translations, unit)));
}

function translatedFrameStepCount(
  translations: Record<string, CachedTranslation>,
  steps: StoryFrame[][],
) {
  return steps.filter((step) => (
    step.every((frame) => frameHasTranslations(translations, frame))
  )).length;
}

function retryDelay(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    let settled = false;
    let timer = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    timer = window.setTimeout(finish, RETRY_DELAY_MS);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

export function useStoryTranslations({
  scriptId,
  frames,
  frameIndex,
  eligible,
  settings,
  manualActive,
  manualTranslations,
}: UseStoryTranslationsOptions) {
  const [serverConfig, setServerConfig] = useState<TranslationServerConfig | null>(null);
  const [serverConfigError, setServerConfigError] = useState("");
  const [translations, setTranslations] = useState<Record<string, CachedTranslation>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [currentError, setCurrentError] = useState<CurrentTranslationError | null>(null);
  const [activeBatchCount, setActiveBatchCount] = useState(0);
  const [schedulerPaused, setSchedulerPaused] = useState(false);
  const [preparationFailed, setPreparationFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const translationsRef = useRef(translations);
  const pendingRef = useRef(new Set<string>());
  const controllersRef = useRef(new Set<AbortController>());
  const generationRef = useRef(0);

  const namespace = useMemo(
    () => translationNamespace(settings, serverConfig),
    [serverConfig, settings],
  );
  const ready = providerIsReady(settings, serverConfig);
  const providerConfig = useMemo(() => providerConfigFromSettings(settings), [settings]);
  const requestConfigSignature = useMemo(
    () => JSON.stringify({ provider: settings.provider, providerConfig }),
    [providerConfig, settings.provider],
  );
  const machineActive = Boolean(
    !manualActive
    && eligible
    && settings.mode === "translated"
    && settings.provider
    && ready,
  );

  const loadServerConfig = useCallback(async (signal?: AbortSignal) => {
    setServerConfigError("");
    try {
      setServerConfig(await fetchTranslationServerConfig(signal));
    } catch (error) {
      if (signal?.aborted) return;
      setServerConfigError(error instanceof Error ? error.message : "无法读取翻译配置");
    }
  }, []);

  const refreshServerConfig = useCallback(() => loadServerConfig(), [loadServerConfig]);

  useEffect(() => {
    const controller = new AbortController();
    void loadServerConfig(controller.signal);
    return () => controller.abort();
  }, [loadServerConfig]);

  const abortRequests = useCallback(() => {
    for (const controller of controllersRef.current) controller.abort();
    controllersRef.current.clear();
    pendingRef.current.clear();
    setPendingIds(new Set());
    setActiveBatchCount(0);
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    abortRequests();
    setCurrentError(null);
    setSchedulerPaused(false);
    setPreparationFailed(false);
    if (manualActive) {
      translationsRef.current = {};
      setTranslations({});
    } else if (settings.provider) {
      const cached = loadPersistentTranslations(settings.provider, namespace, scriptId);
      translationsRef.current = cached;
      setTranslations(cached);
    } else {
      translationsRef.current = {};
      setTranslations({});
    }
  }, [
    abortRequests,
    manualActive,
    namespace,
    requestConfigSignature,
    scriptId,
    settings.mode,
    settings.provider,
  ]);

  useEffect(() => () => abortRequests(), [abortRequests]);

  const frameLookahead = useMemo(
    () => createTranslationFrameLookahead(frames, frameIndex),
    [frameIndex, frames],
  );
  const currentFrame = frames[frameIndex] ?? null;
  const currentFrameUnits = useMemo(
    () => uniqueFrameUnits(currentFrame),
    [currentFrame],
  );
  const aheadFrameSteps = useMemo(() => frameLookahead.slice(1), [frameLookahead]);
  const translatedMachineUnreadFrameCount = useMemo(
    () => translatedFrameStepCount(translations, aheadFrameSteps),
    [aheadFrameSteps, translations],
  );
  const unreadFrameRefillGoal = aheadFrameSteps.length;

  const preparationComplete = Boolean(
    currentFrame && frameHasTranslations(translations, currentFrame),
  );
  const preparationReadyCount = preparationComplete ? 1 : 0;
  const preparationTotal = machineActive && currentFrame ? 1 : 0;
  const preparing = machineActive
    && Boolean(currentFrame)
    && !schedulerPaused
    && !preparationFailed
    && !preparationComplete;
  const preparationKey = machineActive && currentFrame
    ? `${scriptId}:${frameIndex}:${currentFrame.id}`
    : "";

  const translateFrame = useCallback(async (
    frame: StoryFrame,
    surfaceError: boolean,
  ): Promise<TranslationRunResult> => {
    if (!machineActive || !settings.provider) return "deferred";
    const unique = new Map<string, TranslationUnit>();
    for (const unit of uniqueFrameUnits(frame)) {
      const key = `${unit.id}:${translationUnitSourceHash(unit)}`;
      if (!unique.has(key)) unique.set(key, unit);
    }
    const missing = [...unique.values()].filter((unit) => (
      !translationForUnit(translationsRef.current, unit) && !pendingRef.current.has(unit.id)
    ));
    if (!missing.length) return "success";
    if (controllersRef.current.size >= MAX_CONCURRENT_BATCHES) return "deferred";

    const generation = generationRef.current;
    const controller = new AbortController();
    controllersRef.current.add(controller);
    setActiveBatchCount(controllersRef.current.size);
    for (const unit of missing) pendingRef.current.add(unit.id);
    setPendingIds(new Set(pendingRef.current));
    if (surfaceError) setCurrentError(null);

    try {
      for (const chunk of chunkTranslationUnits(missing)) {
        let response: Awaited<ReturnType<typeof requestTranslations>> | null = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            response = await requestTranslations({
              provider: settings.provider,
              scriptId,
              providerConfig,
              items: chunk,
              signal: controller.signal,
            });
            break;
          } catch (error) {
            const retryable = error instanceof TranslationRequestError && error.retryable;
            if (attempt === 0 && retryable && !controller.signal.aborted) {
              await retryDelay(controller.signal);
              continue;
            }
            throw error;
          }
        }

        if (!response || controller.signal.aborted || generation !== generationRef.current) {
          return "deferred";
        }

        // Commit every successful API sub-response immediately. A later chunk
        // may still fail without discarding translations already received.
        const sourceById = new Map(chunk.map((unit) => [unit.id, unit]));
        const next = { ...translationsRef.current };
        for (const translation of response.translations) {
          const unit = sourceById.get(translation.id);
          if (!unit) continue;
          next[unit.id] = {
            sourceHash: translationUnitSourceHash(unit),
            translatedText: translation.translatedText,
          };
        }
        translationsRef.current = next;
        setTranslations(next);
        savePersistentTranslations(
          settings.provider,
          namespace,
          scriptId,
          next,
          response.configurationId,
        );
      }
      return "success";
    } catch (error) {
      if (controller.signal.aborted || generation !== generationRef.current) return "deferred";
      const translatedError = error instanceof TranslationRequestError
        ? error
        : new TranslationRequestError("翻译服务暂时不可用", "provider_unavailable", true);
      setCurrentError({ detail: translatedError.message, retryable: translatedError.retryable });
      setSchedulerPaused(true);
      if (surfaceError) setPreparationFailed(true);
      return "failed";
    } finally {
      controllersRef.current.delete(controller);
      setActiveBatchCount(controllersRef.current.size);
      if (generation === generationRef.current) {
        for (const unit of missing) pendingRef.current.delete(unit.id);
        setPendingIds(new Set(pendingRef.current));
      }
    }
  }, [
    machineActive,
    namespace,
    providerConfig,
    scriptId,
    settings.provider,
  ]);

  useEffect(() => {
    if (
      !machineActive
      || schedulerPaused
      || !currentFrameUnits.length
      || activeBatchCount >= MAX_CONCURRENT_BATCHES
    ) return;
    if (currentFrame) void translateFrame(currentFrame, true);
  }, [
    activeBatchCount,
    currentFrame,
    currentFrameUnits,
    machineActive,
    pendingIds,
    retryNonce,
    schedulerPaused,
    translateFrame,
    translations,
  ]);

  useEffect(() => {
    if (
      !machineActive
      || schedulerPaused
      || activeBatchCount >= MAX_CONCURRENT_BATCHES
      || translatedMachineUnreadFrameCount >= unreadFrameRefillGoal
    ) return;

    const backgroundFrame = aheadFrameSteps
      .flat()
      .find((frame) => (
        uniqueFrameUnits(frame).some((unit) => (
          !translationForUnit(translationsRef.current, unit)
          && !pendingRef.current.has(unit.id)
        ))
      ));
    if (!backgroundFrame) return;

    void translateFrame(backgroundFrame, false);
  }, [
    activeBatchCount,
    aheadFrameSteps,
    machineActive,
    pendingIds,
    retryNonce,
    schedulerPaused,
    translateFrame,
    translatedMachineUnreadFrameCount,
    translations,
    unreadFrameRefillGoal,
  ]);

  const translatedUnit = useCallback((unit: TranslationUnit) => (
    translationForUnit(manualActive ? manualTranslations : translations, unit)
  ), [manualActive, manualTranslations, translations]);

  const frameTranslated = useCallback((frame: StoryFrame) => (
    frameTranslationUnits(frame).every((unit) => Boolean(translatedUnit(unit)))
  ), [translatedUnit]);

  const translatedUnreadFrameCount = useMemo(
    () => translatedFrameStepCount(
      manualActive ? manualTranslations : translations,
      aheadFrameSteps,
    ),
    [aheadFrameSteps, manualActive, manualTranslations, translations],
  );

  const translatedSpeaker = useCallback((frame: StoryFrame) => {
    if (frame.type !== "dialogue") return undefined;
    const unit = frameTranslationUnits(frame).find(({ kind }) => kind === "speaker");
    return unit ? translatedUnit(unit) : undefined;
  }, [translatedUnit]);

  const translatedText = useCallback((frame: StoryFrame) => {
    if (frame.type !== "dialogue") return undefined;
    const unit = frameTranslationUnits(frame).find(({ kind }) => kind === "dialogue");
    return unit ? translatedUnit(unit) : undefined;
  }, [translatedUnit]);

  const translatedChoice = useCallback((frame: StoryFrame, optionIndex: number) => {
    if (frame.type !== "choice") return undefined;
    const unit = frameTranslationUnits(frame)[optionIndex];
    return unit ? translatedUnit(unit) : undefined;
  }, [translatedUnit]);

  const currentTranslated = currentFrameUnits.length > 0
    && currentFrameUnits.every((unit) => Boolean(translatedUnit(unit)));
  const currentPending = !manualActive && currentFrameUnits.some((unit) => pendingIds.has(unit.id));

  return {
    serverConfig,
    serverConfigError,
    refreshServerConfig,
    providerReady: ready,
    namespace,
    preparing,
    preparationKey,
    preparationReadyCount,
    preparationTotal,
    translatedUnreadFrameCount,
    translatedUnreadFrameTarget: TRANSLATION_AHEAD_FRAME_COUNT,
    currentTranslated,
    currentPending,
    currentError,
    frameTranslated,
    translatedSpeaker,
    translatedText,
    translatedChoice,
    retryCurrent: () => {
      setCurrentError(null);
      setSchedulerPaused(false);
      setPreparationFailed(false);
      setRetryNonce((value) => value + 1);
    },
  };
}

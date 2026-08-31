import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  chunkTranslationUnits,
  clearPersistentTranslationCaches,
  fetchTranslationServerConfig,
  loadPersistentTranslations,
  providerConfigFromSettings,
  providerIsReady,
  requestTranslations,
  savePersistentTranslations,
  stepTranslationUnits,
  translationForUnit,
  translationNamespace,
  translationUnitSourceHash,
  TRANSLATION_AHEAD_FRAME_COUNT,
  TranslationRequestError,
  type CachedTranslation,
  type TranslationServerConfig,
  type TranslationSettings,
  type TranslationUnit,
  type TranslatableStep,
} from "../lib/translation";

interface UseStoryTranslationsOptions {
  scriptId: string;
  /** Readable units in display order; index 0 is the current message/choice. */
  steps: TranslatableStep[];
  eligible: boolean;
  settings: TranslationSettings;
  manualActive: boolean;
  manualTranslations: Record<string, CachedTranslation>;
  paused: boolean;
}

interface CurrentTranslationError {
  detail: string;
  retryable: boolean;
}

type TranslationRunResult = "success" | "failed" | "deferred";

const MAX_CONCURRENT_BATCHES = 3;
const BACKGROUND_BATCH_UNIT_LIMIT = 20;
const RETRY_DELAY_MS = 1_000;

function uniqueStepUnits(step: TranslatableStep | null | undefined) {
  return step ? collectUniqueUnits([step]) : [];
}

function collectUniqueUnits(steps: TranslatableStep[]) {
  const units = new Map<string, TranslationUnit>();
  for (const step of steps) {
    for (const unit of stepTranslationUnits(step)) {
      const key = `${unit.id}:${translationUnitSourceHash(unit)}`;
      if (!units.has(key)) units.set(key, unit);
    }
  }
  return [...units.values()];
}

function stepHasTranslations(
  translations: Record<string, CachedTranslation>,
  step: TranslatableStep,
) {
  return stepTranslationUnits(step)
    .every((unit) => Boolean(translationForUnit(translations, unit)));
}

function translatedStepCount(
  translations: Record<string, CachedTranslation>,
  steps: TranslatableStep[],
) {
  return steps.filter((step) => stepHasTranslations(translations, step)).length;
}

function collectBackgroundBatch(
  steps: TranslatableStep[],
  translations: Record<string, CachedTranslation>,
  pendingIds: Set<string>,
  startIndex: number,
) {
  const batch: TranslatableStep[] = [];
  let missingUnitCount = 0;
  let index = startIndex;

  while (index < steps.length) {
    const step = steps[index];
    const stepUnits = stepTranslationUnits(step).filter((unit) => (
      !translationForUnit(translations, unit) && !pendingIds.has(unit.id)
    ));
    if (!stepUnits.length) {
      index += 1;
      continue;
    }
    if (batch.length && missingUnitCount + stepUnits.length > BACKGROUND_BATCH_UNIT_LIMIT) break;
    batch.push(step);
    missingUnitCount += stepUnits.length;
    index += 1;
    if (missingUnitCount >= BACKGROUND_BATCH_UNIT_LIMIT) break;
  }

  return { steps: batch, nextIndex: index };
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
  steps,
  eligible,
  settings,
  manualActive,
  manualTranslations,
  paused,
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
    !paused
    && !manualActive
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

  const clearCache = useCallback(() => {
    generationRef.current += 1;
    abortRequests();
    clearPersistentTranslationCaches();
    translationsRef.current = {};
    setTranslations({});
    setCurrentError(null);
    setSchedulerPaused(false);
    setPreparationFailed(false);
    setRetryNonce((value) => value + 1);
  }, [abortRequests]);

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
    paused,
    requestConfigSignature,
    scriptId,
    settings.mode,
    settings.provider,
  ]);

  useEffect(() => () => abortRequests(), [abortRequests]);

  const currentStep = steps[0] ?? null;
  const currentStepUnits = useMemo(
    () => uniqueStepUnits(currentStep),
    [currentStep],
  );
  const aheadSteps = useMemo(() => steps.slice(1), [steps]);
  const translatedMachineUnreadStepCount = useMemo(
    () => translatedStepCount(translations, aheadSteps),
    [aheadSteps, translations],
  );
  const unreadStepRefillGoal = aheadSteps.length;

  const preparationComplete = Boolean(
    currentStep && stepHasTranslations(translations, currentStep),
  );
  const preparationReadyCount = preparationComplete ? 1 : 0;
  const preparationTotal = machineActive && currentStep ? 1 : 0;
  const preparing = machineActive
    && Boolean(currentStep)
    && !schedulerPaused
    && !preparationFailed
    && !preparationComplete;
  const preparationKey = machineActive && currentStep
    ? `${scriptId}:${currentStep.key}:${currentStepUnits.map((unit) => unit.id).join("|")}`
    : "";

  const translateSteps = useCallback(async (
    stepsToTranslate: TranslatableStep[],
    surfaceError: boolean,
  ): Promise<TranslationRunResult> => {
    if (!machineActive || !settings.provider) return "deferred";
    const missing = collectUniqueUnits(stepsToTranslate).filter((unit) => (
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
      || !currentStepUnits.length
      || activeBatchCount >= MAX_CONCURRENT_BATCHES
    ) return;
    if (currentStep) void translateSteps([currentStep], true);
  }, [
    activeBatchCount,
    currentStep,
    currentStepUnits,
    machineActive,
    pendingIds,
    retryNonce,
    schedulerPaused,
    translateSteps,
    translations,
  ]);

  useEffect(() => {
    if (
      !machineActive
      || schedulerPaused
      || activeBatchCount >= MAX_CONCURRENT_BATCHES
      || translatedMachineUnreadStepCount >= unreadStepRefillGoal
    ) return;

    let nextStepIndex = 0;
    while (controllersRef.current.size < MAX_CONCURRENT_BATCHES && nextStepIndex < aheadSteps.length) {
      const batch = collectBackgroundBatch(
        aheadSteps,
        translationsRef.current,
        pendingRef.current,
        nextStepIndex,
      );
      if (!batch.steps.length) break;
      void translateSteps(batch.steps, false);
      nextStepIndex = batch.nextIndex;
    }
  }, [
    activeBatchCount,
    aheadSteps,
    machineActive,
    pendingIds,
    retryNonce,
    schedulerPaused,
    translateSteps,
    translatedMachineUnreadStepCount,
    translations,
    unreadStepRefillGoal,
  ]);

  const translatedUnit = useCallback((unit: TranslationUnit) => (
    translationForUnit(manualActive ? manualTranslations : translations, unit)
  ), [manualActive, manualTranslations, translations]);

  const stepTranslated = useCallback((step: TranslatableStep) => (
    stepTranslationUnits(step).every((unit) => Boolean(translatedUnit(unit)))
  ), [translatedUnit]);

  const translatedUnreadStepCount = useMemo(
    () => translatedStepCount(
      manualActive ? manualTranslations : translations,
      aheadSteps,
    ),
    [aheadSteps, manualActive, manualTranslations, translations],
  );

  const translatedSpeaker = useCallback((step: TranslatableStep) => {
    if (step.kind !== "message") return undefined;
    const unit = stepTranslationUnits(step).find(({ kind }) => kind === "speaker");
    return unit ? translatedUnit(unit) : undefined;
  }, [translatedUnit]);

  const translatedText = useCallback((step: TranslatableStep) => {
    if (step.kind !== "message") return undefined;
    const unit = stepTranslationUnits(step).find(({ kind }) => kind === "dialogue");
    return unit ? translatedUnit(unit) : undefined;
  }, [translatedUnit]);

  const translatedChoice = useCallback((step: TranslatableStep, optionIndex: number) => {
    if (step.kind !== "choice") return undefined;
    const unit = stepTranslationUnits(step)[optionIndex];
    return unit ? translatedUnit(unit) : undefined;
  }, [translatedUnit]);

  const currentTranslated = currentStepUnits.length > 0
    && currentStepUnits.every((unit) => Boolean(translatedUnit(unit)));
  const currentPending = !manualActive && currentStepUnits.some((unit) => pendingIds.has(unit.id));

  return {
    serverConfig,
    serverConfigError,
    refreshServerConfig,
    clearCache,
    providerReady: ready,
    namespace,
    preparing,
    preparationKey,
    preparationReadyCount,
    preparationTotal,
    translatedUnreadStepCount,
    translatedUnreadStepTarget: TRANSLATION_AHEAD_FRAME_COUNT,
    currentTranslated,
    currentPending,
    currentError,
    abortPending: abortRequests,
    stepTranslated,
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

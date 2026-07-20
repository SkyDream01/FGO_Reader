import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  chunkTranslationUnits,
  fetchTranslationServerConfig,
  frameTranslationUnits,
  loadPersistentTranslations,
  nextTranslationPrefetchFrames,
  providerConfigFromSettings,
  providerIsReady,
  requestTranslations,
  savePersistentTranslations,
  translationForUnit,
  translationNamespace,
  translationUnitSourceHash,
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
  historyOpen: boolean;
  eligible: boolean;
  settings: TranslationSettings;
  skipMode: boolean;
  ctrlHeld: boolean;
  manualActive: boolean;
  manualTranslations: Record<string, CachedTranslation>;
}

interface CurrentTranslationError {
  detail: string;
  retryable: boolean;
}

export function useStoryTranslations({
  scriptId,
  frames,
  frameIndex,
  historyOpen,
  eligible,
  settings,
  skipMode,
  ctrlHeld,
  manualActive,
  manualTranslations,
}: UseStoryTranslationsOptions) {
  const [serverConfig, setServerConfig] = useState<TranslationServerConfig | null>(null);
  const [serverConfigError, setServerConfigError] = useState("");
  const [translations, setTranslations] = useState<Record<string, CachedTranslation>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [currentError, setCurrentError] = useState<CurrentTranslationError | null>(null);
  const [prefetchRoundActive, setPrefetchRoundActive] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const translationsRef = useRef(translations);
  const pendingRef = useRef(new Set<string>());
  const controllersRef = useRef(new Set<AbortController>());
  const generationRef = useRef(0);
  const resolvedConfigurationIdRef = useRef<string | undefined>(undefined);
  const failedPrefetchKeyRef = useRef("");
  const prefetchRoundIdRef = useRef(0);

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
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    prefetchRoundIdRef.current += 1;
    abortRequests();
    setCurrentError(null);
    setPrefetchRoundActive(false);
    failedPrefetchKeyRef.current = "";
    resolvedConfigurationIdRef.current = undefined;
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
  }, [abortRequests, manualActive, namespace, requestConfigSignature, scriptId, settings.provider]);

  useEffect(() => {
    if (settings.mode !== "source") return;
    generationRef.current += 1;
    prefetchRoundIdRef.current += 1;
    abortRequests();
    setCurrentError(null);
    setPrefetchRoundActive(false);
    failedPrefetchKeyRef.current = "";
  }, [abortRequests, settings.mode]);

  useEffect(() => () => abortRequests(), [abortRequests]);

  const translateUnits = useCallback(async (units: TranslationUnit[], surfaceError: boolean) => {
    if (manualActive || !eligible || settings.mode !== "translated" || !settings.provider || !ready) return false;
    const unique = new Map<string, TranslationUnit>();
    for (const unit of units) {
      const key = `${unit.id}:${translationUnitSourceHash(unit)}`;
      if (!unique.has(key)) unique.set(key, unit);
    }
    const missing = [...unique.values()].filter((unit) => (
      !translationForUnit(translationsRef.current, unit) && !pendingRef.current.has(unit.id)
    ));
    if (!missing.length) return true;

    const generation = generationRef.current;
    const controller = new AbortController();
    controllersRef.current.add(controller);
    for (const unit of missing) pendingRef.current.add(unit.id);
    setPendingIds(new Set(pendingRef.current));
    if (surfaceError) setCurrentError(null);

    try {
      for (const chunk of chunkTranslationUnits(missing)) {
        const response = await requestTranslations({
          provider: settings.provider,
          scriptId,
          providerConfig,
          items: chunk,
          signal: controller.signal,
        });
        if (controller.signal.aborted || generation !== generationRef.current) return false;
        resolvedConfigurationIdRef.current = response.configurationId;
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
      return true;
    } catch (error) {
      if (controller.signal.aborted || generation !== generationRef.current) return false;
      if (surfaceError) {
        const translatedError = error instanceof TranslationRequestError
          ? error
          : new TranslationRequestError("翻译服务暂时不可用", "provider_unavailable", true);
        setCurrentError({ detail: translatedError.message, retryable: translatedError.retryable });
      }
      return false;
    } finally {
      controllersRef.current.delete(controller);
      for (const unit of missing) pendingRef.current.delete(unit.id);
      setPendingIds(new Set(pendingRef.current));
    }
  }, [eligible, manualActive, namespace, providerConfig, ready, scriptId, settings.mode, settings.provider]);

  const currentFrame = frames[frameIndex] ?? null;
  const currentUnits = useMemo(
    () => currentFrame ? frameTranslationUnits(currentFrame) : [],
    [currentFrame],
  );

  useEffect(() => {
    if (
      !currentFrame
      || settings.mode !== "translated"
      || !eligible
      || !settings.provider
      || !ready
      || skipMode
      || ctrlHeld
    ) return;
    void translateUnits(currentUnits, true);
  }, [
    ctrlHeld,
    currentFrame,
    currentUnits,
    eligible,
    frameIndex,
    frames,
    ready,
    retryNonce,
    settings.mode,
    settings.provider,
    skipMode,
    translateUnits,
  ]);

  useEffect(() => {
    if (
      !currentFrame
      || settings.mode !== "translated"
      || !eligible
      || !settings.provider
      || !ready
      || skipMode
      || ctrlHeld
      || prefetchRoundActive
      || currentUnits.some((unit) => pendingIds.has(unit.id))
      || currentUnits.some((unit) => !translationForUnit(translations, unit))
    ) return;

    const prefetchFrames = nextTranslationPrefetchFrames(frames, frameIndex, translations);
    if (!prefetchFrames.length) return;
    const prefetchUnits = prefetchFrames.flatMap(frameTranslationUnits);
    const prefetchKey = `${frameIndex}:${prefetchUnits
      .map((unit) => `${unit.id}:${translationUnitSourceHash(unit)}`)
      .join("|")}`;
    if (failedPrefetchKeyRef.current === prefetchKey) return;

    const roundId = prefetchRoundIdRef.current + 1;
    prefetchRoundIdRef.current = roundId;
    setPrefetchRoundActive(true);
    void translateUnits(prefetchUnits, false).then((success) => {
      if (prefetchRoundIdRef.current !== roundId) return;
      failedPrefetchKeyRef.current = success ? "" : prefetchKey;
    }).finally(() => {
      if (prefetchRoundIdRef.current === roundId) setPrefetchRoundActive(false);
    });
  }, [
    ctrlHeld,
    currentFrame,
    currentUnits,
    eligible,
    frameIndex,
    frames,
    pendingIds,
    prefetchRoundActive,
    ready,
    settings.mode,
    settings.provider,
    skipMode,
    translateUnits,
    translations,
  ]);

  useEffect(() => {
    if (
      !historyOpen
      || settings.mode !== "translated"
      || !eligible
      || !settings.provider
      || !ready
      || skipMode
      || ctrlHeld
    ) return;
    const historyUnits = frames
      .slice(0, frameIndex + 1)
      .reverse()
      .flatMap(frameTranslationUnits);
    if (historyUnits.length) void translateUnits(historyUnits, false);
  }, [
    ctrlHeld,
    eligible,
    frameIndex,
    frames,
    historyOpen,
    ready,
    settings.mode,
    settings.provider,
    skipMode,
    translateUnits,
  ]);

  const translatedUnit = useCallback((unit: TranslationUnit) => (
    translationForUnit(manualActive ? manualTranslations : translations, unit)
  ), [manualActive, manualTranslations, translations]);

  const translatedSpeaker = useCallback((frame: StoryFrame) => {
    if (frame.type !== "dialogue") return undefined;
    return translatedUnit(frameTranslationUnits(frame)[0]);
  }, [translatedUnit]);

  const translatedText = useCallback((frame: StoryFrame) => {
    if (frame.type !== "dialogue") return undefined;
    return translatedUnit(frameTranslationUnits(frame)[1]);
  }, [translatedUnit]);

  const translatedChoice = useCallback((frame: StoryFrame, optionIndex: number) => {
    if (frame.type !== "choice") return undefined;
    const unit = frameTranslationUnits(frame)[optionIndex];
    return unit ? translatedUnit(unit) : undefined;
  }, [translatedUnit]);

  const currentTranslated = currentUnits.every((unit) => Boolean(translatedUnit(unit)));
  const currentReady = settings.mode !== "translated"
    || manualActive
    || !eligible
    || (Boolean(settings.provider) && ready && currentTranslated);
  const currentPending = !manualActive && currentUnits.some((unit) => pendingIds.has(unit.id));

  return {
    serverConfig,
    serverConfigError,
    refreshServerConfig,
    providerReady: ready,
    namespace,
    currentReady,
    currentTranslated,
    currentPending,
    currentError,
    translatedSpeaker,
    translatedText,
    translatedChoice,
    retryCurrent: () => {
      setCurrentError(null);
      setRetryNonce((value) => value + 1);
    },
  };
}

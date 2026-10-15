import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CircleAlert,
  Download,
  Expand,
  EyeOff,
  Gauge,
  HardDrive,
  Keyboard,
  Languages,
  ListMusic,
  LoaderCircle,
  MessageSquareText,
  Music2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  CSSProperties,
  ChangeEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  backgroundUrl,
  fallbackBgmUrl,
} from "../data/atlas";
import { useBgm, type BgmPlaybackSession } from "../hooks/useBgm";
import type { GameStateProvider } from "../adv/gameState";
import { useCustomAssetUrl } from "../hooks/useCustomAssetUrl";
import { useManualTranslations } from "../hooks/useManualTranslations";
import { useStoryTranslations } from "../hooks/useStoryTranslations";
import { useExecutor } from "../adv/useExecutor";
import type { ScriptExecutor } from "../adv/executor";
import { AudioChannels, type AudioContinuationPool } from "../adv/audio";
import { StoryStage } from "./StoryStage";
import { RichMessageLines } from "./RichMessageLines";
import { MoviePlayer, RuntimeEffects } from "./RuntimeEffects";
import { stageCoordinateToViewport } from "../lib/stageCoordinates";
import type { MessageLineView } from "../adv/message";
import {
  autoPlaybackDelayMs,
  choiceAutoPlaybackCharacterCount,
} from "../lib/autoPlayback";
import {
  clearLastObservation,
  createLastObservation,
  saveLastObservation,
} from "../lib/lastObservation";
import {
  COORDINATE_DEBUG_ENABLED,
  DEBUG_COORDINATE_OFFSETS,
  type CoordinateDebugSettings,
} from "../lib/coordinateDebug";
import {
  BOOKMARK_STORAGE_KEY,
  choiceTrailStorageKey,
  loadStoredFrameIndex,
  progressStorageKey,
  readProgressStorageKey,
} from "../lib/scriptParserVersion";
import type {
  PreparedCustomPackage,
  PreparedStory,
} from "../lib/storyPreparation";
import {
  collectScriptTranslationUnitBatches,
  collectScriptTranslationUnits,
  MANUAL_TRANSLATION_MAX_BYTES,
  ManualTranslationError,
} from "../lib/manualTranslations";
import {
  deleteLocalOpenAiConfig,
  loadPersistentTranslations,
  loadTranslationSettings,
  providerConfigFromSettings,
  saveLocalOpenAiConfig,
  savePersistentTranslations,
  saveTranslationSettings,
  translateTranslationUnits,
  TranslationBatchError,
  TRANSLATION_AHEAD_FRAME_COUNT,
  type CachedTranslation,
  type FullTranslationProgress,
  type ThinkingLevel,
  type TranslationSettings,
  type TranslatableStep,
} from "../lib/translation";
import {
  exportTextFile,
  leaveApplicationFullscreen,
  registerAndroidBackHandler,
  toggleApplicationFullscreen,
} from "../platform/runtime";
import type {
  Bookmark as ReaderBookmark,
  ChoiceTrail,
  ReaderSettings,
  StoryLaunch,
} from "../types";

interface ReaderViewProps {
  story: StoryLaunch;
  prepared: PreparedStory;
  nextStory: StoryLaunch | null;
  audioContinuations?: AudioContinuationPool;
  bgmSession?: BgmPlaybackSession;
  gameState?: GameStateProvider;
  onNext: () => void;
  onExit: () => void;
}

type Panel = "none" | "log" | "settings" | "shortcuts";

const defaultSettings: ReaderSettings = {
  textSpeed: 28,
  bgmVolume: 0.62,
  skipUnread: false,
  reduceMotion: false,
  masterName: "御主",
  masterGender: "male",
};

const thinkingLevelOptions: Array<{ value: ThinkingLevel; label: string }> = [
  { value: "low", label: "低 · low" },
  { value: "medium", label: "中 · medium" },
  { value: "high", label: "高 · high" },
  { value: "xhigh", label: "极高 · xhigh" },
  { value: "max", label: "最高 · max" },
];

function loadSettings(): ReaderSettings {
  try {
    const stored = localStorage.getItem("fgo-reader-settings");
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function ToggleButton({
  active,
  label,
  shortcut,
  icon,
  onClick,
  disabled,
}: {
  active?: boolean;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`reader-tool ${active ? "active" : ""}`}
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      aria-pressed={active}
    >
      {icon}
      <span>{label}</span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );
}

const shortcutRows = [
  ["Enter / Space / PageDown", "补全文字 / 下一句"],
  ["←", "上一句"],
  ["A", "自动播放"],
  ["S", "跳过已读"],
  ["按住 Ctrl", "临时快进"],
  ["L / PageUp", "历史记录"],
  ["T", "原文 / 译文"],
  ["H", "隐藏 / 恢复界面"],
  ["↑ / ↓ / 1–9", "选择剧情选项"],
  ["B", "保存当前位置"],
  ["M", "静音"],
  ["F", "全屏"],
  ["?", "快捷键帮助"],
  ["Esc", "关闭当前面板"],
];

type CoordinateDebugInputValues = {
  screenOrigin: { x: string; y: string };
  characterOrigin: { x: string; y: string };
};

function coordinateDebugInputValuesFrom(settings: CoordinateDebugSettings): CoordinateDebugInputValues {
  return {
    screenOrigin: {
      x: String(settings.screenOrigin.x),
      y: String(settings.screenOrigin.y),
    },
    characterOrigin: {
      x: String(settings.characterOrigin.x),
      y: String(settings.characterOrigin.y),
    },
  };
}

const DISABLED_COORDINATE_DEBUG_SETTINGS: CoordinateDebugSettings = {
  screenOrigin: { x: 0, y: 0 },
  characterOrigin: { x: 0, y: 0 },
  showScreenOrigin: false,
  showCharacterOrigin: false,
};

function initialCoordinateDebugSettings(): CoordinateDebugSettings {
  const defaults = COORDINATE_DEBUG_ENABLED
    ? DEBUG_COORDINATE_OFFSETS
    : DISABLED_COORDINATE_DEBUG_SETTINGS;
  return {
    screenOrigin: { ...defaults.screenOrigin },
    characterOrigin: { ...defaults.characterOrigin },
    showScreenOrigin: defaults.showScreenOrigin,
    showCharacterOrigin: defaults.showCharacterOrigin,
  };
}

/** Converts plain translated text into the rich line model for display. */
function plainTextToLines(text: string): MessageLineView[] {
  return text.split("\n").map((line) => ({
    spans: line ? [{ text: line, color: null, ruby: null }] : [],
    align: "left" as const,
  }));
}

export function ReaderView({
  story,
  prepared,
  nextStory,
  onNext,
  onExit,
  audioContinuations,
  bgmSession,
  gameState,
}: ReaderViewProps) {
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  // DEBUG ONLY: this is intentionally session-local so calibration changes
  // take effect immediately without becoming a persisted reader preference.
  const [coordinateDebugOffsets, setCoordinateDebugOffsets] = useState<CoordinateDebugSettings>(
    initialCoordinateDebugSettings,
  );
  const [coordinateDebugInputValues, setCoordinateDebugInputValues] = useState(
    () => coordinateDebugInputValuesFrom(initialCoordinateDebugSettings()),
  );
  const [translationSettings, setTranslationSettings] = useState<TranslationSettings>(loadTranslationSettings);
  const [translationDraft, setTranslationDraft] = useState<TranslationSettings>(loadTranslationSettings);
  const [choiceTrail, setChoiceTrail] = useState<ChoiceTrail>(prepared.choiceTrail);
  const customPackage = prepared.customPackage;
  const loading = false;
  const loadNote = prepared.loadNote;
  const [panel, setPanel] = useState<Panel>("none");
  const [autoMode, setAutoMode] = useState(false);
  const [skipMode, setSkipMode] = useState(false);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [muted, setMuted] = useState(audioContinuations?.muted ?? false);
  const [audioUnlocked, setAudioUnlocked] = useState(audioContinuations?.unlocked || (typeof navigator !== "undefined" && navigator.userActivation?.hasBeenActive) || false);
  const [windowFocused, setWindowFocused] = useState(document.hasFocus());
  const [choiceFocus, setChoiceFocus] = useState(0);
  const [toast, setToast] = useState("");
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const japaneseStoryLoaded = prepared.japaneseStoryLoaded;
  const remoteTranslationEligible = prepared.remoteTranslationEligible;
  const [loadedMasterName] = useState(settings.masterName);
  const [loadedMasterGender] = useState(settings.masterGender);
  const [openAiDraftDirty, setOpenAiDraftDirty] = useState(false);
  const [clearOpenAiApiKey, setClearOpenAiApiKey] = useState(false);
  const [translationConfigSaving, setTranslationConfigSaving] = useState(false);
  const [translationConfigError, setTranslationConfigError] = useState("");
  const [manualTranslationBusy, setManualTranslationBusy] = useState(false);
  const [manualTranslationError, setManualTranslationError] = useState("");
  const [oneShotTranslationProgress, setOneShotTranslationProgress] = useState<FullTranslationProgress | null>(null);
  const [readMax, setReadMax] = useState(() => {
    return loadStoredFrameIndex(readProgressStorageKey(story.scriptId), -1);
  });
  const toastTimer = useRef<number | null>(null);
  const manualTranslationInputRef = useRef<HTMLInputElement>(null);
  const oneShotTranslationControllerRef = useRef<AbortController | null>(null);
  const audioDiagnosticTarget = useRef<ScriptExecutor | null>(null);
  const audioChannels = useMemo(() => new AudioChannels(story.region, (region, channel, name) => (
    customPackage?.assetUrls.sounds?.[name] ?? (channel === "subBgm" ? customPackage?.assetUrls.bgm[name] || fallbackBgmUrl(region, name) : null)
  ), name => audioDiagnosticTarget.current?.reportDiagnostic("audio", `音频资源缺失：${name}，静音继续`)), [story.region, customPackage]);

  // ③ Executor-driven playback (docs/FGO_Story_Reader_Standard §1.1 / S-E).
  const effectiveTextSpeed = settings.reduceMotion ? 2 : settings.textSpeed;
  const { executor, snapshot, tap, selectChoice, goBack, jumpToMessage, replay } = useExecutor({
    program: prepared.program,
    masterName: loadedMasterName,
    masterGender: loadedMasterGender,
    startIndex: prepared.startIndex,
    choiceTrail: prepared.choiceTrail,
    textSpeedMs: effectiveTextSpeed,
    // Reduce-motion compresses timed waits and transitions to near-instant,
    // matching the old reader's reduceMotion pacing.
    timeScale: settings.reduceMotion ? 60 : 1,
    reduceMotion: settings.reduceMotion,
    gameState,
    initialBgm: bgmSession?.file ? { name: bgmSession.file, volume: bgmSession.volume } : undefined,
    configureExecutor: runtime => {
      audioDiagnosticTarget.current = runtime;
      if (audioContinuations) audioChannels.restoreContinuations(audioContinuations);
      audioChannels.setUnlocked(audioUnlocked); audioChannels.setMuted(muted); audioChannels.setBaseVolume(settings.bgmVolume);
      runtime.onAudioIntent = intent => audioChannels.handle(intent);
      runtime.onAudioTick = (game, real) => audioChannels.tick(game, real);
      runtime.isExternalBusy = (type, name) => type === "se" || type === "voice" || type === "jingle" || type === "subBgm" ? audioChannels.isScriptBusy(type, name) : undefined;
    },
  });
  const phase = snapshot.phase;
  const completed = phase === "ended";
  const currentMessage = snapshot.message;
  const currentChoice = snapshot.choice;

  // Audio intents route through the S-A channel model (BGM keeps useBgm).
  useEffect(() => {
    if (audioContinuations) audioChannels.restoreContinuations(audioContinuations);
    executor.onAudioIntent = (intent) => audioChannels.handle(intent);
    executor.onAudioTick = (game, real) => audioChannels.tick(game, real);
    executor.isExternalBusy = (type, name) => type === "se" || type === "voice" || type === "jingle" || type === "subBgm" ? audioChannels.isScriptBusy(type, name) : undefined;
    return () => {
      executor.onAudioIntent = null;
      executor.onAudioTick = null;
      executor.isExternalBusy = null;
    };
  }, [executor, audioChannels, audioContinuations]);
  useEffect(() => {
    audioChannels.setUnlocked(audioUnlocked);
    if (audioContinuations) audioContinuations.unlocked = audioUnlocked;
  }, [audioChannels, audioUnlocked]);
  useEffect(() => {
    audioChannels.setMuted(muted);
    if (audioContinuations) audioContinuations.muted = muted;
  }, [audioChannels, muted]);
  useEffect(() => { audioChannels.setBaseVolume(settings.bgmVolume); }, [audioChannels, settings.bgmVolume]);
  useEffect(() => () => { if (audioContinuations) audioChannels.saveContinuations(audioContinuations); audioChannels.dispose(); }, [audioChannels, audioContinuations]);
  useEffect(() => {
    executor.setFastPlay(skipMode || ctrlHeld);
  }, [executor, skipMode, ctrlHeld]);
  useEffect(() => {
    const paused = new Set<"se" | "voice" | "subBgm" | "jingle">();
    if (snapshot.movie?.sePause) paused.add("se");
    if (snapshot.movie?.voicePause) paused.add("voice");
    if (snapshot.movie?.bgmPause) paused.add("subBgm");
    audioChannels.setPaused(paused);
  }, [audioChannels, snapshot.movie?.sePause, snapshot.movie?.voicePause, snapshot.movie?.bgmPause]);
  useEffect(() => { if (snapshot.policy.hideAuto) setAutoMode(false); if (snapshot.policy.hideLog && panel === "log") setPanel("none"); }, [snapshot.policy.hideAuto, snapshot.policy.hideLog, panel]);

  const manualTranslation = useManualTranslations({
    eligible: japaneseStoryLoaded,
    scriptId: story.scriptId,
    title: story.title,
    masterName: loadedMasterName,
    steps: prepared.steps,
  });
  // The readable-step lookahead (current + upcoming) feeds prefetching.
  const translationSteps = useMemo<TranslatableStep[]>(
    () => executor.currentTranslationSteps(TRANSLATION_AHEAD_FRAME_COUNT),
    // Only changes in script position/path invalidate lookahead; art ticks do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [executor, snapshot.position, snapshot.choice?.key, snapshot.choiceTrail.length],
  );
  const translation = useStoryTranslations({
    scriptId: story.scriptId,
    steps: translationSteps,
    eligible: remoteTranslationEligible && manualTranslation.resolved && !manualTranslation.active,
    settings: translationSettings,
    manualActive: manualTranslation.active,
    manualTranslations: manualTranslation.translations,
    paused: manualTranslationBusy,
  });
  const translatedMode = japaneseStoryLoaded && translationSettings.mode === "translated";
  const currentStep = translationSteps[0] ?? null;
  const currentDisplayTranslated = translatedMode
    && currentStep?.kind === "message"
    && Boolean(translation.currentTranslated);
  const translatedTextValue = currentDisplayTranslated && currentStep
    ? translation.translatedText(currentStep) ?? null
    : null;
  const translatedSpeakerValue = translatedMode && currentStep?.kind === "message"
    ? translation.translatedSpeaker(currentStep) ?? null
    : null;
  const displaySpeaker = currentChoice
    ? "回应选择"
    : currentDisplayTranslated && translatedSpeakerValue
      ? translatedSpeakerValue
      : currentMessage?.speaker ?? "旁白";
  const selectedProviderInfo = translation.serverConfig?.providers.find(
    (provider) => provider.id === translationDraft.provider,
  );
  const localOpenAiConfig = translation.serverConfig?.localEnv?.openai;
  const translationDisplayError = useMemo(
    () => {
      if (!translatedMode || !manualTranslation.resolved || manualTranslation.active) return null;
      if (!remoteTranslationEligible) {
        return { detail: "当前本地脚本未允许使用在线翻译，且没有可用的人工译文", retryable: false };
      }
      return !translationSettings.provider || !translation.providerReady
        ? { detail: "翻译后端尚未完成配置", retryable: false }
        : translation.currentError;
    },
    [
      manualTranslation.active,
      manualTranslation.resolved,
      remoteTranslationEligible,
      translatedMode,
      translation.currentError,
      translation.providerReady,
      translationSettings.provider,
    ],
  );
  // Display lines: the revealed rich-token slice for source text, or a
  // proportionally revealed plain-text slice for translations.
  const displayLines = useMemo(() => {
    if (!currentMessage) return [];
    if (translatedTextValue !== null) {
      const chars = Array.from(translatedTextValue);
      const visibleCount = currentMessage.complete
        ? chars.length
        : currentMessage.total > 0
          ? Math.min(chars.length, Math.ceil((currentMessage.revealed / currentMessage.total) * chars.length))
          : chars.length;
      return plainTextToLines(chars.slice(0, visibleCount).join(""));
    }
    return currentMessage.lines;
  }, [currentMessage, translatedTextValue]);
  const textComplete = Boolean(currentChoice) || !currentMessage || currentMessage.complete;
  const sceneId = snapshot.background.id;
  const backgroundFallbackUrl = backgroundUrl(story.region, sceneId, snapshot.fullScreen);
  const {
    url: currentBackground,
    useFallback: useBackgroundFallback,
  } = useCustomAssetUrl({
    packageId: customPackage?.id,
    assetPath: sceneId
      ? customPackage?.assets?.backgrounds?.[sceneId]
      : undefined,
    preloadedUrl: sceneId
      ? customPackage?.assetUrls.backgrounds[sceneId]
      : undefined,
    fallbackUrl: backgroundFallbackUrl,
    fallbackUrls: snapshot.fullScreen ? [backgroundUrl(story.region, sceneId)] : [],
  });
  const previousSceneId = snapshot.background.previousId;
  const bgmName = snapshot.bgm?.name ?? (snapshot.phase === "idle" ? bgmSession?.file ?? null : null);
  const {
    url: localBgmUrl,
    usingLocalAsset: usingLocalBgm,
    loadingLocalAsset: loadingLocalBgm,
  } = useCustomAssetUrl({
    packageId: customPackage?.id,
    assetPath: bgmName
      ? customPackage?.assets?.bgm?.[bgmName]
      : undefined,
    preloadedUrl: bgmName
      ? customPackage?.assetUrls.bgm[bgmName]
      : undefined,
    fallbackUrl: "",
  });
  const progress = snapshot.messageTotal > 1
    ? (snapshot.messageOrdinal / snapshot.messageTotal) * 100
    : 0;

  const bgm = useBgm({
    region: story.region,
    fileName: bgmName,
    localUrl: usingLocalBgm ? localBgmUrl : null,
    localTitle: bgmName ?? undefined,
    localPending: loadingLocalBgm,
    unlocked: audioUnlocked,
    muted,
    volume: snapshot.bgm?.volume ?? settings.bgmVolume,
    fadeSeconds: snapshot.bgm?.fade ?? executor.stage.audio.fade,
    paused: !!snapshot.movie?.bgmPause,
    session: bgmSession,
  });

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  }, []);

  const persistTranslationSettings = useCallback((next: TranslationSettings) => {
    setTranslationSettings(next);
    saveTranslationSettings(next);
  }, []);

  const exportManualTranslationTemplate = useCallback(async () => {
    if (!japaneseStoryLoaded || !prepared.steps.length) return;
    setManualTranslationError("");
    try {
      const safeScriptId = story.scriptId.replace(/[^A-Za-z0-9._-]+/g, "_");
      await exportTextFile(
        `fgo-translation-${safeScriptId}.json`,
        manualTranslation.exportTemplate(),
        "application/json;charset=utf-8",
      );
      showToast("翻译母本已导出");
    } catch (error) {
      setManualTranslationError(error instanceof Error ? error.message : "无法导出翻译母本");
    }
  }, [japaneseStoryLoaded, manualTranslation, showToast, story.scriptId, prepared.steps.length]);

  const translateAndExportManualTranslation = useCallback(async () => {
    if (!japaneseStoryLoaded || !prepared.steps.length || !manualTranslation.resolved) return;
    if (!remoteTranslationEligible) {
      setManualTranslationError("当前脚本未允许使用在线翻译，无法执行一次性翻译");
      return;
    }
    const provider = translationSettings.provider;
    if (!provider || !translation.providerReady) {
      setManualTranslationError("请先选择并配置翻译后端，再执行一次性翻译");
      return;
    }

    const units = collectScriptTranslationUnits(prepared.steps);
    const unitBatches = collectScriptTranslationUnitBatches(prepared.steps);
    if (!units.length) {
      setManualTranslationError("当前脚本没有可翻译的文本");
      return;
    }

    translation.abortPending();
    const controller = new AbortController();
    oneShotTranslationControllerRef.current = controller;
    setManualTranslationBusy(true);
    setManualTranslationError("");
    setOneShotTranslationProgress({
      completed: 0,
      total: units.length,
      translatedCount: 0,
    });

    try {
      const cachedTranslations = loadPersistentTranslations(
        provider,
        translation.namespace,
        story.scriptId,
      );
      const machineTranslations: Record<string, CachedTranslation> = {
        ...cachedTranslations,
      };
      const result = await translateTranslationUnits({
        provider,
        scriptId: story.scriptId,
        providerConfig: providerConfigFromSettings(translationSettings),
        units,
        unitBatches,
        existingTranslations: {
          ...cachedTranslations,
          ...manualTranslation.translations,
        },
        signal: controller.signal,
        onProgress: setOneShotTranslationProgress,
        onBatch: (batch, configurationId) => {
          Object.assign(machineTranslations, batch);
          savePersistentTranslations(
            provider,
            translation.namespace,
            story.scriptId,
            machineTranslations,
            configurationId,
          );
        },
      });
      const safeScriptId = story.scriptId.replace(/[^A-Za-z0-9._-]+/g, "_");
      await exportTextFile(
        `fgo-translation-${safeScriptId}-translated.json`,
        manualTranslation.exportTemplate(result.translations),
        "application/json;charset=utf-8",
      );
      showToast(`已完成 ${units.length} 条翻译并导出人工翻译文件`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setManualTranslationError("一次性翻译已取消");
      } else if (error instanceof TranslationBatchError) {
        setManualTranslationError(
          `一次性翻译已完成 ${error.completed}/${error.total} 条，但${error.message}；未导出文件。`,
        );
      } else {
        setManualTranslationError(error instanceof Error ? error.message : "无法完成一次性翻译并导出");
      }
    } finally {
      if (oneShotTranslationControllerRef.current === controller) {
        oneShotTranslationControllerRef.current = null;
      }
      setManualTranslationBusy(false);
      setOneShotTranslationProgress(null);
    }
  }, [
    japaneseStoryLoaded,
    manualTranslation,
    prepared.steps,
    remoteTranslationEligible,
    showToast,
    story.scriptId,
    translation.namespace,
    translation.abortPending,
    translation.providerReady,
    translationSettings,
  ]);

  const cancelOneShotTranslation = useCallback(() => {
    oneShotTranslationControllerRef.current?.abort();
  }, []);

  const beginManualTranslationImport = useCallback(() => {
    setManualTranslationError("");
    manualTranslationInputRef.current?.click();
  }, []);

  const selectManualTranslationFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MANUAL_TRANSLATION_MAX_BYTES) {
      setManualTranslationError("翻译文件超过 8 MiB 限制");
      return;
    }

    setManualTranslationBusy(true);
    setManualTranslationError("");
    try {
      const imported = await manualTranslation.importTemplate(await file.text());
      persistTranslationSettings({ ...translationSettings, mode: "translated" });
      showToast(`已导入 ${imported.translatedCount} / ${imported.totalCount} 条人工译文`);
    } catch (error) {
      const detail = error instanceof ManualTranslationError || error instanceof Error
        ? error.message
        : "无法导入人工译文";
      setManualTranslationError(detail);
    } finally {
      setManualTranslationBusy(false);
    }
  }, [manualTranslation, persistTranslationSettings, showToast, translationSettings]);

  const removeManualTranslation = useCallback(async () => {
    if (!window.confirm("移除当前脚本保存在浏览器中的人工译文？原 JSON 文件不会受到影响。")) return;
    setManualTranslationBusy(true);
    setManualTranslationError("");
    try {
      await manualTranslation.remove();
      if (!remoteTranslationEligible || !translationSettings.provider || !translation.providerReady) {
        persistTranslationSettings({ ...translationSettings, mode: "source" });
      }
      showToast("已移除当前脚本的人工译文");
    } catch (error) {
      setManualTranslationError(error instanceof Error ? error.message : "无法移除人工译文");
    } finally {
      setManualTranslationBusy(false);
    }
  }, [
    manualTranslation,
    persistTranslationSettings,
    remoteTranslationEligible,
    showToast,
    translation.providerReady,
    translationSettings,
  ]);

  const openSettings = useCallback(() => {
    setTranslationDraft(localOpenAiConfig?.editable
      ? {
          ...translationSettings,
          openai: {
            ...translationSettings.openai,
            baseUrl: localOpenAiConfig.baseUrl,
            apiKey: "",
            model: localOpenAiConfig.model,
            allowNoAuth: localOpenAiConfig.allowNoAuth,
            thinkingEnabled: localOpenAiConfig.thinking === "enabled",
            thinkingLevel: localOpenAiConfig.reasoningEffort,
          },
        }
      : translationSettings);
    setOpenAiDraftDirty(false);
    setClearOpenAiApiKey(false);
    setTranslationConfigError("");
    setPanel("settings");
  }, [localOpenAiConfig, translationSettings]);

  const toggleTranslation = useCallback(() => {
    if (!japaneseStoryLoaded) return;
    if (translationSettings.mode === "translated") {
      persistTranslationSettings({ ...translationSettings, mode: "source" });
      return;
    }
    if (!manualTranslation.resolved) {
      showToast("正在读取本地人工译文");
      return;
    }
    if (manualTranslation.active) {
      persistTranslationSettings({ ...translationSettings, mode: "translated" });
      return;
    }
    if (!remoteTranslationEligible) {
      setPanel("settings");
      showToast("请先导入人工译文，或在脚本库允许使用翻译服务");
      return;
    }
    if (!translationSettings.provider || !translation.providerReady) {
      setTranslationDraft(translationSettings);
      setPanel("settings");
      showToast("请先选择并配置翻译后端");
      return;
    }
    persistTranslationSettings({ ...translationSettings, mode: "translated" });
  }, [
    japaneseStoryLoaded,
    manualTranslation.active,
    manualTranslation.resolved,
    persistTranslationSettings,
    remoteTranslationEligible,
    showToast,
    translation.providerReady,
    translationSettings,
  ]);

  const applyTranslationDraft = useCallback(async () => {
    setTranslationConfigError("");
    setTranslationConfigSaving(true);
    try {
      if (translationDraft.provider === "openai" && localOpenAiConfig?.editable) {
        await saveLocalOpenAiConfig({
          baseUrl: translationDraft.openai.baseUrl,
          model: translationDraft.openai.model,
          apiKey: translationDraft.openai.apiKey,
          allowNoAuth: translationDraft.openai.allowNoAuth,
          clearApiKey: clearOpenAiApiKey,
          thinking: translationDraft.openai.thinkingEnabled ? "enabled" : "disabled",
          reasoningEffort: translationDraft.openai.thinkingLevel,
        });
        const saved: TranslationSettings = {
          ...translationDraft,
          openai: {
            baseUrl: "",
            apiKey: "",
            model: "",
            allowNoAuth: false,
            thinkingEnabled: translationDraft.openai.thinkingEnabled,
            thinkingLevel: translationDraft.openai.thinkingLevel,
          },
        };
        persistTranslationSettings(saved);
        setTranslationDraft((value) => ({
          ...value,
          openai: { ...value.openai, apiKey: "" },
        }));
        setOpenAiDraftDirty(false);
        setClearOpenAiApiKey(false);
        await translation.refreshServerConfig();
        showToast("大模型配置已保存到 .env.local 并应用");
      } else {
        persistTranslationSettings(translationDraft);
        await translation.refreshServerConfig();
        showToast("翻译设置已保存并应用");
      }
    } catch (error) {
      setTranslationConfigError(error instanceof Error ? error.message : "无法保存翻译配置");
    } finally {
      setTranslationConfigSaving(false);
    }
  }, [
    clearOpenAiApiKey,
    localOpenAiConfig?.editable,
    persistTranslationSettings,
    showToast,
    translation,
    translationDraft,
  ]);

  const clearLocalTranslationOverrides = useCallback(async () => {
    setTranslationConfigError("");
    setTranslationConfigSaving(true);
    try {
      if (translationDraft.provider === "openai" && localOpenAiConfig?.editable) {
        await deleteLocalOpenAiConfig();
      }
      const cleared: TranslationSettings = {
        ...translationDraft,
        deepl: { authKey: "", serverUrl: "" },
        openai: {
          baseUrl: "",
          apiKey: "",
          model: "",
          allowNoAuth: false,
          thinkingEnabled: false,
          thinkingLevel: "medium",
        },
      };
      setTranslationDraft(cleared);
      persistTranslationSettings(cleared);
      setOpenAiDraftDirty(false);
      setClearOpenAiApiKey(false);
      await translation.refreshServerConfig();
      showToast(translationDraft.provider === "openai" && localOpenAiConfig?.editable
        ? "已清除 .env.local 大模型配置"
        : "已清除本地翻译凭据");
    } catch (error) {
      setTranslationConfigError(error instanceof Error ? error.message : "无法清除翻译配置");
    } finally {
      setTranslationConfigSaving(false);
    }
  }, [
    localOpenAiConfig?.editable,
    persistTranslationSettings,
    showToast,
    translation,
    translationDraft,
  ]);

  const clearTranslationCache = useCallback(() => {
    if (!window.confirm("清除所有本机机器翻译缓存？之后再次阅读可能会重新请求翻译服务；人工译文不会受到影响。")) return;
    setTranslationConfigError("");
    translation.clearCache();
    showToast("已清除翻译缓存，正在重新翻译");
  }, [showToast, translation.clearCache]);

  useEffect(() => {
    if (
      panel !== "settings"
      || translationDraft.provider !== "openai"
      || !localOpenAiConfig?.editable
      || openAiDraftDirty
    ) return;
    setTranslationDraft((value) => ({
      ...value,
      openai: {
        ...value.openai,
        baseUrl: localOpenAiConfig.baseUrl,
        apiKey: "",
        model: localOpenAiConfig.model,
        allowNoAuth: localOpenAiConfig.allowNoAuth,
        thinkingEnabled: localOpenAiConfig.thinking === "enabled",
        thinkingLevel: localOpenAiConfig.reasoningEffort,
      },
    }));
  }, [localOpenAiConfig, openAiDraftDirty, panel, translationDraft.provider]);

  useEffect(() => {
    localStorage.setItem("fgo-reader-settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(readProgressStorageKey(story.scriptId), String(readMax));
  }, [readMax, story.scriptId]);

  useEffect(() => {
    // Persist the executor cursor (instruction index, docs §7) at every
    // readable boundary — the resume unit for fast-forward replay.
    if (phase === "idle") return;
    localStorage.setItem(progressStorageKey(story.scriptId), String(snapshot.position));
  }, [phase, snapshot.position, story.scriptId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        choiceTrailStorageKey(story.scriptId),
        JSON.stringify(choiceTrail),
      );
    } catch {
      // Choice recovery is an enhancement; playback must continue if storage is full.
    }
  }, [choiceTrail, story.scriptId]);

  useEffect(() => {
    if (completed) {
      if (nextStory) {
        saveLastObservation(createLastObservation(nextStory, 0));
      } else {
        clearLastObservation();
      }
      return;
    }

    saveLastObservation(
      createLastObservation({ ...story, choiceTrail }, snapshot.position),
    );
  }, [choiceTrail, completed, nextStory, snapshot.position, story]);

  useEffect(() => {
    setBackgroundFailed(false);
  }, [currentBackground]);

  // Persist the executed path, including repeated visits and back-navigation edits.
  useEffect(() => {
    setChoiceTrail((current) => JSON.stringify(current) === JSON.stringify(snapshot.choiceTrail) ? current : snapshot.choiceTrail);
  }, [snapshot.choiceTrail]);

  // Read-progress tracks completed messages; choices count once resolved.
  useEffect(() => {
    setReadMax((current) => Math.max(current, snapshot.messageOrdinal));
  }, [snapshot.messageOrdinal]);

  useEffect(() => {
    if (phase === "choice") {
      setChoiceFocus(0);
      setSkipMode(false);
    }
  }, [phase, snapshot.choice?.key]);

  const handleTap = useCallback(() => {
    if (loading || translation.preparing) return;
    setAudioUnlocked(true);
    if (uiHidden) {
      setUiHidden(false);
      return;
    }
    if (phase === "choice") return;
    tap();
  }, [loading, phase, tap, translation.preparing, uiHidden]);

  const resolveChoice = useCallback((choiceIndex: number, continueAutoPlay = false) => {
    if (phase !== "choice" || translation.preparing) return;
    setAudioUnlocked(true);
    if (!continueAutoPlay) {
      setAutoMode(false);
      setSkipMode(false);
    }
    selectChoice(choiceIndex);
  }, [phase, selectChoice, translation.preparing]);

  const handleGoBack = useCallback(() => {
    setAutoMode(false);
    setSkipMode(false);
    setUiHidden(false);
    goBack();
  }, [goBack]);

  const advance = handleTap;

  useEffect(() => {
    if (
      !autoMode
      || snapshot.policy.hideAuto
      || !windowFocused
      || panel !== "none"
      || uiHidden
      || phase === "ended"
      || phase === "wait"
      || translation.preparing
    ) return;
    if (!textComplete) return;
    const characterCount = currentChoice
      ? choiceAutoPlaybackCharacterCount(currentChoice.options)
      : currentMessage?.total ?? 0;
    const timer = window.setTimeout(() => {
      if (currentChoice) resolveChoice(0, true);
      else tap();
    }, autoPlaybackDelayMs(characterCount));
    return () => window.clearTimeout(timer);
  }, [
    autoMode,
    snapshot.policy.hideAuto,
    currentChoice,
    currentMessage?.total,
    panel,
    phase,
    resolveChoice,
    tap,
    textComplete,
    translation.preparing,
    uiHidden,
    windowFocused,
  ]);

  useEffect(() => {
    if (!skipMode || panel !== "none" || phase === "ended") return;
    if (phase === "choice") {
      setSkipMode(false);
      return;
    }
    if (!settings.skipUnread && snapshot.messageOrdinal > readMax) {
      setSkipMode(false);
      showToast("已到达未读内容，跳读已暂停");
      return;
    }
    const timer = window.setInterval(() => {
      tap();
    }, 95);
    return () => window.clearInterval(timer);
  }, [panel, phase, readMax, settings.skipUnread, snapshot.messageOrdinal, showToast, skipMode, tap]);

  useEffect(() => {
    if (!ctrlHeld || panel !== "none" || phase === "choice" || phase === "ended") return;
    const timer = window.setInterval(() => {
      tap();
    }, 80);
    return () => window.clearInterval(timer);
  }, [ctrlHeld, panel, phase, tap]);

  const saveBookmark = useCallback(() => {
    const value: ReaderBookmark = {
      scriptId: story.scriptId,
      scriptUrl: story.scriptUrl,
      title: story.title,
      subtitle: story.subtitle,
      frameIndex: snapshot.position,
      savedAt: Date.now(),
      region: story.region,
      sequence: story.sequence,
      sequenceIndex: story.sequenceIndex,
      choiceTrail,
    };
    localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(value));
    showToast("已保存当前位置");
  }, [choiceTrail, snapshot.position, showToast, story]);

  const toggleFullscreen = useCallback(() => {
    void toggleApplicationFullscreen().catch(() => showToast("当前设备未允许全屏"));
  }, [showToast]);

  useEffect(() => registerAndroidBackHandler(() => {
    if (panel !== "none" || completed) {
      setPanel("none");
      return true;
    }
    void leaveApplicationFullscreen().catch(() => undefined);
    onExit();
    return true;
  }), [completed, onExit, panel]);

  useEffect(() => () => {
    void leaveApplicationFullscreen().catch(() => undefined);
  }, []);

  useEffect(() => {
    const focus = () => setWindowFocused(true);
    const blur = () => {
      setWindowFocused(false);
      setCtrlHeld(false);
    };
    window.addEventListener("focus", focus);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === "Escape") {
        target?.blur();
        setPanel("none");
        return;
      }
      if (target?.matches("input, textarea, select, [contenteditable='true']")) {
        return;
      }

      if (event.key === "Control") {
        setCtrlHeld(true);
        return;
      }

      if (event.code === "KeyT" && (panel === "none" || panel === "log")) {
        toggleTranslation();
        return;
      }

      if (panel !== "none") return;

      if (phase === "choice" && currentChoice) {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setChoiceFocus((value) => (value - 1 + currentChoice.options.length) % currentChoice.options.length);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setChoiceFocus((value) => (value + 1) % currentChoice.options.length);
          return;
        }
        if (/^[1-9]$/.test(event.key)) {
          resolveChoice(Number(event.key) - 1);
          return;
        }
        if (event.key === "Enter" || event.code === "Space") {
          event.preventDefault();
          resolveChoice(choiceFocus);
          return;
        }
      }

      switch (event.code) {
        case "ArrowLeft":
          event.preventDefault();
          handleGoBack();
          break;
        case "Enter":
        case "Space":
        case "PageDown":
          event.preventDefault();
          advance();
          break;
        case "PageUp":
          event.preventDefault();
          if (!snapshot.policy.hideLog) setPanel("log");
          break;
        case "KeyA":
          if (!snapshot.policy.hideAuto) setAutoMode((value) => !value);
          setSkipMode(false);
          break;
        case "KeyS":
          setSkipMode((value) => !value);
          setAutoMode(false);
          break;
        case "KeyL":
          if (!snapshot.policy.hideLog) setPanel("log");
          break;
        case "KeyH":
          setUiHidden((value) => !value);
          break;
        case "KeyM":
          setMuted((value) => !value);
          setAudioUnlocked(true);
          break;
        case "KeyB":
          saveBookmark();
          break;
        case "KeyF":
          toggleFullscreen();
          break;
        case "Slash":
          if (event.shiftKey) setPanel("shortcuts");
          break;
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === "Control") setCtrlHeld(false);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [advance, choiceFocus, currentChoice, handleGoBack, panel, phase, resolveChoice, saveBookmark, toggleFullscreen, toggleTranslation, snapshot.policy.hideAuto, snapshot.policy.hideLog]);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    oneShotTranslationControllerRef.current?.abort();
  }, []);

  const logEntries = snapshot.log;

  const stageStyle = {
    "--stage-background": currentBackground ? `url("${currentBackground}")` : "none",
    "--story-progress": `${progress}%`,
  } as CSSProperties;
  const activeCoordinateDebugSettings = COORDINATE_DEBUG_ENABLED
    ? coordinateDebugOffsets : DISABLED_COORDINATE_DEBUG_SETTINGS;

  const updateCoordinateDebugOffset = (
    group: "screenOrigin" | "characterOrigin",
    axis: "x" | "y",
    rawValue: string,
  ) => {
    setCoordinateDebugInputValues((current) => ({
      ...current,
      [group]: { ...current[group], [axis]: rawValue },
    }));
    if (!rawValue.trim() || rawValue.trim() === "-") return;
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < -1 || value > 1) return;
    setCoordinateDebugOffsets((current) => ({
      ...current,
      [group]: { ...current[group], [axis]: value },
    }));
  };

  const resetCoordinateDebugOffsets = () => {
    const defaults: CoordinateDebugSettings = {
      screenOrigin: { ...DEBUG_COORDINATE_OFFSETS.screenOrigin },
      characterOrigin: { ...DEBUG_COORDINATE_OFFSETS.characterOrigin },
      showScreenOrigin: DEBUG_COORDINATE_OFFSETS.showScreenOrigin,
      showCharacterOrigin: DEBUG_COORDINATE_OFFSETS.showCharacterOrigin,
    };
    setCoordinateDebugOffsets(defaults);
    setCoordinateDebugInputValues(coordinateDebugInputValuesFrom(defaults));
  };

  const stageClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, input, select, .reader-panel")) return;
    advance();
  };

  const handleReplay = () => {
    replay();
    setChoiceTrail([]);
    setAutoMode(false);
    setSkipMode(false);
  };

  return (
    <div className={`reader-shell ${settings.reduceMotion ? "reduce-motion" : ""}`} style={{ ...stageStyle, backgroundColor: snapshot.presentation.backColor ?? undefined }}>
      <div className="letterbox-background" aria-hidden="true" style={{ background: snapshot.presentation.backColor ?? "transparent" }} />
      <div
        className={`reader-stage ${uiHidden ? "ui-hidden" : ""}`}
        onClick={stageClick}
      >
        <StoryStage
          snapshot={snapshot}
          region={story.region}
          customPackage={customPackage}
          currentBackground={backgroundFailed ? "" : currentBackground}
          onBackgroundError={() => {
            if (!useBackgroundFallback()) setBackgroundFailed(true);
          }}
          debug={activeCoordinateDebugSettings}
        />
        {snapshot.movie && <MoviePlayer movie={snapshot.movie} customPackage={customPackage} onFinish={() => executor.finishMovie()} onProgress={(name, elapsed, duration) => executor.updateMovie(name, elapsed, duration)} />}
        {snapshot.notification && <div className="adv-notification" role="dialog" aria-modal="true" aria-label={snapshot.notification.title} onClick={event => event.stopPropagation()}><article><h2>{snapshot.notification.title}</h2><p>{snapshot.notification.text}</p><button onClick={tap}>确定</button></article></div>}

        {!uiHidden && (
          <>
            <header className="reader-header" onClick={(event) => event.stopPropagation()}>
              <div className="reader-title-block">
                <button className="round-tool" onClick={onExit} aria-label="返回目录"><ArrowLeft size={19} /></button>
                <div>
                  <small>{story.subtitle || `${story.region} / STORY RECORD`}</small>
                  <strong>{story.title}</strong>
                </div>
              </div>
              <div className="reader-toolbar">
                <ToggleButton
                  label="后退"
                  shortcut="←"
                  icon={<ChevronLeft size={16} />}
                  onClick={handleGoBack}
                  disabled={snapshot.boundaryCount < 2}
                />
                {!snapshot.policy.hideLog && <ToggleButton label="记录" shortcut="L" icon={<MessageSquareText size={16} />} onClick={() => setPanel("log")} />}
                {japaneseStoryLoaded && (
                  <ToggleButton
                    active={translatedMode}
                    label={translatedMode ? "原文" : "译文"}
                    shortcut="T"
                    icon={translation.preparing || translation.currentPending
                      ? <LoaderCircle className="spin" size={16} />
                      : <Languages size={16} />}
                    onClick={toggleTranslation}
                  />
                )}
                {!snapshot.policy.hideAuto && <ToggleButton active={autoMode} label="自动" shortcut="A" icon={autoMode ? <Pause size={16} /> : <Play size={16} />} onClick={() => { setAutoMode((value) => !value); setSkipMode(false); }} />}
                <ToggleButton active={skipMode} label="跳读" shortcut="S" icon={<SkipForward size={16} />} onClick={() => { setSkipMode((value) => !value); setAutoMode(false); }} />
                <button className={`round-tool ${muted ? "active" : ""}`} onClick={() => { setMuted((value) => !value); setAudioUnlocked(true); }} aria-label={muted ? "恢复声音" : "静音"}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
                <button className="round-tool" onClick={openSettings} aria-label="设置"><Settings size={18} /></button>
              </div>
            </header>

            {snapshot.diagnostics.length > 0 && (
              <button className="reader-compatibility" onClick={openSettings}>
                演出兼容提示 · {snapshot.diagnostics.length} 项
              </button>
            )}

            <div className="reader-side-status">
              <span>{String(Math.min(snapshot.messageOrdinal + (phase === "message" ? 0 : 1), Math.max(snapshot.messageTotal, 1))).padStart(3, "0")}</span>
              <i />
              <small>{String(Math.max(snapshot.messageTotal, 1)).padStart(3, "0")}</small>
            </div>

            {phase === "choice" && currentChoice && (
              <div className="choice-menu" data-centering={snapshot.policy.selectionCentering} onClick={(event) => event.stopPropagation()}>
                <p>SELECT RESPONSE</p>
                {currentChoice.options.map((option, optionIndex) => (
                  <button
                    key={`${option.label}-${optionIndex}`}
                    className={`${choiceFocus === optionIndex ? "focused" : ""} ${currentChoice.selected === optionIndex ? "selected" : ""}`}
                    disabled={currentChoice.selected !== null && currentChoice.selected !== optionIndex}
                    onMouseEnter={() => setChoiceFocus(optionIndex)}
                    onClick={() => resolveChoice(optionIndex)}
                  >
                    <kbd>{optionIndex + 1}</kbd>
                    <span>
                      {/* Choice groups stay in one language: any missing
                          option translation falls back to the source labels. */}
                      {translatedMode && currentStep?.kind === "choice" && translation.stepTranslated(currentStep)
                        ? translation.translatedChoice(currentStep, optionIndex) ?? option.label
                        : option.label}
                    </span>
                    <ChevronDown size={17} />
                  </button>
                ))}
              </div>
            )}

            {(phase === "message" || phase === "choice") && (
              <div
                className="dialogue-wrap"
                data-skin={snapshot.messageStyle.skin}
                data-screen-background={snapshot.messageStyle.screen?.background}
                style={{ transform: `translate(${stageCoordinateToViewport(snapshot.messageStyle.shake.x, "x")}, ${stageCoordinateToViewport(snapshot.messageStyle.shake.y, "y")})`, fontFamily: snapshot.messageStyle.font === "normal" ? undefined : "serif", ...(snapshot.messageStyle.screen ? { left: `calc(50% + ${stageCoordinateToViewport(snapshot.messageStyle.screen.x, "x")})`, top: `calc(50% + ${stageCoordinateToViewport(snapshot.messageStyle.screen.y, "y")})`, bottom: "auto", width: stageCoordinateToViewport(snapshot.messageStyle.screen.width, "x"), height: stageCoordinateToViewport(snapshot.messageStyle.screen.height, "x") } : {}) }}
              >
                <div className="dialogue-track" aria-hidden="true">
                  <span className="track-fill" />
                  {Array.from({ length: 13 }).map((_, nodeIndex) => <i key={nodeIndex} />)}
                </div>
                <div className="speaker-plate" data-name-back={snapshot.messageStyle.nameBack ?? undefined} style={{ backgroundImage: snapshot.messageStyle.nameBack && customPackage?.assetUrls.images?.[snapshot.messageStyle.nameBack] ? `url("${customPackage.assetUrls.images[snapshot.messageStyle.nameBack]}")` : undefined }}>
                  <small>{phase === "choice" ? "MASTER" : "SPEAKER"}</small>
                  <strong>{displaySpeaker}</strong>
                </div>
                <div className="dialogue-box" data-vertical-align={snapshot.messageStyle.verticalAlign}>
                  <RuntimeEffects snapshot={snapshot} region={story.region} customPackage={customPackage} scope="message" />
                  <p className="dialogue-text" style={{ lineHeight: snapshot.messageStyle.lineHeight === null ? undefined : `calc(${Math.max(1, snapshot.messageStyle.lineHeight)} * var(--adv-unit))` }}>
                    {phase === "choice"
                      ? "请选择你的回应。"
                      : <RichMessageLines lines={displayLines} region={story.region} customPackage={customPackage} />}
                  </p>
                  {phase === "message" && textComplete && !translation.preparing && (
                    <span className="advance-indicator" aria-label="继续"><ChevronDown size={20} /></span>
                  )}
                  <div className="dialogue-meta">
                    <span>LOG {String(Math.max(snapshot.messageOrdinal, 1)).padStart(3, "0")}</span>
                    {translatedMode && (
                      <span className="translation-state">
                        {manualTranslation.active
                          ? currentDisplayTranslated
                            ? "IMPORTED"
                            : "SOURCE FALLBACK"
                          : translation.preparing
                            ? `PREPARING ${translation.preparationReadyCount}/${translation.preparationTotal}`
                            : translation.currentPending
                          ? "TRANSLATING"
                          : currentDisplayTranslated
                            ? `已译未读 ${translation.translatedUnreadStepCount} 句`
                            : "SOURCE FALLBACK"}
                      </span>
                    )}
                    <span>{autoMode ? "AUTO" : skipMode ? "SKIP" : ctrlHeld ? "FAST" : "MANUAL"}</span>
                  </div>
                </div>
              </div>
            )}

            {phase === "wait" && (
              <button
                className={`animation-advance ${snapshot.waitKind === "timer" ? "timed" : ""}`}
                onClick={advance}
                aria-label={snapshot.waitKind === "timer" ? "跳过演出" : "继续演出"}
              >
                <span>{snapshot.waitKind === "timer" ? "演出中" : "继续演出"}</span>
                <ChevronDown size={19} />
              </button>
            )}

            {translatedMode && translation.preparing && (
              <div className="translation-note" onClick={(event) => event.stopPropagation()}>
                <LoaderCircle className="spin" size={16} />
                <span>
                  正在翻译当前帧 {translation.preparationReadyCount}/{translation.preparationTotal}，
                  完成后即可阅读；后台将持续预译后续 {translation.translatedUnreadStepTarget} 句。
                </span>
              </div>
            )}

            {translatedMode && translationDisplayError && (
              <div className="translation-note" onClick={(event) => event.stopPropagation()}>
                <CircleAlert size={16} />
                <span>{translationDisplayError.detail}，当前继续显示原文。</span>
                {translation.currentError && (
                  <button onClick={translation.retryCurrent}><RefreshCw size={14} /> 重试</button>
                )}
                <button onClick={openSettings}><Settings size={14} /> 设置</button>
              </div>
            )}

            <div className="bgm-chip" onClick={(event) => event.stopPropagation()}>
              <span className={bgm.status === "playing" ? "playing" : ""}><Music2 size={15} /></span>
              <div>
                <small>{bgm.status === "locked" ? "CLICK TO ENABLE AUDIO" : "NOW PLAYING"}</small>
                <strong>{bgm.title}</strong>
              </div>
              {bgm.status === "locked" && <button onClick={() => setAudioUnlocked(true)}>开启</button>}
            </div>
          </>
        )}

        {uiHidden && (
          <button className="restore-ui" onClick={(event) => { event.stopPropagation(); setUiHidden(false); }}>
            <EyeOff size={17} /> H / 点击恢复界面
          </button>
        )}

        {loadNote && !loading && (
          <div className="load-note"><CircleAlert size={17} /> {loadNote}</div>
        )}

        {toast && <div className="reader-toast"><Check size={16} /> {toast}</div>}

        {panel === "log" && (
          <div className="reader-panel log-panel" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div><small>BACKLOG</small><h2>历史记录</h2></div>
              <div className="panel-header-actions">
                {japaneseStoryLoaded && (
                  <button
                    className={translatedMode ? "active" : ""}
                    onClick={toggleTranslation}
                    aria-label={translatedMode ? "显示日文原文" : "显示简体中文译文"}
                  >
                    <Languages size={18} />
                  </button>
                )}
                <button onClick={() => setPanel("none")} aria-label="关闭历史记录"><X size={20} /></button>
              </div>
            </div>
            <div className="log-list">
              {logEntries.map((entry, index) => {
                const step: TranslatableStep = {
                  key: entry.key,
                  kind: "message",
                  speaker: entry.speaker,
                  text: entry.text,
                };
                const entryTranslated = translatedMode && translation.stepTranslated(step);
                return (
                  <button
                    key={`${entry.key}-${index}`}
                    onClick={() => { jumpToMessage(entry.key); setPanel("none"); }}
                  >
                    <span>{String(index + 1).padStart(3, "0")}</span>
                    <div>
                      <strong>
                        {entryTranslated
                          ? translation.translatedSpeaker(step) ?? entry.speaker
                          : entry.speaker}
                      </strong>
                      <p className="adv-log-text" style={{ fontFamily: snapshot.messageStyle.font === "normal" ? undefined : "serif", lineHeight: snapshot.messageStyle.lineHeight === null ? undefined : `${Math.max(1, snapshot.messageStyle.lineHeight) / 29}em` }}>
                        {entryTranslated
                          ? translation.translatedText(step) ?? entry.text
                          : entry.text}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {panel === "settings" && (
          <div className="reader-panel settings-panel" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div><small>PLAYBACK CONFIG</small><h2>阅读设置</h2></div>
              <button onClick={() => setPanel("none")}><X size={20} /></button>
            </div>
            <div className="settings-list">
              {snapshot.diagnostics.length > 0 && (
                <div className="settings-info">
                  <span><strong>演出兼容性</strong><small>以下指令需要额外资源或实现</small></span>
                  <p>{snapshot.diagnostics.map((item) => `${item.tag}（第 ${item.line} 行）：${item.reason}`).join("\n")}</p>
                </div>
              )}
              <label>
                <span><strong>文字速度</strong><small>{settings.textSpeed} ms / 字</small></span>
                <input type="range" min="10" max="70" step="2" value={settings.textSpeed} onChange={(event) => setSettings((value) => ({ ...value, textSpeed: Number(event.target.value) }))} />
              </label>
              <div className="settings-info">
                <span><strong>自动播放间隔</strong><small>按当前字数动态计算</small></span>
                <p>普通文本：（0.2 × 字数 + 0.5）秒<br />分支：所有选项字数总和 × 0.2 + 0.5 秒<br />演出动画：使用脚本定义时长</p>
              </div>
              <label>
                <span><strong>BGM 音量</strong><small>{Math.round(settings.bgmVolume * 100)}%</small></span>
                <input type="range" min="0" max="1" step="0.02" value={settings.bgmVolume} onChange={(event) => { setAudioUnlocked(true); setSettings((value) => ({ ...value, bgmVolume: Number(event.target.value) })); }} />
              </label>
              <label className="text-setting">
                <span><strong>御主名称</strong><small>下次载入脚本时生效</small></span>
                <input value={settings.masterName} maxLength={16} onChange={(event) => setSettings((value) => ({ ...value, masterName: event.target.value || "御主" }))} />
              </label>
              <label className="text-setting">
                <span><strong>御主性别</strong><small>下次载入脚本时生效</small></span>
                <select value={settings.masterGender} onChange={(event) => setSettings((value) => ({ ...value, masterGender: event.target.value === "female" ? "female" : "male" }))}>
                  <option value="male">男性</option><option value="female">女性</option>
                </select>
              </label>
              <label className="switch-setting">
                <span><strong>允许跳过未读</strong><small>开启后，跳读不会在新内容前停下</small></span>
                <input type="checkbox" checked={settings.skipUnread} onChange={(event) => setSettings((value) => ({ ...value, skipUnread: event.target.checked }))} />
                <i />
              </label>
              <label className="switch-setting">
                <span><strong>减少动态效果</strong><small>关闭震屏、转场和逐字显示</small></span>
                <input type="checkbox" checked={settings.reduceMotion} onChange={(event) => setSettings((value) => ({ ...value, reduceMotion: event.target.checked }))} />
                <i />
              </label>

              {/* DEBUG ONLY: remove this section with coordinateDebug.ts after calibration. */}
              {COORDINATE_DEBUG_ENABLED && (
                <section className="coordinate-debug-section" aria-label="坐标调试">
                  <div className="coordinate-debug-heading">
                    <span><Gauge size={17} /><strong>坐标调试</strong></span>
                    <small>原生坐标 · 原点 0,0</small>
                  </div>
                  <div className="coordinate-debug-grid">
                    <label className="coordinate-debug-field">
                      <span><strong>画面原点 X</strong><small>比例，1 = 100%</small></span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={coordinateDebugInputValues.screenOrigin.x}
                        onChange={(event) => updateCoordinateDebugOffset("screenOrigin", "x", event.target.value)}
                      />
                    </label>
                    <label className="coordinate-debug-field">
                      <span><strong>画面原点 Y</strong><small>比例，1 = 100%</small></span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={coordinateDebugInputValues.screenOrigin.y}
                        onChange={(event) => updateCoordinateDebugOffset("screenOrigin", "y", event.target.value)}
                      />
                    </label>
                    <label className="coordinate-debug-field">
                      <span><strong>角色原点 X</strong><small>比例，1 = 100%</small></span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={coordinateDebugInputValues.characterOrigin.x}
                        onChange={(event) => updateCoordinateDebugOffset("characterOrigin", "x", event.target.value)}
                      />
                    </label>
                    <label className="coordinate-debug-field">
                      <span><strong>角色原点 Y</strong><small>比例，1 = 100%</small></span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={coordinateDebugInputValues.characterOrigin.y}
                        onChange={(event) => updateCoordinateDebugOffset("characterOrigin", "y", event.target.value)}
                      />
                    </label>
                  </div>
                  <label className="coordinate-debug-switch switch-setting">
                    <span><strong>显示画面 0,0 点</strong><small>显示全局最终合成原点</small></span>
                    <input
                      type="checkbox"
                      checked={coordinateDebugOffsets.showScreenOrigin}
                      onChange={(event) => setCoordinateDebugOffsets((value) => ({
                        ...value,
                        showScreenOrigin: event.target.checked,
                      }))}
                    />
                    <i />
                  </label>
                  <label className="coordinate-debug-switch switch-setting">
                    <span><strong>显示角色 0,0 点</strong><small>显示每个角色最终合成锚点</small></span>
                    <input
                      type="checkbox"
                      checked={coordinateDebugOffsets.showCharacterOrigin}
                      onChange={(event) => setCoordinateDebugOffsets((value) => ({
                        ...value,
                        showCharacterOrigin: event.target.checked,
                      }))}
                    />
                    <i />
                  </label>
                  <p className="coordinate-debug-note">正式校准已直接作用于程序；此处为额外临时偏移。比例值 1 = 100%，负值表示反向；修改仅当前阅读会话有效。</p>
                  <button type="button" className="coordinate-debug-reset" onClick={resetCoordinateDebugOffsets}>
                    <RotateCcw size={14} /> 重置调试偏移
                  </button>
                </section>
              )}

              <section className="translation-settings-section">
                <div className="translation-settings-heading">
                  <span><Languages size={17} /><strong>日文翻译</strong></span>
                  <small>JA → 简体中文</small>
                </div>

                {japaneseStoryLoaded && (
                  <div className="manual-translation-section">
                    <input
                      ref={manualTranslationInputRef}
                      className="custom-file-input"
                      type="file"
                      accept=".json,application/json"
                      onChange={(event) => void selectManualTranslationFile(event)}
                    />
                    <div className="manual-translation-status">
                      <span>
                        <strong>人工翻译文件</strong>
                        <small>当前脚本 {story.scriptId}</small>
                      </span>
                      <em className={manualTranslation.active ? "ready" : manualTranslation.status === "stale" ? "stale" : ""}>
                        {!manualTranslation.resolved
                          ? "LOADING"
                          : manualTranslation.active
                            ? `${manualTranslation.translatedCount}/${manualTranslation.totalCount}`
                            : manualTranslation.status === "stale"
                              ? "STALE"
                              : "NOT IMPORTED"}
                      </em>
                    </div>
                    <p>
                      {manualTranslation.active
                        ? "人工译文已启用；未填写的条目显示日文原文，本脚本不会调用在线翻译。"
                        : manualTranslation.status === "stale"
                          ? "已保存的译文与当前脚本或御主名称不一致，请重新导出母本并导入。"
                          : "导出全部日文文本，填写 translatedText 后再导入；所有选择分支都会包含在母本中。"}
                    </p>
                    {!remoteTranslationEligible && (
                      <small className="manual-translation-offline-note">
                        此自定义脚本未允许使用翻译服务，但离线导入和显示人工译文不受影响。
                      </small>
                    )}
                    <div className="manual-translation-actions">
                      <button
                        type="button"
                        onClick={exportManualTranslationTemplate}
                        disabled={manualTranslationBusy || !manualTranslation.resolved}
                      >
                        <Download size={15} /> 导出翻译母本
                      </button>
                      {remoteTranslationEligible && (
                        <>
                          <button
                            type="button"
                            className="primary"
                            onClick={() => void translateAndExportManualTranslation()}
                            disabled={
                              manualTranslationBusy
                              || !manualTranslation.resolved
                              || !translationSettings.provider
                              || !translation.providerReady
                            }
                            title="调用当前翻译后端，翻译本节全部文本后导出为人工翻译 JSON"
                          >
                            {oneShotTranslationProgress
                              ? <LoaderCircle className="spin" size={15} />
                              : <Languages size={15} />}
                            {oneShotTranslationProgress
                              ? <>
                                <span>翻译中 {oneShotTranslationProgress.completed}/{oneShotTranslationProgress.total}</span>
                                <small className="manual-translation-tps">
                                  TPS {typeof oneShotTranslationProgress.tps === "number"
                                    ? `${oneShotTranslationProgress.tps.toFixed(1)} tok/s`
                                    : "—"}
                                </small>
                              </>
                              : "一次性翻译并导出"}
                          </button>
                          {oneShotTranslationProgress && (
                            <button type="button" onClick={cancelOneShotTranslation}>
                              <X size={15} /> 取消翻译
                            </button>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        className="primary"
                        onClick={beginManualTranslationImport}
                        disabled={manualTranslationBusy || !manualTranslation.resolved}
                      >
                        {manualTranslationBusy ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />}
                        导入译文
                      </button>
                      {manualTranslation.hasRecord && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => void removeManualTranslation()}
                          disabled={manualTranslationBusy}
                        >
                          <Trash2 size={15} /> 移除
                        </button>
                      )}
                    </div>
                    {(manualTranslationError || manualTranslation.storageError) && (
                      <div className="translation-experimental-note translation-config-error">
                        <CircleAlert size={16} />
                        <span>{manualTranslationError || manualTranslation.storageError}</span>
                      </div>
                    )}
                  </div>
                )}

                <label className="text-setting">
                  <span>
                    <strong>翻译后端</strong>
                    <small>
                      {selectedProviderInfo
                        ? selectedProviderInfo.experimental
                          ? "实验性非官方接口"
                          : translationDraft.provider === "openai" && localOpenAiConfig?.editable
                            ? selectedProviderInfo.serverConfigured
                              ? ".env.local 已配置"
                              : "保存到 .env.local"
                          : selectedProviderInfo.serverConfigured
                            ? "服务端已配置"
                            : "需要页面配置"
                        : "必须手动选择"}
                    </small>
                  </span>
                  <select
                    value={translationDraft.provider ?? ""}
                    onChange={(event) => {
                      setTranslationDraft((value) => ({
                        ...value,
                        provider: event.target.value
                          ? event.target.value as TranslationSettings["provider"]
                          : null,
                      }));
                      setOpenAiDraftDirty(false);
                      setClearOpenAiApiKey(false);
                      setTranslationConfigError("");
                    }}
                  >
                    <option value="">请选择后端</option>
                    <option value="deepl">DeepL</option>
                    <option value="openai">OpenAI 兼容</option>
                    <option value="bing">Bing / Edge（实验性）</option>
                  </select>
                </label>

                {translationDraft.provider === "deepl" && (
                  <div className="translation-provider-fields">
                    <label className="text-setting">
                      <span><strong>DeepL 密钥</strong><small>留空使用服务端环境变量</small></span>
                      <input
                        type="password"
                        autoComplete="off"
                        value={translationDraft.deepl.authKey}
                        onChange={(event) => setTranslationDraft((value) => ({
                          ...value,
                          deepl: { ...value.deepl, authKey: event.target.value },
                        }))}
                      />
                    </label>
                    <label className="text-setting">
                      <span><strong>DeepL 地址</strong><small>留空自动判断 Free / Pro</small></span>
                      <input
                        type="url"
                        placeholder="https://api-free.deepl.com"
                        value={translationDraft.deepl.serverUrl}
                        onChange={(event) => setTranslationDraft((value) => ({
                          ...value,
                          deepl: { ...value.deepl, serverUrl: event.target.value },
                        }))}
                      />
                    </label>
                  </div>
                )}

                {translationDraft.provider === "openai" && (
                  <div className="translation-provider-fields">
                    {localOpenAiConfig?.editable && (
                      <div className={`translation-env-status ${selectedProviderInfo?.serverConfigured ? "ready" : ""}`}>
                        <HardDrive size={17} />
                        <span>
                          <strong>{localOpenAiConfig.fileName}</strong>
                          <small>本机服务端配置 · 密钥不回传浏览器</small>
                        </span>
                        <em>{selectedProviderInfo?.serverConfigured ? "READY" : "EDITABLE"}</em>
                      </div>
                    )}
                    <label className="text-setting">
                      <span><strong>API Base URL</strong><small>API 根路径，通常以 /v1 结尾</small></span>
                      <input
                        type="url"
                        placeholder="http://127.0.0.1:11434/v1"
                        value={translationDraft.openai.baseUrl}
                        onChange={(event) => {
                          setOpenAiDraftDirty(true);
                          setTranslationDraft((value) => ({
                            ...value,
                            openai: { ...value.openai, baseUrl: event.target.value },
                          }));
                        }}
                      />
                    </label>
                    <label className="text-setting">
                      <span><strong>模型</strong><small>Chat Completions 模型 ID</small></span>
                      <input
                        value={translationDraft.openai.model}
                        onChange={(event) => {
                          setOpenAiDraftDirty(true);
                          setTranslationDraft((value) => ({
                            ...value,
                            openai: { ...value.openai, model: event.target.value },
                          }));
                        }}
                      />
                    </label>
                    <label className="text-setting">
                      <span>
                        <strong>API 密钥</strong>
                        <small>
                          {localOpenAiConfig?.editable
                            ? translationDraft.openai.apiKey
                              ? "保存后替换现有密钥"
                              : clearOpenAiApiKey
                                ? "保存后清除现有密钥"
                                : localOpenAiConfig.apiKeyConfigured
                                  ? "已保存，留空保持不变"
                                  : "尚未保存"
                            : "留空使用服务端环境变量"}
                        </small>
                      </span>
                      <input
                        type="password"
                        autoComplete="off"
                        disabled={translationDraft.openai.allowNoAuth}
                        placeholder={localOpenAiConfig?.apiKeyConfigured ? "••••••••（已保存）" : ""}
                        value={translationDraft.openai.apiKey}
                        onChange={(event) => {
                          setOpenAiDraftDirty(true);
                          setClearOpenAiApiKey(false);
                          setTranslationDraft((value) => ({
                            ...value,
                            openai: { ...value.openai, apiKey: event.target.value },
                          }));
                        }}
                      />
                    </label>
                    <label className="switch-setting compact-switch thinking-setting">
                      <span>
                        <strong>启用思考</strong>
                        <small>向兼容接口发送 thinking.type 参数</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={translationDraft.openai.thinkingEnabled}
                        onChange={(event) => {
                          setOpenAiDraftDirty(true);
                          setTranslationDraft((value) => ({
                            ...value,
                            openai: { ...value.openai, thinkingEnabled: event.target.checked },
                          }));
                        }}
                      />
                      <i />
                    </label>
                    <label className="text-setting thinking-level-setting">
                      <span>
                        <strong>思考强度</strong>
                        <small>
                          {translationDraft.openai.thinkingEnabled
                            ? `当前 ${translationDraft.openai.thinkingLevel}`
                            : "关闭时使用 disabled"}
                        </small>
                      </span>
                      <select
                        disabled={!translationDraft.openai.thinkingEnabled}
                        value={translationDraft.openai.thinkingLevel}
                        onChange={(event) => {
                          setOpenAiDraftDirty(true);
                          setTranslationDraft((value) => ({
                            ...value,
                            openai: {
                              ...value.openai,
                              thinkingLevel: event.target.value as ThinkingLevel,
                            },
                          }));
                        }}
                      >
                        {thinkingLevelOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="switch-setting compact-switch">
                      <span><strong>接口无需鉴权</strong><small>仅用于本机自建兼容服务</small></span>
                      <input
                        type="checkbox"
                        checked={translationDraft.openai.allowNoAuth}
                        onChange={(event) => {
                          setOpenAiDraftDirty(true);
                          setTranslationDraft((value) => ({
                            ...value,
                            openai: { ...value.openai, allowNoAuth: event.target.checked },
                          }));
                        }}
                      />
                      <i />
                    </label>
                    {localOpenAiConfig?.editable && localOpenAiConfig.apiKeyConfigured && (
                      <label className="switch-setting compact-switch clear-secret-switch">
                        <span><strong>清除已保存密钥</strong><small>仅在下次保存时执行</small></span>
                        <input
                          type="checkbox"
                          checked={clearOpenAiApiKey}
                          onChange={(event) => {
                            setOpenAiDraftDirty(true);
                            setClearOpenAiApiKey(event.target.checked);
                            if (event.target.checked) {
                              setTranslationDraft((value) => ({
                                ...value,
                                openai: { ...value.openai, apiKey: "" },
                              }));
                            }
                          }}
                        />
                        <i />
                      </label>
                    )}
                  </div>
                )}

                {translationDraft.provider === "bing" && (
                  <div className="translation-experimental-note">
                    <CircleAlert size={16} />
                    <span>Bing 使用免密的 Edge 非官方链路，可能随时失效、限流或被策略阻断。</span>
                  </div>
                )}

                {translation.serverConfigError && (
                  <div className="translation-experimental-note">
                    <CircleAlert size={16} />
                    <span>{translation.serverConfigError}</span>
                  </div>
                )}

                {translationConfigError && (
                  <div className="translation-experimental-note translation-config-error">
                    <CircleAlert size={16} />
                    <span>{translationConfigError}</span>
                  </div>
                )}

                <p className="translation-storage-warning">
                  {translationDraft.provider === "openai" && localOpenAiConfig?.editable
                    ? "Base URL、模型、思考设置和密钥写入项目根目录 .env.local；已保存密钥只返回配置状态，不返回明文。机器翻译缓存可单独清除，人工译文不会受到影响。"
                    : "页面配置会按你的选择明文保存在 localStorage；仅建议在自己的本机浏览器中使用。机器翻译缓存可单独清除，人工译文不会受到影响。"}
                </p>
                <div className="translation-settings-actions">
                  <button className="primary" onClick={applyTranslationDraft} disabled={translationConfigSaving}>
                    {translationConfigSaving ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}
                    {translationDraft.provider === "openai" && localOpenAiConfig?.editable ? "保存到 .env.local" : "保存并应用"}
                  </button>
                  <button onClick={clearLocalTranslationOverrides} disabled={translationConfigSaving}>
                    <Trash2 size={15} />
                    {translationDraft.provider === "openai" && localOpenAiConfig?.editable ? "清除 .env.local 配置" : "清除本地凭据"}
                  </button>
                  <button
                    className="danger"
                    onClick={clearTranslationCache}
                    disabled={translationConfigSaving || manualTranslationBusy}
                  >
                    <Trash2 size={15} /> 清除翻译缓存
                  </button>
                </div>
              </section>
            </div>
            <button className="shortcut-link" onClick={() => setPanel("shortcuts")}><Keyboard size={17} /> 查看 PC 快捷键</button>
          </div>
        )}

        {panel === "shortcuts" && (
          <div className="reader-panel shortcuts-panel" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div><small>KEYBOARD MAP</small><h2>PC 快捷键</h2></div>
              <button onClick={() => setPanel("none")}><X size={20} /></button>
            </div>
            <div className="shortcut-grid">
              {shortcutRows.map(([key, action]) => (
                <div key={key}><kbd>{key}</kbd><span>{action}</span></div>
              ))}
            </div>
          </div>
        )}

        {completed && (
          <div className="completion-panel" onClick={(event) => event.stopPropagation()}>
            <div className="completion-orbit"><span /><i>END</i></div>
            <small>OBSERVATION COMPLETE</small>
            <h2>观测记录已抵达末尾</h2>
            <p>
              {nextStory
                ? `下一段为「${nextStory.title}」，可以直接继续播放。`
                : "当前播放队列已结束。你可以重新播放这段记录，或返回目录选择其他剧情。"}
            </p>
            <div>
              <button onClick={handleGoBack}><ChevronLeft size={17} /> 返回最后一句</button>
              <button onClick={handleReplay}><RotateCcw size={17} /> 重新播放</button>
              <button className={nextStory ? "" : "primary"} onClick={onExit}><ListMusic size={17} /> 返回目录</button>
              {nextStory && (
                <button className="primary" onClick={onNext}>
                  <SkipForward size={17} /> 开始下一段剧情
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      <nav className="desktop-quickbar" aria-label="阅读器快捷操作">
        <button onClick={() => setUiHidden((value) => !value)}><EyeOff size={16} /><span>隐藏界面</span><kbd>H</kbd></button>
        <button onClick={saveBookmark}><Bookmark size={16} /><span>书签</span><kbd>B</kbd></button>
        <button onClick={() => setPanel("shortcuts")}><Keyboard size={16} /><span>快捷键</span><kbd>?</kbd></button>
        <button onClick={toggleFullscreen}><Expand size={16} /><span>全屏</span><kbd>F</kbd></button>
        <span className="quickbar-mode"><Gauge size={15} /> {ctrlHeld ? "FAST FORWARD" : autoMode ? "AUTO PLAY" : skipMode ? "SKIP READ" : "MANUAL"}</span>
      </nav>
    </div>
  );
}

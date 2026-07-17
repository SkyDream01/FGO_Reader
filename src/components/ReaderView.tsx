import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
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
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  CSSProperties,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  backgroundUrl,
  characterUrl,
  getScriptText,
  offlineDemoScript,
} from "../data/atlas";
import { useBgm } from "../hooks/useBgm";
import { useCustomAssetUrl } from "../hooks/useCustomAssetUrl";
import { useStoryTranslations } from "../hooks/useStoryTranslations";
import {
  addChoiceDecision,
  clearChoiceTrail,
  replayChoiceTrail,
  validateChoiceTrail,
} from "../lib/choiceTrail";
import {
  isCustomScriptUrl,
  loadCustomScriptByUrl,
} from "../lib/customScripts";
import {
  clearLastObservation,
  createLastObservation,
  saveLastObservation,
} from "../lib/lastObservation";
import { parseFgoScript } from "../lib/scriptParser";
import {
  clearPersistentTranslationCaches,
  deleteLocalOpenAiConfig,
  loadTranslationSettings,
  saveLocalOpenAiConfig,
  saveTranslationSettings,
  type TranslationSettings,
} from "../lib/translation";
import type {
  Bookmark as ReaderBookmark,
  CharacterState,
  ChoiceFrame,
  ChoiceTrail,
  ReaderSettings,
  StoryFrame,
  StoryLaunch,
} from "../types";

interface ReaderViewProps {
  story: StoryLaunch;
  nextStory: StoryLaunch | null;
  onNext: () => void;
  onExit: () => void;
}

type Panel = "none" | "log" | "settings" | "shortcuts";

const defaultSettings: ReaderSettings = {
  textSpeed: 28,
  autoDelay: 1500,
  bgmVolume: 0.62,
  skipUnread: false,
  reduceMotion: false,
  masterName: "御主",
};

const choiceTrailStorageKey = (scriptId: string) =>
  `fgo-reader-choice-trail:${scriptId}`;

interface CustomPackageContext {
  id: string;
  scriptText: string;
  translationAllowed: boolean;
  assets?: {
    backgrounds?: Record<string, string>;
    characters?: Record<string, string>;
    bgm?: Record<string, string>;
  };
}

function loadStoredChoiceTrail(scriptId: string): ChoiceTrail {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(choiceTrailStorageKey(scriptId)) || "[]",
    );
    return validateChoiceTrail(value) ? value : [];
  } catch {
    return [];
  }
}

function loadSettings(): ReaderSettings {
  try {
    const stored = localStorage.getItem("fgo-reader-settings");
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function CharacterSprite({
  character,
  region,
  customPackage,
}: {
  character: CharacterState;
  region: StoryLaunch["region"];
  customPackage: CustomPackageContext | null;
}) {
  const [failed, setFailed] = useState(false);
  const [wideAtlas, setWideAtlas] = useState(false);
  const fallbackUrl = characterUrl(region, character.id);
  const {
    url,
    usingLocalAsset,
    useFallback,
  } = useCustomAssetUrl({
    packageId: customPackage?.id,
    assetPath: customPackage?.assets?.characters?.[character.id],
    fallbackUrl,
  });

  useEffect(() => {
    setFailed(false);
  }, [url]);

  return (
    <div
      className={`character-sprite ${character.active ? "active" : "inactive"} ${character.silhouette ? "silhouette" : ""} ${wideAtlas ? "wide-atlas" : ""}`}
      data-position={character.position}
      data-slot={character.slot}
    >
      {!failed && url ? (
        <img
          src={url}
          alt={character.name}
          onLoad={(event) => {
            const image = event.currentTarget;
            setWideAtlas(image.naturalWidth / image.naturalHeight > 1.25);
          }}
          onError={() => {
            if (usingLocalAsset) {
              useFallback();
              return;
            }
            setFailed(true);
          }}
          draggable={false}
        />
      ) : failed ? (
        <div className="character-fallback" aria-label={`${character.name} 立绘不可用`}>
          <span>{character.name.slice(0, 1)}</span>
          <small>{character.name}</small>
        </div>
      ) : null}
    </div>
  );
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

export function ReaderView({ story, nextStory, onNext, onExit }: ReaderViewProps) {
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const [translationSettings, setTranslationSettings] = useState<TranslationSettings>(loadTranslationSettings);
  const [translationDraft, setTranslationDraft] = useState<TranslationSettings>(loadTranslationSettings);
  const [frames, setFrames] = useState<StoryFrame[]>([]);
  const [baseFrames, setBaseFrames] = useState<StoryFrame[]>([]);
  const [choiceTrail, setChoiceTrail] = useState<ChoiceTrail>(() =>
    story.choiceTrail ?? loadStoredChoiceTrail(story.scriptId),
  );
  const [customPackage, setCustomPackage] = useState<CustomPackageContext | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadNote, setLoadNote] = useState("");
  const [loadError, setLoadError] = useState("");
  const [panel, setPanel] = useState<Panel>("none");
  const [autoMode, setAutoMode] = useState(false);
  const [skipMode, setSkipMode] = useState(false);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [muted, setMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [windowFocused, setWindowFocused] = useState(document.hasFocus());
  const [choiceFocus, setChoiceFocus] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [toast, setToast] = useState("");
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const [translationEligible, setTranslationEligible] = useState(false);
  const [openAiDraftDirty, setOpenAiDraftDirty] = useState(false);
  const [clearOpenAiApiKey, setClearOpenAiApiKey] = useState(false);
  const [translationConfigSaving, setTranslationConfigSaving] = useState(false);
  const [translationConfigError, setTranslationConfigError] = useState("");
  const [readMax, setReadMax] = useState(() => {
    const value = localStorage.getItem(`fgo-reader-read:${story.scriptId}`);
    return value === null ? -1 : Number(value);
  });
  const toastTimer = useRef<number | null>(null);
  const revealContext = useRef({ frameId: "", mode: "source", ready: true });

  const currentFrame = frames[frameIndex] ?? null;
  const translation = useStoryTranslations({
    scriptId: story.scriptId,
    frames,
    frameIndex,
    historyOpen: panel === "log",
    eligible: translationEligible,
    settings: translationSettings,
    skipMode,
    ctrlHeld,
  });
  const translatedMode = translationEligible && translationSettings.mode === "translated";
  const displaySpeaker = currentFrame?.type === "dialogue" && translatedMode
    ? translation.translatedSpeaker(currentFrame) ?? currentFrame.speaker
    : currentFrame?.type === "dialogue"
      ? currentFrame.speaker
      : "回应选择";
  const displayText = currentFrame?.type === "dialogue" && translatedMode
    ? translation.translatedText(currentFrame) ?? currentFrame.text
    : currentFrame?.text ?? "";
  const selectedProviderInfo = translation.serverConfig?.providers.find(
    (provider) => provider.id === translationDraft.provider,
  );
  const localOpenAiConfig = translation.serverConfig?.localEnv?.openai;
  const translationDisplayError = useMemo(
    () => translatedMode && (!translationSettings.provider || !translation.providerReady)
      ? { detail: "翻译后端尚未完成配置", retryable: false }
      : translation.currentError,
    [translatedMode, translation.currentError, translation.providerReady, translationSettings.provider],
  );
  const textCharacters = useMemo(
    () => Array.from(displayText),
    [displayText],
  );
  const textComplete = currentFrame?.type === "choice" || revealedCount >= textCharacters.length;
  const backgroundFallbackUrl = backgroundUrl(story.region, currentFrame?.scene ?? null);
  const {
    url: currentBackground,
    usingLocalAsset: usingLocalBackground,
    useFallback: useBackgroundFallback,
  } = useCustomAssetUrl({
    packageId: customPackage?.id,
    assetPath: currentFrame?.scene
      ? customPackage?.assets?.backgrounds?.[currentFrame.scene]
      : undefined,
    fallbackUrl: backgroundFallbackUrl,
  });
  const {
    url: localBgmUrl,
    usingLocalAsset: usingLocalBgm,
    loadingLocalAsset: loadingLocalBgm,
  } = useCustomAssetUrl({
    packageId: customPackage?.id,
    assetPath: currentFrame?.bgm
      ? customPackage?.assets?.bgm?.[currentFrame.bgm]
      : undefined,
    fallbackUrl: "",
  });
  const progress = frames.length > 1 ? (frameIndex / (frames.length - 1)) * 100 : 0;

  const bgm = useBgm({
    region: story.region,
    fileName: currentFrame?.bgm ?? null,
    localUrl: usingLocalBgm ? localBgmUrl : null,
    localTitle: currentFrame?.bgm ?? undefined,
    localPending: loadingLocalBgm,
    unlocked: audioUnlocked,
    muted,
    volume: settings.bgmVolume,
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

  const openSettings = useCallback(() => {
    setTranslationDraft(localOpenAiConfig?.editable
      ? {
          ...translationSettings,
          openai: {
            baseUrl: localOpenAiConfig.baseUrl,
            apiKey: "",
            model: localOpenAiConfig.model,
            allowNoAuth: localOpenAiConfig.allowNoAuth,
          },
        }
      : translationSettings);
    setOpenAiDraftDirty(false);
    setClearOpenAiApiKey(false);
    setTranslationConfigError("");
    setPanel("settings");
  }, [localOpenAiConfig, translationSettings]);

  const toggleTranslation = useCallback(() => {
    if (!translationEligible) return;
    if (translationSettings.mode === "translated") {
      persistTranslationSettings({ ...translationSettings, mode: "source" });
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
    persistTranslationSettings,
    showToast,
    translation.providerReady,
    translationEligible,
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
        });
        const saved: TranslationSettings = {
          ...translationDraft,
          openai: { baseUrl: "", apiKey: "", model: "", allowNoAuth: false },
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
        openai: { baseUrl: "", apiKey: "", model: "", allowNoAuth: false },
      };
      setTranslationDraft(cleared);
      persistTranslationSettings(cleared);
      setOpenAiDraftDirty(false);
      setClearOpenAiApiKey(false);
      clearPersistentTranslationCaches();
      await translation.refreshServerConfig();
      showToast(translationDraft.provider === "openai" && localOpenAiConfig?.editable
        ? "已清除 .env.local 大模型配置和翻译缓存"
        : "已清除本地翻译凭据和缓存");
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
        baseUrl: localOpenAiConfig.baseUrl,
        apiKey: "",
        model: localOpenAiConfig.model,
        allowNoAuth: localOpenAiConfig.allowNoAuth,
      },
    }));
  }, [localOpenAiConfig, openAiDraftDirty, panel, translationDraft.provider]);

  useEffect(() => {
    localStorage.setItem("fgo-reader-settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(`fgo-reader-read:${story.scriptId}`, String(readMax));
  }, [readMax, story.scriptId]);

  useEffect(() => {
    if (!frames.length) return;
    localStorage.setItem(`fgo-reader-progress:${story.scriptId}`, String(frameIndex));
  }, [frameIndex, frames.length, story.scriptId]);

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
    if (!frames.length) return;

    if (completed) {
      if (nextStory) {
        saveLastObservation(createLastObservation(nextStory, 0));
      } else {
        clearLastObservation();
      }
      return;
    }

    saveLastObservation(
      createLastObservation({ ...story, choiceTrail }, frameIndex),
    );
  }, [choiceTrail, completed, frameIndex, frames.length, nextStory, story]);

  useEffect(() => {
    const controller = new AbortController();
    const customSource = isCustomScriptUrl(story.scriptUrl);
    setLoading(true);
    setLoadNote("");
    setLoadError("");
    setFrames([]);
    setBaseFrames([]);
    setCompleted(false);
    setTranslationEligible(false);
    setCustomPackage(null);

    const sourcePromise = customSource
      ? loadCustomScriptByUrl(story.scriptUrl).then((record) => {
          if (!record) throw new Error("本地资源包已不存在或已被删除");
          setCustomPackage(record);
          return { source: record.scriptText, record };
        })
      : getScriptText(story.scriptUrl, controller.signal, story.region, story.scriptId)
          .then((source) => ({ source, record: null }));

    sourcePromise
      .then(({ source, record }) => {
        const parsed = parseFgoScript(source, story.scriptId, settings.masterName);
        if (!parsed.frames.length) throw new Error("脚本中没有可播放的对话");
        const restoredTrail = story.choiceTrail ?? loadStoredChoiceTrail(story.scriptId);
        const replayed = replayChoiceTrail(parsed.frames, restoredTrail);
        const savedProgress = Number(localStorage.getItem(`fgo-reader-progress:${story.scriptId}`) || 0);
        const startIndex = Math.max(
          0,
          Math.min(story.startIndex ?? savedProgress, replayed.frames.length - 1),
        );
        setBaseFrames(parsed.frames);
        setFrames(replayed.frames);
        setChoiceTrail(replayed.choiceTrail);
        setFrameIndex(startIndex);
        setTranslationEligible(
          story.region === "JP" && (!customSource || record?.translationAllowed === true),
        );
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (customSource) {
          setLoadError(
            reason instanceof Error
              ? `无法打开本地资源包：${reason.message}`
              : "无法打开本地资源包，请返回目录后重新导入。",
          );
          return;
        }
        const parsed = parseFgoScript(offlineDemoScript, "offline-demo", settings.masterName);
        setBaseFrames(parsed.frames);
        setFrames(parsed.frames);
        setChoiceTrail(clearChoiceTrail());
        setFrameIndex(0);
        setTranslationEligible(false);
        setLoadNote(
          `Atlas 数据暂时无法读取，已进入离线演示：${reason instanceof Error ? reason.message : "未知错误"}`,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // Master name is intentionally applied when a script is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.choiceTrail, story.scriptId, story.scriptUrl]);

  useEffect(() => {
    setBackgroundFailed(false);
  }, [currentBackground]);

  useEffect(() => {
    setChoiceFocus(0);
    if (!currentFrame) return;
    const previous = revealContext.current;
    const frameChanged = previous.frameId !== currentFrame.id;
    const modeChanged = previous.mode !== translationSettings.mode;
    const translationArrived = translatedMode && !previous.ready && translation.currentReady;
    const showImmediately = currentFrame.type === "choice"
      || settings.reduceMotion
      || modeChanged
      || translationArrived
      || (translatedMode && !translation.currentReady);
    setRevealedCount(showImmediately ? textCharacters.length : frameChanged ? 0 : textCharacters.length);
    revealContext.current = {
      frameId: currentFrame.id,
      mode: translationSettings.mode,
      ready: translation.currentReady,
    };
    if (currentFrame.type === "choice") {
      setAutoMode(false);
      setSkipMode(false);
    }
  }, [
    currentFrame?.id,
    currentFrame,
    settings.reduceMotion,
    textCharacters.length,
    translatedMode,
    translation.currentReady,
    translationSettings.mode,
  ]);

  useEffect(() => {
    if (!currentFrame || currentFrame.type === "choice" || textComplete) return;
    if (ctrlHeld || skipMode) return;
    const previous = textCharacters[Math.max(0, revealedCount - 1)] ?? "";
    const punctuationDelay = /[。！？!?]/.test(previous)
      ? 125
      : /[，、；,;]/.test(previous)
        ? 55
        : 0;
    const timer = window.setTimeout(
      () => setRevealedCount((count) => Math.min(textCharacters.length, count + 1)),
      settings.textSpeed + punctuationDelay,
    );
    return () => window.clearTimeout(timer);
  }, [ctrlHeld, currentFrame, revealedCount, settings.textSpeed, skipMode, textCharacters, textComplete]);

  const markCurrentRead = useCallback(() => {
    setReadMax((current) => Math.max(current, frameIndex));
  }, [frameIndex]);

  const advance = useCallback(() => {
    if (!currentFrame || loading) return;
    setAudioUnlocked(true);
    if (uiHidden) {
      setUiHidden(false);
      return;
    }
    if (currentFrame.type === "choice") return;
    if (!textComplete) {
      setRevealedCount(textCharacters.length);
      return;
    }
    markCurrentRead();
    if (frameIndex < frames.length - 1) {
      setFrameIndex((index) => index + 1);
    } else {
      setCompleted(true);
      setAutoMode(false);
      setSkipMode(false);
    }
  }, [currentFrame, frameIndex, frames.length, loading, markCurrentRead, textCharacters.length, textComplete, uiHidden]);

  const resolveChoice = useCallback(
    (choiceIndex: number) => {
      if (!currentFrame || currentFrame.type !== "choice" || currentFrame.selected !== undefined) return;
      const option = currentFrame.options[choiceIndex];
      if (!option) return;
      setAudioUnlocked(true);
      setAutoMode(false);
      setSkipMode(false);
      markCurrentRead();

      const resolved: ChoiceFrame = { ...currentFrame, selected: choiceIndex };
      setFrames((currentFrames) => [
        ...currentFrames.slice(0, frameIndex),
        resolved,
        ...option.frames,
        ...currentFrames.slice(frameIndex + 1),
      ]);
      setChoiceTrail((currentTrail) => addChoiceDecision(currentTrail, {
        choiceId: currentFrame.id,
        optionIndex: choiceIndex,
      }));

      if (option.frames.length || frameIndex < frames.length - 1) {
        setFrameIndex((index) => index + 1);
      } else {
        setCompleted(true);
      }
    },
    [currentFrame, frameIndex, frames.length, markCurrentRead],
  );

  useEffect(() => {
    if (!autoMode || !windowFocused || panel !== "none" || uiHidden || !textComplete || !currentFrame) return;
    if (currentFrame.type === "choice") return;
    if (translatedMode && !translation.currentReady) return;
    const timer = window.setTimeout(advance, settings.autoDelay + Math.min(900, displayText.length * 7));
    return () => window.clearTimeout(timer);
  }, [
    advance,
    autoMode,
    currentFrame,
    displayText.length,
    panel,
    settings.autoDelay,
    textComplete,
    translatedMode,
    translation.currentReady,
    uiHidden,
    windowFocused,
  ]);

  useEffect(() => {
    if (!translatedMode || !translationDisplayError) return;
    setAutoMode(false);
  }, [translatedMode, translationDisplayError]);

  useEffect(() => {
    if (!skipMode || !currentFrame || panel !== "none") return;
    if (currentFrame.type === "choice") {
      setSkipMode(false);
      return;
    }
    if (!settings.skipUnread && frameIndex > readMax) {
      setSkipMode(false);
      showToast("已到达未读内容，跳读已暂停");
      return;
    }
    const timer = window.setInterval(() => {
      if (!textComplete) setRevealedCount(textCharacters.length);
      else advance();
    }, 95);
    return () => window.clearInterval(timer);
  }, [advance, currentFrame, frameIndex, panel, readMax, settings.skipUnread, showToast, skipMode, textCharacters.length, textComplete]);

  useEffect(() => {
    if (!ctrlHeld || !currentFrame || panel !== "none" || currentFrame.type === "choice") return;
    const timer = window.setInterval(() => {
      if (!textComplete) setRevealedCount(textCharacters.length);
      else advance();
    }, 80);
    return () => window.clearInterval(timer);
  }, [advance, ctrlHeld, currentFrame, panel, textCharacters.length, textComplete]);

  const saveBookmark = useCallback(() => {
    const value: ReaderBookmark = {
      scriptId: story.scriptId,
      scriptUrl: story.scriptUrl,
      title: story.title,
      subtitle: story.subtitle,
      frameIndex,
      savedAt: Date.now(),
      region: story.region,
      sequence: story.sequence,
      sequenceIndex: story.sequenceIndex,
      choiceTrail,
    };
    localStorage.setItem("fgo-reader-bookmark", JSON.stringify(value));
    showToast("已保存当前位置");
  }, [choiceTrail, frameIndex, showToast, story]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else document.documentElement.requestFullscreen().catch(() => showToast("浏览器未允许全屏"));
  }, [showToast]);

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
      if (target?.matches("input, textarea, select, [contenteditable='true']")) {
        if (event.key === "Escape") (target as HTMLElement).blur();
        return;
      }

      if (event.key === "Control") {
        setCtrlHeld(true);
        return;
      }

      if (event.key === "Escape") {
        setPanel("none");
        setCompleted(false);
        return;
      }

      if (event.code === "KeyT" && (panel === "none" || panel === "log")) {
        toggleTranslation();
        return;
      }

      if (panel !== "none") return;

      if (currentFrame?.type === "choice") {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setChoiceFocus((value) => (value - 1 + currentFrame.options.length) % currentFrame.options.length);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setChoiceFocus((value) => (value + 1) % currentFrame.options.length);
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
        case "Enter":
        case "Space":
        case "PageDown":
          event.preventDefault();
          advance();
          break;
        case "PageUp":
          event.preventDefault();
          setPanel("log");
          break;
        case "KeyA":
          setAutoMode((value) => !value);
          setSkipMode(false);
          break;
        case "KeyS":
          setSkipMode((value) => !value);
          setAutoMode(false);
          break;
        case "KeyL":
          setPanel("log");
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
  }, [advance, choiceFocus, currentFrame, panel, resolveChoice, saveBookmark, toggleFullscreen, toggleTranslation]);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const logEntries = useMemo(
    () =>
      frames
        .slice(0, frameIndex + 1)
        .map((frame, index) => ({ frame, index }))
        .filter(({ frame }) => frame.type === "dialogue"),
    [frameIndex, frames],
  );

  const stageStyle = {
    "--stage-background": currentBackground ? `url("${currentBackground}")` : "none",
    "--story-progress": `${progress}%`,
  } as CSSProperties;

  const stageClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, input, select, .reader-panel")) return;
    advance();
  };

  const replay = () => {
    setFrames(baseFrames);
    setChoiceTrail(clearChoiceTrail());
    setFrameIndex(0);
    setCompleted(false);
    setAutoMode(false);
    setSkipMode(false);
  };

  return (
    <div className={`reader-shell ${settings.reduceMotion ? "reduce-motion" : ""}`} style={stageStyle}>
      <div className="letterbox-background" aria-hidden="true" />
      <div
        className={`reader-stage ${currentFrame?.effect ?? "none"} ${uiHidden ? "ui-hidden" : ""}`}
        onClick={stageClick}
      >
        <div className="scene-layer">
          {currentBackground && !backgroundFailed && (
            <img
              key={currentBackground}
              className={`scene-image transition-${currentFrame?.transition ?? "none"}`}
              src={currentBackground}
              alt="剧情背景"
              onError={() => {
                if (usingLocalBackground) {
                  useBackgroundFallback();
                  return;
                }
                setBackgroundFailed(true);
              }}
              draggable={false}
            />
          )}
          <div className="scene-fallback" />
          <div className="scene-vignette" />
          <div className="scene-scanlines" />
        </div>

        <div className="character-layer" aria-live="off">
          {currentFrame?.characters.map((character) => (
            <CharacterSprite
              key={`${character.slot}-${character.id}`}
              character={character}
              region={story.region}
              customPackage={customPackage}
            />
          ))}
        </div>

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
                <ToggleButton label="记录" shortcut="L" icon={<MessageSquareText size={16} />} onClick={() => setPanel("log")} />
                {translationEligible && (
                  <ToggleButton
                    active={translatedMode}
                    label={translatedMode ? "原文" : "译文"}
                    shortcut="T"
                    icon={translation.currentPending ? <LoaderCircle className="spin" size={16} /> : <Languages size={16} />}
                    onClick={toggleTranslation}
                  />
                )}
                <ToggleButton active={autoMode} label="自动" shortcut="A" icon={autoMode ? <Pause size={16} /> : <Play size={16} />} onClick={() => { setAutoMode((value) => !value); setSkipMode(false); }} />
                <ToggleButton active={skipMode} label="跳读" shortcut="S" icon={<SkipForward size={16} />} onClick={() => { setSkipMode((value) => !value); setAutoMode(false); }} />
                <button className={`round-tool ${muted ? "active" : ""}`} onClick={() => { setMuted((value) => !value); setAudioUnlocked(true); }} aria-label={muted ? "恢复声音" : "静音"}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
                <button className="round-tool" onClick={openSettings} aria-label="设置"><Settings size={18} /></button>
              </div>
            </header>

            <div className="reader-side-status">
              <span>{String(frameIndex + 1).padStart(3, "0")}</span>
              <i />
              <small>{String(frames.length).padStart(3, "0")}</small>
            </div>

            {currentFrame?.type === "choice" && (
              <div className="choice-menu" onClick={(event) => event.stopPropagation()}>
                <p>SELECT RESPONSE</p>
                {currentFrame.options.map((option, optionIndex) => (
                  <button
                    key={`${option.label}-${optionIndex}`}
                    className={choiceFocus === optionIndex ? "focused" : ""}
                    onMouseEnter={() => setChoiceFocus(optionIndex)}
                    onClick={() => resolveChoice(optionIndex)}
                  >
                    <kbd>{optionIndex + 1}</kbd>
                    <span>
                      {translatedMode
                        ? translation.translatedChoice(currentFrame, optionIndex) ?? option.label
                        : option.label}
                    </span>
                    <ChevronDown size={17} />
                  </button>
                ))}
              </div>
            )}

            {currentFrame && (
              <div className="dialogue-wrap">
                <div className="dialogue-track" aria-hidden="true">
                  <span className="track-fill" />
                  {Array.from({ length: 13 }).map((_, nodeIndex) => <i key={nodeIndex} />)}
                </div>
                <div className="speaker-plate">
                  <small>{currentFrame.type === "choice" ? "MASTER" : "SPEAKER"}</small>
                  <strong>{displaySpeaker}</strong>
                </div>
                <div className="dialogue-box">
                  <p className="dialogue-text">
                    {currentFrame.type === "choice"
                      ? "请选择你的回应。"
                      : textCharacters.slice(0, revealedCount).join("")}
                  </p>
                  {currentFrame.type !== "choice" && textComplete && (
                    <span className="advance-indicator" aria-label="继续"><ChevronDown size={20} /></span>
                  )}
                  <div className="dialogue-meta">
                    <span>LOG {String(frameIndex + 1).padStart(3, "0")}</span>
                    {translatedMode && (
                      <span className="translation-state">
                        {translation.currentPending
                          ? "TRANSLATING"
                          : translation.currentReady
                            ? "TRANSLATED"
                            : "SOURCE FALLBACK"}
                      </span>
                    )}
                    <span>{autoMode ? "AUTO" : skipMode ? "SKIP" : ctrlHeld ? "FAST" : "MANUAL"}</span>
                  </div>
                </div>
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

        {loading && (
          <div className="reader-loading">
            <div className="loading-orbit"><span /><span /><LoaderCircle className="spin" /></div>
            <p>正在展开灵子记录</p>
            <small>{story.scriptId}</small>
          </div>
        )}

        {loadNote && !loading && (
          <div className="load-note"><CircleAlert size={17} /> {loadNote}</div>
        )}

        {loadError && !loading && (
          <div className="reader-load-error" onClick={(event) => event.stopPropagation()}>
            <CircleAlert size={19} />
            <div>
              <strong>本地记录无法展开</strong>
              <p>{loadError}</p>
            </div>
            <button onClick={onExit}>返回目录</button>
          </div>
        )}

        {toast && <div className="reader-toast"><Check size={16} /> {toast}</div>}

        {panel === "log" && (
          <div className="reader-panel log-panel" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div><small>BACKLOG</small><h2>历史记录</h2></div>
              <div className="panel-header-actions">
                {translationEligible && (
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
              {logEntries.map(({ frame, index }) => frame.type === "dialogue" && (
                <button key={`${frame.id}-${index}`} onClick={() => { setFrameIndex(index); setPanel("none"); }}>
                  <span>{String(index + 1).padStart(3, "0")}</span>
                  <div>
                    <strong>{translatedMode ? translation.translatedSpeaker(frame) ?? frame.speaker : frame.speaker}</strong>
                    <p>{translatedMode ? translation.translatedText(frame) ?? frame.text : frame.text}</p>
                  </div>
                </button>
              ))}
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
              <label>
                <span><strong>文字速度</strong><small>{settings.textSpeed} ms / 字</small></span>
                <input type="range" min="10" max="70" step="2" value={settings.textSpeed} onChange={(event) => setSettings((value) => ({ ...value, textSpeed: Number(event.target.value) }))} />
              </label>
              <label>
                <span><strong>自动播放间隔</strong><small>{(settings.autoDelay / 1000).toFixed(1)} 秒</small></span>
                <input type="range" min="500" max="4000" step="100" value={settings.autoDelay} onChange={(event) => setSettings((value) => ({ ...value, autoDelay: Number(event.target.value) }))} />
              </label>
              <label>
                <span><strong>BGM 音量</strong><small>{Math.round(settings.bgmVolume * 100)}%</small></span>
                <input type="range" min="0" max="1" step="0.02" value={settings.bgmVolume} onChange={(event) => { setAudioUnlocked(true); setSettings((value) => ({ ...value, bgmVolume: Number(event.target.value) })); }} />
              </label>
              <label className="text-setting">
                <span><strong>御主名称</strong><small>下次载入脚本时生效</small></span>
                <input value={settings.masterName} maxLength={16} onChange={(event) => setSettings((value) => ({ ...value, masterName: event.target.value || "御主" }))} />
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

              <section className="translation-settings-section">
                <div className="translation-settings-heading">
                  <span><Languages size={17} /><strong>日文翻译</strong></span>
                  <small>JA → 简体中文</small>
                </div>

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
                    ? "Base URL、模型和密钥写入项目根目录 .env.local；已保存密钥只返回配置状态，不返回明文。"
                    : "页面配置会按你的选择明文保存在 localStorage；仅建议在自己的本机浏览器中使用。"}
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
              <button onClick={replay}><RotateCcw size={17} /> 重新播放</button>
              <button className={nextStory ? "" : "primary"} onClick={onExit}><ListMusic size={17} /> 返回目录</button>
              {nextStory && (
                <button className="primary" onClick={onNext}>
                  <SkipForward size={17} /> 开始下一段剧情
                </button>
              )}
            </div>
          </div>
        )}

        <div className="effect-flash" aria-hidden="true" />
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

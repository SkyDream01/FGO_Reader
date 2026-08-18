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
  characterTextureUrl,
  characterUrl,
  getCharacterFigureMetadata,
} from "../data/atlas";
import { useBgm } from "../hooks/useBgm";
import { useCustomAssetUrl } from "../hooks/useCustomAssetUrl";
import { useManualTranslations } from "../hooks/useManualTranslations";
import { useStoryTranslations } from "../hooks/useStoryTranslations";
import {
  addChoiceDecision,
  clearChoiceTrail,
} from "../lib/choiceTrail";
import {
  autoPlaybackDelayMs,
  choiceAutoPlaybackCharacterCount,
} from "../lib/autoPlayback";
import { blurFilterCss } from "../lib/blurFilter";
import {
  resolveCharacterBaselineTop,
  resolveCharacterAlphaContentRect,
  resolveCharacterCenterCorrection,
  resolveCharacterCanvasSize,
  resolveCharacterBodyHeight,
  resolveCharacterFaceRegion,
  type CharacterCenterCorrection,
} from "../lib/characterFigure";
import {
  STAGE_CALIBRATION_RATIOS,
  stageRatioToViewport,
  stageCoordinateToViewport,
} from "../lib/stageCoordinates";
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
  type CachedTranslation,
  type FullTranslationProgress,
  type ThinkingLevel,
  type TranslationSettings,
} from "../lib/translation";
import {
  exportTextFile,
  leaveApplicationFullscreen,
  registerAndroidBackHandler,
  toggleApplicationFullscreen,
} from "../platform/runtime";
import type {
  Bookmark as ReaderBookmark,
  CharacterState,
  ChoiceFrame,
  ChoiceTrail,
  StageLayerState,
  ReaderSettings,
  StoryFrame,
  StoryLaunch,
} from "../types";

interface ReaderViewProps {
  story: StoryLaunch;
  prepared: PreparedStory;
  nextStory: StoryLaunch | null;
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

const FIGURE_CANVAS_SIZE = 1024;
const defaultCharacterX: Record<CharacterState["position"], number> = {
  left: -256,
  center: 0,
  right: 256,
};

const ZERO_CHARACTER_CENTER_CORRECTION: CharacterCenterCorrection = { x: 0, y: 0 };

const DEFAULT_CAMERA = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  filter: null,
} as const;

function stageLayerAssetId(layer: StageLayerState) {
  return layer.id.replace(/^back/i, "");
}

function cameraFilterCss(value: string | null | undefined) {
  switch (value?.toLowerCase()) {
    case "gray":
      return "grayscale(1)";
    case "darkred":
      return "sepia(0.72) saturate(1.7) hue-rotate(300deg) brightness(0.72)";
    case "inversion":
      return "invert(1)";
    case "normal":
    case undefined:
    case null:
      return "none";
    default:
      return "none";
  }
}

function visualEffectClass(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("sepia")) return "sepia";
  if (normalized.includes("rubble") || normalized.includes("noise")) return "noise";
  if (normalized.includes("security")) return "security";
  return "";
}

function loadBrowserImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`立绘资源读取失败：${url}`));
    image.src = url;
  });
}

function resolveImageCharacterCenterCorrection(
  image: HTMLImageElement,
  fit: "contain" | "cover",
) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width <= 0 || height <= 0) return ZERO_CHARACTER_CENTER_CORRECTION;

  const stageSize = FIGURE_CANVAS_SIZE;
  const scale = fit === "cover"
    ? Math.max(stageSize / width, stageSize / height)
    : Math.min(stageSize / width, stageSize / height);
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  const fallback = resolveCharacterCenterCorrection({
    left: (stageSize - renderedWidth) / 2,
    top: stageSize - renderedHeight,
    width: renderedWidth,
    height: resolveCharacterBodyHeight(height, null) * scale,
  }, stageSize);

  try {
    const scanCanvas = document.createElement("canvas");
    scanCanvas.width = stageSize;
    scanCanvas.height = stageSize;
    const context = scanCanvas.getContext("2d");
    if (!context) return fallback;

    context.save();
    context.beginPath();
    context.rect(0, 0, stageSize, stageSize * 0.75);
    context.clip();
    context.drawImage(
      image,
      0,
      0,
      width,
      height,
      (stageSize - renderedWidth) / 2,
      stageSize - renderedHeight,
      renderedWidth,
      renderedHeight,
    );
    context.restore();

    const visibleContent = resolveCharacterAlphaContentRect(
      context.getImageData(0, 0, stageSize, stageSize).data,
      stageSize,
      stageSize,
    );
    return visibleContent
      ? resolveCharacterCenterCorrection(visibleContent, stageSize)
      : fallback;
  } catch {
    // A cross-origin image without CORS headers can be drawn but not inspected.
    return fallback;
  }
}

function AtlasCharacterFigure({
  character,
  region,
  mergedUrl,
  onError,
  onVisibleCenterCorrection,
}: {
  character: CharacterState;
  region: StoryLaunch["region"];
  mergedUrl: string;
  onError: () => void;
  onVisibleCenterCorrection: (correction: CharacterCenterCorrection) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [resources, setResources] = useState<{
    merged: HTMLImageElement;
    figureWidth: number;
    figureHeight: number;
    metadata: Awaited<ReturnType<typeof getCharacterFigureMetadata>>;
  } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResources(null);
    setReady(false);

    Promise.all([
      loadBrowserImage(mergedUrl),
      loadBrowserImage(characterTextureUrl(region, character.id)).catch(() => null),
      getCharacterFigureMetadata(region, character.id).catch(() => null),
    ])
      .then(([merged, texture, metadata]) => {
        if (cancelled) return;
        setResources({
          merged,
          figureWidth: texture?.naturalWidth || merged.naturalWidth || FIGURE_CANVAS_SIZE,
          figureHeight: texture?.naturalHeight || FIGURE_CANVAS_SIZE,
          metadata,
        });
      })
      .catch(() => {
        if (!cancelled) onError();
      });

    return () => {
      cancelled = true;
    };
  }, [character.id, mergedUrl, region]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !resources) return;
    const context = canvas.getContext("2d");
    if (!context) {
      onError();
      return;
    }

    const { merged, figureWidth, figureHeight, metadata } = resources;
    const canvasSize = resolveCharacterCanvasSize(figureWidth, figureHeight);
    const canvasScale = canvasSize / FIGURE_CANVAS_SIZE;
    const figureLeft = (canvasSize - figureWidth) / 2 + (metadata?.offsetX ?? 0);
    const bodyHeight = resolveCharacterBodyHeight(figureHeight, metadata);
    const figureTop = resolveCharacterBaselineTop(
      bodyHeight,
      FIGURE_CANVAS_SIZE * canvasScale * 0.75,
    );
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      merged,
      0,
      0,
      figureWidth,
      bodyHeight,
      figureLeft,
      figureTop,
      figureWidth,
      bodyHeight,
    );

    if (metadata) {
      const face = resolveCharacterFaceRegion(character.face, figureHeight, metadata);
      if (
        face &&
        face.sourceX + face.width <= merged.naturalWidth &&
        face.sourceY + face.height <= merged.naturalHeight
      ) {
        context.drawImage(
          merged,
          face.sourceX,
          face.sourceY,
          face.width,
          face.height,
          figureLeft + metadata.faceX,
          figureTop + metadata.faceY,
          face.width,
          face.height,
        );
      }
    }
    const fallbackCenterCorrection = resolveCharacterCenterCorrection({
      left: figureLeft,
      top: figureTop,
      width: figureWidth,
      height: bodyHeight,
    }, canvasSize);
    let centerCorrection = fallbackCenterCorrection;
    try {
      const visibleContent = resolveCharacterAlphaContentRect(
        context.getImageData(0, 0, canvasSize, canvasSize).data,
        canvasSize,
        canvasSize,
      );
      if (visibleContent) {
        centerCorrection = resolveCharacterCenterCorrection(visibleContent, canvasSize);
      }
    } catch {
      // Keep the geometric correction if the remote Atlas image taints canvas.
    }
    onVisibleCenterCorrection(centerCorrection);
    setReady(true);
  }, [character.face, onError, onVisibleCenterCorrection, resources]);

  const canvasSize = resources
    ? resolveCharacterCanvasSize(resources.figureWidth, resources.figureHeight)
    : FIGURE_CANVAS_SIZE;

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      className={ready ? "ready" : ""}
      aria-label={character.name}
    />
  );
}

function StageLayerSprite({
  layer,
  region,
  customPackage,
}: {
  layer: StageLayerState;
  region: StoryLaunch["region"];
  customPackage: PreparedCustomPackage | null;
}) {
  const [failed, setFailed] = useState(false);
  const assetId = stageLayerAssetId(layer);
  const fallbackUrl = backgroundUrl(region, assetId);
  const {
    url,
    usingLocalAsset,
    useFallback,
  } = useCustomAssetUrl({
    packageId: customPackage?.id,
    assetPath: customPackage?.assets?.backgrounds?.[assetId] ?? customPackage?.assets?.backgrounds?.[layer.id],
    preloadedUrl: customPackage?.assetUrls.backgrounds[assetId] ?? customPackage?.assetUrls.backgrounds[layer.id],
    fallbackUrl,
  });
  useEffect(() => {
    setFailed(false);
  }, [url]);
  const style = {
    "--stage-layer-x": stageCoordinateToViewport(layer.x, "x"),
    "--stage-layer-y": stageCoordinateToViewport(layer.y, "y"),
    "--stage-layer-scale": String(layer.scale),
    "--stage-layer-depth": String(layer.depth ?? 0),
  } as CSSProperties;

  return url && !failed ? (
    <img
      className={`stage-layer-sprite ${layer.layer === "sub" ? "sub" : "main"}`}
      data-slot={layer.slot}
      src={url}
      alt=""
      style={style}
      onError={() => {
        if (usingLocalAsset) useFallback();
        else setFailed(true);
      }}
      draggable={false}
    />
  ) : null;
}

function CharacterSprite({
  character,
  region,
  customPackage,
  characterCalibrationOffset,
  characterDebugOffset,
  showCharacterOrigin,
}: {
  character: CharacterState;
  region: StoryLaunch["region"];
  customPackage: PreparedCustomPackage | null;
  characterCalibrationOffset: { x: number; y: number };
  characterDebugOffset: { x: number; y: number };
  showCharacterOrigin: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [wideAtlas, setWideAtlas] = useState(false);
  const [characterCenterCorrection, setCharacterCenterCorrection] = useState<CharacterCenterCorrection>(
    ZERO_CHARACTER_CENTER_CORRECTION,
  );
  const fallbackUrl = characterUrl(region, character.id);
  const characterX = Number.isFinite(character.x)
    ? character.x
    : defaultCharacterX[character.position];
  const characterY = Number.isFinite(character.y) ? character.y : 0;
  const characterScale = Number.isFinite(character.scale) && character.scale > 0
    ? character.scale
    : 1;
  const characterStyle = {
    "--character-x": stageCoordinateToViewport(characterX, "x"),
    "--character-y": stageCoordinateToViewport(characterY, "y"),
    "--character-calibration-x": stageRatioToViewport(
      characterCalibrationOffset.x,
      "x",
      "character",
    ),
    "--character-calibration-y": stageRatioToViewport(
      characterCalibrationOffset.y,
      "y",
      "character",
    ),
    "--character-debug-x": stageRatioToViewport(
      characterDebugOffset.x,
      "x",
      "character",
    ),
    "--character-debug-y": stageRatioToViewport(
      characterDebugOffset.y,
      "y",
      "character",
    ),
    "--character-visual-correction-x": stageRatioToViewport(
      characterCenterCorrection.x * characterScale,
      "x",
      "character",
    ),
    "--character-visual-correction-y": stageRatioToViewport(
      characterCenterCorrection.y * characterScale,
      "y",
      "character",
    ),
    "--character-scale": String(characterScale),
    "--character-rotation": `${character.rotation ?? 0}deg`,
  } as CSSProperties;
  const characterOriginStyle = {
    "--character-x": stageCoordinateToViewport(characterX, "x"),
    "--character-y": stageCoordinateToViewport(characterY, "y"),
    "--character-calibration-x": stageRatioToViewport(
      characterCalibrationOffset.x,
      "x",
      "character",
    ),
    "--character-calibration-y": stageRatioToViewport(
      characterCalibrationOffset.y,
      "y",
      "character",
    ),
    "--character-debug-x": stageRatioToViewport(
      characterDebugOffset.x,
      "x",
      "character",
    ),
    "--character-debug-y": stageRatioToViewport(
      characterDebugOffset.y,
      "y",
      "character",
    ),
  } as CSSProperties;
  const {
    url,
    usingLocalAsset,
    useFallback,
  } = useCustomAssetUrl({
    packageId: customPackage?.id,
    assetPath: customPackage?.assets?.characters?.[character.id],
    preloadedUrl: customPackage?.assetUrls.characters[character.id],
    fallbackUrl,
  });

  useEffect(() => {
    setFailed(false);
    setWideAtlas(false);
    setCharacterCenterCorrection(ZERO_CHARACTER_CENTER_CORRECTION);
  }, [url]);

  const handleVisibleCenterCorrection = useCallback(
    (correction: CharacterCenterCorrection) => {
      setCharacterCenterCorrection(correction);
    },
    [],
  );
  const handleAtlasError = useCallback(() => setFailed(true), []);

  return (
    <>
      <div
        className={`character-sprite ${character.active ? "active" : "inactive"} ${character.silhouette ? "silhouette" : ""} ${character.shadow ? "with-shadow" : ""} ${usingLocalAsset && wideAtlas ? "wide-atlas" : ""}`}
        data-position={character.position}
        data-slot={character.slot}
        style={characterStyle}
      >
        {!failed && url && usingLocalAsset ? (
          <img
            src={url}
            alt={character.name}
            onLoad={(event) => {
              const image = event.currentTarget;
              const wide = image.naturalWidth / image.naturalHeight > 1.25;
              setWideAtlas(wide);
              setCharacterCenterCorrection(
                resolveImageCharacterCenterCorrection(image, wide ? "cover" : "contain"),
              );
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
        ) : !failed && url ? (
          <AtlasCharacterFigure
          character={character}
          region={region}
          mergedUrl={url}
          onError={handleAtlasError}
          onVisibleCenterCorrection={handleVisibleCenterCorrection}
        />
        ) : failed ? (
          <div className="character-fallback" aria-label={`${character.name} 立绘不可用`}>
            <span>{character.name.slice(0, 1)}</span>
            <small>{character.name}</small>
          </div>
        ) : null}
      </div>
      {showCharacterOrigin && (
        <span
          className="coordinate-origin-debug character-origin-debug"
          style={characterOriginStyle}
          aria-hidden="true"
        >
          <i />
          <small>角色 0,0</small>
        </span>
      )}
    </>
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

export function ReaderView({
  story,
  prepared,
  nextStory,
  onNext,
  onExit,
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
  const [frames, setFrames] = useState<StoryFrame[]>(prepared.frames);
  const baseFrames = prepared.baseFrames;
  const [choiceTrail, setChoiceTrail] = useState<ChoiceTrail>(prepared.choiceTrail);
  const customPackage = prepared.customPackage;
  const [frameIndex, setFrameIndex] = useState(prepared.startIndex);
  const [revealedCount, setRevealedCount] = useState(() => {
    const initialFrame = prepared.frames[prepared.startIndex];
    return settings.reduceMotion && initialFrame?.type === "dialogue"
      ? Array.from(initialFrame.text).length
      : 0;
  });
  const loading = false;
  const loadNote = prepared.loadNote;
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
  const japaneseStoryLoaded = prepared.japaneseStoryLoaded;
  const remoteTranslationEligible = prepared.remoteTranslationEligible;
  const [loadedMasterName] = useState(settings.masterName);
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
  const dialogueTransitionTimer = useRef<number | null>(null);
  const manualTranslationInputRef = useRef<HTMLInputElement>(null);
  const oneShotTranslationControllerRef = useRef<AbortController | null>(null);
  const revealContext = useRef({ frameId: "", mode: "source", translated: false });
  const revealImmediatelyOnNavigation = useRef(false);
  const translationVisit = useRef({
    key: "",
    waitingForPreparation: false,
    translated: false,
  });

  const currentFrame = frames[frameIndex] ?? null;
  const previousFrame = frames[frameIndex - 1] ?? null;
  const [dialogueLeaving, setDialogueLeaving] = useState(false);
  const manualTranslation = useManualTranslations({
    eligible: japaneseStoryLoaded,
    scriptId: story.scriptId,
    title: story.title,
    masterName: loadedMasterName,
    frames: baseFrames,
  });
  const translation = useStoryTranslations({
    scriptId: story.scriptId,
    frames,
    frameIndex,
    eligible: remoteTranslationEligible && manualTranslation.resolved && !manualTranslation.active,
    settings: translationSettings,
    manualActive: manualTranslation.active,
    manualTranslations: manualTranslation.translations,
    paused: manualTranslationBusy,
  });
  const translatedMode = japaneseStoryLoaded && translationSettings.mode === "translated";
  const translationVisitKey = [
    translationSettings.mode,
    frameIndex,
    currentFrame?.id ?? "",
    translation.preparationKey,
  ].join(":");
  if (translationVisit.current.key !== translationVisitKey) {
    translationVisit.current = {
      key: translationVisitKey,
      waitingForPreparation: translatedMode && translation.preparing,
      translated: translatedMode && !translation.preparing && translation.currentTranslated,
    };
  } else if (translationVisit.current.waitingForPreparation && !translation.preparing) {
    translationVisit.current = {
      ...translationVisit.current,
      waitingForPreparation: false,
      translated: translatedMode && translation.currentTranslated,
    };
  }
  const currentDisplayTranslated = translatedMode && translationVisit.current.translated;
  const displaySpeaker = currentFrame?.type === "dialogue" && currentDisplayTranslated
    ? translation.translatedSpeaker(currentFrame) ?? currentFrame.speaker
    : currentFrame?.type === "dialogue"
      ? currentFrame.speaker
      : "回应选择";
  const displayText = currentFrame?.type === "dialogue" && currentDisplayTranslated
    ? translation.translatedText(currentFrame) ?? currentFrame.text
    : currentFrame?.text ?? "";
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
    preloadedUrl: currentFrame?.scene
      ? customPackage?.assetUrls.backgrounds[currentFrame.scene]
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
    preloadedUrl: currentFrame?.bgm
      ? customPackage?.assetUrls.bgm[currentFrame.bgm]
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
    volume: currentFrame?.presentation?.bgmVolume ?? settings.bgmVolume,
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
    if (!japaneseStoryLoaded || !baseFrames.length) return;
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
  }, [baseFrames.length, japaneseStoryLoaded, manualTranslation, showToast, story.scriptId]);

  const translateAndExportManualTranslation = useCallback(async () => {
    if (!japaneseStoryLoaded || !baseFrames.length || !manualTranslation.resolved) return;
    if (!remoteTranslationEligible) {
      setManualTranslationError("当前脚本未允许使用在线翻译，无法执行一次性翻译");
      return;
    }
    const provider = translationSettings.provider;
    if (!provider || !translation.providerReady) {
      setManualTranslationError("请先选择并配置翻译后端，再执行一次性翻译");
      return;
    }

    const units = collectScriptTranslationUnits(baseFrames);
    const unitBatches = collectScriptTranslationUnitBatches(baseFrames);
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
    baseFrames,
    japaneseStoryLoaded,
    manualTranslation,
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
    if (!frames.length) return;
    localStorage.setItem(progressStorageKey(story.scriptId), String(frameIndex));
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
    setBackgroundFailed(false);
  }, [currentBackground]);

  useEffect(() => {
    setChoiceFocus(0);
    if (!currentFrame) return;
    const previous = revealContext.current;
    const frameChanged = previous.frameId !== currentFrame.id;
    const modeChanged = previous.mode !== translationSettings.mode;
    const translationActivated = translatedMode && !previous.translated && currentDisplayTranslated;
    const showImmediately = currentFrame.type === "choice"
      || settings.reduceMotion
      || revealImmediatelyOnNavigation.current
      || modeChanged
      || translationActivated
      || (translatedMode && !currentDisplayTranslated);
    setRevealedCount(showImmediately ? textCharacters.length : frameChanged ? 0 : textCharacters.length);
    revealImmediatelyOnNavigation.current = false;
    revealContext.current = {
      frameId: currentFrame.id,
      mode: translationSettings.mode,
      translated: currentDisplayTranslated,
    };
    if (currentFrame.type === "choice") {
      setSkipMode(false);
    }
  }, [
    currentFrame?.id,
    currentFrame,
    currentDisplayTranslated,
    settings.reduceMotion,
    textCharacters.length,
    translatedMode,
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

  const goBack = useCallback(() => {
    if (loading || (!completed && frameIndex <= 0)) return;
    if (dialogueTransitionTimer.current !== null) {
      window.clearTimeout(dialogueTransitionTimer.current);
      dialogueTransitionTimer.current = null;
    }
    setDialogueLeaving(false);
    setAutoMode(false);
    setSkipMode(false);
    setUiHidden(false);
    if (completed) {
      setCompleted(false);
      return;
    }
    revealImmediatelyOnNavigation.current = true;
    setFrameIndex((index) => Math.max(0, index - 1));
  }, [completed, frameIndex, loading]);

  const advance = useCallback(() => {
    if (!currentFrame || loading || translation.preparing || dialogueLeaving) return;
    setAudioUnlocked(true);
    if (uiHidden) {
      setUiHidden(false);
      return;
    }
    if (currentFrame.type === "choice") {
      if (currentFrame.selected === undefined) return;
      markCurrentRead();
      if (frameIndex < frames.length - 1) setFrameIndex((index) => index + 1);
      else setCompleted(true);
      return;
    }
    if (!textComplete) {
      setRevealedCount(textCharacters.length);
      return;
    }
    markCurrentRead();
    if (frameIndex < frames.length - 1) {
      if (
        currentFrame.type === "dialogue"
        && frames[frameIndex + 1]?.type === "animation"
        && !settings.reduceMotion
      ) {
        setDialogueLeaving(true);
        dialogueTransitionTimer.current = window.setTimeout(() => {
          dialogueTransitionTimer.current = null;
          setFrameIndex((index) => index + 1);
          setDialogueLeaving(false);
        }, 180);
        return;
      }
      setFrameIndex((index) => index + 1);
    } else {
      setCompleted(true);
      setAutoMode(false);
      setSkipMode(false);
    }
  }, [currentFrame, dialogueLeaving, frameIndex, frames, loading, markCurrentRead, settings.reduceMotion, textCharacters.length, textComplete, translation.preparing, uiHidden]);

  useEffect(() => {
    if (
      currentFrame?.type !== "animation"
      || currentFrame.durationMs === null
      || !windowFocused
      || panel !== "none"
      || translation.preparing
    ) return;
    const duration = settings.reduceMotion ? 1 : Math.max(80, currentFrame.durationMs);
    const timer = window.setTimeout(advance, duration);
    return () => window.clearTimeout(timer);
  }, [
    advance,
    currentFrame,
    panel,
    settings.reduceMotion,
    translation.preparing,
    windowFocused,
  ]);

  const resolveChoice = useCallback(
    (choiceIndex: number, continueAutoPlay = false) => {
      if (
        !currentFrame
        || currentFrame.type !== "choice"
        || currentFrame.selected !== undefined
        || translation.preparing
      ) return;
      const option = currentFrame.options[choiceIndex];
      if (!option) return;
      setAudioUnlocked(true);
      if (!continueAutoPlay) {
        setAutoMode(false);
        setSkipMode(false);
      }
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
        setAutoMode(false);
      }
    },
    [currentFrame, frameIndex, frames.length, markCurrentRead, translation.preparing],
  );

  useEffect(() => {
    if (
      !autoMode
      || !windowFocused
      || panel !== "none"
      || uiHidden
      || !currentFrame
      || translation.preparing
    ) return;
    if (currentFrame.type === "animation") {
      if (currentFrame.durationMs !== null) return;
      const timer = window.setTimeout(advance, autoPlaybackDelayMs(0));
      return () => window.clearTimeout(timer);
    }
    if (!textComplete) return;
    const characterCount = currentFrame.type === "choice"
      ? choiceAutoPlaybackCharacterCount(currentFrame.options)
      : textCharacters.length;
    const timer = window.setTimeout(() => {
      if (currentFrame.type === "choice" && currentFrame.selected === undefined) {
        resolveChoice(0, true);
      } else advance();
    }, autoPlaybackDelayMs(characterCount));
    return () => window.clearTimeout(timer);
  }, [
    advance,
    autoMode,
    currentFrame,
    panel,
    resolveChoice,
    textComplete,
    textCharacters.length,
    translation.preparing,
    uiHidden,
    windowFocused,
  ]);

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
    localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(value));
    showToast("已保存当前位置");
  }, [choiceTrail, frameIndex, showToast, story]);

  const toggleFullscreen = useCallback(() => {
    void toggleApplicationFullscreen().catch(() => showToast("当前设备未允许全屏"));
  }, [showToast]);

  useEffect(() => registerAndroidBackHandler(() => {
    if (panel !== "none" || completed) {
      setPanel("none");
      setCompleted(false);
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
          if (currentFrame.selected !== undefined) advance();
          else resolveChoice(choiceFocus);
          return;
        }
      }

      switch (event.code) {
        case "ArrowLeft":
          event.preventDefault();
          goBack();
          break;
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
  }, [advance, choiceFocus, currentFrame, goBack, panel, resolveChoice, saveBookmark, toggleFullscreen, toggleTranslation]);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    if (dialogueTransitionTimer.current !== null) {
      window.clearTimeout(dialogueTransitionTimer.current);
    }
    oneShotTranslationControllerRef.current?.abort();
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
  const framePresentation = currentFrame?.presentation;
  const camera = framePresentation?.camera ?? DEFAULT_CAMERA;
  const effectClass = visualEffectClass(framePresentation?.screenEffect);
  const worldStyle = {
    "--camera-x": stageCoordinateToViewport(camera.x, "x"),
    "--camera-y": stageCoordinateToViewport(camera.y, "y"),
    "--camera-scale": String(camera.scale > 0 ? camera.scale : 1),
    "--camera-rotation": `${camera.rotation}deg`,
    "--camera-filter": cameraFilterCss(camera.filter),
    "--world-blur": blurFilterCss(framePresentation?.blur),
    "--screen-effect-filter": effectClass === "sepia" ? "sepia(0.82) saturate(0.82)" : "none",
  } as CSSProperties;
  const messageVisible = framePresentation?.messageVisible ?? true;
  const activeCoordinateDebugSettings = COORDINATE_DEBUG_ENABLED
    ? coordinateDebugOffsets
    : DISABLED_COORDINATE_DEBUG_SETTINGS;
  // Keep production calibration separate from the opt-in debug adjustments.
  // The calibration values remain active in every build and mode.
  const screenCalibrationOffset = STAGE_CALIBRATION_RATIOS.screen;
  const screenDebugOffset = activeCoordinateDebugSettings.screenOrigin;
  const characterCalibrationOffset = STAGE_CALIBRATION_RATIOS.character;
  const characterDebugOffset = activeCoordinateDebugSettings.characterOrigin;
  const characterLayerStyle = {
    "--screen-calibration-x": stageRatioToViewport(
      screenCalibrationOffset.x,
      "x",
      "screen",
    ),
    "--screen-calibration-y": stageRatioToViewport(
      screenCalibrationOffset.y,
      "y",
      "screen",
    ),
    "--screen-debug-x": stageRatioToViewport(
      screenDebugOffset.x,
      "x",
      "screen",
    ),
    "--screen-debug-y": stageRatioToViewport(
      screenDebugOffset.y,
      "y",
      "screen",
    ),
  } as CSSProperties;

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
        className={`reader-stage ${currentFrame?.effect ?? "none"} ${effectClass ? `screen-effect-${effectClass}` : ""} ${uiHidden ? "ui-hidden" : ""}`}
        onClick={stageClick}
      >
        <div className="world-layer" style={worldStyle}>
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

          <div className="stage-image-layer" aria-hidden="true">
            {framePresentation?.stageLayers.map((layer) => (
              <StageLayerSprite
                key={`${layer.slot}-${layer.id}`}
                layer={layer}
                region={story.region}
                customPackage={customPackage}
              />
            ))}
          </div>

          <div className="character-layer" style={characterLayerStyle} aria-live="off">
            {COORDINATE_DEBUG_ENABLED && activeCoordinateDebugSettings.showScreenOrigin && (
              <span className="coordinate-origin-debug screen-origin-debug" aria-hidden="true">
                <i />
                <small>画面 0,0</small>
              </span>
            )}
            {currentFrame?.characters.map((character) => (
              <CharacterSprite
                key={`${character.slot}-${character.id}`}
                character={character}
                region={story.region}
                customPackage={customPackage}
                characterCalibrationOffset={characterCalibrationOffset}
                characterDebugOffset={characterDebugOffset}
                showCharacterOrigin={COORDINATE_DEBUG_ENABLED && activeCoordinateDebugSettings.showCharacterOrigin}
              />
            ))}
          </div>

          {framePresentation?.pictureFrame && (
            <div className="picture-frame-overlay" data-frame={framePresentation.pictureFrame} aria-hidden="true" />
          )}
          {framePresentation?.movie && (
            <div className="movie-overlay" aria-hidden="true">
              <span>FILM / {framePresentation.movie}</span>
            </div>
          )}
        </div>

        {framePresentation?.transitionColor && currentFrame?.transition !== "none" && (
          <div
            key={`${currentFrame.id}-transition`}
            className={`transition-overlay transition-${currentFrame.transition}`}
            style={{ backgroundColor: framePresentation.transitionColor.startsWith("#")
              ? framePresentation.transitionColor
              : framePresentation.transitionColor === "black"
                ? "#000"
                : framePresentation.transitionColor === "white"
                  ? "#fff"
                  : `#${framePresentation.transitionColor}` }}
            aria-hidden="true"
          />
        )}

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
                  onClick={goBack}
                  disabled={frameIndex === 0}
                />
                <ToggleButton label="记录" shortcut="L" icon={<MessageSquareText size={16} />} onClick={() => setPanel("log")} />
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
                    className={`${choiceFocus === optionIndex ? "focused" : ""} ${currentFrame.selected === optionIndex ? "selected" : ""}`}
                    disabled={currentFrame.selected !== undefined && currentFrame.selected !== optionIndex}
                    onMouseEnter={() => setChoiceFocus(optionIndex)}
                    onClick={() => {
                      if (currentFrame.selected !== undefined) advance();
                      else resolveChoice(optionIndex);
                    }}
                  >
                    <kbd>{optionIndex + 1}</kbd>
                    <span>
                      {currentDisplayTranslated
                        ? translation.translatedChoice(currentFrame, optionIndex) ?? option.label
                        : option.label}
                    </span>
                    <ChevronDown size={17} />
                  </button>
                ))}
              </div>
            )}

            {messageVisible && currentFrame && currentFrame.type !== "animation" && (
              <div
                className={[
                  "dialogue-wrap",
                  previousFrame?.type === "animation" ? "from-animation" : "",
                  dialogueLeaving ? "leaving-for-animation" : "",
                ].filter(Boolean).join(" ")}
              >
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
                  {currentFrame.type !== "choice" && textComplete && !translation.preparing && (
                    <span className="advance-indicator" aria-label="继续"><ChevronDown size={20} /></span>
                  )}
                  <div className="dialogue-meta">
                    <span>LOG {String(frameIndex + 1).padStart(3, "0")}</span>
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
                            ? `已译未读 ${translation.translatedUnreadFrameCount} 帧`
                            : "SOURCE FALLBACK"}
                      </span>
                    )}
                    <span>{autoMode ? "AUTO" : skipMode ? "SKIP" : ctrlHeld ? "FAST" : "MANUAL"}</span>
                  </div>
                </div>
              </div>
            )}

            {currentFrame?.type === "animation" && (
              <button
                className={`animation-advance ${currentFrame.durationMs !== null ? "timed" : ""}`}
                onClick={advance}
                aria-label={currentFrame.durationMs !== null ? "跳过演出" : "继续演出"}
                style={currentFrame.durationMs !== null
                  ? { "--animation-duration": `${Math.max(80, currentFrame.durationMs)}ms` } as CSSProperties
                  : undefined}
              >
                <span>{currentFrame.durationMs !== null ? "演出中" : "继续演出"}</span>
                <ChevronDown size={19} />
              </button>
            )}

            {translatedMode && translation.preparing && (
              <div className="translation-note" onClick={(event) => event.stopPropagation()}>
                <LoaderCircle className="spin" size={16} />
                <span>
                  正在翻译当前帧 {translation.preparationReadyCount}/{translation.preparationTotal}，
                  完成后即可阅读；后台将持续预译后续 {translation.translatedUnreadFrameTarget} 帧。
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
              {logEntries.map(({ frame, index }) => frame.type === "dialogue" && (
                <button key={`${frame.id}-${index}`} onClick={() => { setFrameIndex(index); setPanel("none"); }}>
                  <span>{String(index + 1).padStart(3, "0")}</span>
                  <div>
                    <strong>
                      {translatedMode && translation.frameTranslated(frame)
                        ? translation.translatedSpeaker(frame) ?? frame.speaker
                        : frame.speaker}
                    </strong>
                    <p>
                      {translatedMode && translation.frameTranslated(frame)
                        ? translation.translatedText(frame) ?? frame.text
                        : frame.text}
                    </p>
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
                    <small>BASE · 画面 Y -0.25 / 角色 Y 0.1</small>
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
              <button onClick={goBack}><ChevronLeft size={17} /> 返回最后一句</button>
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

import type { StoryFrame } from "../types";
import { TRANSLATION_QUALITY_VERSION } from "../../shared/translation-core.mjs";
import { isAndroidNative } from "../platform/runtime";
import {
  getNativeTranslationConfig,
  requestNativeTranslations,
} from "../platform/nativeTranslation";
import { SCRIPT_PARSER_VERSION } from "./scriptParserVersion";

export type TranslationProvider = "deepl" | "openai" | "bing";
export type TranslationMode = "source" | "translated";
export type TranslationKind = "speaker" | "dialogue" | "choice";
export type ThinkingType = "enabled" | "disabled";
export type ThinkingLevel = "low" | "medium" | "high" | "xhigh" | "max";

export interface TranslationSettings {
  mode: TranslationMode;
  provider: TranslationProvider | null;
  deepl: {
    authKey: string;
    serverUrl: string;
  };
  openai: {
    baseUrl: string;
    apiKey: string;
    model: string;
    allowNoAuth: boolean;
    thinkingEnabled: boolean;
    thinkingLevel: ThinkingLevel;
  };
}

export interface TranslationUnit {
  id: string;
  kind: TranslationKind;
  text: string;
  speaker?: string;
}

export interface CachedTranslation {
  sourceHash: string;
  translatedText: string;
}

export interface TranslationProviderInfo {
  id: TranslationProvider;
  label: string;
  serverConfigured: boolean;
  experimental: boolean;
  configurationId: string | null;
}

export interface LocalOpenAiConfig {
  editable: boolean;
  fileName: string;
  baseUrl: string;
  model: string;
  allowNoAuth: boolean;
  thinking: ThinkingType;
  reasoningEffort: ThinkingLevel;
  apiKeyConfigured: boolean;
}

export interface TranslationServerConfig {
  sourceLanguage: "ja";
  targetLanguage: "zh-Hans";
  clientOverridesAllowed: boolean;
  localEnv?: {
    openai: LocalOpenAiConfig;
  };
  providers: TranslationProviderInfo[];
}

export interface TranslationResponse {
  provider: TranslationProvider;
  configurationId: string;
  translations: Array<{
    id: string;
    translatedText: string;
  }>;
}

export interface FullTranslationProgress {
  completed: number;
  total: number;
  translatedCount: number;
  tps?: number;
}

export interface FullTranslationResult {
  translations: Record<string, CachedTranslation>;
  configurationId?: string;
}

export class TranslationRequestError extends Error {
  code: string;
  provider?: TranslationProvider;
  retryable: boolean;

  constructor(detail: string, code = "provider_unavailable", retryable = false, provider?: TranslationProvider) {
    super(detail);
    this.name = "TranslationRequestError";
    this.code = code;
    this.provider = provider;
    this.retryable = retryable;
  }
}

export class TranslationBatchError extends TranslationRequestError {
  partialTranslations: Record<string, CachedTranslation>;
  completed: number;
  total: number;

  constructor(
    detail: string,
    code: string,
    retryable: boolean,
    provider: TranslationProvider,
    partialTranslations: Record<string, CachedTranslation>,
    completed: number,
    total: number,
  ) {
    super(detail, code, retryable, provider);
    this.name = "TranslationBatchError";
    this.partialTranslations = partialTranslations;
    this.completed = completed;
    this.total = total;
  }
}

const SETTINGS_KEY = "fgo-reader-translation-settings:v1";
const CACHE_STORAGE_PREFIX = "fgo-reader-translation-cache:";
const CACHE_INDEX_PREFIX = "fgo-reader-translation-cache-index:";
const CACHE_INDEX_KEY = `fgo-reader-translation-cache-index:v${SCRIPT_PARSER_VERSION}`;
const CACHE_PREFIX = `fgo-reader-translation-cache:v${SCRIPT_PARSER_VERSION}:`;
const CACHE_ENTRY_LIMIT = 12;
export const TRANSLATION_AHEAD_FRAME_COUNT = 10;
export const TRANSLATION_TPS_WINDOW_MS = 1_000;

export const defaultTranslationSettings: TranslationSettings = {
  mode: "source",
  provider: null,
  deepl: {
    authKey: "",
    serverUrl: "",
  },
  openai: {
    baseUrl: "",
    apiKey: "",
    model: "",
    allowNoAuth: false,
    thinkingEnabled: false,
    thinkingLevel: "medium",
  },
};

function hasLocalStorage() {
  return typeof localStorage !== "undefined";
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isProvider(value: unknown): value is TranslationProvider {
  return value === "deepl" || value === "openai" || value === "bing";
}

function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return value === "low"
    || value === "medium"
    || value === "high"
    || value === "xhigh"
    || value === "max";
}

export function loadTranslationSettings(): TranslationSettings {
  if (!hasLocalStorage()) return defaultTranslationSettings;
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null") as Partial<TranslationSettings> | null;
    if (!parsed) return defaultTranslationSettings;
    return {
      mode: parsed.mode === "translated" ? "translated" : "source",
      provider: isProvider(parsed.provider) ? parsed.provider : null,
      deepl: {
        authKey: asString(parsed.deepl?.authKey),
        serverUrl: asString(parsed.deepl?.serverUrl),
      },
      openai: {
        baseUrl: asString(parsed.openai?.baseUrl),
        apiKey: asString(parsed.openai?.apiKey),
        model: asString(parsed.openai?.model),
        allowNoAuth: parsed.openai?.allowNoAuth === true,
        thinkingEnabled: parsed.openai?.thinkingEnabled === true,
        thinkingLevel: isThinkingLevel(parsed.openai?.thinkingLevel)
          ? parsed.openai.thinkingLevel
          : "medium",
      },
    };
  } catch {
    return defaultTranslationSettings;
  }
}

export function saveTranslationSettings(settings: TranslationSettings) {
  if (!hasLocalStorage()) return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function providerConfigFromSettings(settings: TranslationSettings) {
  if (settings.provider === "deepl") {
    return {
      ...(settings.deepl.authKey.trim() ? { authKey: settings.deepl.authKey.trim() } : {}),
      ...(settings.deepl.serverUrl.trim() ? { serverUrl: settings.deepl.serverUrl.trim() } : {}),
    };
  }
  if (settings.provider === "openai") {
    const hasCredentialOverride = Boolean(
      settings.openai.baseUrl.trim()
      || settings.openai.apiKey.trim()
      || settings.openai.model.trim()
      || settings.openai.allowNoAuth,
    );
    return {
      ...(settings.openai.baseUrl.trim() ? { baseUrl: settings.openai.baseUrl.trim() } : {}),
      ...(settings.openai.apiKey.trim() ? { apiKey: settings.openai.apiKey.trim() } : {}),
      ...(settings.openai.model.trim() ? { model: settings.openai.model.trim() } : {}),
      ...(hasCredentialOverride ? { allowNoAuth: settings.openai.allowNoAuth } : {}),
      thinking: {
        type: settings.openai.thinkingEnabled ? "enabled" : "disabled",
      } satisfies { type: ThinkingType },
      ...(settings.openai.thinkingEnabled
        ? { reasoningEffort: settings.openai.thinkingLevel }
        : {}),
    };
  }
  return undefined;
}

export function providerIsReady(
  settings: TranslationSettings,
  serverConfig: TranslationServerConfig | null,
) {
  if (!settings.provider) return false;
  if (settings.provider === "bing") return true;
  const serverReady = serverConfig?.providers.find((provider) => provider.id === settings.provider)?.serverConfigured === true;
  if (serverReady) return true;
  if (settings.provider === "deepl") return Boolean(settings.deepl.authKey.trim());
  return Boolean(
    settings.openai.baseUrl.trim()
    && settings.openai.model.trim()
    && (settings.openai.allowNoAuth || settings.openai.apiKey.trim()),
  );
}

export function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function translationUnitSourceHash(unit: TranslationUnit) {
  return stableHash(`${unit.kind}\u0000${unit.speaker ?? ""}\u0000${unit.text.replace(/\r\n?/g, "\n")}`);
}

export function frameTranslationUnits(frame: StoryFrame): TranslationUnit[] {
  if (frame.type === "animation") return [];
  if (frame.type === "choice") {
    return frame.options.map((option, index) => ({
      id: `${frame.id}:choice:${index}`,
      kind: "choice",
      text: option.label,
    }));
  }
  const speakerId = `speaker:${stableHash(frame.speaker)}`;
  return [
    ...(frame.speaker.trim() ? [{
      id: speakerId,
      kind: "speaker" as const,
      text: frame.speaker,
    }] : []),
    ...(frame.text.trim() ? [{
      id: `${frame.id}:dialogue`,
      kind: "dialogue" as const,
      speaker: frame.speaker,
      text: frame.text,
    }] : []),
  ];
}

/** Collects unique translation units from a group of frames in display order. */
export function collectTranslationUnits(frames: StoryFrame[]) {
  const units = new Map<string, TranslationUnit>();
  for (const frame of frames) {
    for (const unit of frameTranslationUnits(frame)) {
      const key = `${unit.id}:${translationUnitSourceHash(unit)}`;
      if (!units.has(key)) units.set(key, unit);
    }
  }
  return [...units.values()];
}

export function translationForUnit(
  translations: Record<string, CachedTranslation>,
  unit: TranslationUnit,
) {
  const cached = translations[unit.id];
  return cached?.sourceHash === translationUnitSourceHash(unit)
    ? cached.translatedText
    : undefined;
}

export function translationNamespace(
  settings: TranslationSettings,
  serverConfig: TranslationServerConfig | null,
  qualityVersion = TRANSLATION_QUALITY_VERSION,
) {
  if (!settings.provider) return "unconfigured";
  const providerInfo = serverConfig?.providers.find((provider) => provider.id === settings.provider);
  if (settings.provider === "bing") {
    return providerInfo?.configurationId
      ?? `bing-${stableHash(qualityVersion)}`;
  }
  if (settings.provider === "deepl") {
    if (settings.deepl.authKey.trim() || settings.deepl.serverUrl.trim()) {
      return `client-${stableHash(JSON.stringify({
        provider: "deepl",
        serverUrl: settings.deepl.serverUrl.trim(),
        qualityVersion,
      }))}`;
    }
  } else {
    const hasCredentialOverride = Boolean(
      settings.openai.baseUrl.trim()
      || settings.openai.apiKey.trim()
      || settings.openai.model.trim()
      || settings.openai.allowNoAuth,
    );
    return `client-${stableHash(JSON.stringify({
      provider: "openai",
      baseUrl: settings.openai.baseUrl.trim(),
      model: settings.openai.model.trim(),
      allowNoAuth: settings.openai.allowNoAuth,
      ...(hasCredentialOverride ? {} : { serverConfigurationId: providerInfo?.configurationId ?? null }),
      thinking: settings.openai.thinkingEnabled ? "enabled" : "disabled",
      qualityVersion,
    }))}`;
  }
  return providerInfo?.configurationId
    ?? `server-unconfigured-${stableHash(qualityVersion)}`;
}

interface TranslationCacheEntry {
  updatedAt: number;
  provider: TranslationProvider;
  namespace: string;
  scriptId: string;
  resolvedConfigurationId?: string;
  translations: Record<string, CachedTranslation>;
}

function cacheStorageKey(provider: TranslationProvider, namespace: string, scriptId: string) {
  return `${CACHE_PREFIX}${stableHash(`${provider}:${namespace}:${scriptId}`)}`;
}

function loadCacheIndex() {
  if (!hasLocalStorage()) return [] as Array<{ key: string; updatedAt: number }>;
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_INDEX_KEY) || "[]") as Array<{ key?: unknown; updatedAt?: unknown }>;
    return value
      .filter((entry) => typeof entry.key === "string" && typeof entry.updatedAt === "number")
      .map((entry) => ({ key: entry.key as string, updatedAt: entry.updatedAt as number }));
  } catch {
    return [];
  }
}

function touchCacheIndex(key: string, updatedAt: number) {
  const index = loadCacheIndex().filter((entry) => entry.key !== key);
  index.push({ key, updatedAt });
  index.sort((a, b) => b.updatedAt - a.updatedAt);
  const evicted = index.splice(CACHE_ENTRY_LIMIT);
  for (const entry of evicted) localStorage.removeItem(entry.key);
  localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
}

export function loadPersistentTranslations(
  provider: TranslationProvider,
  namespace: string,
  scriptId: string,
) {
  if (!hasLocalStorage()) return {} as Record<string, CachedTranslation>;
  const key = cacheStorageKey(provider, namespace, scriptId);
  try {
    const entry = JSON.parse(localStorage.getItem(key) || "null") as TranslationCacheEntry | null;
    if (!entry || entry.provider !== provider || entry.namespace !== namespace || entry.scriptId !== scriptId) return {};
    touchCacheIndex(key, Date.now());
    return entry.translations ?? {};
  } catch {
    localStorage.removeItem(key);
    return {};
  }
}

export function savePersistentTranslations(
  provider: TranslationProvider,
  namespace: string,
  scriptId: string,
  translations: Record<string, CachedTranslation>,
  resolvedConfigurationId?: string,
) {
  if (!hasLocalStorage()) return;
  const key = cacheStorageKey(provider, namespace, scriptId);
  const updatedAt = Date.now();
  const entry: TranslationCacheEntry = {
    updatedAt,
    provider,
    namespace,
    scriptId,
    resolvedConfigurationId,
    translations,
  };
  try {
    localStorage.setItem(key, JSON.stringify(entry));
    touchCacheIndex(key, updatedAt);
  } catch {
    const index = loadCacheIndex().sort((a, b) => a.updatedAt - b.updatedAt);
    for (const cached of index) {
      if (cached.key === key) continue;
      localStorage.removeItem(cached.key);
      try {
        localStorage.setItem(key, JSON.stringify(entry));
        touchCacheIndex(key, updatedAt);
        return;
      } catch {
        // Continue evicting older script caches until the current script fits.
      }
    }
  }
}

export function clearPersistentTranslationCaches() {
  if (!hasLocalStorage()) return;
  const keys = new Set(loadCacheIndex().map((entry) => entry.key));
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && (key.startsWith(CACHE_STORAGE_PREFIX) || key.startsWith(CACHE_INDEX_PREFIX))) {
      keys.add(key);
    }
  }
  for (const key of keys) localStorage.removeItem(key);
}

export function chunkTranslationUnits(units: TranslationUnit[]) {
  const chunks: TranslationUnit[][] = [];
  let current: TranslationUnit[] = [];
  let length = 0;
  for (const unit of units) {
    const unitLength = Array.from(unit.text).length;
    if (current.length && (current.length >= 20 || length + unitLength > 10_000)) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    current.push(unit);
    length += unitLength;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function prepareTranslationChunks(
  missingUnits: TranslationUnit[],
  unitBatches?: TranslationUnit[][],
) {
  if (!unitBatches) return chunkTranslationUnits(missingUnits);

  const missingById = new Map(missingUnits.map((unit) => [unit.id, unit]));
  const assigned = new Set<string>();
  const chunks: TranslationUnit[][] = [];
  for (const batch of unitBatches) {
    const filtered = batch.filter((unit) => {
      if (!missingById.has(unit.id) || assigned.has(unit.id)) return false;
      assigned.add(unit.id);
      return true;
    });
    // A supplied batch is already the requested five-frame conversation. Keep
    // it intact so the provider receives one system prompt plus exactly one
    // frame group, and the next group starts a new request.
    if (filtered.length) chunks.push(filtered);
  }

  const unassigned = missingUnits.filter((unit) => !assigned.has(unit.id));
  if (unassigned.length) chunks.push(unassigned);
  return chunks;
}

function waitForTranslationRetry(signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    timer = setTimeout(finish, 1_000);
    signal?.addEventListener("abort", finish, { once: true });
    if (signal?.aborted) finish();
  });
}

function translationClock() {
  return Date.now();
}

function isCjkLikeCharacter(character: string) {
  return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(character);
}

function isAsciiWordCharacter(character: string) {
  return /[A-Za-z0-9]/u.test(character);
}

/** Estimates generated tokens locally without depending on provider usage metadata. */
function estimateLocalOutputTokens(text: string) {
  let tokens = 0;
  let asciiRunLength = 0;
  const flushAsciiRun = () => {
    if (!asciiRunLength) return;
    tokens += Math.max(1, Math.ceil(asciiRunLength / 4));
    asciiRunLength = 0;
  };

  for (const character of text) {
    if (/\s/u.test(character)) {
      flushAsciiRun();
    } else if (isCjkLikeCharacter(character)) {
      flushAsciiRun();
      tokens += 1;
    } else if (isAsciiWordCharacter(character)) {
      asciiRunLength += 1;
    } else {
      flushAsciiRun();
      tokens += 1;
    }
  }
  flushAsciiRun();
  return tokens;
}

interface OutputTokenSample {
  completedAt: number;
  tokens: number;
}

function rollingOutputTokensPerSecond(samples: OutputTokenSample[], now: number) {
  const windowStart = now - TRANSLATION_TPS_WINDOW_MS;
  while (samples.length && samples[0].completedAt <= windowStart) samples.shift();
  const tokens = samples.reduce((total, sample) => total + sample.tokens, 0);
  return tokens / (TRANSLATION_TPS_WINDOW_MS / 1_000);
}

/**
 * Translates an entire script in provider-sized batches for manual-template
 * export. When unitBatches is supplied, those logical batches are processed
 * in order as separate requests. The caller can persist each successful batch
 * through onBatch, so a later retry does not have to discard work completed
 * before a failure.
 */
export async function translateTranslationUnits({
  provider,
  scriptId,
  providerConfig,
  units,
  unitBatches,
  existingTranslations = {},
  signal,
  onProgress,
  onBatch,
}: {
  provider: TranslationProvider;
  scriptId: string;
  providerConfig?: object;
  units: TranslationUnit[];
  unitBatches?: TranslationUnit[][];
  existingTranslations?: Record<string, CachedTranslation>;
  signal?: AbortSignal;
  onProgress?: (progress: FullTranslationProgress) => void;
  onBatch?: (
    translations: Record<string, CachedTranslation>,
    configurationId?: string,
  ) => void;
}): Promise<FullTranslationResult> {
  const translations: Record<string, CachedTranslation> = {};
  const missingUnits = units.filter((unit) => {
    const existing = translationForUnit(existingTranslations, unit);
    if (!existing) return true;
    translations[unit.id] = {
      sourceHash: translationUnitSourceHash(unit),
      translatedText: existing,
    };
    return false;
  });
  const chunks = prepareTranslationChunks(missingUnits, unitBatches);
  let completed = Object.keys(translations).length;
  let configurationId: string | undefined;
  let publishedTps: number | undefined;
  const outputTokenSamples: OutputTokenSample[] = [];
  let currentProgress: FullTranslationProgress = {
    completed: Object.keys(translations).length,
    total: units.length,
    translatedCount: Object.keys(translations).length,
  };
  const publishProgress = () => {
    onProgress?.({
      ...currentProgress,
      ...(publishedTps === undefined ? {} : { tps: publishedTps }),
    });
  };
  const refreshTps = () => {
    if (!outputTokenSamples.length) {
      publishedTps = undefined;
    } else {
      publishedTps = rollingOutputTokensPerSecond(outputTokenSamples, translationClock());
    }
    publishProgress();
  };
  const tpsRefreshTimer = onProgress
    ? setInterval(refreshTps, TRANSLATION_TPS_WINDOW_MS)
    : undefined;
  publishProgress();

  try {
    for (const chunk of chunks) {
      if (signal?.aborted) throw new DOMException("Translation cancelled", "AbortError");
      let response: TranslationResponse | null = null;
      let attemptSamples: OutputTokenSample[] = [];
      for (let attempt = 0; attempt < 2; attempt += 1) {
        let observedOutputText = "";
        let observedOutputTokens = 0;
        attemptSamples = [];
        const onOutputText = (text: string) => {
          observedOutputText += text;
          const nextTokens = estimateLocalOutputTokens(observedOutputText);
          const deltaTokens = Math.max(0, nextTokens - observedOutputTokens);
          observedOutputTokens = nextTokens;
          if (deltaTokens) {
            const sample = { completedAt: translationClock(), tokens: deltaTokens };
            outputTokenSamples.push(sample);
            attemptSamples.push(sample);
            refreshTps();
          }
        };
        try {
          response = await requestTranslations({
            provider,
            scriptId,
            providerConfig,
            items: chunk,
            signal,
            onOutputText,
          });
          break;
        } catch (error) {
          for (const sample of attemptSamples) {
            const index = outputTokenSamples.indexOf(sample);
            if (index >= 0) outputTokenSamples.splice(index, 1);
          }
          const retryable = error instanceof TranslationRequestError && error.retryable;
          if (attempt === 0 && retryable && !signal?.aborted) {
            await waitForTranslationRetry(signal);
            continue;
          }
          throw error;
        }
      }

      if (!response || signal?.aborted) {
        throw new DOMException("Translation cancelled", "AbortError");
      }

      const sourceById = new Map(chunk.map((unit) => [unit.id, unit]));
      const batchTranslations: Record<string, CachedTranslation> = {};
      for (const item of response.translations) {
        const unit = sourceById.get(item.id);
        const translatedText = typeof item.translatedText === "string"
          ? item.translatedText.replace(/\r\n?/g, "\n").trim()
          : "";
        if (!unit || !translatedText) continue;
        batchTranslations[unit.id] = {
          sourceHash: translationUnitSourceHash(unit),
          translatedText,
        };
      }

      if (Object.keys(batchTranslations).length !== chunk.length) {
        throw new TranslationRequestError(
          "翻译后端未返回完整结果，请重试",
          "incomplete_translation",
          true,
          provider,
        );
      }

      Object.assign(translations, batchTranslations);
      configurationId = response.configurationId || configurationId;
      completed += chunk.length;
      onBatch?.(batchTranslations, configurationId);
      currentProgress = {
        completed,
        total: units.length,
        translatedCount: Object.keys(translations).length,
      };
      refreshTps();
    }

    if (Object.keys(translations).length !== units.length) {
      throw new TranslationRequestError(
        "翻译后端未返回完整结果，请重试",
        "incomplete_translation",
        true,
        provider,
      );
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }
    const translatedError = error instanceof TranslationRequestError
      ? error
      : new TranslationRequestError("翻译服务暂时不可用", "provider_unavailable", true, provider);
    throw new TranslationBatchError(
      translatedError.message,
      translatedError.code,
      translatedError.retryable,
      provider,
      { ...translations },
      Object.keys(translations).length,
      units.length,
    );
  } finally {
    if (tpsRefreshTimer !== undefined) clearInterval(tpsRefreshTimer);
  }

  return { translations, configurationId };
}

function translationFrameBatchKey(frames: StoryFrame[]) {
  return frames
    .flatMap(frameTranslationUnits)
    .map((unit) => `${unit.id}:${translationUnitSourceHash(unit)}`)
    .join("|");
}

function mergeTranslationFrameStep(frameGroups: StoryFrame[][]) {
  const frames = new Map<string, StoryFrame>();
  for (const frame of frameGroups.flat()) {
    const key = translationFrameBatchKey([frame]);
    if (key && !frames.has(key)) frames.set(key, frame);
  }
  return [...frames.values()];
}

/**
 * Expands a route into logical translation steps. A normal story frame takes
 * one step. At an unresolved choice, every option advances by one frame in the
 * same step; the shared continuation resumes after the longest option branch.
 */
function collectTranslationFrameSteps(
  frames: StoryFrame[],
  frameIndex: number,
  limit: number,
) {
  const steps: StoryFrame[][] = [];
  for (let index = Math.max(0, frameIndex); index < frames.length && steps.length < limit; index += 1) {
    const frame = frames[index];
    steps.push([frame]);
    if (frame.type !== "choice" || frame.selected !== undefined || !frame.options.length) continue;

    const branchLimit = limit - steps.length;
    const branches = frame.options.map((option) => (
      collectTranslationFrameSteps(option.frames, 0, branchLimit)
    ));
    const branchDepth = Math.min(
      branchLimit,
      branches.reduce((depth, branch) => Math.max(depth, branch.length), 0),
    );
    for (let depth = 0; depth < branchDepth; depth += 1) {
      const branchStep = mergeTranslationFrameStep(
        branches.map((branch) => branch[depth] ?? []),
      );
      if (branchStep.length) steps.push(branchStep);
    }
  }
  return steps;
}

/** Returns the current frame plus up to ten logical unread frames. */
export function createTranslationFrameLookahead(
  frames: StoryFrame[],
  frameIndex: number,
  aheadFrameCount = TRANSLATION_AHEAD_FRAME_COUNT,
) {
  const normalizedAheadCount = Math.max(0, Math.floor(aheadFrameCount));
  return collectTranslationFrameSteps(
    frames,
    frameIndex,
    normalizedAheadCount + (frames[frameIndex] ? 1 : 0),
  );
}

export async function fetchTranslationServerConfig(signal?: AbortSignal): Promise<TranslationServerConfig> {
  if (isAndroidNative()) return getNativeTranslationConfig();
  const response = await fetch("/translation-api/config", { signal });
  if (!response.ok) throw new TranslationRequestError("无法读取翻译服务配置", "provider_unavailable", true);
  return response.json() as Promise<TranslationServerConfig>;
}

async function parseLocalConfigResponse(response: Response) {
  if (response.ok) return response.json() as Promise<TranslationServerConfig>;
  let detail = "无法保存本地大模型配置";
  let code = "local_config_write_failed";
  try {
    const error = await response.json() as { detail?: string; code?: string };
    detail = error.detail || detail;
    code = error.code || code;
  } catch {
    // Keep the safe generic error when the local API returns a non-JSON body.
  }
  throw new TranslationRequestError(detail, code, false, "openai");
}

export async function saveLocalOpenAiConfig(input: {
  baseUrl: string;
  model: string;
  apiKey: string;
  allowNoAuth: boolean;
  clearApiKey: boolean;
  thinking: ThinkingType;
  reasoningEffort: ThinkingLevel;
}) {
  if (isAndroidNative()) return getNativeTranslationConfig();
  const response = await fetch("/translation-api/config/openai", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseLocalConfigResponse(response);
}

export async function deleteLocalOpenAiConfig() {
  if (isAndroidNative()) return getNativeTranslationConfig();
  const response = await fetch("/translation-api/config/openai", { method: "DELETE" });
  return parseLocalConfigResponse(response);
}

function emitTranslationText(response: TranslationResponse, onOutputText?: (text: string) => void) {
  if (!onOutputText) return;
  for (const translation of response.translations) {
    if (translation.translatedText) onOutputText(translation.translatedText);
  }
}

async function readStreamedTranslationResponse(
  response: Response,
  onOutputText: (text: string) => void,
): Promise<TranslationResponse> {
  if (!response.body?.getReader) {
    const result = await response.json() as TranslationResponse;
    emitTranslationText(result, onOutputText);
    return result;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: TranslationResponse | null = null;
  let streamedOutput = false;
  const processLine = (line: string) => {
    if (!line.trim()) return;
    let envelope: {
      type?: string;
      text?: string;
      result?: TranslationResponse;
      detail?: string;
      code?: string;
      provider?: TranslationProvider;
      retryable?: boolean;
    };
    try {
      envelope = JSON.parse(line) as typeof envelope;
    } catch {
      throw new TranslationRequestError("翻译服务返回了无效的流数据", "provider_invalid_response", true);
    }
    if (envelope.type === "chunk") {
      if (envelope.text) {
        streamedOutput = true;
        onOutputText(envelope.text);
      }
      return;
    }
    if (envelope.type === "error") {
      throw new TranslationRequestError(
        envelope.detail || "翻译服务暂时不可用",
        envelope.code || "provider_unavailable",
        envelope.retryable === true,
        envelope.provider,
      );
    }
    if (envelope.type === "result" && envelope.result) result = envelope.result;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/u);
    buffer = lines.pop() ?? "";
    for (const line of lines) processLine(line);
  }
  buffer += decoder.decode();
  if (buffer.trim()) processLine(buffer);
  if (!result) {
    throw new TranslationRequestError("翻译服务未返回完整结果", "provider_invalid_response", true);
  }
  if (!streamedOutput) emitTranslationText(result, onOutputText);
  return result;
}

export async function requestTranslations({
  provider,
  scriptId,
  providerConfig,
  items,
  signal,
  onOutputText,
}: {
  provider: TranslationProvider;
  scriptId: string;
  providerConfig?: object;
  items: TranslationUnit[];
  signal?: AbortSignal;
  onOutputText?: (text: string) => void;
}): Promise<TranslationResponse> {
  if (isAndroidNative()) {
    try {
      const result = await requestNativeTranslations({ provider, scriptId, providerConfig, items, signal });
      emitTranslationText(result, onOutputText);
      return result;
    } catch (error) {
      const nativeError = error as {
        detail?: unknown;
        message?: unknown;
        code?: unknown;
        retryable?: unknown;
      };
      throw new TranslationRequestError(
        typeof nativeError.detail === "string"
          ? nativeError.detail
          : typeof nativeError.message === "string"
            ? nativeError.message
            : "翻译服务暂时不可用",
        typeof nativeError.code === "string" ? nativeError.code : "provider_unavailable",
        nativeError.retryable === true,
        provider,
      );
    }
  }
  const stream = Boolean(onOutputText && provider === "openai");
  const response = await fetch("/translation-api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider, scriptId, providerConfig, items, stream }),
    signal,
  });
  if (!response.ok) {
    let detail = "翻译服务暂时不可用";
    let code = "provider_unavailable";
    let retryable = response.status >= 429;
    try {
      const error = await response.json() as { detail?: string; code?: string; retryable?: boolean };
      detail = error.detail || detail;
      code = error.code || code;
      retryable = error.retryable ?? retryable;
    } catch {
      // Keep the safe generic error when the local API returns a non-JSON body.
    }
    throw new TranslationRequestError(detail, code, retryable, provider);
  }
  if (stream) return readStreamedTranslationResponse(response, onOutputText!);
  const result = await response.json() as TranslationResponse;
  emitTranslationText(result, onOutputText);
  return result;
}

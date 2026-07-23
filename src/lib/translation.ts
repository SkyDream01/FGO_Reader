import type { StoryFrame } from "../types";
import { TRANSLATION_QUALITY_VERSION } from "../../shared/translation-core.mjs";
import { isAndroidNative } from "../platform/runtime";
import {
  getNativeTranslationConfig,
  requestNativeTranslations,
} from "../platform/nativeTranslation";

export type TranslationProvider = "deepl" | "openai" | "bing";
export type TranslationMode = "source" | "translated";
export type TranslationKind = "speaker" | "dialogue" | "choice";

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

const SETTINGS_KEY = "fgo-reader-translation-settings:v1";
const CACHE_INDEX_KEY = "fgo-reader-translation-cache-index:v2";
const CACHE_PREFIX = "fgo-reader-translation-cache:v2:";
const CACHE_ENTRY_LIMIT = 12;
export const TRANSLATION_AHEAD_FRAME_COUNT = 10;

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
    const hasLocalOverride = Boolean(
      settings.openai.baseUrl.trim()
      || settings.openai.apiKey.trim()
      || settings.openai.model.trim()
      || settings.openai.allowNoAuth,
    );
    if (!hasLocalOverride) return undefined;
    return {
      ...(settings.openai.baseUrl.trim() ? { baseUrl: settings.openai.baseUrl.trim() } : {}),
      ...(settings.openai.apiKey.trim() ? { apiKey: settings.openai.apiKey.trim() } : {}),
      ...(settings.openai.model.trim() ? { model: settings.openai.model.trim() } : {}),
      allowNoAuth: settings.openai.allowNoAuth,
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
  } else if (
    settings.openai.baseUrl.trim()
    || settings.openai.apiKey.trim()
    || settings.openai.model.trim()
    || settings.openai.allowNoAuth
  ) {
    return `client-${stableHash(JSON.stringify({
      provider: "openai",
      baseUrl: settings.openai.baseUrl.trim(),
      model: settings.openai.model.trim(),
      allowNoAuth: settings.openai.allowNoAuth,
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
  for (const entry of loadCacheIndex()) localStorage.removeItem(entry.key);
  localStorage.removeItem(CACHE_INDEX_KEY);
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

export async function requestTranslations({
  provider,
  scriptId,
  providerConfig,
  items,
  signal,
}: {
  provider: TranslationProvider;
  scriptId: string;
  providerConfig?: object;
  items: TranslationUnit[];
  signal?: AbortSignal;
}): Promise<TranslationResponse> {
  if (isAndroidNative()) {
    try {
      return await requestNativeTranslations({ provider, scriptId, providerConfig, items, signal });
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
  const response = await fetch("/translation-api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider, scriptId, providerConfig, items }),
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
  return response.json() as Promise<TranslationResponse>;
}

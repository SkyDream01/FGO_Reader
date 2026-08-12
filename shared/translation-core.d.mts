export type TranslationProvider = "deepl" | "openai" | "bing";
export type TranslationKind = "speaker" | "dialogue" | "choice";

export const TRANSLATION_QUALITY_VERSION: string;

export interface TranslationItem {
  id: string;
  kind: TranslationKind;
  text: string;
  speaker?: string;
}

export interface TranslationRequest {
  provider: TranslationProvider;
  scriptId: string;
  providerConfig?: Record<string, unknown>;
  items: TranslationItem[];
}

export interface TranslationProviderInfo {
  id: TranslationProvider;
  label: string;
  serverConfigured: boolean;
  experimental: boolean;
  configurationId: string | null;
}

export interface TranslationPublicConfig {
  sourceLanguage: "ja";
  targetLanguage: "zh-Hans";
  clientOverridesAllowed: boolean;
  providers: TranslationProviderInfo[];
}

export interface TranslationResult {
  provider: TranslationProvider;
  configurationId: string;
  translations: Array<{ id: string; translatedText: string }>;
}

export class TranslationError extends Error {
  status: number;
  code: string;
  detail: string;
  retryable: boolean;
  constructor(status: number, code: string, detail: string, retryable?: boolean);
}

export interface TranslationEngine {
  getPublicConfig(): TranslationPublicConfig;
  translate(body: TranslationRequest, signal?: AbortSignal): Promise<TranslationResult>;
}

export function createMemoryCache(options?: {
  maxEntries?: number;
  ttlMs?: number;
  now?: () => number;
}): unknown;

export function isAllowedProviderUrl(value: string): boolean;
export function resolveProviderConfig(
  provider: TranslationProvider,
  env?: Record<string, string | undefined>,
  override?: Record<string, unknown>,
): Record<string, unknown> & { provider: TranslationProvider; configurationId: string };
export function validateTranslationRequest(body: unknown): TranslationRequest & { providerConfig: Record<string, unknown> };
export function translateItemsWithProvider(config: unknown, items: TranslationItem[], context: unknown): Promise<Map<string, string>>;
export function toTranslationError(error: unknown): TranslationError;
export function createTranslationEngine(options?: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  cache?: unknown;
  timeoutMs?: number;
  clientOverridesAllowed?: boolean;
}): TranslationEngine;

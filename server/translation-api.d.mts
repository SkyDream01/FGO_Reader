export interface TranslationAppOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  cache?: unknown;
  timeoutMs?: number;
}

export function createTranslationApp(options?: TranslationAppOptions): any;

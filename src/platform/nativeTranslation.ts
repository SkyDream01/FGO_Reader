import {
  createTranslationEngine,
  TranslationError,
} from "../../shared/translation-core.mjs";
import type {
  TranslationProvider,
  TranslationResponse,
  TranslationServerConfig,
  TranslationUnit,
} from "../lib/translation";

const engine = createTranslationEngine({
  env: {},
  fetchImpl: (input, init) => fetch(input, init),
  clientOverridesAllowed: true,
});

export function getNativeTranslationConfig(): TranslationServerConfig {
  return engine.getPublicConfig();
}

export async function requestNativeTranslations(input: {
  provider: TranslationProvider;
  scriptId: string;
  providerConfig?: object;
  items: TranslationUnit[];
  signal?: AbortSignal;
}): Promise<TranslationResponse> {
  try {
    return await engine.translate({
      provider: input.provider,
      scriptId: input.scriptId,
      providerConfig: input.providerConfig as Record<string, unknown> | undefined,
      items: input.items,
    }, input.signal);
  } catch (error) {
    if (error instanceof TranslationError) throw error;
    throw new TranslationError(503, "provider_unavailable", "翻译服务暂时不可用", true);
  }
}

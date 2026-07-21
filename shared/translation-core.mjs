import {
  buildOpenAiSystemPrompt,
  resolveGlossaryTranslation,
  TRANSLATION_QUALITY_VERSION,
} from "./translation-quality.mjs";

const SOURCE_LANGUAGE = "ja";
const TARGET_LANGUAGE = "zh-Hans";
const BING_ADAPTER_VERSION = "edge-web-v1";
const ITEM_LIMIT = 20;
const ITEM_TEXT_LIMIT = 2_000;
const TOTAL_TEXT_LIMIT = 10_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const PROVIDERS = new Set(["deepl", "openai", "bing"]);
const KINDS = new Set(["speaker", "dialogue", "choice"]);

export { TRANSLATION_QUALITY_VERSION };

export class TranslationError extends Error {
  constructor(status, code, detail, retryable = false) {
    super(detail);
    this.name = "TranslationError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.retryable = retryable;
  }
}

class MemoryLruCache {
  constructor({ maxEntries = 2_000, ttlMs = 24 * 60 * 60 * 1_000, now = Date.now } = {}) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.now = now;
    this.values = new Map();
  }

  get(key) {
    const entry = this.values.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.values.delete(key);
      return undefined;
    }
    this.values.delete(key);
    this.values.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    this.values.delete(key);
    this.values.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.values.size > this.maxEntries) {
      const oldest = this.values.keys().next().value;
      if (oldest === undefined) break;
      this.values.delete(oldest);
    }
  }
}

export function createMemoryCache(options) {
  return new MemoryLruCache(options);
}

function readBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  return /^(?:1|true|yes|on)$/i.test(value.trim());
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function countCharacters(value) {
  return Array.from(value).length;
}

function normalizeText(value) {
  return value.replace(/\r\n?/g, "\n").trim();
}

// Configuration IDs are cache namespaces, not security tokens. Keeping this
// implementation Web-API-only lets the exact same provider code run in Node
// and in the Android WebView without bundling a Node crypto polyfill.
function configurationHash(value) {
  const input = JSON.stringify(value);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  let third = 0x85ebca6b;
  for (const symbol of input) {
    const code = symbol.codePointAt(0) ?? 0;
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x27d4eb2d);
    third = Math.imul(third ^ code, 0x165667b1);
  }
  const hex = (valueToFormat) => (valueToFormat >>> 0).toString(16).padStart(8, "0");
  return `${hex(first)}${hex(second)}${hex(third)}`.slice(0, 20);
}

export function isAllowedProviderUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function normalizeProviderUrl(value, label) {
  const normalized = value.replace(/\/+$/, "");
  if (!isAllowedProviderUrl(normalized)) {
    throw new TranslationError(
      400,
      "invalid_provider_config",
      `${label} 仅允许 HTTPS 或本机 HTTP 地址`,
    );
  }
  return normalized;
}

function resolveDeepLConfig(env, override = {}) {
  const authKey = nonEmpty(override.authKey) ?? nonEmpty(env.DEEPL_AUTH_KEY);
  if (!authKey) {
    throw new TranslationError(503, "provider_not_configured", "DeepL 尚未配置密钥");
  }
  const configuredUrl = nonEmpty(override.serverUrl) ?? nonEmpty(env.DEEPL_SERVER_URL);
  const serverUrl = normalizeProviderUrl(
    configuredUrl ?? (authKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com"),
    "DeepL 地址",
  );
  return {
    provider: "deepl",
    authKey,
    serverUrl,
    configurationId: configurationHash({
      provider: "deepl",
      serverUrl,
      qualityVersion: TRANSLATION_QUALITY_VERSION,
    }),
  };
}

function resolveOpenAiConfig(env, override = {}) {
  const baseUrlValue = nonEmpty(override.baseUrl) ?? nonEmpty(env.OPENAI_COMPAT_BASE_URL);
  const model = nonEmpty(override.model) ?? nonEmpty(env.OPENAI_COMPAT_MODEL);
  const allowNoAuth = typeof override.allowNoAuth === "boolean"
    ? override.allowNoAuth
    : readBoolean(env.OPENAI_COMPAT_ALLOW_NO_AUTH);
  const apiKey = allowNoAuth
    ? undefined
    : nonEmpty(override.apiKey) ?? nonEmpty(env.OPENAI_COMPAT_API_KEY);

  if (!baseUrlValue || !model || (!allowNoAuth && !apiKey)) {
    throw new TranslationError(
      503,
      "provider_not_configured",
      "OpenAI 兼容接口需要 Base URL、模型，以及密钥或无鉴权开关",
    );
  }
  const baseUrl = normalizeProviderUrl(baseUrlValue, "OpenAI 兼容 Base URL");
  return {
    provider: "openai",
    baseUrl,
    apiKey,
    model,
    allowNoAuth,
    configurationId: configurationHash({
      provider: "openai",
      baseUrl,
      model,
      allowNoAuth,
      qualityVersion: TRANSLATION_QUALITY_VERSION,
    }),
  };
}

function resolveBingConfig() {
  return {
    provider: "bing",
    configurationId: configurationHash({
      provider: "bing",
      adapterVersion: BING_ADAPTER_VERSION,
      qualityVersion: TRANSLATION_QUALITY_VERSION,
    }),
  };
}

export function resolveProviderConfig(provider, env = {}, override = {}) {
  switch (provider) {
    case "deepl":
      return resolveDeepLConfig(env, override);
    case "openai":
      return resolveOpenAiConfig(env, override);
    case "bing":
      return resolveBingConfig();
    default:
      throw new TranslationError(400, "invalid_request", "不支持的翻译后端");
  }
}

export function validateTranslationRequest(body) {
  if (!body || typeof body !== "object") {
    throw new TranslationError(400, "invalid_request", "翻译请求格式无效");
  }
  if (!PROVIDERS.has(body.provider)) {
    throw new TranslationError(400, "invalid_request", "请选择有效的翻译后端");
  }
  if (typeof body.scriptId !== "string" || !body.scriptId.trim() || body.scriptId.length > 80) {
    throw new TranslationError(400, "invalid_request", "脚本 ID 无效");
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > ITEM_LIMIT) {
    throw new TranslationError(400, "invalid_request", `每批翻译项目必须为 1–${ITEM_LIMIT} 项`);
  }
  if (
    body.providerConfig !== undefined
    && (body.providerConfig === null || typeof body.providerConfig !== "object" || Array.isArray(body.providerConfig))
  ) {
    throw new TranslationError(400, "invalid_provider_config", "页面翻译配置格式无效");
  }

  const ids = new Set();
  let totalLength = 0;
  const items = body.items.map((item) => {
    if (!item || typeof item !== "object") {
      throw new TranslationError(400, "invalid_request", "翻译项目格式无效");
    }
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const text = typeof item.text === "string" ? normalizeText(item.text) : "";
    const speaker = typeof item.speaker === "string" ? normalizeText(item.speaker) : undefined;
    if (!id || id.length > 180 || ids.has(id)) {
      throw new TranslationError(400, "invalid_request", "翻译项目 ID 必须唯一且有效");
    }
    if (!KINDS.has(item.kind)) {
      throw new TranslationError(400, "invalid_request", "翻译项目类型无效");
    }
    const textLength = countCharacters(text);
    if (!text || textLength > ITEM_TEXT_LIMIT) {
      throw new TranslationError(413, "payload_too_large", `单项文本不得超过 ${ITEM_TEXT_LIMIT} 字符`);
    }
    if (speaker && countCharacters(speaker) > 200) {
      throw new TranslationError(400, "invalid_request", "说话人名称过长");
    }
    totalLength += textLength;
    ids.add(id);
    return { id, kind: item.kind, text, ...(speaker ? { speaker } : {}) };
  });
  if (totalLength > TOTAL_TEXT_LIMIT) {
    throw new TranslationError(413, "payload_too_large", `每批文本不得超过 ${TOTAL_TEXT_LIMIT} 字符`);
  }
  return {
    provider: body.provider,
    scriptId: body.scriptId.trim(),
    providerConfig: body.providerConfig ?? {},
    items,
  };
}

function linkAbortSignal(controller, signal) {
  if (!signal) return () => undefined;
  if (signal.aborted) controller.abort(signal.reason);
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  return () => signal.removeEventListener("abort", abort);
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs, externalSignal) {
  const controller = new AbortController();
  const unlink = linkAbortSignal(controller, externalSignal);
  const timer = setTimeout(() => controller.abort(new Error("translation timeout")), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, redirect: "error", signal: controller.signal });
  } catch (error) {
    if (externalSignal?.aborted) throw error;
    if (controller.signal.aborted) {
      throw new TranslationError(504, "provider_timeout", "翻译服务响应超时", true);
    }
    throw new TranslationError(503, "provider_unavailable", "翻译服务暂时无法连接", true);
  } finally {
    clearTimeout(timer);
    unlink();
  }
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    throw new TranslationError(502, "provider_invalid_response", "翻译服务返回了无法解析的内容", true);
  }
}

function throwForUpstreamStatus(provider, response) {
  if (response.ok) return;
  if (response.status === 401 || response.status === 403) {
    throw new TranslationError(401, "provider_auth_failed", `${provider} 鉴权失败`);
  }
  if (response.status === 429) {
    throw new TranslationError(429, "provider_rate_limited", `${provider} 请求过于频繁或额度不足`, true);
  }
  if (response.status === 400 || response.status === 422) {
    throw new TranslationError(422, "provider_rejected", `${provider} 拒绝了翻译请求`);
  }
  if (response.status >= 500) {
    throw new TranslationError(503, "provider_unavailable", `${provider} 暂时不可用`, true);
  }
  throw new TranslationError(502, "provider_invalid_response", `${provider} 返回异常状态`, true);
}

function validateProviderTranslations(items, translations) {
  if (!Array.isArray(translations) || translations.length !== items.length) {
    throw new TranslationError(502, "provider_invalid_response", "翻译结果数量不完整", true);
  }
  const expected = new Set(items.map((item) => item.id));
  const output = new Map();
  for (const translation of translations) {
    const id = typeof translation?.id === "string" ? translation.id : "";
    const translatedText = typeof translation?.translatedText === "string"
      ? translation.translatedText.trim()
      : "";
    if (!expected.has(id) || output.has(id) || !translatedText) {
      throw new TranslationError(502, "provider_invalid_response", "翻译结果 ID 或正文无效", true);
    }
    output.set(id, translatedText);
  }
  return output;
}

async function translateWithDeepL(config, items, context) {
  const response = await fetchWithTimeout(
    context.fetchImpl,
    `${config.serverUrl}/v2/translate`,
    {
      method: "POST",
      headers: {
        authorization: `DeepL-Auth-Key ${config.authKey}`,
        "content-type": "application/json",
        "user-agent": "FGO-Chronicle-Reader/0.1",
      },
      body: JSON.stringify({
        text: items.map((item) => item.text),
        source_lang: "JA",
        target_lang: "ZH-HANS",
        preserve_formatting: true,
      }),
    },
    context.timeoutMs,
    context.signal,
  );
  throwForUpstreamStatus("DeepL", response);
  const data = await parseJsonResponse(response);
  const translations = data?.translations;
  if (!Array.isArray(translations) || translations.length !== items.length) {
    throw new TranslationError(502, "provider_invalid_response", "DeepL 返回的译文数量不完整", true);
  }
  return new Map(items.map((item, index) => {
    const translatedText = typeof translations[index]?.text === "string" ? translations[index].text.trim() : "";
    if (!translatedText) {
      throw new TranslationError(502, "provider_invalid_response", "DeepL 返回了空译文", true);
    }
    return [item.id, translatedText];
  }));
}

function openAiContentToString(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part?.text === "string" ? part.text : "").join("");
  }
  return "";
}

function parseOpenAiTranslations(content, items) {
  const unfenced = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new TranslationError(502, "provider_invalid_response", "OpenAI 兼容接口未返回 JSON", true);
  }
  let parsed;
  try {
    parsed = JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    throw new TranslationError(502, "provider_invalid_response", "OpenAI 兼容接口返回了无效 JSON", true);
  }
  return validateProviderTranslations(items, parsed?.translations);
}

async function translateWithOpenAi(config, items, context) {
  const endpoint = config.baseUrl.endsWith("/chat/completions")
    ? config.baseUrl
    : `${config.baseUrl}/chat/completions`;
  const headers = {
    "content-type": "application/json",
    "user-agent": "FGO-Chronicle-Reader/0.1",
  };
  if (!config.allowNoAuth && config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;

  const response = await fetchWithTimeout(
    context.fetchImpl,
    endpoint,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: [
          {
            role: "system",
            content: buildOpenAiSystemPrompt(items),
          },
          {
            role: "user",
            content: JSON.stringify({
              sourceLanguage: SOURCE_LANGUAGE,
              targetLanguage: TARGET_LANGUAGE,
              items,
            }),
          },
        ],
      }),
    },
    context.timeoutMs,
    context.signal,
  );
  throwForUpstreamStatus("OpenAI 兼容接口", response);
  const data = await parseJsonResponse(response);
  const content = openAiContentToString(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new TranslationError(502, "provider_invalid_response", "OpenAI 兼容接口没有返回正文", true);
  }
  return parseOpenAiTranslations(content, items);
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeJwtExpiry(token, fallbackNow) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return fallbackNow + 8 * 60 * 1_000;
    const parsed = JSON.parse(decodeBase64Url(payload));
    return typeof parsed.exp === "number" ? parsed.exp * 1_000 : fallbackNow + 8 * 60 * 1_000;
  } catch {
    return fallbackNow + 8 * 60 * 1_000;
  }
}

function createBingClient({ fetchImpl, timeoutMs, now }) {
  let token = "";
  let expiresAt = 0;

  const getToken = async (signal, force = false) => {
    if (!force && token && expiresAt - 60_000 > now()) return token;
    const response = await fetchWithTimeout(
      fetchImpl,
      "https://edge.microsoft.com/translate/auth",
      { headers: { "user-agent": "Mozilla/5.0 FGO-Chronicle-Reader/0.1" } },
      timeoutMs,
      signal,
    );
    throwForUpstreamStatus("Bing / Edge", response);
    token = (await response.text()).trim();
    if (!token) {
      throw new TranslationError(502, "provider_invalid_response", "Bing / Edge 未返回临时令牌", true);
    }
    expiresAt = decodeJwtExpiry(token, now());
    return token;
  };

  const requestTranslation = async (items, signal, forceToken = false) => {
    const bearer = await getToken(signal, forceToken);
    const response = await fetchWithTimeout(
      fetchImpl,
      "https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0&from=ja&to=zh-Hans",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearer}`,
          "content-type": "application/json",
          "user-agent": "Mozilla/5.0 FGO-Chronicle-Reader/0.1",
        },
        body: JSON.stringify(items.map((item) => ({ Text: item.text }))),
      },
      timeoutMs,
      signal,
    );
    if (response.status === 401 && !forceToken) return requestTranslation(items, signal, true);
    throwForUpstreamStatus("Bing / Edge", response);
    const data = await parseJsonResponse(response);
    if (!Array.isArray(data) || data.length !== items.length) {
      throw new TranslationError(502, "provider_invalid_response", "Bing / Edge 返回的译文数量不完整", true);
    }
    return new Map(items.map((item, index) => {
      const translatedText = typeof data[index]?.translations?.[0]?.text === "string"
        ? data[index].translations[0].text.trim()
        : "";
      if (!translatedText) {
        throw new TranslationError(502, "provider_invalid_response", "Bing / Edge 返回了空译文", true);
      }
      return [item.id, translatedText];
    }));
  };

  return { translate: requestTranslation };
}

async function translateUnresolvedItemsWithProvider(config, items, context) {
  switch (config.provider) {
    case "deepl":
      return translateWithDeepL(config, items, context);
    case "openai":
      return translateWithOpenAi(config, items, context);
    case "bing":
      return context.bingClient.translate(items, context.signal);
    default:
      throw new TranslationError(400, "invalid_request", "不支持的翻译后端");
  }
}

export async function translateItemsWithProvider(config, items, context) {
  const translated = new Map();
  const unresolved = [];
  for (const item of items) {
    const glossaryTranslation = resolveGlossaryTranslation(item);
    if (glossaryTranslation) translated.set(item.id, glossaryTranslation);
    else unresolved.push(item);
  }

  if (unresolved.length) {
    const providerTranslations = await translateUnresolvedItemsWithProvider(config, unresolved, context);
    for (const item of unresolved) {
      const translatedText = providerTranslations.get(item.id);
      if (!translatedText) {
        throw new TranslationError(502, "provider_invalid_response", "翻译结果缺少项目", true);
      }
      translated.set(item.id, translatedText);
    }
  }

  return new Map(items.map((item) => [item.id, translated.get(item.id)]));
}

function itemCacheKey(provider, configurationId, item) {
  return configurationHash({
    qualityVersion: TRANSLATION_QUALITY_VERSION,
    provider,
    configurationId,
    kind: item.kind,
    speaker: item.speaker ?? "",
    text: normalizeText(item.text),
  });
}

async function translateWithCache({ config, items, cache, inflight, context }) {
  const itemKeys = items.map((item) => itemCacheKey(config.provider, config.configurationId, item));
  const ownerItems = [];
  const ownerKeys = [];

  for (let index = 0; index < items.length; index += 1) {
    const key = itemKeys[index];
    if (cache.get(key) !== undefined || inflight.has(key) || ownerKeys.includes(key)) continue;
    ownerKeys.push(key);
    ownerItems.push(items[index]);
  }

  if (ownerItems.length) {
    const batchPromise = translateItemsWithProvider(config, ownerItems, context);
    ownerItems.forEach((item, index) => {
      const key = ownerKeys[index];
      const itemPromise = batchPromise.then((result) => {
        const translatedText = result.get(item.id);
        if (!translatedText) {
          throw new TranslationError(502, "provider_invalid_response", "翻译结果缺少项目", true);
        }
        cache.set(key, translatedText);
        return translatedText;
      });
      inflight.set(key, itemPromise);
      itemPromise.then(
        () => inflight.delete(key),
        () => inflight.delete(key),
      );
    });
  }

  const translated = await Promise.all(items.map(async (item, index) => {
    const key = itemKeys[index];
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const pending = inflight.get(key);
    if (!pending) {
      throw new TranslationError(502, "provider_invalid_response", "翻译任务未正确创建", true);
    }
    return pending;
  }));

  return items.map((item, index) => ({ id: item.id, translatedText: translated[index] }));
}

function safeProviderStatus(provider, env) {
  try {
    const config = resolveProviderConfig(provider, env, {});
    return { serverConfigured: true, configurationId: config.configurationId };
  } catch {
    return { serverConfigured: false, configurationId: null };
  }
}

export function toTranslationError(error) {
  if (error instanceof TranslationError) return error;
  return new TranslationError(503, "provider_unavailable", "翻译服务暂时不可用", true);
}

export function createTranslationEngine({
  env = {},
  fetchImpl = fetch,
  now = Date.now,
  cache = createMemoryCache({ now }),
  timeoutMs = Number(env.TRANSLATION_TIMEOUT_MS) > 0
    ? Number(env.TRANSLATION_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS,
  clientOverridesAllowed = env.TRANSLATION_ALLOW_CLIENT_CONFIG === undefined
    ? true
    : readBoolean(env.TRANSLATION_ALLOW_CLIENT_CONFIG),
} = {}) {
  const inflight = new Map();
  const bingClient = createBingClient({ fetchImpl, timeoutMs, now });

  const getPublicConfig = () => {
    const deepl = safeProviderStatus("deepl", env);
    const openai = safeProviderStatus("openai", env);
    return {
      sourceLanguage: SOURCE_LANGUAGE,
      targetLanguage: TARGET_LANGUAGE,
      clientOverridesAllowed,
      providers: [
        { id: "deepl", label: "DeepL", experimental: false, ...deepl },
        { id: "openai", label: "OpenAI 兼容", experimental: false, ...openai },
        {
          id: "bing",
          label: "Bing / Edge（非官方）",
          experimental: true,
          serverConfigured: true,
          configurationId: resolveBingConfig().configurationId,
        },
      ],
    };
  };

  const translate = async (body, signal) => {
    const validated = validateTranslationRequest(body);
    if (!clientOverridesAllowed && Object.keys(validated.providerConfig).length) {
      throw new TranslationError(400, "invalid_provider_config", "服务端已禁止页面覆盖翻译配置");
    }
    const config = resolveProviderConfig(
      validated.provider,
      env,
      clientOverridesAllowed ? validated.providerConfig : {},
    );
    const translations = await translateWithCache({
      config,
      items: validated.items,
      cache,
      inflight,
      context: { fetchImpl, timeoutMs, signal, bingClient },
    });
    return {
      provider: validated.provider,
      configurationId: config.configurationId,
      translations,
    };
  };

  return { getPublicConfig, translate };
}

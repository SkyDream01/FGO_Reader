import express from "express";
import {
  createMemoryCache,
  createTranslationEngine,
  isAllowedProviderUrl,
  resolveProviderConfig,
  toTranslationError,
  TranslationError,
  translateItemsWithProvider,
  validateTranslationRequest,
} from "../shared/translation-core.mjs";
import {
  clearLocalOpenAiConfig,
  publicLocalOpenAiConfig,
  writeLocalOpenAiConfig,
} from "./local-env-config.mjs";

export {
  createMemoryCache,
  isAllowedProviderUrl,
  resolveProviderConfig,
  TranslationError,
  translateItemsWithProvider,
  validateTranslationRequest,
};

function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function countCharacters(value) {
  return Array.from(value).length;
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

function validateLocalOpenAiConfig(body, env) {
  if (!body || typeof body !== "object") {
    throw new TranslationError(400, "invalid_provider_config", "大模型配置格式无效");
  }

  const baseUrlValue = nonEmpty(body.baseUrl);
  const model = nonEmpty(body.model);
  if (!baseUrlValue || countCharacters(baseUrlValue) > 2_048) {
    throw new TranslationError(400, "invalid_provider_config", "请填写有效的 API Base URL");
  }
  if (!model || countCharacters(model) > 200 || /[\r\n\0]/.test(model)) {
    throw new TranslationError(400, "invalid_provider_config", "请填写有效的模型 ID");
  }
  if (typeof body.allowNoAuth !== "boolean") {
    throw new TranslationError(400, "invalid_provider_config", "免鉴权开关格式无效");
  }
  if (body.apiKey !== undefined && typeof body.apiKey !== "string") {
    throw new TranslationError(400, "invalid_provider_config", "API 密钥格式无效");
  }
  if (body.clearApiKey !== undefined && typeof body.clearApiKey !== "boolean") {
    throw new TranslationError(400, "invalid_provider_config", "密钥清除选项格式无效");
  }

  const replacementApiKey = nonEmpty(body.apiKey);
  if (replacementApiKey && countCharacters(replacementApiKey) > 4_096) {
    throw new TranslationError(400, "invalid_provider_config", "API 密钥过长");
  }
  if (replacementApiKey && /[\r\n\0]/.test(replacementApiKey)) {
    throw new TranslationError(400, "invalid_provider_config", "API 密钥不能包含换行符");
  }
  if (replacementApiKey && body.clearApiKey) {
    throw new TranslationError(400, "invalid_provider_config", "不能同时替换和清除 API 密钥");
  }

  const baseUrl = normalizeProviderUrl(baseUrlValue, "OpenAI 兼容 Base URL");
  const apiKey = body.clearApiKey
    ? ""
    : replacementApiKey ?? nonEmpty(env.OPENAI_COMPAT_API_KEY) ?? "";
  if (!body.allowNoAuth && !apiKey && !body.clearApiKey) {
    throw new TranslationError(
      400,
      "invalid_provider_config",
      "需要填写 API 密钥，或开启本机免鉴权接口",
    );
  }

  return {
    OPENAI_COMPAT_BASE_URL: baseUrl,
    OPENAI_COMPAT_API_KEY: apiKey,
    OPENAI_COMPAT_MODEL: model,
    OPENAI_COMPAT_ALLOW_NO_AUTH: String(body.allowNoAuth),
  };
}

function assertLocalConfigWriteRequest(request) {
  const host = request.get("host")?.toLowerCase();
  if (!host) {
    throw new TranslationError(403, "local_config_forbidden", "本地配置只允许从当前阅读器页面修改");
  }

  let hostname;
  try {
    hostname = new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    throw new TranslationError(403, "local_config_forbidden", "本地配置只允许从当前阅读器页面修改");
  }
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(hostname)) {
    throw new TranslationError(403, "local_config_forbidden", "本地配置只允许通过本机地址修改");
  }

  const origin = request.get("origin");
  if (!origin) return;
  try {
    if (new URL(origin).host.toLowerCase() !== host) throw new Error("origin mismatch");
  } catch {
    throw new TranslationError(403, "local_config_forbidden", "跨站页面不能修改本地配置");
  }
}

export function createTranslationApp({
  env = process.env,
  localEnvPath,
  fetchImpl = fetch,
  now = Date.now,
  cache = createMemoryCache({ now }),
  timeoutMs = Number(env.TRANSLATION_TIMEOUT_MS) > 0
    ? Number(env.TRANSLATION_TIMEOUT_MS)
    : 15_000,
} = {}) {
  const router = express();
  const engine = createTranslationEngine({ env, fetchImpl, now, cache, timeoutMs });
  let envWriteQueue = Promise.resolve();

  const localConfigEditable = Boolean(localEnvPath);
  const publicServerConfig = () => ({
    ...engine.getPublicConfig(),
    localEnv: {
      openai: publicLocalOpenAiConfig(env, localConfigEditable),
    },
  });

  const sendRouteError = (response, error) => {
    const translatedError = error instanceof TranslationError
      ? error
      : new TranslationError(500, "local_config_write_failed", "无法写入本地 .env.local 配置");
    response.status(translatedError.status).json({
      detail: translatedError.detail,
      code: translatedError.code,
      retryable: translatedError.retryable,
    });
  };

  router.use(express.json({ limit: "64kb" }));

  router.get("/config", (_request, response) => {
    response.json(publicServerConfig());
  });

  router.put("/config/openai", async (request, response) => {
    try {
      assertLocalConfigWriteRequest(request);
      if (!localEnvPath) {
        throw new TranslationError(503, "local_config_unavailable", "当前启动方式不支持写入 .env.local");
      }
      const values = validateLocalOpenAiConfig(request.body, env);
      const write = () => writeLocalOpenAiConfig({ env, envFilePath: localEnvPath, values });
      const pendingWrite = envWriteQueue.then(write, write);
      envWriteQueue = pendingWrite.catch(() => undefined);
      await pendingWrite;
      response.json(publicServerConfig());
    } catch (error) {
      sendRouteError(response, error);
    }
  });

  router.delete("/config/openai", async (request, response) => {
    try {
      assertLocalConfigWriteRequest(request);
      if (!localEnvPath) {
        throw new TranslationError(503, "local_config_unavailable", "当前启动方式不支持写入 .env.local");
      }
      const write = () => clearLocalOpenAiConfig({ env, envFilePath: localEnvPath });
      const pendingWrite = envWriteQueue.then(write, write);
      envWriteQueue = pendingWrite.catch(() => undefined);
      await pendingWrite;
      response.json(publicServerConfig());
    } catch (error) {
      sendRouteError(response, error);
    }
  });

  router.post("/", async (request, response) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.once("aborted", abort);
    try {
      const result = await engine.translate(request.body, controller.signal);
      if (!controller.signal.aborted) response.json(result);
    } catch (error) {
      if (controller.signal.aborted || response.headersSent) return;
      const translatedError = toTranslationError(error);
      response.status(translatedError.status).json({
        detail: translatedError.detail,
        code: translatedError.code,
        provider: request.body?.provider,
        retryable: translatedError.retryable,
      });
    } finally {
      request.off("aborted", abort);
    }
  });

  router.use((error, _request, response, _next) => {
    if (response.headersSent) return;
    if (error?.type === "entity.too.large") {
      response.status(413).json({
        detail: "翻译请求正文过大",
        code: "payload_too_large",
        retryable: false,
      });
      return;
    }
    response.status(400).json({
      detail: "翻译请求 JSON 无效",
      code: "invalid_request",
      retryable: false,
    });
  });

  return router;
}

import { createServer } from "node:http";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTranslationApp,
  isAllowedProviderUrl,
  resolveProviderConfig,
  translateItemsWithProvider,
  validateTranslationRequest,
} from "./translation-api.mjs";

const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

async function serve(router) {
  const app = express();
  app.use(router);
  app.use((_request, response) => response.sendStatus(404));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

describe("translation provider configuration", () => {
  it("allows HTTPS and loopback HTTP but rejects arbitrary plaintext endpoints", () => {
    expect(isAllowedProviderUrl("https://example.test/v1")).toBe(true);
    expect(isAllowedProviderUrl("http://127.0.0.1:11434/v1")).toBe(true);
    expect(isAllowedProviderUrl("http://localhost:8000/v1")).toBe(true);
    expect(isAllowedProviderUrl("http://192.168.1.10/v1")).toBe(false);
    expect(isAllowedProviderUrl("https://user:pass@example.test/v1")).toBe(false);
  });

  it("merges local OpenAI-compatible overrides without using an OpenAI official key", () => {
    const config = resolveProviderConfig(
      "openai",
      {
        OPENAI_COMPAT_BASE_URL: "https://server.example/v1",
        OPENAI_COMPAT_API_KEY: "server-secret",
        OPENAI_COMPAT_MODEL: "server-model",
      },
      {
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "local-model",
        allowNoAuth: true,
      },
    );
    expect(config).toMatchObject({
      provider: "openai",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "local-model",
      allowNoAuth: true,
      apiKey: undefined,
    });
    expect(config.configurationId).not.toContain("server-secret");
  });
});

describe("translation request validation", () => {
  it("accepts speaker, dialogue and choice units and rejects duplicate IDs", () => {
    expect(validateTranslationRequest({
      provider: "bing",
      scriptId: "0500010010",
      items: [
        { id: "speaker:1", kind: "speaker", text: "マシュ" },
        { id: "frame:1", kind: "dialogue", speaker: "マシュ", text: "先輩。" },
        { id: "choice:1", kind: "choice", text: "おはよう" },
      ],
    }).items).toHaveLength(3);

    expect(() => validateTranslationRequest({
      provider: "bing",
      scriptId: "0500010010",
      items: [
        { id: "same", kind: "speaker", text: "A" },
        { id: "same", kind: "dialogue", text: "B" },
      ],
    })).toThrow(/ID/);
  });
});

describe("provider adapters", () => {
  it("maps OpenAI-compatible JSON output by ID", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const request = JSON.parse(init.body);
      expect(request.model).toBe("local-model");
      expect(request.messages[1].content).toContain("マシュ");
      expect(init.headers.authorization).toBeUndefined();
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: "```json\n{\"translations\":[{\"id\":\"speaker:1\",\"translatedText\":\"玛修\"}]}\n```",
          },
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const result = await translateItemsWithProvider(
      {
        provider: "openai",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "local-model",
        allowNoAuth: true,
        configurationId: "test",
      },
      [{ id: "speaker:1", kind: "speaker", text: "マシュ" }],
      {
        fetchImpl,
        timeoutMs: 1_000,
        signal: new AbortController().signal,
        bingClient: { translate: vi.fn() },
      },
    );
    expect(result.get("speaker:1")).toBe("玛修");
  });
});

describe("translation HTTP API", () => {
  it("does not expose secrets and never falls back from an explicitly selected provider", async () => {
    const fetchImpl = vi.fn(async () => new Response("unavailable", { status: 503 }));
    const app = createTranslationApp({
      env: {
        DEEPL_AUTH_KEY: "never-return-this",
        OPENAI_COMPAT_BASE_URL: "https://example.test/v1",
        OPENAI_COMPAT_API_KEY: "also-secret",
        OPENAI_COMPAT_MODEL: "model-a",
      },
      fetchImpl,
      timeoutMs: 1_000,
    });
    const origin = await serve(app);

    const configResponse = await fetch(`${origin}/config`);
    const configText = await configResponse.text();
    expect(configText).not.toContain("never-return-this");
    expect(configText).not.toContain("also-secret");

    const response = await fetch(origin, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "deepl",
        scriptId: "0500010010",
        items: [{ id: "frame:1", kind: "dialogue", text: "おはよう" }],
      }),
    });
    expect(response.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain("deepl.com");
  });
});

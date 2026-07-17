import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseEnv } from "node:util";
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
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
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

  it("edits only whitelisted OpenAI-compatible values in .env.local without returning secrets", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "fgo-reader-env-"));
    temporaryDirectories.push(directory);
    const localEnvPath = path.join(directory, ".env.local");
    await writeFile(localEnvPath, [
      "# keep this comment",
      "PORT=4999",
      "OPENAI_COMPAT_BASE_URL=https://old.example/v1",
      "OPENAI_COMPAT_API_KEY=old-test-key",
      "OPENAI_COMPAT_MODEL=old-model",
      "OPENAI_COMPAT_ALLOW_NO_AUTH=false",
      "",
    ].join("\n"));
    const env = {
      OPENAI_COMPAT_BASE_URL: "https://old.example/v1",
      OPENAI_COMPAT_API_KEY: "old-test-key",
      OPENAI_COMPAT_MODEL: "old-model",
      OPENAI_COMPAT_ALLOW_NO_AUTH: "false",
    };
    const app = createTranslationApp({ env, localEnvPath });
    const origin = await serve(app);

    const initialText = await (await fetch(`${origin}/config`)).text();
    expect(initialText).not.toContain("old-test-key");
    expect(JSON.parse(initialText).localEnv.openai).toMatchObject({
      editable: true,
      fileName: ".env.local",
      baseUrl: "https://old.example/v1",
      model: "old-model",
      apiKeyConfigured: true,
    });

    const saveResponse = await fetch(`${origin}/config/openai`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl: "http://127.0.0.1:11434/v1/",
        model: "qwen-test",
        apiKey: "replacement-test-key",
        allowNoAuth: false,
        clearApiKey: false,
      }),
    });
    const saveText = await saveResponse.text();
    expect(saveResponse.status).toBe(200);
    expect(saveText).not.toContain("replacement-test-key");
    expect(JSON.parse(saveText).localEnv.openai).toMatchObject({
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen-test",
      apiKeyConfigured: true,
    });

    const savedSource = await readFile(localEnvPath, "utf8");
    const savedEnv = parseEnv(savedSource);
    expect(savedSource).toContain("# keep this comment");
    expect(savedEnv.PORT).toBe("4999");
    expect(savedEnv.OPENAI_COMPAT_BASE_URL).toBe("http://127.0.0.1:11434/v1");
    expect(savedEnv.OPENAI_COMPAT_API_KEY).toBe("replacement-test-key");
    expect(savedEnv.OPENAI_COMPAT_MODEL).toBe("qwen-test");
    expect(env.OPENAI_COMPAT_MODEL).toBe("qwen-test");

    const keepResponse = await fetch(`${origin}/config/openai`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen-test-2",
        apiKey: "",
        allowNoAuth: false,
        clearApiKey: false,
      }),
    });
    expect(keepResponse.status).toBe(200);
    expect(parseEnv(await readFile(localEnvPath, "utf8")).OPENAI_COMPAT_API_KEY).toBe("replacement-test-key");

    const clearKeyResponse = await fetch(`${origin}/config/openai`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "qwen-test-2",
        apiKey: "",
        allowNoAuth: false,
        clearApiKey: true,
      }),
    });
    expect(clearKeyResponse.status).toBe(200);
    expect((await clearKeyResponse.json()).localEnv.openai.apiKeyConfigured).toBe(false);
    expect(parseEnv(await readFile(localEnvPath, "utf8")).OPENAI_COMPAT_API_KEY).toBe("");

    const deleteResponse = await fetch(`${origin}/config/openai`, { method: "DELETE" });
    expect(deleteResponse.status).toBe(200);
    const clearedEnv = parseEnv(await readFile(localEnvPath, "utf8"));
    expect(clearedEnv.PORT).toBe("4999");
    expect(clearedEnv.OPENAI_COMPAT_BASE_URL).toBe("");
    expect(clearedEnv.OPENAI_COMPAT_API_KEY).toBe("");
    expect(clearedEnv.OPENAI_COMPAT_MODEL).toBe("");
    expect(clearedEnv.OPENAI_COMPAT_ALLOW_NO_AUTH).toBe("false");
  });

  it("rejects cross-site attempts to change local environment configuration", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "fgo-reader-env-"));
    temporaryDirectories.push(directory);
    const app = createTranslationApp({ env: {}, localEnvPath: path.join(directory, ".env.local") });
    const origin = await serve(app);
    const response = await fetch(`${origin}/config/openai`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        origin: "https://example.test",
      },
      body: JSON.stringify({
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "local-model",
        apiKey: "",
        allowNoAuth: true,
        clearApiKey: false,
      }),
    });
    expect(response.status).toBe(403);
  });
});

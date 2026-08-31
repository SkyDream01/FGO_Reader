import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chunkTranslationUnits,
  clearPersistentTranslationCaches,
  collectStepTranslationUnits,
  providerConfigFromSettings,
  providerIsReady,
  requestTranslations,
  stableHash,
  stepTranslationUnits,
  translateTranslationUnits,
  translationForUnit,
  translationNamespace,
  translationUnitSourceHash,
  type TranslatableStep,
  type TranslationSettings,
} from "./translation";
import { SCRIPT_PARSER_VERSION } from "./scriptParserVersion";

const settings: TranslationSettings = {
  mode: "translated",
  provider: "openai",
  deepl: { authKey: "", serverUrl: "" },
  openai: {
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKey: "",
    model: "local-model",
    allowNoAuth: true,
    thinkingEnabled: false,
    thinkingLevel: "medium",
  },
};

class MemoryStorage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  keys() {
    return [...this.values.keys()];
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("translation units", () => {
  it("keeps step original text separate from speaker, dialogue and choice units", () => {
    const dialogue: TranslatableStep = {
      key: "step-1",
      kind: "message",
      speaker: "マシュ",
      text: "先輩、おはようございます。",
    };
    const units = stepTranslationUnits(dialogue);
    expect(units).toEqual([
      expect.objectContaining({ kind: "speaker", text: "マシュ" }),
      expect.objectContaining({ id: "step-1:dialogue", kind: "dialogue", speaker: "マシュ" }),
    ]);
    expect(dialogue.text).toBe("先輩、おはようございます。");

    const choice: TranslatableStep = {
      key: "choice-1",
      kind: "choice",
      speaker: "CHOICE",
      text: "",
      optionLabels: ["おはよう", "まだ眠い"],
    };
    expect(stepTranslationUnits(choice).map((unit) => unit.id)).toEqual([
      "choice-1:choice:0",
      "choice-1:choice:1",
    ]);

    expect(stepTranslationUnits({
      ...dialogue,
      key: "image-only-step",
      speaker: "旁白",
      text: "",
    })).toEqual([
      expect.objectContaining({ kind: "speaker", text: "旁白" }),
    ]);
  });

  it("merges step units in display order without repeating shared speakers", () => {
    const first: TranslatableStep = {
      key: "step-1",
      kind: "message",
      speaker: "マシュ",
      text: "最初の文",
    };
    const second: TranslatableStep = { ...first, key: "step-2", text: "次の文" };

    expect(collectStepTranslationUnits([first, second]).map((unit) => unit.id)).toEqual([
      `speaker:${stableHash("マシュ")}`,
      "step-1:dialogue",
      "step-2:dialogue",
    ]);
  });

  it("invalidates cached translations when the source changes", () => {
    const unit = { id: "step-1:dialogue", kind: "dialogue" as const, text: "最初の文" };
    const translations = {
      [unit.id]: {
        sourceHash: translationUnitSourceHash(unit),
        translatedText: "第一句",
      },
    };
    expect(translationForUnit(translations, unit)).toBe("第一句");
    expect(translationForUnit(translations, { ...unit, text: "別の文" })).toBeUndefined();
  });
});

describe("translation batching and readiness", () => {
  it("chunks requests at 20 units without changing their order", () => {
    const units = Array.from({ length: 21 }, (_, index) => ({
      id: `unit-${index}`,
      kind: "dialogue" as const,
      text: `文 ${index}`,
    }));
    const chunks = chunkTranslationUnits(units);
    expect(chunks.map((chunk) => chunk.length)).toEqual([20, 1]);
    expect(chunks.flat().map((unit) => unit.id)).toEqual(units.map((unit) => unit.id));
  });

  it("translates a complete section in batches and reuses existing translations", async () => {
    const units = Array.from({ length: 21 }, (_, index) => ({
      id: `unit-${index}`,
      kind: "dialogue" as const,
      text: `文 ${index}`,
    }));
    const existing = {
      [units[0].id]: {
        sourceHash: translationUnitSourceHash(units[0]),
        translatedText: "已有译文",
      },
    };
    const requests: Array<{ items: typeof units }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as {
        items: typeof units;
      };
      requests.push(payload);
      return {
        ok: true,
        json: async () => ({
          provider: "bing",
          configurationId: "test-config",
          translations: payload.items.map((item) => ({
            id: item.id,
            translatedText: `译：${item.text}`,
          })),
        }),
      } as Response;
    }));

    const progress: Array<{ completed: number; total: number; translatedCount: number; tps?: number }> = [];
    const result = await translateTranslationUnits({
      provider: "bing",
      scriptId: "script",
      units,
      existingTranslations: existing,
      onProgress: (value) => progress.push(value),
    });

    expect(requests.map((request) => request.items.length)).toEqual([20]);
    expect(result.configurationId).toBe("test-config");
    expect(result.translations[units[0].id].translatedText).toBe("已有译文");
    expect(Object.keys(result.translations)).toHaveLength(21);
    expect(progress.at(-1)).toMatchObject({ completed: 21, total: 21, translatedCount: 21 });
    expect(progress.at(-1)?.tps).toBeGreaterThan(0);
  });

  it("translates supplied one-shot batches serially and in order", async () => {
    const units = Array.from({ length: 4 }, (_, index) => ({
      id: `unit-${index}`,
      kind: "dialogue" as const,
      text: `文 ${index}`,
    }));
    const requests: Array<{ items: typeof units }> = [];
    let activeRequests = 0;
    let maxActiveRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as { items: typeof units };
      requests.push(payload);
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 0));
      activeRequests -= 1;
      return {
        ok: true,
        json: async () => ({
          provider: "bing",
          configurationId: "test-config",
          translations: payload.items.map((item) => ({
            id: item.id,
            translatedText: `译：${item.text}`,
          })),
        }),
      } as Response;
    }));

    const result = await translateTranslationUnits({
      provider: "bing",
      scriptId: "script",
      units,
      unitBatches: [units.slice(0, 2), units.slice(2)],
    });

    expect(requests.map((request) => request.items.map((item) => item.id))).toEqual([
      ["unit-0", "unit-1"],
      ["unit-2", "unit-3"],
    ]);
    expect(maxActiveRequests).toBe(1);
    expect(Object.keys(result.translations)).toHaveLength(4);
  });

  it("does not split a supplied one-shot frame group into provider-sized requests", async () => {
    const units = Array.from({ length: 21 }, (_, index) => ({
      id: `unit-${index}`,
      kind: "dialogue" as const,
      text: `文 ${index}`,
    }));
    const requests: Array<{ items: typeof units }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as { items: typeof units };
      requests.push(payload);
      return {
        ok: true,
        json: async () => ({
          provider: "bing",
          configurationId: "test-config",
          translations: payload.items.map((item) => ({
            id: item.id,
            translatedText: `译：${item.text}`,
          })),
        }),
      } as Response;
    }));

    await translateTranslationUnits({
      provider: "bing",
      scriptId: "script",
      units,
      unitBatches: [units],
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].items).toHaveLength(21);
  });

  it("refreshes the one-second rolling output TPS while translation is in progress", async () => {
    const units = [
      { id: "unit-0", kind: "dialogue" as const, text: "文 0" },
      { id: "unit-1", kind: "dialogue" as const, text: "文 1" },
    ];
    const progress: Array<{ tps?: number }> = [];
    let requestIndex = 0;
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as { items: typeof units };
      const delayMs = requestIndex++ === 0 ? 1_000 : 10_000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return {
        ok: true,
        json: async () => ({
          provider: "openai",
          configurationId: "test-config",
          translations: payload.items.map((item) => ({
            id: item.id,
            translatedText: "一二",
          })),
        }),
      } as Response;
    }));

    const translationPromise = translateTranslationUnits({
      provider: "openai",
      scriptId: "script",
      units,
      unitBatches: [[units[0]], [units[1]]],
      onProgress: (value) => progress.push(value),
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(progress.at(-1)?.tps).toBeCloseTo(2, 5);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(progress.at(-1)?.tps).toBe(0);

    await vi.advanceTimersByTimeAsync(10_000);
    await translationPromise;
  });

  it("reads streamed local translation responses for local TPS sampling", async () => {
    const result = {
      provider: "openai" as const,
      configurationId: "test-config",
      translations: [{ id: "unit-0", translatedText: "一二" }],
    };
    const responseBody = [
      { type: "chunk", text: "一" },
      { type: "chunk", text: "二" },
      { type: "result", result },
    ].map((envelope) => JSON.stringify(envelope)).join("\n") + "\n";
    const output: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body)).stream).toBe(true);
      return new Response(responseBody, {
        status: 200,
        headers: { "content-type": "application/x-ndjson" },
      });
    }));

    await expect(requestTranslations({
      provider: "openai",
      scriptId: "script",
      providerConfig: settings.openai,
      items: [{ id: "unit-0", kind: "dialogue", text: "架空試験文" }],
      onOutputText: (text) => output.push(text),
    })).resolves.toEqual(result);
    expect(output).toEqual(["一", "二"]);
  });

  it("recognizes a manual local OpenAI-compatible configuration", () => {
    expect(providerIsReady(settings, null)).toBe(true);
    expect(providerIsReady({
      ...settings,
      openai: { ...settings.openai, baseUrl: "", allowNoAuth: false },
    }, null)).toBe(false);
  });

  it("keeps server credentials usable while explicitly disabling thinking", () => {
    expect(providerConfigFromSettings({
      ...settings,
      openai: {
        baseUrl: "",
        apiKey: "",
        model: "",
        allowNoAuth: false,
        thinkingEnabled: false,
        thinkingLevel: "medium",
      },
    })).toEqual({ thinking: { type: "disabled" } });
  });

  it("sends the selected reasoning effort only when thinking is enabled", () => {
    expect(providerConfigFromSettings({
      ...settings,
      openai: { ...settings.openai, thinkingEnabled: true, thinkingLevel: "xhigh" },
    })).toMatchObject({
      thinking: { type: "enabled" },
      reasoningEffort: "xhigh",
    });
    expect(providerConfigFromSettings({
      ...settings,
      openai: { ...settings.openai, thinkingEnabled: false, thinkingLevel: "max" },
    })).toMatchObject({ thinking: { type: "disabled" } });
    expect(providerConfigFromSettings({
      ...settings,
      openai: { ...settings.openai, thinkingEnabled: false, thinkingLevel: "max" },
    })).not.toHaveProperty("reasoningEffort");

    expect(providerConfigFromSettings({
      ...settings,
      openai: {
        baseUrl: "",
        apiKey: "",
        model: "",
        allowNoAuth: false,
        thinkingEnabled: true,
        thinkingLevel: "high",
      },
    })).toEqual({
      thinking: { type: "enabled" },
      reasoningEffort: "high",
    });
  });

  it("reuses one translation cache across thinking strengths", () => {
    expect(translationNamespace({
      ...settings,
      openai: { ...settings.openai, thinkingEnabled: true, thinkingLevel: "low" },
    }, null)).toBe(translationNamespace({
      ...settings,
      openai: { ...settings.openai, thinkingEnabled: true, thinkingLevel: "max" },
    }, null));
  });

  it("produces stable non-secret cache identifiers", () => {
    expect(stableHash("same")).toBe(stableHash("same"));
    expect(stableHash("same")).not.toBe(stableHash("different"));
  });

  it("changes client cache namespaces when translation quality changes", () => {
    expect(translationNamespace(settings, null, "quality-v1"))
      .not.toBe(translationNamespace(settings, null, "quality-v2"));
    expect(translationNamespace(settings, null, "quality-v1"))
      .toBe(translationNamespace(settings, null, "quality-v1"));
  });

  it("clears all persistent translation cache versions and leaves unrelated storage intact", () => {
    const storage = new MemoryStorage();
    storage.setItem("fgo-reader-translation-settings:v1", "keep");
    storage.setItem(`fgo-reader-translation-cache:v${SCRIPT_PARSER_VERSION}:orphan`, "current");
    storage.setItem(`fgo-reader-translation-cache-index:v${SCRIPT_PARSER_VERSION}`, "[]");
    storage.setItem("fgo-reader-translation-cache:v4:legacy", "legacy");
    storage.setItem("fgo-reader-translation-cache-index:v4", "[]");
    vi.stubGlobal("localStorage", storage);

    clearPersistentTranslationCaches();

    expect(storage.keys()).toEqual(["fgo-reader-translation-settings:v1"]);
  });
});

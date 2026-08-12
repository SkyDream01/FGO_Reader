import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chunkTranslationUnits,
  collectTranslationUnits,
  createTranslationFrameLookahead,
  frameTranslationUnits,
  providerConfigFromSettings,
  providerIsReady,
  requestTranslations,
  stableHash,
  translateTranslationUnits,
  translationForUnit,
  translationNamespace,
  translationUnitSourceHash,
  type TranslationSettings,
} from "./translation";
import type { StoryFrame } from "../types";

const settings: TranslationSettings = {
  mode: "translated",
  provider: "openai",
  deepl: { authKey: "", serverUrl: "" },
  openai: {
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKey: "",
    model: "local-model",
    allowNoAuth: true,
  },
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("translation units", () => {
  it("keeps StoryFrame original text separate from speaker, dialogue and choice units", () => {
    const dialogue: StoryFrame = {
      id: "frame-1",
      type: "dialogue",
      speaker: "マシュ",
      text: "先輩、おはようございます。",
      scene: null,
      bgm: null,
      characters: [],
      effect: "none",
      transition: "none",
    };
    const units = frameTranslationUnits(dialogue);
    expect(units).toEqual([
      expect.objectContaining({ kind: "speaker", text: "マシュ" }),
      expect.objectContaining({ id: "frame-1:dialogue", kind: "dialogue", speaker: "マシュ" }),
    ]);
    expect(dialogue.text).toBe("先輩、おはようございます。");

    const choice: StoryFrame = {
      id: "choice-1",
      type: "choice",
      speaker: "CHOICE",
      text: "选择回应",
      scene: null,
      bgm: null,
      characters: [],
      effect: "none",
      transition: "none",
      options: [
        { label: "おはよう", frames: [] },
        { label: "まだ眠い", frames: [] },
      ],
    };
    expect(frameTranslationUnits(choice).map((unit) => unit.id)).toEqual([
      "choice-1:choice:0",
      "choice-1:choice:1",
    ]);

    expect(frameTranslationUnits({
      ...dialogue,
      id: "image-only-frame",
      speaker: "旁白",
      text: "",
    })).toEqual([
      expect.objectContaining({ kind: "speaker", text: "旁白" }),
    ]);
  });

  it("merges frame units in display order without repeating shared speakers", () => {
    const first: StoryFrame = {
      id: "frame-1",
      type: "dialogue",
      speaker: "マシュ",
      text: "最初の文",
      scene: null,
      bgm: null,
      characters: [],
      effect: "none",
      transition: "none",
    };
    const second: StoryFrame = { ...first, id: "frame-2", text: "次の文" };

    expect(collectTranslationUnits([first, second]).map((unit) => unit.id)).toEqual([
      `speaker:${stableHash("マシュ")}`,
      "frame-1:dialogue",
      "frame-2:dialogue",
    ]);
  });

  it("invalidates cached translations when the source changes", () => {
    const unit = { id: "frame-1:dialogue", kind: "dialogue" as const, text: "最初の文" };
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
  it("keeps ten logical unread frames after the current frame", () => {
    const frames: StoryFrame[] = Array.from({ length: 12 }, (_, index) => ({
      id: `frame-${index}`,
      type: "dialogue" as const,
      speaker: "Mash",
      text: `line ${index}`,
      scene: null,
      bgm: null,
      characters: [],
      effect: "none" as const,
      transition: "none" as const,
    }));

    const lookahead = createTranslationFrameLookahead(frames, 0);
    expect(lookahead).toHaveLength(11);
    expect(lookahead.every((step) => step.length === 1)).toBe(true);
    expect(lookahead.flat().map((frame) => frame.id))
      .toEqual(frames.slice(0, 11).map((frame) => frame.id));
  });

  it("counts every branch advancing one frame as one logical frame", () => {
    const branch = (prefix: string): StoryFrame[] => Array.from({ length: 7 }, (_, index) => ({
      id: `${prefix}-${index}`,
      type: "dialogue" as const,
      speaker: "Mash",
      text: `${prefix} ${index}`,
      scene: null,
      bgm: null,
      characters: [],
      effect: "none" as const,
      transition: "none" as const,
    }));
    const optionA = branch("option-a");
    const optionB = branch("option-b");
    const choice: StoryFrame = {
      id: "choice-nearby",
      type: "choice",
      speaker: "CHOICE",
      text: "choose",
      scene: null,
      bgm: null,
      characters: [],
      effect: "none",
      transition: "none",
      options: [
        { label: "A", frames: optionA },
        { label: "B", frames: optionB },
      ],
    };
    const route = [
      ...branch("route-head").slice(0, 2),
      choice,
      ...branch("route-tail"),
    ];
    const lookahead = createTranslationFrameLookahead(route, 1, 6);

    expect(lookahead.map((step) => step.map((frame) => frame.id))).toEqual([
      ["route-head-1"],
      ["choice-nearby"],
      ["option-a-0", "option-b-0"],
      ["option-a-1", "option-b-1"],
      ["option-a-2", "option-b-2"],
      ["option-a-3", "option-b-3"],
      ["option-a-4", "option-b-4"],
    ]);
  });

  it("resumes the shared route after the longest choice branch", () => {
    const line = (id: string): StoryFrame => ({
      id,
      type: "dialogue",
      speaker: "Mash",
      text: id,
      scene: null,
      bgm: null,
      characters: [],
      effect: "none",
      transition: "none",
    });
    const choice: StoryFrame = {
      id: "choice",
      type: "choice",
      speaker: "CHOICE",
      text: "choose",
      scene: null,
      bgm: null,
      characters: [],
      effect: "none",
      transition: "none",
      options: [
        { label: "A", frames: [line("a-0")] },
        { label: "B", frames: [line("b-0"), line("b-1")] },
      ],
    };

    expect(createTranslationFrameLookahead([choice, line("tail-0"), line("tail-1")], 0)
      .map((step) => step.map((frame) => frame.id))).toEqual([
      ["choice"],
      ["a-0", "b-0"],
      ["b-1"],
      ["tail-0"],
      ["tail-1"],
    ]);
  });

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

  it("leaves an empty page override undefined so server environment values can apply", () => {
    expect(providerConfigFromSettings({
      ...settings,
      openai: { baseUrl: "", apiKey: "", model: "", allowNoAuth: false },
    })).toBeUndefined();
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
});

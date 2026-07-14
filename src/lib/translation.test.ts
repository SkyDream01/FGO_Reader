import { describe, expect, it } from "vitest";
import {
  chunkTranslationUnits,
  frameTranslationUnits,
  nextTranslationPrefetchFrames,
  providerConfigFromSettings,
  providerIsReady,
  stableHash,
  translationForUnit,
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

  it("starts the next translation round only after the translated buffer drops below the threshold", () => {
    const frames: StoryFrame[] = Array.from({ length: 18 }, (_, index) => ({
      id: `frame-${index}`,
      type: "dialogue" as const,
      speaker: "マシュ",
      text: `台詞 ${index}`,
      scene: null,
      bgm: null,
      characters: [],
      effect: "none" as const,
      transition: "none" as const,
    }));
    const translatedFrames = frames.slice(0, 6);
    const translations = Object.fromEntries(
      translatedFrames.flatMap(frameTranslationUnits).map((unit) => [
        unit.id,
        {
          sourceHash: translationUnitSourceHash(unit),
          translatedText: `译：${unit.text}`,
        },
      ]),
    );

    expect(nextTranslationPrefetchFrames(frames, 0, translations)).toEqual([]);
    expect(nextTranslationPrefetchFrames(frames, 1, translations).map((frame) => frame.id)).toEqual([
      "frame-6",
      "frame-7",
      "frame-8",
      "frame-9",
      "frame-10",
      "frame-11",
      "frame-12",
      "frame-13",
      "frame-14",
      "frame-15",
    ]);
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
});

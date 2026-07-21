import { describe, expect, it } from "vitest";
import {
  chunkTranslationUnits,
  createTranslationFrameLookahead,
  frameTranslationUnits,
  providerConfigFromSettings,
  providerIsReady,
  stableHash,
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

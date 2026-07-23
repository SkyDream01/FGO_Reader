import { afterEach, describe, expect, it } from "vitest";
import type { StoryFrame } from "../types";
import {
  collectScriptTranslationUnits,
  createTranslationTemplate,
  inspectManualTranslationRecord,
  loadManualTranslation,
  parseTranslationTemplate,
  saveManualTranslation,
  serializeTranslationTemplate,
  setManualTranslationStorageForTesting,
  type ManualTranslationRecord,
  type ManualTranslationStorage,
  type TranslationTemplateV2,
} from "./manualTranslations";

function dialogue(id: string, speaker: string, text: string): StoryFrame {
  return {
    id,
    type: "dialogue",
    speaker,
    text,
    scene: null,
    bgm: null,
    characters: [],
    effect: "none",
    transition: "none",
  };
}

const frames: StoryFrame[] = [
  dialogue("script-0", "マシュ", "先輩。\nおはようございます。"),
  {
    id: "script-3",
    type: "choice",
    speaker: "CHOICE",
    text: "选择回应",
    scene: null,
    bgm: null,
    characters: [],
    effect: "none",
    transition: "none",
    options: [
      { label: "おはよう", frames: [dialogue("script-1", "マシュ", "今日もよろしくお願いします。")] },
      { label: "まだ眠い", frames: [dialogue("script-2", "ダ・ヴィンチ", "もう少し休みたまえ。")] },
    ],
  },
];

const context = {
  scriptId: "script",
  title: "翻译测试",
  masterName: "御主",
  frames,
};

afterEach(() => {
  setManualTranslationStorageForTesting(null);
});

describe("manual translation template", () => {
  it("collects every choice branch in reading order and deduplicates speakers", () => {
    const units = collectScriptTranslationUnits(frames);
    expect(units.map((unit) => [unit.kind, unit.text])).toEqual([
      ["speaker", "マシュ"],
      ["dialogue", "先輩。\nおはようございます。"],
      ["choice", "おはよう"],
      ["choice", "まだ眠い"],
      ["dialogue", "今日もよろしくお願いします。"],
      ["speaker", "ダ・ヴィンチ"],
      ["dialogue", "もう少し休みたまえ。"],
    ]);
    expect(units.filter((unit) => unit.kind === "speaker" && unit.text === "マシュ")).toHaveLength(1);
  });

  it("round-trips UTF-8 JSON with a BOM and permits blank untranslated entries", () => {
    const template = createTranslationTemplate(context);
    expect(template.version).toBe(2);
    template.entries[0].translatedText = "玛修";
    template.entries[1].translatedText = "前辈。\r\n早上好。";
    const record = parseTranslationTemplate(`\uFEFF${JSON.stringify(template)}`, context, 1234);

    expect(record.importedAt).toBe(1234);
    expect(Object.values(record.translations).map((translation) => translation.translatedText)).toEqual([
      "玛修",
      "前辈。\n早上好。",
    ]);
    expect(inspectManualTranslationRecord(record, context)).toMatchObject({
      status: "ready",
      translatedCount: 2,
      totalCount: template.entries.length,
    });
  });

  it("strictly rejects incomplete, duplicate, stale, empty, and cross-script files", () => {
    const template = createTranslationTemplate(context);
    template.entries[0].translatedText = "玛修";
    const parse = (next: TranslationTemplateV2) => parseTranslationTemplate(JSON.stringify(next), context);

    expect(() => parse({ ...template, scriptId: "other" })).toThrow("不属于当前脚本");
    expect(() => parse({ ...template, masterName: "藤丸立香" })).toThrow("不同的御主名称");
    expect(() => parse({ ...template, entries: template.entries.slice(1) })).toThrow("条目不完整");
    expect(() => parse({ ...template, entries: [...template.entries.slice(0, -1), template.entries[0]] })).toThrow("重复 ID");
    expect(() => parse({
      ...template,
      entries: template.entries.map((entry, index) => index === 1 ? { ...entry, sourceText: "改过的原文" } : entry),
    })).toThrow("原文与当前脚本不一致");
    expect(() => parse({
      ...template,
      entries: template.entries.map((entry) => ({ ...entry, translatedText: "" })),
    })).toThrow("尚未填写任何译文");

    const record = parse(template);
    expect(inspectManualTranslationRecord(record, {
      ...context,
      frames: [dialogue("script-0", "マシュ", "更新后的原文")],
    }).status).toBe("stale");
  });

  it("atomically replaces a script record so blank entries clear old translations", async () => {
    let saved: ManualTranslationRecord | null = null;
    const storage: ManualTranslationStorage = {
      load: async (key) => saved?.key === key ? saved : null,
      save: async (record) => {
        saved = record;
        return record;
      },
      delete: async (key) => {
        const existed = saved?.key === key;
        if (existed) saved = null;
        return existed;
      },
    };
    setManualTranslationStorageForTesting(storage);

    const first = createTranslationTemplate(context);
    first.entries[0].translatedText = "玛修";
    first.entries[1].translatedText = "第一版译文";
    await saveManualTranslation(parseTranslationTemplate(JSON.stringify(first), context));

    const second = createTranslationTemplate(context);
    second.entries[1].translatedText = "第二版译文";
    await saveManualTranslation(parseTranslationTemplate(JSON.stringify(second), context));
    const loaded = await loadManualTranslation(context.scriptId);

    expect(Object.values(loaded?.translations ?? {}).map((translation) => translation.translatedText)).toEqual([
      "第二版译文",
    ]);
    expect(serializeTranslationTemplate(context, loaded?.translations)).toContain("第二版译文");
    expect(serializeTranslationTemplate(context, loaded?.translations)).not.toContain("第一版译文");
  });
});

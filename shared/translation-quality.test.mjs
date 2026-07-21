import { describe, expect, it, vi } from "vitest";
import {
  buildOpenAiSystemPrompt,
  extractGlossaryMatches,
  fgoGlossarySnapshot,
  lookupGlossaryEntry,
  resolveGlossaryTranslation,
  TRANSLATION_PROMPT_VERSION,
  TRANSLATION_QUALITY_VERSION,
} from "./translation-quality.mjs";
import { translateItemsWithProvider } from "./translation-core.mjs";
import {
  fgoGotranCharacterNames,
  fgoGotranGlossaryMetadata,
  fgoGotranTerms,
} from "../third_party/fgogotran/glossary.mjs";

const context = (fetchImpl = vi.fn()) => ({
  fetchImpl,
  timeoutMs: 1_000,
  signal: new AbortController().signal,
  bingClient: { translate: vi.fn() },
});

describe("FgoGotran glossary snapshot", () => {
  it("pins the verified 2026.07.12.1 database", () => {
    expect(fgoGlossarySnapshot.metadata).toMatchObject({
      contentVersion: "2026.07.12.1",
      schemaVersion: 1,
      locale: "zh-Hans",
      dbSha256: "5de699a68ff1f1b9c46f6d9e7d9d4eb7c5648f362f86032c82525b9c67780104",
      dbSize: 102400,
    });
    expect(fgoGlossarySnapshot.characterNameCount).toBe(837);
    expect(fgoGlossarySnapshot.termCount).toBe(137);
    expect(TRANSLATION_PROMPT_VERSION).toBe("fgo-reader-translate-v2");
    expect(TRANSLATION_QUALITY_VERSION).toContain("fgogotran-2026.07.12.1");
    expect(fgoGotranGlossaryMetadata.characterNameCount).toBe(fgoGotranCharacterNames.length);
    expect(fgoGotranGlossaryMetadata.termCount).toBe(fgoGotranTerms.length);
    expect(fgoGotranCharacterNames.every((row) => (
      row.length === 3
      && row.slice(0, 2).every((value) => typeof value === "string" && value.length > 0)
      && Array.isArray(row[2])
    ))).toBe(true);
    expect(fgoGotranTerms.every((row) => (
      row.length === 4
      && row.slice(0, 3).every((value) => typeof value === "string" && value.length > 0)
      && Array.isArray(row[3])
    ))).toBe(true);
  });

  it("resolves character names, aliases and whole-item terms deterministically", () => {
    expect(resolveGlossaryTranslation({ kind: "speaker", text: "マシュ・キリエライト" }))
      .toBe("玛修·基列莱特");
    expect(resolveGlossaryTranslation({ kind: "speaker", text: "マシュキリエライト" }))
      .toBe("玛修·基列莱特");
    expect(resolveGlossaryTranslation({ kind: "dialogue", text: "カルデア" }))
      .toBe("迦勒底");
    expect(resolveGlossaryTranslation({ kind: "choice", text: "「カルデア」" }))
      .toBe("「迦勒底」");
    expect(lookupGlossaryEntry("存在しない架空名", "speaker")).toBeUndefined();
  });

  it("uses longest-first RAG matches without matching inside a longer Katakana word", () => {
    expect(extractGlossaryMatches([
      { kind: "dialogue", text: "マシュマロ" },
    ])).toEqual([]);

    const matches = extractGlossaryMatches([
      { kind: "dialogue", text: "マシュ・キリエライトはカルデアへ戻った。" },
    ]);
    expect(matches.map((entry) => entry.sourceText).slice(0, 3)).toEqual([
      "マシュ・キリエライト",
      "キリエライト",
      "カルデア",
    ]);
  });
});

describe("translation quality integration", () => {
  it("bypasses every provider for locally resolved items", async () => {
    for (const provider of ["deepl", "openai", "bing"]) {
      const fetchImpl = vi.fn();
      const providerContext = context(fetchImpl);
      const result = await translateItemsWithProvider(
        { provider },
        [
          { id: "speaker", kind: "speaker", text: "マシュ" },
          { id: "term", kind: "dialogue", text: "カルデア" },
        ],
        providerContext,
      );
      expect([...result.entries()]).toEqual([
        ["speaker", "玛修"],
        ["term", "迦勒底"],
      ]);
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(providerContext.bingClient.translate).not.toHaveBeenCalled();
    }
  });

  it("sends only unresolved items upstream and merges them in input order", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const request = JSON.parse(init.body);
      const userPayload = JSON.parse(request.messages[1].content);
      expect(userPayload.items.map((item) => item.id)).toEqual(["dialogue"]);
      expect(request.messages[0].content).toContain("マシュ -> 玛修 [character]");
      expect(request.messages[0].content).not.toContain("オリュンポス ->");
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              translations: [{ id: "dialogue", translatedText: "前辈，我们回去吧。" }],
            }),
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
      },
      [
        { id: "speaker", kind: "speaker", text: "マシュ" },
        { id: "dialogue", kind: "dialogue", speaker: "マシュ", text: "先輩、帰りましょう。" },
      ],
      context(fetchImpl),
    );
    expect([...result.entries()]).toEqual([
      ["speaker", "玛修"],
      ["dialogue", "前辈，我们回去吧。"],
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("assembles only relevant conditional prompt rules", () => {
    const prompt = buildOpenAiSystemPrompt([{
      id: "choice",
      kind: "choice",
      text: "マシュちゃんとカルデア《Chaldea》へ……",
    }]);
    expect(prompt).toContain("自然、忠实、适合连续阅读");
    expect(prompt).toContain("选项规则");
    expect(prompt).toContain("注音规则");
    expect(prompt).toContain("敬称规则");
    expect(prompt).toContain("停顿规则");
    expect(prompt).toContain("カルデア -> 迦勒底 [place]");
    expect(prompt).not.toContain("歧义规则：ロマン");
  });
});

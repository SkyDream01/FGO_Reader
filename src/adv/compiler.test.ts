import { describe, expect, it } from "vitest";
import { compileFgoScript } from "../lib/scriptParser";
import { SCRIPT_PARSER_VERSION } from "../lib/scriptParserVersion";
import { parseMarkup, renderTokensPlain } from "./markup";

const options = { scriptId: "test", masterName: "藤丸[x]", masterGender: "male" as const, variables: { 5: "123" } };
const compile = (source: string) => compileFgoScript(source, "test", options);
describe("evidence-based compiler", () => {
  it("resolves entry and internal labels without relocating choice branches", () => {
    const program = compile('＄entry\n[branch "later"]\n＠旁白\n跳过\n[k]\n＄"later"\n＠玛修\n到达\n[k]');
    expect(program.instructions[0].tag).toBe("label");
    expect(program.instructions[1].targetIndex).toBe(program.labels.get("later"));
    expect(program.messageCatalog[0].key).toContain(`@v${SCRIPT_PARSER_VERSION}:m:`);
  });
  it("lowers timing macros using native values including the authored 0,3 typo", () => {
    const program = compile("[wt 0,3]\n[twt 0.5]\n[wait frame 3]");
    expect(program.instructions.map((item) => item.params)).toEqual([["time", "0"], ["rtime", "0.5"], ["frame", "3"]]);
  });
  it("keeps inline actions at glyph offsets instead of hoisting them", () => {
    const program = compile("＠玛修\n前[charaFace A 3][wt 0.2]后\n[k]");
    expect(program.instructions.map((item) => item.tag)).toEqual(["$speaker", "$message", "k"]);
    expect(program.instructions[1].tokens).toMatchObject([{ type: "text", value: "前" }, { type: "command", tag: "charaFace" }, { type: "wait" }, { type: "text", value: "后" }]);
  });
  it("retains choice ordinals, hidden flags, resources and a shared exit", () => {
    const program = compile("？1,1000,saveMaterial：第一；asked\n[scene 10110]\n？2：第二\n[scene 95202]\n？！\n[end]");
    const choice = program.instructions[0];
    expect(choice.options).toMatchObject([{ id: 1, label: "第一", hiddenFlag: "asked", routeInfo: { route: 1000, saveMaterial: true } }, { id: 2, label: "第二" }]);
    expect(program.instructions[2]).toMatchObject({ tag: "$choiceExit", targetIndex: choice.endIndex });
    expect(program.sceneIds).toEqual(["10110", "95202"]);
  });
  it("selects gender-dependent resources and keeps image assets separate from backgrounds", () => {
    const program = compileFgoScript("[masterSet L 111 222 1]\n[masterScene 10110 95202]\n[imageSet D back10000 2]\n[sceneSet Q 142200 1]", "test", { masterGender: "female" });
    expect(program.characterIds).toEqual(["222"]);
    expect(program.sceneIds).toEqual(["95202", "142200"]);
    expect(program.assets).toContainEqual({ kind: "image", name: "back10000", path: "Image/back10000" });
  });
  it("diagnoses incomplete structures and missing jump targets", () => {
    const program = compile("[branch missing]\n[ifClear flag]\n？1：选择");
    expect(program.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining(["unresolved_label", "unclosed_if", "unclosed_choice"]));
  });
});
describe("supplement-markup", () => {
  it("implements ruby, emphasis and recursive gender selection", () => {
    const tokens = parseMarkup("[&女の[#躯:からだ]:男性][r][#强调]", options);
    expect(renderTokensPlain(tokens)).toBe("女の躯\n强调");
    expect(tokens).toContainEqual({ type: "ruby", base: "躯", ruby: "からだ" });
    expect(tokens).toContainEqual({ type: "emphasis", value: "强调" });
  });
  it("resolves replacement variables with sanitization and color reset", () => {
    expect(renderTokensPlain(parseMarkup("[%1]/[%5]/[%99]", options))).toBe("藤丸［x］/123/");
  });
  it("preserves unknown tags, literal punctuation, quotes and unmatched brackets", () => {
    const source = '[line3]・■［］"[#literal]"[unfinished';
    expect(renderTokensPlain(parseMarkup(source, options))).toBe(source);
  });
  it("preserves rich colors, font sizes, image alternate text and speed resets", () => {
    const tokens = parseMarkup("[51d4ff][f large]甲[-][s 0][image npc_language_5:文字][speed -]", options);
    expect(tokens).toEqual(expect.arrayContaining([{ type: "color", color: "#51d4ff" }, { type: "font", size: 48 }, { type: "speed", charsPerSecond: 0 }, { type: "image", name: "npc_language_5", alt: "文字", icon: false }, { type: "speed", charsPerSecond: null }]));
  });
});

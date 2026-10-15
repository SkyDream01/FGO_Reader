import { describe, expect, it } from "vitest";
import { parseCommandParameters, parseNativeParameters, parseScriptDocument } from "./scriptSyntax";
import { COMMAND_NAMES } from "../adv/spec";

describe("docs/out native source records", () => {
  it("recognizes the exact 366 dispatcher names and analysis macros", () => {
    expect(COMMAND_NAMES.size).toBe(366);
    const document = parseScriptDocument("[charaFace A 3]\n[charaface A 3]\n[wt 0.1]\n[specialEffectPuase cutting]");
    expect(document.nodes.map((node) => node.type)).toEqual(["command", "text", "command", "command"]);
  });
  it("classifies a command only when the whole line is one known bracket group", () => {
    const document = parseScriptDocument('[f small]  [f -]本文\n[font large][messageShake 0.05 4 7 1.0]本文\n[51d4ff][line 3]本文\n[image npc_language_5]\n[future value]\n"[charaFace A 3]"');
    expect(document.nodes.every((node) => node.type === "text")).toBe(true);
  });
  it("preserves quotes, backslashes, nesting and native delimiters", () => {
    expect(parseCommandParameters('input selectBranch "two words" [nested x] C:\\file')).toEqual(["input", "selectBranch", '"two words"', "[nested x]", "C:\\file"]);
    expect(parseNativeParameters('A 0,-50 0.4')).toEqual(["A", " ", "0", ",", "-50", " ", "0.4"]);
    expect(parseNativeParameters('flag=true')).toEqual(["flag", "=", "true"]);
  });
  it("records dollar markers as executable labels and uses the four native line separators", () => {
    const document = parseScriptDocument("\uFEFF＄entry\r\n＠玛修\uFFFE本文\uBBBF[k]\n＄later\n＊注释\n＃10110");
    expect(document.nodes[0]).toMatchObject({ type: "command", name: "label", args: ["entry"], span: { startLine: 1 } });
    expect(document.nodes.at(-2)).toMatchObject({ name: "label", args: ["later"] });
    expect(document.nodes.at(-1)).toMatchObject({ name: "scene", args: ["10110"] });
  });
  it("supports explicit localized markers without guessing a region's punctuation", () => {
    const document = parseScriptDocument("$entry\n@玛修\n?1:选项\n?!", { markers: { label: "$", talk: "@", choice: "?", choiceEnd: "?!", choiceSplit: ":" } });
    expect(document.nodes.map((node) => node.type)).toEqual(["command", "speaker", "choice", "choiceEnd"]);
  });
});

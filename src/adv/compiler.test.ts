import { describe, expect, it } from "vitest";
import { parseScriptDocument } from "../lib/scriptSyntax";
import { compileScriptDocument, renderTokensPlain } from "./compiler";

function compile(source: string, scriptId = "test") {
  const document = parseScriptDocument(source, { region: "JP" });
  return {
    document,
    program: compileScriptDocument(document, {
      scriptId,
      masterName: "御主",
      masterGender: "male",
    }),
  };
}

const tags = (program: ReturnType<typeof compile>["program"]) =>
  program.instructions.map((instruction) => instruction.tag);

describe("compileScriptDocument", () => {
  it("lowers the S-P8 prologue walkthrough into commands, talkName and message", () => {
    const { program } = compile(`＄01-00-00-00-1-0

[soundStopAll]
[bgm BGM_EVENT_2 0.1]
[scene 10110]
[charaSet A 98001000 0 マシュ]
[charaSet B 98003000 2 Dr.ロマン]
[fadein black 1]
[wait fade]

＠[51d4ff]アナウンス[-]
[51d4ff][line 3]塩基配列　　ヒトゲノムと確認[-][r][51d4ff][line 3]霊器属性　　善性・中立と確認[-]
[k]
`);

    expect(tags(program)).toEqual([
      "soundstopall",
      "bgm",
      "scene",
      "charaset",
      "charaset",
      "fadein",
      "wait",
      "talkname",
      "message",
    ]);

    const charaSet = program.instructions[3];
    expect(charaSet.params).toEqual(["A", "98001000", "0", "マシュ"]);

    const talkName = program.instructions[7];
    expect(talkName.speaker?.name).toBe("アナウンス");
    expect(talkName.isMessage).toBe(true);
    expect(talkName.messageKey).toBeTruthy();

    const message = program.instructions[8];
    expect(message.isMessage).toBe(true);
    expect(message.messageKey).toBe(talkName.messageKey);
    // Inline color/line/newline markup survives as a rich token stream.
    expect(message.tokens?.some((token) => token.type === "color")).toBe(true);
    expect(message.tokens?.some((token) => token.type === "line")).toBe(true);
    expect(message.tokens?.some((token) => token.type === "newline")).toBe(true);

    expect(program.messageCatalog).toHaveLength(1);
    expect(program.sceneIds).toContain("10110");
    expect(program.characterIds).toContain("98001000");
    expect(program.bgmNames).toContain("BGM_EVENT_2");
  });

  it("keeps source line numbers on instructions", () => {
    const { program } = compile(`[bgm BGM_EVENT_2 0.1]

[scene 10110]
`);
    expect(program.instructions.map((instruction) => instruction.line)).toEqual([1, 3]);
  });

  it("resolves forward label jumps", () => {
    const { program } = compile(`[jump lblEnd]
[bgm BGM_EVENT_2 0.1]
[label lblEnd]
[k]
＠テスト
本文[k]
`);
    const jump = program.instructions[0];
    expect(jump.tag).toBe("jump");
    expect(jump.targetIndex).toBe(program.instructions.findIndex((entry) => entry.tag === "label"));
  });

  it("degrades unresolved jumps to linear playback with a diagnostic", () => {
    const { program } = compile("[jump missing]\n[scene 100]");
    expect(program.instructions[0].targetIndex).toBe(1);
    expect(program.diagnostics.some((entry) => entry.code === "unresolved_label")).toBe(true);
  });

  it("lowers a choice block into inline bodies with a shared exit", () => {
    const { program } = compile(`＠選択
どれにする？
？1:一つ目
＠一つ目
一番[k]
？2:二つ目
＠二つ目
二番[k]
？！
＠後
共通[k]
`);
    const choiceIndex = program.instructions.findIndex((entry) => entry.tag === "choice");
    const choice = program.instructions[choiceIndex];
    expect(choice.options).toHaveLength(2);

    const firstBody = choice.options![0].bodyIndex;
    expect(program.instructions[firstBody].tag).toBe("talkname");
    expect(program.instructions[firstBody + 1].tag).toBe("message");
    const firstExit = program.instructions[firstBody + 2];
    expect(firstExit.tag).toBe("jump");
    // The shared exit is where main flow continues: the ＠後 talkName below.
    expect(firstExit.targetIndex).toBe(program.instructions.length - 2);

    const secondBody = choice.options![1].bodyIndex;
    expect(secondBody).toBeGreaterThan(firstBody);
    expect(program.instructions[secondBody].tag).toBe("talkname");
    expect(program.choiceCatalog).toHaveLength(1);
    expect(program.choiceCatalog[0].options.map((option) => option.label)).toEqual([
      "一つ目",
      "二つ目",
    ]);
  });

  it("lowers ifClear/else/endIf into conditional branches", () => {
    const { program } = compile(`[ifClear 60152100]
[bgm BGM_EVENT_1 1]
[else]
[bgm BGM_EVENT_2 1]
[endIf]
[scene 100]
`);
    const branch = program.instructions.find((entry) => entry.tag === "branch");
    expect(branch?.branch).toEqual({ kind: "questNotClear", questId: "60152100" });
    // Branch target = first instruction after [else] → the second bgm.
    const bgmIndexes = program.instructions
      .map((entry, index) => (entry.tag === "bgm" ? index : -1))
      .filter((index) => index >= 0);
    expect(branch?.targetIndex).toBe(bgmIndexes[1]);
    // The else-jump lands after [endIf] → the scene command.
    const elseJump = program.instructions[bgmIndexes[0] + 1];
    expect(elseJump.tag).toBe("jump");
    expect(elseJump.targetIndex).toBe(program.instructions.length);
  });

  it("captures flags with normalized boolean values", () => {
    const { program } = compile("[flag smn 1]\n[flag kda 0]");
    expect(program.instructions[0].params).toEqual(["smn", "true"]);
    expect(program.instructions[1].params).toEqual(["kda", "false"]);
  });

  it("resolves master name, gender branches and ruby text in the catalog", () => {
    const { program } = compile("＠マシュ\n[%1]です[#業:カルマ][&兄:姉][r]二行目[k]", "id1");
    const record = program.messageCatalog[0];
    expect(record.speaker).toBe("マシュ");
    expect(record.text).toBe("御主です業兄\n二行目");
    const message = program.instructions[1];
    expect(message.tokens).toEqual([
      { type: "text", value: "御主です" },
      { type: "ruby", base: "業", ruby: "カルマ" },
      { type: "text", value: "兄" },
      { type: "newline" },
      { type: "text", value: "二行目" },
    ]);
  });

  it("hoists inline commands inside dialogue bodies before the message", () => {
    const { program } = compile("＠ロマン\n前[charaFace A 3]後[k]");
    expect(tags(program)).toEqual(["charaface", "talkname", "message"]);
  });

  it("renders plain text through the token stream helper", () => {
    expect(renderTokensPlain([
      { type: "text", value: "あ" },
      { type: "color", color: "#51d4ff" },
      { type: "text", value: "い" },
      { type: "color", color: null },
      { type: "line", length: 3 },
      { type: "newline" },
      { type: "ruby", base: "漢", ruby: "かん" },
      { type: "text", value: "じ" },
    ])).toBe("あい———\n漢じ");
  });
});

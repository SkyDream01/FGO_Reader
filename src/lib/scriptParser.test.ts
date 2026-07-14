import { describe, expect, it } from "vitest";
import { cleanScriptText, parseFgoScript } from "./scriptParser";

describe("cleanScriptText", () => {
  it("converts common FGO markup", () => {
    expect(
      cleanScriptText("你好[sr][#前辈:せんぱい]，[&君:ちゃん]，[%1]", "藤丸"),
    ).toBe("你好\n前辈，君，藤丸");
  });

  it("understands slotted speaker names and page breaks", () => {
    const script = `
[charaSet A 98001000 0 玛修]
[charaPut A 1]
＠A：玛修
第一行[sr]第二行
[page]
`;
    const parsed = parseFgoScript(script, "slot-demo");
    expect(parsed.frames[0]).toMatchObject({
      speaker: "玛修",
      text: "第一行\n第二行",
    });
    expect(parsed.frames[0].characters[0].active).toBe(true);
  });

  it("maps coordinate positions used by newer scripts", () => {
    const script = `
[charaSet A 1 0 左]
[charaSet B 2 0 中]
[charaSet C 3 0 右]
[charaFadein A 0.1 -256,0]
[charaFadein B 0.1 0,-50]
[charaFadein C 0.1 150,0]
＠B：中
坐标测试
[k]
`;
    const parsed = parseFgoScript(script, "coordinate-demo");
    expect(parsed.frames[0].characters.map((character) => character.position)).toEqual([
      "left",
      "center",
      "right",
    ]);
  });
});

describe("parseFgoScript", () => {
  it("keeps effect anchors, sub-camera slots and parked objects out of the character layer", () => {
    const script = `
[charaSet S 98115000 1 エフェクト用]
[charaSet T 2000001 1 サブカメラ用]
[charaSet U 2000002 1 画面外]
[charaSet V 2000003 1 伯爵]
[charaLayer T sub #A]
[charaTalk depthOff]
[charaPut S 1]
[charaEffect S bit_talk_4elements_light]
[charaPut T 0,-30]
[charaEffect T bit_talk_4elements_light]
[charaPut U 2000,2000]
[charaPut V 1]
＠伯爵
思うに[line 3]
[k]
`;

    const parsed = parseFgoScript(script, "jp-effect-anchor");

    expect(parsed.frames[0]).toMatchObject({
      speaker: "伯爵",
      text: "思うに——",
    });
    expect(parsed.frames[0].characters).toEqual([
      expect.objectContaining({ id: "2000003", name: "伯爵", position: "center" }),
    ]);
  });

  it("preserves legitimate same-id character instances in separate slots", () => {
    const script = `
[charaSet A 1001001 1 玛修]
[charaSet B 1001001 1 玛修]
[charaPut A 0]
[charaPut B 2]
＠A：玛修
双实例测试
[k]
`;

    const parsed = parseFgoScript(script, "same-id-slots");

    expect(parsed.frames[0].characters.map(({ slot, id, position }) => ({
      slot,
      id,
      position,
    }))).toEqual([
      { slot: "A", id: "1001001", position: "left" },
      { slot: "B", id: "1001001", position: "right" },
    ]);
  });

  it("tracks scene, characters, bgm and choices", () => {
    const script = `
[charaSet A 1001001 1 玛修]
[scene 10201]
[bgm BGM_EVENT_2 0.1]
[charaTalk A]
[charaFadein A 0.2 1]
＠玛修
早上好。[r]前辈。
[k]
？1：出发吧
＠玛修
好的。
[k]
？2：再等等
＠玛修
明白了。
[k]
？！
`;
    const parsed = parseFgoScript(script, "demo");
    expect(parsed.frames).toHaveLength(2);
    expect(parsed.frames[0]).toMatchObject({
      type: "dialogue",
      speaker: "玛修",
      scene: "10201",
      bgm: "BGM_EVENT_2",
    });
    expect(parsed.frames[0].characters[0]).toMatchObject({
      id: "1001001",
      position: "center",
      active: true,
    });
    const choice = parsed.frames[1];
    expect(choice.type).toBe("choice");
    if (choice.type === "choice") {
      expect(choice.options.map((option) => option.label)).toEqual([
        "出发吧",
        "再等等",
      ]);
      expect(choice.options[0].frames[0]).toMatchObject({ text: "好的。" });
    }
  });
});

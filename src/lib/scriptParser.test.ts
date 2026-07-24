import { readFile } from "node:fs/promises";
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
  it("splits consecutive click markers into frames while retaining the speaker", () => {
    const parsed = parseFgoScript([
      "＄01-00-00-01-1-0",
      "[charaSet A 98001000 1 マシュ]",
      "[charaPut A 1]",
      "＠A：マシュ",
      "……マスター。[k]",
      "本日もよろしくお願いします。[k]",
    ].join("\n"), "documented-dialogue");

    expect(parsed.frames.map((frame) => ({
      speaker: frame.speaker,
      text: frame.text,
    }))).toEqual([
      { speaker: "マシュ", text: "……マスター。" },
      { speaker: "マシュ", text: "本日もよろしくお願いします。" },
    ]);
    expect(parsed.frames[0].characters).toEqual([
      expect.objectContaining({ slot: "A", visible: true, active: true }),
    ]);
  });

  it("activates every spot speaker and accepts the full charaFilter argument form", () => {
    const parsed = parseFgoScript([
      "[charaSet A 1001 1 A]",
      "[charaSet B 1002 1 B]",
      "[charaFilter A X silhouette 00000080]",
      "[charaPut A 0]",
      "[charaPut B 2]",
      "＠二人=spot[A,B]",
      "同時発言。[k]",
    ].join("\n"), "spot-dialogue");

    expect(parsed.frames[0].characters).toEqual([
      expect.objectContaining({ slot: "A", active: true, silhouette: true }),
      expect.objectContaining({ slot: "B", active: true, silhouette: false }),
    ]);
  });

  it("supports comma-separated charaTalk slots without treating stop commands as effects", () => {
    const parsed = parseFgoScript([
      "[charaSet A 1001 1 A]",
      "[charaSet B 1002 1 B]",
      "[charaPut A -256,0]",
      "[charaPut B 256,0]",
      "[charaMoveScale A 2.5 1.0]",
      "[charaTalk A,B]",
      "[flashOff]",
      "[shakeStop]",
      "＠二人",
      "同時発言。[k]",
    ].join("\n"), "multi-talk");

    expect(parsed.frames[0]).toMatchObject({
      effect: "none",
      transition: "none",
      characters: [
        expect.objectContaining({ slot: "A", position: "left", active: true }),
        expect.objectContaining({ slot: "B", position: "right", active: true }),
      ],
    });
  });

  it("selects gender-dependent master assets and stops at the end command", () => {
    const parsed = parseFgoScript([
      "[masterSet L 1098348300 1098348310 1]",
      "[masterScene 276600 276601 1.0]",
      "[charaFadein L 0.1 1]",
      "＠L：[%1]",
      "選択された姿です。[k]",
      "[end]",
      "この行は終了後なので表示しない。[k]",
    ].join("\n"), "master-assets", {
      masterName: "藤丸",
      masterGender: "female",
    });

    expect(parsed.frames).toHaveLength(1);
    expect(parsed.frames[0]).toMatchObject({
      speaker: "藤丸",
      scene: "276601",
      characters: [
        expect.objectContaining({
          slot: "L",
          id: "1098348310",
          name: "藤丸",
          active: true,
        }),
      ],
    });
  });

  it("does not show preloaded figures before their entrance and preserves charaChange visibility", () => {
    const parsed = parseFgoScript([
      "[charaSet A 4032000 1 埃尔梅罗Ⅱ世]",
      "[charaSet C 1098123200 1 ？？？]",
      "[charaFilter C silhouette 00000080]",
      "[charaSet D 9005001 1 ？？？]",
      "[charaFilter D silhouette 00000080]",
      "[charaSet E 98001000 1 ？？？]",
      "[charaFilter E silhouette 00000080]",
      "[charaTalk A]",
      "[charaFace A 7]",
      "[charaFadein A 0.4 1]",
      "＠A：谜之少女",
      "终于醒了啊。我的弟子。[k]",
      "[charaChange A 1098164900 5 nomal 0]",
      "＠A：谜之少女",
      "立绘切换后仍在场。[k]",
    ].join("\n"), "cn-preloaded-figures");

    expect(parsed.frames[0].characters).toEqual([
      expect.objectContaining({
        slot: "A",
        id: "4032000",
        face: 7,
        visible: true,
      }),
    ]);
    expect(parsed.frames[1].characters).toEqual([
      expect.objectContaining({
        slot: "A",
        id: "1098164900",
        face: 5,
        visible: true,
      }),
    ]);
  });

  it("keeps empty dialogue frames for images that have no dialogue", () => {
    const script = `
[charaSet A 1001001 1 玛修]
[charaTalk A]
[charaPut A 1]
[scene 100]
[fadein black 0.5]
[scene 200]
＠旁白
第二张图片有正文。
[k]
[scene 300]
＠旁白
[k]
[scene 400]
[fadein white 0.5]
`;

    const parsed = parseFgoScript(script, "image-only-scenes");

    expect(parsed.frames.map(({ scene, text }) => ({ scene, text }))).toEqual([
      { scene: "100", text: "" },
      { scene: "200", text: "第二张图片有正文。" },
      { scene: "300", text: "" },
      { scene: "400", text: "" },
    ]);
    expect(parsed.frames[0].characters).toEqual([
      expect.objectContaining({ slot: "A", active: false }),
    ]);
    expect(parsed.sceneCount).toBe(4);
  });

  it("keeps effect anchors, sub-camera slots and parked objects out of the character layer", () => {
    const script = `
[charaSet S 98115000 1 エフェクト用]
[charaSet G 98109200 1 特效用dummy]
[charaSet T 2000001 1 サブカメラ用]
[charaSet U 2000002 1 画面外]
[charaSet V 2000003 1 伯爵]
[charaLayer T sub #A]
[charaTalk depthOff]
[charaPut S 1]
[charaEffect S bit_talk_4elements_light]
[charaPut G 600,800]
[charaEffect G bit_talk_impactlanding]
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

  it("shows a faded-in communicator without rendering its noise effect anchor", () => {
    const script = `
[charaSet F 99502600 1 玛修]
[charaFilter F silhouette 00000080]
[charaSet I 98014000 1 通信噪音]
[charaPut I 1]
[charaEffect I bit_talk_10]
[charaTalk F]
[charaFace F 0]
[charaFadeTime F 0.4 0.7]
＠玛修
前辈！　听得……到吗……！
[k]
`;

    const parsed = parseFgoScript(script, "communication-noise");

    expect(parsed.frames[0].characters).toEqual([
      expect.objectContaining({
        slot: "F",
        id: "99502600",
        name: "玛修",
        visible: true,
        silhouette: true,
        active: true,
      }),
    ]);
    expect(parsed.frames[0].characters).not.toContainEqual(
      expect.objectContaining({ slot: "I" }),
    );
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

  it("hides characters behind visible scene layers by depth", () => {
    const script = `
[charaSet B 1098341100 1 オルガマリー]
[charaSet D 1098341100 3 オルガマリー]
[sceneSet J 269400 1]
[charaDepth D 6]
[charaDepth J 4]
[charaDepth B 2]
[charaFadein D 0.4 -250,0]
[charaFadein J 0.4 -150,-300]
[charaFadein B 0.1 1]
＠D：オルガマリー
前景の立ち絵だけを表示する。
[k]
[charaFadeout D 0.4]
[charaFadeout J 0.4]
＠B：オルガマリー
背景レイヤーの退場後に表示する。
[k]
`;

    const parsed = parseFgoScript(script, "scene-layer-depth");

    expect(parsed.frames[0].characters.map(({ slot }) => slot)).toEqual(["D"]);
    expect(parsed.frames[1].characters.map(({ slot }) => slot)).toEqual(["B"]);
  });

  it("removes characters erased by charaSpecialEffect flashErasure", () => {
    const script = `
[charaSet D 1098273900 1 演出用_Ｅ－オルガマリー]
[charaTalk D]
[charaFadein D 0.1 1]
＠Ｅ－オルガマリー
消去前のセリフ。
[k]
[charaSpecialEffect D flashErasure 1 1.7]
[wait charaSpecialEffect D]
[charaSet B 1098257300 1 ダ・ヴィンチ]
[charaTalk B]
[charaFadein B 0.1 1]
＠ダ・ヴィンチ
消去後のセリフ。
[k]
`;

    const parsed = parseFgoScript(script, "flash-erasure");

    expect(parsed.frames[0].characters).toEqual([
      expect.objectContaining({ slot: "D", face: 1, visible: true }),
    ]);
    expect(parsed.frames[1]).toMatchObject({
      type: "animation",
      characters: [],
    });
    expect(parsed.frames[2].characters).toEqual([
      expect.objectContaining({ slot: "B", visible: true }),
    ]);
  });

  it("removes characters erased by erasureReverse before the next speaker appears", () => {
    const script = `
[charaSet A 4032000 1 埃尔梅罗Ⅱ世]
[charaSet B 1098165800 1 仿古自动人偶]
[charaTalk B]
[charaFadein B 0.1 1]
[charaSpecialEffect B erasureReverse 1 0.3]
[charaTalk A]
[charaFadein A 0.1 1]
＠埃尔梅罗Ⅱ世
哼，逃走了吗？
[k]
`;

    const parsed = parseFgoScript(script, "erasure-reverse");

    expect(parsed.frames[0].characters).toEqual([
      expect.objectContaining({ slot: "A", name: "埃尔梅罗Ⅱ世", visible: true }),
    ]);
    expect(parsed.frames[0].characters).not.toContainEqual(
      expect.objectContaining({ slot: "B" }),
    );
  });

  it("removes animation stand-ins erased by appearanceReverse", () => {
    const script = `
[charaSet A 1098330800 7 マシュ]
[charaSet C 8001900 21 マシュ]
[charaSet E 1098341100 25 オルガマリー]
[charaPut A 200,0]
[charaSpecialEffect A appearanceReverse 1 0.25]
[charaFadein C 0.5 250,-50]
[charaFadein E 0.5 -175,-115]
＠C：マシュ
突然の乱入、失礼します！
[k]
`;

    const parsed = parseFgoScript(script, "appearance-reverse");

    expect(parsed.frames[0].characters.map(({ slot }) => slot)).toEqual(["C", "E"]);
    expect(parsed.frames[0].characters).not.toContainEqual(
      expect.objectContaining({ slot: "A" }),
    );
  });

  it("creates silent animation frames for visible sub-render characters", () => {
    const script = `
[charaSet A 8001900 1 マシュ]
[charaSet F 1098154000 1 空想樹の種子]
[charaSet G 1098154000 1 空想樹の種子]
[charaFadein A 0.1 1]
[charaLayer F sub #A]
[charaLayer G sub #A]
[charaFadein F 0.1 -350,250]
[charaFadein G 0.1 150,250]
[subRenderFadein #A 0.3 -50,-360]
[wt 1.0]
[subRenderFadeout #A 0.4]
[wt 0.5]
＠A：マシュ
空想樹の種子を確認しました。
[k]
`;

    const parsed = parseFgoScript(script, "silent-sub-render");

    expect(parsed.frames.map(({ type }) => type)).toEqual([
      "animation",
      "animation",
      "dialogue",
    ]);
    expect(parsed.frames[0]).toMatchObject({
      type: "animation",
      speaker: "",
      text: "",
      characters: [
        expect.objectContaining({ slot: "A", id: "8001900" }),
        expect.objectContaining({ slot: "F", id: "1098154000" }),
        expect.objectContaining({ slot: "G", id: "1098154000" }),
      ],
    });
    expect(parsed.frames[1].characters.map(({ slot }) => slot)).toEqual(["A"]);
    expect(parsed.characterCount).toBe(2);
  });

  it("removes enemies erased by enemyErasure", () => {
    const script = `
[charaSet A 1098154000 1 空想樹の種子]
[charaSet B 8001900 1 マシュ]
[charaPut A 1]
[charaSpecialEffect A enemyErasure 1 1.7]
[charaPut B 1]
＠マシュ
戦闘終了です。
[k]
`;

    const parsed = parseFgoScript(script, "enemy-erasure");

    expect(parsed.frames[0].characters).toEqual([
      expect.objectContaining({ slot: "B", name: "マシュ" }),
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

  it("uses source positions for stable v2 frame ids and accepts q/KR punctuation", () => {
    const parsed = parseFgoScript([
      "@Narrator",
      "First[line3][q]",
      "?1:Continue",
      "@Narrator",
      "Branch A[q]",
      "?2：Stop",
      "@Narrator",
      "Branch B[k]",
      "?!",
    ].join("\n"), "source-id", { region: "KR" });

    expect(parsed.parserVersion).toBe(4);
    expect(parsed.frames.map((frame) => frame.id)).toEqual([
      "source-id@v4:d:1:1:0",
      "source-id@v4:c:3:1:0",
    ]);
    expect(parsed.frames[0]).toMatchObject({ text: "First——" });
    const choice = parsed.frames[1];
    expect(choice.type).toBe("choice");
    if (choice.type === "choice") {
      expect(choice.options.map((option) => option.label)).toEqual(["Continue", "Stop"]);
      expect(choice.options.map((option) => option.frames[0]?.id)).toEqual([
        "source-id@v4:d:4:1:0",
        "source-id@v4:d:7:1:0",
      ]);
    }
  });

  it("allows a choice with no branch-specific frames before shared continuation", () => {
    const parsed = parseFgoScript([
      "[wt 1.5]",
      "？1：[line 3]消えてしまった[line 3]",
      "",
      "？！",
      "",
      "＠旁白",
      "Shared continuation[k]",
    ].join("\n"), "empty-choice-result");

    expect(parsed.diagnostics).not.toContainEqual(expect.objectContaining({
      severity: "error",
    }));
    expect(parsed.frames).toHaveLength(2);
    const choice = parsed.frames[0];
    expect(choice.type).toBe("choice");
    if (choice.type === "choice") {
      expect(choice.options).toEqual([{
        label: "——消えてしまった——",
        frames: [],
      }]);
    }
    expect(parsed.frames[1]).toMatchObject({ text: "Shared continuation" });
  });

  it("uses the complete numeric placement table and an explicit speaker slot", () => {
    const setup = Array.from({ length: 7 }, (_, index) => [
      `[charaSet S${index} ${index + 1} 0 "Same Name"]`,
      `[charaPut S${index} ${index}]`,
    ].join("\n")).join("\n");
    const parsed = parseFgoScript(`${setup}\n＠S5：Same Name\nPosition test[k]`, "placements");

    expect(parsed.frames[0].characters.map((character) => character.position)).toEqual([
      "left",
      "center",
      "right",
      "left",
      "left",
      "right",
      "right",
    ]);
    expect(parsed.frames[0].characters.filter((character) => character.active).map((character) => character.slot))
      .toEqual(["S5"]);
  });

  it("consumes choice presentation once and preserves only branch-identical state", () => {
    const parsed = parseFgoScript([
      "[scene 100]",
      "[bgm BASE]",
      "[fadein black 0.2]",
      "？1：Left",
      "[scene 200]",
      "[bgm LEFT]",
      "＠旁白",
      "Left branch[k]",
      "？2：Right",
      "[scene 300]",
      "[bgm RIGHT]",
      "＠旁白",
      "Right branch[k]",
      "？！",
      "＠旁白",
      "Shared continuation[k]",
    ].join("\n"), "choice-state");

    const choice = parsed.frames[0];
    expect(choice).toMatchObject({ type: "choice", scene: "100", bgm: "BASE", transition: "fade" });
    if (choice.type === "choice") {
      expect(choice.options.map((option) => option.frames[0])).toEqual([
        expect.objectContaining({ scene: "200", bgm: "LEFT", transition: "none" }),
        expect.objectContaining({ scene: "300", bgm: "RIGHT", transition: "none" }),
      ]);
    }
    expect(parsed.frames[1]).toMatchObject({
      text: "Shared continuation",
      scene: "100",
      bgm: "BASE",
    });
    expect(parsed.diagnostics).toContainEqual(expect.objectContaining({
      code: "divergent_choice_state",
    }));
  });

  it("counts frames and resources recursively and keeps parser diagnostics", () => {
    const parsed = parseFgoScript([
      "？1：A",
      "[scene 101]",
      "[bgm A]",
      "[charaSet A 1001 0 A]",
      "[charaPut A 0]",
      "＠A：A",
      "Branch A[k]",
      "？2：B",
      "[scene 202]",
      "[bgm B]",
      "[charaSet B 2002 0 B]",
      "[charaPut B 2]",
      "＠B：B",
      "Branch B[k]",
      "？！",
      "[futureCommand one]",
      "[futureCommand two]",
    ].join("\n"), "recursive-counts");

    expect(parsed).toMatchObject({
      frameCount: 3,
      choiceCount: 1,
      characterCount: 2,
      sceneCount: 2,
      bgmCount: 2,
    });
    expect(parsed.diagnostics).toContainEqual(expect.objectContaining({
      code: "unknown_command",
      command: "futureCommand",
      count: 2,
    }));
  });
});

describe("custom script package example", () => {
  it("parses the checked-in text-only package through filesystem URLs", async () => {
    const packageUrl = new URL(
      "../../examples/custom-script-package/",
      import.meta.url,
    );
    const manifest = JSON.parse(
      await readFile(new URL("manifest.json", packageUrl), "utf8"),
    ) as {
      format: string;
      version: number;
      title: string;
      region: string;
      script: string;
    };
    const source = await readFile(new URL(manifest.script, packageUrl), "utf8");

    expect(manifest).toMatchObject({
      format: "fgo-reader-script-package",
      version: 1,
      title: "最小文本剧本包",
      region: "JP",
      script: "script.txt",
    });

    const parsed = parseFgoScript(source, "custom-script-package-example");
    expect(parsed.frames).toHaveLength(2);
    expect(parsed.frames[0]).toMatchObject({
      type: "dialogue",
      speaker: "旁白",
      text: "这是一个只含文本的自定义剧本包。",
    });

    const choice = parsed.frames[1];
    expect(choice.type).toBe("choice");
    if (choice.type === "choice") {
      expect(choice.options.map((option) => option.label)).toEqual([
        "继续阅读",
        "先查看说明",
      ]);
      expect(choice.options.map((option) => option.frames[0]?.text)).toEqual([
        "那么，让我们开始吧。",
        "请先阅读自定义剧本包说明。",
      ]);
    }
  });
});

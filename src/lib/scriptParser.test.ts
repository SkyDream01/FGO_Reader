import { describe, expect, it } from "vitest";
import { parseScriptDocument } from "./scriptSyntax";
import { ScriptExecutor } from "../adv/executor";
import { compileFgoScript, cleanScriptText } from "./scriptParser";
import { SCRIPT_PARSER_VERSION } from "./scriptParserVersion";
import type { ScriptProgram } from "../adv/instruction";

function compile(source: string, scriptId = "test", options?: { masterName?: string; masterGender?: "male" | "female" }) {
  return compileFgoScript(source, scriptId, {
    region: "JP",
    masterName: options?.masterName ?? "御主",
    masterGender: options?.masterGender ?? "male",
  });
}

/** Compiles, runs to the first message boundary and returns the snapshot. */
function runToFirstMessage(
  source: string,
  scriptId = "test",
  options?: { masterName?: string; masterGender?: "male" | "female" },
) {
  const program = compile(source, scriptId, options);
  const executor = new ScriptExecutor(program, {
    masterName: options?.masterName ?? "御主",
    masterGender: options?.masterGender ?? "male",
    textSpeedMs: 2,
  });
  executor.start();
  return { program, executor, snapshot: executor.getSnapshot() };
}

describe("cleanScriptText", () => {
  it("converts common FGO markup", () => {
    expect(
      cleanScriptText("你好[sr][#前辈:せんぱい]，[&君:ちゃん]，[%1]", "藤丸"),
    ).toBe("你好\n前辈，君，藤丸");
  });
});

describe("compileFgoScript", () => {
  it("bumps stable message keys to the current parser version", () => {
    const program = compile("＠マシュ\n本文[k]", "0100000010");
    expect(SCRIPT_PARSER_VERSION).toBe(6);
    expect(program.messageCatalog[0].key).toBe(
      `0100000010@v${SCRIPT_PARSER_VERSION}:m:1:1:0`,
    );
  });

  it("tracks scenes, characters and bgm in program catalogs", () => {
    const program = compile(`[charaSet A 1001001 1 玛修]
[charaSet B 1001001 1 玛修]
[scene 10201]
[sceneSet J back269400 1]
[imageSet K back8888 1]
[bgm BGM_EVENT_2 0.1]
＠玛修
你好。[k]
`);
    expect(program.characterIds).toEqual(["1001001"]);
    expect(program.sceneIds).toEqual(["10201", "269400", "8888"]);
    expect(program.bgmNames).toEqual(["BGM_EVENT_2"]);
    expect(program.messageCatalog).toHaveLength(1);
  });

  it("lowers label-based choice options into bodies with a shared exit", () => {
    const program = compile(`＠選択
？1：出发吧
＠玛修
好的。
[k]
？2：再等等
＠玛修
明白了。
[k]
？！
＠玛修
共通。
[k]
`);
    expect(program.choiceCatalog).toHaveLength(1);
    expect(program.choiceCatalog[0].options.map((option) => option.label)).toEqual([
      "出发吧",
      "再等等",
    ]);
  });
});

describe("ScriptExecutor stage semantics", () => {
  it("splits consecutive click markers into separate messages with the same speaker", () => {
    const { program, snapshot } = runToFirstMessage([
      "＄01-00-00-01-1-0",
      "[charaSet A 98001000 1 マシュ]",
      "[charaPut A 1]",
      "＠A：マシュ",
      "……マスター。[k]",
      "本日もよろしくお願いします。[k]",
    ].join("\n"), "documented-dialogue");

    expect(program.messageCatalog.map((record) => record.text)).toEqual([
      "……マスター。",
      "本日もよろしくお願いします。",
    ]);
    expect(snapshot.characters).toEqual([
      expect.objectContaining({ slot: "A", active: true }),
    ]);
  });

  it("maps the numeric placement table and explicit speaker slots", () => {
    const { snapshot } = runToFirstMessage(`
[charaSet A 1 0 左]
[charaSet B 2 0 中]
[charaSet C 3 0 右]
[charaFadein A 0.1 -256,0]
[charaFadein B 0.1 0,-50]
[charaFadein C 0.1 150,0]
＠B：中
坐标测试
[k]
`, "coordinate-demo");
    expect(snapshot.characters.map((character) => character.position)).toEqual([
      "left",
      "center",
      "right",
    ]);
  });

  it("activates every spot speaker and applies the charaFilter silhouette form", () => {
    const { snapshot } = runToFirstMessage([
      "[charaSet A 1001 1 A]",
      "[charaSet B 1002 1 B]",
      "[charaFilter A X silhouette 00000080]",
      "[charaPut A 0]",
      "[charaPut B 2]",
      "＠二人=spot[A,B]",
      "同時発言。[k]",
    ].join("\n"), "spot-dialogue");
    expect(snapshot.characters).toEqual([
      expect.objectContaining({ slot: "A", active: true, silhouette: true }),
      expect.objectContaining({ slot: "B", active: true, silhouette: false }),
    ]);
  });

  it("supports comma-separated charaTalk slots without treating stop commands as effects", () => {
    const { snapshot } = runToFirstMessage([
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
    expect(snapshot.characters).toEqual([
      expect.objectContaining({ slot: "A", position: "left", active: true }),
      expect.objectContaining({ slot: "B", position: "right", active: true }),
    ]);
    expect(snapshot.shake.seq).toBe(0);
    expect(snapshot.flash.seq).toBe(0);
  });

  it("selects gender-dependent master assets and stops at the end command", () => {
    const { program, executor } = runToFirstMessage([
      "[masterSet L 1098348300 1098348310 1]",
      "[masterScene 276600 276601 1.0]",
      "[charaFadein L 0.1 1]",
      "＠L：[%1]",
      "選択された姿です。[k]",
      "[end]",
      "この行は終了後なので表示しない。[k]",
    ].join("\n"), "master-assets", { masterName: "藤丸", masterGender: "female" });
    void program;

    executor.tick(50); // resolve the fade wait
    const snapshot = executor.getSnapshot();
    expect(snapshot.background.id).toBe("276601");
    expect(snapshot.characters).toEqual([
      expect.objectContaining({ slot: "L", id: "1098348310", name: "藤丸", active: true }),
    ]);
    executor.tap();
    // The [end] command ends the run; the trailing dialogue never plays.
    expect(executor.getSnapshot().phase).toBe("ended");
  });

  it("keeps effect anchors, sub-camera slots and parked objects out of the character layer", () => {
    const { snapshot } = runToFirstMessage(`
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
`, "jp-effect-anchor");
    expect(snapshot.characters).toEqual([
      expect.objectContaining({ id: "2000003", name: "伯爵", position: "center" }),
    ]);
  });

  it("shows a faded-in communicator without rendering its noise effect anchor", () => {
    const { snapshot } = runToFirstMessage(`
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
`, "communication-noise");
    expect(snapshot.characters).toEqual([
      expect.objectContaining({
        slot: "F",
        id: "99502600",
        name: "玛修",
        silhouette: true,
        active: true,
      }),
    ]);
    expect(snapshot.characters).not.toContainEqual(
      expect.objectContaining({ slot: "I" }),
    );
  });

  it("preserves legitimate same-id character instances in separate slots", () => {
    const { snapshot } = runToFirstMessage(`
[charaSet A 1001001 1 玛修]
[charaSet B 1001001 1 玛修]
[charaPut A 0]
[charaPut B 2]
＠A：玛修
双实例测试
[k]
`, "same-id-slots");
    expect(snapshot.characters.map(({ slot, id, position }) => ({
      slot,
      id,
      position,
    }))).toEqual([
      { slot: "A", id: "1001001", position: "left" },
      { slot: "B", id: "1001001", position: "right" },
    ]);
  });

  it("hides characters behind visible scene layers by depth", () => {
    const source = `
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
    const program = compile(source, "scene-layer-depth");
    const executor = new ScriptExecutor(program, {
      masterName: "御主",
      masterGender: "male",
      textSpeedMs: 2,
    });
    executor.start();
    const first = executor.getSnapshot();
    expect(first.characters.map(({ slot }) => slot)).toEqual(["D"]);

    executor.tap(); // finish first message
    executor.tick(600); // fadeouts complete (no active fade wait in script)
    executor.tap(); // advance to the second message
    const second = executor.getSnapshot();
    expect(second.characters.map(({ slot }) => slot)).toEqual(["B"]);
  });

  it("removes characters erased by charaSpecialEffect flashErasure", () => {
    const source = `
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
    const program = compile(source, "flash-erasure");
    const executor = new ScriptExecutor(program, {
      masterName: "御主",
      masterGender: "male",
      textSpeedMs: 2,
    });
    executor.start();
    expect(executor.getSnapshot().characters).toEqual([
      expect.objectContaining({ slot: "D", face: 1 }),
    ]);

    executor.tap(); // complete the typewriter reveal
    executor.tap(); // advance past the first message; erasure runs
    executor.tick(50);
    const afterErasure = executor.getSnapshot();
    expect(afterErasure.characters).toEqual([
      expect.objectContaining({ slot: "B" }),
    ]);
  });

  it("removes animation stand-ins erased by appearanceReverse", () => {
    const { snapshot } = runToFirstMessage(`
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
`, "appearance-reverse");
    expect(snapshot.characters.map(({ slot }) => slot)).toEqual(["C", "E"]);
    expect(snapshot.characters).not.toContainEqual(
      expect.objectContaining({ slot: "A" }),
    );
  });

  it("removes enemies erased by enemyErasure", () => {
    const { snapshot } = runToFirstMessage(`
[charaSet A 1098154000 1 空想樹の種子]
[charaSet B 8001900 1 マシュ]
[charaPut A 1]
[charaSpecialEffect A enemyErasure 1 1.7]
[charaPut B 1]
＠マシュ
戦闘終了です。
[k]
`, "enemy-erasure");
    expect(snapshot.characters).toEqual([
      expect.objectContaining({ slot: "B", name: "マシュ" }),
    ]);
  });

  it("shows sub-render characters only while the sub layer is visible", () => {
    const source = `
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
    const program = compile(source, "silent-sub-render");
    const executor = new ScriptExecutor(program, {
      masterName: "御主",
      masterGender: "male",
      textSpeedMs: 2,
    });
    executor.start();
    const duringSub = executor.getSnapshot();
    expect(duringSub.characters.map(({ slot }) => slot)).toEqual(["A", "F", "G"]);

    // [wt 1.0] timer: tick past it; sub layer then fades out ([wt 0.5] next).
    executor.tick(1200);
    executor.tick(700);
    const afterSub = executor.getSnapshot();
    expect(afterSub.characters.map(({ slot }) => slot)).toEqual(["A"]);
    expect(afterSub.phase).toBe("message");
    expect(afterSub.message?.speaker).toBe("マシュ");
    expect(program.characterIds).toEqual(["8001900", "1098154000"]);
  });

  it("projects camera, blur, pictureFrame and scene layers into the live snapshot", () => {
    const { executor } = runToFirstMessage([
      "[scene 10000]",
      "[sceneSet Q 142200 1]",
      "[charaFadein Q 0.1 1]",
      "[bgm BGM_EVENT_38 0.25 0.9]",
      "[cameraMove 0.1 0,-30 1.2]",
      "[cameraFilter gray]",
      "[blur glass 0.5 2 10]",
      "[pictureFrame cut063_cinema]",
      "[messageOff]",
      "＠旁白",
      "演出状态测试。[k]",
    ].join("\n"), "presentation-state");
    executor.tick(200); // camera tween (0.1s) settles
    const snapshot = executor.getSnapshot();
    expect(snapshot.camera).toEqual({ x: 0, y: -30, scale: 1.2, rotation: 0, filter: "gray" });
    expect(snapshot.blur).toBe(0.5);
    expect(snapshot.pictureFrame).toBe("cut063_cinema");
    expect(snapshot.bgm).toEqual({ name: "BGM_EVENT_38", volume: 0.25 });
    expect(snapshot.stageLayers).toEqual([
      expect.objectContaining({ slot: "Q", id: "142200", source: "background" }),
    ]);
  });

  it("reads cameraMoveEase scale from the documented fourth parameter", () => {
    const { executor } = runToFirstMessage([
      "[cameraMoveEase 0,-30 1.0 easeOutQuad 1.2]",
      "＠旁白",
      "缓动镜头[k]",
    ].join("\n"), "camera-ease");
    executor.tick(1500); // camera tween (1.0s) settles
    expect(executor.getSnapshot().camera).toMatchObject({ x: 0, y: -30, scale: 1.2 });
  });

  it("reopens the message window for dialogue after a messageOff transition", () => {
    const { executor } = runToFirstMessage([
      "[scene 10000]",
      "[messageOff]",
      "[fadeout black 0.5]",
      "[wait fade]",
      "＠旁白",
      "转场后的正文。",
      "[k]",
    ].join("\n"), "message-off-dialogue");
    executor.tick(700); // [wait fade] resolves; the message opens
    const messageSnapshot = executor.getSnapshot();
    // The dialogue itself reopens the window (corpus form) and is displayed.
    expect(messageSnapshot.message?.lines).toBeTruthy();
    expect(messageSnapshot.message?.speaker).toBe("旁白");
  });

  it("resolves the blur-off variants after global and sub-render blur", () => {
    const program = compile([
      "[blur lens 1.1 2 10]",
      "＠旁白",
      "全局模糊。[k]",
      "[subBlur #A glass 0.4 2 10 1.0 subBlur]",
      "＠旁白",
      "子渲染模糊。[k]",
      "[blurOff]",
      "＠旁白",
      "关闭模糊。[k]",
    ].join("\n"), "blur-intensity");
    const executor = new ScriptExecutor(program, {
      masterName: "御主",
      masterGender: "male",
      textSpeedMs: 2,
    });
    executor.start();
    expect(executor.getSnapshot().blur).toBe(1.1);
    executor.tap();
    executor.tap();
    expect(executor.getSnapshot().blur).toBe(0.4);
    executor.tap();
    executor.tap();
    expect(executor.getSnapshot().blur).toBeNull();
  });

  it("keeps an authored coordinate and scale through later dialogue", () => {
    const { snapshot } = runToFirstMessage(`
[charaSet A 1098366400 1 大型角色]
[charaScale A 2.0]
[charaFadein A 0.1 -150,470]
[charaMoveEase A -150,90 1.0 easeOutSine]
＠A：大型角色
坐标和缩放测试[k]
`, "character-transform-demo");
    expect(snapshot.characters[0]).toMatchObject({
      x: -150,
      y: 90,
      scale: 2,
      position: "left",
    });
  });

  it("returns a moved character to the center when charaFadein omits a position", () => {
    const source = `
[charaSet A 1098366400 1 可移动角色]
[charaFadein A 0.1 -150,470]
[charaMove A 80,-60 0.5]
[charaFadeout A 0.1]
[charaFadein A 0.1]
＠A：可移动角色
省略坐标时回到中心位置。[k]
`;
    const program = compile(source, "fadein-omitted-position");
    const executor = new ScriptExecutor(program, {
      masterName: "御主",
      masterGender: "male",
      textSpeedMs: 2,
    });
    executor.start();
    executor.tick(800); // charaMove tween (0.5s) settles
    const snapshot = executor.getSnapshot();
    expect(snapshot.characters[0]).toMatchObject({
      x: 0,
      y: 0,
      position: "center",
    });
  });

  it("reports unresolved command tags as warnings without breaking playback", () => {
    const program = compile("＠テスト\n本文[k]\n[unknownCommandFoo 1]", "unknown-cmd");
    expect(program.diagnostics.some((entry) => entry.code === "unknown_command")).toBe(true);
    const executor = new ScriptExecutor(program, {
      masterName: "御主",
      masterGender: "male",
      textSpeedMs: 2,
    });
    executor.start();
    expect(executor.getSnapshot().phase).toBe("message");
  });
});

/** Guards the parser against structural drift before the executor ever runs. */
describe("compileFgoScript parser contract", () => {
  it("keeps message text normalized (line rules, trailing spaces, blank runs)", () => {
    const program = compile("＠テスト\n前文[line 3][r]後文[k]", "normalize");
    expect(program.messageCatalog[0].text).toBe("前文———\n後文");
  });

  it("accepts full-width and KR punctuation click markers", () => {
    const program = compile("＠テスト\n一[q]\n二[K]", "punctuation");
    expect(program.messageCatalog.map((record) => record.text)).toEqual(["一", "二"]);
  });

  it("resolves {0} placeholders to the master name", () => {
    const program = compile("＠テスト\n{0}よ、[tag]いかが？[k]", "placeholder", { masterName: "藤丸" });
    expect(program.messageCatalog[0].text).toBe("藤丸よ、いかが？");
  });

  it("degrades structural errors instead of throwing", () => {
    const program = compile("[jump nowhere]\n[scene 100]", "degrade");
    expect(program.diagnostics.some((entry) => entry.code === "unresolved_label")).toBe(true);
  });

  it("parses documents through the shared syntax layer", () => {
    const document = parseScriptDocument("＠テスト\n本文[k]", { region: "JP" });
    expect(document.nodes).toHaveLength(1);
    const program: ScriptProgram = compile("＠テスト\n本文[k]", "syntax");
    expect(program.instructions[0].tag).toBe("talkname");
  });
});

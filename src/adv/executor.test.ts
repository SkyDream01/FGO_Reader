import { describe, expect, it } from "vitest";
import { compileFgoScript } from "../lib/scriptParser";
import { ScriptExecutor } from "./executor";
import { easings, resolveEasing } from "./easings";
import { TweenService } from "./tween";
import { stepTranslationUnits } from "../lib/translation";

function create(source: string, options: { masterGender?: "male" | "female"; reduceMotion?: boolean } = {}) {
  const program = compileFgoScript(source, "test", options);
  const executor = new ScriptExecutor(program, { masterName: "御主", masterGender: options.masterGender ?? "male", textSpeedMs: 100, ...options });
  executor.start();
  return { executor, program };
}
const text = (executor: ScriptExecutor) => executor.getSnapshot().message?.lines.flatMap((line) => line.spans.map((span) => span.text)).join("");

describe("native runtime", () => {
  it("shows placed figures and image layers through explicit alpha fades, including resume", () => {
    // 9415900210: Natchan slides in with Put + FadeTime, and Q is a dimming
    // background. 9415900310 uses the same path for Blackbeard at alpha 0.65.
    const source = "[charaSet I 1098365200 1 ナッちゃん]\n[sceneSet Q 10000 1]\n[charaPut I 350,0]\n[charaMoveEase I 250,0 0.8 easeOutSine]\n[charaFadeTime I 0.8 1]\n[charaPut Q 1]\n[charaFadeTime Q 0.2 0.5]\n[wt 1]\n＠旁白\n同框\n[k]\n[charaFadeTime I 0.4 0]\n[wt 0.5]\n＠旁白\n退场\n[k]";
    const { executor, program } = create(source);
    executor.tick(100);
    expect(executor.getSnapshot().characters.find(item => item.slot === "I")?.alpha).toBeCloseTo(0.125);
    expect(executor.getSnapshot().stageLayers.find(item => item.slot === "Q")?.alpha).toBeCloseTo(0.25);
    executor.tick(900);
    expect(executor.getSnapshot().characters.find(item => item.slot === "I")).toMatchObject({ x: 250, alpha: 1 });
    executor.start({ startIndex: program.messageCatalog[0].instructionIndex });
    expect(executor.getSnapshot().characters.find(item => item.slot === "I")).toMatchObject({ x: 250, alpha: 1 });
    expect(executor.getSnapshot().stageLayers.find(item => item.slot === "Q")?.alpha).toBe(0.5);
    executor.tap(); executor.tap(); executor.tick(500);
    expect(executor.getSnapshot().characters.some(item => item.slot === "I")).toBe(false);
    const blackbeard = create("[charaSet K 4008300 1 黒髭]\n[charaPutFSL K -350,0]\n[charaFadeTime K 0.4 0.65]\n[wt 0.5]\n＠旁白\nてぃーち？\n[k]", { reduceMotion: true }).executor;
    expect(blackbeard.getSnapshot().characters[0].alpha).toBe(0.65);
  });
  it("keeps a prepared cut-in hidden until its first fade and fades continuously when interrupted", () => {
    const { executor } = create("[subCameraOn 2]\n[charaSet A 8002100 1]\n[charaLayer A sub #A]\n[charaFadein A 0 0,250]\n[subCameraFilter #A maskEdge cut359_mask16 5 0,0,0,255]\n[wt 0.5]\n[subRenderFadein #A 0.2 380,-270]\n[wt 0.3]\n[subRenderFadeout #A 1]\n[wt 0.4]\n[subRenderFadein #A 0.2 380,-270]\n[wt 0.3]\n[subRenderFadeout #A 0.2]\n[wt 0.3]\n＠旁白\n完了\n[k]");
    const layer = () => executor.getSnapshot().subLayers.find(item => item.key === "#A")!;
    expect(layer()).toMatchObject({ visible: false, alpha: 0 });
    executor.tick(500);
    expect(layer()).toMatchObject({ visible: true, alpha: 0, x: 380, y: -270 });
    executor.tick(100);
    expect(layer().alpha).toBeCloseTo(0.5);
    executor.tick(200); // Starts fadeout.
    executor.tick(400); // Interrupted fadeout starts fading back from 0.6.
    expect(layer().alpha).toBeCloseTo(0.6);
    executor.tick(100);
    expect(layer().alpha).toBeCloseTo(0.8);
    executor.tick(200); // Starts the final fadeout.
    executor.tick(100);
    expect(layer().alpha).toBeCloseTo(0.5);
    executor.tick(200);
    expect(layer()).toMatchObject({ visible: false, alpha: 0 });
  });
  it("records the sub-camera mask outline and clears it with through", () => {
    const { executor } = create("[subCameraFilter #A maskEdge cut359_mask16 5 0,0,0,255]\n＠旁白\n斜切\n[k]\n[subCameraFilter #A through]\n＠旁白\n还原\n[k]");
    expect(executor.getSnapshot().subLayers[0]).toMatchObject({ mask: "cut359_mask16", maskEdge: { width: 5, color: "rgba(0,0,0,1)" } });
    executor.tap(); executor.tap();
    expect(executor.getSnapshot().subLayers[0]).toMatchObject({ mask: null, maskEdge: null });
  });
  it("expires transient impacts while preserving persistent effects in reduced motion and resume", () => {
    const source = "[effect bit_talk_impactlanding 50,-100]\n[effect bit_talk_rubble]\n＠旁白\n经过\n[k]\n＠旁白\n恢复位置\n[k]";
    const reduced = create(source, { reduceMotion: true }).executor;
    expect([...reduced.stage.effects.values()].map((effect) => effect.name)).toEqual(["bit_talk_rubble"]);
    const { executor, program } = create(source);
    executor.start({ startIndex: program.messageCatalog[1].instructionIndex });
    expect([...executor.stage.effects.values()].map((effect) => effect.name)).toEqual(["bit_talk_rubble"]);
    expect(executor.getSnapshot().message?.key).toBe(program.messageCatalog[1].key);
  });
  it("preserves full screen asset mode and sceneSet scale type through replay", () => {
    const { executor } = create("[enableFullScreen]\n[scene 293500]\n[sceneSet T 293500 1 1]\n[charaScale T 1.2]\n[charaFadein T 0 50,-220]\n＠旁白\n画面\n[k]");
    expect(executor.getSnapshot().fullScreen).toBe(true);
    expect(executor.getSnapshot().stageLayers[0]).toMatchObject({ source: "background", x: 50, y: -220, scale: 1.2, fullScreenScale: "1" });
    executor.start();
    expect(executor.getSnapshot().fullScreen).toBe(true);
    executor.stage.reset();
    expect(executor.stage.fullScreen).toBe(false);
  });
  it("starts presentation in one burst and waits on the actual fade track", () => {
    const { executor } = create("[scene 10110]\n[charaSet A 98001000 0 玛修]\n[charaFadein A 0.5 0]\n[fadein black 1]\n[wait fade]\n＠玛修\n本文\n[k]");
    expect(executor.getSnapshot()).toMatchObject({ phase: "wait", background: { id: "10110" }, fade: { alpha: 1 } });
    executor.tick(500);
    expect(executor.getSnapshot().fade.alpha).toBeCloseTo(0.5);
    executor.tick(500);
    expect(executor.getSnapshot()).toMatchObject({ phase: "message", fade: { alpha: 0 }, message: { complete: false } });
  });
  it("uses scaled time, real time and frame counts independently", () => {
    const { executor } = create("[wt 1]\n[twt 1]\n[wait frame 2]\n＠旁白\n完成\n[k]");
    executor.setTimeScale(10); executor.tick(100);
    expect(executor.getSnapshot().phase).toBe("wait");
    executor.tick(100); expect(executor.getSnapshot().phase).toBe("wait");
    executor.tick(900); expect(executor.getSnapshot().phase).toBe("wait");
    executor.tick(0); expect(executor.getSnapshot().phase).toBe("wait");
    executor.tick(0); expect(executor.getSnapshot().phase).toBe("message");
  });
  it("runs an inline action only when its glyph position has been reached", () => {
    const { executor } = create("[charaSet A 1 1]\n[charaFadein A 0 1]\n＠旁白\n前[charaFace A 3][twt 0.5]后\n[k]");
    expect(executor.stage.slots.get("A")?.face).toBe(0);
    executor.tick(100);
    expect(executor.stage.slots.get("A")?.face).toBe(3);
    expect(text(executor)).toBe("前");
    executor.setTimeScale(20); executor.tick(100);
    expect(text(executor)).toBe("前");
    executor.tick(500); expect(text(executor)).toBe("前后");
  });
  it("reveals text on the first tap and advances on the second", () => {
    const { executor } = create("＠玛修\n你好\n[k]\n＠旁白\n再见\n[k]");
    executor.tap(); expect(text(executor)).toBe("你好");
    executor.tap(); expect(executor.getSnapshot().message?.speaker).toBe("旁白");
    executor.tap(); executor.tap(); expect(executor.getSnapshot().phase).toBe("ended");
  });
  it("does not skip real-time waits on tap", () => {
    const { executor } = create("[twt 1]\n＠旁白\n之后\n[k]");
    executor.tap(); expect(executor.getSnapshot().phase).toBe("wait");
    executor.tick(1000); expect(executor.getSnapshot().phase).toBe("message");
  });
  it("implements conditional branch comparison and full-width label targets", () => {
    const { executor } = create("[flag route true]\n[branch chosen route true]\n＠旁白\n错误\n[k]\n＄chosen\n＠玛修\n正确\n[k]");
    executor.tap(); expect(text(executor)).toBe("正确");
  });
  it("enters selection at the first choice and skips the unselected body", () => {
    const { executor } = create("？1：一\n＠玛修\n分支一\n[k]\n？2：二\n＠玛修\n分支二\n[k]\n？！\n＠旁白\n共通\n[k]");
    expect(executor.getSnapshot().phase).toBe("choice");
    executor.selectChoice(1); executor.tap(); expect(text(executor)).toBe("分支二");
    executor.tap(); executor.tap(); expect(text(executor)).toBe("共通");
    expect(executor.getSnapshot().log.map((entry) => entry.text)).toEqual(["分支二", "共通"]);
  });
  it("keeps authored selection ordinals after hiding options", () => {
    const { executor } = create("[flag asked true]\n？1：隐藏；asked\n？2：显示\n？！\n[branch chosen INPUT_SELECT_BRANCH 2]\n[end]\n[label chosen]\n＠旁白\n正确\n[k]");
    expect(executor.getSnapshot().choice?.options).toEqual([{ label: "显示", id: 2 }]);
    executor.selectChoice(0); executor.tap(); expect(text(executor)).toBe("正确");
    expect(executor.takeNewDecisions()[0].optionIndex).toBe(1);
  });
  it("keeps translation identifiers aligned with hidden choice ordinals", () => {
    const { executor } = create("[flag asked true]\n？1：隐藏；asked\n？2：显示\n？！\n＠旁白\n本文\n[k]");
    const step = executor.currentTranslationSteps(3)[0];
    expect(step.optionLabels).toEqual(["显示"]);
    expect(stepTranslationUnits(step)[0].id).toBe(`${step.key}:choice:1`);
  });
  it("replays repeated visits to the same choice in their recorded order", () => {
    const source = "＄menu\n？1：问问题；asked\n[flag asked true]\n[branch menu]\n？2：结束\n？！\n＠旁白\n结尾\n[k]";
    const { executor } = create(source);
    executor.selectChoice(0);
    expect(executor.getSnapshot().choice?.options).toEqual([{ id: 2, label: "结束" }]);
    executor.selectChoice(0);
    const saved = executor.getSnapshot().position, trail = executor.takeNewDecisions();
    expect(trail.map((entry) => entry.optionIndex)).toEqual([0, 1]);
    executor.start({ startIndex: saved, choiceTrail: trail }); executor.tap();
    expect(text(executor)).toBe("结尾");
  });
  it("applies standalone font and speed commands to subsequent messages", () => {
    const { executor } = create("[font large]\n[s 0]\n＠旁白\n立刻显示\n[k]");
    expect(executor.getSnapshot().message?.complete).toBe(true);
    expect(executor.getSnapshot().message?.lines[0].spans[0].fontSize).toBe(48);
  });
  it("honors gender guards and gender-specific master branches", () => {
    const { executor } = create("[masterBranch male female]\n[label male]\n[end]\n[label female]\n[masterSet L 111 222 1]\n[charaFadein L 0 1]\n＠旁白\n女性\n[k]", { masterGender: "female" });
    expect(executor.stage.slots.get("L")?.id).toBe("222");
  });
  it("reconstructs a chosen path for resume, back navigation and read-only lookahead", () => {
    const source = "＠旁白\n开始\n[k]\n？1：一\n＠玛修\n分支一\n[k]\n？2：二\n＠玛修\n分支二\n[k]\n？！\n＠旁白\n共通\n[k]";
    const { executor, program } = create(source);
    executor.tap(); executor.tap(); executor.selectChoice(1); executor.tap(); executor.tap();
    const saved = executor.getSnapshot().position, trail = executor.takeNewDecisions(), hash = executor.getSceneStateHash();
    expect(executor.enumerateUpcomingMessages(3).map((entry) => entry.text)).toEqual(["共通"]);
    expect(executor.getSceneStateHash()).toBe(hash);
    const restored = new ScriptExecutor(program, { masterName: "御主", masterGender: "male", textSpeedMs: 100 });
    restored.start({ startIndex: saved, choiceTrail: trail }); restored.tap();
    expect(text(restored)).toBe("共通");
    restored.goBackOneBoundary(); restored.tap(); expect(text(restored)).toBe("分支二");
  });
  it("leaves an unanswered choice visible during resume", () => {
    const { executor, program } = create("？1：一\n＠旁白\n本文\n[k]\n？！");
    executor.start({ startIndex: program.instructions.length - 1 });
    expect(executor.getSnapshot().phase).toBe("choice");
  });
  it("steps back repeatedly through messages and reopens choices without future decisions", () => {
    const { executor } = create("＠旁白\n开始\n[k]\n？1：一\n＠旁白\n分支一\n[k]\n？2：二\n＠旁白\n分支二\n[k]\n？！\n＠旁白\n共通\n[k]", { reduceMotion: true });
    executor.tap(); executor.selectChoice(1); executor.tap();
    expect(text(executor)).toBe("共通");
    executor.goBackOneBoundary();
    expect(text(executor)).toBe("分支二");
    executor.goBackOneBoundary();
    expect(executor.getSnapshot()).toMatchObject({ phase: "choice", choiceTrail: [] });
    executor.goBackOneBoundary();
    expect(text(executor)).toBe("开始");
    executor.tap(); executor.selectChoice(0);
    expect(text(executor)).toBe("分支一");
    expect(executor.getSnapshot().choiceTrail.map(item => item.optionIndex)).toEqual([0]);
  });
  it("returns to the last message after ending, then continues back to the beginning", () => {
    const { executor } = create("＠旁白\n一\n[k]\n＠旁白\n二\n[k]\n＠旁白\n三\n[k]\n[end black]", { reduceMotion: true });
    executor.tap(); executor.tap(); executor.tap();
    expect(executor.getSnapshot().phase).toBe("ended");
    for (const expected of ["三", "二", "一"]) {
      executor.goBackOneBoundary();
      expect(text(executor)).toBe(expected);
      expect(executor.getSnapshot()).toMatchObject({ phase: "message", fade: { alpha: 0 } });
    }
    executor.goBackOneBoundary();
    expect(text(executor)).toBe("一");
  });
  it("can return from a one-message ending and from the following presentation wait", () => {
    const { executor } = create("＠旁白\n唯一一句\n[k]\n[wt 1]\n[end black]", { reduceMotion: true });
    executor.tap();
    expect(executor.getSnapshot().phase).toBe("wait");
    executor.goBackOneBoundary();
    expect(executor.getSnapshot().phase).toBe("message");
    executor.tap(); executor.tick(1000);
    expect(executor.getSnapshot().phase).toBe("ended");
    executor.goBackOneBoundary();
    expect(executor.getSnapshot().phase).toBe("message");
    expect(text(executor)).toBe("唯一一句");
  });
  it("seeks a log entry before a choice without replaying its later decisions", () => {
    const { executor, program } = create("＠旁白\n前文\n[k]\n？1：继续\n＠旁白\n后文\n[k]\n？！", { reduceMotion: true });
    executor.tap(); executor.selectChoice(0);
    executor.jumpToMessage(program.messageCatalog[0].key);
    expect(text(executor)).toBe("前文");
    expect(executor.getSnapshot().choiceTrail).toEqual([]);
    executor.tap();
    expect(executor.getSnapshot().phase).toBe("choice");
  });
  it("preserves the visit when backing through a menu that starts at instruction zero", () => {
    const { executor } = create("[menu ask=询问 done=离开]\n[label ask]\n[flag asked true]\n[jump start]\n[label start]\n[menu ask=再问 done=离开]\n[label done]\n＠旁白\n结束\n[k]", { reduceMotion: true });
    executor.selectChoice(0); executor.selectChoice(1);
    executor.goBackOneBoundary();
    expect(executor.getSnapshot()).toMatchObject({ phase: "choice", choiceTrail: [{ optionIndex: 0 }] });
    executor.goBackOneBoundary();
    expect(executor.getSnapshot()).toMatchObject({ phase: "choice", choiceTrail: [] });
  });
  it("backs through consecutive visits to the same menu in order", () => {
    const { executor } = create("[label menu]\n[menu ask=询问 done=离开]\n[label ask]\n[jump menu]\n[label done]\n＠旁白\n结束\n[k]", { reduceMotion: true });
    executor.selectChoice(0); executor.selectChoice(0); executor.selectChoice(1);
    expect(text(executor)).toBe("结束");
    for (const choiceCount of [2, 1, 0]) {
      executor.goBackOneBoundary();
      expect(executor.getSnapshot().phase).toBe("choice");
      expect(executor.getSnapshot().choiceTrail).toHaveLength(choiceCount);
    }
    expect(executor.getSnapshot().canGoBack).toBe(false);
  });
  it("isolates sub-cameras, slot alpha and group depth", () => {
    const { executor } = create("[charaSet A 1 1]\n[charaSet B 2 1]\n[charaFadein A 1 1]\n[charaFadein B 0 1]\n[charaLayer B sub #B]\n[subRenderDepth #B 5]\n[subCameraMove #B 0 100,-20 1.5]\n[subRenderFadein #B 0 0,0]\n[subRenderFadeout #B 1]\n[wait charaFade A]\n＠旁白\n本文\n[k]");
    executor.tick(500);
    expect(executor.stage.slots.get("A")?.alpha).toBeCloseTo(0.5);
    expect(executor.stage.subLayers.get("#B")).toMatchObject({ depth: 5, alpha: 0.5, camera: { x: 100, y: -20, scale: 1.5 } });
    expect(executor.stage.camera.x).toBe(0);
  });
  it("consumes the proven image position and full-screen scale parameters", () => {
    const { executor } = create("[imageSet D back10000 2 1]\n[charaFadein D 0]\n＠旁白\n本文\n[k]");
    expect(executor.getSnapshot().stageLayers[0]).toMatchObject({ x: 256, y: 0, source: "image", fullScreenScale: "1" });
  });
  it("records unsupported Unity commands without fabricating an erasure", () => {
    const { executor } = create("[charaSet A 1 1]\n[charaFadein A 0 1]\n[charaSpecialEffect A appearanceReverse]\n[specialEffect cutting]\n＠旁白\n本文\n[k]");
    expect(executor.getSnapshot().characters).toHaveLength(1);
    expect(executor.getSnapshot().diagnostics.map((entry) => entry.tag)).toEqual(["charaSpecialEffect", "specialEffect"]);
  });
  it("terminates self-jumping scripts with a diagnostic instead of hanging", () => {
    const { executor } = create("＄again\n[branch again]");
    expect(executor.getSnapshot().phase).toBe("ended");
    expect(executor.getSnapshot().diagnostics[0].tag).toBe("control_flow");
  });
});
describe("animation tracks", () => {
  it("recognizes every native easing with case-insensitive lookup", () => {
    expect(Object.keys(easings)).toHaveLength(33);
    expect(resolveEasing("easeOutSine")(0.5)).toBeCloseTo(Math.SQRT1_2);
    expect(resolveEasing("EASEOUTSINE")(0.5)).toBeCloseTo(Math.SQRT1_2);
    for (const ease of Object.values(easings)) expect(Number.isFinite(ease(0.37))).toBe(true);
  });
  it("supports completion callbacks that replace a track and real-time tracks", () => {
    const tweens = new TweenService(); let x = 0, y = 0;
    tweens.add({ owner: "x", duration: 1, onUpdate: (t) => { x = t; }, onComplete: () => tweens.add({ owner: "x", duration: 1, onUpdate: (t) => { x = 1 + t; } }) });
    tweens.add({ owner: "y", duration: 1, clock: "real", onUpdate: (t) => { y = t; } });
    tweens.update(1, 0.1); expect(x).toBe(1); expect(y).toBeCloseTo(0.1);
    tweens.update(0.5, 0.1); expect(x).toBeCloseTo(1.5);
  });
});

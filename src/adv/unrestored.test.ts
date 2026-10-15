import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileFgoScript } from "../lib/scriptParser";
import { ScriptExecutor, type ExecutorOptions } from "./executor";
import { executeStageCommand } from "./commands";
import { Stage } from "./stage";
import { TweenService } from "./tween";
import { parseNativeParameters, parseCommandParameters } from "./syntax";
import { sideOffset } from "./motion";
import { figureResourceCandidates } from "./resources";
import type { AudioIntent } from "./audio";

function play(source: string, options: Partial<ExecutorOptions> = {}) {
  const program = compileFgoScript(source, "contracts", { masterName: "御主" });
  const executor = new ScriptExecutor(program, { masterName: "御主", masterGender: "male", textSpeedMs: 0, ...options });
  executor.start(); return executor;
}
const text = (executor: ScriptExecutor) => executor.getSnapshot().message?.lines.flatMap(line => line.spans.map(span => span.text)).join("");
const tail = "\n＠旁白\n已到达\n[k]";

describe("how-to-adv-unrestored contracts", () => {
  it("has an explicit execution or documented fallback for all 154 listed commands", () => {
    const doc = readFileSync(new URL("../../docs/how-to-adv-unrestored.md", import.meta.url), "utf8").split("## §25")[1];
    const names = [...doc.matchAll(/^\|[^\n]*?`([A-Za-z][A-Za-z0-9]*)`\s*\|\s*`?0x/gm)].map(match => match[1]);
    expect(new Set(names).size).toBe(154);
    const executorTags = /^(branch|masterNameWidth|flagRandom|questMessageOverwrite|revivalBranch|menu$|notification$|switchCase|page$)/;
    const unhandled: string[] = [];
    for (const tag of names.filter(name => !executorTags.test(name))) {
      const stage = new Stage(); for (const slot of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") stage.setSlot(slot, "1", "figure");
      const source = "A test 1 2 3 4 5 6", pd = parseNativeParameters(source);
      executeStageCommand({ tag, params: parseCommandParameters(source), pd, raw: `[${tag} ${source}]`, line: 1, column: 1, isMessage: false }, { stage, tweens: new TweenService(), masterGender: "male", fastForward: false, reduceMotion: true, aspectRatio: 16 / 9, emitAudio: () => undefined, onUnhandled: name => unhandled.push(name), diagnose: () => undefined, requestWait: () => undefined, retryNextFrame: () => undefined });
    }
    expect(unhandled).toEqual([]);
  });
  it("registers missing effects with native asset keys and supports pause/start/stop/destroy", () => {
    const executor = play("[effectPause X 10,20 H]\n[effectStart X]\n[wait effect X]\n[effectStop X]\n[wait effect X]\n[effectDestroy X]" + tail);
    executor.tick(400); executor.tick(300);
    expect(executor.stage.effects.size).toBe(0); expect(text(executor)).toBe("已到达");
    const paused = play("[charaSet A 1 1]\n[charaEffectPause A X 10,20 H]" + tail);
    expect([...paused.stage.effects.values()][0]).toMatchObject({ assetName: "Effect/Talk/X", container: "chara:A:effect", x: 10, y: 20, flip: "H", status: "paused", busy: false });
  });
  it("retries lifecycle operations on the following frame while a resource is loading", () => {
    const executor = play("[effect X]\n[wait time 0.1]\n[effectStop X]" + tail);
    const effect = [...executor.stage.effects.values()][0]; effect.loading = true;
    executor.tick(100); expect(executor.getSnapshot().phase).toBe("wait");
    executor.tick(16); expect(executor.stage.effects.size).toBe(1);
    effect.loading = false; executor.tick(16); executor.tick(300);
    expect(text(executor)).toBe("已到达"); expect(executor.stage.effects.size).toBe(0);
  });
  it("handles communication ids, coordinates, face and a nonblocking loop wait", () => {
    const executor = play("[communicationCharaLoop 98003003 1 5 1 5]\n[wait communicationChara]\n[communicationCharaFace 3]" + tail);
    expect(executor.stage.communication).toMatchObject({ svtId: "9800300", limitCount: 3, depth: -50, face: 3, loaded: true, busy: false });
    expect(text(executor)).toBe("已到达");
    const clear = play("[communicationCharaLoop 98003003 100,200 5 0 5]\n[communicationCharaClear]\n[wait communicatioChara]" + tail);
    expect(clear.stage.communication).toBeNull(); expect(text(clear)).toBe("已到达");
  });
  it("prepares a cut without consuming its time and starts it on demand", () => {
    const executor = play("[charaSet G 1 1]\n[charaFadein G 0]\n[charaCutinPause G upToDown 0.2 0]\n[wait time 0.5]\n[charaCutinStart G]\n[wait charaCut G]" + tail);
    expect(executor.stage.slots.get("G")?.cut).toMatchObject({ paused: true, progress: 0 });
    executor.tick(500); executor.tick(100); expect(executor.stage.slots.get("G")?.cut?.progress).toBeCloseTo(0.5);
    executor.tick(100); expect(text(executor)).toBe("已到达");
  });
  it("waits for a face crossfade, retaining the previous face buffer", () => {
    const executor = play("[charaSet A 1 1]\n[charaFadein A 0]\n[charaFaceFade A 4 0.4]" + tail);
    expect(executor.getSnapshot().phase).toBe("wait");
    executor.tick(200); expect(executor.stage.slots.get("A")?.change).toMatchObject({ face: 0, progress: 0.5 });
    executor.tick(200); expect(text(executor)).toBe("已到达"); expect(executor.stage.slots.get("A")?.face).toBe(4);
  });
  it("allows infinite alpha loops through waits and stops them at their authored last alpha", () => {
    const executor = play("[charaSet A 1 0]\n[charaFadein A 0]\n[charaFadeTimeLoop A 2 0.2 0.1 0.3 0.8 0]\n[wait charaFadeTimeLoop A]\n[charaFadeTimeLoopStop A]\n[charaPut A 200,50]\n[charaReturn A 0]" + tail);
    expect(executor.stage.slots.get("A")).toMatchObject({ alpha: 0.8, x: -256, y: 0, alphaLoop: null }); expect(text(executor)).toBe("已到达");
  });
  it("diagnoses invalid alpha parameters and preserves the following script", () => {
    const executor = play("[charaSet A 1]\n[charaFadeTimeLoop A 2 0.2 0.1 0]\n[clear unexpected]" + tail);
    expect(executor.getSnapshot().diagnostics.map(item => item.reason)).toContain("parameter error"); expect(text(executor)).toBe("已到达");
  });
  it("clears messages and waits for input without resetting the stage", () => {
    const executor = play("[scene 123]\n[charaSet A 1]\n[charaFadein A 0]\n[clear]" + tail);
    expect(executor.getSnapshot()).toMatchObject({ phase: "wait", background: { id: "123" }, waitKind: "input", message: null });
    expect(executor.getSnapshot().characters).toHaveLength(1); executor.tap(); expect(text(executor)).toBe("已到达");
  });
  it("applies inline message shake at its glyph position and resets it after its duration", () => {
    const executor = play("＠旁白\n前[messageShake 0.05 4 3 0.3]后\n[k]", { textSpeedMs: 100 });
    expect(executor.stage.messageStyle.shake).toEqual({ x: 0, y: 0 });
    executor.tick(100); executor.tick(50); expect(Math.abs(executor.stage.messageStyle.shake.x)).toBeLessThanOrEqual(4); expect(executor.stage.shake.x).toBe(0);
    executor.tick(300); expect(executor.stage.messageStyle.shake).toEqual({ x: 0, y: 0 });
  });
  it("blocks movies until completion, supports false/background and skips them in replay", () => {
    const blocking = play("[criMovie test bgmPlay true]" + tail); expect(blocking.getSnapshot().phase).toBe("wait"); blocking.finishMovie(); expect(text(blocking)).toBe("已到达");
    const background = play("[criMovie talk_mov151_M bgmPlay false]" + tail); expect(text(background)).toBe("已到达"); expect(background.stage.movie?.blocking).toBe(false);
    background.tick(3000); expect(background.stage.movie).toBeNull();
  });
  it("finishes missing prefab, FSM and insertion waits without an unknown wait error", () => {
    const executor = play("[fsmObjSet K ScriptUI/SelectPanel/select01 select01]\n[fsmObjSetState K show]\n[wait fsmObjFinished K]\n[advSet test]\n[advPrepare test]\n[insertionAnimationSetFSSideR ac_fude_triangle_slide_R 0,70]\n[insertionAnimationStart ac_fude_triangle_slide_R]\n[wait insertionAnimationStart ac_fude_triangle_slide_R]" + tail);
    expect(executor.stage.insertions.get("ac_fude_triangle_slide_R")).toMatchObject({ x: 0, y: 70 }); executor.tick(400); expect(text(executor)).toBe("已到达"); expect([...executor.unknownCommands.keys()]).toEqual([]);
  });
  it("defaults unknown account data to the Not branch and never fabricates a grand count", () => {
    const executor = play("[branchSetGrandSvtCount wrong 0 ABOVE]\n[branchNotRouteSelect right 1 2]\n[label wrong]\n[end]\n[label right]" + tail);
    expect(text(executor)).toBe("已到达");
    const actual = play("[branchSetGrandSvtCount right 1 ABOVE]\n[end]\n[label right]" + tail, { gameState: { grandSvtCount: 0 } }); expect(text(actual)).toBe("已到达");
  });
  it("evaluates route lists using deduplicated route ids", () => {
    const executor = play("[branchRouteSelectCount right 2 EQUAL 1,2 100,100,200]\n[end]\n[label right]" + tail, { gameState: { routeSelected: (_quest, route) => route === 100 || route === 200 } }); expect(text(executor)).toBe("已到达");
  });
  it("resolves both name-width labels, revival targets and explicit menus", () => {
    const width = play("[masterNameWidth large 339 small big]\n[label big]\n[end]\n[label small]" + tail, { measureName: () => 338 }); expect(text(width)).toBe("已到达");
    const menu = play('[menu a="路线 一" b="路线 二"]\n[label a]\n[end]\n[label b]' + tail);
    expect(menu.getSnapshot().choice?.options.map(option => option.label)).toEqual(["路线 一", "路线 二"]); menu.selectChoice(1); expect(text(menu)).toBe("已到达");
    const explicit = play("[switchCase 1：甲]\n[end]\n[switchCase 2：乙]" + tail + "\n[switchCaseEnd]"); explicit.selectChoice(1); expect(text(explicit)).toBe("已到达");
  });
  it("replays flagRandom identically when looking ahead, restarting and returning", () => {
    const executor = play("[flagRandom route 1 10000]" + tail); const before = executor.getFlag("route");
    executor.enumerateUpcomingMessages(4); expect(executor.getFlag("route")).toBe(before);
    executor.start(); expect(executor.getFlag("route")).toBe(before); expect(Number(before)).toBeGreaterThanOrEqual(1); expect(Number(before)).toBeLessThanOrEqual(10000);
  });
  it("retains a frozen scene while the live scene continues behind it", () => {
    const executor = play("[scene 1]\n[charaSet A 111]\n[capture]\n[scene 2]\n[charaSet A 222]" + tail);
    expect(executor.stage.capture).toMatchObject({ background: "1", slots: [{ id: "111" }] }); expect(executor.stage.background.current).toBe("2");
  });
  it("fades white before ending and keeps unknown waits nonblocking", () => {
    const executor = play("[wait missing]\n[endFade white]\n[end]"); expect(executor.getSnapshot().phase).toBe("wait");
    executor.tick(250); expect(executor.stage.fade.alpha).toBeCloseTo(0.5); executor.tick(250); expect(executor.getSnapshot().phase).toBe("ended");
    expect(executor.getSnapshot().diagnostics.map(item => item.tag)).toContain("wait missing");
  });
  it("distinguishes skippable time from game time and frame waits", () => {
    const executor = play("[wait time 1]\n[wait skippableTime 2]" + tail); executor.tap(); expect(executor.getSnapshot().phase).toBe("wait"); executor.tick(1000); executor.tap(); expect(text(executor)).toBe("已到达");
  });
  it("suspends inline completion waits before the remaining glyphs and then resumes the same message", () => {
    const executor = play("[charaSet A 1]\n[charaFadein A 1]\n＠旁白\n前[wait charaFade A]后\n[k]", { textSpeedMs: 100 });
    executor.tick(100); expect(text(executor)).toBe("前"); expect(executor.getSnapshot().phase).toBe("wait");
    executor.tick(900); expect(text(executor)).toBe("前"); executor.tick(100); expect(text(executor)).toBe("前后"); expect(executor.getSnapshot().waitKind).toBe("input");
  });
  it("reads separate coordinate and duration arrays for authored loop movement", () => {
    const executor = play("[charaSet A 1]\n[charaRelativeLoopMove A 2 0,-2 0,0 0.4 0.4 0]\n[wait time 1]" + tail);
    executor.tick(200); expect(executor.stage.slots.get("A")?.y).toBeCloseTo(-1); executor.tick(400); expect(executor.stage.slots.get("A")?.y).toBeCloseTo(-1);
  });
  it("uses separate side and margin formulas with a Form fallback chain", () => {
    expect(sideOffset("charaPutFSL", 7 / 3)).toBe(-80); expect(sideOffset("charaPutFSSideL", 7 / 3)).toBe(-160); expect(sideOffset("charaPutFSL", 16 / 9)).toBe(0);
    expect(figureResourceCandidates("Form/costume/123")).toEqual(["Form/costume/123", "123", "1000000"]);
  });
  it("preserves cue volume/fade argument shapes, continuation ids and keep-sub-BGM nesting", () => {
    const program = compileFgoScript("[cueSe bank a]\n[cueSe bank b 0.4]\n[cueSe bank c 0.2 0.7]\n[cueSeContinue bank d 0.3 0.8 7]\n[cueSeContinueStop d 0.5 7]\n[keepSubBgmOn]\n[keepSubBgmOn]\n[keepSubBgmOff]\n[soundStopAllFade 0.6]" + tail, "audio");
    const executor = new ScriptExecutor(program, { masterName: "御主", masterGender: "male", textSpeedMs: 0 }), intents: AudioIntent[] = [];
    executor.onAudioIntent = intent => intents.push(intent); executor.start();
    expect(intents.filter(intent => intent.kind === "play")).toMatchObject([{ sheet: "bank", name: "a", volume: 1, fadeIn: 0 }, { name: "b", volume: 0.4, fadeIn: 0 }, { name: "c", volume: 0.7, fadeIn: 0.2 }, { name: "d", volume: 0.8, fadeIn: 0.3, continueId: 7, loop: false }]);
    expect(intents).toContainEqual({ kind: "stop", channel: "se", name: "d", fadeOut: 0.5, continueOnly: true, continueId: 7 });
    expect(intents).toContainEqual({ kind: "stopAll", fadeOut: 0.6, keepSubBgm: true });
  });
});

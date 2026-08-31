import { describe, expect, it } from "vitest";
import { compileFgoScript } from "./scriptParser";
import { collectStorySteps } from "./storyPreparation";

describe("story resource collection", () => {
  it("collects and deduplicates resources from every choice branch", () => {
    const program = compileFgoScript([
      "[charaSet A 1001 1 共通]",
      "[scene shared]",
      "[bgm shared-bgm 0.1]",
      "＠共通",
      "導入[k]",
      "？1：left",
      "[scene left-scene]",
      "[charaSet B 1001 1 共通]",
      "[bgm left-bgm 0.1]",
      "＠共通",
      "左[k]",
      "？2：right",
      "[scene right-scene]",
      "[charaSet C 2002 1 共通]",
      "[bgm right-bgm 0.1]",
      "＠共通",
      "右[k]",
      "？！",
    ].join("\n"), "branch-resources");

    expect(program.sceneIds).toEqual(["shared", "left-scene", "right-scene"]);
    expect(program.characterIds).toEqual(["1001", "2002"]);
    expect(program.bgmNames).toEqual(["shared-bgm", "left-bgm", "right-bgm"]);
  });

  it("builds the readable step catalog in program order across branches", () => {
    const program = compileFgoScript([
      "＠導入",
      "始まり[k]",
      "？1：一",
      "＠一",
      "一番[k]",
      "？2：二",
      "＠二",
      "二番[k]",
      "？！",
      "＠共通",
      "終わり[k]",
    ].join("\n"), "step-catalog");
    const steps = collectStorySteps(program);
    // The catalog interleaves the choice step (empty text, its own kind)
    // between the branch bodies in program order.
    expect(steps.map((step) => [step.kind, step.text])).toEqual([
      ["message", "始まり"],
      ["choice", ""],
      ["message", "一番"],
      ["message", "二番"],
      ["message", "終わり"],
    ]);
    expect(steps[0].speaker).toBe("導入");
  });
});

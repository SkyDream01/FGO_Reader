import { describe, expect, it } from "vitest";
import type { ChoiceFrame, DialogueFrame, StoryFrame } from "../types";
import {
  addChoiceDecision,
  clearChoiceTrail,
  replayChoiceTrail,
  validateChoiceTrail,
} from "./choiceTrail";

function dialogue(id: string): DialogueFrame {
  return {
    id,
    type: "dialogue",
    speaker: "Mash",
    text: id,
    scene: null,
    bgm: null,
    characters: [],
    effect: "none",
    transition: "none",
  };
}

function choice(
  id: string,
  branches: StoryFrame[][],
  selected?: number,
): ChoiceFrame {
  return {
    id,
    type: "choice",
    speaker: "CHOICE",
    text: "选择回应",
    scene: null,
    bgm: null,
    characters: [],
    effect: "none",
    transition: "none",
    options: branches.map((frames, index) => ({
      label: `Option ${index + 1}`,
      frames,
    })),
    ...(selected === undefined ? {} : { selected }),
  };
}

function frameSummary(frames: StoryFrame[]) {
  return frames.map((frame) =>
    frame.type === "choice"
      ? `${frame.id}:${frame.selected ?? "open"}`
      : frame.id,
  );
}

describe("choice trails", () => {
  it("replays nested decisions in the same splice order as runtime resolution", () => {
    const nested = choice("nested", [[dialogue("nested-a")], [dialogue("nested-b")]]);
    const root = choice("root", [[dialogue("branch-start"), nested], [dialogue("other-branch")]]);
    const source = [root, dialogue("after-root")];

    const replay = replayChoiceTrail(source, [
      { choiceId: "root", optionIndex: 0 },
      { choiceId: "nested", optionIndex: 1 },
    ]);

    expect(frameSummary(replay.frames)).toEqual([
      "root:0",
      "branch-start",
      "nested:1",
      "nested-b",
      "after-root",
    ]);
    expect(replay.choiceTrail).toEqual([
      { choiceId: "root", optionIndex: 0 },
      { choiceId: "nested", optionIndex: 1 },
    ]);
    expect(frameSummary(source)).toEqual(["root:open", "after-root"]);
    expect(nested.selected).toBeUndefined();
  });

  it("drops malformed, missing, duplicate, and out-of-order entries", () => {
    const nested = choice("nested", [[dialogue("nested-result")]]);
    const root = choice("root", [[nested]]);
    const trailing = choice("trailing", [[dialogue("trailing-result")]]);

    const replay = replayChoiceTrail([root, trailing], [
      null,
      { choiceId: "missing", optionIndex: 0 },
      { choiceId: "trailing", optionIndex: 0 },
      { choiceId: "root", optionIndex: 99 },
      { choiceId: "root", optionIndex: 0 },
      { choiceId: "root", optionIndex: 0 },
      { choiceId: "nested", optionIndex: 0 },
      { choiceId: "trailing", optionIndex: 0 },
    ]);

    expect(frameSummary(replay.frames)).toEqual([
      "root:0",
      "nested:0",
      "nested-result",
      "trailing:0",
      "trailing-result",
    ]);
    expect(replay.choiceTrail).toEqual([
      { choiceId: "root", optionIndex: 0 },
      { choiceId: "nested", optionIndex: 0 },
      { choiceId: "trailing", optionIndex: 0 },
    ]);
  });

  it("does not expand a choice that is already selected", () => {
    const alreadyInserted = dialogue("already-inserted");
    const selected = choice("selected", [[alreadyInserted]], 0);
    const next = choice("next", [[dialogue("next-result")]]);

    const replay = replayChoiceTrail([selected, alreadyInserted, next], [
      { choiceId: "selected", optionIndex: 0 },
      { choiceId: "next", optionIndex: 0 },
    ]);

    expect(frameSummary(replay.frames)).toEqual([
      "selected:0",
      "already-inserted",
      "next:0",
      "next-result",
    ]);
    expect(replay.choiceTrail).toEqual([
      { choiceId: "selected", optionIndex: 0 },
      { choiceId: "next", optionIndex: 0 },
    ]);
  });

  it("provides immutable add, clear, and validation helpers", () => {
    const first = { choiceId: "first", optionIndex: 0 };
    const trail = addChoiceDecision([], first);

    expect(validateChoiceTrail(trail)).toBe(true);
    expect(validateChoiceTrail([{ choiceId: "first", optionIndex: -1 }])).toBe(false);
    expect(addChoiceDecision(trail, { choiceId: "second", optionIndex: 1 })).toEqual([
      first,
      { choiceId: "second", optionIndex: 1 },
    ]);
    expect(addChoiceDecision(trail, { choiceId: "first", optionIndex: 1 })).toEqual([
      first,
    ]);
    expect(clearChoiceTrail()).toEqual([]);
    expect(trail).toEqual([first]);
  });
});

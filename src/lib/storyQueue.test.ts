import { describe, expect, it } from "vitest";
import type { StoryLaunch, StoryQuest } from "../types";
import { buildStorySequence, getNextStoryLaunch } from "./storyQueue";

const quest = (id: number, name: string, scripts: string[]): StoryQuest => ({
  id,
  name,
  type: "main",
  spotName: "测试地点",
  warId: 1,
  warLongName: "测试章节",
  chapterId: id,
  chapterSubId: 0,
  chapterSubStr: "",
  phases: [1],
  phaseScripts: [
    {
      phase: 1,
      scripts: scripts.map((scriptId) => ({
        scriptId,
        script: `https://example.com/${scriptId}.txt`,
      })),
    },
  ],
  priority: id,
});

describe("story queue", () => {
  it("keeps script and quest order when building the playback sequence", () => {
    const sequence = buildStorySequence(
      [quest(1, "第一节", ["100", "101"]), quest(2, "第二节", ["200"])],
      "CN",
      "序章",
    );

    expect(sequence.map(({ scriptId, title }) => [scriptId, title])).toEqual([
      ["100", "第一节"],
      ["101", "第一节"],
      ["200", "第二节"],
    ]);
  });

  it("launches the next segment from the beginning and preserves the queue", () => {
    const sequence = buildStorySequence(
      [quest(1, "第一节", ["100", "101"])],
      "CN",
      "序章",
    );
    const current: StoryLaunch = {
      ...sequence[0],
      sequence,
      sequenceIndex: 0,
    };

    expect(getNextStoryLaunch(current)).toEqual({
      ...sequence[1],
      startIndex: 0,
      sequence,
      sequenceIndex: 1,
    });
    expect(getNextStoryLaunch({ ...current, sequenceIndex: 1 })).toBeNull();
  });
});

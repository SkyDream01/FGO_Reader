import { describe, expect, it } from "vitest";
import type { StoryLaunch } from "../types";
import {
  createLastObservation,
  lastObservationToLaunch,
  parseLastObservation,
} from "./lastObservation";

const story: StoryLaunch = {
  region: "CN",
  scriptId: "1000000001",
  scriptUrl: "https://example.test/1000000001.txt",
  title: "第一节",
  subtitle: "测试章节",
  sequence: [
    {
      region: "CN",
      scriptId: "1000000001",
      scriptUrl: "https://example.test/1000000001.txt",
      title: "第一节",
      subtitle: "测试章节",
    },
    {
      region: "CN",
      scriptId: "1000000002",
      scriptUrl: "https://example.test/1000000002.txt",
      title: "第二节",
      subtitle: "测试章节",
    },
  ],
  sequenceIndex: 0,
};

describe("last observation", () => {
  it("stores the exact playback position and queue context", () => {
    const observation = createLastObservation(story, 7.8, 1234);

    expect(observation).toEqual({
      scriptId: story.scriptId,
      scriptUrl: story.scriptUrl,
      title: story.title,
      subtitle: story.subtitle,
      frameIndex: 7,
      updatedAt: 1234,
      region: story.region,
      sequence: story.sequence,
      sequenceIndex: 0,
    });
    expect(lastObservationToLaunch(observation)).toEqual({
      ...story,
      startIndex: 7,
    });
  });

  it("ignores corrupt records and invalid queue metadata", () => {
    expect(parseLastObservation("not json")).toBeNull();
    expect(parseLastObservation(JSON.stringify({ scriptId: "100" }))).toBeNull();

    const observation = createLastObservation(story, 2, 1234);
    const parsed = parseLastObservation(
      JSON.stringify({ ...observation, sequenceIndex: 99 }),
    );

    expect(parsed).toEqual({
      scriptId: story.scriptId,
      scriptUrl: story.scriptUrl,
      title: story.title,
      subtitle: story.subtitle,
      frameIndex: 2,
      updatedAt: 1234,
      region: story.region,
    });
  });

  it("round-trips a valid choice trail and omits an invalid optional trail", () => {
    const storyWithTrail: StoryLaunch = {
      ...story,
      choiceTrail: [{ choiceId: "frame-12", optionIndex: 1 }],
    };
    const observation = createLastObservation(storyWithTrail, 2, 1234);

    expect(observation.choiceTrail).toEqual([
      { choiceId: "frame-12", optionIndex: 1 },
    ]);
    expect(lastObservationToLaunch(observation).choiceTrail).toEqual(
      observation.choiceTrail,
    );

    const { choiceTrail: _choiceTrail, ...legacyObservation } = observation;
    expect(parseLastObservation(JSON.stringify(legacyObservation))).toEqual(
      legacyObservation,
    );
    expect(
      parseLastObservation(
        JSON.stringify({
          ...observation,
          choiceTrail: [{ choiceId: "", optionIndex: -1 }],
        }),
      ),
    ).toEqual(legacyObservation);
  });
});

import { describe, expect, it } from "vitest";
import {
  autoPlaybackDelayMs,
  choiceAutoPlaybackCharacterCount,
  countAutoPlaybackCharacters,
} from "./autoPlayback";

describe("automatic playback timing", () => {
  it("counts Unicode characters", () => {
    expect(countAutoPlaybackCharacters("你好🙂")).toBe(3);
  });

  it("uses 0.2 seconds per character plus a 0.5 second base", () => {
    expect(autoPlaybackDelayMs(0)).toBe(500);
    expect(autoPlaybackDelayMs(8)).toBe(2_100);
  });

  it("sums the character counts of every branch option", () => {
    expect(choiceAutoPlaybackCharacterCount([
      { label: "是" },
      { label: "不，现在不了" },
    ])).toBe(7);
  });
});

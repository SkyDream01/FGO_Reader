import { describe, expect, it } from "vitest";
import type { ChoiceFrame, DialogueFrame } from "../types";
import { collectStoryResources } from "./storyPreparation";

function dialogue(
  id: string,
  scene: string | null,
  bgm: string | null,
  characterId?: string,
): DialogueFrame {
  return {
    id,
    type: "dialogue",
    speaker: "",
    text: id,
    scene,
    bgm,
    characters: characterId
      ? [{
          slot: id,
          id: characterId,
          name: characterId,
          face: 0,
          visible: true,
          position: "center",
          silhouette: false,
          active: false,
        }]
      : [],
    effect: "none",
    transition: "none",
  };
}

describe("story resource collection", () => {
  it("collects and deduplicates resources from every choice branch", () => {
    const choice: ChoiceFrame = {
      id: "choice",
      type: "choice",
      speaker: "CHOICE",
      text: "",
      scene: "shared",
      bgm: "shared-bgm",
      characters: [],
      effect: "none",
      transition: "none",
      options: [
        {
          label: "left",
          frames: [
            dialogue("left", "left-scene", "left-bgm", "1001"),
          ],
        },
        {
          label: "right",
          frames: [
            dialogue("right", "right-scene", "right-bgm", "2002"),
            dialogue("duplicate", "shared", "shared-bgm", "1001"),
          ],
        },
      ],
    };

    expect(collectStoryResources([choice])).toEqual({
      backgrounds: ["shared", "left-scene", "right-scene"],
      characters: ["1001", "2002"],
      bgm: ["shared-bgm", "left-bgm", "right-bgm"],
    });
  });
});

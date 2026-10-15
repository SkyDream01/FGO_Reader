import { describe, expect, it } from "vitest";
import {
  normalizeChoiceTrail,
  validateChoiceTrail,
} from "./choiceTrail";

describe("choice trails", () => {
  it("validates and normalizes persisted decisions", () => {
    expect(validateChoiceTrail([])).toBe(true);
    expect(validateChoiceTrail([{ choiceId: "first", optionIndex: 0 }])).toBe(true);
    expect(validateChoiceTrail([{ choiceId: "first", optionIndex: -1 }])).toBe(false);
    expect(validateChoiceTrail([{ optionIndex: 0 }])).toBe(false);
    expect(validateChoiceTrail("nope")).toBe(false);

    const mixed = [
      { choiceId: "ok", optionIndex: 2 },
      { choiceId: "bad" },
      null,
      { choiceId: "also-ok", optionIndex: 0 },
    ];
    expect(normalizeChoiceTrail(mixed)).toEqual([
      { choiceId: "ok", optionIndex: 2 },
      { choiceId: "also-ok", optionIndex: 0 },
    ]);
  });

  it("preserves repeated choice visits in their original order", () => {
    const first = { choiceId: "first", optionIndex: 0 };
    const trail = [first, { choiceId: "first", optionIndex: 1 }];
    const normalized = normalizeChoiceTrail(trail);
    expect(normalized).toEqual(trail);
    expect(normalized).not.toBe(trail);
  });
});

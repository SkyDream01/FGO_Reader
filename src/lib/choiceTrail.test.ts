import { describe, expect, it } from "vitest";
import {
  addChoiceDecision,
  clearChoiceTrail,
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

  it("adds decisions immutably and dedupes by choice id", () => {
    const first = { choiceId: "first", optionIndex: 0 };
    const trail = addChoiceDecision([], first);

    expect(addChoiceDecision(trail, { choiceId: "second", optionIndex: 1 })).toEqual([
      first,
      { choiceId: "second", optionIndex: 1 },
    ]);
    // A choice can only appear once in a path: re-adding is a no-op here —
    // the executor replaces changed decisions before persisting.
    expect(addChoiceDecision(trail, { choiceId: "first", optionIndex: 1 })).toEqual([
      first,
    ]);
    expect(clearChoiceTrail()).toEqual([]);
    expect(trail).toEqual([first]);
  });
});

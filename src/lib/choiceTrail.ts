import type { ChoiceDecision, ChoiceTrail } from "../types";

function isChoiceDecision(value: unknown): value is ChoiceDecision {
  return (
    typeof value === "object" &&
    value !== null &&
    "choiceId" in value &&
    typeof value.choiceId === "string" &&
    value.choiceId.length > 0 &&
    "optionIndex" in value &&
    Number.isInteger(value.optionIndex) &&
    Number(value.optionIndex) >= 0
  );
}

/** Returns whether a value is safe to persist as a complete choice trail. */
export function validateChoiceTrail(value: unknown): value is ChoiceTrail {
  return Array.isArray(value) && value.every(isChoiceDecision);
}

/** Drops malformed entries while copying the remaining decisions. */
export function normalizeChoiceTrail(value: unknown): ChoiceTrail {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isChoiceDecision)
    .map(({ choiceId, optionIndex }) => ({ choiceId, optionIndex }));
}

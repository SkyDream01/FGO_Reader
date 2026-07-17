import type {
  ChoiceDecision,
  ChoiceFrame,
  ChoiceTrail,
  StoryFrame,
} from "../types";

export interface ChoiceTrailReplay {
  frames: StoryFrame[];
  choiceTrail: ChoiceTrail;
}

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

/** Adds one decision immutably; a choice frame can only appear once in a path. */
export function addChoiceDecision(
  choiceTrail: ChoiceTrail | undefined,
  decision: ChoiceDecision,
): ChoiceTrail {
  const normalized = normalizeChoiceTrail(choiceTrail);
  if (
    !isChoiceDecision(decision) ||
    normalized.some(({ choiceId }) => choiceId === decision.choiceId)
  ) {
    return normalized;
  }

  return [...normalized, { ...decision }];
}

/** Creates an empty trail for a new story path. */
export function clearChoiceTrail(): ChoiceTrail {
  return [];
}

function hasValidSelectedOption(frame: ChoiceFrame): boolean {
  return (
    Number.isInteger(frame.selected) &&
    Number(frame.selected) >= 0 &&
    Number(frame.selected) < frame.options.length
  );
}

/**
 * Replays decisions in the same order as ReaderView's runtime resolver:
 * replace the choice with a selected copy, then insert its chosen frames
 * immediately after it. Invalid or unreachable trail entries are ignored.
 */
export function replayChoiceTrail(
  parsedFrames: StoryFrame[],
  choiceTrail: unknown,
): ChoiceTrailReplay {
  const frames = [...parsedFrames];
  const decisions = normalizeChoiceTrail(choiceTrail);
  const normalizedTrail: ChoiceTrail = [];
  const replayedChoiceIds = new Set<string>();
  let frameIndex = 0;
  let decisionIndex = 0;

  while (frameIndex < frames.length && decisionIndex < decisions.length) {
    const frame = frames[frameIndex];
    if (frame.type !== "choice") {
      frameIndex += 1;
      continue;
    }

    const decision = decisions[decisionIndex];

    // A selected frame can be present when an already-replayed array is passed
    // back in. It is never expanded again, which keeps replay idempotent.
    if (frame.selected !== undefined) {
      if (decision.choiceId !== frame.id) {
        frameIndex += 1;
        continue;
      }

      decisionIndex += 1;
      if (
        hasValidSelectedOption(frame) &&
        decision.optionIndex === frame.selected &&
        !replayedChoiceIds.has(frame.id)
      ) {
        normalizedTrail.push({ ...decision });
        replayedChoiceIds.add(frame.id);
        frameIndex += 1;
      }
      continue;
    }

    // Ignore a missing, duplicated, or out-of-order decision and keep looking
    // for the decision that can resolve the current blocking choice.
    if (decision.choiceId !== frame.id || replayedChoiceIds.has(frame.id)) {
      decisionIndex += 1;
      continue;
    }

    decisionIndex += 1;
    const option = frame.options[decision.optionIndex];
    if (!option) continue;

    const resolved: ChoiceFrame = { ...frame, selected: decision.optionIndex };
    frames.splice(
      frameIndex,
      1,
      resolved,
      ...option.frames,
    );
    normalizedTrail.push({ ...decision });
    replayedChoiceIds.add(frame.id);
    frameIndex += 1;
  }

  return { frames, choiceTrail: normalizedTrail };
}

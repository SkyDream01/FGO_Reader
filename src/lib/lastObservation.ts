import type {
  LastObservation,
  Region,
  StoryLaunch,
  StorySequenceItem,
} from "../types";
import { normalizeChoiceTrail, validateChoiceTrail } from "./choiceTrail";
import { LAST_OBSERVATION_STORAGE_KEY } from "./scriptParserVersion";

export const LAST_OBSERVATION_KEY = LAST_OBSERVATION_STORAGE_KEY;

const regions = new Set<Region>(["CN", "JP", "NA", "TW", "KR"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRegion(value: unknown): value is Region {
  return typeof value === "string" && regions.has(value as Region);
}

function isSequenceItem(value: unknown): value is StorySequenceItem {
  return (
    isRecord(value) &&
    typeof value.scriptId === "string" &&
    typeof value.scriptUrl === "string" &&
    typeof value.title === "string" &&
    (value.subtitle === undefined || typeof value.subtitle === "string") &&
    isRegion(value.region)
  );
}

export function createLastObservation(
  story: StoryLaunch,
  frameIndex: number,
  updatedAt = Date.now(),
): LastObservation {
  const choiceTrail = validateChoiceTrail(story.choiceTrail)
    ? normalizeChoiceTrail(story.choiceTrail)
    : undefined;

  return {
    scriptId: story.scriptId,
    scriptUrl: story.scriptUrl,
    title: story.title,
    ...(story.subtitle ? { subtitle: story.subtitle } : {}),
    frameIndex: Math.max(0, Math.trunc(frameIndex)),
    updatedAt,
    region: story.region,
    ...(story.sequence ? { sequence: story.sequence } : {}),
    ...(story.sequenceIndex !== undefined
      ? { sequenceIndex: story.sequenceIndex }
      : {}),
    ...(choiceTrail ? { choiceTrail } : {}),
  };
}

export function lastObservationToLaunch(
  observation: LastObservation,
): StoryLaunch {
  const choiceTrail = validateChoiceTrail(observation.choiceTrail)
    ? normalizeChoiceTrail(observation.choiceTrail)
    : undefined;

  return {
    region: observation.region,
    scriptId: observation.scriptId,
    scriptUrl: observation.scriptUrl,
    title: observation.title,
    ...(observation.subtitle ? { subtitle: observation.subtitle } : {}),
    startIndex: observation.frameIndex,
    ...(observation.sequence ? { sequence: observation.sequence } : {}),
    ...(observation.sequenceIndex !== undefined
      ? { sequenceIndex: observation.sequenceIndex }
      : {}),
    ...(choiceTrail ? { choiceTrail } : {}),
  };
}

export function parseLastObservation(raw: string | null): LastObservation | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      typeof value.scriptId !== "string" ||
      typeof value.scriptUrl !== "string" ||
      typeof value.title !== "string" ||
      (value.subtitle !== undefined && typeof value.subtitle !== "string") ||
      !Number.isInteger(value.frameIndex) ||
      Number(value.frameIndex) < 0 ||
      !Number.isFinite(value.updatedAt) ||
      !isRegion(value.region)
    ) {
      return null;
    }

    const sequence = Array.isArray(value.sequence) && value.sequence.every(isSequenceItem)
      ? value.sequence
      : undefined;
    const sequenceIndex =
      sequence &&
      Number.isInteger(value.sequenceIndex) &&
      Number(value.sequenceIndex) >= 0 &&
      Number(value.sequenceIndex) < sequence.length
        ? Number(value.sequenceIndex)
        : undefined;
    const choiceTrail = validateChoiceTrail(value.choiceTrail)
      ? normalizeChoiceTrail(value.choiceTrail)
      : undefined;

    return {
      scriptId: value.scriptId,
      scriptUrl: value.scriptUrl,
      title: value.title,
      ...(value.subtitle ? { subtitle: value.subtitle } : {}),
      frameIndex: Number(value.frameIndex),
      updatedAt: Number(value.updatedAt),
      region: value.region,
      ...(sequence && sequenceIndex !== undefined
        ? { sequence, sequenceIndex }
        : {}),
      ...(choiceTrail ? { choiceTrail } : {}),
    };
  } catch {
    return null;
  }
}

export function loadLastObservation(
  storage: Pick<Storage, "getItem"> = localStorage,
): LastObservation | null {
  try {
    return parseLastObservation(storage.getItem(LAST_OBSERVATION_KEY));
  } catch {
    return null;
  }
}

export function saveLastObservation(
  observation: LastObservation,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  try {
    storage.setItem(LAST_OBSERVATION_KEY, JSON.stringify(observation));
  } catch {
    // Progress persistence should never interrupt playback.
  }
}

export function clearLastObservation(
  storage: Pick<Storage, "removeItem"> = localStorage,
) {
  try {
    storage.removeItem(LAST_OBSERVATION_KEY);
  } catch {
    // Ignore unavailable or full storage implementations.
  }
}

import type { ChoiceOption } from "../types";

const AUTO_PLAY_BASE_DELAY_MS = 500;
const AUTO_PLAY_CHARACTER_DELAY_MS = 200;

/** Counts displayed characters without treating surrogate pairs as two characters. */
export function countAutoPlaybackCharacters(text: string): number {
  return Array.from(text).length;
}

/** Returns the automatic playback delay for a character count. */
export function autoPlaybackDelayMs(characterCount: number): number {
  return AUTO_PLAY_BASE_DELAY_MS
    + Math.max(0, characterCount) * AUTO_PLAY_CHARACTER_DELAY_MS;
}

/** Branches use the combined character count of all option labels. */
export function choiceAutoPlaybackCharacterCount(
  options: ReadonlyArray<Pick<ChoiceOption, "label">>,
): number {
  return options.reduce(
    (total, option) => total + countAutoPlaybackCharacters(option.label),
    0,
  );
}

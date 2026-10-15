import names from "./commandNames.json";
import localization from "./localization.json";

export const COMMAND_NAMES: ReadonlySet<string> = new Set(names);
export const MACRO_NAMES: ReadonlySet<string> = new Set(["wt", "twt"]);
export const isCommand = (name: string) => COMMAND_NAMES.has(name) || MACRO_NAMES.has(name);

export interface ScriptMarkers {
  label: string;
  scene: string;
  talk: string;
  choice: string;
  choiceEnd: string;
  choiceSplit: string;
  hidden: string;
  comment: string;
  voice: string;
  insert: string;
  return: string;
}

/** LocalizationJpn defaults; overrides are explicit parser options. */
export const DEFAULT_MARKERS: Readonly<ScriptMarkers> = Object.freeze(localization);

export const FONT_SIZES: Readonly<Record<string, number>> = {
  "-": 29, "x-small": 19, small: 24, medium: 29, large: 48, "x-large": 64,
};

export const EMPTY_COMMANDS = new Set([
  "advSoundSet", "delayEnd", "enableWaitLoadAssetWhenResume",
]);

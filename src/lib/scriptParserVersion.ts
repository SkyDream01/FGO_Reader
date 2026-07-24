export const SCRIPT_PARSER_VERSION = 3 as const;

const VERSION_NAMESPACE = `v${SCRIPT_PARSER_VERSION}`;

export const BOOKMARK_STORAGE_KEY = `fgo-reader-bookmark:${VERSION_NAMESPACE}`;
export const LAST_OBSERVATION_STORAGE_KEY = `fgo-reader-last-observation:${VERSION_NAMESPACE}`;
export const LEGACY_BOOKMARK_STORAGE_KEY = "fgo-reader-bookmark";
export const LEGACY_LAST_OBSERVATION_STORAGE_KEY = "fgo-reader-last-observation";

export function progressStorageKey(scriptId: string) {
  return `fgo-reader-progress:${VERSION_NAMESPACE}:${scriptId}`;
}

export function readProgressStorageKey(scriptId: string) {
  return `fgo-reader-read:${VERSION_NAMESPACE}:${scriptId}`;
}

export function choiceTrailStorageKey(scriptId: string) {
  return `fgo-reader-choice-trail:${VERSION_NAMESPACE}:${scriptId}`;
}

export function legacyProgressStorageKey(scriptId: string) {
  return `fgo-reader-progress:${scriptId}`;
}

export function legacyReadProgressStorageKey(scriptId: string) {
  return `fgo-reader-read:${scriptId}`;
}

export function legacyChoiceTrailStorageKey(scriptId: string) {
  return `fgo-reader-choice-trail:${scriptId}`;
}

const PARSER_VERSION_MARKER = "fgo-reader-script-parser-version";
const LEGACY_EXACT_KEYS = [
  LEGACY_BOOKMARK_STORAGE_KEY,
  LEGACY_LAST_OBSERVATION_STORAGE_KEY,
  "fgo-reader-translation-cache-index:v1",
  "fgo-reader-translation-cache-index:v2",
];
const LEGACY_PREFIXES = [
  "fgo-reader-progress:",
  "fgo-reader-read:",
  "fgo-reader-choice-trail:",
  "fgo-reader-translation-cache:v1:",
  "fgo-reader-translation-cache:v2:",
];

export function consumeParserUpgradeNotice(
  storage: Pick<Storage, "getItem" | "setItem" | "key" | "length"> = localStorage,
) {
  try {
    const version = String(SCRIPT_PARSER_VERSION);
    if (storage.getItem(PARSER_VERSION_MARKER) === version) return false;

    let hasLegacyState = LEGACY_EXACT_KEYS.some((key) => storage.getItem(key) !== null);
    for (let index = 0; !hasLegacyState && index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;
      hasLegacyState = LEGACY_PREFIXES.some(
        (prefix) => key.startsWith(prefix) && !key.includes(`:${VERSION_NAMESPACE}:`),
      );
    }

    storage.setItem(PARSER_VERSION_MARKER, version);
    return hasLegacyState;
  } catch {
    return false;
  }
}

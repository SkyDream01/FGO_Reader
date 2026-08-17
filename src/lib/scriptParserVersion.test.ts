import { describe, expect, it } from "vitest";
import {
  BOOKMARK_STORAGE_KEY,
  LAST_OBSERVATION_STORAGE_KEY,
  SCRIPT_PARSER_VERSION,
  choiceTrailStorageKey,
  consumeParserUpgradeNotice,
  loadStoredFrameIndex,
  progressStorageKey,
  readProgressStorageKey,
} from "./scriptParserVersion";

class MemoryStorage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
}

describe("script parser persistence version", () => {
  it("uses one v5 namespace for every frame-dependent record", () => {
    expect(SCRIPT_PARSER_VERSION).toBe(5);
    expect(BOOKMARK_STORAGE_KEY).toBe("fgo-reader-bookmark:v5");
    expect(LAST_OBSERVATION_STORAGE_KEY).toBe("fgo-reader-last-observation:v5");
    expect(progressStorageKey("script")).toBe("fgo-reader-progress:v5:script");
    expect(readProgressStorageKey("script")).toBe("fgo-reader-read:v5:script");
    expect(choiceTrailStorageKey("script")).toBe("fgo-reader-choice-trail:v5:script");
  });

  it("reports legacy state once and ignores already-versioned state", () => {
    const legacy = new MemoryStorage();
    legacy.setItem("fgo-reader-progress:script", "7");
    expect(consumeParserUpgradeNotice(legacy)).toBe(true);
    expect(consumeParserUpgradeNotice(legacy)).toBe(false);

    const current = new MemoryStorage();
    current.setItem(progressStorageKey("script"), "7");
    expect(consumeParserUpgradeNotice(current)).toBe(false);

    const legacyCacheIndex = new MemoryStorage();
    legacyCacheIndex.setItem("fgo-reader-translation-cache-index:v1", "[]");
    expect(consumeParserUpgradeNotice(legacyCacheIndex)).toBe(true);

    const previousVersionCache = new MemoryStorage();
    previousVersionCache.setItem("fgo-reader-translation-cache-index:v4", "[]");
    expect(consumeParserUpgradeNotice(previousVersionCache)).toBe(true);

    const previousVersionBookmark = new MemoryStorage();
    previousVersionBookmark.setItem("fgo-reader-bookmark:v4", "{}");
    expect(consumeParserUpgradeNotice(previousVersionBookmark)).toBe(true);
  });

  it("uses a fallback for corrupt or unavailable persisted frame positions", () => {
    const storage = new MemoryStorage();
    const key = progressStorageKey("script");
    storage.setItem(key, "17");
    expect(loadStoredFrameIndex(key, 0, storage)).toBe(17);

    for (const value of ["", "-1", "2.5", "NaN", "Infinity", "9007199254740992"]) {
      storage.setItem(key, value);
      expect(loadStoredFrameIndex(key, -1, storage)).toBe(-1);
    }

    expect(loadStoredFrameIndex(key, -1, {
      getItem: () => {
        throw new Error("storage unavailable");
      },
    })).toBe(-1);
  });
});

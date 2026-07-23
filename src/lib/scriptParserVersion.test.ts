import { describe, expect, it } from "vitest";
import {
  BOOKMARK_STORAGE_KEY,
  LAST_OBSERVATION_STORAGE_KEY,
  SCRIPT_PARSER_VERSION,
  choiceTrailStorageKey,
  consumeParserUpgradeNotice,
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
  it("uses one v2 namespace for every frame-dependent record", () => {
    expect(SCRIPT_PARSER_VERSION).toBe(2);
    expect(BOOKMARK_STORAGE_KEY).toBe("fgo-reader-bookmark:v2");
    expect(LAST_OBSERVATION_STORAGE_KEY).toBe("fgo-reader-last-observation:v2");
    expect(progressStorageKey("script")).toBe("fgo-reader-progress:v2:script");
    expect(readProgressStorageKey("script")).toBe("fgo-reader-read:v2:script");
    expect(choiceTrailStorageKey("script")).toBe("fgo-reader-choice-trail:v2:script");
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
  });
});

import { afterEach, describe, expect, it } from "vitest";
import {
  customScriptId,
  customScriptUrl,
  deleteCustomScriptPackage,
  getCustomScriptAssetBlob,
  isCustomScriptUrl,
  listCustomScriptPackages,
  loadCustomScriptByUrl,
  parseCustomScriptArchive,
  saveCustomScriptPackage,
  setCustomScriptPackageStorageForTesting,
  setCustomScriptTranslationAllowed,
  type CustomScriptArchivePreview,
  type CustomScriptPreviewCounts,
  type CustomScriptPackageRecord,
  type CustomScriptPackageStorage,
  type CustomScriptPackageSummary,
} from "./customScripts";

const encoder = new TextEncoder();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeU32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function join(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

/** A tiny Store-only ZIP writer keeps these tests independent of a ZIP package. */
function storedZip(files: Record<string, string | Uint8Array>): ArrayBuffer {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const [name, source] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const content = typeof source === "string" ? encoder.encode(source) : source;
    const checksum = crc32(content);
    const local = new Uint8Array(30 + nameBytes.byteLength + content.byteLength);
    writeU32(local, 0, 0x04034b50);
    writeU16(local, 4, 20);
    writeU16(local, 8, 0);
    writeU32(local, 14, checksum);
    writeU32(local, 18, content.byteLength);
    writeU32(local, 22, content.byteLength);
    writeU16(local, 26, nameBytes.byteLength);
    local.set(nameBytes, 30);
    local.set(content, 30 + nameBytes.byteLength);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.byteLength);
    writeU32(central, 0, 0x02014b50);
    writeU16(central, 4, 20);
    writeU16(central, 6, 20);
    writeU16(central, 10, 0);
    writeU32(central, 16, checksum);
    writeU32(central, 20, content.byteLength);
    writeU32(central, 24, content.byteLength);
    writeU16(central, 28, nameBytes.byteLength);
    writeU32(central, 42, localOffset);
    central.set(nameBytes, 46);
    centralParts.push(central);
    localOffset += local.byteLength;
  }

  const central = join(centralParts);
  const footer = new Uint8Array(22);
  writeU32(footer, 0, 0x06054b50);
  writeU16(footer, 8, localParts.length);
  writeU16(footer, 10, localParts.length);
  writeU32(footer, 12, central.byteLength);
  writeU32(footer, 16, localOffset);
  return join([...localParts, central, footer]).buffer as ArrayBuffer;
}

function manifest(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: "fgo-reader-script-package",
    version: 1,
    title: "测试剧本",
    region: "JP",
    script: "story.txt",
    ...overrides,
  });
}

const playableScript = "＠玛修\n欢迎来到测试。\n[k]\n";

afterEach(() => {
  setCustomScriptPackageStorageForTesting(null);
});

describe("custom script package parser", () => {
  it("parses a root package, validates mappings, and generates a stable custom URL", async () => {
    const preview = await parseCustomScriptArchive(storedZip({
      "manifest.json": manifest({
        assets: {
          backgrounds: { "100": "assets/background.png" },
          characters: { "9001": "assets/character.webp" },
          bgm: { BGM_TEST: "assets/test.ogg" },
        },
      }),
      "story.txt": playableScript,
      "assets/background.png": new Uint8Array([1, 2, 3]),
      "assets/character.webp": new Uint8Array([4, 5]),
      "assets/test.ogg": new Uint8Array([6]),
      "notes/unused.bin": new Uint8Array([7]),
    }));

    expect(preview.record).toMatchObject({
      scriptId: preview.record.id,
      title: "测试剧本",
      region: "JP",
      translationAllowed: false,
      preview: { parserVersion: 3, frameCount: 1, characterCount: 0 },
    });
    expect(preview.assets.map((asset) => asset.path).sort()).toEqual([
      "assets/background.png",
      "assets/character.webp",
      "assets/test.ogg",
    ]);
    const url = customScriptUrl(preview.record.id);
    expect(isCustomScriptUrl(url)).toBe(true);
    expect(customScriptId(url)).toBe(preview.record.id);
  });

  it("accepts one wrapper directory and rejects traversal paths", async () => {
    const preview = await parseCustomScriptArchive(storedZip({
      "package/manifest.json": manifest(),
      "package/story.txt": playableScript,
    }));
    expect(preview.record.title).toBe("测试剧本");

    await expect(parseCustomScriptArchive(storedZip({
      "manifest.json": manifest({ script: "../story.txt" }),
      "story.txt": playableScript,
    }))).rejects.toMatchObject({ code: "invalid_path" });
  });

  it("rejects a script that defines too many character slots", async () => {
    const slots = Array.from(
      { length: 65 },
      (_, index) => `[charaSet S${index} ${index + 1} 0 角色${index}]`,
    ).join("\n");
    await expect(parseCustomScriptArchive(storedZip({
      "manifest.json": manifest(),
      "story.txt": `${slots}\n${playableScript}`,
    }))).rejects.toMatchObject({ code: "invalid_script" });
  });

  it("uses parser diagnostics as import validation and counts branch resources recursively", async () => {
    await expect(parseCustomScriptArchive(storedZip({
      "manifest.json": manifest({ region: "KR" }),
      "story.txt": "?1:Outer\n?1:Nested\n@N\nText[q]\n?!\n?!",
    }))).rejects.toMatchObject({ code: "invalid_script" });

    const preview = await parseCustomScriptArchive(storedZip({
      "manifest.json": manifest({ region: "KR" }),
      "story.txt": [
        "?1:A",
        "[scene 101]",
        "[bgm A]",
        "[charaSet A 1001 0 A]",
        "[charaPut A 0]",
        "@A:A",
        "Branch A[q]",
        "?2:B",
        "[scene 202]",
        "[bgm B]",
        "[charaSet B 2002 0 B]",
        "[charaPut B 2]",
        "@B:B",
        "Branch B[q]",
        "?!",
      ].join("\n"),
    }));

    expect(preview.record.preview).toEqual({
      parserVersion: 3,
      frameCount: 3,
      choiceCount: 1,
      characterCount: 2,
      sceneCount: 2,
      bgmCount: 2,
    });

    const sharedContinuation = await parseCustomScriptArchive(storedZip({
      "manifest.json": manifest(),
      "story.txt": "？1：Continue\n？！\n＠旁白\nShared continuation[k]",
    }));
    expect(sharedContinuation.parsedScript.frames[0]).toMatchObject({
      type: "choice",
      options: [{ label: "Continue", frames: [] }],
    });
  });
});

describe("custom script package persistence facade", () => {
  it("uses an injected storage adapter without asking list() to load asset blobs", async () => {
    const preview = await parseCustomScriptArchive(storedZip({
      "manifest.json": manifest({ assets: { backgrounds: { "1": "scene.png" } } }),
      "story.txt": playableScript,
      "scene.png": new Uint8Array([1]),
    }));
    let saved: CustomScriptPackageRecord | null = null;
    const storedAssets = new Map<string, Blob>();
    let assetReads = 0;
    const summary = (record: CustomScriptPackageRecord): CustomScriptPackageSummary => {
      const { scriptText: _scriptText, ...value } = record;
      return value;
    };
    const storage: CustomScriptPackageStorage = {
      save: async (next: CustomScriptArchivePreview) => {
        saved = { ...next.record };
        for (const asset of next.assets) storedAssets.set(asset.path, asset.blob);
        return saved;
      },
      list: async () => saved ? [summary(saved)] : [],
      load: async (id) => saved?.id === id ? saved : null,
      delete: async (id) => {
        const deleted = saved?.id === id;
        if (deleted) saved = null;
        return deleted;
      },
      setTranslationAllowed: async (id, allowed) => {
        if (!saved || saved.id !== id) return null;
        saved = { ...saved, translationAllowed: allowed };
        return saved;
      },
      getAsset: async (id, path) => {
        assetReads += 1;
        return saved?.id === id ? storedAssets.get(path) ?? null : null;
      },
    };
    setCustomScriptPackageStorageForTesting(storage);

    const savedRecord = await saveCustomScriptPackage(preview);
    expect((await listCustomScriptPackages())[0]).not.toHaveProperty("scriptText");
    expect(assetReads).toBe(0);
    expect(await loadCustomScriptByUrl(customScriptUrl(savedRecord.id))).toMatchObject({ id: savedRecord.id });
    expect(await setCustomScriptTranslationAllowed(savedRecord.id, true)).toMatchObject({ translationAllowed: true });
    expect(await getCustomScriptAssetBlob(savedRecord.id, "scene.png")).toBeInstanceOf(Blob);
    expect(assetReads).toBe(1);
    expect(await deleteCustomScriptPackage(savedRecord.id)).toBe(true);
  });

  it("lazily refreshes stale preview metadata without replacing package assets", async () => {
    const imported = await parseCustomScriptArchive(storedZip({
      "manifest.json": manifest({ assets: { backgrounds: { "1": "scene.png" } } }),
      "story.txt": playableScript,
      "scene.png": new Uint8Array([1]),
    }));
    const stalePreview = { ...imported.record.preview, frameCount: 0 };
    delete (stalePreview as Partial<CustomScriptPreviewCounts>).parserVersion;
    let saved: CustomScriptPackageRecord = {
      ...imported.record,
      preview: stalePreview as CustomScriptPreviewCounts,
    };
    let updateCount = 0;
    let assetReads = 0;
    const summary = () => {
      const { scriptText: _scriptText, ...value } = saved;
      return value;
    };
    const storage: CustomScriptPackageStorage = {
      save: async () => saved,
      list: async () => [summary()],
      load: async () => saved,
      delete: async () => false,
      setTranslationAllowed: async () => saved,
      updatePreview: async (_id, preview) => {
        updateCount += 1;
        saved = { ...saved, preview };
        return saved;
      },
      getAsset: async () => {
        assetReads += 1;
        return null;
      },
    };
    setCustomScriptPackageStorageForTesting(storage);

    expect((await listCustomScriptPackages())[0].preview).toMatchObject({
      parserVersion: 3,
      frameCount: 1,
    });
    expect(updateCount).toBe(1);
    expect(assetReads).toBe(0);
    await listCustomScriptPackages();
    expect(updateCount).toBe(1);
  });
});

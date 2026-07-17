import { parseFgoScript } from "./scriptParser";
import type { ParsedScript, Region, StoryFrame } from "../types";

export const CUSTOM_SCRIPT_URL_PREFIX = "fgo-reader-custom://";
export const CUSTOM_SCRIPT_FORMAT = "fgo-reader-script-package";
export const CUSTOM_SCRIPT_FORMAT_VERSION = 1;

const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 128 * 1024 * 1024;
const MAX_ENTRIES = 256;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_SCRIPT_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const MAX_FLATTENED_FRAMES = 10_000;
const MAX_CHOICE_OPTIONS = 9;
const MAX_CHARACTER_SLOTS = 64;

const PACKAGE_ID_PATTERN = /^custom-v1-[0-9a-f]{24}$/;
const PACKAGE_DB_NAME = "fgo-reader-custom-scripts";
const PACKAGE_DB_VERSION = 2;
const PACKAGE_STORE = "packages";
const SCRIPT_STORE = "scripts";
const ASSET_STORE = "assets";

const REGIONS = new Set<Region>(["CN", "JP", "NA", "TW", "KR"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpeg", "jpg", "webp"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "ogg", "wav"]);

export type CustomScriptArchiveInput = File | Blob | ArrayBuffer;
export type CustomScriptAssetKind = "backgrounds" | "characters" | "bgm";

export interface CustomScriptAssetMappings {
  backgrounds: Record<string, string>;
  characters: Record<string, string>;
  bgm: Record<string, string>;
}

export interface CustomScriptPreviewCounts {
  frameCount: number;
  choiceCount: number;
  characterCount: number;
  sceneCount: number;
  bgmCount: number;
}

/** The persisted package data. Asset bytes are deliberately kept out of this record. */
export interface CustomScriptPackageRecord {
  id: string;
  scriptId: string;
  format: typeof CUSTOM_SCRIPT_FORMAT;
  version: typeof CUSTOM_SCRIPT_FORMAT_VERSION;
  title: string;
  author?: string;
  description?: string;
  region: Region;
  scriptText: string;
  assets: CustomScriptAssetMappings;
  importedAt: number;
  updatedAt: number;
  archiveName: string;
  byteSize: number;
  translationAllowed: boolean;
  preview: CustomScriptPreviewCounts;
}

/** A lightweight record returned by list operations; it never includes the script body or blobs. */
export type CustomScriptPackageSummary = Omit<CustomScriptPackageRecord, "scriptText">;

export interface CustomScriptAssetBlob {
  packageId: string;
  path: string;
  blob: Blob;
}

/** The validated import result. Pass this object to saveCustomScriptPackage. */
export interface CustomScriptArchivePreview {
  record: CustomScriptPackageRecord;
  parsedScript: ParsedScript;
  assets: CustomScriptAssetBlob[];
}

export type CustomScriptPackageErrorCode =
  | "archive_too_large"
  | "invalid_archive"
  | "unsupported_compression"
  | "unsupported_browser"
  | "invalid_manifest"
  | "invalid_path"
  | "invalid_resource"
  | "invalid_script"
  | "storage_unavailable";

export class CustomScriptPackageError extends Error {
  readonly code: CustomScriptPackageErrorCode;

  constructor(message: string, code: CustomScriptPackageErrorCode = "invalid_archive") {
    super(message);
    this.name = "CustomScriptPackageError";
    this.code = code;
  }
}

interface ZipEntry {
  name: string;
  isDirectory: boolean;
  flags: number;
  compressionMethod: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface ValidatedManifest {
  title: string;
  author?: string;
  description?: string;
  region: Region;
  script: string;
  assets: CustomScriptAssetMappings;
}

interface StoredAsset {
  packageId: string;
  path: string;
  blob: Blob;
}

interface StoredScript {
  id: string;
  scriptText: string;
}

export interface CustomScriptPackageStorage {
  save(preview: CustomScriptArchivePreview): Promise<CustomScriptPackageRecord>;
  list(): Promise<CustomScriptPackageSummary[]>;
  load(id: string): Promise<CustomScriptPackageRecord | null>;
  delete(id: string): Promise<boolean>;
  setTranslationAllowed(id: string, allowed: boolean): Promise<CustomScriptPackageRecord | null>;
  getAsset(id: string, path: string): Promise<Blob | null>;
}

let databasePromise: Promise<IDBDatabase> | null = null;
let storageOverride: CustomScriptPackageStorage | null = null;

function packageError(
  message: string,
  code: CustomScriptPackageErrorCode = "invalid_archive",
): never {
  throw new CustomScriptPackageError(message, code);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRegion(value: unknown): value is Region {
  return typeof value === "string" && REGIONS.has(value as Region);
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      packageError(`${label} contains an unsupported field: ${key}`, "invalid_manifest");
    }
  }
}

function assertSafeArchivePath(path: string, label: string) {
  if (!path || path.includes("\0") || path.includes("\\") || path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
    packageError(`${label} must be a relative POSIX path`, "invalid_path");
  }

  const isDirectory = path.endsWith("/");
  const parts = path.split("/");
  if (isDirectory) parts.pop();
  if (!parts.length || parts.some((part) => !part || part === "." || part === "..")) {
    packageError(`${label} must not contain empty, . or .. path segments`, "invalid_path");
  }
}

function fileExtension(path: string) {
  const baseName = path.slice(path.lastIndexOf("/") + 1);
  const dot = baseName.lastIndexOf(".");
  return dot >= 0 ? baseName.slice(dot + 1).toLowerCase() : "";
}

function mimeTypeForPath(path: string) {
  switch (fileExtension(path)) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    case "mp3": return "audio/mpeg";
    case "ogg": return "audio/ogg";
    case "wav": return "audio/wav";
    default: return "application/octet-stream";
  }
}

function cloneAssets(assets: CustomScriptAssetMappings): CustomScriptAssetMappings {
  return {
    backgrounds: { ...assets.backgrounds },
    characters: { ...assets.characters },
    bgm: { ...assets.bgm },
  };
}

function parseAssetMappings(value: unknown): CustomScriptAssetMappings {
  const mappings: CustomScriptAssetMappings = {
    backgrounds: {},
    characters: {},
    bgm: {},
  };
  if (value === undefined) return mappings;
  if (!isObject(value)) packageError("manifest.assets must be an object", "invalid_manifest");

  assertOnlyKeys(value, ["backgrounds", "characters", "bgm"], "manifest.assets");
  for (const kind of ["backgrounds", "characters", "bgm"] as const) {
    const rawMapping = value[kind];
    if (rawMapping === undefined) continue;
    if (!isObject(rawMapping)) {
      packageError(`manifest.assets.${kind} must be an object`, "invalid_manifest");
    }
    for (const [key, path] of Object.entries(rawMapping)) {
      if (typeof path !== "string") {
        packageError(`manifest.assets.${kind}.${key} must be a string path`, "invalid_manifest");
      }
      assertSafeArchivePath(path, `manifest.assets.${kind}.${key}`);
      mappings[kind][key] = path;
    }
  }
  return mappings;
}

function parseManifest(text: string): ValidatedManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    packageError("manifest.json is not valid JSON", "invalid_manifest");
  }
  if (!isObject(raw)) packageError("manifest.json must contain an object", "invalid_manifest");

  assertOnlyKeys(
    raw,
    ["format", "version", "title", "author", "description", "region", "script", "assets"],
    "manifest.json",
  );
  if (raw.format !== CUSTOM_SCRIPT_FORMAT || raw.version !== CUSTOM_SCRIPT_FORMAT_VERSION) {
    packageError("manifest.json has an unsupported package format or version", "invalid_manifest");
  }
  if (typeof raw.title !== "string") packageError("manifest.title must be a string", "invalid_manifest");
  if (raw.author !== undefined && typeof raw.author !== "string") {
    packageError("manifest.author must be a string", "invalid_manifest");
  }
  if (raw.description !== undefined && typeof raw.description !== "string") {
    packageError("manifest.description must be a string", "invalid_manifest");
  }
  if (!isRegion(raw.region)) packageError("manifest.region must be CN, JP, NA, TW, or KR", "invalid_manifest");
  if (typeof raw.script !== "string") packageError("manifest.script must be a string path", "invalid_manifest");
  assertSafeArchivePath(raw.script, "manifest.script");

  return {
    title: raw.title,
    ...(raw.author === undefined ? {} : { author: raw.author }),
    ...(raw.description === undefined ? {} : { description: raw.description }),
    region: raw.region,
    script: raw.script,
    assets: parseAssetMappings(raw.assets),
  };
}

function decodeUtf8(bytes: Uint8Array, label: string, allowBom = false) {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    return allowBom ? decoded.replace(/^\uFEFF/, "") : decoded;
  } catch {
    packageError(`${label} must be valid UTF-8`, "invalid_archive");
  }
}

function findEndOfCentralDirectory(bytes: Uint8Array, view: DataView) {
  const minimumOffset = Math.max(0, bytes.byteLength - 0x10016);
  for (let offset = bytes.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + 22 + commentLength === bytes.byteLength) return offset;
  }
  packageError("ZIP end-of-central-directory record is missing", "invalid_archive");
}

function parseZipDirectory(archive: ArrayBuffer) {
  const bytes = new Uint8Array(archive);
  const view = new DataView(archive);
  if (bytes.byteLength < 22) packageError("ZIP archive is too short", "invalid_archive");

  const eocd = findEndOfCentralDirectory(bytes, view);
  const disk = view.getUint16(eocd + 4, true);
  const centralDirectoryDisk = view.getUint16(eocd + 6, true);
  const entriesOnDisk = view.getUint16(eocd + 8, true);
  const entryCount = view.getUint16(eocd + 10, true);
  const centralDirectorySize = view.getUint32(eocd + 12, true);
  const centralDirectoryOffset = view.getUint32(eocd + 16, true);

  if (disk !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
    packageError("multi-disk ZIP archives are not supported", "invalid_archive");
  }
  if (
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    packageError("ZIP64 archives are not supported", "invalid_archive");
  }
  if (entryCount > MAX_ENTRIES) packageError(`ZIP archives may contain at most ${MAX_ENTRIES} entries`, "invalid_archive");
  if (centralDirectoryOffset + centralDirectorySize > bytes.byteLength) {
    packageError("ZIP central directory is outside the archive", "invalid_archive");
  }

  const entries = new Map<string, ZipEntry>();
  let totalUncompressed = 0;
  let cursor = centralDirectoryOffset;
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > centralDirectoryEnd || view.getUint32(cursor, true) !== 0x02014b50) {
      packageError("ZIP central directory entry is invalid", "invalid_archive");
    }
    const flags = view.getUint16(cursor + 8, true);
    const compressionMethod = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const diskStart = view.getUint16(cursor + 34, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const recordEnd = cursor + 46 + nameLength + extraLength + commentLength;

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff ||
      diskStart !== 0 ||
      recordEnd > centralDirectoryEnd
    ) {
      packageError("ZIP64 or multi-disk entries are not supported", "invalid_archive");
    }

    const name = decodeUtf8(bytes.subarray(cursor + 46, cursor + 46 + nameLength), "ZIP entry name");
    assertSafeArchivePath(name, "ZIP entry name");
    if (entries.has(name)) packageError(`ZIP contains duplicate entry: ${name}`, "invalid_archive");

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      packageError("ZIP archive exceeds the 128 MiB uncompressed limit", "invalid_archive");
    }
    entries.set(name, {
      name,
      isDirectory: name.endsWith("/"),
      flags,
      compressionMethod,
      crc,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    cursor = recordEnd;
  }

  if (cursor > centralDirectoryEnd) packageError("ZIP central directory is invalid", "invalid_archive");
  return entries;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(
  archive: ArrayBuffer,
  start: number,
  end: number,
  expectedSize: number,
): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === "undefined") {
    packageError(
      "This browser cannot read deflated ZIP packages because DecompressionStream is unavailable",
      "unsupported_browser",
    );
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  try {
    const compressed = archive.slice(start, end);
    let decompressor: DecompressionStream;
    try {
      decompressor = new DecompressionStream("deflate-raw");
    } catch {
      packageError(
        "This browser cannot read deflated ZIP packages because deflate-raw is unavailable",
        "unsupported_browser",
      );
    }
    const stream = new Blob([compressed]).stream().pipeThrough(decompressor);
    reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > expectedSize || byteLength > MAX_UNCOMPRESSED_BYTES) {
        void reader.cancel();
        packageError("ZIP entry expands beyond its declared size", "invalid_archive");
      }
      const chunk = new Uint8Array(value.byteLength);
      chunk.set(value);
      chunks.push(chunk);
    }
    const output = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output.buffer as ArrayBuffer;
  } catch (error) {
    if (error instanceof CustomScriptPackageError) throw error;
    throw new CustomScriptPackageError("ZIP entry could not be deflated", "invalid_archive");
  } finally {
    reader?.releaseLock();
  }
}

async function extractZipEntry(archive: ArrayBuffer, entry: ZipEntry): Promise<ArrayBuffer> {
  if ((entry.flags & 0x1) !== 0 || (entry.flags & 0x40) !== 0) {
    packageError(`ZIP entry is encrypted: ${entry.name}`, "unsupported_compression");
  }
  if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
    packageError(`ZIP compression method is unsupported for ${entry.name}`, "unsupported_compression");
  }

  const bytes = new Uint8Array(archive);
  const view = new DataView(archive);
  const header = entry.localHeaderOffset;
  if (header + 30 > bytes.byteLength || view.getUint32(header, true) !== 0x04034b50) {
    packageError(`ZIP local header is invalid for ${entry.name}`, "invalid_archive");
  }
  const localFlags = view.getUint16(header + 6, true);
  const localMethod = view.getUint16(header + 8, true);
  const nameLength = view.getUint16(header + 26, true);
  const extraLength = view.getUint16(header + 28, true);
  const dataStart = header + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (
    localMethod !== entry.compressionMethod ||
    (localFlags & 0x1) !== 0 ||
    dataStart > bytes.byteLength ||
    dataEnd > bytes.byteLength
  ) {
    packageError(`ZIP local header data is invalid for ${entry.name}`, "invalid_archive");
  }
  const localName = decodeUtf8(bytes.subarray(header + 30, header + 30 + nameLength), "ZIP local entry name");
  if (localName !== entry.name) packageError(`ZIP entry names do not match: ${entry.name}`, "invalid_archive");

  let output: ArrayBuffer;
  if (entry.compressionMethod === 0) {
    if (entry.compressedSize !== entry.uncompressedSize) {
      packageError(`stored ZIP entry size is invalid for ${entry.name}`, "invalid_archive");
    }
    output = archive.slice(dataStart, dataEnd);
  } else {
    output = await inflateRaw(archive, dataStart, dataEnd, entry.uncompressedSize);
  }

  const outputBytes = new Uint8Array(output);
  if (outputBytes.byteLength !== entry.uncompressedSize || crc32(outputBytes) !== entry.crc) {
    packageError(`ZIP entry checksum or size is invalid for ${entry.name}`, "invalid_archive");
  }
  return output;
}

function packagePrefix(entries: Map<string, ZipEntry>) {
  const rootManifest = entries.get("manifest.json");
  if (rootManifest && !rootManifest.isDirectory) return "";

  const files = [...entries.values()].filter((entry) => !entry.isDirectory);
  const roots = new Set(files.map((entry) => entry.name.split("/")[0]));
  if (roots.size !== 1) {
    packageError("manifest.json must be at the archive root or inside one wrapper directory", "invalid_archive");
  }
  const [wrapper] = roots;
  const prefix = `${wrapper}/`;
  if (!files.every((entry) => entry.name.startsWith(prefix))) {
    packageError("all package files must be inside the one wrapper directory", "invalid_archive");
  }
  if (!entries.get(`${prefix}manifest.json`) || entries.get(`${prefix}manifest.json`)?.isDirectory) {
    packageError("wrapper directory does not contain manifest.json", "invalid_archive");
  }
  return prefix;
}

function findRequiredEntry(entries: Map<string, ZipEntry>, prefix: string, path: string, label: string) {
  const entry = entries.get(`${prefix}${path}`);
  if (!entry || entry.isDirectory) packageError(`${label} does not exist in the ZIP archive: ${path}`, "invalid_resource");
  return entry;
}

function validateAssetEntries(entries: Map<string, ZipEntry>, prefix: string, assets: CustomScriptAssetMappings) {
  for (const kind of ["backgrounds", "characters", "bgm"] as const) {
    const extensions = kind === "bgm" ? AUDIO_EXTENSIONS : IMAGE_EXTENSIONS;
    const byteLimit = kind === "bgm" ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
    for (const [key, path] of Object.entries(assets[kind])) {
      if (!extensions.has(fileExtension(path))) {
        packageError(`manifest.assets.${kind}.${key} has an incompatible file extension`, "invalid_resource");
      }
      const entry = findRequiredEntry(entries, prefix, path, `manifest.assets.${kind}.${key}`);
      if (entry.uncompressedSize > byteLimit) {
        packageError(
          `manifest.assets.${kind}.${key} exceeds its per-file size limit`,
          "invalid_resource",
        );
      }
    }
  }
}

function inspectFrames(frames: StoryFrame[]) {
  let frameCount = 0;
  let choiceCount = 0;
  const pending = [...frames];
  while (pending.length) {
    const frame = pending.pop()!;
    frameCount += 1;
    if (frameCount > MAX_FLATTENED_FRAMES) {
      packageError(`script has more than ${MAX_FLATTENED_FRAMES} flattened frames`, "invalid_script");
    }
    if (frame.type !== "choice") continue;
    choiceCount += 1;
    if (!frame.options.length) packageError("script contains an empty choice", "invalid_script");
    if (frame.options.length > MAX_CHOICE_OPTIONS) {
      packageError(`a script choice may contain at most ${MAX_CHOICE_OPTIONS} options`, "invalid_script");
    }
    for (const option of frame.options) pending.push(...option.frames);
  }
  if (!frameCount) packageError("script contains no playable frames", "invalid_script");
  return { frameCount, choiceCount };
}

function inspectScriptSourceBudget(source: string) {
  const slots = new Set<string>();
  let frameCandidates = 0;
  let inChoiceGroup = false;

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    const characterMatch = trimmed.match(/^\[charaSet\s+(\S+)/i);
    if (characterMatch) {
      slots.add(characterMatch[1]);
      if (slots.size > MAX_CHARACTER_SLOTS) {
        packageError(
          `script may define at most ${MAX_CHARACTER_SLOTS} character slots`,
          "invalid_script",
        );
      }
    }

    if (trimmed.startsWith("＠")) {
      frameCandidates += 1;
    } else if (/^？\d+[：:]/.test(trimmed)) {
      if (!inChoiceGroup) {
        frameCandidates += 1;
        inChoiceGroup = true;
      }
    } else if (/^？！/.test(trimmed)) {
      inChoiceGroup = false;
    }

    if (frameCandidates > MAX_FLATTENED_FRAMES) {
      packageError(
        `script has more than ${MAX_FLATTENED_FRAMES} possible frames`,
        "invalid_script",
      );
    }
  }
}

async function hashArchive(archive: ArrayBuffer) {
  if (!globalThis.crypto?.subtle) {
    packageError("This browser does not provide WebCrypto for package hashing", "unsupported_browser");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", archive);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `custom-v1-${hex.slice(0, 24)}`;
}

async function readArchiveInput(input: CustomScriptArchiveInput) {
  if (input instanceof ArrayBuffer) {
    return { archive: input, archiveName: "custom-script.zip" };
  }
  if (!input || typeof input.arrayBuffer !== "function") {
    packageError("Expected a ZIP File, Blob, or ArrayBuffer", "invalid_archive");
  }
  if (input.size > MAX_ARCHIVE_BYTES) {
    packageError("ZIP archive exceeds the 64 MiB limit", "archive_too_large");
  }
  const archive = await input.arrayBuffer();
  return {
    archive,
    archiveName: "name" in input && typeof input.name === "string" && input.name ? input.name : "custom-script.zip",
  };
}

/**
 * Validates a one-script ZIP package without persisting it. ZIP entry names, the manifest and
 * script are all treated as fatal UTF-8. A UTF-8 BOM is accepted for manifest and script text.
 */
export async function parseCustomScriptArchive(input: CustomScriptArchiveInput): Promise<CustomScriptArchivePreview> {
  const { archive, archiveName } = await readArchiveInput(input);
  if (archive.byteLength > MAX_ARCHIVE_BYTES) {
    packageError("ZIP archive exceeds the 64 MiB limit", "archive_too_large");
  }

  const entries = parseZipDirectory(archive);
  const prefix = packagePrefix(entries);
  const manifestEntry = findRequiredEntry(entries, prefix, "manifest.json", "manifest.json");
  if (manifestEntry.uncompressedSize > MAX_MANIFEST_BYTES) {
    packageError("manifest.json exceeds the 64 KiB limit", "invalid_manifest");
  }
  const manifestText = decodeUtf8(new Uint8Array(await extractZipEntry(archive, manifestEntry)), "manifest.json", true);
  const manifest = parseManifest(manifestText);
  const scriptEntry = findRequiredEntry(entries, prefix, manifest.script, "manifest.script");
  if (scriptEntry.uncompressedSize > MAX_SCRIPT_BYTES) {
    packageError("script exceeds the 2 MiB limit", "invalid_script");
  }
  validateAssetEntries(entries, prefix, manifest.assets);

  const id = await hashArchive(archive);
  const scriptText = decodeUtf8(new Uint8Array(await extractZipEntry(archive, scriptEntry)), "script", true);
  inspectScriptSourceBudget(scriptText);
  const parsedScript = parseFgoScript(scriptText, id);
  const frameInfo = inspectFrames(parsedScript.frames);

  const assetByPath = new Map<string, CustomScriptAssetBlob>();
  for (const kind of ["backgrounds", "characters", "bgm"] as const) {
    for (const path of Object.values(manifest.assets[kind])) {
      if (assetByPath.has(path)) continue;
      const entry = findRequiredEntry(entries, prefix, path, `manifest.assets.${kind}`);
      const bytes = await extractZipEntry(archive, entry);
      assetByPath.set(path, {
        packageId: id,
        path,
        blob: new Blob([bytes], { type: mimeTypeForPath(path) }),
      });
    }
  }

  const now = Date.now();
  return {
    record: {
      id,
      scriptId: id,
      format: CUSTOM_SCRIPT_FORMAT,
      version: CUSTOM_SCRIPT_FORMAT_VERSION,
      title: manifest.title,
      ...(manifest.author === undefined ? {} : { author: manifest.author }),
      ...(manifest.description === undefined ? {} : { description: manifest.description }),
      region: manifest.region,
      scriptText,
      assets: cloneAssets(manifest.assets),
      importedAt: now,
      updatedAt: now,
      archiveName,
      byteSize: archive.byteLength,
      translationAllowed: false,
      preview: {
        frameCount: frameInfo.frameCount,
        choiceCount: frameInfo.choiceCount,
        characterCount: parsedScript.characterCount,
        sceneCount: parsedScript.sceneCount,
        bgmCount: parsedScript.bgmCount,
      },
    },
    parsedScript,
    assets: [...assetByPath.values()],
  };
}

function requirePackageId(value: string) {
  if (!PACKAGE_ID_PATTERN.test(value)) packageError("Invalid custom script package id", "invalid_archive");
  return value;
}

/** Builds the pseudo URL used by the reader to identify a persisted package. */
export function customScriptUrl(id: string) {
  return `${CUSTOM_SCRIPT_URL_PREFIX}${requirePackageId(id)}`;
}

/** Returns true only for a valid custom package pseudo URL. */
export function isCustomScriptUrl(value: string) {
  return customScriptId(value) !== null;
}

/** Extracts a package id from a custom package pseudo URL. */
export function customScriptId(value: string): string | null {
  if (typeof value !== "string" || !value.startsWith(CUSTOM_SCRIPT_URL_PREFIX)) return null;
  const id = value.slice(CUSTOM_SCRIPT_URL_PREFIX.length);
  return PACKAGE_ID_PATTERN.test(id) ? id : null;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

function openPackageDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new CustomScriptPackageError("IndexedDB is unavailable", "storage_unavailable"));
  }
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(PACKAGE_DB_NAME, PACKAGE_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction!;
      if (!database.objectStoreNames.contains(PACKAGE_STORE)) {
        database.createObjectStore(PACKAGE_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SCRIPT_STORE)) {
        database.createObjectStore(SCRIPT_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(ASSET_STORE)) {
        database.createObjectStore(ASSET_STORE, { keyPath: ["packageId", "path"] });
      }

      // Version 1 stored full script bodies alongside list metadata. Move them
      // to their own store so refreshing the library never reads every source.
      if (event.oldVersion < 2 && database.objectStoreNames.contains(PACKAGE_STORE)) {
        const packages = transaction.objectStore(PACKAGE_STORE);
        const scripts = transaction.objectStore(SCRIPT_STORE);
        const cursorRequest = packages.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const record = cursor.value as Partial<CustomScriptPackageRecord>;
          if (typeof record.id === "string" && typeof record.scriptText === "string") {
            const { scriptText, ...summary } = record;
            scripts.put({ id: record.id, scriptText } satisfies StoredScript);
            cursor.update(summary);
          }
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
    request.onblocked = () => reject(new Error("IndexedDB is blocked by another open tab"));
  });
  return databasePromise;
}

function summaryFromRecord(record: CustomScriptPackageRecord): CustomScriptPackageSummary {
  const { scriptText: _scriptText, ...summary } = record;
  return cloneSummary(summary);
}

function cloneSummary(record: CustomScriptPackageSummary): CustomScriptPackageSummary {
  return {
    ...record,
    assets: cloneAssets(record.assets),
    preview: { ...record.preview },
  };
}

function cloneRecord(record: CustomScriptPackageRecord): CustomScriptPackageRecord {
  return {
    ...record,
    assets: cloneAssets(record.assets),
    preview: { ...record.preview },
  };
}

function recordFromSummary(
  summary: CustomScriptPackageSummary,
  scriptText: string,
): CustomScriptPackageRecord {
  return {
    ...cloneSummary(summary),
    scriptText,
  };
}

function deletePackageAssets(store: IDBObjectStore, packageId: string) {
  return new Promise<void>((resolve, reject) => {
    const request = store.openCursor();
    request.onerror = () => reject(request.error ?? new Error("Could not enumerate package assets"));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const value = cursor.value as StoredAsset;
      if (value.packageId === packageId) cursor.delete();
      cursor.continue();
    };
  });
}

const indexedDbStorage: CustomScriptPackageStorage = {
  async save(preview) {
    const database = await openPackageDatabase();
    const existing = await this.load(preview.record.id);
    const now = Date.now();
    const record: CustomScriptPackageRecord = {
      ...cloneRecord(preview.record),
      importedAt: existing?.importedAt ?? preview.record.importedAt ?? now,
      updatedAt: now,
      translationAllowed: preview.record.translationAllowed,
    };
    const transaction = database.transaction([PACKAGE_STORE, SCRIPT_STORE, ASSET_STORE], "readwrite");
    const packages = transaction.objectStore(PACKAGE_STORE);
    const scripts = transaction.objectStore(SCRIPT_STORE);
    const assets = transaction.objectStore(ASSET_STORE);
    await deletePackageAssets(assets, record.id);
    for (const asset of preview.assets) {
      if (asset.packageId !== record.id) {
        packageError("Preview asset package id does not match its record", "invalid_archive");
      }
      assets.put({ packageId: record.id, path: asset.path, blob: asset.blob } satisfies StoredAsset);
    }
    packages.put(summaryFromRecord(record));
    scripts.put({ id: record.id, scriptText: record.scriptText } satisfies StoredScript);
    await transactionDone(transaction);
    return cloneRecord(record);
  },

  async list() {
    const database = await openPackageDatabase();
    const transaction = database.transaction(PACKAGE_STORE, "readonly");
    const records = await requestResult(transaction.objectStore(PACKAGE_STORE).getAll()) as CustomScriptPackageSummary[];
    await transactionDone(transaction);
    return records.map(cloneSummary).sort((left, right) => right.updatedAt - left.updatedAt);
  },

  async load(id) {
    const database = await openPackageDatabase();
    const transaction = database.transaction([PACKAGE_STORE, SCRIPT_STORE], "readonly");
    const [summary, source] = await Promise.all([
      requestResult(transaction.objectStore(PACKAGE_STORE).get(id)) as Promise<CustomScriptPackageSummary | undefined>,
      requestResult(transaction.objectStore(SCRIPT_STORE).get(id)) as Promise<StoredScript | undefined>,
    ]);
    await transactionDone(transaction);
    return summary && source?.scriptText !== undefined
      ? recordFromSummary(summary, source.scriptText)
      : null;
  },

  async delete(id) {
    const database = await openPackageDatabase();
    const transaction = database.transaction([PACKAGE_STORE, SCRIPT_STORE, ASSET_STORE], "readwrite");
    const packages = transaction.objectStore(PACKAGE_STORE);
    const existing = await requestResult(packages.get(id));
    await deletePackageAssets(transaction.objectStore(ASSET_STORE), id);
    if (existing) {
      packages.delete(id);
      transaction.objectStore(SCRIPT_STORE).delete(id);
    }
    await transactionDone(transaction);
    return Boolean(existing);
  },

  async setTranslationAllowed(id, allowed) {
    const database = await openPackageDatabase();
    const transaction = database.transaction([PACKAGE_STORE, SCRIPT_STORE], "readwrite");
    const store = transaction.objectStore(PACKAGE_STORE);
    const [existing, source] = await Promise.all([
      requestResult(store.get(id)) as Promise<CustomScriptPackageSummary | undefined>,
      requestResult(transaction.objectStore(SCRIPT_STORE).get(id)) as Promise<StoredScript | undefined>,
    ]);
    if (!existing || source?.scriptText === undefined) {
      await transactionDone(transaction);
      return null;
    }
    const updated: CustomScriptPackageSummary = {
      ...cloneSummary(existing),
      translationAllowed: Boolean(allowed),
      updatedAt: Date.now(),
    };
    store.put(updated);
    await transactionDone(transaction);
    return recordFromSummary(updated, source.scriptText);
  },

  async getAsset(id, path) {
    const database = await openPackageDatabase();
    const transaction = database.transaction(ASSET_STORE, "readonly");
    const asset = await requestResult(transaction.objectStore(ASSET_STORE).get([id, path])) as StoredAsset | undefined;
    await transactionDone(transaction);
    return asset?.blob ?? null;
  },
};

function activeStorage() {
  return storageOverride ?? indexedDbStorage;
}

/** Test-only escape hatch so unit tests can inject a small in-memory repository. */
export function setCustomScriptPackageStorageForTesting(storage: CustomScriptPackageStorage | null) {
  storageOverride = storage;
  databasePromise = null;
}

/** Saves a validated preview. Re-importing the same archive hash updates the one existing record. */
export async function saveCustomScriptPackage(preview: CustomScriptArchivePreview) {
  requirePackageId(preview.record.id);
  return activeStorage().save(preview);
}

/** Lists package metadata without opening the asset Blob store. */
export function listCustomScriptPackages() {
  return activeStorage().list();
}

export async function loadCustomScriptPackage(id: string) {
  return activeStorage().load(requirePackageId(id));
}

export async function loadCustomScriptByUrl(url: string) {
  const id = customScriptId(url);
  return id ? activeStorage().load(id) : null;
}

export async function deleteCustomScriptPackage(id: string) {
  const resolvedId = customScriptId(id) ?? id;
  return activeStorage().delete(requirePackageId(resolvedId));
}

export async function setCustomScriptTranslationAllowed(id: string, allowed: boolean) {
  const resolvedId = customScriptId(id) ?? id;
  return activeStorage().setTranslationAllowed(requirePackageId(resolvedId), Boolean(allowed));
}

/** Fetches one persisted asset Blob by package id and manifest-relative asset path. */
export async function getCustomScriptAssetBlob(packageId: string, assetPath: string) {
  assertSafeArchivePath(assetPath, "asset path");
  return activeStorage().getAsset(requirePackageId(packageId), assetPath);
}

// Short aliases make the persistence API convenient outside the UI integration.
export const saveCustomScript = saveCustomScriptPackage;
export const listCustomScripts = listCustomScriptPackages;
export const loadCustomScript = loadCustomScriptPackage;
export const deleteCustomScript = deleteCustomScriptPackage;
export const updateTranslationAllowed = setCustomScriptTranslationAllowed;
export const getCustomScriptAsset = getCustomScriptAssetBlob;

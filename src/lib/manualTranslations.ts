import type { StoryFrame } from "../types";
import {
  frameTranslationUnits,
  stableHash,
  translationForUnit,
  translationUnitSourceHash,
  type CachedTranslation,
  type TranslationKind,
  type TranslationUnit,
} from "./translation";

export const MANUAL_TRANSLATION_FORMAT = "fgo-reader-translation-template";
export const MANUAL_TRANSLATION_VERSION = 1;
export const MANUAL_TRANSLATION_MAX_BYTES = 8 * 1024 * 1024;

const DATABASE_NAME = "fgo-reader-manual-translations";
const DATABASE_VERSION = 1;
const STORE_NAME = "translations";

export interface TranslationTemplateEntry {
  id: string;
  kind: TranslationKind;
  speaker?: string;
  sourceHash: string;
  sourceText: string;
  translatedText: string;
}

export interface TranslationTemplateV1 {
  format: typeof MANUAL_TRANSLATION_FORMAT;
  version: typeof MANUAL_TRANSLATION_VERSION;
  scriptId: string;
  region: "JP";
  title: string;
  sourceLanguage: "ja";
  targetLanguage: "zh-Hans";
  masterName: string;
  exportedAt: string;
  entries: TranslationTemplateEntry[];
}

export interface ManualTranslationRecord {
  key: string;
  version: typeof MANUAL_TRANSLATION_VERSION;
  scriptId: string;
  region: "JP";
  title: string;
  masterName: string;
  importedAt: number;
  sourceHashes: Record<string, string>;
  translations: Record<string, CachedTranslation>;
}

export interface ManualTranslationInspection {
  status: "none" | "ready" | "stale";
  translations: Record<string, CachedTranslation>;
  translatedCount: number;
  totalCount: number;
}

export interface ManualTranslationStorage {
  load(key: string): Promise<ManualTranslationRecord | null>;
  save(record: ManualTranslationRecord): Promise<ManualTranslationRecord>;
  delete(key: string): Promise<boolean>;
}

export class ManualTranslationError extends Error {
  code: string;

  constructor(message: string, code = "invalid_translation_file") {
    super(message);
    this.name = "ManualTranslationError";
    this.code = code;
  }
}

interface TranslationTemplateContext {
  scriptId: string;
  title: string;
  masterName: string;
  frames: StoryFrame[];
}

let databasePromise: Promise<IDBDatabase> | null = null;
let storageOverride: ManualTranslationStorage | null = null;

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function manualTranslationKey(scriptId: string) {
  return `JP:${scriptId}`;
}

function cloneTranslations(translations: Record<string, CachedTranslation>) {
  return Object.fromEntries(
    Object.entries(translations).map(([id, translation]) => [id, { ...translation }]),
  );
}

function cloneManualTranslationRecord(record: ManualTranslationRecord): ManualTranslationRecord {
  return {
    ...record,
    sourceHashes: { ...record.sourceHashes },
    translations: cloneTranslations(record.translations),
  };
}

/** Collects every translatable unit, including frames nested below every choice branch. */
export function collectScriptTranslationUnits(frames: StoryFrame[]) {
  const units: TranslationUnit[] = [];
  const byId = new Map<string, TranslationUnit>();

  const visit = (branchFrames: StoryFrame[]) => {
    for (const frame of branchFrames) {
      for (const unit of frameTranslationUnits(frame)) {
        const existing = byId.get(unit.id);
        if (existing) {
          if (
            existing.kind !== unit.kind
            || existing.text !== unit.text
            || existing.speaker !== unit.speaker
            || translationUnitSourceHash(existing) !== translationUnitSourceHash(unit)
          ) {
            throw new ManualTranslationError(
              `脚本中存在冲突的翻译单元：${unit.id}`,
              "conflicting_translation_unit",
            );
          }
          continue;
        }
        byId.set(unit.id, unit);
        units.push(unit);
      }

      if (frame.type === "choice") {
        for (const option of frame.options) visit(option.frames);
      }
    }
  };

  visit(frames);
  return units;
}

export function translationSourceSignature(frames: StoryFrame[]) {
  return stableHash(collectScriptTranslationUnits(frames)
    .map((unit) => `${unit.id}:${translationUnitSourceHash(unit)}`)
    .join("\u0000"));
}

export function createTranslationTemplate(
  context: TranslationTemplateContext,
  existingTranslations: Record<string, CachedTranslation> = {},
): TranslationTemplateV1 {
  const entries = collectScriptTranslationUnits(context.frames).map((unit) => ({
    id: unit.id,
    kind: unit.kind,
    ...(unit.speaker === undefined ? {} : { speaker: unit.speaker }),
    sourceHash: translationUnitSourceHash(unit),
    sourceText: unit.text,
    translatedText: translationForUnit(existingTranslations, unit) ?? "",
  }));

  return {
    format: MANUAL_TRANSLATION_FORMAT,
    version: MANUAL_TRANSLATION_VERSION,
    scriptId: context.scriptId,
    region: "JP",
    title: context.title,
    sourceLanguage: "ja",
    targetLanguage: "zh-Hans",
    masterName: context.masterName,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

export function serializeTranslationTemplate(
  context: TranslationTemplateContext,
  existingTranslations: Record<string, CachedTranslation> = {},
) {
  return `${JSON.stringify(createTranslationTemplate(context, existingTranslations), null, 2)}\n`;
}

function parseJson(raw: string) {
  if (new TextEncoder().encode(raw).byteLength > MANUAL_TRANSLATION_MAX_BYTES) {
    throw new ManualTranslationError("翻译文件超过 8 MiB 限制", "translation_file_too_large");
  }
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
  } catch {
    throw new ManualTranslationError("翻译文件不是有效的 JSON", "invalid_json");
  }
}

function requireString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string") {
    throw new ManualTranslationError(`翻译文件字段 ${key} 无效`);
  }
  return value;
}

/** Fully validates a template before producing the one record that may be persisted. */
export function parseTranslationTemplate(
  raw: string,
  context: TranslationTemplateContext,
  now = Date.now(),
): ManualTranslationRecord {
  const value = parseJson(raw);
  if (!isRecord(value)) throw new ManualTranslationError("翻译文件根节点格式无效");
  if (value.format !== MANUAL_TRANSLATION_FORMAT) {
    throw new ManualTranslationError("不是 FGO Reader 翻译母本", "invalid_format");
  }
  if (value.version !== MANUAL_TRANSLATION_VERSION) {
    throw new ManualTranslationError("不支持此翻译母本版本", "unsupported_version");
  }
  if (value.region !== "JP" || value.sourceLanguage !== "ja" || value.targetLanguage !== "zh-Hans") {
    throw new ManualTranslationError("翻译母本的区服或语言方向无效", "invalid_language");
  }
  if (requireString(value, "scriptId") !== context.scriptId) {
    throw new ManualTranslationError("翻译母本不属于当前脚本", "script_mismatch");
  }
  if (requireString(value, "masterName") !== context.masterName) {
    throw new ManualTranslationError("翻译母本使用了不同的御主名称，请重新导出", "master_name_mismatch");
  }
  const title = requireString(value, "title");
  requireString(value, "exportedAt");
  if (!Array.isArray(value.entries)) {
    throw new ManualTranslationError("翻译母本缺少 entries 数组");
  }

  const units = collectScriptTranslationUnits(context.frames);
  if (value.entries.length !== units.length) {
    throw new ManualTranslationError("翻译母本的文本条目不完整，请重新导出", "source_mismatch");
  }
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const seen = new Set<string>();
  const sourceHashes: Record<string, string> = {};
  const translations: Record<string, CachedTranslation> = {};

  for (const rawEntry of value.entries) {
    if (!isRecord(rawEntry)) throw new ManualTranslationError("翻译母本包含无效条目");
    const id = requireString(rawEntry, "id");
    if (seen.has(id)) {
      throw new ManualTranslationError(`翻译母本包含重复 ID：${id}`, "duplicate_translation_id");
    }
    seen.add(id);
    const unit = unitById.get(id);
    if (!unit) {
      throw new ManualTranslationError(`翻译母本包含未知 ID：${id}`, "source_mismatch");
    }
    const sourceHash = translationUnitSourceHash(unit);
    const entrySpeaker = rawEntry.speaker;
    if (
      rawEntry.kind !== unit.kind
      || requireString(rawEntry, "sourceHash") !== sourceHash
      || normalizeLineEndings(requireString(rawEntry, "sourceText")) !== normalizeLineEndings(unit.text)
      || (entrySpeaker === undefined ? undefined : entrySpeaker) !== unit.speaker
    ) {
      throw new ManualTranslationError(`翻译母本原文与当前脚本不一致：${id}`, "source_mismatch");
    }
    const translatedText = normalizeLineEndings(requireString(rawEntry, "translatedText")).trim();
    sourceHashes[id] = sourceHash;
    if (translatedText) translations[id] = { sourceHash, translatedText };
  }

  if (seen.size !== unitById.size) {
    throw new ManualTranslationError("翻译母本的文本条目不完整，请重新导出", "source_mismatch");
  }
  if (!Object.keys(translations).length) {
    throw new ManualTranslationError("翻译母本中尚未填写任何译文", "empty_translation");
  }

  return {
    key: manualTranslationKey(context.scriptId),
    version: MANUAL_TRANSLATION_VERSION,
    scriptId: context.scriptId,
    region: "JP",
    title,
    masterName: context.masterName,
    importedAt: now,
    sourceHashes,
    translations,
  };
}

export function inspectManualTranslationRecord(
  record: ManualTranslationRecord | null,
  context: Pick<TranslationTemplateContext, "scriptId" | "masterName" | "frames">,
): ManualTranslationInspection {
  const units = collectScriptTranslationUnits(context.frames);
  const empty: ManualTranslationInspection = {
    status: "none",
    translations: {},
    translatedCount: 0,
    totalCount: units.length,
  };
  if (!record) return empty;
  if (
    record.version !== MANUAL_TRANSLATION_VERSION
    || record.region !== "JP"
    || record.scriptId !== context.scriptId
    || record.masterName !== context.masterName
    || !isRecord(record.sourceHashes)
    || !isRecord(record.translations)
  ) {
    return { ...empty, status: "stale" };
  }

  const unitIds = new Set(units.map((unit) => unit.id));
  const storedIds = Object.keys(record.sourceHashes);
  if (
    storedIds.length !== units.length
    || storedIds.some((id) => !unitIds.has(id))
    || units.some((unit) => record.sourceHashes[unit.id] !== translationUnitSourceHash(unit))
  ) {
    return { ...empty, status: "stale" };
  }

  const translations = Object.fromEntries(units.flatMap((unit) => {
    const translatedText = translationForUnit(record.translations, unit);
    return translatedText
      ? [[unit.id, { sourceHash: translationUnitSourceHash(unit), translatedText } satisfies CachedTranslation]]
      : [];
  }));
  if (!Object.keys(translations).length) return { ...empty, status: "stale" };
  return {
    status: "ready",
    translations,
    translatedCount: Object.keys(translations).length,
    totalCount: units.length,
  };
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

function openDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new ManualTranslationError("当前浏览器无法保存人工译文", "storage_unavailable"));
  }
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
    request.onblocked = () => reject(new Error("IndexedDB is blocked by another open tab"));
  });
  return databasePromise;
}

const indexedDbStorage: ManualTranslationStorage = {
  async load(key) {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const record = await requestResult(transaction.objectStore(STORE_NAME).get(key)) as ManualTranslationRecord | undefined;
    await transactionDone(transaction);
    return record ? cloneManualTranslationRecord(record) : null;
  },
  async save(record) {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(cloneManualTranslationRecord(record));
    await transactionDone(transaction);
    return cloneManualTranslationRecord(record);
  },
  async delete(key) {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const existing = await requestResult(store.get(key));
    if (existing) store.delete(key);
    await transactionDone(transaction);
    return Boolean(existing);
  },
};

function activeStorage() {
  return storageOverride ?? indexedDbStorage;
}

export function setManualTranslationStorageForTesting(storage: ManualTranslationStorage | null) {
  storageOverride = storage;
  databasePromise = null;
}

export function loadManualTranslation(scriptId: string) {
  return activeStorage().load(manualTranslationKey(scriptId));
}

export function saveManualTranslation(record: ManualTranslationRecord) {
  if (record.key !== manualTranslationKey(record.scriptId)) {
    return Promise.reject(new ManualTranslationError("人工译文记录 ID 无效", "invalid_record"));
  }
  return activeStorage().save(record);
}

export function deleteManualTranslation(scriptId: string) {
  return activeStorage().delete(manualTranslationKey(scriptId));
}

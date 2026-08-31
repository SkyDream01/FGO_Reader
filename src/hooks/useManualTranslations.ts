import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteManualTranslation,
  inspectManualTranslationRecord,
  loadManualTranslation,
  parseTranslationTemplate,
  saveManualTranslation,
  serializeTranslationTemplate,
  translationSourceSignature,
  type ManualTranslationRecord,
} from "../lib/manualTranslations";
import type { CachedTranslation, TranslatableStep } from "../lib/translation";

interface UseManualTranslationsOptions {
  eligible: boolean;
  scriptId: string;
  title: string;
  masterName: string;
  /** The script's full message catalog in program order. */
  steps: TranslatableStep[];
}

export function useManualTranslations({
  eligible,
  scriptId,
  title,
  masterName,
  steps,
}: UseManualTranslationsOptions) {
  const [record, setRecord] = useState<ManualTranslationRecord | null>(null);
  const [loadedSignature, setLoadedSignature] = useState("");
  const [storageError, setStorageError] = useState("");
  const sourceSignature = useMemo(
    () => eligible && steps.length ? translationSourceSignature(steps) : "",
    [eligible, steps],
  );
  const loadSignature = eligible && sourceSignature
    ? `${scriptId}:${masterName}:${sourceSignature}`
    : "";

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setStorageError("");
    setLoadedSignature("");
    if (!loadSignature) return () => { cancelled = true; };

    void loadManualTranslation(scriptId)
      .then((loaded) => {
        if (!cancelled) setRecord(loaded);
      })
      .catch((error) => {
        if (!cancelled) {
          setStorageError(error instanceof Error ? error.message : "无法读取本地人工译文");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedSignature(loadSignature);
      });

    return () => { cancelled = true; };
  }, [loadSignature, scriptId]);

  const inspection = useMemo(
    () => inspectManualTranslationRecord(record, { scriptId, masterName, steps }),
    [steps, masterName, record, scriptId],
  );
  const resolved = !loadSignature || loadedSignature === loadSignature;

  const importTemplate = useCallback(async (raw: string) => {
    const next = parseTranslationTemplate(raw, { scriptId, title, masterName, steps });
    const saved = await saveManualTranslation(next);
    setRecord(saved);
    setLoadedSignature(loadSignature);
    setStorageError("");
    return inspectManualTranslationRecord(saved, { scriptId, masterName, steps });
  }, [steps, loadSignature, masterName, scriptId, title]);

  const remove = useCallback(async () => {
    await deleteManualTranslation(scriptId);
    setRecord(null);
    setLoadedSignature(loadSignature);
    setStorageError("");
  }, [loadSignature, scriptId]);

  const exportTemplate = useCallback((
    existingTranslations?: Record<string, CachedTranslation>,
  ) => serializeTranslationTemplate(
    { scriptId, title, masterName, steps },
    existingTranslations ?? (inspection.status === "ready" ? inspection.translations : {}),
  ), [steps, inspection.status, inspection.translations, masterName, scriptId, title]);

  return {
    ...inspection,
    active: resolved && inspection.status === "ready",
    hasRecord: Boolean(record),
    resolved,
    storageError,
    importTemplate,
    remove,
    exportTemplate,
  };
}

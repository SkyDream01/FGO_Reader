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
import type { StoryFrame } from "../types";

interface UseManualTranslationsOptions {
  eligible: boolean;
  scriptId: string;
  title: string;
  masterName: string;
  frames: StoryFrame[];
}

export function useManualTranslations({
  eligible,
  scriptId,
  title,
  masterName,
  frames,
}: UseManualTranslationsOptions) {
  const [record, setRecord] = useState<ManualTranslationRecord | null>(null);
  const [loadedSignature, setLoadedSignature] = useState("");
  const [storageError, setStorageError] = useState("");
  const sourceSignature = useMemo(
    () => eligible && frames.length ? translationSourceSignature(frames) : "",
    [eligible, frames],
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
    () => inspectManualTranslationRecord(record, { scriptId, masterName, frames }),
    [frames, masterName, record, scriptId],
  );
  const resolved = !loadSignature || loadedSignature === loadSignature;

  const importTemplate = useCallback(async (raw: string) => {
    const next = parseTranslationTemplate(raw, { scriptId, title, masterName, frames });
    const saved = await saveManualTranslation(next);
    setRecord(saved);
    setLoadedSignature(loadSignature);
    setStorageError("");
    return inspectManualTranslationRecord(saved, { scriptId, masterName, frames });
  }, [frames, loadSignature, masterName, scriptId, title]);

  const remove = useCallback(async () => {
    await deleteManualTranslation(scriptId);
    setRecord(null);
    setLoadedSignature(loadSignature);
    setStorageError("");
  }, [loadSignature, scriptId]);

  const exportTemplate = useCallback(() => serializeTranslationTemplate(
    { scriptId, title, masterName, frames },
    inspection.status === "ready" ? inspection.translations : {},
  ), [frames, inspection.status, inspection.translations, masterName, scriptId, title]);

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

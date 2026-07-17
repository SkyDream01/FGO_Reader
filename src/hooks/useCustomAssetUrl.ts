import { useEffect, useMemo, useState } from "react";
import { getCustomScriptAssetBlob } from "../lib/customScripts";

interface UseCustomAssetUrlOptions {
  packageId?: string | null;
  assetPath?: string | null;
  fallbackUrl: string;
}

interface LocalAssetUrl {
  key: string;
  url: string;
}

/**
 * Resolves an optional package asset to a short-lived object URL. A mapped
 * asset deliberately holds Atlas back until its local lookup succeeds/fails,
 * so the package remains the true first-choice source.
 */
export function useCustomAssetUrl({
  packageId = null,
  assetPath = null,
  fallbackUrl,
}: UseCustomAssetUrlOptions) {
  const assetKey = useMemo(
    () => packageId && assetPath ? `${packageId}\u0000${assetPath}` : "",
    [assetPath, packageId],
  );
  const [localAsset, setLocalAsset] = useState<LocalAssetUrl>({ key: "", url: "" });
  const [failedAssetKey, setFailedAssetKey] = useState("");
  const [fallbackAssetKey, setFallbackAssetKey] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    if (!assetKey || !packageId || !assetPath) return undefined;

    getCustomScriptAssetBlob(packageId, assetPath)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setFailedAssetKey(assetKey);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setLocalAsset({ key: assetKey, url: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setFailedAssetKey(assetKey);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetKey, assetPath, packageId]);

  const localUrl = localAsset.key === assetKey ? localAsset.url : "";
  const preferFallback = fallbackAssetKey === assetKey;
  const localReadFailed = failedAssetKey === assetKey;
  const usingLocalAsset = Boolean(localUrl && !preferFallback);
  const loadingLocalAsset = Boolean(
    assetKey && !localUrl && !preferFallback && !localReadFailed,
  );

  return {
    url: usingLocalAsset ? localUrl : loadingLocalAsset ? "" : fallbackUrl,
    usingLocalAsset,
    loadingLocalAsset,
    useFallback: () => {
      if (assetKey) setFallbackAssetKey(assetKey);
    },
  };
}

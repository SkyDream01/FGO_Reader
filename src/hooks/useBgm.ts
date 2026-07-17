import { useEffect, useMemo, useRef, useState } from "react";
import { fallbackBgmUrl, getBgmCatalog } from "../data/atlas";
import type { BgmEntry, Region } from "../types";

type AudioStatus = "idle" | "locked" | "loading" | "playing" | "error";

interface UseBgmOptions {
  region: Region;
  fileName: string | null;
  localUrl?: string | null;
  localTitle?: string;
  localPending?: boolean;
  unlocked: boolean;
  muted: boolean;
  volume: number;
}

export function useBgm({
  region,
  fileName,
  localUrl = null,
  localTitle,
  localPending = false,
  unlocked,
  muted,
  volume,
}: UseBgmOptions) {
  const [catalog, setCatalog] = useState<BgmEntry[]>([]);
  const [status, setStatus] = useState<AudioStatus>(fileName ? "locked" : "idle");
  const [error, setError] = useState("");
  const [localFailed, setLocalFailed] = useState(false);
  const playersRef = useRef<HTMLAudioElement[]>([]);
  const currentPlayerRef = useRef(-1);
  const currentFileRef = useRef<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const fadeTokenRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getBgmCatalog(region)
      .then((entries) => !cancelled && setCatalog(entries))
      .catch(() => !cancelled && setCatalog([]));
    return () => {
      cancelled = true;
    };
  }, [region]);

  const catalogEntry = useMemo(
    () => catalog.find((entry) => entry.fileName === fileName),
    [catalog, fileName],
  );

  useEffect(() => {
    setLocalFailed(false);
  }, [fileName, localUrl]);

  useEffect(() => {
    const players = [new Audio(), new Audio()];
    for (const player of players) {
      player.loop = true;
      player.preload = "metadata";
    }
    playersRef.current = players;

    return () => {
      fadeTokenRef.current += 1;
      for (const player of players) {
        player.pause();
        player.removeAttribute("src");
        player.load();
      }
      playersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const players = playersRef.current;
    if (!players.length) return;

    const targetVolume = muted ? 0 : Math.max(0, Math.min(1, volume));
    const currentIndex = currentPlayerRef.current;
    if (currentIndex >= 0) players[currentIndex].volume = targetVolume;
  }, [muted, volume]);

  useEffect(() => {
    const players = playersRef.current;
    if (!players.length) return;

    if (!fileName) {
      const current = players[currentPlayerRef.current];
      currentFileRef.current = null;
      currentUrlRef.current = null;
      setStatus("idle");
      if (!current) return;
      const token = ++fadeTokenRef.current;
      const startVolume = current.volume;
      const startedAt = performance.now();
      const fade = (time: number) => {
        if (token !== fadeTokenRef.current) return;
        const progress = Math.max(0, Math.min(1, (time - startedAt) / 650));
        current.volume = startVolume * (1 - progress);
        if (progress < 1) requestAnimationFrame(fade);
        else current.pause();
      };
      requestAnimationFrame(fade);
      return;
    }

    if (localPending) {
      const current = players[currentPlayerRef.current];
      current?.pause();
      setStatus("loading");
      return;
    }

    if (!unlocked) {
      setStatus("locked");
      return;
    }

    const usingLocalAsset = Boolean(localUrl && !localFailed);
    const resolvedAudioUrl = usingLocalAsset
      ? localUrl!
      : catalogEntry?.audioAsset || fallbackBgmUrl(region, fileName);
    if (
      currentFileRef.current === fileName &&
      currentUrlRef.current === resolvedAudioUrl &&
      currentPlayerRef.current >= 0
    ) {
      const current = players[currentPlayerRef.current];
      current.volume = muted ? 0 : volume;
      if (current.paused) {
        current.play().then(() => setStatus("playing")).catch(() => setStatus("error"));
      }
      return;
    }

    const previousIndex = currentPlayerRef.current;
    const nextIndex = previousIndex === 0 ? 1 : 0;
    const previous = previousIndex >= 0 ? players[previousIndex] : null;
    const next = players[nextIndex];
    const targetVolume = muted ? 0 : Math.max(0, Math.min(1, volume));
    const audioUrl = resolvedAudioUrl;
    const token = ++fadeTokenRef.current;

    next.pause();
    next.src = audioUrl;
    next.currentTime = 0;
    next.volume = 0;
    currentPlayerRef.current = nextIndex;
    currentFileRef.current = fileName;
    currentUrlRef.current = audioUrl;
    setStatus("loading");
    setError("");

    next
      .play()
      .then(() => {
        if (token !== fadeTokenRef.current) return;
        setStatus("playing");
        const previousStart = previous?.volume ?? 0;
        const startedAt = performance.now();
        const fade = (time: number) => {
          if (token !== fadeTokenRef.current) return;
          const progress = Math.max(0, Math.min(1, (time - startedAt) / 900));
          next.volume = targetVolume * progress;
          if (previous) previous.volume = previousStart * (1 - progress);
          if (progress < 1) requestAnimationFrame(fade);
          else previous?.pause();
        };
        requestAnimationFrame(fade);
      })
      .catch((reason: unknown) => {
        if (token !== fadeTokenRef.current) return;
        if (usingLocalAsset) {
          setLocalFailed(true);
          return;
        }
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "BGM 播放失败");
      });
  }, [catalogEntry?.audioAsset, fileName, localFailed, localPending, localUrl, muted, region, unlocked, volume]);

  return {
    title: localUrl && !localFailed
      ? localTitle || fileName || "本地 BGM"
      : catalogEntry?.name || fileName || "无 BGM",
    status,
    error,
  };
}

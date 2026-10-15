import { useEffect, useMemo, useRef, useState } from "react";
import { fallbackBgmUrl, getBgmCatalog } from "../data/atlas";
import type { BgmEntry, Region } from "../types";

type AudioStatus = "idle" | "locked" | "loading" | "playing" | "error";
/** Owned by App so a next-story remount can retain the actual playback position. */
export class BgmPlaybackSession {
  enabled = true;
  players: HTMLAudioElement[] = [];
  currentIndex = -1;
  file: string | null = null;
  url: string | null = null;
  fadeToken = 0;
  volume = 1;
  clear(): void {
    this.fadeToken++;
    for (const player of this.players) { player.pause(); player.removeAttribute("src"); player.load(); }
    this.players = []; this.currentIndex = -1; this.file = this.url = null;
  }
}

interface UseBgmOptions {
  region: Region;
  fileName: string | null;
  localUrl?: string | null;
  localTitle?: string;
  localPending?: boolean;
  unlocked: boolean;
  muted: boolean;
  volume: number;
  fadeSeconds?: number;
  paused?: boolean;
  session?: BgmPlaybackSession;
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
  fadeSeconds = 0.9,
  paused = false,
  session,
}: UseBgmOptions) {
  const [catalog, setCatalog] = useState<BgmEntry[]>([]);
  const [status, setStatus] = useState<AudioStatus>(fileName ? "locked" : "idle");
  const [error, setError] = useState("");
  const [localFailed, setLocalFailed] = useState(false);
  const playback = useMemo(() => session ?? new BgmPlaybackSession(), [session]);
  playback.volume = volume;
  const playersRef = useMemo(() => ({ get current() { return playback.players; }, set current(value: HTMLAudioElement[]) { playback.players = value; } }), [playback]);
  const currentPlayerRef = useMemo(() => ({ get current() { return playback.currentIndex; }, set current(value: number) { playback.currentIndex = value; } }), [playback]);
  const currentFileRef = useMemo(() => ({ get current() { return playback.file; }, set current(value: string | null) { playback.file = value; } }), [playback]);
  const currentUrlRef = useMemo(() => ({ get current() { return playback.url; }, set current(value: string | null) { playback.url = value; } }), [playback]);
  const fadeTokenRef = useMemo(() => ({ get current() { return playback.fadeToken; }, set current(value: number) { playback.fadeToken = value; } }), [playback]);
  const mutedRef = useRef(muted), volumeRef = useRef(volume);
  mutedRef.current = muted; volumeRef.current = volume;
  useEffect(() => {
    for (const player of playersRef.current) {
      if (paused) player.pause();
      else if (unlocked && player.src && player === playersRef.current[currentPlayerRef.current]) void player.play().catch(() => undefined);
    }
  }, [paused, unlocked]);

  useEffect(() => {
    let cancelled = false;

    // The catalog is only needed to find an Atlas-specific audio asset. Avoid
    // fetching it for silent scenes and for BGM already supplied by a package.
    if (!fileName || localUrl || localPending) {
      return () => {
        cancelled = true;
      };
    }

    getBgmCatalog(region)
      .then((entries) => !cancelled && setCatalog(entries))
      .catch(() => !cancelled && setCatalog([]));
    return () => {
      cancelled = true;
    };
  }, [fileName, localPending, localUrl, region]);

  const catalogEntry = useMemo(
    () => catalog.find((entry) => entry.fileName === fileName),
    [catalog, fileName],
  );

  useEffect(() => {
    setLocalFailed(false);
  }, [fileName, localUrl]);

  useEffect(() => {
    const players = playback.players.length ? playback.players : [new Audio(), new Audio()];
    for (const player of players) {
      player.loop = true;
      player.preload = "metadata";
    }
    playersRef.current = players;

    return () => {
      fadeTokenRef.current += 1;
      if (!session || !playback.enabled) playback.clear();
    };
  }, [playback, session]);

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
        const progress = fadeSeconds <= 0 ? 1 : Math.max(0, Math.min(1, (time - startedAt) / (fadeSeconds * 1000)));
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

    if (!unlocked || paused) {
      setStatus("locked");
      return;
    }

    const usingLocalAsset = Boolean(localUrl && !localFailed);
    const resolvedAudioUrl = usingLocalAsset
      ? localUrl!
      : playback.file === fileName && playback.url ? playback.url : catalogEntry?.audioAsset || fallbackBgmUrl(region, fileName);
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
          const progress = fadeSeconds <= 0 ? 1 : Math.max(0, Math.min(1, (time - startedAt) / (fadeSeconds * 1000)));
          next.volume = (mutedRef.current ? 0 : volumeRef.current) * progress;
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
  }, [catalogEntry?.audioAsset, fileName, localFailed, localPending, localUrl, muted, region, unlocked, volume, fadeSeconds, paused]);

  return {
    title: localUrl && !localFailed
      ? localTitle || fileName || "本地 BGM"
      : catalogEntry?.name || fileName || "无 BGM",
    status,
    error,
  };
}

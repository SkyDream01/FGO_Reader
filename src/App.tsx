import { CircleAlert, LoaderCircle, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { LibraryView } from "./components/LibraryView";
import { ReaderView } from "./components/ReaderView";
import {
  createLastObservation,
  saveLastObservation,
} from "./lib/lastObservation";
import {
  prepareStory,
  type PreparedStory,
  type StoryPreparationProgress,
} from "./lib/storyPreparation";
import { getNextStoryLaunch } from "./lib/storyQueue";
import type { StoryLaunch } from "./types";

interface ActiveStory {
  launch: StoryLaunch;
  prepared: PreparedStory;
}

interface StoryPreloadState {
  story: StoryLaunch;
  progress: StoryPreparationProgress;
  error: string;
}

function currentMasterName() {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("fgo-reader-settings") || "{}",
    );
    if (
      typeof value === "object" &&
      value !== null &&
      "masterName" in value &&
      typeof value.masterName === "string" &&
      value.masterName.trim()
    ) {
      return value.masterName;
    }
  } catch {
    // Invalid settings fall back to the reader default.
  }
  return "御主";
}

export default function App() {
  const [activeStory, setActiveStory] = useState<ActiveStory | null>(null);
  const [preload, setPreload] = useState<StoryPreloadState | null>(null);
  const activeStoryRef = useRef<ActiveStory | null>(null);
  const preparationRef = useRef<{
    id: number;
    controller: AbortController;
  } | null>(null);
  const requestIdRef = useRef(0);
  const nextStory = activeStory
    ? getNextStoryLaunch(activeStory.launch)
    : null;

  const cancelPreload = useCallback(() => {
    requestIdRef.current += 1;
    preparationRef.current?.controller.abort();
    preparationRef.current = null;
    setPreload(null);
  }, []);

  const closeStory = useCallback(() => {
    cancelPreload();
    const previous = activeStoryRef.current;
    activeStoryRef.current = null;
    setActiveStory(null);
    if (previous) window.setTimeout(previous.prepared.dispose, 0);
  }, [cancelPreload]);

  const openStory = useCallback(async (story: StoryLaunch) => {
    preparationRef.current?.controller.abort();
    const controller = new AbortController();
    const id = ++requestIdRef.current;
    preparationRef.current = { id, controller };
    setPreload({
      story,
      progress: {
        phase: "script",
        completed: 0,
        total: 1,
        label: "正在读取剧情脚本",
      },
      error: "",
    });

    try {
      const prepared = await prepareStory(story, {
        signal: controller.signal,
        masterName: currentMasterName(),
        onProgress: (progress) => {
          if (requestIdRef.current !== id) return;
          setPreload((current) => current
            ? { ...current, progress }
            : current);
        },
      });
      if (requestIdRef.current !== id || controller.signal.aborted) {
        prepared.dispose();
        return;
      }

      const previous = activeStoryRef.current;
      const next = { launch: story, prepared };
      activeStoryRef.current = next;
      saveLastObservation(createLastObservation(story, prepared.startIndex));
      setActiveStory(next);
      setPreload(null);
      preparationRef.current = null;
      if (previous) window.setTimeout(previous.prepared.dispose, 0);
    } catch (reason) {
      if (requestIdRef.current !== id || controller.signal.aborted) return;
      preparationRef.current = null;
      setPreload((current) => current
        ? {
            ...current,
            error: reason instanceof Error
              ? reason.message
              : "剧情资源准备失败，请稍后重试。",
          }
        : current);
    }
  }, []);

  return (
    <div className="app-viewport">
      <div className="app-railwork" aria-hidden="true" />
      <main className="app-frame">
        {activeStory ? (
          <ReaderView
            key={`${activeStory.launch.scriptId}:${activeStory.launch.sequenceIndex ?? "direct"}`}
            story={activeStory.launch}
            prepared={activeStory.prepared}
            nextStory={nextStory}
            onNext={() => nextStory && openStory(nextStory)}
            onExit={closeStory}
          />
        ) : (
          <LibraryView onOpenStory={openStory} />
        )}
      </main>
      {preload && (
        <div
          className="reader-loading app-story-preload"
          role="status"
          aria-live="polite"
          onClick={(event) => event.stopPropagation()}
        >
          {preload.error ? (
            <div className="preload-error">
              <CircleAlert size={22} />
              <div>
                <strong>剧情准备失败</strong>
                <p>{preload.error}</p>
              </div>
              <div className="preload-error-actions">
                <button type="button" onClick={() => openStory(preload.story)}>
                  重试
                </button>
                <button type="button" onClick={cancelPreload}>
                  返回
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="preload-cancel"
                onClick={cancelPreload}
                aria-label="取消准备剧情"
              >
                <X size={18} />
              </button>
              <div className="loading-orbit">
                <span />
                <span />
                <LoaderCircle className="spin" />
              </div>
              <p>{preload.progress.label}</p>
              <small>
                {preload.progress.phase === "resources"
                  ? `${preload.progress.completed} / ${preload.progress.total} · `
                  : ""}
                {preload.story.scriptId}
              </small>
              <div className="preload-progress" aria-hidden="true">
                <span
                  style={{
                    width: preload.progress.total
                      ? `${(preload.progress.completed / preload.progress.total) * 100}%`
                      : "0%",
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

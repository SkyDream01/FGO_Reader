import { useState } from "react";
import { LibraryView } from "./components/LibraryView";
import { ReaderView } from "./components/ReaderView";
import {
  createLastObservation,
  saveLastObservation,
} from "./lib/lastObservation";
import { getNextStoryLaunch } from "./lib/storyQueue";
import { progressStorageKey } from "./lib/scriptParserVersion";
import type { StoryLaunch } from "./types";

export default function App() {
  const [activeStory, setActiveStory] = useState<StoryLaunch | null>(null);
  const nextStory = activeStory ? getNextStoryLaunch(activeStory) : null;
  const openStory = (story: StoryLaunch) => {
    const savedProgress = Number(
      localStorage.getItem(progressStorageKey(story.scriptId)),
    );
    const startIndex = story.startIndex ?? (
      Number.isInteger(savedProgress) && savedProgress >= 0 ? savedProgress : 0
    );
    saveLastObservation(createLastObservation(story, startIndex));
    setActiveStory(story);
  };

  return (
    <div className="app-viewport">
      <div className="app-railwork" aria-hidden="true" />
      <main className="app-frame">
        {activeStory ? (
          <ReaderView
            key={`${activeStory.scriptId}:${activeStory.sequenceIndex ?? "direct"}`}
            story={activeStory}
            nextStory={nextStory}
            onNext={() => nextStory && openStory(nextStory)}
            onExit={() => setActiveStory(null)}
          />
        ) : (
          <LibraryView onOpenStory={openStory} />
        )}
      </main>
    </div>
  );
}

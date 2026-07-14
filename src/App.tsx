import { useState } from "react";
import { LibraryView } from "./components/LibraryView";
import { ReaderView } from "./components/ReaderView";
import {
  createLastObservation,
  saveLastObservation,
} from "./lib/lastObservation";
import { getNextStoryLaunch } from "./lib/storyQueue";
import type { StoryLaunch } from "./types";

export default function App() {
  const [activeStory, setActiveStory] = useState<StoryLaunch | null>(null);
  const nextStory = activeStory ? getNextStoryLaunch(activeStory) : null;
  const openStory = (story: StoryLaunch) => {
    const savedProgress = Number(
      localStorage.getItem(`fgo-reader-progress:${story.scriptId}`),
    );
    const startIndex = story.startIndex ?? (
      Number.isInteger(savedProgress) && savedProgress >= 0 ? savedProgress : 0
    );
    saveLastObservation(createLastObservation(story, startIndex));
    setActiveStory(story);
  };

  return activeStory ? (
    <ReaderView
      key={`${activeStory.scriptId}:${activeStory.sequenceIndex ?? "direct"}`}
      story={activeStory}
      nextStory={nextStory}
      onNext={() => nextStory && openStory(nextStory)}
      onExit={() => setActiveStory(null)}
    />
  ) : (
    <LibraryView onOpenStory={openStory} />
  );
}

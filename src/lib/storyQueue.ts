import type {
  Region,
  StoryLaunch,
  StoryQuest,
  StorySequenceItem,
} from "../types";

export function buildStorySequence(
  quests: StoryQuest[],
  region: Region,
  subtitle: string,
): StorySequenceItem[] {
  return quests.flatMap((quest) =>
    quest.phaseScripts.flatMap((phase) =>
      phase.scripts.map((script) => ({
        region,
        scriptId: script.scriptId,
        scriptUrl: script.script,
        title: quest.name,
        subtitle,
      })),
    ),
  );
}

export function getNextStoryLaunch(story: StoryLaunch): StoryLaunch | null {
  if (!story.sequence || story.sequenceIndex === undefined) return null;
  const nextIndex = story.sequenceIndex + 1;
  const nextStory = story.sequence[nextIndex];
  if (!nextStory) return null;

  return {
    ...nextStory,
    startIndex: 0,
    choiceTrail: [],
    sequence: story.sequence,
    sequenceIndex: nextIndex,
  };
}

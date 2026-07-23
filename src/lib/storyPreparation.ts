import {
  backgroundUrl,
  characterTextureUrl,
  characterUrl,
  fallbackBgmUrl,
  getBgmCatalog,
  getCharacterFigureMetadata,
  getScriptText,
  offlineDemoScript,
} from "../data/atlas";
import {
  getCustomScriptAssetBlob,
  isCustomScriptUrl,
  loadCustomScriptByUrl,
  type CustomScriptAssetMappings,
  type CustomScriptPackageRecord,
} from "./customScripts";
import {
  clearChoiceTrail,
  replayChoiceTrail,
  validateChoiceTrail,
} from "./choiceTrail";
import { parseFgoScript } from "./scriptParser";
import {
  choiceTrailStorageKey,
  progressStorageKey,
} from "./scriptParserVersion";
import type {
  ChoiceTrail,
  ParsedScript,
  StoryFrame,
  StoryLaunch,
} from "../types";

const RESOURCE_TIMEOUT_MS = 20_000;
const RESOURCE_CONCURRENCY = 6;

export interface StoryResources {
  backgrounds: string[];
  characters: string[];
  bgm: string[];
}

export interface PreparedCustomPackage {
  id: string;
  translationAllowed: boolean;
  assets: CustomScriptAssetMappings;
  assetUrls: CustomScriptAssetMappings;
}

export interface PreparedStory {
  baseFrames: StoryFrame[];
  frames: StoryFrame[];
  choiceTrail: ChoiceTrail;
  startIndex: number;
  customPackage: PreparedCustomPackage | null;
  japaneseStoryLoaded: boolean;
  remoteTranslationEligible: boolean;
  loadNote: string;
  dispose: () => void;
}

export interface StoryPreparationProgress {
  phase: "script" | "resources";
  completed: number;
  total: number;
  label: string;
}

export interface PrepareStoryOptions {
  signal?: AbortSignal;
  masterName?: string;
  onProgress?: (progress: StoryPreparationProgress) => void;
}

export class StoryPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryPreparationError";
  }
}

interface ResourceTask {
  label: string;
  load: () => Promise<void>;
}

function abortError() {
  return new DOMException("剧情准备已取消", "AbortError");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

function parsePlayableStory(
  source: string,
  story: Pick<StoryLaunch, "scriptId" | "region">,
  masterName: string,
): ParsedScript {
  let parsed: ParsedScript;
  try {
    parsed = parseFgoScript(source, story.scriptId, {
      region: story.region,
      masterName,
    });
  } catch (reason) {
    throw new StoryPreparationError(
      `脚本解析失败：${reason instanceof Error ? reason.message : "解析器发生未知错误"}`,
    );
  }

  const fatal = parsed.diagnostics.find((diagnostic) => diagnostic.severity === "error");
  if (fatal) {
    throw new StoryPreparationError(
      `脚本解析失败：第 ${fatal.line} 行第 ${fatal.column} 列：${fatal.message}`,
    );
  }
  if (!parsed.frames.length) {
    throw new StoryPreparationError("脚本解析失败：脚本中没有可播放的对话");
  }
  return parsed;
}

function loadStoredChoiceTrail(scriptId: string): ChoiceTrail {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(choiceTrailStorageKey(scriptId)) || "[]",
    );
    return validateChoiceTrail(value) ? value : [];
  } catch {
    return [];
  }
}

export function collectStoryResources(frames: StoryFrame[]): StoryResources {
  const backgrounds = new Set<string>();
  const characters = new Set<string>();
  const bgm = new Set<string>();

  const visit = (storyFrames: StoryFrame[]) => {
    for (const frame of storyFrames) {
      if (frame.scene) backgrounds.add(frame.scene);
      if (frame.bgm) bgm.add(frame.bgm);
      for (const character of frame.characters) characters.add(character.id);
      if (frame.type === "choice") {
        for (const option of frame.options) visit(option.frames);
      }
    }
  };
  visit(frames);

  return {
    backgrounds: [...backgrounds],
    characters: [...characters],
    bgm: [...bgm],
  };
}

function withResourceTimeout<T>(
  operation: (finish: (result: T) => void, fail: (reason: unknown) => void) => () => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    throwIfAborted(signal);
    let settled = false;
    let cleanupOperation: () => void = () => undefined;

    const cleanup = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      cleanupOperation();
    };
    const finish = (result: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const fail = (reason: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(reason);
    };
    const onAbort = () => fail(abortError());
    const timer = window.setTimeout(
      () => fail(new Error("资源加载超时")),
      RESOURCE_TIMEOUT_MS,
    );
    signal?.addEventListener("abort", onAbort, { once: true });
    cleanupOperation = operation(finish, fail);
  });
}

function preloadImage(url: string, signal?: AbortSignal) {
  return withResourceTimeout<void>((finish, fail) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      image.decode().catch(() => undefined).finally(() => finish());
    };
    image.onerror = () => fail(new Error(`图片资源读取失败：${url}`));
    image.src = url;
    return () => {
      image.onload = null;
      image.onerror = null;
      if (!image.complete) image.src = "";
    };
  }, signal);
}

function preloadAudio(url: string, signal?: AbortSignal) {
  return withResourceTimeout<void>((finish, fail) => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.onloadeddata = () => finish();
    audio.onerror = () => fail(new Error(`音频资源读取失败：${url}`));
    audio.src = url;
    audio.load();
    return () => {
      audio.onloadeddata = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, signal);
}

function awaitResource<T>(promise: Promise<T>, signal?: AbortSignal) {
  return withResourceTimeout<T>((finish, fail) => {
    promise.then(finish, fail);
    return () => undefined;
  }, signal);
}

async function runResourceTasks(
  tasks: ResourceTask[],
  signal: AbortSignal | undefined,
  onProgress: PrepareStoryOptions["onProgress"],
) {
  let nextTask = 0;
  let completed = 0;
  let failures = 0;
  onProgress?.({
    phase: "resources",
    completed,
    total: tasks.length,
    label: tasks.length ? "正在预载剧情资源" : "剧情资源已就绪",
  });

  const worker = async () => {
    while (nextTask < tasks.length) {
      throwIfAborted(signal);
      const task = tasks[nextTask];
      nextTask += 1;
      try {
        await task.load();
      } catch (reason) {
        if (signal?.aborted) throw abortError();
        failures += 1;
      }
      completed += 1;
      onProgress?.({
        phase: "resources",
        completed,
        total: tasks.length,
        label: task.label,
      });
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(RESOURCE_CONCURRENCY, tasks.length) },
      () => worker(),
    ),
  );
  return failures;
}

function emptyAssetUrls(): CustomScriptAssetMappings {
  return { backgrounds: {}, characters: {}, bgm: {} };
}

async function prepareCustomAsset(
  record: CustomScriptPackageRecord,
  kind: keyof CustomScriptAssetMappings,
  resourceId: string,
  assetUrls: CustomScriptAssetMappings,
  objectUrls: string[],
  signal?: AbortSignal,
) {
  const assetPath = record.assets[kind][resourceId];
  if (!assetPath) return null;
  const blob = await getCustomScriptAssetBlob(record.id, assetPath);
  throwIfAborted(signal);
  if (!blob) throw new Error(`本地资源不存在：${assetPath}`);
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  assetUrls[kind][resourceId] = url;
  return url;
}

async function createResourceTasks(
  story: StoryLaunch,
  frames: StoryFrame[],
  customRecord: CustomScriptPackageRecord | null,
  assetUrls: CustomScriptAssetMappings,
  objectUrls: string[],
  signal?: AbortSignal,
) {
  const resources = collectStoryResources(frames);
  const bgmCatalog = resources.bgm.length
    ? await awaitResource(getBgmCatalog(story.region), signal).catch(() => [])
    : [];
  throwIfAborted(signal);
  const bgmByFile = new Map(bgmCatalog.map((entry) => [entry.fileName, entry]));
  const tasks: ResourceTask[] = [];

  for (const sceneId of resources.backgrounds) {
    tasks.push({
      label: `背景 ${sceneId}`,
      load: async () => {
        const localUrl = customRecord
          ? await prepareCustomAsset(
              customRecord,
              "backgrounds",
              sceneId,
              assetUrls,
              objectUrls,
              signal,
            )
          : null;
        await preloadImage(localUrl || backgroundUrl(story.region, sceneId), signal);
      },
    });
  }

  for (const characterId of resources.characters) {
    tasks.push({
      label: `立绘 ${characterId}`,
      load: async () => {
        const localUrl = customRecord
          ? await prepareCustomAsset(
              customRecord,
              "characters",
              characterId,
              assetUrls,
              objectUrls,
              signal,
            )
          : null;
        if (localUrl) {
          await preloadImage(localUrl, signal);
          return;
        }
        await preloadImage(characterUrl(story.region, characterId), signal);
        await Promise.allSettled([
          preloadImage(characterTextureUrl(story.region, characterId), signal),
          awaitResource(
            getCharacterFigureMetadata(story.region, characterId),
            signal,
          ),
        ]);
        throwIfAborted(signal);
      },
    });
  }

  for (const fileName of resources.bgm) {
    tasks.push({
      label: `BGM ${fileName}`,
      load: async () => {
        const localUrl = customRecord
          ? await prepareCustomAsset(
              customRecord,
              "bgm",
              fileName,
              assetUrls,
              objectUrls,
              signal,
            )
          : null;
        const entry = bgmByFile.get(fileName);
        await preloadAudio(
          localUrl || entry?.audioAsset || fallbackBgmUrl(story.region, fileName),
          signal,
        );
      },
    });
  }

  return tasks;
}

export async function prepareStory(
  story: StoryLaunch,
  {
    signal,
    masterName = "御主",
    onProgress,
  }: PrepareStoryOptions = {},
): Promise<PreparedStory> {
  const objectUrls: string[] = [];
  const dispose = () => {
    for (const url of objectUrls.splice(0)) URL.revokeObjectURL(url);
  };

  try {
    throwIfAborted(signal);
    onProgress?.({
      phase: "script",
      completed: 0,
      total: 1,
      label: "正在读取剧情脚本",
    });

    const customSource = isCustomScriptUrl(story.scriptUrl);
    let customRecord: CustomScriptPackageRecord | null = null;
    let parsed: ParsedScript;
    let loadNote = "";
    let offlineFallback = false;

    if (customSource) {
      customRecord = await loadCustomScriptByUrl(story.scriptUrl);
      throwIfAborted(signal);
      if (!customRecord) {
        throw new StoryPreparationError("无法打开本地资源包：资源包已不存在或已被删除");
      }
      parsed = parsePlayableStory(customRecord.scriptText, story, masterName);
    } else {
      try {
        const source = await getScriptText(
          story.scriptUrl,
          signal,
          story.region,
          story.scriptId,
        );
        throwIfAborted(signal);
        parsed = parsePlayableStory(source, story, masterName);
      } catch (reason) {
        if (signal?.aborted) throw abortError();
        if (reason instanceof StoryPreparationError) throw reason;
        parsed = parseFgoScript(offlineDemoScript, "offline-demo", {
          region: "CN",
          masterName,
        });
        offlineFallback = true;
        loadNote = `Atlas 数据暂时无法读取，已进入离线演示：${
          reason instanceof Error ? reason.message : "未知错误"
        }`;
      }
    }

    const restoredTrail = story.choiceTrail ?? loadStoredChoiceTrail(story.scriptId);
    const replayed = replayChoiceTrail(parsed.frames, restoredTrail);
    const savedProgress = Number(
      localStorage.getItem(progressStorageKey(story.scriptId)) || 0,
    );
    const startIndex = Math.max(
      0,
      Math.min(
        story.startIndex ?? savedProgress,
        Math.max(0, replayed.frames.length - 1),
      ),
    );
    onProgress?.({
      phase: "script",
      completed: 1,
      total: 1,
      label: "剧情脚本已展开",
    });

    const assetUrls = emptyAssetUrls();
    const tasks = await createResourceTasks(
      story,
      parsed.frames,
      customRecord,
      assetUrls,
      objectUrls,
      signal,
    );
    const failures = await runResourceTasks(tasks, signal, onProgress);
    throwIfAborted(signal);
    if (failures) {
      const preloadNote = `${failures} 项资源未能预载，播放时将继续尝试。`;
      loadNote = loadNote ? `${loadNote} ${preloadNote}` : preloadNote;
    }

    return {
      baseFrames: parsed.frames,
      frames: replayed.frames,
      choiceTrail: replayed.choiceTrail,
      startIndex,
      customPackage: customRecord
        ? {
            id: customRecord.id,
            translationAllowed: customRecord.translationAllowed,
            assets: customRecord.assets,
            assetUrls,
          }
        : null,
      japaneseStoryLoaded: story.region === "JP" && !offlineFallback,
      remoteTranslationEligible:
        story.region === "JP" &&
        !offlineFallback &&
        (!customSource || customRecord?.translationAllowed === true),
      loadNote,
      dispose,
    };
  } catch (reason) {
    dispose();
    throw reason;
  }
}

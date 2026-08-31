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
  validateChoiceTrail,
} from "./choiceTrail";
import { compileFgoScript } from "./scriptParser";
import {
  choiceTrailStorageKey,
  loadStoredFrameIndex,
  progressStorageKey,
} from "./scriptParserVersion";
import { retryAsync } from "./loadRetry";
import type { ScriptProgram, MessageRecord } from "../adv/instruction";
import type { TranslatableStep } from "./translation";
import type {
  ChoiceTrail,
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
  program: ScriptProgram;
  /** Full readable catalog in program order (manual translation source). */
  steps: TranslatableStep[];
  choiceTrail: ChoiceTrail;
  /** Instruction index to fast-forward to (docs/FGO_Story_Reader_Standard §7). */
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

/** The readable catalog, covering every branch of the compiled program. */
export function collectStorySteps(program: ScriptProgram): TranslatableStep[] {
  const steps: TranslatableStep[] = program.messageCatalog.map((record) => ({
    key: record.key,
    kind: "message" as const,
    speaker: record.speaker,
    text: record.text,
  }));
  for (const choice of program.choiceCatalog) {
    steps.push({
      key: choice.key,
      kind: "choice" as const,
      speaker: "CHOICE",
      text: "",
      optionLabels: choice.options.map((option) => option.label),
    });
  }
  // Keep the catalog in program order for stable template exports.
  steps.sort((left, right) => {
    const leftIndex = left.kind === "message"
      ? program.messageCatalog.find((record) => record.key === left.key)?.instructionIndex ?? Number.MAX_SAFE_INTEGER
      : program.choiceCatalog.find((choice) => choice.key === left.key)?.instructionIndex ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = right.kind === "message"
      ? program.messageCatalog.find((record) => record.key === right.key)?.instructionIndex ?? Number.MAX_SAFE_INTEGER
      : program.choiceCatalog.find((choice) => choice.key === right.key)?.instructionIndex ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
  return steps;
}

function compilePlayableStory(
  source: string,
  story: Pick<StoryLaunch, "scriptId" | "region">,
  masterName: string,
): ScriptProgram {
  let program: ScriptProgram;
  try {
    program = compileFgoScript(source, story.scriptId, {
      region: story.region,
      masterName,
    });
  } catch (reason) {
    throw new StoryPreparationError(
      `脚本解析失败：${reason instanceof Error ? reason.message : "解析器发生未知错误"}`,
    );
  }

  const fatal = program.diagnostics.find((diagnostic) => diagnostic.severity === "error");
  if (fatal) {
    throw new StoryPreparationError(
      `脚本解析失败：第 ${fatal.line} 行第 ${fatal.column} 列：${fatal.message}`,
    );
  }
  if (!program.messageCatalog.length) {
    throw new StoryPreparationError("脚本解析失败：脚本中没有可播放的对话");
  }
  return program;
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
  return retryAsync(
    () => withResourceTimeout<void>((finish, fail) => {
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
    }, signal),
    { signal },
  );
}

function preloadAudio(url: string, signal?: AbortSignal) {
  return retryAsync(
    () => withResourceTimeout<void>((finish, fail) => {
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
    }, signal),
    { signal },
  );
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

function createResourceTasks(
  story: StoryLaunch,
  program: ScriptProgram,
  bgmByFile: Map<string, { audioAsset?: string }>,
  customRecord: CustomScriptPackageRecord | null,
  assetUrls: CustomScriptAssetMappings,
  objectUrls: string[],
  signal?: AbortSignal,
): ResourceTask[] {
  const tasks: ResourceTask[] = [];

  for (const sceneId of program.sceneIds) {
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

  for (const characterId of program.characterIds) {
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

  for (const fileName of program.bgmNames) {
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
        await preloadAudio(
          localUrl || bgmByFile.get(fileName)?.audioAsset || fallbackBgmUrl(story.region, fileName),
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
    let program: ScriptProgram;
    let steps: TranslatableStep[];
    let loadNote = "";
    let offlineFallback = false;

    if (customSource) {
      customRecord = await loadCustomScriptByUrl(story.scriptUrl);
      throwIfAborted(signal);
      if (!customRecord) {
        throw new StoryPreparationError("无法打开本地资源包：资源包已不存在或已被删除");
      }
      program = compilePlayableStory(customRecord.scriptText, story, masterName);
    } else {
      try {
        const source = await getScriptText(
          story.scriptUrl,
          signal,
          story.region,
          story.scriptId,
        );
        throwIfAborted(signal);
        program = compilePlayableStory(source, story, masterName);
      } catch (reason) {
        if (signal?.aborted) throw abortError();
        if (reason instanceof StoryPreparationError) throw reason;
        program = compileFgoScript(offlineDemoScript, "offline-demo", {
          region: "JP",
          masterName,
        });
        offlineFallback = true;
        loadNote = `Atlas 数据暂时无法读取，已进入离线演示：${
          reason instanceof Error ? reason.message : "未知错误"
        }`;
      }
    }
    steps = collectStorySteps(program);

    const restoredTrail = story.choiceTrail ?? loadStoredChoiceTrail(story.scriptId);
    // Resume replays inside the executor; the stored cursor is clamped to the
    // compiled program for stale-progress safety.
    const savedProgress = loadStoredFrameIndex(progressStorageKey(story.scriptId));
    const startIndex = Math.max(
      0,
      Math.min(
        story.startIndex ?? savedProgress,
        Math.max(0, program.instructions.length - 1),
      ),
    );
    onProgress?.({
      phase: "script",
      completed: 1,
      total: 1,
      label: "剧情脚本已展开",
    });

    const bgmCatalog = program.bgmNames.length
      ? await awaitResource(getBgmCatalog(story.region), signal).catch(() => [])
      : [];
    throwIfAborted(signal);
    const bgmByFile = new Map(bgmCatalog.map((entry) => [entry.fileName, entry]));
    const assetUrls = emptyAssetUrls();
    const tasks = createResourceTasks(
      story,
      program,
      bgmByFile,
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
      program,
      steps,
      choiceTrail: restoredTrail,
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

export type { MessageRecord };

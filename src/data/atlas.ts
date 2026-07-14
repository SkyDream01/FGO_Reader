import type {
  BasicWar,
  BgmEntry,
  Region,
  ScriptSearchResult,
  StoryQuest,
  WarDetail,
} from "../types";

const EXPORT_ROOT = "https://api.atlasacademy.io/export";
const STATIC_ROOT = "https://static.atlasacademy.io";

const basicWarCache = new Map<Region, Promise<BasicWar[]>>();
const bgmCache = new Map<Region, Promise<BgmEntry[]>>();

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function getBasicWars(region: Region): Promise<BasicWar[]> {
  if (!basicWarCache.has(region)) {
    basicWarCache.set(
      region,
      fetchJson<BasicWar[]>(`${EXPORT_ROOT}/${region}/basic_war.json`),
    );
  }
  return basicWarCache.get(region)!;
}

export async function getWarDetail(
  region: Region,
  warId: number,
  signal?: AbortSignal,
): Promise<WarDetail> {
  return fetchJson<WarDetail>(`/atlas-api/nice/${region}/war/${warId}`, signal);
}

export function getBgmCatalog(region: Region): Promise<BgmEntry[]> {
  if (!bgmCache.has(region)) {
    bgmCache.set(
      region,
      fetchJson<BgmEntry[]>(`${EXPORT_ROOT}/${region}/nice_bgm.json`),
    );
  }
  return bgmCache.get(region)!;
}

export async function getScriptText(
  scriptUrl: string,
  signal?: AbortSignal,
  region?: Region,
  scriptId?: string,
) {
  const readResponse = async (url: string) => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`脚本读取失败 (${response.status})`);
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const metadata = (await response.json()) as { script?: string };
      if (!metadata.script) throw new Error("Atlas 未返回脚本正文地址");
      const scriptResponse = await fetch(metadata.script, { signal });
      if (!scriptResponse.ok) {
        throw new Error(`脚本正文读取失败 (${scriptResponse.status})`);
      }
      return scriptResponse.text();
    }
    return response.text();
  };

  try {
    return await readResponse(scriptUrl);
  } catch (error) {
    if (!region || !scriptId || scriptUrl.startsWith("/atlas-api/nice/")) throw error;
    return readResponse(`/atlas-api/nice/${region}/script/${scriptId}`);
  }
}

export async function searchScripts(
  region: Region,
  query: string,
  signal?: AbortSignal,
): Promise<ScriptSearchResult[]> {
  const params = new URLSearchParams({ query, limit: "24" });
  return fetchJson<ScriptSearchResult[]>(
    `/atlas-api/nice/${region}/script/search?${params.toString()}`,
    signal,
  );
}

export function scriptUrlFromId(region: Region, scriptId: string) {
  const normalized = scriptId.trim();
  return `/atlas-api/nice/${region}/script/${normalized}`;
}

export function backgroundUrl(region: Region, sceneId: string | null) {
  if (!sceneId) return "";
  return `${STATIC_ROOT}/${region}/Back/back${sceneId}.png`;
}

export function characterUrl(region: Region, characterId: string) {
  return `${STATIC_ROOT}/${region}/CharaFigure/${characterId}/${characterId}.png`;
}

export function fallbackBgmUrl(region: Region, fileName: string) {
  return `${STATIC_ROOT}/${region}/Audio/Bgm/${fileName}/${fileName}.mp3`;
}

export function flattenStoryQuests(war: WarDetail): StoryQuest[] {
  const quests = new Map<number, StoryQuest>();
  for (const spot of war.spots ?? []) {
    for (const quest of spot.quests ?? []) {
      if (quest.phaseScripts?.some((phase) => phase.scripts?.length)) {
        quests.set(quest.id, quest);
      }
    }
  }
  for (const selection of war.questSelections ?? []) {
    const quest = selection.quest;
    if (quest?.phaseScripts?.some((phase) => phase.scripts?.length)) {
      quests.set(quest.id, quest);
    }
  }
  return [...quests.values()].sort((a, b) => b.priority - a.priority);
}

export function stripSnippetHtml(value: string) {
  const documentFragment = document.createElement("div");
  documentFragment.innerHTML = value;
  return documentFragment.textContent ?? "";
}

export const offlineDemoScript = `
＄DEMO
[scene 10201]
[fadein black 0.8]
＠观测记录终端
灵子演算完成。[r]这里是离线演示记录。
[k]

＠玛修
前辈，Atlas Academy 暂时没有回应。[r]我们仍然可以确认阅读器的文字、选项和快捷键是否正常。
[k]

？1：继续观测
[charaTalk A]
＠观测记录终端
已记录你的选择。[r]网络恢复后，可从目录载入完整剧情。
[k]
？2：查看快捷键
＠观测记录终端
按下问号键可以随时打开快捷键总览。
[k]
？！

＠观测记录终端
离线演示结束。
[k]
`;

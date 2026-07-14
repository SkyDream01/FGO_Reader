import {
  BookMarked,
  ChevronRight,
  CircleAlert,
  Database,
  FileText,
  History,
  Library,
  LoaderCircle,
  Play,
  Radio,
  Search,
  Sparkles,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  flattenStoryQuests,
  getBasicWars,
  getWarDetail,
  scriptUrlFromId,
} from "../data/atlas";
import {
  lastObservationToLaunch,
  loadLastObservation,
} from "../lib/lastObservation";
import { buildStorySequence } from "../lib/storyQueue";
import type {
  BasicWar,
  Bookmark,
  LastObservation,
  Region,
  ScriptReference,
  StoryLaunch,
  StoryQuest,
  WarDetail,
} from "../types";

interface LibraryViewProps {
  onOpenStory: (story: StoryLaunch) => void;
}

const regionLabels: Record<Region, string> = {
  CN: "简中",
  JP: "日服",
  NA: "美服",
  TW: "繁中",
  KR: "韩服",
};

function getQuestCaption(quest: StoryQuest) {
  if (!quest.chapterId && !quest.chapterSubId) return quest.spotName;
  const chapter = quest.chapterId ? `第 ${quest.chapterId} 节` : "序章";
  const sub = quest.chapterSubId ? ` · ${quest.chapterSubId}` : "";
  return `${chapter}${sub}${quest.chapterSubStr ? ` ${quest.chapterSubStr}` : ""}`;
}

function getScripts(quest: StoryQuest | null) {
  if (!quest) return [];
  return quest.phaseScripts.flatMap((phase) =>
    phase.scripts.map((script) => ({ ...script, phase: phase.phase })),
  );
}

export function LibraryView({ onOpenStory }: LibraryViewProps) {
  const [region, setRegion] = useState<Region>("CN");
  const [category, setCategory] = useState<"main" | "event">("main");
  const [warQuery, setWarQuery] = useState("");
  const [wars, setWars] = useState<BasicWar[]>([]);
  const [activeWarId, setActiveWarId] = useState<number | null>(null);
  const [warDetail, setWarDetail] = useState<WarDetail | null>(null);
  const [selectedQuestId, setSelectedQuestId] = useState<number | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [showAllQuests, setShowAllQuests] = useState(false);
  const [directScriptId, setDirectScriptId] = useState("");
  const [loadingWars, setLoadingWars] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [lastObservation] = useState<LastObservation | null>(loadLastObservation);
  const [bookmark] = useState<Bookmark | null>(() => {
    try {
      const value = localStorage.getItem("fgo-reader-bookmark");
      return value ? (JSON.parse(value) as Bookmark) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let cancelled = false;
    setLoadingWars(true);
    setError("");
    setWars([]);
    setWarDetail(null);
    setActiveWarId(null);

    getBasicWars(region)
      .then((data) => {
        if (cancelled) return;
        setWars(data);
        const firstMain = data.find(
          (war) => war.flags.includes("mainScenario") && war.id < 10_000,
        );
        setActiveWarId(firstMain?.id ?? data[0]?.id ?? null);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "章节目录读取失败");
        }
      })
      .finally(() => !cancelled && setLoadingWars(false));

    return () => {
      cancelled = true;
    };
  }, [region]);

  const visibleWars = useMemo(() => {
    const query = warQuery.trim().toLocaleLowerCase();
    return wars
      .filter((war) => {
        const isMain = war.flags.includes("mainScenario") && war.id < 10_000;
        return category === "main"
          ? isMain
          : !isMain && war.flags.includes("isEvent");
      })
      .filter((war) =>
        query
          ? `${war.name} ${war.longName} ${war.eventName}`
              .toLocaleLowerCase()
              .includes(query)
          : true,
      )
      .slice(0, category === "event" && !query ? 180 : undefined);
  }, [category, warQuery, wars]);

  useEffect(() => {
    if (!visibleWars.length) return;
    if (!visibleWars.some((war) => war.id === activeWarId)) {
      setActiveWarId(visibleWars[0].id);
    }
  }, [activeWarId, visibleWars]);

  useEffect(() => {
    if (activeWarId === null) return;
    const controller = new AbortController();
    setLoadingDetail(true);
    setWarDetail(null);
    setSelectedQuestId(null);
    setSelectedScriptId(null);
    setError("");

    getWarDetail(region, activeWarId, controller.signal)
      .then((detail) => setWarDetail(detail))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "章节详情读取失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDetail(false);
      });

    return () => controller.abort();
  }, [activeWarId, region]);

  const allQuests = useMemo(
    () => (warDetail ? flattenStoryQuests(warDetail) : []),
    [warDetail],
  );
  const quests = useMemo(
    () =>
      showAllQuests
        ? allQuests.filter((quest) => quest.type !== "free")
        : allQuests.filter((quest) => quest.type === "main"),
    [allQuests, showAllQuests],
  );

  useEffect(() => {
    if (!quests.length) return;
    if (!quests.some((quest) => quest.id === selectedQuestId)) {
      setSelectedQuestId(quests[0].id);
    }
  }, [quests, selectedQuestId]);

  const selectedQuest =
    quests.find((quest) => quest.id === selectedQuestId) ?? null;
  const scripts = useMemo(() => getScripts(selectedQuest), [selectedQuest]);

  useEffect(() => {
    if (!scripts.length) return;
    if (!scripts.some((script) => script.scriptId === selectedScriptId)) {
      setSelectedScriptId(scripts[0].scriptId);
    }
  }, [scripts, selectedScriptId]);

  const selectedScript =
    scripts.find((script) => script.scriptId === selectedScriptId) ?? null;
  const selectedProgress = useMemo(() => {
    if (!selectedScript) return 0;
    const value = Number(
      localStorage.getItem(`fgo-reader-progress:${selectedScript.scriptId}`),
    );
    return Number.isInteger(value) && value > 0 ? value : 0;
  }, [selectedScript]);
  const scriptCount = allQuests.reduce(
    (total, quest) => total + getScripts(quest).length,
    0,
  );
  const storySequence = useMemo(
    () =>
      warDetail
        ? buildStorySequence(quests, region, warDetail.longName)
        : [],
    [quests, region, warDetail],
  );

  const openSelectedScript = () => {
    if (!selectedScript || !selectedQuest || !warDetail) return;
    const sequenceIndex = storySequence.findIndex(
      (item) => item.scriptId === selectedScript.scriptId,
    );
    onOpenStory({
      region,
      scriptId: selectedScript.scriptId,
      scriptUrl: selectedScript.script,
      title: selectedQuest.name,
      subtitle: warDetail.longName,
      ...(sequenceIndex >= 0
        ? { sequence: storySequence, sequenceIndex }
        : {}),
    });
  };

  const submitDirectScript = (event: FormEvent) => {
    event.preventDefault();
    const scriptId = directScriptId.trim();
    if (!/^\d{6,14}$/.test(scriptId)) {
      setError("请输入 6–14 位数字脚本 ID");
      return;
    }
    onOpenStory({
      region,
      scriptId,
      scriptUrl: scriptUrlFromId(region, scriptId),
      title: `脚本 ${scriptId}`,
      subtitle: `${regionLabels[region]} · 直接读取`,
    });
  };

  const activeWar = wars.find((war) => war.id === activeWarId);
  const bookmarkDuplicatesLast = Boolean(
    bookmark &&
      lastObservation &&
      bookmark.region === lastObservation.region &&
      bookmark.scriptId === lastObservation.scriptId &&
      bookmark.frameIndex === lastObservation.frameIndex,
  );

  return (
    <div className="library-screen">
      <div className="library-ambient" aria-hidden="true" />
      <header className="archive-header">
        <div className="archive-brand">
          <div className="brand-sigil" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p>OBSERVATION ARCHIVE</p>
            <h1>CHRONICLE <span>// 剧情阅读器</span></h1>
          </div>
        </div>
        <div className="header-status">
          <span><Radio size={14} /> Atlas Academy</span>
          <label className="region-select">
            <span>数据区域</span>
            <select value={region} onChange={(event) => setRegion(event.target.value as Region)}>
              {Object.entries(regionLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error && (
        <button className="error-banner" onClick={() => setError("")}>
          <CircleAlert size={17} />
          <span>{error}</span>
          <small>点击关闭</small>
        </button>
      )}

      <main className="archive-grid">
        <aside className="war-rail panel-surface">
          <div className="rail-heading">
            <div>
              <p className="eyebrow">RECORD INDEX</p>
              <h2>观测目录</h2>
            </div>
            <Library size={19} />
          </div>

          <div className="segmented-control" aria-label="章节分类">
            <button className={category === "main" ? "active" : ""} onClick={() => setCategory("main")}>主线记录</button>
            <button className={category === "event" ? "active" : ""} onClick={() => setCategory("event")}>活动记录</button>
          </div>

          <label className="search-field">
            <Search size={16} />
            <input
              value={warQuery}
              onChange={(event) => setWarQuery(event.target.value)}
              placeholder={category === "main" ? "搜索章节" : "搜索活动名称"}
            />
          </label>

          <div className="war-list" role="listbox" aria-label="章节列表">
            {loadingWars ? (
              <div className="loading-block"><LoaderCircle className="spin" /> 正在同步目录</div>
            ) : visibleWars.length ? (
              visibleWars.map((war) => (
                <button
                  key={war.id}
                  className={`war-row ${activeWarId === war.id ? "active" : ""}`}
                  onClick={() => setActiveWarId(war.id)}
                  role="option"
                  aria-selected={activeWarId === war.id}
                >
                  <span className="war-index">{String(war.id).padStart(4, "0")}</span>
                  <span className="war-copy">
                    <strong>{war.name || war.eventName || "未命名记录"}</strong>
                    <small>{war.longName.replace(/\n/g, " · ")}</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))
            ) : (
              <div className="empty-block">没有匹配的记录</div>
            )}
          </div>

          <form className="direct-script" onSubmit={submitDirectScript}>
            <p><FileText size={14} /> 按脚本 ID 读取</p>
            <div>
              <input
                inputMode="numeric"
                value={directScriptId}
                onChange={(event) => setDirectScriptId(event.target.value)}
                placeholder="例：0100000010"
              />
              <button aria-label="读取脚本"><ChevronRight size={17} /></button>
            </div>
          </form>
        </aside>

        <section className="quest-panel panel-surface">
          <div className="war-hero">
            {(warDetail?.headerImage || warDetail?.banner) && (
              <img src={warDetail.headerImage || warDetail.banner} alt="" />
            )}
            <div className="hero-grid" aria-hidden="true" />
            <div className="hero-content">
              <div className="hero-code"><Database size={14} /> WAR {activeWar?.id ?? "----"}</div>
              <p>{activeWar?.age || "OBSERVATION RECORD"}</p>
              <h2>
                {(warDetail?.longName || activeWar?.longName || "选择观测记录")
                  .split("\n")
                  .map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
              </h2>
              <div className="hero-metrics">
                <span><strong>{allQuests.length}</strong> 剧情节点</span>
                <span><strong>{scriptCount}</strong> 脚本片段</span>
                <span><strong>{regionLabels[region]}</strong> 数据</span>
              </div>
            </div>
          </div>

          <div className="quest-heading">
            <div>
              <p className="eyebrow">SEQUENCE SELECT</p>
              <h3>选择剧情节点</h3>
            </div>
            <div className="quest-filter">
              <button className={!showAllQuests ? "active" : ""} onClick={() => setShowAllQuests(false)}>主线</button>
              <button className={showAllQuests ? "active" : ""} onClick={() => setShowAllQuests(true)}>全部剧情</button>
            </div>
          </div>

          <div className="quest-list">
            {loadingDetail ? (
              <div className="loading-block large"><LoaderCircle className="spin" /> 正在解算章节记录</div>
            ) : quests.length ? (
              quests.map((quest, index) => (
                <button
                  key={quest.id}
                  className={`quest-row ${selectedQuestId === quest.id ? "active" : ""}`}
                  onClick={() => setSelectedQuestId(quest.id)}
                >
                  <span className="quest-order">{String(index + 1).padStart(2, "0")}</span>
                  <span className="quest-main">
                    <small>{getQuestCaption(quest)}</small>
                    <strong>{quest.name}</strong>
                    <em>{quest.spotName}</em>
                  </span>
                  <span className="quest-script-count">{getScripts(quest).length} FILES</span>
                  <ChevronRight size={17} />
                </button>
              ))
            ) : (
              <div className="empty-block large">
                <Sparkles size={20} />
                当前筛选下没有可读取的剧情脚本
              </div>
            )}
          </div>
        </section>

        <aside className="launch-panel panel-surface">
          <div className="launch-overview">
            <div className="launch-heading">
              <p className="eyebrow">PLAYBACK QUEUE</p>
              <h2>播放队列</h2>
            </div>

            <div className="resume-stack">
              {lastObservation ? (
                <button
                  className="resume-card"
                  onClick={() => onOpenStory(lastObservationToLaunch(lastObservation))}
                >
                  <History size={18} />
                  <span>
                    <small>继续上次观测</small>
                    <strong>{lastObservation.title}</strong>
                    <em>
                      {regionLabels[lastObservation.region]} · 记录点 {lastObservation.frameIndex + 1}
                    </em>
                  </span>
                  <Play size={16} fill="currentColor" />
                </button>
              ) : (
                <div className="resume-empty" role="status">
                  <History size={18} />
                  <span>
                    <small>继续观测</small>
                    <strong>暂无可继续的记录</strong>
                    <em>开始任意剧情后将自动保存</em>
                  </span>
                </div>
              )}

              {bookmark && !bookmarkDuplicatesLast && (
                <button
                  className="resume-card bookmark-card"
                  onClick={() =>
                    onOpenStory({
                      region: bookmark.region,
                      scriptId: bookmark.scriptId,
                      scriptUrl: bookmark.scriptUrl,
                      title: bookmark.title,
                      subtitle: bookmark.subtitle || "已保存的观测点",
                      startIndex: bookmark.frameIndex,
                      sequence: bookmark.sequence,
                      sequenceIndex: bookmark.sequenceIndex,
                    })
                  }
                >
                  <BookMarked size={18} />
                  <span>
                    <small>读取手动书签</small>
                    <strong>{bookmark.title}</strong>
                    <em>记录点 {bookmark.frameIndex + 1}</em>
                  </span>
                  <Play size={16} fill="currentColor" />
                </button>
              )}
            </div>
          </div>

          <div className="selected-record">
            <div className="record-orbit" aria-hidden="true">
              <span /><span /><span />
              <i>{selectedScript ? "READY" : "IDLE"}</i>
            </div>
            <p>{selectedQuest ? getQuestCaption(selectedQuest) : "尚未选择节点"}</p>
            <h3>{selectedQuest?.name || "等待观测目标"}</h3>
            <span>{warDetail?.longName.replace(/\n/g, " / ") || "从左侧目录选择章节"}</span>
          </div>

          <div className="script-stack">
            <div className="stack-label">
              <span>脚本片段</span>
              <small>{scripts.length} 条</small>
            </div>
            <div className="script-options">
              {scripts.map((script) => (
                <button
                  key={script.scriptId}
                  className={selectedScriptId === script.scriptId ? "active" : ""}
                  onClick={() => setSelectedScriptId(script.scriptId)}
                >
                  <span>PHASE {script.phase}</span>
                  <strong>{script.scriptId}</strong>
                  <ChevronRight size={15} />
                </button>
              ))}
              {!scripts.length && <div className="empty-script">NO SCRIPT SELECTED</div>}
            </div>
          </div>

          <button className="launch-button" onClick={openSelectedScript} disabled={!selectedScript}>
            <span>
              <Play size={19} fill="currentColor" />
              {selectedProgress > 0 ? "继续观测" : "开始观测"}
            </span>
            <small>
              {selectedProgress > 0
                ? `RESUME FROM LOG ${String(selectedProgress + 1).padStart(3, "0")}`
                : "ENTER STORY MODE"}
            </small>
          </button>

          <div className="source-note">
            <BookMarked size={15} />
            <p>
              剧情与媒体资源由 Atlas Academy 提供索引。该项目为非官方阅读工具，资源权利归原权利方所有。
            </p>
          </div>
        </aside>
      </main>

      <footer className="archive-footer">
        <span>CHRONICLE ENGINE / 0.1</span>
        <span>首次播放声音需要一次用户操作</span>
        <span>DATA: ATLAS ACADEMY</span>
      </footer>
    </div>
  );
}

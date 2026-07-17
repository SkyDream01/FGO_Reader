import {
  BookMarked,
  BookOpen,
  ChevronRight,
  CircleAlert,
  Database,
  FileText,
  HardDrive,
  History,
  Library,
  LoaderCircle,
  Play,
  Radio,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  flattenStoryQuests,
  getBasicWars,
  getWarDetail,
  scriptUrlFromId,
} from "../data/atlas";
import {
  clearLastObservation,
  lastObservationToLaunch,
  loadLastObservation,
} from "../lib/lastObservation";
import {
  customScriptUrl,
  deleteCustomScriptPackage,
  listCustomScriptPackages,
  parseCustomScriptArchive,
  saveCustomScriptPackage,
  setCustomScriptTranslationAllowed,
  type CustomScriptArchivePreview,
  type CustomScriptPackageSummary,
} from "../lib/customScripts";
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

type CustomLibraryPanel = "none" | "library" | "preview";

function customPackageLaunch(
  record: CustomScriptPackageSummary,
  restart = false,
): StoryLaunch {
  return {
    region: record.region,
    scriptId: record.scriptId,
    scriptUrl: customScriptUrl(record.id),
    title: record.title,
    subtitle: `本地资源包 · ${regionLabels[record.region]}`,
    ...(restart ? { startIndex: 0, choiceTrail: [] } : {}),
  };
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function customPackageProgress(scriptId: string) {
  const value = Number(localStorage.getItem(`fgo-reader-progress:${scriptId}`));
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function sameChoiceTrail(
  left: StoryLaunch["choiceTrail"],
  right: StoryLaunch["choiceTrail"],
) {
  const normalizedLeft = left ?? [];
  const normalizedRight = right ?? [];
  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every(
    (decision, index) =>
      decision.choiceId === normalizedRight[index]?.choiceId &&
      decision.optionIndex === normalizedRight[index]?.optionIndex,
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
  const [lastObservation, setLastObservation] = useState<LastObservation | null>(loadLastObservation);
  const [bookmark, setBookmark] = useState<Bookmark | null>(() => {
    try {
      const value = localStorage.getItem("fgo-reader-bookmark");
      return value ? (JSON.parse(value) as Bookmark) : null;
    } catch {
      return null;
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customPackages, setCustomPackages] = useState<CustomScriptPackageSummary[]>([]);
  const [customPanel, setCustomPanel] = useState<CustomLibraryPanel>("none");
  const [importPreview, setImportPreview] = useState<CustomScriptArchivePreview | null>(null);
  const [importTranslationAllowed, setImportTranslationAllowed] = useState(false);
  const [importingPackage, setImportingPackage] = useState(false);

  const refreshCustomPackages = useCallback(async () => {
    try {
      setCustomPackages(await listCustomScriptPackages());
    } catch (reason) {
      setError(reason instanceof Error ? `无法读取本地脚本库：${reason.message}` : "无法读取本地脚本库");
    }
  }, []);

  useEffect(() => {
    void refreshCustomPackages();
  }, [refreshCustomPackages]);

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

  const openSelectedScript = (startIndex?: number) => {
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
      ...(startIndex === undefined ? {} : { startIndex }),
      ...(startIndex === 0 ? { choiceTrail: [] } : {}),
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

  const beginImport = () => {
    setError("");
    setImportPreview(null);
    setImportTranslationAllowed(false);
    fileInputRef.current?.click();
  };

  const closeCustomPanel = () => {
    if (importingPackage) return;
    setCustomPanel("none");
    setImportPreview(null);
    setImportTranslationAllowed(false);
  };

  const selectPackage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportingPackage(true);
    setError("");
    try {
      const preview = await parseCustomScriptArchive(file);
      setImportPreview(preview);
      setImportTranslationAllowed(false);
      setCustomPanel("preview");
    } catch (reason) {
      setError(reason instanceof Error ? `导入失败：${reason.message}` : "导入资源包失败");
    } finally {
      setImportingPackage(false);
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setImportingPackage(true);
    try {
      let record = await saveCustomScriptPackage({
        ...importPreview,
        record: {
          ...importPreview.record,
          translationAllowed: importPreview.record.region === "JP" && importTranslationAllowed,
        },
      });
      if (
        record.region === "JP" &&
        record.translationAllowed !== importTranslationAllowed
      ) {
        record = await setCustomScriptTranslationAllowed(
          record.id,
          importTranslationAllowed,
        ) ?? record;
      }
      await refreshCustomPackages();
      setImportPreview(null);
      setCustomPanel("none");
      onOpenStory(customPackageLaunch(record));
    } catch (reason) {
      setError(reason instanceof Error ? `无法保存资源包：${reason.message}` : "无法保存资源包");
    } finally {
      setImportingPackage(false);
    }
  };

  const deleteCustomPackage = async (record: CustomScriptPackageSummary) => {
    if (!window.confirm(`删除「${record.title}」及其本地资源？此操作不会影响 Atlas 剧情。`)) return;
    try {
      await deleteCustomScriptPackage(record.id);
      localStorage.removeItem(`fgo-reader-progress:${record.scriptId}`);
      localStorage.removeItem(`fgo-reader-read:${record.scriptId}`);
      localStorage.removeItem(`fgo-reader-choice-trail:${record.scriptId}`);
      if (lastObservation?.scriptUrl === customScriptUrl(record.id)) {
        clearLastObservation();
        setLastObservation(null);
      }
      if (bookmark?.scriptUrl === customScriptUrl(record.id)) {
        localStorage.removeItem("fgo-reader-bookmark");
        setBookmark(null);
      }
      await refreshCustomPackages();
    } catch (reason) {
      setError(reason instanceof Error ? `无法删除资源包：${reason.message}` : "无法删除资源包");
    }
  };

  const toggleCustomTranslation = async (record: CustomScriptPackageSummary, allowed: boolean) => {
    try {
      await setCustomScriptTranslationAllowed(record.id, allowed);
      await refreshCustomPackages();
    } catch (reason) {
      setError(reason instanceof Error ? `无法更新翻译授权：${reason.message}` : "无法更新翻译授权");
    }
  };

  const activeWar = wars.find((war) => war.id === activeWarId);
  const bookmarkDuplicatesLast = Boolean(
    bookmark &&
      lastObservation &&
      bookmark.region === lastObservation.region &&
      bookmark.scriptId === lastObservation.scriptId &&
      bookmark.frameIndex === lastObservation.frameIndex &&
      sameChoiceTrail(bookmark.choiceTrail, lastObservation.choiceTrail),
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

          <section className="custom-script-tools" aria-label="自定义脚本">
            <div className="custom-script-heading">
              <span><HardDrive size={14} /> 本地脚本库</span>
              <small>{customPackages.length} PACKAGES</small>
            </div>
            <input
              ref={fileInputRef}
              className="custom-file-input"
              type="file"
              accept=".zip,application/zip"
              onChange={selectPackage}
            />
            <button type="button" className="custom-import-button" onClick={beginImport} disabled={importingPackage}>
              {importingPackage ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />}
              <span>{importingPackage ? "正在校验资源包" : "导入 ZIP 资源包"}</span>
            </button>
            <div className="custom-script-actions">
              <button type="button" onClick={() => setCustomPanel("library")}>
                <Library size={14} /> 浏览脚本库
              </button>
              <a
                href="https://github.com/SkyDream01/FGO_Reader/blob/main/docs/custom-scripts.md"
                target="_blank"
                rel="noreferrer"
              >
                <BookOpen size={14} /> 制作指南
              </a>
            </div>
          </section>
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
                      choiceTrail: bookmark.choiceTrail,
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

          <div className="launch-actions">
            {selectedProgress > 0 && (
              <button
                className="launch-button restart-button"
                onClick={() => openSelectedScript(0)}
                disabled={!selectedScript}
              >
                <span className="launch-action-icon" aria-hidden="true">
                  <RotateCcw size={18} />
                </span>
                <span className="launch-action-copy">
                  <strong>重新观测</strong>
                  <small>从 LOG 001 开始</small>
                </span>
              </button>
            )}
            <button
              className="launch-button resume-button"
              onClick={() => openSelectedScript()}
              disabled={!selectedScript}
            >
              <span className="launch-action-icon" aria-hidden="true">
                <Play size={19} fill="currentColor" />
              </span>
              <span className="launch-action-copy">
                <strong>{selectedProgress > 0 ? "继续观测" : "开始观测"}</strong>
                <small>
                  {selectedProgress > 0
                    ? `从 LOG ${String(selectedProgress + 1).padStart(3, "0")} 继续`
                    : "从 LOG 001 开始"}
                </small>
              </span>
            </button>
          </div>

          <div className="source-note">
            <BookMarked size={15} />
            <p>
              剧情与媒体资源由 Atlas Academy 提供索引。该项目为非官方阅读工具，资源权利归原权利方所有。
            </p>
          </div>
        </aside>
      </main>

      {customPanel !== "none" && (
        <div
          className="custom-library-backdrop"
          role="presentation"
          onMouseDown={closeCustomPanel}
        >
          <section
            className="custom-library-modal"
            role="dialog"
            aria-modal="true"
            aria-label={customPanel === "preview" ? "导入自定义资源包" : "本地脚本库"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="custom-library-header">
              <div>
                <p className="eyebrow">LOCAL OBSERVATION ARCHIVE</p>
                <h2>{customPanel === "preview" ? "确认导入资源包" : "本地脚本库"}</h2>
              </div>
              <button type="button" onClick={closeCustomPanel} disabled={importingPackage} aria-label="关闭">
                <X size={19} />
              </button>
            </header>

            {customPanel === "preview" && importPreview && (
              <div className="custom-import-preview">
                <div className="custom-import-seal" aria-hidden="true">
                  <Upload size={28} />
                  <span>ZIP</span>
                </div>
                <div className="custom-import-title">
                  <small>{importPreview.record.archiveName}</small>
                  <h3>{importPreview.record.title}</h3>
                  <p>{importPreview.record.description || "未提供简介"}</p>
                  <em>{regionLabels[importPreview.record.region]} · {importPreview.record.author || "未署名"}</em>
                </div>

                <div className="custom-import-metrics">
                  <span><strong>{importPreview.record.preview.frameCount}</strong> LOGS</span>
                  <span><strong>{importPreview.record.preview.choiceCount}</strong> CHOICES</span>
                  <span><strong>{Object.keys(importPreview.record.assets.backgrounds).length + Object.keys(importPreview.record.assets.characters).length + Object.keys(importPreview.record.assets.bgm).length}</strong> ASSETS</span>
                  <span><strong>{formatBytes(importPreview.record.byteSize)}</strong> SIZE</span>
                </div>

                {importPreview.record.region === "JP" && (
                  <label className="custom-translation-consent">
                    <input
                      type="checkbox"
                      checked={importTranslationAllowed}
                      onChange={(event) => setImportTranslationAllowed(event.target.checked)}
                    />
                    <i />
                    <span>
                      <strong>允许此脚本使用翻译服务</strong>
                      <small>开启译文模式后，文本会发送给你已配置的翻译后端。</small>
                    </span>
                  </label>
                )}

                <p className="custom-import-note">
                  脚本与本地资源保存在当前浏览器；未映射的场景、立绘和 BGM 将按包内区服从 Atlas 读取。
                </p>
                <div className="custom-modal-actions">
                  <button type="button" onClick={closeCustomPanel} disabled={importingPackage}>取消</button>
                  <button type="button" className="primary" onClick={confirmImport} disabled={importingPackage}>
                    {importingPackage ? <LoaderCircle className="spin" size={15} /> : <Play size={15} fill="currentColor" />}
                    导入并开始观测
                  </button>
                </div>
              </div>
            )}

            {customPanel === "library" && (
              <div className="custom-package-list">
                {customPackages.length ? customPackages.map((record) => {
                  const progress = customPackageProgress(record.scriptId);
                  return (
                    <article className="custom-package-row" key={record.id}>
                      <div className="custom-package-mark"><HardDrive size={18} /></div>
                      <div className="custom-package-copy">
                        <small>{regionLabels[record.region]} · {formatBytes(record.byteSize)} · {record.archiveName}</small>
                        <strong>{record.title}</strong>
                        <em>{record.author || "未署名"}{record.description ? ` · ${record.description}` : ""}</em>
                      </div>
                      <div className="custom-package-controls">
                        {record.region === "JP" && (
                          <label title="允许使用翻译服务">
                            <input
                              type="checkbox"
                              checked={record.translationAllowed}
                              onChange={(event) => void toggleCustomTranslation(record, event.target.checked)}
                            />
                            <span>译文</span>
                          </label>
                        )}
                        <button type="button" onClick={() => onOpenStory(customPackageLaunch(record, true))} title="从头开始">
                          <RotateCcw size={15} />
                        </button>
                        <button type="button" className="custom-open-button" onClick={() => onOpenStory(customPackageLaunch(record))}>
                          <Play size={15} fill="currentColor" /> {progress > 0 ? "继续" : "开始"}
                        </button>
                        <button type="button" className="danger" onClick={() => void deleteCustomPackage(record)} title="删除资源包">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  );
                }) : (
                  <div className="custom-package-empty">
                    <HardDrive size={24} />
                    <strong>脚本库为空</strong>
                    <p>导入一个 ZIP 资源包后，它会保存在这个浏览器中。</p>
                    <button type="button" onClick={() => { closeCustomPanel(); beginImport(); }}>
                      <Upload size={15} /> 导入第一个资源包
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <footer className="archive-footer">
        <span>CHRONICLE ENGINE / 0.1</span>
        <span>首次播放声音需要一次用户操作</span>
        <span>DATA: ATLAS ACADEMY</span>
      </footer>
    </div>
  );
}

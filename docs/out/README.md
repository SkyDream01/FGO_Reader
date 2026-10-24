# FGO 剧情阅读器 — 逆向结论总览

本目录由项目作者整理、撰写或制作的逆向研究文档、证据说明、命令/参数表和结构化数据，按仓库根目录 [AGPL-3.0-only 许可证](../../LICENSE) 发布。再发布这些原创资料的修改版或其衍生作品时，须遵守该许可证并提供可修改的源格式。许可证仅覆盖项目作者有权许可的原创表达，不覆盖 FGO 原始内容、第三方代码或仅属事实的信息。

> ⚠️ **2026-10-14 覆盖度核查**:拿到真实剧本语料(33 章 2,583 个 `.txt`)后发现本文部分结论有误,
> 已产出补充卷与核查报告 —— **先读 `coverage-verification.md`**。三处最关键的更正:
> ①行语法是 `[tag args]`(整行方括号),不是 `<tag> [参数...]`;②消息体是**纯文本行 + `＠` 说话人行 + `[k]`**,
> 真实语料中 `message2`/`message3`/`talkName`/`page` **0 次**;③`＠`/`＄`/`＃`/`？`/`？！` 等控制符来自 APK 内置
> 本地化表 `LocalizationJpn`(`data.unity3d`),已实证(见 `_evidence/marker-table.md`)。
> 补充卷:`supplement-script-format.md` / `supplement-command-coverage.md` / `supplement-markup.md` /
> `supplement-presentation-composition.md`。

目标:为"剧情阅读器"提供所需信息 —— 脚本解析、脚本代码解释、动画效果、画面构建。
对象:`Fate/Grand Order` Android **2.139.3**(`com.aniplex.fategrandorder`,XAPK,arm64)。
所有结论都带**二进制证据地址**(`VA` = `libil2cpp.so` 虚拟地址);未能证实的部分明确标为 INFERRED。

---

## TL;DR

| 问题 | 结论 |
|---|---|
| 脚本是什么格式 | **纯文本,一行一条语句:`[tag 参数...]`(整行方括号)**;另有控制符行(`＠`说话人/`＄`入口标签/`？`选项)、纯文本消息体、`#`/`//` 注释;详见 `supplement-script-format.md` |
| 有多少指令 | **366 条命令**(分派器是 FNV-1a 哈希树,379 个哈希常量全部反解命中)+ 消息体行 `message2`/`message3`(走显式比较,不在 366 内)+ `pd[0]` 子命令树 72 关键字(如 `input selectBranch`)。表:`out/commands.json` |
| 指令怎么执行 | `ScriptManager.ScriptCommandExecute(tag, pd, line, data, …)` 巨型分发(VA `0x3177290`),返回 `Normal/Continue/ReturnFalse` |
| 参数含义 | **366 条命令全部有参数含义记录**:合计 1272 行(925 个值参数 + 347 个分隔符位),high 815 / medium 259 / low 194;总纲 `out/command-params.md`,数据 `out/command_params.json` |
| 消息文本怎么标 | `[#RRGGBB]…[-]` 颜色、`[#ruby:base]` 注音、`[r]` 换行、`[line n]`/`[image …]` 行内图、`[tRoute …]` 路线文本、`・`/`■` 傍点 |
| 脚本在哪 | **不在 APK 内**,按需下载;资源名以 `.txt` 结尾(`IsExistScriptFile` VA `0x319bf3c`) |
| 加密怎么破 | AssetStorage:base64 → **Rijndael-256-CBC** → **bzip2** → **逐字节取反** → UTF-8,**已跑通并校验 CRC** |
| 画面怎么搭 | 12 层相机栈(BgCamera -1 → FigureCamera 0 → ActionCamera 1 → 2DUICamera 2 → … → TouchCamera 15);剧情画面渲染到 **1344×576 RenderTexture**;主场景可直接从 `data.unity3d` 读 |

**两个反直觉但已实证的坑**:①v2.139.3 **没有** `bg`/`mes`/`char` 指令(`bg` 是 UI 对象名/语言代码,
`mes` 无任何代码引用);背景用 `bScene`/`imageSet`/`sceneSet`,消息行用 `message2`/`message3`。
②指令名里有游戏自带的拼写错误(`specialEffectPuase`、`communicatioChara`、`masterverticalImageSet`),必须原样匹配。

---

## 文件地图

### 我(主)整理的文档
| 文件 | 内容 |
|---|---|
| `out/script-format.md` | **脚本文本语法**、行分类、消息内嵌标记、完整命令清单分组、执行模型(返回码/状态机/延迟/起播模式/角色槽位) |
| `out/asset-pipeline.md` | **资源流水线**:AssetStorage 容器格式与解密链、密钥拆位算法、资源包命名规则、脚本资源定位 |
| `out/_evidence/scene-cameras.md` | 主场景相机栈与层序(depth/clearFlags 实证) |
| `tools/fgo_script_parser.py` | **脚本解析器原型**(文本 → 结构化 JSON / HTML 讲稿),已自测 |
| `tools/fgo_assets.py` | **AssetStorage 解密器**(可运行,含 CRC 校验) |
| `tools/param_semantics.py` | 参数污点跟踪:`pd[i]` → 转换 → 消费方法参数位(含边界截断、可选性检测) |
| `tools/dump_index.py` | 从 `dump.cs` 抽取全部方法签名(参数名/类型/是否 static) |
| `tools/merge_params.py` | 合并自动跟踪与命令表,生成 `command_params.json` + 骨架表 |
| `tools/finalize_params.py` | **最终汇总**:按优先级把域文档折叠进唯一权威表 |
| `tools/param_overrides.json` | 人工核验覆盖项(带证据 VA),优先级最高 |
| `tools/rijndael256.py` | Rijndael-256(Nb=8,Nk=8,Nr=14)CBC 实现 |

### 子代理产出的专题文档
| 文件 | 内容 |
|---|---|
| `out/commands.md` / `out/commands.json` | 366 条命令:handler VA、按 `pd[]` 下标给出的参数类型与消费函数、min-token 数、哈希、置信度;以及 `pd[0]` 子命令表与取值词汇表 |
| `out/command-params.md` | **参数含义总纲**:`pd[]` 读法、角色槽位字母表、7 个位置坐标、坐标形式 `x,y`、布尔/省略/哨兵取值、资源名转换表、命令尾声与空实现命令、缓动透传、置信度说明、控制流标记补遗 |
| `out/command_params.json` | **唯一权威机器可读参数表**:366 条命令 × 1272 行(925 值参数 + 347 分隔符位),每行含 `pd` 下标、类型、含义、取值、置信度、来源、证据地址 |
| `out/params-visual.md` / `.json` | 演出域详细版:253 条命令、991 行(high 742),13 处标注未知;含共享尾块机制、FSL/FSR 是命令名而非参数、位置两种写法 |
| `out/params-misc.md` / `.json` | 音频/消息窗/流程控制/杂项详细版:124 条命令、212 行(high 50)、59 处标注未知;含 `wait` 的 72 键关键字表与延迟/自动等待模型 |
| `out/presentation.md` / `out/presentation.json` | 演出系统:相机、转场(fade/wipe/mask/flash)、滤镜与 RenderTexture 特效、角色演出、插入动画/FSM、子层、时间模型 |
| `out/composition.md` / `out/composition.json` | 画面构建:资源路径模板、坐标/分辨率约定、层序与深度、字体与文本渲染 |

### 逆向过程产物(可复查)
| 路径 | 内容 |
|---|---|
| `work/` | 解包后的 APK、`libil2cpp.so`、`global-metadata.dat`、`data.unity3d` |
| `work/il2cpp_out/dump.cs` | Il2CppDumper 全量类/字段/方法签名(含字段偏移) |
| `work/il2cpp_out/script.json` | 每个方法的 VA(24 万个) |
| `work/il2cpp_out/stringliteral.json` | 字符串字面量表 |
| `work/il2cpp_out/command_names_raw.json` | 从 `AnalysText` 提取的 386 个标签字面量 = 命令表原始来源 |
| `work/il2cpp_out/slot2str.json` | 代码槽位 → 字符串 缓存(工具链核心) |
| `work/tools/*.py` | 全套分析工具,见下 |

---

## 方法与工具链(可复现)

1. **解包**:XAPK 内含 `com.aniplex.fategrandorder.apk`(44MB)+ `config.arm64_v8a.apk`(40MB)。
   后者含 `libil2cpp.so`(94MB)与 `libunity.so`;基础包含 `global-metadata.dat`(20MB)与 `data.unity3d`(21MB)。
   → **IL2CPP**,不是 Mono,所以需要元数据还原。
2. **元数据还原**:`Il2CppDumper` v6.7.46 → `dump.cs` / `script.json` / `stringliteral.json` / 99 个 dummy DLL。
3. **字符串与 xref**:IL2CPP 的字符串字面量在代码里是**两次加载**——
   `adrp+ldr` 取到"槽位地址",槽位内容由 `.rela.dyn` 重定位在加载时指向字面量表项。
   关键突破点是**解析 ELF 重定位表把槽位映射回字符串**(`tools/resolve_strings.py`),
   否则反汇编里看到的全是 0。`tools/annotate_func.py` 在此之上做带寄存器跟踪的注解反汇编。
4. **命令表提取**:`ScriptManager$$AnalysText`(VA `0x31a920c`)的元数据初始化序言一次性加载了它认识的
   全部标签字面量 → 直接得到命令表(`il2cpp_out/command_names_raw.json`)。
5. **文本格式**:`AnalysScript` / `AnalysParam` / `ScriptAnalys` 的反汇编 + 消息系统字面量。
6. **加密**:`CatAndMouseGame..cctor` + `MouseGame8` + `MouseHomeMainZ2` 反汇编 → 用 Python 重实现 → 实测通过。
7. **画面**:`data.unity3d` 用 UnityPy 直接读相机/组件(`out/_evidence/cameras.json`)。

分析工具(均在 `work/tools/`):
`resolve_strings.py`(槽位→字符串)、`annotate_func.py`(注解反汇编)、
`find_literal_refs.py`(按字符串内容反查引用点)、`extract_commands.py` / `window_cmp.py`(命令分派提取)、
`scan_xref.py`(全量扫描)、`fgo_assets.py` / `rijndael256.py`(解密)、`fgo_script_parser.py`(脚本解析);
专题分析过程中另建:`build_lit_index.py`(字面量→方法 反向索引,`il2cpp_out/lit_methods.json`)、
`cmdwin.py` / `hash_switch.py`(命令分派窗口与哈希反解)、`bulk_annot.py` / `handler.py`(批量注解)、
`klass.py` / `mdump.py`(类与方法转储)。

> 复用提示:代码段在 `libil2cpp.so` 的 **0x2321aa4–0x5311320**(不是 `.text` 节);
> AArch64 `adrp` 是 PC 相对寻址,两处都处理对才能复现这些索引。

**可选:Ghidra 图形化分析**。`tools/ghidra_11.4.2_PUBLIC/` 已就绪(Ghidra 11.4.2 + JDK 25),
`tools/ghidra_with_struct.py` 是 Il2CppDumper 自带的符号恢复脚本。若要交互式查看反编译:

```bash
cd F:/Project/fgo/work
cmd //c "tools\ghidra_11.4.2_PUBLIC\support\analyzeHeadless.bat F:\Project\fgo\work\ghidra_proj FGO \
  -import F:\Project\fgo\work\extract\lib\arm64-v8a\libil2cpp.so -processor AARCH64:LE:64:v8A -max-cpu 4"
```

(94MB ARM64 全量自动分析耗时数小时;本次结论均未依赖它,那一步已终止。)

---

## 关键地址速查

| 符号 | VA | 说明 |
|---|---|---|
| `ScriptManager$$ScriptCommandExecute` | `0x3177290` | 指令分派总入口(0x3177290–0x319402c) |
| `ScriptManager$$AnalysText` | `0x31a920c` | 行分类 + 命令表来源 |
| `ScriptManager$$AnalysScript` | `0x31a50ec` | 脚本正文解析 |
| `ScriptManager$$AnalysParam` | `0x31a7688` | 参数切分(`' '` `'='` `','`) |
| `ScriptManager$$ProcessScript` | `0x31bc344` | 逐行执行主循环 |
| `ScriptManager$$GetScriptData` | `0x31a3ba8` | 脚本资源名拼接(`Q`/`E`/`W` 后缀) |
| `ScriptManager$$IsExistScriptFile` | `0x319bf3c` | 校验 `.txt` |
| `AssetManager.<InitCR>d__136$$MoveNext` | `0x2dac340` | AssetStorage 启动加载/校验 |
| `CatAndMouseGame$$MouseGame8` | `0x2e4fe9c` | AssetStorage 解密入口 |
| `CatAndMouseGame$$MouseHomeMainZ2` | `0x2e4ffec` | Rijndael-256 解密 + gzip |
| `CatAndMouseGame$$MouseHomeMain` | `0x2e4ea14` | Rijndael-256 解密 + bzip2 |
| `CatAndMouseGame$$.cctor` | `0x2e4bffc` | 密钥字面量与拆位 |
| `AssetData$$get_DownloadName` | `0x2d9cfdc` | 资源包文件名规则 |
| `ScriptMessageLabel$$AnalysTagParam` | `0x31d0f98` | 消息内嵌标记解析 |
| `ScriptMessageLabel$$GetTalkName` | `0x31d4ddc` | 说话人/称号/表情图标解析 |

---

## 现状与下一步

**已经可以做的**:拿到一份解密的 `.txt` 剧本 → 用 `tools/fgo_script_parser.py` 得到结构化 JSON(含标签、参数、
消息 markup、label 表)→ 配合 `commands.md` 的参数表就能按序播放文本与基础画面指令。

**还差的三件事(需要真实下载资源才能收口)**
1. ~~**真实剧本样本**~~ **【已完成 · 2026-10-14】** 已拿到 33 章 2,583 个真实 `.txt`(1,867,761 行,见 `scripts\`),
   完成全量对拍;格式与控制符均已实证(见 `coverage-verification.md`)。
   `tools/fgo_script_parser.py` **需要按 `supplement-script-format.md` 的行语法与控制符重写**(现版按错误的裸行语法解析)。
2. **生产版资源清单**:~~APK 内是桩文件,只有一行数据版本;完整清单需从游戏缓存取~~ **【脚本部分已闭环 · 2026-10-14】**
   脚本资源名 = `String.Format("{0:D10}", WarEntity.targetId)`(PlayChapterStart 0x319a1f8)、
   存储名 = `"ScriptActionEncrypt/" + 名前2位`、清单资源 = `"ScriptActionEncrypt/ScriptFileList"`、
   存在性校验 = `名 + ".txt"`(IsExistScriptFile 0x319bf3c),`Q/E/W` 为 PlayQuestStart 模式的同资源追加键
   —— 见 `_evidence/closure-meta-assets.md`。**其余资源**(图/音/模型)的清单与各 `keyType` 解密组合仍需游戏缓存。
3. ~~**参数级对拍**~~ **【已完成 · 2026-10-14】** 已按前 60 高频命令做参数形态对拍:
   39 条一致、6 处漏参、3 类矛盾,见 `supplement-command-coverage.md` §D。

**合规提醒**:脚本与美术资源是 Aniplex/Type-Moon 的版权内容。技术格式可以自由研究,
但分发资源本身需注意授权;阅读器建议做成"读取本地已下载缓存"的形式,不内置资源。

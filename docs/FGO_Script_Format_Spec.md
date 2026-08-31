# FGO 脚本格式规范

> 基于 `scripts/` 目录中的 2,583 个脚本文件（当前快照：2026-08-15）逆向分析，并对照 Atlas Academy 解析器实现校准。
>
> 解析器对照版本：[`packages/db/src/Component/Script.tsx`](https://github.com/atlasacademy/apps/blob/a596decc0a0f8cb4556dcf7fc59fa53e3916faa1/packages/db/src/Component/Script.tsx)（commit `a596decc0a0f8cb4556dcf7fc59fa53e3916faa1`）。

---

## 目录

1. [概述](#概述)
   - [解析器对照与证据等级](#解析器对照与证据等级)
2. [文件结构](#文件结构)
3. [语法基础](#语法基础)
4. [文本标记](#文本标记)
5. [命令参考](#命令参考)
   - [场景/背景](#场景背景)
   - [角色管理](#角色管理)
   - [音频](#音频)
   - [摄像机](#摄像机)
   - [视觉效果](#视觉效果)
   - [影片/动画](#影片动画)
   - [控制流](#控制流)
   - [UI 控制](#ui-控制)
   - [子摄像机系统](#子摄像机系统)
   - [其他命令](#其他命令)
6. [画面合成与坐标系（客户端逆向）](#画面合成与坐标系客户端逆向)
   - [引擎侧解析与执行管线](#引擎侧解析与执行管线)
   - [画面合成栈](#画面合成栈)
   - [素材的 00 点（锚点）](#素材的-00-点锚点)
7. [非官方剧情阅读器实现指南](#非官方剧情阅读器实现指南)
   - [总体架构：三段管线](#总体架构三段管线)
   - [脚本解析标准](#脚本解析标准)
   - [执行语义标准](#执行语义标准)
   - [画面演出标准](#画面演出标准)
   - [素材体系与降级策略](#素材体系与降级策略)
   - [引擎常量速查表](#引擎常量速查表)
8. [控制流模式](#控制流模式)
9. [完整示例](#完整示例)
10. [附录](#附录)

---

## 概述

FGO（Fate/Grand Order）使用自定义文本 DSL 作为视觉小说脚本引擎。所有脚本均为 `.txt` 文件，UTF-8 编码，包含日文文本和嵌入式命令。

### 解析器对照与证据等级

本文把结论分为四类：

- **样本确认**：直接出现在当前 `scripts/` 快照中的语法、参数形态或统计值。
- **解析器确认**：上面链接的 Atlas Academy `Script.tsx` 明确实现的分词、状态转换或命令分支。
- **客户端逆向确认**：来自 FGO 客户端 APK（2.138.0，versionCode 496）IL2CPP 逆向的结果——即游戏引擎本体（`libil2cpp.so` 中 Assembly-CSharp 的 `ScriptManager` 体系）的真实行为。证据摘要与工具链见 [附录：客户端逆向资料](#客户端逆向资料)。
- **推测/待确认**：只有资源命名、参数聚类或演出效果能够支持，尚未由游戏客户端或更多样本证明的语义。

Atlas Academy 的代码是用于展示和检索脚本的解析器，不是 FGO 客户端本身的完整执行器。因此：

1. `parseScript` 按行识别 `＄` 头部、`＠` 说话者、`？` 选项和 `？！` 选项段结束；`＄` 头部在解析器中被跳过，不会校验文件名或六段编号。
2. 对话行中的方括号标记会先按成对的 `[`/`]` 切分；颜色、字体、对齐、换行、Ruby、性别依存文本等属于文本标记，其他可识别命令交给命令解析分支。
3. `parseBracketComponent` 没有覆盖的命令会保留为 `UNPARSED`。这表示“该版本展示解析器没有专门建模”，不表示游戏引擎一定拒绝该命令。
4. 解析器大多只按参数位置读取 `parseInt`/`parseFloat`，不严格校验参数数量；多余参数可能被忽略，缺失参数可能变成 `undefined` 或 `NaN`。本规范因此同时保留原始样本中的扩展形态。

当前版本直接建模的核心命令包括：`charaSet`、`imageSet`/`verticalImageSet`/`horizontalImageSet`、`equipSet`、`sceneSet`、`charaChange`、`charaTalk`、`charaFace`、`charaFaceFade`、`charaFilter`、`charaFadein`/`charaFadeout`、`charaFadeTime`、`charaCrossFade`、`charaMove`、`charaPut`/`charaPutFSR`、`charaScale`、`charaDepth`、`charaCutin`/`charaCutinPause`、`charaEffect`/`charaEffectStop`、`se`、`cueSe`、`wt`、`label`、`branch`、`branchQuestNotClear`、`pictureFrame`、`bgm`/`bgmStop`、`voice`、`criMovie`、`scene`、`flag`、`masterBranch`、`enableFullScreen`、`cameraFilter`、`effect`/`effectStop`/`effectDestroy`。

解析器专门处理的文本标记还包括 `[k]`/`[page]`/`[q]`、`[r]`/`[sr]`/`[csr]`、`[s]`/`[speed]`、`[%1]`、`[line N]`、`[servantName ...]`、`[image ...]`/`[i ...]`、`[#原文:读音]`、`[&男性:女性]`、颜色、字体和对齐标记。

#### 高影响的兼容性差异

| 原始脚本形态 | Atlas 当前解析器的处理 | 规范写法 |
|---|---|---|
| `[line N]` / `[line3]` | 作为带长度的横线组件 | 不要解释为“显示 N 行” |
| `[wait 类型 ...]` | 没有与 `[wt 秒]` 相同的专用等待类型 | 保留原始命令；区分 `wait` 与 `wt` |
| `[bgm ID 参数2 参数3]` | 参数 2/3 分别按 `volume`/`fadeinTime` 读取 | 保留位置，不按旧注释交换参数 |
| `[charaTalk A,B]` | 把 `A,B` 保存成一个字面说话者代码 | 多人语义属于客户端/原始 DSL 层 |
| `[input ...]`、`[fadein ...]`、`[cameraMove ...]` 等 | 当前版本没有对应的直接命令类型 | `UNPARSED` 只表示展示解析器未建模 |
| `[Q]` 与 `[q]` | `[Q]` 可出现在 `spot[Q]`；消息边界是小写 `[q]` | 保持大小写 |

### 设计原则

- **事件驱动**：脚本按顺序执行，无函数/循环结构
- **有限状态控制**：没有通用表达式/变量系统，但存在 `flag`、任务条件、路线计数和文本替换
- **视觉小说范式**：以对话为核心，命令控制演出效果
- **角色槽位制**：A-Z 单字母标识角色、效果、图像等槽位，`#A` 等标识子渲染层；具体用途不是固定分区

> **引擎侧对应**（客户端逆向确认）：客户端把每个槽位映射为 `ScriptCharaData`（最多 26 个，对应 A-Z；见 `ScriptManager.CHARA_MAX = 26`），表情槽位上限 `FACE_MAX = 133`。脚本加载后被逐行切分进 `executeTagList`（标签名）/`executeDataList`（参数原文）/`executeLineList`（行号）数组，再由 `ScriptCommandExecute` 逐条分发执行；控制流（`label`/`jump`/`branch`/`selectBranch`）只是对执行索引 `executeIndex` 的跳转，与"无函数/循环"的观察一致。详见 [画面合成与坐标系（客户端逆向）](#画面合成与坐标系客户端逆向) 一章。

### 文件编码

- 编码：UTF-8
- 扩展名：`.txt`
- 当前样本：UTF-8 无 BOM，2,583 个文件均使用 CRLF
- 兼容性：解析器按脚本中是否出现 `CRLF` 选择 `CRLF` 或 `LF` 分行；混合换行不应视为规范格式

---

## 文件结构

### 目录组织

```
scripts/
├── Singularity FFlame Contaminated City Fuyuki/    # 特异点章节
├── Third SingularitySealed Ends of the Four Seas/   # 第三特异点
├── Lostbelt No1Permafrost Empire Anastasia/         # 异闻带章节
├── PrologueDec 26th 2017/                           # 序章
├── The Inescapable Gehenna Id/                      # 活动章节
└── ...
```

### 文件命名规则

当前样本中的文件名均为 10 位数字 ID + `.txt`：

```
XXXXXXXXXX.txt
```

**（客户端逆向确认）** 引擎按 `{questId:D8}{phase:D1}` 生成脚本基名（`ScriptManager.SCRIPT_NAME_BATTLE_BASE = "{0:D8}{1:D1}"`），即 **前 8 位 = questId，第 9 位 = questPhase，第 10 位 = 变体尾号**。战斗类脚本的尾号含义由引擎常量固定：

| 尾号 | 引擎常量 | 含义 |
|------|----------|------|
| `0` | `SCRIPT_NAME_BATTLE_START` | 战斗前剧情 |
| `1` | `SCRIPT_NAME_BATTLE_END` | 战斗后剧情 |
| `2` | `SCRIPT_NAME_BATTLE_START2` | 战斗前剧情（第二形态） |
| `3` | `SCRIPT_NAME_BATTLE_END2` | 战斗后剧情（第二形态） |
| `4` / `6` | `SCRIPT_NAME_BATTLE_OTHERWIN_END(2)` | 其他胜利结果结局 |
| `5` / `7` | `SCRIPT_NAME_BATTLE_LOSEWIN_END(2)` | 败利结局 |
| `8` | `SCRIPT_NAME_NOTMEETS_COND` | 条件不满足提示 |
| `9` | `SCRIPT_NAME_BATTLE_START_JUST_BEFORE` | 战斗直前剧情 |

样本验证：`0100000010`/`0100000011`（同一任务 start/end 对）、`0400069110`→`0400069140`（同一 questId 的 phase 1→4）、`0400069210/0400069211`（相邻任务）均吻合。非战斗的纯剧情脚本沿用同样的 8+1+1 结构，尾号作为自由变体号使用。

在此结构下，此前把 10 位拆成 `2-2-2-2-1-1` 六段的理解可以修正为：**前两位与章节号是 questId 的组成部分**（questId 的首位编码大类，如 `01`=特异点 F、`03`=序章/异闻带、`04`=终局后/Ordeal Call），"子章节/任务号"即 questId 低位，"场景/阶段号"即 questPhase。另存在 `WarEpilogue` 等具名脚本（`SCRIPT_NAME_WAR_EPILOGUE`）。

### 脚本头部

几乎所有脚本都包含此标识符（当前 2,583 个文件中有 2,582 个，约 99.96%）：

```
＄01-00-03-01-1-0
```

- 使用全角 `＄` 符号
- 格式通常与文件名 ID 对应，但不是绝对约束；解析器只跳过该行，不校验两者关系
- 仅 `scripts/Fifth SingularityNorth American Myth War E Pluribu/0100051140.txt` 没有头部，直接以命令或空行开始
- 头部最晚出现在第 17 行，不能只扫描前 5 行。当前行号分布为：第 1 行 484、第 2 行 714、第 3 行 693、第 4 行 460、第 5 行 62、第 6 行 37、第 7 行 4、第 8 行 3、第 9 行 3、第 10 行 117、第 11 行 4、第 17 行 1
- 当前样本中有 74 个文件的文件名 ID 与头部 ID 不一致，应将其视为异常或历史兼容数据

**（客户端逆向）** 引擎按"行首码"识别特殊行：`ScriptManager` 持有 `codeSceneString`（场景头）、`codeTalkString`（对话行）、`codeCommentString`（注释）、`codeLabelString`（标签行）、`codeInsertString`（插入）、`codeReturnString`（返回）等字段，值在 `FirstExecuteScriptLoadCommonData`（RVA 0x313B61C）中由游戏内通用脚本数据初始化——即这些前缀是**数据驱动的引擎约定**，而非散落各处的硬编码。其中 `＠` 已作为字符串常量出现在 `libil2cpp.so` 中（对应对话行识别）；`＄` 无独立常量，说明它只在通用脚本数据里配置，与头部"跳过、不校验文件名关系"的观察一致。头部六段数字的具体语义未在引擎代码中找到直接消费点，客户端各系统使用的 questId/warId/questPhase 均来自播放接口参数（`PlayChapterStart(warId, …)` 等），而非头部行。

---

## 语法基础

### 命令格式

```
[command parameter1 parameter2 ...]
```

- 方括号包裹
- 命令名与参数以空格分隔
- 需要在一个参数中保留空格时可使用双引号，例如 `[input selectBranch skipStop "branchNotRouteSelect 4000517 4000574"]`
- 参数数量因命令而异
- 签名中的 `<参数>` 表示占位符，`<参数>?` 表示可选参数；命令外层的 `[]` 是脚本中的实际字符
- 命令既可以独占一行，也可以嵌入台词文本行；解析器先按成对方括号切分，再按上下文决定是文本标记、命令还是 `UNPARSED`

> **引擎侧分词行为**（客户端逆向确认）：标签名的提取由 `ScriptManager.GetCommandTag`（RVA 0x314A1FC）完成，算法是**从 `[` 后的位置逐字符拼接，遇到空格或 `]` 即停止**——即命令名就是第一个空白前 token，与"[命令名 空格 参数…]"的书写规则互为印证。整条命令随后以 `(tag, string[] pd, int line, string data, …)` 传入 `ScriptCommandExecute`（`pd` 为按空格/引号切分的参数数组，`data` 是整行原文），引擎据此能同时支持"独占一行"与"嵌入台词"两种形态。命令名匹配用 `string` switch（`ComputeStringHash` + 逐 case `op_Equality`），因此命令名**大小写敏感**。

### 对话格式

```
＠角色名
台词文本内容[k]
```

- `＠`（全角 at 标记）必须位于行首，标识说话者；也可写成 `＠槽位：显示名`。除韩文区域外解析器使用全角冒号，韩文区域使用半角冒号
- `＠显示名=spot[A,B]` 表示同一行台词由多个槽位共同说出
- 台词通常独占一行，但可以在台词中嵌入命令和文本标记
- `[k]` 表示结束当前消息并等待玩家点击继续；`[q]` 和 `[page]` 也会触发消息段结束
- `[r]`、`[sr]`、`[csr]` 表示换行/软分页，不等待；当前本地样本主要使用 `[r]`

> **引擎侧机制**（客户端逆向确认）：
> - 行首识别码（`＠`、`＄` 等）不是硬编码字符，而是 `ScriptManager` 的字符串字段（`codeTalkString`/`codeSceneString`/`codeCommentString`/`codeLabelString`/`codeInsertString`/`codeReturnString` 等），由通用脚本数据在 `FirstExecuteScriptLoadCommonData`（RVA 0x313B61C）中初始化——引擎把"特殊行前缀"当作可配置数据。
> - `＠` 行的剩余部分成为 `talkName`，引擎用 `IsEqualTalkName` / `ConvertCharaIndexTalk` 把说话者匹配回 A-Z 槽位（用于把非说话角色压暗/失焦等演出）；`＠显示名=spot[A,B]` 多人共演同样在此阶段解析。
> - 台词正文不单独解析：`AnalysText`（RVA 0x314154C）把整行切分为"文本片段 + 行内标签"序列，行内标签与独立命令一样进入分发器，文本片段按字符步进渲染（`ScriptLineMessage` 逐字对象池）。
> - 消息等待由 `isScriptWait` 状态位驱动：`[k]`/`[q]`/`[page]` 等边界标签把等待挂到 `waitType`，点击后继续；自动播放模式由 `autoWaitTime` 控制时长，模板常量 `AUTO_WAIT_TAG_FORMAT = "[wait skippableTime {0:F2}]"`（引擎会在自动模式下按此格式生成等待）。

### 角色槽位

当前样本主要使用大写字母 A-Z 作为槽位标识：

| 形式 | 用途 |
|----------|------|
| `A`-`Z` | 角色、图像、场景、效果或临时对象的脚本槽位 |
| `#A`、`#B` 等 | 子摄像机/子渲染层标识，不是普通角色槽位 |

槽位用途并非硬性分区；实际脚本会把任意 A-Z 槽位用于角色、效果、图像或临时对象。

### 注释

当前样本中没有观察到专用注释语法，也没有以 `//` 开头的行。Atlas 解析器会跳过行首为 `//` 的行，但这只能证明该展示解析器的兼容行为，不能据此断言客户端正式支持注释。本文档代码块中的 `# ...` 仅是说明，不应复制到脚本中；`sub #A` 等情况中的 `#` 则是实际参数的一部分。

**（客户端逆向）** 引擎确实预留了注释相关机制：`ScriptManager` 有 `codeCommentString` 字段（行首注释码，与其他行首码一同由通用脚本数据初始化），且 `ScriptAnalys` 的字符串表中出现 `debugComment` 标签——脚本里可以写 `[debugComment ...]` 类标记，引擎在分析阶段识别但不应产生演出效果。当前 2,583 个样本文件中未见使用。

---

## 文本标记

> **（客户端逆向确认）** 以下标记由 `AnalysText`（RVA 0x314154C）在文本分析阶段识别。反汇编其字符串表可得引擎侧标记词表，其中**多字符标记以字符串比较**：`k`、`q`、`page`、`page3`、`wt`、`twt`、`font`、`wait`、`skip`、`center`、`right`、`label`、`jump`、`branch`、`tdelay`、`else`、`endIf`、`once`、`start`、`tRoute`、`tVoice` 等；**单字符标记（如 `r`）以字符比较**（`String.get_Chars`），不作为字符串常量出现。引擎还会对连续换行做特殊处理（字符串表中有字面量 `"[r][r]"`）。同一分发器既处理独立命令也处理行内标记，因此文本标记与命令在引擎层是同一套语法。

### 换行与分页

| 标记 | 含义 | 出现次数 |
|------|------|----------|
| `[k]` | 消息段边界，等待玩家点击 | 184,799 |
| `[r]` | 软换行，不等待 | 133,096 |
| `[sr]` / `[csr]` | 解析器支持的其他软换行标记；当前本地样本未形成显著统计 | — |
| `[line N]` | 插入长度为 `N` 的横线/分隔线，不是“强制显示 N 行”；Atlas 展示组件按长度绘制横线 | 19,539 |
| `[line3]` | `[line 3]` 的无空格形式；解析器按 `line` 前缀识别 | 1 |

`[k]`、`[q]` 和 `[page]` 是消息段边界；`[r]`、`[sr]`、`[csr]` 只改变消息内部排版。

### 注音/ルビ（Ruby Text）

```
[#原文:读音]
```

**示例**：
- `[#船長:キャプテン]` → 显示"船長"，注音为"キャプテン"
- `[#戦:いくさ]` → 显示"戦"，注音为"いくさ"

### 性别依存文本

```
[&男性文本:女性文本]
```

客户端根据主角性别选择显示文本。Atlas 展示解析器会同时解析男性分支和女性分支，并把男性分支作为主显示、女性分支作为辅助内容；这证明了语法结构，不等同于客户端性别判定实现。

**示例**：
- `[&君:ちゃん]` → 男性主角显示"君"，女性显示"ちゃん"
- `[&彼:彼女]` → 男性显示"彼"，女性显示"彼女"
- `[&オレ:わたし]` → 男性显示"オレ"，女性显示"わたし"

### 颜色标记

```
[RRGGBB]文本[-]
```

**常用颜色**：

| 颜色代码 | 用途 | 出现次数 |
|----------|------|----------|
| `51ffff` | 蓝色（常见于系统文本） | 1,375 |
| `93CA76` | 绿色 | 347 |
| `51d4ff` | 浅蓝 | 228 |
| `D9FF69` | 黄绿色 | 228 |
| `6680ff` | 紫蓝 | 161 |
| `FFFFFF` | 白色 | 514 |
| `FF0000` | 红色 | 48 |
| `FF143C` | 深红 | 28 |

**示例**：
```
[51ffff]システムメッセージ[-]
[FF0000]警告！[-]
```

在 Atlas 解析器中，`[-]` 会清除当前颜色并同时恢复字体大小；当前本地样本使用 `[-]`，没有把同一颜色再次写作结束标记的可靠实例。

### 变量替换

| 标记 | 含义 | 出现次数 |
|------|------|----------|
| `[%1]` | 玩家名称；Atlas 解析器直接建模 | 3,956 |
| `[%5]` | 当前样本仅 1 次，解析器没有对应分支，语义未确认 | 1 |

**（客户端逆向确认）** 引擎侧实现为静态类 `ScriptReplaceString`：维护替换列表 + `playerGenderIndex`（性别依存文本用），对外提供 `SetString(index, str)` / `GetString(num)`；已知枚举 `ScriptReplaceString.Index.USER_NAME = 1` 对应玩家名占位。替换发生在文本进入渲染前（`ScriptManager.ReplaceBranchText` / `GetOverwriteText` 亦会改写文本）。

### 文本对齐

```
[align center]
[align right]
[align]
```

`[align]` 用于恢复默认对齐；当前样本未观察到 `[align left]`。

### 字体控制

```
[font large]      # 大字体
[font small]      # 小字体
[font x-large]    # 特大字体

[fontSize large]
[fontSize x-large]
[fontSize -]
[f small]         # 小字体（简写）
[f -]             # 默认字体
[f medium]
[f x-small]
[f small center]
[f x-small center]
```

### 消息速度

```
[speed -]         # 默认速度
[speed 32]        # 指定速度
[messageSpeedForcedNormal on|off]  # 强制正常速度
```

`[s N]` 是短写形式。Atlas 解析器把 `[s]`/`[speed]` 都作为对话速度标记处理；本地样本中的 `[s 0]`、`[s 16]` 等不应再解释为滚动位置。

`messageSpeedForcedNormal` 属于原始脚本中的扩展标记，当前 Atlas 展示解析器没有对应的专用文本状态分支。

> **（客户端逆向确认）** 逐字速度由 `ScriptMessageCommonManager` 的 `stepTime` 驱动（默认值 `defaultStepTime`，可被设置项 `SetScenarioTextSpeedControl` 修改）；引擎还有自动播放的时间参数 `autoWaitTime` / `scenarioSpeed` / `textStepTime`，以及模板常量 `AUTO_WAIT_TAG_FORMAT = "[wait skippableTime {0:F2}]"`——自动模式下引擎按此格式生成等待标签。`messageSpeedForcedNormal` 对应引擎字段 `isMessageSpeedForcedNormal`，为真时强制回到默认速度。

---

## 命令参考

### 命令总索引（语料全集）

> 下表为当前语料的**命令全集**：263 种在用标签 + 4 种声明未用（`[tRoute]` 引擎有专用解析正则、`[branchNotMaterial]/[branchHaveSvtEquip]/[branchNotHaveSvtEquip]` 解析器声明支持），共 267 行；16 进制颜色码、`[#汉字:かな]` 注音、`[A,B]` spot 槽位、`[&男性:女性]` 性别分支 4 类伪标签见"语法基础/文本标记"章，不在此列。词频 = 原始出现次数（2,583 文件统计）；**词频 0 = 声明支持但当前语料未使用**。各命令的详细参数与示例见后续分类小节；索引语义为本规范口径，与引擎行为冲突处以逆向证据为准。

**文本与排版标记（语法见"文本标记"章）**（合计 346,683 次）

| 命令 | 词频 | 语义 |
|---|---:|---|
| `[k]` | 184,799 | 消息段边界，等待点击 |
| `[r]` | 133,096 | 软换行，不等待 |
| `[q]` | 2 | 消息段边界（少见变体） |
| `[-]` | 2,953 | 颜色/样式复位 |
| `[%1]` | 3,956 | 玩家名占位（ScriptReplaceString） |
| `[%5]` | 1 | 占位符变体，语义未确认 |
| `[line N]` | 19,539 | 插入长度 N 的横线 |
| `[line3]` | 1 | `[line 3]` 无空格简写 |
| `[f …]` | 1,304 | 字号标记（`f small/-/large`，可带对齐） |
| `[font …]` | 16 | 字体切换（large/x-large 等） |
| `[fontSize N]` | 24 | 字号设置 |
| `[s N]` | 52 | 逐字速度短写 |
| `[speed N]` | 48 | 逐字速度 |
| `[align …]` | 536 | 文本对齐 |
| `[messageAlign …]` | 1 | 消息窗整体对齐（bottom 等） |
| `[i 名]` | 49 | 行内图片短写（语音图标等） |
| `[image …]` | 302 | 行内图片（可带缩放/偏移） |
| `[imageChange …]` | 1 | 替换已放置的行内图片 |
| `[tRoute …]` | 0 | 带编号的选项路由文本（引擎有专用解析正则） |
| `[tRaidShortName …]` | 3 | Raid 任务简称占位 |
**等待与输入（详见"UI 控制/控制流"章）**（合计 143,645 次）

| 命令 | 词频 | 语义 |
|---|---:|---|
| [wt] | 116,117 | 定时等待 N 秒（可点击打断） |
| [twt] | 27 | wt 的语音同步变体 |
| [wait] | 26,884 | 按类型等待（fade/se/ad1/movie 等 25+ 种） |
| [input] | 83 | 玩家输入控制（selectBranch 跳转控制等，参数可带引号） |
| [skip] | 217 | 跳过模式开关 |
| [tapSkip] | 1 | 显示点击跳过提示 |
| [clear] | 152 | 清屏/清空消息显示 |
| [turnPageOn] | 12 | 开启翻页模式（f=强制） |
| [turnPageOff] | 11 | 关闭翻页模式 |
| [autoAndBackLog] | 1 | 自动播放+回顾组合开关 |
| [selectionUse] | 30 | 启用已保存的选择（masterMale 等） |
| [enableWaitLoadAssetWhenResume] | 108 | 断点续播时允许等待资源加载 |
| [scrollStop] | 1 | 滚动停止 |
| [interruption] | 1 | 标记可被外部系统中断续播 |

**场景与转场（详见"场景/背景""视觉效果"章）**（合计 46,718 次）

| 命令 | 词频 | 语义 |
|---|---:|---|
| [scene] | 10,447 | 装载背景图并交叉淡化 |
| [sceneSet] | 4,687 | 预装载背景（不立即显示） |
| [pictureFrame] | 854 | 画框/遮幅形态 |
| [pictureFrameTop] | 224 | 顶部画框（z=-230 层） |
| [backCameraColor] | 43 | 背景相机底色重置 |
| [fadein] | 8,791 | 从颜色遮罩淡入（默认 0.5s） |
| [fadeout] | 8,770 | 淡出到颜色遮罩 |
| [fadeMove] | 83 | 带位移的遮罩淡入淡出 |
| [wipein] | 3,104 | 擦除显现（30+ 方向） |
| [wipeout] | 3,124 | 擦除覆盖 |
| [wipeOff] | 215 | 清除擦除层 |
| [wipeFilter] | 250 | 擦除花式遮罩（cinema/circleIn/openEye…） |
| [flashin] | 1,231 | 闪光转入 |
| [flashout] | 48 | 闪光转出 |
| [flashOff] | 145 | 清除闪光层 |
| [maskin] | 156 | 遮罩淡入（黑/白） |
| [maskout] | 73 | 遮罩淡出 |
| [stretchin] | 4 | 画布拉伸入场 |
| [stretchout] | 1 | 画布拉伸出场 |
| [subStretch] | 1 | 子层拉伸开关 |
| [blur] | 523 | 画面模糊（类型 强度 参数） |
| [blurOff] | 507 | 解除模糊 |
| [capture] | 14 | 捕获当前画面到捕获纹理 |
| [captureRelease] | 1 | 释放捕获纹理 |
| [shake] | 2,426 | 屏幕震动（X,Y 周期 时长） |
| [shakeStop] | 331 | 停止屏幕震动 |
| [messageShake] | 635 | 消息窗震动 |
| [messageShakeStop] | 29 | 停止消息窗震动 |
| [endFade] | 1 | 结局淡出（white 等） |

**角色管理（详见"角色管理"章）**（合计 394,090 次）

| 命令 | 词频 | 语义 |
|---|---:|---|
| [charaSet] | 26,798 | 建/换角色：槽位 图像ID 位置 显示名 |
| [charaPut] | 11,546 | 把已有角色放到坐标/位置 |
| [charaPutFSL] | 130 | 放到左侧全屏延展区 |
| [charaPutFSR] | 128 | 放到右侧全屏延展区 |
| [charaPutFSSideL] | 7 | 放到侧左延展区 |
| [charaPutFSSideR] | 14 | 放到侧右延展区 |
| [charaFace] | 115,973 | 切表情（Face.Type 索引） |
| [charaFaceFade] | 2,066 | 表情交叉淡化 |
| [charaFadein] | 74,320 | 角色淡入（含位置变体） |
| [charaFadeout] | 76,808 | 角色淡出 |
| [charaFadeTime] | 1,822 | 设置该角色后续淡入淡出时长 |
| [charaFadeinFSL] | 1,611 | 左侧延展区淡入 |
| [charaFadeinFSR] | 1,659 | 右侧延展区淡入 |
| [charaFadeinFSSideL] | 158 | 侧左淡入 |
| [charaFadeinFSSideR] | 189 | 侧右淡入 |
| [charaFadeinFSLNotNotch] | 6 | 左侧淡入（避开刘海安全区） |
| [charaFadeinFSRNotNotch] | 6 | 右侧淡入（避开刘海安全区） |
| [charaMove] | 9,030 | 绝对坐标移动 |
| [charaMoveEase] | 2,578 | 带缓动的移动 |
| [charaMoveReturn] | 1,464 | 移回槽位原坐标 |
| [charaMoveReturnEase] | 2 | 带缓动移回 |
| [charaMoveFSL] | 369 | 左延展区移动 |
| [charaMoveFSR] | 345 | 右延展区移动 |
| [charaMoveFSSideL] | 44 | 侧左移动 |
| [charaMoveFSSideR] | 81 | 侧右移动 |
| [charaMoveEaseFSL] | 72 | 左延展区缓动移动 |
| [charaMoveEaseFSR] | 80 | 右延展区缓动移动 |
| [charaMoveEaseFSSideL] | 7 | 侧左缓动移动 |
| [charaMoveEaseFSSideR] | 26 | 侧右缓动移动 |
| [charaMoveReturnFSL] | 123 | 从左延展区移回 |
| [charaMoveReturnFSR] | 125 | 从右延展区移回 |
| [charaMoveReturnFSSideL] | 23 | 从侧左移回 |
| [charaMoveReturnFSSideR] | 25 | 从侧右移回 |
| [charaMoveReturnEaseFSL] | 1 | 左延展区缓动移回 |
| [charaMoveReturnEaseFSR] | 1 | 右延展区缓动移回 |
| [charaMoveScale] | 1,419 | 缩放动画 |
| [charaMoveScaleEase] | 441 | 带缓动缩放动画 |
| [charaScale] | 15,860 | 设置缩放倍率 |
| [charaDepth] | 21,768 | 设置排序层级 |
| [charaLayer] | 8,269 | 设置渲染子层（normal/#A/#B/#mask） |
| [charaRoll] | 337 | 设置旋转角度（可带旋转中心） |
| [charaRollAxis] | 71 | 绕指定轴旋转 |
| [charaRollMove] | 28 | 旋转动画 |
| [charaRollMoveEx] | 8 | 扩展旋转（带位移） |
| [charaShake] | 2,766 | 角色震动 |
| [charaShakeStop] | 204 | 停止角色震动 |
| [charaCrossFade] | 476 | 双网格交叉淡化换装 |
| [charaChange] | 149 | 整体换立绘（kind 控制过渡方式） |
| [charaClear] | 6 | 从舞台移除角色 |
| [charaCutin] | 16 | 切入特写（方向/时长） |
| [charaCutout] | 8 | 切出特写 |
| [charaAttack] | 53 | 攻击动作演出 |
| [charaShadow] | 49 | 角色阴影开关 |
| [charaFilter] | 890 | 角色滤镜（名称 颜色） |
| [charaEffect] | 4,657 | 角色特效（bit_talk_* 等） |
| [charaEffectStop] | 1,829 | 停止角色特效 |
| [charaEffectDestroy] | 1,006 | 销毁角色特效 |
| [charaEffectStart] | 8 | 启动已备特效 |
| [charaEffectPause] | 8 | 暂停角色特效 |
| [charaEffectEdgeBlur] | 178 | 边缘模糊+描边色 |
| [charaEffectEdgeBlurStart] | 7 | 启动边缘模糊 |
| [charaEffectEdgeBlurStop] | 66 | 停止边缘模糊 |
| [charaEffectEdgeBlurPause] | 7 | 暂停边缘模糊 |
| [charaEffectEdgeBlurDestroy] | 118 | 销毁边缘模糊 |
| [charaSpecialEffect] | 1,287 | 特殊演出（appearance/flash/enemyErasure…） |
| [charaSpecialEffectStop] | 7 | 停止特殊演出 |
| [charaBackEffect] | 49 | 角色背后特效 |
| [charaBackEffectStop] | 27 | 停止背后特效 |
| [charaBackEffectDestroy] | 10 | 销毁背后特效 |
| [charaRelativeLoopMove] | 39 | 相对偏移循环移动（呼吸/悬浮） |
| [charaRelativeLoopMoveStop] | 31 | 停止循环移动 |
| [imageSet] | 2,028 | 图片槽位设置（Kind=IMAGE） |
| [verticalImageSet] | 30 | 竖图槽位 |
| [horizontalImageSet] | 4 | 横图槽位 |
| [equipSet] | 4 | 灵基外观槽位（Kind=EQUIP） |
| [masterSet] | 50 | 主角槽位设置（男女双 ID） |
| [masterImageSet] | 18 | 主角图片（男女双 ID） |
| [communicationChara] | 131 | 通讯立绘（id 姿势 表情 位置 形态） |
| [communicationCharaLoop] | 691 | 通讯立绘（带循环位） |
| [communicationCharaFace] | 528 | 通讯立绘切表情 |
| [communicationCharaClear] | 814 | 清除通讯立绘 |
| [communicationCharaStop] | 3 | 停止通讯立绘 |

**音频（详见"音频"章）**（合计 81,776 次）

| 命令 | 词频 | 语义 |
|---|---:|---|
| [bgm] | 12,478 | 播放 BGM（名 音量 淡入） |
| [bgmStop] | 9,146 | 停止 BGM（带淡出） |
| [bgmStopEnd] | 228 | 停止 BGM 并等待完成 |
| [se] | 24,080 | 播放音效 |
| [seStop] | 11,506 | 停止音效 |
| [seVolume] | 10,256 | 音效音量 |
| [seLoop] | 132 | 循环音效 |
| [seContinue] | 64 | 跨消息持续音效 |
| [seContinueStop] | 25 | 停止持续音效 |
| [seContinueVolume] | 6 | 调整持续音效音量 |
| [cueSe] | 5,767 | 播放 CRI cue 音效 |
| [cueSeStop] | 1,686 | 停止 cue 音效 |
| [cueSeVolume] | 1,034 | cue 音效音量 |
| [cueSeContinue] | 32 | 跨消息 cue 音效 |
| [cueSeContinueStop] | 20 | 停止跨消息 cue |
| [cueSeContinueVolume] | 14 | 调整跨消息 cue 音量 |
| [soundStopAll] | 4,929 | 停止全部声音 |
| [soundStopAllEnd] | 255 | 停止全部声音并等待完成 |
| [soundStopAllFade] | 32 | 全部声音带淡出停止 |
| [voice] | 62 | 播放语音 |
| [voiceStop] | 5 | 停止语音 |
| [jingle] | 1 | 播放 jingle 短曲 |
| [tVoice] | 18 | 测试/临时语音等待 |

**摄像机（详见"摄像机"章）**（合计 4,703 次）

| 命令 | 词频 | 语义 |
|---|---:|---|
| [cameraMove] | 2,512 | 镜头平移 |
| [cameraMoveEase] | 172 | 带缓动镜头平移 |
| [cameraHome] | 454 | 镜头复位 |
| [cameraFilter] | 356 | 镜头滤镜（darkred 等） |
| [cameraRoll] | 2 | 镜头旋转 |
| [cameraRollMove] | 20 | 镜头旋转动画 |
| [enableFullScreen] | 1,187 | 解除 16:9 遮幅（全屏延展） |

**影片与插入动画（详见"影片/动画"章）**（合计 886 次）

| 命令 | 词频 | 语义 |
|---|---:|---|
| [criMovie] | 181 | 播放 CRI 视频 |
| [movie] | 1 | 播放影片（旧形式） |
| [insertionAnimationSetFSSideR] | 1 | 右侧插入动画装载 |
| [insertionAnimationStart] | 1 | 开始插入动画 |
| [insertionAnimationEnd] | 1 | 结束插入动画 |
| [overlayFadein] | 650 | 叠加层淡入（槽位 时长 偏移） |
| [masterScene] | 50 | 主角场景图切换（男女双 ID） |
| [masterNameWidth] | 1 | 主角名牌宽度设置 |

**子摄像机与子渲染层（详见"子摄像机系统"章）**（合计 11,626 次）

| 命令 | 词频 | 语义 |
|---|---:|---|
| [subCameraOn] | 908 | 开子相机 |
| [subCameraOff] | 603 | 关子相机 |
| [subCameraMove] | 54 | 子相机平移 |
| [subCameraMoveEase] | 12 | 子相机缓动平移 |
| [subCameraHome] | 12 | 子相机复位 |
| [subCameraFilter] | 1,948 | 子相机滤镜 |
| [subCameraRoll] | 56 | 子相机旋转 |
| [subCameraRollMove] | 4 | 子相机旋转动画 |
| [subRenderFadein] | 1,880 | 子层淡入 |
| [subRenderFadeout] | 2,357 | 子层淡出 |
| [subRenderFadeinFSL] | 154 | 子层左延展区淡入 |
| [subRenderFadeinFSR] | 162 | 子层右延展区淡入 |
| [subRenderFadeinFSSideL] | 133 | 子层侧左淡入 |
| [subRenderFadeinFSSideR] | 165 | 子层侧右淡入 |
| [subRenderMove] | 512 | 子层移动 |
| [subRenderMoveEase] | 374 | 子层缓动移动 |
| [subRenderMoveFSL] | 70 | 子层左延展区移动 |
| [subRenderMoveFSR] | 103 | 子层右延展区移动 |
| [subRenderMoveFSSideL] | 67 | 子层侧左移动 |
| [subRenderMoveFSSideR] | 90 | 子层侧右移动 |
| [subRenderMoveEaseFSL] | 35 | 子层左缓动移动 |
| [subRenderMoveEaseFSR] | 48 | 子层右缓动移动 |
| [subRenderMoveEaseFSSideL] | 29 | 子层侧左缓动移动 |
| [subRenderMoveEaseFSSideR] | 54 | 子层侧右缓动移动 |
| [subRenderMoveScale] | 24 | 子层缩放动画 |
| [subRenderMoveScaleEase] | 29 | 子层缓动缩放 |
| [subRenderScale] | 783 | 子层缩放 |
| [subRenderDepth] | 859 | 子层层级 |
| [subRenderShake] | 16 | 子层震动 |
| [subRenderShakeStop] | 2 | 停止子层震动 |
| [subBlur] | 38 | 子层模糊 |
| [subBlurOff] | 36 | 解除子层模糊 |
| [subBlur2] | 5 | 二代子层模糊（透镜类） |
| [subBlur2Off] | 4 | 解除二代子层模糊 |

**演出对象与特殊效果（详见"视觉效果/其他命令"章）**（合计 6,647 次）

| 命令 | 词频 | 语义 |
|---|---:|---|
| [effect] | 3,164 | 场景特效（bit_talk_*） |
| [effectStop] | 778 | 停止特效 |
| [effectDestroy] | 652 | 销毁特效 |
| [effectStart] | 1 | 启动特效 |
| [effectPause] | 1 | 暂停特效 |
| [effectForceStop] | 19 | 强制停止特效 |
| [fowardEffect] | 1,303 | 前景特效 |
| [fowardEffectStart] | 4 | 启动前景特效 |
| [fowardEffectStop] | 192 | 停止前景特效 |
| [fowardEffectPause] | 4 | 暂停前景特效 |
| [fowardEffectDestroy] | 212 | 销毁前景特效 |
| [backEffect] | 143 | 背景侧特效 |
| [backEffectStop] | 67 | 停止背景特效 |
| [backEffectDestroy] | 35 | 销毁背景特效 |
| [effectmessage] | 12 | 特效文字消息（图/文本合成） |
| [effectmessageStop] | 12 | 停止特效文字 |
| [specialEffect] | 8 | 特殊演出（cutting 等） |
| [distortionstart] | 13 | 画面扭曲（6 参数） |
| [distortionstop] | 11 | 停止扭曲 |
| [fsmObjSet] | 3 | 装载 FSM 演出对象（PlayMaker） |
| [fsmObjLayer] | 3 | FSM 对象层级 |
| [fsmObjSetState] | 3 | FSM 跳转状态 |
| [fsmObjSendEvent] | 3 | FSM 发送事件 |
| [fsmObjDestroy] | 3 | 销毁 FSM 对象 |
| [useSimpleMeshFigure] | 1 | 使用简化网格立绘 |

**控制流与分支（详见"控制流"章）**（合计 4,912 次）

| 命令 | 词频 | 语义 |
|---|---:|---|
| [label] | 1,095 | 定义跳转标签 |
| [branch] | 785 | 条件跳转 |
| [branchQuestClear] | 27 | 任务已通关分支 |
| [branchQuestNotClear] | 24 | 任务未通关分支 |
| [branchMaterial] | 26 | 素材条件分支 |
| [branchNotMaterial] | 0 | 无素材反向分支 |
| [branchHaveSvtEquip] | 0 | 持有特定灵基分支 |
| [branchNotHaveSvtEquip] | 0 | 未持有反向分支 |
| [branchRouteSelect] | 18 | 路线选择分支 |
| [branchNotRouteSelect] | 14 | 路线反向分支 |
| [branchRouteSelectCount] | 22 | 按选择次数分支 |
| [branchSetGrandSvtCount] | 2 | 冠位从者计数分支 |
| [masterBranch] | 137 | 主角性别分支 |
| [flag] | 159 | 旗标开关（on/off 判断标签） |
| [ifClear] | 3 | 任务通关条件块 |
| [else] | 3 | 条件块否决支 |
| [endIf] | 3 | 条件块结束 |
| [end] | 2,594 | 场景结束 |

**界面与对话窗（详见"UI 控制"章）**（合计 97,966 次）

| 命令 | 词频 | 语义 |
|---|---:|---|
| [charaTalk] | 70,650 | 对话窗模式切换（on/off/槽位组/spot） |
| [messageOff] | 27,236 | 隐藏消息窗 |
| [talkNameBack] | 33 | 说话者名牌背景图 |
| [backlogStart] | 16 | 手动开始 BackLog 记录段 |
| [backlogEnd] | 16 | 结束 BackLog 记录段 |
| [messageSpeedForcedNormal] | 14 | 强制正常文字速度 |
| [messageChange] | 1 | 消息窗形态切换（cinema 等） |

### 场景/背景



#### 切换场景

```
[scene 场景ID 交叉淡化时长? 画面模式?]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 场景ID | 整数 | 背景/场景资源标识 |
| 交叉淡化时长 | 浮点数，可选 | 场景切换时的过渡时间；部分旧脚本省略 |
| 画面模式 | 字符串，可选 | 当前样本出现 `FULLSCREEN_IMAGE_DEVICE_WIDTH` 等设备/画面模式值 |

**示例**：
```
[scene 104100]
[scene 95207]
[scene 95202 0.5]
[scene 55600 0.4 FULLSCREEN_IMAGE_DEVICE_WIDTH]
```

Atlas 解析器只直接取场景 ID；其代码把命令后的第 3 个参数（`parameters[3]`）按 `crossFadeDurationSec` 读取，而不是按本地样本常见签名把第 2 个参数直接当作过渡时长。对其余参数也不做完整语义校验。原始脚本中的扩展形式应保留，不要据解析器的简化模型删去参数。

#### 命名场景

```
[sceneSet 槽位 场景ID 模式 参数?]
```

**示例**：
```
[sceneSet Q 142200 1]
[sceneSet R 142200 1]
[sceneSet G 120901 1 1]
```

Atlas 解析器把前三个参数分别保存为槽位、背景 ID 和 `baseFace`；第四个及以后参数在该展示实现中未建模。

#### 淡入淡出

```
[fadein 颜色 时长? 参数?]
[fadeout 颜色 时长 参数?]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 颜色 | 字符串/十六进制 | `black`, `white`, 或十六进制颜色如 `ffd700`, `f93769`, `ff000080` 等 |
| 时长 | 浮点数 | 秒数 |

**常用颜色值**：

| 颜色值 | 说明 |
|--------|------|
| `black` | 黑色（最常用） |
| `white` | 白色 |
| `ffd700` | 金色 |
| `f93769` | 粉红色 |
| `ff5a36` / `ff3333` | 橙红/亮红 |
| `ff000080` | 半透明红色 |
| `9f0000` / `800000` | 深红 |
| `dc143c` / `dd1f30` | 猩红 |
| `ffffe4` / `fafad2` | 米黄 |
| `dff2fc` | 极浅蓝 |
| `502749` | 深紫 |
| `c0c0c0` | 银灰 |
| `424242` | 深灰 |
| `ffa07a` / `b3b8bb` | 浅橙/灰蓝 |
| `dedcdf` | 浅灰 |

**示例**：
```
[fadein black 1.0]
[fadeout black 1.5]
[fadein white 2.0]
[fadeout white 0.5]
[fadein ffd700 1.0]
[fadeout f93769 0.8]
```

#### 擦除过渡

```
[wipein 方向 时长 参数?]
[wipeout 方向 时长 参数?]
[wipeFilter 方向/模式 时长 参数]
```

**方向类型**：

| 方向 | 说明 | 出现频次 |
|------|------|----------|
| `leftToRight` | 从左到右 | 高 |
| `rightToLeft` | 从右到左 | 高 |
| `leftDownToRightUp` | 左下到右上（对角线） | 中 |
| `rightUpToLeftDown` | 右上到左下（对角线） | 中 |
| `leftUpToRightDown` | 左上到右下（对角线） | 低 |
| `rightDownToLeftUp` | 右下到左上（对角线） | 低 |
| `circleIn` | 圆形收缩 | 高 |
| `circleOut` | 圆形扩散 | 低 |
| `openEye` | 睁眼效果 | 中 |
| `downToUp` | 从下到上 | 中 |
| `upToDown` | 从上到下 | 中 |
| `rollRight` | 向右滚动 | 中 |
| `rollLeft` | 向左滚动 | 中 |
| `rollFlashRight` | 向右滚动闪光 | 低 |
| `rectangleStripLeftToRight` | 三条矩形从左到右 | 高 |
| `rectangleStripRightToLeft` | 三条矩形从右到左 | 高 |
| `rectangleStripUpToDown` | 三条矩形从上到下 | 中 |
| `rectangleStripDownToUp` | 三条矩形从下到上 | 中 |
| `rectangleLeftToRight` | 单矩形从左到右 | 低 |
| `rectangleRightToLeft` | 单矩形从右到左 | 低 |
| `sideBlind` | 百叶窗侧向 | 低 |
| `verBlind` | 百叶窗垂直 | 低 |
| `cutVer` | 垂直切割 | 低 |
| `cutSide` | 侧向切割 | 低 |
| `cutAcross` | 横向切割 | 低 |
| `noise` | 噪点过渡 | 低 |
| `windmill` | 风车旋转 | 低 |
| `uzumaki` | 涡旋 | 低 |
| `uzumakiBig` | 大涡旋 | 低 |
| `moya` | 朦胧 | 低 |
| `magic` | 魔法阵 | 低 |
| `gunya` | 抖动 | 低 |
| `clash` | 碰撞 | 低 |
| `fire` | 火焰 | 低 |
| `sazanami` | 涟漪 | 低 |
| `mozaFade` | 马赛克淡出 | 低 |
| `mezo` | 马赛克 | 低 |
| `diaOut` | 菱形扩散 | 低 |
| `polka02` / `polka04` | 圆点图案 | 低 |
| `heartOut` / `heartOutBig` | 心形扩散 | 低 |
| `guruguru` | 旋转 | 低 |
| `damage` | 伤害闪烁 | 低 |
| `square` | 方形效果 | 低 |

`cinema` 等模式主要通过 `wipeFilter` 使用。命令名和方向值建议保持脚本中的大小写；当前样本使用 camelCase 形式。

**示例**：
```
[wipein rightToLeft 1.0 1.0]
[wipeout circleIn 0.5 1]
[wipein openEye 1.0 1.0]
[wipeFilter cinema 0.5 0]
[wipein rollRight 0.5 1]
[wipeout rectangleStripLeftToRight 0.5 1]
```

#### 遮罩

```
[maskin 颜色 时长]
[maskout 颜色 时长]
```

**示例**：
```
[maskin black 1.0]
[maskout white 2.0]
```

#### 拉伸效果

```
[stretchin 类型 时长 参数]
[stretchout 类型 时长 参数]
```

**示例**：
```
[stretchin full 2.0 2.0]
[stretchout full 3.0 3.0]
```

---

### 角色管理

#### 设置角色

```
[charaSet 槽位 角色ID 初始表情 名称]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 槽位 | 字母 | A-Z |
| 角色ID | 整数 | 角色资源 ID |
| 初始表情 | 整数 | 角色的初始表情编号；角色仍需通过 `charaPut` 或 `charaFadein` 登场 |
| 名称 | 字符串 | 显示名称 |

**示例**：
```
[charaSet A 1098158200 1 シオン]
[charaSet B 98115000 1 通信用]
[charaSet A 98001000 1 マシュ_制服]
```

#### 角色表情

```
[charaFace 槽位 表情编号]
[charaFaceFade 槽位 表情编号 时长]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 表情编号 | 整数 | 0=默认, 1-30+ 不同表情 |
| 时长 | 浮点数 | 过渡时间（仅 Fade 版） |

**示例**：
```
[charaFace A 12]                # 瞬间切换表情
[charaFace A 0]                 # 恢复默认表情
[charaFaceFade A 20 0.3]        # 平滑过渡到新表情
[charaFaceFade Q 35 0.3]
[charaFaceFade A 27 0.2]
```

#### 角色淡入淡出

```
[charaFadein 槽位 时长 X,Y?]
[charaFadeout 槽位 时长]
```

`charaFadein` 传入 `X,Y` 时使用指定坐标；也可以传入位置编号。Atlas 解析器当前使用的编号映射为：`0=(-256,0)`、`1=(0,0)`、`2=(256,0)`、`3=(-438,0)`、`4=(-512,0)`、`5=(438,0)`、`6=(512,0)`；省略坐标时由客户端决定默认位置，展示解析器中的位置字段保持未定义。

**示例**：
```
[charaFadein A 0.4 1]
[charaFadeout A 0.1]
[charaFadein A 0.1 2]
```

#### 角色位置

**（客户端逆向确认）** 脚本中的 `X,Y` 被引擎原样写入 NGUI 节点的 `Transform.localPosition`（`ScriptPosition.GetPosition(float,float)` 是恒等函数，仅补 z=0），**没有任何单位换算或缩放系数**。因此坐标单位就是合成舞台的世界单位，等于虚拟舞台 1024×576 的像素：

- `(0,0)` = **合成画面中心**（NGUI 相机看向原点）；`X` 负值向左、正值向右；`Y` 正值向上、负值向下
- 16:9 舞台宽度 1024：`X` 可用范围约 `-512 ~ +512`（引擎槽位表里 `-512/+512` 正是画面左右边缘）；高度 576：`Y` 约 `-288 ~ +288`
- 宽屏（21:9）下舞台横向扩展到约 1346（`PICTURE_FRAME_SPRITE_WIDTH_16_9 = 1025`、`PICTURE_FRAME_SPRITE_WIDTH_21_9 = 1346`，含 1px 出血）；长屏设备默认强制 16:9 遮幅（`ScriptManager.defaultForceObi_16_9 = true`），`[charaMoveFSL/FSR]` 等变体用于把角色移入遮幅外延区域
- 角色缩放（`charaScale`）只改节点 scale，**不会改变坐标单位**；角色最终合成的坐标锚点位于画面中心

`[charaSet]`/`[charaPut]` 的位置参数是**槽位索引**，由引擎查静态表 `ScriptPosition.positionList`（`Vector2[7]`，越界回落到 0 号位）：

| 槽位 | 坐标 (X,Y) | 含义 |
|------|-----------|------|
| 0 | (-256, 0) | 左（左三分位） |
| 1 | (0, 0) | 中央 |
| 2 | (256, 0) | 右（右三分位） |
| 3 | (-438, 0) | 最左（画面内侧） |
| 4 | (-512, 0) | 画面左缘 |
| 5 | (438, 0) | 最右（画面内侧） |
| 6 | (512, 0) | 画面右缘 |

样本统计：`charaSet` 第三参数绝大多数为 `1`（26,615 次），`0` 与 `2` 各约百次——单角色居中、双角色左右三分位是基本构图；3-6 号槽位由特殊演出使用。另有 `ScriptPosition.charaOffsetList`（3 项，当前全 0）作为每槽位微调偏移的预留接口。

```
[charaMove 槽位 X,Y 时长]
[charaMoveEase 槽位 X,Y 时长 缓动函数]
[charaMoveReturn 槽位 X,Y 时长]
[charaMoveReturnEase 槽位 X,Y 时长 缓入函数 缓出函数]
[charaMoveFSL 槽位 X,Y 时长]               # 左侧角色移动 (Full Screen Left)
[charaMoveFSR 槽位 X,Y 时长]               # 右侧角色移动 (Full Screen Right)
[charaMoveEaseFSL 槽位 X,Y 时长 缓动函数]  # 左侧缓动移动
[charaMoveEaseFSR 槽位 X,Y 时长 缓动函数]  # 右侧缓动移动
[charaMoveFSSideL 槽位 X,Y 时长]           # 侧左移动 (Full Screen Side Left)
[charaMoveFSSideR 槽位 X,Y 时长]           # 侧右移动 (Full Screen Side Right)
[charaMoveEaseFSSideL 槽位 X,Y 时长 缓动函数]  # 侧左缓动移动
[charaMoveEaseFSSideR 槽位 X,Y 时长 缓动函数]  # 侧右缓动移动
[charaMoveReturnFSL 槽位 X,Y 时长]         # 左侧返回原位
[charaMoveReturnFSR 槽位 X,Y 时长]         # 右侧返回原位
[charaMoveReturnFSSideL 槽位 X,Y 时长]     # 侧左返回原位
[charaMoveReturnFSSideR 槽位 X,Y 时长]     # 侧右返回原位
[charaMoveReturnEaseFSL 槽位 X,Y 时长 缓入 缓出]  # 左侧缓动返回
[charaMoveReturnEaseFSR 槽位 X,Y 时长 缓入 缓出]  # 右侧缓动返回
```

**缓动函数（当前样本中观察到）**：`easeInBack`, `easeInCubic`, `easeInExpo`, `easeInOutCubic`, `easeInOutExpo`, `easeInOutQuad`, `easeInOutQuart`, `easeInOutQuint`, `easeInOutSine`, `easeInQuad`, `easeInSine`, `easeOutBack`, `easeOutCirc`, `easeOutCubic`, `easeOutElastic`, `easeOutExpo`, `easeOutQuad`, `easeOutQuart`, `easeOutQuint`, `easeOutSine`

部分 FSL/FSR/Side 变体还允许在时长后追加缓动函数，例如 `[charaMoveFSR B 260,0 0.3 easeOutQuint]`。

**示例**：
```
[charaMove G 0,0 0.3]
[charaMoveEase V 0,-350 4.0 easeOutQuad]
[charaMoveReturn G 200,-5 0.6]
[charaMoveFSL E -250,0 10.0]
[charaMoveFSR D 236,0 0.6]
[charaMoveReturnEase G 0,10 0.4 easeOutSine easeInSine]
```

Atlas 解析器直接建模的是基础形式 `[charaMove 槽位 X,Y 时长]`；`Ease`、FSL/FSR/Side 和 Return 变体来自原始脚本样本，当前展示解析器不会把它们转换为对应的专用类型。

#### 角色缩放

```
[charaScale 槽位 缩放倍率]
[charaMoveScale 槽位 倍率 时长]
[charaMoveScaleEase 槽位 倍率 时长 缓动函数]
```

**示例**：
```
[charaScale C 1.1]
[charaScale T 1.01]
[charaMoveScale R 2.5 1.0]
```

#### 角色旋转

```
[charaRoll 槽位 角度 X,Y?]                 # 设置旋转角度
[charaRollAxis 槽位 轴 角度 时长]         # 绕指定轴旋转
[charaRollMove 槽位 时长 角度]            # 旋转动画
[charaRollMoveEx 槽位 时长 角度 X,Y?]     # 扩展旋转（带位移）
```

`charaRoll` 可带可选的旋转中心坐标；`charaRollAxis` 和 `charaRollMoveEx` 还存在额外参数变体，具体含义尚未完全确认。

**示例**：
```
[charaRoll X 31]
[charaRollAxis K y 180 0.1]
[charaRollMove O 0.1 0]
[charaRollMoveEx O 6.5 1440 0,-200]
[charaRollMoveEx J 0 -10 0,0]
```

#### 角色深度

```
[charaDepth 槽位 层级]
```

**示例**：
```
[charaDepth B 1]
[charaDepth A 2]
[charaDepth C 3]
```

#### 角色切换

```
[charaChange 槽位 新ID 新表情 过渡方式 时长]
[charaCrossFade 槽位 新ID 新表情 时长]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 新ID | 整数 | 新的角色资源 ID |
| 新表情 | 整数 | 切换后的表情编号，不改变角色当前是否在场 |
| 过渡方式 | 字符串 | `fade`, `normal` |
| 时长 | 浮点数 | 过渡时间 |

**示例**：
```
[charaChange A 98020000 1 fade 2]
[charaChange J 9018002 13 normal 0.1]
[charaCrossFade A 1098158210 6 0.2]
[charaCrossFade F 1098329920 36 1.1]
```

Atlas 解析器对 `charaChange` 读取“槽位、角色 ID、表情、过渡方式、时长”，对 `charaCrossFade` 读取“槽位、角色 ID、表情、时长”；其他切换变体不在该版本的专用类型中。

#### 角色效果

```
[charaEffect 槽位 效果名 X,Y? 层?]
[charaEffectStop 槽位 效果名? X,Y? 层?]
[charaEffectDestroy 槽位 效果名? X,Y? 层?]
[charaEffectPause 槽位 效果名 X,Y? 层?]
[charaEffectStart 槽位 效果名?]
```

**常用效果名**：
- `bit_talk_noise`, `bit_talk_10`, `bit_talk_12`, `bit_talk_13`
- `bit_talk_36`, `bit_talk_41`
- `bit_talk_10_LowLevel`

**示例**：
```
[charaEffect B bit_talk_noise]
[charaEffectStop G bit_talk_10]
[charaEffectDestroy S bit_talk_4elements_light]
[charaEffectPause J bit_talk_gram_slash_03_fs 0,50 H]
[charaEffectStart J bit_talk_gram_slash_03_fs]
```

Atlas 解析器对 `charaEffect`/`charaEffectStop` 只直接读取槽位和效果名；原始脚本中出现的坐标、层级以及 `Pause`/`Start`/`Destroy` 变体应按引擎样本处理。

#### 角色边缘模糊

```
[charaEffectEdgeBlur 槽位 颜色1 颜色2 强度 模糊度]
[charaEffectEdgeBlurDestroy 槽位]
[charaEffectEdgeBlurStop 槽位]
[charaEffectEdgeBlurPause 槽位 颜色1 颜色2 强度 模糊度]  # 暂停并改变参数
[charaEffectEdgeBlurStart 槽位]                            # 恢复播放
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 槽位 | 字母 | A-Z |
| 颜色1 | 十六进制 | 边缘颜色 1 |
| 颜色2 | 十六进制 | 边缘颜色 2 |
| 强度 | 整数/浮点数 | 效果强度 |
| 模糊度 | 整数/浮点数 | 模糊程度 |

`charaEffectEdgeBlur`、`charaEffectEdgeBlurStop` 和 `charaEffectEdgeBlurDestroy` 在样本中都存在省略参数的变体；上面的完整形式用于需要显式设置参数的场景。

**示例**：
```
[charaEffectEdgeBlur A ffffff ffffff 4 1]
[charaEffectEdgeBlurDestroy A]
[charaEffectEdgeBlurPause A FFF9A5 FFF9A5 4 3.0]
[charaEffectEdgeBlurStart A]
```

#### 角色滤镜

```
[charaFilter 槽位 模式 颜色?]
```

**参数说明**：
| 参数 | 类型 | 说明 |
|------|------|------|
| 槽位 | 字母 | A-Z |
| 模式 | 字符串 | `silhouette` — 剪影效果 / `normal` — 恢复正常显示 |
| 颜色 | 十六进制，可选 | 剪影颜色；`normal` 模式可以省略 |

**示例**：
```
[charaFilter G silhouette 00000080]
[charaFilter G normal]
[charaFilter H silhouette 00000000]
[charaFilter I silhouette 00000080]
[charaFilter D silhouette FFFFFF00]
[charaFilter F normal 16161680]
```

Atlas 解析器把模式类型声明为 `silhouette` 或 `normal`，并把颜色作为附加字符串读取；脚本中的具体颜色格式仍由客户端解释。

#### 角色阴影

```
[charaShadow 槽位 开关]
```

控制角色是否显示阴影。

**示例**：
```
[charaShadow F true]     # 显示阴影
[charaShadow F false]    # 隐藏阴影
[charaShadow H true]
[charaShadow H false]
```

#### 角色震动

角色的抖动效果（不同于屏幕震动）。

```
[charaShake 槽位 幅度 X强度 Y强度 时长]
[charaShakeStop 槽位]
```

**示例**：
```
[charaShake A 0.05 3 3 0.25]
[charaShake D 0.05 3 3 0.4]
[charaShake E 0.05 3 3 0.15]
[charaShakeStop H]
[charaShakeStop A]
```

#### 角色对话标记

```
[charaTalk 槽位]                    # 指定单个说话角色
[charaTalk on]                      # 开启对话模式（场景过渡后重置对话状态）
[charaTalk depthOn]                 # 开启深度显示（子渲染层角色可见）
[charaTalk depthOff]                # 关闭深度显示
[charaTalk A,B]                     # 双角色同时说话
[charaTalk A,B,C]                   # 三角色同时说话
[charaTalk A,B,C,D,E,F]             # 多角色同时说话
[charaTalk D,L,C,N,O,B,M,K]         # 8人同时说话（多人场景）
```

**示例**：
```
[charaTalk A]
[charaTalk on]
[charaTalk depthOn]
[charaTalk B,C]                     # B和C同时说话
[charaTalk D,L,C,N,O,B,M,K]         # 8人同时说话（多人场景）
```

当前样本观察到的多人形式最多包含 8 个槽位；引擎的硬性上限尚未确认，不应写成“最多 6 个”。

Atlas 解析器把 `A,B` 这样的多人值作为一个字面 `speakerCode` 保存，并不会在该层拆成多个槽位；多人演出是原始 DSL 的事实，展示层是否完整渲染属于另一个问题。

#### 多角色对话标记（spot）

```
＠角色名=spot[槽位列表]
```

当多个角色同时说出相同台词时使用此标记，`spot` 内包含所有参与角色的槽位。

**示例**：
```
＠ダ・ヴィンチ＆ゴルドルフ=spot[A,B]
ちょっと待ったぁぁぁぁぁ！[k]

＠デイノニクス11兄弟たち=spot[C,D]
クェーー！無茶も休み休みクェー！[k]

＠オセロトル=spot[A,B,C,D,E,F]
[FFFFFF]？[-][k]

＠一同=spot[D,L,C,N,O,B,M,K]
[line 6]（呆然）[k]
```

#### 角色图层

```
[charaLayer 槽位 模式]
```

**模式**：
- `normal` — 普通图层
- `main` — 主图层
- `sub #A` — 子渲染层 A（用于分屏/画中画）
- `sub #B` — 子渲染层 B
- `sub #C` — 子渲染层 C
- `sub #D` — 子渲染层 D
- `sub #mask` — 遮罩子渲染层

**示例**：
```
[charaLayer T sub #A]
[charaLayer O normal]
[charaLayer D sub #A]
[charaLayer E sub #C]
[charaLayer F sub #D]
[charaLayer G sub #mask]
[charaLayer H main]
```

#### 角色特殊效果

高级视觉效果，用于角色出现/消失、闪白、擦除等。

```
[charaSpecialEffect 槽位 效果类型 参数...]
[charaSpecialEffectStop 槽位]                    # 停止效果
[charaSpecialEffectStop 槽位 效果类型]            # 停止指定类型
[charaSpecialEffectStop 槽位 参数]                # 停止指定参数的效果
```

**效果类型一览**：

| 效果类型 | 功能 |
|----------|------|
| `appearance` | 角色显现（从透明到不透明） |
| `erasureReverse` | 反向擦除显现（从有到无的逆过程） |
| `flashErasure` | 闪白擦除消失 |
| `enemyErasure` | 敌人消失效果 |
| `erasure` | 擦除消失（淡出式） |
| `appearanceReverse` | 反向显现（从有到无） |
| `darkEnemyErasure` | 暗色敌人消失效果 |
| `wipeTimeRe` | 反向擦除时间控制 |
| `wipeTime` | 擦除时间控制 |
| `flash` | 闪光效果 |
| `wipe` | 擦除过渡 |

**常见参数说明**：
- 部分效果使用整数模式参数（常见为 `0` 或 `1`）
- 部分效果使用浮点时长
- 具体参数数量和含义依效果类型而定

不同效果类型的参数数量并不完全一致：样本中既有只写槽位和效果类型的形式，也有包含多个控制参数的形式。`参数1` 和“时长”不能推广到所有效果类型。

**示例**：
```
[charaSpecialEffect F appearance 0 1.0]           # 角色显现
[charaSpecialEffect A appearanceReverse 1 0.25]   # 反向显现
[charaSpecialEffect G flashErasure 1 1.7]         # 闪白消失
[charaSpecialEffect C erasure 1 1.0]              # 擦除消失
[charaSpecialEffect G erasureReverse 1 0.7]       # 反向擦除显现
[charaSpecialEffect G darkEnemyErasure 1 3]       # 暗色敌人消失
[charaSpecialEffect E flash 0 1]                  # 闪光
[charaSpecialEffect K wipeTime 1 2.0]             # 擦除时间控制
[charaSpecialEffect G wipeTimeRe 1 1.0]           # 反向擦除时间
[charaSpecialEffect H wipe 1 0.1]                 # 擦除过渡
[charaSpecialEffectStop E]
[charaSpecialEffectStop G flash]
[charaSpecialEffectStop A darkEnemyErasure]
```

Atlas 解析器没有直接建模 `charaSpecialEffect`；原始脚本中的效果类型和参数仍应按客户端样本解释。`charaEffect`/`charaEffectStop` 的解析器说明见上节。

#### 角色攻击动画

角色冲向目标的攻击动作。

```
[charaAttack 槽位 类型 X,Y 时长]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 类型 | 字符串 | 攻击类型（如 `normal`） |
| X,Y | 坐标 | 冲击位移 |
| 时长 | 浮点数 | 动画时间 |

**示例**：
```
[charaAttack D normal 250,0 0.25]
[charaAttack A normal 450,0 0.4]
[charaAttack B normal -200,0 0.2]
[charaAttack E normal 0,-898 14.0]
```

#### 角色切入/切出

特殊的角色出现/消失动画效果。

```
[charaCutin 槽位 方向 时长 参数]
[charaCutinPause 槽位 方向 时长 参数]
[charaCutout 槽位 时长]
```

**方向**：当前样本使用 `leftToRight`、`upToDown`、`circleIn`；解析器类型还声明 `leftDownToRightUp`、`rightUpToLeftDown`、`wormEaten`。`rightToLeft` 不应仅凭通用擦除命令的方向表推入 `charaCutin`。

`charaCutinPause` 与 `charaCutin` 共用参数，额外表示暂停式切入；这是 Atlas 解析器直接区分的两个命令名。

**示例**：
```
[charaCutin H leftToRight 0.1 1.0]
[charaCutin G leftToRight 0.25 0.0]
[charaCutin D upToDown 0.5 0.25]
[charaCutin E leftToRight 0.4 1.0]
[charaCutin F circleIn 1.0 1.0]
[charaCutout F 1.0]
[charaCutout E 0.4]
```

#### 角色背景效果

在角色背后显示的特殊效果（如光环、魔法阵等）。

```
[charaBackEffect 槽位 效果名 X,Y? 层?]
[charaBackEffectDestroy 槽位? 效果名? X,Y?]
[charaBackEffectStop 槽位? 效果名? 时长?]
```

**示例**：
```
[charaBackEffect K bit_talk_fire_wall -250,0]
[charaBackEffect A bit_talk_black_aura_tsk]
[charaBackEffect A bit_talk_lightning_01t]
[charaBackEffectDestroy K bit_talk_fire_wall]
[charaBackEffectStop A bit_talk_black_aura_tsk]
[charaBackEffectStop A bit_talk_lightning_01t 0.1]
```

#### 角色放置

将角色瞬间移动到指定位置（无动画）。

```
[charaPut 槽位 X,Y]                # 普通放置
[charaPutFSL 槽位 X,Y]             # 左侧放置 (Full Screen Left)
[charaPutFSR 槽位 X,Y]             # 右侧放置 (Full Screen Right)
[charaPutFSSideL 槽位 X,Y]         # 侧左放置 (Full Screen Side Left)
[charaPutFSSideR 槽位 X,Y]         # 侧右放置 (Full Screen Side Right)
```

样本中还存在少量非坐标参数形式的 `charaPut`，其参数含义尚未完全确认。

**示例**：
```
[charaPut B 0,0]
[charaPut B 1200,2000]             # 移出屏幕
[charaPutFSL G -240,0]
[charaPutFSR N 30,50]
[charaPutFSSideL N -375,-50]
[charaPutFSSideR K 450,-50]
```

Atlas 解析器直接建模 `charaPut` 和 `charaPutFSR`；其他 FSL/FSide 变体属于原始脚本命令族，展示解析器不会为它们创建对应的专用类型。

#### 角色淡入位置变体

```
[charaFadeinFSL 槽位 时长 位置]              # 左侧淡入 (Full Screen Left)
[charaFadeinFSR 槽位 时长 位置]              # 右侧淡入 (Full Screen Right)
[charaFadeinFSSideL 槽位 时长 X,Y]           # 侧左淡入 (Full Screen Side Left)
[charaFadeinFSSideR 槽位 时长 X,Y]           # 侧右淡入 (Full Screen Side Right)
[charaFadeinFSLNotNotch 槽位 时长 X,Y]       # 左侧淡入（无刘海屏适配）
[charaFadeinFSRNotNotch 槽位 时长 X,Y]       # 右侧淡入（无刘海屏适配）
```

**示例**：
```
[charaFadeinFSL L 0.1 0]
[charaFadeinFSR A 0.1 2]
[charaFadeinFSSideL F 0.1 -350,0]
[charaFadeinFSSideR A 0.1 390,0]
[charaFadeinFSLNotNotch K 0.2 -110,-105]
[charaFadeinFSRNotNotch L 0.2 270,-105]
```

#### 角色持续移动

角色的循环浮动动画，用于呼吸效果、悬浮效果等。

```
[charaRelativeLoopMove 槽位 模式 X,Y X2,Y2 时长1 时长2 参数]
[charaRelativeLoopMoveStop 槽位]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 模式 | 整数 | 移动模式 |
| X,Y | 坐标 | 起始偏移 |
| X2,Y2 | 坐标 | 结束偏移 |
| 时长1 | 浮点数 | 正向移动时间 |
| 时长2 | 浮点数 | 反向移动时间 |
| 参数 | 整数 | 额外参数 |

> **（客户端逆向确认）** 这里的 X,Y 确实是**相对当前基座位置的偏移**：引擎侧 `UIScriptChara` 持有 `moveRelativePositions: Vector2[]` / `isMoveRelativePosition` / `SetRelativePosition(Vector2)`，插值结果叠加在 `basePosition` 之上，不改动槽位坐标本身。这也是它能做"呼吸浮动"（如 `0,-2 → 0,0`）的原因。

**示例**：
```
[charaRelativeLoopMove N 2 0,-2 0,0 0.4 0.4 0]
[charaRelativeLoopMove K 2 0,-2 0,0 0.15 0.1 0]
[charaRelativeLoopMove D 2 0,-4 0,0 0.6 0.6 0]
[charaRelativeLoopMoveStop N]
[charaRelativeLoopMoveStop K]
```

部分脚本使用扩展参数形式（例如包含第三个坐标和额外时长/模式参数）；这些参数的确切语义尚未完全确认。

#### 角色淡出时间

```
[charaFadeTime 槽位 时长 透明度]
```

设置角色淡入/淡出的时间和透明度参数。Atlas 解析器把两个数分别保存为 `duration` 和 `alpha`；客户端对边界值（如 `0`、`1.0`）的具体含义仍以样本为准。

**示例**：
```
[charaFadeTime C 0 0.4]
[charaFadeTime R 0.2 0.5]
[charaFadeTime Y 0.4 0.5]
```

#### 清除角色

完全移除指定槽位的角色（包括其所有效果）。

```
[charaClear 槽位]
```

**示例**：
```
[charaClear F]
[charaClear B]
[charaClear G]
```

#### 装备设置

为角色设置装备/道具的显示。

```
[equipSet 槽位 装备ID 基准表情/索引 名称]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 装备ID | 整数 | 装备资源 ID |
| 基准表情/索引 | 整数 | Atlas 解析器字段名为 `baseFace`；不要直接解释为装备数量 |
| 名称 | 字符串 | 装备名称 |

**示例**：
```
[equipSet S 9402490 1 アトラス院]
[equipSet L 9402180 2 若返りの霊薬]
[equipSet E 9400780 2 モナ・リザ]
```

Atlas 解析器对 `equipSet` 读取槽位、装备 ID、第三个数值和名称，并将第三个数值保存为 `baseFace`。

---

### 音频

#### 背景音乐

```
[bgm BGM标识 参数2? 参数3?]
[bgmStop BGM标识 淡出时长]
[bgmStopEnd BGM标识 淡出时长]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| BGM标识 | 字符串 | 如 `BGM_EVENT_38`, `BGM_MAP_23` |
| 参数2 | 浮点数 | 原始样本常见 `0.1`、`1.0`；Atlas 解析器按 `volume` 读取（源码属性名拼作 `volumne`） |
| 参数3 | 浮点数 | 原始样本常见 `0.4`、`0.9`；Atlas 解析器将其命名为 `fadeinTime` |

原始 DSL 的参数位置必须保留。历史资料常把第二、第三参数描述成“淡入时长/音量”，但 Atlas 当前代码按“音量/淡入时长”读取；在没有客户端证据时不要只凭数值大小交换两者。

**BGM 类型前缀**：
- `BGM_EVENT_` — 事件音乐
- `BGM_MAP_` — 地图音乐
- `BGM_BATTLE_` — 战斗音乐
- `BGM_ENDING_` — 结尾音乐

实际资源前缀不止以上四类，例如还观察到 `BGM_MYROOM_`、`BGM_HALLOWEEN_` 等；这里的列表仅作示例。

**示例**：
```
[bgm BGM_EVENT_38 0.1]
[bgm BGM_MAP_57 0.1 0.9]
[bgmStop BGM_EVENT_38 1.5]
[bgmStopEnd BGM_BATTLE_43 2.0]
```

Atlas 解析器直接建模 `bgm` 和 `bgmStop`，不单独处理 `bgmStopEnd`。

#### 音效

```
[se 音效标识 参数...]
[seStop 音效标识 参数...]
[seLoop 音效标识]
[seVolume 音效标识 淡入 淡出]
[seContinue 音效标识 参数...]
[seContinueStop 音效标识 参数...]
[seContinueVolume 音效标识 时长 音量 编号]
```

**`seContinueVolume` 参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| 音效标识 | 字符串 | 如 `ad1`, `ad931` |
| 时长 | 浮点数 | 音量过渡时间 |
| 音量 | 浮点数 | 目标音量 0.0-1.0 |
| 编号 | 整数 | 通道编号 |

**音效标识前缀**：
- `ad` — 通用音效
- `bac` 等以 `ba` 开头的标识 — 战斗音效

Atlas 解析器按标识前两字符推导资源目录：`ba` → `Battle`、`ad` → `SE`、`ar` → `ResidentSE`、`21` → `SE_21`；这属于展示层资源定位规则，不等同于客户端完整音频路由。

**示例**：
```
[se ad1]
[se ad931]
[seStop ad931 1.5]
[seLoop ad84]
[seVolume ad9 0 0.4]
```

`se` 的基础形式是 `[se 音效标识]`；当前样本还存在带附加参数的扩展形式，但 Atlas 解析器只直接取第一个音效标识。`seStop`、`seVolume`、`seContinue*` 等属于原始脚本命令族。

#### 提示音

```
[cueSe 类别 标识 参数...]
[cueSeStop 标识 参数...]
[cueSeVolume 标识 淡入 淡出]
[cueSeContinue 类别 标识 参数...]
[cueSeContinueStop 标识 参数...]
[cueSeContinueVolume 标识 时长 音量 编号]
```

**类别**：`Battle`, `SE_21`, `NoblePhantasm_9943010`, `Servants_100100` 等；类别与资源标识共同决定音效资源。

**示例**：
```
[cueSe SE_21 21_ad1097]
[cueSe NoblePhantasm_9943010 NP_9943010_6]
[cueSeStop m84916 2.0]
```

#### 全部停止

```
[soundStopAll]
[soundStopAllEnd]
[soundStopAllFade 时长]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 时长 | 浮点数 | 淡出时间（秒） |

**示例**：
```
[soundStopAll]
[soundStopAllFade 0.4]
[soundStopAllEnd]
```

#### 语音

```
[voice 语音标识]
[voiceStop 语音标识]
[voiceStop 语音标识 参数?]
```

**示例**：
```
[voice 302800_0_B030]
[voice 701100_0_B100]
[voiceStop NP_502300_1]
[voiceStop NP_100100_1 0]
```

Atlas 解析器直接建模 `[voice 语音标识]`；`voiceStop` 是原始脚本中存在的控制命令，但不在该版本的专用解析分支中。

#### 铃声

```
[jingle BGM标识]
```

**示例**：
```
[jingle BGM_ENDING_1]
```

---

### 摄像机

#### 移动

```
[cameraMove 时长 X,Y 缩放]
[cameraMoveEase X,Y 时长 缓动函数 缩放]
```

**示例**：
```
[cameraMove 0.1 0,-30 1.2]
[cameraMoveEase 0,-30 1.0 easeOutQuad 1.2]
[cameraMove 2.5 0,0 1.01]
```

#### 归位

```
[cameraHome 时长?]
```

**示例**：
```
[cameraHome 3.0]
[cameraHome 0.1]
```

#### 旋转

```
[cameraRoll 角度 X,Y?]
[cameraRollMove 时长 角度]
```

**示例**：
```
[cameraRoll 0]
[cameraRoll 10 0,0]
[cameraRollMove 2.0 2]
```

#### 滤镜

```
[cameraFilter 模式 参数...]
[cameraFilter]
```

原始脚本中的无参数形式用于清除或恢复摄像机滤镜；Atlas 解析器仍会创建滤镜对象，但不校验模式是否存在。

**原始样本模式**：`gray`, `normal`, `aberration`, `darkred`

Atlas 解析器类型声明中还出现 `summon`；它会读取第一个模式参数但不校验模式名，`aberration` 的附加数值会被原始脚本保留，展示层不一定完整呈现。

**示例**：
```
[cameraFilter gray]
[cameraFilter normal]
[cameraFilter aberration 1 2 1 -2 -1 2]
[cameraFilter darkred]
```

#### 背景颜色

```
[backCameraColor]
```

---

### 视觉效果

#### 全局效果

```
[effect 效果名 X,Y? 层?]
[effectStop 效果名? X,Y? 层?]
[effectDestroy 效果名? X,Y? 层?]
[effectForceStop 效果名]
[effectStart]              # 恢复暂停的效果
[effectPause 效果名]        # 暂停指定效果
```

| 命令 | 说明 |
|------|------|
| `effect 效果名` | 播放全局视觉效果 |
| `effectStop 效果名` | 停止效果 |
| `effectDestroy 效果名` | 销毁效果实例 |
| `effectForceStop 效果名` | 强制立即停止效果 |
| `effectStart` | 恢复之前暂停的效果 |
| `effectPause 效果名` | 暂停指定名称的效果 |

**常用效果名**：
- `bit_sepia01_depth_fs` — 棕褐色调
- `bit_talk_rubble` — 瓦砾
- `bit_talk_13`, `bit_talk_14`, `bit_talk_21`, `bit_talk_41` — 各种视觉效果
- `bit_talk_security_fs` — 安全框

**示例**：
```
[effect bit_sepia01_depth_fs]
[effect bit_talk_rubble]
[effectStop bit_sepia01_depth_fs]
[effectDestroy bit_talk_security_fs]
[effectPause bit_talk_rubble]
[effectStart]
```

`effect` 还可带坐标和翻转参数，例如 `[effect bit_talk_43h_fs 0,0 V]`；Atlas 解析器把 `H`、`V`、`F` 分别解释为水平、垂直和全屏翻转。`effectForceStop`、`effectPause`、`effectStart` 是原始样本中的扩展命令，当前解析器只直接建模 `effect`、`effectStop`、`effectDestroy`。

#### 前向效果

```
[fowardEffect 效果名 X,Y? 层?]
[fowardEffectStop 效果名? X,Y? 层?]
[fowardEffectDestroy 效果名? X,Y? 层?]
[fowardEffectStart]              # 恢复暂停的前向效果
[fowardEffectPause 效果名]        # 暂停指定前向效果
```

| 命令 | 说明 |
|------|------|
| `fowardEffect 效果名` | 播放前向视觉效果 |
| `fowardEffectStop 效果名` | 停止前向效果 |
| `fowardEffectDestroy 效果名` | 销毁前向效果实例 |
| `fowardEffectStart` | 恢复之前暂停的前向效果 |
| `fowardEffectPause 效果名` | 暂停指定名称的前向效果 |

**示例**：
```
[fowardEffect bit_talk_29]
[fowardEffect bit_talk_14]
[fowardEffectStop bit_talk_41]
[fowardEffectPause bit_talk_29]
[fowardEffectStart]
```

`fowardEffect` 是引擎实际使用的拼写（少一个 `r`），不要自行改写为 `forwardEffect`。

#### 背景效果

```
[backEffect 效果名 X,Y? 层?]
[backEffectStop 效果名? 时长?]
[backEffectDestroy 效果名?]
```

**示例**：
```
[backEffect bit_talk_07_loop]
[backEffectStop bit_talk_lightning_01t 0.1]
[backEffectDestroy bit_talk_light_range]
```

#### 文字效果

```
[effectmessage 效果名 X,Y 时长 参数]
[effectmessageStop 效果名]
```

**示例**：
```
[effectmessage bit_talk_hknf_text 440,179 1.5 48]
[effectmessageStop bit_talk_hknf_text]
```

#### 屏幕震动

```
[shake 幅度 X强度 Y强度 时长]
[shakeStop]
```

**示例**：
```
[shake 0.05 2 2 3.0]
[shake 0.05 3 3 6.5]
[shakeStop]
```

#### 模糊

```
[blur 类型 参数...]
[blurOff 类型 时长? 模式?]
```

**类型**：`lens`, `motion`, `glass`

**示例**：
```
[blur lens 1.1 2 10]
[blur lens 0.5 2 20]
[blur motion 1.0 2 10]
[blur glass 0.5 2 10]
[blurOff lens 0.1]
```

样本中 `blur` 还存在更长的参数形式；参数含义依赖模糊类型，不能按固定三个参数处理。

#### 闪光

```
[flashin 模式 时长 颜色1 颜色2]
[flashout 时长]
[flashOff]
```

**模式**：`once`, `loop`

**示例**：
```
[flashin once 0.1 0.3 FFFFFFAF FFFFFF00]
[flashin loop 0.7 0.7 FF000080 FF000000]
[flashout 0.5]
[flashOff]
```

#### 扭曲效果

```
[distortionstart 参数1 参数2 参数3 参数4 参数5 参数6]
[distortionstop 时长]
```

**示例**：
```
[distortionstart 3.5 0.5 0.5 0.4 0.4 10.0]
[distortionstop 0.1]
```

#### 全屏效果

```
[enableFullScreen]
```

---

### 影片/动画

#### 过场影片

```
[criMovie 影片标识 bgmPlay 开关]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 影片标识 | 字符串 | 如 `talk_mov148` |
| bgmPlay | 布尔 | `true`/`false` |

**示例**：
```
[criMovie talk_mov148 bgmPlay true]
[criMovie talk_mov333 bgmPlay false]
```

Atlas 解析器只直接建模影片标识；`bgmPlay true/false` 等附加字段会被原始脚本保留，但不由该展示解析器执行。

#### 电影滤镜

```
[pictureFrame 画面标识?]
[pictureFrameTop 画面标识?]
```

省略画面标识的形式用于清除或恢复当前电影滤镜。

**示例**：
```
[pictureFrame cut063_cinema]
[pictureFrameTop cut063_cinema]
```

Atlas 解析器直接建模 `pictureFrame`；`pictureFrameTop` 是原始脚本中的扩展命令，不在该版本的专用解析分支中。

#### 画面比例

```
[turnPageOn 参数?]
[turnPageOff]
[messageChange cinema]
```

#### 过场动画

```
[movie 影片标识]
```

**示例**：
```
[movie talk_mov010]
```

#### 插入动画

```
[insertionAnimationStart 动画标识 画面标识]
[insertionAnimationEnd 动画标识]
[insertionAnimationSetFSSideR 动画标识 X,Y]
```

**示例**：
```
[insertionAnimationStart ac_fude_triangle_slide_R cut530_ior_06]
[insertionAnimationEnd ac_fude_triangle_slide_R]
```

---

### 控制流

#### 标签

```
[label 标签名]
```

**示例**：
```
[label lblClear01]
[label lblNotClear01]
[label selectBranch]
```

#### 分支跳转

```
[branch 标签名]
[branch 标签名 标志名 标志值]
```

**示例**：
```
[branch lblConf01]
[branch lblClear02]
```

Atlas 解析器对第二种形式建立条件跳转对象，条件由 `标志名=标志值` 表示；无条件形式只保存目标标签。

#### 条件分支

```
[branchQuestClear 标签名 任务ID]       # 任务已完成
[branchQuestNotClear 标签名 任务ID]    # 任务未完成
[branchMaterial 标签名]                 # 素材相关
[branchRouteSelect 标签名 任务ID 参数]  # 路线选择
[branchNotRouteSelect 标签名 任务ID 参数]
[branchRouteSelectCount 标志名 数量 比较 任务ID列表 标签列表]
[branchSetGrandSvtCount 标签名 数量 比较]
```

样本中观察到的 `比较` 值包括 `EQUAL` 和 `ABOVE`；其他比较符号尚未确认。

**示例**：
```
[branchQuestClear lblClear01 4000217]
[branchQuestNotClear lblNotClear05 4000326]
[branchRouteSelect select_answer_01 3000810 5000]
[branchRouteSelectCount truthflag1 2 EQUAL 3000910,3000919 2030,2060]
```

Atlas 解析器当前直接建模的是 `branchQuestNotClear`；`branchQuestClear`、路线计数及其他条件命令来自原始脚本，未在该版本的专用分支中实现。

#### 玩家输入

```
[input 标签名]
```

原始样本还出现 `[input 标签名 skipStop "branchNotRouteSelect 任务ID 任务ID"]` 等扩展参数。`input` 本身不是 Atlas 当前 `parseBracketComponent` 的专用命令分支；选项解析主要依靠行首 `？` 和段结束标记 `？！`。

**示例**：
```
[input selectBranch]
```

#### 跳过控制

```
[skip true/false]
[tapSkip 参数]
```

**示例**：
```
[skip false]    # 禁止跳过
[skip true]     # 允许跳过
[tapSkip test_skip]
```

#### 条件判断

```
[ifClear 任务ID]
[endIf]
[else]
```

**示例**：
```
[ifClear 60152100]
... 已通关内容 ...
[else]
... 未通关内容 ...
[endIf]
```

#### 标志位

```
[flag 名称 值]
```

**示例**：
```
[flag smn 1]
[flag kda 1]
[flag flag_1 true]
[flag IsCmn true]
```

#### 清除

```
[clear]
```

#### 中断

```
[interruption]
```

#### 选择使用

```
[selectionUse 类型]
```

**类型**：`masterMale`, `masterFemale`

**示例**：
```
[selectionUse masterMale]
[selectionUse masterFemale]
```

#### 结束

```
[end]
[end 颜色?]
[endFade 颜色]
```

**示例**：
```
[end]
[end white]
[endFade white]
```

当前样本中既有 `[end]`，也有 `[end black]`/`[end white]`；`endFade` 另有少量样本，不能把带颜色的形式统一改写成 `endFade`。

---

### UI 控制

#### 消息窗口

```
[messageOff]              # 隐藏消息窗口
[messageOn]               # 显示消息窗口（当前样本未出现）
[messageChange cinema]    # 电影模式
[messageAlign bottom]     # 底部对齐
```

#### 消息震动

```
[messageShake 幅度 X强度 Y强度 时长]
[messageShakeStop]
```

**示例**：
```
[messageShake 0.05 4 4 0.4]
[messageShakeStop]
```

#### 文字背景

```
[talkNameBack 图片标识?]
```

**示例**：
```
[talkNameBack img_talk_namebg02]
[talkNameBack]
```

#### 等待

```
[wait 类型 参数...]
```

**等待类型**：

| 类型 | 说明 | 参数 |
|------|------|------|
| `fade` | 等待淡入淡出完成 | 无 |
| `wipe` | 等待擦除完成 | 无 |
| `mask` | 等待遮罩完成 | 无 |
| `charaCrossFade 槽位?` | 等待角色交叉淡化完成 | 槽位可选 |
| `charaSpecialEffect 槽位? 效果类型?` | 等待角色特殊效果完成 | 槽位和效果类型可选 |
| `charaMove 槽位?` | 等待角色移动完成 | 槽位可选 |
| `charaMoveReturn 槽位` | 等待角色返回原位完成 | 槽位字母 |
| `charaChange 槽位?` | 等待角色切换完成 | 槽位可选 |
| `charaCut 槽位?` | 等待角色切入/切出完成 | 槽位可选 |
| `charaEffect 槽位? 效果名?` | 等待角色效果完成 | 槽位/效果名称可选 |
| `charaEffectStart 槽位? 效果名?` | 等待角色效果恢复完成 | 参数可选 |
| `charaBackEffect 槽位? 效果名?` | 等待角色背景效果完成 | 参数可选 |
| `camera` | 等待摄像机移动完成 | 无 |
| `cameraRoll` | 等待摄像机旋转完成 | 无 |
| `effect 效果名?` | 等待全局效果完成 | 效果名称可选 |
| `fowardEffect 效果名?` | 等待前向效果完成 | 效果名称可选 |
| `fowardEffectStart` | 等待前向效果恢复完成 | 无 |
| `flash` | 等待闪光完成 | 无 |
| `se 音效标识` | 等待音效播放完成 | 音效 ID |
| `voice` | 等待语音播放完成 | 无 |
| `tVoice` | 等待测试语音完成 | 参数可选 |
| `scene` | 等待场景加载完成 | 无 |
| `specialEffect` | 等待特殊效果完成 | 无 |
| `subCamera` | 等待子摄像机移动完成 | 无 |
| `insertionAnimationStart 标识` | 等待插入动画开始完成 | 动画标识 |
| `insertionAnimationEnd 标识` | 等待插入动画结束完成 | 动画标识 |
| `subRenderMoveFSSideL #层?` | 等待子渲染层左侧移动完成 | 层编号可选 |
| `subRenderMoveFSSideR #层?` | 等待子渲染层右侧移动完成 | 层编号可选 |
| `imageSet 槽位?` | 等待图像设置完成 | 槽位可选 |
| `fastPlayDraw 参数?` | 等待快速绘制完成 | 参数可选 |
| `fsmObjFinished 槽位?` | 等待 FSM 对象完成 | 槽位可选 |
| `communicationChara` | 等待通信角色完成 | 无 |
| `touch` | 等待触摸输入 | 无 |

**示例**：
```
[wait fade]
[wait charaCrossFade A]
[wait wipe]
[wait camera]
[wait charaMove B]
[wait se ad1]
[wait voice]
[wait flash]
```

原始脚本大量使用 `[wait 类型 参数...]`，但 Atlas 当前解析器的专用等待分支是 `[wt 秒数]`；`wait` 在该展示实现中会落入 `UNPARSED` 或按上下文保留原始参数。这是解析器覆盖范围的差异，不应据此删除客户端脚本中的 `[wait ...]`。

#### 等待加载

```
[enableWaitLoadAssetWhenResume]
```

#### 自动返回

```
[autoAndBackLog false]
```

#### 日志标记

```
[backlogStart]    # 开始记录到日志
[backlogEnd]      # 结束记录到日志
```

用于标记可回溯的对话段落范围。

#### 章节效果

```
[fowardEffect bit_chapterstart401]
```

---

### 子摄像机系统

子摄像机用于分屏显示、画中画等高级演出。

#### 开关

```
[subCameraOn 编号?]
[subCameraOff]
```

**示例**：
```
[subCameraOn 1]
[subCameraOn 2]
[subCameraOff]
```

#### 移动

```
[subCameraMove #层 时长 X,Y 缩放]
[subCameraMoveEase #层 X,Y 时长 缓动函数 缩放]
[subCameraHome #层 时长]
[subCameraRoll #层 角度 X,Y?]
[subCameraRollMove #层 时长 角度]
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `subCameraHome` | `#层 时长` | 子摄像机归位到初始位置 |
| `subCameraRollMove` | `#层 时长 角度` | 子摄像机旋转动画 |

**示例**：
```
[subCameraMove #A 0.1 10,0 1.1]
[subCameraMoveEase #A 0,-50 0.5 easeOutQuart 1.2]
[subCameraHome #A 1.0]
[subCameraRoll #A 30 0,0]
```

#### 滤镜

```
[subCameraFilter #层? 模式 参数...]
```

省略 `#层` 时作用于当前或默认子摄像机；不同模式的参数数量不同。

**模式**：`through`, `mask`, `maskEdge`, `maskEdge&gray`, `mask&gray`, `inversion`, `gray`, `normal`

**示例**：
```
[subCameraFilter #A through]
[subCameraFilter #A mask cut359_mask12]
[subCameraFilter #A maskEdge cut359_mask05 3 255,255,255,255]
[subCameraFilter #A maskEdge&gray cut359_mask05 3 255,255,255,255]
[subCameraFilter #A mask&gray cut359_mask12]
[subCameraFilter #A inversion]
[subCameraFilter #A gray]
[subCameraFilter #A normal]
```

#### 子渲染层

```
[subRenderDepth #层 层级]
[subRenderFadein #层? 时长 X,Y]
[subRenderFadeinFSL #层 时长 X,Y]       # 左侧淡入
[subRenderFadeinFSR #层? 时长 X,Y]       # 右侧淡入
[subRenderFadeinFSSideL #层 时长 X,Y]   # 侧左淡入
[subRenderFadeinFSSideR #层? 时长 X,Y]   # 侧右淡入
[subRenderFadeout #层? 时长]
[subRenderMove #层? X,Y 时长]
[subRenderMoveEase #层 X,Y 时长 缓动函数]
[subRenderMoveFSL #层 X,Y 时长]         # 左侧移动
[subRenderMoveFSR #层 X,Y 时长]         # 右侧移动
[subRenderMoveFSSideL #层 X,Y 时长]     # 侧左移动
[subRenderMoveFSSideR #层? X,Y 时长]     # 侧右移动
[subRenderMoveEaseFSL #层 X,Y 时长 缓动函数]   # 左侧缓动移动
[subRenderMoveEaseFSR #层? X,Y 时长 缓动函数]   # 右侧缓动移动
[subRenderMoveEaseFSSideL #层 X,Y 时长 缓动函数]  # 侧左缓动移动
[subRenderMoveEaseFSSideR #层? X,Y 时长 缓动函数]  # 侧右缓动移动
[subRenderMoveScale #层 倍率 时长]      # 缩放移动
[subRenderMoveScaleEase #层 倍率 时长 缓动函数]  # 缓动缩放移动
[subRenderScale #层? 倍率]
[subRenderShake #层 幅度 X强度 Y强度 参数]
[subRenderShakeStop #层]
```

当前样本中确认可省略 `#层` 的命令包括：`subRenderFadein`、`subRenderFadeinFSR`、`subRenderFadeinFSSideR`、`subRenderFadeout`、`subRenderMove`、`subRenderMoveFSSideR`、`subRenderMoveEaseFSR`、`subRenderMoveEaseFSSideR` 和 `subRenderScale`；省略时作用于当前或默认子渲染层。其他变体目前仅观察到显式指定 `#层` 的形式。部分 FSL/FSR/Side 移动变体还允许追加缓动函数。

**示例**：
```
[subRenderDepth #A 2]
[subRenderFadein #A 1.0 -200,0]
[subRenderFadeinFSL #B 0.4 -120,-120]
[subRenderFadeout #A 0.4]
[subRenderMove #A 150,0 16.0]
[subRenderMoveEase #B 0,-330 0.3 easeOutQuint]
[subRenderScale #A 1.5]
[subRenderMoveScale #C 1.1 3.5]
```

#### 子模糊

```
[subBlur #层 类型 参数1 参数2 参数3 参数4]
[subBlurOff #层 类型 时长 模式]
[subBlur2 #层 类型 参数1 参数2 参数3 参数4]
[subBlur2Off #层 类型 时长 模式]
```

**示例**：
```
[subBlur #A lens 0.4 2 10 1.0 subBlur]
[subBlurOff #A lens 0.1 normal]
```

#### 子拉伸

```
[subStretch on]
```

#### 叠加淡入

```
[overlayFadein 槽位 时长 X,Y?]
```

**示例**：
```
[overlayFadein I 0.1 0,734]
[overlayFadein J 0.1 0,-734]
[overlayFadein P 2.0]
```

#### 图像设置

```
[imageSet 槽位 图像ID 参数...]
[image 图像标识]
[imageChange 槽位 新图像 模式 时长]
[horizontalImageSet 槽位 图像ID 参数]
[verticalImageSet 槽位 图像ID 参数]
```

**示例**：
```
[imageSet C back10000 1 1]
[imageSet T back10000 1]
[image berserker_language_2]
[horizontalImageSet K scene88101 2]
[verticalImageSet J back68500 1]
```

Atlas 解析器对三种 `*ImageSet` 形式只直接读取槽位和图像标识；其他参数会保留在原始脚本中，但不在该展示实现的专用字段里。

#### 主角相关

```
[masterSet 槽位 男性ID 女性ID 参数]
[masterScene 男性场景ID 女性场景ID 时长?]
[masterImageSet 槽位 男性ID 女性ID 参数]
[masterBranch _Male标签 _Female标签]
[masterNameWidth 参数 名称1 名称2 名称3]
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `masterSet` | `槽位 男性ID 女性ID 初始表情` | 设置主角角色（根据性别自动选择）；仍需通过角色登场命令显示 |
| `masterScene` | `男性场景ID 女性场景ID 时长?` | 设置主角场景 |
| `masterImageSet` | `槽位 男性ID 女性ID 参数` | 设置主角图像 |
| `masterBranch` | `_Male标签 _Female标签` | 性别分支跳转 |
| `masterNameWidth` | `参数 名称1 名称2 名称3` | 设置主角名称显示宽度 |

**示例**：
```
[masterSet L 1098348300 1098348310 1]
[masterScene 276600 276601 1.0]
[masterBranch _Male01 _Female01]
[masterNameWidth large 339 _Name339Less _Name339Over]
```

Atlas 解析器只直接建模 `masterBranch`；`masterSet`、`masterScene`、`masterImageSet` 和 `masterNameWidth` 属于原始脚本命令族，展示解析器不会为它们创建对应的专用类型。

---

### 其他命令

#### 通信角色

```
[communicationChara 角色ID 标志 参数1 参数2 参数3]
[communicationCharaClear]
[communicationCharaFace 表情编号]
[communicationCharaLoop 角色ID 标志 参数1 参数2 参数3]
[communicationCharaStop]
```

**示例**：
```
[communicationChara 98003003 1 5 0 2]
[communicationCharaClear]
[communicationCharaFace 4]
```

#### FSM 对象

```
[fsmObjSet 槽位 路径 名称]
[fsmObjSetState 槽位 状态]
[fsmObjSendEvent 槽位 事件]
[fsmObjLayer 槽位 层级]
[fsmObjDestroy 槽位]
```

**示例**：
```
[fsmObjSet K ScriptUI/SelectPanel/select01 select01]
[fsmObjSetState K WAIT_SELECTED_ANIMATION]
[fsmObjSendEvent K START]
[fsmObjLayer K ui]
[fsmObjDestroy K]
```

#### 滚动停止

```
[scrollStop]
```

#### 全屏模式

```
[enableFullScreen]
```

#### 简单网格模型

```
[useSimpleMeshFigure ID1,ID2]
```

**示例**：
```
[useSimpleMeshFigure 1009000,1098321800]
```

#### 特殊效果

```
[specialEffect 类型]
```

**类型**：`cutting`

#### 淡入移动

```
[fadeMove 颜色 时长 参数]
```

**示例**：
```
[fadeMove white 1.5 0.9]
[fadeMove white 0.7 0.1]
```

#### 擦除关闭

```
[wipeOff]
```

#### 语音测试

```
[tVoice 语音包标识 语音ID 时长]
```

**示例**：
```
[tVoice ChrVoice_7100100 0_T010 0.4]
[tVoice ChrVoice_7100100 0_T030]
```

Atlas 解析器只在行首把 `tVoice`/`tVoiceUser` 作为对话语音元数据处理；它们与通用 `[voice ...]` 命令不是同一分支。

#### 时间等待

```
[twt 时长]
[wt 时长]
```

**示例**：
```
[twt 0.5]
[wt 1.0]
[wt 0.1]
```

#### 捕获

```
[capture]
[captureRelease]
```

#### 任务简称

```
[tRaidShortName 任务ID 参数]
```

**示例**：
```
[tRaidShortName 80593 1]
```

#### 文本显示

```
[q]
[Q]
[s 参数]
```

`[q]` 是小写消息边界；当前样本中的 `[Q]` 主要出现在 `spot[Q]` 等槽位列表中，不应当作 `[q]` 的大小写变体。

---

## 画面合成与坐标系（客户端逆向）

> 本章来自对客户端 APK（2.138.0）IL2CPP 代码的逆向，证据分级见[概述](#概述)。逆向工具链与完整产物清单见[附录：客户端逆向资料](#客户端逆向资料)。

### 引擎侧解析与执行管线

客户端没有独立的"脚本解释器 DLL"，剧情系统全部在 `Assembly-CSharp` 的 `ScriptManager`（单例 MonoBehaviour，423 个方法）及其协作类中：

```
PlayScenario / PlayBattleStart / PlayChapterStart …   ← 各系统入口（传入脚本名 = {questId:D8}{phase:D1}{序号}）
        │
LoadScript (RVA 0x313C670)                            ← 读取脚本（明文或按 ScriptEncryptSettings 解密）
        │
ScriptAnalys (0x313C968) / AnalysText (0x314154C)      ← 按行切分：＄头、＠说话者、[标签]、行内标记、ruby
        │                                              结果存入 executeTagList / executeDataList /
        │                                              executeLineList / executeOrgLineList / orgScriptList
ExecuteScript (0x313C2A0)                              ← 装载解析结果，驱动执行状态机（executeIndex 游标）
        │
ScriptCommandExecute (0x30FA9D4)                       ← 逐标签分发：string switch（ComputeStringHash →
                                                        op_Equality 逐 case 比较），每标签一个处理分支
```

分发器内通过 capstone 反汇编还原出的分支调用关系（`tag_handlers.json`）与样本统计的 299 种标签有 277 种直接对应；其余为颜色码等运行时构造的字符串。控制流类命令（`label`/`jump`/`branch`/`tdelay` 等）只是修改执行索引，`flag`/`switchCase` 状态保存在 `ScriptFlagData` 列表与 `switchSelections` 字典中。

### 画面合成栈

剧情画面是 **NGUI 2D 舞台 + 多相机 RenderTexture 合成**，不是 Unity 场景图里的 3D 布景。`ScriptManager` 持有的关键节点（序列化字段，挂载关系来自预制体）：

```
UIRoot（NGUI 根，UIRootReScale 做全屏适配）
 ├─ renderPanel                          ← 剧情舞台容器
 │   ├─ backSprite1 / backSprite2        ← [scene]/[back] 背景，双缓冲交叉淡化（sceneCrossFadeTime）
 │   ├─ cameraScale → cameraPosition → cameraRoll1 → cameraRoll2   ← [cameraMove]/[cameraRoll]/[cameraScale]
 │   │                                      的层级链（move/roll/scale 各占一层）
 │   ├─ charaList[CHARA_MAX=26]          ← ScriptCharaData → UIScriptChara（SortingGroup 排序）
 │   ├─ meshFadeBase / meshWipeBase / meshExWipeBase / meshFlashBase / charaMeshFlashBase
 │   │                                   ← [fade]/[wipe]/[flash] 的全屏网格层
 │   ├─ meshCaptureBase / meshRenderBase ← [capture] 捕获与合成层（captureTexture RenderTexture）
 │   ├─ pictureFrameSprite               ← 16:9 遮幅画框
 │   └─ ScriptActionAdvPrefab* / ScriptFsmObject*   ← [fsm]/新式演出（PlayMakerFSM，Fgo.PlayMaker.dll 935 个 action）
 ├─ subLayerManager（ScriptSubLayerManager）← [subRender*] 子渲染层（独立 subCamera + RenderTexture）
 ├─ normalMessageManager / faceMessageManager        ← 对话窗口（NGUI；[charaTalk] 切换两种模式）
 ├─ actionPanel / systemPanel / blockPanel           ← 按钮、输入拦截面板
 └─ renderTextureCamera / margeCamera / ui2dCamera / mapCamera  ← 相机组
```

合成要点：

- **相机与 RT**：`renderTextureCamera` 把剧情舞台渲染进 RenderTexture，`margeCamera` 负责最终合成上屏；`[subRender*]` 系列通过 `ScriptSubLayerManager` 的子相机在独立 RT 上渲染（子模糊/子拉伸/叠加淡入都作用在这层）。
- **前后关系（Z 轴）**：NGUI 相机朝 +z 看，z 越小越靠近相机（越在上层）。角色等默认在 z=0；遮幅画框 `PICTURE_FRAME_Z_POS_NORMAL = -10`（画框在角色前），顶部遮幅 `PICTURE_FRAME_Z_POS_TOP = -230`。角色间前后用 `charaDepth`（写入 SortingGroup/defaultDepth）控制。
- **角色渲染**：`ScriptCharaData.SetPosition/SetFace/SetScale…` → `UIScriptChara`（8 组基座 Transform：position/relativePosition/depth/scale/roll1/roll2/shake + 剪切与特效容器）→ `UIStandFigureRender`（身体+表情+淡入三层网格）。移动/旋转/抖动都是对基座 Transform 的插值，不回写脚本坐标。
- **视频**：`[movie]` → `CRIMoviePlayer`（CRIWARE），`[movieResume]` 等断点由 `SaveMovieResumeInfo` 管理。
- **音频**：BGM/环境音走 `BgmManager`、SE 走 `SePlayer`、`cueSe` 走 CRIWARE cue 表；`[voiceStop]` 等停止类命令直接调用对应 Manager 的 Stop。

### 素材的 00 点（锚点）

来自 `UIStandFigureRender` 静态常量（单位均为素材像素，且 1 素材像素 = 1 世界坐标单位）：

| 常量 | 值 | 含义 |
|------|-----|------|
| `NORMAL_MAIN_SIZE_X/Y` | 1024 / 2048 | 立绘大表（每张立绘的原始纹理）为 1024×2048 |
| `WIDE_MAIN_SIZE_X/Y` | 1024 / 2048 | 宽屏表同尺寸 |
| `NORMAL_BODY_SIZE_X/Y` | 1022 / 2046 | 标准模式下身体网格的显示范围 |
| `WIDE_BODY_SIZE_X/Y` | 766 / 2046 | 宽屏模式身体显示范围（裁掉两侧） |
| `FACE_SIZE_X/Y` | 254 / 254 | 表情图块尺寸 |
| `FACE2A_SIZE` | 256 | 特殊表情（2A）图块 256×256，UV 缩放 0.9883 |
| `NORMAL_LEFT_X / NORMAL_RIGHT_X` | -510 / +511 | 表情网格横向边界（以锚点为 0 居中） |
| `NORMAL_TOP_Y / NORMAL_BOTTOM_Y` | +511 / -254 | 表情网格纵向边界：**上 511、下 254，不对称** |
| `WIDE_LEFT_X / WIDE_RIGHT_X` | -1022 / +1023 | 宽屏表情网格边界 |
| `HIGH_TOP_Y / HIGH_BOTTOM_Y` | +1023 / -1022 | 高分辨率全身模式边界（近似对称） |

结论：

1. **横向**：立绘素材以图像中心为 00 点（`-510 ~ +511`，即 1024 宽居中）；`SetPosition` 移动的是这个中心点。
2. **纵向**：锚点不在图像中心，而在**素材下约 1/3 处（约胸口/领口线）**——表情图块区从锚点向上 511px、向下仅 254px。因此 `Y=0` 时角色的头部在 `+511` 以上、躯干在 `0` 附近，地面/脚部在锚点下方远处；FGO 立绘"落位在胸口"的观感即来自该锚点。
3. **表情（`[charaFace]` 第 2 参数 / `Face.Type`）**：从 1024×2048 表中按 254×254 图块网格裁切（网格边界即上表常量）；`Face.Type` 枚举 `NORMAL=0, PLEASURE=1, CRY=2, EMBARRASSED=3, SAD=4, ANGRY=5, FACE_6…FACE_59` 与之对应。
4. **多表情表**：`FACE_MAX = 133`、表情槽位上限（调试 UI 口径），表情切换用双网格交叉淡化（`charaFaceFade`）。

### 与脚本命令的对应

| 命令 | 引擎动作 |
|------|----------|
| `[charaSet A id pos]` / `[charaPut]` | 建槽位 → `ScriptPosition.GetPosition(pos)` 查表 → `UIScriptChara.SetBasePosition`（存 `basePosition` 并写 `localPosition`） |
| `[charaMove …]` | 从当前位置向 `GetPosition(X,Y)` 插值（时长/缓动）；`Return` 变体回到槽位坐标 |
| `[charaScale]` / `[charaRoll]` / `[charaShake]` | 写 `UIScriptChara` 对应基座 Transform，不改坐标单位 |
| `[charaDepth N]` | 写 `defaultDepth` → SortingGroup 排序 |
| `[scene id]` | `SetSceneImage` → backSprite 双缓冲交叉淡化 |
| `[fadein]/[fadeout]/[wipe]/[flash]` | 对应 mesh 层网格渲染（`meshFadeBase` 等） |
| `[cameraMove]/[cameraRoll]/[cameraFilter]` | 驱动 cameraPosition/cameraRoll1/2 层级或 `SetCameraFilter(filter, float[])` |
| `[subRender*]` | `ScriptSubLayerManager` 子相机 RT 层 |
| `[fsm]` / `[fsmObj*]` | `ScriptFsmObjectData` 实例化 PlayMakerFSM 并转发 SetState/SendEvent/SetBool |

---

## 非官方剧情阅读器实现指南

> 本章把前文的格式规范与客户端逆向结论收敛为一套**可落地的实现标准**，供构建非官方 FGO 剧情阅读器/播放器参考。文中"引擎确认"均指 APK 2.138.0 IL2CPP 逆向结论（证据与 RVA 见[附录：客户端逆向资料](#客户端逆向资料)）；标注"建议"的为工程实践意见，非引擎行为。
>
> **配套标准文档**：本章的完整展开版（编号标准 S-P/E/R/A 系列、指令数据模型、状态机迁移、命令→演出映射速查表、分阶段实施路线）见 [`FGO_Story_Reader_Standard.md`](FGO_Story_Reader_Standard.md)。本章为速览，标准文档为准。
>
> **合规提醒**：脚本文本、立绘、音声等素材版权归 Aniplex/TYPE-MOON 所有。阅读器应定位为离线学习研究工具，不附带、不分发游戏资源本体。

### 总体架构：三段管线

引擎本身是"解析一次、逐指令执行"的结构（`executeTagList/executeDataList` + 游标 `executeIndex`）。建议阅读器采用同构的三段管线，便于实现断点续播与跳过：

```
① Parser   文本 → 行分类 → token 流        （对应 ScriptAnalys / AnalysText / GetCommandTag）
② Compiler token 流 → 指令数组 + 控制流表    （对应 executeTagList / executeDataList / executeLineList）
③ Executor 状态机逐条消费指令，驱动演出       （对应 ScriptManager.State + ScriptCommandExecute）
```

- ①② 一次性完成（引擎在 `LoadScriptAnalys` 里同步做）；③ 逐帧推进。
- 指令数组保留**原始行号**（引擎的 `executeLineList/executeOrgLineList` 同时保留去标记前/后的行号，供 BackLog 与调试定位）——建议阅读器同样保留，用于进度显示与错误定位。
- 控制流目标（`label`/`branch`）在 ② 阶段建索引表，③ 阶段只做游标跳转（引擎即 `JumpScript`/`SearchBranchLabel`）。

### 脚本解析标准

**行分类**（按优先级，`＠`/`＄` 等前缀以引擎字段 code*String 的运行时值为准，即观察到的全角符号）：

| 行形态 | 处理 |
|---|---|
| `＄数字-数字-…` | 场景头：跳过不执行（引擎无直接消费点；questId/phase 由播放接口传入） |
| `＠…`（含 `＠名=spot[A,B]`） | 对话行：首段为说话者名（可含颜色标记），其余为说话者元数据；正文从后续行累积 |
| `[label xxx]` 等控制行 | 进入控制流索引 |
| 普通行 | 按 `[` 扫描切分为"文本片段 + 行内标签"序列；行内标签与独立命令同管线 |

**分词规则**（引擎确认）：

- 命令名 = `[` 后到第一个空格或 `]` 的字符序列（`GetCommandTag` 算法），**大小写敏感**；
- 参数按空格切分，双引号包裹的段保留空格（如 `[input selectBranch skipStop "branchNotRouteSelect …"]`）；
- 一行内可有多个 `[...]`；`[` 后紧跟空格或 `]` 视为空 token。

**容错标准**（建议）：引擎对无法识别的命令会拼出错误信息（分发器字符串表含 `" is not found"`、`"structure error"`），但**不会中断整个场景**。阅读器应：未识别标签记录日志后原样跳过，参数数量不足按 `NaN/undefined` 处理（与 Atlas 解析器口径一致），不因单条命令失败终止播放。

### 执行语义标准

**状态机**（引擎确认，`ScriptManager.State` 枚举）——阅读器执行核心建议照此建模：

```
NONE → LOAD(加载/解密) → EXECUTE(逐条指令) ⇄ WAIT(消息/等待类命令) → WAIT_EXIT → EXIT
                              │
                              ├─ WAIT_SKIP(跳过模式)
                              └─ BACK_VIEW / FIGURE_VIEW / EQUIPGRAPH_VIEW / IMAGE_VIEW  ← 回忆页等查看模式
ERROR：脚本结构错误兜底态
```

**阻塞模型**：每条指令执行后可置 `isScriptWait`。归类（引擎语义）：

| 类别 | 命令 | 行为 |
|---|---|---|
| 消息边界 | `[k]` `[q]` `[page]` `[page3]` | 等待点击；`page*` 同时分页 |
| 定时等待 | `[wt 秒]` `[wait 类型…]` `[tdelay]` `[tw]/[twt]` | 按秒/类型等待，部分可被点击打断 |
| 即时演出 | `charaSet/charaMove*/charaFace/scene/…` | 启动动画后**不阻塞**（除非紧跟 wait 类） |
| 有限时长演出 | `[fadein/fadeout/wipein/wipeout/flashin/flashout 秒]` | 按参数秒数推进，可与后续命令并行（引擎字段 `isExecuteFade` 等表示"进行中"） |

**开场淡入**：`Play*` 接口带 `StartMode`（引擎枚举 17 种）：`CLEAR_BLACK/CLEAR_WHITE`（从黑/白淡入）、`BLACK/WHITE`（先置黑/白）、`THROUGH`（直切无过渡）、`BLACK_SCENE_STOP` 等。阅读器应为每种模式实现对应的开场效果。

**自动播放与跳过**：自动模式按 `autoWaitTime` 在消息边界自动翻页（引擎甚至以模板 `"[wait skippableTime {0:F2}]"` 生成等待）；跳过模式进入 `WAIT_SKIP` 快速推进并跳过未读演出（引擎 `skipFade` 记录跳过前的过渡状态，退出跳过时恢复）。

**分支与状态**：`flag` 列表（`ScriptFlagData`）、`switchCase` 选择记录（`switchSelections` 字典，按行号记忆）、`selectBranch` 路线选择（有独立存档键，跨场景生效）。`[interruption]` 支持从战斗等其他系统中断续播。

### 画面演出标准

画布与坐标的完整论证见[画面合成与坐标系（客户端逆向）](#画面合成与坐标系客户端逆向)，此处给阅读器实现口径：

1. **画布**：以 1024×576 为基准世界坐标，中心为 (0,0)，x 右正 y 上正；宽屏横向延展到 1346；长屏默认按 16:9 遮幅（上下加黑带），`[enableFullScreen]` 解除。阅读器建议：内部固定用 1024×576 逻辑坐标，呈现时按窗口纵横比做"遮幅 or 横向扩展"。
2. **层序**（自下而上，对应引擎合成栈）：背景（双缓冲交叉淡化）→ 角色层（`charaDepth` 排序，基准 z=0）→ 特效/转场网格层 → 遮幅画框（z=-10/-230，永远在最上）→ 对话框 UI（独立于舞台层）。
3. **角色演出**：每槽位一个"基座"对象，位置/缩放/旋转/抖动各一层 Transform；移动即对基座插值（时长、缓动来自命令参数；缓动函数表见[附录](#缓动函数参考)）；`charaRelativeLoopMove` 是叠加在基座上的**相对偏移**循环（呼吸/悬浮）。表情用双网格交叉淡化（`charaFaceFade` 时长参数）。
4. **镜头**：`[cameraMove]/[cameraRoll]/[cameraScale]` 作用于嵌套的 cameraScale→cameraPosition→cameraRoll1→cameraRoll2 层级（父链来自字段命名与序列化顺序，标注推测）。阅读器可等价实现为"整块舞台画布的仿射变换链"：平移 × 旋转 × 缩放，`[cameraHome]` 复位。
5. **转场**：`fade`（纯色淡入出，颜色含 18+ 种命名色）、`wipe`（方向擦除 + `wipeFilter` 花式遮罩）、`flash`（闪光）。未给时长时默认 `DEFAULT_FADE_TIME = 0.5` 秒（引擎确认）。
6. **文本演出**：逐字显示（步进时间受 `[s]/[speed]` 与玩家设置控制），`[r]` 软换行、`[#汉字:かな]` 注音、`[%1]` 玩家名替换（`ScriptReplaceString`，性别索引用于 `[&男性:女性]`）；BackLog 需要保留"去标记后"的纯文本流。
7. **声音**：`[bgm]/[se]/[cueSe]/[voice]` 只引用素材名（如 `BGM_EVENT_2`、`se ad1`），引擎经 SoundManager/BgmManager/SePlayer 与 CRIWARE 播放；阅读器需自建"素材名 → 音频文件"映射表。交叉淡化的淡入/淡出时长是命令参数。
8. **视频**：`[criMovie]` 引用 CRI 电影名，阅读器以视频播放器替位（字幕可选挂脚本同期文本）。

### 素材体系与降级策略

- **槽位 Kind**（引擎确认，`ScriptCharaData.Kind`）：`FIGURE=0`（立绘）、`EQUIP=1`（灵基外观）、`IMAGE=2`（图片）、`VERTICAL_IMAGE=3`、`HORIZONTAL_IMAGE=4`——`charaSet/equipSet/imageSet/verticalImageSet/horizontalImageSet` 五组命令共用 A-Z 槽位池，只是 Kind 不同。
- **立绘资源**：imageId（如 `98001000`）对应 1024×2048 表；表情 `Face.Type` 0-59 块状裁切（254×254）。
- **[fsm]/[fsmObj*]/Prefab 演出**：由 PlayMakerFSM 驱动，含专属动画资源，**无法用阅读器的 2D 管线忠实复刻**。降级策略建议：解析时识别这些标签 → 播放时显示占位（章节标题卡/静帧/留白 + 等待对应时长），保证叙事连续性。
- 素材本体不在本仓库范围：游戏资源打包于 APK 的 `data.unity3d` 与后续下载的 AssetStorage，可用 AssetStudio/UnityPy 自行研究（注意版权）。

### 引擎常量速查表

| 常量 | 值 | 出处 |
|---|---|---|
| 虚拟舞台 | 1024×576（16:9）；21:9 宽 1346 | `PICTURE_FRAME_SPRITE_WIDTH_16_9/21_9` |
| 默认淡入时长 | 0.5 s | `DEFAULT_FADE_TIME` |
| 遮幅画框 z | -10（标准）/ -230（顶部） | `PICTURE_FRAME_Z_POS_*` |
| 角色槽位上限 | 26（A-Z） | `CHARA_MAX` |
| 表情上限 | 133 | `FACE_MAX` |
| 立绘表 | 1024×2048；表情块 254×254（2A：256） | `UIStandFigureRender` 常量 |
| 槽位坐标表 | (-256,0)/(0,0)/(256,0)/(-438,0)/(-512,0)/(438,0)/(512,0) | `ScriptPosition.positionList` |
| 自动播放等待模板 | `[wait skippableTime {0:F2}]` | `AUTO_WAIT_TAG_FORMAT` |
| 对话/存档键 | `ScriptManagerAutoMessage`、`ScriptManagerSelectBranch`、TalkResume/MovieResume 键 | 引擎字段 |
| 执行状态 | 17 态（见[执行语义标准](#执行语义标准)） | `ScriptManager.State` |
| 开场模式 | 17 种（`StartMode` 枚举） | 引擎枚举 |

---

## 控制流模式

### 线性叙事

最基本的模式，命令和对话顺序执行：

```
＄01-00-03-01-1-0
[scene 104100]
[fadein black 1.0]
[charaSet A 98001000 1 マシュ]
[charaFadein A 0.4 1]
[charaTalk A]
＠マシュ
おはようございます、マスター[k]
[fadeout black 0.5]
[end]
```

### 玩家分支选择

```
[input selectBranch]

[label selectBranch]
？1：選択肢Aのテキスト
[branch lblBranch01]
？2：選択肢Bのテキスト
[branch lblBranch02]
？！

[label lblBranch01]
... 分支A的内容 ...
[branch lblEnd]

[label lblBranch02]
... 分支B的内容 ...

[label lblEnd]
... 后续共通内容 ...
```

选择项也可能带有额外元数据，例如 `？1,1000,saveMaterial：选项文本`。`[input 标签名]` 与后面的同名 `[label 标签名]` 共同标记选择段，实际分支目标由每个选项后的 `[branch 标签]` 指定。

### 任务进度条件分支

```
[branchQuestClear lblClear01 94146201]
[branch lblNotClear01]

[label lblClear01]
... 已通关的对话 ...
[branch lblContinue]

[label lblNotClear01]
... 未通关的对话 ...

[label lblContinue]
... 后续内容 ...
```

### 场景切换标准序列

```
[messageOff]
[fadeout black 0.5]
[wait fade]
[scene 新场景ID]
[bgm BGM_MAP_XX 0.1]
[fadein black 0.5]
[wait fade]
```

### 角色登场序列

```
[charaSet A 角色ID 1 名称]
[charaFadein A 0.4 1]
[charaTalk A]
＠名称
台词[k]
```

### 角色退场序列

```
[charaFadeout A 0.1]
[charaClear A]
```

### 性别分支

```
[masterBranch _Male _Female]

... 共通内容 ...

[masterSet L 男性ID 女性ID 1]
[masterScene 男性场景 女性场景 1.0]
```

---

## 完整示例

### 最小可运行脚本

```
＄01-00-00-01-1-0
[scene 10000]
[fadein black 1.0]
[charaSet A 98001000 1 マシュ]
[charaFadein A 0.4 1]
[charaTalk A]
＠マシュ
……マスター。[k]
本日もよろしくお願いします。[k]
[fadeout black 0.5]
[end]
```

### 带分支的对话脚本

```
＄01-00-00-02-1-0
[scene 104100]
[fadein black 1.0]
[bgm BGM_EVENT_38 0.1]
[charaSet A 98001000 1 マシュ]
[charaFadein A 0.4 1]
[charaTalk A]
＠マシュ
マスター、お疲れ様です。[k]
今日の作戦についてご確認ください。[k]

[input selectBranch]

[label selectBranch]
？1：作戦を確認する
[branch lblReady]
？2：準備ができていない
[branch lblNotReady]
？！

[label lblReady]
[charaFace A 1]
[charaTalk A]
＠マシュ
では、説明いたします。[k]
……（作戦説明）[k]
[fadeout black 0.5]
[bgmStop BGM_EVENT_38 1.0]
[branch lblEnd]

[label lblNotReady]
[charaTalk A]
＠マシュ
準備ができるまでお待ちします。[k]

[label lblEnd]
[end]
```

### 进入战斗前过渡的任务脚本

```
＄03-00-06-01-1-0
[scene 142200]
[fadein black 1.0]
[bgm BGM_MAP_23 0.1]
[charaSet A 1098158200 1 シオン]
[charaSet B 1098123200 1 ゴルドルフ]
[charaFadein A 0.4 1]
[charaFadein B 0.4 2]
[charaTalk A]
＠シオン
……特異点の反応が近いです。[k]
[charaFace B 3]
[charaTalk B]
＠ゴルドルフ
気を引き締めていくぞ。[k]
[messageOff]
[fadeout black 0.5]
[wait fade]
[criMovie talk_mov148 bgmPlay true]
[fadein black 0.5]
[wait fade]
[charaTalk A]
＠シオン
……敵のサーヴァントです。[k]
[bgm BGM_BATTLE_43 0.1]
[messageOff]
[fadeout black 0.5]
[wait fade]
[end]
```

---

## 附录

### 角色 ID 前缀

| ID 范围 | 说明 |
|---------|------|
| 98001000+ | 玛修（各种服装） |
| 1098158200+ | 主角/玩家相关 |
| 1098123200+ | 戈尔德鲁夫 |
| 1098182300+ | 尼莫 |
| 98115000+ | 通信角色 |

这些 ID 前缀是样本中的资源命名惯例，不是严格的数值范围定义；同一角色或用途可能存在例外。

### BGM 标识索引

| 前缀 | 用途 |
|------|------|
| `BGM_EVENT_` | 事件/剧情音乐 |
| `BGM_MAP_` | 地图探索音乐 |
| `BGM_BATTLE_` | 战斗音乐 |
| `BGM_ENDING_` | 结尾音乐 |

当前样本还观察到 `BGM_MYROOM_`、`BGM_HALLOWEEN_`、`BGM_TITLE_` 等前缀；本表不是完整索引。

### 场景 ID 范围

| ID 范围 | 类型 |
|---------|------|
| 10000-11000 | 迦勒底内部 |
| 21230+ | 城市/街道 |
| 95200+ | 特殊场景 |
| 142200+ | 异闻带场景 |

这些是样本中观察到的 ID 聚类，不应理解为互不重叠或覆盖全部场景的严格范围。

### 缓动函数参考

| 名称 | 效果 |
|------|------|
| `easeInBack` | 缓入（回弹） |
| `easeInCubic` | 缓入（三次） |
| `easeInExpo` | 缓入（指数） |
| `easeInOutCubic` | 入出（三次） |
| `easeInOutQuart` | 入出（四次） |
| `easeInQuad` | 缓入（二次） |
| `easeOutQuad` | 缓出（二次） |
| `easeOutSine` | 缓出（正弦） |
| `easeOutExpo` | 缓出（指数） |
| `easeOutBack` | 缓出（回弹） |
| `easeOutCirc` | 缓出（圆形） |
| `easeOutQuart` | 缓出（四次） |
| `easeOutQuint` | 缓出（五次） |
| `easeOutCubic` | 缓出（三次） |
| `easeOutElastic` | 缓出（弹性） |
| `easeInOutSine` | 入出（正弦） |
| `easeInOutQuad` | 入出（二次） |
| `easeInOutExpo` | 入出（指数） |
| `easeInOutQuint` | 入出（五次） |
| `easeInSine` | 缓入（正弦） |

### 命令统计（部分）

基于 2,583 个脚本文件的原始出现次数；命令嵌入台词时也计数。以下是常用命令和本版本新增/修订命令的部分统计，不等同于完整排名。

| 命令 | 出现次数 | 用途 |
|------|----------|------|
| `[k]` | 184,799 | 等待点击 |
| `[r]` | 133,096 | 换行 |
| `wt` | 116,117 | 时间等待 |
| `charaFace` | 115,973 | 角色表情 |
| `charaTalk` | 70,650 | 角色对话 |
| `charaFadeout` | 76,808 | 角色淡出 |
| `charaFadein` | 74,320 | 角色淡入 |
| `charaSet` | 26,798 | 设置角色 |
| `charaScale` | 15,860 | 角色缩放 |
| `charaDepth` | 21,768 | 角色深度 |
| `line` | 19,539 | 横线长度 |
| `messageOff` | 27,236 | 隐藏消息 |
| `wait` | 26,884 | 等待 |
| `se` | 24,080 | 音效 |
| `cameraMove` | 2,512 | 摄像机移动 |
| `charaMove` | 9,030 | 角色移动 |
| `charaEffect` | 4,657 | 角色效果 |
| `charaEffectStop` | 1,829 | 停止角色效果 |
| `bgm` | 12,478 | 背景音乐 |
| `bgmStop` | 9,146 | 停止BGM |
| `scene` | 10,447 | 切换场景 |
| `fadein` | 8,791 | 淡入 |
| `fadeout` | 8,770 | 淡出 |
| `soundStopAll` | 4,929 | 停止所有声音 |
| `seStop` | 11,506 | 停止音效 |
| `seVolume` | 10,256 | 音效音量 |
| `effect` | 3,164 | 视觉效果 |
| `fowardEffect` | 1,303 | 前向效果 |
| `flashin` | 1,231 | 闪光 |
| `shake` | 2,426 | 震动 |
| `charaFilter` | 890 | 角色滤镜（剪影/正常） |
| `charaLayer` | 8,269 | 角色图层（normal/main/sub #A~#D/mask） |
| `charaEffectEdgeBlur` | 178 | 角色边缘模糊 |
| `subCameraFilter` | 1,948 | 子摄像机滤镜（8种模式） |
| `blur` | 523 | 模糊（lens/motion/glass） |
| `cameraFilter` | 356 | 摄像机滤镜（含 darkred） |
| `masterNameWidth` | 1 | 主角名称宽度 |
| `backlogStart/End` | 16/16 | 日志段落标记 |
| `effectStart/Pause` | 1/1 | 全局效果恢复/暂停 |
| `fowardEffectStart/Pause` | 4/4 | 前向效果恢复/暂停 |

### 特殊标记说明

以下标记并非独立命令，而是其他语法的组成部分：

| 标记 | 实际用途 |
|------|----------|
| `[A]`, `[B]`, `[C]` ... `[Z]` | `spot` 标记的一部分，用于多角色对话 |
| `[A,B]`, `[C,D]` 等 | `spot` 标记的槽位列表，如 `＠角色=spot[A,B]` |
| `[charaTalk on]` | 开启对话模式（场景过渡后重置对话状态） |
| `[charaTalk A,B]` | 多角色同时说话 |
| `=spot[...]` | 对话行标记，表示多个角色共同说出台词 |
| `[q]` | 对话消息段边界；解析器还支持 `[page]` |
| `[Q]` | 当前样本中主要作为 `spot` 槽位（例如 `spot[Q]`），不是 `[q]` 的大小写变体 |
| `[s 参数]` | 对话速度短写；Atlas 解析器按速度处理 |
| `[I]` | 单字母 spot 标记（极少单独使用） |
| `[line3]` | `[line 3]` 的简写形式 |

### 仍未完全确认的命令

| 命令 | 推测用途 |
|------|----------|
| `scrollStop` | 滚动停止（引擎确认存在 `ScriptManager.isScrollStop` 字段与同名标签） |
| `capture` / `captureRelease` | 屏幕捕获相关（引擎确认：`captureTexture` RenderTexture 与 `meshCaptureBase` 网格层） |
| `interruption` | 中断标记（引擎确认存在同名标签与 `isScriptInterruption` 字段） |
| `tapSkip` | 点击跳过标记（引擎确认存在 `tapSkipLabel`/`tapSkipFade` 字段） |
| `useSimpleMeshFigure` | 简化网格模型显示（引擎确认存在 `simpleMeshFigureNames` 列表） |
| `autoAndBackLog` | 自动返回日志 |
| `wipeFilter` | 擦除滤镜（支持 `cinema`、`circleIn`、`openEye`、`downToUp` 等模式；引擎侧 `SetWipeFilter`） |
| `voiceStop` 双参数形式 | 第二个参数（如 `0`）含义不明，可能是停止模式 |

---

### 客户端逆向资料

以下资料支撑了本文所有"客户端逆向确认"级结论，分析对象为 `1.apk`（`com.aniplex.fategrandorder` 2.138.0 / versionCode 496，Unity IL2CPP）：

| 产物 | 路径 | 说明 |
|---|---|---|
| Il2CppDumper 导出 | `F:\Project\fgo\fgo_dump\dump.cs` | 全部 18,259 个 C# 类型/方法签名 + RVA；同目录 `script.json`（24 万函数地址）、`stringliteral.json`、`DummyDll\` |
| 分析总报告 | `F:\Project\fgo\fgo_dump\FGO剧情引擎分析报告.md` | 引擎结构、渲染链、产物索引 |
| 标签分发还原 | `F:\Project\fgo\fgo_dump\tag_handlers.json`、`dispatch_trace.txt`、`cell_strings.json` | capstone 反汇编 `ScriptCommandExecute` 的分支调用摘要与字符串桥接表 |
| 样本标签统计 | `F:\Project\fgo\fgo_dump\script_file_tags.json` | 2,583 个脚本文件的 299 种标签词频 |
| Java 层反编译 | `F:\Project\fgo\fgo_apk\jadx_out\` | 仅平台插件，无剧情逻辑 |
| Ghidra 工程 | `F:\Project\fgo\ghidra_proj\` | 已导入 `libil2cpp.so`；**PIE 基址：Ghidra 地址 = RVA + 0x100000** |

本文引用的关键 RVA（Il2CppDumper 口径）：

| 方法 | RVA | 作用 |
|---|---|---|
| `ScriptManager$$ScriptCommandExecute` | 0x30FA9D4 | 标签分发器（string switch） |
| `ScriptManager$$ScriptAnalys` | 0x313C968 | 按行切分脚本 |
| `ScriptManager$$AnalysText` | 0x314154C | 解析 ＠ 说话者与行内标记 |
| `ScriptManager$$LoadScript` | 0x313C670 | 脚本加载（含解密） |
| `ScriptManager$$ExecuteScript` | 0x313C2A0 | 执行状态机 |
| `ScriptPosition$$GetPosition` | 0x317EC40 / 0x317ECF4 | 槽位表查询 / 坐标直通 |
| `UIScriptChara$$SetBasePosition` | 0x3186540 | 角色基座位置写入 |
| `ScriptManager$$SetCharaFace` | 0x314FAC0 | 表情切换 |
| `ScriptManager$$SetSceneImage` | 0x314FF40 | [scene] 背景装载 |
| `ScriptManager$$PlayCRIMovie` | 0x3153FD8 | [movie] 播放 |

引擎静态常量（`ScriptManager`/`UIStandFigureRender`/`ScriptPosition` 的 `.cctor`，值取自 `.rodata` 字面量池）：
`CHARA_MAX=26`、`FACE_MAX=133`、`DEFAULT_FADE_TIME=0.5`、`PICTURE_FRAME_Z_POS_NORMAL=-10`、`PICTURE_FRAME_Z_POS_TOP=-230`、
`PICTURE_FRAME_SPRITE_WIDTH_16_9=1025`、`PICTURE_FRAME_SPRITE_WIDTH_21_9=1346`、`defaultForceObi_16_9=true`、
立绘表 `1024×2048`、表情块 `254×254`、`ScriptPosition.positionList = {(-256,0), (0,0), (256,0), (-438,0), (-512,0), (438,0), (512,0)}`。

---

> **文档版本**: v1.8
> **生成日期**: 2026-08-30
> **基于文件数**: 2,583 个脚本 + 客户端 APK 2.138.0 逆向
> **更新内容**: 
> - v1.8: 命令参考章新增**命令总索引（语料全集）**——覆盖全部 267 种标签（4 类伪标签指向语法章）的词频、典型形态与一句话语义，机器生成自语料全量统计；词频 0 表示引擎支持但当前语料未使用（如 `[tRoute]`，引擎侧有专用解析正则）；补齐 `[backlogStart]/[backlogEnd]`、`[capture]/[captureRelease]`、`[f]` 字号标记、`[-]` 颜色复位等此前未单独收录的条目
> - v1.7: 新增**非官方剧情阅读器实现指南**：三段管线总体架构（对应引擎解析/编译/执行分层）、脚本解析标准（行分类、分词容错）、执行语义标准（`ScriptManager.State` 17 态状态机、阻塞模型四分类、`StartMode` 17 种开场淡入、自动播放/跳过/分支状态）、画面演出标准（画布口径、层序、镜头仿射链、转场默认时长）、素材体系与 `[fsm]` 类演出降级策略、引擎常量速查表；补充 `ScriptCharaData.Kind` 五类槽位与 `setScene`/`imageSet` 命令族的共用关系
> - v1.6: 用引擎逆向证据重写脚本格式解释：文件命名规则修正为引擎确认的 `{questId:D8}{phase:D1}{尾号}` 结构（尾号 0-9 含义表来自 `SCRIPT_NAME_BATTLE_*` 常量）；`＄/＠` 行首码改为"数据驱动字段"说明（`codeSceneString/codeTalkString` 等由通用脚本数据初始化，`＠` 已在二进制中找到常量）；补充 `GetCommandTag` 分词算法（遇空格或 `]` 结束、命令名大小写敏感）；补充对话行引擎机制（`talkName` 匹配槽位、行内标签与命令同管线、`isScriptWait` 等待机制）；补充 `debugComment` 注释标签、文本标记引擎词表（多字符标记字符串比较、单字符标记字符比较）、自动播放等待模板 `AUTO_WAIT_TAG_FORMAT`、变量替换 `ScriptReplaceString` 实现
> - v1.5: 引入**客户端逆向确认**证据等级（APK 2.138.0 IL2CPP 逆向，见附录"客户端逆向资料"）；新增**画面合成与坐标系**一章（引擎解析管线、NGUI+多相机合成栈、坐标直通证据、7 槽位表、遮幅/宽屏常量）；"角色位置"升级为引擎确认并补充 `ScriptPosition.positionList` 槽位表与素材 00 点说明；新增"素材的 00 点（锚点）"（立绘 1024×2048 表、表情块 254×254、纵向锚点在素材下 1/3 处）；确认 `charaRelativeLoopMove` 为基座相对偏移；确认 `scrollStop`/`capture`/`interruption`/`tapSkip`/`useSimpleMeshFigure`/`wipeFilter` 的引擎侧字段
> - v1.4: 按当前 2,583 个文件重新校准头部覆盖率和行号分布；补充 Atlas Academy 解析器的证据边界、`UNPARSED` 行为、文本标记解析、BGM 参数顺序、`wait`/`wt` 差异、`line` 横线语义、场景扩展参数、选项和结束标记兼容性
> - v1.3: 修正头部位置和文件名映射说明；明确命令可嵌入台词；统一可选参数表示；修正 `cameraMoveEase`、`charaFilter`、擦除方向和 `tVoice` 大小写；补充分支选择语法、等待参数变体、缓动函数和统计口径；精确化 `overlayFadein`、等待类型和子渲染层可选参数；修正完整分支示例
> - v1.2: 补充 `wait` 完整类型列表（25+种）、扩展淡入淡出颜色值（18+种）、扩展擦除方向（30+种）、修正 `charaFilter` 格式描述、补充 `charaLayer` 子层（#C/#D/#mask/main）、补充 `subCameraFilter` 模式、补充模糊类型（motion/glass）、补充 `cameraFilter darkred`、添加 `masterNameWidth` 命令、添加 `soundStopAllFade` 参数说明、添加 `effectStart`/`effectPause`/`fowardEffectStart`/`fowardEffectPause` 详细说明、添加 `seContinueVolume`/`cueSeContinueVolume` 参数表、修正 `＄` 头部非必需说明、修正 `voiceStop` 双参数形式
> - v1.1: 补充了多角色对话标记（spot）、多角色 charaTalk、角色移动位置变体（FSL/FSR/SideL/SideR）、子渲染层完整命令、角色效果暂停/恢复、对话模式开关（charaTalk on）等
> **说明**: 本文档基于实际脚本文件逆向分析。命令拼写和常见参数形式以样本为准；资源 ID、效果参数和少量控制流语义仍可能存在推测或历史兼容差异。

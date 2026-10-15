# FGO 剧情脚本格式(实证版)

> ⚠️ **本文核心语法节已被真实脚本证伪,请以补充卷为准** —— 见 `supplement-script-format.md` 与
> `coverage-verification.md`。要点:①行语法是 `[tag args]`(整行括号),不是 `<tag> [参数...]`;
> ②消息体是纯文本行 + `＠` 说话人行,真实语料中 `message2`/`message3`/`talkName`/`page` 等 **0 次**;
> ③`＠`/`＄`/`＃`/`？`/`？！` 等控制符来自 APK 内置本地化表(已实证,`_evidence/marker-table.md`);
> ④"引号未出现"有误,`"` 有 4 处实测比较点;⑤脚本正文无任何反斜杠转义。

对象:`Fate/Grand Order` Android 2.139.3(`com.aniplex.fategrandorder`,IL2CPP,Unity 6000.0.68f1)。
所有结论都标注了二进制中的证据位置(VA = `libil2cpp.so` 中的虚拟地址,YAML/AOT dump 由 Il2CppDumper 生成)。
**未证实的内容一律标 INFFERED(推断)**,请不要当成事实使用。

---

## 1. 脚本文件是什么

剧情脚本不是二进制字节码,而是**纯文本**。依据:

| 证据 | 说明 |
|---|---|
| `ScriptManager$$AnalysScript(string scriptData, string orgScriptData)` VA `0x31a50ec` | 形参就是字符串;内部按行处理 |
| `ScriptManager$$AnalysParam(string data)` VA `0x31a7688` | 把一个参数串切成 `string[]`,内部用 `' '`、`'='`、`','` 三个字面量做字符扫描(见 §2) |
| `ScriptManager$$ScriptAnalys(label, scriptData, oriScriptData)` VA `0x31a4620` | 全文件级解析,返回 `List<List<string>>` |
| `ScriptManager$$GetScriptData()` VA `0x31a3ba8` | 拼接资源名(带 `Q`/`E`/`W` 后缀)后取文本 |
| 转义字面量 `'\\n' '\\t' '\\r' '\\b' '\\f' '\\\\'` 出现在 `AnalysScript` 中 | 文本里存在转义序列,解析时要反转义 |

脚本经由资源系统加载(`AssetManager.isExistAssetStorage` / `AssetManager.isNeedDownload` / `AssetLoader.LoadEndDataHandler`,见 `ScriptManager$$LoadScript` VA `0x31a4328`),即**脚本是下载资源**,不在 APK 内(APK 只带一个资源清单桩)。

---

## 2. 行语法

```
<line>       ::= <comment> | <empty> | <statement>
<statement>  ::= <tag> [ <param> ... ]
<comment>    ::= ("#" | "//") <任意文本>
```

- 分隔符是**空格**;`AnalysParam` 里还有 `'='` 与 `','`:`key=value` 形式的参数与列表型参数。
- 反引号/引号未在证据中出现;`AnalysParam` 只处理 `' '`、`'='`、`,`三种字符,所以参数内部含空格时依赖命令自身的约定(例如消息体把剩余部分整体作为文本)。
- 转义:`\n \t \r \b \f \\` 在文本中生效。

### 行分类
`AnalysScript` 会先把行分类(产出 `tagDataList` / `scriptDataList` / `lineDataList` / `messageLine` 等),
分类结果决定这一行是"消息行"还是"命令/结构行"(`ScriptManager$$IsMessageLine` VA `0x31b7ad4` 只是查这个预计算数组)。

- **消息相关标签**(在 `ScriptManager$$ProcessScript` VA `0x31bc344` 中被显式比较):
  `messageStart`、`message2`、`message3`、`page`、`page2`、`clear`、`clear2`、
  `talkName` / `talkName2` / `talkName3` / `talkNameBack`、
  `talkStart` / `talkEnd`、`line`、`fontSize`、`betweenHeight`、`detail`、`messageChange`、`messageAlign`、
  `messageShake` / `messageShakeStop`。
  处理链(实证):`page`/`page2` → `ScriptMessageCommonManager$$PageScroll`(`0x31d4b44`)、
  `WaitNextTouch`(`0x31d4708`);`message2`/`message3` → `RequestFastMessage`(`0x31d46e4`)/
  `ReturnScroll`(`0x31d4840`);`talkName*` → `IsEqualTalkName`(`0x31b4e64`)。
  同一行还会先经 `AnalysParam`(`0x31a7688`)与 `ScriptMessageLabel$$GetFontSize`(`0x31d271c`),
  然后才交给命令分发器 —— 也就是说**消息行与命令行共用同一条执行路径**,
  分发器对不认识的行返回 `ReturnFalse`,消息系统接管。
- **控制流**:`label`(跳转目标,`SetJumpIndexByLabel` VA `0x31b2b88` 用 `String.Equals` 比对标签名)、
  `switchCase` / `switchCaseEnd`、`ifClear` / `else` / `endIf`、`branch*`、`selectBranch`、`menu`、`jump`、`skip`、`Loop`。
- **表现命令**:约 300+ 个,见 §4。
- 其余行按消息体处理(INFERRED:这是"未识别的 tag 即消息"这一常见设计,`AnalysText` 持有一张"已知标签"表,表中没有的按消息文本渲染)。

---

## 3. 消息文本内嵌标记(markup)

证据来自 `ScriptMessageLabel` / `ScriptMessageCommonManager` / `ScriptLineMessage` 的字面量与正则:

| 标记 | 含义 | 证据 |
|---|---|---|
| `[#RRGGBB]` … `[-]` | 颜色起 / 颜色止 | `'[#'`, `'[-]'`, `'#'`, `GetColor(VA 0x31d781c)`, `EnforceColorTag`, `RemoveColorTag` |
| `[#ruby:base]` | 注音(振り仮名) | 正则字面量 `\[#[^:]+:[^:]+\]`,`HasRubyFormat`,`UpdateRuby` |
| `[r]` | 换行 | 字面量 `'[r]'` |
| `[line <n>]` | 行内图片(线) | `'[line '`,`UpdateLine(..., string imageStr = "line")` |
| `[image <name>]` | 行内图片 | `'[image '`,`UpdateImage` |
| `[~<n>]` / `[^…]` / `[*…]` / `[=…]` | 行内效果/标记 | 字面量 `'[~'`,`'[~1]'`,`'[^'`,`'[*'`,`'[='` |
| `[tRoute <routeId> <text>]` | **分支相关文本**:按已选路线替换 | 正则 `\[tRoute (?<id>[0-9]+) (?<text>.+)\]`(VA 处 `0x31a47c0`) |
| `・` / `■` | 傍点(bouten)/ 强调符 | `UpdateBouten`,字面量 `'・'`,`'■'` |
| 全角 `［` `］` `：` | 名称与称号分隔等 | `GetTagFairingString`,`GetTalkName`(用 `'：'`) |
| `small` / `medium` / `large` / `x-small` / `x-large` | 字号关键字 | `ScriptMessageLabel$$.cctor` |
| `top` / `center` / `bottom` | 对齐 | `GetVerticalAlignFromString` |
| `icon_class_{0:D3}` | 表情图标资源命名 | `ScriptMessageLabel$$GetTalkName` |

`talkName` 的解析(`GetTalkName(out imageName, out className, out charaName, out charaIndex, talkName)`)会用 `'：'`、`'[image '`、`'icon_class_{0:D3}'` 拆出立绘/称号/名字。

> 播放器实现建议:遇到不认识的 `[...]` 一律原样保留文本,不要丢弃 —— 因为标记集合会随版本变化。

---

## 4. 命令表

- **命令条目 366 个**(含别名与共用 body),对应 379 个哈希常量(其中一部分属于 `pd[0]` 的**子命令分发树**)。
  做法:`ScriptCommandExecute` 里 `switch (tag)` 被编译成 **FNV-1a 32 位哈希判定树**,于是对全部字面量算
  FNV-1a 与 `movz/movk` 立即数比对,常量全部命中。逐命令表见 `out/commands.md` / `out/commands.json`。
- 命令集分三层,不要混为一谈:
  1. **哈希树分发的 366 条命令**(`out/commands.json`,本次最完整的表);
  2. **`pd[0]` 子命令树**(根 VA `0x318753c`,比较寄存器 `x22`,72 个关键字:12 个纯等待关键字
     `time`/`frame`/`rtime`/`charaCut`/`charaFade`/`effectmessage`/`fastPlayDraw`/`fsmObjFinished`/`communicatioChara` 等,
     其余 60 个是命令名,用于 `wait charaMoveEase …` 这类写法);
  3. **显式字符串比较处理的消息/结构行**(不在上面 366 条内):消息体行 `message2` / `message3`
     (在 `ProcessScript` VA `0x31bc344` 与 `ScriptCommandExecute` VA `0x317b20c` 处以 `op_Equality` 比较),
     以及 `page2` / `clear2` 等 "2 系" 变体。
- 另有取自 `ScriptManager$$AnalysText`(VA `0x31a920c`)序言字面量的 386 条清单
  (`il2cpp_out/command_names_raw.json`),里面混有内嵌标记与裸记号;两份清单的差异已整理为
  `out/_evidence/command_names.json`:
  - **仅哈希法有(18)**:`messageStart`、`talkName`、`switchCase`、`switchCaseEnd`、`charaCut`、`charaCutStart`、
    `charaFade`、`communicatioChara`、`effectmessageStart`、`fastPlayDraw`、`frame`、`fsmObjFinished`、
    `masterverticalImageSet`、`rtime`、`skippableTime`、`specialEffectPuase`、`stretchOff`、`time`
  - **仅字面量法有(25)**:内嵌记号(`'#'`、`'['`、`'[r]'`、`'-'`、`'0'`…)、
    `mask`/`maskEdge`、`spriteMaskOn`、`specialEffectDestroy`、`specialEffectPause`、`glass`、`form`、
    `checkOn`、`normal`/`off`、`wt`/`twt`/`rtime `/`time `、`bit_talk_edgeblur_light`(其实是资源名)、
    `maleImageId`/`imagePartsGroupId`(其实是属性名)
- ⚠️ **游戏自身存在拼写错误的指令名**:`specialEffectPuase`(应为 Pause)、`communicatioChara`(少一个 n)、
  `masterverticalImageSet`(小写 v)。阅读器必须按**原样**匹配,不要"纠正"。
### 4.1 参数是位置式的,而且分隔符也占位(重要)

`AnalysParam(string)`(VA `0x31a7688`)分词时会**把分隔符本身也写进数组**:

```
pd[0] = 值, pd[1] = " ", pd[2] = 值, pd[3] = " ", pd[4] = 值, ...
        偶数下标 = 值;奇数下标 = 分隔符(空格 / 逗号 / 等号)
```

- 无参数时 `pd.Length == 0`。
- 每个处理块开头的 `ldr wK,[pd,#0x18]; cmp wK,#N` 是**最少元素数**校验,即 `commands.json` 的
  `min_token_count`(已按分支方向修正:`b.le/b.ls` ⇒ N+1)。
- `,` 与 `=` 也会作为独立元素出现;`' '`(单个空格)表示**省略的参数**。
- ⚠️ 本版本中 `GetStringParameter` / `GetIntegerParameter` / `GetFloatParameter` / `GetPositionParameter`
  **是死代码**(全 `.so` 扫描:仅 `GetIntegerParameter`/`GetFloatParameter` 各调用一次 `GetStringParameter`,
  而它们自身零调用者)。所以**不存在"参数名"字符串**,只能按位置消费:`commands.json` 里
  `params[].name` 为 `null`,`consumer` 字段给出该位置实际由哪个转换函数消费(如 `ConvertBackTextureName`)。

- 典型命令(按功能分组,全部可在表中查到):

| 组 | 命令示例 |
|---|---|
| 背景/场景 | `bScene`, `bSceneLoad`, `scene`, `sceneSet`, `imageSet`, `imageChange`, `clear`, `masterScene`, `masterImageSet`/`masterImageChange`, `warBoardTalkScreen` |
| 角色 | `char`(表内为 `charaSet`/`charaChange`/`charaPut` 系列), `charaFadein*`, `charaMove*`, `charaPutFSSideL/R`, `charaCut`, `charaCutout`, `charaCutin*`, `charaFace`, `charaFaceFade`, `charaFaceIcon`, `charaReturn`, `charaCrossFade`, `charaRoll*`, `charaDepth`, `charaLayer`, `charaShadow`, `charaChange`, `charaClear` |
| 表情/立绘 | `faceTalkScreen`, `talkNameBack`, `equipSet`/`equipChange`, `figureSet`/`figureChange`, `masterImage*`, `masterVerticalImage*`, `masterHorizontalImage*` |
| 相机 | `cameraHome`, `cameraMove`, `cameraMoveEase`, `cameraRoll`, `cameraRollMove`, `subCamera*`, `subRender*`, `cameraFilter`, `subCameraFilter` |
| 转场 | `fade`/`fadein`/`fadeout`/`fadeMove`/`fadeOff`/`overlayFadein`, `wipe`/`wipein`/`wipeout`/`wipeinEx`/`wipeoutEx`/`wipeFilter`/`wipeFilterEx`/`wipeOff`, `mask`/`maskin`/`maskout`/`maskOff`/`maskEdge`, `flashin`/`flashout`/`flashinDep`/`flashoutDep`/`flashOff*`, `stretchin`/`stretchout`, `turnPageOn/Off` |
| 特效 | `effect*`/`backEffect*`/`fowardEffect*`, `charaEffect*`, `specialEffect*`, `charaSpecialEffect*`, `effectmessage*`, `distortionstart/stop/loop`, `blur`/`blurOff`/`subBlur*`, `glass`, `BitEffect`, `spriteMaskOn/Off/Set`, `charaEffectEdgeBlur*` |
| 音频 | `bgm`, `bgmStop`, `bgmStopEnd`, `subBgm`, `subBgmStop`, `se`, `seStop`, `seLoop`, `seVolume`, `seContinue*`, `cueSe*`, `voice`, `voiceStop`, `voiceVolume`, `tVoice*`, `jingle*`, `advSoundSet`, `soundStopAll*` |
| 消息 | `messageOn`, `messageOff`, `messageAlign`, `messageShake`, `messageChange`, `effectmessage`, `effectmessageStop`, `effectmessageDestroy` |
| 流程/分支 | `label`, `branch`, `branchMaterial`, `branchQuestClear`, `branchQuestNotClear`, `branchRouteSelect*`, `branchHaveSvtEquip`, `branchNotHaveSvtEquip`, `branchNotMaterial`, `revivalBranch`, `selectBranch`, `selectionUse`, `selectionCentering`, `switchCase`(见 §2), `ifClear`/`else`/`endIf` |
| 等待/延迟 | `wait`, `wt`, `twt`, `delay`, `tdelay`, `delayEnd`, `delayStop`, `delayStopAll`, `rtime` |
| 影片 | `movie`, `criMovie`, `jingle` |
| 对象/动画驱动 | `fsmObjSet`, `fsmObjSetState`, `fsmObjSetBool`, `fsmObjSetFloat`, `fsmObjSetString`, `fsmObjSendEvent`, `fsmObjDestroy`, `fsmObjLayer`, `advPlayAnimator`, `advActorShow`, `advActorHide`, `insertionAnimation*` |
| 事件/战棋 | `warEventScript`, `warEffectPiece`, `warEffectPos`, `warEffectOff`, `warEffectSquare`, `warMoveCameraPiece/Pos/Square`, `warCharaFadein`, `warBoardTalkScreen` |
| 其他 | `capture`, `captureRelease`, `flag`, `flagRandom`, `flagRandom`, `input`, `notification`, `rewardSwitch`, `questMessageOverwrite`, `gender`, `maleImageId`, `form` |

**每个命令的参数表**:见同目录 `commands.md` / `commands.json`(方法:从 `ScriptCommandExecute` 的分派点回溯到处理块,再读其中对 `GetStringParameter/GetIntegerParameter/GetFloatParameter/GetPositionParameter` 的调用——第 3 个实参就是参数名的字符串字面量)。

### 4.1 两个容易踩的坑(已实测排除)

- **没有 `bg` 指令**。字面量 `'bg'` 确实存在,但它的引用点全部是 UI 对象名与语言代码
  (`BattlePerformanceBg$$GetBgObject` 查子对象、`CultureInfo.CreateSpecificCultureFromNeutral` 的 `bg`=保加利亚语)。
  背景请用 `bScene` / `bSceneLoad` / `scene` / `sceneSet` / `imageSet` / `masterScene`。
- **没有 `mes` 指令**。`mes` 在整个二进制里没有任何代码引用(槽位数为 0)。消息行是
  `message2` / `message3`,由 `CommonMessageManager$$ProcessScript`(`0x3168448` 处比较)
  与 `ScriptManager$$ScriptCommandExecute`(`0x317b20c` 处比较)共同处理;
  翻页用 `page` / `page2`,清屏用 `clear` / `clear2`。

---

## 5. 解析器原型

`tools/fgo_script_parser.py`:把脚本文本解析成结构化 JSON,并可选渲染成 HTML 讲稿。

```bash
python tools/fgo_script_parser.py <script.txt> --json parsed.json --html story.html
```

行为要点(与游戏一致的部分):
- 参数按游戏的 `AnalysParam` 规则切分,**分隔符(' ' / ',' / '=')各占一个数组元素**,见 `pd` 字段(§4.1);
  `params` 是去掉分隔符后的干净值列表,便于阅读。
- `message2` / `message3` / `messageStart` 判为**消息行**,叙事文本取 `pd` 的**最后一个值**(`body` 字段),
  其余为位置参数。
- 行首 `#` / `//` 为注释。

输出结构:

```json
{
  "lines": [
    {"index": 2, "raw": "bScene field_001", "kind": "command", "tag": "bScene",
     "params": ["field_001"], "pd": ["field_001"]},
    {"index": 7, "kind": "message", "tag": "message2",
     "pd": ["0"," ","0"," ", "...", " ", "先輩、[#ff0000]赤い[-]です。[r]改行もできます。"],
     "params": ["0","0","...","先輩、[#ff0000]赤い[-]です。[r]改行もできます。"],
     "body": "先輩、赤いです。改行もできます。",
     "markup": [{"type":"text","value":"先輩、"},
                 {"type":"color","value":"ff0000"},
                 {"type":"text","value":"赤い"},
                 {"type":"tag","name":"-","meaning":"end of colour span"},
                 {"type":"text","value":"です。"},
                 {"type":"tag","name":"r","meaning":"line break"},
                 {"type":"text","value":"改行もできます。"}]}
  ],
  "labels": {"routeA": 14}
}
```

> 注意:`body` 是原文(含标记);`markup` 是切分后的片段,渲染时应跳过 `type=tag` 中 `meaning` 为空
> 的未知标记会丢失样式,请按 §3 的建议原样保留文本。

运行自测(合成样本,仅用于验证解析器,非真实剧本):
`out/_evidence/sample_synthetic.txt`(文件首行已注明)。

### 播放器需要补齐的两件事
1. **参数语义**:按 `out/commands.json` 的 schema 消费参数——注意 §4.1 的 `pd[]` **交错分隔符**布局,
   以及 `params[].consumer` 指出的转换函数。
2. **等待模型**:哪些命令阻塞、等多久,取决于 `ScriptManager` 的 delay 系统(`ScriptCommandDelayParam`、`ProcessDelayScript`、`GetAutoWaitTime`),见 `presentation.md`。

---

## 6. 执行模型(用于"脚本代码解释")

### 6.1 单条命令的返回值

```csharp
// dump.cs: private enum ScriptManager.ScriptCommandExecuteReturnCode
Normal      = 0;   // 已处理,按正常节奏继续
Continue    = 1;   // 已处理,但需要"继续/连击"语义(例如需要点击推进)
ReturnFalse = 2;   // 本行不是命令(交给消息/其它路径处理)
```

`ScriptCommandExecute(tag, pd, line, data, ref scriptErrorMessage, ref isScriptWait, …)`
(VA `0x3177290`,函数体 0x3177290–0x319402c)就是这条链的终点:它用 **FNV-1a 哈希树**分派
`tag`(见 `out/commands.md`),命中后解析 `pd` 参数数组。

命令体执行完统一跳到公共尾声,地址与返回值一一对应(实证):

| 尾声 | 返回值 |
|---|---|
| `0x3193f00` | `Normal` |
| `0x3193f04` | `Continue` |
| `0x3188c6c` | `ReturnFalse` |
| `0x3193e80` | (报错出口,参数长度不足) |

### 6.2 状态机

```csharp
// ScriptManager.State
NONE=0, IDLE=1, LOAD=2, EXECUTE=3, WAIT=4, WAIT_SKIP=5, WAIT_EXIT=6, EXIT=7,
BACK_VIEW_INIT=8, BACK_VIEW=9, FIGURE_VIEW_INIT=10, FIGURE_VIEW=11,
EQUIPGRAPH_VIEW_INIT=12, EQUIPGRAPH_VIEW=13, IMAGE_VIEW_INIT=14, IMAGE_VIEW=15, ERROR=16
```

`EXECUTE` 逐行推进;遇到阻塞型命令进入 `WAIT`(可被跳过 → `WAIT_SKIP`);播放模式另有
`PlayMode.NORMAL/DEBUG/BACK/FIGURE/EQUIPGRAPH/IMAGE`(观察模式,不推进剧情)。

### 6.3 延迟/自动播放参数

```csharp
// ScriptCommandDelayParam (dump.cs 4813)
int   executeIndex;      // 起始行
int   executeIndexMax;   // 结束行
float delaySecond;       // 该段延迟秒数
bool  skipDropFlag;      // 跳过时是否丢弃
bool  messageFlag;       // 是否消息行
bool  checkTextSpeed;    // 是否受文字速度影响
```

读取方式见 `ScriptManager.UpdateDelayScript` / `ProcessDelayScript` / `DelayStop` /
`GetNextDelayEnd` / `TDelayJumpScript`(VA 见 `annotate_func.py` 输出)。
自动播放的等待时间由 `SetAutoWait` / `GetAutoWaitTime(stringCount)` / `GetCommandTag(startIdx, data)` /
`CheckNotSetAutoWaitCommand(commands, data)` 计算 —— 即"按本行字符数换算等待时间,
但某些命令不参与计数"。

### 6.4 起播模式与画面初始状态

```csharp
// ScriptManager.StartMode
CLEAR_BLACK, CLEAR_WHITE, BLACK_CLEAR, WHITE_CLEAR, CLEAR, BLACK, WHITE, FULL,
CLEAR_FULL, BLACK_FULL, WHITE_FULL, CLEAR_BLACK_FULL, CLEAR_WHITE_FULL,
THROUGH, THROUGH_BLACK, BLACK_SCENE_STOP
```

入参来自资源名解析(`GetStartModeForAssetStorage`,见 `asset-pipeline.md`)。
播放器可用它决定"从黑场淡入 / 全屏图开始 / 直接贯穿"。

### 6.5 角色槽位

```csharp
// ScriptCharaData
Kind  : FIGURE=0, EQUIP=1, IMAGE=2, VERTICAL_IMAGE=3, HORIZONTAL_IMAGE=4
State : LOAD=0, IDLE=1, MOVE=2, DESTROY=3
```

即剧情里"角色位"不只放立绘:`EQUIP`(礼装图)、`IMAGE`、`VERTICAL_IMAGE`、`HORIZONTAL_IMAGE`
共用同一套槽位系统 —— 这就是 `masterImage*` / `verticalImage*` / `horizontalImage*` /
`equipChange` 这些命令能互相同位替换的原因。

### 6.6 循环/开关块

`ScriptLoop`(dump.cs 4831)持有 `count` / `switchCaseCount` / `switchCaseIndex` /
`switchCaseMessage` / `lastSelectedIndex`,配合 `switchCase` / `switchCaseEnd` / `Loop` /
`selectionUse` / `selectionCentering` 实现选项与循环;被选中的选项文本会进入回想日志
(`switchCaseMessage`、`SetSelectLogMessage`)。

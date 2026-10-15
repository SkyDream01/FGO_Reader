# FGO 剧情脚本文档 —— 覆盖度核查报告

对象:`Fate/Grand Order` Android 2.139.3(`com.aniplex.fategrandorder`,IL2CPP,arm64)。
核查语料:`scripts\` 33 章 **2,583 个真实剧本 `.txt`,1,867,761 行**(非合成样本)。
核查日期:2026-10-14。核查方式:**语料侧全量统计 ↔ 文档断言逐条对拍 ↔ `libil2cpp.so` 反编译取证**。

> 行数口径说明:本文统一用"Python 逐行迭代"口径 = **1,867,761 行**(文件末行未换行也算 1 行)。
> `supplement-markup.md` 的"物理行 1,870,344"是"按 `\n` 切分"口径,每个文件多算 1 个尾部空段(+2,583),两者不矛盾。

---

## 0. 总判定

| 文档 | 判定 | 一句话结论 |
|---|---|---|
| **剧情脚本解析** `script-format.md` | ❌ **核心语法节错误,需修正** | 格式不是 `<tag> [参数...]` 而是 `[tag args]`;消息不是 `message2/3` 而是纯文本行 + `＠`;漏了 `＄`/`？`/`？！` 控制符与 `[k]`/`[wt]` |
| **脚本代码解释** `commands.md` / `command-params.md` / `params-*.md` | ⚠️ **主干可用,有漏项与错标** | 366/384 哈希常量已命名;漏 `wt`(114,251 次)/`effectmessage`;17 个"无名常量"实为 `wait` 子关键字与树边界;6 处漏参、3 类矛盾 |
| **动画效果** `presentation.md` | ⚠️ **主链 PASS,两处大 GAP** | 相机/转场/子层/FSM PASS;角色演出面(§5)与时间模型(§8)缺 `charaTalk`/`charaMoveEase`/`wt` 等;缓动清单完全缺失(语料 21 名 ↔ 二进制 33 名) |
| **画面构建** `composition.md` | ✅ **基本 PASS,3 处小修正** | 资源命名/层序/坐标自洽;`GetPosition` 返回值、`imageSet` 第 3 参、`master*` 性别双资源需修正 |

补充产物(本次新增,**未改动任何既有文档**):

| 文件 | 行数 | 内容 |
|---|---|---|
| `work/out/supplement-script-format.md` | 617 | 行语法修正、行分类规则、`k`/`wt`/`twt` 执行位置、引号/转义纠正、控制符全表与选项语法(§F) |
| `work/out/supplement-command-coverage.md` | 305 | 384 哈希常量收口、`effectmessage`/`wt`/`k` 语义、60 条高频命令参数对拍、118 条零出现命令清单 |
| `work/out/supplement-markup.md` | 795 | 消息内嵌标记全量清单(14 种非命令标记 + 次数 + 引擎解析点) |
| `work/out/supplement-presentation-composition.md` | 396 | 演出/画面逐系统覆盖度核查、缓动清单、关键字取值域、画面构建修正 |
| `work/out/_evidence/marker-table.md` | 164 | **控制符实证表**(本次新解,见 §1.3) |
| `work/out/_evidence/supplement-*.findings.json` | 4 个 | 每条结论的 claim/evidence(VA)/confidence 机器可读记录 |

复核工具(本次新增,均在 `work/coverage/`):`census.py`(全量标签普查)、`usage.py`(参数形态画像)、
`classify.py`(行分类器+哈希对拍)、`win.py`(带字面量注解的反汇编窗口)、`dumpfunc.py`、`charlit.py`/`fullscan.py`/`markerscan.py`(字符立即数全段扫描)。

---

## 1. 剧情脚本解析 —— ❌ 核心语法错误

### 1.1 硬错误 1:行语法漏了方括号

文档 §2 写的是:

```
<statement> ::= <tag> [ <param> ... ]      # 无括号,空格分隔
```

真实语料**不存在这种行**。真实行是 `[tag args]`(整行被方括号包住),全量统计:

| 行种类 | 行数 | 说明 |
|---|---|---|
| `[tag args]` 整行恰一个括号组、tag 命中哈希树 | **857,520** | 命令 |
| `[tag args]` 整行一个括号组、tag 非哈希命令(压倒性为 `[wt 1.0]`) | 114,315 | 见 §2 |
| `[` 开头但带尾随文本/多括号组 | 11,423 | 消息行(内联标记起头) |
| 纯文本消息体 | 203,209 | |
| `＠` 说话人行 | 184,792 | |
| `＄` 标签行 | 2,582 | 每文件恰 1 行 |
| 空行 | 493,920 | |

证据:`ScriptManager$$ProcessScript` 0x31c08f8 `mov w1,#0x5b` / 0x31c0908 `mov w1,#0x5d`(括号修剪);
`ScriptManager$$AnalysText` 0x31aa62c `cmp w8,#0x5b`、0x31aaaf8/0x31aab00 括号深度计数;
文档自己的解析器原型样例 `sample_synthetic.txt` 用的是 `bScene field_001` 这种**不存在的裸行写法**,而 `bScene`
在真实语料中 **0 次**(33 章全部用 `[scene <id>]`)。

### 1.2 硬错误 2:消息行不是 `message2`/`message3`

文档 §2 把 `message2`/`message3`/`messageStart`/`talkName`/`talkStart`/`talkEnd`/`page`/`clear` 等列为消息行标签。
真实语料中这些标签的出现次数**全部为 0**。真实消息机制是:

```
＠マシュ                                  ← 说话人行(＠=本地化控制符,见 §1.3)
………先輩。[r]これはいったい、[#どういう事:……]なのでしょう……
[k]                                      ← 点击推进
```

- 消息体就是**普通文本行**(可含内联标记),由 `[k]` 收束;
- 说话人用 `＠`;
- 语料全量统计里,文档 366 条命令中有 **118 条零出现**(分组清单见 `supplement-command-coverage.md` §E)。

### 1.3 硬错误 3 + 最大缺口:控制符没有任何记载(现已实证)

文档从未提到 `＠`/`＄`/`？`/`？！`。本次已把全套控制符从 **APK 基础包内的本地化表**里实证出来:
`work/extract/assets/bin/Data/data.unity3d` → TextAsset **`LocalizationJpn`**(349,803B JSON):

| 键 | 值 | 语义 | 语料次数 |
|---|---|---|---|
| `SCRIPT_ACTION_CODE_LABEL` | `＄` U+FF04 | **入口跳转标签**(`label`) | 2,582(每文件 1 行) |
| `SCRIPT_ACTION_CODE_TALK` | `＠` U+FF20 | 说话人(`talkName`) | 184,792 |
| `SCRIPT_ACTION_CODE_SWITCH_CASE` | `？` U+FF1F | 选项行 | 18,198 |
| `SCRIPT_ACTION_CODE_SWITCH_END` | `？！` | 选项块结束 | 11,684 |
| `SCRIPT_ACTION_CODE_SCENE`/`_COMMENT`/`_VOICE`/`_INSERT`/`_RETURN`/`_SWITCH_CASE_HIDDEN` | `＃`/`＊`/`％％`/`％！`/`￥`/`；` | 场景/注释/语音/插入/返回/隐藏选项 | 0(本语料未用) |

引擎侧闭环(全部为本次反汇编实测):

```
Initialize  0x31a10b4  x23 = 'SCRIPT_ACTION_CODE_LABEL'     ; 键
            0x31a1138  LocalizationManager$$Get               ; 取值(='＄')
            0x31a1140  str x0,[x19,#0x660]                    ; 字段 0x660 := '＄'
            0x31a115c  str x0,[x19,#0x668]                    ; 0x668 := '＃' (SCENE)
            0x31a1178  str x0,[x19,#0x670]                    ; 0x670 := '＠' (TALK)

AnalysScript 0x31a5c6c  StartsWith(line, [x21,#0x660]) → tag='label'
             0x31a5c8c  StartsWith(line, [x21,#0x668]) → tag='scene'
             0x31a5cac  StartsWith(line, [x21,#0x670]) → tag='talkName'
             0x31a5cd8  Substring(1)                          ; 去标记,余下为参数
```

这解释了此前的谜团:全 94MB 代码段里搜不到 `＠`/`＄` 的字符立即数或字面量比较(已用 `fullscan.py` 全量扫描确认),
因为它们是**运行时从本地化表读出**的字段。完整表与复现命令见 `_evidence/marker-table.md`。

> **语义修正**:`＄01-00-00-00-1-0` 不是"section id/章节头",而是**该脚本的入口标签**
> (`label 01-00-00-00-1-0`),值由文件名 `0100000010.txt` 派生。

### 1.4 其他修正

- **引号**:文档称"反引号/引号未在证据中出现" —— 错。`"` 在 `AnalysText` 0x31aa624、`AnalysTagParam` 0x31d10c8、
  `CommonMessageManager$$AnalysText` 0x3166f3c、`AnalysParam` 0x31a77f8 均有比较;语义是"引号内 `[`/`]`/空格失去结构意义,
  引号本身保留"。语料中仅 3 行用到引号,且恰好是这两种用法。
- **转义**:文档 §1 称转义字面量 `\n \t \r \b \f \\` 出现在 `AnalysScript` —— 实际语料含反斜杠的行 **0 行**;
  `AnalysScript` 里那个 `'\r'`(0x31a54c4)是**真实 CR**,用于 `Replace("\r","")` 行尾归一化。脚本正文无任何转义序列。
- **行分类规则**(文档未给):整行恰为一个括号组且 tag 命中哈希树 ⇒ 命令;否则 ⇒ 消息行。这就是为什么
  `[f small]　　`、`[font large][messageShake …]ホロボス…`、`[51d4ff][line 3]…` 都是消息行而不是命令。

---

## 2. 脚本代码解释 —— ⚠️ 主干可用,有漏项与错标

### 2.1 命令表:366/384,差集已收口

`ScriptCommandExecute` 与 `AnalysText` 里共有 **384 个 FNV-1a 哈希常量**(`hash_constants.json` 漏收了 1 个
判定树边界 `0x8643a3f7`)。此前"17 个常量无名"的真相是:

- **13 个**是 `wait` 的 `pd[0]` 子关键字叶子(`time`/`rtime`/`frame`/`charaCut`/`charaFade`/`skippableTime`/
  `effectmessage`/`fastPlayDraw`/`fsmObjFinished`/`communicatioChara`/`masterverticalImageSet` …),属于
  `waitType` 判定树(`root 0x3187544`,输入 `this.waitType` @0x3d8),**不是独立命令**;
- **5 个**是判定树边界值,恰等于 `fnv(某命令名)+1`,**不是命令**。

### 2.2 高频漏项:`wt` / `effectmessage` / `k`

| 项 | 语料次数 | 文档状态 | 实证 |
|---|---|---|---|
| `wt <sec>` | **114,251** | 仅列名,无参数语义 | `AnalysText` 哈希树 0x31aca24;是**行改写宏** → `wait time <t>`(字面量 `'wait'` 0x31ad6f8 + `'time '` 0x31ad724);`twt` → `wait rtime`;秒数 `Single::Parse` 进 `waitCount`(0x3e4, 0x3193790);0 秒直接跳过 |
| `effectmessage` | 12 | 被当成命令列在分组表 | 实为 `wait` 关键字 + 消息窗路径(资产校验 `ConvertTalkEffectName` 0x31aeca8;`MessageEffectIsBusy` 0x31c02f4),**不在命令分派器** |
| `k` | **184,799** | 在表内但语义未核对 | `state=WAIT`(0x317fa40)+`waitType="k"`(0x318f014)→`WaitNextTouch(true)`(0x31c2550);**必须 0 参**(带参报 `'parameter be unnecessary'`) |

附:`LocalizationJpn` 的 `SCRIPT_ACTION_NOT_SET_AUTO_WAIT_TARGET = '(wt|k)'` 从配置侧佐证了 `wt`/`k` 的等待语义。

### 2.3 参数对拍(前 60 高频命令)

- **39 条一致**;
- **6 处漏参**:`cameraMove` 的 `pd[6]` 缩放、`bgm` 的 `pd[4]`、`effect` 系列的 `x,y` 消费点
  (`GetEffectParameter`)、`subCameraFilter`/`subRender*`/`charaEffect*` 的可选尾参;
- **3 类矛盾**(文档会误导实现):
  1. `specialEffect` 表记 `min_token_count=9`,实际首检 `cmp w9,#1`(0x3187610,不足则跳错误出口 0x3193e80)
     —— 按文档实现会拒绝真实写法 `[specialEffect cutting]`;
  2. `se` 的 `cmp #5; b.ne` 只是"5 值形态"分支,不是必需;语料 23,183 次单参 `[se ad1]` 合法;
  3. 多处 `pd` 类型错标(如 `seStop pd[0]` 记 float、`charaLayer`/`charaEffect`/`charaFadeTime` 的 `pd[0]` 记 int,
     而语料 100% 是槽位字母 `A`..`V`/`T` 等)。
- 顺带证实:`scene` 第 3 参 `FULLSCREEN_IMAGE_DEVICE_WIDTH` 是 `ScriptManager.SCENE_MODE` **枚举名**,
  由 `System.Enum.Parse`(0x31c7ef8)解析——所以二进制里搜不到该字符串,这是正常的,不是缺证据。

---

## 3. 动画效果 —— ⚠️ 主链 PASS,角色面/时间面 GAP,缓动清单缺失

### 3.1 PASS 的部分
相机主链(`cameraMove`/`cameraHome`/`cameraMoveEase`/`subCameraOn/Off/Home/Move/Roll`)、
转场族(`fadein/fadeout`/`wipein/wipeout/wipeFilter`/`maskin/maskout`/`flashin/flashout/flashOff`)、
子层结构(`ScriptSubLayer`/`#A` 组)、FSM(`fsmObjSet`/`SetState`/`SendEvent`)在文档中有对应且与语料一致。

### 3.2 §5 角色演出面(大 GAP)
文档缺:`charaPut`(11,521)、`charaMoveEase`(2,559,含缓动名)、`charaMoveScale`/`charaMoveScaleEase`(1,406/433)、
`charaRelativeLoopMove(Stop)`、`charaTalk`(**70,640**,含 `on/off/depthOff`)、`charaFadein/Fadeout` 的完整参数形态
(如 `[charaFadein J 0.4 0,-50]` 第 3 参既可为 `int` 又可为 `x,y`)、`charaShake`/`shake`/`shakeStop` 的 4~5 参形态。

### 3.3 §8 时间面(大 GAP + 矛盾)
- 文档讲的 `delay`/`tdelay`/`delayEnd`/`delayStop`/`delayStopAll` 在 2,583 个 adv 脚本中 **0 次**;
- `wait` 实为 `pd[0]` 关键字分派(`wait` handler 0x31874f4 → `ComputeStringHash` 0x3187530),`time` 用
  `Time.deltaTime`、`rtime` 用 unscaled(0x31bc2a8/0x31bc2b8);
- `wt`(114,251)/`twt` 两文档完全未提(见 §2.2);
- `wait` 的自动播放字数计数受本地化正则 `'(wt|k)'` 与命令表 `'speed,s,tVoice,delay,tdelay'` 排除。

### 3.4 缓动清单(硬缺口,已补)
- 语料全量 `*MoveEase`/`cameraMoveEase` 共 **21 个缓动名,3,928 次**(最高 `easeOutSine` 1,762);
- 二进制侧缓动域 = `iTween.EaseType` 的 **33 个成员**(dump.cs:1102178),转换点
  `iTween$$RetrieveArgs` 0x482d3c4 → `Enum.Parse(..., ignoreCase:true)` 0x482db60;
  `WarBoardManager$$GetEaseTypeScript` 的 33 条字面量(0x2b22d8c–0x2b2320c)与枚举**一毫不差**;
- 差集:语料 → 二进制 = ∅(全部合法);二进制 → 语料 = 12 个未用(`easeInBounce/Circ/Elastic` 族、`easeInQuart/Quint`、`linear/spring/punch`)。
- 两份文档都没有这份清单 → 已补入 `supplement-presentation-composition.md` §B。

### 3.5 其他纠正
- `overlayFadein`(649 次)实为**角色槽位 alpha 命令**(`[overlayFadein I 0.1 0,734]`),不是 fade 族;
- `blur` 的 `lens|motion|glass` 是**关键字**而非命令名(语料 `glass` 命令 0 次);
- `pd[]` **不含 tag**(文档 §1 的 "element[0]=tag" 说法需改):分隔符占奇数下标
  (`charaScale` 3 元素 + `pd[1]==' '` @0x31815a4;`charaMove` `pd[3]` 首字符 `,` @0x31850e4);
- 子层键域实测 `#A/#B/#C/#D/#MASK`(`IsExistTargetSubLayerGroup` @0x31c6e5c 用 `pd[0]+'#'` 判定)。

---

## 4. 画面构建 —— ✅ 基本 PASS,3 处修正

`composition.md` 的资源路径模板、层序/深度、坐标约定与语料自洽(相机/子渲染/槽位统计见补充文档 §D)。需修正:

1. `GetPosition(float,float)`(0x31d8e3c)实际是 `movi d2,#0` + `ret` ⇒ 返回 `(x, y, 0)`,不是 `(0,0,0)`;
2. `imageSet` 第 3 参取值域只有 `1`/`2`(开关),不是"位置";语料中 `[imageSet D 38100 0,0]`(4 次)是把位置写在了第 3 参,
   属脚本作者越界写法,按 `1/2` 实现时需容错;
3. `master*` 家族(`masterSet`/`masterBranch`/`masterImageSet`…)是**性别双资源**机制
   (`[masterBranch _Male01 _Female01]`,`masterSet L <男> <女> <n>`),文档未说明。

另:`charaLayer T sub #A` 的 `sub`/`normal` 层关键字、`pictureFrame` 的 Z 常量
(`PICTURE_FRAME_Z_POS_NORMAL/TOP`)、`PICTURE_FRAME_SPRITE_WIDTH_16_9/21_9` 均已在补充文档中建立语料↔二进制对应。

---

## 5. 结论与建议

**回答"是否完全覆盖":不完全是。** 四个领域里,只有"画面构建"基本达标;其余三块都有实质缺口,其中
"剧情脚本解析"的**核心语法描述与真实脚本不符**,按原文档实现会完全解析不了真实剧本。

建议的文档合入顺序:
1. 用 `supplement-script-format.md` 替换 `script-format.md` 的 §1–§3(语法/行分类/标记),并回改 README 的 TL;DR;
2. 把 `supplement-command-coverage.md` 的 `wt`/`effectmessage`/`k` 条目与 6 处漏参、3 类矛盾并入
   `command-params.md` 与 `command_params.json`;
3. `supplement-markup.md` 替换 `script-format.md` §3 的标记表(注意 `[#RRGGBB]` 应为**裸十六进制** `[51ffff]`,
   `#` 用于注音/傍点);
4. `supplement-presentation-composition.md` 的缓动清单与角色/时间两节并入 `presentation.md`。

**仍未闭环的项(2026-10-14 第二轮"逆向闭环"后更新)**

| 原残余项 | 状态 | 结论与证据 |
|---|---|---|
| ① `？n：` 选项块与分支落点 | ✅ 闭环 | `？n：文本`→tag `switchCase`(参数为 `Substring(1)`,解析期不切分);运行期遇首个 `switchCase` 即弹选择框等待输入,选中后 `JumpScriptSwitchCase`(0x31b2e34)按序号跳到对应行继续,正文撞到下一个 `？`/`？！` 收尾;`？！` 只是终止落点标签。序号写 PlayerPrefs `"ScriptManagerSelectBranch"` + flag `INPUT_SELECT_BRANCH` + `switchSelections`;`selectionUse masterMale/female` 是性别守卫;`？n：文本；flag` 的 `；` 是隐藏选项(flag 真则从列表消失但保留序号)。详见 `_evidence/closure-choice-branch.md` |
| ② `AnalysScript` marker 分支后的 `op_Equality` 长链 | ✅ 闭环 | 链 = "块结构 tag 集合"(`k`/`q`/`talkName`/`selectionUse`/`switchCase`/`switchCaseEnd`/`menu`/`notification`/`input`);`k`/`q` 命中即"结束说话人块"→ `tagDataList.Add("talkEnd")`(0x31a5d40-0x31a5d6c)。详见 `_evidence/closure-exec-model.md` §2.1 |
| ③ `[k]` 的 `null` tag 条目消费点 | ✅ 闭环 | `AnalysText` 仅被 `AnalysScript` 在 0x31a67c0 每行调用(11 参 `ref` 状态);`[k]` 做"闭合消息块"+ 追加 `null` 占位(0x31ad4d8-0x31ad5ec);四条列表按记录对齐,null = 该记录无 tag。运行期消费:`executeMessageFlagList`/`executeMessageMaxSizeList`(字段 0x350/0x358,`AnalysScript` 0x31a756c/0x31a7580 写,`ProcessScript` 0x31c1a20/0x31c1a34 读)、`IsMessageLine` = `executeMessageFlagList[executeLineList[i]]`(0x31b7ad4)。详见 `closure-exec-model.md` |
| ④ 4 元 `char[]` 行分隔符 | ✅ 闭环 | = `U+BBBF, U+FEFF, U+FFFE, U+000A`(字节 `BF BB FF FE FE FF 0A 00`),由 `global-metadata.dat` fields[75761] 的 FieldDefaultValue blob 读出,并以 Roslyn 内容寻址(Roslyn 生成字段名 == 该 blob 的 sha256)自证。详见 `_evidence/closure-meta-assets.md` |
| ⑤ 多语言控制符 | ✅ 闭环 | `LocalizationManager.Get` 读静态字典,表由 `SetTextData` 填充;内置默认 = `data.unity3d` 的 TextAsset `LocalizationJpn`(25 个实例全部指向它);运行时另有 `AssetManager.loadAssetStorage("Localization",…)` 覆盖路径 → **控制符随语言/服务器可变,阅读器应按配置解析**。详见 `closure-meta-assets.md` |
| ⑥ (新增)ADV 脚本资源命名 | ✅ 闭环 | 模板 = `String.Format("{0:D10}", WarEntity.targetId)`(PlayChapterStart 0x319a1f8)、存储名 = `"ScriptActionEncrypt/" + 名前2位`、清单 = `"ScriptActionEncrypt/ScriptFileList"`、存在性 = `名 + ".txt"`(IsExistScriptFile 0x319bf3c);`Q/E/W` 属 PlayQuestStart 模式的同资源追加键。语料对拍:2508/2583 的首行 `＄` 标签与文件名严格一致。详见 `closure-meta-assets.md` |

**仅剩 1 条 INFERRED**(不影响实现):`ProcessScript` 在 0x31bd140 取 tag 后直接 `ComputeStringHash`,未见 null 检查;
`null` 占位记录的跳过点未钉死(候选 0x31bd128-0x31bd13c → 0x31bd5c4/0x31c2850)。阅读器把"无 tag 记录"当消息体处理即与
`executeMessageFlagList` 语义一致。详见 `closure-exec-model.md` §4。

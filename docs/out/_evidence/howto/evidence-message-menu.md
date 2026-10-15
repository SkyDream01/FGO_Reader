# message/menu 证据补录

对象：Fate/Grand Order Android 2.139.3（IL2CPP arm64，`libil2cpp.so`，代码段 `0x2321aa4–0x5311320`）。
本文只补「消息窗、字体和头像（13 条）」+「菜单及显式选项命令（5 条）」两组的 VA 证据与阅读器实现要点。
所有 `0x…` 均为 VA；无直接指令支撑的结论一律标 **INFERRED**。既有文档可复用的部分直接标 `per <文档名>`。

复现命令（工作目录 `F:\Project\fgo\work`）：

```bash
python coverage/win.py <VA> <前字节数> <后字节数>   # 注意：第 2/3 参数是“字节”，不是指令数（4 字节/条）
python tools/klass.py '^类名$'
python tools/mfind.py '方法名正则'
```

语料计数来自 `work/coverage/tag_counts.json`（2583 个 `.txt`，1,867,761 物理行）；`MISSING` = 0 次。

---

## 共享体：分发/参数/字段约定（两组都适用）

`ScriptManager$$ScriptCommandExecute`（`0x3177290`）签名与寄存器（dump.cs + 序言实测 `0x31772b4–0x31772e4`）：

```asm
0x31772c0  adrp x20, #0x55c9000
0x31772cc  ldr  x20, [x20, #0x508]     ; x20 = &pd（后续 ldr x8,[x20] → Pd，+0x18=长度，+0x20+8i=元素i）
0x31772d0  mov  x23, x6                ; ref bool isScriptWait
0x31772d4  mov  x21, x5                ; ref string scriptErrorMessage
0x31772d8  mov  x24, x4                ; string data（整行原文）
0x31772dc  mov  x22, x2                ; string[] pd（menu/notification 的 waitType 赋值读 *x22，见各条）
0x31772e0  mov  x25, x1                ; string tag（命令名，用于 op_Equality 逐名匹配）
0x31772e4  mov  x19, x0                ; this = ScriptManager
```

`ScriptCommandExecute(string tag, string[] pd, int line, string data, ref string scriptErrorMessage, ref bool isScriptWait, ref float delta)`。

**调用方**（全代码段只有 2 个 `bl 0x3177290`：`0x31b6598`、`0x31c1adc`）实证了实参来源：
`x1 = tag = executeTagList[i]`、`x2 = pd`、`x3 = line`、`x4 = data`；其中 **`pd` 是 `ScriptManager$$AnalysParam(string data)`（`0x31a7688`，返回 `string[]`）的返回值**（`0x31c1a1c bl #0x31a7688` → `0x31c1a24 mov x28,x0` → `0x31c1ac8 mov x2,x28`）。

**两条硬约定**（阅读器解析器必须匹配）：

1. `pd` 是「分词结果，分隔符也占一个元素」——偶数下标是值、奇数下标是分隔符（`per out/script-format.md §4.1` / `out/supplement-markup.md §3.13`）。凡「min_token=7」之类的要求，指的就是含分隔符的长度。
2. 参数错误分两种字面量：`'parameter error'`（`0x55c9000+0x58`，跳转点如 `0x3191828`）与 `'parameter be unnecessary'`（`0x55c9000+0x68`，如 `0x3188dc4`）。后者 = 「该命令不接受参数」。

**字段地图（本文用到的全部 offset，来源 dump.cs 类体）**

`ScriptManager`（TypeDefIndex 4870）：

| off | 字段 | 用途 |
|---|---|---|
| 0x28 | `messageManager` : ScriptMessageCommonManager | 全部消息类命令的主对象 |
| 0x58 | `selectDialog` : ScriptSelectDialog | 选项窗（switchCase / menu / selectionCentering） |
| 0x1F8 | `logMessage` : ScriptLogMessage | 回想日志（行距/字体同步） |
| 0x200 | `notificationDialog` : ScriptNotificationDialog | 通知 |
| 0x288 | `state` : State | 4 = WAIT（dump.cs `NONE=0,IDLE=1,LOAD=2,EXECUTE=3,WAIT=4,…`） |
| 0x370 | `isSwitchCase` : bool | 「正在播放某个选项的正文」 |
| 0x3D8 / 0x3E0 | `waitType` / `waitIndex` | 等待类型 |
| 0x3E8 | `waitName` | 通知标题 |
| 0x3F0 / 0x3F8 | `waitTitle` / `waitMessage` | 通知/任务提示的标题与正文 |
| 0x404 | `isQuestOpen` | 通知走「任务开放」对话框 |
| 0x4A0 / 0x4A8 / 0x4B8 / 0x4B0 | `menuMessageList` / `menuLabelList` / `menuRouteList` / `menuRouteSelectEndIndex` | menu 的文本/标签 |
| 0x4C8 / 0x4CC / 0x4D0 | `limitTimeMode` / `limitTimeSeconds` / `limitTimeSeNames` | 选项限时模式 |
| 0x490 | `charaList` : ScriptCharaData[] | charaFaceIcon |

`ScriptMessageCommonManager`（TypeDefIndex 4876）：

| off | 字段 | 用途 |
|---|---|---|
| 0x50 | `messageShake` : Transform | **messageShake 抖动的对象**（消息容器） |
| 0xA0 | `nextMarkSprite` | faceTalkScreen 换图之一 |
| 0xB8 | `defaultBetweenLineHeight` | 行距默认值 |
| 0xE0 | `stepTime` | 打字步进（SetSpeed 写） |
| 0xE4 | `isMessageSpeedForcedNormal` | messageSpeedForcedNormal |
| 0xE8 / 0xF4 / 0xF8 | `textOnlyLineHeight` / `rubyLineHeight` / `betweenLineHeight` | 行距（0xF8 是 betweenHeight 的落点） |
| 0x118 / 0x128 | `defaultFontType` / `fontType` | fontType |
| 0x130 / 0x134 | `fontSize` / `verticalAlign` | `[f …]` 的第二参（≠ messageAlign！） |
| 0x138 | `messageSpeed` | 速度倍率（MessageUpdate 消费） |
| 0x150 / 0x158 | `talkNameAtlas` / `talkNameSpriteName` | talkNameBack 的默认名牌 |
| 0x1B8 | `currentMessageWindow` : ScriptMessageWindow | messageChange |
| 0x1D8/0x1DC/0x1E0/0x1E4 | `shakeTime` / `shakeCycle` / `shakeX` / `shakeY` | messageShake 参数 |
| 0x1EC / 0x1F0 | `horizontalAlign` / `messageAlign` | messageAlign（0x1F0） |

`ScriptMessageWindow`（TypeDefIndex 4883）：`messageWindowBack // 0x28`、`nextMark*`、`talkNameIcon // 0x48`、**`talkNameBack // 0x50`**、`imageSuffix // 0x78`、`messageMainLabel // 0x80` …

---

## 消息窗、字体和头像（13 条）

### betweenHeight / `l`（共享体）

- **handler**：`0x318472c`（**共享体**：`betweenHeight` 与 `l` 同名同体）。
  - `l` case entry `0x317af28`（hash `0xe90c310b`）→ `0x3184710` → 载入 `'l'` 槽 → 汇入 `0x3184720` 的 `op_Equality`；
  - `betweenHeight` case entry `0x317b0a4`（hash `0x9859d490`）→ 载入 `'betweenHeight'` 槽 → **`b #0x3184720`** 同一比较点。
  ```asm
  0x317b0b4  adrp x8, #0x55c9000
  0x317b0c0  ldr  x8, [x8, #0x20]  ; &'betweenHeight'
  0x317b0c4  b    #0x3184720
  0x318471c  ldr  x8, [x8]  ; &'l'
  0x3184720  ldr  x1, [x8]  ; 'l'
  0x3184724  bl   #0x4870cc0  CALL System.String$$op_Equality
  0x3184728  tbz  w0, #0, #0x3188c6c
  0x318472c  ldr  x8, [x20]                       ; pd（两条命令此后完全同体，无 tag 判定）
  ```
- **参数消费**：`pd.Length==1` → `pd[0]=='-'` ⇒ `s8=-1.0f`，否则 `Single.Parse(pd[0])`；`pd.Length==0` ⇒ `-1.0f`；其它长度 ⇒ `parameter error`。
  ```asm
  0x3184738  cmp  w9, #1
  0x318473c  b.ne #0x3188d90                      ; 长度!=1 的另一支
  0x3184750  ldr  x1, [x9]  ; '-'
  0x3184754  bl   #0x4870cc0  CALL System.String$$op_Equality  args: x1='-'
  0x3184758  fmov s8, #-1.00000000
  0x3184778  bl   #0x49e8728  CALL System.Single$$Parse
  0x3188d90  cbnz x9, #0x3193e80                  ; 长度 != 0 → parameter error
  0x3188d9c  fmov s0, #-1.00000000                ; 长度 == 0 → -1
  ```
- **行为**：写入两个对象的行距字段：
  - `ScriptMessageCommonManager.messageManager.SetBetweenLineHeight(v)` `@0x31d28f4`：`v<0` 取默认 `0xB8`，否则写 **`betweenLineHeight // 0xF8`**；
  - `ScriptLogMessage.SetBetweenLineHeight(v)` `@0x3176cec`：同样规则，写 `0x70`（默认 `0x6C`）。
  ```asm
  0x3184780  ldr  x0, [x19, #0x28]                       ; messageManager
  0x3184790  bl   #0x31d28f4  CALL ScriptMessageCommonManager$$SetBetweenLineHeight
  0x3184794  ldr  x0, [x19, #0x1f8]                      ; logMessage
  0x3188db8  bl   #0x3176cec  CALL ScriptLogMessage$$SetBetweenLineHeight
  0x31d28f4  fcmp s0, #0.0
  0x31d28fc  ldr  s0, [x0, #0xb8]                        ; 负 → defaultBetweenLineHeight
  0x31d2908  str  s0, [x0, #0xf8]                        ; betweenLineHeight := v
  ```
- **后端 API 地图**：`ScriptMessageCommonManager$$SetBetweenLineHeight @0x31d28f4`（纯字段写入）；`ScriptLogMessage$$SetBetweenLineHeight @0x3176cec`；`SetDefaultState @0x31d242c` 里 `0x31d2480 str s1,[x19,#0xf8]` 是复位点。
- **资源**：无。
- **阅读器补齐要点**：纯逻辑（CSS `line-height`）。语义：`<0 或 缺省` ⇒ 恢复默认行距；值单位 = 像素（设计分辨率 1024×576 尺度，`per composition.md §2`）。`l` 与 `betweenHeight` 必须都接（单字母命令，注意解析器别把它当未知标记）。对白与回想日志两块都要改（native 同时写 messageManager 与 logMessage）。
- **语料**：`betweenHeight` 0 次、`l` 0 次（两者都是**旧版遗留**，但引擎仍注册）。**置信度**：high（handler/参数/字段/调用链全实证）。
- **未决项**：`betweenLineHeight(0xF8)` 的**读取点**不在 `0x31cc834–0x31d6000`（同编译单元全扫 `#0xf8]` 无 load，只有 2 个 store）⇒ 具体布局公式 **INFERRED**：行距用于标签排版（`get_textLineHeight` `@0x31cc834` 只返回 `textOnlyLineHeight(0xE8)+rubyLineHeight(0xF4)`，是另一组量）。

### charaFaceIcon

- **handler**：`0x3182e04`（case entry `0x317dedc`，hash `0x7ab7e550`，min_token=3）。
- **参数消费**：
  - `pd.Length>=3` 且 `pd[1]==' '`；
  - `pd[0]` → `ScriptManager$$ConvertCharaIndex @0x31b34f0` → 槽号（越界直接报错）；
  - `pd[2]` → `Int32.Parse @0x49d31f4` → 表情编号；
  - `pd.Length>=7` 时 `pd[4]`/`pd[6]` → `Int32.Parse` → X/Y。
  ```asm
  0x3182e38  ldr  x8, [x20]
  0x3182e54  bl   #0x31b34f0  CALL ScriptManager$$ConvertCharaIndex
  0x3182e58  ldr  x8, [x19, #0x490]        ; charaList
  0x3182e74  ldr  x21, [x8, #0x20]          ; charaData[slot]
  0x3182e84  bl   #0x316fcc4  CALL ScriptCharaData$$IsMoveAlpha
  0x3182e88  tbnz w0, #0, #0x3187ed8        ; 正在淡变 → 等 'charaFade'
  0x3182eac  movi d0, #0000000000000000
  0x3182ebc  bl   #0x316fa54  CALL ScriptCharaData$$SetFace
  ```
- **行为**：
  1. `charaList[slot]`（`0x490`）取 `ScriptCharaData`；
  2. 若该角色正在淡变（`IsMoveAlpha()`）⇒ `state=4`(WAIT)、`waitType(0x3D8)='charaFade'`（`0x3187ed8–0x3187ef0`）并返回 —— 标准「等淡变结束」惯用法；
  3. `SetFace(pd[2], 0)` `@0x316fa54`；
  4. `WarBoardMessageScriptMaster.GetMessageEntity(chara.imageName /*0x20*/)` `@0x306e8c0` 命中且有 `pd[4]/pd[6]` 时：`SetMaskData(entity.offsetXFaceTalkCenter, offsetYFaceTalkCenter, widthFaceTalkCenter, heightFaceTalkCenter)` `@0x3170e78` + `SetPosition(pd[4], pd[6])` `@0x316fbcc`；
  5. 收尾 `MoveAlpha(0, 1, true)`（`0x3182f70–0x3182f80` → `0x3193b00` → `@0x316fd5c`）= 立即置 alpha=1。
  ```asm
  0x3182ec4  ldr  x8, [x8, #0xe80]
  0x3182ee4  bl   #0x388b208  CALL DataManager$$GetMaster<object>
  0x3182ef4  bl   #0x306e8c0  CALL WarBoardMessageScriptMaster$$GetMessageEntity
  0x3182f5c  ldp  w1, w2, [x19, #0x1c]     ; offsetX/offsetYFaceTalkCenter（entity）
  0x3182f60  ldp  w3, w4, [x19, #0x24]     ; width/heightFaceTalkCenter
  0x3182f6c  bl   #0x3170e78  CALL ScriptCharaData$$SetMaskData
  0x3182f74  fmov s1, #1.00000000
  0x3193b04  bl   #0x316fd5c  CALL ScriptCharaData$$MoveAlpha
  ```
- **后端 API 地图**：`ScriptCharaData$$SetFace @0x316fa54`、`SetMaskData @0x3170e78`、`SetPosition(float,float) @0x316fbcc`、`IsMoveAlpha @0x316fcc4`、`MoveAlpha @0x316fd5c`；数据源 `WarBoardMessageScriptMaster$$GetMessageEntity @0x306e8c0`（实体字段：`imageId 0x10`、`form 0x18`、`offsetXFaceTalkCenter 0x1C`、`offsetYFaceTalkCenter 0x20`、`widthFaceTalkCenter 0x24`、`heightFaceTalkCenter 0x28`）。
- **资源**：立绘/表情（`ScriptCharaData.imageName`）+ **游戏数据表 WarBoardMessageScript**（imageId+form 主键）。⇒ 属「战棋/战斗演出」缺口（`adv-unrestored.md` 的战棋组同源）。
- **阅读器补齐要点**：数据模型上需要「头像/脸部图标」节点（charaData 的 face + 位置 + 遮罩矩形）与 WarBoard 数据源；目前两者都没有 ⇒ **保留 onUnhandled 诊断**，别用普通立绘冒充。若将来接：`SetFace(type)`→表情贴图，`SetMaskData`→CSS `clip-path: inset()`，`MoveAlpha(0,1,true)`→立即显示。
- **语料**：0 次 ⇒ 只用于 WarBoard 脚本（另一个语料集）。**置信度**：反汇编 high；用途判定 medium-high。
- **未决项**：`SetFace` 的 type→表情资源路径（在 `UIScriptChara`/`Face` 侧，未展开）；遮罩矩形与设计分辨率的换算未取值。

### faceTalkScreen

- **handler**：`0x317cd60`（case entry `0x317cd30`，hash `0xce912426`，无参数，`shared_tail=0x3193f00`）。
- **参数消费**：无（不读 pd）。
- **行为**：把当前消息窗的 **3 个 sprite 换成 WarBoard 版贴图**，全部经 `AtlasManager$$SetWarBoardImage @0x2dbf24c`：
  ```asm
  0x317cd6c  bl   #0x31cc8ac  CALL ScriptMessageCommonManager$$GetMessageBackSprite
  0x317cdd0  bl   #0x2dbf24c  CALL AtlasManager$$SetWarBoardImage  args: x1='img_talk_textbg'
  0x317cde0  bl   #0x31cc8c4  CALL ScriptMessageCommonManager$$GetTalkNameBackSprite
  0x317ce3c  bl   #0x2dbf24c  CALL AtlasManager$$SetWarBoardImage  args: x1='img_talk_namebg'
  0x317ce4c  ldr  x19, [x8, #0xa0]                     ; messageManager.nextMarkSprite
  0x317cea0  bl   #0x2dbf24c  CALL AtlasManager$$SetWarBoardImage  args: x1='img_arrow_under'
  0x317cea4  b    #0x3193f00
  ```
- **后端 API 地图**：`ScriptMessageCommonManager$$GetMessageBackSprite @0x31cc8ac`、`GetTalkNameBackSprite @0x31cc8c4`；`AtlasManager$$SetWarBoardImage @0x2dbf24c`。
- **资源**：3 个 war-board 贴图名 `img_talk_textbg` / `img_talk_namebg` / `img_arrow_under`（**需原始图集**；`SetWarBoardImage` 内部是 AtlasManager 单例的 mark 查表，图集归属未逐字解析，标 INFERRED=WarBoard 专用图集）。
- **阅读器补齐要点**：属「表情屏/战棋消息皮肤」：数据模型加 `messageSkin: 'normal'|'warBoard'`；文档给出 3 个贴图名，但**无资源时不换图**（降级为默认窗口样式 + 诊断），不要用普通图猜。语料 0 次。
- **置信度**：high（调用链与字面量）;**未决项**：贴图实际所在 AssetBundle/Atlas（AssetStorage 明文只给 key，不在此范围内）。

### fontType

- **handler**：`0x31795f8`（case entry `0x31795c8`，hash `0x949487b8`）。
- **参数消费**：`pd.Length==1` 时必须（否则走 `0x3189578`：长度 0 ⇒ 复位默认，长度 ≠0 ⇒ `parameter error 0x3193e80`）；`pd[0]` 空串 或 `=='normal'` ⇒ `font=null`（默认字体）；否则 `ScriptManager$$ConvertFontName @0x31b3898`。
  ```asm
  0x3179604  cmp  w9, #1
  0x3179608  b.ne #0x3189578
  0x3179614  bl   #0x4871c3c  CALL System.String$$IsNullOrEmpty
  0x3179648  bl   #0x4870cc4  CALL System.String$$op_Inequality  args: x1='normal'
  0x3179674  bl   #0x31b3898  CALL ScriptManager$$ConvertFontName
  0x31796a0  bl   #0x2da6474  CALL AssetManager$$getAssetStorage
  0x31796b4  bl   #0x3806f00  CALL AssetData$$GetObject<object>
  0x31796c8  bl   #0x38ebe30  CALL UnityEngine.GameObject$$GetComponent<object>
  0x31796d4  bl   #0x36276a4  CALL UILabel$$get_trueTypeFont
  ```
- **行为**：`messageManager.SetFontType(font) @0x31d25fc` + 同一 font 设到 `logMessage`（`0x318f9a0–0x318f9ac`）。`SetFontType` 内部 `0x31d2664 ldr x19,[x20,#0x118]`：`font==null ⇒ fontType := defaultFontType(0x118)`，否则 `fontType := font`，写 **`0x128`**。
  ```asm
  0x318f98c  ldr  x0, [x19, #0x28]
  0x318f99c  bl   #0x31d25fc  CALL ScriptMessageCommonManager$$SetFontType
  0x31d265c  cbnz x20, #0x31d2668
  0x31d2664  ldr  x19, [x20, #0x118]        ; defaultFontType
  0x31d2670  str  x19, [x20, #0x128]        ; fontType := font ?: default
  ```
- **资源**：`Font/{name}`（`ConvertFontName @0x31b3898`，模板 `0x31b38b0`；`per composition.md §1.2/§5.1`）；默认 UI 字体 `Fonts/FGO-Main-Font`（`UILabel.SetDefaultFont @0x362cc94`）；字体走 AssetStorage 下载（`ScriptManager$$CheckFontData @0x31b11a8`）。
- **阅读器补齐要点**：字体是**原始 Unity 字体资源**（需资源），Web 端只能：① 用 `@font-face` 加载同名 ttf（若有）；② 缺失时 `font=normal` 分支必须真的复位（等价于清掉自定义 font-family），并记录诊断。注意 native 是 NGUI `UILabel`+TrueTypeFont，行高/字距与 DOM 不一致，别追求像素级一致。
- **语料**：0 次（旧版遗留）。**置信度**：high。
- **未决项**：`AssetData.GetObject` 的泛型实参（第二个参数是类型对象，win.py 显示为 `<object>`）；不影响结论。

### messageAlign

- **handler**：`0x3186e48`（case entry `0x317d354`，hash `0xe055dfd1`）。
- **参数消费**：`pd.Length==0` ⇒ `align=""`；否则 `pd[0]`。**取值域：`center`→1、`bottom`→2、其它（含 `top`/空串）→0**。
  ```asm
  0x3186e54  cbz  x9, #0x318b2a0                  ; 长度 0 → 空串槽
  0x3186e60  b    #0x318b2a8
  0x318b2b8  ldr  x1, [x9]  ; 'center'
  0x318b2c0  bl   #0x4870cc0  CALL System.String$$op_Equality  args: x1='center'
  0x318b2d0  mov  w9, #1
  0x318b2e8  ldr  x1, [x8]  ; 'bottom'
  0x318b2fc  mov  w9, #2
  0x318b304  str  w9, [x8, #0x1f0]                ; messageManager.messageAlign := 1|2
  0x318c6fc  str  wzr, [x8, #0x1f0]               ; 其它 → 0
  ```
- **行为**：**直接写字段** `ScriptMessageCommonManager.messageAlign // 0x1F0`（与 `SetMessageVerticalAlign @0x31d2954` 等价，后者就是 `str w1,[x0,#0x1f0]`）。枚举 `ScriptMessageCommonManager.VerticalAlign { Top=0, Center=1, Bottom=2 }`（dump.cs 169540–169546）。
  **消费点**：`GetVerticalAlignedOffset @0x31d2994` 读 `0x1F0`（`0x31d2cdc/0x31d2cf4/0x31d2d14`）算偏移；`CalcMessageVerticalAlign @0x31d295c` 用它把 `dispPosition(0x180).y` 调到 `startPosition.y - offset`。
- **后端 API 地图**：`ScriptMessageCommonManager$$SetMessageVerticalAlign @0x31d2954`、`GetVerticalAlignedOffset @0x31d2994`、`CalcMessageVerticalAlign @0x31d295c`。
- **资源**：无。
- **阅读器补齐要点**：注意**与 `[f … center]` 不是同一条**：`[f …]` 的第二参写 `verticalAlign(0x134)`（标签级，`per supplement-markup.md §3.13`），`messageAlign` 写 `0x1F0`（消息块级）。DOM 侧 = 消息块在窗口内的垂直基准（flex 对齐 / `position` 偏移），CSS 可直接做。
- **语料**：**1 次**：`Final Chapter\0400070720.txt:1219 [messageAlign bottom]`，紧邻 `:1216 [messageChange cinema]`（同一段演出：换成 cinema 窗 + 文本贴底）。**置信度**：high。
- **未决项**：`0x1F0` 只被垂直偏移计算消费；`[align …]`（行内水平）与 `horizontalAlign(0x1EC)` 是 `ProcessScript`/`SetHorizontalAlign` 的另一路，不在本条。

### messageChange

- **handler**：`0x31852b8`（case entry `0x317bce8`，hash `0x9e17a594`，min_token=1）。
- **参数消费**：`pd.Length>=1` ⇒ `pd[0]`；`pd.Length==0` ⇒ 复位默认窗口。无取值域校验（任意资源名）。
- **行为**（切换的是**消息窗 prefab**，即 UI 皮肤，不是显示模式）：
  ```asm
  0x31852c4  bl   #0x31d47c8  CALL ScriptMessageCommonManager$$ResetLongPress
  0x31852d4  bl   #0x31a8220  CALL ScriptManager$$ModifyPlaySpeed
  0x31852f8  bl   #0x31b3ed4  CALL ScriptManager$$ConvertMessageWindowName
  0x3185324  bl   #0x2da6474  CALL AssetManager$$getAssetStorage
  0x318533c  bl   #0x2d9e78c  CALL AssetData$$GetObject  args: x1='prefab'
  0x3185368  bl   #0x38ebe30  CALL UnityEngine.GameObject$$GetComponent<object>
  0x3185380  bl   #0x31d320c  CALL ScriptMessageCommonManager$$ChangeMessageWindow
  0x318b4fc  bl   #0x31d38bc  CALL ScriptMessageCommonManager$$ResetMessageWindow   ; 无参形态
  ```
  类型检查：`0x318534c ldr x9,[x0]; 0x3185354 cmp x9,x8`（GetComponent 结果必须是 `ScriptMessageWindow`，否则丢弃）。
- **后端 API 地图**：
  - `ScriptManager$$ConvertMessageWindowName @0x31b3ed4` — 模板 **`ScriptUI/MessageWindow/{name}`**（字面量槽 `0x55caa40`，`0x31b3eec`）；
  - `ScriptMessageCommonManager$$ChangeMessageWindow @0x31d320c` — 过程：`DeleteLabels @0x31cc8e4` → `ScriptLineMessage.DeleteLabels @0x3172ae8`（talkNameManager）→ 旧窗口 `SetActive(false)` + `Object.Destroy`（`0x31d32f4`）→ 换 `currentMessageWindow(0x1B8)`、重建面板/根对象、`SetDefaultState` 复位（行距/字号/字体/对齐随新窗口重算）；
  - `ScriptMessageCommonManager$$ResetMessageWindow @0x31d38bc` — 回默认 `defaultMessageWindow(0x58)`。
- **资源**：**需要原始窗口 prefab** `ScriptUI/MessageWindow/{name}`（AssetStorage 里存在该目录，`per composition.md §1.3`）。语料唯一值 = **`cinema`**（`[messageChange cinema]`，Final Chapter `0400070720.txt:1216`）。
- **⚠ 修正 composition.md**：该文档 §1.2 表把 `ConvertMessageWindowName` 标为「**本版本为死代码**：全库只有自身引用」——**不成立**：`messageChange` handler `0x31852f8` 是活调用点，且语料真有 1 次使用。它只是「只有一个调用者」，不是死代码。
- **阅读器补齐要点**：数据模型加 `messageWindow: 'default' | 'cinema' | …`（外加 `reset` 形态）。`cinema` 窗的具体视觉（推测为电影字幕条/无边框）在 prefab 里 ⇒ **需资源**；无资源时降级：保持默认窗口 + 诊断，并保留 `messageChange` 事件以便将来换皮。注意 native 切换窗口会**重置**行距/字号/对齐默认值（阅读器也应重置这些状态）。
- **置信度**：high（调用链/模板/语料值）。**未决项**：`cinema` prefab 的具体贴图与布局（资源不可读）。

### messageShake

- **handler**：`0x3182074`（case entry `0x317d364`，hash `0xe127297a`，min_token=7）。
- **参数消费**：`pd.Length>=7`，且 `pd[1]/pd[3]/pd[5]` 必须都是 `' '`；4 个数值按下标 0/2/4/6 解析。
  **顺序与简报相反**：`pd[0]=cycle(周期秒)`、`pd[2]=X 振幅`、`pd[4]=Y 振幅`、**`pd[6]=duration(持续秒)`**。
  ```asm
  0x3182080  cmp  w9, #7
  0x3182084  b.lt #0x318d244                      ; parameter error
  0x3182098  ldr  x1, [x22]  ; ' '
  0x3182110  ldr  x0, [x8, #0x20]                 ; pd[0] = cycle
  0x3182118  bl   #0x49e8728  CALL System.Single$$Parse
  0x3182124  ldr  s1, [x8, #0x71c]                ; 常量 0.0166667 (1/60)
  0x318212c  fcsel s9, s1, s0, eq                 ; cycle==0 → 1/60
  0x3182140  ldr  x0, [x8, #0x50]                 ; pd[6] = duration
  0x3182148  bl   #0x49e8728  CALL System.Single$$Parse
  0x3182158  bl   #0x31b5344  CALL ScriptManager$$IsFastPlaySpeed
  0x318216c  fcsel s9, s0, s9, ne                 ; 快速播放 && duration>0 → cycle=0（=禁用）
  0x3182184  ldr  x0, [x8, #0x30]                 ; pd[2] = x
  0x31821a8  ldr  x0, [x8, #0x40]                 ; pd[4] = y
  0x31821d4  bl   #0x31d4c20  CALL ScriptMessageCommonManager$$Shake
  ```
  实参：`Shake(duration=pd[6], cycle=(pd[0]==0 ? 1/60 : pd[0]，快速播放时置 0), x=pd[2], y=pd[4])`。
- **行为**：写 4 个字段后**尾调用 OnShake()**：
  ```asm
  0x31d4c5c  str  s0, [x19, #0x1d8]     ; shakeTime = (duration>0 ? Time.time+duration : 0)
  0x31d4c64  str  s10, [x19, #0x1dc]    ; shakeCycle = cycle
  0x31d4c68  str  s9, [x19, #0x1e0]     ; shakeX
  0x31d4c6c  str  s8, [x19, #0x1e4]     ; shakeY
  0x31d4c7c  b    #0x31d4c84            ; → OnShake
  0x31d4cb4  ldr  s0, [x19, #0x1dc]
  0x31d4cc0  fcmp s0, #0.0
  0x31d4cc4  b.le #0x31d4d50            ; cycle<=0 → 停
  0x31d4cdc  ldr  s1, [x19, #0x1d8] ; 0x31d4ce0 fcmp s0,s1 ; b.pl → 停（Time.time>=shakeTime）
  0x31d4cf8  bl   #0x4fcbda8  CALL UnityEngine.Random$$Range      ; (-shakeX, +shakeX)
  0x31d4d10  bl   #0x4fcbda8  CALL UnityEngine.Random$$Range      ; (-shakeY, +shakeY)
  0x31d4d2c  bl   #0x4fe1abc  CALL UnityEngine.Transform$$set_localPosition
  0x31d4d4c  b    #0x4fd6068  CALL UnityEngine.MonoBehaviour$$Invoke   ; Invoke('OnShake', cycle) 自续期
  0x31d4d5c  bl   #0x4fd6334  CALL UnityEngine.MonoBehaviour$$CancelInvoke   ; 'OnShake'
  0x31d4da8  bl   #0x4fe1abc  CALL UnityEngine.Transform$$set_localPosition  ; 归零
  0x31d4dac  str  wzr, [x19, #0x1dc]     ; shakeCycle = 0
  ```
  被抖动对象 = **`messageManager.messageShake`（`Transform // 0x50`）**，`Invoke/ CancelInvoke` 的方法名字面量 = `'OnShake'`（`0x55ca000+0xbb0`）。
- **抖动对象结论（回答本组问题）**：**是「消息容器/文本框整体」抖动**——每 `cycle` 秒把 `messageShake` 这个 Transform 的 `localPosition` 随机设置到 `[-x,x]×[-y,y]`，到 `duration`（或 `cycle<=0`）为止；**不是逐字符文本抖动，也不是相机/全屏抖动**。与 `[shake]`/`[shakeStop]`（独立命令、独立 case entry，摇的是舞台/相机层，阅读器已有 `stage.shake`）是两套对象、两套参数顺序。
- **后端 API 地图**：`ScriptMessageCommonManager$$Shake @0x31d4c20`、`OnShake @0x31d4c84`（`[ContextMenu]` 风格私有方法，也作为 `Invoke` 名）；`UnityEngine.Random$$Range @0x4fcbda8`；`Transform$$set_localPosition @0x4fe1abc`。
- **资源**：无（纯逻辑）。
- **阅读器补齐要点**：在消息窗容器上做 CSS `transform: translate()`；每 `cycle` 重新随机一次（用确定性 PRNG，保证回放/后退同一帧序列，阅读器 `commands.ts` 的 `shake()` 已用同一思路）；`duration` 到点或「快速播放」时归零；`reduceMotion` 直接禁用。注意 **值序是 `cycle x y duration`**（与 `[shake duration cycle x y]` 不同，别复用同一个参数映射）。
- **语料**：**635 次**（整行 87（`tag_counts`）+ 内联 548（`supplement-markup.md §1.2`）；字符串 `messageShake` 全量 grep = 664 次，其中 29 次属于 `messageShakeStop`）。形状恒为 `float int int float`，如 `[messageShake 0.05 4 3 0.3]`、`[messageShake 0.05 5 5 0.5]`。**置信度**：high。
- **未决项**：常量 `0xee771c = 0.0166667 (1/60)` 的来源语义（cycle==0 时按「每帧」抖动）— 机制确定，命名 INFERRED。

### messageShakeStop

- **handler**：`0x317e89c`（case entry `0x317e86c`，hash `0x47473262`）；verify `0x317e890 op_Equality('messageShakeStop')`。
- **参数消费**：无（不读 pd，不做长度检查）。
- **行为**：`Shake(0,0,0,0)`：
  ```asm
  0x317e89c  ldr  x0, [x19, #0x28]        ; messageManager
  0x317e8a4  movi d0, #0000000000000000
  0x317e8a8  movi d1, #0000000000000000
  0x317e8b0  movi d2, #0000000000000000
  0x317e8b4  movi d3, #0000000000000000
  0x317e8b8  bl   #0x31d4c20  CALL ScriptMessageCommonManager$$Shake
  ```
  即 `shakeCycle:=0` ⇒ OnShake 走停止分支（`CancelInvoke('OnShake')` + `localPosition:=zero`）。
- **阅读器补齐要点**：取消抖动 tween + `translate` 归零。
- **语料**：整行 26 + 内联 3 = 29。**置信度**：high。**未决项**：无。

### messageSpeedForcedNormal

- **handler**：`0x3184204`（case entry `0x317a480`，hash `0xb86e2e29`，min_token=1）。
- **参数消费**：`pd.Length==1`；`pd[0]=='on'` ⇒ true、`'off'` ⇒ false、其它 ⇒ `parameter error 0x318d244`。
  ```asm
  0x3184228  ldr  x1, [x9]  ; 'on'
  0x318422c  bl   #0x4870cc0  CALL System.String$$op_Equality  args: x1='on'
  0x3184240  mov  w1, #1
  0x318c2dc  ldr  x1, [x9]  ; 'off'
  0x318c2e0  bl   #0x4870cc0  CALL System.String$$op_Equality  args: x1='off'
  0x318c2f0  mov  w1, wzr
  0x318c2f8  bl   #0x31d4dc4  CALL ScriptMessageCommonManager$$SetMessageSpeedForcedNormal
  ```
- **行为**：写 **`isMessageSpeedForcedNormal // 0xE4`**，随后尾调用 `SetDefaultState @0x31d249c`：
  ```asm
  0x31d4dc4  strb w1, [x0, #0xe4]
  0x31d4dc8  b    #0x31d249c                      ; SetDefaultState
  0x31d24d8  ldrb w8, [x19, #0xe4]
  0x31d24dc  cbz  w8, #0x31d24f0
  0x31d24e0  mov  w8, #0x3f800000                 ; 1.0f
  0x31d24e8  str  w8, [x19, #0x138]               ; messageSpeed := 1.0（强制正常）
  0x31d250c  bl   #0x2e7d40c  CALL OptionManager$$GetScenarioTextSpeed   ; 否则用玩家设置
  ```
- **消费点**：`MessageUpdate @0x31d4164` 用 `messageSpeed(0x138)` / `defaultStepTime(0xB4)` 决定打字速率（`0x31d4264 ldr s1,[x19,#0xb4]`、`0x31d42a0 ldr s2,[x19,#0x138]`）。
- **语义**：`on` = 忽略玩家「剧情文本速度」选项，锁死 ×1.0 正常速度；`off` = 回到玩家设置（`OptionManager.GetScenarioTextSpeed`）。
- **阅读器补齐要点**：阅读器 `MessageWindow` 已有 `defaultSpeed/overrideSpeed` 机制（`src/adv/message.ts`）：`on` → 把基础速度锁为 normal（并忽略用户设置/阅读器速度条），`off` → 恢复。是纯逻辑。
- **语料**：14 次，成对出现（例：`Lostbelt No1 Anastasia\0300011720.txt:443 on` / `:447 off`）。**置信度**：high。**未决项**：无。

### messageStart

- **handler**：`0x317f98c`（case entry `0x3179dcc`，hash `0xa9fb9b48`）；verify `0x317f980`。
- **参数消费**：**不做任何长度/取值校验**；整段 `pd`（含分隔符元素）直接传给消息管理：
  ```asm
  0x317f98c  ldr  x0, [x19, #0x28]
  0x317f994  ldr  x1, [x20]                   ; 整段 pd
  0x317f99c  bl   #0x31d295c  CALL ScriptMessageCommonManager$$CalcMessageVerticalAlign
  0x317f9a0  b    #0x3193f00
  ```
- **行为**：`CalcMessageVerticalAlign(dataList)` `@0x31d295c` → `GetVerticalAlignedOffset`（扫 `'f'`/`'・'`/`'r'` 等 token，`0x31d29e8/0x31d29f4/0x31d2a00`）+ 读 `messageAlign(0x1F0)` → 更新 `dispPosition(0x180)`：
  ```asm
  0x31d296c  bl   #0x31d2994  CALL ScriptMessageCommonManager$$GetVerticalAlignedOffset
  0x31d297c  fmov s1, w9
  0x31d2980  fsub s0, s1, s0
  0x31d2984  str  s0, [x19, #0x180]           ; dispPosition.y
  ```
- **阅读器补齐要点**：**旧版遗留**（语料 0 次；与 `message2/message3` 同族的旧消息指令）。可直接 no-op + 诊断；若要还原，等价于「按当前 messageAlign 重算消息块垂直位置」。
- **语料**：0 次。**置信度**：handler/调用链 high；「旧版遗留」判定 medium（语料 0 + 现代管线由 `[k]`/`[f]`/`messageAlign` 完成）。
- **未决项**：`GetVerticalAlignedOffset` 对 dataList 的完整扫描规则（只确认字面量 `'f'`/`'・'`/`'r'` 与 `messageAlign` 参与），未逐行还原。

### `page` / `clear`（共享体）

- **handler**：`0x3182038`（**共享体**：`page` 与 `clear` 同体，差异只在 case entry 预先载入的**字面量**）。
  ```asm
  0x318201c  adrp x23, #0x55c8000
  0x3182028  ldr  x23, [x23, #0xfc0]  ; &'clear'
  0x3182030  bl   #0x4870cc0  CALL System.String$$op_Equality  args: x1='clear'
  0x317c13c  ldr  x23, [x23, #0xff0]  ; &'page'（page case entry）
  0x317c148  tbnz w0, #0, #0x3182038
  ```
- **参数消费**：**必须无参**（长度 ≠0 ⇒ `'parameter be unnecessary'`）：
  ```asm
  0x3182040  ldr  x8, [x8, #0x18]
  0x3182044  cbnz x8, #0x3188dc4                  ; → 'parameter be unnecessary'
  0x3182048  mov  w8, #4
  0x318204c  ldr  x1, [x23]                       ; 'page' 或 'clear'
  0x3182050  str  w8, [x19, #0x288]               ; state := 4 (WAIT)
  0x3182054  b    #0x3192e70
  0x3192e70  str  x1, [x19, #0x3d8]               ; waitType := 'page' | 'clear'
  0x3192e78  b    #0x3193efc
  ```
- **⚠ 修正 params-misc.md / brief-message.md**：原文写「page 保存整行 pd 后交给消息系统 / pd[0] 整段 pd 存入 waitType」——**不成立**。实测：**命令必须无参**，写进 `waitType(0x3D8)` 的是**常量字面量 `'page'` 或 `'clear'`**（由 case entry 决定的 x23）。
  **消费侧**（本次只取证到入口，未逐条展开，标 INFERRED）：等待状态机读 `waitType` 并分派——`0x31bc2d8 ldr x0,[x19,#0x3d8]` 后 `0x31bc2f0 op_Equality(x1='time')`（同一函数区域还有 `'clear'` 的比较点 `0x31bba20` / `0x31bbca0` / `0x31bbd54`）；真正的「翻页/清屏」由消息系统按该 waitType 推进。
  ```asm
  0x3182040  ldr  x8, [x8, #0x18]
  0x3182044  cbnz x8, #0x3188dc4                  ; pd 非空 → 'parameter be unnecessary'
  0x3182048  mov  w8, #4
  0x318204c  ldr  x1, [x23]                       ; 'page' 或 'clear'
  0x3182050  str  w8, [x19, #0x288]               ; state := 4 (WAIT)
  0x3192e70  str  x1, [x19, #0x3d8]               ; waitType := 'page' | 'clear'
  0x3192e78  b    #0x3193efc
  0x31bc2d0  cmp  w8, #4                          ; 消费侧：state==WAIT
  0x31bc2d8  ldr  x0, [x19, #0x3d8]               ; waitType
  0x31bc2f0  bl   #0x48706e4  CALL System.String$$Equals  args: x1='time'
  ```
- **阅读器补齐要点**：
  - 语义 = 「结束当前页并等待点击」：进入等待态（阅读器 `wait = {kind:"input"}`），让已显示文本停止打字并等下一次点击；`clear` 的具体消息系统行为未逐条取证（**INFERRED**：清空当前消息文本后等点击）。无论哪种实现，**native handler 本身不碰舞台**（只有 `state`/`waitType` 两个写入）。
  - ⚠ 阅读器现状 `src/adv/commands.ts:104` 把 `clear` 实现为 **`tweens.clear(); stage.reset()`（重置整个舞台）**，与 native 不符 —— 语料里 `clear` **152 次**，影响面大，建议改：`clear` = 清消息文本 + 等待点击（舞台复位交给 `scene`/`fadeout`/`clearAll` 类命令）。`page` 语料 0 次，但作为命令名仍要接（= 只等待点击/翻页）。
- **语料**：`page` 0 次、`clear` 152 次。**置信度**：high。**未决项**：`clear2`/`page2` 变体不在本版本命令表（`clear2` 0 次，`per params-misc.md`）。

### talkNameBack

- **handler**：`0x3184900`（case entry `0x317b290`，hash `0xd9f57ae7`，min_token=1）。
- **参数消费**：`pd.Length>=1` ⇒ `pd[0]`；`pd.Length==0` ⇒ `null`（复位）。无其它校验。
  ```asm
  0x3184908  ldr  w9, [x8, #0x18]
  0x318490c  ldr  x0, [x19, #0x28]
  0x3184910  cmp  w9, #1
  0x3184914  b.lt #0x318b1b0                      ; 无参 → x1 = 0
  0x318491c  ldr  x1, [x8, #0x20]
  0x318b1b4  mov  x1, xzr
  0x318b1bc  bl   #0x31d2ff0  CALL ScriptMessageCommonManager$$SetTalkNameBack
  ```
- **行为**：`SetTalkNameBack(imageName) @0x31d2ff0`：取 `currentMessageWindow(0x1B8).talkNameBack(0x50)` 这个 UISprite；
  - 空名 ⇒ `sprite.atlas := talkNameAtlas(0x150)`、`sprite.spriteName := talkNameSpriteName(0x158)`（恢复默认名牌）；
  - 有名 ⇒ `AtlasManager$$SetMark(sprite, imageName) @0x2db2330`；
  - 末尾按 `GetAtlasSprite` 尺寸修 `UIWidget.set_height`（`0x31d3148 → 0x3612b4c`）。
  ```asm
  0x31d3030  ldr  x8, [x21, #0x1b8]                 ; currentMessageWindow
  0x31d3040  ldr  x19, [x8, #0x50]                  ; window.talkNameBack
  0x31d30b4  bl   #0x4871c3c  CALL System.String$$IsNullOrEmpty
  0x31d30d4  bl   #0x3620548  CALL UISprite$$set_atlas
  0x31d30e4  bl   #0x362d7b0  CALL UISprite$$set_spriteName
  0x31d3110  bl   #0x2db2330  CALL AtlasManager$$SetMark
  0x31d3118  bl   #0x362e5a8  CALL UISprite$$GetAtlasSprite
  0x31d3128  ldr  w8, [x0, #0x24]
  0x31d3148  b    #0x3612b4c  CALL UIWidget$$set_height
  ```
  另见 `GetTalkNameBackSprite @0x31cc8c4`（读同一 sprite）。
- **资源**：`img_talk_namebg02`（语料唯一值，23+ 次；见 `Pseudo-Singularity IV\0200040151.txt:93`）；属**窗口内嵌 atlas 的 sprite**（不同窗口 atlas 不同）⇒ 需原始资源；`[talkNameBack]` 空参复位形态语料也有（`0200040151.txt:223`）。
- **阅读器补齐要点**：数据模型 `talkNameBackSkin: string | null`（null = 默认）；有名时是「一张 sprite」，CSS 可用 `background-image`（若有解包图）或降级为默认底框 + 诊断；必须实现**空参复位**。注意改名底板是 `talkNameBack(0x50)`，与 `talkNameIcon(0x48)`/`talkNameAtlas(0x150)` 不是同一资源。
- **语料**：33 次（含 1 次空参）。**置信度**：high。**未决项**：`AtlasManager.SetMark` 的图集查找规则（mark 表）未逐行展开，只确认「按 sprite 名查表」。

---

## 菜单及显式选项命令（5 条）

### menu

- **handler**：`0x317fa74`（case entry `0x317a17c`，hash `0x99e4dd3a`）；verify `0x317fa68 op_Equality('menu')`（字面量槽 `0x55c97a0`）。
- **语法（实测解析规则）**：`[menu <label>=<text> <label>=<text> …]`
  - 元素 `' '` ⇒ 跳 1 格；否则要求 `pd[i+1] == '='`（字面量 `0x5578000+0x5d8`）；
  - `pd[i]`（**标签**）过 `ConvertNameString` → `listA`；`pd[i+2]`（**显示文本**）过 `ConvertNameString` → `listB`；步长 3；（`ConvertNameString @0x31b1530` 实测语义：`null`→空串，首尾都是 `"` 时去掉首尾引号，其它原样返回；`0x31b1584–0x31b15c4`）
  - 任一对不满足 `=` ⇒ `scriptErrorMessage := 'parameter error'`（`0x318a21c–0x318a230`）后按结果收尾。
  ```asm
  0x317fa88  mov  x23, x0                         ; listA（标签）
  0x317faa8  bl   #0x44c7b8c  CALL List<object>$$.ctor   ; listB（文本）
  0x317faf0  bl   #0x4870cc0  CALL System.String$$op_Equality  args: x1=' '
  0x317fb3c  bl   #0x4870cc0  CALL System.String$$op_Equality  args: x1='='
  0x317fb6c  bl   #0x31b1530  CALL ScriptManager$$ConvertNameString   ; pd[i]
  0x317fba8  bl   #0x31b1530  CALL ScriptManager$$ConvertNameString   ; pd[i+2]
  0x318a244  mov  w8, #4
  0x318a24c  str  w8, [x19, #0x288]               ; state := 4 (WAIT)
  0x318a250  ldr  x1, [x22]
  0x318a254  str  x1, [x19, #0x3d8]               ; waitType ← *x22（见未决项）
  0x318a274  mov  x1, x0
  0x318a278  str  x0, [x19, #0x4a0]               ; menuMessageList := listB.ToArray()
  0x318a294  str  x0, [x19, #0x4a8]               ; menuLabelList   := listA.ToArray()
  ```
  `listA.Count<1` ⇒ 整条命令 no-op（`0x318a23c b.lt #0x3193f00`）。
- **行为（选择回调 = 跳 label）**：`OnSelectMenu @0x31b722c`：
  ```asm
  0x31b729c  bl   #0x2e80798  CALL OverwriteAssetSoundName$$PlaySystemSe   ; SE id 8
  0x31b72a4  ldr  x8, [x19, #0x4a0]               ; menuMessageList
  0x31b72cc  bl   #0x31b6bf8  CALL ScriptManager$$SetSelectLogMessage      ; 记日志
  0x31b72dc  bl   #0x31d9dd0  CALL ScriptSelectDialog$$Close
  0x31b72e0  ldr  x8, [x19, #0x4a8]               ; menuLabelList
  0x31b7300  ldr  x20, [x8, #0x20]                ; label = menuLabelList[index]
  0x31b7304/0x31b7314/0x31b7324  str xzr → 0x4a0 / 0x4a8 / 0x4b8；0x31b7338 str wzr → 0x4b0
  0x31b733c  strb w8, [x19, #0x375]               ; isCancelInput := true
  0x31b7340  bl   #0x31a8488  CALL ScriptManager$$JumpScript            ; 跳到 label
  ```
  打开路径（`ProcessScript`）：`0x31c2c60…0x31c2cd4` — `SetActive(scriptPlayBase,false)` → `PausePlaySpeed(0)` → `ScriptSelectDialog$$Open(selectDialog, menuMessageList(0x4A0), fontType, callback, 0)`（`@0x31d95bc`）；随后 `waitType := 'menu2'`（`0x31c2cdc ldr x8,[&'menu2'] → 0x31c2fd8 ldr x1,[x8]; str x1,[x20]`）。清理分支：`0x31bd2a0`（tag=='menu'）与 `0x31bd2bc`（tag=='menu2'）→ `0x31bd2cc` 关闭并清 `0x4A0/0x4A8/0x4B8/0x4B0`。
- **后端 API 地图**：`ScriptSelectDialog$$Open @0x31d95bc`（签名 `Open(string[] selectMessageList, Font fontType, ClickDelegate callback)`）；`ScriptSelectDialog$$Close @0x31d9dd0`；`ScriptManager$$OnSelectMenu @0x31b722c`；`ScriptManager$$JumpScript @0x31a8488`；`ClickDelegate$$.ctor @0x31da34c`（方法槽 `0x55ca000+0xaf0`，未逐字解析为方法指针 → INFERRED = OnSelectMenu）。
- **与 switchCase 的本质差别**：`switchCase` 选择后把执行点搬到「第 index 个选项 tag 之后的正文」；**`menu` 选择后按 `menuLabelList[index]` 跳到 label**（选项体写在 label 处），且不写 `INPUT_SELECT_BRANCH` flag/存档（只有 `SetSelectLogMessage` 日志）。
- **资源**：无（复用 `ScriptSelectDialog` UI）。
- **阅读器补齐要点**：编译期把 `menu` 解析成「label 选项」：`options=[{id:i, label:text, targetLabel:label}]`，运行期复用 `$choice` 弹窗 UI，点击 → `cursor = labels[targetLabel]`，并写日志；不需要新资源、不需要新 UI。语料 0 次 ⇒ 优先级低，但成本也低（`$choice` 已有 `hiddenFlag/boundary/日志` 机制）。
- **语料**：0 次（`menu2` 也 0 次）。**置信度**：handler/语法/字段/回调 high。
- **未决项**：`0x318a254` 的 `waitType ← *x22` 精确字面量未能静态确定（`x22` 由序言 `0x31772dc mov x22,x2` 持有 pd，menu 体（`0x317fa74–0x317fbd4` + `0x318a234–0x318a2a0`）内**无对 x22 的写入**；运行期语义以 `ProcessScript` 侧的 `'menu2'` 为准），标 **INFERRED**。

### notification

- **handler**：`0x317af78`（case entry `0x317af48`，hash `0xea3d3046`，min_token=3）。
- **参数消费**：`pd.Length>=3` 且 `pd[1]==' '`；`pd[0]`=标题、`pd[2]`=正文，**两者都过 `ConvertNameString`**（`@0x31b1530`：`null`→空串、去首尾引号、其它原样）；**`pd[2]` 为空则整条 no-op**。
  ```asm
  0x317af84  cmp  w9, #3
  0x317af88  b.lt #0x31894b8                     ; 无参形态（见下）
  0x317afa0  bl   #0x4870cc0  CALL System.String$$op_Equality  args: x1=' '
  0x317afcc  bl   #0x31b1530  CALL ScriptManager$$ConvertNameString   ; pd[2] 正文
  0x317afd8  bl   #0x4871c3c  CALL System.String$$IsNullOrEmpty
  0x317afdc  tbz  w0, #0, #0x317afe4
  0x317afe0  b    #0x3193f00                      ; 空 → 不显示
  0x317afec  str  w8, [x19, #0x288]               ; state := 4 (WAIT)
  0x317aff4  str  x1, [x19, #0x3d8]               ; waitType ← *x22（INFERRED）
  0x317b01c  bl   #0x31b1530  CALL ScriptManager$$ConvertNameString   ; pd[0] 标题
  ```
- **行为**：写 `waitName(0x3E8) = 标题`、`waitTitle(0x3F0)=null`、**`waitMessage(0x3F8) = 正文`**、`isQuestOpen(0x404)=false`：
  ```asm
  0x31904ec  str  x1, [x19, #0x3e8]               ; waitName := 标题
  0x3190500  str  xzr, [x19, #0x3f0]              ; waitTitle := null
  0x3190510  str  x21, [x19, #0x3f8]              ; waitMessage := 正文(x21)
  0x319051c  strb wzr, [x19, #0x404]              ; isQuestOpen := false
  ```
  运行期（`ProcessScript` tag=='notification' 分支 `0x31bd588`）：`waitType := 'notification2'`（`0x31c2bc8`）→ 若 `isQuestOpen` ⇒ `OpenStoryQuestOpenDialog(title,message) @0x31c39f4`；否则 ⇒ `ScriptManager$$OpenNotificationDialog @0x31c3680`（`w4=5`）→ `ScriptNotificationDialog$$Open @0x31d87e8` / `SetMessage @0x31d897c`。
  **无参形态**（`0x31894b8`）：`pd.Length<3` 时用 `NotificationInfoManager$$HasCurrentNotificationInfo @0x31ca754` 判断「已有通知」⇒ 有则 `state=4`、`waitType ← *x22`（同一处未定赋值）直接复用当前通知；没有则不动作。
- **后端 API 地图**：`ScriptNotificationDialog`（TypeDefIndex 4886）：`messageLabel // 0x68`、`titleLabel // 0x70`、`titledMessageLabel // 0x78`、`closeButton // 0x88`；`ScriptManager$$OpenNotificationDialog @0x31c3680`；`ScriptManager.NotificationInfoManager$$HasCurrentNotificationInfo @0x31ca754`。
- **资源**：无（纯 UI，CSS 即可）。
- **阅读器补齐要点**：数据模型 `notification: {title:string, message:string} | null` + 一个独立的等待状态（等玩家点「关闭」再继续，`phase` 里加 `"notification"`，与 `wait.kind` 并列）；显示为通知条/对话框（标题+正文+关闭），并进回想日志（native 走 `waitName/waitMessage`，不写 messages）。**语料 0 ⇒ 低优先**，但实现成本低、无资源依赖。
- **置信度**：handler/字段/调用链 high。**未决项**：`waitType` 常量（同 menu）；`OpenNotificationDialog` 的 `w4=5` 枚举含义未解析。

### selectionCentering

- **handler**：`0x317f90c`（case entry `0x3179c5c`，hash `0x2b7bb164`，min_token=1）。
- **参数消费**：`pd.Length==1`（否则 `parameter error 0x3191820`）；`Boolean.TryParse(pd[0], out bool) @0x495d278`，解析失败 ⇒ `parameter error`。
  ```asm
  0x317f918  cmp  w9, #1
  0x317f91c  b.ne #0x3191820                      ; parameter error
  0x317f948  bl   #0x495d278  CALL System.Boolean$$TryParse
  0x317f94c  tbnz w0, #0, #0x317f954
  0x317f950  b    #0x3191820
  0x317f95c  ldrb w9, [sp, #0x13c]
  0x317f964  strb w9, [x8, #0x90]                 ; selectDialog.isCenteringEnabled
  ```
- **行为**：`ScriptManager.selectDialog(0x58).isCenteringEnabled // 0x90 := bool`（等价 `ScriptSelectDialog$$SetCentering @0x31d9ef4`）。该类另有 `BASE_VIEW_POSITIONS // 0x98`、`CenteredListViewItemSeedPitch // 0xA8`、`SelectItemHeight = 82` 等居中布局数据。
- **资源**：无。
- **阅读器补齐要点**：`stage.choiceCentering: boolean`（或挂在 choice 指令上），渲染 `$choice` 选项列表时居中（CSS `justify-content:center` / 定宽居中）；必须在 `[selectionCentering true]` 之后的所有选项块生效（native 是**持久字段**，直到再次设置/窗口复位）。语料 0 次 ⇒ 低优先，纯逻辑。
- **置信度**：high。**未决项**：`isCenteringEnabled` 是否在 `Open/Close` 时被复位（未逐条追）。

### switchCase（显式命令形式 ↔ `？` 控制符）

- **handler**：`0x31875c4`（case entry `0x317d818`，hash `0x4b951a35`）；verify `0x31875bc` 为 `op_Equality`，比较的 tag 字面量槽 = `0x55ca230`（`'switchCase'`）。
- **与 `？` 的关系（回答本组问题）**：**同一条码路**。分派键就是 tag 字符串：
  - 解析期：`AnalysScript @0x31a66f8` 对 `？…` 行（`IsCodeSwitchCaseString @0x31a9080` = `StartsWith('？') && Substring(1).Contains('：')`）产出 **tag=`'switchCase'`**、data=`行.Substring(1)`（`0x31a670c`/`0x31a6714`/`0x31a6718`，`per closure-choice-branch.md §B.1`）；`？！` 行 ⇒ **tag=`'switchCaseEnd'`**（`0x31a5f48`），消息下标置 -1（`0x31a6778`）；
  - 执行期：`ScriptCommandExecute` 用 `op_Equality(tag, 'switchCase' | 'switchCaseEnd')` 命中本 handler——**同一个字符串键**，所以「`？` 行」和「显式 `[switchCase …]` 命令行」必然进同一 handler（后者只是脚本作者手写同一 tag）。
  - 语料里 **`[switchCase …]` / `[switchCaseEnd]` 文本 0 次**：命令表条目存在、但脚本侧全部由 `？`/`？！` 这两个**本地化控制符**（键名 `SCRIPT_ACTION_CODE_SWITCH_CASE` / `SCRIPT_ACTION_CODE_SWITCH_END`，运行时写入 `ScriptManager` 字段 `0x678/0x690`，`per closure-choice-branch.md §B.1`）产生。即：命令表与 tag 表同构 → 「显式命令」是 tag 名的另一种写法，而非独立实现。
- **handler 行为**：
  ```asm
  0x31875c4  ldrb w8, [x19, #0x370]               ; isSwitchCase（正在选项正文里？）
  0x31875c8  cbz  w8, #0x318a774                  ; 否 → 收集选项（下方）
  0x31875d8  ldr  x8, [x8, #0xd98]  ; &'switchCaseEnd'
  0x31875dc  ldr  x1, [x8]  ; 'switchCaseEnd'
  0x31875e0  bl   #0x31b2cfc  CALL ScriptManager$$JumpScriptCommand   ; 直接跳到块尾
  0x31875e4  b    #0x3193f00
  ```
  未在正文里（`0x318a774`）时**自己收集选项**（与 `ProcessScript` 的弹窗路径并存）：
  ```asm
  0x318a7dc  ldr  w8, [x19, #0x324]               ; executeIndexMax
  0x318a800  ldr  x9, [x19, #0x338]               ; executeDataList
  0x318a83c  bl   #0x4870cc0  CALL System.String$$op_Equality  args: x1='switchCaseEnd'
  0x318a858  bl   #0x4870cc0  CALL System.String$$op_Equality  args: x1='switchCase'
  0x318a864  ldr  x1, [x19, #0x678]               ; '？'
  0x318a870  bl   #0x4870d34  CALL System.String$$StartsWith
  0x318a884  bl   #0x4877de4  CALL System.String$$LastIndexOf     ; '：'(0x680)
  0x318a898  bl   #0x4876934  CALL System.String$$Substring
  0x318a8ac  bl   #0x4874f2c  CALL System.String$$Split           ; 按 ' '
  0x318a8ec  strb w8, [x19, #0x4c8]               ; limitTimeMode
  0x318a904  str  s0, [x19, #0x4cc]               ; 限时秒 = Single.Parse(parts[0])
  ```
  ⇒ **隐藏语法**：选项文本按 `' '` 切出 **>2 段**时进入「限时选择」模式（第一段 = 秒数，`0x4C8/0x4CC`）。
- **选择结果闭环**（`per closure-choice-branch.md §B.3–B.9`，本次复核通过）：弹窗 `ScriptSelectDialog$$Open @0x31d95bc` / `OpenHidden @0x31d998c` / `OpenLimitTime @0x31d9aa4`；回调 `OnSelectSwitchCase @0x31b6834` → `EndSelectSwitchCase @0x31b6e50` → `SaveSwitchSelection @0x31b6f3c` + `JumpScriptSwitchCase @0x31b2e34`（`SetSelectBranchIndex→PlayerPrefs`、`flag INPUT_SELECT_BRANCH=v`、`executeIndex := 第 index 个 switchCase tag + 1`、`isSwitchCase=true`）；`waitType := 'switchCase2'`（`0x31c2fd4 → 0x31c2fd8`）。
- **阅读器补齐要点**：阅读器已有 `$choice/$choiceExit/$choiceEnd`（`src/adv/compiler.ts:69–95`），补齐 = ① 编译器把 `[switchCase <n>：<text>]` 命令行**归一到同一 `$choice` 节点**（或对整行做与 `？` 相同的解析），`[switchCaseEnd]` → `$choiceEnd`；② 可选实现 `>2 段` 的限时语法（读秒→自动选择/超时），语料 0 例、可后置；③ 运行期语义「正文里撞到下一个选项 tag ⇒ 跳到块尾」阅读器已由 `$choiceExit/targetIndex` 等价实现。
- **语料**：显式命令 0 次；`？n：` 行 18,197 行 / `？！` 11,684 行（`per closure-choice-branch.md §A.0`）。**置信度**：high（handler、tag 生成点、弹窗/跳转全链）。
- **未决项**：`0x318a774` 收集路径与 `ProcessScript` 弹窗路径的分工（何时走哪条）未逐帧确认（两条都会组选项；`per closure-choice-branch.md` 认为运行期主路径是 ProcessScript）— 标 INFERRED。

### switchCaseEnd

- **handler**：`0x3188c58`（case entry `0x317eb50`，hash `0xfe9f10da`）；verify `0x3188c50 op_Equality('switchCaseEnd')`（槽 `0x55c9d98`）。
- **参数消费**：无。
- **行为**：
  ```asm
  0x3188c58  ldrb w8, [x19, #0x370]               ; isSwitchCase
  0x3188c5c  cbz  w8, #0x318ae40                  ; 不在选项正文 → 另一支
  0x3188c60  mov  w24, wzr                        ; 返回 0（Continue）
  0x3188c64  strb wzr, [x19, #0x370]              ; isSwitchCase := false
  0x3188c68  b    #0x3193f04
  ```
- **语义**：**块尾/终止落点**，自身不等待、不分支：`？` 弹窗由第一个 `switchCase` tag 触发、结果由选择回调跳转；正文走到下一个 `？` ⇒ `JumpScriptCommand('switchCaseEnd')` 落回 `？！`；正文直接走到 `？！` ⇒ 本 handler 复位 `isSwitchCase` 后顺序继续（`per closure-choice-branch.md §B.5`，本次同地址复核）。
- **阅读器补齐要点**：目前不需要新逻辑（`$choiceEnd` 已实现）；只要接受显式命令写法。
- **语料**：显式命令 0 次（`？！` 行 11,684 行产生该 tag）。**置信度**：high。**未决项**：`0x318ae40` 分支（`isSwitchCase==false` 时的处理）未展开。

---

## 本组小结

### 缺口分类（按实现方式）

**a) 纯逻辑缺口（CSS/DOM 直接可做，无资源依赖）**

| 命令 | 落点 | 语料 |
|---|---|---|
| `betweenHeight` / `l` | 对白+日志行距（`line-height`；`<0`=默认） | 0 / 0 |
| `messageAlign` | 消息块垂直基准（`0x1F0`） | 1 |
| `messageShake` / `messageShakeStop` | 消息容器 `transform` 随机抖动；`Invoke('OnShake', cycle)` 自续期 | 635 / 29 |
| `messageSpeedForcedNormal` | 锁定 ×1.0 打字速度 / 恢复玩家设置 | 14 |
| `page` / `clear` | 等待点击；`clear` 的等待类型交给消息系统（**INFERRED**：清空当前消息文本后等点击，**不是**舞台复位） | 0 / **152** |
| `selectionCentering` | 选项列表居中（持久布尔） | 0 |
| `switchCase` / `switchCaseEnd` | 显式命令 → 现有 `$choice/$choiceEnd` | 0（tag 由 `？/？！` 产生 29k 行） |
| `menu` | label 型选项（复用 `$choice` UI + 跳 label） | 0 |
| `notification` | 通知条（title+message+关闭） | 0 |
| `messageStart` | 旧版遗留；no-op+诊断或按 `messageAlign` 重算垂直位置 | 0 |
| `fontType` / `talkNameBack` 的**复位分支** | `normal`/空参 ⇒ 恢复默认字体 / 默认名牌 | 部分 |

**b) 需原始资源（Unity prefab/图集/字体）**

| 命令 | 缺的资源 |
|---|---|
| `messageChange` | `ScriptUI/MessageWindow/{name}` prefab（语料仅 `cinema`）；换窗还会重置行距/字号/对齐 |
| `talkNameBack` | 名牌 sprite（语料仅 `img_talk_namebg02`，属窗口 atlas） |
| `fontType` | `Font/{name}` 字体资源（`normal` 可用默认字体，故可半还原） |
| `faceTalkScreen` | war-board 贴图 `img_talk_textbg` / `img_talk_namebg` / `img_arrow_under` |

**c) 需游戏数据源**

| 命令 | 数据源 |
|---|---|
| `charaFaceIcon` | `WarBoardMessageScriptMaster`（imageId+form → 遮罩矩形）+ 战棋角色资源 |
| `notification` 无参形态 | `NotificationInfoManager.HasCurrentNotificationInfo`（当前通知） |

### 最小可交付实现（建议顺序）

1. **`clear` 语义修正**（语料 152 次，影响面最大）：`clear` = 清空当前消息文本 + 进入等待点击；把舞台复位从 `clear` 移出（现 `src/adv/commands.ts:104` 是 `stage.reset()`，与 native 0x3182038 不符）。
2. **`messageShake` / `messageShakeStop`**（语料最大项 635/29）：消息容器 CSS `translate` 抖动，值序 **`cycle x y duration`**，`cycle==0` 或快速播放时禁用，结束归零；用确定性 PRNG 保证回放一致。
3. **`messageAlign` + `betweenHeight`/`l` + `messageSpeedForcedNormal`**：各自 1–14 次，纯状态位，半天量级。
4. **`switchCase`/`switchCaseEnd` 命令别名**（0 次但便宜）：编译器把显式命令归一到 `$choice/$choiceEnd`。
5. **`selectionCentering` + `notification` + `menu`**（各 0 次）：复用 `$choice`/通知条 UI；`menu` 用 label 目标。
6. **`talkNameBack` 复位分支 + `fontType normal` 分支 + `messageStart` no-op 诊断**：能做的先做，资源缺失降级并 `diagnostics`。
7. **`messageChange` / `faceTalkScreen` / `charaFaceIcon`**：只登记状态 + 诊断（`adv-unrestored.md` 已有 onUnhandled 通道），等原始资源/战棋数据表。

### 升级路径

1. 拿到 `assets/AssetStorages` 明文（`asset-pipeline.md` 已打通解密）后，按 `ScriptUI/MessageWindow/{name}` 与 `Font/{name}` 取 prefab/字体 → `messageChange`、`fontType`、`talkNameBack` 从「降级」升为「完整」。
2. 接入 WarBoard 数据表（`WarBoardMessageScriptMaster`）+ 战棋资源 → `charaFaceIcon` / `faceTalkScreen` 组（本语料集不覆盖，需另找对应脚本样本）。
3. 截图对拍：`messageShake` 的振幅/周期（design 1024×576）、`messageAlign bottom` 的实际偏移、`cinema` 窗口外观 —— 这是唯一能验证「渲染数值」的手段，当前 `adv-unrestored.md` 明确未做视觉对拍。
4. 复核项：`0x318a254`（menu）与 `0x317aff4`（notification）的 `waitType ← *x22` 未定字面量，可在真机/模拟器上以 `waitType` 读值或断点确认（若需 100% 精确）。

### 对既有文档的修正汇总

| 文档 | 原文 | 修正 |
|---|---|---|
| `out/composition.md §1.2` | `ConvertMessageWindowName` 是「本版本死代码」 | **错**：`messageChange` handler `0x31852f8` 为活调用点，语料有 1 次 `[messageChange cinema]` |
| `out/params-misc.md` / `brief-message.md` | `page`「保存整行 pd 存入 waitType」 | **错**：`page`/`clear` **必须无参**，`waitType` 写常量 `'page'`/`'clear'`（`0x3182044`、`0x318204c`、`0x3192e70`） |
| `brief-message.md` | `messageShake` 参数顺序疑为 0/6/2/4 | **确定**：`pd[0]=cycle, pd[2]=x, pd[4]=y, pd[6]=duration`（`Shake(p6,s9(p0),p2,p4)`，`0x31821d4`） |
| `brief-message.md` | `messageStart` pd[0]「整段 pd 传入」 | **补充**：确实整段传入 `CalcMessageVerticalAlign`，且**无任何长度校验**；语料 0 次（旧版遗留） |
| `brief-message.md` | `fontType` handler「`0x31795f8`」参数 high | **补充**：`pd.Length==0` 也合法（等价 `normal` 复位），`!=0 且 !=1` 才 `parameter error`（`0x3189578`） |
| `brief-menu.md` | `menu` pd[0]「名称字符串（ConvertNameString）」 | **更正**：语法是 `label=text` 对（`'='` 字面量 `0x317fb3c`），标签进 `menuLabelList(0x4A8)`、文本进 `menuMessageList(0x4A0)`，选择后 `JumpScript(label)` |
| `adv-unrestored.md` | 消息窗组 13 条「部分还需字体/窗口资源」 | 精确化：真正需资源的只有 `messageChange`/`fontType`/`talkNameBack`/`faceTalkScreen`/`charaFaceIcon`；其余 8 条纯逻辑 |

（本文所有 VA 均来自本次 `coverage/win.py` / `tools/klass.py` / `tools/mfind.py` 的实测输出，未编造；`[x20]`=pd 的寄存器约定、`pd` 元素偏移 `0x20+8i` 由 `0x317a800`（input handler）完整反汇编交叉验证。）

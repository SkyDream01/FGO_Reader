# 演出 / 画面 两文档的覆盖度核查与补遗(语料实证 · VA 证据)

对象:`work/out/presentation.md`(+`presentation.json`,演出系统)、`work/out/composition.md`(+`composition.json`,画面构建)。
**本文不重写已有文档**,只做「覆盖度核查 + 缺口补充」;与既有文档冲突处一律给出可复现证据并说明哪一侧应修正。

* 语料:`scripts\` 2583 个 `.txt` / **1,867,761 行**(33 章)。单遍扫描脚本 `work/scratch/supp_scan.py`(产物 `work/scratch/supp_scan.json`),对 200+ 演出相关 tag 逐位记录「取值 Counter + 形状 + 样例」。
* 语料统计口径:`<tag uses>` = 整行恰为一个 `[...]` 的次数(census 同口径);行内嵌(inline)单独统计。全部 973,594 次 tag 使用;去重 tag 399 个。
* 二进制:`extract/lib/arm64-v8a/libil2cpp.so`;VA 为 ELF 虚拟地址;`dump.cs` 行号指 `work/il2cpp_out/dump.cs`。
* 置信度:标 `【实证】`= 有反汇编/字面量/字段直证;`【推断】`= 由调用链或语料形态推断;`【语料实证】`= 仅有语料统计(次数可复现)。

---

## 0. 覆盖度总览(先给结论)

| 文档 | 小节 | 判定 | 一句话 |
|---|---|---|---|
| presentation §1 调度 | PASS(需 1 处修正) | 命令表齐;**参数数组布局描述有误**(见 §A.11.1) |
| presentation §2 相机 | PASS(主相机)/ GAP(子相机命令词) | `cameraMove/Ease/Home/Roll*` 有;`subCameraOn/Off/Home/Roll/RollMove`(共 1600+ 次)只在 §7.2 的 tag 名单里出现,无参数说明 |
| presentation §2.5 抖动 | PASS(缺 Stop 三兄弟) | `shake/charaShake/messageShake` 齐;`shakeStop/charaShakeStop/messageShakeStop/subRenderShakeStop`(557 次)未列 |
| presentation §3.1 Fade | PASS(1 处归类错误) | `overlayFadein` 被归入 fade 族,实测是**角色槽位 alpha**命令(§A.11.2) |
| presentation §3.2 Wipe | PASS | 结构/资源/命令全覆盖;仅取值域清单缺(本文 §C.1 补 45 个名字) |
| presentation §3.3 Mask | PASS | 语料域仅 `black/white`;`clear` 未使用,`maskOff` 0 次 |
| presentation §3.4 Flash | PASS | `once/loop` 语料实用;`pingpong` 与 `flashDep` 全族 0 次 |
| presentation §3.5 Stretch | GAP(参数形态+语料 6 次) | 7 个方向名有字面量直证,但语料只用了 `full`(5 次)+`subStretch on`(1 次) |
| presentation §4.1 特效层 | PASS(字段/翻转)/ GAP(命令词与参数) | `effectStart/Stop/Pause/Destroy`、`fowardEffect*`、`backEffect*` 的命令词只在 composition §4 出现,presentation 未列 |
| presentation §4.2 滤镜 | PASS | `cameraFilter`/`charaFilter` 机制;补语料域(§C.3) |
| presentation §4.3 RT 特效 | GAP(subBlur 族) | `subBlur`(38)/`subBlurOff`(36)/`subBlur2Off` 未列;`distortionloop` 0 次 |
| presentation §4.4 SpriteMask | 语料 0 次 | `spriteMaskSet/Off/charaMask` 在 2583 文件中**全部 0 次** → 对回放器非必需 |
| presentation §5 角色 | **GAP(最大)** | 缺 `charaPut(11521)`、`charaMove(8914)`、`charaMoveEase(2559)`、`charaMoveScale(1406)`、`charaMoveScaleEase(433)`、`charaMoveReturn(Ease)`、`charaRelativeLoopMove(Stop)`、`charaRollMove/Ex`、`charaTalk(70640)`、`charaFadein(74211)`/`charaFadeout` 参数形态、`charaEffectEdgeBlur{Start,Stop,Pause,Destroy}`、`charaBackEffectStop/Destroy`、`charaSpecialEffectStop` |
| presentation §6 FSM/插入动画 | PASS(结构)/ 语料稀薄 | 命令族齐;`fsmObjSetBool/Float/String` 0 次,`adv*` 全族 0 次,`insertionAnimation*` 仅 3 次 |
| presentation §7 子层 | PASS(结构)/ GAP(变体族) | `subRenderFadein{FSL,FSR,FSSideL,FSSideR}`(607 次)、`subRenderMoveFS*`、`subRenderMoveScale`、`subRenderShakeStop`、`#MASK` 键未列 |
| presentation §8 时间模型 | **GAP(与语料严重不符)** | `tdelay/delayEnd/delayStop/delayStopAll` **语料 0 次**;`wait` 是关键字分派命令而非纯阻塞点;`wt(114251)`/`twt(27)` 未提 |
| composition §1 资产命名 | PASS | 模板与语料一致(`back10000`/`cut063_cinema` 等名可直拼) |
| composition §2 分辨率/站位 | PASS(1 处错误) | §2.2 对 `GetPosition(float,float)` 的描述与反汇编不符(§A.11.3) |
| composition §3 图层 | PASS | 补:`charaLayer` 第 2 参语料含 `nomal/nnormal/main` 等非规范值 |
| composition §4 命令表 | PASS(3 处需修正/补) | `imageSet` 第 3 参语义、`master*` 双资源语义、`charaPut` 缺失 |
| composition §5 字体文本 | PASS | 补:`messageAlign bottom`、`messageSpeedForcedNormal on/off`、`talkNameBack`、`fontSize` 的语料低频事实 |
| composition §6 次要 API | PASS | — |

**三个最严重的缺口**:① presentation §5 与 §8 与真实语料脱节(角色移动族/时间族);② 缓动清单(§B)两份文档都没有;③ 转场/滤镜关键字取值域(§C)只有零散示例。

---

## A. 逐系统覆盖度核查

### A.0 语料命令频次(本文用到的全部家族,一次给全)

| 家族 | 命令(次数) |
|---|---|
| 主相机 | `cameraMove`2507 `cameraMoveEase`171 `cameraHome`454 `cameraRoll`2 `cameraRollMove`20 `cameraFilter`356 |
| 子相机/子渲染 | `subCameraOn`908 `subCameraOff`603 `subCameraMove`54 `subCameraMoveEase`11 `subCameraHome`12 `subCameraRoll`56 `subCameraRollMove`4 `subCameraFilter`1948 |
| 子渲染(命令) | `subRenderFadein`1863 `subRenderFadeout`2346 `subRenderDepth`859 `subRenderScale`783 `subRenderMove`504 `subRenderMoveEase`370 `subRenderMoveScale`24 `subRenderMoveScaleEase`29 `subRenderShake`16 `subRenderShakeStop`2 + `*FSL/FSR/FSSide*` 变体 |
| Fade | `fadein`8787 `fadeout`8763 `overlayFadein`649 `fadeMove`83 `soundStopAllFade`32 `endFade`1 `fadeOff`0 |
| Wipe | `wipein`3103 `wipeout`3123 `wipeFilter`250 `wipeOff`215 `wipeinEx/wipeoutEx/wipeFilterEx`0 |
| Mask/Flash/Stretch | `maskin`156 `maskout`73 `flashin`1214 `flashout`48 `flashOff`145 `stretchin`4 `stretchout`1 `turnPageOn`12 `turnPageOff`11 |
| 抖动 | `shake`2402 `charaShake`2661 `messageShake`87 `shakeStop`330 `charaShakeStop`199 `messageShakeStop`26 |
| 滤镜/模糊 | `cameraFilter`356 `charaFilter`890 `blur`521 `blurOff`503 `subBlur`38 `subBlurOff`36 `subBlur2`4 `subBlur2Off`4 `distortionstart`13 `distortionstop`11 |
| 场景特效 | `effect`3150 `effectStop`773 `effectDestroy`652 `effectForceStop`19 `effectStart`1 `effectPause`1 `backEffect`143 `backEffectStop`67 `backEffectDestroy`35 `fowardEffect`1297 `fowardEffectStop`191 `fowardEffectDestroy`212 `fowardEffectStart`4 `fowardEffectPause`4 `specialEffect`8 |
| 角色特效 | `charaEffect`4635 `charaEffectStop`1824 `charaEffectDestroy`1005 `charaEffectStart`8 `charaEffectPause`8 `charaBackEffect`49 `charaBackEffectStop`27 `charaBackEffectDestroy`10 `charaSpecialEffect`1284 `charaSpecialEffectStop`7 `charaEffectEdgeBlur`177 `charaEffectEdgeBlurDestroy`118 `charaEffectEdgeBlurStop`65 `charaEffectEdgeBlurStart`7 `charaEffectEdgeBlurPause`7 |
| 角色 | `charaSet`26796 `charaFace`114682 `charaFadeout`76752 `charaFadein`74211 `charaTalk`70640 `messageOff`27236 `charaDepth`21768 `charaScale`15856 `charaPut`11521 `charaMove`8914 `charaLayer`8269 `charaShake`2661 `charaMoveEase`2559 `charaFaceFade`2007 `charaFadeTime`1778 `charaMoveScale`1406 `charaMoveReturn`1255 `charaEffect*`(见上) `charaFilter`890 `charaCrossFade`472 `charaMoveScaleEase`433 `charaRoll`337 `charaMoveReturnFSL/FSR`239 `charaPutFSL/FSR`255 `charaMoveFSL/FSR`706 `charaFadeinFSL/FSR`3257 `charaFadeinFSSide*`346 `charaMoveEaseFS*`185 `charaRollAxis`71 `charaAttack`50 `charaShadow`49 `charaRelativeLoopMove`39 `charaRollMove`28 `charaRollMoveEx`8 `charaCutout`8 `charaClear`6 `charaCutin`16 `charaMask`0 |
| 特效消息 | `effectmessage`12 `effectmessageStop`12 |
| FSM/插入 | `fsmObjSet/SetState/SendEvent/Layer/Destroy` 各 3;`insertionAnimationStart/End/SetFSSideR` 各 1;`adv*` 0 |
| 画面 | `scene`10445 `sceneSet`4687 `imageSet`2028 `enableFullScreen`1187 `pictureFrame`854 `pictureFrameTop`224 `masterBranch`137 `masterSet`50 `masterScene`50 `backCameraColor`43 `verticalImageSet`30 `masterImageSet`18 `backlogStart/End`16/16 `charaCutin`16 `capture`14 `messageSpeedForcedNormal`14 `turnPageOn/Off`12/11 `horizontalImageSet`4 `imageChange`1 `masterNameWidth`1 `autoAndBackLog`1 `messageAlign`1 `messageChange`1 `captureRelease`1 |
| 等待 | `wt`114251(整行)+1815(行内)`wait`26781(整行)+99(行内)`k`184799(整行标记,无行内)`twt`0(整行)+27(行内)`tdelay/delayEnd/delayStop/delayStopAll` 0 |

> 语料里还有 8 行用 **制表符** 分隔参数(如 `[scene \t260400]`),一次出现即被算作 `str` 形状;阅读器的分词应把 `\t` 视作空格。

### A.1 相机(§2)

* **PASS**:`cameraMove` 的解析顺序与 `ScriptPosition` 位置表、`MainCameraMoveEase` 的 iTween 参数、`SetCameraRoll/StartCameraRoll` 双节点 pivot、`Shake/OnShake` 全部与语料/反汇编一致。
* **GAP(命令词缺参数说明)**:文档只在 §7.2 的 `IsExistTargetSubLayerGroup` tag 名单里出现过 `subCameraMoveEase/subCameraRoll` 等名字,没有参数表。语料实测:

| 命令 | 形状(语料) | 样例 | 次数 |
|---|---|---|---|
| `subCameraOn <n>` | int ∈ {1,2,3,4} | `[subCameraOn 2]`(404/256/121/109) | 908(另有 18 次无参) |
| `subCameraOff` | 无参 | `[subCameraOff]` | 603 |
| `subCameraHome <#key> <t>` | `str float` | `[subCameraHome #A 0.1]` | 12 |
| `subCameraMove <#key> <t> <x,y> <scale>` | `str float pos float` | `[subCameraMove #A 0.1 0,0 1.1]` | 54 |
| `subCameraMoveEase <#key> <t> <x,y> <ease> <scale>` | `str float pos str float` | `[subCameraMoveEase #A 0,0 0.1 easeOutSine 1.0]` | 11 |
| `subCameraRoll <#key> <deg> [<center>]` | `str int [pos]` | `[subCameraRoll #A 180 0,0]` | 56 |
| `subCameraRollMove <#key> <t> <deg>` | `str float int` | `[subCameraRollMove #A 5.0 30]` | 4 |
| `cameraHome <t>` | float | `[cameraHome 0.1]` | 454 |
| `cameraRoll <deg> [<center>]` | int / int pos | `[cameraRoll 10]` | 2 |
| `cameraRollMove <t> <deg>` | float int | `[cameraRollMove 0.3 0]` | 20 |

  * `subCameraOn` 的 n 与 `ScriptManager.RenderCameraSubStart(int subLayerCount)` @`0x31a00e8`(presentation §7.1 已录)对应,语料最大 4 → **子层组上限 4 个编号**(与 `#A/#B/#C/#D` 一致,见 §D.2)。**【推断】**
  * 语料里**没有** `cameraRollEase/cameraRollMoveEase/subCameraRollEase`(0 次),不要为它们写代码。

### A.2 抖动(§2.5)

* PASS:`Shake(duration,cycle,x,y)`、`OnShake` 的 `InvokeRepeating("OnShake")`、`shakeTime/cycle/X/Y` 偏移全部直证。
* GAP:`shakeStop`(330)、`charaShakeStop`(199)、`messageShakeStop`(26)、`subRenderShakeStop`(2)未列。语料形态:`shakeStop` 通常无参(326/330),`charaShakeStop <slot>`(199/199 只带槽位),`messageShakeStop` 无参。
* GAP:`charaShake` = `<slot> <cycle> <x> <y> <time>`,如 `[charaShake A 0.05 3 3 0.25]`;第 3/4 参语料域 {0..8,10,27,30,48,60,90}(以 2/3/4 为主),第 5 参为时长 float。文档只给了类方法签名。

### A.3 转场(§3)

* **Fade**:PASS(`StartFadeMove`/`GetFadeoutType`/`MaskFade.Kind`)。补充语料事实:
  * 首参**并不只有 black/white**:19 种十六进制色共 56 次,如 `[fadein ffd700 1.0]`、`[fadeout FF000080 1.0]`(8 位含 alpha)。所谓“数字首参 `[fadein 800000 1.0]`”其实是**十六进制颜色 `800000`**(深红),不是数字参数。**【语料实证】**
  * `fadein` 第 2 参:1.0(3866)/1.5(1471)/0.5(789)/2.0(645)/0.1(509)…;`fadeout` 同样只有 1 个必需参数。`fadeMove <black|white> <t1> <level>`:第 3 参是**目标 alpha**(1.0/0.4/0.7/0.3/0 等)。
  * `fadeOff/endFade` 语料 ~0 次(1 次 endFade)。
* **Wipe**:PASS(资源 `Wipe/<name>`、`_Gradation`、`GetHorizontal5SplitUv` 基准宽 512)。取值域见 §C.1(45 名)。
* **Mask**:PASS。语料域:`maskin black|white`(119/37),`maskout white|black`(37/36);`clear` 关键字**未使用**;`maskOff` 0 次。
* **Flash**:PASS(`once|loop|pingpong` 字面量在 `OnFlashRequest` @`0x31ba4b4/0x31ba4d8/0x31ba4e4`)。语料只用 **once(1081)/loop(133)**;`pingpong` 0 次;`flashin` = `<once|loop> <时间1> <时间2> <色1> <色2>`(色为 8 位十六进制,如 `[flashin once 0.1 0.3 FFFFFFAF FFFFFF00]`);`flashout` **只接 1 个时长**(48/48)。`*Dep` 全族 0 次。
* **Stretch**:文档列出的 7 个方向名有字面量直证(`StartStretch` @`0x31b9c70`–`0x31b9cd0`:horizontally / horizontallyLeft / horizontallyRight / vertical / verticalUp / verticalDown / full),`subStretch` 走 `ScriptSubLayer.StartSubStretch` @`0x31dea10`(同一组字面量 @`0x31dea64`–`0x31deab8`)。语料:仅 `[stretchin full 0.1 1.0]` 4 次、`[stretchout full 3.0 3.0]` 1 次、`[subStretch on]` 1 次。**`subStretch` 的第 1 参在语料里是 `on`,不在 7 名之内** → 语义未定。**【推断:on = 开启子层拉伸】**

### A.4 滤镜 / RT 特效(§4)

* PASS:`SetCameraFilter` 的 shader 名拼接、`_FilterParam` 16 float 矩阵、`charaFilter` 链、`ScriptActionRenderEffectController` 的字段表。
  * 交叉证据:binary 里**没有** `Custom/Sprite-ScriptActionRenderGray` 之类的字面量(只有 `Custom/Sprite-ScriptActionRender` @`0x31a0628`,见 §C.3),说明 `cameraFilter gray` 的 shader 名确为运行时拼接。**【实证】**
* GAP:`subBlur`(38)/`subBlurOff`(36)/`subBlur2`(4)/`subBlur2Off`(4)未列;参数:`[subBlur #A lens 0.4 4 10 0.5 ...]`(形状 `str str float int int float str`)。
* GAP:`blur/blurOff` 的第 1 参取值域 `lens|motion|glass`(285/235/1、260/194/1)未列。`glass` **不是命令**,只是 `blur` 的关键字(各 1 次),且 `blur` 有 8 参形态 `str float int int float float float int`(231 次)。
* `distortionstart` 6 个 float:`<sec> <count> <centerX%> <centerY%> <strength> <range>`(语料 13 次,典型 `2.5 0.5 0.5 1.0 1.0 100.0`;第 6 参 9/13 是 `100.0`),`distortionstop <sec>`(11 次);`distortionloop` 0 次。

### A.5 角色(§5)——最大缺口

presentation §5.2 的表格只覆盖了:`charaSet/charaChange/charaFace/charaFaceFade/charaDepth/charaLayer/charaCutout/charaCutin/charaMask/charaRoll/charaRollAxis/charaScale/charaShake/charaFadeout/charaCrossFade/charaFadeTime/charaEffect{Start,Stop,Destroy}/charaBackEffect*/charaSpecialEffect*/useSimpleMeshFigure/figureChange/equipSet/imageSet 族/pictureFrame/spotlight`。
**语料里高频但文档未描述参数**的命令(全部为 §5 应补):

| 命令 | 语料形状 | 样例 | 次数 |
|---|---|---|---|
| `charaSet` | `str int int str`(+`str int int int`) | `[charaSet A 1098158200 1 シオン]`、`[charaSet R 1098345110 0 1]` | 26796 |
| `charaPut` | `str pos`(7499)/`str int`(4018) | `[charaPut H 1200,1200]`(缩放)、`[charaPut H 1]`(站位 index) | 11521 |
| `charaMove` | `str pos float` | `[charaMove G 0,0 0.3]` | 8914 |
| `charaMoveEase` | `str pos float str` | `[charaMoveEase H 300,0 0.5 easeOutQuad]` | 2559 |
| `charaMoveScale` | `str float float` | `[charaMoveScale H 1.1 0.3]`(缩放到 1.1,用时 0.3) | 1406 |
| `charaMoveScaleEase` | `str float float str` | `[charaMoveScaleEase H 1.0 1.0 easeOutSine]` | 433 |
| `charaMoveReturn` | `str pos float`(1250) | `[charaMoveReturn A 0,-5 0.4]` | 1255 |
| `charaMoveReturnEase` | `str pos float str str` | `[charaMoveReturnEase G 0,10 0.4 easeOutSine easeInSine]`(两段缓动) | 2 |
| `charaRelativeLoopMove` | `str int pos pos pos float float float int` | 循环相对位移(39)/`…Stop`(31) | 39 |
| `charaRollMove` / `Ex` | `str float int` / `str float int pos` | `[charaRollMove G 0.1 45]`、`[charaRollMoveEx G 0.4 -10 0,0]` | 28/8 |
| `charaTalk` | `str`(可逗号多槽) | `[charaTalk A]`、`[charaTalk off]`、`[charaTalk A,B]` | 70640 |
| `charaFadein/Fadeout` | `str float int`(52687)/`str float pos`(18303,淡入时同时给坐标) | `[charaFadein C 0.1 1]`、`[charaFadein X 0.3 300,-280]`;`charaFadeout` 只有 `str float`(75189) | 74211/76752 |
| `charaEffectEdgeBlur*` | `str str str [int] [float]` | `[charaEffectEdgeBlur C FFF9A5 FFF9A5 4]` | 177(+Destroy118/Stop65/Start7/Pause7) |
| `charaAttack` / `charaShadow` / `charaClear` | — | — | 50/49/6 |

  * 语料里 `charaMove` 还存在**第 4 参 = 缓动名**的形态(13 次,如 `[charaMove C 40,57 2.5 easeOutCubic]`)。已核 handler:region `0x318505c`(`branch_map` 归属 `charaMove/charaMoveFSL/FSR/FSSideL/FSSideR`)只调 `ScriptCharaData.MovePosition` @`0x316feb8`(`0x3185208`),**没有** ease 分支 → 第 4 参被忽略。**【实证:该形态是脚本笔误/遗留】**
  * `charaTalk` 支持**逗号分隔多槽**(`A,B` 48 次、`I,J,K` 5 次、最多 8 个槽),以及 `on/off/depthOn/depthOff`(含大小写混杂 `Off/DepthOff/DepthOn/dpthOn`)。composition §1.1 的 `ConvertCharaIndexTalk`(0x31b356c)只处理单词比较,多槽的展开点未定位。**【推断:handler 循环对 pd 的偶数下标逐个处理】**
  * `charaDepth` 第 2 参语料域 **-1..50**(0 常见、最大 50,`-1` 是"恢复默认");composition §3.2 只说"单个角色的深度"。

### A.6 FSM / 插入动画(§6)

* PASS:结构、字段、命令族、`InsertionAnimations/{0}/{0}` 模板均有。
* 语料实况:`fsmObjSet <slot> <assetName> <objectName>` = `ScriptUI/SelectPanel/select01`(3 次);`fsmObjSetState K WAIT_SELECTED_ANIMATION`、`fsmObjSendEvent K START`、`fsmObjLayer K ui`、`fsmObjDestroy K`(各 3 次)。`fsmObjSetBool/Float/String` **0 次**。
* `insertionAnimationSet` 本身 0 次;仅 `insertionAnimationSetFSSideR ac_fude_triangle_slide_R 0,70`、`insertionAnimationStart ac_fude_triangle_slide_R cut530_ior_06`、`insertionAnimationEnd ac_fude_triangle_slide_R` 各 1 次 → **`insertionAnimationStart` 有第 2 参(动画名/触发器)**,文档 §6.1 只说 `GameObject.Find(<name>)` 校验。
* `adv*`(§6.3)在 2583 个 adv 脚本中 **0 次** → adv prefab 属战斗/其他流程,回放器可不实现。

### A.7 子层(§7)

* PASS:类结构、`IsExistTargetSubLayerGroup`、`subRender*` 命令、DEFAULT `#A` 全部正确(本文另补 `#` 前缀的直接证据,见 §D.2)。
* GAP(命令词):`subRenderFadeinFSL/FSR/FSSideL/FSSideR`(152/159/132/164)、`subRenderMoveFSL/FSR/FSSideL/FSSideR`、`subRenderFadeinFSR`、`subRenderMoveScale`(24)、`subRenderShakeStop`(2)、`subRenderScaleEase`(0)未列。
* GAP:`subRenderFadein <#key> <t> <x,y>` 的第 3 参 = **平移目标**(639 次 `0,0`,其余多为 `0,-300` 等),即“淡入 + 位移”;`subRenderFadeout` 只有 `<#key> <t>`。
* GAP:`subRenderMove <#key> <x,y> <t>`(504)、`subRenderDepth <#key> <int>`(859,值 1..5)、`subRenderScale <#key> <scale>`(783)。

### A.8 时间模型(§8)

* **§8.3 与语料不符**:`tdelay/delayEnd/delayStop/delayStopAll` 在 `scripts\` 全量 **0 次**(grep 直证)。二进制里确有这套机制(`GetNextDelayEnd` @`0x31b2710`、`ProcessDelayScript` 被 `find_callers 0x3177290` 列为 `ScriptCommandExecute` 的两个调用者之一)+ 但**本语料集不使用**。**【实证:语料 0 次 / 机制存在于代码】**
* **§8.4 需修正**:`wait` 不是单纯的阻塞点。handler @`0x31874f4`:`pd[0]` 送 `ComputeStringHash`(`0x3187514`/`0x3187530`)做**关键字分派**,语料域 = `fade`(25299)、`se <name>`(1437)、`charaSpecialEffect <slot> <name>`(40)、`fastPlayDraw <t>`(5)。真正的“等待玩家点击”由整行标记 `[k]`(184799 次)与 `[wt]`(114251 次)承担。
* **GAP**:`wt`(114251)/`twt`(27 行内)、`messageSpeedForcedNormal on|off`(14)、`skip`(217)、`enableWaitLoadAssetWhenResume`(108)未提。`wt`/`twt` 的改写点(`AnalysText`:→`wait time X` / `wait rtime X`)由 `work/out/supplement-script-format.md` §B.2 给出,本文不复述。

### A.9 消息窗 / 文本

* PASS(§5.2/§5.3)。补语料事实:`messageOff` 27236(整行;行内 0 次)、`messageAlign bottom`(1)、`messageChange cinema`(1)、`messageSpeedForcedNormal on|off`(7/7)、`talkNameBack`(33)、`effectmessage <name> <x,y> <t> <int>`(12,如 `[effectmessage bit_talk_change_text01 440,177 4.7 19]`)、`effectmessageStop <name>`(12)、`charaFaceIcon` **0 次**、`backlogStart/End` 各 16(无参)、`autoAndBackLog false`(1)、`enableFullScreen` 1187(无参)。

### A.10 画面构建(composition 全篇)

* §1 资产命名:PASS。语料侧全部落在文档给出的模板内:
  * `scene 10110` / `scene 95202 0.5` / `scene 55600 0.4 FULLSCREEN_IMAGE_DEVICE_WIDTH`,backId 为 5 位(`Back/back{0:D5}`)或 6 位(如 `132900`,`D5` 不截断);
  * `imageSet T back10000 1` → `Image/back10000`(语料 `imageSet` 第 2 参 695 次是 `back10000`),`imageSet` 还有第 4 参(528 次为 `1`);
  * `sceneSet Q 142200 1`(第 3 参 4687/4687 全是 `1`;41 次带第 4 参 `1`)。
* §2 分辨率/站位:PASS(见 §D.5 自洽性);*一处错误*见 §A.11.3。
* §3 图层:PASS。补:`charaLayer` 第 2 参语料含**非规范值** `NORMAL`(8)/`nomal`(7)/`nnormal`(3)/`main`(4) → 这些不会命中 `'sub'` 比较(`0x3182a5c`),按文档逻辑一律走“正常层”分支。文档应提示“按原样容错处理”。
* §4 命令表:3 处需修正/补充 → §A.11.4。
* §5 字体:PASS;`fontType` 语料 0 次(只有 `fontSize` 6 次)。
* §7 未决问题 1(bg/char 不存在):**确认**(语料 0 次);未决 4(`defaultDepth` 来源)仍未解;未决 6(adv*):语料 0 次,优先级降为最低。

### A.11 文档与语料/反汇编的矛盾(需修正)

#### A.11.1 presentation §1:`pd[0]` 不是 tag,分隔符占奇数位

* 文档两处互相矛盾:§1 说“第 k 个元素 `+0x20+8k`(element[0]=tag)”,同节又说“命令 tag 放在寄存器 **x25**”。后者正确。
* 直证:
  * 签名 `ScriptCommandExecute(string tag, string[] pd, int line, string data, ref string scriptErrorMessage, ref bool isScriptWait, ref float delta)`(dump.cs:**169490**)——`pd` 与 `tag` 是两个参数;
  * `wait` handler `0x3187514 ldr x1,[x8,#0x20]`(取 pd[0])→ `0x3187530 bl ComputeStringHash`:拿 **pd[0]='fade'** 做关键字分派,证明 pd[0] 是第一个**参数**;
  * `charaScale` handler `0x31815ac cmp w9,#3; b.ne <下一个 tag>`(**长度必须恰为 3**)+ `0x31815c4 ldr x0,[x8,#0x28]`(pd[1])与 `' '` 比较 + `0x31815e8 ldr x1,[x8,#0x20]`(pd[0])→`ConvertCharaIndex`。语料 `[charaScale A 1.0]` 只有 3 词 → 唯一自洽解释:**pd = [值, 分隔符, 值, …]**,即
    ```
    [charaScale A 1.0]  →  pd = ["A", " ", "1.0"]        (len 3 ✓)
    [charaMove A 0,0 0.5] → pd = ["A"," ","0",",","0"," ","0.5"] (len 7)
    ```
  * `charaMove` handler `0x31850e4 ldr x0,[x8,#0x38]`(pd[3])→ `get_Chars(0)` 与 `0x2c(',')` 比较(`0x31850f4`/`0x3185100`)→ 逗号**确实是独立元素**(与文档“逗号是独立 token”一致)。
* 因此文档里的 “参数可用单个空格 ' ' 表示省略” 应改写为:**`' '` 是分隔符元素本身,固定出现在 pd 的奇数下标**;命令 handler 用 `pd[1]==' '` 之类做格式校验。

#### A.11.2 presentation §3.1:`overlayFadein` 不是 fade 族

语料 649 次,形状 `str float pos`(+`str int pos`),样例 `[overlayFadein I 0.1 0,734]`、`[overlayFadein P 0 0,-757]` —— 首参是**角色槽位**(L/M/P/J/K/X/Y/O…),即“把槽位上的东西淡入到某坐标”。handler region `0x3184300`–`0x31843ac`(branch_map 归属 `overlayFadein`;cmd_sig 记录的 lits 含 `'clear'`、calls 列表含 `ScriptCharaData$$IsMoveAlpha`)也指向角色 alpha。**【实证(hash 名单+IsMoveAlpha 调用);槽位直译推断】**

#### A.11.3 composition §2.2:`GetPosition(float,float)` 不是返回 (0,0,0)

`0x31d8e3c` 反汇编:
```
0x31d8e3c  movi d2, #0000000000000000
0x31d8e40  ret
```
只把 **z 分量(d2)** 清零,`s0/s1`(传入的 x,y)原样返回 → 返回 `Vector3(x,y,0)`。**presentation §2.6 的描述正确,composition §2.2 的“只返回 (0,0,0)”错误**,应修正为“返回 (x,y,0)”。**【实证】**

#### A.11.4 composition §4:三处需修正

1. `imageSet`:文档说“位置/缩放由参数控制”。语料实测 `imageSet <slot> <name> <int> [<int>]`,第 3 参只有 **1(2006 次)/2(15 次)** 两种值(第 4 参 528 次恒为 `1`)→ 是模式/标志位,不是位置。位置/缩放来自随后的 `charaPut`/`charaMove`。**【语料实证 + 形状直证】** 具体位义未定位,标 **INFERRED**。
2. `master*` 家族是**性别双资源**:`masterSet <slot> <maleId> <femaleId> <1>`(如 `[masterSet L 1098348300 1098348310 1]`)、`masterScene <maleScene> <femaleScene> [t]`、`masterImageSet <slot> <maleAsset> <femaleAsset> 1`、`masterBranch <maleLabel> <femaleLabel>`(如 `[_Male _Female]`)。文档只写“针对主人称/横图槽位”,未提双份资源的含义。**【语料实证】**
3. `charaPut`(11521)完全缺失:`[charaPut <slot> 1200,1200]` = 设缩放百分比;`[charaPut <slot> 1]` = 按 `ScriptPosition` 站位 index 摆放。**【语料实证;第二参语义由值域推断】**

---

## B. 缓动(easing)全量清单

### B.1 语料侧(21 个名字,按次数)

扫描 `*MoveEase* / *ScaleEase* / *ReturnEase*` 共 17 个命令(3,928 次使用)的第 3/4 参(缓动名位置随命令而定,均为 `^ease[A-Z]` 形态):

| 缓动名 | 次数 | 缓动名 | 次数 |
|---|---|---|---|
| easeOutSine | 1762 | easeInOutBack | 14 |
| easeOutCubic | 667 | easeInBack | 13 |
| easeOutQuad | 357 | easeInExpo | 13 |
| easeOutQuint | 287 | easeInOutQuart | 13 |
| easeInOutSine | 245 | easeInOutQuad | 13 |
| easeOutQuart | 214 | easeOutElastic | 10 |
| easeOutExpo | 182 | easeInQuad | 9 |
| easeOutBack | 37 | easeInOutExpo | 2 |
| easeOutCirc | 32 | easeInCubic | 1 |
| easeInOutQuint | 26 | easeInSine | 15 |
| easeInOutCubic | 20 | | |

按命令的分布(节选):`charaMoveEase` 18 名 / `cameraMoveEase` 16 名 / `charaMoveScaleEase` 16 名 / `subRenderMoveEase` 12 名 / `charaMoveEaseFSL` 10 / `charaMoveEaseFSR` 9 / `charaMoveFSSide*` 4-6 / `subRenderMoveScaleEase` 7 / `charaMoveReturnEase` {easeOutSine,easeInSine}(2 段式:去/回各一)。
（数据:`work/scratch/ease_corpus.json`）

### B.2 二进制侧:两处「名字 → 枚举」转换,集合完全相同

1. **adv 命令走 iTween(权威)**:
   * 所有 `*Ease` 命令把缓动名**当字符串**塞进 iTween 的 Hashtable:`ScriptManager$$MainCameraMoveEase`(`0x31b9068 'easetype'`)、`UIScriptChara$$MovePositionEase`(`0x31e121c`)、`MoveReturnPositionEase`(`0x31e17ac/0x31e1ac4`,两段各一次,对应 `charaMoveReturnEase` 的两个名字)、`MoveScaleEase`(`0x31e1ea0`)、`MoveRelativePositionEase`(`0x31e25d4`)、`SubCameraMoveEase`(`0x31b8868`)、`SubRenderMoveScaleEase`(`0x31b8d40`)。
   * iTween 在 `iTween$$RetrieveArgs` @ **`0x482d3c4`** 里把字符串转枚举:`0x482d4c8` 取 `'easetype'`,四处 `System.Enum$$Parse`(@`0x482db60`/`0x482dce8`/`0x482de90`/`0x482e038`,其中 `w2=1` = `ignoreCase:true` @`0x482db58`),失败回退并打印 **`'iTween: Unsupported easeType supplied! Default will be used.'`**(@`0x482e3a0`)。
   * 接受集合 = `public enum iTween.EaseType`(dump.cs:**1102178**–1102216)的 **33** 个成员:
     `easeIn|Out|InOut` × {Quad,Cubic,Quart,Quint,Sine,Expo,Circ} = 21,加 `linear, spring, easeInBounce, easeOutBounce, easeInOutBounce, easeInBack, easeOutBack, easeInOutBack, easeInElastic, easeOutElastic, easeInOutElastic, punch`。
2. **竞技场(WarBoard)侧的字面量表**,与 1 完全同集合:`WarBoardManager$$GetEaseTypeScript` 的 33 条字面量(`0x2b22d8c`–`0x2b2320c`,如 `easeOutQuad`@`0x2b22d8c`、`linear`@`0x2b22e64`、`spring`@`0x2b22ef4`、`punch`@`0x2b22ea0`)。可用作“二进制字面量集合”的独立佐证。
   * 差集:`iTween.EaseType` 33 名 **=** WarBoard 33 字面量,**一个不差**。**【实证】**
3. PlayMaker FSM 另有一套命名(供 `fsmObjSet*` 的 FSM 内部使用):`EaseFsmAction.EaseType`(dump.cs:**831671**,29 个成员),差异:`bounce/elastic/punch` 为**裸名**(而非 easeInBounce/easeInElastic/easeOutElastic),总数 29 也少于 iTween 的 33。**adv 脚本的 `*Ease` 命令不经过它。**【实证:字面量集合无交集于 dispatcher】**

### B.3 差集(语料 ↔ 二进制)

| 方向 | 结果 |
|---|---|
| 语料有、二进制没有 | **空集(0 个)** —— 21 个名字全部 ∈ `iTween.EaseType` |
| 二进制有、语料未用 | **12 个**:`easeInBounce, easeOutBounce, easeInOutBounce, easeInCirc, easeInOutCirc, easeInElastic, easeInOutElastic, easeInQuart, easeInQuint, linear, spring, punch` |
| WarBoard 字面量表 vs 语料 | 与上表完全一致(`wb − corpus` 也是同 12 个) |

**结论**:缓动名的取值域就是 `iTween.EaseType`(33 名),语料只用到 21 个;阅读器实现时按 33 名建表即可,并必须**大小写不敏感**(`Enum.Parse(..., true)`)。
表见 `work/scratch/ease_binary.json`。

### B.4 presentation.md 的缺口

presentation.md **完全没有缓动清单**:§2.2 只说 `MainCameraMoveEase(... string easetype ...)`,§5.1 只提 `SetRoll(rollAxis,roll,...)` 与 `moveRelativeEaseType` 字段,且**没有提到任何具体缓动名**。§5.2 的 `charaMoveEase` 一节(若补)应直接引用 §B.1/§B.2 的两张表。

---

## C. 转场 / 滤镜关键字取值域(全量 + 解析点)

### C.1 Wipe 名字(45 个,`Wipe/<name>` 资产)

| 名字(次数) |
|---|
| rectangleStripLeftToRight 1002 · rectangleStripRightToLeft 996 · rightToLeft 794 · leftToRight 701 · openEye 600 · rectangleStripDownToUp 456 · rectangleStripUpToDown 452 · circleIn 325 · rollLeft 188 · rollRight 173 · upToDown 108 · downToUp 106 · rollFlashRight 32 · sideBlind 32 · rightUpToLeftDown 27 · noise 26 · leftDownToRightUp 26 · cutVer 25 · gunya 18 · circleOut 16 · moya 15 · magic 15 · cutSide 14 · clash 9 · diaOut 8 · verBlind 8 · leftUpToRightDown 7 · uzumaki 6 · windmill 6 · rightDownToLeftUp 5 · fire 4 · square 4 · guruguru 3 · polka02 2 · polka04 2 · mozaFade 2 · heartOut 2 · uzumakiBig 2 · mezo 2 · sazanami 2 · cutAcross 1 · heartOutBig 1 · rectangleRightToLeft 1 · rectangleLeftToRight 1 · damage 1 |

* `wipein`/`wipeout` 用同一套名字(方向由命令决定);`wipeFilter` 另有偏向:`cinema 216`、`circleIn 23`、`openEye 8`、`downToUp 2`、`rightToLeft 1`。
* 第 3 参(level)域:1.0(1507)/1(1451)/0.5(92)/2/1.2…;`wipeFilter cinema 0.5 0` 的第 3 参恒 `0`(216)。
* 二进制解析:名字**不进枚举**,直接 `ConvertWipeName` → `Wipe/{name}`(**`Wipe/`@`0x31b3a00` 一带**,literal `'Wipe/cutVer'` 存在 → `cutVer` 走 ExUIUserMeshRenderer 5 段网格,见 presentation §3.2)。`wipeinEx/wipeoutEx/wipeFilterEx` 语料 0 次。

### C.2 Fade / Mask / Flash / Stretch

| 命令 | 第 1 参取值域(次数) | 二进制证据 |
|---|---|---|
| `fadein`/`fadeout`/`fadeMove` | `black`(14024) `white`(3470) + 19 种 hex 色(56 次,如 `ffd700`,`FF000080`) | `StartFade` 的 `'clear'`@`0x319ee64`、`'black'`@`0x319ee70`、`'white'`@`0x319eea0`;`StartFadeMove` `'black'`@`0x31bb9d8`;`ConvertColor`@`0x31b36bc` 处理 hex |
| `maskin` / `maskout` | `black`(119/36) `white`(37/37) | `StartMask`@`0x31bbc10`(presentation §3.3);`'clear'` 未在语料使用 |
| `flashin` | `once`(1081) `loop`(133) | `OnFlashRequest`@`0x31ba3d8`: `'pingpong'`@`0x31ba4b4`、`'once'`@`0x31ba4d8`、`'loop'`@`0x31ba4e4`;`pingpong` 语料 0 次 |
| `stretchin`/`stretchout`/`subStretch` | `full`(5) / `on`(1) | `StartStretch`@`0x31b9c28` 7 名字面量 `0x31b9c70`–`0x31b9cd0`;`StartSubStretch`@`0x31dea10` 同一组 `0x31dea64`–`0x31deab8` |
| `turnPageOn`/`Off` | 无参(11/11);1 次 `turnPageOn f` | — |

### C.3 滤镜关键字

| 命令 | 取值域(次数) | 二进制解析点 |
|---|---|---|
| `cameraFilter` | `gray`(181) `normal`(169) `darkred`(3) `aberration`(1),353/356 次只带 1 个参数 | 名字**无字面量**(`gray/darkred/aberration` 在 binary 的 story 代码里都不存在)→ shader 名运行时拼接:「`Custom/Sprite-ScriptActionRender`」@**`0x31a0628`**(`GetSpriteScriptActionRenderShader`)+ `GetStringWithFirstLetterChangedToUpperCase`@`0x31a0578` → `…RenderGray` 等(与 presentation §4.2 一致)。`aberration` 的 shader 名在字符串表中不存在 → 依赖 assetbundle 内的 shader。**【实证:无字面量 + 拼接链】** |
| `charaFilter` | 第 2 参:`silhouette`(820) `normal`(70);第 3 参:色值 hex(`00000080` 644、`FFFFFF80` 46…) | `'silhouette'`/`'normal'` 在渲染类里比较:`UIImageRender$$SetCharacterRender`(`0x30fb06c` 附近)、`UIEquipGraphRender$$SetCharacterRender`(`0x30f1f80`)、`UIEquipGraphViewerRender`、`UIHorizontalImageRender`;对应 shader 字面量 `Custom/Sprite-ScriptActionFigureSilhouette`(`0x30fb018`)、`…FigureNormal`(`0x30fb048`) |
| `subCameraFilter` | 形态 6 种,主流 `str str str int pos int`(818)/`str str`(604)。域:第 2 参 `maskEdge`(1290) `normal`(336) `through`(248) `mask`(28) `maskEdge&gray`(9) `gray`(9) `mask&gray`(3) `inversion`(2);第 3 参 `cut359_mask01..42`(32 种,编号不连续,缺 19/27-32/38-40)+ `#MASK`(14);第 4 参 3/4/5/30;第 5 参 RGB(A);第 6 参 0/1(`0`=693,`1`=115) | handler region `0x3183234`–`0x3183288`(branch_map 归属 `subCameraFilter`);关键字比较在 dispatcher 内:`'mask'`@`0x3188490`/`0x318ca38`、`'maskEdge'`@`0x318ca54`、`'normal'`@`0x318cc3c` 一带;`'through'` 字面量只出现在 `ScriptManager$$RenderCameraInit`(`0x319f9d0`)→ **`through` 是“相机直通/无滤镜”的渲染模式名**。材料属性 `_FilterParam`/`_Color` 由 `ScriptSubLayerManager$$RenderingSubLayer`(`0x31defd0`/`0x31defdc`)写入 |
| `blur`/`blurOff` | 第 1 参 `lens`(285/260) `motion`(235/194) `glass`(1/1) | 三个名字都是字面量(`'lens'`@`0x31779f4`、`'motion'`@`0x3178894`、`'glass'`@`0x3178534`,均在 `ScriptCommandExecute`;`'glass'` 另在 `AnalysText`@`0x31a9d5c` 用于资产收集)。**`glass` 不是命令**(语料 0 次独立出现) |
| `distortionstart` | 6 个 float:`<sec> <count> <centerX%> <centerY%> <strength> <range>` | `StartDistortion`(presentation §4.3);`distortionstop <sec>` |

> 语料里 `#MASK` 是**唯一非字母的槽位键**(其余槽位键是 `#A`–`#D`;另有 3 次 `charaLayer <slot> sub normal` 把普通层名当键写的怪例),见 §D.2。

---

## D. 画面构建实证核对

### D.1 `scene` / `sceneSet` / `imageSet` / `master*`

| 命令 | 语料形状(次数) | 样例 | 与 composition.md |
|---|---|---|---|
| `scene` | `int`(8855) `int float`(1062) `int int`(488) `int float str`(28) `int int str`(3) `int str`(1) | `[scene 104100]` `[scene 95202 0.5]` `[scene 10000 0]` `[scene 55600 0.4 FULLSCREEN_IMAGE_DEVICE_WIDTH]` | 一致:第 2 参 = 淡入时间,第 3 参 = `SCENE_MODE` 枚举名 |
| `sceneSet` | `str int int`(4646) `str int int int`(41) | `[sceneSet Q 142200 1]` | 一致:`Back/back{0:D5}`;第 3 参恒 1 |
| `imageSet` | `str str int`(1491) `str str int int`(528) | `[imageSet T back10000 1]` | **需修正**:第 3 参 ∈{1,2},非位置(§A.11.4) |
| `masterSet` | `str int int int` | `[masterSet L 1098348300 1098348310 1]` | 男/女双 id |
| `masterScene` | `int int [float]` | `[masterScene 246802 246806 0.5]` | 男/女双 backId |
| `masterImageSet` | `str str str int` / `str int int int` | `[masterImageSet L 276600 276601 1]` | 男/女双资产名 |
| `masterBranch` | `str str` | `[masterBranch _Male _Female]` | 男/女两个 label |
| `masterNameWidth` | `str int str str` | `[masterNameWidth large 339 _Name339Less _Name339Over]` | 1 次;名牌宽度切换 |
| `pictureFrame(Top)` | `str`/无参 | `[pictureFrame cut063_cinema]`(425) / `[pictureFrameTop cut063_cinema]`(157) | 一致;`pictureFrame` 另有 426 次无参(**【推断】**= 清除,对应 `ClearPictureFrameImage`) |
| `backCameraColor` | 无参(43) | `[backCameraColor]` | — |
| `capture`/`captureRelease` | 无参(14/1) | — | 一致 |

* `FULLSCREEN_IMAGE_DEVICE_WIDTH` 的直证:`public enum ScriptManager.SCENE_MODE { DEFAULT = 0, FULLSCREEN_IMAGE_DEVICE_WIDTH = 1 }`(dump.cs:**167278**–167283);`SetbSceneParam(string data, out SCENE_MODE sceneMode, out float fadeTime)`(dump.cs:**169418**)→ 与 composition §4 的“`Enum.Parse` 反射写入”一致(详见 `work/out/supplement-command-coverage.md`)。
* `bScene/bSceneLoad/sceneLoad/figureSet/figureChange/masterImageChange/pictureFrameLoad` **语料 0 次**(它们只在二进制/旧版本存在)→ composition §1.2 里相应行可加“语料未使用”注记。

### D.2 子层键 `#A` 与 `#MASK`

* 语料 `#` 键全域:`#A`(8026) `#B`(4107) `#C`(1902) `#D`(760) `#MASK`(44)。使用者:`charaLayer`(p2)、`subRender*`(p0)、`subCamera*`(p0)、`subBlur*`(p0)、`subRenderDepth`(p0);`#MASK` 共 44 次,分布 `charaLayer` 29 / `subCameraFilter` 14 / `subRenderDepth` 1。
* 解析直证:
  * `ScriptManager$$IsExistTargetSubLayerGroup` @`0x31c69f8`:`0x31c6e54 ldr w8,[x19,#0x18]`(pd 长度)→ `0x31c6e5c ldr x0,[x19,#0x20]`(**pd[0]**)→ `0x31c6e6c ldr x8,[x8,#0xae0]`(**`'#'`** 字面量,slot `0x5579000+0xae0`)→ `String.StartsWith("#")`;函数体内 44 条命令名字面量(`0x31c6a14`–`0x31c6e34`,含 `subRenderFadein/FSL/FSR/FSSideL/R`、`subRenderMove*`、`subRenderScale`、`subCameraMoveEase`、`subCameraFilter`、`charaLayer` 等)= 按 tag 选“层 key 在第几参”。
  * 默认组名:`ScriptSubLayerManager$$GetSubLayer` @`0x31df7d4`,`0x31df8b0 IsNullOrEmpty(key)` → `0x31df8c0 ldr x8,[x8,#0x320]` = **`'#A'`**(唯一 `'#A'` 字面量,`0x31df858` 处加载);`DEFAULT_SUB_LAYER_GROUP_NAME='#A'`。
  * **`#MASK` 在二进制里不是字面量** → 它就是普通的 `#`-前缀键,由 `GetSubLayer`/`CreateSubLayer` 按需建组;`ScriptSubLayer.SetMaskLayer`(`0x31ddc60` = `str x1,[x0,#0xb0]!`,写 `SubLayerMask` 字段)说明存在“遮罩层”概念。**【实证:无字面量 + 前缀判定;遮罩语义推断】**
* 语料里 `#MASK` 的两种角色:① `[charaLayer G sub #MASK]` = 把角色挂到 MASK 组;② `[subCameraFilter #A mask #MASK]` = 用 MASK 组当滤镜纹理。**【推断:①/②互证】**

### D.3 角色槽位 / 深度 / 层 / 缩放

* **槽位字母表 = A–Z(26 个,全部出现)**:
  * `charaSet` 27 种值(A–Z + 1 次 `?`);`charaPut`/`charaDepth` 26 种(A–Z);
  * `charaTalk` 的槽位参允许**逗号列表**(`A,B`、`I,J,K`、最多 `U,D,A,B,C` / `N,H,E,F,G` 等 5-8 槽),并含 `on/off/depthOn/depthOff`(大小写混杂);
  * `ConvertCharaIndex`(`0x31b34f0`)把字母打包成 int:`w20=(c-'A')|(w20<<8)`(composition §1.1),对**多字符**输入会得到一个巨大 int → handler 之后用 `cmp w0,w9; b.hs <越界保护 0x3193cd4>` 挡掉(例:`charaScale` 0x3181604)。这与“语料里存在 `?`、`A,B` 等怪值”一致:它们会被越界保护吞掉或落到别的分支。**【实证 + 语料实证】**
* `charaDepth` 第 2 参域 **-1..50**;`charaLayer` 第 2 参域 `sub|normal|NORMAL|nomal|nnormal|main`。
* `charaScale`(15856)域:0.1–3.0 主流(1.2 4202、1.0 3385、1.3 1307、1.1 1304、1.01 1237…),即**倍率**;`charaMoveScale` 同族。
* `charaPut` 第 2 参混两种语义(缩放对 `1200,1200`/`2000,2500` vs 站位 index `1`)。

### D.4 pictureFrame 常量与渲染层

* `ScriptManager.PICTURE_FRAME_Z_POS_NORMAL`(`+0x10`)/`PICTURE_FRAME_Z_POS_TOP`(`+0x14`)(dump.cs:**167799**/167800);`PICTURE_FRAME_SPRITE_WIDTH_16_9`(`+0x18`)/`_21_9`(`+0x1C`)(dump.cs:**167820**/167821)——与 composition §3.1 的 -10.0 / -230.0 / 1025 / 1346 对应(数值由 `.cctor`@`0x31c9600` 写入,composition 已录)。
* 语料侧旁证:`pictureFrame` 名只有 3 种(`cut063_cinema` 425、`cut049_frame01` 2、`cut197_savastacinema` 1),`pictureFrameTop` 只用 `cut063_cinema`→ “画框 + 顶层画框”是一组固定装饰资源。**【语料实证】**

### D.5 坐标 / 分辨率自洽性

对 `pos` 形态参数(x,y)的统计(`work/scratch/supp_scan.json` 的 `coord`):

| 命令 | x 范围(distinct) | y 范围(distinct) | 占比 |
|---|---|---|---|
| `charaMove` | [-1500, 2000](333) | [-2500, 2500](376) | \|x\|≤700: **98.6%**, \|y\|≤800: **97.2%** |
| `charaMoveEase` | [-2700, 3250](198) | [-2900, 1400](200) | 98.9% / 98.6% |
| `charaMoveReturn` | [-630, 510] | [-450, 583] | 100% / 100% |
| `charaMoveFSL/FSR` | [-920, 556] / [-425, 1056] | [-1500, 500] | ≥98% |
| `cameraMove` | [-350, 300](64) | [-200, 200](68) | 100% |
| `cameraMoveEase` | [-120, 130](18) | [-100, 50](24) | 100% |
| `subRenderMove(Ease)` | [-750, 2000] | [-770, 2500] | ≥98% |
| `overlayFadein` | [-2000, 2000] | [-1800, 1500] | 93.9% / 87.9% |

* **自洽性**:绝大多数立绘/相机坐标落在 ±700(16:9 可视半宽 512 + 边距)以内,极端值(±2500/±2000)是“屏外起点/终点”,与 `ScriptPosition` 的 ±512、`FS_OFFSET_X_MARGIN=80`、1344×576(半宽 672)一致;`cameraMove` 永远在 ±350 内(相机只做小幅推拉),与 `MainCameraMoveEase` 的 scale 1.0–1.5 匹配。**【语料实证 + 与 composition §2 结论一致】**
* y 值以**负值为主**(`charaMove` y 值 Top:`-50`625、`-200`484、`-300`355 → 向上偏移),`charaMoveReturn` 用 ±5..55 的小偏移(呼吸/抖动式回位);`charaPut` 的 `2500,2500`/`2000,2500` 是**缩放百分比**,不属于坐标(见 §A.11.4)。
* 结论:composition §2.1/§2.2 的分辨率与站位结论**与语料自洽**,无需修改。

---

## E. 未决 / INFERRED 汇总

1. **INFERRED** `subCameraOn <n>` 的 n = 子层组数量(语料 1..4),与 `#A..#D` 一一对应;`RenderCameraSubStart(int)` 的实参来源未逐位验证。
2. **INFERRED** `imageSet` 第 3 参 ∈{1,2} 的位义(1=普通、2=特殊?);handler 未定位到可读的形状切换点。
3. **INFERRED** `subStretch on` 不在 `StartSubStretch` 的 7 名字面量内 → 可能是“开关”语义或有别的入口。
4. **INFERRED** `charaTalk A,B` 多槽展开点未定位(handler region `0x3184a00`–`0x3184a50` 只见到 `IsWaitTalk`,实际分支在共享块)。
5. **INFERRED** `subCameraFilter` 第 6 参(0/1)与第 4 参(3/4/5/30)的位义。
6. **语料 0 次**(阅读器可延后):`spriteMaskSet/Off`、`charaMask`、`adv*` 全族、`tdelay/delayEnd/delayStop/delayStopAll`、`flashDep` 族、`wipeinEx/wipeoutEx/wipeFilterEx`、`subRenderScaleEase`、`glass`(独立)、`charaFaceIcon`、`messageOn`、`fontType`、`figureSet/figureChange/bScene/bSceneLoad/sceneLoad/pictureFrameLoad`、`distortionloop`、`stretchOff/subStretchout`、`fadeOff/maskOff`、`fsmObjSetBool/Float/String`。
7. `pd` 的**长度语义**:handler 里 `cmp w9,#N` 有 `b.lt`(下限)与 `b.ne`(精确,如 `charaScale` 恰 3)两种 → 阅读器的分词器应保留分隔符元素,否则精确长度校验会全部失配。**(实证)**

---

## 附录:证据文件与复现命令

| 产物 | 内容 |
|---|---|
| `work/scratch/supp_scan.py` | 单遍语料扫描(200+ tag 的逐位取值/形状/样例、`#` 键、坐标直方图) |
| `work/scratch/supp_scan.json` | 上者输出(≈5 MB):`shape` / `posval` / `fullarg` / `hashkey` / `coord` / `inline` |
| `work/scratch/ease_corpus.json` | 缓动名按命令的分布(21 名 + 次数) |
| `work/scratch/ease_binary.json` | `iTween.EaseType`(33)/`EaseFsmAction.EaseType`(29)/WarBoard 字面量(33)/语料集合(21) |

```
python work/scratch/supp_scan.py                                    # 重跑语料统计(~30s)
python work/coverage/win.py 0x482db60 70 2                          # iTween Enum.Parse(easetype)
python work/coverage/win.py 0x31874f4 0 50                          # wait 关键字分派(pd[0])
python work/coverage/win.py 0x31815a4 0 70                          # charaScale: 精确长度 3 + pd[1]==' '
python work/coverage/win.py 0x31850e4 0 20                          # charaMove: pd[3] 首字符 ',' (0x2c)
python work/coverage/win.py 0x31c6e54 0 20                          # IsExistTargetSubLayerGroup: pd[0] + '#'
python work/coverage/win.py 0x31d8e3c 6 8                           # ScriptPosition.GetPosition(float,float)
python work/coverage/win.py 0x31df858 0 20                          # ScriptSubLayerManager.GetSubLayer: '#A'
```

# FGO v2.139.3 剧情「画面构建」逆向说明

目标：说明 Fate/Grand Order Android 客户端（IL2CPP，libil2cpp.so）在播放剧情脚本时，
**资产如何命名 / 画面如何布局 / 图层如何叠加**，以便实现一个能渲染脚本的剧情阅读器。

- 二进制：`extract/lib/arm64-v8a/libil2cpp.so`
- 调度器：`ScriptManager$$ScriptCommandExecute` VA `0x3177290..0x319402c`
- 本文所有结论都带 **VA + 字符串字面量 / 浮点常量 / 字段** 证据；标注 `【实证】` 或 `【推断】`。
- 字面量取值来自 `il2cpp_out/stringliteral.json`；字符串使用点由 `il2cpp_out/lit_methods.json`
  （`tools/build_lit_index.py` 生成：全代码段精确匹配 `adrp xN,page ; ldr xN,[xN,#off]` 的
  metadata-usage slot 引用，再映射到字面量）反查得到。

---

## 0. 快速结论

1. 剧情画面是 **UI（NGUI）层** 上的一组元素，核心是 `ScriptManager` 上的 ScriptAction 预制体
   （字面量 `ScriptAction/`、`ScriptActionEncrypt/`，见 `ScriptManager$$.cctor` @`0x31c94cc`/`0x31c94d0`）。
2. 背景 + 立绘 + 特效被渲染进一张 **1344×576 的 RenderTexture**
   （`ScriptActionSetRenderTextureComponent`：`ScriptActionRenderWidth = 1344`、`ScriptActionRenderHeight = 576`），
   再作为 Sprite 合成到 UI 上；16:9 参考画布为 **1024×576**（`FSUtility.GetCalcOffsetX` 使用 576.0f @`0x31231c0`，
   且 `PICTURE_FRAME_SPRITE_WIDTH_16_9 = 1025` / `21_9 = 1346`）。
3. 角色站位是 **7 个固定 x 偏移**（`ScriptPosition.positionList`，`x = -256 / 0 / +256 / -438 / -512 / +438 / +512`），
   y 全部为 0 —— 纵向由预制体 pivot 决定。
4. 刘海/超宽屏（21:9）处理：`RATIO_16_9 = 1.7777778`、`RATIO_VISTA = 2.0`、`RATIO_SCOPE = 2.3333333`；
   左右各留 68（`SUB_MARGIN_X`）/ 全屏命令 80（`FS_OFFSET_X_MARGIN`）边距；
   `charaPutFSR` 等命令按 `ceil(GetOffsetX(80))` 平移，`*NotNotch` 变体不平移。
5. 立绘资产模板：`CharaFigure/[Form/{form}/]{servantId}`，缺省回退 `CharaFigure/1000000`。
6. 特效统一在 `Effect/` 根下：`ConvertTalkEffectName` 产出 `Talk/{name}`，
   再经 `CommonEffectManager.GetAssetName` 加上 `Effect/` → **`Effect/Talk/{name}`**；
   wipe 同理 → **`Effect/Wipe/{name}`**（`AnalysText` @`0x31afcd8`/`0x31afd04` 直接证明了这个拼接链）。

---

## 1. 资产命名与路径构造

### 1.1 通用字符串处理

| 函数 | VA | 行为 |
|---|---|---|
| `ScriptManager.ConvertNameString` | `0x31b1530` | 若字符串长度≥3 且首尾都是 `"`（`cmp w8,#0x22` @`0x31b1580`）则去掉首尾引号；null → `""`（`''` slot `0x5570000+0x458`） |
| `ScriptManager.ConvertCharaIndex` | `0x31b34f0` | 把 A–Z 字母串打包成 int：`w20 = (c-'A') \| (w20 << 8)`（@`0x31b3524`–`0x31b3544`）。即 `"A"`→0、`"B"`→1…多字符时后出现的字符在高位 |
| `ScriptManager.ConvertCharaIndexTalk` | `0x31b356c` | 先 `ConvertNameString`；与 `'on'`/`'off'`/`'depthOn'`/`'depthOff'`（slot `0x5577020/0x5577030/0x55c9e8/0x55c9f0`）比较，命中返回 **-1**；否则在本对象 `List`（字段 `+0x490`，元素 `+0x28` 存名字）里查找，未找到则回落到 `ConvertCharaIndex` |
| `ScriptManager.GetCharaImageNameAndFormId` | `0x31c5f4c` | `s = ConvertNameString(name)`；`i = s.IndexOf("form")`（slot `0x55bfcd8`）；`formId = int.Parse(s.Substring(i+4))`，`imageName = s.Substring(0,i)`。例：`100100form2` → (`100100`, 2) |
| `ScriptManager.GetStringWithFirstLetterChangedToUpperCase` | `0x31a0578` | 首字母大写（无字面量） |
| `ScriptManager.GetUiRootActiveHeight` | `0x31c8468` | `uiRoot`（字段 `+0x118`）非空时返回 `UIRoot.activeHeight`（`0x361de70`），否则 0 |

### 1.2 各资产类别的路径模板（实证）

| 类别 | 产出函数 (VA) | 模板 | 回退/备注 |
|---|---|---|---|
| 背景 back | `ConvertBackTextureName` `0x31b3930` | `Back/back{0:D5}`（`0x31b394c` 字面量，`0x31b39a0` `String.Format`） | 另有 `Back/back{0}`（12 处引用，如 `MyRoomBackGroundManager.GetBgImgName` `0x2622dbc`） |
| 场景(sceneSet/bScene) | `GetBackTextureNameScene` `0x31c7b28`、`SetSceneImage` `0x31b7d68` | `Back/back{0:D5}`；由 `sceneSet` 组合（`String.Split(',')` @`0x31c7b84`、`Split(':')` @`0x31c7bdc`、`Split(' ')` @`0x31c7c14`，并用 `CondType.IsQuestPhaseClear` @`0x31c7cdc` 做条件筛选） | `SetSceneImage` 里对 `"0"` 调用 `ConvertBackTextureName`（`0x31b7e88`），最终 `ExUISpriteRenderer.SetAssetImageBackFS`（`0x31b7fb0`），并有 `OnCrossFadeEndScene`（`0x31b8000`） |
| 立绘 figure | `UIStandFigureRender.GetAssetNameWithForm` `0x310c31c`、`GetAssetName` `0x31116d0` | `CharaFigure/` + (`Form/{0}/` @`0x310c34c`) + `servantId.ToString()`（`0x310c400` `String.Concat`） | 先 `AssetManager.isExistAssetStorage`(`0x2da2ba0`) 校验，失败退化 `CharaFigure/{id}`，再失败 **`CharaFigure/1000000`**（`0x310c358`） |
| 窄立绘 narrow | `UINarrowFigureRender.GetAssetName` `0x3104e1c` | `NarrowFigure/{0}`（`0x3104e3c`） | 回退 `NarrowFigure/100000`（`0x3104e30`） |
| 卡面/装备图 | `UICharaGraphRender.GetAssetName` `0x30e93c8`、`GetExCharaGraphAssetName` `0x30e9bec`、`UIEquipGraphRender.GetAssetNameList` `0x30f1b98`、`UIEquipGraphViewerRender.GetAssetNameList` `0x30f3f70` | `CharaGraph/{id}`（`0x30e93f4`）、Ex:`CharaGraph/CharaGraphEx/{id}`（`0x30e9c00`） | 回退 `CharaGraph/100000`（`0x30e93dc`）、装备回退 `CharaGraph/9400010`（`0x30f1b90`）※装备图与卡面同类别 |
| 脚本图片 image/verticalImage/horizontalImage | `UIImageRender.GetAssetNameList` `0x30fac0c`、`UIVerticalImageRender.GetAssetNameList` `0x311c594`、`UIHorizontalImageRender.GetAssetNameList` `0x30f8558` | `Image/{id}`（`0x30fac28`/`0x311c5b0`/`0x30f8568`） | 回退 `Image/00001`（`0x30fac1c` 等） |
| pictureFrame | `ConvertPictureFrameImageName` `0x31b38e4` | `Image/{0}`（`0x31b38fc` → `String.Format` `0x31b392c`） | 与图片同类别 |
| spriteMask | `ConvertSpriteMaskName` `0x31b39b4` | `Image/mask_{0}`（`0x31b39cc`） | |
| 立绘特效 talk effect | `ConvertTalkEffectName` `0x31b37c8` | `Talk/{name}`（`0x31b37e4`，去引号逻辑同 `ConvertNameString`） | 例字面量：`Talk/bit_talk_10`、`Talk/communicationCharaEffect`、`Talk/Test*` |
| wipe | `ConvertWipeName` `0x31b3a00` | `Wipe/{name}`（`0x31b3a1c`） | 例：`Wipe/cutVer` |
| 特效根（拼接证明） | `CommonEffectManager.GetAssetName` `0x30bfb78` | `String.Concat(<静态前缀>, name)`，前缀 = `Effect/`（`CommonEffectManager$$.cctor` slot `0x30c36b8`） | `AnalysText` @`0x31afcd8` 先 `ConvertWipeName` 再 @`0x31afd04` `GetAssetName` → **`Effect/Wipe/{name}`**；talk 系 → **`Effect/Talk/{name}`**（字面量 `Effect/Talk/bit_talk_10`、`Effect/Talk/communicationCharaEffect`、`Effect/Talk/GetTitleSprites/`、`Effect/SideEffect/`、`Effect/Skin/{0:D2}` 存在） |
| 插入动画 | `ConvertInsertionAnimationName` `0x31b3f20` | `InsertionAnimations/{0}/{0}`（`0x31b3f38`） | id 出现两次；`insertionAnimationSet`(`0x3188158`) 走 `AssetManager.loadAssetStorage`(`0x2da59ac`) |
| 影片 | `ConvertMovieName` `0x31b3c38`、`ConvertCRIMovieName` `0x31b3c84` | `Movie/{0}.mp4`（`0x31b3c50`）、`Movie/{0}.usm`（`0x31b3c9c`） | 另有 `Movie/ops{0:00000}.usm`（`OpeningMovieData.OnStartBootMovie` 等） |
| 字体 | `ConvertFontName` `0x31b3898` | `Font/{name}`（`0x31b38b0`） | 详见 §5 |
| 文本框 | `ConvertMessageWindowName` `0x31b3ed4` | `ScriptUI/MessageWindow/{name}`（`0x31b3eec`） | **本版本为死代码**：全库只有自身引用；实际窗口是 `ScriptMessageCommonManager` 的序列化字段（`defaultMessageWindow`、`mainPrefab`、`rubyPrefab`、`imagePrefab`、`rootPanel`） |
| 声音 SE | `SeManager.GetPathName` `0x2e911bc` | `Se/{name}`（slot `0x2e911c4`） | 本地 CRI |
| 声音 BGM/语音 | `SoundManager.CpkLoader.setupCpkAssetPath`（`Audio`/`Bgm`/`.cpk.bytes` @`0x2e9d32c/0x2e9d338/0x2e9b1c8`），`WellFired.USFGOPlayAudioEvent.GetAudioAssetPath`（`ChrVoice/`） | `Audio/{Bgm\|Se\|Voice}/{name}.cpk.bytes`、`ChrVoice/{name}` | `SoundManager.getDownloadAssetNames` 用 `Audio/`、`Audio/Bgm/` |
| 剧情脚本自身 | `GetScriptAssetName` `0x3195ce4`/`0x319c1c0` | 若 `id` 落在 `[94064512, 95064511]`：`String.Format("{0:D2}/{1:D4}", id/1000000, id/10000)`（`0x319c1f0`）否则 `String.Format("{0:D2}", id/10000)`（`0x319c1e4`）；除法用魔数 `0x431bde83>>50`(=1000000) 与 `0xd1b71759>>45`(=10000) 实现 | 与 `SCRIPT_NAME_BATTLE_BASE = "{0:D8}{1:D1}"` 等常量（`dump.cs` ScriptManager 字段）共同构成战斗脚本名 |
| 其它已确认字面量 | — | `Bg/{0}`、`Bg/10500`、`ClassCard/class_g_{0}`、`CommandSpellEffect/ef_commandspell{0:D4}`、`MasterFace/image{0:D5}`、`MasterFace/equip{0:D5}`、`MasterFigure/equip{0:D5}`、`MasterFullFigure/equip{0:D5}`、`EnemyMasterFigure/figure{0:D5}`、`EnemyMasterFace/enemyMstFace{0:d5}`、`Form/{0}/`、`ScriptAction/`、`ScriptActionEncrypt/` | `Assets/AssetStorages/`、`AssetStorages/` 为存储根；`AssetData$$.cctor`(`0x2d9ec88`) 里的示例值 `CharaFigure/`、`NarrowFigure/`、`CharaGraph/` |

> 资产目录（AssetStorage）本身是加密的 `assets/AssetStorages/Android/AssetStorage.txt`（128 字节编码），
> 见 `ScriptEncryptSettings`/`CatAndMouseGame`（`CatAndMouseGame$$GetAssetbundleKey` VA `0x2e51200`）。
> 阅读器只要按上表模板拼名字即可，无需解密。

### 1.3 资产类别清单（对阅读器实现者）

```
Back/   (背景)            Image/  (脚本图片, 含 mask_, pictureFrame)
CharaFigure/ (立绘)       NarrowFigure/ (窄立绘)
CharaGraph/  (卡面/装备图) MasterFace/ MasterFigure/ MasterFullFigure/
EnemyMasterFigure/        EnemyMasterFace/
Talk/  → Effect/Talk/     Wipe/ → Effect/Wipe/     Effect/  (其它特效)
InsertionAnimations/      Movie/                   Font/  (Fonts/* 为 UI 默认字体)
Se/  Audio/  ChrVoice/    ScriptAction/  ScriptActionEncrypt/
ScriptUI/MessageWindow/   FullScreen/FSUtilityList
```

---

## 2. 画面模型（分辨率 / 坐标 / 刘海）

### 2.1 参考分辨率

| 项 | 值 | 证据 |
|---|---|---|
| ScriptAction 渲染纹理 | **1344 × 576** | `ScriptActionSetRenderTextureComponent.ScriptActionRenderWidth/Height`（dump.cs）；1344/576 = 2.3333（21:9） |
| 刘海计算使用的参考高 | **576.0f** | `FSUtility.GetCalcOffsetX` @`0x31231c0` `mov w8,#0x44100000` |
| pictureFrame 精灵宽度 | 16:9 = **1025**，21:9 = **1346** | `ScriptManager` 静态字段 `PICTURE_FRAME_SPRITE_WIDTH_16_9/21_9`（`0x18/0x1C`），`.cctor` @`0x31c9600` 从 rodata `0xEA7A70`/`0xEA7158` 读入 |
| 截图/临时 RT | 1024 × 1024，深度 **24** bit，名字 `TempScriptActionRednerTexture` | `ScriptManager.RenderCameraInit` @`0x319f990`（`RenderTextureDescriptor(1024,1024,0,24)` @`0x319f924`，`RenderTexture.GetTemporary` @`0x319f968`，`'TempScriptActionRednerTexture'`） |
| 常量 | `DEPTH_BUFFER_BITS = 24`、`RENDER_TEXTURE_CMAERA_DEPTH_DEFAULT = 1` | ScriptManager 字段 |
| 画布推导 | 1024×576 = 16:9，1344×576 = 21:9 | 上两行 + `GETCALCOFFSETX` 公式 |

### 2.2 站位（position 参数）

`ScriptPosition.positionList`（`Vector2[7]`，`ScriptPosition..cctor` @`0x31d8f08`，值来自 rodata
`0xEA7060 / 0 / 0xEA7FD8 / 0xEA6B48 / 0xEA7E10 / 0xEA8508 / 0xEA7E18`）：

| index | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| x | **-256** | **0** | **+256** | **-438** | **-512** | **+438** | **+512** |
| y | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

`ScriptPosition.GetPosition(int index)`（`0x31d8d88`）返回 `Vector3(x, y, 0)`；
index 会被 clamp（负数→0，越界→?，`csel w19,w19,wzr,gt` @`0x31d8de8`）。
`charaOffsetList`（`Vector2[3]`）全为 (0,0)（`0x31d9018..0x31d9030`）。
`GetPosition(float x, float y)` 的重载（`0x31d8e3c`）只返回 `(0,0,0)`。

**阅读器实现要点**：position 参数 0/1/2 = 左/中/右（±256），3/5/6 是更靠边的位置（±438/±512）；
y 恒为 0，纵向对齐由立绘预制体的 pivot / `ScriptCharaData.SetPosition` 之后的层级决定。

### 2.3 刘海 / 超宽屏

常量：`FSUtility.RATIO_16_9 = 1.7777778`、`RATIO_VISTA = 2.0`、`RATIO_SCOPE = 2.3333333`
（`FSUtility..cctor` @`0x31235e0` 读 `0xEA7680`，第二值由 `mov w8,#0x40155555` 立即数写入）；
`FSUtility.SUB_MARGIN_X = 68`；`ScriptManager.FS_OFFSET_X_MARGIN = 80`；
`FSWindowUtil.windowAspectMin/Max = 1.7777778 / 2.3333333`。

```
IsUnderVista()      = Screen.w/h <= RATIO_VISTA(2.0)   (fcmp+cset ls)  @0x3122124
IsOverScope()       = Screen.w/h >  RATIO_SCOPE(2.3333333) (fcmp+cset gt, 字段 +0xC) @0x3122f88
IsCalcNotch(flag)   = None→false; Always→true; OnlySpecified→ deviceModel ∈ {iPhone18,1..4} @0x3121854
GetSafeAreaWidth()  = Screen.width - 2*min(safeArea.x, Screen.width - safeArea.w - safeArea.x) @0x3121944
GetScreenToConfigSizeRate() = configHeight / Screen.height         @0x3121998
GetNotchSubMarginX(sub) = notchW>0 ? sub*(CalculateNotchWidth()/68.0) : sub   @0x31222f8
GetOffsetX(sub=68, flag=Always) :
    if IsUnderVista() return 0
    if IsCalcNotch(flag) sub = GetNotchSubMarginX(sub)
    return GetCalcOffsetX(sub)                                    @0x31230bc
GetCalcOffsetX(sub) :                                             @0x3123180
    aspect = Screen.w / Screen.h
    m = min(aspect, 2.3333333)
    v = (m + (-1.7777778)) * 576.0 * 0.5      ; 0 @16:9 → 160 @21:9
    if (aspect < 1.7777778) v = 0.5
    return v - sub
```

`ScriptManager.GetFSCommandOffsetX(name, prefix, forceObi)`（`0x31c5b68`）：

- `forceObi && CommonUI.GetForceObi_16_9()`（`0x23ba688`）→ **0**
- `name == prefix+"FSL"`（`0x31c5c38`）→ `-ceil(GetOffsetX(80.0f))`（`frintm`/`fcvtms` @`0x31c5cb8`）
- `name == prefix+"FSR"`（`0x31c5cf4`）→ `+ceil(GetOffsetX(80.0f))`（`frintp` @`0x31c5d74`）
- 另有 `FSSideL`/`FSSideR`/`FSLNotNotch`/`FSRNotNotch`（`0x31c5d94`..`0x31c5f20`）四个变体；
  `*NotNotch` = 不做刘海补偿（对应命令 `charaPutFSRNotNotch` @`0x3177dc0`、`charaFadeinFSLNotNotch` @`0x3178cf0` 等）

**每背景 Y 偏移表**：`FSUtilityList`（资产 `FullScreen/FSUtilityList`，`FSUtility..cctor` @`0x3123568`）
含 `legacyBacks`（保持 16:9 的 Back id）、`fullScreenImages`（21:9 已适配的 Image/Back id，
`[imageSet]/[sceneSet]` 用）、`trimBackRatioY`（`<backId, offsetY>`，端末最大偏移 **±98**，中央 0）、
`legacyMovies`、`notFullScreenNpChrs`。

---

## 3. 图层 / z-order 合成

### 3.1 有数值的部分（实证）

| 项 | 值 | 证据 |
|---|---|---|
| pictureFrame 正常 z | **-10.0** | `PICTURE_FRAME_Z_POS_NORMAL`（字段 `+0x10`），`.cctor` @`0x31c9600` 读 rodata `0xEA7A70` |
| pictureFrame 顶层 z | **-230.0** | `PICTURE_FRAME_Z_POS_TOP`（字段 `+0x14`），同处 |
| 角色上限 / 表情上限 | `CHARA_MAX = 26`，`FACE_MAX = 133` | `.cctor` rodata `0xEA7150` |
| 延迟槽上限 | `DELAY_INDEX_MAX = 16` | `.cctor` @`0x31c95e8` `mov w9,#0x10` |
| 默认淡入时间 | `DEFAULT_FADE_TIME = 0.5f` | `.cctor` @`0x31c95f4` `mov w8,#0x3f000000` |
| 渲染相机深度默认 | 1（`RENDER_TEXTURE_CMAERA_DEPTH_DEFAULT`） | ScriptManager 常量 |
| `ScriptActionSetRenderTextureComponent.RenderTextureType` | `RenderTarget=0`、`Capture=1` | dump.cs 枚举 |

### 3.2 图层控制命令

| 命令 | 处理位置 | 作用 |
|---|---|---|
| `charaDepth <index> <depth>` | handler 起 `0x3183114`；`Int32.Parse` `0x31831b0`；调 `ScriptCharaData.SetDepth` `0x316f838` @`0x31831c0` | 单个角色的深度（在 ScriptAction 内部空间） |
| `charaLayer <index> sub` | `0x31829e0`；`'sub'` 比较 `0x3182a5c`；`ScriptManager.IsExistTargetSubLayerGroup` `0x31c69f8`；`ScriptSubLayerManager.RegistCharaData` `0x31dfa98` | 把角色移入子图层组 |
| `subRenderDepth <float>` | `0x3182c08`；`Single.Parse` `0x3182c34`；`ScriptSubLayerManager.SetDepth` `0x31dfadc` | 当前子图层组的整体深度 |
| `charaLayer`/`subRender*` 家族 | `ScriptSubLayer`、`ScriptSubLayerManager`（dump.cs `171209`/`171488`） | 子图层 = 独立渲染组（含 ShakeParam），可与主层分离做相机/抖动 |

`ScriptCharaData`（dump.cs `165886`）是屏幕上每个元素的载体：
`kind ∈ {FIGURE=0, EQUIP=1, IMAGE=2, VERTICAL_IMAGE=3, HORIZONTAL_IMAGE=4}`、
`state ∈ {LOAD,IDLE,MOVE,DESTROY}`、字段 `defaultDepth(0x54)`、`defaultLayer(0x5C)`，
方法 `SetDepth/RecoverDepth/SetTalkDepth/MoveAlpha/MoveAlphaSpeed` 等。
`ScriptCharaData.SetCharacter`（`0x316f718`）会调用 `ScriptManager.IsUseSimpleMeshFigure`（`0x31c82d4`）
决定用简单 mesh 还是立绘网格。

### 3.3 面板（ScriptManager 上的 UIPanel 字段）

`blockPanel(+0x40)`、`normalBlockPanel(+0x48)`、`faceBlockPanel(+0x50)`、`systemPanel(+0x60)`、
`actionPanel(+0x68)`、`renderPanel(+0x70)`。
**这些 UIPanel 的 depth 值序列化在预制体里，代码中看不到数值**，所以只能给出角色分工：

```
renderPanel   —— ScriptAction 渲染纹理（背景+立绘+特效的合成结果）
actionPanel   —— ScriptAction 动作层（角色/特效的动作与网格效果）
blockPanel / normalBlockPanel / faceBlockPanel —— 输入拦截（点击继续/自动）
systemPanel   —— 选择肢、菜单、通知等最上层 UI
```

图中合成的经验顺序（**部分推断**）：
`背景(backSprite1/2 交叉淡入) → 立绘(按 charaDepth) → 前景特效(backEffect 在角色之后、effect 在角色之前、fowardEffect 覆盖全屏)
→ pictureFrame(normal z=-10 / top z=-230) → 消息窗口(rootPanel) → wipe/flash/mask/mesh 过渡 → 选择肢/系统 UI`。

---

## 4. 脚本命令 → 画面元素

命令名对应关系由 `il2cpp_out/command_cmp.json`（`tools/extract_commands.py`：在
`ScriptCommandExecute` 中跟踪 `mov x0,<tag寄存器>` + `bl String.op_Equality`）给出比较点，
处理体 = 比较指令之后紧接的代码；下表调用证据来自 `tools/handler.py`（annotate 版反汇编）。

| 命令 | 比较点 VA | 主要调用 | 屏幕结果 | 置信度 |
|---|---|---|---|---|
| `charaChange` | `0x317ec8c` | `ConvertCharaIndex` `0x31b34f0`、`ScriptCharaData.IsLoad` `0x316f36c`、`ConvertNameString`、`Contains("form")` `0x317ee04`、`GetCharaImageNameAndFormId` `0x31c5f4c`、`UIStandFigureRender.GetAssetName` `0x3111a14`、`Single.Parse` | 替换指定槽位的立绘（`CharaFigure/[Form/f/]id`），带换装/速度参数 | 调用链实证，参数顺序推断 |
| `charaSet` / `charaPut` | `0x3186fcc`（x23 侧） | `ConvertCharaIndex`、`IsLoad`/`Destroy` `0x316f98c`、`Int32.TryParse` `0x49d35d8`、`DataManager.GetMaster` `0x388b208`、`TryGetEntity` `0x3f48494`、`UserGameMaster.TryGetSelfUserGame` `0x30243a4` | 把立绘/装备/图片放入槽位（含从 master 数据解析 servant id） | 调用链实证 |
| `imageSet` / `verticalImageSet` / `horizontalImageSet` / `master*ImageSet` / `imageChange` / `imageChange`(`masterImageChange`) | `0x3189734` / `0x318db3c` / `0x318f638` / `0x318d6e8` / `0x318ed20` / `0x3191c34` / `0x317fe0c` | `ConvertCharaIndex`、`IsLoad`、`Int32.Parse`、`ScriptCharaData.SetPosition` `0x316fbcc`、`GetFSCommandOffsetX('charaFadein')` `0x3189840`、递归 `ScriptCommandExecute` `0x3193f9c` | 载入 `Image/{id}` 到槽位（kind = IMAGE / VERTICAL_IMAGE / HORIZONTAL_IMAGE），位置/缩放由参数控制 | 种类由 `ScriptCharaData.Kind` 实证；参数顺序推断 |
| `figureSet` / `figureChange` | 字面量 `0x317879c`；`equipSet` `0x31870c8` | `UIStandFigureRender.GetAssetName`、`UIEquipGraphRender.GetAssetNameList` `0x30f1b98` | 立绘 = `CharaFigure/[Form/f/]id`；装备图 = `CharaGraph/{equipId}` | 资产命名实证 |
| `sceneSet` / `scene` / `bScene` / `masterScene` | `0x318bb40` / `0x3180e08` / `0x317c58c` / `0x3180a24` | `sceneSet`: `ConvertBackTextureName` `0x31b3930`、`isExistAssetStorage`、`ScriptPosition.GetPosition`、`ScriptCharaData.SetPosition`、`Dictionary.GetEnumerator`；`scene`: `MoveAlphaSpeed` `0x316fd84`；`masterScene`: `0x201a774`、`SingletonMonoBehaviour.get_Instance` | 背景贴图槽（`Back/back{0:D5}`），支持交叉淡入；`bScene`=背景场景，`masterScene`=主人公场景 | 调用链实证 |
| `sceneLoad` / `bSceneLoad`（背景载入） | 载入链在 `0x318dde8..0x318de30`；`'bSceneLoad'` 字面量比较点 `0x318de38` | `GetBackTextureNameScene` `0x31c7b28` → `SetbSceneParam` `0x31c7d6c` → `IsNormalPlaySpeed` `0x31b5324` → `SetSceneImage` `0x31b7d68` | 按脚本给出的场景参数（可带 `questId:phase` 条件）选择 `Back/back{0:D5}` 并铺到 backSprite1/2 | 调用链实证（命令归属：`SetbSceneParam` 全库仅此一处调用） |
| bScene 的参数（`page2`/`page3`） | `SetbSceneParam` `0x31c7d6c` | `String.Split` `0x31c7dc4/0x31c7df4`、`Single.TryParse/Parse` `0x31c7e38`、`str s0,[x21]` `0x31c7e50`、`Type.GetTypeFromHandle` `0x31c7e6c`、`Enum.Parse` `0x31c7ef8`、字面量 `'page3'`（`0x31c7f10`，同族 `'page2'`） | bScene 是**多页背景**对象：参数拆成浮点值 + 页名字段（page2/page3…）后经反射写入 | 实证 |
| `clear` | `0x318202c` | `'messageShake'` 比较、`Single.Parse` ×3、`IsFastPlaySpeed` | 清空屏幕（角色/图片/背景），参数为淡出时间 | 部分实证 |
| `pictureFrame` / `pictureFrameTop` / `pictureFrameLoad` | `0x317e828` / `0x318c040` | `pictureFrameTop`: `ConvertNameString` `0x318c068` → `SetPictureFrameImage` `0x31b7bbc` @`0x318c07c`；清理走 `ClearPictureFrameImage` `0x31b7b3c`（`0x31914f4`）；z = `PICTURE_FRAME_Z_POS_NORMAL(-10)` / `TOP(-230)` | 装饰画框（`Image/{name}`），普通模式在角色之下、Top 模式用更小的 z（-230，即更靠前） | 实证（top 链）；normal 的 z 由常量实证，命令归属推断 |
| `charaCut` / `charaCutout` / `charaCutin` | `0x3193088` / `0x317dc7c` / `0x31855e8` | `ScriptCharaData.SetCutout` `0x3170578`、`CharaCutEffectComponent.CutinStart`、`CharaWipeEffectComponent.WipeStart`（`Wipe/`）、`CharaFlashEffectComponent.FlashStart`、`CharaErasureEffectComponent.ErasureStart`（`Talk/`） | 立绘被切/擦除/闪现/入场，全部是立绘网格的 shader 效果（`Custom/Sprite-ScriptActionFigureCut/Erasure/Flash/Wipe`） | 部分实证 |
| `backEffect` / `backEffectStart` / `backEffectStop|Destroy|Pause` | `0x317c3a8` / `0x3182464` | `ConvertTalkEffectName` `0x31b37c8`、`CommonEffectManager.Resume` `0x30c1738` | 角色**后面**的特效 → `Effect/Talk/{name}` | 部分实证 |
| `effect` / `effectStart` / `effectStop` / `effectPause` / `effectDestroy` | `0x3180b60` / `0x317cc98` | `ConvertTalkEffectName`、`GetEffectParameter` `0x31b8248`、`Contains("bit_shot_")`、`CommonEffectLoadComponent.LoadEndHandler..ctor` `0x30b7ae4` | 角色**前面**的特效 → `Effect/Talk/{name}` | 部分实证 |
| `fowardEffect` / `fowardEffectStart` / `fowardEffectStop|Destroy|Pause` | `0x3181400` | `ConvertTalkEffectName`、`'capture'` 比较 `0x318144c`、`Camera.get_targetTexture` `0x4f99b70`、`ScriptMessageCommonManager.OffScreen/ClearText`、`ScriptLogMessage.ReturnText` | 全屏 overlay 特效；可抓取当前相机构图作为贴图并隐藏文本框 | 部分实证 |
| `communicationChara` / `…Stop|Loop|Clear|Face` | `0x317ef00` | `Int32.Parse` ×2、`String.get_Chars`、`ScriptPosition.GetPosition` `0x31d8e3c` | 羁绊/通讯角色横幅；位置来自 `ScriptPosition`，特效 `Talk/communicationCharaEffect` | 部分实证 |
| `insertionAnimationSet` / `…Start` / `…End` | `0x3188158` / `0x3180d00` | `ConvertInsertionAnimationName` `0x31b3f20`、`AssetLoader.LoadEndDataHandler..ctor`、`AssetManager.loadAssetStorage`、`GameObject.Find`、`EventPlayAnimationInsertionComponent.ChangeAnimationSprite/PlayAnimation` | 插入动画 `InsertionAnimations/{id}/{id}` 放进场景 | 部分实证 |
| `masterBranch` / `masterImageChange` / `masterChange` | `0x3179ba8` / `0x317fe0c` / `0x3187c10` | `masterBranch`: 递归 `ScriptCommandExecute` `0x3193f9c`（对主人公槽执行一条嵌套命令）；`masterChange`: `ConvertCharaIndex`、`IsLoad`、`Int32.Parse`、`Single.Parse` | 针对主人公（master）伪槽位的分支/换图/换人 | 部分实证 |
| `messageStart` / `talkStart` / `talkEnd` / `talkName` / `messageOn` / `messageOff` / `messageChange` / `fontSize` / `fontType` | `0x317f97c` / `0x3182bb8` / `0x3187be4` / `0x31795e8`(fontType) / `0x3187914`(fontSize) | `ScriptMessageCommonManager.CalcMessageVerticalAlign` `0x31d295c`、`ConvertCharaIndexTalk` `0x31b356c`、`ConvertFontName`、`UILabel.get_trueTypeFont` `0x36276a4` | 文本框开/关、说话人名牌、字体与字号、行距 | 部分实证 |
| `capture` / `captureRelease` | `0x3181448` | `Camera.get_targetTexture`、`Object.op_Equality` | 冻结当前剧情相机构图供后续贴图使用 | 部分实证 |
| `criMovie`（movie） | `0x3183c24` | `ConvertCRIMovieName` → `Movie/{0}.usm`、`PlayCRIMovie` `0x31bbe00` | 全屏 CRI Sofdec 影片 | 命名实证 |
| `fontType` | `0x31795e8` | `IsNullOrEmpty`、`op_Inequality('normal')`、`ConvertFontName` `0x31b3898`、`AssetManager.getAssetStorage` `0x2da6474`、`AssetData.GetObject` `0x3806f00`、`GameObject.GetComponent` `0x38ebe30`、`UILabel.get_trueTypeFont` `0x36276a4` | 切换消息字体为 `Font/{name}`；`normal` 恢复默认 | **实证** |
| `advSet` / `advActorShow|Hide|Prepare|Release|PlayAnimator` | 文本 `adv*` 字面量在 `ScriptManager$$.cctor` | `ScriptActionAdvPrefab*`（dump.cs `164799+`） | 在场景里显示/驱动任意预制体（adv prefab actor） | 未深入 |

> 说明：`bg`、`char` 这两个“老命令名”在 v2.139.3 的调度器中**不存在**——`ScriptCommandExecute` 的
> 字符串字面量集合（`il2cpp_out/dispatcher_strings_uniq.json`，556 条）里没有 `bg`/`char`，
> 它们只出现在与剧情无关的类中（如 `BattlePerformanceBg`、`System.Xml`）。本版本的对应命令是
> `imageSet` / `sceneSet` / `charaSet` / `bScene` / `masterScene` 等。
> 调度器是一个“巨型 if-else 链”：比较点在 `command_cmp.json` 中分为 `commands`（与 tag 寄存器比较）
> 与 `param_values`（与参数 token 比较），因此 `charaSet`/`imageSet`/`sceneSet` 等被归入后者；
> 处理体紧跟其后（例如 `charaDepth` → `ScriptCharaData.SetDepth`、`subRenderDepth` →
> `ScriptSubLayerManager.SetDepth`，这两个是完整可验证的）。

> **位置 / 大小 / 透明度 / 旋转参数**：位置来自 `ScriptPosition.GetPosition`（0..6，§2.2）或
> `ScriptCharaData.SetPosition(x,y)`；缩放走 `ScriptCharaData.SetScale`（`0x316fbfc`）/`SetFullScreenScaleType`
> （`0x316fc14`），对应命令 `charaScale`/`charaMoveScale`/`charaMoveScaleEase`（均在调度器字面量表中）；
> 透明度走 `SetAlpha`（`0x316fc58`）/`MoveAlpha`/`MoveAlphaSpeed`（命令 `charaFadein|out`、`scene`）；
> 旋转走 `charaRoll`/`charaRollAxis`/`charaRollMove`/`charaRollMoveEx`（`charaRollAxisLoopStop` 等，
> 同样在调度器字面量表中，对应 `SetCameraRoll`/`StartCameraRoll` 一族 `0x31b97b8..0x31b9c20`）。

---

## 5. 字体与文本渲染

### 5.1 字体资产

- `[fontType <name>]` → `Font/{name}`（`ConvertFontName` `0x31b3898`），
  `normal` 特判（`op_Inequality('normal')` `0x3179648`）恢复默认；加载后取
  `UILabel.get_trueTypeFont`（`0x36276a4`）——**文本框用的是 NGUI `UILabel` + TrueTypeFont，不是 TextMeshPro**
  （TMP 只出现在 `Libs/TextMeshPro` 的内部字符串里）。
- UI 默认字体字面量：`Fonts/FGO-Main-Font`（`UILabel.Awake` `0x362ca5c`、`UILabel.SetDefaultFont` `0x362cc94`）、
  `Fonts/FGO-NumberFont-02`、`Fonts/TextAtlas1`、`Fonts/TextAtlas3`、`Fonts/BitmapFontProperties`
  （`AppendBitmapFont$$.cctor` `0x35bad44`）。
- `ScriptManager.CheckFontData`（`0x31b11a8`）：比较/去重后 `List.AddWithResize`，
  再 `AssetManager.isNeedDownload`（`0x2da4bac`）判断是否需下载 —— 字体走 AssetStorage 下载流程。

### 5.2 消息文本结构（ScriptMessageCommonManager）

字段（dump.cs `169609`）：`rootPanel(UIPanel)`、`mainPrefab`、`rubyPrefab`、`imagePrefab`、
`rootObject`、`messageBase`、`messageShake`、`defaultMessageWindow(ScriptMessageWindow)`、
`talkNameManager(ScriptLineMessage)`、`touchPress`、`backLogButton`、`autoMessageButton`、
`nextTouchRootObject`、`defaultScrollTime/fastScrollTime`、`defaultKeyDelayTime`、`defaultStepTime`、
`defaultBetweenLineHeight`、`defaultAllDispSize/Center`、`windowUpCurve/windowDownCurve`
→ 说明一行文本 = 若干 `mainPrefab`（文字）+ `rubyPrefab`（注音）+ `imagePrefab`（行内图）实例，
由 `UILabel` 逐个排布。

### 5.3 文本标记（由字面量实证）

`AnalysScript`（`0x31a50ec`）负责把脚本行分类，`AnalysText`（`0x31a920c`）负责按命令收集资产名，
`AnalysParam`（`0x31a7688`）用 `'='`/`' '`/`','` 切分参数（`0x31a7718/0x31a7724/0x31a7730`）。

脚本文本内的标记（字面量 + 使用点）：

| 标记 | 证据 |
|---|---|
| `#` 注释行 | `0x31a5250` |
| `[#RRGGBB]` 颜色 / `[-]` 结束颜色 | `'[#'` `0x31a5370`；示例串 `'[#[FF0000]主[-]人公:しゅじんこう]はぐだぐだな主人公'` |
| 注音 ruby：`[漢字:かんじ]`（颜色可与 ruby 嵌套） | 同上示例字符串（`rubyPrefab` 字段） |
| `[r]` 换行 | `0x31a53e8`；字面量 `'[r][r]'`（段落换行） |
| `[=...]` | `'[='` `0x31a53c4`；`'[=]'` |
| `]` 标记结束 | `0x31a5418` |
| `%`、`&` 转义/替换相关 | `'%'` `0x31a5334`、`'&'` `0x31a537c` |
| 参数键：`page` / `line` / `talkStart` / `talkEnd` / `messageStart` / `talkName` / `fontSize` / `image` / `betweenHeight` / `font` | `0x31a5394`/`0x31a53a0`/`0x31a53ac`/`0x31a534c`/`0x31a5388`/`0x31a53f4`/`0x31a53d0`/`0x31a53dc`/`0x31a5430`/`0x31a5268` |
| 控制行关键字：`menu`/`input`/`notification`/`branch`/`selectBranch`/`switchCase`/`switchCaseEnd`/`label`/`selectionUse`/`Loop`/`tRoute` | `0x31a525c`/`0x31a5274`/`0x31a52ec`/`0x31a52d4`/`0x31a5328`/`0x31a543c`/`0x31a5364`/`0x31a5358`/`0x31a5310`/`0x31a5448`；正则 `'\\[tRoute (?<id>[0-9]+) (?<text>.+)\\]'` @`0x31a47c0` |
| 单字符前缀 `l `/`r `/`f `/`i`/`f`/`k`/`q`/`s` | `0x31a52e0`/`0x31a5304`/`0x31a531c`/`0x31a528c`/`0x31a52b0`/`0x31a52bc`/`0x31a52f8`/`0x31a52b8` |
| 自动等待标记 | `AUTO_WAIT_TAG_FORMAT = "[wait skippableTime {0:F2}]"`（ScriptManager 常量） |
| 全屏标记 | `[enableFullScreen]`（`0x31912716` 命令） |
| 名称分隔符 | `'・ '` `0x31a5424` |

正文替换：`ScriptReplaceString`（`USER_NAME = 1`）+ `ScriptManager.GetReplacedText`（`0x31c601c`）、
`ReplaceHiddenFlagText`（`0x31c8220`）、`TextOverwriteRoute`（`0x31c6e9c`）、
`TextOverwriteFlag`（`0x31c72e8`）、`TextOverwriteRaidShortName`（`0x31c75f4`）。

---

## 6. 次要 API（阅读器实现相关）

| API | VA | 行为（证据） |
|---|---|---|
| `ScriptManager.GetUiRootActiveHeight` | `0x31c8468` | `uiRoot(+0x118)` 非空 → `UIRoot.activeHeight`（`0x361de70`）；否则 0。可用于把 0.0–1.0 的相对坐标换算成像素 |
| `ScriptManager.IsUseSimpleMeshFigure(servantId)` | `0x31c82d4` | 取单例（slot `0x5578758`，未解析）→ 其字段 `+0x788` 的 `List.Contains`（`0x44c8790`）；即“该从者是否使用简化网格立绘”的名单。名单本身是序列化数据，代码里无字面量 |
| `ScriptManager.CheckAssetData` / `CheckAssetDataList` | `0x31b1364` / `0x31b14c8` | 遍历脚本收集的资产名，去重后 `AssetManager.isNeedDownload`（`0x2da4bac`）→ 需要下载的加入列表（`List.AddWithResize` `0x31b12b0`）。**这就是“脚本 → 资产集”的判定点** |
| `ScriptManager.CheckAudioData` | `0x31b0f80` | 同上，但音频名先经 `SoundManager.getAssetName`（`0x2e9b28c`）分类 |
| `SoundManager.getAssetName(name)` | `0x2e9b28c` | `name.StartsWith("ba")`（`0x4870d34`，字面量 `'ba'` `0x2e9b2a8`）→ 返回 `"Battle"`（`0x2e9b2b4`）否则 null。音效资产 = `Audio/{Bgm\|Se\|Voice\|Battle}/{name}.cpk.bytes` |
| `ScriptManager.AddSwitchCaseAsset` | `0x31a90e4` | `String.Split`（`0x31a913c`/`0x31a9188`）→ `ConvertNameString` ×2 → `SoundManager.getAssetName` → `CheckAudioData`：`switchCase` 可以携带需要预载的音效名 |
| `ScriptManager.StartLoadAnimationAssetData` / `StartLoadUIAssetData` / `StartLoadAudioAssetData` | `0x31a8824` / `0x31a8920` / `0x31a8a1c` | 把上一步收集的动画/UI/音频列表交给 AssetManager 异步加载（`0x31a8908` → `0x2da60c0`） |
| `ScriptManager.AnalysText` | `0x31a920c` | 命令名 switch → 收集资产名（例：wipe 命令在 `0x31afcd8` 调 `ConvertWipeName`、`0x31afd04` 调 `CommonEffectManager.GetAssetName`；`0x31afd04` 同族还有立绘/图片分支） |

---

## 7. 未能确定的部分

1. `*Set` 家族命令的**精确参数顺序**：调度器是巨型条件链，参数 token 解析与命令分支交织，
   只能从调用序列推断（`ConvertCharaIndex` → id/form → 位置 → 透明度 → 速度…）。
2. 各 UIPanel（block/action/render/system）的 depth 数值不在代码里（序列化在预制体），
   因此“图层顺序”只能给出角色分工 + 经验顺序。
3. pictureFrame 与角色、前景特效之间的**精确 z 值**只拿到 `-10 / -230`（pictureFrame 内部空间），
   角色深度靠 `charaDepth` / ScriptAction 预制体默认值，未找到默认值常量。
4. 角色默认深度/图层来源：`ScriptCharaData.defaultDepth/defaultLayer`（`+0x54`/`+0x5C`）由谁赋值未追（应为预制体上的组件）。
5. `bg`/`char` 命令在本版本不存在（只能由 `imageSet`/`sceneSet`/`charaSet` 等代替）；
   若阅读器需兼容旧脚本格式，需要另行实现老命令到新命令的映射。
6. `adv*`（Advanced prefab actor）命令族未深入。

---

## 附录 A：验证方法与工具

| 工具 | 用途 |
|---|---|
| `tools/resolve_strings.py` | `So()`：ELF 段读写、`slot2str`（metadata-usage slot VA → 字面量）、方法表 |
| `tools/annotate_func.py` | 反汇编并解析字面量/call（含调用参数中的字面量） |
| `tools/build_lit_index.py` | 全代码段扫描 `adrp xN,page ; ldr xN,[xN,#off]` → `il2cpp_out/lit_methods.json`（字面量 → 引用它的方法） |
| `tools/litq.py` / `litgrep.py` / `litfilter.py` | 按正则在 27043 条字面量 / 反向索引里检索 |
| `tools/handler.py` | 打印某个脚本命令处理体的注解反汇编 |
| `tools/extract_commands.py` + `il2cpp_out/command_cmp.json` | 调度器内命令名比较点/处理器位置表 |

### 关键坑（供后续复现）

1. **代码在 `il2cpp` 段（`0x2321aa4..0x5311320`），不是 `.text`（`0x2015070..0x2321aa4`）**；
   只扫 `.text` 会得到 0 命中。
2. **AArch64 ADRP 是 PC 相对**：`page = (pc & ~0xFFF) + (sign_extend(immhi:immlo,21) << 12)`；
   用绝对页去编码 `adrp` 会永远匹配不到（本仓库 `find_lit_index` 已按正确语义实现）。
3. 字面量槽在 `.got`/`.data`（如 `0x55aad68`），槽内容指向 `.data` 里的字符串对象
   （`stringliteral.json` 的 address）；直接读 `.data` 里那些对象拿到的是指针而不是文本。
4. 线性反汇编会在跳转表附近失步；反向索引使用「精确指令编码匹配」规避了这个问题。

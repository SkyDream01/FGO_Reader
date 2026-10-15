# 部分实现项(22 行)收口证据 —— adv-unrestored.md「已有基础路径，但没有完整还原」

对象：FGO Android 2.139.3 / IL2CPP arm64，`work/extract/lib/arm64-v8a/libil2cpp.so`。
本文对 `adv-unrestored.md`「已有基础路径，但没有完整还原」表的 **22 行**逐项给出：当前实现 → 缺口 → 原生机制与证据(VA) → 收口步骤 → 置信度。
约定：VA = ELF 虚拟地址；命令 handler 均在 `ScriptManager$$ScriptCommandExecute 0x3177290..0x319402c` 内；字段偏移与类体取自 `work/il2cpp_out/dump.cs`(ScriptManager TypeDefIndex 4870)。
证据分级：**【实证】**=本次反汇编/字面量直证（含对既有文档结论的复核）；**【引用】**=既有文档已给结论（注明来源与其中 VA）；**【推断】**=由调用链/语法推断。
本次复核使用的语料计数：`work/coverage/tag_counts.json`(2583 文件 / 1,867,761 行)。

> 本文新增复证(可直接改写既有文档的 5 条硬结论，正文各处展开)：
> 1. `imageSet` 第 3 参 = `ScriptCharaData.SetPosition` 的**站位下标**；第 4 参 = `SetFullScreenScaleType` 的类型值（既有 INFERRED 已闭环，见 §5）。
> 2. `blur lens|motion|glass` 分别 = 相机滤镜 `GaussianBlur`/`MotionBlur`/`FrostedGlass`；`subBlur` 用 `*Through` 版本（见 §2）。
> 3. FSL/FSR/FSSideL/R/NotNotch 的**精确公式**（FSSide 用 `GetForceOffsetX(0)`，即不做 Vista 门控、不加 80 边距；见 §7）。
> 4. `skip`/`tapSkip`/`autoAndBackLog`/`backlogStart|End` 的字段级语义（`isSkip 0x377`/`tapSkipLabel 0x380`/`tapSkipFade 0x388`/`isBackLog 0x391`/`isBacklogOnly 0x392`/`hideAutoMessageButton 0x3A1`/`hideBackLogButton 0x3A2`；见 §13）。
> 5. `charaTalk on/off/depthOn/depthOff` = `SetTalkName`(0x31b744c) 写 `isTalkMask 0x3B1`/`isTalkDepth 0x3B2`/`talkMaskName 0x3B8`，随后按 `charaList` 逐角色 `SetTalkMask(bool)`(+`SetTalkDepth()`)（见 §9）。

---

## 1. 划像与遮罩转场（wipein/out、wipeFilter/Ex、maskin/out）

**当前实现**（adv-unrestored.md）：划像用几类 CSS clip-path；mask 作为全屏颜色淡变；无原始 Wipe prefab/网格/纹理/shader；level 等参数未完整使用。

**缺口**：① 每个 wipe 名的纹理资产与 shader；② `_Gradation`=level 的等效（当前用 clip-path 几何模拟，语义不同）；③ `wipeFilter` 为"持续滤镜"（isWipeFilter 常驻）与一次性 wipe 的差别；④ Ex 形态（cutVer 5 段网格 + cvcenter/cvcentersize/cvleft/cvright）；⑤ mask 的 black/white Kind 与 in/out 方向。

**原生机制与证据**
- 【引用】presentation.md §3.2：`StartWipe` 0x31bae90（写 wipeName/wipeLevel/cv 参数后 `AssetManager.loadAssetStorage`）、`SetWipeFilter` 0x31bb07c（唯一区别 `isWipeFilter 0x5AA=1`）、`EndLoadWipe` 0x31bb1d4；`'Wipe/cutVer'` + cv 任一非 0 → `ExUIUserMeshRenderer(0xE0).SetUserMesh(GetHorizontal5Split,GetHorizontal5SplitUv,wipeExCutVarTriangles)`、`exWipeType=1`；否则 `ExUIMeshRenderer(0xD8).SetImage`；材质属性 `'_Gradation'`=wipeLevel；`duration>0` → `TweenRenderVolume.Begin(go,from,to,duration)`，from/to 由 `isWipeIn(0x5AB)` 决定(0x31bb51c/0x31bb548 两条 fcsel)。`GetHorizontal5SplitUv` 0x31bb60c 固定 12 元素 UV（左右各内缩 1/512，基准宽 512）；`GetHorizontal5Split` 0x31bb734 以 0.5 为中心 `Math.Max(0,·)` 生成 12 顶点。
- 【实证】本次复核：`'_Gradation'` 的脚本侧唯一写点 = `ScriptManager$$EndLoadWipe`(0x31bb220)；语料侧 `wipein/wipeout` 3,103/3,123 次、`wipeFilter` 250、`wipeOff` 215、`wipeinEx/wipeoutEx/wipeFilterEx` 0 次；名字取值域 45 个（supplement-presentation-composition.md §C.1，如 rectangleStripLeftToRight 1002、leftToRight 701、openEye 600、circleIn 325）；level 域 1.0/1/0.5/…；`wipeFilter cinema` 第 3 参恒 0(216 次)。
- 【引用】presentation.md §3.3：`StartMask(name,isIn,duration)` 0x31bbc10：`maskin` → `CommonUI.Instance.maskFadein(duration)`；否则 `'clear'` → 依次 `InitEffect/InitFlashCommand/InitFlashDepCommand/InitWipe/InitFade` 且 `maskOnWhileJumping(0x40C)=false`；`'black'` → `maskFadeout(1,duration)`、`'white'` → `maskFadeout(2,duration)`（1/2 = `MaskFade.Kind.BLACK/WHITE`，`GetFadeoutType` 0x31b40d0）。语料 `maskin black|white`=119/37，`maskout`=36/37。
- 【实证】`#MASK` 在二进制中**无字面量**（`tools/find_literal_refs.py '#MASK'` 0 命中），它是普通 `#` 前缀子层键，语义见 §3。

**收口步骤**
1. wipe 数据模型（可完整实现，纯逻辑部分）：`{name, isIn, duration, level, cv[4], isFilter, isEx}`；行解析按【引用】参数表（pd[0] 名、pd[2] 时长、pd[4] level、Ex 的 pd[6..12]→cvcenter/cvcentersize/cvleft/cvright）。
2. 渲染等效：全屏 quad 贴 `Wipe/<name>` 图 + uniform `_Gradation`=level；`isIn==0/1` 决定 from→to（0↔level，方向与 tag 的对应在 presentation.md 仍是【推断】，实机对拍一次即可钉死）。CSS 版可用 mask-image + 灰度进度近似，但 cutVer 类程序化划像必须走 5 段网格(需资源)。
3. cutVer（需资源）：实现 5 段横向切分的顶点生成（`GetHorizontal5Split` 公式）与固定 UV（12 元素、1/512 内缩），再按 cv* 变形。
4. mask（可完整实现）：全屏单色 quad，`maskin`=淡入显示遮罩（保持），`maskout black|white`=按 Kind 淡出；`clear`=取消全部转场（含 wipe/fade/flash 的 Init 系列）。
5. Wipe 纹理 + shader（Gradation 混合）与 ExUIUserMeshRenderer 等价物 → 需资源。

**置信度**：机制 high（presentation + 本次 `_Gradation`/`#MASK` 复核）；`isIn` 方向映射 medium（未逐 tag 验证）；wipe 纹理与 shader = 需资源。

---

## 2. 滤镜和模糊（cameraFilter、subCameraFilter、blur、subBlur/subBlur2）

**当前实现**：仅 gray/inversion/darkred 等 CSS 滤镜 + 统一 CSS blur；镜头/运动/玻璃模糊、aberration、maskEdge 及参数未等效。

**缺口**：blur 三族关键字与参数位；subBlur 的"Through"版本；cameraFilter 的 16 float 参数矩阵落地；subCameraFilter 的 maskEdge/mask/#MASK 合成。

**原生机制与证据**
- 【引用】presentation.md §4.2：`SetCameraFilter(Material,string,float[16])` 0x31a0304：`""/normal`→`Shader.Find("Custom/Sprite-ScriptActionRender")`；其他 → `"Custom/Sprite-ScriptActionRender"+UpperFirst(name)`；`Material.SetMatrix("_FilterParam", 4x4)`。`charaFilter` 见 §10。
- 【实证】`blur` 命令（handler 0x3181f20；前置 `[x19,#0x5E0]`=renderEffectController 且 `isEnable(0x30)==0` 才走 start 路径）：
  - `blur lens <sec> <int> <float>`（pd 长度恰 7）：`SetCameraFilter("GaussianBlur")`（0x318e220，字面量槽 0x55ca038='GaussianBlur'）→ `renderEffectController.SetGaussianBlur`（0x318e280，参 pd[4] Int32、pd[6] Single；0x318e2c8 再按 pd[2] Single 计时长/插值）。
  - `blur motion …`（pd 长度恰 15 = 8 token）：`SetCameraFilter("MotionBlur")`（0x318fe54-0x318fe6c）。
  - `blur glass …`（pd 长度恰 13 = 7 token）：`SetCameraFilter("FrostedGlass")`（0x31918ac-0x31918c4，字面量槽 0x55ca270='FrostedGlass'，本次 `resolve_strings.slot2str` 复核）。
  - 名称域与次数：`lens 285 / motion 235 / glass 1`（supplement-presentation-composition.md §C.3）；语料 8 参形态 231 次即 motion 形态。
  - `blurOff`：`'lens'` 关键字 + `Single.Parse(sec)` + `StopGaussianBlur`（presentation.md §4.3，handler 0x3187994）。
- 【实证】`subBlur`/`subBlur2`（同 handler 0x3180674，共用体）：`#key lens …`（pd 长度恰 13）→ `SetCameraFilter(subLayer.meshRender(0x70).material, "GaussianBlurThrough")`（0x318cc98/0x318cca8）；`motion` → `"MotionBlurThrough"`（0x318e3c4）。即"对子层 RT 做模糊直通"。
- 【引用】supplement-presentation-composition.md §C.3 + §D.2：`subCameraFilter` 参数域 第 2 参 `maskEdge 1290/normal 336/through 248/mask 28/…`；第 3 参 `cut359_mask01..42`(32 种) + `#MASK`(14)；第 5 参 RGB(A)；材料属性 `_FilterParam`/`_Color` 由 `ScriptSubLayerManager$$RenderingSubLayer`(0x31defd0/0x31defdc) 写入；`through` 是 `RenderCameraInit`(0x319f9d0) 里的"相机直通"模式名。`cameraFilter aberration` 的 shader 名不在字符串表 → 在资产内（§C.3）。
- 【实证】`distortionstart` 6 float：`<sec> <count> <centerX%> <centerY%> <strength> <range>`（§C.3 语料域），背后是 `ScriptActionRenderEffectController.StartDistortion`（presentation.md §4.3）。

**收口步骤**
1. 滤镜统一模型（可完整实现）：`{filterName, paramsFloat[16], color}` → 渲染层映射；无 shader 时保留现 CSS 降级并写诊断。gray/inversion/darkred 之外新增 `aberration`（色差：CSS 可用三层 RGB 平移近似）。
2. blur 三族（逻辑可完整实现，视觉质量需资源）：`lens`→屏幕高斯/景深(参数 sec/int/float)、`motion`→运动模糊(8 参)、`glass`→玻璃模糊(7 参)；参数顺序里 lens 已实证 pd[2]/pd[4]/pd[6] 分别为时长/int/float，motion/glass 的逐位对应仍待回读（medium）。
3. subBlur/subBlur2（可完整实现）：对子层容器施加同类滤镜（CSS 版即对该层加 `filter: blur`，强度取"scale"位），Off 版本停止。
4. subCameraFilter 的 `maskEdge`（需资源）：需要 mask 纹理（cut359_mask* 系列）或 `#MASK` 组 RT 作合成纹理，按 `_FilterParam` 采样 —— 与 §3 的子层合成一起做。
5. 需要的资源：`Custom/Sprite-ScriptActionRender*` 系列 shader（资产内）、cut359_mask* 纹理。

**置信度**：blur 三关键字与 shader 名 = high（本次逐指令+字面量反解）；subBlur lens/motion = high（subBlur2 共用体为推断）；参数逐位 medium；maskEdge 合成公式 low（需资源）。

---

## 3. 子层遮罩和精确合成（subCameraFilter…#MASK、subCameraOn、subRenderDepth）

**当前实现**：组间 `#MASK` 纹理合成未实现；数字子层数没有完整消费；DOM z-index 替代原相机/UIPanel/RenderTexture 栈，原始默认深度仍有缺口。

**缺口**：① `#MASK` 组作为"遮罩纹理"参与其它组合成的路径；② `subCameraOn <n>` 的语义落地（建几组）；③ `subRenderDepth` 的深度域与默认值；④ 组前缀键与字符数据的挂接（charaLayer）。

**原生机制与证据**
- 【引用】supplement-presentation-composition.md §D.2：`IsExistTargetSubLayerGroup` 0x31c69f8 用 `pd[0].StartsWith('#')` 判定子层键；默认组名 `'#A'`（`GetSubLayer` 0x31df7d4）；`ScriptSubLayer.SetMaskLayer` 0x31ddc60 写 `SubLayerMask` 字段(0xB0)；`#MASK` 语料 44 次（charaLayer 29 / subCameraFilter 14 / subRenderDepth 1）。（本次复核：`#MASK` 无字面量，0 命中。）
- 【实证】`subCameraOn`（handler 0x318339c）：`pd[0]`→`Int32.Parse` → `ScriptManager.RenderCameraSubStart(0x31a00e8)(count)`（0x318b128）；**无参时默认 1**（0x318b11c `mov w1,#1`）。语料 908 次，n∈{1,2,3,4}（supplement §A.1 → 组上限 4，与 `#A..#D` 对应，【推断】）。
- 【实证】`subRenderDepth`（handler 0x3182c14）：`#key` + 深度 float → `ScriptSubLayerManager.SetDepth(0x31dfadc)`（presentation.md §7.3 同）。语料深度值 1..5（supplement §A.7）；相机深度默认 `RENDER_TEXTURE_CMAERA_DEPTH_DEFAULT=1`（composition.md §3.1）。
- 【实证】`ScriptSubLayer` 遮罩用料字段（本次 dump）：`edgeMaskSubMaterial 0x50` + `edgeMaskSubMaterialParams 0x58`、`SubLayerMask 0xB0`；setter `SetEdgeMaskSubMaterial` 0x31de634；`RenderingSubLayer` 0x31def68 负责把 `_FilterParam`/`_Color` 写进组材质。
- 【引用】`charaLayer <slot> sub #key` 把角色挂到组（`RegistCharaData` 0x31dfa98）；`ScriptSubLayer` 独立相机链 0x88-0xA0、`meshRender 0x70`、`renderTexture 0x40`（presentation.md §7.1）。

**收口步骤**
1. 子层模型（可完整实现）：`group = {key, charaList[], depth, rt, maskKey?}`；`#A` 默认组；`#MASK` 只是普通 `#`-前缀组（不要特判字符串）。
2. `subCameraOn n`（可完整实现）：建/启用 n 个组；n 与键的对应按语料 `{1→#A,2→#A#B,3→…,4→#A..#D}`。
3. `subRenderDepth`（可完整实现）：深度值直接入组排序（默认 1，值 1..5）。
4. `#MASK` 合成（需资源+shader）：`subCameraFilter <组> mask #MASK` 时，把 MASK 组的 RT 作为该组 `edgeMaskSubMaterial` 的采样纹理（`SetEdgeMaskSubMaterial`/参数字段），配合 `_FilterParam` 混合。DOM 版可先用 CSS `mask-image` 以 MASK 组画布为蒙版近似。
5. 精确合成栈（部分需真机）：原实现是 RenderTexture+相机深度，阅读器以 DOM 层级替代时需保持：组内 charaDepth 排序 → 组间 subRenderDepth 排序 → 遮罩组不参与显示（只采样）→ 主层。默认值缺口：`ScriptCharaData.defaultDepth(0x54)/defaultLayer(0x5C)` 来自预制体（composition.md §7 未决 4），DOM 版需自定义一组默认值并用 `charaDepth` 语料域(-1..50)校准。

**置信度**：subCameraOn/subRenderDepth/#MASK 判定 = high（本次+文档）；#MASK 合成 shader/混合公式 = medium-low（需资源）。

---

## 4. 表情和立绘切换（charaFaceFade、charaCrossFade、charaChange）

**当前实现**：已有图片/表情切换，但淡变是直接改 face/id；没有旧/新表情和立绘的双缓冲交叉渐变。

**缺口**：双缓冲(main/back)与 ChangeKind 状态机；FADE/BLINK/CROSS_FADE 的差别；切换动画的等待语义。

**原生机制与证据**
- 【实证】`UIScriptChara`（dump.cs 171674）双缓冲字段：`changeKind 0xB0`（`ChangeKind{NONE=0,NORMAL=1,FADE=2,BLINK=3,CROSS_FADE=4}`）、`changeSpeed 0xB4`、`changeCount 0xB8`、`changeRange 0xBC`、`changeTotal 0xC0`、`changeStep 0xC4`、`isChangeContinueSilhouette 0xC8`、`mainIndex 0xE0`、`backIndex 0xE4`；方法 `ChangeCharacter(kind,speed,imageName,faceType,callback,isContinueSilhouette)` slot10 0x31E041C、`SetCharacter` slot11 0x31E04A4、`SetFace(faceType,fadeTime)` slot13 0x31E0668。
- 【实证】`charaFaceFade` handler 0x3183290：**pd 长度必须恰为 5**（`cmp w9,#5; b.ne 参数错误`）+ `pd[1]==' '`、`pd[3]==' '`；`ConvertCharaIndex(pd[0])` → charaData → `IsLoad`；随后 `state(0x288)=4(WAIT)`、`waitType(0x3D8)='charaChange'`、`waitIndex(0x3E0)=槽位下标`（0x3183348-0x318336c）→ 返回 Continue。即**换表情是可等待动画**，完成条件在 ProcessScript 的 `'charaChange'` 分支里。
- 【实证】`charaCrossFade` handler 0x317aad0：同样 `IsLoad` → 同一 WAIT 块（`mov w9,#4` + `&'charaChange'`，0x317ab2c-0x317ab38）。presentation.md §5.2：`charaCrossFade` → CharData.ChangeCharacter(ChangeKind.CROSS_FADE)。
- 【引用】presentation.md §5.2：`charaChange` cmp 0x317ec9c，含 `ConvertNameString`、`Contains("form")`、`GetCharaImageNameAndFormId` 0x31c5f4c、`UIStandFigureRender.GetAssetName` 0x3111a14；形态 `charaChange <槽> <新名+form> [附加] …`（params-visual.md：pd[2]=`GetCharaImageNameAndFormId` 的 `100100form2`）。

**收口步骤**
1. 数据模型（可完整实现）：每槽位两张 sprite（main/back）+ `{changeKind, changeSpeed, changeCount, changeRange, changeTotal, changeStep}`；切换时新图入 back，按 `changeTotal`(时长) 逐帧推进 alpha/裁剪；结束后交换 main/back、置 `IsChange()=false`。
2. 命令接线（可完整实现）：`charaFaceFade <槽> <face> <fade>`（pd 恰 5）→ 走 FADE 路径，fade 时长进 changeTotal；`charaCrossFade <槽> <立绘名> …` → CROSS_FADE 路径（main/back 两张立绘交叉）；`charaChange` 按 `form` 解析（`GetCharaImageNameAndFormId`）走 NORMAL 路径。
3. 等待语义（可完整实现）：三者都注册 `waitType='charaChange'`+waitIndex=槽；播放器应让脚本等待该动画（或按 skip 加速）——这是当前"直接改 face/id"的最大语义差。
4. 曲线校准（需真机）：FADE/BLINK/CROSS_FADE 三者的区别只能从视觉对拍确定（`changeRange/changeStep` 的具体推进公式未读）。
5. 资源：faceType 是立绘网格内的表情索引 → 需要立绘 atlas（需资源）。

**置信度**：字段/等待注册 = high（本次）；三种 kind 的视觉曲线 = medium（需真机）。

---

## 5. 装备与图片种类（equipSet/Change、verticalImage*/horizontalImage*、imageSet/master*Image*）

**当前实现**：装备按普通立绘；各种图片用统一图片节点；模式位与专用布局未完整消费；`imageSet 1/2` 的位义在逆向资料中仍标为推断。

**缺口**：① `imageSet` 第 3/4 参位义（本章已闭环）；② 装备的 CharaGraph 专用渲染路径；③ vertical/horizontal/master 各族的资源模板与双资源选择。

**原生机制与证据**
- 【实证】**imageSet 位义闭环**（此前 supplement §E.2 INFERRED）：共享 handler 0x3186fe0（charaSet/imageSet/equipSet/figureSet/sceneSet 同体），尾块 0x31927c4 起：
  - `pd[3]==' '` 且 `pd.Length>=7` 时，若 `pd[5]` 首字符为 `','` → 坐标形式（pd[4]=X、pd[6]=Y）；否则 `pd[4]`→`Int32.Parse` → `ScriptCharaData.SetPosition(0x316facc)`（**站位下标**，0x31928ec-0x3192910）；
  - 若 `pd[5]==' '` 且 `tag ∈ {imageSet, sceneSet}`（0x3192954/0x3192974）且 `pd.Length>6` → `pd[6]`→`Int32.Parse` → `ScriptCharaData.SetFullScreenScaleType(0x316fc14)`（0x3192990-0x31929a8）；
  - 其他 tag（charaSet 等）把剩余参数交 `GetAfterParam`(0x31b220c) 原样保留（0x31929c0-0x31929d8）。
  - 结论：`[imageSet T back10000 1]` 的 `1` = **站位下标**（positionList[1]=中央）；语料取值只有 1(2006)/2(15) 因为图片只放中/右；`[imageSet X Y A B]` 的第 4 值 = `SetFullScreenScaleType` 类型（语料 528 次恒 1）。
- 【引用】composition.md §4 + §1.2：`equipSet`→`UIEquipGraphRender.GetAssetNameList` 0x30f1b98，资源 `CharaGraph/{id}`，回退 `CharaGraph/9400010`；卡面 `UICharaGraphRender.GetAssetName` 0x30e93c8（`CharaGraph/{id}`，回退 `CharaGraph/100000`）、Ex 变体 0x30e9bec（`CharaGraph/CharaGraphEx/{id}`）。presentation.md §5.2：`charaSet` 家族按 `ScriptCharaData.Kind{FIGURE=0,EQUIP=1,IMAGE=2,VERTICAL_IMAGE=3,HORIZONTAL_IMAGE=4}` 分别建对象（`SetCharaImage` 0x31b77c4 / `SetEquipGraphic` 0x31b79b4）。
- 【引用】supplement §A.11.4：`master*` 家族是性别双资源：`masterSet <slot> <maleId> <femaleId> <1>`、`masterImageSet <slot> <maleAsset> <femaleAsset> 1`、`masterScene <maleScene> <femaleScene> [t]`、`masterBranch <maleLabel> <femaleLabel>`；玩家性别索引 `playerGenderIndex`（markup §3.11，`UserGame+0x4c`）。
- 【引用】图片渲染族：`UIImageRender/UIVerticalImageRender/UIHorizontalImageRender.GetAssetNameList`（`Image/{id}`，回退 `Image/00001`，composition §1.2）；`UIEquipGraph*Render.SetGradation`(0x30f2d64 等) 提供 `_Gradation` 淡入（本次 find_literal_refs 复核）。

**收口步骤**
1. `imageSet` 第 3/4 参接线（可完整实现）：站位下标 → `SetPosition`；第 4 值 → 全屏缩放类型（当前可先记录并按 1=默认处理，枚举域待查 `SetFullScreenScaleType` 实现 0x316fc14 的转发目标 UIScriptChara.SetFullScreenScaleType slot24 0x31E1068）。
2. 各族资源模板（可完整实现，图片需资源）：
   - `imageSet`→`Image/{id}`；`verticalImageSet/horizontalImageSet`→同 `Image/{id}`（composition §1.2，三者模板相同、Kind 不同）；
   - `equipSet/equipChange`→`CharaGraph/{servoId}`（回退 `CharaGraph/9400010`）；立绘 `figureSet`→`CharaFigure/[Form/f/]id`；
   - `masterImageSet` 双资源按 `playerGenderIndex` 选一；`master*` 族全部按此规则。
3. 装备专用渲染（需资源）：EQUIP kind 应挂 CharaGraph 渲染器（含 Ex 图的裁切/渐变），DOM 版先用普通 `<img>` 呈现并记录差异；`SetGradation`=alpha 淡入可直接实现。
4. vertical/horizontal 的尺寸/锚点差异（需资源+真机）：三族共用 `Image/` 命名但渲染器不同（UIVerticalImageRender/UIImageRender），当前统一节点需按 Kind 切换 CSS 类。

**置信度**：imageSet 位义 = high（本次）；equip/图片模板 = high（文档）；vertical/horizontal 渲染差异 = medium。

---

## 6. 旋转和相机 pivot（charaRollAxis、charaRollMoveEx、cameraRoll/subCameraRoll）

**当前实现**：主要是 CSS Z 轴旋转；X/Y 轴、双节点 pivot 和部分 Ex 参数未实现。

**缺口**：① 任意轴(axis)旋转；② 双节点 pivot 的等价（绕画面外点旋转）；③ `charaRollMoveEx` 的时长+目标点语义；④ 相机 roll 的 centerOffset。

**原生机制与证据**
- 【实证】`charaRollAxis` handler 0x3179868：`pd.Length>=7`；`pd[0]`→槽位；**`pd[2]` 直接作为 axis 字符串**（`0x31798cc ldr x22,[x8,#0x30]`，不转换）→ `pd[4]` Single.Parse=roll 角、`pd[6]` Single.Parse=duration（0x31798d4/0x317990c；`IsNormalPlaySpeed` 守卫在中间）；`pd.Length>=9` 时另有循环/等待/停止角（0x318cec8）。→ `UIScriptChara.StartRollAxis(axis,roll,duration,isLoop,isWait,stopAngle)` 0x31E3408；协程 `<RollAxis>d__137` 0x31E3344 内含 `rotationAxis(Vector3)`、`stopRotation`、`angularVelocity`、`angle`、`duration` —— **axis 字符串会被解释为 3D 轴**（`"X"/"Y"/"Z"` 或轴名），支持非 Z 轴。`StopRollAxisLoop` 0x31E36CC。
  - 注：`params-visual.md` 把 `charaRollAxis pd[2]` 记作"立绘/资源名"是误标，实际是 axis（证据 0x31798cc + StartRollAxis 签名）。
- 【实证】`UIScriptChara.SetRoll(rollZ,centerOffset)` 0x31E2C08、`StartRoll` 0x31E2EC8、`StartRollEx(duration,rollZ,centerOffset)` 0x31E30A4；相机侧 `SetCameraRoll(cameraRoll1,cameraRoll2,rollZ,centerOffset,isMain)` 0x31b9830、`StartCameraRoll` 0x31b9a08（presentation.md §2.3：**双节点 pivot 技巧**——roll1 旋转、roll2 反向平移 centerOffset，实现绕画面外点旋转）。
- 【引用】presentation.md §5.2：`charaRoll` cmp 0x3188238 → `SetRoll(rollZ,centerOffset)`；`charaRollMove` 0x317f4ec（角度+时长）；`charaRollMoveEx` 0x31836ac（params-visual：pd[2]=时长、pd[6]/pd[8]→`GetPosition(float,float)` 目标坐标 → 对应 `StartRollEx` 的 centerOffset 或"旋转+移动"）；`subCameraRoll` 0x317a2e0（deg + center）、`subCameraRollMove` 0x3179e0c（时长+角）；`charaRollAxisLoopStop` 0x3185968 → `StopRollAxisLoop`。

**收口步骤**
1. 旋转模型（可完整实现）：`{axis, roll, duration, isLoop, isWait, stopAngle}`；DOM 用 `transform: rotate3d(ax,ay,az,θ)` 实现任意轴；Z 轴即现实现；axis 字符串 → 向量映射需与协程对拍（`"X"/"Y"/"Z"` 大小写待验证，medium）。
2. 双节点 pivot（可完整实现）：把 `centerOffset` 换算为 `transform-origin` 偏移：原生 = 平移 -c → 旋转 → 平移 +c（roll1/roll2 两对象），CSS 中 `transform-origin: calc(50% + cx) calc(50% + cy)` 等价（注意符号方向）。
3. `charaRollMoveEx`（可完整实现）：时长+目标点 → 旋转中心偏移或终点；实现后与真机对拍一次确认是 centerOffset 还是移动（medium）。
4. 相机/子层 roll（可完整实现）：同一 origin 技巧作用于舞台根/子层容器；`cameraRoll` 语料仅 2 次、`subCameraRoll` 56 次。
5. 循环旋转停止（可完整实现）：`isRollLoop`+`stopAngle` → 每帧推进角速度，到 stopAngle 停（协程字段 angularVelocity/stopRotation 已给）。

**置信度**：axis 参数与协程字段 = high（本次）；RollEx/双节点换算细节 = medium。

---

## 7. 屏幕边缘变体（FSL/FSR/FSSideL/FSSideR/NotNotch）

**当前实现**：共用简化的宽高比偏移；没有完整区分 Side、NotNotch 和刘海安全边距。

**缺口**：精确公式与分支选择（本章已全部拿到，可直接完整实现）。

**原生机制与证据**（全部【实证】，本次逐指令复核；与 composition.md §2.3 的概述一致并更精确）
- `ScriptManager.GetFSCommandOffsetX(name,prefix,forceObi)` 0x31c5b68：
  - `forceObi && CommonUI.GetForceObi_16_9()` → 0（0x31c5c18-0x31c5c20）。
  - `prefix+"FSL"`（0x31c5c38）→ `GetOffsetX(80.0f, flag=1)`（0x31c5c74；80.0=0x42a00000）→ 取负尾块（0x31c5cd0 `csel/neg`）。
  - `prefix+"FSR"`（0x31c5cf4）→ `GetOffsetX(80,1)` → 取正尾块（0x31c5d38 `frintp`）。
  - `prefix+"FSSideL"`（0x31c5dbc）→ **`GetForceOffsetX(flag=1, sub=0.0)`**（0x31c5df8-0x31c5dfc `movi d0,#0; mov w0,#1`）→ 负尾块（`b 0x31c5c80`）。
  - `prefix+"FSSideR"`（0x31c5e18）→ `GetForceOffsetX(1,0)`（0x31c5e50）→ 正尾块（`b 0x31c5d3c`）。
  - `prefix+"FSLNotNotch"`（0x31c5e6c）→ `GetOffsetX(80, flag=0)`（0x31c5ea8 `mov w0,wzr`）→ 负尾块；`FSRNotNotch` 同构。
- `FSUtility.GetOffsetX(sub,flag)` 0x31230bc：`IsUnderVista()`(0x3122124) → **0**；否则 `IsCalcNotch(flag)`(0x3121854) → `sub=GetNotchSubMarginX(sub)`(0x31222f8) → `GetCalcOffsetX(sub)`。
- `FSUtility.GetForceOffsetX(flag,sub)` 0x3123200：**不做 IsUnderVista 门控**，其余同上（0x312324c IsCalcNotch → 0x312326c GetNotchSubMarginX → 尾调 GetCalcOffsetX）。
- `FSUtility.GetCalcOffsetX(sub)` 0x3123180：
  `aspect = Screen.width/Screen.height`（0x3123190/0x312319c）；
  `m = min(aspect, 2.3333333)`（0x31231b4/0x31231bc/0x31231c8 `fcsel gt`）；
  `v = (m - 1.7777778) * 576.0 * 0.5`（0x31231b8 + s2、0x31231c0 `0x44100000`=576、0x31231e4 `0.5`）；
  `if (aspect < 1.7777778) v = 0.5`（0x31231dc `s3`、0x31231f0 `fcsel mi`）；
  `return v - sub`（0x31231f4 `fsub s0,s0,s8`）。
- 数值：16:9 → v=0；21:9(2.3333) → v=160；`FS_OFFSET_X_MARGIN=80`、`SUB_MARGIN_X=68`、`GetNotchSubMarginX(sub)= 有刘海时 sub*(notchWidth/68)`（composition.md §2.3，`IsCalcNotch` 0x3121854 / `GetSafeAreaWidth` 0x3121944）。
- 命令族与语料：`charaPutFSL/FSR/FSSideL/FSSideR`、`charaFadeinFSL/FSR/FSSideL/FSSideR/NotNotch`、`charaMove*`/`subRenderFadein*` 变体（params-visual.md 各表；`charaFadeinFSRNotNotch` 6 次、`charaFadeinFSLNotNotch` 6 次、`charaPutFSLNotNotch/FSRNotNotch` 0 次）。

**收口步骤**（可完整实现，纯公式）
1. 实现 `offsetX(variant, aspect, notchWidth, forceObi)`：
   - FSL = `-floor(GetOffsetX(80, Always))`；FSR = `+ceil(GetOffsetX(80, Always))`；
   - FSSideL/R = `∓GetForceOffsetX(Always, 0)` = `∓v`（v 为上面公式，**不含 80 边距、不受 IsUnderVista 影响**）；
   - NotNotch = `flag=None`（不做刘海补偿），其余同 L/R。
2. Web 端：`IsUnderVista` ⟺ `aspect<=2.0` → FSL/FSR 偏移 0（16:9 无偏移）；`IsCalcNotch(None)=false` → NotNotch 与普通变体在浏览器等价（无刘海），保留参数以利真机/模拟。
3. 把偏移叠加到该命令的位置参数（x += offset；注意 L/R 符号），再走既有 charaPut/移动逻辑。
4. 真机核对项：`forceObi`(CommonUI.GetForceObi_16_9) 与刘海机的 notchWidth 取值（需真机样本）。

**置信度**：high（本次逐指令 + 常量复核）。

---

## 8. 角色循环移动和闪光（charaRelativeLoopMove*、flashin loop/pingpong 与 Dep 变体）

**当前实现**：循环移动用正弦轨迹，循环闪光用余弦透明度；没有完整 native 往返曲线和不同模式、颜色/依赖角色 mesh 的区别。

**缺口**：① 相对循环移动的分段线性/缓动结构与循环次数；② flash 的 once/loop/pingpong；③ Dep 变体（按依赖角色 mesh）。

**原生机制与证据**
- 【实证】`charaRelativeLoopMove` handler 0x3181190：`pd.Length>=0xb`；`pd[0]`→槽位；`pd[2]`→`Int32.Parse`=循环段数 n（`n<1` 直接返回）；**精确长度 = 6n+5**（0x3181204-0x318121c `mov w9,#6; mov w10,#5; madd w9,w0,w9,w10; cmp w9,w8`）→ 即 token 数 = 3n+3：`槽位 + n + n×(x,y,时长)`。随后按数组调 `UIScriptChara.MoveRelativePositionLoop(Vector2[],float[],loopNum,isFastPlay)` 0x31E2528 或 `MoveRelativePositionEaseLoop(...,easeType,...)` 0x31E2974（`charaRelativeLoopMoveEase` 0x31871c4 同结构）；`Stop...` 0x31E2470。字段：`moveRelativePositions 0x100/moveRelativeDurations 0x108/moveRelativeLoopNum 0x110/currentMoveRelativeIndex 0xFC/moveRelativeEaseType 0x118`。
- 【引用】presentation.md §3.4：flash 字段（flashName 0x518、flashCount 0x524、flashTime1/2/3 0x528/0x52C/0x530、flashColor1 0x534-0x540、flashColor2 0x544-0x550；Dep 版 0x558-0x594 含 `flashDepNum 0x594`）；`StartFlash(name,d1,d2,c1,c2)` 0x31ba3d8；`OnFlashRequest` 0x31ba490 与字面量 **`'pingpong'`/`'once'`/`'loop'`**（0x31ba4b4/4d8/4e4）；`EndFlash(duration)` 0x31ba8a8 写 flashTime3+isEndRequestFlash(0x521)；`StartFlashDep(name,dep,d1,d2,c1,c2)` 0x31ba8c0；mesh：`meshFlashBase 0xD0`/`charaMeshFlashBase 0xF0`。
- 【引用】语料：`flashin` 1,214 次（once 1081/loop 133）、`flashout` 48（只接 1 个时长）、`flashOff` 145；`pingpong` 与 `*Dep` 全族 0 次（supplement §A.3/§C.2）；`charaRelativeLoopMove` 39 / `…Stop` 31 / `…Ease` 0。
- 【实证】`flashin` 参数形态（params-visual.md）：pd[0]=`Flash/<name>`、pd[6]/pd[8]=起/止颜色（ConvertColor）、Dep 版 pd[10]=叠加角色槽位（`ConvertCharaIndex`）。

**收口步骤**
1. 循环移动（可完整实现）：`{slot, n, segs:[{x,y,dur}×n]}`，逐段线性插值（Ease 版按 §15/缓动表 33 名做段内缓动），循环 n 次（`moveRelativeLoopNum`），Stop 立即停并归位；`isFastPlay`/skip 时加速。
2. flash（可完整实现，视觉近似）：两段颜色+时间；`once`=播一次即透明；`loop`=跳回第一段循环；`pingpong`=时1色1→时2色2→倒放时1（OnFlashRequest 的三分支枚举），到 `flashout <t>`/`flashOff` 结束。非 Dep 用全屏四边 mesh（DOM：全屏 overlay + 四边渐变可由单 overlay 近似），Dep 用角色 mesh 且 `flashDepNum` 指定角色对象。
3. 颜色为 8 位 hex（`[flashin once 0.1 0.3 FFFFFFAF FFFFFF00]`），沿用 `ConvertColor` 规则（composition §3.1 已录 hex 解析）。
4. 若需放弃正弦/余弦近似：把当前"正弦轨迹、余弦透明度"换成"分段线性（+缓动）"与"两段颜色插值"即可闭合语义差（纯逻辑）。

**置信度**：loop 移动参数结构与长度公式 = high（本次）；flash 机制 = high（文档）；pingpong/Dep 无样本 = 真机/样本待补。

---

## 9. 发言者演出（charaTalk on/off/depthOn/depthOff）

**当前实现**：记录 talkSlots 和 talkDepth，但 talkDepth 未进入合成；active/inactive 类没有原生聚光、暗化和深度切换效果。

**缺口**：on/off/depthOn/depthOff 的状态位、聚光（非发言者暗化）与深度切换。

**原生机制与证据**（本次逐指令【实证】）
- `charaTalk` handler 0x3184a00：`pd.Length==1` 时 `pd[0]`→`ConvertCharaIndexTalk(0x31b356c)`（0x3189bbc）；返回 **-1**（= `on/off/depthOn/depthOff`，该函数内比较这 4 个字面量）→ 分支 0x318ebf0 → `ScriptManager.SetTalkName(pd[0])`（0x31b744c，0x318ec0c）。多槽（`A,B`）走 0x318c370 分支（展开点仍未定位，INFERRED）。
- `ScriptManager.SetTalkName(string)` 0x31b744c：
  - `'on'` → `isTalkMask(0x3B1)=1`（0x31b74c8）；`'off'` → `isTalkMask=0`（0x31b74f4）；
  - `'depthOn'` → `isTalkDepth(0x3B2)=1`（0x31b7518）；`'depthOff'` → `isTalkDepth=0`（0x31b7548）；
  - 其他值 → `talkMaskName(0x3B8)=value`（0x31b7550-0x31b7558，GC 写屏障）；
  - 随后 0x31b7560：若 `isTalkMask`，遍历 `charaList(0x490)`，把 `charaData.name(0x28)` 与 `talkMaskName` 比较（0x31b7594-0x31b75a0），命中下标进 0x31b75d8：
    - 命中者：`ScriptCharaData.SetTalkMask(false)`（0x316fc34，0x31b7630），且 `if isTalkDepth` → `ScriptCharaData.SetTalkDepth()`（0x316fca0，0x31b7644）；
    - 未命中者：`SetTalkMask(true)`（0x31b764c）+ 恢复深度（0x31b7658 起）。
  - 字段名取自 dump.cs：`isTalkMask 0x3B1 / isTalkDepth 0x3B2 / talkMaskName 0x3B8`。
- 【引用】presentation.md §5.2「spotlight」：`ScriptManager.SetCharaSpotlight(List<int>)` 0x31b76dc 同族机制（名单内 `SetTalkMask(false)`+`isTalkDepth` 时 `SetTalkDepth()`，名单外 `SetTalkMask(true)+RecoverDepth()`）；`＠名前=spot[槽位…]` 是脚本侧写法（supplement-markup.md §4.2，ProcessScript `'=spot'` 0x31c0888 解析）。

**收口步骤**
1. 状态位（可完整实现）：实现 `{isTalkMask, isTalkDepth, talkMaskName}`；`charaTalk <slot>`=点名发言者（沿用现 talkSlots）；`charaTalk on/off`=打开/关闭"非发言者暗化"；`depthOn/depthOff`=是否对发言者做深度调整。
2. 合成落地（可完整实现，参数需对拍）：非发言者 → `SetTalkMask(true)` 的视觉 = 变暗/压暗（DOM：`filter: brightness(~0.5)` 或叠加黑色半透明层）；发言者 → 取消压暗，且 `isTalkDepth` 时 `SetTalkDepth()` 做 z/位移调整。当前实现只记录不应用，是本项主缺口。
3. `SetTalkDepth()`(0x316fca0) 内部的具体位移/深度增量未读（**INFERRED**：在原 depth 上的固定偏移）——补证需读该函数或真机对拍。
4. `=spot[..]` 解析（可完整实现）：名字行后缀 `=spot[H,I]` 指定聚光槽位列表，接到同一套 SetTalkMask/Depth。

**置信度**：状态位与调用链 = high（本次）；压暗/深度的视觉量值 = medium（需读 SetTalkMask/SetTalkDepth 内部或真机）。

---

## 10. 角色着色（charaFilter）

**当前实现**：已有黑色剪影；记录的着色值未实际用于指定色彩/alpha 的 shader 渲染。

**缺口**：filterColor 的完整渲染色（不只黑色剪影）；filterName 与 shader 选择。

**原生机制与证据**
- 【引用】params-visual.md：`charaFilter` handler 0x3187830：pd[2]=滤镜名、pd[4]=颜色 → `ScriptCharaData.SetFilter(filterName,Color)`。
- 【实证】`UIScriptChara.SetFilter` slot14 0x31E066C：`filterName` 存 0x98（0x31e0684 `str x1,[x19,#0x98]!`），4 个 Color 分量存到 0x9C/0xA0 区（0x31e0698/0x31e069c `stp`）。字段 `filterName 0x98 / filterColor 0xA0`。
- 【引用】supplement §C.3：`'silhouette'/'normal'` 在渲染层比较（`UIImageRender$$SetCharacterRender` 0x30fb06c 一带、`UIEquipGraphRender` 0x30f1f80 等），shader 字面量 `Custom/Sprite-ScriptActionFigureSilhouette`(0x30fb018) / `Custom/Sprite-ScriptActionFigureNormal`(0x30fb048)。语料：第 2 参 silhouette 820 / normal 70；第 3 参 hex 色（`00000080` 644、`FFFFFF80` 46）。

**收口步骤**
1. 数据模型（可完整实现）：`{slot, filterName, color{rgba}}`；`normal`=清滤镜；`silhouette`=以 `filterColor` 着色（alpha 由 A 通道控制）。
2. 渲染等效（可完整实现，精确度需资源）：DOM 可用两层实现——底层用 `filter: brightness(0)`（或 canvas 阈值化）得到剪影，再用 `filterColor` 的 RGB 参与混合（`mix-blend-mode`/`background-color` + `mask`），alpha=A/255。与 shader 版的差别在于边缘抗锯齿与 HDR 亮度，需真机对拍（需真机样本）。
3. shader 名规则：若出现 `silhouette/normal` 之外的值，按 `"Custom/Sprite-ScriptActionFigure"+UpperFirst(name)` 拼接（与 cameraFilter 同族的命名规律，【推断】）。

**置信度**：字段与传递链 = high（本次+文档）；混合公式 = medium（需 shader/真机）。

---

## 11. 音频淡出与跨脚本续播（bgm、bgmStop*、seStop、seContinue*、soundStopAll*）

**当前实现**：普通音频可播放；部分尾参没有消费，停止主要是直接停止，BGM 淡变使用阅读器自己的逻辑；新执行器 start 会 stopAll；跨脚本续播 ID/保持状态未还原。

**缺口**：尾参（fadeTime/fadeoutTime）语义落地；"停止到脚本末尾"语义；跨脚本/跨场景续播。

**原生机制与证据**
- 【引用】params-misc.md §0.3/各条：`se` 3 值=name+volume、5 值=name+fadeinTime+volume（pd[2]=淡入时间、pd[4]=音量）；`seStop` pd[2]=fadeoutTime（`Single.Parse` 0x3188c2c → `OverwriteAssetSoundName.StopSe` 0x318bd5c）；`seContinue` pd[6]=续播编号 id → `ScriptManager.CheckSameIdSeContinue`(0x31803e0) + `PlaySeContinue`；`seVolume/cueSeContinue/voiceVolume` 同为 pd[2]=fadeTime、pd[4]=volume；`bgm pd[2]`=音量（medium，pd[4] 为第二个 float，疑似淡入时间，supplement §D.2）；`soundStopAll`=无参全停（0x3188554）；`soundStopAllEnd`（0x3187494，"脚本结束段"）；`soundStopAllFade`（0x3181c98，带淡出，32 次）；`keepSubBgmOn/Off` → `BgmManager.Enable_KeepSubBgm(bool)`(0x2e45d20)/禁止。
- 【实证】`BgmManager` API（本次 dump.cs 复核，TypeDefIndex 2073）：
  - `PlayBgm(string name, float volume, float fadeTime, long startTime = 0, Action finishCallback)`、`PlayBgm(MainBgmPlayArgs, SubBgmPlayArgs[], cb)`、`PlayBgm(BgmPlayArgsGroup, cb)`；
  - `FadeoutBgm(float fadeoutTime, Action)`、`StopBgm(string, float fadeoutTime=0, Action)`、`StopAll(float fadeoutTime=0)`、`StopSubBgm(string,float)`、`PauseBgm(bool)`；
  - `Enable_KeepSubBgm(bool)`、`ForceDisable_KeepSubBgm()`；`BgmPlayArgsGroup{MainArgs, SubArgsList, AllArgsList, ChannelId}`、子通道上限 2（`SubBgmPlayerMaxCount=2`）。
  - 即跨脚本续播的引擎原语是 **`startTime`（从指定进度续播）+ KeepSubBgm（场景切换保持副通道）**；每"通道"可同时挂多 BGM 玩家（`BGM_PLAYER_MAX_COUNT`），由 `channelId` 区分。
- 【引用】`SoundManager.getAssetName` 0x2e9b28c（`ba*`→Battle）；音频资产 = `Audio/{Bgm|Se|Voice|Battle}/{name}.cpk.bytes`（composition §1.2）；`Se/` 为本地（composition §1.2）。

**收口步骤**
1. 参数全量消费（可完整实现）：统一实现 `fadeIn/fadeOut` 时长参数（se/bgm/voice 的 pd[2]/pd[4]；seStop/cueSeStop 的 fadeoutTime）；`soundStopAllFade` 读时长；`bgmStop <name|' '> [t]` 的"空格=当前 BGM"分支。
2. 跨脚本状态（可完整实现）：维护音频保持表 `{kind, name, volume, id?, startTime?}`：
   - `seContinue <name> [t][vol] <id>`：若同 id 的续播 SE 正在播 → **接续**（不重头）；否则起始播；`seContinueStop <name> <t> <id>` 按 id 停。
   - BGM：`PlayBgm` 的 `startTime` 用于"新执行器启动后从旧进度续播"；`keepSubBgmOn/Off` 控制 sub 通道跨场景保持（`Enable_KeepSubBgm`，并注意 `ForceDisable_KeepSubBgm` 在脚本结束/异常时的强制关闭）。
3. 延迟停止（可完整实现）：`bgmStopEnd`/`soundStopAllEnd` = 登记 pending stop，在 `EndExecuteScript`(结束淡出) 处统一 `StopAll`；当前"直接停"应改为分三类（stop now / fade stop / stop at end）。
4. 数据源（需游戏数据）：cpk/CRI 音频包与 cue sheet；本地文件播放器可用占位/静音，但完整音量曲线与 CRI 行为需真机。
5. 真机对拍项：`bgm pd[4]` 语义（淡入时间 vs 其它）、`skipDropFlag` 0/1 方向（§12）、`BgmPlayArgsGroup` 的多通道混音规则。

**置信度**：API 与参数顺序 = high（文档+本次 dump）；跨脚本续播映射 = medium（startTime/keep 语义为强推断，需真机证实）；音频资源 = 需数据。

---

## 12. 延迟与等待（delay/tdelay、wait 的各子关键字）

**当前实现**：延迟区间只把普通演出命令交给演出处理器；跳过对话、wait 和复杂流程，嵌套/文本速度/skipDropFlag 未实现；等待按少量轨道家族或真实音频查询，未覆盖逆向表中完整 72 键的精确完成条件。

**缺口**：① delay 区间模型（含 flags）；② `wait` 的 72 键分派与各键完成条件；③ 时间源区别（scaled/unscaled/帧）。

**原生机制与证据**
- 【引用】params-misc.md §0.2（ScriptCommandDelayParam 结构、构造 0x3170f44、`delay/tdelay` handler 0x3182768、`GetNextDelayEnd` 0x31b2710、`TDelayJumpScript`、`UpdateDelayScript` 0x31b576c、`DelayStop` 0x31c5ab4、`delayEnd` 空体 0x3182018）：`delay/tdelay <slot> <sec> [flag]`；`skipDropFlag=(pd[4]==0)`；`checkTextSpeed=(tag!='tdelay')`；`messageFlag=IsMessageLine(当前行)`；推进时非消息行按 `GetTextSpeed()` 缩放 delta；`delayStop(slot,2)`。语料 `delay/tdelay/delayEnd/delayStop/delayStopAll` **全 0 次**（supplement §A.8 直证）。
- 【实证】`wait` handler 0x31874f4：`state(0x288)=WAIT`、`waitType(0x3D8)=pd[0]` → `ComputeStringHash` 72 键树（supplement-command-coverage §A.0/§A.1；本次复核 `wait_keys.json` keys=72：`time/rtime/frame/skippableTime` + `charaCut/charaCutStart/charaFade/communicatioChara/effectmessage/effectmessageStart/fastPlayDraw/fsmObjFinished/masterverticalImageSet` + 60 个命令名）。
- 【引用】params-misc §0.1：时间键 `time/rtime/frame/skippableTime` 的 pd[2]=秒/帧（`Single.Parse`，0x3193790；0 秒直接跳过 0x3193794；0 值还可改按名字等待 0x3193854）；60 个命令名共用体 0x31938c8：pd[2]→`ConvertCharaIndex`（槽）、pd[4]=int；`time` 用 `Time.deltaTime`（scaled，0x31bc2f0）、`rtime` 用 `Time.unscaledDeltaTime`（0x31bc2a8/0x31bc2b8，supplement-script-format §B.3）。
- 【引用】skippableTime：`SetAutoWait`(0x31b1974) 追加 `[wait skippableTime {0:F2}]`；`GetAutoWaitTime(charCount)` 0x31b2038 = `autoWaitTime(0x6F8)+textStepTime(0x720)*字数/GetTextSpeed()`；不计字数的行由本地化正则 `'(wt|k)'` 与命令表 `speed,s,tVoice,delay,tdelay` 排除（marker-table.md §1.1/§3）。
- 【引用】完成条件分支（ProcessScript 内按 waitType 字符串再分支）：`rtime` 0x31bce60、`skippableTime` 0x31bcc8c/0x31be868、`charaFade` 0x31bc9a4（supplement-command-coverage §C.2）；`k` → `WaitNextTouch(true)` 0x31c2550（script-format §B.1）。

**收口步骤**
1. delay 区间（可完整实现，纯逻辑；语料 0 次可后置）：实现 `{slot, endLine=下一个delayEnd, second, skipDropFlag, messageFlag, checkTextSpeed}`；主循环跳过区间并行推进，到点/遇阻塞执行区间；`delayStop/delayStopAll` 取消；`delayEnd` 仅作边界标签。
2. wait 时间键（可完整实现）：`time/rtime/frame/skippableTime` 四键 + 秒/帧解析 + 0 值语义 + 时间源区分（scaled vs unscaled）；`skippableTime` 与自动播放字数模型合并（`(wt|k)` 排除规则照抄本地化表）。
3. wait 命令键（可完整实现框架，条件需逐个对拍）：对 60 个命令名实现 `isBusy(cmd, slot)` 查询——播放器已有各演出轨道，把"该命令动画是否完成"暴露为谓词；已知可先接：`charaCut`(→cut 状态)、`charaFade`(→alpha 动画)、`charaMove*`(→移动 tween)、`effectmessage`(→MessageEffectIsBusy 0x31c02f4)、`fsmObjFinished`、`fastPlayDraw`、`communicatioChara`、`masterverticalImageSet`（注意原样拼写，含游戏自带拼写错误 `communicatioChara`/`masterverticalImageSet`）。
4. 剩余完成条件（需继续逆向+真机）：把 ProcessScript 里对该 waitType 的比较点补全（模式已明确：`0x31bc344 ProcessScript` 内 per-key 分支），再按真机对拍。
5. `skipDropFlag` 0/1 的实际方向、72 键中命令键的完成粒度（等"实例空闲"还是"动画结束"）→ 真机样本。

**置信度**：结构与解析 = high（文档+本次复核 72 键）；完成条件覆盖 = 低（仅 4-5 个键有 VA，其余需补）。

---

## 13. 自动播放和跳读（skip、tapSkip、autoAndBackLog、backlogStart/End）

**当前实现**：这些脚本命令目前直接跳过；UI 自己的自动/跳读/回想功能可用，但没有执行脚本对它们的策略限制。

**缺口**：5 条命令的状态位与联动（本章已全部取证，可完整实现）。

**原生机制与证据**（本次逐指令【实证】；字段名取 dump.cs）
- `skip`（handler 0x317b3f4）：**pd 长度必须恰为 1**（`cmp w9,#1; b.ne 参数错误`）；入口先 `isNeedSkipStateAfterMovie(0x6E1)=false`（0x317b414）；`pd[0]=='true'` → `isSkip(0x377)=1`（0x317b42c）；`'false'`/`'allFalse'`（0x318c5e8/0x318c614）→ `isSkip=0`（0x318c61c）；三种合法值都执行 `tapSkipFade(0x388)=null`（0x318c620）；其他字符串 → 通用错误路径 0x318fde8。
- `tapSkip`（handler 0x317bba0）：`pd.Length>=1`；入口 `tapSkipResetPlaySpeedWhenNoSkip(0x390)=false`（0x317bbb8）；`pd[0]` → `tapSkipLabel(0x380)`（0x317bbc0-0x317bbc8）；`pd.Length>=5` 时若 `pd[3]==' '` 且 `pd[4]` 存在：`pd[4]=='dontResetPress'`（0x318d290）→ 标志 w22=0，否则 w22=1；若 `pd[4]` 不是该关键字 → `tapSkipFade(0x388)=pd[4]`（0x31903cc）；收尾：`tapSkipFade=null`（0x3190450）→ `ScriptMessageCommonManager.SetTapSkip(this,1)`（0x31d1c00，0x3190468）→ 非 dontResetPress 时 `ResetLongPress()`（0x31d47c8）。语料 `tapSkip` 仅 1 次。
- `autoAndBackLog`（handler 0x317923c）：**前置守卫 `isBackLog(0x391)` 为 0 则整条命令直接 Normal**（0x317923c-0x3179240）；`pd` 恰 1 值 `'true'`/`'false'`；`'true'`→ `hideAutoMessageButton(0x3A1)=hideBackLogButton(0x3A2)=0`、`SetActiveAutoMessageButton(1,0)`；`'false'`→两者=1、`SetActive...(0,…)`（0x31792d0-0x31792ec 的 `bic/and`+调用）；同时 `ModifyPlaySpeed` + `ResetLongPress`。语料 1 次。
- `backlogStart`（0x31813e0）：`isBacklogOnly(0x392)=1`；`backlogEnd`（0x317c1ec）：`isBacklogOnly=0`。各 16 次。
- 【引用】`isBacklogOnly(0x392)`/`isButtonDisable(0x393)` 被 `[k]` 分支读取（script-format §B.1：`k` → `WaitNextTouch`，读 `isButtonDisable`/`inputTopMode`/`isBacklogOnly`）——即 backlogOnly 模式影响"下一句"指示与点击行为。
- 【引用】回想的记录侧：`ScriptLoop`(`switchCaseCount/switchCaseIndex/lastSelectedIndex`，closure-choice-branch.md §B.4⑤)；回想文案包裹符 `「」`、选项色 `[FF4040]`（marker-table.md §1.1）。

**收口步骤**（全部可完整实现，纯逻辑）
1. 状态位：`{isSkip(0x377), skipFade?, tapSkipLabel(0x380), tapSkipFade(0x388), tapSkipResetPlaySpeedWhenNoSkip(0x390), isNeedSkipStateAfterMovie(0x6E1), isBackLog(0x391), isBacklogOnly(0x392), hideAutoMessageButton(0x3A1), hideBackLogButton(0x3A2)}`。
2. `skip true/false/allFalse`：进入/退出"脚本强制跳读"；`allFalse` 与 `false` 在当前证据下等价（都清 isSkip）；`true` 时阅读器应立即消化后续演出（现 UI 的手动跳读逻辑可直接接）。
3. `tapSkip <label> [fade] [dontResetPress]`：注册"点击跳过区"（label 目标 + fade 颜色），`dontResetPress` 时不重置长按/点击状态；实现为 UI 热区 + 跳转到 label。
4. `autoAndBackLog true/false`：显示/隐藏自动播放与回想按钮；**注意守卫是 `isBackLog`**——播放器里把 isBackLog 视为"剧情允许回想"的开关（默认真），否则该命令为 no-op。
5. `backlogStart/End`：圈定回想记录写入区间（`isBacklogOnly`）；与消息系统记录开关联动（`ScriptMessageCommonManager` 侧）。

**置信度**：high（本次逐指令+字段名）。

---

## 14. 任务条件和变量数据（branchQuestClear/NotClear、[%2]…[%5]）

**当前实现**：接口能接受 questClear 和 variables；当前读取流程未提供游戏任务状态/从者数量等数据。未知任务按未完成处理，未给变量显示空串。

**缺口**：条件求值函数 + 数据源；`[%N]` 的 5 个变量写入。

**原生机制与证据**
- 【实证】`branchQuestClear`/`branchQuestNotClear` handler 0x317bdd0：`pd.Length>=3` + `pd[1]==' '`；`pd[2]` → `ScriptManager.GetQuestId`(0x31b3f6c，内部 `SingletonMonoBehaviour.get_Instance` + `DataManager.GetMasterData` 查主数据)；`pd.Length==5` 时 `pd[3]==' '` 且 `pd[4]` → `Int32.Parse`（0x317be6c-0x317be74，=phase/比较值）；共享块 0x318a3a4：`tag=='branchQuestClear'` → w22，最终 **`CondType$$IsQuestPhaseClear`（0x2d70ad8）调用**（0x318a420，参数 w1=questId、w2=phase、w3=-1、w4=0）→ `eor w8,w22,w0`（0x318a424）→ 决定跳转。
  - 即条件语义 = `IsQuestPhaseClear(questId, phase)`；NotClear 为同一结果取反（tag 异或）。
- 【引用】`branchRouteSelect/NotRouteSelect`（0x31834e4，pd[4]→Int32）、`branchRouteSelectCount`（0x317c85c：pd[2] Int32 + pd[4] `Enum.Parse`）、`branchSetGrandSvtCount`（0x317e20c：pd[2] Int32 + pd[4] Enum.Parse）（params-misc.md；语料 branchQuestClear 27 / NotClear 24 / RouteSelect 18 / RouteSelectCount 22 / branchMaterial 26 / branchSetGrandSvtCount 2）。
- 【引用】`[%1]..[%5]`（supplement-markup.md §3.10）：`%1`=玩家名（`UserGame+0x18`）、`%2`=questTitle(statics+0xF0)、`%3`=questMessage(+0xF8)、`%4`=questMessageRuby(+0x100)、`%5`=`UserServantMaster.servantAllNum.ToString()`（0x31a3684）；写入点 `FirstExecuteScript` 0x31a33ec；替换时尾部自动补 `[-]`（0x31d0410）；未知编号 → 空串（引擎行为）。语料 `[%5]騎による総力戦`。

**收口步骤**
1. 接口化数据源（可完整实现接口，数据需游戏侧）：
   - `questPhaseClear(questId, phase) -> bool`（对应 `CondType.IsQuestPhaseClear`；数据 = 任务通关进度表）；
   - `svtAllCount() -> int`（对应 `UserServantMaster.servantAllNum`）；
   - `questTitle/questMessage/questMessageRuby`（`%2/%3/%4`）。
2. 求值（可完整实现）：`branchQuestClear` = provider(...) 为真；NotClear = 取反；`branchRouteSelect*`/`branchSetGrandSvtCount` 同法（provider + int/enum 比较）。
3. `[%N]`（可完整实现）：替换器接 5 个值；**未知编号给空串并补 `[-]`**（当前"变量显示空串"应改为"替换后补颜色终止符"以匹配引擎）。
4. 数据源落地（需游戏数据）：任务状态来自用户档/游戏缓存（本地无 → 对未知任务保持现"未完成"策略并在诊断中标记）。

**置信度**：条件链与求值函数 = high（本次）；数据源 = 需游戏数据。

---

## 15. 字体、图标及稀有行内标记（[f size top/center/bottom]、[i]、[image]、servantName、tRoute、tFlag、tRaidShortName）

**当前实现**：字号第二参未处理；图片/图标使用普通图片而非原生排版；后四类没有专用替换器，未知标记保留字面文本；effectmessage 可解析但没有特效执行器。

**缺口**：字号+垂直对齐双参；`[i]/[image]` 的行内渲染语义；4 类替换器的数据源；`effectmessage` 执行器（已在 effects 组补录，见 `evidence-effects.md`）。

**原生机制与证据**
- 【引用+实证】`[f]/[font]/[fontSize]` 共用 handler 0x3187928（supplement-markup.md §3.13）：`pd.Length==1` → `SetFontSize(pd[0], null)`；`pd.Length>=3` → `SetFontSize(pd[0], pd[2])`（0x318946c-0x3189480）——**第 2 参=垂直对齐**；`SetFontSize(string,string)` 0x31d2684 写 `fontSize(0x130)`/`verticalAlign(0x134)`（0x31d26e4/0x31d26f8）。字号表（`ScriptMessageLabel..cctor` 0x31d7ed4）：`'-'`=29、`x-small`=19、`small`=24、`medium`=29、`large`=48、`x-large`=64；对齐表 `GetVerticalAlignFromString` 0x31d2828：`top`→0、`center`→1、`bottom`→2（空串=0）。
- 【引用】`[i 名]`（UpdateLabels 0x31d07b8 Equals 'i'）与 `[image 名]`（0x31d0680）→ 内部标签 `[^…]`（0x31d06b8/0x31d06d8 Concat）；资源族 `npc_language_*`（45 次）/`berserker_language_*`；`[image 名:文本]` 由 `:` 参数切分（§2.2/3.3）；立绘形式 `[image <名> 1.5]`（`SetTalkName` 0x31d3d3c Concat，第三参=缩放）；`i` 与 `image` 的资源族相同，渲染差异【INFERRED】（`i`=行内小图标、`image`=语言气泡）。
- 【引用】`servantName`：`UpdateLabels` 0x31d0840 Equals 'servantName' → `ScriptMessageLabel.GetServantChangeName`；本语料 0 次（战斗用）。
- 【引用】`tRoute/tFlag/tRaidShortName`：渲染路径 `ScriptManager.ReplaceBranchText` 0x31b5064（比较点 0x31b5218/0x31b5244/0x31b5270；未命中的标记原样重建）；`TextOverwriteRoute` 0x31c6e9c / `TextOverwriteFlag` 0x31c72e8 / `TextOverwriteRaidShortName` 0x31c75f4（composition.md §5.3）；语料 `[tRaidShortName 80593 1]` 3 次，tRoute/tFlag 0 次。
- 【引用】`effectmessage`：① wait 关键字叶子 0x31920a8（`waitName`=ConvertTalkEffectName(pd[2])）；② `AnalysText` 0x31aeca8 资产登记；③ `ProcessScript` 0x31c02f4 `MessageEffectIsBusy(waitName)` 等待；行内标记 `[effectmessage X]`→内部 `[*X]`、`[effectmessage /]` 关闭（supplement-markup §3.5；命令参数表见 supplement-command-coverage §B.2）。

**收口步骤**
1. `[f …]`（可完整实现）：接第 2 参垂直对齐（0/1/2）+ 6 档字号像素值；`-`/空复位；字体本身用 `Font/*`（需资源，UI 默认 `Fonts/FGO-Main-Font`，composition §5.1）。
2. `[i]/[image]`（可完整实现外壳，视觉需资源）：渲染为行内 `<img>`（`i` 小图标、`image` 气泡；尺寸/锚点以真机对拍为准），`[image name:文本]` 的"替字"要作为可选显示文本；`[image <名> 1.5]` 的第三参=缩放。
3. `servantName`（需数据源）：从当前队伍/关卡上下文取从者名；语料 0 次可后置。
4. `tRaidShortName <id> <n>`（需数据源）：查 raid/讨伐战短名表；`tRoute/tFlag`（需数据源）：路由/flag 文本替换——无数据时按"未知标记保留字面"（当前行为）并在诊断记录。
5. `effectmessage`：接消息窗特效执行器（资源），等待语义按 `MessageEffectIsBusy`；细节见 `evidence-effects.md`。

**置信度**：`[f]` 双参与字号表 = high（文档）；`[i]/[image]` 渲染差异 = medium（INFERRED）；4 类替换器机制 = high（文档），数据源 = 需数据。

---

## 16. 本地化及嵌套脚本（markers 覆盖、％！、￥）

**当前实现**：有可配置控制符 API，但未自动加载服务器本地化表；稀有控制符只有简化转换，没有完整插入脚本、调用/返回栈。

**缺口**：① LocalizationJpn/服务器表解析与自动加载；② ％！（INSERT）与 ￥（RETURN）语义；③ "调用/返回栈"是否存在。

**原生机制与证据**
- 【引用】marker-table.md / closure-meta-assets.md：12 个控制符全部来自本地化表（键名固定、值随语言）：`SCRIPT_ACTION_CODE_LABEL=＄`、`TALK=＠`、`SWITCH_CASE=？`、`SWITCH_END=？！`、`SPLIT=：`、`HIDDEN=；`、`COMMENT=＊`、`SCENE=＃`、`INSERT=％！`、`VOICE=％％`、`RETURN=￥`、`CLASS_SPLIT=：`；运行时映射到 `ScriptManager` 字段 0x658-0x6A8（`Initialize` 0x31a10b0-0x31a125c，`LocalizationManager.Get` 0x2e58030）；内置默认表 = APK 内 TextAsset `LocalizationJpn`（data.unity3d pathID 98），可被 AssetStorage `"Localization"` 覆盖（`LoadAssetData` 0x2e57c24 → `AssetManager.loadAssetStorage`）；`SetTextData` 0x2e5c768 解析表文本。
- 【实证】％！/￥ 的解析入口：`AnalysScript` 里 `StartsWith(line, codeInsertString)` 0x31a5b38（命中后进 0x31a66e0 分支，行循环继续/插装路径）；`codeReturnString(0x6A8)` 出现于一段 `String.Replace(?, ￥, '[r]')`（0x31a6594，x1=codeReturnString、x2=`'[r]'`）——即 RETURN 字符在文本处理路径被换成换行。两者语料均 0 次，**完整语义未闭环（INFERRED）**。
- 【实证】`dump.cs` 全库检索无 `returnIndex/callStack/jumpStack/scriptStack` 字段 → 不存在显式"调用/返回栈"字段；`jump <label> [<script>]`（params-misc：handler 0x31801a4 → `LoadExecuteScript`）承担跨脚本跳转，且不会自动返回。
- 【引用】行分隔符：`AnalysScript` 的 `char[4]{U+BBBF,U+FEFF,U+FFFE,U+000A}`（closure-meta-assets §A），语料实际只用 LF，`Replace("\r","")` 归一化。

**收口步骤**
1. 本地化（可完整实现）：按键名读表（可复用 `LocalizationJpn` 解析或服务器 `Localization` storage），控制符全部配置化；解析表文本时按 §A 的分隔符集合断行并忽略 `//`。
2. ％！/￥（语料 0 次，按"识别+安全降级"收口）：解析期识别该两前缀并**记录+按字面/跳过处理**（不报未知错误）；若要完整实现插入脚本，以 0x31a5b38→0x31a66e0 分支为入口继续逆向（需样本：含 ％！/￥ 的旧活动脚本）。
3. "调用/返回栈"：当前证据表明**不需要实现**（无栈字段；￥更接近文本标记）；保留该项为"待样本证实"。
4. markers 覆盖：控制符可被服务器表覆盖 → 播放器禁止硬编码 `＠/＄/？`（当前可配置 API 已满足，补上默认表加载即可）。

**置信度**：本地化链 = high（文档+本次字段复核）；insert/return 语义 = 低（INFERRED，需样本）。

---

## 17. 原始资源链（AssetStorage、AssetBundle、CharaFigure Form/默认资源回退）

**当前实现**：运行时使用 Atlas 或 ZIP 显式映射；没有接入 AssetStorage 解密/CRC、全部 keyType、AssetBundle 转换与 Unity 原始资源执行；立绘 Form 路径和原生默认资源回退链也未完整覆盖。

**原生机制与证据（结合 asset-pipeline.md）**
- 解密链（**已打通**，asset-pipeline.md §2）：`AssetStorage.txt`(base64 文本) → `Convert.FromBase64String` → `CatAndMouseGame.MouseGame8`(0x2e4fe9c)：`MouseHomeMainZ2`(0x2e4ffec, Rijndael-256-CBC/PKCS7, key=stageData/iv=stageTop) 或回退 `MouseHomeMain`(0x2e4ea14, +`DataDecryptor` 0x2e5199c) → 逐字节 NOT(`mvn`, 0x2e4ff80-0x2e4ff9c) → UTF8。明文 `~<crc32>` + 后随全部字节(含末尾换行)做 CRC-32 校验；记录以 `@` 开头。密钥 = `CatAndMouseGame..cctor`(0x2e4bffc) 对两个 64 字符字面量**奇偶拆位**（`stageData/stageTop/baseData/baseTop`；直接拿 dump.cs 的 SKEY 会解不开）。
- 包命名与解密（asset-pipeline.md §3）：`DownloadName`(0x2d9cfdc)/`CacheName`(0x2d9d140)/`Path`(0x2d9d284)/`Url`(0x2d9cf3c)/`Key`(0x2d9d398 → `CatAndMouseGame.GetAssetbundleKey` 0x2e51200)；`ASSETBUNDLE_SPLIT_BASE_CHAR '/'`/`CACHE_CHAR '@'`/`HASH_CHAR '@'`/`NOT_HASH_CHAR '_'`（`AssetData..cctor` 0x2d9ec34）；包体 = bzip2 或 gzip（`BZ` 魔数区分）。密钥材料：`SetAssetbundleKeys` 0x2e50fa4 / `AddAssetbundleKeys` 0x2e510f0 / `keyCollection`/`assetbundleKeyCollection`。
- 脚本资源（closure-meta-assets §C）：`ScriptActionEncrypt/` + 名称前 2 位（`94` 特例 = `94/前4位`）；清单 `ScriptActionEncrypt/ScriptFileList`（`EndLoadScriptFileListAssetData` 0x31a22e8，按 `\n` 切分+排序+`ScriptEncryptSettings`）；解密 = `AssetData.GetDecryptObjectText(name, ScriptEncryptSettings.GetKey(name))`（0x31710a4/0x2d9e830）；存在性 = 名字+`".txt"`（0x319bf3c）。
- 立绘 Form 与回退（composition.md §1.2）：`UIStandFigureRender.GetAssetNameWithForm` 0x310c31c：`CharaFigure/` + `Form/{form}/` + `servantId`；先 `AssetManager.isExistAssetStorage` 0x2da2ba0 → 失败退 `CharaFigure/{id}` → 再失败 **`CharaFigure/1000000`**；`GetCharaImageNameAndFormId` 0x31c5f4c 从 `100100form2` 解析 (`100100`,2)。
- 其他回退：`CharaGraph/100000`、装备 `CharaGraph/9400010`、`Image/00001`、`NarrowFigure/100000`（composition §1.2）。

**落地缺口清单（本次整理）**
| # | 缺口 | 现状 | 收口条件 |
|---|---|---|---|
| 1 | AssetStorage 解密+CRC 进播放器 | tools/fgo_assets.py 已实现可复用；播放器仍用 Atlas/ZIP 显式映射 | **需游戏缓存**：APK 内是桩文件（仅 1 行数据版本），完整清单需游戏下载目录 |
| 2 | keyType → 具体 `CatGame*/MouseGame*` 组合 | 代码按 keyType 分派，未逐一枚举（asset-pipeline §5 未验证） | 需真实包样本逐个试解（工具已具备） |
| 3 | AssetBundle→Unity 资源 | 未接入；`.unity3d` 解密后还要 Unity 资源读取 | **需资源**：用 UnityPy 预转换 Texture/Sprite/TextAsset/Material |
| 4 | 立绘 Form 路径与回退链 | 部分（模板已知） | **可完整实现**（纯逻辑，见上 VA）；显示效果需立绘资源 |
| 5 | Unity 原始资源执行（shader/材质/粒子） | 未接入 | 需资源+真机（Web 端以近似替代） |
| 6 | CRI/CPK 音频、`.acf` | 未接入 | 需游戏数据（`Audio/*.cpk.bytes`、`assets/FGO.acf`） |
| 7 | 服务器本地化表 `Localization` | 未自动加载 | 见 §16；表内容在服务器（分服） |

**收口步骤**
1. （可完整实现）把 `GetScriptAssetName`/`IsExistScriptFile`/`Q/E/W` 条目键规则接进脚本加载器（closure-meta-assets §C.6 已给规则）；脚本解密复用 `tools/rijndael256.py`/`fgo_script_parser.py`。
2. （可完整实现）立绘 Form 解析 + 三级回退链（`Form/{f}/` → 无 Form → `1000000`），先按"存在性探测"实现，资产缺失时按回退链降级。
3. （需游戏缓存/数据）AssetStorage/keyType/AssetBundle：接入 `tools/fgo_assets.py` 的解密函数，资源清单指向游戏缓存目录；对每个包的 keyType 做一次自动试解（bzip2/gzip + 各 key 组合）以补全映射表。
4. （需资源）Unity 资源转换：离线把 `.unity3d` 批量转成 Web 可用格式（贴图/图集/材质参数），播放器只消费转换产物；shader 类资源（`_FilterParam` 混合、wipe Gradation、blur）以等价实现替代。
5. （需真机）用真机抓一次完整下载目录，验证：CRC 校验、`ScriptFileList` 规模、`Wipe/`/`Effect/` 的实际资产形态。

**置信度**：解密链 = high（asset-pipeline 已验证+工具可复现）；keyType/包内资源 = 未验证（需数据）；Form 回退链 = high（文档 VA）。

---

## 小结

### 四类归档（22 项）

**A. 可立即收口（纯逻辑，无需新资源/数据）**
| 项 | 可直接落地的部分 | 备注 |
|---|---|---|
| 5 | imageSet 第 3 参=SetPosition 下标、第 4 参=SetFullScreenScaleType；master* 双资源按性别选择 | 站位/类型值已闭环 |
| 7 | FSL/FSR/FSSide/NotNotch 全公式（含 GetForceOffsetX 分支） | 本次逐指令 |
| 8 | 循环移动分段结构（长度=6n+5）、flash 两段+once/loop/pingpong | 用分段线性替换正弦 |
| 9 | charaTalk on/off/depthOn/depthOff 状态位 + 非发言者压暗 | 视觉量值可先取经验值 |
| 10 | charaFilter 的 filterName/filterColor 传递与 silhouet 着色外壳 | RGB/A 混色公式需资源 |
| 11 | 音频参数全量消费（fadeTime/fadeoutTime）+ keep 表 + stop-at-end | 跨脚本续播映射为强推断 |
| 12 | delay 区间模型 + wait 的 72 键分派框架 + 4 个时间键 + `(wt|k)` 字数规则 | 60 命令键：框架可先接 busy 谓词 |
| 13 | skip/tapSkip/autoAndBackLog/backlogStart|End 全部字段级语义 | 本次逐指令 |
| 14 | 条件求值接口（IsQuestPhaseClear 语义）+ `[%N]` 替换器（含空串+`[-]`） | 数据源外接 |
| 15 | `[f]` 双参（字号+垂直对齐、6 档像素） | 字体资源另列 |
| 16 | 控制符表驱动（含默认表加载、禁止硬编码） | ％！/￥ 先安全降级 |
| 17 | 脚本资源命名/存在性/Q|E|W、立绘 Form 解析+回退链 | 属加载器逻辑 |
| 3 | subCameraOn/subRenderDepth 的消费逻辑、#MASK 作为普通 `#` 组 | shader 合成另列 |
| 4 | 双缓冲数据模型 + `charaFaceFade/CrossFade` 的 WAIT 语义 | 曲线需真机 |
| 6 | 任意轴旋转模型 + centerOffset→transform-origin 换算 | RollEx 细节待对拍 |
| 1 | mask 的 in/out/Kind/clear 语义；wipe 参数全量解析 | 纹理/shader 另列 |

**B. 需资源（纹理/shader/字体/prefab）**
- 1（Wipe/`<name>` 纹理、`_Gradation` shader、cutVer 5 段网格资产）
- 2（`Custom/Sprite-ScriptActionRender*` 系列 shader、cut359_mask* 纹理）
- 3（#MASK 合成材质/shader）
- 5（CharaGraph/卡面图、装备专用渲染 prefab）
- 10（Figure 着色 shader 的精确混合）
- 15（`Font/*` 字体与图标资源）
- 17（AssetBundle 内 Unity 资源、材质/粒子/shader）
- 8、4、6 的视觉精度（mesh/atlas）

**C. 需游戏数据（用户档/主数据/音频包/服务器表）**
- 11（CPK/CRI 音频与 cue sheet、`FGO.acf`）
- 14（任务通关进度、从者数量、任务标题/文本）
- 15（`tRaidShortName`/`tRoute`/`tFlag` 表、从者名上下文）
- 16（服务器 `Localization` storage 内容、分服控制符）
- 17（生产 AssetStorage 完整清单、keyType 映射、缓存目录）

**D. 需真机样本（对拍/验证）**
- 4（FADE/BLINK/CROSS_FADE 曲线）
- 8（pingpong 与 `*Dep` 全族；语料 0 次）
- 9（SetTalkMask/SetTalkDepth 的视觉量值；`=spot` 多槽展开）
- 12（skipDropFlag 0/1 方向；60 命令键的完成粒度）
- 13（与 UI 自动/跳读/回想的交互时序）
- 16（含 ％！/￥ 的旧脚本样本）
- 2（maskEdge 合成的视觉）
- 7（`forceObi`/刘海机的 notchWidth）

### 建议优先级（P0 → P3）
1. **P0（纯逻辑、高收益、低风险）**：7（公式一次性闭合）→ 5（imageSet/master* 位义）→ 9（talk 状态位）→ 13（自动/跳读策略位）→ 4/6/8 的模型部分（双缓冲、任意轴、分段循环）。
2. **P1（时间/等待主链）**：12 的 time/rtime/frame/skippableTime + `(wt|k)` + wait 框架；11 的参数顺序与 keep 表；3 的子层组模型。
3. **P2（资源依赖，先外壳后替换）**：1（mask 先收口、wipe 纹理后补）、2（滤镜映射表先建、shader 后补）、10（着色外壳）、15（字体/图标）、17（资源管道接入）。
4. **P3（数据/真机依赖，可延后）**：14（数据源接入）、11（CRI 音频）、15（稀有替换器）、16（％！/￥ 语义）、8（pingpong/Dep）。

### 对既有文档的最小修订建议
1. `params-visual.md`：`charaRollAxis` 的 `pd[2]` 由"立绘/资源名"改为 **axis 字符串**（证据 0x31798cc + `StartRollAxis` 签名 0x31E3408）。
2. `supplement-presentation-composition.md` §E.2：`imageSet` 第 3 参位义 INFERRED → **已闭环**（= `SetPosition` 站位下标；第 4 参 = `SetFullScreenScaleType` 类型）。
3. `presentation.md` §4.3：`blur` 的 "即 GaussianBlur start（推断）" → **lens/motion/glass → GaussianBlur/MotionBlur/FrostedGlass**（VA 见 §2），subBlur 为 `*Through` 版本。
4. `composition.md` §2.3：补 FSSide 精确公式（`GetForceOffsetX(flag,0)`，不做 Vista 门控、不加 80 边距；`GetCalcOffsetX` 完整式见 §7）。
5. `params-misc.md`：`skip/tapSkip/autoAndBackLog/backlogStart|End` 可补字段级语义（§13）；`branchQuestClear/NotClear` 补 `CondType.IsQuestPhaseClear`(0x2d70ad8) 调用点（§14）。

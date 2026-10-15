# 未还原功能与原因清单

核查日期：2026-10-14。本文件保留为**补齐前的历史快照**。根据补齐指南进行的开发、验证及剩余资源边界见 [ADV 补齐开发状态](adv-implementation-status.md)，下列“未实现”统计不再代表当前代码。

## 统计口径

- 366 条是命令名识别数量。
- 其中 **154 条缺少实际处理分支**，完整名单分组列在下面。
- 其余 212 条只能说明存在处理、转换或跳过路径，包含近似、部分实现及原生空实现，不能称为 212 条完全还原。
- 本次检查对命令分派提供已存在的 A–Z 槽位，避免“缺槽位直接返回”掩盖未实现命令；结合执行器分支核对。不是视觉对拍或参数全形态验证。
- `effectmessage` 和若干行内替换标记不在这 366 条内，另列于部分实现表。

## 没有实际处理分支的命令（154 条）

| 功能组 | 数量 | 原因 |
|---|---:|---|
| 常规、前后景及角色特效 | 41 | 缺少特效加载、实例化、更新、暂停及销毁后端；完整画面还需要 Unity prefab、粒子、材质、纹理和动画资源。 |
| 通讯窗口 | 5 | 通讯窗口状态、头像、循环和关闭效果的处理器尚未编写；通信特效也未接入。 |
| 角色切入与攻击 | 6 | 切入/切出/攻击状态、暂停/恢复及关联效果协作尚未实现，不能全部归为资源缺失。 |
| 角色循环及复位 | 5 | 淡变速度、循环透明度、专用复位和轴旋转循环停止逻辑尚未实现。 |
| PlayMaker FSM | 8 | 缺少 FSM 对象、变量、事件和状态切换后端，以及原始 FSM 图和动作实现。 |
| 插入动画 | 7 | 未加载 InsertionAnimations/{name}/{name} prefab，也没有动画时间轴和完整生命周期。 |
| ADV prefab / 3D 演出 | 6 | 演员对象、Animator trigger、模型/骨骼及 RenderTexture 合成后端未实现；部分原始参数还需确认。 |
| 影片 | 2 | MP4 播放组件尚未接入；USM/CRI 另缺解码与资源后端。MP4 的缺口属于实现未完成。 |
| CRI cue 与 BGM 保留 | 11 | 缺少 cue sheet/bank 寻址、CPK/CRI 读取和续播控制；普通文件音频播放不能覆盖。 |
| 游戏条件分支 | 9 | 素材、礼装、路线和冠位设置条件缺少游戏状态来源与求值器，相关命令处理器尚未编写。 |
| 随机旗标 | 1 | 未实现随机值、可持久化随机种子和一致的恢复/回退重放规则。 |
| 游戏流程及名字宽度判断 | 4 | 任务文本改写、复活、奖励界面及名字宽度判断尚未实现；名字宽度判断属于本地实现缺口。 |
| 消息窗、字体和头像 | 13 | 窗口切换、行距、垂直对齐、抖动、强制速度、名字底板、头像及旧消息控制形式尚未实现；部分还需字体/窗口资源。 |
| 菜单及显式选项命令 | 5 | 菜单、通知、居中及显式 switchCase 命令尚未接入；全角 ？/？！ 行编译出的选项可以正常使用。 |
| 截屏及渲染模式 | 4 | 截图纹理生命周期、相机清屏色及简化 mesh 模式没有处理器。 |
| 畸变及精灵遮罩 | 6 | 没有畸变、精灵遮罩与对应 RenderTexture/shader 后端。 |
| 拉伸、翻页和滚动 | 10 | 画面变形、翻页、滚动状态及停止逻辑尚未实现；部分参数/资源还需核实。 |
| 结束淡出 | 1 | 没有实现结尾淡出与结束执行的衔接。 |
| 战棋/战斗演出 | 10 | 未建立地图格/坐标、棋子、战斗演员和战棋相机模型。该语料集未覆盖这些专用演出，仍需对应样本与资源。 |

### 常规、前后景及角色特效（41 条）

`backEffect`、`backEffectDestroy`、`backEffectPause`、`backEffectStart`、`backEffectStop`、`charaBackEffect`、`charaBackEffectDestroy`、`charaBackEffectPause`、`charaBackEffectStart`、`charaBackEffectStop`、`charaEffect`、`charaEffectDestroy`、`charaEffectEdgeBlur`、`charaEffectEdgeBlurDestroy`、`charaEffectEdgeBlurPause`、`charaEffectEdgeBlurStart`、`charaEffectEdgeBlurStop`、`charaEffectPause`、`charaEffectStart`、`charaEffectStop`、`charaSpecialEffect`、`charaSpecialEffectPause`、`charaSpecialEffectStart`、`charaSpecialEffectStop`、`effect`、`effectDestroy`、`effectForceStop`、`effectPause`、`effectStart`、`effectStop`、`effectmessageDestroy`、`effectmessageStop`、`fowardEffect`、`fowardEffectDestroy`、`fowardEffectPause`、`fowardEffectStart`、`fowardEffectStop`、`specialEffect`、`specialEffectPuase`、`specialEffectStart`、`specialEffectStop`。

缺少特效加载、实例化、更新、暂停及销毁后端；完整画面还需要 Unity prefab、粒子、材质、纹理和动画资源。

### 通讯窗口（5 条）

`communicationChara`、`communicationCharaClear`、`communicationCharaFace`、`communicationCharaLoop`、`communicationCharaStop`。

通讯窗口状态、头像、循环和关闭效果的处理器尚未编写；通信特效也未接入。

### 角色切入与攻击（6 条）

`charaAttack`、`charaCutStop`、`charaCutin`、`charaCutinPause`、`charaCutinStart`、`charaCutout`。

切入/切出/攻击状态、暂停/恢复及关联效果协作尚未实现，不能全部归为资源缺失。

### 角色循环及复位（5 条）

`charaFadeSpeed`、`charaFadeTimeLoop`、`charaFadeTimeLoopStop`、`charaReturn`、`charaRollAxisLoopStop`。

淡变速度、循环透明度、专用复位和轴旋转循环停止逻辑尚未实现。

### PlayMaker FSM（8 条）

`fsmObjDestroy`、`fsmObjLayer`、`fsmObjSendEvent`、`fsmObjSet`、`fsmObjSetBool`、`fsmObjSetFloat`、`fsmObjSetState`、`fsmObjSetString`。

缺少 FSM 对象、变量、事件和状态切换后端，以及原始 FSM 图和动作实现。

### 插入动画（7 条）

`insertionAnimationEnd`、`insertionAnimationSet`、`insertionAnimationSetFSL`、`insertionAnimationSetFSR`、`insertionAnimationSetFSSideL`、`insertionAnimationSetFSSideR`、`insertionAnimationStart`。

未加载 InsertionAnimations/{name}/{name} prefab，也没有动画时间轴和完整生命周期。

### ADV prefab / 3D 演出（6 条）

`advActorHide`、`advActorShow`、`advPlayAnimator`、`advPrepare`、`advRelease`、`advSet`。

演员对象、Animator trigger、模型/骨骼及 RenderTexture 合成后端未实现；部分原始参数还需确认。

### 影片（2 条）

`criMovie`、`movie`。

MP4 播放组件尚未接入；USM/CRI 另缺解码与资源后端。MP4 的缺口属于实现未完成。

### CRI cue 与 BGM 保留（11 条）

`cueSe`、`cueSeContinue`、`cueSeContinueStop`、`cueSeContinueVolume`、`cueSeStop`、`cueSeVolume`、`cueVoice`、`cueVoiceStop`、`cueVoiceVolume`、`keepSubBgmOff`、`keepSubBgmOn`。

缺少 cue sheet/bank 寻址、CPK/CRI 读取和续播控制；普通文件音频播放不能覆盖。

### 游戏条件分支（9 条）

`branchHaveSvtEquip`、`branchMaterial`、`branchNotHaveSvtEquip`、`branchNotMaterial`、`branchNotRouteSelect`、`branchNotRouteSelectCount`、`branchRouteSelect`、`branchRouteSelectCount`、`branchSetGrandSvtCount`。

素材、礼装、路线和冠位设置条件缺少游戏状态来源与求值器，相关命令处理器尚未编写。

### 随机旗标（1 条）

`flagRandom`。

未实现随机值、可持久化随机种子和一致的恢复/回退重放规则。

### 游戏流程及名字宽度判断（4 条）

`masterNameWidth`、`questMessageOverwrite`、`revivalBranch`、`rewardSwitch`。

任务文本改写、复活、奖励界面及名字宽度判断尚未实现；名字宽度判断属于本地实现缺口。

### 消息窗、字体和头像（13 条）

`betweenHeight`、`charaFaceIcon`、`faceTalkScreen`、`fontType`、`l`、`messageAlign`、`messageChange`、`messageShake`、`messageShakeStop`、`messageSpeedForcedNormal`、`messageStart`、`page`、`talkNameBack`。

窗口切换、行距、垂直对齐、抖动、强制速度、名字底板、头像及旧消息控制形式尚未实现；部分还需字体/窗口资源。

### 菜单及显式选项命令（5 条）

`menu`、`notification`、`selectionCentering`、`switchCase`、`switchCaseEnd`。

菜单、通知、居中及显式 switchCase 命令尚未接入；全角 ？/？！ 行编译出的选项可以正常使用。

### 截屏及渲染模式（4 条）

`backCameraColor`、`capture`、`captureRelease`、`useSimpleMeshFigure`。

截图纹理生命周期、相机清屏色及简化 mesh 模式没有处理器。

### 畸变及精灵遮罩（6 条）

`charaMask`、`distortionloop`、`distortionstart`、`distortionstop`、`spriteMaskOff`、`spriteMaskSet`。

没有畸变、精灵遮罩与对应 RenderTexture/shader 后端。

### 拉伸、翻页和滚动（10 条）

`screen`、`scrollStop`、`stretchOff`、`stretchin`、`stretchout`、`subStretch`、`subStretchin`、`subStretchout`、`turnPageOff`、`turnPageOn`。

画面变形、翻页、滚动状态及停止逻辑尚未实现；部分参数/资源还需核实。

### 结束淡出（1 条）

`endFade`。

没有实现结尾淡出与结束执行的衔接。

### 战棋/战斗演出（10 条）

`warBoardTalkScreen`、`warCharaFadein`、`warEffectOff`、`warEffectPiece`、`warEffectPos`、`warEffectSquare`、`warEventScript`、`warMoveCameraPiece`、`warMoveCameraPos`、`warMoveCameraSquare`。

未建立地图格/坐标、棋子、战斗演员和战棋相机模型。该语料集未覆盖这些专用演出，仍需对应样本与资源。

## 已有基础路径，但没有完整还原

| 功能 | 命令或参数 | 当前缺口与原因 |
|---|---|---|
| 划像与遮罩转场 | wipein/out、wipeFilter/Ex、maskin/out | 划像使用几类 CSS clip-path；mask 当前作为全屏颜色淡变。没有原始 Wipe prefab、网格、纹理和 shader，level 等参数未完整使用。 |
| 滤镜和模糊 | cameraFilter、subCameraFilter、blur、subBlur/subBlur2 | 仅 gray/inversion/darkred 等 CSS 滤镜和统一 CSS blur。镜头/运动/玻璃模糊、aberration、maskEdge 及滤镜参数未等效实现。 |
| 子层遮罩和精确合成 | subCameraFilter ... #MASK、subCameraOn、subRenderDepth | 组间 #MASK 纹理合成未实现；数字子层数没有完整消费。DOM 的 z-index 替代原相机/UIPanel/RenderTexture 栈，原始默认深度仍有资料缺口。 |
| 表情和立绘切换 | charaFaceFade、charaCrossFade、charaChange | 已有图片/表情切换，但淡变形式目前直接改 face/id；没有旧/新表情和立绘的双缓冲交叉渐变。 |
| 装备与图片种类 | equipSet/Change、verticalImage*/horizontalImage*、imageSet/master*Image* | 装备暂按普通立绘处理，未接 CharaGraph 专用渲染；各种图片使用统一图片节点，模式位及专用布局未完整消费。imageSet 1/2 的位义在逆向资料中仍标为推断。 |
| 旋转和相机 pivot | charaRollAxis、charaRollMoveEx、cameraRoll/subCameraRoll | 主要是 CSS Z 轴旋转；X/Y 轴、双节点 pivot 和部分 Ex 参数未实现。 |
| 屏幕边缘变体 | FSL/FSR/FSSideL/FSSideR/NotNotch | 共用简化的宽高比偏移；没有完整区分 Side、NotNotch 和刘海安全边距。 |
| 角色循环移动和闪光 | charaRelativeLoopMove*、flashin 的 loop/pingpong 与 Dep 变体 | 循环移动用正弦轨迹，循环闪光用余弦透明度；没有完整 native 往返曲线和不同模式、颜色/依赖角色 mesh 的区别。 |
| 发言者演出 | charaTalk on/off/depthOn/depthOff | 记录 talkSlots 和 talkDepth，但 talkDepth 未进入合成，active/inactive 类没有原生聚光、暗化和深度切换效果。 |
| 角色着色 | charaFilter | 已有黑色剪影；记录的着色值未实际用于指定色彩/alpha 的 shader 渲染。 |
| 音频淡出与跨脚本续播 | bgm、bgmStop*、seStop、seContinue*、soundStopAll* | 普通音频可播放；部分尾参没有消费，停止主要是直接停止，BGM 淡变使用阅读器自己的逻辑。新执行器 start 会 stopAll，跨脚本续播 ID/保持状态未还原。 |
| 延迟与等待 | delay/tdelay、wait 的各子关键字 | 延迟区间只把普通演出命令交给演出处理器；跳过对话、wait 和复杂流程，嵌套/文本速度/skipDropFlag 未实现。等待按少量轨道家族或真实音频查询，未覆盖逆向表中完整 72 键的精确完成条件。 |
| 自动播放和跳读 | skip、tapSkip、autoAndBackLog、backlogStart/End | 这些脚本命令目前直接跳过；UI 自己的自动/跳读/回想功能仍可用，但没有执行脚本对它们的策略限制。 |
| 任务条件和变量数据 | branchQuestClear/NotClear、[%2]…[%5] | 接口能接受 questClear 和 variables；当前读取流程未提供游戏任务状态/从者数量等数据。未知任务按未完成处理，未给变量显示空串。 |
| 字体、图标及稀有行内标记 | [f size top/center/bottom]、[i]、[image]、servantName、tRoute、tFlag、tRaidShortName | 字号第二参未处理，图片/图标使用普通图片而非原生排版；后四类没有专用替换器，未知标记保留字面文本。effectmessage 作为行内动作可解析，但没有特效执行器。 |
| 本地化及嵌套脚本 | markers 覆盖、％！、￥ | 有可配置控制符 API，但未自动加载服务器本地化表。稀有控制符只有简化转换，没有完整插入脚本、调用/返回栈。 |
| 原始资源链 | AssetStorage、AssetBundle、CharaFigure Form/默认资源回退 | 运行时使用 Atlas 或 ZIP 显式映射；没有接入 AssetStorage 解密/CRC、全部 keyType、AssetBundle 转换与 Unity 原始资源执行。立绘 Form 路径和原生默认资源回退链也未完整覆盖。 |

## 不计为未还原的原生空实现

`advSoundSet`、`delayEnd`、`enableFullScreen`、`enableWaitLoadAssetWhenResume` 在该版本的逆向证据中直接进入空 handler。它们被跳过符合这部分证据；其中 delayEnd 仍承担区间边界定位。

## 诊断和验证边界

完全未实现的命令多数会记录诊断。已近似处理、部分参数被忽略或被主动跳过的命令**不一定会告警**，所以“没有告警”不能作为完全还原的证明。

124 项测试和 2,583 份脚本编译检查验证现有行为及语法结构，没有证明全部指令、全部参数形态或原始视觉效果一致。

## 对照文件

- [命令分派](../src/adv/commands.ts)、[执行与等待](../src/adv/executor.ts)
- [舞台合成](../src/components/StoryStage.tsx)、[立绘渲染](../src/components/StageSprites.tsx)
- [演出逆向](out/presentation.md)、[资源与图层](out/composition.md)
- [实证修正与未决参数](out/supplement-presentation-composition.md)、[覆盖核查](out/coverage-verification.md)


# FGO 非官方剧情阅读器实现标准与指导

本文面向基于 FGO 反编译结果和已导出的剧情脚本实现独立剧情阅读器的开发者。

> **配套参考**：完整的词法、参数约定、267 个标签/伪标签的统计、签名、示例与语义索引见 [FGO脚本语法全集与命令参考.md](FGO脚本语法全集与命令参考.md)。

目标是复现剧情脚本的可观察行为：文本、背景、立绘、镜头、转场、音频、选择分支和常用演出。目标不是复刻 Unity/NGUI/PlayMaker 的内部实现，也不要求运行官方客户端。

本文以当前仓库中的 IL2CPP 导出结果为基线，主要证据包括：

- `fgo_dump/dump.cs`：类型、字段、方法签名、枚举和 RVA。
- `fgo_dump/script_file_tags.json`：2,583 个脚本文件中的标签统计和参数样本。
- `fgo_dump/tag_inventory.json`：标签频率、参数形态和样本。
- `fgo_dump/tag_handlers.json`：标签分支的调用摘要。
- `fgo_dump/FGO剧情引擎分析报告.md`：总体定位和反编译过程记录，仅作为辅助材料。

当前基线应标记为 `FGO-script-engine-2.138.0`。标签、资源命名、脚本加密和演出对象都可能随客户端版本变化，阅读器必须保留版本适配层。

## 1. 设计目标和边界

### 1.1 必须达到的目标

阅读器应当能够：

1. 载入一个脚本文件或脚本片段，并按标签顺序执行。
2. 显示普通对话、角色名、颜色、换行、等待点击、逐字显示、注音和行内图片。
3. 显示并控制背景、五类剧情显示对象、层级、位置、缩放、透明度、表情和常用特效。
4. 执行淡入淡出、闪白、遮罩、擦除、抖动、镜头移动和镜头旋转。
5. 播放 BGM、SE、循环 SE、语音和 CRI 电影；资源不可用时能继续阅读。
6. 执行常见标签控制流：`label`、`jump`、`branch`、`flag`、`ifClear`、`else`、`endIf`、`selectBranch` 相关流程。
7. 支持暂停、快进、自动播放、跳过、回看、选择和断点恢复。
8. 对未实现标签、参数异常和缺失资源提供可诊断的降级行为，而不是静默卡死。

### 1.2 不应假定的事项

以下内容不能仅凭当前导出结果假定为稳定协议：

- 所有标签的参数数量和参数类型。统计结果显示同一标签存在多种签名。
- 坐标索引对应的具体像素位置。`ScriptPosition` 只暴露了静态表的访问方法，具体表值需要从目标版本运行时或资源中提取。
- 脚本解密算法本身。当前结果确认存在 `ScriptEncryptSettings.GetKey` 和按脚本名选择 key 的流程，但不等于已经得到通用解密器。
- FGO 资源包的完整命名和加载规则。`AssetManager`、`AssetData`、`ItemSeed` 等对象属于官方资源系统，独立阅读器应通过适配器访问资源。
- PlayMaker FSM 和 ADV Prefab 的具体内容。它们是数据驱动演出容器，不能把 `[fsm]` 当作普通静态图片标签处理。

### 1.3 证据等级

实现文档、代码注释和兼容性报告建议使用以下标记：

- **E0：直接证据**：`dump.cs` 中的类型/字段/方法签名，或样本脚本中可重复观察的语法。
- **E1：强关联证据**：`tag_handlers.json` 中的调用链，能确定目标对象或副作用，但未确认全部参数语义。
- **E2：统计推断**：由标签频率、参数样本或同类标签归纳出的行为。
- **E3：待验证假设**：需要真实资源、运行时跟踪、更多版本或画面对比验证。

实现时不得把 E2/E3 写成“协议保证”。

## 2. 总体架构标准

推荐将阅读器拆成六层。解析器不应直接操作渲染对象，渲染器也不应解析原始字符串。

```text
ScriptSource
  -> SourceLoader / optional Decryptor
  -> Lexer + LineParser
  -> Normalized IR + source mapping
  -> ScriptVM / control flow / waits / substitutions
  -> Runtime SceneState
  -> Renderer, AudioBackend, InputBackend, AssetResolver
```

### 2.1 模块职责

| 模块 | 职责 | 禁止承担的职责 |
|---|---|---|
| `SourceLoader` | 读取 UTF-8 文本、脚本索引、版本信息 | 解释标签 |
| `Decryptor` | 根据版本和脚本名解密 | 猜测 key 或静默返回乱码 |
| `Lexer` | 识别场景头、标签、对话行和原始文本 | 修改业务状态 |
| `Normalizer` | 参数类型化、保留 raw 参数、生成 IR | 加载资源或播放动画 |
| `ScriptVM` | PC、跳转、等待、分支、替换、断点 | 依赖具体 UI 框架 |
| `SceneState` | 背景、角色、相机、音频和特效的纯数据状态 | 直接创建纹理或 UI |
| `Renderer` | 将 SceneState 渲染到目标平台 | 解析原始脚本 |
| `AssetResolver` | ID/名称到图片、字体、音频、视频、FSM 资源的映射 | 依赖脚本 PC |
| `Diagnostics` | 错误、未知标签、资源缺失、统计和截图标记 | 阻断所有后续脚本 |

### 2.2 规范化中间表示

每条脚本记录至少包含：

```text
Instruction {
    index: int                 // 逻辑执行索引，等价于 executeIndex
    sourceLine: int            // executeLineList
    originalLine: int          // executeOrgLineList；没有时等于 sourceLine
    tag: string                // 小写/大小写按原文保存，分发 key 建议大小写敏感
    args: List<Arg>             // 类型化参数
    rawArgs: List<string>      // 永久保留，供未知标签和版本适配
    rawText: string            // 原始标签或对话内容
    message: bool              // 对应 executeMessageFlagList
    switchIndex: int?          // 对应 executeSwitchList
    sourceFile: string
}
```

`Arg` 至少支持 `String`、`Int`、`Float`、`Bool`、`Color`、`Position`、`CharacterRef`、`LabelRef` 和 `Raw`。类型化失败时必须保留 `Raw`，不能把失败值替换成 0 或空字符串。

`SceneState` 建议包含：

```text
SceneState {
    background: BackgroundState
    characters: Map<CharacterSlot, CharacterState>
    subLayers: Map<string, SubLayerState>
    mainCamera: CameraState
    message: MessageState
    transitions: TransitionState
    effects: EffectState
    audio: AudioState
    flags: Map<string, FlagValue>
    variables: Map<string, Value>
    metadata: RuntimeMetadata
}
```

每次指令执行应产生可选的 `SceneEvent`。例如 `SetCharacterFace`、`MoveCharacter`、`ShowMessage`、`StartFade`、`PlaySe`。事件用于日志、测试、录制和替换渲染后端。

## 3. 脚本源格式和词法标准

### 3.1 编码和行处理

1. 首选 UTF-8；保留 BOM 兼容能力。
2. 同时接受 `LF`、`CRLF` 和单独 `CR` 行尾。
3. 不应对全角符号做 ASCII 归一化。场景头使用的 `＄` 和对话前缀使用的 `＠` 必须按 Unicode 字符识别。
4. 去除行尾的 `CR` 和不可见 BOM；除非协议明确要求，否则不要 trim 对话正文中的前导/尾随空格。
5. 空行应作为 `Blank` 记录保留在解析诊断中，但一般不生成可执行指令。
6. 注释、插入段和原始脚本行应保留，以便断点和错误信息能回到原文。

### 3.2 顶层记录

当前样本和 `ScriptManager.ScriptAnalys`/`AnalysText` 的签名支持以下顶层形式：

```text
＄<场景头>
[<tag> <param> ...]
＠<talk-name>
<message-text>
```

一行中可以含有多个行内标记。标签参数不能简单使用 `Split(' ')` 处理，因为样本中出现了制表符、逗号坐标、空参数以及需要保留空格的文本。

### 3.3 标签词法

标签行的最小语法：

```ebnf
command  = "[", name, { whitespace, parameter }, whitespace, "]" ;
name     = 1*(not-whitespace, not-"]") ;
parameter = quoted | bare ;
quoted   = '"', { escaped | not-'"' }, '"' ;
bare     = 1*(not-whitespace, not-"]") ;
```

这是阅读器自己的容错语法，不声称是官方完整 BNF。解析器必须允许：

- `[scene \t260400]` 中的制表符。
- `position` 参数的 `0,0`、`0, 0`、`0,-200` 形式。
- `str` 参数中出现的短横线、问号、`#A`、数字和资源名。
- 不完整的 `]`。这类记录应生成错误诊断，并保留 raw 文本。

不要把所有十六进制字符串都预先解析成颜色。`se ad1048` 里的资源 ID 也可能由十六进制样式组成。只有标签 schema 声明为 `Color` 的参数才调用颜色解析。

### 3.4 对话行和说话者

`CommonMessageManager`、`ScriptMessageCommonManager` 和 `ScriptLineMessage` 均有独立的文本分析入口，说明对话是执行流中的一等记录，而不是普通标签的副作用。

推荐将对话拆成：

```text
Dialogue {
    talkNameRaw: string
    talkName: TalkName
    body: InlineTextDocument
    sourceLine: int
    voice: VoiceRef?
}

TalkName {
    imageName: string?
    className: string?
    characterName: string
    characterIndex: int?
}
```

`ScriptMessageLabel.GetTalkName`、`GetServantChangeName` 和 `ScriptManager.ConvertNameString` 表明说话者可能不是单纯显示文本。解析器必须保留 `talkNameRaw`，并将分解失败降级为普通名称。

### 3.5 行内文本标记

已确认或高可信的行内能力包括：

- `[r]`：换行。
- `[k]`：等待点击或消息段结束控制。
- `[line]`/行内 line：分隔线或图片型行元素。
- `[image ...]`、短图片标记：行内图片。
- `[#汉字:かな]`：注音/ruby。
- `[51d4ff]...[-]`：颜色开始和颜色恢复。
- 性别/玩家名替换，例如 `&彼:彼女` 及 `ScriptReplaceString` 相关替换。

不要通过正则把所有方括号都替换掉。应先扫描字符串并生成 token：

```text
TextToken = Plain | NewLine | WaitInput | Ruby(base, ruby) |
            ColorPush(color) | ColorPop | InlineImage(name, scale, offset) |
            Line(length) | FontSize(name) | Effect(name, params) | UnknownInline(raw)
```

颜色栈必须支持嵌套。遇到 `[-]` 时弹出最近一次颜色；栈为空时记录 warning 并恢复默认颜色。

注音不能按字符数简单对齐。`ScriptMessageLabel.UpdateRuby` 的存在表明主文字和 ruby 有独立 UILabel/布局数据。IR 应保存 base 文本和 ruby 文本，并让布局器决定宽度、字号、基线偏移。

## 4. 解析器实现标准

### 4.1 两阶段解析

建议分为两阶段：

**阶段 A：源解析**

1. 按物理行读取。
2. 识别场景头、标签行、对话名行、正文行和未知行。
3. 解析标签名与 raw 参数。
4. 为每条记录保存物理行号和原文。

**阶段 B：语义归一化**

1. 根据标签 schema 尝试将参数转为类型。
2. 解析坐标、颜色、布尔值、ease 名称和角色槽位。
3. 建立 label 索引和可能的跳转引用。
4. 建立 `message`、`switch`、延时和资源依赖信息。
5. 不执行任何副作用。

这样可以实现 `DebugScriptAnalys` 同类的“只分析不播放”工具，并且能在没有图片/音频时检查脚本结构。

### 4.2 参数转换规则

`ScriptManager` 暴露了以下转换方法，应在独立实现中设置对应适配函数：

| 官方侧方法 | 阅读器适配函数 | 规则 |
|---|---|---|
| `GetIntegerParameter` | `parseInt` | 十进制为主；失败保留 raw |
| `GetFloatParameter` | `parseFloat` | 使用 invariant culture；允许 `1.` |
| `GetPositionParameter` | `parsePosition` | 逗号分隔的 1/2/3 分量，保留空白 |
| `ConvertCharaIndex` | `resolveCharacterSlot` | 处理 `A`、`?`、数字及版本别名 |
| `ConvertCharaIndexTalk` | `resolveTalkSlot` | 与舞台角色槽位分开维护 |
| `ConvertNameString` | `resolveName` | 做玩家名、性别、覆盖文本替换 |
| `ConvertColor` | `parseColor` | 支持 RGB/RGBA 十六进制和命名颜色 |
| `ConvertTalkEffectName` | `resolveTalkEffect` | 仅做资源/别名映射 |
| `ConvertFontName` | `resolveFont` | 不存在时回退默认字体 |
| `ConvertWipeName` | `resolveWipe` | 不存在时使用普通淡出或直接切换 |
| `ConvertEffectFlipKind` | `parseFlip` | 支持官方别名和左右翻转 |
| `ConvertCRIMovie*` | `parseMovieOptions` | 独立处理 BGM/SE/Voice/Script pause |

颜色解析要明确 alpha 默认值。脚本样本同时存在 `FF0000` 和 `FF000080`，六位颜色应默认 alpha=255，八位颜色按 `RRGGBBAA` 解释，除非运行时跟踪证明目标版本采用其他排列。

### 4.3 预索引

解析完成后应生成：

```text
ProgramIndex {
    instructions: Instruction[]
    labels: Map<string, int[]>
    branchTargets: Map<int, BranchTargetInfo>
    messageIndexes: BitSet
    resourceDependencies: ResourceDependency[]
    sourceHash: string
    engineVersion: string
}
```

同名 label 不能直接覆盖。当前 `SearchBranchLabel` 有 `beforeExecuteIndex`、`isAfterSearch`、`selectBranchCount` 参数，说明搜索方向和出现次数可能参与选择。阅读器至少应保存所有命中位置，并在跳转时实现：

1. 优先选择符合当前 switch/branch 上下文的目标。
2. 否则按官方近似顺序选择目标。
3. 多目标或未命中时给出诊断。

## 5. 脚本虚拟机标准

### 5.1 执行状态

`ScriptManager.State` 和 `CommonMessageManager.State` 都包含 `IDLE`、`LOAD`、`EXECUTE`、`WAIT`、`EXIT`、视图和错误状态。独立 VM 至少需要：

```text
VmState = Created | Loading | Executing | Waiting | Selecting |
          MovieWaiting | Paused | Backlog | Exiting | Error | Completed
```

VM 内部至少维护：

- `pc`：当前指令索引。
- `wait`：等待种类、剩余时间、目标对象和是否可跳过。
- `playSpeed`：Pause/Normal/Fast。
- `skipMode`：跳过策略和禁止跳过标签。
- `selectedBranch`：当前选择及 route type。
- `flags`：脚本 flag。
- `parameterList`：与任务/玩家上下文相关的整数或长整数参数。
- `isMessageOffTalkMode`、`isTalkMask`、`isTalkDepth` 等消息状态。
- `activeMovie`、`activeFsm`、`activeEffects` 的等待句柄。

### 5.2 指令返回语义

`ScriptCommandExecuteReturnCode` 明确包含：

- `Normal`：当前指令处理完成，进入下一条。
- `Continue`：当前指令未完成或需要继续处理，保留 PC/等待状态。
- `ReturnFalse`：指令失败或要求执行路径退出。

不要把所有动画标签都同步执行。资源加载、淡入、移动、消息逐字显示、电影和选择都需要异步句柄：

```text
ExecuteResult = Advance(pc + 1)
              | KeepPc(waitHandle)
              | Jump(targetPc)
              | OpenChoice(choiceHandle)
              | Fail(diagnostic)
```

### 5.3 时间和播放速度

`ScriptManager` 同时存在 `scenarioSpeed`、`scenarioTextWaitTimeSecond`、`autoWaitTime`、`textStepTime`，并有 `IsNormalPlaySpeed`、`IsFastPlaySpeed`、`ModifyPlaySpeed`。

推荐采用单一时间上下文：

```text
effectiveDelta = realDelta * scenarioSpeed * speedMultiplier
```

但文字逐字速度和演出动画速度应分别计算，不能让快进跳过所有必须完成的状态清理。至少区分：

- `Text`：逐字间隔。
- `Tween`：位置、缩放、透明度、相机和转场。
- `Audio`：播放进度和淡入淡出。
- `Wait`：脚本显式等待。
- `Input`：点击/确认等待。

`[wt 1.0]`、`[wt 0,3]` 等样本显示等待参数存在多种形式。解析器应支持一个数值、逗号分隔数值以及命名 wait type。未知 wait type 默认记录 warning，并采用可点击继续的安全策略，不能无限等待。

### 5.4 跳过和自动播放

跳过模式应分为：

1. **快速显示当前消息**：立即完成逐字输出，但保留点击等待。
2. **跳过可跳过等待**：消化 `wt`、过渡和短动画。
3. **强制执行控制流**：仍执行 flag、branch、资源切换和结束清理。
4. **不可跳过节点**：选择、输入、关键电影或显式禁止跳过的演出必须暂停。

脚本中的 `skip false`、`tapSkip`、`messageSpeedForcedNormal`、`enableWaitLoadAssetWhenResume` 等标签说明跳过不是一个全局布尔值。每个 wait/command schema 应声明 `skippable` 和 `fastForwardPolicy`。

## 6. 控制流和状态变量

### 6.1 label/jump/branch

基本控制标签：

- `label name`：建立目标。
- `jump name`：无条件跳转；如果当前版本样本没有显式 `jump`，仍应保留 schema，因为 `JumpScriptCommand` 存在。
- `branch ...`：按条件选择目标或进入选择流程。
- `selectBranch`、`input selectBranch`：显示玩家选项并等待输入。
- `masterBranch`、`branchRouteSelect`、`branchRouteSelectCount`：路线/菜单类条件。
- `branchQuestClear`、`branchQuestNotClear`：任务完成条件。
- `ifClear`、`else`、`endIf`：少量脚本中的结构化条件。

条件系统建议抽象为：

```text
ConditionContext {
    flags: Map<string, FlagValue>
    questClear: Set<int>
    routeSelections: Map<string, int>
    parameters: long[]
    playerGender: int
    collectionMode: bool
}
```

### 6.2 Flag

`ScriptFlagData` 的字段为 `name` 和 `long v`，并暴露 `Comp(string)`、`Comp()`、`Set(string)`、`Set(long)`、`SetRahdom(string, string)`。因此 flag 值至少应使用有符号 64 位整数或可兼容的字符串/整数联合值。

`flag` 的实现标准：

1. 建立脚本局部 flag 和全局上下文 flag 的命名空间。
2. 支持 set、compare、random/range 等已观察操作。
3. 对未识别比较符返回诊断并使用 false，避免错误地进入奖励/完成路径。
4. 在断点中保存 flags、路线选择和当前 PC。

### 6.3 选择

`ScriptSelectDialog` 支持普通选择、隐藏选择、限时选择；`ScriptSelectListViewItemDraw.DispMode` 有 `INVISIBLE`、`INVALID`、`VALID`、`INPUT`。

选择模型应支持：

```text
Choice {
    id: string?
    messages: string[]
    visible: bool[]
    enabled: bool[]
    routes: ChoiceRoute[]
    timeoutSeconds: float?
    timeoutAction: ChoiceRoute?
    sound: AudioRef?
}
```

没有 UI 时也必须能通过键盘/脚本接口选择。限时选择倒计时结束时必须走显式 timeout route，不能默认选择第一项，除非样本或运行时跟踪证明如此。

## 7. 画面构建标准

### 7.1 渲染坐标和画布

`ScriptManager` 持有 `UIRoot`、`UIRootReScale`、`renderTextureCamera`、`margeCamera`、`ui2dCamera`，并通过 `cameraScale`、`cameraPosition`、`cameraRoll1`、`cameraRoll2` 控制主镜头。`ScriptPosition` 提供位置表和角色偏移表访问。

阅读器应建立一个逻辑画布：

```text
LogicalCanvas {
    width:  int
    height: int
    safeArea: Rect
    aspectMode: Normal | Wide | High | FullscreenDeviceWidth
}
```

所有脚本坐标先转换到逻辑画布，再由平台 viewport 做缩放。不要直接把脚本坐标当成 CSS/窗口像素；`FS_OFFSET_X_MARGIN = 80` 和 `SCENE_MODE.FULLSCREEN_IMAGE_DEVICE_WIDTH` 表明全屏设备宽度存在额外适配。

坐标适配器至少提供：

```text
positionFromIndex(index) -> Vec3
positionFromXY(x, y) -> Vec3
charaOffsetFromIndex(index) -> Vec3
charaOffsetFromXY(x, y) -> Vec3
```

在具体表值未验证前，索引位置必须来自可配置数据文件，而不是硬编码在渲染器里。

### 7.2 渲染层次

推荐固定的合成顺序：

```text
back effects
background / scene
sub layers
characters and character effects
forward effects
message window
fade / wipe / flash overlay
system UI and input overlay
```

角色的 `defaultDepth`、`SetDepth`、`SetSortingOrder` 和 `charaLayer` 必须统一映射到一个排序模型。不要只按角色数组顺序绘制，因为脚本会动态修改深度。

### 7.3 五类显示对象

`ScriptCharaData.Kind` 明确包含：

- `FIGURE`：立绘。
- `EQUIP`：装备/图像图表类对象。
- `IMAGE`：普通图片。
- `VERTICAL_IMAGE`：竖向图片。
- `HORIZONTAL_IMAGE`：横向图片。

每个槽位的状态至少包含：

```text
CharacterState {
    slot: CharacterSlot
    kind: DisplayKind
    name: string
    imageName: string
    talkName: string?
    faceType: int
    position: Vec3
    relativePosition: Vec2
    scale: float
    rotation: Vec3
    alpha: float
    depth: int
    layer: LayerKind
    shadow: bool
    talkMask: bool
    filter: FilterState?
    activeEffects: EffectInstance[]
    loadState: Loading | Idle | Moving | Destroyed
}
```

### 7.4 立绘构建

`UIStandFigureRender` 的字段直接显示了目标构建方式：`bodyFilter/bodyRenderer`、`faceFilter/faceRenderer`、`fadeFilter/fadeRenderer` 三组 Mesh；同时存在 `normalFaceRectTable`、`wideFaceRectTable`、`faceTextureRect`、`faceType`、`formId` 和 `textureList`。

独立实现应按以下顺序构建立绘：

1. 根据 `imageName` 解析 `imageId`、servant ID、服装/阶段和 form。`UIStandFigureRender` 提供 `GetServantId`、`GetImageLimitCount`、`GetImageForm` 等入口，说明 image name 不是单一资源路径。
2. 加载身体纹理和脸部纹理；若资源是已合成整图，则使用 simple mesh 路径。
3. 根据 `normal/wide/high` 画布模式选择脸部矩形表。
4. 生成 body mesh 和 face mesh；face UV 由 `faceType` 选择。
5. 应用 `figureOffset`、`dispOffset`、缩放、旋转、透明度和排序。
6. 若执行 `charaFaceFade` 或跨立绘切换，使用 fade mesh/第二实例交叉淡化。
7. 资源未加载完成时显示占位或保持旧对象，禁止把空纹理当成完成状态。

`Face.Type` 当前枚举从 `NORMAL=0` 到 `FACE_132=132`，`SUM=133`。阅读器应接受任意整数 face type；超出本地资源表时回退到 normal，同时发出资源诊断。

### 7.5 角色动画和变换

`ScriptCharaData` 暴露了多组移动方法：普通移动、ease 移动、返回位置、缩放、相对循环移动、攻击移动、旋转、轴旋转、抖动、cutin、special effect、普通 effect、back effect。

建议所有变换使用可取消的 tween：

```text
Tween {
    target: EntityId
    property: Position | Scale | Rotation | Alpha | Filter
    from: Value
    to: Value
    duration: float
    easing: Easing
    cancelPolicy: Replace | Blend | Queue
    waitPolicy: BlockScript | Background
}
```

默认策略应为同一目标同一属性 `Replace`，同一角色不同属性并行。脚本显式 `wait` 或需要 `IsMove()` 的标签再阻塞 VM。

### 7.6 子层

`ScriptSubLayerManager`、`ScriptSubLayer` 说明脚本支持 `#A` 等命名子层，每个子层拥有独立 render texture、camera scale/position/roll、角色列表、背景色、mask、effect controller 和 stretch。

子层标准：

1. `#A` 作为默认子层键。
2. 子层必须有独立的 `SceneState`/render target，不能把 `#A` 的角色混入主角色列表。
3. 子层支持 `subCameraOn/Off`、`subCameraMove`、`subCameraRoll`、`subRenderMove`、`subRenderScale`、`subRenderDepth`、`subRenderFadein/out`、`subCameraFilter` 等操作。
4. `subRenderDepth` 和主舞台 depth 使用同一排序坐标系，最后由合成器决定覆盖顺序。
5. 没有 GPU render texture 的平台可用离屏 canvas 或预合成位图代替，但必须保留滤镜和 alpha 语义。

## 8. 背景、镜头和转场

### 8.1 背景

`SetSceneImage`、`OnLoadEndScene`、`OnCrossFadeEndScene` 以及 `backSprite1/backSprite2` 表明 `[scene]` 至少支持双缓冲背景和交叉淡化。

背景状态应包含：

```text
BackgroundState {
    current: ImageRef?
    previous: ImageRef?
    crossFade: Tween?
    mode: Default | FullscreenImageDeviceWidth
    color: Color
}
```

加载新背景时先解析并开始异步加载；加载成功后将 current/previous 交换并启动 cross fade。加载失败时保留旧背景并记录错误，除非脚本明确要求清空。

### 8.2 主镜头

`StartCamera`、`MainCameraMoveEase`、`StartCameraRoll`、`SetCameraRoll`、`cameraHome` 和 `cameraFilter` 表明镜头至少有：位置、缩放、Z 轴旋转、旋转中心、滤镜。

```text
CameraState {
    position: Vec3
    scale: float
    rollZ: float
    rollCenter: Vec3
    filter: FilterState?
    activeMove: Tween?
    activeRoll: Tween?
}
```

相机移动的 `scale` 参数要区分“目标缩放为 0”与“未提供缩放”。使用可选值，不要用 0 充当缺省值。

### 8.3 转场

当前导出结果直接暴露：

- `fadein/fadeout/fadeMove/endFade`。
- `wipein/wipeout/wipeFilter/wipeOff`。
- `flashin/flashout/flashOff`。
- `maskin/maskout`。
- `stretchin/stretchout`。
- `shake/shakeStop`。
- `capture/captureRelease`。

统一用 `TransitionState` 管理，避免每种效果各自修改根画布 alpha：

```text
TransitionState {
    fade: FadeLayer?
    wipe: WipeLayer?
    flash: FlashLayer?
    mask: MaskLayer?
    stretch: StretchLayer?
    capture: CaptureBuffer?
    shake: ShakeParam?
}
```

`ScriptManager` 中 flash 有两组颜色和多个 duration 字段，说明 flash 不一定是一个简单 alpha tween。至少支持颜色 1、颜色 2、进入时长、停留/过渡时长和退出时长；参数不足时使用目标版本默认值。

## 9. 文本窗口和布局标准

### 9.1 普通消息和头像消息

`ScriptMessageCommonManager`、`ScriptMessageManager` 和 `ScriptFaceMessageManager` 分别承担通用消息、普通窗口和带脸部图标窗口。`ScriptMessageCommonManager` 有 `defaultMessageWindow`、字体、字号、行高、水平/垂直对齐、消息滚动、逐字计时和 next mark。

阅读器应实现两种模式：

- `NormalMessageWindow`：底部或脚本指定位置的普通对话框。
- `FaceMessageWindow`：显示说话者头像/脸图，支持 `FaceTalk` 和 `WarBoardTalk` 模式。

`charaTalk` 只负责当前说话角色/窗口状态时，应通过 `TalkContext` 影响立绘聚焦、头像和名字；不能强制改变所有角色的 alpha，除非脚本明确发出 spotlight/mask 类命令。

### 9.2 逐字输出

`ScriptMessageCommonManager.UpdateLabels`、`MessageUpdate`、`WaitNextTouch` 和 `ScriptLineMessage.UpdateLabels` 表明文本显示由标签对象池逐步更新。

逐字输出标准：

1. 使用 Unicode grapheme cluster 而不是 UTF-16 code unit 作为显示单位，避免 emoji/组合字符被拆开。
2. 控制 token 不占普通显示长度；ruby 的 base 文本按主文字宽度计算。
3. `[r]` 立即换行；`[k]` 进入 input wait；显式 `wait` 由 VM 管理。
4. 快速显示时一次性显示剩余 token，但保留文字完成后的声音/效果触发点。
5. 文本颜色、字体、字号和行距变化只影响后续 token，除非原始标记明确包围一段范围。

### 9.3 布局

`ScriptMessageLabel` 保存 `main`、`ruby`、`image`、`effect`、`mainPosition`、`rubyPosition`、`fontSize`、`rubySize`、`widthSize`、`dispLength`，说明每个逻辑标签可能由多个可视对象组成。

布局器必须支持：

- 普通字、ruby、行、图片、效果的混排。
- 行首/行尾定位和水平对齐。
- 左/中/右水平对齐；上/中/下垂直对齐。
- 大小为 `large`、`x-large` 等名称和数值回退。
- 文字测量和实际渲染使用同一个字体度量来源。
- 窗口高度变化时不遮挡 next mark、操作按钮和日志入口。

缺少官方字体时，应允许用户配置替代字体并保存测量偏差。截图对比要以逻辑画布为基准，不以操作系统字体的像素完全相同为要求。

### 9.4 日志和回看

`ScriptLogMessage` 与 `ScriptBackLog` 是独立路径。日志条目至少保存：说话者、已替换文本、颜色/注音、语音资源引用、原始脚本位置和时间顺序。回看日志不应重新执行场景副作用。

## 10. 音频、视频和资源系统

### 10.1 资源解析器

`ScriptManager` 维护 `downloadAssetList`、`fontAssetList`、`audioAssetList`、`uiAssetList`、`animationAssetList`，并有 `CheckAssetData`、`CheckAudioData`、`CheckFontData`。这说明资源依赖扫描是正式流程的一部分。

解析阶段应扫描并输出资源清单：

```text
ResourceDependency {
    kind: Image | Font | Audio | Video | Animation | Ui | Fsm | Unknown
    logicalName: string
    sourceInstruction: int
    required: bool
    fallback: FallbackPolicy
}
```

资源加载要有引用计数或场景级生命周期。脚本退出时释放场景资源，但允许共享字体、BGM 和常用 UI 缓存。

### 10.2 BGM、SE、循环 SE、语音

`BgmManager`、`SoundManager`、`SePlayer` 和 `voicePlayer` 的方法区分播放、停止、淡入、淡出、音量、循环、channel 和 voice。独立后端至少提供：

```text
playBgm(name, volume, fadeIn)
stopBgm(name?, fadeOut)
playSe(name, volume, fadeIn, loop, channel?)
stopSe(name?, fadeOut, channel?)
playVoice(assetName, objectName?, volume)
stopVoice(assetName?, objectName?, fadeOut)
```

`seContinue`、`cueSeContinue` 和 `CheckSameIdSeContinue` 说明连续 SE 需要按 ID/名称复用 player，而不是每次叠加新声音。后端应维护 `seContinuePlayers` 等价映射。

资源缺失策略：

1. 音频缺失：记录 warning，按照音频长度未知处理，默认不阻塞脚本。
2. 关键 voice 缺失：允许继续显示文本，并保留“语音缺失”标志。
3. BGM 缺失：停止/切换语义仍更新 AudioState，便于后续恢复。
4. 播放器错误：不能阻断非音频脚本指令。

### 10.3 电影

`PlayCRIMovie` 和 `ConvertCRIMovieBgmStop/SeStop/VoiceStop/ScriptStop` 明确电影可能控制 BGM、SE、语音和脚本暂停。

电影指令应生成：

```text
MovieRequest {
    name: string
    pauseBgm: bool
    stopScript: bool
    pauseSe: bool
    pauseVoice: bool
    resumePolicy: ResumePolicy
}
```

CRI 播放器不可用时可以使用已转码视频；两者都不可用时显示占位并根据 `stopScript` 选择立即继续或等待用户跳过。不能因视频缺失进入永久 `MovieWaiting`。

### 10.4 解密脚本

`ScriptEncryptSettings` 包含 `ScriptEncryptEntity[] settings`、`lookup`、`GetKey(scriptName)`，`ScriptManager` 也提供 `GetKey`/`GetEncryptEntity`。实现应设计为插件：

```text
IScriptDecoder {
    canDecode(version, scriptName, bytes) -> bool
    decode(version, scriptName, bytes) -> Utf8Text
}
```

没有已验证算法时，不要根据乱码猜 key；应输出“需要外部解密结果”的诊断。解密器必须记录版本、脚本名、输入 hash 和输出 hash，便于复现。

## 11. FSM、ADV Prefab 和复杂演出

### 11.1 FSM

`ScriptFsmObject` 持有 `PlayMakerFSM`，提供 `SetState`、`SendEvent`、`SetString`、`SetFloat`、`SetBool`、`Skip`、`OnFinished`；`ScriptFsmObjectData` 负责资源加载、父对象、位置、状态、事件、变量和销毁。

因此 `[fsm]`、`fsmObjSet`、`fsmObjLayer`、`fsmObjSendEvent`、`fsmObjSetState`、`fsmObjDestroy` 应抽象成 FSM 后端接口：

```text
IFsmInstance {
    setParent(entity)
    setPosition(x, y)
    setState(name)
    sendEvent(name)
    setString(name, value)
    setFloat(name, value)
    setBool(name, value)
    skip()
    isPlaying() -> bool
    destroy()
}
```

首期阅读器可以只实现常见 FSM 的数据映射和截图占位，但必须把 FSM 节点标记为“已遇到、未复现/已复现/资源缺失”，不能静默忽略。

### 11.2 ADV Prefab

`ScriptActionAdvPrefabController` 及其 actor/camera/light 类支持角色动画、性别显示、跟随目标、Animator、SE 和 voice。它与普通 `charaSet` 立绘不是同一种对象。

`advPrefab` 或相关标签应单独进入 `AdvancedScene`，至少保留：预制体名、actor 名、摄像机 locator、灯光设置、动画触发器、性别条件和资源生命周期。

## 12. 标签实现分级

当前样本共统计 299 种标签/伪标签；标签分发器通过字符串 switch 处理，样本标签中有 277 个与分支 case 一一对应。建议按实际使用频率和副作用分级，不按字母顺序实现。

### P0：阅读器基本可用

`k`、`r`、`wt`、`messageOff`、`wait`、`end`、`charaSet`、`charaFace`、`charaFadein`、`charaFadeout`、`charaTalk`、`charaPut`、`charaMove`、`charaScale`、`charaDepth`、`scene`、`bgm`、`bgmStop`、`se`、`seStop`、`soundStopAll`、`fadein`、`fadeout`、`label`、`branch`、`flag`、`selectBranch`、`cameraMove`、`shake`。

### P1：常规活动和主线演出

`charaMoveEase`、`charaMoveReturn`、`charaMoveScale`、`charaMoveFSR/FSL/FSSideR/FSSideL`、`charaFaceFade`、`charaFilter`、`charaLayer`、`charaShadow`、`charaEffect`、`charaEffectStop/Destroy`、`charaSpecialEffect`、`effect`、`effectStop/Destroy`、`backEffect`、`fowardEffect`、`imageSet`、`sceneSet`、`cameraMoveEase`、`cameraRoll`、`cameraRollMove`、`cameraFilter`、`wipein/wipeout`、`flashin/flashout`、`maskin/maskout`、`blur/blurOff`、`voice`、`voiceStop`、`cueSe` 系列。

### P2：复杂图层和资源驱动演出

`subCamera*`、`subRender*`、`subBlur*`、`communicationChara*`、`charaBackEffect*`、`charaEffectEdgeBlur*`、`charaCutin`、`capture`、`pictureFrame`、`horizontalImageSet`、`verticalImageSet`、`masterSet`、`masterScene`、`equipSet`、`equipGraph` 相关操作。

### P3：专用内容

`fsm*`、`fsmObj*`、`criMovie`、`movie`、`insertionAnimation*`、`specialEffect`、`useSimpleMeshFigure`、极低频分支/任务/路线标签以及版本特有标签。

每个标签注册项必须声明：参数 schema、读写状态、是否等待、是否可跳过、资源类型、缺失资源策略、证据等级和测试样例。

## 13. 未知标签和兼容性标准

未知标签是版本兼容的正常情况。处理策略必须是：

1. 解析器保留 tag、rawArgs、sourceLine。
2. VM 生成 `UnknownCommand` 事件。
3. 根据标签分类猜测是否等待：未知标签默认不等待，除非名称包含明确的 load/movie/wait/animation 语义且配置允许。
4. 渲染器显示可选的开发诊断，不影响普通阅读。
5. 汇总未知标签频率和上下文，生成适配清单。

以下情况可以升级为 error：脚本语法损坏、跳转目标缺失且无安全 fallback、选择节点没有任何可选项、循环等待超过配置上限。

建立版本能力表：

```text
EngineProfile {
    id: "2.138.0"
    supportedTags: Set<string>
    tagSchemas: Map<string, Schema>
    positionTable: PositionTable
    assetRules: AssetRules
    textRules: TextRules
    featureFlags: Set<string>
}
```

## 14. 断点、回放和可重复性

`ScriptManager` 暴露 `SaveTalkResumeInfo`、`SaveMovieResumeInfo`，并维护 `executeIndex`、`executeWaitIndex`、`playScriptJumpLine`、`parameterList` 和多种播放状态。断点不能只保存当前行号。

断点格式至少包含：

```json
{
  "engineProfile": "FGO-script-engine-2.138.0",
  "sourceFile": "0100000010.txt",
  "sourceHash": "...",
  "pc": 123,
  "wait": { "kind": "input", "remaining": 0 },
  "flags": {},
  "parameters": [],
  "routeSelections": {},
  "gender": 0,
  "sceneState": {},
  "audioState": {},
  "timestamp": "..."
}
```

恢复时先恢复纯数据状态，再重新绑定资源，最后恢复等待。资源加载超时必须进入可继续状态；不能在恢复阶段无限等待。

为了可重复测试，VM 应支持固定时间步长和随机种子。`SetRahdom`/随机分支必须使用可注入 RNG。

## 15. 工具链和验证方法

### 15.1 必备工具

建议提供以下命令：

```text
reader parse <script> --json
reader index <directory> --profile 2.138.0
reader deps <script> --format json
reader replay <script> --from-label <label> --headless
reader trace <script> --unknown-only
reader render <script> --frame <n> --png <out>
reader validate <directory> --strict
```

### 15.2 解析验证

至少使用以下样本覆盖：

- 无参数标签：`k`、`r`、`messageOff`、`soundStopAll`。
- 单浮点：`wt 1.0`、`charaScale A 1.1`。
- 逗号坐标：`charaPut B 0,0`、`cameraMove 0.1 0,-30 1.2`。
- 多颜色：六位和八位颜色。
- ruby：`#運命:ルート`、含多个空格分隔读音的样本。
- 多种同名标签签名：`charaFadein`、`wait`、`bgm`、`se`、`branch`。
- 控制流：`label`、条件 branch、选择、返回。
- 资源演出：`scene`、立绘切换、淡入、抖动、子层和电影。

解析测试应比较结构化 JSON，而不是只比较“没有抛异常”。

### 15.3 运行时验证

每个标签测试至少检查：

1. 执行前后的 `SceneState` 差异。
2. 是否阻塞 PC。
3. 等待是否能完成、跳过和取消。
4. 缺失资源是否产生诊断并能继续。
5. 反复执行是否没有重复叠加对象、音频或 tween。

### 15.4 画面对比

使用固定逻辑分辨率、固定字体、固定资源和固定时间点截图。建议输出：

- 背景单独图层。
- 角色合成图层。
- 消息窗口图层。
- 转场/滤镜图层。
- 最终合成图。

重点检查：角色位置、排序、表情 UV、ruby 基线、背景交叉淡化、镜头中心、alpha、裁剪和安全区。对于未得到官方位置表/材质参数的功能，应在报告中标记误差来源。

### 15.5 终止性和性能

必须有以下保护：

- 单帧最大连续指令数。
- 同一 PC/状态重复次数检测。
- wait 最大时间或可恢复超时。
- 资源加载超时。
- 电影/FSM 无回调时的 fallback。
- 大量标签、立绘和效果的对象池/资源缓存。

脚本执行不能在主线程同步读取所有资源。预扫描依赖，按需加载当前窗口附近资源，并在后台预取下一段。

## 16. 推荐开发顺序

### 阶段 1：解析和无图文本阅读

实现源读取、标签 lexer、对话/ruby tokenizer、IR、label 索引、flag/branch VM、普通消息和日志。此阶段不依赖官方资源即可验收。

### 阶段 2：基础舞台

实现 `scene`、`charaSet`、`charaFace`、`charaFadein/out`、`charaPut`、`charaMove`、`charaScale`、`charaDepth`、`fade`、`cameraMove` 和 `shake`。

### 阶段 3：音频和完整交互

接入 BGM/SE/voice、自动播放、快进、跳过、选择、限时选择、断点和回看。

### 阶段 4：高级图层和后处理

加入子层、滤镜、wipe、flash、blur、cutin、角色特效和图片帧。

### 阶段 5：复杂资源

实现 CRI 电影适配、FSM/ADV Prefab 适配、特殊活动标签和版本 profile。

每个阶段结束都应保留可运行版本。不要在 FSM、材质滤镜或资源逆向尚未完成时阻塞 P0/P1 文本阅读功能。

## 17. 最低验收标准

一个版本 profile 达到“可用”必须满足：

- 对 `script_file_tags.json` 中前 30 个高频标签有 schema 和实现。
- 解析 2,583 个样本文件时无未处理的解析异常；未知标签只能出现在诊断清单。
- 所有跳转目标可建立索引；缺失目标有文件/行号/标签信息。
- 任意资源缺失不会让 VM 永久等待。
- 普通对话、ruby、颜色、点击等待、背景、立绘表情、角色移动、淡入淡出和 BGM/SE 能完整走通。
- 选择、暂停、快进、跳过、日志和断点能在同一脚本中组合工作。
- headless 回放能输出逐指令 trace 和最终 `SceneState` hash。
- 至少有一个固定脚本完成截图回归测试。
- 未知标签统计能按 profile、标签、文件和上下文导出。

## 18. 反编译证据索引

以下位置适合作为实现时的快速索引，行号以当前 `dump.cs` 为准，RVA 以 IL2CPP 导出为准：

| 内容 | 位置 |
|---|---|
| `ScriptManager` 字段、脚本数组、运行时状态 | `dump.cs` 约 166915 行起；字段含 `executeTagList`、`executeDataList`、`executeLineList`、`executeOrgLineList`、`executeMessageFlagList` |
| 脚本加载、分析、执行 | `LoadScript` RVA `0x313C670`；`ScriptAnalys` RVA `0x313C968`；`AnalysText` RVA `0x314154C`；`ExecuteScript` RVA `0x313C2A0` |
| 标签分发 | `ScriptCommandExecute` RVA `0x30FA9D4` |
| 控制流和参数转换 | `JumpScript` RVA `0x314AA70`；`SearchBranchLabel` RVA `0x314AD64`；转换方法约在 `0x314B28C` 至 `0x314C234` |
| 立绘状态 | `ScriptCharaData` 约 165021 行起；五类 `Kind` 和四态 `State` |
| 立绘网格和表情 UV | `UIStandFigureRender` 约 155521 行起；body/face/fade mesh 和 normal/wide face rect table |
| 消息和逐字布局 | `ScriptMessageCommonManager` 约 168717 行起；`ScriptLineMessage` 约 165718 行起；`ScriptMessageLabel` 约 169244 行起 |
| 子层和离屏渲染 | `ScriptSubLayer`/`ScriptSubLayerManager` 约 170700 行起 |
| FSM | `ScriptFsmObject`/`ScriptFsmObjectData` 约 165557 行起 |
| 选择 | `ScriptSelectDialog` 约 169745 行起；`ScriptSelectListViewManager` 约 169936 行起 |
| 资源/音频依赖 | `ScriptManager` 的 `downloadAssetList`、`audioAssetList`、`fontAssetList`，以及 `CheckAssetData*`、`CheckAudioData`、`CheckFontData` |
| 标签统计和参数样本 | `script_file_tags.json`、`tag_inventory.json` |
| 标签到处理调用摘要 | `tag_handlers.json` |

重新导出后行号可能变化，实际实现应按类名和 RVA 定位，不应把行号当成协议数据。

## 19. 实现原则总结

1. 原始文本、类型化参数和运行时状态必须同时保留。
2. 解析、VM、状态和渲染严格分层。
3. 任何等待都必须有完成、跳过、取消或超时路径。
4. 资源缺失应降级为可诊断事件，不能变成永久卡死。
5. 角色、消息、背景、相机、子层和特效都应有纯数据状态。
6. 版本差异通过 profile 和 schema 管理，不通过散落的字符串判断管理。
7. 对官方内部行为的结论按 E0/E1/E2/E3 标注，并用脚本样本、运行时 trace 或截图回归逐步提高证据等级。







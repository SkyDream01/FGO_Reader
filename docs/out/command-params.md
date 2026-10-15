# 脚本指令参数的含义(总纲)

回答"每个指令的参数到底是什么意思"。分三部分:**① 参数数组怎么读**、**② 跨指令通用的取值语义**、
**③ 逐指令参数表**(机器可读 + 分域文档)。

证据约定:`VA` = `libil2cpp.so` 虚拟地址;`.rodata` 常量给出实际数值;括号内为证据位置。
未经证实的项标 `未知`。

---

## ① 参数数组 `pd[]` 怎么读

命令体里读取参数的真实指令形态(在 `ScriptManager.ScriptCommandExecute` VA `0x3177290` 内):

```asm
ldr x8, [x20]                ; x8 = pd(该行的 string[])
ldr w9, [x8, #0x18]          ; pd.Length,后面跟 >= N 检查
ldr x0, [x8, #0x20 + 8*i]    ; pd[i]
```

四条规则:

1. **偶数下标是值,奇数下标是分隔符**:`pd[0]=值, pd[1]=" ", pd[2]=值, pd[3]=" ", …`
   所以"第 k 个参数"落在 `pd[2k]`(0 基)。分隔符可能是 `" "`、`","`、`"="`。
   `AnalysParam` VA `0x31a7688` 是分词器;`pd[1]/[3]/[5]…` 与 `" "` 的比较在调度器里出现 **133 次**。
2. **`" "`(单个空格)作为"值"出现时表示该参数被省略** —— 所以在脚本里写占位空格等价于不传。
3. **可选参数有守卫**:读 `pd[2k]` 之前会先检查 `pd[2k-1] == " "`
   (即"分隔符存在"),`out/command_params.json` 的 `optional_pd` 列就是这些下标。
4. **最少元素数**:命令体开头的 `cmp wK,#N` 是 `pd.Length` 下限,
   即 `out/commands.json` 的 `min_token_count`(注意 `b.le/b.ls` 要 +1)。
   低于下限直接走错误分支(`0x3193cd4`)或空实现(`0x3193f00`)。

举例(实证):`wipein A B C` → `min_token_count=5`,`optional_pd=[2,4]`,
含义即 `pd[0]=划像名`、`pd[2]=时长(可选)`、`pd[4]=强度(可选)`。

---

## ② 跨指令通用的取值语义(实证)

### 2.1 角色槽位 —— 用**字母**写

`ScriptManager::ConvertCharaIndex` VA `0x31b34f0`:
逐字符 `c - 0x41('A')`,要求落在 `0..25`,再按 8 位打包累加(`w = (w<<8) | (c-'A')`)。

| 写法 | 结果 |
|---|---|
| `A`..`Z` | 槽位 `0..25`(与 `ScriptManager.CHARA_MAX = 26` 一致) |
| 其他任何字符(含数字、符号) | `0`(即等于槽位 A) |

所以 `charaSet 0 0 0` 与 `charaSet A …` 同义 —— **想指定槽位必须用字母**。
`ConvertCharaIndexTalk` 是同一套,用于说话人。

### 2.2 立绘/角色位置 —— 7 个固定坐标

`ScriptPosition.positionList`(静态构造 VA `0x31d8f08`,常量取自 `.rodata`),
`ScriptPosition::GetPosition(int)` VA `0x31d8d88` 按下标取(下标越界或负数 → 0):

| 索引 | 坐标 (x, y) | 直观含义 |
|---|---|---|
| 0 | **(-256, 0)** | 左 |
| 1 | **(0, 0)** | 中 |
| 2 | **(+256, 0)** | 右 |
| 3 | **(-438, 0)** | 偏左(两人并立时的外侧) |
| 4 | **(-512, 0)** | 最左(常作画面外) |
| 5 | **(+438, 0)** | 偏右 |
| 6 | **(+512, 0)** | 最右(常作画面外) |

证据:6 个常量地址 `0xea7060 / 0xea7fd8 / 0xea6b48 / 0xea7e10 / 0xea8508 / 0xea7e18`
解出的 float 对,依次为 `(-256,0) (256,0) (-438,0) (-512,0) (438,0) (512,0)`,
下标 1 为 `(0,0)`(`positionList[1]` 在 cctor 里写 `xzr`)。
参考分辨率:剧情画面渲染到 **1344×576**(`ScriptActionSetRenderTextureComponent.ScriptActionRenderWidth/Height`),
16:9 基准高度 576 —— 所以 `±256` 约为画面宽度的 ±19%。

### 2.3 数值、时间与颜色

| 参数种类 | 写法 | 证据 |
|---|---|---|
| 时间 | 浮点秒,如 `0.5`;默认淡入淡出 `ScriptManager.DEFAULT_FADE_TIME = 0.5f` | dump.cs 常量;`Single::Parse` 调用点 |
| 缩放/强度 | 浮点,通常 0–1 或像素 | `Single::Parse` → 消费方参数名 |
| 颜色 | `[#RRGGBB]`(文本标记)或 `ConvertColor` 接受的颜色名 | `ScriptManager::ConvertColor`;`[#` 字面量 |
| 翻转/朝向 | `ConvertEffectFlipKind` VA 处:`H`→1,`V`→2,`F`→3,其他→0 | 反汇编分支 |
| 布尔 | `true` / `false`(在命令体内被比较 10 次 / 4 次) | 非 tag 比较字面量统计 |
| 开关类取值 | `on` / `off`(各 2 次) | 同上 |
| 省略 | 单个空格 `' '`(133 次) | 同上 |
| 列表 | `,` 作为独立 token(11 次) | 同上 |
| 键值对 | `=` 作为独立 token | 同上 |

### 2.4 命名后缀约定(`FSL` / `FSR` / `FSSideL` / `FSSideR` / `NotNotch`)

剧情画面的安全区随刘海屏变化,`FSUtility` 里:

- 16:9 / VISTA(2.0)/ SCOPE(2.333) 三档比例常量,边距 68 / 80
- `GetCalcOffsetX = (min(aspect, 2.3333) − 1.7778) · 288 − margin`,0 时为 0、超宽时最大 160 px
- 位置表里的 `-438/+438`、`-512/+512` 与 `±256` 配合,可覆盖"有人站在画面外"

⚠️ **`FSL` / `FSR` / `FSSideL` / `FSSideR` / `NotNotch` 是「命令名」的一部分,不是参数**。
它们是同一族命令的屏边变体,由 `ScriptManager.GetFSCommandOffsetX/Y(tag, base, forceObi)` 按屏幕比例
自动算出边缘 X(FSL 取负、FSR 取正;`*NotNotch` 走 `forceObi` 关闭路径,**不**做刘海内缩)。
所以 `charaPutFSSideR` 这类命令**没有**额外的"边"参数 —— 边由命令名决定(实证见 `out/params-visual.md` 约定章节)。

证据:`out/composition.md` 的 `screen_model` 小节(含 `FSUtility.GetCalcOffsetX` VA `0x31231c0`)。

### 2.5 资源名转换函数(参数经它们变成资源路径)

| 转换函数 | 参数含义 | 生成的资源名 |
|---|---|---|
| `ConvertBackTextureName` | 背景/场景 | `Back/back{0:D5}` |
| `ConvertCharaIndex` | 角色槽位 | —(转成槽位号) |
| `ConvertNameString` | 名称字符串 | —(原样/规范化) |
| `ConvertWipeName` | 划像 | `Wipe/<name>` |
| `ConvertTalkEffectName` | 对话特效 | `Talk/<name>` |
| `ConvertFontName` | 字体 | `Font/<name>` |
| `ConvertPictureFrameImageName` | 画框图片 | `Image/<name>` |
| `ConvertSpriteMaskName` | 精灵遮罩 | `Image/mask_<name>` |
| `ConvertInsertionAnimationName` | 插入动画 | `InsertionAnimations/<name>/<name>` |
| `ConvertMovieName` / `ConvertCRIMovieName` | 影片 | `Movie/<name>.mp4` / `.usm` |
| `GetCharaImageNameAndFormId` | 立绘 `名字+formId` | `CharaFigure/[Form/<form>/]<svtId>` |

(路径模板的完整清单与证据见 `out/composition.md`。)

### 2.6 缓动(easing)

脚本里的 easing 字符串**原样透传**给 LeanTween(`MainCameraMoveEase(..., string easetype)` 等),
本二进制内**没有** `expo/quad/sine/...` 之类的比较点 —— 所以无法从客户端枚举合法取值,
阅读器可以直接把未知 easing 当作线性/自定义曲线处理。

---

## ③ 逐指令参数表

| 材料 | 内容 |
|---|---|
| `out/command_params.json` | **机器可读**:366 条命令,每条的 `pd` 索引、类型、转换链、消费方法及其参数名、是否可选、置信度、证据地址 |
| `out/_evidence/params_skeleton.md` | 上述数据的表格版(520 行),便于人工审阅 |
| `out/params-visual.md` / `.json` | 演出域逐指令参数含义:**253 条命令、991 条参数记录**(742 high / 171 medium / 78 low),13 处明确标未知 |
| `out/params-misc.md` / `.json` | 音频/消息窗/流程控制/杂项逐指令参数含义:124 条命令、212 条参数记录(50 high / 105 medium / 57 low)、59 处明确标未知;含 `wait` 的 72 键关键字表与延迟/自动等待模型 |

覆盖度:两个域文档合计覆盖 **356/366** 条命令;剩余 10 条(`else`/`endIf`/`ifClear`/`f`/`k`/`l`/`q`/`s`/`shake`/`shakeStop`)
为控制流标记或单字母别名,见 §④ 补遗。

置信度标注含义:

- **high(受限扫描)** —— 扫描范围被"下一条命令 case 入口"截断,参数不会与相邻指令混淆;
  另有转换链 + 目标方法参数名双重佐证。
- **medium(顺序对应)** —— 多个数值参数按顺序对应到某个 API 的数值形参(如 `Shake(duration, cycle, x, y)`)。
- **low(边界放宽)** —— 该指令体是共享尾部或跳转结构,扫描放宽后可能混入相邻指令的流,
  **必须**回读该 handler 复核后才能采信。

### 2.7 命令体的四种收尾(便于判断"参数有没有被用")

命令体执行完后统一跳到几个公共尾声(`out/params-misc.md` 实证):

| 尾声地址 | 返回值 | 含义 |
|---|---|---|
| `0x3193f00` | `Normal`(0) | 正常,按节奏继续 |
| `0x3193f04` | `Continue`(1) | 需要"继续/连击"推进 |
| `0x3188c6c` | `ReturnFalse`(2) | 本行不是命令(交给消息系统) |
| `0x3193e80` | — | **参数错误**(长度不足等),直接报错 |

另有若干命令在 2.139.3 里是**空实现**(直接 `b 0x3193f00`,参数被忽略):
`advSoundSet`、`delayEnd`、`enableFullScreen`、`enableWaitLoadAssetWhenResume`。
写阅读器时这些可以安全地当 no-op。

### ③-补 三个命令的完整参数含义(示例)

来自 `out/params-visual.md` / `out/params-misc.md`,都已回读 handler 验证:

| 脚本写法 | 参数含义 |
|---|---|
| `charaSet A 100100 2` | `pd[0]=A` 角色槽位 A(0) · `pd[2]=100100` 立绘资源名 · `pd[4]=2` 位置下标(2=右,+256) |
| `charaMoveEase A 3 0.5 1 expo` | `pd[0]=A` 槽位 · `pd[2]=3` X? 见下注 · `pd[4]=0.5` 时长(秒) · `pd[6]=1` … · `pd[8]=expo` 缓动名 |
| `cameraMoveEase 0 0 1.5 expo` | `pd[0]=0` X 坐标 · `pd[2]=0` Y 坐标 · `pd[4]=1.5` 时长(秒) · `pd[6]=expo` 缓动名 |
| `shake 0.3 0.05 8 4` | 时长 0.3s · 周期 0.05s · X 幅度 8 · Y 幅度 4 |
| `wipein cut_01 0.5 0.8` | 划像名 `cut_01`(→`Wipe/cut_01`)· 时长 0.5s · 强度 0.8 |
| `se SE_001 0.5` | SE 名 · 音量 0.5 |
| `input selectBranch 0 はい いいえ` | 子命令 `selectBranch` · 选项 1/2 文本 |
| `wait time 1.0` | 等待类型 `time` · 等待 1.0 秒(共 72 种 `pd[0]` 关键字,见 `params-misc.md`) |

> 坐标形式:许多立绘类命令支持 `x,y` 写法(此时 `pd[3] == ","`),与"位置下标"二选一。

---

## ④ 补遗:控制流标记与单字母别名(10 条)

| 命令 | 含义 | 证据 |
|---|---|---|
| `else` | 条件块转折标记,无参数 | handler `0x317c0dc`;与 `ifClear`/`endIf` 配套(`ScriptManager` 内以 `op_Equality` 比较) |
| `endIf` | 条件块结束标记,无参数 | handler `0x317dbf4` |
| `ifClear <flag>` | 条件判断(`min_token_count=1`),参数为 flag 名;与 `else`/`endIf` 组成条件块 | handler `0x3179400`,pd[0] 参与 `' '` 分隔符守卫 |
| `f` | **`font` / `fontSize` 的别名**(共享 handler `0x3187928`) | 同 handler 三条 tag |
| `l` | **`betweenHeight` 的别名**(共享 handler `0x318472c`) | 同上 |
| `s` | **`speed` 的别名**(共享 handler `0x3184a58`) | 同上 |
| `k` | 单字母命令,自带 handler `0x317fa28`(体内有 `ConvertNameString` 与 `=` 比较),**参数含义未定** | 需真实脚本对拍 |
| `q` | 单字母命令,自带 handler `0x318662c`,**参数含义未定** | 同上 |
| `shake` | 抖动:`pd[0]`=时长(秒)、`pd[2]`=周期、`pd[4]`=X 幅度、`pd[6]`=Y 幅度 | handler `0x318548c`,4×`Single::Parse` → `fmov s0..s3` → `ScriptManager::Shake(duration,cycle,x,y)` |
| `shakeStop` | 停止屏幕抖动(内部走同一个 `Shake` 归零) | handler `0x317e0d8` 调用 `ScriptManager::Shake` |

### 已知缺口(必须说明)

1. **值语义数据驱动**:`wipeFilter*` / `cameraFilter` / `charaFilter` 的名称、`talkEffect` 名、
   部分 `effect` 名都是资源名,代码里只有 `Convert*` 前缀拼接,**没有可枚举的合法值表**。
2. **异步/延迟型命令**的返回值不进入下一步参数解析,部分参数只在 `state=WAIT` 的后续帧被消费,
   自动扫描可能只看到后半截。
3. **`message2` / `message3`** 不在 366 条命令内(显式比较处理),
   其数值前缀与消息体的切分依赖真实脚本样本才能逐位确认。
4. 尚未用**真实剧本**做过整表对拍 —— 以上都是从客户端代码推出的,建议抽样验证。

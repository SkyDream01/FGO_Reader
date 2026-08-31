# FGO 非官方剧情阅读器实现标准与指导

> **文档定位**：基于 FGO 客户端（`com.aniplex.fategrandorder` 2.138.0 / versionCode 496，Unity IL2CPP）逆向工程结论，为构建**非官方 FGO 剧情阅读器/播放器**提供的实现标准（Stardard，编号 S-P/E/R/A 系列）与工程指导。
>
> **证据来源**：
> - 脚本语料：`F:\Project\fgo_scripts\scripts`（2,583 个脚本文件）
> - 客户端逆向：`F:\Project\fgo\fgo_dump\`（Il2CppDumper 导出 + capstone 反汇编 + 字符串桥接），详见 [`FGO剧情引擎分析报告.md`](fgo_dump/FGO剧情引擎分析报告.md)
> - 语法全集与命令参考：[`FGO_Script_Format_Spec.md`](FGO_Script_Format_Spec.md)（下称"格式规范"）
>
> **结论分级**：标注 **【引擎】** 的为客户端二进制中直接验证的行为（附 RVA/常量出处）；标注 **【样本】** 的为脚本语料统计；标注 **【建议】** 的为工程实践意见，非引擎行为。
>
> **合规**：FGO 脚本文本、立绘、音声、视频素材版权归 Aniplex / TYPE-MOON / FGO PROJECT 所有。本标准仅覆盖"解析与演出复刻"技术口径，阅读器实现应定位为离线学习研究工具，**不附带、不分发游戏资源本体**。

---

## 目录

1. [总体架构](#1-总体架构)
2. [解析标准 S-P](#2-解析标准-s-p)（含 S-P8 真实脚本解析走查）
3. [执行标准 S-E](#3-执行标准-s-e)（含 S-E8 从脚本到像素：一条指令的一生）
4. [画面演出标准 S-R](#4-画面演出标准-s-r)（含 S-R9 特效实现手册、S-R10 场景帧构建手册）
5. [音声与视频标准 S-A](#5-音声与视频标准-s-a)
6. [素材体系](#6-素材体系)
7. [进度与状态持久化](#7-进度与状态持久化)
8. [引擎常量与枚举总表](#8-引擎常量与枚举总表)
9. [核心命令 → 演出映射速查](#9-核心命令--演出映射速查)
10. [实施路线建议](#10-实施路线建议)

---

## 1. 总体架构

### 1.1 三段管线

引擎本体是"解析一次、顺序执行"的视觉小说执行器。阅读器采用同构三段管线【建议，与引擎分层一致】：

```
┌─────────────┐   ┌──────────────────┐   ┌───────────────────────┐
│ ① Parser    │ → │ ② Compiler       │ → │ ③ Executor / Renderer │
│ 文本→token流 │   │ token→指令数组+   │   │ 状态机逐条消费，        │
│ (S-P)       │   │ 控制流索引 (S-P6) │   │ 驱动演出 (S-E/S-R)     │
└─────────────┘   └──────────────────┘   └───────────────────────┘
```

- ①② 在加载时一次性完成（引擎在 `LoadScriptAnalys` 同步完成，RVA 0x313C938）。
- ③ 是帧驱动状态机（引擎 `ScriptManager.State`，见 S-E2）。
- **指令数组必须保留原始行号**：引擎同时保留去标记前后的行号（`executeLineList` / `executeOrgLineList`）用于 BackLog 与定位【引擎】。阅读器据此实现进度条、日志回溯与错误定位。

### 1.2 核心数据模型【建议，字段与引擎对齐】

```csharp
class Instruction {
    string  Tag;          // 命令名（大小写敏感，原样）
    string[] Params;      // 空格切分、双引号保空的参数数组（引擎 pd）
    int     Line;         // 逻辑行号（引擎 executeLineList）
    int     OrgLine;      // 源文件行号（引擎 executeOrgLineList）
    bool    IsMessage;    // 是否为对话正文（引擎 executeMessageFlagList）
    string  RawText;      // 原文（引擎 executeDataList）
}
class Scene {
    string Header;            // ＄ 头部原文（不执行）
    List<Instruction> Body;   // 指令流
    Dictionary<string,int> Labels;  // label → 指令索引（对应引擎 labelLblLoopLine 等）
}
```

执行游标 `int Index`（引擎 `executeIndex`），控制流 = 修改游标（引擎 `JumpScript`）。

---

## 2. 解析标准 S-P

### S-P1 文件与编码【引擎+样本】

| 项 | 标准 |
|---|---|
| 编码 | UTF-8 无 BOM；换行 CRLF |
| 文件名 | `{questId 8位}{phase 1位}{尾号 1位}.txt`；战斗类尾号固定：0=战斗前、1=战斗后、2/3=第二形态、4/6=其他胜利结局、5/7=败利结局、8=条件不满足、9=战斗直前（引擎 `SCRIPT_NAME_BATTLE_*` 常量）；另有 `WarEpilogue` 等具名脚本 |
| 头部 | 首个 `＄…` 行为场景头，**跳过不执行**；引擎不校验头部与文件名的关系 |
| 章节目录 | 目录名与引擎无关，仅语料组织用 |

### S-P2 行分类【引擎】

按以下优先级处理每一行（行首码是引擎的可配置字段 `codeTalkString/codeSceneString/codeCommentString/...`，运行值为观察到的全角符号；`＠` 已在二进制中找到常量）：

1. `＄` 开头 → 场景头，记录后跳过；
2. `＠` 开头 → **对话行**：其余部分为说话者描述（见 S-P4），随后正文行累积到消息边界；
3. 含 `[...]` 的行 → 切分为"文本片段 + 行内标签"序列（**行内标签与独立命令同管线**，引擎确认）；
4. 空行 → 保留为文本分隔（引擎正文按行累积，空行参与排版）。

### S-P3 分词【引擎】

`GetCommandTag`（RVA 0x314A1FC）的等价算法——**命令名 = 从 `[` 后逐字符收集，遇空格或 `]` 停止**：

```
function GetCommandTag(s, start):
    if s == null: return ""
    tag = ""
    for i in [start, s.Length):
        c = s[i]
        if c == ']' or c == ' ': break     # ← 引擎两个终止符
        tag += c
    return tag
```

- 之后参数按空格切分，双引号包裹段保留空格（如 `[input selectBranch skipStop "branchNotRouteSelect 4000517 4000574"]`）；
- 命令分发是 string switch（`ComputeStringHash` + 逐 case `op_Equality`）→ **命令名大小写敏感**；
- `]` 前的多余空白不产生空参数；`[` 后紧跟空格/`]` 产生空 token（罕见，容错处理）。

### S-P4 对话行【引擎】

- `＠` 后的内容为说话者描述：支持 `＠显示名`、`＠槽位：显示名`（韩文区用半角冒号）、`＠显示名=spot[A,B]`（多人共演）；
- 引擎将说话者名经 `IsEqualTalkName` / `ConvertCharaIndexTalk` 匹配回 A-Z 槽位，用于"说话者高亮、其余压暗"演出；
- 说话者名内可嵌颜色标记（如 `＠[51d4ff]アナウンス[-]`）；
- 正文行累积至 `[k]`/`[q]`/`[page]` 边界；`[r]` 为行内软换行。

### S-P5 文本标记规范清单

标记全集与参数见格式规范"文本标记"章。阅读器**最低必须支持**（按语料词频排序）：

| 标记 | 语义 | 词频 |
|---|---|---|
| `[k]` | 消息段边界，等待点击 | 184,799 |
| `[r]` | 软换行（不等待） | 133,096 |
| `[wt 秒]` | 定时等待（可被点击打断） | 116,117 |
| `[line N]` | 横线分隔（`[line3]` 为无空格形式） | 19,539+1 |
| `[s N]`/`[speed N]` | 逐字速度 | — |
| `[center]`/`[right]` | 对齐（引擎字符串比较确认；`left` 为默认） | — |
| `[#汉字:かな]` | 注音 ruby | — |
| `[&男性:女性]` / `[%1]` | 性别分支文本 / 玩家名（`ScriptReplaceString.USER_NAME=1`） | 3,956 |
| `[51d4ff]…[-]` 等颜色 | 16 进制色 + `[-]` 复位；命名色见格式规范 | — |
| `[font …]` | 字体（引擎确认标记） | — |

### S-P6 解析产物

见 1.2 数据模型。除指令流外需构建：

- `Labels: label名 → 指令索引`（`[label xxx]`）；
- `Branches`：`[branch 条件 标签]`、`[branchQuestNotClear]`、`[switchCase]` 等条件分支表；
- `MessageBlocks`：消息边界索引（供自动播放、跳过、进度估算）。

### S-P7 容错【引擎语义 + 建议】

- 未识别命令：引擎拼出 `"<tag> is not found"` 类错误串（分发器字符串表证据），**不终止场景**。阅读器：记录日志 → 跳过该指令 → 继续游标。
- 参数不足/类型错：引擎按 `NaN/undefined` 容忍。阅读器：数值参数解析失败按 0 或跳过动画。
- `structure error`（引擎错误串）对应结构性问题（如分支无目标标签）→ 阅读器可降级为线性播放。

### S-P8 解析走查：从脚本文本到指令数组【走查样本】

以序章 `0100000010.txt` 开头 30 行为样本，走一遍 ①→② 管线（行号对应源文件）：

**输入（节选）**：

```
＄01-00-00-00-1-0
                            ← 空行
[soundStopAll]
[bgm BGM_EVENT_2 0.1]
[scene 10110]
[charaSet A 98001000 0 マシュ]
[charaSet B 98003000 2 Dr.ロマン]
…（C~F 同形）…
[fadein black 1]
[wait fade]

＠[51d4ff]アナウンス[-]
[51d4ff][line 3]塩基配列　　ヒトゲノムと確認[-][r][51d4ff][line 3]霊器属性　　善性・中立と確認[-]
[k]
```

**逐行处理**：

| 行 | 分类（S-P2） | 产物 |
|---|---|---|
| `＄01-00-00-00-1-0` | 场景头 | `Scene.Header = "01-00-00-00-1-0"`，不产生指令 |
| 空行 | 文本分隔 | 空文本指令（保留排版节奏） |
| `[soundStopAll]` | 命令行 | `{Tag:"soundStopAll", Params:[]}` |
| `[bgm BGM_EVENT_2 0.1]` | 命令行 | `{Tag:"bgm", Params:["BGM_EVENT_2","0.1"]}` |
| `[scene 10110]` | 命令行 | `{Tag:"scene", Params:["10110"]}` |
| `[charaSet A 98001000 0 マシュ]` | 命令行 | `{Tag:"charaSet", Params:["A","98001000","0","マシュ"]}`（位置参数 `"0"` → 槽位表索引 0 = (-256,0)，见 S-R3） |
| `[fadein black 1]` | 命令行 | `{Tag:"fadein", Params:["black","1"]}` |
| `[wait fade]` | 命令行 | `{Tag:"wait", Params:["fade"]}`——等待"fade 类指令完成" |
| `＠[51d4ff]アナウンス[-]` | 对话行 | 说话者解析：剥离行内标记 → `talkName="アナウンス"`；引擎将其与槽位 F 的显示名匹配（`IsEqualTalkName`） |
| `[51d4ff][line 3]塩基配列…[-][r]…` | 混合行 | 按 `[` 扫描切成 token 流：`[51d4ff]`→颜色、`[line 3]`→横线、`塩基配列　　ヒトゲノムと確認`→文本、`[-]`→颜色复位、`[r]`→软换行、`[51d4ff]`、`[line 3]`、文本、`[-]` |
| `[k]` | 消息边界 | `{Tag:"k"}` → 消息块结束，等待点击 |

**分词细节**（对 `[charaSet A 98001000 0 マシュ]` 应用 S-P3）：

```
GetCommandTag 从 '[' 后开始：'c','h','a','r','a','S','e','t' → 遇 ' ' 停 → Tag = "charaSet"
剩余 "A 98001000 0 マシュ]" 按空格切分 → Params = [A, 98001000, 0, マシュ]，']' 丢弃
```

**得到的指令数组（②产物，示意）**：

```
#0  soundStopAll      []              Line=3
#1  bgm               [BGM_EVENT_2, 0.1]   Line=4
#2  scene             [10110]         Line=5
#3  charaSet          [A, 98001000, 0, マシュ]   Line=6
#4  charaSet          [B, 98003000, 2, Dr.ロマン]  Line=7
… 
#9  fadein            [black, 1]      Line=12
#10 wait              [fade]          Line=13
#11 talkName          (＠行, talkName=アナウンス)  Line=15
#12 message           ([51d4ff][line 3]… token 流)  Line=16
#13 k                 []              Line=17
```

**实现提示**【建议】：对话行不要在解析期拆散文本与标记的配对关系——引擎保留 `data`（整行原文）+ 独立的 token 序列，渲染时才逐 token 消费；这样 BackLog、注音、颜色复位都不需要回溯。

---

## 3. 执行标准 S-E

### S-E1 指令执行与返回码【引擎】

分发器 `ScriptCommandExecute(tag, pd, line, data, …)` 返回 `ScriptCommandExecuteReturnCode`【引擎确认】：

| 返回码 | 语义 | 执行循环行为 |
|---|---|---|
| `Normal = 0` | 本指令已挂起等待（`isScriptWait=true`） | 停在当前指令，等待解除后前进 |
| `Continue = 1` | 本指令为即时演出 | 立即取下一条（同一帧可连续执行多条） |
| `ReturnFalse = 2` | 出错 | 进入错误处理 |

**实现要点**【建议】：Executor 主循环为 `while (返回码 == Continue)`，天然复刻"同帧连发即时命令、遇等待挂起"的引擎节奏——这是 FGO 演出手感的核心（一次点击后 fade+bgm+chara 同帧启动）。

### S-E2 状态机【引擎，`ScriptManager.State` 17 态】

```
NONE → IDLE → LOAD(加载+解密) → EXECUTE ──┬→ WAIT(等待点击/定时) → EXECUTE
              │                           ├→ WAIT_SKIP(跳过模式快速推进)
              │                           ├→ WAIT_EXIT → EXIT(结局淡出+回调)
              │                           └→ *_VIEW_INIT → *_VIEW(回忆查看)
              └→ ERROR(结构错误)
```

查看态四组：`BACK_VIEW`（背景）、`FIGURE_VIEW`（立绘）、`EQUIPGRAPH_VIEW`（灵基）、`IMAGE_VIEW`（图片）——对应 `[backViewPlay]/[figureViewPlay]/[equipGraphViewPlay]/[imageViewPlay]` 与 `PlayMode` 枚举的 `BACK/FIGURE/EQUIPGRAPH/IMAGE`（`PlayMode` 另有 `NORMAL/DEBUG`）。

### S-E3 指令阻塞四分类【引擎语义汇总】

| 类 | 命令族 | 循环行为 |
|---|---|---|
| 消息边界 | `[k] [q] [page] [page3]` | `Normal`：等待输入/自动计时 |
| 定时等待 | `[wt 秒] [wait 类型…] [tdelay] [tw] [twt]` | `Normal`：计时等待；部分类型可被点击打断 |
| 即时演出 | `charaSet/charaMove*/charaFace/scene/bgm/se/…` | `Continue`：启动动画即前进 |
| 有限时长转场 | `[fadein/fadeout/wipein/wipeout/flashin/flashout 时长]` | `Continue`（并行推进；引擎用 `isExecuteFade/isExecuteWipe/...` 跟踪进行中状态） |

### S-E4 播放速度与输入模态【引擎】

- `PlaySpeed`：`NONE / PAUSE / NORMAL / FAST`——跳过模式 = FAST；选项对话框打开时 PAUSE。
- `InputTopMode`（顶层输入模态 9 种）：`NORMAL / MENU(菜单) / SKIP_CONFIRM(跳过确认) / NOTIFICATION / INPUT(选项) / BACK_LOG(回顾) / SKIP_VOICE(语音跳过确认) / SHOW_BACK / EXIT`。阅读器 UI 层应实现为互斥模态栈【建议】。

### S-E5 开场模式【引擎，`StartMode` 17 种】

播放接口的初始画面状态（进入场景前的过渡）：

| 组 | 值 | 效果 |
|---|---|---|
| 直切 | `NONE(0)` | 无过渡 |
| 从色淡入 | `CLEAR_BLACK(1)/CLEAR_WHITE(2)/CLEAR(5)/CLEAR_FULL(9)/CLEAR_BLACK_FULL(12)/CLEAR_WHITE_FULL(13)` | 从黑/白遮罩淡入（`_FULL` 为全屏遮幅变体） |
| 先置色 | `BLACK_CLEAR(3)/WHITE_CLEAR(4)/BLACK(6)/WHITE(7)/BLACK_FULL(10)/WHITE_FULL(11)` | 先置黑/白屏再显场景 |
| 直通 | `THROUGH(14)/THROUGH_BLACK(15)` | 无过渡直入（`_BLACK` 保留黑底） |
| 特殊 | `BLACK_SCENE_STOP(16)` | 黑屏停住（配合后续命令才显示） |

阅读器 MVP 至少实现 `NONE/CLEAR_BLACK/BLACK/THROUGH` 四种，覆盖绝大多数场景【样本统计建议】。

### S-E6 控制流与状态【引擎】

- 线性游标 + 跳转：`[label x]` 建索引；`[jump x]` 无条件跳；`[branch …]` 族条件跳；`[tdelay]` 延迟跳转；`[ifClear]/[else]/[endIf]` 条件块；`[switchCase]/[switchEnd]` 按行号记忆选择（引擎 `switchSelections` 字典）。
- 旗标：`[flag on/off 判断标签]` → `ScriptFlagData` 列表（名称+布尔），分支命令按旗标求值。
- 路线选择：`[selectBranch]`/`[branchRouteSelect]`/`[masterBranch]`，选择结果有跨场景持久化（存档键见 §7）；`MenuRouteInfo.RouteType = NONE/BAD/TRUE` 标记路线性质（BAD=坏结局、TRUE=真结局）。
- 中断续播：`[interruption]` 支持战斗中插播剧本后返回（引擎 `isScriptInterruption`）。

### S-E7 自动播放与跳过【引擎】

- 自动模式：消息边界按 `autoWaitTime` 自动翻页；引擎以模板 `"[wait skippableTime {0:F2}]"` 生成等待【引擎常量】。
- 跳过模式：进入 `WAIT_SKIP` + `PlaySpeed.FAST`，快速推进、淡出当前演出（`skipFade` 记录，退出跳过时恢复）；语音可单独跳过（`SKIP_VOICE` 模态）。
- 跳过中的转场参数由 `skipFade/tapSkipFade` 字段控制——阅读器跳过模式应至少把逐字时间与移动动画加速到可接受程度【建议】。

### S-E8 从脚本到像素：一条指令的一生

以 `[charaSet A 98001000 0 マシュ]` 为例，从脚本文本到屏幕像素的完整路径【引擎结构】：

```
脚本文本行
  │ ① Parser（S-P）
  ▼
Instruction{Tag:"charaSet", Params:[A,98001000,0,マシュ]}
  │ ② Compiler 入列（executeIndex=3）
  ▼
③ Executor 主循环（State=EXECUTE）
  │  每帧: ScriptCommandExecute(tag,pd,line,data) —— string switch 命中 "charaSet" 分支
  ▼
④ 命令分支执行：
  ├─ 槽位检查：charaList["A"]（不存在则新建 ScriptCharaData，Kind=FIGURE）
  ├─ 资源加载：AssetManager.getAssetStorage("98001000") → 异步（State 字段 LOAD→IDLE）
  ├─ 位置写入：ScriptPosition.GetPosition(0) → (-256,0,0)
  │            → UIScriptChara.SetBasePosition → Transform.localPosition
  └─ 返回 Continue（1）→ 同帧继续取下一条指令
  │
  ▼（数帧后资源加载完成，EndLoadAsset 回调）
⑤ 渲染状态更新：
  ├─ UIScriptChara 挂立绘网格（身体+表情双 Mesh），SortingGroup.depth=默认层
  ├─ alpha 渐入（isWaitTalkMoveAlpha 状态跟踪）
  ▼
⑥ 帧合成（每帧，NGUI）：
  UIWidget/Panel 收集 → mesh 重建 → renderTextureCamera 绘制舞台 → RenderTexture
  → margeCamera 合成上屏 → ui2dCamera 绘制对话窗/系统 UI → 屏幕
```

**节奏特征**（复刻手感的关键）【引擎】：EXECUTE 态内"返回 Continue 就同帧连发"——所以 `bgm + scene + charaSet×6 + fadein` 在**同一帧**内全部启动，只有 `[wait fade]`（返回 Normal）把状态机推进到 WAIT。阅读器若把每条指令隔帧执行，演出节奏会明显"发糊"。

**等待解除路径**：WAIT 态下每帧检查 waitType 对应的完成标志（如 fade 的 `isExecuteFade==false`、点击输入、`wt` 计时归零）→ 返回 EXECUTE 继续游标。

---

## 4. 画面演出标准 S-R

> 坐标与合成的完整论证见格式规范"画面合成与坐标系（客户端逆向）"章。本章给实现口径。

### S-R1 画布与坐标【引擎】

| 项 | 标准 |
|---|---|
| 逻辑画布 | **1024 × 576**（16:9），单位=世界单位=虚拟像素 |
| 原点 | **画面正中心**；x 右正、y 上正；z 轴朝观察者（z 小者在前） |
| 边界 | x ∈ [-512, +512]、y ∈ [-288, +288] |
| 宽屏 | 21:9 横向扩展至 1346（`PICTURE_FRAME_SPRITE_WIDTH_21_9=1346`） |
| 长屏设备 | 默认 16:9 遮幅（`defaultForceObi_16_9=true`），`[enableFullScreen]` 解除遮幅改用全屏延展 |
| 写入方式 | 脚本坐标**原样**写入节点位置（`GetPosition(float,float)` 恒等，RVA 0x317ECF4），无单位换算 |

**窗口映射建议**：内部渲染固定 1024×576（或 1346×576），呈现时"contain（遮幅）"或"扩展（宽屏）"两种适配；不要缩放坐标数值。

### S-R2 合成层栈【引擎结构 + 建议实现】

自下而上：

| 层 | 内容 | 引擎对应 |
|---|---|---|
| L0 背景 | 双缓冲交叉淡化（`[scene]/[sceneSet]`） | `backSprite1/2 + sceneCrossFadeTime` |
| L1 角色 | A-Z 槽位立绘/图片 | `charaList[] → UIScriptChara`（SortingGroup 按 `charaDepth` 排序） |
| L2 特效 | `[effect]/[backEffect]/[fowardEffect]/[charaEffect]` | `CommonEffectManager`（翻转参数 H/V/F） |
| L3 转场 | fade/wipe/flash 全屏网格 | `meshFadeBase/meshWipeBase/meshFlashBase` |
| L4 画框 | 16:9 遮幅黑带 | `pictureFrameSprite`，z=-10（标准）/z=-230（顶部） |
| L5 对话窗 | 消息 UI（独立于舞台） | `ScriptMessageCommonManager` 体系 |
| L6 系统UI | skip/auto/log 按钮、选项框 | `actionPanel/systemPanel/blockPanel` |

子渲染层（`[subRender*]/[subCamera*]`）为**独立离屏层**：阅读器可用一张离屏画布实现（子模糊/子拉伸/叠加淡入都作用于该层）。

### S-R3 角色系统【引擎】

- **槽位 Kind**（`ScriptCharaData.Kind`）：`FIGURE=0` 立绘、`EQUIP=1` 灵基外观、`IMAGE=2` 图片、`VERTICAL_IMAGE=3` 竖图、`HORIZONTAL_IMAGE=4` 横图。`charaSet/equipSet/imageSet/verticalImageSet/horizontalImageSet` 五组命令共用 A-Z 槽位池（上限 `CHARA_MAX=26`）。
- **槽位坐标表**（`ScriptPosition.positionList`，`[charaSet/charaPut]` 第 3 参数为索引，越界回落 0）：

| 索引 | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| 坐标 | (-256,0) | (0,0) | (256,0) | (-438,0) | (-512,0) | (438,0) | (512,0) |
| 语义 | 左三分位 | 中央 | 右三分位 | 最左 | 左缘 | 最右 | 右缘 |

- **素材锚点**：立绘表 1024×2048；横向以图像中心为锚；纵向锚点在**下约 1/3 处（胸口线）**（表情网格 y ∈ [-254, +511] 不对称）。即 `Y=0` 时角色胸口位于画面中心高度。
- **动画基座**：位置/缩放/旋转/抖动分层插值（`UIScriptChara` 8 组基座 Transform）；`[charaMove*]` 为**绝对坐标**移动（时长+缓动，缓动函数表见格式规范附录）；`[charaRelativeLoopMove]` 为**相对偏移**循环（呼吸/悬浮，0,-2→0,0 型）。
- **表情**：`Face.Type`（`NORMAL=0, PLEASURE=1, CRY=2, EMBARRASSED=3, SAD=4, ANGRY=5, FACE_6…59`），从 1024×2048 表按 254×254 块裁切（2A 特殊表情 256×256）；切换用双网格交叉淡化（`[charaFaceFade]`；`UIScriptChara.ChangeKind = NONE/NORMAL/FADE/BLINK/CROSS_FADE` 对应 `[charaChange]` 变体）。
- **阴影/滤镜**：`[charaShadow]`（`SetShadow`）、`[charaFilter]`（`SetFilter(name,color)`）。

### S-R4 背景与场景【引擎】

- `[scene id]`：装载 `id` 对应背景图，双缓冲交叉淡化（时长为参数或默认 0.5s）；`[sceneSet]` 预装载；`SCENE_MODE = DEFAULT / FULLSCREEN_IMAGE_DEVICE_WIDTH`（扩展参数控制设备宽全屏显示）。
- `[pictureFrame]`：画框/遮幅形态控制。

### S-R5 转场【引擎】

| 命令族 | 网格层 | 要点 |
|---|---|---|
| `[fadein/fadeout 色 时长]` | `meshFadeBase` | 命名色 + 16 进制色（18+ 种）；未给时长默认 `DEFAULT_FADE_TIME=0.5`s |
| `[wipein/wipeout 方向 时长]` | `meshWipeBase` | 30+ 方向；`[wipeFilter]`（cinema/circleIn/openEye/downToUp…）与 `[wipeoutEx]`（ExWipeType.CutVar）为花式遮罩 |
| `[flashin/flashout …]` / `[flashDep]` | `meshFlashBase` | 多段时序（time1/2/3 + 双色） |
| `[shake X,Y 周期 时长]` | shakeRoot | 屏幕震动（角色级另有 `[charaShake]`） |

### S-R6 镜头【引擎结构，父链标注推测】

`[cameraMove]/[cameraRoll]/[cameraScale]/[cameraHome]` 作用于嵌套层级 `cameraScale → cameraPosition → cameraRoll1 → cameraRoll2`（父链来自字段命名与序列化顺序）。阅读器等价实现：**对整块舞台画布（L0–L3）施加仿射变换链**——平移（cameraMove，坐标同脚本坐标系）、旋转（cameraRoll，角度制）、缩放（cameraScale），`[cameraHome]` 复位全部。子相机（`[subCameraMove/Roll/Filter]`）只作用于离屏子层。

### S-R7 文本窗【引擎】

- 逐字渲染：步进时间 = `stepTime`（默认 `defaultStepTime`，受玩家设置与 `[s]/[speed]` 调制）；
- 两种窗口模式：普通窗（`ScriptMessageManager`）与头像窗（`ScriptFaceMessageManager`），由 `[charaTalk]` 切换（开/关/多角色 `spot`）；
- 说话者高亮：非说话角色压暗（引擎由 talkName→槽位匹配驱动）；
- BackLog：需要"去标记纯文本"流（引擎有独立的 log 消息构建路径 `ScriptLogMessage/ScriptBackLog`）。

### S-R8 不可复刻演出的降级【建议】

| 引擎能力 | 阅读器降级方案 |
|---|---|
| `[fsm]`/`[fsmObj*]`（PlayMakerFSM 演出，Fgo.PlayMaker.dll 935 action） | 占位静帧 + 保留命令等待时长，保证叙事节奏 |
| `[insertionAnimation]`（插入动画） | 同上 |
| `[criMovie]` | 视频播放器替位（无素材时显示章节卡） |
| `[useSimpleMeshFigure]`（网格模型） | 以立绘/静帧替位 |
| `[capture]`（屏幕捕获） | 截取当前画布为纹理 |

降级时**必须保留命令的等待语义**（时长/边界），否则时间轴错位。

### S-R9 特效实现手册

每款特效给出三层信息：**引擎状态字段**（dump.cs 确认）→ **shader 属性**（二进制字符串常量确认）→ **实现配方**（伪代码；标注推测处）。转场/滤镜类特效都是"全屏网格层 + 材质参数动画"，阅读器等价实现为一个带自定义 shader 的全屏 Sprite/Quad。

#### R9.1 淡入淡出（`[fadein]/[fadeout]/[fadeMove]`）

- **引擎字段**：`fadeName(颜色名)/fadeColor(Color)/isExecuteFade`；承载层 `meshFadeBase`（UITweenRenderer）。
- **shader 属性**：`_ClipFade / _FADE_CLIP / _FadeDegreeFrom / _FadeDegreeTo / _FadeFactor / _FadeTime`。
- **配方**：

```
全屏 Quad，材质颜色 = fadeColor
fadeout: alpha 0→1（时长 t，线性或 ease）        # 屏幕被 fadeColor 覆盖
fadein : alpha 1→0                              # 从遮罩中显现
进行中标志 isExecuteFade；[wait fade] 等待其归位
```

- `fadeMove`（叠加移动淡入）在 fade 基础上带位移插值【推测：_FadeDegree 渐变区间即来源】。

#### R9.2 擦除（`[wipein]/[wipeout]/[wipeinEx]/[wipeoutEx]/[wipeFilter]`）

- **引擎字段**：`wipeName/wipeAssetData/isExecuteWipe/isLoadWipe/isWipeFilter/isWipeIn/wipeDuration/wipeLevel/wipeParam1~4`；承载层 `meshWipeBase`（ExUIMeshRenderer）；`ExWipeType = None / CutVar`。
- **shader 属性**：`_WipeTex`（遮罩图）、`_WipeX / _WipeY`（位移）、`_WipeColor`、`_PetternNumber`（图案号）、`_ErasureColor`。
- **配方**：

```
遮罩纹理 wipeTex 按方向从一侧扫过屏幕（方向 = 命令方向参数 30+ 种）
进度 p: 0→1（时长 wipeDuration）；wipeLevel/wipeParam* → 材质参数（羽化/阈值）
像素 alpha = step(wipeTex(uv + dir*p * _WipeX/Y), level)   # 掩膜阈值扫描【推测：具体函数由 shader 定】
wipeout = 场景被擦除层覆盖；wipein = 从覆盖中显现
wipeFilter（cinema/circleIn/openEye/downToUp…）= 更换 _WipeTex 图案（_PetternNumber 选图案）
wipeoutEx（ExWipeType.CutVar）= 碎片切割变体（引擎持有 wipeExCutVarTriangles 三角表）
```

#### R9.3 闪光（`[flashin]/[flashout]/[flashDep]`）

- **引擎字段**：`flashName/isExecuteFlash/isEndRequestFlash/flashCount/flashTime1/2/3/flashColor1/2`；`flashDep*` 为另一组（Depth 变体，`flashDepNum`）；承载层 `meshFlashBase`。
- **shader 属性**：`_FlashColor`。
- **配方**：

```
重复 flashCount 次三段时序（time1/time2/time3，颜色在 flashColor1/2 间过渡）【三段具体波形为推测：
常见实现为 升起(time1)-保持(time2)-回落(time3) 的三角/梯形 alpha 脉冲】
flashDep：叠加一层"深度闪光"（依赖亮度的泛光型二次闪光）【推测】
```

#### R9.4 屏幕/角色震动（`[shake]/[charaShake]`）

- **引擎字段**：屏幕级 `shakeTime/shakeCycle/shakeX/shakeY` 作用于 `shakeRoot`；角色级 `UIScriptChara.baseShake` 层（`shakeTime/shakeCycle` 字段同名）。
- **配方**：

```
t < shakeTime 期间：offset(t) = 振幅 * 波形(t / shakeCycle)
    shakeX/shakeY 为各自振幅；周期参数 shakeCycle【波形推测：sin 或衰减随机】
t ≥ shakeTime：offset 归零
```

#### R9.5 镜头滤镜（`[cameraFilter]/[subCameraFilter]`）

- **引擎入口**：`SetCameraFilter(filterName, float[] paramsFloat)`（RVA 0x3138290）→ `GetSpriteScriptActionRenderShader(shaderName)` **按名加载 shader**。
- **shader 属性**（滤镜族，字符串常量确认）：`_ColorMatRow0~3`（4×4 色彩矩阵）、`_ColorMatrixTime`、`_Saturation/_Contrast/_Bright`、`_Luminance/_Threshold`、`_Blur/_BlurLv/_BlurSize/_BlurDistance/_KernelSize/_Sigma/_Spread`（高斯/散景族）、`_VignetteTex`、`_ChromaticAberration/_AxialAberration`、`_GrainTex/_GrainOffsetScale`（胶片颗粒）、`_FilterColor/_FilterParam`。
- **配方**：滤镜 = 后处理 pass（作用于舞台 RT）：色彩滤镜（如 `darkred`）= 颜色矩阵乘法；模糊类 = 多 tap 高斯（`_Offsets` 双 pass）；滤镜名→shader/参数表需按 `filterName` 建映射【建议：先实现 色彩矩阵 + 高斯 两种，覆盖多数滤镜】。

#### R9.6 角色滤镜与边缘模糊（`[charaFilter]/[charaSpecialEffect]`）

- **引擎入口**：`ScriptCharaData.SetFilter(name,color)`、`UIScriptChara.SetEffectEdgeBlur(effectName, color, particleColor, isSkip, isPause, flip, level, thick)`。
- **shader 属性**：`_FilterColor/_FilterParam`（滤镜）；`_EdgeColor/_EdgeWidth/_Thick`（边缘模糊/发光描边）。
- **配方**：立绘网格做基于 UV 边缘距离的模糊/染色；`level/thick` 控制强度与宽度；粒子颜色供描边粒子【推测】。

#### R9.7 后处理特效（`[distortionstart]/[subBlur]/[frostedGlass]` 等）

- **引擎类**：`ScriptActionRenderEffectController` 持有参数类 `DistortionParam / GaussianBlurParam / MotionBlurParam / FrostedGlassParam`；`Adv.Core.Graphics`（CustomPostProcess/ScreenEffectBlur/ScreenEffectCrossFade/DofSetting）。
- **shader 属性**：`_Sigma/_KernelSize`（高斯）、`_Strength/_Scale`（扭曲）、`_Timelines/_TimeValue`（动态噪声）。
- **配方**：RT 级二次处理——扭曲 = UV 偏移噪声；毛玻璃 = 降采样+模糊+噪声混合；运动模糊 = 帧间混合。全部可降级【建议】：MVP 用静态模糊贴图代替。

#### R9.8 表情切换与角色换装（`[charaFace]/[charaFaceFade]/[charaChange]`）

- **引擎字段/枚举**：`UIScriptChara.ChangeKind = NONE/NORMAL(直切)/FADE(淡入)/BLINK(眨眼)/CROSS_FADE(交叉淡化)`；`SetFace(type, fadeTime)`。
- **shader 属性**：`_FaceTex / _FaceTex2 / _FaceTexOffset(2) / _FaceAlphaTex(2)` —— **双表情纹理 + alpha 混合**。
- **配方**：双 Mesh 淡化——faceMesh0 显示旧表情，faceMesh1 显示新表情，alpha 0→1（fadeTime）；BLINK = 快速两次 alpha 脉冲【推测】；`[charaChange]` 整体替换立绘图像（身体+表情，kind/speed 参数控制剪切或淡化过渡）。

#### R9.9 消息窗动画与逐字显示

- **引擎字段**：`ScriptMessageCommonManager` 的 `windowUpCurve/windowDownCurve（AnimationCurve）/windowOpenTime/windowCloseTime/windowNormalPosY/windowClosePosY/stepTime`；`ScriptLineMessage` 的 `mainPrefab/rubyPrefab/imagePrefab` 对象池。
- **配方**：

```
窗体开合：messageWindow.anchoredPosition.y 从 windowClosePosY → windowNormalPosY
          按 windowUpCurve 插值（windowOpenTime 秒）；关闭用 windowDownCurve
逐字显示：stepTime 间隔推进一个字符；遇 [r] 换行、[line N] 插横线、[#汉字:かな] 挂 ruby 预制体、
          [image] 挂图片预制体；[/]颜色标记即时切换 UILabel color
点击打断：正在逐字输出时点击 → 立即补全整段【建议，常规视觉小说行为】
```

#### R9.10 补间体系

- **移动/缩放/旋转**：`[charaMove*]` 族走引擎内插值（`UIScriptChara.isMove/changeStep/changeTotal` 字段 + `moveRelativePositions` 循环），缓动函数名来自脚本（20 种，见格式规范附录）；`iTween` 亦在场（字符串 `iTweenOnComplete` 出现在分析器中）。
- **阅读器建议**：实现一个统一 Tween 服务（值插值 + 20 种缓动 + onComplete 回调），所有位移/缩放/旋转/透明度共用；时长单位一律秒，帧率无关。

### S-R10 场景帧构建手册

**静态搭建**（进入场景一次）：

1. 画布初始化：1024×576 逻辑坐标、中心原点、正交相机；舞台层 + 离屏子层 + 对话窗层。
2. 应用 `StartMode`（S-E5）：如 `CLEAR_BLACK` = 先全屏黑，`THROUGH` = 直接显示。
3. 处理 `＄` 头部（仅记录）；执行前文变量替换（`ScriptReplaceString` 玩家名/性别）。

**动态帧循环**（每帧）：

```
① Executor: State==EXECUTE 时消费指令直到返回 Normal（S-E8）
② 推进补间：移动/缩放/旋转/震动/转场网格 alpha（含 isExecuteFade 等完成标志）
③ 文本步进：WAIT 且 waitType==消息时按 stepTime 显示字符
④ 音声tick：BGM 淡入淡出、SE 计时
⑤ 合成输出：背景双缓冲 → 角色层(按 depth) → 特效层 → 转场网格 → 遮幅画框 → 对话窗 → 系统 UI
⑥ WAIT 解除判定：点击 / 定时 / 完成标志 → 回到 EXECUTE
```

**序章实例推演**（对应 S-P8 指令数组）：

| 指令 | 帧上可见状态 |
|---|---|
| `#0 soundStopAll` | 无可见变化 |
| `#1 bgm BGM_EVENT_2 0.1` | BGM 起播（0.1s 淡入），画面仍全黑（StartMode 黑屏） |
| `#2 scene 10110` | 背景装载到 L0（被黑幕遮住） |
| `#3~#8 charaSet×6` | 六个槽位注册：A(-256,0)左、B/C(256,0)右、D/E/F(0,0)中央——后设的盖住先设的，资源异步加载 |
| `#9 fadein black 1` | 黑幕 alpha 1→0（1 秒）——**同帧启动**，之后画面=背景+中央角色们 |
| `#10 wait fade` | 状态机 WAIT 1 秒 |
| `#11~#13 ＠アナウンス + 正文 + [k]` | 消息窗上滑（windowUpCurve），蓝字（51d4ff）逐字输出两行带横线的文本，等点击 |

**构图速查**：单角色=槽位 1 居中；双角色=0/2 三分位；三人=0/1/2；退场预放=3/5（±438）或 4/6（±512 屏缘外）。

---

## 5. 音声与视频标准 S-A

- **BGM**：`[bgm 名 音量 淡入]` / `[bgmStop 名 淡出]`（参数序见格式规范）；`[subBgm]`、`[keepSubBgm]` 双通道。素材名为 `BGM_EVENT_*` 等引用，需要"名→音频"映射表。
- **SE**：`[se 名 通道?]`、`[seStop]`、`[seVolume]`、`[seContinue]`（跨消息持续音）、`[seLoop]`。
- **CUE SE**：`[cueSe …]` 族（CRIWARE cue 表：`cueSe/cueSeStop/cueSeVolume/cueSeContinue*`）。
- **语音**：`[voice]`、`[voiceStop]`；语音文件名与脚本/台词关联（`CharaSoundManager`），阅读器可按 `svtId` 命名规则建立映射。
- **Jingle**：`[jingle]/[jingleStop]`（标题/结算短曲）。
- **全部停止**：`[soundStopAll]`（引擎确认标签；`[soundStopAllFade]` 带淡出）。
- **视频**：`[criMovie 名 …]`（`PlayCRIMovie` RVA 0x3153FD8），参数控制 BGM/SE/语音/脚本是否暂停；断点续播键见 §7。

**通道模型建议**：BGM(1) + SubBGM(1) + SE(多通道，`seContinuePlayers` 字典) + Voice(1) + Jingle(1)【与引擎字段结构对齐】。

---

## 6. 素材体系

- **打包位置**：APK 内 `assets/bin/Data/data.unity3d` + 运行期下载的 AssetStorage（`GetStartModeForAssetStorage(path, label)` 暗示按路径+label 组织）【引擎】。工具：AssetStudio / UnityPy。
- **命名映射**：
  - 立绘/表情：imageId（如 `98001000`）+ `Face.Type`；`ConvertPictureFrameImageName/GetCharaImageNameAndFormId` 负责名字变换【引擎】；
  - 背景：`[scene]` id（如 `10110`）；`GetBackTextureNameScene(data)` 做名字变换【引擎】；
  - 音声：`BGM_EVENT_*`、se 名、cue 名；视频：criMovie 名。
- **脚本加密**：部分脚本体加密，密钥表 `ScriptEncryptSettings`（scriptName→keyType）【引擎】；语料库中的 `fgo_scripts/scripts` 已是解密明文。
- **阅读器策略**【建议】：建立"资源 ID → 本地文件"清单（JSON/DB），缺资源时以占位符 + 文本继续，不阻塞播放。

---

## 7. 进度与状态持久化

引擎持久化键【引擎确认】：

| 键 | 内容 |
|---|---|
| `ScriptManagerAutoMessage` | 自动播放开关 |
| `ScriptManagerSelectBranch` | 选项分支历史 |
| `TalkResumeKeyV2` | 对话断点（BattleScriptRootComponent.TalkScriptInfo） |
| `MovieResumeKey` / `PlayedLastMovieKey` | 影片断点 / 已播标记 |
| `dialogIgnoreTime` | 对话框忽略计时 |
| switchSelections（内存） | `switchCase` 选择（按行号）——同一场景内有效 |

**阅读器标准**【建议】：进度 = `(脚本名, 指令索引)`；分支状态 = flag 表 + switchCase 字典 + 路线选择（含 BAD/TRUE 标记）；提供"从头播放/从断点续播/跳过已读"三入口。

---

## 8. 引擎常量与枚举总表

### 常量（值取自 `.rodata` 字面量池 / 引擎字段）

| 常量 | 值 |
|---|---|
| 虚拟舞台 | 1024×576（16:9）；21:9 宽 1346 |
| `DEFAULT_FADE_TIME` | 0.5 s |
| `PICTURE_FRAME_Z_POS_NORMAL / TOP` | -10 / -230 |
| `CHARA_MAX / FACE_MAX` | 26 / 133 |
| 立绘表 | 1024×2048；表情块 254×254（2A=256，UV 0.9883） |
| `AUTO_WAIT_TAG_FORMAT` | `[wait skippableTime {0:F2}]` |
| 槽位表 positionList | (-256,0) (0,0) (256,0) (-438,0) (-512,0) (438,0) (512,0) |
| charaOffsetList | 3 项全 0（预留微调） |

### 枚举（全部从 `dump.cs` 提取）

| 枚举 | 值 |
|---|---|
| `State`(17) | NONE IDLE LOAD EXECUTE WAIT WAIT_SKIP WAIT_EXIT EXIT BACK_VIEW_INIT BACK_VIEW FIGURE_VIEW_INIT FIGURE_VIEW EQUIPGRAPH_VIEW_INIT EQUIPGRAPH_VIEW IMAGE_VIEW_INIT IMAGE_VIEW ERROR |
| `StartMode`(17) | NONE CLEAR_BLACK CLEAR_WHITE BLACK_CLEAR WHITE_CLEAR CLEAR BLACK WHITE FULL CLEAR_FULL BLACK_FULL WHITE_FULL CLEAR_BLACK_FULL CLEAR_WHITE_FULL THROUGH THROUGH_BLACK BLACK_SCENE_STOP |
| `PlayMode`(6) | NORMAL DEBUG BACK FIGURE EQUIPGRAPH IMAGE |
| `PlaySpeed`(4) | NONE PAUSE NORMAL FAST |
| `InputTopMode`(9) | NORMAL MENU SKIP_CONFIRM NOTIFICATION INPUT BACK_LOG SKIP_VOICE SHOW_BACK EXIT |
| `ReturnCode`(3) | Normal=0 Continue=1 ReturnFalse=2 |
| `CharaData.Kind`(5) | FIGURE=0 EQUIP=1 IMAGE=2 VERTICAL_IMAGE=3 HORIZONTAL_IMAGE=4 |
| `CharaData.State`(4) | LOAD IDLE MOVE DESTROY |
| `ChangeKind`(5) | NONE=0 NORMAL=1 FADE=2 BLINK=3 CROSS_FADE=4 |
| `Face.Type` | NORMAL=0 PLEASURE=1 CRY=2 EMBARRASSED=3 SAD=4 ANGRY=5 FACE_6…FACE_59… |
| `SCENE_MODE`(2) | DEFAULT=0 FULLSCREEN_IMAGE_DEVICE_WIDTH=1 |
| `ExWipeType`(2) | None=0 CutVar=1 |
| `RouteType`(3) | NONE=0 BAD=1 TRUE=2 |

### 关键 RVA（Il2CppDumper 口径；Ghidra 中 +0x100000）

| 方法 | RVA |
|---|---|
| `ScriptCommandExecute`（分发器） | 0x30FA9D4 |
| `ScriptAnalys` / `AnalysText` | 0x313C968 / 0x314154C |
| `LoadScript` / `ExecuteScript` | 0x313C670 / 0x313C2A0 |
| `GetCommandTag` | 0x314A1FC |
| `ScriptPosition.GetPosition` | 0x317EC40 / 0x317ECF4 |
| `UIScriptChara.SetBasePosition` | 0x3186540 |
| `SetCharaFace` / `SetSceneImage` / `PlayCRIMovie` | 0x314FAC0 / 0x314FF40 / 0x3153FD8 |

---

## 9. 核心命令 → 演出映射速查

> 高频命令（按 2,583 文件词频），动作语义与格式规范"命令参考"章一致；详细参数见该章。阻塞列：**等待**=消息边界/定时，**即时**=启动后前进，**并行**=带时长推进。

| 命令 | 演出动作 | 阻塞 |
|---|---|---|
| `[k]` | 消息边界，等点击 | 等待 |
| `[r]` | 软换行 | 即时(文本) |
| `[wt 秒]` | 定时等待，可点击打断 | 等待 |
| `[charaFace 槽 表情]` | 切表情（双网格交叉淡化） | 即时 |
| `[charaFadeout 槽 时长]` / `[charaFadein 槽 时长]` | 角色淡出/入 | 并行 |
| `[charaTalk on/off/A,B]` | 切换对话窗模式/多角色共演 | 即时 |
| `[messageOff]` | 隐藏消息窗 | 即时 |
| `[wait 类型…]` | 按类型等待（资源加载/动画完成等 25+ 种） | 等待 |
| `[charaSet 槽 id 位置 名]` | 建/换角色（Kind=FIGURE） | 即时 |
| `[se 名 …]` / `[seStop]` / `[seVolume]` | 播放/停止/调音量 | 即时 |
| `[charaDepth 槽 N]` | 排序层级 | 即时 |
| `[charaScale 槽 倍率]` | 缩放 | 即时 |
| `[bgm 名 音量 淡入]` / `[bgmStop]` | BGM 播放/停止 | 即时 |
| `[charaPut 槽 位置]` | 放置角色到槽位坐标 | 即时 |
| `[scene id]` | 背景交叉淡化 | 并行 |
| `[charaMove 槽 X,Y 时长]` | 绝对坐标移动 | 并行 |
| `[fadein/fadeout 色 时长]` | 全屏淡入出 | 并行 |
| `[cueSe …]` 族 | CRI cue 音效 | 即时 |
| `[soundStopAll]` | 全部声音停止 | 即时 |
| `[charaEffect 槽 效果名]` / `[charaEffectStop/Destroy]` | 角色粒子/特效 | 即时 |
| `[effect 名]` / `[effectStop/Destroy]` | 场景特效 | 即时 |
| `[wipein/wipeout 方向 时长]` | 擦除转场 | 并行 |
| `[charaShake 槽 X,Y 周期 时长]` | 角色震动 | 并行 |
| `[end]` | 场景结束（→EXIT） | 等待 |
| `[charaMoveEase 槽 X,Y 时长 缓动]` | 缓动移动 | 并行 |
| `[cameraMove X,Y 时长]` / `[cameraHome]` | 镜头平移/复位 | 并行/即时 |
| `[shake X,Y 周期 时长]` | 屏幕震动 | 并行 |
| `[subRenderFadein/Fadeout/Move/Scale/Depth]` | 子渲染层演出 | 并行 |
| `[charaFaceFade 槽 时长]` | 表情交叉淡化 | 并行 |
| `[imageSet 槽 id]` | 图片槽位（Kind=IMAGE） | 即时 |
| `[subCameraOn/Off/Filter]` | 子相机开关/滤镜 | 即时 |
| `[charaFadeTime 槽 时长]` | 修改后续淡入淡出时长 | 即时 |
| `[charaMoveReturn 槽 时长]` | 移回槽位原坐标 | 并行 |
| `[charaMoveScale 槽 倍率 时长]` | 缩放动画 | 并行 |
| `[fowardEffect 名]` | 前景特效 | 即时 |
| `[charaSpecialEffect …]` | 角色特殊演出（模糊/边缘模糊等） | 即时/并行 |
| `[flashin/flashout …]` | 闪光转场 | 并行 |
| `[enableFullScreen]` | 解除 16:9 遮幅 | 即时 |
| `[label x]` / `[jump x]` / `[branch …]` | 控制流 | 即时 |
| `[pictureFrame …]` | 画框/遮幅控制 | 即时 |
| `[communicationCharaClear/Loop/Face]` | 通讯立绘控制 | 即时 |
| `[overlayFadein …]` | 叠加层淡入 | 并行 |
| `[messageShake …]` | 消息窗震动 | 并行 |
| `[align center/right]` / `[blur]/[blurOff]` | 对齐/画面模糊 | 即时 |
| `[selectBranch]` / `[flag]` / `[switchCase]` | 分支/状态 | 等待(选项)/即时 |
| `[criMovie …]` | 播放视频 | 等待 |
| `[fsm …]` / `[fsmObj*]` | FSM 演出（建议降级，见 S-R8） | 视实现 |
| `[end]` | 结束（同上） | 等待 |

未列出命令见格式规范"命令参考"全表（299 种）；实现顺序建议按本章词频从上到下。

---

## 10. 实施路线建议

| 阶段 | 范围 | 覆盖率预估 |
|---|---|---|
| MVP | S-P 全部 + S-E1~E3 + S-R1/R2(基础层)/R3(立绘+表情)/R4/R5(fade) + 文本窗 | 高频命令约 80% 场景可读 |
| V1 | S-E5~E7 + S-R5(wipe/flash)/R6 镜头 + S-A 音声 + 分支选择 UI | 接近完整体验 |
| V2 | 子渲染层、回忆查看态、BackLog、断点续播、FSM 降级占位 | 全量 |

**验收口径**：以 `scripts/Singularity FFlame Contaminated City Fuyuki/0100000010.txt`（序章，含 `[charaSet]/[scene]/[bgm]/[fadein]/[k]` 基本闭环）与任一含 `[selectBranch]` 的章节为冒烟用例；逐字速度、槽位构图（1=居中、0/2=三分位）与官方截图对照。

## 11. 本阅读器实现状态（v6 管线重构后）

> 2026-08-30 按本标准完成的三段管线重构。解析器版本升级为 **v6**（进度/已读/选项轨迹/翻译缓存的存储键随版本隔离，旧记录自动失效）。

**已对齐标准**

| 标准项 | 实现 |
|---|---|
| ① Parser（S-P） | `src/lib/scriptSyntax.ts`（AST、行分类、分词、容错，重构前即达标） |
| ② Compiler（S-P6） | `src/adv/compiler.ts`：AST → `Instruction[]`（tag/params/line/column/raw/isMessage），`Labels` 索引、消息目录（`messageCatalog`）、选项目录（`choiceCatalog`）；？选项块降级为「choice 指令 + 选项体内联 + jump 汇合」；未解析标签退化线性播放（S-P7） |
| ③ Executor（S-E） | `src/adv/executor.ts`：游标 + `while(Continue)` 同帧连发（S-E1/E8）、四类阻塞（S-E3：消息边界/定时/即时/转场完成标志）、`[wait fade]` 由补间完成标志自动释放、`PlaySpeed`/`timeScale`、`fastForwardTo` 断点快进续播（S-E7/§7）、运行时控制流（S-E6：`jump`/`branch`(旗标)/`flag`/`ifClear`/`else`/`endIf`/`switchCase` 记忆） |
| 舞台层栈（S-R2） | `src/adv/stage.ts`：L0 背景双缓冲（`scene` 交叉淡化）、L1 A-Z 槽位（Kind/深度/子渲染可见性/遮挡剔除）、L3 转场网格状态（fade 为补间 alpha；wipe/flash/shake 为一次性序列号触发）、L4 画框、L5 消息窗状态 |
| 补间体系（S-R9.10） | `src/adv/tween.ts` + `src/adv/easings.ts`：20 种语料缓动、秒单位帧率无关、按 owner 取消、快进时 `finishAll()`；`charaMove*`（含 `charaMoveScale`）与 `cameraMove*` 按脚本时长+缓动补间，`fadein/fadeout` 与 `scene` 交叉淡化走补间 |
| 文本窗（S-R7/R9.9） | `src/adv/message.ts`：token 流逐字步进（标点停顿）、`[hex]…[-]` 颜色、`[#漢字:かな]` ruby（`<ruby>` 渲染）、`[line N]`、`[align]`、`[s]/[speed]`、点击补全 |
| 音声通道（S-A） | `src/adv/audio.ts`：BGM(1)+SubBGM(1)+SE(多通道)+Voice(1)+Jingle(1) 意图通道，`se/voice/jingle/subBgm` 命令已接入；BGM 交叉淡化仍由 `useBgm` 驱动；SE/Voice 缺素材映射时静默降级（§6 策略） |
| 进度与状态（§7） | 进度 = `(脚本名, 指令索引)`（消息边界为恢复锚点）；断点恢复/历史跳转/回退统一走 `fastForwardTo` 快进重放；选项轨迹按 choice 指令稳定 id 记录，重选时替换 |

**与标准的差异（现状）**

- `StartMode` 仅实现视觉子集（`NONE/CLEAR_BLACK/CLEAR_WHITE/BLACK/WHITE/THROUGH`），其余映射为 NONE。
- wipe/flash 转场仍为一次性 CSS 动画（时长/方向参数未完全参数化）；`[shake]` 为固定节奏 CSS 动画，未实现振幅/周期波形。
- 相机滤镜仅 `gray/darkred/inversion` 三种 CSS 近似（S-R9.5 的色彩矩阵/高斯未实现）；`[fsm]/[criMovie]/[insertionAnimation]` 维持降级占位（S-R8）。
- SE/Voice 通道就绪但无素材映射表（Atlas 不提供），播放静默。
- `[branchMaterial]/[branchRouteSelectCount]/[branchSetGrandSvtCount]` 与任务通关类条件按"首次阅读"路径处理（阅读器无玩家进度）。

---

> **文档版本**: v1.1（2026-08-30）
> **证据快照**: APK 2.138.0 / 2,583 脚本 / fgo_dump 逆向产物
> **更新内容**:
> - v1.1: 新增 **S-P8 解析走查**（序章脚本逐行 → token → 指令数组）、**S-E8 从脚本到像素**（一条指令的一生 + 同帧连发节奏）、**S-R9 特效实现手册**（淡入淡出/擦除/闪光/震动/镜头滤镜/角色滤镜/后处理/表情交叉淡化/消息窗动画/补间体系，字段→shader 属性→算法伪代码三层口径）、**S-R10 场景帧构建手册**（静态搭建+帧循环+序章实例推演）
> - v1.0: 初版（S-P/E/R/A 标准、常量枚举总表、命令映射速查、实施路线）
> **配套文档**: [`FGO_Script_Format_Spec.md`](FGO_Script_Format_Spec.md)（语法与命令全集）、[`fgo_dump/FGO剧情引擎分析报告.md`](fgo_dump/FGO剧情引擎分析报告.md)（引擎结构总报告）

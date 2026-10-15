# 未还原功能补齐指南（how-to-adv-unrestored）

对象：`Fate/Grand Order` Android **2.139.3**（IL2CPP arm64，`libil2cpp.so`）。
依据：[`adv-unrestored.md`](adv-unrestored.md)（2026-10-14 核查：154 条命令无实际处理分支 + 部分实现表 17 行）。
本文做什么：对上述每一项做**针对性逆向补证**，给出「原生机制（带 VA 证据）→ 阅读器补齐步骤 → 资源缺失时的安全降级 → 验收口径」。
本次全部证据另存 8 份，见文末 §24「证据文件索引」；凡标 `INFERRED` 的为推断，其余为反汇编/类体/语料实测。

> 阅读器指 Web（TS/DOM/CSS）实现；本文的"补齐步骤"直接对着这类实现写。
> 语料口径：`scripts/` 33 章 2,583 个 `.txt`，1,867,761 行（与 `coverage-verification.md` 一致）。
> 频次表：`work/coverage/tag_counts.json`（本次全量统计）。

---

## §0 总览

### 0.1 与 adv-unrestored.md 的对照

| adv-unrestored.md 功能组 | 条数 | 语料有出现的条数 | 本次结论要点 |
|---|---:|---:|---|
| 常规、前后景及角色特效 | 41 | 31 | 逻辑可全量实现；视觉需 `Effect/*` prefab |
| 通讯窗口 | 5 | 5 | 逻辑全量实现；立绘/噪声层需资源 |
| 角色切入与攻击 | 6 | 3 | 状态机全量实现；划像贴图可选 |
| 角色循环及复位 | 5 | **0** | **纯逻辑**，实现成本最低 |
| PlayMaker FSM | 8 | 4 | 逻辑可实现；FSM 图语义需 prefab/离线转换 |
| 插入动画 | 7 | 3 | 逻辑可实现；时长/贴图需 prefab |
| ADV prefab / 3D 演出 | 6 | **0** | 语料 0 → 解析+no-op 即可 |
| 影片 | 2 | 2 | 名称/阻塞/跳过必须实现；USM 解码走占位/转码 |
| CRI cue 与 BGM 保留 | 11 | 6 | 与 se/voice 同管线，仅寻址不同；续播池/keep 计数可 1:1 |
| 游戏条件分支 | 9 | 6 | 求值框架纯逻辑；真值需 `GameStateProvider` 注入 |
| 随机旗标 | 1 | 0 | 3 行代码 + 回放轨迹（避免 unsupported） |
| 游戏流程及名字宽度 | 4 | 1 | `masterNameWidth` 双标签需 compiler 扩展 |
| 消息窗、字体和头像 | 13 | 6 | 8 条纯逻辑；`messageShake` 是高频（635 含内联） |
| 菜单及显式选项命令 | 5 | 0（控制符产生 2.9 万行） | 与 `？/？！` 同一 tag 码路，归一到现有 `$choice` |
| 截屏及渲染模式 | 4 | 4 | `backCameraColor` 43 次性价比最高 |
| 畸变及精灵遮罩 | 6 | 2 | 计时/状态必须照走；shader/贴图需资源 |
| 拉伸、翻页和滚动 | 10 | 6 | 全部纯逻辑补间/状态位；`screen` 是文本框矩形（非画面变形） |
| 结束淡出 | 1 | 1 | 与 `end` 的 startMode 链已完整实证 |
| 战棋/战斗演出 | 10 | **0** | 语料 0 且无 wait → 识别+跳过+诊断 |
| （部分实现表 17 行） | — | — | 逐项收口清单见 §20 |

### 0.2 三条全局前置（不先落地，后面 154 条会全部错位）

**前置 1：参数模型 =「值/分隔符」交错 token 数组（已去掉 tag）。**
`ScriptManager$$AnalysParam`（`0x31a7688`）逐字符扫描：双引号段整体并入一个 token（引号保留，后续由 `ConvertNameString`/`ConvertTalkEffectName` 去掉）；空格 `' '`、逗号 `','`、等号 `'='` **各自独立成一个元素**。
因此 `[effect bit_talk_10 100,200 H]` 交给 handler 的数组是
`["bit_talk_10"," ","100",",","200"," ","H"]` —— **值落在偶数下标 0/2/4/6…，奇数位是分隔符**。
各 handler 里的 `cmp wN,#K` 校验的就是这个含分隔符的长度（如 `distortionstart` `cmp w8,#0xb`=11 token、`screen` `cmp w9,#9`）。

- 反例警示：`presentation.md` §1 的"element[0]=tag"是**错的**（pd 不含 tag；证据：`effect` handler 直接把 `pd[0]` 送 `ConvertTalkEffectName`，`0x3180b90`）。
- 语料侧交叉验证：`[communicationCharaLoop 98003003 1 5 0 5]`、`[charaCutin G upToDown 0.1 0]`、`[screen true 100 0 800 200]` 与奇偶下标逐位吻合（见 `evidence-communication-chara.md` §0、`evidence-distortion-stretch-war.md` §0）。

阅读器解析器应产出「与引擎同构的 token 数组」，再按偶数下标取值；这样本文所有 pd 下标可以直接照抄。

**前置 2：handler 结构与两种"参数错误"。**

- 154 条 handler 全部是 `ScriptManager$$ScriptCommandExecute`（`0x3177290..0x319402c`）巨型函数内的**代码块**；很多命令**共享同一块体**（`commands.json` 的 `body_sharing_groups`，如 `effect`/`effectPause`、`page`/`clear`）。
- 共享体靠闭包字段二次派发：序言 `0x3178fc4 str x25,[x22,#0x20]!` 把当前 tag 存入 `<>c__DisplayClass808_0.tag`，handler 内 `ldr x1,[x22]` 即当前 tag（`evidence-fsm-insertion.md` §0）。
- 参数错误有**两种字面量**：`'parameter error'`（不接受该参数形态）与 `'parameter be unnecessary'`（该命令必须无参）；两者都只是写 `scriptErrorMessage` 后 **返回 Normal 继续脚本**——阅读器应照抄：记一条诊断，不中断。

**前置 3：等待模型。**

- 阻塞命令统一写 `state(0x288)=4(WAIT)` + `waitType(0x3D8)` + 可选 `waitIndex(0x3E0)`/`waitName(0x3E8)`/`waitCount(0x3E4)`，由 `ProcessScript` 每帧判定。
- **未知 waitType → `state=16(ERROR)`**（`0x31c2848`）——所以「命令实现了但对应 waitType 没实现」会变成脚本卡死；阅读器应把未知 waitType 当错误诊断并**放行**（或可配置）。
- `Stop/Resume` 系命令完成后端返回 `false` 时，native 会写 `waitType='frame'`、`waitCount=1.0`、`isScriptWait=true`，**下一帧重放该命令**（`0x318b0c8`/`0x318be24` 等）。实现特效生命周期时必须保留这个"帧级重试"，否则 `effectStop` 类命令在异步加载未完成时会永久失效。

### 0.3 缺口三分类与优先级

**分类**：
- **a) 纯逻辑缺口**：参数解析、状态机、补间、跳转、等待判定 —— 无需任何原始资源即可完整实现（本文件多数命令属此）。
- **b) 需原始资源**：Unity prefab / 粒子 / 材质 / 纹理 / shader / 字体 / 音频包（USM、ACB）。
- **c) 需游戏数据源**：任务/路线/礼装/冠位计数/本地化表/战棋盘面等，建议以 `GameStateProvider` 外接注入，缺失时按"不可判定 → Not 侧"安全默认。

**优先级（按语料频次排序；括注为本次统计次数）**：

| 档 | 项 |
|---|---|
| **P0（高频，先做）** | `cueSe` 5712、`charaEffect` 4635、`effect` 3150、`charaEffectStop` 1824、`cueSeStop` 1674、`fowardEffect` 1297、`charaSpecialEffect` 1284、`cueSeVolume` 1031、`charaEffectDestroy` 1005、`communicationCharaClear` 814、`effectStop` 773、`communicationCharaLoop` 691、`effectDestroy` 652、`communicationCharaFace` 519、`messageShake`（整行 87 + 内联 548）、`backEffect`/`fowardEffectDestroy`/`backEffectStop`/`charaBackEffect` 等百次级 |
| **P1（中频/机制性）** | `criMovie` 181、`charaEffectEdgeBlur` 177、`backCameraColor` 43、`talkNameBack` 33、`cueSeContinue*` 66、`charaAttack` 50、`branchMaterial` 26、`branchRouteSelect*` 54、`messageShakeStop` 29、`turnPage*` 23、`distortion*` 24、`charaCutin/Cutout` 24、`capture` 14、`messageSpeedForcedNormal` 14、`stretchin/out` 5 |
| **P2（低频但逻辑便宜）** | `charaFadeTimeLoop` 系、`fsmObj*`、`insertionAnimation*`、`menu/notification/selectionCentering`、`switchCase` 显式命令、`flagRandom`、`masterNameWidth`、`endFade`、`spriteMask*`、`screen`、`scrollStop`、`subStretch*`、`keepSubBgm*`、`rewardSwitch`、`revivalBranch` |
| **P3（语料 0 或需资源/数据；可先"识别+诊断"）** | `adv*`、全部 `war*`、`cueVoice*`、`faceTalkScreen`、`charaFaceIcon`、`questMessageOverwrite`、`useSimpleMeshFigure`、`stretchOff`、`charaMask`、`charaLoop` 5 条（0 次但纯逻辑，成本低，可随手做） |

### 0.4 建议的后端接口与两条铁律

阅读器建议新增一组可空实现的"演出后端"，命令 handler 只做参数解析 + 调用后端：

```ts
interface EffectBackend {              // §1 §2 §3
  create(c: Container, name: string, pos?: Vec2, param?: object, o?: {flip?: Flip; isPause?: boolean; isSkip?: boolean}): void;
  resume(c: Container, name: string | null, isSkip: boolean): void;
  stop(c: Container, name: string | null, isSkip: boolean, markKey?: string): boolean; // false → 帧级重试
  forceStop(c: Container, name: string | null): void;
  destroy(c: Container, name: string | null): void;
  isBusy(c: Container, name?: string): boolean;
}
type Container = 'specialEffect' | 'fowardEffect' | 'effect' | 'backEffect' | 'communicationChara'
               | { chara: number; slot: 'cut' | 'specialEffect' | 'effect' | 'backEffect' | 'shadow' };
```

**铁律 1（不可阻塞）**：凡资源缺失/未实现的后端，必须**立即完成等待**（返回 busy=false / loading=false），否则 `state=WAIT` 会卡死整段剧情。native 在"参数非法"时也只是记 `parameter error` 后继续，阅读器同理。
**铁律 2（占位实例）**：资源缺失时 `create` 仍要**登记一个占位实例**，否则后续 `stop/resume/destroy/isBusy` 的名字匹配全部失败（native 的匹配键 = `GetAssetName(name)`，即 `Effect/…`；实例身份 = `Effect(<effectName>)`，`0x30bb348`）。

每帧更新统一遵循 native 的字段语义：只有 `status>=START(3)` 的实例推进时间轴（`0x30bcf48`），`INIT/PAUSE/DESTORY` 不推进；`END` 后回收。

---

## §1 常规、前后景及角色特效（41 条）

**语料**：31/41 条有出现。主力：`charaEffect` 4635、`effect` 3150、`charaEffectStop` 1824、`fowardEffect` 1297、`charaSpecialEffect` 1284、`charaEffectDestroy` 1005、`effectStop` 773、`effectDestroy` 652、`charaEffectEdgeBlur` 177、`backEffect` 143、`fowardEffectDestroy` 212、`backEffectStop` 67、`charaBackEffect` 49、`charaBackEffectStop` 27、`charaEffectEdgeBlurDestroy` 118、`effectForceStop` 19、`effectmessageStop` 12、`specialEffect` 8。0 次：全部 `*Pause/Start` 边角与 `specialEffectPuase`。

**五+三容器（`ScriptManager$$InitEffect 0x31a1bec` 实测）**：

| 容器 | 偏移 | 后端 | 命令族 |
|---|---|---|---|
| `specialEffectBase` | `0x160` | `ProgramEffectManager` | `specialEffect*`（cutting/flash 专用组件） |
| `fowardEffectBase` | `0x168` | `CommonEffectManager` | `fowardEffect*`（前景 overlay） |
| `effectBase` | `0x170` | `CommonEffectManager` | `effect*`（角色前） |
| `backEffectBase` | `0x178` | `CommonEffectManager` | `backEffect*`（角色后） |
| `communicationCharaEffectBase` | `0x158` | `CommonEffectManager` | 通讯窗口（§2） |
| 每角色 `baseCutEffect/baseSpecialEffect/baseEffect/baseEffectBack/baseShadowEffect` | `0x50/0x58/0x60/0x68/0x70`（`UIScriptChara`） | 同上 | `chara*Effect*` |

**生命周期与语义（`CommonEffectManager` 类体 + 实测）**：
- 创建：`CreateParam(...)`（`0x30c1234/0x30c1318/0x30c1400/0x30c14cc` 四个重载）→ `LoadCreateLocal` 先实例化 loader prefab，异步加载 `Effect/<name>`，到货后 `Instantiate` + `CommonEffectComponent.Init`。
- Resume（`effectStart` 等）：对容器（可带名字）取消 `isPause`、必要时跳入场；`name=null` 匹配全部（空遍历即静默）。
- Stop / Destroy：名字匹配键 = `GetAssetName(name)`（`Effect/…`），匹配对象是 loader 的 `effectName` 与组件的 `effectName`（`0x30c1b18/0x30c1b80`）；**loader 未加载完时返回 false → 帧级重试**（§0.2 前置 3）。
- `ForceStop`：直接 `Object.Destroy`（不给 end 表演），`0x30c1bc8`。
- 实例状态机：`INIT/PAUSE/DESTORY/START/LOOP/TOUCH/TOUCHED_LOOP/END`，动画名表 `{3:"start",4:"loop",5:"touch",6:"touched_loop",7:"end"}`（`0x30beb10`）。

**参数形态（实测；`pd` 含分隔符）**：
- `effect <名> <x>,<y> [<翻转>]`：pd[0]=名（`ConvertTalkEffectName`→`Talk/<名>`）、pd[2]=x、pd[4]=y、pd[6]=flip（`ConvertEffectFlipKind`，H/V/F）。
- `charaEffect <槽> <名> <x>,<y> [<翻转>]`：pd[0]=槽、pd[2]=名、pd[4]=x、pd[6]=y、pd[8]=flip；坐标再经 `ScriptPosition.GetCharaOffset`。
  - ⚠ 修正：`params-visual.md` 把 pd[4]/pd[6] 记成"颜色/?"是**误标**（那是相邻 `charaEffectEdgeBlur` 块的证据）。
- `charaEffectEdgeBlur <槽> [色] [粒子色] [level] [thick]`：**名字硬编码 `bit_talk_edgeblur_light`**（字面量 `0x31883e0`），缺省 level=4、thick=1.5；走 `ScriptCharaData.SetEffectEdgeBlur`（`0x3170824`）。
- `specialEffect <名> <x>,<y> <time> <color> <range>`：注意 pd[6]=**time**、pd[10]=**range**；`cutting`/`flash` 两个名字命中 `CuttingEffectComponent.CuttingStart`/`FlashEffectComponent.FlashStart`（`0x30c4aa0/0x30c74a8`）；可用命名参数 `ver=/bodySize=/bodyCenter=/continueSilhouette`（`GetCharaSpecialEffectSubParam 0x31c8ba4`）。
- `charaSpecialEffect <槽> <名> [命名参数…]`：走 `ProgramEffectManager.CreateCharaEffect`（`0x30c92bc`），参数表与 `specialEffect` **不同**。

**两条快速播放规则（必须照抄）**：
1. `effect`/`charaEffect` 在快速播放时对名字含 `bit_shot_` 的特效**直接跳过**（`0x3180bec`、`0x3187b54`）。
2. 快速播放里"已请求特效"会插入一次 0.01s 等待（`waitCount=0x3C23D70A`，`0x319cc0`）。

**effectmessage 衔接**：`[effectmessage <名> x,y t n]` 不是命令，是 ①`wait` 关键字（`waitName=ConvertTalkEffectName(pd[2])`）②`AnalysText` 资产校验 ③`ProcessScript` 调 `MessageEffectIsBusy(0x31d4f58)` 等待。`effectmessageStop/effectmessageDestroy` 走 `ScriptMessageCommonManager.MessageEffectStop`（`0x31d4df4`，Destroy 时 isSkip=1）。另有一条自动停止规则：`CheckEffectMessageStopping`（`0x31c4a44`）在 tag ∈ {`seLoop`,`se`,`wait`,`seStop`,`seContinue`,`seContinueStop`,`seContinueVolume`,`effectmessageStop`,`seVolume`} 时自动结束消息窗特效——阅读器应在这些 tag 出现时清 effectmessage 状态。

**补齐步骤**：
1. 建 `EffectInstance{container, assetName:"Effect/Talk/"+name, name, pos, flip, status, isPause, isSkip, markKey, loading}`；实例身份显示名 `Effect(<name>)`。
2. 实现五个原语（create/resume/stop/forceStop/destroy）；`stop` 返回 false 时写 `waitType='frame', waitCount=1.0` 并**下一帧重放**。
3. 按容器/角色槽接线 41 条命令（对照本文表格与 `commands.json` 的 `body_sharing_groups`）。
4. 快速播放规则两条 + `effectmessage` 自动停止 tag 表。
5. 资源缺失：创建"占位实例"（0×0 节点或空 sprite），按 `Effect/Talk/<name>` 查表失败记 warn；`isBusy` 对占位实例按生命周期正常归零。

**降级与验收**：无 `Effect/*` prefab 时视觉为空，但 `charaEffect` 类命令的**时间线/等待/停止语义**必须完整（可用占位时长近似 end 段）。验收：`[effect X]…[effectStop X]` 序列不卡帧、`effectDestroy` 幂等、快速播放跳过 `bit_shot_*`。

---

## §2 通讯窗口（5 条）

**语料**：`communicationCharaClear` 814、`communicationCharaLoop` 691、`communicationCharaFace` 519、`communicationChara` 131、`communicationCharaStop` 3；另有 `[wait communicationChara]` 813。

**原生机制（`communicationChara/Loop` 共享体 `0x317ef18`）**：
- 参数：pd[0]=`svtId*10+limitCount`（魔数除法拆位 `0x318ef10`）、pd[2]=位置（位置表下标 **或** `x,y` 坐标形式）、pd[4 或 6]=深度 A（语料恒 5 → `z=-A*10=-50`）、pd[6 或 8]=noiseKind(0/1)、pd[8 或 10]=faceType(0..10)。
- 语义：`CommonEffectManager.CreateParam(parent=communicationCharaEffectBase(0x158), effectName='Talk/communicationCharaEffect', …)` → 资源全名 **`Effect/Talk/communicationCharaEffect`**；回调 `ReadyCommunicationChara` 清 `isLoadCommunicationChara(0x498)`。
- `communicationCharaLoop` 与 `communicationChara` 唯一差别：`isStartLoop = (tag=='Loop') ? true : IsFastPlaySpeed()`。
- 阻塞：命令自身写 `WAIT + waitType='communicationCharaLoad'`，`ProcessScript 0x31c0598` 等 `isLoadCommunicationChara==0`。
- `[wait communicationChara]`（注意拼写：wait 键树里只有错拼 `'communicatioChara'`，正确拼写落 default 路径但 `waitType` 原文保留）→ 等 `CommonEffectManager.IsBusy(communicationCharaEffectBase)`（`0x31bf334`）。
- `communicationCharaFace <0..10>` → `Get(base)[0]` 转 `CommunicationCharaEffectComponent` → `SetFace`；`Clear` → `Destroy(base)`；`Stop` → `Stop(base,isSkip=0)`。
- 循环节拍：`Update 0x30c41f8` 每 2s 重放 2 号噪声层（`noiseCount`）。

**补齐步骤**：
1. 数据模型 `{svtId, limitCount, faceType, pos, depth:-(A*10), noiseKind, loop, loaded, busy}`；
2. 创建即登记实例 + 立即完成加载等待（无资源时用占位：矩形 + face 文字 + 可选 CSS 噪点动画）；
3. `Face/Clear/Stop` 三个原语按实例查找实现；`wait communicationChara` = `busy==false`；
4. `Loop` 后循环呈现；`Clear` 销毁实例（关窗语义）。

**验收**：`[communicationCharaLoop …] → [wait communicationChara] → [communicationCharaFace n] → [communicationCharaClear]` 全链不卡；`svtId*10+limit` 拆分与语料 `98003003 → svtId 9800300, limit 3` 一致。

---

## §3 角色切入与攻击（6 条）

**语料**：`charaAttack` 50（全部 `normal`）、`charaCutin` 16、`charaCutout` 8、`charaCutinStart/Pause/CutStop` 0。

**原生机制**：
- `charaCutin/Pause`（共享体 `0x31855fc`）：`[charaCutin <槽> <划像名> <时长> [mgd]]`；`isPause=(tag=='charaCutinPause')`；走 `ScriptCharaData.SetCutin` → `UIScriptImage.SetCutin`（`0x31eaf08`）→ `ProgramEffectManager.CreateCharaEffect(name='cut')` → `CharaCutEffectComponent.CutinStart`：`Wipe/<划像名>` 贴图 + shader `Custom/Sprite-ScriptActionFigureCut` + `_Gradation` 从 0 补间到 `mgd+256/255`（常量 `1.0039216`）。
- `charaCutinPause` 只加载不播（`isPause!=0` → `isCutBusy=0`）；`charaCutinStart` → `ResumeCutin` → `CutinResume()` 才播——"狙击式暂停/恢复"两段式。
- `charaCutout <槽> <时长>`：`CutoutStart` 把 `_Gradation` 补间回 0 后销毁（`isSkip` 或时长≤0 则直接销毁）。
- `charaCutStop <槽>`：`ScriptCharaData.StopCut`（`0x317059c`）实测转到 `UIScriptChara.StopSpecialEffect`（销毁 `baseSpecialEffect 0x58`；层级前提 INFERRED）。
- `charaAttack <槽> normal <x>,<y> <时长>`（必须 9 token）：`UIScriptChara.MoveAttack`（`0x31e2a0c`）——`TweenPosition.Begin` 平移，**时长缺省 0.5s**；duration 仅正常速度解析，快进传 0。
- 上述命令都置 `isRequestEffect(0x3C0)=1`。

**补齐步骤**：
1. 切入状态机：`{phase: 'loading'→'ready'→'playing'→'done', isCutBusy}`；`Pause` 停在 ready，`Start` 进 playing；`Cutout` 反向洗掉；`CutStop` 兜底移除。
2. 视觉（可选，纯 CSS）：角色 sprite 上叠方向性 mask 扫过——`upToDown`→纵向、`leftToRight`→横向、`circleIn`→径向渐变；`mgd` 映射为渐变超出量（0/1）。无 `Wipe/*` 贴图时用 `mask-image: linear-gradient`。
3. `charaAttack`：0.5s 缺省平移（`transform` 补间），保留 duration 语义。

**验收**：`charaCutin G upToDown 0.1 0` 页面呈现扫过动画并在时长后自动收尾；`Pause→Start` 两步可复现"先备好再播"。

---

## §4 角色循环及复位（5 条）

**语料：全部 0 次**，但这是**纯逻辑成本最低的一组**（无资源、无数据源），建议随手补齐。

**原生机制**：
- `charaFadeSpeed <槽> <speed> <alpha>`（**恰好 5 token**）：`ScriptCharaData.MoveAlphaSpeed(speed, alpha, isWaitTalk=false)`（`0x316fd84`）；`UIScriptChara` 静态 `UNIT_SPEED≈0.015`（`.cctor 0x31e4cc8`）用于把速度换成补间时长；快进时 speed=0（立即）。
- `charaFadeTimeLoop <槽> <N> <d1> <a1> … <dN> <aN> <loopNum>`：**token 数必须 == 4N+5**（`0x318c100` 强校验），逐奇数位必须是空格；`loopNum=0` 表示无限（`IsMoveAlphaInfiniteLoop` = `moveAlphaLoopNum(0x138)==0`）。推进不是每帧 Update，而是 iTween 完成回调链 `EndMoveAlphaLoop`（`0x31e0b38` 逐段/逐圈推进）。
- `[wait charaFadeTimeLoop <槽>]` 判定：`IsMoveAlphaInfiniteLoop() || !IsMoveAlphaLoop()` 即放行（`0x31bf0e8`）。
- `charaFadeTimeLoopStop <槽>`：跳到当前数组最后一个 alpha 值并清循环（`0x31e0abc`）。
- `charaReturn <槽> [时长]`：补间回 `basePosition`（`UIScriptChara 0x7C..0x84`，由 `charaPosition/charaSet→SetBasePosition` 写入）——"回归位"= 最近一次摆放位。
- `charaRollAxisLoopStop <槽>`：停 `charaRollAxis` 启动的轴向自转；`isRollWait` 为真时补间到 `AngleAxis(stopAngle, axis)`，否则原地结束（`0x31e36cc`）。

**补齐步骤**：数据模型 `{basePosition, alphaLoop{durations[],values[],loopNum,index,loopCount}, rollAxis{axis,angle,isLoop,isWait,stopAngle}}`；用"步骤+定时器"实现 alpha 循环（无需回调链移植）；`loopNum=0` 不参与 wait；`charaReturn` 复位到 basePosition；RollAxis 停止落 stopAngle。

**验收**：`charaFadeTimeLoop` 的 token 长度公式校验（4N+5）拒绝非法行；`charaFadeTimeLoopStop` 后 alpha 停在末值；`charaReturn` 位置回到 basePosition。

---

## §5 PlayMaker FSM（8 条）

**语料**：`fsmObjSet` 3、`fsmObjDestroy` 3、`fsmObjLayer` 3、`fsmObjSetState` 3、`fsmObjSendEvent` 3；`fsmObjSetBool/Float/String` 0。

**原生机制**：
- 槽位模型：所有 `fsmObj*` 的第 1 参数用 `ConvertCharaIndex`（`0x31b34f0`，A-Z base-26，`K`→10）编码为下标，取 `ScriptManager.fsmObjectDataList(0x790)` 的一个槽——**槽与角色无关**，只是命名空间。
- `fsmObjSet <槽> <assetName> <objectName>`（5 token，pd[2]/pd[4]；pd[3] 只是空格）：销毁旧槽 → new `ScriptFsmObjectData(assetName, objectName)` → 写 `state=WAIT`、`waitType='fsmObjSet'`、`waitIndex=idx`，**隐式阻塞到加载完成**（完成条件 `isLoading(0x18)==false`，`0x31bf444`）。加载：`AssetManager.loadAssetStorage(assetName)` → `GetObject(objectName)` → `Instantiate` → `GetComponent<ScriptFsmObject>`。
- `fsmObjSetBool/Float/String <槽> <变量名> <值>`（共享体 `0x3182adc`，二次派发）：分别 `SetBool 0x3172248`（`bool.TryParse`）/`SetFloat 0x31721a0`（`float.TryParse`）/`SetString 0x3172104`；解析失败/槽空 → **静默 no-op**；不阻塞、不设 WAIT。
- `fsmObjSetState <槽> <状态名>` / `fsmObjSendEvent <槽> <事件名>`（共享体 `0x3185e08`）：分别 `PlayMakerFSM.SetState`（`0x4adeacc`）/`SendEvent`（`0x4adeb14`），两者都先自动发一次 `"SKIP"` 并把 `isPlaying=true`；**快进时额外 `Skip()`**。
- `fsmObjLayer <槽> ui [<x>,<y>]`：pd[2] 只接受 `'ui'`（否则 `parameter error`）→ `SetParent(scriptReScale.gameObject)` + `SetActive(true)`；可选坐标 `SetPosition`。
- `fsmObjDestroy <槽>`：`Object.Destroy` + `AssetManager.releaseAsset`，槽置 null。
- `[wait fsmObjFinished <槽>]`：完成 = `fsmObjectDataList[waitIndex]==null || !IsPlaying`（`0x31bfa44`）；`isPlaying` 由 FSM prefab 发 `OnFinished` 清零（`ScriptFsmObject.OnFinished 0x3171c74`，无静态调用者 → prefab 触发，INFERRED）。

**补齐步骤**：
1. 数据模型 `fsmSlots: Map<number, {assetName, objectName, isLoading, isPlaying, fsm?}>`；
2. 命令语义按上表；`fsmObjSet` 无资源时**立即完成 WAIT**（否则卡死）；
3. wait：`fsmObjFinished` → `!slot?.isPlaying`；`fsmObjSet` → `!isLoading`；
4. 后续升级：离线性把 prefab 的 `PlayMakerFSM`（states/transitions/variables）抽成 JSON，在阅读器里实现 PlayMaker 解释器子集（标准 Action 来自 `PlayMaker.dll`，FGO 扩展在 `Fgo.PlayMaker.dll`，含 `PlayMakerFSMHelper/FsmProcessor/UpdateHelper`），即可真正驱动 `select01` 等交互面板；在那之前按"no-op + 立即完成"降级，并给可配置的最短停留时长防闪。

**验收**：`[fsmObjSet K ScriptUI/SelectPanel/select01 select01]` 不卡；`SetState/SendEvent` 对空槽静默。

---

## §6 插入动画（7 条）

**语料**：`insertionAnimationStart` 1、`insertionAnimationEnd` 1、`insertionAnimationSetFSSideR` 1、`insertionAnimationSet*` 其余 0；另有 `[wait insertionAnimationStart/End <名>]` 样本（Final Chapter `0400074810.txt`）。

**原生机制**：
- `insertionAnimationSet* <动画名> [<x>,<y>[,<scale>]]`（共享体 `0x318816c`，FSL/FSR/FSSideL/FSSideR 变体只差"加载完成后叠加的 X 偏移"）：
  - **handler 不校验参数**；资源模板 `String.Format("InsertionAnimations/{0}/{0}")`（`ConvertInsertionAnimationName 0x31b3f20`，模板槽 `0x55ca0a48`）；
  - 自身隐式阻塞：`WAIT + waitType='insertionAnimationSet'`，完成 = `isInsertionAnimationLoading(0x748)==false`；
  - 加载回调（`0x31cbdb8`）消费 pd[2]=x、pd[4]=y、pd[6]=scale，再叠加变体偏移（`GetFSCommandOffsetX 0x31c5b68`：FSL=−48px、FSR=+48、FSSide 走 `GetForceOffsetX`）。
- `insertionAnimationStart <名> [贴图名…]`（`0x3180d0c`）：`GameObject.Find` → `EventPlayAnimationInsertionComponent.ChangeAnimationSprite(pd)`（贴图前缀 `Image/`）→ `PlayAnimation(pd[0], _in, isSkip)`（`Animator.Play("Base Layer."+name+"_in")`）。
- `insertionAnimationEnd`（`0x317f818`）：同型但播 `_out` 并置 `isDestroy`。
- `[wait insertionAnimationStart/End <名>]`：完成 = 对象/组件不存在或 `isActive(0x30)==false`（`0x31bf738`），Start 与 End 判定一致；`isActive` 由 `Update` 按 Animator normalizedTime 清零。
- 每帧：组件 `Update` 只看 `normalizedTime>1`；prefab 结构 = Animator（`Base Layer.{id}_in/_out`）+ 贴图节点（`Texture_`/`Image/…`）+ 组件。

**补齐步骤**：
1. `insertionObjects: Map<name, {phase:'in'|'out', x, y, scale, active, loading}>`；
2. `Set`：写 WAIT；无资源时**立即清 loading**（防止卡死），位置/缩放仍按 pd 解析（不依赖 prefab）；
3. `Start/End`：切 `active` 状态并用占位时长（0.3–0.5s 可配置）或在 `wait` 时以"超时兜底"完成；
4. 升级：离线导出每个 id 的 `_in/_out` 时长表（或 sprite-sheet）后按时间轴播放。

**验收**：`[insertionAnimationSetFSSideR ac_fude_triangle_slide_R 0,70] → [wait insertionAnimationStart ac_fude_triangle_slide_R] → [wait insertionAnimationEnd …]` 全链不卡。

---

## §7 ADV prefab / 3D 演出（6 条）

**语料：全部 0 次** → 目标是"解析正确 + 不卡流程"，不必建模 3D。

**原生机制**：
- `advSet <名>`：`GetAssetName`→`ADV/{0}`（`0x3169b74`）→ `ScriptActionAdvPrefabController.Setup` 异步加载；登记 `WAIT + waitType='advSet'`，完成 = `controller.isSetup(0x38)`（`0x31c0050`）；已 setup 则整条跳过。
- `advPrepare <对象名>`：`Prepare` 实例化 prefab、建 `actorDict`；把 `GetTemporary(1267,576,24)` 的 RT 逐个接给 prefab 内相机（`camera.targetTexture`）；`meshAdvPrefabRenderBase(0x250).SetImage(RT)` 并关闭普通层 `meshRenderBase(0x130)` —— **3D 演出→RT→全屏 quad** 链路（直证）。
- 演员：`advActorShow/Hide <演员名>`（`ConvertNameString`）→ `actorDict.TryGetValue` → `SetActive(true/false)`；`advPlayAnimator <演员> <trigger>`（跳读时直接跳过）→ 清 `IsGoNext` + `Animator.SetTrigger`；动画进入 `GoNextState` 时回填 `IsGoNext=true`。
- `advRelease`：清 RT、销毁 demo 对象、释放 asset、复位渲染层。
- `[wait advPlayAnimator]` 分支存在（等演员 GoNext）但**无任何 waitType 赋值点 → 死代码**（2.139.3 实际不等待）。

**补齐步骤**：实现为 `adv = {isSetup, actors: Map<string,{visible, goNext}>}`；`advSet/Prepare/Release` 记录状态并**立即完成等待**；`Show/Hide/PlayAnimator` 改占位状态；升级路径 = 接入离线转换的 glTF/序列帧后按 `1267×576` RT 尺寸复刻。

---

## §8 影片（2 条）

**语料**：`criMovie` 181（119×`… bgmPlay false`、60×`… bgmPlay true`、2× `talk_mov*`）+ `movie` 1。

**原生机制（共享 handler `0x3183c38`）**：
- 快进（`IsFastPlaySpeed`）或跳读（`IsJumpLine`）→ **整条不播、不登记等待**。
- 参数个数必须 ∈ {2,4,6,8,10}；名字经 `ConvertCRIMovieName` → **`Movie/{0}.usm`**（`0x31b3c84`）。
- 4 个谓词扫描 pd：`bgmStop`/`seStop`/`voiceStop`/`false` → `PlayCRIMovie(name, isBgmPause, isScriptStop=!Any("false"), isSePause, isVoicePause)`。注意 `bgmPlay` 这个 token 在 2.139.3 二进制里**不存在**，行为实际由 `false` token 决定（含 `false` → **非阻塞**，脚本继续、影片后台播放）。
- 播放：`Resources.Load('CRIMovie/CRIMoviePlayerWithPanel')` → `CRIMoviePlayer`（CriMana/Sofdec2 后端）→ `MoviePlay`。
- 等待：`state=WAIT + waitType='movie'`（criMovie 同）；完成 = `cRIMoviePlayer(0x5C8)==null` **或** `isScriptExecuteMoviePlay(0x6E0)!=0`（非阻塞，`0x31c0410`）。
- 断点续播：`MovieResumeKey/PlayedLastMovieKey`。

**补齐步骤（181 次，必须做）**：
1. 名称转换 + 阻塞/非阻塞解析（`!contains('false')` → 阻塞）+ 快进/跳读跳过 + 等待注册；
2. 播放层：USM 无法在浏览器解码 → **占位层**（黑底 + "影片播放中" + 进度条，可点击跳过，对应 `MovieStop`）；若离线把同名影片转成 mp4/webm，则用 `<video>` 接管，`bgmStop/seStop/voiceStop` 映射静音轨；
3. `wait` 到占位/视频结束或被跳过；非阻塞模式立即放行；
4. 升级：USM → ffmpeg 转码管线；`SeekSequence`→`video.currentTime`；resume key → localStorage（可选）。

**验收**：`[criMovie talk_mov151_M bgmPlay false]` 立即继续且后台占位在播；无 `false` 的形态阻塞至结束/跳过。

---

## §9 CRI cue 与 BGM 保留（11 条）

**语料**：`cueSe` 5712（2 值 4933 / 3 值 189 / 4 值 590）、`cueSeStop` 1674、`cueSeVolume` 1031、`cueSeContinue` 32、`cueSeContinueStop` 20、`cueSeContinueVolume` 14；`cueVoice*` 与 `keepSubBgm*` 均 0。

**原生机制——与 `se/voice` 完全同源，只是寻址方式不同**：
`OverwriteAssetSoundName.PlaySe`（`0x2e8036c/0x2e8041c`）→ `SeManager.PlaySe` → `SePlayer`（`cueSheetName 0x18`、`objName 0x20`）→ `CriAtomSource`（`_cueName 0x70`、`_cueSheet 0x78`）→ `CriAtom.GetAcb` + `CriAtomExPlayer.SetCue`。**不存在 `ConvertCueName`**；资源前缀 `Se/`（`0x2e911c4`）。

| 命令 | 参数（值序 `p[k]=pd[2k]`） | 行为 |
|---|---|---|
| `cueSe <sheet> <cue> [fadein] [volume]` | 2 值音量=1；3 值 `p[2]`=volume；4 值 `p[2]`=fadein、`p[3]`=volume | 播放，句柄写 `sePlayer(0x460)` |
| `cueSeStop <cue> [fadeout]` | `p[0]`=cue、`p[1]`=fadeout；0 参=全停（`SoundManager.stopSe(null,0)`） | 与 `seStop` 同一尾块 |
| `cueSeVolume <cue> <fade> <volume>` | `changeVolumeSe(name, volume=p[2], fadeTime=p[1])` | 音量按名匹配 |
| `cueSeContinue … <id>` | 3 值 `p[2]`=id；4 值 `p[2]`=volume、`p[3]`=id；5 值 `p[2]`=fadein、`p[3]`=volume、`p[4]`=id | 播放并存入续播池 `seContinuePlayers(0x470)`；同 id 先停旧（`CheckSameIdSeContinue 0x31b4d08` 幂等） |
| `cueSeContinueStop <name> <fadeout> [id]` | 有 id 按池查；无 id 按 `objName` 遍历池匹配 | 停止池中句柄 |
| `cueSeContinueVolume <name> <fade> <volume> <id>` | 池中 id → `SePlayer.ChangeVolume(p[2],p[1])`；池中无此 id → no-op | |
| `cueVoice/Stop/Volume` | 与 `voice` 同构，但名字在 **pd[2]**（`SoundManager.playCharaVoice/stopVoice/changeVolumeVoice`） | 语料 0 |
| `keepSubBgmOn/Off` | 无参 | 写 `BgmManager.enableCounter_KeepSubBgm(0x48)` **计数器**（+1/-1 夹 0）；脚本退出时 `ForceDisable_KeepSubBgm(0x31b4710)` 强制清零 |

**补齐步骤**：
1. 音频块新增 9 条命令，全部走现有 `AudioIntent`（play/stop/volume）；`cueSe` 的资源解析顺序 `Se/<sheet>/<cue>` → `Se/<cue>`，未命中 → **静音降级 + 一次诊断**（不要伪造声音）；
2. 续播池 `Map<number, {name, entry}>`，`cueSeContinue` 同 id 先停旧；`Stop/Volume` 按 id 或名字定位；
3. `keepSubBgm` 计数器：`soundStopAll`/`bgmStop` 在 `>0` 时不停止 subBgm 通道；播放结束复位；
4. 升级：离线解 ACB（`(sheet,cue)→文件` 映射表）后可全量出声；`fadein/fadeout` 用 WebAudio 增益补间。

---

## §10 游戏条件分支（9 条）

**语料**：`branchMaterial` 26、`branchRouteSelectCount` 22、`branchRouteSelect` 18、`branchNotRouteSelect` 14、`branchSetGrandSvtCount` 2；`branchNotMaterial`/`HaveSvtEquip`/`NotHaveSvtEquip`/`NotRouteSelectCount` 0。

**共同基座**：条件成立 → `JumpScript(ConvertNameString(pd[0]))`（`0x319075c` → `0x31a8488`，改 `executeIndex`）；不成立 → 顺序执行下一行。**9 条全部返回 Normal**，跳行靠 handler 内副作用——阅读器不要在返回码上做文章，直接在 handler 里 `jump(target)`。

| 命令 | 条件（原生） | 阅读器 Provider |
|---|---|---|
| `branchMaterial`/`NotMaterial` | `isCollection(0x371)` 与 tag 异或（`0x31802b0`） | `gameState.isCollection`（默认 false=正片） |
| `branchHaveSvtEquip`/`Not` | `CondType.IsOpen(kind 8 或 0x28, 装备ID=pd[2])`（`0x318459c`/`0x2d6c594`） | `gameState.svtEquipHaving?(id)` |
| `branchRouteSelect`/`Not` | `CondType.IsRouteSelect(quest=pd[2], route=pd[4])`；collection 且允许 material play 时改用 `MaterialBranchRouteManager.IsMaterialSelectedRouteId`（`0x31834e4`） | `gameState.routeSelected?(questId, routeId)` |
| `branchRouteSelectCount`/`Not` | `IsRouteSelect(IList quests, IList routes, count=pd[2], op=pd[4])`，逐 route 查 `UserQuestRouteMaster.haveRouteId`（`0x317c85c`） | `gameState.routeSelectCount?(…)`（可本地用 routeSelected 去重计数实现 EQUAL/BELOW/ABOVE） |
| `branchSetGrandSvtCount` | 计数 = `UserServantGrandMaster.GetUserServantEntities().Count()`，`GetCompareCheckType(op, 脚本值, 计数)`（`0x317e20c`）：`EQUAL→==`、`BELOW→<=`、`ABOVE→>=` | `gameState.grandSvtCount` |

**补齐步骤**：
1. `ExecutorOptions.gameState?: GameStateProvider`（可空）；不可判定 → **走 Not 侧（正分支不跳）+ 一次诊断**，与现有 `branchQuestClear` 未知处理一致；
2. `branchMaterial` 用 `collectionMode`（默认 false）——阅读器本质回放正片；
3. `branchRouteSelectCount` 本地实现列表去重计数可脱离 provider 半精度运行；
4. `branchSetGrandSvtCount` 未注入时**不跳**（注意 `0 ABOVE` 对 0 会为真，直接按 ABOVE 实现会误跳，必须按"不可判定"处理）；
5. compiler 已能解析 `branch*` 首参标签，无需改动。

---

## §11 随机旗标（1 条）

**语料 0 次**；当前 `unsupported` 建议换成实现（成本 3 行）。

**原生机制**：`flagRandom <flag> <ss> <es>`（恰好 3 值）；`flag = UnityEngine.Random.Range(Conv(ss), Conv(es)+1)`（闭区间），写 `ScriptFlagData.v(0x18)`；`Conv` 把 `true/on→1`、`false/off→0`、其余按数字解析。随机源是 Unity 全局 Random，**不入档**；入档的是 flag 值本身（`SaveFlagInfo 0x31c8044`，PlayerPrefs JSON）。

**补齐步骤**：取 `lo/hi` → `v = lo + floor(rand()*(hi-lo+1))` → 写 flags；随机源推荐**回放轨迹记录掷出值**（与引擎"存档含 flag 值、不含种子"一致，撤销/前进可复现），或独立 mulberry32 种子流。注意：引擎 flag 比较是整数语义，阅读器 `flags` 是字符串 Map——建议对纯数字串做数值比较或在 `flagRandom` 侧标注已知近似。

---

## §12 游戏流程及名字宽度判断（4 条）

**语料**：`masterNameWidth` 1；其余 0。

- **`masterNameWidth <字号名> <阈值px> <小于标签> <不小于标签>`**（`0x3185be0`）：测量对象是**主人公名字**（`ScriptReplaceString.GetString(USER_NAME=1)` → `LocalizationManager.ReplaceNameTag`），用临时 UILabel（`GetFontSize(pd[0])`，如 large=48）测 `UIWidget.mWidth`，`width < 阈值` → pd[4] 标签，否则 pd[6]。
  - 阅读器：compiler 需把 `params[2]/params[3]` 解析成**两个** targetIndex（`Instruction` 目前只有 1 个 target，建议加 `targetList?`）；测量用 `canvas.measureText(masterName)`，字号表 `'-'29/x-small 19/small 24/medium 29/large 48/x-large 64`；NGUI mWidth 与 px 的换算差用**可配置系数**（默认 1.0，在唯一语料样本 `large 339` 上校准）。
- **`questMessageOverwrite <label>`**（`0x317d710`）：键 `"QuestMessageAdd"+pd[0]` → `GetOverwriteText(label, questId)` 查**加密任务文本资产** → 非空则覆写任务消息文本；未注入时 no-op。
- **`revivalBranch <labelA> [<labelB>] [<labelC>]`**（`0x31853a4`）：collection → 3 值走 pd[4]、否则 pd[0]；正常游玩 `isRevival(0x374)`（由 `EventDetailEntity.IsRevivalEvent 0x2f0a578` 计算）→ pd[2]，否则 pd[0]。
- **`rewardSwitch <true|false>`**（`0x318522c`）：写 `isGetReward(0x758)`；其它字符串静默不改；消费在事件界面（阅读器实现为状态位即可）。

**补齐步骤**：compiler 标签域扩到 `revivalBranch`/`masterNameWidth`；`rewardSwitch` 写状态位；`questMessageOverwrite` 走可选注入；`masterNameWidth` 先按比例系数 1.0 实现。

---

## §13 消息窗、字体和头像（13 条）

**语料**：`messageShake` **635**（整行 87 + 内联 548，全命令最高频）、`talkNameBack` 33、`messageShakeStop` 29、`messageSpeedForcedNormal` 14、`clear`（共享体）152、`messageAlign` 1、`messageChange` 1；其余 0。

**逐条机制与补齐**：

| 命令 | 原生机制（VA） | 阅读器补齐 |
|---|---|---|
| `betweenHeight` / `l`（共享体 `0x318472c`） | `SetBetweenLineHeight(v)`（`0x31d28f4`）：`v<0` 或空参数 → 默认（`0xB8`），否则写 `betweenLineHeight(0xF8)`；同时对 `logMessage` 写 `0x70` | 对白与回想两块都设 CSS `line-height`；`-`/空=复位默认 |
| `messageShake <cycle> <x> <y> <duration>`（min 7，**顺序：周期、振幅X、振幅Y、时长**） | `Shake`（`0x31d4c20`）：抖的是**消息容器 Transform**（`messageManager.messageShake 0x50`），每 `cycle` 秒随机 `localPosition ∈ [-x,x]×[-y,y]`，到 `duration` 停；`cycle==0`→1/60 每帧；快速播放禁用 | 容器 `transform: translate()` + 确定性 PRNG；`duration` 到点/快速播放归零；注意与 `[shake]`（舞台/相机）参数序不同 |
| `messageShakeStop` | `Shake(0,0,0,0)` → 取消 + 归零 | 取消 tween + translate 归零 |
| `messageAlign <top\|center\|bottom>`（无参=`top`） | 直写 `messageAlign(0x1F0)`：center=1、bottom=2、其它=0；消费于 `GetVerticalAlignedOffset 0x31d2994` | 消息块在窗口内的垂直基准（flex/偏移）；**与 `[f … center]` 的标签级对齐是两条路** |
| `messageChange <窗口名>`（无参=复位） | `ScriptUI/MessageWindow/{name}` prefab（`0x31b3ed4`）→ `ChangeMessageWindow`；换窗会**重置**行距/字号/对齐默认值 | 记录窗口名 + 重置上述状态；无 prefab 时保持默认窗 + 诊断（语料唯一值 `cinema`） |
| `messageSpeedForcedNormal <on\|off>` | 写 `isMessageSpeedForcedNormal(0xE4)` + `SetDefaultState`：`on` → `messageSpeed=1.0`，`off` → 用玩家设置（`OptionManager.GetScenarioTextSpeed`） | 锁/放打字速度；忽略用户设置 |
| `page` / `clear`（共享体 `0x3182038`） | **必须无参**（带参报 `parameter be unnecessary`）；写 `waitType='page'/'clear'` 后等点击推进 | ⚠ **当前实现把 `clear` 当 `stage.reset()` 是错的**（语料 152 次）；应为"清消息 + 等待点击"，舞台复位交给 `scene/fadeout` 类命令；`page` 同理=等待点击 |
| `messageStart` | 旧版遗留；把整段 pd 交给 `CalcMessageVerticalAlign`，无长度校验 | 可直接 no-op + 诊断，或等价为"按 messageAlign 重算垂直位置" |
| `fontType <名>`（空/`normal`=默认） | `Font/{name}`（`ConvertFontName 0x31b3898`）→ `SetFontType` 写 `fontType(0x128)`；同时应用到 logMessage | `@font-face` 若可用；缺失时 `normal` 分支必须复位字体；记诊断 |
| `talkNameBack <图片名>`（无参=复位） | 换 `currentMessageWindow.talkNameBack(0x50)` 的 sprite（`AtlasManager.SetMark`）；空参恢复默认名牌 | `talkNameBackSkin` 状态；有解包图用 `background-image`，否则默认底框 + 诊断；**必须实现空参复位** |
| `charaFaceIcon` | **WarBoard 专用**：`WarBoardMessageScriptMaster.GetMessageEntity` + 遮罩矩形（`SetMaskData`） | 无战棋数据 → 保持 onUnhandled 诊断；不要用普通立绘冒充 |
| `faceTalkScreen` | WarBoard 专用：换 3 张 `img_talk_textbg/img_talk_namebg/img_arrow_under` | 同上（登记 `messageSkin` 状态 + 诊断） |

**验收**：`messageShake` 抖动出现在消息框容器（非全屏）、`cycle/duration` 语义正确；`clear` 不再是舞台复位；`messageAlign bottom` 生效。

---

## §14 菜单及显式选项命令（5 条）

**语料**：显式 `[menu]/[notification]/[selectionCentering]/[switchCase]/[switchCaseEnd]` 全 0——但 `？`/`？！` 控制符产生 18,197/11,684 行，走的是**同一 tag 码路**。

| 命令 | 原生机制 | 阅读器补齐 |
|---|---|---|
| `menu <label>=<text> …`（`0x317fa74`） | `=` 分隔的 label/text 对（pd[i] 过 `ConvertNameString`）；`menuLabelList(0x4A8)`/`menuMessageList(0x4A0)`；选择回调 `OnSelectMenu` **`JumpScript(label)`**（与 switchCase 的"正文法"本质不同，不写 INPUT_SELECT_BRANCH） | 编译期解析成 `{label,text,targetLabel}[]`，复用 `$choice` 弹窗；点击 → 跳 label |
| `notification <标题> <正文>`（`0x317af84`） | 写 `waitName(0x3E8)/waitMessage(0x3F8)` + `waitType='notification2'`；运行期开通知窗（`ScriptNotificationDialog`）；正文为空整条 no-op | 通知条 UI（标题+正文+关闭）+ 独立等待相位；低优先 |
| `selectionCentering <bool>`（`0x317f90c`） | 写 `selectDialog.isCenteringEnabled(0x90)`，**持久**到下次设置/窗口复位 | 选项列表居中开关 |
| `switchCase`（显式命令） | tag 与 `？` 行相同（解析期 `Substring(1)` 即 data）；正文里撞到下一个选项 tag → `JumpScriptCommand('switchCaseEnd')`；隐藏限时语法：选项文本按空格切 >2 段时第一段=秒数（`0x4C8/0x4CC`） | 编译器把 `[switchCase n：text]` 归一到 `$choice`；限时语法可后置 |
| `switchCaseEnd` | 块尾落点：复位 `isSwitchCase(0x370)`，不等待 | 归一 `$choiceEnd`（现有实现已覆盖 `？！`） |

**验收**：显式命令写法（若某脚本手写）与 `？/？！` 行为一致；`menu` 选择跳 label。

---

## §15 截屏及渲染模式（4 条）

**语料**：`backCameraColor` 43、`capture` 14、`captureRelease` 1、`useSimpleMeshFigure` 1。

- **`backCameraColor [<'false'|#RRGGBB>]`**（`0x317cb6c`）：`false` → `margeCamera.clearFlags=3`（只清深度）；`#RRGGBB`（无参用 `000000`，长度必须 6）→ `clearFlags=2` + `backgroundColor=颜色`。阅读器：设置/清除页面容器背景（黑边）色；无参=黑。**43 次，性价比最高**。
- **`capture`**（无参，`0x3181454`）：`renderTextureCamera.targetTexture` 为 null → `scriptErrorMessage='capture error'` 后继续；RT 未创建时先 `WAIT + waitType='wipe'`（等划像结束）；`RenderCameraSwap(0x31a010c)`：旧 RT 更名 `captureScriptActionRednerTexture`、新建 **1024×1024** RT 给 `0x138/0x148/0x150` 三台相机、直播层 `meshRenderBase(0x130)` 贴新 RT；`captureTexture(0x268)` 贴到 `meshCaptureBase(0x128)`。语义 = **冻结当前画面成贴图**，场景继续演。
- **`captureRelease`**（`0x31823a4`）：幂等释放（颜色透明 → ClearImage → `Release`+`Destroy` → 置空）。
- **`useSimpleMeshFigure <逗号分隔 id…>`**（`0x317ba14`）：元素过 `ConvertNameString` 存入 `simpleMeshFigureNames(0x788)`；消费点 `IsUseSimpleMeshFigure(id)`（渲染选路）。

**补齐步骤**：`capture` 若渲染层是 canvas → `drawImage` 快照到离屏 canvas 叠上层（语义 1:1）；DOM 实现 → 退化为"冻结交互/保留画面"或 no-op + 诊断；`captureRelease` 幂等。`useSimpleMeshFigure` 记名单（无简化资源=全量渲染）。`capture error` 等价值 = 记录错误并继续。

---

## §16 畸变及精灵遮罩（6 条）

**语料**：`distortionstart` 13、`distortionstop` 11；`distortionloop`/`charaMask`/`spriteMask*` 0。

**畸变（都是"材质属性插值"，不是相机后处理）**：
- `distortionstart <sec> <cx> <cy> <strength> <range> <coefficient>`（**11 token**，`0x317b128`）→ `SetCameraFilter('Distortion')` + `StartDistortion(sec, count=0, …)`。
- `distortionloop`（**13 token**，`0x317f1e0`）→ `count=pd[2]`；`count!=0` 时插值速率走**三角波往返** `rate = 1-2|0.5-rate|`（`0x316d060`）。
- `distortionstop <sec>`（1 token，`0x317b7ec`）→ 从当前值插到 `strength=range=0` 的停止参数。
- 控制器 `ScriptActionRenderEffectController`（`0x5E0`）：`{timerCount 0x10, timerMax 0x14, loopCount 0x18, reflectionFunction 0x20, isEnable 0x30}`；材质属性 **`_CenterX/_CenterY/_Strength/_Range/_Coefficient`**；快进时 `SkipDistortion`（rate=1 落终态）。
- **补齐**：状态机与计时器必须照走（否则 `distortionstop` 语义错）；视觉无 shader 时降级：SVG `feTurbulence/feDisplacementMap` 近似，或纯记录 + 一次诊断。**绝不阻塞**（原版不阻塞）。

**精灵遮罩**：
- `spriteMaskSet <名>`（`0x3179ff0`）：`ConvertSpriteMaskName` → **`Image/mask_<name>`**；`WAIT + waitType='spriteMaskSet' + isSpriteMaskLoading(0x732)`；回调 `Sprite.Create` → `spriteMask(0x210).sprite` → `SetActive(true)`。
- `spriteMaskOff`（`0x3187440`）：清 sprite + 隐藏（**不复位** `isMaskEnabled/isSpriteMaskLoading`）。
- `charaMask <槽> inside|outside|none`（`0x3183f88`）：→ `ScriptCharaData.SetMaskInteraction(1/2/0)`（Unity `SpriteMaskInteraction`）；槽空静默返回。**不是 `#MASK` 子层机制**，要单独建模。
- **补齐**：`spriteMaskSet` 找不到贴图 → 记诊断、**当加载立即完成**、遮罩视为关闭（原版找不到时写 `"<name> is not found"` 但也不阻塞流程——阅读器不能被等待卡死）；有 `Image/mask_*.png` 时用 CSS `mask-image`（`charaMask` 的 inside/outside 用 `mask-composite` 近似）。

---

## §17 拉伸、翻页和滚动（10 条）

**语料**：`turnPageOn` 12、`turnPageOff` 11、`stretchin` 4、`stretchout` 1、`subStretch` 1；其余 0。

| 命令 | 原生机制 | 阅读器补齐 |
|---|---|---|
| `stretchin`/`stretchout <名> [时长] [scale]`（共享体 `0x3187cbc→0x318924c`） | `StartStretch`（`0x31b9c28`）对 `stretchBase(0xC8)` 同时 `TweenScale`+`TweenPosition`；名称域 **`horizontally / horizontallyLeft / horizontallyRight / vertical / verticalUp / verticalDown / full`**；忙（`isExecuteStretch 0x508`）拒绝；非法名 → `state=ERROR` | 舞台层 `transform: scale()/translate()` + transition；语料只用 `full`；`stretchOff` 复位 |
| `stretchOff` | `InitStretch`（`0x31a1cfc`）：停 tween + 按静态预设复位 + 清状态 | 取消 transition + `transform:none` |
| `subStretch <on\|off>` | `ScriptSubLayerManager.SetSubStretch(bool)`（`0x31dfb10`） | 子层拉伸总开关 |
| `subStretchin`/`out <组键> <方向> <scale> [时长]`（共享体 `0x317d3a4`） | `ScriptSubLayer.StartSubStretch`（`0x31dea10`，目标 `subStretchBase(0x80)`）；层不存在**静默**返回 | 子层容器 tween |
| `screen <true\|false> <x> <y> <w> <h>`（**9 token**，`0x31804c8`） | 消息窗口矩形 → `ScriptMessageCommonManager.SetScreen(0x31d193c)` + `ScriptLogMessage.SetHomePosition`；`true/false`=底板开关 | ⚠ 不是"画面变形"；把 x/y/w/h 写进文本框容器；0 次 → 低优先 |
| `turnPageOn [f]` / `turnPageOff` | `SetForcedDisableTurnPage(flag,force)`（`0x31d1c0c`）：Off=禁用翻页；On=解除，`f`=强制立即解除 | 状态位 `{forcedDisable, force}`；Web 文本框无翻页动画 → 记录状态即可，不阻塞 |
| `scrollStop`（无参） | 置 `isScrollStop(0x42C)`；下一条消息显示时交给 `ReturnScroll` 后清零 | 一次性 flag：下一条消息"立即整段显示" |

---

## §18 结束淡出（1 条）

**语料**：`endFade white` 1 次（`Final Singularity/0100082211.txt:931`，4 行后 `[end]`）。

**原生机制（全链实证）**：`endFade <clear|black|white>`（`0x31843b4`）**只写** `startMode(0x280)`：`clear→9(CLEAR_FULL)`、`black→10`、`white→11`。
`[end]`（无参，`EndExecuteScript(null) 0x31b2824`）→ `GetEndMode(color)`（`0x31b402c`）：color 空 → 返回 `startMode`（即 endFade 设的值）；`white→7`、`black→6`；随后按族：黑族 `{1,6,10,12,16}`→`CommonUI.maskFadeout(kind=1)`；白族 `{2,7,11,13}`→`kind=2`；clear 族 `{3,4,5,9}`→`StartFade('clear')`；最后 `state=WAIT_EXIT(6)`。

**补齐步骤**：`endFade` 存 `startMode`；`end`（无参）→ 按 startMode 用黑/白遮罩淡出后结束脚本；`[end black|white]` 覆盖；`[endFade clear]` = 结束时不加淡出。

---

## §19 战棋/战斗演出（10 条）

**语料：10 条全部 0 次**（`grep -rl "\[war" scripts` = 0 文件）；且**全部不写 wait**（不阻塞）。

**原生机制（供将来接入，不必现在建模）**：10 条 handler 都只做参数整形后转发 `SingletonMonoBehaviour<WarBoardManager>.get_Instance`（`0x47e721c`）：
- `warEventScript <id>` → `AddEventScript`；`warEffectOff/Piece/Pos/Square` → `StopEffectScript`/`PlayEffect*Script`（key+特效名+三种定位：棋子 `int[3]`、平面 `Vector2`、格号 `int`）；
- `warMoveCamera{Piece,Pos,Square}` → `MoveCamera*Script`（`posIndex/moveTime/zoom/easeType/target`）→ `MapCamera.StartAutoWork`（`0x2934e58`）；缓动词表 = iTween 全套（`GetEaseTypeScript 0x2b22d74`）；
- `warCharaFadein`：`GetPiecePosIndexScript`（`0x2b337d8`，`WorldToViewportPoint` 返回 -1/0/1/2 决定镜像 x）→ `SetPosition` + `MoveAlpha`；
- `warBoardTalkScreen`：消息窗底板换 `img_talk_textbg`（同 `faceTalkScreen`）。
- 坐标模型 = `squarePositionDict(0x1C8)` 查表（`GetSquarePosition 0x2b147ac`，取不到用静态预设默认值）。

**建议**：实现为「可识别 + 跳过 + 一次性诊断」。依据：语料 0；依赖 3D 相机/盘面 prefab/格子表（另一套渲染栈）；无 wait 耦合，跳过不改变流程；原版在战棋外调用会走 NullRef 分支。将来做战棋回放时，按上表接口补 `WarBoardBackend`。

---

## §20 部分实现项收口清单（adv-unrestored.md「已有基础路径」表，17 行）

详细证据（逐项 VA、反汇编摘录、语料对拍）见 `work/out/_evidence/howto/evidence-partial.md`。下表是"最小收口动作"汇总；优先级按 `evidence-partial.md` 的 P0–P3。

| # | 项 | 关键缺口 | 最小收口动作（纯逻辑优先） | 依赖 | 优先级 |
|---|---|---|---|---|---|
| 1 | 划像与遮罩转场 | `_Gradation`=level 未用；cutVer 5 段网格缺失；mask Kind/in/out 未等效 | **mask 先收口**：`maskin`=淡入遮罩、`maskout black\|white`=按 Kind 淡出、`clear`=取消全部转场；wipe 参数全量解析（名/时长/level）；CSS `mask-image` 近似，cutVer 需资源 | Wipe 纹理/shader | P2 |
| 2 | 滤镜和模糊 | 只有 gray/inversion/darkred + 统一 blur | `blur lens\|motion\|glass` → **`GaussianBlur`/`MotionBlur`/`FrostedGlass`**；`subBlur` 用 `*Through` 版本；统一滤镜模型 `{name, params[16], color}`；`aberration` 用 RGB 平移近似 | shader | P2 |
| 3 | 子层遮罩与精确合成 | `#MASK` 组未参与合成；子层数未消费；默认深度缺口 | `subCameraOn n` 建/启用 n 组（`1..4 → #A..#D`）；`subRenderDepth` 入组排序（默认 1、值 1..5）；**`#MASK` 只是普通 `#` 前缀组**（无字面量，不应特判） | #MASK 合成 shader | P1 |
| 4 | 表情和立绘切换 | 无双缓冲交叉渐变；无等待语义 | 双缓冲 `main/back` + `ChangeKind{NORMAL/FADE/BLINK/CROSS_FADE}`；`charaFaceFade`/`charaCrossFade` 注册 **`waitType='charaChange'`+waitIndex=槽**（当前"直接改 face/id"最大语义差）；曲线需真机对拍 | 立绘 atlas | P1 |
| 5 | 装备与图片种类 | `imageSet` 1/2 位义曾是推断 | **已闭环**：`imageSet` 第 3 参=`SetPosition` **站位下标**、第 4 参=`SetFullScreenScaleType`（`0x31928ec/0x3192990`）；`equipSet`→`CharaGraph/{id}`（回退 `9400010`）；`master*` 按 `playerGenderIndex` 选双资源 | CharaGraph/卡面图 | P0 |
| 6 | 旋转和相机 pivot | 仅 Z 轴；双节点 pivot 未实现 | `charaRollAxis` 的 `pd[2]` 是 **axis 字符串**（`0x31798cc`；支持任意轴 → `rotate3d`）；`centerOffset` → `transform-origin` 偏移（原生=平移-旋转-平移双节点）；`charaRollMoveEx`=时长+目标点 | 无 | P0 |
| 7 | 屏幕边缘变体 | 公式简化 | **全公式已取**：FSL=`-floor(GetOffsetX(80,1))`、FSR=`+ceil(同)`、FSSideL/R=`∓GetForceOffsetX(1,0)`（不门控 Vista、不加 80 边距）、NotNotch=`flag=0`；`GetCalcOffsetX`：`v=(min(aspect,2.3333)-1.7778)*576*0.5`（aspect<16:9 时 v=0.5） | 无（真机核对刘海） | P0 |
| 8 | 循环移动和闪光 | 正弦/余弦近似 | `charaRelativeLoopMove` token=**6n+5**（每段 x,y,时长），改分段线性（Ease 版按缓动表）；flash 改"两段颜色+时间"，`once/loop/pingpong` 三分支（替代余弦透明度） | 无 | P0/P1 |
| 9 | 发言者演出 | talkDepth 未进合成 | `charaTalk on/off/depthOn/depthOff` → `SetTalkName(0x31b744c)` 写 `isTalkMask 0x3B1/isTalkDepth 0x3B2/talkMaskName 0x3B8`，逐角色 `SetTalkMask`（非发言者压暗）+`SetTalkDepth`；`=spot[..]` 接同一套 | 无（量值需对拍） | P0 |
| 10 | 角色着色 | 只有黑色剪影 | `charaFilter` 写 `filterName 0x98/filterColor 0xA0`；`normal` 清除、`silhouette` 用颜色着色（A 通道控 alpha）；DOM 用 `brightness(0)`+混色近似 | shader 精确混合 | P2 |
| 11 | 音频淡出与续播 | 尾参未消费、无续播 | 参数全量消费（fadeIn/fadeOut、`seStop` fadeout、`soundStopAllFade`）；`seContinue` 池按 id；`keepSubBgm` 计数器 + `ForceDisable` 复位；停止分三类（立即/淡出/**脚本结束**） | CPK/CRI 音频 | P1 |
| 12 | 延迟与等待 | delay 区间简化；wait 完成条件不全 | wait 四时间键精确实现（`time`=scaled、`rtime`=unscaled、`frame`、`skippableTime`）+ `(wt\|k)` 字数排除规则；60 个命令键先接 busy 谓词框架；delay 区间（语料 0）后置 | 无 | P1 |
| 13 | 自动播放和跳读 | 命令直接跳过 | 字段级语义已取：`isSkip 0x377`、`tapSkipLabel 0x380`、`tapSkipFade 0x388`、`isBackLog 0x391`、`isBacklogOnly 0x392`、`hideAutoMessageButton 0x3A1`/`hideBackLogButton 0x3A2`；`autoAndBackLog` 有 `isBackLog` 前置守卫 | 无 | P0 |
| 14 | 任务条件和变量数据 | 无求值函数/数据源 | `branchQuestClear`=`CondType.IsQuestPhaseClear(0x2d70ad8)`；`[%1..%5]` 替换器（`%5`=`servantAllNum`；未知编号给空串并补 `[-]`）；数据源外接 provider | 用户档 | P3 |
| 15 | 字体、图标及行内标记 | 字号第二参未处理 | `[f]` 第 2 参=垂直对齐（top0/center1/bottom2）+ 6 档字号（`-`29/x-small19/small24/medium29/large48/x-large64）；`[i]/[image]` 行内图（`[image 名:文本]` 替字、第三参=缩放）；`tRoute/tFlag/tRaidShortName` 接替换器 | 字体/图集 | P2 |
| 16 | 本地化及嵌套脚本 | 未自动加载服务器表 | 控制符**表驱动**（默认表 `LocalizationJpn` 内置于 `data.unity3d`，可被 `AssetStorage("Localization")` 覆盖；禁止硬编码 `＠/＄/？`）；`％！/￥` 语料 0 → 识别+安全降级；**无调用/返回栈字段，不需要实现** | 服务器表 | P2 |
| 17 | 原始资源链 | 未接 AssetStorage/AssetBundle | 脚本命名/存在性/`Q\|E\|W`（`closure-meta-assets.md` 已闭环）+ 立绘 Form 三级回退（`Form/{f}/` → 无 Form → `1000000`）**可完整实现**；解密链 `tools/fgo_assets.py` 已跑通，待游戏缓存；AssetBundle→Unity 资源走离线转换 | 游戏缓存 | P2 |

---

## §21 原生空实现（4 条）与诊断口径

`advSoundSet`、`delayEnd`、`enableFullScreen`、`enableWaitLoadAssetWhenResume` 在该版本逆向证据中**直接进入空 handler**（`0x3182018` 共享体，仅 `ret`）。

- 阅读器处理：**跳过、不实现、不告警**（与原版一致）。
- 例外：`delayEnd` 仍承担**延迟区间的边界定位**（`GetNextDelayEnd 0x31b2710` 用它找区间结束行）；阅读器做 delay 区间时把它当边界标签，而不是命令。
- 诊断口径建议与 `adv-unrestored.md` 对齐：完全未实现的命令记诊断；**近似/漏参/主动跳过的命令也要记**（"没有告警"不能当完全还原的证明）。

---

## §22 验收与回归建议

1. **全量冒烟**：对 `scripts/` 2,583 个脚本做「解析 → 顺序执行到 `end`/`endFade`」回放，断言不崩溃、不永久 WAIT。重点回归 79 条有出现的命令（频次表见 `work/coverage/tag_counts.json`）。
2. **命令命中率**：把本文件 §1–§19 实现的命令从 `unsupported` 移出；对 P0 列表（§0.3）做逐条冒烟用例（可用语料原句）。
3. **等待契约测试**：未知 waitType → 记录错误并放行；资源缺失的 `*Set/ Prepare/ Set` 类命令必须立即完成等待（构造"后端不可用"的单测）。
4. **参数错误契约**：非法参数按 native 记 `parameter error`/`parameter be unnecessary` 诊断后继续（不抛异常、不中断）；`specialEffect cutting` 这类**短形态**不能被长度校验误拒。
5. **已知近似清单（对外标注）**：CSS blur 代替 shader；distortion 的 SVG/无渲染近似；wipe 的 mask-image 代替网格；`messageShake` 的确定性 PRNG；`flagRandom` 的数值比较近似；`charaReturn`/循环的定时器实现；war*/adv* 的占位跳过。
6. **抽样对拍（可选）**：`masterNameWidth large 339`（唯一语料）、`charaCutin upToDown` 扫过方向、`messageShake 0.05 4 3 0.3` 的振幅/周期、`[endFade white]` 的结束淡出——这几处是数值/视觉最值得真机核对的点。
7. **边界声明**：本文件未做视觉对拍；`adv-unrestored.md` 的"124 项测试 + 2,583 份编译检查"只证明现有行为与语法结构，不等于全指令/全参数形态/原始视觉一致。

---

## §23 对既有文档的修正汇总（本次逆向新增/纠正）

| 文档 | 原文 | 修正（证据） |
|---|---|---|
| `presentation.md` §1 | 「element[0]=tag」 | **pd 不含 tag**；值/分隔符交错（`0x31c1ac4`、各 handler） |
| `params-visual.md` | `charaEffect` pd[4]=颜色、pd[8]=翻转 | pd[4]=x、pd[6]=y、pd[8]=flip；颜色证据属 `charaEffectEdgeBlur` |
| `params-visual.md` | `specialEffect` pd[6]=朝向 | pd[6]=**time**、pd[10]=**range** |
| `params-visual.md` | `charaRollAxis` pd[2]=立绘/资源名 | pd[2]=**axis 字符串**（`0x31798cc`+`StartRollAxis 0x31e3408`） |
| `presentation.md` §4.3 | blur「即 GaussianBlur（推断）」 | lens/motion/glass → **GaussianBlur/MotionBlur/FrostedGlass**；subBlur=`*Through`（`0x318e220/0x318fe6c/0x31918c4`） |
| `composition.md` §1.2 | `ConvertMessageWindowName` 是死代码 | **错**：`messageChange` handler `0x31852f8` 是活调用点，语料 1 次 |
| `composition.md` §2.3 | FSL/FSR/FSide 简化描述 | 补精确公式（`GetForceOffsetX` 分支；`GetCalcOffsetX` 完整式） |
| `params-misc.md`/brief | `page`「保存整行 pd」 | `page`/`clear` **必须无参**，waitType 写常量 `'page'/'clear'`（`0x3182044/0x3192e70`） |
| `supplement-presentation-composition.md` §E.2 | `imageSet` 第 3 参位义 INFERRED | **已闭环**：站位下标 + `SetFullScreenScaleType` |
| `params-misc.md` | `skip/tapSkip/autoAndBackLog/backlogStart\|End` 语义缺失 | 补字段级语义（§20 第 13 项） |
| `composition.md` | `fowardEffect` 名下含 capture | `capture` 是独立命令（`0x3181454`） |
| `adv-unrestored.md` 消息窗组 | 「部分还需字体/窗口资源」 | 精确化：真正需资源的只有 `messageChange/fontType/talkNameBack/faceTalkScreen/charaFaceIcon` |

---

## §24 证据文件索引与未决项

### 24.1 本次 8 份证据文件（`work/out/_evidence/howto/`）

| 文件 | 覆盖 |
|---|---|
| `evidence-effects.md` | 特效 41 条 + 5 容器 + CommonEffect/ProgramEffect API 全表 + effectmessage |
| `evidence-communication-chara.md` | 通讯 5 + 切入/攻击 6 + 循环/复位 5 |
| `evidence-fsm-insertion.md` | FSM 8 + 插入动画 7 + wait 机制细节 |
| `evidence-advprefab-movie-capture.md` | ADV prefab 6 + 影片 2 + 截屏/渲染 4 + endFade 1 |
| `evidence-cri-branch-flow.md` | CRI cue 11 + 条件分支 9 + flagRandom + 流程/名宽 4 |
| `evidence-message-menu.md` | 消息窗 13 + 菜单/选项 5 |
| `evidence-distortion-stretch-war.md` | 畸变/遮罩 6 + 拉伸/翻页/滚动 10 + 战棋 10 |
| `evidence-partial.md` | 部分实现表 17 行逐项收口 |

### 24.2 复现命令（工作目录 `F:\Project\fgo\work`）

```bash
python coverage/win.py <VA> <before_bytes> <after_bytes>   # 带字面量/调用注解的反汇编窗口
python tools/klass.py '<类名regex>' [members]              # dump.cs 类体
python tools/mfind.py '<方法名regex>' [n]                  # 方法名 → VA
python tools/annotate_func.py '<方法名regex>' [strings]    # 整函数注解反汇编
python tools/find_literal_refs.py '<子串|/regex/>' --max N # 字面量 → 引用点
python -c "import json;d=json.load(open('work/coverage/tag_counts.json',encoding='utf-8'));print(dict(d['counts']).get('<cmd>'))"
```

### 24.3 仍未决的关键项（不影响上述补齐方案的落地）

| 主题 | 未决内容 |
|---|---|
| 特效 | `0x3193fec` 返回的静态 Vector2 具体值；`CommonEffectLoadComponent.LoadEndHandler` 回调体；`ProgramEffectManager.mainSpecialEffectList` 的序列化清单（决定 `specialEffect <名>` 合法值集合）；`ScriptManager+0x5c4` 字段名 |
| 通讯 | 虚表槽 `0x1A8/0x198` 的具体方法名（推断 `ForceLoop/ForceStart`）；深度 `-(A*10)` 语义 |
| FSM | `fsmObjectDataList` 长度静态源；负 waitIndex 循环上限 |
| 影片/截屏 | `captureRelease` 后旧 RT 的回收点；`meshCaptureBase/meshRenderBase` 叠放次序；`advPlayAnimator` waitType 赋值点（判为死代码） |
| 音频 | `cueSeContinue` 5 值形态 name 不经 `ConvertNameString`（实测差异，照抄即对）；`cueSeContinueVolume` 的 3 值分支参数字义 |
| 分支 | `CondType.IsOpen` 的 Kind 8/0x28 枚举名；`flagRandom` 无样本可比对分布 |
| 消息 | `menu`/`notification` 的 `waitType ← *x22` 精确字面量（运行期以 `'menu2'/'notification2'` 为准）；`charaFaceIcon` 的 face→贴图映射 |
| 畸变/拉伸/战棋 | 畸变 shader 内部算法；拉伸静态预设（槽 `0x5571a88`）的类名与数值（需运行时采样）；战棋 `MapCamera/MapZoom` 细节 |

> 若要把上述"未决"继续收口：优先用**真机/模拟器**对 `masterNameWidth`、`messageShake`、`charaCutin`、`[endFade white]` 四个点做一次视觉对拍；其余（shader 算法、prefab 内容）以资源离线提取为准，属于"资源到位的升级路径"。




---

## §25 附录：154 条命令逐条索引（实现工作清单）

说明：`handler` = `ScriptCommandExecute` 内代码块 VA（共享体成员 VA 相同）；`语料` = 33 章全量统计次数；
「处置」是建议的最小交付形态。逐条证据与参数细节见对应节与 8 份证据文件。

| 组 | 命令 | handler | 语料 | 处置 | 见 |
|---|---|---|---:|---|---|
| 特效 | `backEffect` | `0x317c3c0` | 143 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `backEffectDestroy` | `0x3184ad0` | 35 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `backEffectPause` | `0x317c3c0` | 0 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `backEffectStart` | `0x3182470` | 0 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `backEffectStop` | `0x317ebac` | 67 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaBackEffect` | `0x3181664` | 49 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaBackEffectDestroy` | `0x317b2e0` | 10 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaBackEffectPause` | `0x3181664` | 0 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaBackEffectStart` | `0x3187fb4` | 0 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaBackEffectStop` | `0x317e538` | 27 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaEffect` | `0x3187a5c` | 4635 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaEffectDestroy` | `0x317f398` | 1005 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaEffectEdgeBlur` | `0x3188390` | 177 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaEffectEdgeBlurDestroy` | `0x31865b8` | 118 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaEffectEdgeBlurPause` | `0x3188390` | 7 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaEffectEdgeBlurStart` | `0x317b730` | 7 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaEffectEdgeBlurStop` | `0x317eabc` | 65 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaEffectPause` | `0x3187a5c` | 8 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaEffectStart` | `0x3188090` | 8 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaEffectStop` | `0x317a4d0` | 1824 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaSpecialEffect` | `0x3184b84` | 1284 | 实现-占位（命名参数） | §1 |
| 特效 | `charaSpecialEffectPause` | `0x3184b84` | 0 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaSpecialEffectStart` | `0x3186754` | 0 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `charaSpecialEffectStop` | `0x318198c` | 7 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `effect` | `0x3180b70` | 3150 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `effectDestroy` | `0x3184278` | 652 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `effectForceStop` | `0x3184508` | 19 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `effectPause` | `0x3180b70` | 1 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `effectStart` | `0x317cca8` | 1 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `effectStop` | `0x31821f8` | 773 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `effectmessageDestroy` | `0x3181ce4` | 0 | 实现-逻辑（消息窗特效停止） | §1 |
| 特效 | `effectmessageStop` | `0x31814c4` | 12 | 实现-逻辑（消息窗特效停止） | §1 |
| 特效 | `fowardEffect` | `0x318087c` | 1297 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `fowardEffectDestroy` | `0x317db6c` | 212 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `fowardEffectPause` | `0x318087c` | 4 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `fowardEffectStart` | `0x318140c` | 4 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `fowardEffectStop` | `0x318496c` | 191 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `specialEffect` | `0x3187604` | 8 | 实现-占位（cutting/flash 特例） | §1 |
| 特效 | `specialEffectPuase` | `0x3187604` | 0 | 实现-占位 | §1 |
| 特效 | `specialEffectStart` | `0x318290c` | 0 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 特效 | `specialEffectStop` | `0x317c6d8` | 0 | 实现-占位（逻辑全量，视觉待 prefab） | §1 |
| 通讯 | `communicationChara` | `0x317ef18` | 131 | 实现-占位（占位立绘/噪声） | §2 |
| 通讯 | `communicationCharaClear` | `0x318670c` | 814 | 实现-占位（占位立绘/噪声） | §2 |
| 通讯 | `communicationCharaFace` | `0x317d044` | 519 | 实现-占位（占位立绘/噪声） | §2 |
| 通讯 | `communicationCharaLoop` | `0x317ef18` | 691 | 实现-占位（占位立绘/噪声） | §2 |
| 通讯 | `communicationCharaStop` | `0x3181d7c` | 3 | 实现-占位（占位立绘/噪声） | §2 |
| 切入/攻击 | `charaAttack` | `0x3186270` | 50 | 实现-逻辑/占位（CSS 划像降级） | §3 |
| 切入/攻击 | `charaCutStop` | `0x31857a8` | 0 | 实现-逻辑/占位（CSS 划像降级） | §3 |
| 切入/攻击 | `charaCutin` | `0x31855fc` | 16 | 实现-逻辑/占位（CSS 划像降级） | §3 |
| 切入/攻击 | `charaCutinPause` | `0x31855fc` | 0 | 实现-逻辑/占位（CSS 划像降级） | §3 |
| 切入/攻击 | `charaCutinStart` | `0x317d9c8` | 0 | 实现-逻辑/占位（CSS 划像降级） | §3 |
| 切入/攻击 | `charaCutout` | `0x317dc8c` | 8 | 实现-逻辑/占位（CSS 划像降级） | §3 |
| 循环/复位 | `charaFadeSpeed` | `0x3180e44` | 0 | 实现-逻辑 | §4 |
| 循环/复位 | `charaFadeTimeLoop` | `0x3182fa0` | 0 | 实现-逻辑 | §4 |
| 循环/复位 | `charaFadeTimeLoopStop` | `0x31889d8` | 0 | 实现-逻辑 | §4 |
| 循环/复位 | `charaReturn` | `0x317a3ac` | 0 | 实现-逻辑 | §4 |
| 循环/复位 | `charaRollAxisLoopStop` | `0x3185968` | 0 | 实现-逻辑 | §4 |
| FSM | `fsmObjDestroy` | `0x317aba0` | 3 | 实现-逻辑（无图时立即完成等待） | §5 |
| FSM | `fsmObjLayer` | `0x317f638` | 3 | 实现-逻辑（无图时立即完成等待） | §5 |
| FSM | `fsmObjSendEvent` | `0x3185e08` | 3 | 实现-逻辑（无图时立即完成等待） | §5 |
| FSM | `fsmObjSet` | `0x317c248` | 3 | 实现-逻辑（无图时立即完成等待） | §5 |
| FSM | `fsmObjSetBool` | `0x3182adc` | 0 | 实现-逻辑（无图时立即完成等待） | §5 |
| FSM | `fsmObjSetFloat` | `0x3182adc` | 0 | 实现-逻辑（无图时立即完成等待） | §5 |
| FSM | `fsmObjSetState` | `0x3185e08` | 3 | 实现-逻辑（无图时立即完成等待） | §5 |
| FSM | `fsmObjSetString` | `0x3182adc` | 0 | 实现-逻辑（无图时立即完成等待） | §5 |
| 插入动画 | `insertionAnimationEnd` | `0x317f818` | 1 | 实现-占位（占位时间轴） | §6 |
| 插入动画 | `insertionAnimationSet` | `0x318816c` | 0 | 实现-占位（占位时间轴） | §6 |
| 插入动画 | `insertionAnimationSetFSL` | `0x318816c` | 0 | 实现-占位（占位时间轴） | §6 |
| 插入动画 | `insertionAnimationSetFSR` | `0x318816c` | 0 | 实现-占位（占位时间轴） | §6 |
| 插入动画 | `insertionAnimationSetFSSideL` | `0x318816c` | 0 | 实现-占位（占位时间轴） | §6 |
| 插入动画 | `insertionAnimationSetFSSideR` | `0x318816c` | 1 | 实现-占位（占位时间轴） | §6 |
| 插入动画 | `insertionAnimationStart` | `0x3180d0c` | 1 | 实现-占位（占位时间轴） | §6 |
| ADV prefab | `advActorHide` | `0x317f138` | 0 | 解析+占位（语料 0） | §7 |
| ADV prefab | `advActorShow` | `0x318489c` | 0 | 解析+占位（语料 0） | §7 |
| ADV prefab | `advPlayAnimator` | `0x318267c` | 0 | 解析+占位（语料 0） | §7 |
| ADV prefab | `advPrepare` | `0x317d14c` | 0 | 解析+占位（语料 0） | §7 |
| ADV prefab | `advRelease` | `0x31839d8` | 0 | 解析+占位（语料 0） | §7 |
| ADV prefab | `advSet` | `0x317ec04` | 0 | 解析+占位（语料 0） | §7 |
| 影片 | `criMovie` | `0x3183c38` | 181 | 实现-占位（占位播放器/转码升级） | §8 |
| 影片 | `movie` | `0x3183c38` | 1 | 实现-占位（占位播放器/转码升级） | §8 |
| CRI/保留 | `cueSe` | `0x3186434` | 5712 | 实现-逻辑/占位（音频资源缺失静音） | §9 |
| CRI/保留 | `cueSeContinue` | `0x317ffa4` | 32 | 实现-逻辑/占位（音频资源缺失静音） | §9 |
| CRI/保留 | `cueSeContinueStop` | `0x31838c8` | 20 | 实现-逻辑/占位（音频资源缺失静音） | §9 |
| CRI/保留 | `cueSeContinueVolume` | `0x3188898` | 14 | 实现-逻辑/占位（音频资源缺失静音） | §9 |
| CRI/保留 | `cueSeStop` | `0x3188bb0` | 1674 | 实现-逻辑/占位（音频资源缺失静音） | §9 |
| CRI/保留 | `cueSeVolume` | `0x318440c` | 1031 | 实现-逻辑/占位（音频资源缺失静音） | §9 |
| CRI/保留 | `cueVoice` | `0x317cef8` | 0 | 实现-逻辑（语料 0，成本≈0） | §9 |
| CRI/保留 | `cueVoiceStop` | `0x3179ed0` | 0 | 实现-逻辑（语料 0，成本≈0） | §9 |
| CRI/保留 | `cueVoiceVolume` | `0x317b954` | 0 | 实现-逻辑（语料 0，成本≈0） | §9 |
| CRI/保留 | `keepSubBgmOff` | `0x31797d0` | 0 | 实现-逻辑（计数器） | §9 |
| CRI/保留 | `keepSubBgmOn` | `0x3181fd4` | 0 | 实现-逻辑（计数器） | §9 |
| 条件分支 | `branchHaveSvtEquip` | `0x318459c` | 0 | 实现-逻辑（provider 可空） | §10 |
| 条件分支 | `branchMaterial` | `0x31802b0` | 26 | 实现-逻辑（provider 可空） | §10 |
| 条件分支 | `branchNotHaveSvtEquip` | `0x318459c` | 0 | 实现-逻辑（provider 可空） | §10 |
| 条件分支 | `branchNotMaterial` | `0x31802b0` | 0 | 实现-逻辑（provider 可空） | §10 |
| 条件分支 | `branchNotRouteSelect` | `0x31834e4` | 14 | 实现-逻辑（provider 可空） | §10 |
| 条件分支 | `branchNotRouteSelectCount` | `0x317c85c` | 0 | 实现-逻辑（provider 可空） | §10 |
| 条件分支 | `branchRouteSelect` | `0x31834e4` | 18 | 实现-逻辑（provider 可空） | §10 |
| 条件分支 | `branchRouteSelectCount` | `0x317c85c` | 22 | 实现-逻辑（provider 可空） | §10 |
| 条件分支 | `branchSetGrandSvtCount` | `0x317e20c` | 2 | 实现-逻辑（provider 可空） | §10 |
| 随机旗标 | `flagRandom` | `0x3184ed4` | 0 | 实现-逻辑（回放轨迹） | §11 |
| 流程/名宽 | `masterNameWidth` | `0x3185be0` | 1 | 实现-逻辑（数据可注入） | §12 |
| 流程/名宽 | `questMessageOverwrite` | `0x317d710` | 0 | 实现-逻辑（数据可注入） | §12 |
| 流程/名宽 | `revivalBranch` | `0x31853a4` | 0 | 实现-逻辑（数据可注入） | §12 |
| 流程/名宽 | `rewardSwitch` | `0x318522c` | 0 | 实现-逻辑（数据可注入） | §12 |
| 消息窗 | `betweenHeight` | `0x318472c` | 0 | 实现-逻辑（部分需资源降级） | §13 |
| 消息窗 | `charaFaceIcon` | `0x3182e04` | 0 | 占位+诊断（战棋数据） | §13 |
| 消息窗 | `faceTalkScreen` | `0x317cd60` | 0 | 占位+诊断（战棋数据） | §13 |
| 消息窗 | `fontType` | `0x31795f8` | 0 | 实现-逻辑+资源降级 | §13 |
| 消息窗 | `l` | `0x318472c` | 0 | 实现-逻辑（部分需资源降级） | §13 |
| 消息窗 | `messageAlign` | `0x3186e48` | 1 | 实现-逻辑（部分需资源降级） | §13 |
| 消息窗 | `messageChange` | `0x31852b8` | 1 | 实现-逻辑+资源降级 | §13 |
| 消息窗 | `messageShake` | `0x3182074` | 87 | 实现-逻辑（部分需资源降级） | §13 |
| 消息窗 | `messageShakeStop` | `0x317e89c` | 26 | 实现-逻辑（部分需资源降级） | §13 |
| 消息窗 | `messageSpeedForcedNormal` | `0x3184204` | 14 | 实现-逻辑（部分需资源降级） | §13 |
| 消息窗 | `messageStart` | `0x317f98c` | 0 | 实现-逻辑（部分需资源降级） | §13 |
| 消息窗 | `page` | `0x3182038` | 0 | 实现-逻辑（修正 clear 语义） | §13 |
| 消息窗 | `talkNameBack` | `0x3184900` | 33 | 实现-逻辑+资源降级 | §13 |
| 菜单/选项 | `menu` | `0x317fa74` | 0 | 实现-逻辑（复用 $choice/通知条） | §14 |
| 菜单/选项 | `notification` | `0x317af78` | 0 | 实现-逻辑（复用 $choice/通知条） | §14 |
| 菜单/选项 | `selectionCentering` | `0x317f90c` | 0 | 实现-逻辑 | §14 |
| 菜单/选项 | `switchCase` | `0x31875c4` | 0 | 实现-逻辑（归一到 $choice） | §14 |
| 菜单/选项 | `switchCaseEnd` | `0x3188c58` | 0 | 实现-逻辑（归一到 $choice） | §14 |
| 截屏/渲染 | `backCameraColor` | `0x317cb6c` | 43 | 实现-逻辑/占位（canvas 快照或降级） | §15 |
| 截屏/渲染 | `capture` | `0x3181454` | 14 | 实现-占位（canvas 快照或冻结降级） | §15 |
| 截屏/渲染 | `captureRelease` | `0x31823a4` | 1 | 实现-逻辑/占位（canvas 快照或降级） | §15 |
| 截屏/渲染 | `useSimpleMeshFigure` | `0x317ba14` | 1 | 实现-逻辑/占位（canvas 快照或降级） | §15 |
| 畸变/遮罩 | `charaMask` | `0x3183f88` | 0 | 实现-逻辑（maskInteraction 建模） | §16 |
| 畸变/遮罩 | `distortionloop` | `0x317f1e0` | 0 | 实现-占位（计时器必须照走） | §16 |
| 畸变/遮罩 | `distortionstart` | `0x317b128` | 13 | 实现-占位（计时器必须照走） | §16 |
| 畸变/遮罩 | `distortionstop` | `0x317b7ec` | 11 | 实现-占位（计时器必须照走） | §16 |
| 畸变/遮罩 | `spriteMaskOff` | `0x3187440` | 0 | 实现-占位（贴图缺失视为关闭） | §16 |
| 畸变/遮罩 | `spriteMaskSet` | `0x3179ff0` | 0 | 实现-占位（贴图缺失视为关闭） | §16 |
| 拉伸/翻页/滚动 | `screen` | `0x31804c8` | 0 | 实现-逻辑 | §17 |
| 拉伸/翻页/滚动 | `scrollStop` | `0x317f1a0` | 0 | 实现-逻辑 | §17 |
| 拉伸/翻页/滚动 | `stretchOff` | `0x3181c60` | 0 | 实现-逻辑 | §17 |
| 拉伸/翻页/滚动 | `stretchin` | `0x3187cbc` | 4 | 实现-逻辑 | §17 |
| 拉伸/翻页/滚动 | `stretchout` | `0x3187cbc` | 1 | 实现-逻辑 | §17 |
| 拉伸/翻页/滚动 | `subStretch` | `0x3187f58` | 1 | 实现-逻辑 | §17 |
| 拉伸/翻页/滚动 | `subStretchin` | `0x317d3a4` | 0 | 实现-逻辑 | §17 |
| 拉伸/翻页/滚动 | `subStretchout` | `0x317d3a4` | 0 | 实现-逻辑 | §17 |
| 拉伸/翻页/滚动 | `turnPageOff` | `0x3182720` | 11 | 实现-逻辑 | §17 |
| 拉伸/翻页/滚动 | `turnPageOn` | `0x317d4e8` | 12 | 实现-逻辑 | §17 |
| 结束淡出 | `endFade` | `0x31843b4` | 1 | 实现-逻辑 | §18 |
| 战棋 | `warBoardTalkScreen` | `0x317cd60` | 0 | 识别+跳过+诊断（语料 0） | §19 |
| 战棋 | `warCharaFadein` | `0x317ac68` | 0 | 识别+跳过+诊断（语料 0） | §19 |
| 战棋 | `warEffectOff` | `0x317fc60` | 0 | 识别+跳过+诊断（语料 0） | §19 |
| 战棋 | `warEffectPiece` | `0x317fd14` | 0 | 识别+跳过+诊断（语料 0） | §19 |
| 战棋 | `warEffectPos` | `0x3186664` | 0 | 识别+跳过+诊断（语料 0） | §19 |
| 战棋 | `warEffectSquare` | `0x317f470` | 0 | 识别+跳过+诊断（语料 0） | §19 |
| 战棋 | `warEventScript` | `0x317a1bc` | 0 | 识别+跳过+诊断（语料 0） | §19 |
| 战棋 | `warMoveCameraPiece` | `0x3187cec` | 0 | 识别+跳过+诊断（语料 0） | §19 |
| 战棋 | `warMoveCameraPos` | `0x317df90` | 0 | 识别+跳过+诊断（语料 0） | §19 |
| 战棋 | `warMoveCameraSquare` | `0x3183030` | 0 | 识别+跳过+诊断（语料 0） | §19 |

> 共 154 条；语料有出现的 79 条（0 次命令仍需可解析、可诊断、不阻塞）。

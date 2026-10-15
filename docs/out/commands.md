# FGO ADV/剧情脚本 命令集 (libil2cpp.so 2.139.3, arm64-v8a)

## 1. 推导方法 (How this was derived)

**目标函数**: `ScriptManager$$ScriptCommandExecute` @ `0x3177290` – `0x319402c`（VA，函数长 0x1CD9C 字节，约 29543 条指令）。

**核心发现 — C# `switch (tag)` 被编译成 FNV-1a 哈希判定树**

调用约定（函数序言已确认）: `x0=this, x1=tag, x2=pd(string[]), x3=line, x4=data, x5..=ref 参数`；序言把 `tag` 存入 `x25`，`pd` 存入局部结构 `[x20]`。

`0x3178ff0` 处 `x25` 从局部结构重载为 tag，随后 `0x3178ffc  bl #0x2cdf448`（哈希函数），返回值 `w0` 进入判定树（树根 `0x3179000`）。

对 355 个叶子逐一验证了哈希函数为 **FNV-1a 32 位**（对 UTF-16 code unit，offset basis = 2166136261，prime = 16777619）：
`fnv1a(literal) == 节点哈希常量` 对全部叶子成立（355/355，见 `il2cpp_out/cmd_tag_v3.json`）。

**方法**:
1. 用 `tools/extract_switch.py` 抓取函数内所有 `mov w8,#lo; movk w8,#hi,lsl#16; cmp w0,w8; b.<cond>` 节点（共 594 个）。
2. 用 `tools/final_commands2.py` 的 `walk()` 对每个节点的每条后继路径做**带状态的路径遍历**（跟踪 `x8` 的 adrp+ldr 字面量槽、`x0` 的来源寄存器、`bl op_Equality` 后的 `tbz/tbnz` 分支），得到 (字面量, 比较寄存器, body, fallback)。
3. 只保留 `fnv1a(literal) == 节点哈希` 的候选（哈希校验使结果可信）。
4. 按比较寄存器分类: `x0 = x25` ⇒ tag 比较（= 命令）; `x0 = x22` ⇒ 第二棵判定树（对 `pd[0]` 的“子命令/关键字”分发，见 §4）。

**完备性校验**（三重交叉）:
1. **树遍历vs全节点**: 从树根 BFS 只能到达 479/594 节点（部分节点由其它块跳入），因此改为遍历全部 594 个候选节点；用整表反查（对 27043 个字面量全部算 FNV-1a）补回了 BFS 漏掉的命令（`wait / messageOff / endFade / charaMoveScale / charaPut / branchQuestNotClear / interruption / equipChange …`）。
2. **独立扫描**: `tools/dataflow.py` + `tools/winres.py` 独立提取函数内**所有** `String.op_Equality` 调用中与 tag 比较的字面量（264 个）; 全集 ⊆ 本表 366 个命令（差集为空）。
3. **无孤立常量**: 594 个节点的 383 个不同哈希常量中，每一个都能对应到 `fnv1a` 反查得到的字面量（命令或 §4 的 pd[0] 关键字），没有无法解释的常量。

**结果**: 命令 **366** 个（含别名/共用 body）；其中 129 个给出参数类型表，247 个给出最小 token 数。

**重要修正（与先验预期不同）**:
- 本版本二进制中 **不存在字面量 `mes`、`bg`、`char`、`fade`、`voice`（作为命令）**（`il2cpp_out/stringliteral.json` 全表检索）。
  核心剧情命令实际是 `messageStart/messageOn/messageOff/messageChange/messageAlign`、`talkStart/talkEnd/talkName/talkNameBack`、`chara*` 系列等。
- 参数helper (`GetStringParameter/GetIntegerParameter/GetFloatParameter/GetPositionParameter`) 在本版本**是死代码**（全 `.so` 扫描 `bl` 调用点: 只有 `GetIntegerParameter`/`GetFloatParameter` 各调用一次 `GetStringParameter`，而这两个自身 0 调用者）。参数**没有**以字面量名字出现，改为位置式 `pd[]`。
  因此 `commands.json` 中 `params[].name` 为 `null`，`consumer` 字段给出该参数的**消费者/转换函数**（这是二进制中可证明的语义）。

### 1.1 pd (参数数组) 的布局

`AnalysParam(string)` @ `0x31a7688` 是分词器（按 0x20 空格 / 0x22 引号 / 0x2c 逗号 / 0x3d `=` 切分）；**分隔符自身也成为一个元素**：

```
pd[0] = 值, pd[1] = " ", pd[2] = 值, pd[3] = " ", pd[4] = 值, ...
```

- 偶数下标 = 值，奇数下标 = 分隔符（`pd[1]/[3]/[5]/[7]/[9] == " "` 的分隔符校验共 237 处，见 §4）。
- 每个 handler 开头的 `ldr wK,[pd,#0x18]; cmp wK,#N` 是**最少元素数**校验（本表 `min_token_count`；已按分支方向修正：`b.le/b.ls` ⇒ N+1）。
- 无参数时 `pd.Length == 0`（例如 `clear` 无参时直接走 §4 的 pd[0] 分发）。

## 2. 命令表

说明: `handler` = 比较成功后 case body 的首条指令（VA）。`verify` = 该命令的 `bl op_Equality`（tag 校验点）所在地址，`hash` = 判定树中的 FNV-1a 常量。
参数列: `pd[i]:type (消费者)`。`confidence=high` 表示有类型化参数或有明确最小 token 数且 body 独立；`medium` 表示 body 与其它命令共享（别名/case 合并）或参数只在共享尾部分析到。

| 命令 | handler | 参数 (有序) | min tokens | 证据 (verify/hash) | conf |
|---|---|---|---|---|---|
| `advActorHide` | 0x317f138 | pd[0]:string (ConvertNameString) | 1 | verify 0x317f12c · 0xf0f908b | high |
| `advActorShow` | 0x318489c | pd[0]:string (ConvertNameString) | 1 | verify 0x3184894 · 0x55bc150e | high |
| `advPlayAnimator` | 0x318267c | — | — | verify 0x3182674 · 0x4c63a509 | medium |
| `advPrepare` | 0x317d14c | — | — | verify 0x317d140 · 0xf1787bc1 | medium |
| `advRelease` | 0x31839d8 | — | — | verify 0x31839d0 · 0xa9e91acb | medium |
| `advSet` | 0x317ec04 | pd[0]:unknown (GetAssetName) | 1 | verify 0x317ebf8 · 0x4799d20a | high |
| `advSoundSet` | 0x3182018 | — | — | verify 0x3182010 · 0xb64c2567 | medium |
| `autoAndBackLog` | 0x317923c | — | 1 | verify 0x3179230 · 0xc00815ca | medium |
| `bScene` | 0x317c59c | — | — | verify 0x317c590 · 0x26ce7b13 | medium |
| `backCameraColor` | 0x317cb6c | — | 1 | verify 0x317cb60 · 0xf4951da4 | medium |
| `backEffect` | 0x317c3c0 | pd[0]:string (ConvertTalkEffectName) | 5 | verify 0x317c3b4 · 0x4a6c6c2f | high |
| `backEffectDestroy` | 0x3184ad0 | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x3184ac8 · 0xa7f3d9f | high |
| `backEffectPause` | 0x317c3c0 | pd[0]:string (ConvertTalkEffectName) | 5 | verify 0x317c3b4 · 0x10c8602f | high |
| `backEffectStart` | 0x3182470 | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x3182468 · 0xfa9a46a5 | high |
| `backEffectStop` | 0x317ebac | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x317eba0 · 0x1db4e77 | high |
| `backlogEnd` | 0x317c1ec | — | — | verify 0x317c1e0 · 0x2e09f6d | medium |
| `backlogStart` | 0x31813e0 | — | — | verify 0x31813d8 · 0xbdb01614 | medium |
| `betweenHeight` | 0x318472c | — | — | verify 0x3184724 · 0x9859d490 | medium |
| `bgm` | 0x31824fc | pd[2]:float (Single.Parse) | 3 | verify 0x31824f4 · 0x5db2d891 | high |
| `bgmStop` | 0x3181900 | — | — | verify 0x31818f8 · 0x3b958991 | medium |
| `bgmStopEnd` | 0x3181900 | — | — | verify 0x31818f8 · 0xd0ddb2f6 | medium |
| `blur` | 0x3181f20 | — | 2 | verify 0x3181f18 · 0x6bfbd198 | medium |
| `blurOff` | 0x3187994 | pd[2]:float (Single.Parse) | 3 | verify 0x318798c · 0x68b6651d | high |
| `branch` | 0x317b498 | — | 3 | verify 0x317b48c · 0xb6873945 | medium |
| `branchHaveSvtEquip` | 0x318459c | — | 3 | verify 0x3184594 · 0x271b37fa | medium |
| `branchMaterial` | 0x31802b0 | pd[0]:unknown (op_Equality) | 1 | verify 0x31802a4 · 0xa9c7db00 | high |
| `branchNotHaveSvtEquip` | 0x318459c | — | 3 | verify 0x3184594 · 0x4e750e71 | medium |
| `branchNotMaterial` | 0x31802b0 | pd[0]:unknown (op_Equality) | 1 | verify 0x31802a4 · 0x1604056f | high |
| `branchNotRouteSelect` | 0x31834e4 | — | 5 | verify 0x31834dc · 0x53f0f90b | medium |
| `branchNotRouteSelectCount` | 0x317c85c | — | 9 | verify 0x317c850 · 0xf3fd2b9a | medium |
| `branchQuestClear` | 0x317bdd0 | — | 3 | verify 0x317bdc4 · 0xe4895e3a | medium |
| `branchQuestNotClear` | 0x317bdd0 | — | 3 | verify 0x317bdc4 · 0x83820b5b | medium |
| `branchRouteSelect` | 0x31834e4 | — | 5 | verify 0x31834dc · 0x81e06266 | medium |
| `branchRouteSelectCount` | 0x317c85c | — | 9 | verify 0x317c850 · 0xb55797f5 | medium |
| `branchSetGrandSvtCount` | 0x317e20c | — | 5 | verify 0x317e200 · 0x3845f2b1 | medium |
| `cameraFilter` | 0x3181d38 | — | 3 | verify 0x3181d30 · 0xf491b448 | medium |
| `cameraHome` | 0x3188800 | pd[0]:float (Single.Parse) | 1 | verify 0x31887f8 · 0x5fd62b01 | high |
| `cameraMove` | 0x318683c | — | 3 | verify 0x3186834 · 0xaaf53cdb | medium |
| `cameraMoveEase` | 0x317a648 | — | 7 | verify 0x317a63c · 0x7df406a9 | medium |
| `cameraRoll` | 0x3188238 | pd[0]:float (Single.Parse), pd[2]:int (Int32.Parse), pd[4]:int (Int32.Parse) | 5 | verify 0x3188230 · 0x522663c1 | high |
| `cameraRollMove` | 0x317dddc | pd[0]:float (Single.Parse), pd[2]:float (Single.Parse) | 3 | verify 0x317ddd0 · 0x437f0700 | high |
| `capture` | 0x3181454 | — | — | verify 0x318144c · 0xfc9819c1 | medium |
| `captureRelease` | 0x31823a4 | — | — | verify 0x318239c · 0x7f05cc22 | medium |
| `charaAttack` | 0x3186270 | — | 5 | verify 0x3186268 · 0x3af68b60 | medium |
| `charaBackEffect` | 0x3181664 | — | 3 | verify 0x318165c · 0xc01f6afa | medium |
| `charaBackEffectDestroy` | 0x317b2e0 | pd[0]:int (ConvertCharaIndex) | 3 | verify 0x317b2d4 · 0xdb14b6f4 | high |
| `charaBackEffectPause` | 0x3181664 | — | 3 | verify 0x318165c · 0x5272f94c | medium |
| `charaBackEffectStart` | 0x3187fb4 | pd[0]:unknown (IsFastPlaySpeed), pd[0]:int (ConvertCharaIndex), pd[2]:string (ConvertTalkEffectName) | 3 | verify 0x3187fac · 0xf6a3c7e2 | high |
| `charaBackEffectStop` | 0x317e538 | pd[0]:bool (ModifyPlaySpeed), pd[0]:int (ConvertCharaIndex) | 3 | verify 0x317e52c · 0x6fe20be2 | high |
| `charaChange` | 0x317ec9c | pd[0]:unknown (IsLoad), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x317ec90 · 0xa003d4a4 | high |
| `charaClear` | 0x3182968 | pd[0]:unknown (Destroy), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x3182960 · 0xeb08b389 | high |
| `charaCrossFade` | 0x317aad0 | pd[0]:unknown (IsLoad), pd[0]:unknown (op_Equality), pd[0]:int (ConvertCharaIndex), pd[2]:unknown (GetCharaImageNameAndFormId), pd[2]:string (ConvertNameString), pd[6]:float (Single.Parse) | 7 | verify 0x317aac4 · 0xc3258eaa | high |
| `charaCutStop` | 0x31857a8 | pd[0]:unknown (StopCut), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x31857a0 · 0x485b96b4 | high |
| `charaCutin` | 0x31855fc | — | 5 | verify 0x31855f4 · 0x809ac7b3 | medium |
| `charaCutinPause` | 0x31855fc | — | 5 | verify 0x31855f4 · 0x54abe85b | medium |
| `charaCutinStart` | 0x317d9c8 | pd[0]:unknown (IsFastPlaySpeed), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x317d9bc · 0x2a64c021 | high |
| `charaCutout` | 0x317dc8c | — | 3 | verify 0x317dc80 · 0x595168a0 | medium |
| `charaDepth` | 0x3183120 | — | 3 | verify 0x3183118 · 0xd3b8c0a9 | medium |
| `charaEffect` | 0x3187a5c | pd[0]:int (ConvertCharaIndex), pd[2]:string (ConvertTalkEffectName) | 3 | verify 0x3187a54 · 0xfb0c36fd | high |
| `charaEffectDestroy` | 0x317f398 | pd[0]:int (ConvertCharaIndex) | 3 | verify 0x317f38c · 0x39ab340d | high |
| `charaEffectEdgeBlur` | 0x3188390 | pd[0]:int (ConvertCharaIndex) | 3 | verify 0x3188388 · 0xd115434d | high |
| `charaEffectEdgeBlurDestroy` | 0x31865b8 | pd[0]:unknown (StopEffect), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x31865b0 · 0x7489677d | high |
| `charaEffectEdgeBlurPause` | 0x3188390 | pd[0]:int (ConvertCharaIndex) | 3 | verify 0x3188388 · 0xe7ddf525 | high |
| `charaEffectEdgeBlurStart` | 0x317b730 | pd[0]:unknown (IsFastPlaySpeed), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x317b724 · 0xb129a77 | high |
| `charaEffectEdgeBlurStop` | 0x317eabc | pd[0]:bool (ModifyPlaySpeed), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x317eab0 · 0x82c040dd | high |
| `charaEffectPause` | 0x3187a5c | pd[0]:int (ConvertCharaIndex), pd[2]:string (ConvertTalkEffectName) | 3 | verify 0x3187a54 · 0xea99cd15 | high |
| `charaEffectStart` | 0x3188090 | pd[0]:unknown (IsFastPlaySpeed), pd[0]:int (ConvertCharaIndex), pd[2]:string (ConvertTalkEffectName) | 3 | verify 0x3188088 · 0xb718787 | high |
| `charaEffectStop` | 0x317a4d0 | pd[0]:bool (ModifyPlaySpeed), pd[0]:int (ConvertCharaIndex) | 3 | verify 0x317a4c4 · 0xb8f2092d | high |
| `charaFace` | 0x31847c0 | — | 3 | verify 0x31847b8 · 0x132e0105 | medium |
| `charaFaceFade` | 0x3183290 | — | 5 | verify 0x3183288 · 0x9f320873 | medium |
| `charaFaceIcon` | 0x3182e04 | — | 3 | verify 0x3182dfc · 0x7ab7e550 | medium |
| `charaFadeSpeed` | 0x3180e44 | — | 5 | verify 0x3180e3c · 0x9ea38ea5 | medium |
| `charaFadeTime` | 0x3188580 | pd[0]:unknown (IsNormalPlaySpeed), pd[0]:int (ConvertCharaIndex), pd[2]:float (Single.Parse), pd[4]:float (Single.Parse) | 5 | verify 0x3188578 · 0xf25efbf3 | high |
| `charaFadeTimeLoop` | 0x3182fa0 | pd[0]:unknown (op_Inequality) | 9 | verify 0x3182f98 · 0xf71d4141 | high |
| `charaFadeTimeLoopStop` | 0x31889d8 | pd[0]:unknown (StopMoveAlphaLoop), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x31889d0 · 0x47259261 | high |
| `charaFadein` | 0x3184fa4 | — | 3 | verify 0x3184f9c · 0x6dc520dd | medium |
| `charaFadeinFSL` | 0x3184fa4 | — | 3 | verify 0x3184f9c · 0x1e9814ae | medium |
| `charaFadeinFSLNotNotch` | 0x3184fa4 | — | 3 | verify 0x3184f9c · 0x9f05676f | medium |
| `charaFadeinFSR` | 0x3184fa4 | — | 3 | verify 0x3184f9c · 0x897f20c | medium |
| `charaFadeinFSRNotNotch` | 0x3184fa4 | — | 3 | verify 0x3184f9c · 0x300bbca1 | medium |
| `charaFadeinFSSideL` | 0x3184fa4 | — | 3 | verify 0x3184f9c · 0x36eaa31b | medium |
| `charaFadeinFSSideR` | 0x3184fa4 | — | 3 | verify 0x3184f9c · 0x24ea86c5 | medium |
| `charaFadeout` | 0x3187e50 | — | 3 | verify 0x3187e48 · 0x417a2be6 | medium |
| `charaFilter` | 0x3187830 | — | 3 | verify 0x3187828 · 0x29dffd16 | medium |
| `charaLayer` | 0x31829ec | pd[0]:int (ConvertCharaIndex) | 3 | verify 0x31829e4 · 0x1b882c21 | high |
| `charaMask` | 0x3183f88 | pd[0]:int (ConvertCharaIndex) | 3 | verify 0x3183f80 · 0x597c9aa4 | high |
| `charaMove` | 0x318505c | — | 5 | verify 0x3185054 · 0xf1c292c1 | medium |
| `charaMoveEase` | 0x3183e08 | — | 9 | verify 0x3183e00 · 0x4b3c4b6b | medium |
| `charaMoveEaseFSL` | 0x3183e08 | — | 9 | verify 0x3183e00 · 0x4da5580 | medium |
| `charaMoveEaseFSR` | 0x3183e08 | — | 9 | verify 0x3183e00 · 0x22da84ba | medium |
| `charaMoveEaseFSSideL` | 0x3183e08 | — | 9 | verify 0x3183e00 · 0x99aee291 | medium |
| `charaMoveEaseFSSideR` | 0x3183e08 | — | 9 | verify 0x3183e00 · 0xa3aef24f | medium |
| `charaMoveFSL` | 0x318505c | — | 5 | verify 0x3185054 · 0xa87bbea | medium |
| `charaMoveFSR` | 0x318505c | — | 5 | verify 0x3185054 · 0xc87bf10 | medium |
| `charaMoveFSSideL` | 0x318505c | — | 5 | verify 0x3185054 · 0x1819d1a7 | medium |
| `charaMoveFSSideR` | 0x318505c | — | 5 | verify 0x3185054 · 0xfe19a8b9 | medium |
| `charaMoveReturn` | 0x3184c98 | — | 5 | verify 0x3184c90 · 0x66e03dfb | medium |
| `charaMoveReturnEase` | 0x3181a58 | — | 7 | verify 0x3181a50 · 0x79a1cb89 | medium |
| `charaMoveReturnEaseFSL` | 0x3181a58 | — | 7 | verify 0x3181a50 · 0x831f0ab2 | medium |
| `charaMoveReturnEaseFSR` | 0x3181a58 | — | 7 | verify 0x3181a50 · 0x951f2708 | medium |
| `charaMoveReturnEaseFSSideL` | 0x3181a58 | — | 7 | verify 0x3181a50 · 0x4448155f | medium |
| `charaMoveReturnEaseFSSideR` | 0x3181a58 | — | 7 | verify 0x3181a50 · 0x5a483801 | medium |
| `charaMoveReturnFSL` | 0x3184c98 | — | 5 | verify 0x3184c90 · 0xcf6a60d0 | medium |
| `charaMoveReturnFSR` | 0x3184c98 | — | 5 | verify 0x3184c90 · 0xcd6a5daa | medium |
| `charaMoveReturnFSSideL` | 0x3184c98 | — | 5 | verify 0x3184c90 · 0xa92c5341 | medium |
| `charaMoveReturnFSSideR` | 0x3184c98 | — | 5 | verify 0x3184c90 · 0x932c309f | medium |
| `charaMoveScale` | 0x3182550 | — | 5 | verify 0x3182548 · 0x89e0af55 | medium |
| `charaMoveScaleEase` | 0x318228c | — | 7 | verify 0x3182284 · 0xb98ba0ef | medium |
| `charaPut` | 0x3186e80 | — | 3 | verify 0x3186e78 · 0x87ab67fd | medium |
| `charaPutFSL` | 0x3186e80 | — | 3 | verify 0x3186e78 · 0x5e4d168e | medium |
| `charaPutFSLNotNotch` | 0x3186e80 | — | 3 | verify 0x3186e78 · 0x45340d4f | medium |
| `charaPutFSR` | 0x3186e80 | — | 3 | verify 0x3186e78 · 0x484cf3ec | medium |
| `charaPutFSRNotNotch` | 0x3186e80 | — | 3 | verify 0x3186e78 · 0xa7254b01 | medium |
| `charaPutFSSideL` | 0x3186e80 | — | 3 | verify 0x3186e78 · 0xe90139bb | medium |
| `charaPutFSSideR` | 0x3186e80 | — | 3 | verify 0x3186e78 · 0xd7011d65 | medium |
| `charaRelativeLoopMove` | 0x3181190 | pd[0]:float (Single.Parse), pd[0]:int (Int32.Parse), pd[2]:int (Int32.Parse) | 3 | verify 0x3181188 · 0x47007bd7 | high |
| `charaRelativeLoopMoveEase` | 0x31871c4 | pd[0]:unknown (IsFastPlaySpeed), pd[0]:float (Single.Parse), pd[0]:int (Int32.Parse), pd[2]:int (Int32.Parse) | 3 | verify 0x31871bc · 0x8062c6d5 | high |
| `charaRelativeLoopMoveStop` | 0x3181f68 | pd[0]:unknown (StopMoveRelativePositionLoop), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x3181f60 · 0xf064676f | high |
| `charaRelativePut` | 0x31817d0 | — | 3 | verify 0x31817c8 · 0x26c26d0d | medium |
| `charaReturn` | 0x317a3ac | pd[0]:int (ConvertCharaIndex) | 3 | verify 0x317a3a0 · 0x446cbd2a | high |
| `charaRoll` | 0x31869d0 | pd[0]:unknown (.ctor), pd[0]:int (ConvertCharaIndex), pd[2]:int (Int32.Parse), pd[4]:int (Int32.Parse), pd[6]:int (Int32.Parse) | 7 | verify 0x31869c8 · 0x6b8e2ee7 | high |
| `charaRollAxis` | 0x3179868 | pd[0]:int (ConvertCharaIndex), pd[2]:float (Single.Parse), pd[4]:float (Single.Parse), pd[6]:float (Single.Parse) | 9 | verify 0x317985c · 0x3a4433d2 | high |
| `charaRollAxisLoopStop` | 0x3185968 | pd[0]:unknown (IsFastPlaySpeed), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x3185960 · 0xa29f5c88 | high |
| `charaRollMove` | 0x317f4ec | — | 3 | verify 0x317f4e0 · 0x723053de | medium |
| `charaRollMoveEx` | 0x31836ac | — | 3 | verify 0x31836a4 · 0xfee0e57b | medium |
| `charaScale` | 0x31815a4 | — | 3 | verify 0x318159c · 0x4982840e | medium |
| `charaSet` | 0x3186fe0 | — | 3 | verify 0x3186fd8 · 0xb9704d5c | medium |
| `charaShadow` | 0x317e6dc | — | 3 | verify 0x317e6d0 · 0x9fd86770 | medium |
| `charaShake` | 0x31859e8 | — | 9 | verify 0x31859e0 · 0x65c88cca | medium |
| `charaShakeStop` | 0x3184e68 | pd[0]:unknown (ShakeStop), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x3184e60 · 0x3486b6d2 | high |
| `charaSpecialEffect` | 0x3184b84 | — | 3 | verify 0x3184b7c · 0x4f3fe4c2 | medium |
| `charaSpecialEffectPause` | 0x3184b84 | — | 3 | verify 0x3184b7c · 0x8b071724 | medium |
| `charaSpecialEffectStart` | 0x3186754 | pd[0]:int (ConvertCharaIndex), pd[2]:string (ConvertNameString) | 3 | verify 0x318674c · 0xccfb6cfa | high |
| `charaSpecialEffectStop` | 0x318198c | pd[0]:int (ConvertCharaIndex) | 3 | verify 0x3181984 · 0x119470da | high |
| `charaTalk` | 0x3184a00 | — | — | verify 0x31849f8 · 0x78e89632 | medium |
| `clear` | 0x3182038 | — | — | verify 0x3182030 · 0x5c6e1222 | medium |
| `communicationChara` | 0x317ef18 | pd[0]:int (Int32.Parse) | 3 | verify 0x317ef0c · 0xe685d03e | high |
| `communicationCharaClear` | 0x318670c | — | — | verify 0x3186704 · 0x4d505e0f | medium |
| `communicationCharaFace` | 0x317d044 | pd[0]:int (Int32.Parse) | 1 | verify 0x317d038 · 0x6d7b8a87 | high |
| `communicationCharaLoop` | 0x317ef18 | pd[0]:int (Int32.Parse) | 3 | verify 0x317ef0c · 0xdc96d1c4 | high |
| `communicationCharaStop` | 0x3181d7c | — | — | verify 0x3181d74 · 0xa10d876 | medium |
| `criMovie` | 0x3183c38 | — | — | verify 0x3183c30 · 0x1dcc0581 | medium |
| `cueSe` | 0x3186434 | pd[0]:string (ConvertNameString), pd[2]:string (ConvertNameString), pd[4]:float (Single.Parse) | 7 | verify 0x318642c · 0xb129b224 | high |
| `cueSeContinue` | 0x317ffa4 | pd[2]:string (ConvertNameString), pd[4]:float (Single.Parse), pd[6]:int (Int32.Parse) | 9 | verify 0x317ff98 · 0x4b340125 | high |
| `cueSeContinueStop` | 0x31838c8 | pd[0]:unknown (op_Equality) | 3 | verify 0x31838c0 · 0x2b516325 | high |
| `cueSeContinueVolume` | 0x3188898 | pd[2]:float (Single.Parse), pd[4]:float (Single.Parse), pd[6]:int (Int32.Parse) | 7 | verify 0x3188890 · 0xe4cc08cf | high |
| `cueSeStop` | 0x3188bb0 | pd[0]:float (Single.Parse), pd[2]:float (Single.Parse) | 3 | verify 0x3188ba8 · 0x81709bec | high |
| `cueSeVolume` | 0x318440c | — | 5 | verify 0x3184404 · 0x4a9cd496 | medium |
| `cueVoice` | 0x317cef8 | — | 3 | verify 0x317ceec · 0x316fbd5a | medium |
| `cueVoiceStop` | 0x3179ed0 | — | — | verify 0x3179ec4 · 0x6b2bbb82 | medium |
| `cueVoiceVolume` | 0x317b954 | — | 5 | verify 0x317b948 · 0xd1009d6c | medium |
| `delay` | 0x3182768 | pd[0]:int (Int32.Parse), pd[2]:float (Single.Parse), pd[4]:int (Int32.Parse) | 5 | verify 0x3182760 · 0x4ed1f1d8 | high |
| `delayEnd` | 0x3182018 | — | — | verify 0x3182010 · 0xacd4411d | medium |
| `delayStop` | 0x31886a0 | pd[0]:int (Int32.Parse), pd[2]:int (Int32.Parse) | 3 | verify 0x3188698 · 0x20c8df00 | high |
| `delayStopAll` | 0x317fcbc | — | — | verify 0x317fcb0 · 0x7d286a53 | medium |
| `distortionloop` | 0x317f1e0 | pd[2]:int (Int32.Parse), pd[4]:float (Single.Parse), pd[6]:float (Single.Parse), pd[8]:float (Single.Parse), pd[10]:float (Single.Parse), pd[12]:float (Single.Parse) | 9 | verify 0x317f1d4 · 0x52ded3b8 | high |
| `distortionstart` | 0x317b128 | pd[2]:float (Single.Parse), pd[4]:float (Single.Parse), pd[6]:float (Single.Parse), pd[8]:float (Single.Parse), pd[10]:float (Single.Parse) | 9 | verify 0x317b11c · 0x569b71d2 | high |
| `distortionstop` | 0x317b7ec | pd[0]:float (Single.Parse) | 1 | verify 0x317b7e0 · 0x9239b092 | high |
| `effect` | 0x3180b70 | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x3180b64 · 0x6e6e8d54 | high |
| `effectDestroy` | 0x3184278 | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x3184270 · 0xf8310406 | high |
| `effectForceStop` | 0x3184508 | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x3184500 · 0xc0c274bf | high |
| `effectPause` | 0x3180b70 | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x3180b64 · 0xb7e2027e | high |
| `effectStart` | 0x317cca8 | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x317cc9c · 0x8e961ad8 | high |
| `effectStop` | 0x31821f8 | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x31821f0 · 0x45bba27c | high |
| `effectmessageDestroy` | 0x3181ce4 | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x3181cdc · 0x7662206b | high |
| `effectmessageStop` | 0x31814c4 | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x31814bc · 0x2c09cdb | high |
| `else` | 0x317c0dc | — | — | verify 0x317c0d0 · 0xbdbf5bf0 | medium |
| `enableFullScreen` | 0x3182018 | — | — | verify 0x3182010 · 0x9c236c7b | medium |
| `enableWaitLoadAssetWhenResume` | 0x3182018 | — | — | verify 0x3182010 · 0x633964ee | medium |
| `end` | 0x317f9c4 | — | — | verify 0x317f9b8 · 0x6a8e75aa | medium |
| `endFade` | 0x31843b4 | — | 1 | verify 0x31843ac · 0x867da2ec | medium |
| `endIf` | 0x317dbf4 | — | — | verify 0x317dbe8 · 0x1c625f2d | medium |
| `equipChange` | 0x31884b4 | pd[0]:unknown (IsLoad), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x31884ac · 0x8a3e0dd7 | high |
| `equipSet` | 0x3186fe0 | — | 3 | verify 0x3186fd8 · 0x25a4ee11 | medium |
| `f` | 0x3187928 | — | — | verify 0x3187920 · 0xe30c2799 | medium |
| `faceTalkScreen` | 0x317cd60 | — | — | verify 0x317cd54 · 0xce912426 | medium |
| `fadeMove` | 0x3181ef0 | — | — | verify 0x3181ee8 · 0xab024cba | medium |
| `fadeOff` | 0x3184b58 | — | — | verify 0x3184b50 · 0x8ef601f0 | medium |
| `fadein` | 0x3180b14 | — | — | verify 0x3180b08 · 0xae01fb20 | medium |
| `fadeout` | 0x3180b14 | — | — | verify 0x3180b08 · 0x20407665 | medium |
| `figureChange` | 0x317ec9c | pd[0]:unknown (IsLoad), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x317ec90 · 0xd558a289 | high |
| `figureSet` | 0x3186fe0 | — | 3 | verify 0x3186fd8 · 0x6032d17f | medium |
| `flag` | 0x3188a44 | pd[0]:unknown (SearchFlag), pd[2]:unknown (Set) | 3 | verify 0x3188a3c · 0xbdeaa8d7 | high |
| `flagRandom` | 0x3184ed4 | — | 5 | verify 0x3184ecc · 0xacf5d138 | medium |
| `flashOff` | 0x317d868 | — | — | verify 0x317d85c · 0x4cff8f0e | medium |
| `flashOffDep` | 0x317c600 | — | — | verify 0x317c5f4 · 0xa5971263 | medium |
| `flashin` | 0x317df1c | — | — | verify 0x317df10 · 0x7ae472ea | medium |
| `flashinDep` | 0x3187f10 | — | — | verify 0x3187f08 · 0xb6903d97 | medium |
| `flashout` | 0x31809bc | pd[0]:float (Single.Parse) | 1 | verify 0x31809b0 · 0x8f69a0a3 | high |
| `flashoutDep` | 0x3185ef0 | pd[0]:float (Single.Parse) | 1 | verify 0x3185ee8 · 0x53407890 | high |
| `font` | 0x3187928 | — | — | verify 0x3187920 · 0x274e1290 | medium |
| `fontSize` | 0x3187928 | — | — | verify 0x3187920 · 0xa8f18501 | medium |
| `fontType` | 0x31795f8 | — | — | verify 0x31795ec · 0x949487b8 | medium |
| `fowardEffect` | 0x318087c | pd[0]:string (ConvertTalkEffectName), pd[2]:int (Int32.Parse) | 5 | verify 0x3180870 · 0xae20810d | high |
| `fowardEffectDestroy` | 0x317db6c | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x317db60 · 0xeb4e703d | high |
| `fowardEffectPause` | 0x318087c | pd[0]:string (ConvertTalkEffectName), pd[2]:int (Int32.Parse) | 5 | verify 0x3180870 · 0x79355ce5 | high |
| `fowardEffectStart` | 0x318140c | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x3181404 · 0x80a47737 | high |
| `fowardEffectStop` | 0x318496c | pd[0]:string (ConvertTalkEffectName) | 1 | verify 0x3184964 · 0xb5b3e89d | high |
| `fsmObjDestroy` | 0x317aba0 | pd[0]:unknown (Destroy), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x317ab94 · 0x284081d0 | high |
| `fsmObjLayer` | 0x317f638 | — | 3 | verify 0x317f62c · 0x8afb97c3 | medium |
| `fsmObjSendEvent` | 0x3185e08 | — | 3 | verify 0x3185e00 · 0x73600b4c | medium |
| `fsmObjSet` | 0x317c248 | — | 5 | verify 0x317c23c · 0x8643a3f6 | medium |
| `fsmObjSetBool` | 0x3182adc | — | 5 | verify 0x3182ad4 · 0x996d981a | medium |
| `fsmObjSetFloat` | 0x3182adc | — | 5 | verify 0x3182ad4 · 0x25392b7c | medium |
| `fsmObjSetState` | 0x3185e08 | — | 3 | verify 0x3185e00 · 0x94ce0aeb | medium |
| `fsmObjSetString` | 0x3182adc | — | 5 | verify 0x3182ad4 · 0xbf98a387 | medium |
| `horizontalImageChange` | 0x31884b4 | pd[0]:unknown (IsLoad), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x31884ac · 0xae26297a | high |
| `horizontalImageSet` | 0x3186fe0 | — | 3 | verify 0x3186fd8 · 0xfad91c16 | medium |
| `ifClear` | 0x3179400 | — | 1 | verify 0x31793f4 · 0xa03fd777 | medium |
| `imageChange` | 0x31884b4 | pd[0]:unknown (IsLoad), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x31884ac · 0xff9b04ee | high |
| `imageSet` | 0x3186fe0 | — | 3 | verify 0x3186fd8 · 0x5c1b8bfa | medium |
| `input` | 0x317a800 | — | 1 | verify 0x317a7f4 · 0xf9d86f7b | medium |
| `insertionAnimationEnd` | 0x317f818 | — | — | verify 0x317f80c · 0xc8e1b9f1 | medium |
| `insertionAnimationSet` | 0x318816c | — | — | verify 0x3188164 · 0x931e8db4 | medium |
| `insertionAnimationSetFSL` | 0x318816c | — | — | verify 0x3188164 · 0xc7d76289 | medium |
| `insertionAnimationSetFSR` | 0x318816c | — | — | verify 0x3188164 · 0xc1d75917 | medium |
| `insertionAnimationSetFSSideL` | 0x318816c | — | — | verify 0x3188164 · 0x8b8a5a58 | medium |
| `insertionAnimationSetFSSideR` | 0x318816c | — | — | verify 0x3188164 · 0x998a7062 | medium |
| `insertionAnimationStart` | 0x3180d0c | — | — | verify 0x3180d04 · 0xf20ffe70 | medium |
| `interruption` | 0x317f9c4 | — | — | verify 0x317f9b8 · 0x884d2996 | medium |
| `jingle` | 0x3186b70 | — | 1 | verify 0x3186b68 · 0xef3a9228 | medium |
| `jingleStop` | 0x31846c0 | — | — | verify 0x31846b8 · 0x667b7330 | medium |
| `jump` | 0x31801a4 | pd[0]:string (ConvertNameString) | 3 | verify 0x3180198 · 0xa73f5c0d | high |
| `k` | 0x317fa28 | — | — | verify 0x317fa1c · 0xee0c38ea | medium |
| `keepSubBgmOff` | 0x31797d0 | — | — | verify 0x31797c4 · 0xd74cae15 | medium |
| `keepSubBgmOn` | 0x3181fd4 | — | — | verify 0x3181fcc · 0x1f76ee39 | medium |
| `l` | 0x318472c | — | — | verify 0x3184724 · 0xe90c310b | medium |
| `label` | 0x317b600 | — | 1 | verify 0x317b5f4 · 0xf69717fd | medium |
| `maskOff` | 0x3183208 | — | — | verify 0x3183200 · 0xf324464e | medium |
| `maskin` | 0x3188484 | — | — | verify 0x318847c · 0xbecdfa2a | medium |
| `maskout` | 0x3188484 | — | — | verify 0x318847c · 0x358feae3 | medium |
| `masterBranch` | 0x3179bb8 | — | 3 | verify 0x3179bac · 0xcb78578b | medium |
| `masterChange` | 0x3187c1c | pd[0]:unknown (IsLoad), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x3187c14 · 0x987dcf37 | high |
| `masterHorizontalImageChange` | 0x317fe24 | pd[0]:unknown (IsLoad), pd[0]:int (ConvertCharaIndex) | 9 | verify 0x317fe18 · 0x934e55d8 | high |
| `masterHorizontalImageSet` | 0x3188708 | — | 5 | verify 0x3188700 · 0x43e4c390 | medium |
| `masterImageChange` | 0x317fe24 | pd[0]:unknown (IsLoad), pd[0]:int (ConvertCharaIndex) | 9 | verify 0x317fe18 · 0x3fc15a0 | high |
| `masterImageSet` | 0x3188708 | — | 5 | verify 0x3188700 · 0x9f0b35e8 | medium |
| `masterNameWidth` | 0x3185be0 | — | 7 | verify 0x3185bd8 · 0x110334b4 | medium |
| `masterScene` | 0x3180a34 | — | — | verify 0x3180a28 · 0x4fe73b71 | medium |
| `masterSet` | 0x3188708 | — | 5 | verify 0x3188700 · 0x6ef359f1 | medium |
| `masterVerticalImageChange` | 0x317fe24 | pd[0]:unknown (IsLoad), pd[0]:int (ConvertCharaIndex) | 9 | verify 0x317fe18 · 0xe6ad339e | high |
| `masterVerticalImageSet` | 0x3188708 | — | 5 | verify 0x3188700 · 0x6436880a | medium |
| `menu` | 0x317fa74 | — | — | verify 0x317fa68 · 0x99e4dd3a | medium |
| `messageAlign` | 0x3186e48 | — | — | verify 0x3186e40 · 0xe055dfd1 | medium |
| `messageChange` | 0x31852b8 | pd[0]:unknown (ConvertMessageWindowName) | 1 | verify 0x31852b0 · 0x9e17a594 | high |
| `messageOff` | 0x318152c | — | — | verify 0x3181524 · 0x84f7ac69 | medium |
| `messageOn` | 0x317bc58 | — | — | verify 0x317bc4c · 0x20bd548d | medium |
| `messageShake` | 0x3182074 | — | 7 | verify 0x318206c · 0xe127297a | medium |
| `messageShakeStop` | 0x317e89c | — | — | verify 0x317e890 · 0x47473262 | medium |
| `messageSpeedForcedNormal` | 0x3184204 | — | 1 | verify 0x31841fc · 0xb86e2e29 | medium |
| `messageStart` | 0x317f98c | — | — | verify 0x317f980 · 0xa9fb9b48 | medium |
| `movie` | 0x3183c38 | — | — | verify 0x3183c30 · 0xaef39ccf | medium |
| `notification` | 0x317af78 | — | 3 | verify 0x317af6c · 0xea3d3046 | medium |
| `overlayFadein` | 0x3184300 | — | 3 | verify 0x31842f8 · 0x2f80406 | medium |
| `page` | 0x3182038 | — | — | verify 0x317c144 · 0x815dfa76 | medium |
| `pictureFrame` | 0x317e838 | — | — | verify 0x317e82c · 0xe5d2343a | medium |
| `pictureFrameTop` | 0x317e838 | — | — | verify 0x317e82c · 0x6055ad3d | medium |
| `q` | 0x318662c | — | — | verify 0x3186624 · 0xf40c425c | medium |
| `questMessageOverwrite` | 0x317d710 | — | — | verify 0x317d704 · 0x698d999 | medium |
| `revivalBranch` | 0x31853a4 | — | 3 | verify 0x318539c · 0x5d81bb60 | medium |
| `rewardSwitch` | 0x318522c | — | — | verify 0x3185224 · 0x20460882 | medium |
| `s` | 0x3184a58 | — | — | verify 0x3184a50 · 0xf60c4582 | medium |
| `scene` | 0x3180e14 | — | — | verify 0x3180e0c · 0x2063cb13 | medium |
| `sceneSet` | 0x3186fe0 | — | 3 | verify 0x3186fd8 · 0x69977591 | medium |
| `screen` | 0x31804c8 | — | 9 | verify 0x31804bc · 0x55c54c11 | medium |
| `scrollStop` | 0x317f1a0 | — | — | verify 0x317f194 · 0x93d86544 | medium |
| `se` | 0x3180760 | pd[0]:string (ConvertNameString), pd[2]:float (Single.Parse) | 5 | verify 0x3180754 · 0x3c520aa5 | high |
| `seContinue` | 0x3180310 | pd[0]:string (ConvertNameString), pd[2]:float (Single.Parse), pd[4]:int (Int32.Parse) | 7 | verify 0x3180304 · 0x973b8604 | high |
| `seContinueStop` | 0x31838c8 | pd[0]:unknown (op_Equality) | 3 | verify 0x31838c0 · 0x1e72650c | high |
| `seContinueVolume` | 0x3188898 | pd[2]:float (Single.Parse), pd[4]:float (Single.Parse), pd[6]:int (Int32.Parse) | 7 | verify 0x3188890 · 0x96db45b6 | high |
| `seLoop` | 0x31833e0 | pd[0]:string (ConvertNameString), pd[2]:float (Single.Parse) | 5 | verify 0x31833d8 · 0x47410f2b | high |
| `seStop` | 0x3180a80 | pd[0]:float (Single.Parse), pd[2]:float (Single.Parse) | 3 | verify 0x3180a74 · 0x34a684a5 | high |
| `seVolume` | 0x3181dd0 | — | 5 | verify 0x3181dc8 · 0x8dadc64f | medium |
| `selectionCentering` | 0x317f90c | — | 1 | verify 0x317f900 · 0x2b7bb164 | medium |
| `selectionUse` | 0x317d28c | — | — | verify 0x317d280 · 0x9dedcfc4 | medium |
| `shake` | 0x318548c | pd[0]:float (Single.Parse), pd[2]:float (Single.Parse), pd[4]:float (Single.Parse), pd[6]:float (Single.Parse) | 7 | verify 0x3185484 · 0xbd8bb2f5 | high |
| `shakeStop` | 0x317e0d8 | — | — | verify 0x317e0cc · 0xdeb8bd5 | medium |
| `skip` | 0x317b3f4 | — | 1 | verify 0x317b3e8 · 0x416b7bc2 | medium |
| `soundStopAll` | 0x3188554 | — | — | verify 0x318854c · 0x6ee5b7e7 | medium |
| `soundStopAllEnd` | 0x3187494 | — | — | verify 0x318748c · 0x5322754 | medium |
| `soundStopAllFade` | 0x3181c98 | pd[0]:float (Single.Parse) | 1 | verify 0x3181c90 · 0xb45ad829 | high |
| `specialEffect` | 0x3187604 | pd[0]:string (ConvertNameString), pd[2]:int (Int32.Parse), pd[4]:int (Int32.Parse), pd[6]:float (Single.Parse) | 9 | verify 0x31875fc · 0x9b439b01 | high |
| `specialEffectPuase` | 0x3187604 | pd[0]:string (ConvertNameString), pd[2]:int (Int32.Parse), pd[4]:int (Int32.Parse), pd[6]:float (Single.Parse) | 9 | verify 0x31875fc · 0xc622e861 | high |
| `specialEffectStart` | 0x318290c | pd[0]:string (ConvertNameString) | 1 | verify 0x3182904 · 0x6982d753 | high |
| `specialEffectStop` | 0x317c6d8 | pd[0]:string (ConvertNameString) | 1 | verify 0x317c6cc · 0x13048b21 | high |
| `speed` | 0x3184a58 | — | — | verify 0x3184a50 · 0x7b80c780 | medium |
| `spriteMaskOff` | 0x3187440 | — | — | verify 0x3187438 · 0xfa7137f1 | medium |
| `spriteMaskSet` | 0x3179ff0 | — | — | verify 0x3179fe4 · 0xeef1b964 | medium |
| `stretchOff` | 0x3181c60 | — | — | verify 0x3181c58 · 0xd8d0d187 | medium |
| `stretchin` | 0x3187cbc | — | — | verify 0x3187cb4 · 0x57067d35 | medium |
| `stretchout` | 0x3187cbc | — | — | verify 0x3187cb4 · 0x2db0e81e | medium |
| `subBgm` | 0x31824fc | pd[2]:float (Single.Parse) | 3 | verify 0x31824f4 · 0x5372061 | high |
| `subBgmStop` | 0x3181900 | — | — | verify 0x31818f8 · 0x6617ac41 | medium |
| `subBlur` | 0x3180674 | pd[0]:unknown (GetScriptSubLayer) | 6 | verify 0x3180668 · 0x50e9c348 | high |
| `subBlur2` | 0x3180674 | pd[0]:unknown (GetScriptSubLayer) | 6 | verify 0x3180668 · 0xd9feb90e | high |
| `subBlur2Off` | 0x3183a9c | pd[0]:unknown (GetScriptSubLayer), pd[4]:float (Single.Parse) | 7 | verify 0x3183a94 · 0x4d43c02b | high |
| `subBlurOff` | 0x3183a9c | pd[0]:unknown (GetScriptSubLayer), pd[4]:float (Single.Parse) | 7 | verify 0x3183a94 · 0xed0cd1ad | high |
| `subCameraFilter` | 0x3183234 | — | — | verify 0x318322c · 0x21501858 | medium |
| `subCameraHome` | 0x317dac0 | pd[0]:unknown (GetScriptSubLayer) | 3 | verify 0x317dab4 · 0x6983f751 | high |
| `subCameraMove` | 0x3182c6c | — | 5 | verify 0x3182c64 · 0xb6cf534b | medium |
| `subCameraMoveEase` | 0x3185430 | — | — | verify 0x3185428 · 0x46f3ff79 | medium |
| `subCameraOff` | 0x3179750 | — | — | verify 0x3179744 · 0x533834db | medium |
| `subCameraOn` | 0x318339c | pd[0]:int (Int32.Parse) | 1 | verify 0x3183394 · 0xe5863997 | high |
| `subCameraRoll` | 0x317a2e0 | pd[0]:unknown (GetScriptSubLayer) | 3 | verify 0x317a2d4 · 0xde7ae531 | high |
| `subCameraRollMove` | 0x3179e0c | pd[0]:unknown (GetScriptSubLayer) | 3 | verify 0x3179e00 · 0xa9ffd8d0 | high |
| `subRenderDepth` | 0x3182c14 | pd[0]:float (Single.Parse), pd[2]:float (Single.Parse) | 3 | verify 0x3182c0c · 0x41c90422 | high |
| `subRenderFadein` | 0x3185f64 | — | — | verify 0x3185f5c · 0xd7b31398 | medium |
| `subRenderFadeinFSL` | 0x3185f64 | — | — | verify 0x3185f5c · 0x3b06af45 | medium |
| `subRenderFadeinFSR` | 0x3185f64 | — | — | verify 0x3185f5c · 0x4d06cb9b | medium |
| `subRenderFadeinFSSideL` | 0x3185f64 | — | — | verify 0x3185f5c · 0xf664b234 | medium |
| `subRenderFadeinFSSideR` | 0x3185f64 | — | — | verify 0x3185f5c · 0xdc648946 | medium |
| `subRenderFadeout` | 0x317d310 | — | — | verify 0x317d304 · 0x5caba61d | medium |
| `subRenderMove` | 0x3180f80 | — | — | verify 0x3180f78 · 0x6ec06cec | medium |
| `subRenderMoveEase` | 0x3186c5c | — | — | verify 0x3186c54 · 0x1eb3aeb6 | medium |
| `subRenderMoveEaseFSL` | 0x3186c5c | — | — | verify 0x3186c54 · 0xbad79d2f | medium |
| `subRenderMoveEaseFSR` | 0x3186c5c | — | — | verify 0x3186c54 · 0xb0d78d71 | medium |
| `subRenderMoveEaseFSSideL` | 0x3186c5c | — | — | verify 0x3186c54 · 0x8427f51a | medium |
| `subRenderMoveEaseFSSideR` | 0x3186c5c | — | — | verify 0x3186c54 · 0x6627c5e0 | medium |
| `subRenderMoveFSL` | 0x3180f80 | — | — | verify 0x3180f78 · 0x98b9821 | medium |
| `subRenderMoveFSR` | 0x3180f80 | — | — | verify 0x3180f78 · 0xf38b757f | medium |
| `subRenderMoveFSSideL` | 0x3180f80 | — | — | verify 0x3180f78 · 0xe4344080 | medium |
| `subRenderMoveFSSideR` | 0x3180f80 | — | — | verify 0x3180f78 · 0x2346fba | medium |
| `subRenderMoveScale` | 0x317c508 | — | — | verify 0x317c4fc · 0xc085a4a6 | medium |
| `subRenderMoveScaleEase` | 0x317f7b4 | — | — | verify 0x317f7a8 · 0x4d38e8ac | medium |
| `subRenderScale` | 0x317cad8 | — | — | verify 0x317cacc · 0x787d9c49 | medium |
| `subRenderShake` | 0x3179c9c | pd[0]:unknown (GetScriptSubLayer), pd[2]:float (Single.Parse), pd[4]:int (Int32.Parse), pd[6]:int (Int32.Parse), pd[8]:float (Single.Parse) | 9 | verify 0x3179c90 · 0x2be7961d | high |
| `subRenderShakeStop` | 0x317fc00 | — | — | verify 0x317fbf4 · 0xddd7948d | medium |
| `subStretch` | 0x3187f58 | — | 1 | verify 0x3187f50 · 0x7a7833ba | medium |
| `subStretchin` | 0x317d3a4 | pd[0]:unknown (GetScriptSubLayer), pd[4]:float (Single.Parse) | 5 | verify 0x317d398 · 0x5ba5fec5 | high |
| `subStretchout` | 0x317d3a4 | pd[0]:unknown (GetScriptSubLayer), pd[4]:float (Single.Parse) | 5 | verify 0x317d398 · 0xe29ef44e | high |
| `switchCase` | 0x31875c4 | — | — | verify 0x31875bc · 0x4b951a35 | medium |
| `switchCaseEnd` | 0x3188c58 | — | — | verify 0x3188c50 · 0xfe9f10da | medium |
| `tVoice` | 0x317cc08 | pd[0]:string (ConvertNameString), pd[4]:float (Single.Parse) | 7 | verify 0x317cbfc · 0xa71eb67 | high |
| `tVoiceUser` | 0x317ae9c | pd[0]:string (ConvertNameString), pd[8]:float (Single.Parse) | 9 | verify 0x317ae90 · 0x67709e34 | high |
| `talkEnd` | 0x3180268 | — | — | verify 0x318025c · 0xe9c1d77c | medium |
| `talkName` | 0x3187bf0 | — | — | verify 0x3187be8 · 0x1aff046c | medium |
| `talkNameBack` | 0x3184900 | — | 1 | verify 0x31848f8 · 0xd9f57ae7 | medium |
| `talkStart` | 0x3182bc4 | — | — | verify 0x3182bbc · 0x581cc885 | medium |
| `tapSkip` | 0x317bba0 | pd[2]:unknown (op_Equality) | 5 | verify 0x317bb94 · 0xf2239de9 | high |
| `tdelay` | 0x3182768 | pd[0]:int (Int32.Parse), pd[2]:float (Single.Parse), pd[4]:int (Int32.Parse) | 5 | verify 0x3182760 · 0x2a4286d2 | high |
| `turnPageOff` | 0x3182720 | — | — | verify 0x3182718 · 0xc6b33946 | medium |
| `turnPageOn` | 0x317d4e8 | — | 1 | verify 0x317d4dc · 0x4662386c | medium |
| `useSimpleMeshFigure` | 0x317ba14 | — | — | verify 0x317ba08 · 0x355910af | medium |
| `verticalImageChange` | 0x31884b4 | pd[0]:unknown (IsLoad), pd[0]:int (ConvertCharaIndex) | 1 | verify 0x31884ac · 0xe82687d8 | high |
| `verticalImageSet` | 0x3186fe0 | — | 3 | verify 0x3186fd8 · 0x29c1990 | medium |
| `voice` | 0x317d5b0 | — | 1 | verify 0x317d5a4 · 0x7f9bc9f9 | medium |
| `voiceStop` | 0x317d8c8 | — | — | verify 0x317d8bc · 0xc73f3ba9 | medium |
| `voiceVolume` | 0x317e3ec | — | 5 | verify 0x317e3e0 · 0xaf859093 | medium |
| `wait` | 0x31874f4 | — | 1 | verify 0x31874ec · 0x892e4ca0 | medium |
| `warBoardTalkScreen` | 0x317cd60 | — | — | verify 0x317cd54 · 0x9537e6ad | medium |
| `warCharaFadein` | 0x317ac68 | — | — | verify 0x317ac5c · 0xa890df7d | medium |
| `warEffectOff` | 0x317fc60 | pd[0]:unknown (get_Instance) | 1 | verify 0x317fc54 · 0xb8c3be19 | high |
| `warEffectPiece` | 0x317fd14 | pd[0]:unknown (0x2230564), pd[2]:unknown (0x2230564), pd[4]:int (Int32.Parse), pd[6]:int (Int32.Parse), pd[8]:int (Int32.Parse) | 9 | verify 0x317fd08 · 0xf9a697b6 | high |
| `warEffectPos` | 0x3186664 | pd[0]:float (Single.Parse), pd[2]:float (Single.Parse), pd[4]:float (Single.Parse), pd[6]:float (Single.Parse) | 7 | verify 0x318665c · 0x9a791fe | high |
| `warEffectSquare` | 0x317f470 | pd[0]:int (Int32.Parse), pd[2]:int (Int32.Parse), pd[4]:int (Int32.Parse) | 5 | verify 0x317f464 · 0xb0bcd6d3 | high |
| `warEventScript` | 0x317a1bc | pd[0]:int (Int32.Parse) | 1 | verify 0x317a1b0 · 0x99feb508 | high |
| `warMoveCameraPiece` | 0x3187cec | pd[2]:float (Single.Parse), pd[4]:float (Single.Parse), pd[6]:unknown (0x2230564), pd[8]:int (Int32.Parse), pd[10]:int (Int32.Parse), pd[12]:int (Int32.Parse) | 9 | verify 0x3187ce4 · 0xdb22bb53 | high |
| `warMoveCameraPos` | 0x317df90 | pd[2]:float (Single.Parse), pd[4]:float (Single.Parse), pd[6]:float (Single.Parse), pd[8]:float (Single.Parse), pd[10]:float (Single.Parse) | 7 | verify 0x317df84 · 0xf73ba0e3 | high |
| `warMoveCameraSquare` | 0x3183030 | pd[0]:int (Int32.Parse), pd[2]:float (Single.Parse), pd[4]:float (Single.Parse), pd[6]:int (Int32.Parse), pd[8]:int (Int32.Parse) | 9 | verify 0x3183028 · 0x525668fc | high |
| `wipeFilter` | 0x3185814 | pd[0]:string (ConvertWipeName), pd[2]:float (Single.Parse), pd[4]:float (Single.Parse) | 5 | verify 0x318580c · 0xc0189da0 | high |
| `wipeFilterEx` | 0x317bee0 | — | — | verify 0x317bed4 · 0x47212805 | medium |
| `wipeOff` | 0x3184940 | — | — | verify 0x3184938 · 0x3bdaedc3 | medium |
| `wipein` | 0x317e910 | pd[0]:string (ConvertWipeName), pd[2]:float (Single.Parse), pd[4]:float (Single.Parse) | 5 | verify 0x317e904 · 0xbee8a3a9 | high |
| `wipeinEx` | 0x318402c | — | — | verify 0x3184024 · 0xf36270b4 | medium |
| `wipeout` | 0x317e910 | pd[0]:string (ConvertWipeName), pd[2]:float (Single.Parse), pd[4]:float (Single.Parse) | 5 | verify 0x317e904 · 0xd97b372a | high |
| `wipeoutEx` | 0x318402c | — | — | verify 0x3184024 · 0xdcd2af1f | medium |

### 2.1 共用 body（别名 / case 合并）

同一 body 被多个 tag 共用，通常是 C# `case "a": case "b": <body>` 或按 tag 再分流：

- `0x317bdd0`: `branchQuestClear`, `branchQuestNotClear`
- `0x317c3c0`: `backEffect`, `backEffectPause`
- `0x317c85c`: `branchNotRouteSelectCount`, `branchRouteSelectCount`
- `0x317cd60`: `faceTalkScreen`, `warBoardTalkScreen`
- `0x317d3a4`: `subStretchin`, `subStretchout`
- `0x317e838`: `pictureFrame`, `pictureFrameTop`
- `0x317e910`: `wipein`, `wipeout`
- `0x317ec9c`: `charaChange`, `figureChange`
- `0x317ef18`: `communicationChara`, `communicationCharaLoop`
- `0x317f9c4`: `end`, `interruption`
- `0x317fe24`: `masterHorizontalImageChange`, `masterImageChange`, `masterVerticalImageChange`
- `0x31802b0`: `branchMaterial`, `branchNotMaterial`
- `0x3180674`: `subBlur`, `subBlur2`
- `0x318087c`: `fowardEffect`, `fowardEffectPause`
- `0x3180b14`: `fadein`, `fadeout`
- `0x3180b70`: `effect`, `effectPause`
- `0x3180f80`: `subRenderMove`, `subRenderMoveFSL`, `subRenderMoveFSR`, `subRenderMoveFSSideL`, `subRenderMoveFSSideR`
- `0x3181664`: `charaBackEffect`, `charaBackEffectPause`
- `0x3181900`: `bgmStop`, `bgmStopEnd`, `subBgmStop`
- `0x3181a58`: `charaMoveReturnEase`, `charaMoveReturnEaseFSL`, `charaMoveReturnEaseFSR`, `charaMoveReturnEaseFSSideL`, `charaMoveReturnEaseFSSideR`
- `0x3182018`: `advSoundSet`, `delayEnd`, `enableFullScreen`, `enableWaitLoadAssetWhenResume`
- `0x3182038`: `clear`, `page`
- `0x31824fc`: `bgm`, `subBgm`
- `0x3182768`: `delay`, `tdelay`
- `0x3182adc`: `fsmObjSetBool`, `fsmObjSetFloat`, `fsmObjSetString`
- `0x31834e4`: `branchNotRouteSelect`, `branchRouteSelect`
- `0x31838c8`: `cueSeContinueStop`, `seContinueStop`
- `0x3183a9c`: `subBlur2Off`, `subBlurOff`
- `0x3183c38`: `criMovie`, `movie`
- `0x3183e08`: `charaMoveEase`, `charaMoveEaseFSL`, `charaMoveEaseFSR`, `charaMoveEaseFSSideL`, `charaMoveEaseFSSideR`
- `0x318402c`: `wipeinEx`, `wipeoutEx`
- `0x318459c`: `branchHaveSvtEquip`, `branchNotHaveSvtEquip`
- `0x318472c`: `betweenHeight`, `l`
- `0x3184a58`: `s`, `speed`
- `0x3184b84`: `charaSpecialEffect`, `charaSpecialEffectPause`
- `0x3184c98`: `charaMoveReturn`, `charaMoveReturnFSL`, `charaMoveReturnFSR`, `charaMoveReturnFSSideL`, `charaMoveReturnFSSideR`
- `0x3184fa4`: `charaFadein`, `charaFadeinFSL`, `charaFadeinFSLNotNotch`, `charaFadeinFSR`, `charaFadeinFSRNotNotch`, `charaFadeinFSSideL`, `charaFadeinFSSideR`
- `0x318505c`: `charaMove`, `charaMoveFSL`, `charaMoveFSR`, `charaMoveFSSideL`, `charaMoveFSSideR`
- `0x31855fc`: `charaCutin`, `charaCutinPause`
- `0x3185e08`: `fsmObjSendEvent`, `fsmObjSetState`
- `0x3185f64`: `subRenderFadein`, `subRenderFadeinFSL`, `subRenderFadeinFSR`, `subRenderFadeinFSSideL`, `subRenderFadeinFSSideR`
- `0x3186c5c`: `subRenderMoveEase`, `subRenderMoveEaseFSL`, `subRenderMoveEaseFSR`, `subRenderMoveEaseFSSideL`, `subRenderMoveEaseFSSideR`
- `0x3186e80`: `charaPut`, `charaPutFSL`, `charaPutFSLNotNotch`, `charaPutFSR`, `charaPutFSRNotNotch`, `charaPutFSSideL`, `charaPutFSSideR`
- `0x3186fe0`: `charaSet`, `equipSet`, `figureSet`, `horizontalImageSet`, `imageSet`, `sceneSet`, `verticalImageSet`
- `0x3187604`: `specialEffect`, `specialEffectPuase`
- `0x3187928`: `f`, `font`, `fontSize`
- `0x3187a5c`: `charaEffect`, `charaEffectPause`
- `0x3187cbc`: `stretchin`, `stretchout`
- `0x318816c`: `insertionAnimationSet`, `insertionAnimationSetFSL`, `insertionAnimationSetFSR`, `insertionAnimationSetFSSideL`, `insertionAnimationSetFSSideR`
- `0x3188390`: `charaEffectEdgeBlur`, `charaEffectEdgeBlurPause`
- `0x3188484`: `maskin`, `maskout`
- `0x31884b4`: `equipChange`, `horizontalImageChange`, `imageChange`, `verticalImageChange`
- `0x3188708`: `masterHorizontalImageSet`, `masterImageSet`, `masterSet`, `masterVerticalImageSet`
- `0x3188898`: `cueSeContinueVolume`, `seContinueVolume`

## 3. 参数词汇表 (sub-parameter vocabularies)

### 3.1 分隔符与布尔/哨兵值（`pd[i] == literal` 比较，证据见 `il2cpp_out/pd_cmps_classified.json`）

| 字面量 | 出现位置 (pd 下标) | 次数 | 说明 |
|---|---|---|---|
| `' '` | [0, 1, 3, 5, 7, 9] | — | 元素分隔符（只出现在奇数下标，奇数=分隔符位） |
| `','` | [1, 3, 5] | — | 元素分隔符（只出现在奇数下标，奇数=分隔符位） |
| `true` | [0, 2] | — | 布尔字面量 |
| `false` | [0] | — | 布尔字面量 |
| `-` | [0] | — | 哨兵值（`GetIntegerParameter` 里 `'-'` 表示缺省；`0x31b33e8` 处引用） |

### 3.2 值与关键字（在 `pd[i]`（偶数下标）上与字面量比较的值）

| 字面量 | pd 下标 | 说明 |
|---|---|---|
| `allFalse` | [0] | 值关键字 (证据见 pd_cmps_classified.json) |
| `clear` | [0] | 值关键字 (证据见 pd_cmps_classified.json) |
| `lens` | [0] | 值关键字 (证据见 pd_cmps_classified.json) |
| `off` | [0] | 值关键字 (证据见 pd_cmps_classified.json) |
| `on` | [0] | 值关键字 (证据见 pd_cmps_classified.json) |
| `resume` | [0] | 值关键字 (证据见 pd_cmps_classified.json) |
| `selectBranch` | [0] | 值关键字 (证据见 pd_cmps_classified.json) |
| `subBlur2` | [0] | 值关键字 (证据见 pd_cmps_classified.json) |
| `subBlur2Off` | [0] | 值关键字 (证据见 pd_cmps_classified.json) |
| `inside` | [2] | 值关键字 (证据见 pd_cmps_classified.json) |
| `skipStop` | [2] | 值关键字 (证据见 pd_cmps_classified.json) |
| `sub` | [2] | 值关键字 (证据见 pd_cmps_classified.json) |
| `ui` | [2] | 值关键字 (证据见 pd_cmps_classified.json) |

### 3.3 effect 翻转 (flip) 取值

`ScriptManager$$ConvertEffectFlipKind` @ `0x31b3ad0` 完整比较链（可证明）:

| 输入字面量 | 枚举值 | 证据 |
|---|---|---|
| `H` | 1 (Horizontal) | `0x31b3b30` `op_Equality(x, "H")` → `0x31b3b38 mov w0,#1` |
| `V` | 2 (Vertical) | `0x31b3b54` → `0x31b3b5c mov w0,#2` |
| `F` | 3 | `0x31b3b78` → `0x31b3b7c mov w8,#3` |
| 其它 | 0 (none) | 默认 `wzr` |

### 3.4 完结淡入淡出颜色 (`EndExecuteScript(endFadeColor)` / `GetEndMode`)

`ScriptManager$$GetEndMode` @ `0x31b402c`: 空/`null` → 默认, `"white"` → White 模式, `"black"` → Black 模式（`0x31b4094` / `0x31b40b8`）。
`ConvertMovieColor` @ `0x31b3b94` 同样只识别 `black` / `white`。

### 3.5 资源路径型参数（不是枚举，取值来自资源命名，代码只做前缀/格式化）

| 参数类型 | 转换函数 | 代码中的格式 |
|---|---|---|
| wipe 名 | `ConvertWipeName` `0x31b3a00` | `"Wipe/" + name`（并去掉两侧引号）|
| talk effect | `ConvertTalkEffectName` `0x31b37c8` | `"Talk/" + name` |
| font | `ConvertFontName` `0x31b3898` | `String.Format("Font/{0}", …)` |
| picture frame 图 | `ConvertPictureFrameImageName` `0x31b38e4` | `String.Format("Image/{0}", …)` |
| sprite mask | `ConvertSpriteMaskName` `0x31b39b4` | `String.Format("Image/mask_{0}", …)` |
| back texture | `ConvertBackTextureName` `0x31b3930` | `String.Format("Back/back{0:D5}", int)` |
| movie | `ConvertMovieName` `0x31b3c38` | `String.Format("Movie/{0}.mp4", …)` |

### 3.6 位置 (pos) 参数

`ScriptManager$$GetPositionParameter` @ `0x31b3130` → `ScriptPosition.GetPosition` @ `0x31d8e3c`/`0x31d8d88`：位置是**两个整数**（x,y）而非关键字，没有位置关键字字面量可枚举。

## 4. 第二棵判定树 = `waitType` 分发（比较寄存器 x22，输入 pd[0]）

除命令判定树外，函数内还有第二棵 FNV-1a 判定树（树根 `0x318753c`，其叶子全部用 `x0 = x22` 比较）。
字段名（`il2cpp_out/dump.cs`, class `ScriptManager`）证明它是 **`waitType` 分发**：

```
protected State  state;      // 0x288   (enum ScriptManager.State: NONE=0 IDLE=1 LOAD=2 EXECUTE=3 WAIT=4 ...)
protected string waitType;   // 0x3D8
protected int    waitIndex;  // 0x3E0
protected float  waitCount;  // 0x3E4
protected string waitName;   // 0x3E8
```

代码：`0x31874f8 mov w8,#4; str w8,[x19,#0x288]`（state = WAIT）→ 取出 `pd[0]` 存进 `waitType`（`0x3187514-0x318751c`）→ `hash(pd[0])`（`0x3187530`）→ 进入第二棵判定树。

因此这些 token 是 **可等待的对象/方式**，不是独立命令（`test`: `wait time 1.5` → 树键 `time`，body `0x3193744` 把 `Single.Parse(pd[2])` 写入 `waitCount`(0x3e4)；
`wait frame 30` → 键 `frame`，body `0x31937f8`；`wait charaCut <n>` → 键 `charaCut`，body `0x319309c`，先把 `pd[2]` 经 `ConvertNameString` 写入 `waitName`(0x3e8)）。

写入 `state = WAIT(4)` 的（可见）命令: `wait, talkStart, talkEnd, talkName, charaTalk, page, k, notification, advSet, fsmObjSet, spriteMaskSet, masterVerticalImageSet, switchCaseEnd`。

**只作为 `waitType` 关键字出现、不是命令**的 12 个字面量（哈希同样通过 FNV-1a 校验；verify 地址为 `bl op_Equality` 处）：

| waitType 关键字 | verify | hash |
|---|---|---|
| `charaCut` | 0x3193094 | 0x8714dc7c |
| `charaCutStart` | 0x3193094 | 0x3365dc30 |
| `charaFade` | 0x31938c0 | 0x1322c812 |
| `communicatioChara` | 0x31907c4 | 0xca51292 |
| `effectmessage` | 0x3193518 | 0xf8e02873 |
| `effectmessageStart` | 0x3193518 | 0x46720de1 |
| `fastPlayDraw` | 0x31935c0 | 0x83be074b |
| `frame` | 0x31937f0 | 0xd20a71a6 |
| `fsmObjFinished` | 0x31938c0 | 0x4e57d930 |
| `masterverticalImageSet` | 0x31938c0 | 0xc7630faa |
| `rtime` | 0x31937f0 | 0x58666514 |
| `time` | 0x319373c | 0x5d3c9be4 |

**既是命令、也可作为 `waitType`** 的 60 个字面量（即 `wait <该动作>` / 等待该动画结束）：

- `backEffect`, `charaAttack`, `charaBackEffect`, `charaChange`, `charaCrossFade`, `charaEffect`
- `charaEffectEdgeBlur`, `charaFadeTimeLoop`, `charaMove`, `charaMoveEase`, `charaMoveEaseFSL`, `charaMoveEaseFSR`
- `charaMoveEaseFSSideL`, `charaMoveEaseFSSideR`, `charaMoveFSL`, `charaMoveFSR`, `charaMoveFSSideL`, `charaMoveFSSideR`
- `charaMoveReturn`, `charaMoveReturnEase`, `charaMoveReturnEaseFSL`, `charaMoveReturnEaseFSR`, `charaMoveReturnEaseFSSideL`, `charaMoveReturnEaseFSSideR`
- `charaMoveReturnFSL`, `charaMoveReturnFSR`, `charaMoveReturnFSSideL`, `charaMoveReturnFSSideR`, `charaMoveScale`, `charaReturn`
- `charaRollAxis`, `charaRollAxisLoopStop`, `charaRollMove`, `charaRollMoveEx`, `charaSet`, `charaSpecialEffect`
- `effect`, `equipChange`, `equipSet`, `figureChange`, `figureSet`, `fowardEffect`
- `fsmObjSet`, `horizontalImageChange`, `horizontalImageSet`, `imageChange`, `imageSet`, `insertionAnimationEnd`
- `insertionAnimationStart`, `masterChange`, `masterHorizontalImageChange`, `masterHorizontalImageSet`, `masterImageChange`, `masterImageSet`
- `masterSet`, `masterVerticalImageChange`, `sceneSet`, `specialEffect`, `verticalImageChange`, `verticalImageSet`

## 4b. `input` / `selectBranch` 机制

`selectBranch` **不是命令**，而是 `input` 命令的 `pd[0]` 取值：`ScriptManager` 常量 `FLAG_NAME_INPUT_SELECT_BRANCH = "INPUT_SELECT_BRANCH"`。
`input` body `0x317a800`: 先要求 `pd.Length >= 1`，比较 `pd[0] == "selectBranch"`（`0x317...`，见 `il2cpp_out/pd_cmps_classified.json` 中 `selectBranch` 的 3 处比较），
并把结果写入 `isSelectBranch`(0x3D0)（dump.cs 字段）。

## 4c. 与任务预期清单的差异（本版本不存在同名命令）

| 预期名 | 本版本情况 |
|---|---|
| `mes` | 二进制中无此字面量；消息命令为 `messageStart/messageOn/messageOff/messageChange/messageAlign/messageShake` |
| `bg` | 无此字面量；背景命令为 `bScene`(=`sceneSet` 同 body) / `scene` / `screen` |
| `char` | 无此字面量；立绘命令为 `charaSet / charaPut / charaChange / charaFadein / charaFadeout / charaClear / charaLayer` 等 |
| `face` / `name` | 无独立命令；表情=`charaFace/charaFaceFade/charaFaceIcon`，名字=`talkName/talkNameBack` |
| `goto` | 无；无条件跳转为 `jump`（`jump` body 读 `pd[0]` 经 `ConvertNameString`） |
| `quake` | 无；画面震动为 `shake`/`shakeStop`/`charaShake`/`subRenderShake` |
| `selectBranch` | 非命令，见 §4b |
| `gift` / `stage` / `filter` / `entry` / `exit` / `sceneLoad` | 无同名命令（`stage`≈`scene`/`bScene`；`filter`≈`cameraFilter`/`charaFilter`/`subCameraFilter`；`gift` 在战斗/奖励逻辑里，不在 ADV 命令表） |
| `wipe` / `mask` / `fade` | 只有带后缀的形式: `wipein/wipeout/wipeinEx/wipeoutEx/wipeFilter/wipeFilterEx/wipeOff`、`maskin/maskout/maskOff/spriteMaskSet/spriteMaskOff`、`fadein/fadeout/fadeMove/fadeOff/overlayFadein/subRenderFadein*` |
| `charaFade` | 无（有 `charaFadein/charaFadeout/charaFadeTime/charaFadeSpeed/charaFadeTimeLoop`） |

## 5. 不确定与未完成项

- 未能给出参数表的命令共 237 个（body 只做状态切换/调用无参逻辑，或参数在未建模的共享尾部分析）: `advPlayAnimator`, `advPrepare`, `advRelease`, `advSoundSet`, `autoAndBackLog`, `bScene`, `backCameraColor`, `backlogEnd`, `backlogStart`, `betweenHeight`, `bgmStop`, `bgmStopEnd`, `blur`, `branch`, `branchHaveSvtEquip`, `branchNotHaveSvtEquip`, `branchNotRouteSelect`, `branchNotRouteSelectCount`, `branchQuestClear`, `branchQuestNotClear`, `branchRouteSelect`, `branchRouteSelectCount`, `branchSetGrandSvtCount`, `cameraFilter`, `cameraMove`, `cameraMoveEase`, `capture`, `captureRelease`, `charaAttack`, `charaBackEffect`, `charaBackEffectPause`, `charaCutin`, `charaCutinPause`, `charaCutout`, `charaDepth`, `charaFace`, `charaFaceFade`, `charaFaceIcon`, `charaFadeSpeed`, `charaFadein` …

1. **参数名不存在**: 本版本参数是位置式的，没有 `name=value` 形式的参数名字面量；`GetStringParameter(pd,s,name)` 的 `name` 机制在本版本是死代码。表中 `params[].name` 一律为 `null`。
2. **参数索引的语义**: `pd[0]` 是行内的第一个 token，但**行首的 tag 是否也在 pd 内**依命令而不同（`wait` 的 pd[0] 是关键字 `time`；多数命令 body 直接读 `pd[0]` 作为第一个值）。表中一律给出**代码实际读取的 pd 下标**，不做行文本到 pd 的映射。
3. **共享 body**: 54 组命令共用 body，参数表按 body 给出（对同组每个命令都适用）。body 内部的再分流（例如 `charaMoveEase` 按 tag 决定 FSL/FSR）未逐条展开。
4. **噪声**: 少数参数条目的下标异常（>20）是线性反汇编在跨分支处的误解析，已在生成时丢弃；消费者为低层小工具（`0x2230448` write barrier、`0x22305f4` class-init、`get_Chars`、`Equals`、`Concat`）的条目也已剔除。余下 `unknown` 类型的消费者是普通调用（未做进一步类型推导）。
5. **easing 名（`expo/quad/back/linear/...`）无法从本函数证明**: 全 `.so` 字面量表中不存在 `expo/quad/sine/cubic` 等 LeanTween 名；函数把 ease 字符串**原样透传**给 `MovePositionEase(..., string easetype)` 等（`ScriptManager` @ `0x31b87ec/0x31b8cf0/0x31b8ff0` 各有 `string easetype` 形参），转换发生在 LeanTween 一侧，本函数内没有比较点。
6. **wipe/fade filter 名**: `wipeFilter/wipeFilterEx/subCameraFilter/cameraFilter` 的名称是资源名（`ConvertWipeName` 只加 `Wipe/` 前缀），取值数据驱动，代码内无可枚举的比较链。
7. 线性反汇编在跳表处可能失步；本表结论均以「哈希校验 + op_Equality + 路径遍历」三重条件为准，单条孤立指令不作为证据。

## 6. 命令总表 (纯名单, 便于比对)

`advActorHide`, `advActorShow`, `advPlayAnimator`, `advPrepare`, `advRelease`, `advSet`, `advSoundSet`, `autoAndBackLog`, `bScene`, `backCameraColor`, `backEffect`, `backEffectDestroy`, `backEffectPause`, `backEffectStart`, `backEffectStop`, `backlogEnd`, `backlogStart`, `betweenHeight`, `bgm`, `bgmStop`, `bgmStopEnd`, `blur`, `blurOff`, `branch`, `branchHaveSvtEquip`, `branchMaterial`, `branchNotHaveSvtEquip`, `branchNotMaterial`, `branchNotRouteSelect`, `branchNotRouteSelectCount`, `branchQuestClear`, `branchQuestNotClear`, `branchRouteSelect`, `branchRouteSelectCount`, `branchSetGrandSvtCount`, `cameraFilter`, `cameraHome`, `cameraMove`, `cameraMoveEase`, `cameraRoll`, `cameraRollMove`, `capture`, `captureRelease`, `charaAttack`, `charaBackEffect`, `charaBackEffectDestroy`, `charaBackEffectPause`, `charaBackEffectStart`, `charaBackEffectStop`, `charaChange`, `charaClear`, `charaCrossFade`, `charaCutStop`, `charaCutin`, `charaCutinPause`, `charaCutinStart`, `charaCutout`, `charaDepth`, `charaEffect`, `charaEffectDestroy`, `charaEffectEdgeBlur`, `charaEffectEdgeBlurDestroy`, `charaEffectEdgeBlurPause`, `charaEffectEdgeBlurStart`, `charaEffectEdgeBlurStop`, `charaEffectPause`, `charaEffectStart`, `charaEffectStop`, `charaFace`, `charaFaceFade`, `charaFaceIcon`, `charaFadeSpeed`, `charaFadeTime`, `charaFadeTimeLoop`, `charaFadeTimeLoopStop`, `charaFadein`, `charaFadeinFSL`, `charaFadeinFSLNotNotch`, `charaFadeinFSR`, `charaFadeinFSRNotNotch`, `charaFadeinFSSideL`, `charaFadeinFSSideR`, `charaFadeout`, `charaFilter`, `charaLayer`, `charaMask`, `charaMove`, `charaMoveEase`, `charaMoveEaseFSL`, `charaMoveEaseFSR`, `charaMoveEaseFSSideL`, `charaMoveEaseFSSideR`, `charaMoveFSL`, `charaMoveFSR`, `charaMoveFSSideL`, `charaMoveFSSideR`, `charaMoveReturn`, `charaMoveReturnEase`, `charaMoveReturnEaseFSL`, `charaMoveReturnEaseFSR`, `charaMoveReturnEaseFSSideL`, `charaMoveReturnEaseFSSideR`, `charaMoveReturnFSL`, `charaMoveReturnFSR`, `charaMoveReturnFSSideL`, `charaMoveReturnFSSideR`, `charaMoveScale`, `charaMoveScaleEase`, `charaPut`, `charaPutFSL`, `charaPutFSLNotNotch`, `charaPutFSR`, `charaPutFSRNotNotch`, `charaPutFSSideL`, `charaPutFSSideR`, `charaRelativeLoopMove`, `charaRelativeLoopMoveEase`, `charaRelativeLoopMoveStop`, `charaRelativePut`, `charaReturn`, `charaRoll`, `charaRollAxis`, `charaRollAxisLoopStop`, `charaRollMove`, `charaRollMoveEx`, `charaScale`, `charaSet`, `charaShadow`, `charaShake`, `charaShakeStop`, `charaSpecialEffect`, `charaSpecialEffectPause`, `charaSpecialEffectStart`, `charaSpecialEffectStop`, `charaTalk`, `clear`, `communicationChara`, `communicationCharaClear`, `communicationCharaFace`, `communicationCharaLoop`, `communicationCharaStop`, `criMovie`, `cueSe`, `cueSeContinue`, `cueSeContinueStop`, `cueSeContinueVolume`, `cueSeStop`, `cueSeVolume`, `cueVoice`, `cueVoiceStop`, `cueVoiceVolume`, `delay`, `delayEnd`, `delayStop`, `delayStopAll`, `distortionloop`, `distortionstart`, `distortionstop`, `effect`, `effectDestroy`, `effectForceStop`, `effectPause`, `effectStart`, `effectStop`, `effectmessageDestroy`, `effectmessageStop`, `else`, `enableFullScreen`, `enableWaitLoadAssetWhenResume`, `end`, `endFade`, `endIf`, `equipChange`, `equipSet`, `f`, `faceTalkScreen`, `fadeMove`, `fadeOff`, `fadein`, `fadeout`, `figureChange`, `figureSet`, `flag`, `flagRandom`, `flashOff`, `flashOffDep`, `flashin`, `flashinDep`, `flashout`, `flashoutDep`, `font`, `fontSize`, `fontType`, `fowardEffect`, `fowardEffectDestroy`, `fowardEffectPause`, `fowardEffectStart`, `fowardEffectStop`, `fsmObjDestroy`, `fsmObjLayer`, `fsmObjSendEvent`, `fsmObjSet`, `fsmObjSetBool`, `fsmObjSetFloat`, `fsmObjSetState`, `fsmObjSetString`, `horizontalImageChange`, `horizontalImageSet`, `ifClear`, `imageChange`, `imageSet`, `input`, `insertionAnimationEnd`, `insertionAnimationSet`, `insertionAnimationSetFSL`, `insertionAnimationSetFSR`, `insertionAnimationSetFSSideL`, `insertionAnimationSetFSSideR`, `insertionAnimationStart`, `interruption`, `jingle`, `jingleStop`, `jump`, `k`, `keepSubBgmOff`, `keepSubBgmOn`, `l`, `label`, `maskOff`, `maskin`, `maskout`, `masterBranch`, `masterChange`, `masterHorizontalImageChange`, `masterHorizontalImageSet`, `masterImageChange`, `masterImageSet`, `masterNameWidth`, `masterScene`, `masterSet`, `masterVerticalImageChange`, `masterVerticalImageSet`, `menu`, `messageAlign`, `messageChange`, `messageOff`, `messageOn`, `messageShake`, `messageShakeStop`, `messageSpeedForcedNormal`, `messageStart`, `movie`, `notification`, `overlayFadein`, `page`, `pictureFrame`, `pictureFrameTop`, `q`, `questMessageOverwrite`, `revivalBranch`, `rewardSwitch`, `s`, `scene`, `sceneSet`, `screen`, `scrollStop`, `se`, `seContinue`, `seContinueStop`, `seContinueVolume`, `seLoop`, `seStop`, `seVolume`, `selectionCentering`, `selectionUse`, `shake`, `shakeStop`, `skip`, `soundStopAll`, `soundStopAllEnd`, `soundStopAllFade`, `specialEffect`, `specialEffectPuase`, `specialEffectStart`, `specialEffectStop`, `speed`, `spriteMaskOff`, `spriteMaskSet`, `stretchOff`, `stretchin`, `stretchout`, `subBgm`, `subBgmStop`, `subBlur`, `subBlur2`, `subBlur2Off`, `subBlurOff`, `subCameraFilter`, `subCameraHome`, `subCameraMove`, `subCameraMoveEase`, `subCameraOff`, `subCameraOn`, `subCameraRoll`, `subCameraRollMove`, `subRenderDepth`, `subRenderFadein`, `subRenderFadeinFSL`, `subRenderFadeinFSR`, `subRenderFadeinFSSideL`, `subRenderFadeinFSSideR`, `subRenderFadeout`, `subRenderMove`, `subRenderMoveEase`, `subRenderMoveEaseFSL`, `subRenderMoveEaseFSR`, `subRenderMoveEaseFSSideL`, `subRenderMoveEaseFSSideR`, `subRenderMoveFSL`, `subRenderMoveFSR`, `subRenderMoveFSSideL`, `subRenderMoveFSSideR`, `subRenderMoveScale`, `subRenderMoveScaleEase`, `subRenderScale`, `subRenderShake`, `subRenderShakeStop`, `subStretch`, `subStretchin`, `subStretchout`, `switchCase`, `switchCaseEnd`, `tVoice`, `tVoiceUser`, `talkEnd`, `talkName`, `talkNameBack`, `talkStart`, `tapSkip`, `tdelay`, `turnPageOff`, `turnPageOn`, `useSimpleMeshFigure`, `verticalImageChange`, `verticalImageSet`, `voice`, `voiceStop`, `voiceVolume`, `wait`, `warBoardTalkScreen`, `warCharaFadein`, `warEffectOff`, `warEffectPiece`, `warEffectPos`, `warEffectSquare`, `warEventScript`, `warMoveCameraPiece`, `warMoveCameraPos`, `warMoveCameraSquare`, `wipeFilter`, `wipeFilterEx`, `wipeOff`, `wipein`, `wipeinEx`, `wipeout`, `wipeoutEx`

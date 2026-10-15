# 剧情脚本格式(补充实证):行语法 / `k` / `wt`·`twt` / `＠`·`＄`

对象:`Fate/Grand Order` Android 2.139.3(`com.aniplex.fategrandorder`,IL2CPP,Unity 6000.0.68f1)。
本文是 `work/out/script-format.md` 的**补充与修正**,所有结论给出 `libil2cpp.so` 的 VA + 反汇编原文。
**未证实的内容标 INFERRED**。不修改既有文档。

本文件所用工具(可复现):

```bash
python work/coverage/win.py <VA> [前] [后]      # 带字面量注解的反汇编窗口
python work/scratch/range.py <VA起> <VA止>      # 本文新增:精确 adrp/ldr 注解的区间反汇编
python work/scratch/hscan.py <起> <止> [hash...] # 本文新增:哈希树 (w8=lo;movk;cmp w0,w8;b.xx) 定位
python work/scratch/xref2.py <slot...>          # 本文新增:全代码段 adrp/ldr xref(允许 rd!=rn)
python work/scratch/classify2.py                # 本文新增:独立行分类器(输出与 classify.py 一致)
```

字面量↔槽位链:代码 `adrp x8,page; ldr x8,[x8,#off]` 取到的是**字面量使用槽**(`R_AARCH64_RELATIVE`,type 1027);
槽内是字符串字面量对象的指针,再 `ldr x1,[x8]` 得到 `System.String`。这是全文引用 `; &'xxx'` 注解的含义。

---

## A. 修正后的行语法(全量实证)

### A.1 行种类与出现次数

语料:`scripts\` 33 章 2583 个 `.txt`,1,867,761 行。用 `work/scratch/classify2.py`(独立重写,结果与
`work/coverage/classify.py` 完全一致)统计:

| 行种类 | 形态 | 行数 | 说明 |
|---|---|---|---|
| 入口标签行 | `＄01-00-00-00-1-0` | 2,582 | 每文件首行;`＄`=`SCRIPT_ACTION_CODE_LABEL`,→ tag `label`(§C.3/F) |
| 说话人 | `＠[51d4ff]アナウンス[-]` | 184,792 | 全角 `＠` + 1 个后续名 |
| **命令** | 整行恰为一个 `[...]`,且 tag 命中 `ScriptCommandExecute` 哈希树 | **857,520** | 含 `[k]` 184,799 行 |
| 括号但非命令 | 整行恰为一个 `[...]`,tag 不在哈希树 | 114,315 | `wt` 114,251 / `line` 23 / `image` 21 / 颜色码如 `[c3b1c6]` 等 |
| 消息行 | 以 `[` 开头但后面还有文本(≥2 个括号组或尾随文本) | 11,423 | `[51d4ff][line 3]塩基配列…` |
| 纯文本消息体 | 不以 `＄＠[` 开头 | 203,209 | |
| 空行 | | 493,920 | |
| 合计 | | 1,867,761 | |

> 括号内 tag 出现次数 Top:`k` 184,799、`charaFace` 114,682、`wt` 114,251、`charaFadeout` 76,752、
> `charaFadein` 74,211、`charaTalk` 70,640、`messageOff` 27,236、`charaSet` 26,796、`wait` 26,781、`se` 23,843 …
> (来源 `work/coverage/census.json` 的 `tagcount`,399 种 tag)

### A.2 引擎的判定规则(二进制证据)

`ScriptManager$$AnalysText`(`0x31a920c`,`ref List<string> tagDataList, ref List<string> scriptDataList,
ref List<int> lineDataList, ref List<int> orgLineDataList, ref int lastMessageIndex, ref string talkName,
ref bool messageLine, ref int fontSize, string analysData, int line, int orgLine`)逐字符扫描一行:

1. **累加当前 token**(`x20`),每字符 `String.Concat`:

```
0x31aa608 mov w1,w19            ; i
0x31aa60c mov x0,x29            ; analysData
0x31aa618 bl  #0x486c8a8        CALL System.String$$get_Chars
0x31aa624 cmp w8, #0x22         ; '"' → 0x31aa6c8(引号内原样拷贝,见 §D)
0x31aa62c cmp w8, #0x5b         ; '[' → 0x31aa634,否则 0x31aa768 直接 Concat
```

2. **遇到 `[` 且 token 非空 → 本行标记为消息行**(这是"消息行"的判定点之一):

```
0x31aa634 ldr x1,[x26]          ; &''
0x31aa640 bl  #0x4870cc4        CALL System.String$$op_Inequality   ; x20 != "" ?
0x31aa644 tbz w0,#0 → 0x31aaac8 ; token 为空 → 走"行首括号组"分支
...
0x31aaab8 bl  #0x44aba00        CALL List<int>$$AddWithResize        ; lineDataList.Add(line)
0x31aaabc ldr x8,[sp, #0x18]    ; [sp+0x18] = &messageLine(第 7 参)
0x31aaac0 mov w9, #1
0x31aaac4 strb w9, [x8]         ; *messageLine = true
```

同样还有两处 `*messageLine = true`: `0x31ae830-0x31ae838`、`0x31b0f4c-0x31b0f54`(函数收尾的兜底路径)。

3. **行首就是 `[` → 扫描整个括号组**,用括号深度计数器 `w26`,`[` 加 1、`]` 减 1,深度 <0 结束;
   同时把**第一个空格之前**的子串记在 `x21`(0x31aab1c-0x31aab28: `cmp w8,#0x20` + `ccmp x21,#0` + `csel x21,x20,x21,eq`):

```
0x31aaaf8 cmp w8, #0x5b         ; '['
0x31aab14 add w26, w26, #1
0x31aab00 cmp w8, #0x5d         ; ']'
0x31aab08 subs w26, w26, #1     ; 深度归零→b.pl 继续,负→0x31aac04 结束
0x31aab1c and w8, w0, #0xffff
0x31aab20 cmp w8, #0x20         ; ' '
0x31aab24 ccmp x21, #0, #0, eq
0x31aab28 csel x21, x20, x21, eq ; x21 = 空格前的 token = tag
0x31aac0c csel x26, x20, x21, eq ; 无空格时 tag = 整组内容
0x31aac10 mov x0, x26
0x31aac14 bl #0x2cdf448         CALL <PrivateImplementationDetails>$$ComputeStringHash   ; FNV-1a 32 位
```

`x26` = **tag**(括号组内第一个空格之前的文本),随即进入哈希树;命中→命令,未命中→默认路径
(`0x31ae064`,先判 `talkName` 是否非空、`lastMessageIndex` 符号,再按消息处理)。

### A.3 判定规则(本文结论)

> **一行是命令,当且仅当:去掉行首尾空白后整行恰好是一个 `[...]` 括号组,且组内第一个 token(tag)的
> FNV-1a 命中 `ScriptCommandExecute` 的哈希树。其他任何"括号组 + 额外文本"的形态都是消息行。**

边界案例(全部来自真实语料,已逐个核对):

| 行 | 为什么不是命令 | 证据链 |
|---|---|---|
| `[f small]  [f -]白紙化した地球での…[r][f small]  [f -]彷徨海での…[line 3]”` (453 行) | `f` **是**命令 tag(`fnv1a('f')=0xe30c2799` 在 `hash_constants.json` 中),但整行不是单一括号组 → 消息 | AnalysText 扫完第一个组后回到 0x31aa608 继续;再遇 `[` 时 token(=两个空格)非空 → `*messageLine=true`(0x31aaabc) |
| `[font large][messageShake 0.05 4 7 1.0]ホロボスウゥウウウウ！！` (16 行) | `font` 也是命令 tag,但行内有两个括号组 + 尾随文本 → 消息 | 同上;`messageShake` 亦为命令 tag |
| `[51d4ff][line 3]塩基配列…` | `51d4ff` 不是任何命令 tag(6 位十六进制颜色码);`line`/`image`/`i`/`align` 同样**不在**命令哈希树里(`fnv1a('line')=0x17db1627` 不在集合中) | 括号组 content 首个 token 作为 tag 参与哈希,未命中 → 默认路径。语料:首组为 `51d4ff` 的行 74 条,首组为 `line` 的 4,875 条,首组为 `image` 的 139 条 |
| `[wt 1.0]` (114,251 行) | `wt` 不在 `ScriptCommandExecute` 树里,但在 **`AnalysText` 自己的树**里:被改写为 `wait`+`time ` (见 §B.2) | 0x31aca2c `b.eq 0x31ad6cc` |
| `[k]` (184,799 行) | **是命令**:`fnv1a('k')=0xee0c38ea` 在 `ScriptCommandExecute` 树里(0x3179fb8/0x3179fbc `b.eq 0x317fa08`) | 见 §B.1 |
| `[align center]ストーム・ボーダー管制室[align][r]…` (227 行) | `align` 是**消息内联标记**,不是命令 | `fnv1a('align')=0x602c63de` 不在命令树 |
| `"[#Once you eliminate…

…]"` (2 行) | 整行被引号包住,引号把内层 `[` 从特殊字符降级为普通文本 | 0x31aa624 / 0x31aa6c8,见 §D |

⚠ 结论:`[f small]`、`[font large]`、`[fontSize x-large]`、`[s 16]`、`[speed 32]`、`[charaTalk B]`
这些**既是命令 tag、又能出现在消息行内部**。阅读器/播放器不能用"行首是已知命令 tag"来判断命令,
必须用"整行恰为一个括号组"。

---

## B. `k` 与 `wt`/`twt` 的执行位置

### B.1 `[k]` = 关闭当前 talk + 等待点击

**三段证据(处理链完整闭合):**

**(1) `AnalysText` 的 `k` 分支**。哈希叶子判定在 `0x31ab554`(`b.ne 0x31ae064` 为未命中),
命中后 `0x31ab55c` 装载字面量 `'k'`(`0x55c8f98`),跳到块 `0x31ad4d8`:

```
0x31ab54c mov w8, #0x38ea
0x31ab550 movk w8, #0xee0c, lsl #16
0x31ab554 cmp w0, w8
0x31ab558 b.ne #0x31ae064          ; 不是 k → 默认(消息)路径
0x31ab55c adrp x8, #0x55c8000
0x31ab560 ldr x8, [x8, #0xf98]     ; &'k'
0x31ab564 b #0x31ad4d8

0x31ad4d8 ldr x1, [x8]
0x31ad4dc mov x0, x26              ; x26 = tag
0x31ad4e4 bl  #0x4870cc0           CALL System.String$$op_Equality   ; tag=="k" 防哈希碰撞
0x31ad4e8 tbz w0, #0, #0x31ae064
0x31ad4ec ldr x8, [sp, #0x48]      ; [sp+0x48] = &lastMessageIndex
0x31ad4f4 ldr w8, [x8]
0x31ad4fc tbnz w8, #0x1f, #0x31ad5a0 ; lastMessageIndex<0(没有打开的消息块)→跳过
0x31ad500 ldr x8, [sp, #0x20]      ; &talkName
0x31ad518 bl  #0x4870cc4           CALL System.String$$op_Inequality   ; talkName != ""
0x31ad534 ldr x8, [x8, #0xce0]     ; &'talkEnd'
0x31ad53c ldr x1, [x8]             ; 'talkEnd'
0x31ad540 bl  #0x201abc4           CALL List<string>.Add(tagDataList,"talkEnd")
0x31ad544 ldr x8, [sp, #0x50]      ; &scriptDataList
0x31ad550 adrp x8, #0x5570000
0x31ad554 ldr  x8, [x8, #0x458]    ; &''
0x31ad55c ldr  x1, [x8]            ; ''
0x31ad560 bl  #0x201abc4           ; scriptDataList.Add("")
0x31ad574/0x31ad590 bl #0x201ff54  ; lineDataList.Add(line) / orgLineDataList.Add(orgLine)
0x31ad594 ldr x8, [sp, #0x48]
0x31ad598 mov w9, #-1
0x31ad59c str w9, [x8]             ; *lastMessageIndex = -1
0x31ad5a0 ldr x8, [sp, #0x40]      ; &tagDataList
0x31ad5dc mov x1, xzr
0x31ad5e4 str xzr, [x8, #0x20]!    ; tagDataList.Add(null)
0x31ad5ec bl  #0x2230448           ; GC write barrier
0x31b0420 ldr x9, [x9, #0xfb0]     ; &'[r]'
0x31b0454 str x1, [x8, #0x20]!     ; scriptDataList.Add("[r]")
```

即:`[k]` 在解析期**关闭正在进行的说话人块**(发射 `talkEnd` + 清 `lastMessageIndex`)。

**(2) `ScriptCommandExecute` 的 `k` 分支**(分派点 `0x3179fb8`;`hash_constants.json` 中 `0xee0c38ea`
唯一 b.eq 目标 `0x317fa08`):

```
0x317fa28 ldr x8, [x20]            ; x20 = pd
0x317fa30 ldr x8, [x8, #0x18]      ; pd.Length
0x317fa34 cbnz x8, #0x318663c      ; 有参数 → &'parameter be unnecessary' 报错(0x3186640)
0x317fa3c mov w8, #4
0x317fa40 str w8, [x19, #0x288]    ; ScriptManager.state = 4 = State.WAIT
0x317fa44 b #0x318f014
0x318f014 str x1, [x19, #0x3d8]    ; waitType = "k"   (0x3d8 = ScriptManager.waitType)
0x318f018 … b #0x3193e94 → 0x3193f00  ; 返回 Normal(0)
```

(`ScriptManager` 字段偏移:`0x288 state`、`0x3d8 waitType`、`0x3e0 waitIndex`、`0x3e4 waitCount`,
见 dump.cs `public class ScriptManager : SingletonMonoBehaviour<ScriptManager> // TypeDefIndex: 4870`)

**(3) `ProcessScript` 的 `k` 分支**(`0x31c24e0` 叶子 + `0x31c24f0` 防碰撞):

```
0x31c250c ldr x0, [x19, #0x28]              ; ScriptManager.messageCommonManager
0x31c2514 ldrb w8, [x0, #0x1c0]
0x31c2518 cbnz w8, #0x31c2850
0x31c251c ldr w8, [x19, #0x408]             ; playScriptJumpLine
0x31c2520 str wzr, [x19, #0x400]            ; waitTime = 0
0x31c2524 tbz w8, #0x1f, #0x31c2554
0x31c2528 ldrb w8, [x19, #0x393]            ; isButtonDisable
0x31c2534 ldr w8, [x19, #0x294]             ; inputTopMode
0x31c253c ldrb w8, [x19, #0x392]            ; isBacklogOnly
0x31c2548 mov w1, #1
0x31c2550 bl  #0x31d4708                    CALL ScriptMessageCommonManager$$WaitNextTouch(bool isShowNextTouchObject = true)
```

⇒ **`[k]` 语义 = 结束当前对话块,并等待玩家点击(`WaitNextTouch`,显示"下一句"指示),可被自动播放/跳过逻辑
接管。** 语料中 `[k]` 恒为无参数形态(184,799 行全部等于 `[k]` 字符串),与 `pd.Length==0` 的校验一致;
唯一一处 `[q]`(`0400070420.txt`)与 `k` 同树同分支。

### B.2 `wt` / `twt` = `wait time` / `wait rtime`(语法糖,在 `AnalysText` 里改写)

`wt` 不在命令树(`fnv1a('wt')=0x4b4794e6` 不在 `hash_constants.json`),只在 `AnalysText` 的树里:
`0x31aca2c b.eq 0x31ad6cc`。分支目标块:

```
0x31ad6cc adrp x8, #0x55c8000
0x31ad6d8 ldr  x8, [x8, #0xfe0]     ; &'wt'
0x31ad6e0 bl   #0x4870cc0           CALL op_Equality(tag,"wt")
0x31ad6e4 tbz  w0, #0, #0x31ae064
0x31ad6f8 ldr  x8, [x8, #0x648]     ; &'wait'
0x31ad700 ldr  x1, [x8]
0x31ad704 bl   #0x201abc4           CALL tagDataList.Add("wait")      ← tag 改写为 wait
0x31ad70c ldr  w8, [x26, #0x10]     ; w8 = "wt".Length = 2
0x31ad714 add  w1, w8, #1           ; w1 = 3
0x31ad724 ldr  x8, [x8, #8]         ; &'time '
0x31ad728 ldr  x26, [x8]            ; x26 = "time "
0x31ad73c bl   #0x4876934           CALL analysData.Substring(3)      ; 跳过 "wt " 3 个字符
0x31b03bc …  bl #0x4867ef8 CALL String.Concat("time ", 值) ; → scriptDataList.Add("time <值>")
```

`twt` 的叶子在 `0x31ac4fc`(`b.ne` 未命中),块 `0x31ac500`,`0x31ac55c` 装载 `'rtime '`(`0x55ca9b0`),
`0x31ac560 b 0x31ad728` 与 `wt` 共用尾部:

```
0x31ac558 ldr x8, [x8, #0x9b0]      ; &'rtime '
0x31ac560 b   #0x31ad728
```

⇒ `[wt 1.0]` ≡ `[wait time 1.0]`,`[twt 1.0]` ≡ `[wait rtime 1.0]`。语料侧一致:`[wt <浮点秒>]` 共 176 种
(`0.1` 47,006 次、`1.0` 12,444 次、`0.5` 10,001 次…),`wait` 行则全部是条件等待
(`[wait fade]` 17,566、`[wait wipe]` 6,194、`[wait communicationChara]` 813、`[wait camera]` 259…)。

### B.3 `wait` 的子关键字树 与 `time`/`rtime`/`frame` 的区别

`ScriptCommandExecute` 的 `wait` 处理(`0x31874d8`,hash 叶子 `0x317d7dc b.eq`):

```
0x31874f4 mov w8, #4
0x31874f8 str w8, [x19, #0x288]     ; state = WAIT
0x3187510 b.le #0x3193e80           ; pd.Length<=0 → &'parameter error'(0x3193e84)
0x3187514 ldr x1, [x8, #0x20]       ; pd[0]
0x318751c str x1, [x19, #0x3d8]     ; waitType = pd[0]
0x318752c bl  #0x2cdf448            CALL ComputeStringHash(pd[0])
0x318753c …                          ; 以 w0 为键的二叉哈希树(根 0x318753c,比较寄存器 x22)
```

树内三个关键叶子(本文用 `hscan.py` 全量定位):
- `time` (`fnv1a=0x5d3c9be4`):`0x319219c b.eq 0x3193728`
- `rtime`(`fnv1a=0x58666514`):`0x3191fb4 b.ne` 未命中,命中块 `0x3191fc4`(装载 `'rtime'`)→ `b 0x31937e4`
- `frame`(`fnv1a=0xd20a71a6`):`0x31921d8 b.eq 0x31937dc`(装载 `'frame'`)→ 落入同一个 `0x31937e4`

`time` 处理块 `0x3193728`:

```
0x3193730 ldr x1,[x8]              ; 'time'
0x3193740 bl  #0x4870cc0           CALL op_Equality(pd[0],"time")
0x3193764 ldr x0,[x8, #0x28]       ; pd[1]
0x319376c bl  #0x4870cc0           CALL op_Equality(pd[1]," ")        ; 必须确实是空格分隔
0x3193788 ldr x0,[x8, #0x30]       ; pd[2]
0x3193790 bl  #0x49e8728           CALL System.Single$$Parse
0x3193798 str s0, [x19, #0x3e4]    ; waitCount = 秒数
0x31937a8 bl  #0x31b5344           CALL ScriptManager$$IsFastPlaySpeed
0x3193854 …                        ; 值==0 时走 ConvertNameString(pd[2]) → waitName(命名等待)
```

`rtime`/`frame` 共用块 `0x31937e4`(同样的 `pd[1]==" "` 校验 + `Single.Parse(pd[2])` → `waitCount`),
**行为差异只体现在 `waitType` 字段上**,由 `ScriptManager$$Update` 消费:

```
0x31bc2a8 bl  #0x36072f8    CALL RealTime$$get_deltaTime      ; = UnityEngine.Time.unscaledDeltaTime(0x36072f8→0x4fde5c8)
0x31bc2b0 ldrb w8, [x19, #0x6e0]     ; isScriptExecuteMoviePlay
0x31bc2b8 bl  #0x4fde578    CALL UnityEngine.Time$$get_deltaTime   ; 受 Time.timeScale 影响的游戏时间
0x31bc2cc ldr w8, [x19, #0x288]      ; state
0x31bc2d0 cmp w8, #4                 ; == WAIT
0x31bc2d4 b.ne #0x31bc2f8
0x31bc2d8 ldr x0, [x19, #0x3d8]      ; waitType
0x31bc2e8 ldr x8, [x8, #0x6c0]       ; &'time'
0x31bc2ec ldr x1, [x8]               ; 'time'
0x31bc2f0 bl  #0x48706e4    CALL System.String$$Equals(waitType,"time")
0x31bc2f4 tbnz w0, #0, #0x31bc2b8    ; waitType=="time" → 用 UnityEngine.Time.deltaTime(游戏时间)
0x31bc2f8 … bl #0x31bc344   CALL ScriptManager$$ProcessScript(delta)
```

⇒ **`time` = 游戏时间(scaled，`Time.deltaTime`,受播放速度/timeScale 影响);`rtime` = 实时间
(`Time.unscaledDeltaTime`,不受 timeScale 影响);`frame` = 帧计数(同一解析块,仅 `waitType` 不同)。**
`wt`/`twt` 因此分别是"按游戏时间等待 N 秒/按实时间等待 N 秒"。

---

## C. `＠` / `＄` 之谜:**已定位**

### C.1 结论

引擎**从不比较 `＠`/`＄` 字符本身**。行首标记运行时来自**本地化字符串字段**:

| 字段(dump.cs) | 偏移 | 值来源(VA) | 用途(VA) |
|---|---|---|---|
| `ScriptManager.codeLabelString` | 0x660 | `LocalizationManager.Get("SCRIPT_ACTION_CODE_LABEL")` @ `0x31a1130-0x31a1140` | `0x31a5c6c` StartsWith → tag `"label"` |
| `ScriptManager.codeSceneString` | 0x668 | `Get("SCRIPT_ACTION_CODE_SCENE")` @ `0x31a114c-0x31a115c` | `0x31a5c8c` StartsWith → tag `"scene"` |
| **`ScriptManager.codeTalkString`** | **0x670** | `Get("SCRIPT_ACTION_CODE_TALK")` @ `0x31a1168-0x31a1178` | **`0x31a5cac` StartsWith → tag `"talkName"`** |
| `codeSwitchCaseString` | 0x678 | `..._SWITCH_CASE` @ 0x31a1184-0x31a1194 | 0x31a6720 |
| `codeSwitchCaseSplitString` | 0x680 | `..._SWITCH_CASE_SPLIT` @ 0x31a11a0-0x31a11b0 | 0x31a6734 |
| `codeSwitchCaseHiddenString` | 0x688 | `..._SWITCH_CASE_HIDDEN` @ 0x31a11bc-0x31a11cc | |
| `codeSwitchEndString` | 0x690 | `..._SWITCH_END` @ 0x31a11d8-0x31a11f0 | 0x31a5f24 |
| `codeInsertString` | 0x698 | `..._INSERT` @ 0x31a1204-0x31a1214 | 0x31a5b38 |
| `codeVoiceString` | 0x6A0 | `..._VOICE` @ 0x31a1228-0x31a1238 | 0x31a5f10 |
| `codeReturnString` | 0x6A8 | `..._RETURN` @ 0x31a124c-0x31a125c | 0x31a6580 |
| `codeCommentString` | 0x658 | `..._COMMENT` @ 0x31a1114-0x31a1124 | 0x31a5b24 |

`ScriptManager$$AnalysScript`(VA `0x31a50ec`)的分派原文:

```
0x31a5c6c ldr x1, [x21, #0x660]     ; this.codeLabelString
0x31a5c78 bl  #0x4870d34            CALL String.StartsWith(line)
0x31a5c7c tbz w0, #0, #0x31a5c8c
0x31a5c84 ldr x8, [x8, #0xd80]      ; &'label'     → tag = "label"     ← ＄ 行走这里(见 §C.3 实证)
0x31a5c8c ldr x1, [x21, #0x668]     ; this.codeSceneString
0x31a5c98 bl  #0x4870d34            CALL String.StartsWith(line)
0x31a5ca0 ldr x8, [x8, #0xbb8]      ; &'scene'     → tag = "scene"     ← ＃ 行走这里(本语料 0 次)
0x31a5cac ldr x1, [x21, #0x670]     ; this.codeTalkString
0x31a5cb8 bl  #0x4870d34            CALL String.StartsWith(line)
0x31a5cc4 ldr x8, [x8, #0xfb8]      ; &'talkName'  → tag = "talkName"  ← ＠ 行走这里
0x31a5cd8 bl  #0x4876934            CALL line.Substring(1)              ; 去掉 1 个字符的标记
0x31a5edc ldr x8, [x8, #0xfb8]      ; &'talkName'
0x31a5ef0 bl  #0x4870cc0            CALL op_Equality(tag,"talkName")
0x31a5efc csel x8, x25, x8, ne      ; tag=="talkName" → talkName = line.Substring(1)
0x31a5f00 str x8, [sp, #0x60]
```

**`Substring(1)` 证明标记正好 1 个字符**。

### C.3 字符实证(补证,推翻 §C.1 的 INFERRED 与一处错标)

本地化表**就在 APK 内**(`data.unity3d` → TextAsset `LocalizationJpn`),已读出字段的实际取值:

```
0x31a10b4 x23 = 'SCRIPT_ACTION_CODE_LABEL'   ; 0x31a1130 Get([x23]) → 0x31a1140 str→[x19,#0x660] ⇒ 0x660 = '＄'
0x31a10b8 x27 = 'SCRIPT_ACTION_CODE_SCENE'   ; 0x31a114c Get([x27]) → 0x31a115c str→[x19,#0x668] ⇒ 0x668 = '＃'
0x31a10bc x26 = 'SCRIPT_ACTION_CODE_TALK'    ; 0x31a1168 Get([x26]) → 0x31a1178 str→[x19,#0x670] ⇒ 0x670 = '＠'
```

⇒ **字段 0x660(`codeLabelString`)= `＄` → tag `label`**;
0x668(`codeSceneString`)= `＃` → tag `scene`;0x670(`codeTalkString`)= `＠` → tag `talkName`。

> **修正上文 §C.1 表格内的"← ＄ 行走这里"标注**:`＄` 行(2,582 行,每文件 1 行、值=文件名派生的入口标签)
> 走的是 **0x660 → tag `label`** 这条链,不是 `scene`。
> 完整表与复现命令见 `work/out/_evidence/marker-table.md`。

`＠` 行最终变成 tag `"talkName"` + 数据 `"[51d4ff]アナウンス[-]"`,由命令 `talkName` 消费
(`ScriptCommandExecute` 中 `fnv1a('talkName')=0x1aff046c` 在树里)。

### C.2 为什么全量扫描找不到字符立即数

- `＠`(U+FF20)、`＄`(U+FF04)在 94MB 代码段没有任何 `cmp w8,#imm`/`movz` 立即数比较 —— 因为**比较对象是字段**。
- 字符串字面量"＠"确实存在(`0x5831FD0` 的 Il2CppString,使用槽 `0x557b708`),
  但用 `work/scratch/xref2.py` 全代码段扫描:**该槽在整个 .so 里只被一个地方装载**:

```
0x24f3c38 adrp x0, #0x557b000
0x24f3c3c ldr  x0, [x0, #0x708]     ; &'＠'
0x24f3c40 bl   #0x22304a4           ; 字面量注册(类型 cctor 内联体)
```

即 `BoxGachaResultEffectComponent` 的类型初始化里注册了 `"[k]"`(0x24f3c2c)、`"＠"`(0x24f3c38)、
`"SCRIPT_ACTION_CODE_TALK"`(0x24f3c44)三个字面量,但**没有任何比较/解析代码再读它** —— 是当前版本里
用不上(或改由 `codeTalkString` 取代)的残留字面量。`＄` 则连字面量都不存在(`stringliteral.json` 中 0 条)。

### C.3 同机制的第二个入口:`CommonMessageManager`(消息文本管线)

`CommonMessageManager`(`public class CommonMessageManager : ScriptMessageManager`)有同名字段:

| 字段 | 偏移 | 初始化 VA |
|---|---|---|
| `codeCommentString` | 0x240 | `0x3165c28-0x3165c38` |
| `codeTalkString` | 0x248 | `0x3165c44-0x3165c54` |
| `codeVoiceString` | 0x250 | `0x3165c60-0x3165c70` |
| `codeReturnString` | 0x258 | `0x3165c7c-0x3165c8c` |

(每个都是 `LocalizationManager.Get("SCRIPT_ACTION_CODE_*")`,调用点 `0x3165c30/0x3165c4c/0x3165c68/0x3165c84`)

`CommonMessageManager$$AnalysScript`(0x3165e68)对每条"消息行"同样判定:

```
0x31660fc bl  #0x4870d34   CALL StartsWith(line,"//")            ; 注释
0x3166114 bl  #0x4870d34   CALL StartsWith(line, this.codeCommentString)
0x3166128 bl  #0x4870d34   CALL StartsWith(line, this.codeTalkString)   ; ← ＠ 判定(字段!)
0x316612c tbz w0, #0, #0x31661dc                                  ; 不然测 codeVoiceString(0x250)
0x3166148 bl  #0x4876934   CALL line.Substring(1)                 ; 说话人名
0x3166168 bl  #0x4870cc0   CALL op_Equality(name,"k")             ; 名字=="k"?
0x3166184 bl  #0x4870cc0   CALL op_Equality(name,"q")             ; 名字=="q"?
```

`CommonMessageManager$$AnalysText`(0x3166c7c)是与 `ScriptManager$$AnalysText` 同构的逐字符扫描器
(`0x3166eb0 cmp w8,#0x22` / `0x3166eb8 cmp w8,#0x5b`,同 §A.2 规则)。

### C.4 顺带澄清:任务给的 `=spot` / `GetTalkName` 路径与 `＠` 无关

`ProcessScript` 的 `'=spot'`(`0x31bcac4`)及其后的修剪/`GetTalkName` 调用,属于**命令 `talkName` 的参数语法**:

```
0x31c0870 ldr x26, [x21]            ; x26 = pd[0] = [talkName 的参数字符串]
0x31c0890 bl  #0x4877124            CALL String.Contains(pd[0], "=spot")
0x31c08bc bl  #0x2019c04            ; new string[1]{"=spot"}
0x31c08d0 bl  #0x4876250            CALL String.Split(pd[0], ["=spot"], 1)
0x31c08f0 ldr x26, [x0, #0x20]      ; parts[0] = 名字文本
0x31c0900 bl  #0x4877050            CALL String.TrimStart('[')     ; 0x5b
0x31c0910 bl  #0x48770a4            CALL String.TrimEnd(']')       ; 0x5d
0x31c0924 bl  #0x4874f2c            CALL String.Split(',')
0x31c095c mov x4, x26               ; x4 = 名字文本(不是 ＠!)
0x31c0964 bl  #0x31d6be0   CALL ScriptMessageLabel$$GetTalkName(out imageName, out className, out charaName, out charaIndex, talkName)
0x31c099c bl  #0x31d3b4c   CALL ScriptMessageCommonManager$$SetTalkName(this, 0, className, charaName, charaIndex, 0)
```

即 `[talkName <名字> =spot <立绘1,立绘2>]` 的解析;传给 `GetTalkName` 的正是 `=spot` 之前的那段文本,
与 `＠` 无关。**`＠` 只在 `AnalysScript` 的 `codeTalkString` 判定点(0x31a5cac / 0x3166128)进入系统。**

### C.5 播放器实现建议(可直接落地)

1. 行首 `＠` ⇒ 说话人:`speaker = line[1:]`(标记长度为 1),对应引擎 tag `talkName`(字段 0x670);
2. 行首 `＄` ⇒ **入口标签**:`label = line[1:]`,对应引擎 tag `label`(字段 0x660)——不是"章节/场景 id"
   (此前一版误标为 `scene`,已按 §C.3 的字段实证修正);`＃` 才是 `scene` tag(字段 0x668,本语料未用);
3. 行首 `＊` ⇒ 注释,跳过(`codeCommentString` 0x658;语料中无此类行,保留兼容);`//`/`#` 注释在本语料 0 行,
   引擎侧未见对应比较点(原文档的 `#`/`//` 注释说法无证据支持);
4. `[k]` ⇒ 结束当前说话人块 + 等待点击(§B.1);
5. `[wt X]` / `[twt X]` ⇒ 等价 `[wait time X]` / `[wait rtime X]`(§B.2);
6. 其余行:整行恰为一个 `[...]` 且 tag 在 `out/commands.json` 里 ⇒ 命令;否则 ⇒ 消息文本(保留全部 `[...]` 标记原样渲染)。

---

## D. 引号与转义

### D.1 引号 `"` 的语义:**把内部内容整体当普通字符**(不剥引号)

三处独立实现,语义完全一致(`ScriptManager$$AnalysText` / `ScriptMessageLabel$$AnalysTagParam` /
`CommonMessageManager$$AnalysText`):

**(1) `ScriptManager$$AnalysText` 0x31aa624**(token 累加循环内):

```
0x31aa624 cmp w8, #0x22
0x31aa628 b.eq #0x31aa6c8
0x31aa6c8 … bl #0x494f7e8 CALL Char$$ToString        ; 先把开引号变成字符串
0x31aa6f0 bl #0x4867ef8  CALL String$$Concat          ; x20 = x20 + '"'
0x31aa70c add w21, w19, #1
0x31aa710 bl #0x486c8a8  CALL String$$get_Chars       ; 内层循环:逐字符
0x31aa71c cmp w8, #0x22
0x31aa720 b.eq #0x31aa78c                            ; 遇下一个引号 → 结束(0x31aa78c: i=i+1)
0x31aa74c bl #0x4867ef8  CALL String$$Concat          ; 否则原样追加(不再判 '[' ']' ' ')
0x31aa790 ldr x1, [x27]  ; &'"'
0x31aa79c bl #0x4867ef8  CALL String$$Concat          ; 闭引号同样被追加
```

**(2) `AnalysText` 的括号组扫描分支 0x31aab60-0x31aabdc**:同样的"遇 `"` → 复制到下一个 `"` 为止",
且**在引号内部不识别 `[`/`]`**(深度计数器不动)、**不把空格当 tag 分界**
(`0x31aab1c` 的 `cmp w8,#0x20` 分支被跳过)。

**(3) `ScriptMessageLabel$$AnalysTagParam` 0x31d10c8 / 0x31d10f4 / 0x31d1124**:

```
0x31d10c0 bl #0x487cda8 CALL StringBuilder$$Append(c)     ; 当前字符(可能就是引号)
0x31d10c8 cmp w8, #0x22
0x31d10d0 … 0x31d10ec bl #0x486c8a8 CALL String$$get_Chars   ; 内层复制
0x31d10f4 cmp w8, #0x22 ; b.eq 0x31d111c                     ; 到闭引号为止
0x31d1120 mov w1, #0x22 ; 0x31d112c bl #0x487cda8 CALL Append('"')   ; 闭引号也追加
```

**(4) `CommonMessageManager$$AnalysText` 0x3166eb0 / 0x3166f90/(0x31671c4,0x31671f0)**:
`0x3166f3c` 起同样"复制到下一个引号 + 闭引号追加"。

**结论:引号不是转义/剥离机制,而是"整体保护"机制 —— 引号内的 `[`、`]`、空格全部失去结构意义;
引号本身保留在 token 里(引擎不做剥离)。**

### D.2 语料侧证据

全量扫描 1,867,761 行,含 `"` 的行**仅 3 行**,且恰好覆盖两种用法:

```
0400051740.txt : [input selectBranch skipStop "branchNotRouteSelect 4000517 4000574"]
0200021421.txt : "[#Once you eliminate the impossible, whatever remains,:　あ…][r]  [#no matter how improbable…]"
0300122130.txt : "…同上一行(另一章的同文本)"
```

- 第 1 行:引号保护**参数内的空格**(否则 `branchNotRouteSelect 4000517 4000574` 会被切成 3 个参数)。
- 第 2、3 行:整行(含 `[#…]`、`[r]` 等标记)被引号包住 → 按"普通文本"逐字处理,内部 `[` 不再触发括号组解析
  (对照 §A.2 的 0x31aa624/0x31aa6c8,以及后文的 `talkStart`)。

### D.3 转义:**语料里没有任何转义**

- 全量扫描:含反斜杠的行 **0 行**(`\n`、`\t`、`\r`、`\\`、`\"`、`\b`、`\f` 全部为 0)。
- 换行用真实换行符:语料按 LF 分行,行内无 CR。
- `AnalysScript` 里唯一与"转义"相关的是**真实 CR 字符** U+000D,用于规范化行尾:

```
0x31a54c4 ldr x8, [x8, #0x6f0]  ; &'\r'      ← 真 CR,不是两字符 "\r"
0x31a54dc bl  #0x48748dc  CALL System.String$$Replace(text, "\r", "")
0x31a5508 ldr x8, [x8, #0x348]
0x31a5510 bl  #0x491026c  CALL RuntimeHelpers$$InitializeArray(char[4])
0x31a5528 bl  #0x4875368  CALL System.String$$Split(text, char[4], 0)
```

⇒ **修正既有文档 §1 的"转义字面量 `\n \t \r \b \f \\` 出现在 AnalysScript 中"**:实际只有 `'\r'`(CR),
且它的用途是 `Replace` 行尾,而不是文本转义;脚本体内**不含任何反斜杠转义**。
(另:文件被 `String.Split` 按一个 4 元 `char[]` 分隔符切分,该数组内容未在本次定位成功,
见 §E 未解决项;不影响"按行解析"的结论。)

---

## E. 未解决 / 存疑

1. ~~**本地化表本身不在 APK 内**……~~ **【已收口 · 补证】**
   本地化表**就在 APK 基础包内**:`work/extract/assets/bin/Data/data.unity3d` 的 TextAsset **`LocalizationJpn`**
   (349,803 字节 JSON)。已读出全部 `SCRIPT_ACTION_CODE_*` 定义 —— `＠`(TALK)/`＄`(LABEL)/`＃`(SCENE)/
   `？`(SWITCH_CASE)/`：`(SPLIT)/`；`(HIDDEN)/`？！`(SWITCH_END)/`＊`(COMMENT)/`％！`(INSERT)/`％％`(VOICE)/`￥`(RETURN)
   —— **字符全部实证**,并把"标记 → 内部 tag"钉死:`＄`→`label`(字段 0x660)、`＃`→`scene`(0x668)、`＠`→`talkName`(0x670)。
   证据表:`work/out/_evidence/marker-table.md`;摘要见本文 **§F**。
   推论修正:`＄01-00-00-00-1-0` **不是"section id/章节头",而是该脚本的入口跳转标签**(`label 01-00-00-00-1-0`)。
2. `AnalysScript` 在若干 marker 分支后会进入一个对 tag 的 `op_Equality` 长链
   (`0x31a5cf8` 比较 `"k"`、`0x31a5d14` 比较 `"q"`、`0x31a5e2c` `"talkName"`、`0x31a5e48` `"selectionUse"`、
   `0x31a5e60` `"switchCase"`、`0x31a5e80` `"switchCaseEnd"`、`0x31a5e9c` `"menu"`、`0x31a5eb8` `"notification"`、
   `0x31a5ed4` `"input"` …)。这些分支的**完整控制流**(谁在什么条件下跳入)尚未逐块复原;
   但 `0x31a5edc` 处把 `Substring(1)` 结果写入 `[sp+0x60]`(talkName)是已证实的。
3. `AnalysText` 对 `[k]` 追加的 `null` tag 条目(`0x31ad5ec`)在运行期的消费位置未定位
   (`ProcessScript` 取 tag 用 `ldr x25,[x20]`(0x31bd140)后直接哈希,未见 null 分支处理;可能是"空消息"占位)。
4. `ScriptManager$$AnalysScript` 切分文件用的 4 元 `char[]` 分隔符内容未解(元数据静态数组 blob 需经
   `global-metadata.dat` 解析)。语料实测为 LF 分行。

---

## F. 控制符全表与选项语法(补证:来源为 APK 内置本地化表)

### F.1 控制符 = 本地化表键值,不是硬编码字符

`ScriptManager$$Initialize` 把本地化键的取值读入实例字段(x19=this):

```
0x31a10b4  ldr  x23, [x23, #0x830]  ; &'SCRIPT_ACTION_CODE_LABEL'
0x31a10b8  ldr  x27, [x27, #0x820]  ; &'SCRIPT_ACTION_CODE_SCENE'
0x31a10bc  ldr  x26, [x26, #0x710]  ; &'SCRIPT_ACTION_CODE_TALK'
0x31a1138  bl   #0x2e58030  CALL LocalizationManager$$Get   ; Get([x23])
0x31a1140  str  x0, [x19, #0x660]                          ; 字段0x660 := '＄'
0x31a1154  bl   #0x2e58030  CALL LocalizationManager$$Get   ; Get([x27])
0x31a115c  str  x0, [x19, #0x668]                          ; 字段0x668 := '＃'
0x31a1170  bl   #0x2e58030  CALL LocalizationManager$$Get   ; Get([x26])
0x31a1178  str  x0, [x19, #0x670]                          ; 字段0x670 := '＠'
```

`ScriptManager$$AnalysScript` 逐行 `StartsWith(字段)` 并转换 tag:

```
0x31a5c6c  ldr  x1, [x21, #0x660]                  ; '＄'
0x31a5c78  bl   #0x4870d34  CALL String$$StartsWith
0x31a5c84  ldr  x8, [x8, #0xd80]  ; &'label'       ; ⇒ tag = "label"
0x31a5c8c  ldr  x1, [x21, #0x668]                  ; '＃'
0x31a5c98  bl   #0x4870d34  CALL String$$StartsWith
0x31a5ca4  ldr  x8, [x8, #0xbb8]  ; &'scene'       ; ⇒ tag = "scene"
0x31a5cac  ldr  x1, [x21, #0x670]                  ; '＠'
0x31a5cb8  bl   #0x4870d34  CALL String$$StartsWith
0x31a5cc4  ldr  x8, [x8, #0xfb8]  ; &'talkName'    ; ⇒ tag = "talkName"
0x31a5cd8  Substring(1)
```

值来自 `work/extract/assets/bin/Data/data.unity3d` → TextAsset **`LocalizationJpn`**(349,803B JSON):

| 键 | 值(码位) | 语料行首出现次数 |
|---|---|---|
| `SCRIPT_ACTION_CODE_LABEL` | `＄` U+FF04 | 2,582(每文件 1 行,值=文件名派生的入口标签) |
| `SCRIPT_ACTION_CODE_TALK` | `＠` U+FF20 | 184,792 |
| `SCRIPT_ACTION_CODE_SWITCH_CASE` | `？` U+FF1F | 29,882(=18,198 选项行 + 11,684 `？！`) |
| `SCRIPT_ACTION_CODE_SWITCH_END` | `？！` U+FF1F U+FF01 | (含于上)11,684 |
| `SCRIPT_ACTION_CODE_SCENE` | `＃` U+FF03 | 0 |
| `SCRIPT_ACTION_CODE_COMMENT` | `＊` U+FF0A | 0 |
| `SCRIPT_ACTION_CODE_SWITCH_CASE_SPLIT` | `：` U+FF1A | (行内) |
| `SCRIPT_ACTION_CODE_SWITCH_CASE_HIDDEN` | `；` U+FF1B | 0 |
| `SCRIPT_ACTION_CODE_INSERT` | `％！` U+FF05 U+FF01 | 0 |
| `SCRIPT_ACTION_CODE_VOICE` | `％％` U+FF05 U+FF05 | 0 |
| `SCRIPT_ACTION_CODE_RETURN` | `￥` U+FFE5 | 0 |
| `SCRIPT_ACTION_CODE_CLASS_SPLIT` | `：` U+FF1A | `GetTalkName` 的称号/名字分隔(0x31d6ca8) |

同表还有一条与等待模型直接相关的正则:
`SCRIPT_ACTION_NOT_SET_AUTO_WAIT_TARGET = '(wt|k)'`(不计入自动播放等待字数的行)。

> 播放器提示:控制符随语言/版本可变,应像引擎一样**把控制符当配置读取**(或至少按上述字符集处理并把
> `＃`/`＊`/`％％` 等纳入语法),不要在实现里写死为"仅 `＠`/`＄`"。

### F.2 选项(分支)语法:`？<n>：<文本>` … `？！`

全量统计:选项行 18,198、`？！` 11,684。示例(`Anti-Primate Biosphere Tunguska Sanctuary/0300110110.txt:82`):

```
＠マシュ
…………先輩。[r]これはいったい、どういう事なのでしょう……
[k]

？1：[&ああ:うん]……
？2：まさかの行動制限だね……

？！

[charaFadeout A 0.1]
```

要点:
- `？<n>：<选项文本>` 一选项一行;`：` 之后是显示文本,可含全部消息内联标记(含 `[&男:女]`)。
- 块以独占一行的 `？！` 结束。
- 选项文本会进回想日志(`ScriptLoop.switchCaseMessage` / `SetSelectLogMessage`,dump.cs:4831);
  是否分支由 `ScriptLoop` / `selectBranch` 机制决定(以上示例为无分支台词选项)。
- 部分选项文本带 `[&…]`(性别)与 `[#…]`(注音)标记,见 §D/`supplement-markup.md`。

---

## 附:本文引用的关键 VA 速查

| 主题 | VA | 内容 |
|---|---|---|
| 行分类(命令/消息) | 0x31aa624 / 0x31aa62c / 0x31aa634 / 0x31aaabc | `'\"'` / `'['` / token 非空再遇 `[` → `messageLine=true` |
| tag 切分 + 哈希 | 0x31aab1c-0x31aab28 / 0x31aac0c-0x31aac14 | 首个空格前 = tag;`ComputeStringHash` |
| `k`(AnalysText) | 0x31ab554 / 0x31ab55c / 0x31ad4d8 / 0x31ad540 / 0x31ad594 / 0x31ad5ec | talkEnd + `lastMessageIndex=-1` + null 条目 |
| `k`(ScriptCommandExecute) | 0x3179fbc / 0x317fa08 / 0x317fa40 / 0x318f014 | `state=WAIT`,`waitType="k"`,无参校验 |
| `k`(ProcessScript) | 0x31c24e0 / 0x31c250c / 0x31c2550 | `WaitNextTouch(isShowNextTouchObject=true)` |
| `wt` / `twt` | 0x31aca2c→0x31ad6cc / 0x31ac4fc→0x31ac500 | → `wait`+`time ` / `wait`+`rtime `,`Substring(3)` |
| `wait` 子键树 | 0x31874d8 / 0x3187530-0x318753c / 0x3193728(time) / 0x3191fc4(rtime) / 0x31937dc(frame) | `waitType=pd[0]` |
| `time` vs `rtime` | 0x31bc2a8 / 0x31bc2b8 / 0x31bc2d8-0x31bc2f4 | unscaled vs scaled delta |
| `＠`/`＄` 标记 | 0x31a1114-0x31a125c(Initialize) / 0x31a5c6c / 0x31a5c8c / 0x31a5cac / 0x31a5cd8 | code*String = LocalizationManager.Get(key) |
| `＠` 字面量 | 0x5831FD0(数据) / 0x24f3c38(唯一装载点) | 未被比较的残留字面量 |
| `talkName` 命令 | 0x31c0870-0x31c099c | `=spot` 分割 + `GetTalkName` + `SetTalkName` |
| 引号 | 0x31aa624/0x31aa6c8-0x31aa79c、0x31d10c8-0x31d112c、0x3166eb0/0x3166f3c | 原样保护,不剥离 |
| 行尾/切分 | 0x31a54c4(Replace CR) / 0x31a5528(Split) | CR 归一化 |

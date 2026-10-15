# 命令覆盖度补遗(哈希常量反解 · effectmessage · k/wt · 参数对拍 · 零出现命令)

对 `out/commands.json`(366 条命令)做**覆盖度收口**:把 383 个哈希常量的最后 17 个无名项查清、
把语料里高频但表外的 tag 归档、用真实剧本对拍参数形态、列出 118 条零出现命令。

证据约定:所有 VA 为 `libil2cpp.so` 虚拟地址;`.rodata`/字符串字面量由**重定位槽位反解**(`tools/resolve_strings.py`)给出;
未经证实的推断标 `INFERRED`。**不改动 `out/` 下已有文档**,本文件是补充卷。
所有数字来自真实语料 2583 个 `.txt`(33 章)与全函数反汇编复扫(见文末"复核命令")。

---

## TL;DR

| 项 | 结论 |
|---|---|
| 383 个哈希常量 | 实为 **384** 个:366 个 = tag 树叶子(= 命令表) + **13 个 = `wait` 关键字叶子** + **5 个 = 判定树边界(= 某命令哈希+1)**。`hash_constants.json` 漏收 1 个边界(`0x8643a3f7`) |
| 两张哈希树 | `ScriptCommandExecute` 内有**两个** `ComputeStringHash` 调用:tag 树(0x3178ffc,root 0x3179000,366 键)+ **waitType 树**(0x3187530,root 0x3187544,72 键);后者的输入是 `this.waitType`(0x3d8),来源是 `wait` 的 pd[0](0x3187514) |
| `effectmessage` | **不是 tag 树命令**。它是 ①`wait` 关键字(叶子 0x31920a8)→ 设 `waitName`;②`AnalysText` 特判(0x31aeca8,做特效资产校验);③`ProcessScript` 特判(0x31c02f4,查 `MessageEffectIsBusy(waitName)`)。语料 12 次 `[effectmessage bit_talk_* x,y t n]` 由 ②③ 承接 |
| `k` | handler `0x317fa28`:无参 → `state=WAIT(4)`(0x317fa40)+ `waitType="k"`(0x318f014)+ 返回 `Normal`;带参 → 报 `'parameter be unnecessary'`(0x3186640)。**最小=最大=0 参**,与语料 184,799 次 `[k]` 一致 |
| `wt`/`twt` | 都是 `AnalysText` 的**行改写宏**。`wt`→`wait time <t>`(`&'time '` 0x31ad724);`twt`→`wait rtime <t>`(`&'rtime '` 0x31ac55c)。语义 = 等秒:`waitCount(0x3e4) = Single::Parse(pd[2])`(0x3193790-0x3193798);0 秒则直接跳过(0x3193794) |
| 参数对拍 | 前 60 tag:**39 条与表一致**;**6 处文档漏参**(cameraMove 第 4 值、bgm 第 3 值、effect 的 `x,y`、subCameraFilter、subRender 系列、charaEffect* 系列);**3 处文档与语料/自身矛盾**(specialEffect min=9、se min=5、若干 pd 类型记错) |
| 零出现命令 | 118/366 条语料未观察到(战斗战棋 10、御主立绘 6、信息窗/插入动画/FSM/CRI 音频等);见 §E |

---

## A. 383 个哈希常量的最后 17 个无名项

### A.0 方法与两张树的分界(硬证据)

单条 `bl ComputeStringHash` 只有一处不能说明结构,全函数扫描后是**两处**:

| 树 | 哈希调用 | 哈希输入 | 双分树根 | 叶子键数 |
|---|---|---|---|---|
| tag 树(判定"这是哪条命令") | `0x3178ffc` | `x25 = [x22]`,x22 = `<>c__DisplayClass808_0.tag`(prologue `str x25,[x22,#0x20]!` @0x3178fc4) | `0x3179000` | **366**(结构化遍历 = `commands.json` 的 366 个名字,逐一命中) |
| waitType 树(`wait` 的 pd[0] 子分派) | `0x3187530` | `x22 = [x19,#0x3d8]` = `ScriptManager.waitType` | `0x3187544` | **72**(= `_evidence/wait_keys.json` 的 keys) |

`waitType` 的写入点实证:`wait` 命令体 `0x3187514 ldr x1,[x8,#0x20]`(pd[0])→ `0x318751c str x1,[x19,#0x3d8]`。

把 384 个常量(383 + 补 1)按"是否有 `cmp;b.eq/b.ne` 叶子站点"分类:

- **378 个叶子键**:366 个 tag + 12 个 wait 关键字(`charaCut/charaCutStart/charaFade/communicatioChara/effectmessage/effectmessageStart/fastPlayDraw/frame/fsmObjFinished/masterverticalImageSet/rtime/time`)
- **6 个"仅边界"常量**:5 个 = 某命令哈希 **+1**(见 A.2),1 个(`0x828e5c3b`=`fnv('skippableTime')`)实际也是叶子(它的叶子写成 `cmp;b.hi X;b.eq Y` 两分支,旧扫描只记了 `b.hi`)

### A.1 13 个 wait 关键字叶子(全部带字面量反解)

证据列给的是 **字面量加载指令**(`adrp+ldr` 解出 `&'名字'`)与**等价性校验指令**(`System.String$$op_Equality`)。

| 常量(hex) | 反解名 | 叶子判定 `cmp` | 校验块 / 字面量加载 VA | 目标块 | 备注 |
|---|---|---|---|---|---|
| `0x8714dc7c` | `charaCut` | `0x318b74c b.eq` | `&'charaCut'` @`0x3193084`,op_Equality @`0x3193094` | 0x3193080 | 语料 `[wait charaCut …]` 14 次 |
| `0x3365dc30` | `charaCutStart` | `0x318f200 b.ne` | `&'charaCutStart'` @`0x318f20c`(共享校验尾 `b 0x3193088`) | — | 同族别名,语料 0 次 |
| `0x1322c812` | `charaFade` | `0x31920c4 b.eq` | `&'charaFade'` @`0x3193714` | 0x3193710 | `ProcessScript` 对 waitType=="charaFade" 另有分支(`0x31bc9a4`) |
| `0x0ca51292` | `communicatioChara` | `0x31907a8 b.ne` | `&'communicatioChara'` @`0x31907bc`,op_Equality @`0x31907c4` | — | 语料写作 `[wait communicationChara …]`(813 次,拼写不带尾 i) |
| `0xf8e02873` | `effectmessage` | `0x31920a8 b.ne` | `&'effectmessage'` @`0x31920b4` → `b 0x319350c`,op_Equality @`0x3193518` | 0x3193520 | 见 §B;`effectmessageStart` 共享其校验尾+命令体 |
| `0x46720de1` | `effectmessageStart` | `0x319222c b.eq` | `&'effectmessageStart'` @`0x3193508` | 0x3193504 | 与 `effectmessage` **同体**;语料 0 次 |
| `0x83be074b` | `fastPlayDraw` | `0x31923d0 b.eq` | `&'fastPlayDraw'` @`0x31935b8`,op_Equality @`0x31935c0` | 0x31935ac | 语料 `[wait fastPlayDraw …]` 5 次 |
| `0xd20a71a6` | `frame` | `0x31921e0 b.eq` | `&'frame'` @`0x31937e0`,op_Equality @`0x31937f0` | 0x31937dc | 与 `rtime` 同体(帧/实时等待) |
| `0x4e57d930` | `fsmObjFinished` | `0x318d948 b.ne` | `&'fsmObjFinished'` @`0x318d954` | — | 语料 6 次 |
| `0xc7630faa` | `masterverticalImageSet` | `0x318d9a4 b.ne` | `&'masterverticalImageSet'` @`0x318d9b0` | — | 游戏自带拼写错误(小写 v),必须原样匹配 |
| `0x58666514` | `rtime` | `0x3191fbc b.ne` | `&'rtime'` @`0x3191fc8` | — | `ProcessScript` 另有 waitType=="rtime" 分支(`0x31bce60` 字面量引用) |
| `0x828e5c3b` | `skippableTime` | `0x3190924 b.hi` + `0x319092c b.eq` | `&'skippableTime'` @`0x3193188` | 0x3193184 | 双分支叶子;`ProcessScript` 另有分支(`0x31bcc8c/0x31be868`) |
| `0x5d3c9be4` | `time` | `0x31921a4 b.eq` | `&'time'` @`0x319372c`,op_Equality @`0x319373c` | 0x3193728 | 见 §C.2(wt 改写目标) |

> 13 个名字全部**同时**出现在 `_evidence/wait_keys.json` 的 72 关键字表中,互为独立佐证。
> 语料侧佐证:`[wait <关键字> …]` 形态确有 `charaCut/fsmObjFinished/fastPlayDraw/insertionAnimation*` 等用法(见 `[wait …]` 统计)。

### A.2 5 个判定树边界(不是命令,是"某命令哈希 + 1")

推导:这些常量**只有 `cmp;b.hs` 边界站点**(无 op_Equality 叶子),且值 = `fnv(已收录命令名) + 1`。
这是 LLVM 把 `if (hash > K) goto RIGHT` 下沉为 `cmp hash, K+1; b.hs RIGHT` 的产物。

| 常量(hex) | = fnv(名)+1 | 边界站点(命令区树) | 边界站点(waitType 树) | 被 +1 的原键(叶子 VA) |
|---|---|---|---|---|
| `0x22da84bb` | `charaMoveEaseFSR` (0x22da84ba) | `0x3179020 mov w8,#0x84bb` / `0x3179024 movk w8,#0x22da,lsl#16` / `0x3179028 cmp w0,w8` / `0x317902c b.hs 0x3179314` | `0x318754c/0x3187554 b.hs 0x318f1c8` | 0x22da84ba 叶子(命名项) |
| `0x4a6c6c30` | `backEffect` (0x4a6c6c2f) | `0x3179164 movk` / `0x3179168 b.hs 0x317aa24` | `0x3187544/0x318754c b.hs 0x318d900` | 同上 |
| `0xe6ad339f` | `masterVerticalImageChange` (0xe6ad339e) | `0x31794e8 movk` / `0x31794ec b.hs 0x317c64c` | `0x318d960/0x318d964 b.hs 0x318f2ac` | 同上 |
| `0xae20810e` | `fowardEffect` (0xae20810d) | `0x317baac movk` / `0x317bab0 b.hs 0x317e39c` | `0x31908e4/0x31908e8 b.hs 0x31922c4` | 同上 |
| `0x8643a3f7` ⚠️ | `fsmObjSet` (0x8643a3f6) | `0x31790dc mov w26,#0xa3f7` / `0x31790e0 movk w26,#0x8643,lsl#16` / `0x31790e4 cmp w0,w26` / `0x31790e8 b.hs 0x317a9d8` | 未出现(单站点) | — |

⚠️ `0x8643a3f7` **不在** `il2cpp_out/hash_constants.json`(383 项)里 —— 旧脚本的 4 条指令窗口漏读;本次全量复扫(595 站点/384 常量)补齐。因此"A. 383 个常量"的真实总数是 **384**。

**结论**:17 个"无名常量"里 **0 个是真正的独立命令** —— 13 个 = `wait` 关键字(A.1),4 个 = 边界值(A.2)。
"无名"只是**不属于 366 命令表**的同义词,不是"未知命令"。

---

## B. `effectmessage`:为什么它不在命令表,以及它的参数到底在哪

### B.1 三处归属(三份硬证据)

| # | 位置 | VA 证据 | 作用 |
|---|---|---|---|
| ① | `ScriptCommandExecute` **waitType 树**叶子 | `0x31920a8 movz/movk→0xf8e02873` + `b.ne`;校验 `0x31920b4 &'effectmessage'` → `b 0x319350c` → op_Equality `0x3193518` → `tbz w0,#0,0x3193920` | `[wait effectmessage <名>]`:`0x3193564 ldr x1,[x8,#0x30]`(pd[2])→ `0x3193570 ConvertTalkEffectName` → `0x3193578 str x0,[x19,#0x3e8]`(**waitName**);`0x3193598 strb wzr,[x19,#0x3c0]`(isRequestEffect=false);`0x319359c b 0x3193f04`(返回 Continue) |
| ② | `ScriptManager.AnalysText` **行分类树**叶子 | `0x31aeca8 movz/movk→0xf8e02873` + `b.ne 0x31ae83c`;`0x31aecb8 &'effectmessage'` → 共享尾 `0x31af310` op_Equality(`0x31af31c`) | 取 `pd[0]`(`0x31af330 ldr x1,[x20,#0x20]`)→ `0x31af74c ConvertTalkEffectName` → `0x31afd04 CommonEffectManager.GetAssetName`(资产存在性校验/预载登记) |
| ③ | `ScriptManager.ProcessScript` 执行循环 | `0x31c02f4 &'effectmessage'` → `0x31c02fc op_Equality` → `0x31c0304/0x31c030c ldr x1,[x19,#0x3e8]`(waitName)→ `0x31c0314 ScriptMessageCommonManager$$MessageEffectIsBusy` → `0x31c0318 tbz`(不忙则继续下一行,忙则等待) | 把该行当"消息窗特效"处理,等待它播完 |

消息窗侧另有字面量引用:`ScriptMessageCommonManager$$UpdateLabels` prologue `0x31d010c &'effectmessage'`、`ScriptMessageLabel$$UpdateBouten` `0x31cea3c`。

### B.2 `effectmessage` 参数表(补录)

语料 12 次全部是 `[effectmessage <bit_talk名> <x>,<y> <时长> <整数>]`:

| pd | 类型 | 含义 | 证据 VA | 置信度 |
|---|---|---|---|---|
| 0 | string | 对话特效名 → `Talk/<名>` | `AnalysText 0x31af330 → 0x31af74c ConvertTalkEffectName`;同名 `effectmessageStop` 自己的 handler `0x31814d8 ldr x1,[x8,#0x20]` → `0x31814e4` | high |
| 2 | int | X 坐标 | 语料 12/12;`[effectmessage bit_talk_hknf_text 440,179 1.5 48]` | medium(消费点在消息窗侧,未逐条回读) |
| 3 | separator | `,`(坐标形式) | 同上 | medium |
| 4 | int | Y 坐标 | 同上 | medium |
| 6 | float | 时长(秒;语料 0.8–6.2) | 同上 | medium |
| 8 | int | 未知(语料 13–48 浮动) | 同上 | low `INFERRED`(疑似文字长度/速度/帧数,需实机对拍) |

> ⚠️ **与 §A 的无冲突解释**:`wait` 关键字形态的 `[wait effectmessage <名>]` 用 **pd[2]** 当名(pd[0]="effectmessage" 占位);
> 顶层 tag 形态 `[effectmessage <名> …]` 用 **pd[0]** 当名。两者由 ②③ 与 ① 分别承接,不矛盾。

### B.3 顺带核对(表内命令 × 语料)

| 命令 | 表(min/参数) | 语料形态 | 判定 |
|---|---|---|---|
| `effectmessageStop` | min=1,pd[0]→ConvertTalkEffectName(`0x31814d8/0x31814e4`) | 12 次 `[effectmessageStop <bit_talk名>]` | **一致** ✓ |
| `effectmessageDestroy` | min=1,同形(`0x3181ce4/0x3181d04`) | 0 次 | 表内,语料未见 |
| `charaCutin` | min=5,**params=[]** | 16 次 `[charaCutin H leftToRight 0.1 1.0]` / `[charaCutin F upToDown 0.1 0]` | **文档漏参** → 见下 |
| `insertionAnimationStart` | min=null,params=[] | 1 次 `[insertionAnimationStart ac_fude_triangle_slide_R cut530_ior_06]` | **文档漏参**(2 值) |
| `insertionAnimationEnd` | min=null,params=[] | 1 次 `[insertionAnimationEnd ac_fude_triangle_slide_R]` | 文档漏参(1 值) |
| `specialEffect` | min=**9**,pd[0,2,4,6] | 8 次 `[specialEffect cutting]`(仅 1 参) | **矛盾**:处理器首检是 `0x3187610 cmp w9,#1` + `0x3187614 b.lt 0x3193e80`;后续分级守卫 `#3 @0x318764c`、`#5 @0x318767c` ⇒ min 记 9 会**拒绝全部真实用法** |
| `specialEffectStop` | min=1,pd[0]→ConvertNameString | 0 次 | 表内,语料未见 |
| `specialEffectPuase` | 与 `specialEffect` 同 handler `0x3187604`(别名) | 0 次 | 表内,语料未见(名字自带拼写错误) |

`charaCutin` 参数回读(handler `0x31855fc`):
`0x3185608 cmp w9,#5; b.lt 0x3191820`(min=5) → `pd[0] 0x318566c→ConvertCharaIndex 0x3185678` ·
`pd[1] 0x318561c vs ' '` · `pd[2] 0x31856b0→ConvertNameString 0x31856bc`(方向名) ·
`pd[3] 0x3185644 vs ' '` · `pd[4] 0x31856d8→Single::Parse 0x31856e0` · `pd[6] 0x3185700→Single::Parse 0x3185708`
⇒ 语料第 4 个值(1.0/0)读得到,**漏的是 pd[0..6] 全部**,置信度 high。

---

## C. `k` 与 `wt`/`twt` 的真实语义

### C.1 `k` —— "消息送り待ち"(等一次性推进),0 参数

| 事实 | VA + 指令 |
|---|---|
| 入口 | handler `0x317fa28`(commands.json 已收录,`min_token_count=null` 应记 0) |
| 参数上限 | `0x317fa30 ldr x8,[x8,#0x18]`(pd.Length)→ `0x317fa34 cbnz x8,#0x318663c`;`0x3186640 ldr x8,&'parameter be unnecessary'` ⇒ **带参即报错**(所以是"0 参",不是"未定") |
| 无参分支 | `0x317fa3c mov w8,#4` → `0x317fa40 str w8,[x19,#0x288]` = `State.WAIT`(`ScriptManager.State` 0x288,`WAIT=4`) |
| 等待类型 | `0x317fa44 b 0x318f014` → `0x318f014 str x1,[x19,#0x3d8]` = `waitType = "k"`(x1 来自 `0x317fa14 ldr x23,[x23,#0xf98] ; &'k'`);`0x318f018 add x0,x19,#0x3d8` → `0x3193e94 bl wbarrier` → `0x3193f00`(返回 `Normal`) |
| 语料角色 | 184,799 次,全部 `[k]` 无参,**总紧跟消息行后**(例 `0300110110.txt:80-81` 台词 → `[k]` → 下一条台词)= 等玩家点击推进 |
| 旁证 | `AnalysText` 树对 `'k'` 有叶子(`0x31ab54c`,`0x31ab55c &'k'`);`ProcessScript` 树对 `'k'` 有叶子(`0x31c24e0`,`0x31c24fc &'k'`)⇒ 与等待/消息状态机联动 |
| 连带发现 | `q`(handler `0x318662c`):无参 → `0x318b298 strb w8(=1),[x19,#0x375]` = `isCancelInput=true`(`0x375` 字段名实证于 dump.cs);带参 → 同一 `'parameter be unnecessary'` 路径。⇒ `[q]` = 取消/清除输入等待 |

### C.2 `wt` / `twt` —— 行改写宏(不是命令,也不是 wait 关键字)

| 事实 | VA + 指令 |
|---|---|
| `wt` 识别 | `AnalysText` 树 `0x31aca24 movz/movk→0x4b4794e6 (=fnv('wt')) ; b.eq 0x31ad6cc`;`0x31ad6e0 op_Equality(tag,'wt')` |
| `wt` 改写 | 加载 `&'wait'`(`0x31ad6f8`)与 **`&'time '`(带尾空格,`0x31ad724`)** → `0x31ad704 bl 0x201abc4`(String.Concat 系)→ 行变成 **`wait time <t>`** |
| `twt` 识别 | 叶子 `0x31ac4f4 (0xb32476d8)` → `0x31ac518 op_Equality(tag,'twt')` |
| `twt` 改写 | `&'wait'`(`0x31ac530`)+ **`&'rtime '`(`0x31ac55c`)** → **`wait rtime <t>`**(`rtime` = 真实时间等待;语料 0 次) |
| 秒数语义 | `time` 关键字叶子 `0x31921a4 b.eq 0x3193728`;守卫 `0x3193750 cmp w9,#3; b.lt 0x3193e80`(缺 pd[2] 即参数错误)→ `0x3193788 ldr x0,[x8,#0x30]`(pd[2])→ `0x3193790 Single::Parse` → **`0x3193798 str s0,[x19,#0x3e4]` = `waitCount`**;`0x3193794 fcmp s0,#0.0` + `0x319379c b.eq 0x3193854`(0 秒直接跳过) |
| `rtime`/`frame` 同体 | `0x3193844 Single::Parse`(相同形状),即 `rtime`/`frame` 在**解析层面**与 `time` 等价;差别在倒计时侧(`ProcessScript` 对 waitType 字符串另有分支,refs: rtime `0x31bce60`、skippableTime `0x31bcc8c/0x31be868`、charaFade `0x31bc9a4`)= `INFERRED` |

**语料形态核对**(与任务给定数字一致):

| 写法 | 次数 | 解析结果 |
|---|---|---|
| `[wt 1.0]` | 114,016 | float → `waitCount=1.0` ✓ |
| `[wt 2]` | 231 | int 文本,`Single::Parse("2")=2.0` ✓(与 `wait time 2` 等价) |
| `[wt 0,3]` | 3 | 改写成 `wait time 0,3` → pd=[time,' ','0',',','3'] → **时间只取 pd[2]='0' ⇒ 等 0 秒(立即继续)**;`,3` 被忽略 → 疑似作者把 `0.3` 写成 `0,3`(不是解析错误,证据 `0x3193788/0x3193794`) |
| `[wt 1.]` | 1 | `Single::Parse("1.")`=1 ✓(usage 里被归为 str 类,实为 float 写法) |

> 与主文档的关系:`params-misc.md` 已把 `wt` 记为"非分派命令";本卷补上**改写目标**(time/rtime)与**秒数写入点**的 VA。

---

## D. 参数形态对拍(使用量前 60 的 tag × 真实语料 × 表)

方法:直接解析 2583 个剧本的每一行,按 `AnalysParam` 的分词语义(值 + 分隔符 `' '`/`','`)算出 **pd 元素数**与每个下标的值类型,
再与 `commands.json`(命令表)+ `command_params.json`(参数总表)比对;不一致时回读 handler 的
`ldr wK,[x8,#0x18]; cmp wK,#N` 边界与 `ldr x?,[x8,#0x20+8i]` 读取点。

### D.1 一致(抽样列出,均有完整形态统计)

| tag | 表 min | 语料元素数 | 语料主形态 |
|---|---|---|---|
| `charaFace` | 3 | 3(全部) | `[charaFace A 5]` |
| `charaFadeout` | 3 | 3 | `[charaFadeout A 0.1]` |
| `charaFadein`/`FSR`/`FSL` | 3 | 3 / 5 / 7 | `[charaFadein A 0.4 1]`、`[… 0.4 150,0]`;`pd[4]=位置下标 或 X`,`pd[6]=Y` ✓ 与 `params-visual.md` 一致(仅 `commands.json` 未列 pd[2]) |
| `charaDepth`/`charaScale`/`charaFadeTime`/`charaMoveScale`/`charaFaceFade`/`charaFilter` | 3–5 | 3–5 | `[charaDepth A 100]` 等 |
| `charaSet`/`sceneSet`/`imageSet` | 3 | 5 / 7 | `[charaSet A 100100 2]` |
| `charaShake` | 9 | 9(全部 2661) | `[charaShake A 0.3 0.05 8 4]` |
| `shake` | 7 | 7(全部) | `[shake 0.3 0.05 8 4]` |
| `charaMoveEase` | 9 | 9(全部 2559) | `[charaMoveEase A 0,0 0.2 expo]`、`[… 0 -30 0.2 expo]` |
| `seVolume` | 5 | 5(全部 10187) | `[seVolume SE vol 0.3]`(第 2 值 int 写法也进 `Single::Parse`) |
| `cueSeVolume`/`charaFadeTime`/`charaFaceFade`/`charaFadeTime` | 5 | 5 | — |
| `wipein`/`wipeout` | 5 | 5(98%+;少量 3) | `[wipein cut_01 0.5 0.8]`;**第 3 值 int/float 皆可**(`0x317ea34 Single::Parse`) |
| `cueSe` | 7 | 3 / 5 / 7 | `[cueSe <名> <名> <vol> <fade>]`(7 元素为主) |
| `bgmStop`/`subRenderDepth`/`charaFilter`/`label`/`charaTalk`/`wait`/`charaMove`(5–9 区间内) | — | 表内区间 | — |

### D.2 文档漏参(语料用到、表里没有的下标;全部回读了 handler)

| tag | 漏掉的 pd | 语料用法 | handler 证据(VA + 指令) | 置信度 |
|---|---|---|---|---|
| `cameraMove` | **pd[6]**(第 4 个值 = 缩放) | 2505/2507 次:`[cameraMove 0.1 0,-30 1.2]`;也可写成第二个逗号 `[cameraMove 0.1 0,30,1.4]` | 守卫 `0x3186964 cmp w9,#7; b.lt 0x318f964`;`0x3186988 String$$get_Chars` + `0x3186990 cmp w8,#0x20; b.ne 0x318f964`(pd[5] 首字符判空格,否则走逗号分支);缩放解析 `0x318f95c Single::Parse` | **high** |
| `bgm` | **pd[4]**(第 3 个值,第二个 float) | 3260 次:`[bgm BGM_MAP_57 0.1 0.9]` | `0x3182610 cmp w9,#4` → `0x3182618 ldr x0,[x8,#0x40]` → `0x3182620 Single::Parse` | **high**(含义=第 2 个 float,疑似淡入时间:'INFERRED') |
| `effect` | **pd[2]/pd[4]**(`x,y` 坐标形式)的消费点不在 handler 内 | 486 次:`[effect bit_talk_explosion_triple02 -450,100]` | handler `0x3180b70`(与 `effectPause` 同体,min=1):`0x3180b84 pd[0]` → `0x3180b90 ConvertTalkEffectName` + **`0x3180ba4 ScriptManager$$GetEffectParameter`**(按特效名取参数对象);其后只有分隔符守卫(`0x3180c8c pd[1]`、`0x3180cc0 pd[3]`)与 `0x3180c74 cmp w9,#5` 分支 | medium:坐标值的最终消费点在 `GetEffectParameter`/资产参数侧,表里 pd[2] 之外的行建议标 `待实测` |
| `subCameraFilter` | pd[2] 起(滤镜种类/mask 名/强度/颜色) | 818 次 6 token:`[subCameraFilter #A maskEdge cut359_mask05 3 255,255,255,255]` | handler `0x3183234`:pd[0] 组校验 `0x3183268 op_Equality`、`0x318330c ConvertCharaIndex`、`0x31833b8 Int32::Parse`,链式多段守卫;pd[N] 逐个下标未全部确认 | medium |
| `subRenderFadein` / `subRenderFadeout` | pd[2](+pd[4]/pd[6]) | 1863 / 2346 次:`[subRenderFadein #A 1.0 -200,0]`、`[subRenderFadeout #A 0.4]` | 守卫 `0x3185fac cmp w9,w8; b.gt 0x3191820`、`0x3185fdc/0x3186008 cmp w9,w10; b.hs 0x3193cd4` | medium |
| `charaEffect` / `charaEffectStop` / `charaEffectDestroy` / `charaSpecialEffect` | pd[6](坐标 Y)、pd[8]、部分 pd[4] | 语料 9/11 元素形态 | handler 链式守卫:`0x3187a64 cmp w9,#3`、`0x3187b68 #7`、`0x3187b90 #5`、`0x3187bc0 #9; b.ge 0x3192558`(超长形态转 0x3192558) | medium |
| `charaMove` | pd[8](第 4 个值) | 13 次 4 token 形态 | 守卫 `0x3185064 #5`、`0x31850d8 #7`(`#7` 之上还有一段读取) | medium |
| `charaPut` / `seStop` / `cueSeStop` | pd[6] / pd[4] / pd[4] | 各 2–3 次 | `charaPut: 0x3186efc cmp w9,#5; b.lt 0x318bbcc`;`seStop: 0x3180a88 cmp w9,#1; b.lt 0x3191820` | low(样本太少) |
| `flashin` | pd[2]/pd[4] | 1214 次:`[flashin loop 0.7 0.7 FF000080 FF000000]` | **未回读** | low `INFERRED` |
| `fowardEffect` | pd[4] | 193 次 5 元素 | `commands.json` 记了异常下标 `27`,疑似旧脚本偏移错误;未回读 | low |

### D.3 文档与语料矛盾(含表内自相矛盾)

| # | 对象 | 文档 | 语料/二进制 | 裁决(证据) |
|---|---|---|---|---|
| 1 | `specialEffect` `min_token_count` | **9** | 8/8 次只传 1 参;处理器首检 `0x3187610 cmp w9,#1` + `0x3187614 b.lt 0x3193e80` | **表错**。9 只是"全参形态"的取值,**不是下限**;按表实现会拒绝全部真实用法。high |
| 2 | `se` `min_token_count` | **5** | 23,183 次 `[se <名>]`(1 元素)+ 489 次 3 元素 | **表的语义记错**:`0x318076c cmp w9,#5; b.ne 0x318df84` 是"是否 5 值形态"的分支,**≠5 会走 3 值形态**(`params-misc.md` 已记 `pd[2]`:3 值=音量/5 值=淡入时间)。建议记 min=1。high |
| 3 | `charaLayer pd[0]` | `commands.json`:int | 100% str(`[charaLayer T sub #A]`、`[charaLayer T normal]`);`params-visual.md`:string | `commands.json` 错;`0x3182a0c ConvertCharaIndex`、`pd[2] vs 'sub' 0x3182a5c`、`pd[4]→0x318ab8 RegistCharaData`。high |
| 4 | `charaEffect pd[0]` | `commands.json`:int | 100% str(`[charaEffect B bit_talk_noise]`);`params-visual.md`:string | `commands.json` 错。medium(handler `0x3187a5c` 起点做长度/槽位转换) |
| 5 | `charaFadeTime pd[0]` | `commands.json`:int | 100% str(`[charaFadeTime A …]`) | `commands.json` 错。medium |
| 6 | `seStop pd[0]` | `commands.json`:**float** | 100% str(SE 名,`[seStop ad59]`;`[seStop ad931 1.5]`) | `commands.json` 错(pd[2] 才是 float)。medium |
| 7 | `charaTalk pd[0]` | `commands.json`/总表:"角色槽位(A-Z/数字)" | 还有 `on`(2913)/`off`(3549)/`depthOff`(2238) | **表漏取值域**:`ConvertCharaIndexTalk` 内部就比较 `'on'`(`0x31b35ac`)/`'off'`(`0x31b3594`)/`'depthOff'`(`0x31b35b8`);`SetTalkName 0x31b7474/0x31b748c` 同。high |
| 8 | `wt` | 不在 366 表 | 语料 **114,251** 次(第 2 高频) | **表漏条目**(行改写宏,见 §C.2)。high |
| 9 | `effectmessage` | 不在 366 表 | 语料 12 次 | **表漏条目**(见 §B)。high |
| 10 | `[wt 0,3]`(3 次) | — | 可解析为"等 0 秒" | 不是解析错误,**疑似作者笔误**(0.3 → 0,3)。medium |
| 11 | `scene` 第 3 参 | 总表:`pd[4]=透明度/强度(0-1)` float | 31 次全部是 **`FULLSCREEN_IMAGE_DEVICE_WIDTH`**(枚举名) | **实为 `ScriptManager.SCENE_MODE` 枚举名**:`dump.cs` `public const ScriptManager.SCENE_MODE FULLSCREEN_IMAGE_DEVICE_WIDTH = 1;`(TypeDefIndex 4846);解析在 `SetbSceneParam`(0x31c7d6c):`0x31c7dc4 String$$Split`、`0x31c7e04 #3 / 0x31c7e0c #2`(2/3 段形态)、`0x31c7e38 Single::Parse`、**`0x31c7ef8 System.Enum$$Parse`** ⇒ 合法值 = {`DEFAULT`,`FULLSCREEN_IMAGE_DEVICE_WIDTH`},且**因为是 Enum.Parse,名字不需要以字面量出现在二进制里**(这解释了语料 token 查不到字符串)。high |
| 12 | `fowardEffect` 表内下标 `27` | — | 无对应读取 | 疑似旧脚本窗口越界,**建议弃用该行**。low |

> 另注:`usage.json` 把带负号的坐标(`0,-30`)与 `0,30,1.4` 这类 3 分量坐标归到了 `str` 类 —— 这是主分析员预算脚本的**分类残差,不是语料的真实字符串参数**;本卷 D 全部按"值 + 分隔符"重算。

---

## E. 118 条"零出现"命令(表有、语料无)

统计口径:366 条命令中,在 2583 个剧本里出现 **0 次** 的 = **118 条**;
语料里可观察到的括号 tag 共 **273** 个(= 248 表内 + 25 表外,其中 23 个是消息内联标记、2 个是 `effectmessage`/`wt`)。

**必须先说清**:以下是"语料未观察到",**不代表不存在**,也不代表命令无效——FGO 剧本按需下载,本语料只覆盖 33 章;
战棋/战斗/旧活动章节的专用命令很可能只是没进这份语料。

### E.1 战斗/战棋专用(10)

`warBoardTalkScreen`,`warCharaFadein`,`warEffectOff`,`warEffectPiece`,`warEffectPos`,`warEffectSquare`,`warEventScript`,`warMoveCameraPiece`,`warMoveCameraPos`,`warMoveCameraSquare`
—— 全部 `war*` 前缀 = 战线/战棋演出(Fate 版"战棋地图");正式战斗流程脚本不在本语料。

### E.2 御主立绘与场景/背景资源(7)

`masterChange`,`masterHorizontalImageChange`,`masterHorizontalImageSet`,`masterImageChange`,`masterVerticalImageChange`,`masterVerticalImageSet`(游戏拼写小写 v;其 `width` 变体 `masterverticalImageSet` 却是 wait 关键字,见 §A.1),`bScene`(`scene`/`sceneSet` 系列已在语料中替代使用)

### E.3 信息窗特效 / 插入动画 / FSM / CRI 音频(11)

`effectmessageDestroy`,`insertionAnimationSet`,`insertionAnimationSetFSL`,`insertionAnimationSetFSR`,`insertionAnimationSetFSSideL`,`fsmObjSetBool`,`fsmObjSetFloat`,`fsmObjSetString`,`cueVoice`,`cueVoiceStop`,`cueVoiceVolume`
—— `effectmessageDestroy` 是 `effectmessageStop` 的姊妹(走 `MessageEffectStop`);`insertionAnimationSet*` 只在 `insertionAnimationStart/End` 体系里被少量使用过替代形态。

### E.4 角色演出族(22)

`charaBackEffectPause`,`charaBackEffectStart`,`charaCutStop`,`charaCutinPause`,`charaCutinStart`,`charaFaceIcon`,`charaFadeSpeed`,`charaFadeTimeLoop`,`charaFadeTimeLoopStop`,`charaMask`,`charaMoveReturnEaseFSSideL`,`charaMoveReturnEaseFSSideR`,`charaPutFSLNotNotch`,`charaPutFSRNotNotch`,`charaRelativeLoopMoveEase`,`charaRelativePut`,`charaReturn`,`charaRollAxisLoopStop`,`charaSpecialEffectPause`,`charaSpecialEffectStart`,`figureChange`,`figureSet`

### E.5 流程/消息/UI(18)

`advSet`,`advPrepare`,`advRelease`,`advPlayAnimator`,`flagRandom`,`jump`,`menu`,`messageOn`,`messageStart`,`notification`,`page`,`questMessageOverwrite`,`revivalBranch`,`rewardSwitch`,`selectionCentering`,`switchCase`,`switchCaseEnd`,`screen`
—— 多为"选择肢/翻页/菜单"流程;语料中 `message2/message3` + `input selectBranch` 等已覆盖同类语义(`menu`/`page` 等疑似旧版或特定模式专用)。

### E.6 音频 / 特效 / 流程判定 / 其他(50)

`advActorHide`,`advActorShow`,`advSoundSet`,`backEffectPause`,`backEffectStart`,`betweenHeight`,
`branchHaveSvtEquip`,`branchNotHaveSvtEquip`,`branchNotMaterial`,`branchNotRouteSelectCount`,
`delay`,`delayEnd`,`delayStop`,`delayStopAll`,`distortionloop`,`equipChange`,`faceTalkScreen`,`fadeOff`,
`flashOffDep`,`flashinDep`,`flashoutDep`,`font`,`fontType`,`horizontalImageChange`,`jingleStop`,
`keepSubBgmOff`,`keepSubBgmOn`,`l`(=betweenHeight 别名),`maskOff`,`scrollStop`,
`specialEffectPuase`,`specialEffectStart`,`specialEffectStop`,`spriteMaskOff`,`spriteMaskSet`,
`stretchOff`,`subBgm`,`subBgmStop`,`subStretchin`,`subStretchout`,`tVoiceUser`,`talkEnd`,`talkName`,`talkStart`,
`tdelay`,`verticalImageChange`,`voiceVolume`,`wipeFilterEx`,`wipeinEx`,`wipeoutEx`

> 细分提示:`delay*`/`tdelay`/`l`/`betweenHeight`/`font`/`fontType` 属**消息节奏与排版**;
> `backEffect*`/`advActor*` 属**助手(Adv)模式**的演出;`wipeinEx`/`wipeoutEx`/`wipeFilterEx` 与
> `branch*`(4 条分支判定)属**旧版或特定模式专用**(语料里被 `branchQuestClear`/`flag`/`sceneSet` 等覆盖)。
> 用阅读器实现时,这些命令按"已定义、可空实现/待实测"处理即可。

---

## 附.复核命令(可复现)

```bash
# 1) 17 个无名常量 → 名字 + 站点
python work/scratch/unnamed.py          # 383+1 常量 × 分支目标块(带 &'literal' 注解)
python work/scratch/litsites.py         # 函数内某字面量的所有加载点
# 2) 两张哈希树的结构化遍历(366 / 72 键)
python work/scratch/walktree.py         # tag 树 0x3179000, waitType 树 0x3187544
# 3) 关键单点反汇编
python work/coverage/win.py 0x3193520   # effectmessage(wait 关键字)命令体
python work/coverage/win.py 0x31c7d6c   # SetbSceneParam(Enum.Parse;scene 第 3 参)
python work/coverage/win.py 0x31ad6cc   # wt 改写(wait + 'time ')
python work/coverage/win.py 0x31ac4f4   # twt 改写(wait + 'rtime ')
python work/coverage/win.py 0x317fa28   # k(K=等推进,0 参)
# 4) 语料 × 表 对拍
python work/scratch/dfinal.py           # 前 60 tag 的元素数/形态/漏参
python work/scratch/crosscheck2.py      # 表(min/下标)与语料形态比对 + handler 守卫扫描
# 5) 全量常量复扫(384 = 383 + 0x8643a3f7)
python work/scratch/allcmps.py
```

辅助产物(新增,均在 `work/scratch/`):`unnamed_raw.json`、`unnamed_named.json`、`all_cmps.json`、
`tree_TAG.json`、`tree_WAIT.json`、`crosscheck60.json`、`d_final.json`。

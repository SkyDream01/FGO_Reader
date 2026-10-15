# 消息内嵌标记(markup)补充实证 —— `[r]` / `[#]` / `[%N]` / `[&]` / `[align]` / `[f]` / `[s]` …

对象:`Fate/Grand Order` Android 2.139.3(`com.aniplex.fategrandorder`,IL2CPP,Unity 6000.0.68f1)。
本文是 `work/out/script-format.md` **§3(消息文本内嵌标记)** 的补充与修正。
**不修改任何既有文档**;所有结论都给出 `libil2cpp.so` 的 VA + 反汇编/字面量原文;**未证实的标 INFERRED**。

新增/使用的工具(可复现):

```bash
python work/coverage/inline_scan.py            # 本文新增:全语料括号 token 扫描(内联 vs 整行),输出 work/scratch/inline_scan.json
python work/scratch/winlit.py @file            # 本文新增:任意 VA 列表的带字面量注解反汇编窗口
python work/scratch/findlit.py <方法正则> <字面量…>  # 本文新增:某方法内字面量的**数据流使用点**(方法序言里的字面量预初始化不算使用点)
python work/coverage/win.py <VA> [前] [后]      # 既有工具
```

> ⚠️ 阅读本文的注意点:`work/il2cpp_out/lit_methods.json` 记录的 VA 是**方法序言里的字面量元数据初始化点**
> (`adrp/ldr + bl 0x22304a4`),不是使用点。要证明"谁解析这个标记",必须再做数据流追踪
> (`findlit.py` / `annotate_func.annotate`)找到 `op_Equality` / `StartsWith` / `IndexOf` / `Split` 的真实调用点。
> 本文给出的都是**使用点**。

---

## 1. 语料全量清单

### 1.1 规模(`inline_scan.py`,`scripts\` 33 章 2583 个 `.txt`)

| 指标 | 数量 |
|---|---|
| 物理行 | 1,870,344 |
| 非空行(排除空行) | 1,373,841 |
| 入口标签行 `＄…`(§见 `_evidence/marker-table.md`) | 2,582 |
| 说话人行 `＠…` | 184,792 |
| 注释行(`#` / `//`) | 0(语料中未出现) |
| **整行恰为一个括号组**(语句行) | **971,836** |
| 消息行(其余所有内容行) | **214,631** |
| 消息行里的括号 token | **201,461** |
| 语句行里的括号 token | 971,836 |
| 消息文本总字符(不含括号部分) | 5,089,730 |
| 消息行中"至少含 1 个括号 token"的比例 | 139,251 / 214,631 = **64.9%** |

(与 `work/out/supplement-script-format.md` 的行分类一致:语句行 971,836 = 命令 857,520 + 整行非命令 114,315,
消息行 214,631 = 以 `[` 开头但后面还有文本 11,423 + 纯文本 203,209。)
每消息行的括号 token 数直方图:0 → 75,380;1 → 112,970;2 → 20,618;3 → 4,165;4 → 591;5 → 703;≥6 → 204。

### 1.2 内联标记总表(排除 `ScriptCommandExecute` 的 366 条命令)

标记名取自 **`ScriptMessageLabel$$GetCommandName`**(VA `0x31d0bf8`)的定义:token 名前缀 = 从 `[` 之后
**到第一个 `空格` / `:` / `[` / `]` 为止**的字符(见 §2.1)。因此 `[#運命:ルート]` 的"标记名"其实是 `#運命`。

| 标记 | 形态 | 内联次数 | 整行次数 | 语料例句(≤120 字符) |
|---|---|---|---|---|
| `r` | `[r]` 换行 | 133,096 | 0 | `アトラス院からの来訪者。[r]自ら破滅の[#運命:ルート]を手繰った者よ。` |
| `#…:…` | `[#基准:读音]` 注音 | 24,882 | 0 | `はい。[#中断:カット]も[#修正:リテイク]もナシ。[r]契約内容は変わらずでお願いします。` |
| `line` | `[line N]` 行内线画 | 19,515 | 23 | `[line 3]シオン。[bgm BGM_EVENT_38 0.1][r]シオン・エルトナム・ソカリス。` |
| `#…` | `[#文本]` 强调(无冒号) | 4,363 | 0 | `まあ、[#すぐ]には難しいですが。[r]最後の戦いにはキッチリ間に合わせます。` |
| `%N` | `[%1]` 变量替换 | 3,855 | 0 | `そしてマスター・[%1]の[r]決定的な一言。` |
| `&a:b` | `[&男:女]` 性别分支 | 3,071 | 2 | `それでも、[&彼:彼女]らの敗北は必至だった。[r]ビーストを倒せない、という意味ではない。` |
| `RRGGBB` | `[51ffff]` 颜色起(裸 16 进制) | 2,342 | 14 | `[FFFFFF]？[-]　妙な喩えでしたけど……。[r]私、冥界にも鳥にも縁はナイですよねぇ……` |
| `-` | `[-]` 颜色止 | 2,037 | 0 | 同上 |
| `align` | `[align center]`/`[align right]`/`[align]` | 535 | 1 | `[align center]ストーム・ボーダー管制室[align][r][align center]資源回収巡回航行中[align]` |
| `image` | `[image 名]` / `[image 名:附带文本]` | 270 | 21 | `[image npc_language_5:！　オベロン様だ、オベロン様だ！][wt 0.2]…` |
| `i` | `[i 名]` 图标 | 45 | 4 | `目標までの相対距離[i berserker_language_1]！[r]多重結界らしき空間を突破する、衝撃備えて！` |
| `twt` | `[twt 0.5]` 等待(见 §3.16) | 27 | 0 | `……[twt 0.5]……[twt 0.5]……[twt 0.5]……[twt 0.5][charaFace A 3]は？` |
| `tRaidShortName` | `[tRaidShortName 80593 1]` | 3 | 0 | `[D9FF69][tRaidShortName 80593 1]が切除されました。[-][r]…` |
| `line3` | `[line3]`(**拼写错误**,无空格) | 1 | 0 | `…道を切り開く、[r][#人間らしい人間]は、あのカルデアのマスター[line3]。` |

**另有两个统计上不属于上面两类、但会出现在消息行里的命令**:`[wt n]`(内联 1,866 / 整行 114,251)、
`[k]`(整行 184,799)、`[q]`、`[se …]`、`[bgm …]`、`[charaFace …]` 等共 ~50 种命令也会内联出现
(尤其 `charaFace` 1,291 次、`se` 237 次、`bgm` 487 次)。**"命令"和"标记"共用同一语法,只是处理层不同**。

### 1.3 取值域(内联出现时的实参)

| 标记 | 取值分布 |
|---|---|
| `line N` | 3 → 16,509;2 → 1,699;6 → 890;4 → 203;5 → 69;8 → 41;9 → 34;7 → 15;12 → 13;10 → 13;18 → 7;15 → 6;11/17/20/25/27/28/26/19/14 → 各 1~6。**N ∈ [2,28]**,仅 23 次是整行(`[line 4]` 等) |
| `image X` | 带冒号 48 次(`[image npc_language_5:文本]`),不带冒号 222 次。图片名只有 `berserker_language_{1..9}` 与 `npc_language_{1..53, 35_w1..w8}` 两个族 |
| `f` / `font` / `fontSize` | `small` 450、`-` 405、`large` 394、`x-large` 21、`x-small` 18、`medium` 14;另有 **2 例双参** `[f small center]` / `[f x-small center]`。`font` 16 次(`large` 14/`x-large` 1/`small` 1),`fontSize` 24 次(`x-large` 9/`large` 9/`-` 6) |
| `s` / `speed` | `16` 22、`0` 3、`255` 1、`256` 1、`150` 1、`-` 24、`32` 23、`10000` 1。`[s n]` 也有 24 次整行 |
| `align` | 无参(复位)`[align]` 268、`center` 240、`right` 27 |
| `%N` | `%1` 3,855、`%5` 1(另有 96 次出现在 `＠` 说话人行,如 `＠[%1]`) |
| `&a:b` | 3,071 + 2;`a` 与 `b` 可为空串(如 `[&君:]` 118 次、`[&:さん]` 39 次、`[&だ:]` 45 次);Top:`[&君:ちゃん]` 434、`[&彼:彼女]` 289、`[&オレ:わたし]` 158、`[&ミスター:ミス]` 154、`[&貴方:貴女]` 82 |
| 裸颜色 | **34 种**,共 3,292 次(消息行 2,342 + `＠` 名 936 + 整行 14):`51ffff` 1,375、`FFFFFF` 514、`93CA76` 347、`51d4ff` 228、`D9FF69` 228、`6680ff` 161、`FF0000` 48、`e8decd` 48、`ebd8eb` 44、`8d90d7` 42、`b8b3d1` 39、`8a7ab0` 30、`907ca1` 30、`c3b1c6` 28、`ff143c` 28、`d72727` 17、`b86349` 15、`bb8f69` 12、`a1b6df` 12、`eed720` 10、`08fa55` 9、`ff4040` 9、其余 ≤3。**大小写与 `#` 前缀都不统一,甚至同一章内混用** |
| `[-]` | 2,953 = 消息行 2,037 + `＠` 名 916 |
| `#文本`(无冒号) | 4,363;文本可以是任意短语(`[#その一帯ごと]`、`[#消失]`、`[#すぐ]`) |
| `messageShake` | 内联 548 + 整行 87;形状恒为 `float int int float`(`[messageShake 0.05 4 4 0.4]`) |

### 1.4 分布

以上 14 种标记在 **全部 33 章**都出现(除 `font` 3 章、`fontSize` 5 章、`twt`/`tRaidShortName` 少量章),
按章节数最高的是 `Lostbelt No.6 Avalon le Fae`、`Lostbelt No.7 Nahui Mictlān`、`Naraka Mandala Heian-kyo`
(注音/强调/`[line]` 在后期章节用得最多)。逐标记的章分布见 `work/scratch/inline_scan.json` 的 `chapters`。

### 1.5 嵌套(全语料只有 13 例)

语法上的嵌套(`[` … `[` … `]` … `]`)在语料中**极少但真实存在**。全部 13 例:

```
Final Chapter            0400074710.txt:1863  [&兄弟:[#兄妹:きょうだい]]
Final Singularity        0100081010.txt:257   [&小僧:[%1]]
Lostbelt No.3 SIN        0300031210.txt:409   [&:と[%1]]
Lostbelt No.4 Yugaks     0300041330.txt:78    [&[#彼らを欺いてまで]:[#彼女らを欺いてまで]]
Lostbelt No.5 Olympus    0300060551.txt:701   [&いや、[#不老不死:ふ ろ う ふ し]なのか……！:いえ、[#不老不死:…]なの……！？]
Ordeal Call III          0400041650.txt:1452  [&[#貴方:マスター]:[#貴女:マスター]]
Ordeal Call IV           0400051931.txt:1301  [&[#彼]:[#彼女]]
Shimousa                 0200030820.txt:538    [&女の[#躯:からだ]がさほどに珍しいか？:同じ女の[#躯:からだ]、何をさほどに目を見張る？]
Pseudo-Singularity IV    0200040410.txt:1428  [&マスター:[%1]]
Pseudo-Singularity IV    0200040520.txt:396   [&[%1]に女装させても:[%1]にやらせるにも]
Pseudo-Singularity IV    0200040711.txt:825   [&、とは:[line 3]って]
Gehenna Id               0400032251.txt:288   [&[#作った]:[#作ったの]]
Gehenna Id               0400032540.txt:766   [&[#俯:うつむ]いて、奥歯を噛みしめる:[#俯:うつむ]いて、唇を噛む]
```

规律:**嵌套全部发生在 `[&a:b]` 分支标签内部**(因为只有它需要"先选一支、再解析该支")。
13 例中 8 例嵌套 `[#…]`,3 例嵌套 `[%N]`,1 例嵌套 `[line 3]`。
⚠️ 任务描述里提到的 `&[#彼らを欺いてまで` / `[&女の[#躯:からだ` 其实是这两条完整 token 的**前缀片段**,
语料中**不存在**"裸 `&` + 独立 `[#…]`"的写法(全语料 `&[` 只出现在 `[&[#…` 里,共 6 处)。见 §5。

### 1.6 引号

含双引号 `"` 的行**只有 3 条**:`[input selectBranch skipStop "branchNotRouteSelect 4000517 4000574"]`
与 2 条以 `"` 开头的英文台词。但引号在解析器里是**一等公民**(见 §2.2 / §6)。

### 1.7 引擎支持但语料 0 次的标记

`[~N]`、`[^X]`、`[*X]`(内部标签,见 §3.19)、`[=…]`、`[effectmessage …]`(只整行 12 次)、
`[servantName]`、`[tRoute …]`、`[tFlag …]`。**`[tRoute]`/`[tFlag]` 在本语料 0 次**
(任务描述里的 `[tRoute id text]` 是 `replaceBranchText` 的能力,不是本语料的实际用法;
grep 到的 15 处 "tRoute" 全是 `[branchNotRouteSelect …]` 的子串)。

---

## 2. 语法内核(引擎侧,全部为使用点)

### 2.1 标记名 = 到 `空格`/`:`/`[`/`]` 为止

`ScriptMessageLabel$$GetCommandName(string s, int start)` VA `0x31d0bf8`:

```
0x31d0c78  bl   #0x486c8a8   CALL System.String$$get_Chars     ; c = s[i]
0x31d0c7c  and  w8, w0, #0xffff
0x31d0c80  sub  w8, w8, #0x20
0x31d0c84  lsl  x9, x22, x8            ; x22 = 1
0x31d0c88  cmp  w8, #0x3d
0x31d0c8c  and  x8, x9, x23            ; x23 = 1 | (0x400<<16) | (0x2800<<48)
0x31d0c90  ccmp x8, #0, #4, ls
0x31d0c94  b.ne #0x31d0cbc             ; 命中即结束
```

`x23 = 0x2800_0400_0000_0001` → 置位的是 bit0 / bit26 / bit59 / bit61 →
`chr(0x20+0)=空格`、`chr(0x20+26)=0x3a ':'`、`chr(0x20+59)=0x5b '['`、`chr(0x20+61)=0x5d ']'`。
**即:标记名在空格、`:`、`[`、`]` 处截断。** 所以:

* `[&彼:彼女]` 的名字是 `&彼`(不是 `&`),`[#運命:ルート]` 的名字是 `#運命`;
* `[line 3]` 的名字是 `line`,第一个参数是 `3`(注意 `[line3]` 会被当成名字 `line3`,是**不认识的标记**)。

### 2.2 参数 = `:` 分隔 + `[...]` 深度 + `"` 引号

`ScriptMessageLabel$$AnalysTagParam(string s, int start)` VA `0x31d0f98`(返回 `List<string>`):

```
0x31d1080  cmp  w8, #0x3a     ; ':'  → 0x31d10ac
0x31d1088  cmp  w8, #0x5b     ; '['  → 0x31d10a4
0x31d1090  cmp  w8, #0x5d     ; ']'  → 0x31d1098 subs w25,w25,#1 / b.pl 继续 / 否则结束
0x31d10a4  add  w25, w25, #1  ; 深度+1
0x31d10ac  cbz  w25, #0x31d1140   ; 深度==0 的 ':' = 参数分隔符,提交一个参数
0x31d10c8  cmp  w8, #0x22     ; '"' → 进入引号原样拷贝循环(0x31d10dc..0x31d1118)
```

`ScriptMessageLabel$$GetTagSplitString(string s, int start, int index)` VA `0x31d0d8c` 是同一个扫描器,
但只返回**第 index 个**(从 1 开始)参数(`0x31d0f00 cmp w25,w19; b.ne` → 不是就 `set_Length(0)` 重来)。
`[image npc_language_5:文本]`、`[#運命:ルート]`、`[&彼:彼女]` 都靠这个切分。

### 2.3 配对括号 = 深度计数

`ScriptMessageLabel$$GetBraceIndex(string s, int from)` VA `0x31d0b64`:

```
0x31d0b9c  cmp  w8, #0x5b     ; '[' → 深度+1
0x31d0bc0  cmp  w8, #0x5d     ; ']' → 若深度==0 则 return 当前位置;否则深度-1
0x31d0be0  mov  w19, #-1      ; 扫到结尾还没配对 → 返回 -1
```

**结论:标记是"带深度的括号组",不是"到第一个 `]` 为止"。** 这是嵌套能被正确切分的基础。

### 2.4 哪些名字被当作"内联标记"(而不是命令)

`ScriptManager$$AnalysScript`(`0x31a50ec`)对每一行调用 `AnalysText`(`0x31a920c`)得到 tag 名后,做如下判定:

```
0x31a6814  bl #0x4870cc0 CALL System.String$$op_Equality  args: x1='i'          ; 0x31a6818 tbnz → 0x31a68a8
0x31a6830  bl #0x4870cc0 CALL System.String$$op_Equality  args: x1='image'      ; 0x31a6834 tbnz → 0x31a68a8
0x31a684c  bl #0x4870cc0 CALL System.String$$op_Equality  args: x1='line'       ; 0x31a6850 tbnz → 0x31a68a8
0x31a6868  bl #0x4870d34 CALL System.String$$StartsWith   args: x1='%'          ; 0x31a686c tbnz → 0x31a68a8
0x31a6884  bl #0x4870d34 CALL System.String$$StartsWith   args: x1='&'          ; 0x31a6888 tbnz → 0x31a68a8
0x31a68a0  bl #0x4870d34 CALL System.String$$StartsWith   args: x1='#'          ; 0x31a68a4 tbz  → 0x31a622c(命令路径)
```

即**引擎明确把 `i` / `image` / `line` / `%…` / `&…` / `#…` 六类当作"消息内嵌标记"**,其余名字走命令分支
(`ScriptCommandExecute` 哈希树)或按消息文本处理。`replaceBranchText` 的 `tRoute/tFlag/tRaidShortName`
是另一条支线(§3.17)。

### 2.5 "不认识的标记原样保留"—— 源码级证据

`ScriptMessageCommonManager$$UpdateLabels(string msg, ...)` VA `0x31cfff8` 是真正把消息文本变成标签的主循环
(逐字符,`w27`=i):

```
0x31d02ac  cmp  w8, #0x5b          ; c == '[' ?
0x31d02f4  GetCommandName(msg, i+1)     ; 取名字
0x31d0678..0x31d0680  Equals(name,'image')      → 走 [image] 分支
0x31d045c..0x31d0464  Equals(name,'r')          → 换行
0x31d07b0..0x31d07b8  Equals(name,'i')          → 图标
0x31d08d4..0x31d08dc  StartsWith(name,'line')   → 线画
0x31d0310..0x31d0318  Equals(name,'effectmessage')
0x31d0838..0x31d0840  Equals(name,'servantName')
0x31d04c0  ldr  x0,[x24] ; 0x31d04d0 ldr x8,[x8,#0x5f0] ; '['   ← 括号未配对(GetBraceIndex==-1)
0x31d04d8  bl   #0x487c48c CALL System.Text.StringBuilder$$Append  args: x1='['
0x31d0420..0x31d0448  get_Chars + StringBuilder$$Append      ← 其余字符原样抄进输出文本
```

**不认识的名字不会命中任何比较 → 落到 `0x31d0420` 的"逐字符拷贝"路径,连 `[`、`]` 一起原样保留。**
语料里的 `[line3]`(§1.2 最后一行)就是这条路径的真实产物。

---

## 3. 逐个标记的引擎证据

### 3.1 `[r]` 换行

* 主循环比较:`0x31d0464 bl #0x48706e4 CALL System.String$$Equals args: x1='r'`(UpdateLabels)。
* `AnalysScript` 把 token 文本 `[r]` **规范成名字 `r `**:`0x31a6e38 op_Equality(tok,'[r]')` → `0x31a6e48 ldr x8,[#0x910] ; 'r '` → `0x31a70... Append`。
* `AnalysScript` 还会把真实换行**替换成** `[r]`:`0x31a6594 bl #0x48748dc CALL System.String$$Replace args: x2='[r]'`(x1 = 来自脚本的换行串)。
* 语料:133,096 次,全部在消息行内;**说话人行 `＠` 里 0 次**。

### 3.2 `[line N]` 行内线画 —— 内部名 `[~N]`

```
0x31d08dc  bl #0x4870d34 CALL System.String$$StartsWith  args: x1='line'   ; name.StartsWith("line")
0x31d08fc  add w1, w27, #5                 ; 跳过 "[line" (5 字符)
0x31d090c  bl #0x48746b4 CALL System.String$$Substring
0x31d0924  bl #0x4876d80 CALL System.String$$Trim
0x31d06d8  bl #0x48727c4 CALL System.String$$Concat args: x2=']'  ; 前面 0x31d06b8 ldr x8,[…] ; '[~'
```

→ `[line N]` 被**改写成内部标签 `[~N]`**,交给 `AddLabel`。`GetFontSizeString`/`ScriptMessageLabel$$.cctor`
里成对出现的 `'[line '`(`0x31d7f6c`)与默认名 `'line'`(§3.19)说明 `line` 是"默认的标签类型名"。
语料里 N 的取值域是 2..28(§1.3),23 次整行 `[line 4]` 之类。

### 3.3 `[image 名]` / `[image 名:附带文本]` —— 内部名 `[^…]`

```
0x31d0680  bl #0x48706e4 CALL System.String$$Equals  args: x1='image'
0x31d06a0  add w1, w27, #7               ; 跳过 "[image "
0x31d06b0  bl #0x48746b4 CALL System.String$$Substring
0x31d06b8  ldr x8,[x8] ; '[^' ; 0x31d06d8 Concat('[^', 参数串, ']')
```

`ScriptMessageCommonManager$$SetTalkName` 反向构造它:`0x31d3d3c bl #0x4872f4c CALL System.String$$Concat
args: x0='[image ', x2=' 1.5]'` → 立绘用 `[image <名> 1.5]` 形式(第三个参数是缩放)。
语料 270 次内联中 48 次带 `:`,即 `[image npc_language_5:文本]` —— 参数切分由 §2.2 的 `:` 规则完成,
"文本"是随图显示的替字。

### 3.4 `[i 名]` 图标

`0x31d07b8 bl #0x48706e4 CALL System.String$$Equals args: x1='i'`(与 `image` 同层分支,同样交给标签层)。
语料 49 次,名字全部是 `berserker_language_*` / `npc_language_*`,与 `[image]` 同一资源族。
(注:任务描述里的 `[i npc_language_17]` 是"行内小图标"写法,和 `[image …]` 两者并存,语义差别只能从资源看出 —— **INFERRED**:`i` 出现在文字中间,`image` 多出现在行首。)

### 3.5 `[effectmessage X]` 与 `[effectmessage /]`

```
0x31d0318  bl #0x48706e4 CALL System.String$$Equals args: x1='effectmessage'
0x31d0324  add w1, w27, #0xf           ; 跳过 "[effectmessage" (14)
0x31d0348  bl #0x4870cc0 CALL System.String$$op_Equality args: x1='/'   ; 参数是 "/" → 关闭
0x31d077c  bl #0x48727c4 CALL System.String$$Concat args: x0='[*', x2=']'  ; 否则 → 内部标签 [*X]
```

语料 12 次整行:`[effectmessage bit_talk_hknf_text 440,179 1.5 48]`(资源名 + 位置 + 时长 + 字号)。

### 3.6 `[servantName]`

`0x31d0840 bl #0x48706e4 CALL System.String$$Equals args: x1='servantName'` → `0x31d08b0 CALL
ScriptMessageLabel$$GetServantChangeName`。**本语料 0 次**(战斗中替换 Servant 名的用途;
另有 `SelectTdCommandController$$ReplaceTag` 的正则 `'\\[\\s*servantName\\s*\\]'` 在 VA `0x34fb20c`)。

### 3.7 `[#基准:读音]` 注音(ruby)

* 正则字面量 `'\\[#[^:]+:[^:]+\\]'` 的引用点是 **`ScriptLineMessage$$HasRubyFormat`**(VA `0x3174d90`,方法 `0x3174d64`)。
* 实际拆分在 `ScriptLineMessage$$AddLabel`(`0x3173948`):
  ```
  0x31739ec  cmp w8, #0x5b   ; t[0]=='['
  0x3173a08  cmp w8, #0x23   ; t[1]=='#'
  0x3173a14  CALL ScriptLineMessage$$FetchMainLabel     ; 主标签
  0x3173a30  CALL ScriptLineMessage$$FetchRubyLabel     ; 注音标签
  0x3173a58  Substring(2, len-3)                        ; 去掉 "[#" 与 "]"
  0x3173a8c  mov w8, #0x3a ; 用 ':' 作为唯一分隔字符数组
  ```
  → **冒号前是主体、冒号后是注音**;只有 1 段时**只有主标签、没有注音标签**(= 3.8 的强调)。
* 渲染:`ScriptMessageLabel$$UpdateRuby` `0x31ced60` / `UpdateImageRuby` `0x31cf2f0` / `ScriptLineMessage$$PreProcSetRubyLabel` `0x3174ae4`。
* `ScriptReplaceString$$Init` 给出的官方示例字符串本身就用了这种写法(§3.10):
  `'[#[FF0000]主[-]人公:しゅじんこう]はぐだぐだな主人公'` —— 注音标签里**再嵌颜色标签**,是引擎作者自己的用例。
* 语料 24,882 次(+ `＠` 名 2 次,如 `＠L：[#遺分體:エレメンツ]`)。

### 3.8 `[#文本]`(无冒号)= 强调/傍点

* `ScriptManager$$AnalysScript`:对 `#` 开头的 token 做 `Split(':')`,
  ```
  0x31a6e78  StartsWith(tok,'#')  → 0x31a6e84
  0x31a6e9c  w1 = 0x3a(':'); 0x31a6ea0 CALL System.String$$Split
  0x31a6eac  cmp w8, #1 ; 0x31a6eb0 b.gt #0x31a7074     ; 有 ':' → 走注音处理
  0x31a6ebc  ldr x8, [x8, #0x928]   ; '・ '            ; 无 ':' → 名字用 '・ '
  0x31a7070  CALL System.Text.StringBuilder$$Append
  ```
* `ScriptMessageLabel$$UpdateBouten`(`0x31ce9b0`)把文本变成"每字符一个 `・`":
  ```
  0x31ceaac  mov x1, x27                    ; x27 = 传入文本
  0x31ceac4  ldr w8, [x29, #0x10]           ; = 文本长度
  0x31ceaf0  CALL System.String$$Concat args: x1='・'      ; 循环 len 次,每次追加一个 '・'
  0x31ceb10  b.lt #0x31ceae4
  ```
  调用点:`ScriptLineMessage$$AddLabel 0x3173eb0` / `ScriptLogMessage$$AddLabel 0x3175e24` /
  `ScriptMessageCommonManager$$AddLabel 0x31ce420`。
  → **`[#文本]`(无冒号)是"给这段文字加傍点"**,与 `[#A:B]`(注音)是同一个 `#` 标记的两种形态。
  语料 4,363 次,置信度:机制 high(代码),"视觉上确实是傍点" medium(未见渲染截图 —— 标 **INFERRED**)。

### 3.9 颜色:`[RRGGBB]` / `[RRGGBBAA]` / `[-]` —— **没有 `#`**

**修正 §3 的重要一条:语料中 `[#RRGGBB]` 出现 0 次**(`[#` 后接 3~8 位 16 进制的 token 全语料为 0)。
颜色是**裸 16 进制**:

```
ScriptMessageLabel$$IsColorBeginTag(string)  VA 0x31d66bc
0x31d66f4  ldr  w21, [x19, #0x10]      ; len
0x31d66f8  orr  w8, w21, #2
0x31d66fc  cmp  w8, #0xa               ; (len|2)==10 → len==8 或 len==10
0x31d671c  cmp  w8, #0x5b              ; s[0] == '['
0x31d6738  cmp  w8, #0x5d              ; s[len-1] == ']'
0x31d6780  cmp  w8, #0xa               ; '0'..'9'
0x31d6794  cmp  w8, #0x25              ; 在 A..F 范围内
0x31d67a0  tst  x8, #0x3f0000003f      ; 掩码 = bit0..5 与 bit32..37 → 'A'-'F' 与 'a'-'f'
```

→ `[FFFFFF]`(8 字符)与 `[FFFFFFFF]`(10 字符,含 alpha)是合法颜色,大小写都接受。

```
ScriptMessageLabel$$GetColor(string colorTag)  VA 0x31d781c
0x31d78ac  op_Inequality(colorTag, '[-]')        ; "[-]" 不是颜色
0x31d78e0  strh w9(0x5b='['), [x1, #0x20]        ; 构造 trim 字符数组 "[]"
0x31d78ec  strh w8(0x5d=']'), [x1, #0x22]
0x31d7918  bl #0x4867ef8 CALL System.String$$Concat     ; '#' + colorTag  ← '#' 是引擎补的
0x31d7924  bl #0x4fc0a28 CALL UnityEngine.ColorUtility$$TryParseHtmlString
```

→ 引擎把脚本里的裸 16 进制**前面补 `#`** 再交给 `ColorUtility.TryParseHtmlString`。
旁证:`AccountLinkageParams$$AddColorCodeBracket`(VA `0x326e088`)的字面量正则 `'(\\[[0-9A-F]{6}\\])'`。

`[-]` 是颜色终止:`GetColor 0x31d78ac op_Inequality(x,'[-]')`、`EnforceColorTag 0x31d14b8 op_Equality(x,'[-]')`、
`RemoveColorTag 0x31d6554 CALL System.String$$IndexOf args: x1='[-]'`。语料 2,953 次。
**颜色标记不跨行**(`GetColor` 每次只吃一个标签),`％N` 替换结果尾部会自动补 `[-]`(§3.10)。

### 3.10 `[%N]` 变量替换 —— `%1` = 玩家名

`ScriptMessageCommonManager$$UpdateLabels`:

```
0x31d039c  cmp  w8, #0x25                  ; msg[i+1] == '%'
0x31d03cc  CALL System.String$$Substring   ; 取 [% 与 ] 之间的数字串
0x31d03d4  CALL System.Int32$$Parse
0x31d03fc  CALL ScriptReplaceString$$GetString            ; ← 查表
0x31d040c  ldr x1, [x8] ; '[-]'
0x31d0410  CALL System.String$$Concat      ; Concat(替换文本, '[-]')
```

`ScriptManager$$GetReplacedText`(VA `0x31c601c`)做同样的事:`0x31c6190 cmp w8,#0x25` →
`0x31c61b4 Int32.Parse` → `0x31c61d8 CALL ScriptReplaceString$$GetString`。

`ScriptReplaceString`(`dump.cs` TypeDefIndex 4889):

```csharp
protected static List<string> replaceList;   // 0x0
protected static int playerGenderIndex;      // 0x8
public enum Index { USER_NAME = 1 }          // TypeDefIndex 4888
public static string GetString(int num);     // 0x31d0d0c → replaceList[num]
```

表项由 `ScriptManager$$FirstExecuteScript`(`0x31a33ec`)填充:

```
0x31a35a8  CALL ScriptReplaceString$$SetString   w0=1  x1=[UserGame+0x18]      → 玩家名(Index.USER_NAME)
0x31a3624  CALL ScriptReplaceString$$SetString   w0=2  x1=[ScriptManager statics+0xf0]
0x31a363c  CALL ScriptReplaceString$$SetString   w0=3  x1=[…+0xf8]
0x31a3654  CALL ScriptReplaceString$$SetString   w0=4  x1=[…+0x100]
0x31a3684  CALL ScriptReplaceString$$SetString   w0=5  x1=UserServantMaster$$getServantAllNum→ToString()
0x31a35e4  str w22, [x8, #8]                     ; playerGenderIndex = [UserGame+0x4c]
```

`dump.cs` 里 ScriptManager 的静态字段:`questTitle // 0xF0`、`questMessage // 0xF8`、`questMessageRuby // 0x100`。

| 变量 | 含义 | 证据 |
|---|---|---|
| `[%1]` | **玩家自己的名字**(`Index.USER_NAME`) | 枚举 `USER_NAME = 1`;`SetString(1, userGame[0x18])` `0x31a35a8` |
| `[%2]` | 任务标题 `ScriptManager.questTitle` | statics+0xF0 `0x31a3624` |
| `[%3]` | 任务文本 `ScriptManager.questMessage` | statics+0xF8 `0x31a363c` |
| `[%4]` | 任务文本(带注音) `questMessageRuby` | statics+0x100 `0x31a3654` |
| `[%5]` | **所持从者总数** | `UserServantMaster.servantAllNum.ToString()` `0x31a3684` |

语料旁证:`[%5]騎による総力戦。`(`0300132330.txt:964`,正好是"N 骑"的量词用法);
`[%1]、マシュ、…` / `＠[%1]`(说话人名字也可以是玩家名)。
`ScriptReplaceString$$Init`(`0x31d9054`)的默认表内容是开发用样例:
`0x31d908c` = `'[#[FF0000]主[-]人公:しゅじんこう]はぐだぐだな主人公'`、`0x31d9098` = `'ルビを含むテキストにも[#置換:ちかん]できますよ'`。

### 3.11 `[&a:b]` 性别分支 —— 按 `playerGenderIndex` 选一支

两个解析点,机制完全一致:

`ScriptManager$$GetReplacedText`(VA `0x31c601c`):

```
0x31c61f8  cmp  w8, #0x26                       ; msg[i+1] == '&'
0x31c6244  ldr  w25, [x9, #8]                   ; w25 = ScriptReplaceString.static_fields[8] = playerGenderIndex
0x31c6254  add  w1, w23, #2                     ; from = '[' 之后 2 个字符(跳过 "[&")
0x31c6264  CALL ScriptMessageLabel$$GetTagSplitString   ; 取第 playerGenderIndex 个 ':' 参数
0x31c6278  CALL System.Text.StringBuilder$$Append
```

`ScriptMessageCommonManager$$UpdateLabels`(VA `0x31cfff8`):

```
0x31d04f4  cmp  w8, #0x26                       ; msg[i+1] == '&'
0x31d04fc..0x31d0524 取 ScriptReplaceString 类(0x55c9000+0x130 槽)
0x31d055c  ldr  x8, [x20] ; 0x31d0560 ldr x9, [x0, #0xb8]   ; static_fields
0x31d0568  ldr  w29, [x9, #8]                   ; = playerGenderIndex
0x31d0578  add  w1, w27, #2
0x31d0584  CALL ScriptMessageLabel$$GetTagSplitString
0x31d05b0  CALL ScriptMessageCommonManager$$UpdateLabels    ; ← 对选中的那一支**递归再解析**
```

**规则:`[&a:b]` 按 `:` 切成参数,取第 `playerGenderIndex` 个(0 = 前 = 男,1 = 后 = 女)。**
`playerGenderIndex` 由 `ScriptManager$$FirstExecuteScript 0x31a35e4` 从 `UserGame+0x4c` 写入。
`GetTagSplitString` 的 `index` 从 1 起算(`0x31d0f00 cmp w25,w19`),所以 **0 与 1 都是"第 1 个"** ——
**INFERRED**:`[&a:b]` 时 index=1 取到的是 `a`... 但语料里两种性别都要能出结果(如 `[&彼:彼女]`),
更可能是 `playerGenderIndex` 的取值本身就是 1/2(或 0/1 且 0 走"取第 1 个"的默认分支),
`ScriptReplaceString$$GetPlayerGenderIndex`(`0x31d9450`)在 2.139.3 中**无调用者**,无法进一步区分 —— 标 **INFERRED**。
可确定的旁证:**空参数合法**,`[&君:]`(118 次)、`[&だ:]`(45 次)说明"某一支为空"是常规写法,
`GetTagSplitString` 在 index 越界时返回空串(`0x31d0f78 mov x0,x23`,x23 初值 = `''`)。

* `LocalizationManager$$ReplaceNameTag`(`0x2e5bb7c`)对 `&`/`^`/`~`/`%`/`line` 开头的标签**直接跳过**
  (`0x2e5bec8 StartsWith('&') → tbnz → 0x2e5bdf4`),说明这些标签归消息层管,不归本地化层管(分层证据)。
* 嵌套:`[&…[#…]…]` 能成立是因为 `GetBraceIndex`/`GetTagSplitString` 都做深度计数(§2.3),
  且选中那一支后会**递归** `UpdateLabels`(0x31d05b0)—— 13 例嵌套全部是这种形态(§1.5)。

### 3.12 `[align]` / `[align center]` / `[align right]` —— 整串相等比较

`align` 在 `lit_methods.json` 里**没有任何名字字面量**,原因是引擎比较的是**带括号的完整 token**:

```
ScriptManager$$ProcessScript  VA 0x31bc344
0x31c107c  adrp x8, … ; 0x31c1080 ldr x8,[x8,#0xcc0] ; &slot for '[align center]'
0x31c1084  mov  x0, x26                 ; x26 = 消息的一个 token
0x31c1088  ldr  x1, [x8] ; '[align center]'
0x31c108c  CALL System.String$$op_Equality
0x31c1090  tbz  w0, #0, #0x31c10a4
0x31c109c  mov  w9, #1 ; 0x31c10cc str w9, [x8, #0x1ec]      ; center → 1
0x31c10b0  ldr  x8,[x8,#0xd10] ; &slot for '[align right]'
0x31c10b8  CALL System.String$$op_Equality  args: x1='[align right]'
0x31c10c8  mov  w9, #2                                        ; right  → 2
0x31c11ec / 0x31c1208 / 0x31c14d4  同样比较 '[align]'         ; 复位
```

以及另一处消去循环里的 `[r]`/`[align]` 判定:

```
0x31be9e8  op_Equality(tok,'[r]')          ; 0x31be9f0 tbnz
0x31bea20  op_Equality(tok,'[align]')      ; 0x31bea24 tbnz → 0x31c11ec
```

**结论:`[align …]` 只有三种合法写法,且必须逐字符精确**(`[align  center]`、`[align Center]`、
`[align left]` 都不会命中,会被当成未知标记原样保留)。取值域:center / right / 无参(复位),
**没有 left**(左对齐是默认值)。

### 3.13 `[f …]` / `[font …]` / `[fontSize …]` 字号(+ 可选垂直对齐)

三个名字**共用同一个 handler**(`out/commands.json`:`font`/`fontSize` 是 `f` 的 alias,handler VA `0x3187928`):

```
0x3187920  CALL System.String$$op_Equality  args: x1='fontSize'
0x3187930  ldr  w9, [x8, #0x18]             ; pd.Length
0x3187934  cmp  w9, #1
0x3187938  b.ne #0x3188cac
0x3187944  ldr  x1, [x8, #0x20]             ; pd[0]
0x3187950  CALL ScriptMessageCommonManager$$SetFontSize      ; [f small]   → (small, null)
…
0x3188cac  cmp  w9, #3
0x3188cb0  b.ge #0x318946c
0x3188ccc  CALL ScriptMessageCommonManager$$SetFontSize      ; pd.Length==0 → (null,null) 复位
…
0x318946c  ldr  x0, [x19, #0x28]
0x3189474  ldr  x2, [x8, #0x30]             ; pd[2]
0x3189478  ldr  x1, [x8, #0x20]             ; pd[0]
0x3189480  CALL ScriptMessageCommonManager$$SetFontSize      ; [f small center] → (small, center)
```

⚠️ 注意 `pd` 是 `AnalysParam` 的分词结果,**分隔符也占一个元素**(见 `script-format.md` §4.1:
偶数下标 = 值、奇数下标 = 空格/逗号/等号)。所以 `[f small center]` 的 `pd = ["small"," ","center"]`,
长度 3 正好落进 `b.ge #0x318946c` 这一支,读 `pd[0]` 与 `pd[2]` —— **这就是"双参 = 字号 + 垂直对齐"的机制**;
而长度为 2(`[f small ]` 这种尾随分隔符)会走进 `'parameter error'`(`0x3191820` 的 `ldr x8,[x8,#0x58] ; &slot for 'parameter error'`)。
消息路径 `CommonMessageManager$$ProcessScript`(VA `0x3168348`)对同名字面量的处理完全同构:
`0x3168df0 cmp w9,#3 ; 0x3168df4 b.ge #0x3168e50 ; 0x3168e60 CALL ScriptMessageCommonManager$$SetFontSize`。

`ScriptMessageCommonManager$$SetFontSize(string sizeName, string alignName)` VA `0x31d2684`:

```
0x31d26e0  CALL ScriptMessageLabel$$GetFontSize           ; 0x31d271c
0x31d26e4  str  w0, [x19, #0x130]                          ; fontSize(像素)
0x31d26ec  CALL ScriptMessageLabel$$GetVerticalAlignFromString  ; 0x31d2828
0x31d26f8  str  w0, [x19, #0x134]                          ; verticalAlign
```

**这解释了语料里 `[f small center]` / `[f x-small center]` 的两参写法:第 2 参是垂直对齐。**

字号表在 `ScriptMessageLabel$$.cctor` VA `0x31d7ed4`(`Dictionary<object,int>`):

```
0x31d8068  Add x1='-'        w2=#0x1d   (29)   ← 默认
0x31d807c  Add x1='x-small'  w2=#0x13   (19)
0x31d8090  Add x1='small'    w2=#0x18   (24)
0x31d80a4  Add x1='medium'   w2=#0x1d   (29)
0x31d80b8  Add x1='large'    w2=#0x30   (48)
0x31d80cc  Add x1='x-large'  w2=#0x40   (64)
```

`ScriptMessageLabel$$GetFontSize(string s, int current)` VA `0x31d271c`:
`s` 为空或等于 `'-'` → `current>0 ? current : 表['-']`(`0x31d2774 IsNullOrEmpty`、`0x31d2788 op_Equality(x,'-')`);
否则查表 `0x31d2820 b #0x402bd40`。逆变换 `GetFontSizeString(int)` VA `0x31d5dc8`
(被 `ProcessScript 0x31bea68`/`0x31c0604` 用于回写 backlog 日志)。
另一张 `Dictionary<int,int>`(同样在 cctor)把 24→0、29→1、48→2、64→3,是字号档位枚举。

垂直对齐表 `ScriptMessageLabel$$GetVerticalAlignFromString(string)` VA `0x31d2828`:

```
0x31d2890  op_Equality(s,'top')      → 0(或空串 → 0)
0x31d28bc  op_Equality(s,'center')   → 1(mov w0,#1)
0x31d28e0  op_Equality(s,'bottom')   → 2
```

所以 `[f …]` 的完整取值域 = 字号 `{-|x-small|small|medium|large|x-large}` × 垂直对齐 `{top|center|bottom}`。
语料只用到 `small`/`x-small` + `center` 的双参组合各 1 例。

### 3.14 `[s N]` / `[speed N]` 打字速度

`handler 0x3184a58`(`s`/`speed` 同体):

```
0x3184a4c  ldr x1, [x8] ; 's'
0x3184a50  CALL System.String$$op_Equality
0x3184a60  ldr w9, [x8, #0x18] ; cmp w9,#1     ; 必须 1 参
0x3184a7c  ldr x1, [x9] ; '-'
0x3184a80  CALL System.String$$op_Equality  args: x1='-'
0x3184a84  fmov s0, #-1.00000000               ; [s -] / [speed -] → -1(默认)
0x3184aa4  CALL System.Single$$Parse           ; 否则解析成 float
```

语料取值:16 / 0 / 255 / 256 / 150 / 32 / 10000 / `-`。`[align center]…[align][r][s 0]` 这类组合说明
`s` 是"当前这一段"的速度,和字号一样是**状态型**标记(有 `-` 复位)。

### 3.15 `[messageShake …]` / `[messageAlign …]`

`messageShake` 是命令(`handler 0x3182074`),语料里 548 次内联、87 次整行,形状恒为 `float int int float`
(`[messageShake 0.05 4 4 0.4]`),作用是让紧邻的文字抖动。`messageAlign` 是命令(`0x3186e48`),
语料只 1 次整行 `[messageAlign bottom]`。**两者都按整行/内联通用语法走。**

### 3.16 `[wt n]` / `[twt n]`

* `wt`:整行 114,251 + 内联 1,866,参数 `float`(`[wt 1.0]`)。在 `AnalysText` 的已知名字表里(`0x31a9bb8`)。
* `twt`:内联 27,参数 `float`(`[twt 0.5]`),**只出现在 `ScriptManager$$AnalysText` 的名字表**(`0x31a960c`),
  **不在** `commands.json`(366 条)也不在 `all_key_literals.json`(378 条 FNV 常量)里。
  → **INFERRED**:`twt` 是消息层的"等待"变体(推测 = "talk wait",与 `wt` 同族),语料用例都是
  `……[twt 0.5]……` 这种"停顿",与 `wt` 表现一致。**建议播放器把它当 `wt`。**

### 3.17 `[tRaidShortName id n]` / `tRoute` / `tFlag`

`ScriptManager$$ReplaceBranchText(string)` VA `0x31b5064`,对每个 `[...]` 取名字后:

```
0x31b5218  CALL System.String$$op_Equality  args: x1='tRoute'
0x31b5244  CALL System.String$$op_Equality  args: x1='tFlag'
0x31b5270  CALL System.String$$op_Equality  args: x1='tRaidShortName'
0x31b52c4  CALL System.String$$Concat args: x1='[', x3=']'     ; 未命中的标记原样重建
```

调用者:`ScriptManager$$IsEqualTalkName 0x31b4f00`、`ScriptManager$$ProcessScript 0x31c0080 / 0x31c0970 / 0x31c2af4`。
另一条:`ScriptManager$$TextOverwriteRaidShortName`(`0x31c76f8` 引用 `'tRaidShortName '`,带尾空格)。
语料只有 `[tRaidShortName 80593 1]` 3 次(Final Chapter),`tRoute`/`tFlag` 0 次。
**修正 §3:这条表的"`[tRoute <id> <text>]` 正则(VA 0x31a47c0)"属于 `ScriptManager$$ScriptAnalys`
(VA `0x31a4620`,文件级"分支收集"用的正则 `'\\[tRoute (?<id>[0-9]+) (?<text>.+)\\]'`),不是消息渲染路径。**

### 3.18 特殊字符:`・`、`■`、全角 `［］`

* `・`(U+30FB)
  * `ScriptMessageLabel$$UpdateBouten 0x31ceaf0` 用它画傍点(§3.8);
  * `ScriptMessageCommonManager$$GetVerticalAlignedOffset 0x31d29f0/0x31d29fc` 也用 `'・'` 与 `'r'`(垂直对齐用的"标尺"字符);
  * `ScriptManager$$AnalysScript 0x31a6ebc` 用它作为 `[#文本]` 的**内部名字** `'・ '`。
  * ⚠️ 语料里的 `・` 绝大多数是**普通中点字符**(人名 `ネモ・マリーン`),消息文本中共 6,974 个,
    **不能**当作标记计数。判别只能靠"是否被 `[#…]` 包裹"。
* `■`(U+25A0)—— **修正 §3:`■` 不是脚本标记。**
  * 语料 88 行里的 `■` 是**涂黑/乱码文本**(`■■■■■。[r]■■■■■、■■■。`),就是普通字符;
  * 引擎侧 `'■'` 只出现在 UI 初始化:`ScriptLineMessage$$Init 0x317285c / 0x31728fc`、
    `ScriptMessageManager$$Start 0x31d8444 / 0x31d8480`、`ScriptFaceMessageManager$$Start 0x31713cc / 0x3171400`,
    全都是 `UILabel$$set_text("■")`(占位/预热的占位文本)。
* 全角 `［］`—— **修正 §3:不是"名称与称号分隔"。**
  `ScriptMessageLabel$$GetTagFairingString` VA `0x31d67d8`:
  ```
  0x31d6b10  cmp w8, #0x5b                     ; c == '[' ?
  0x31d6b18  ldr x8, [x8, #0x90] ; '［'
  0x31d6b1c  csel x8, x8, x29, eq              ; 是 '[' → '［',否则 → '］'
  0x31d6b24  CALL System.Text.StringBuilder$$Append
  ```
  唯一调用者是 `ScriptReplaceString$$SetString 0x31d922c` —— 也就是说**引擎把外部输入文本(玩家名等)
  里的 `[`/`]` 换成全角,防止它被当成标记**。这是"输入消毒",不是脚本标记。
  语料里全角 `］` 只有 1 次,出现在一条乱码行里(`0100071611.txt:922`),与标记无关。
* 全角 `：`(U+FF1A)—— 用在 **`＠` 说话人行**:`＠<槽位字母>：<显示名>`,7,735 行。
  `ScriptMessageLabel$$GetTalkName`(`0x31d6be0`)**拼接**它:
  `0x31d6fa0 CALL System.String$$Concat args: x1='：'`;同方法用 `String.Format('icon_class_{0:D3}', n)`
  (`0x31d6f68`)与 `LocalizationManager.Get("SCRIPT_ACTION_CODE_CLASS_SPLIT")`(`0x31d6ca8`)。

### 3.19 内部标签 `[~N]` / `[^X]` / `[*X]`(脚本里不该出现)

`ScriptMessageCommonManager$$UpdateLabels` / `ScriptLineMessage$$AddLabel` / `ScriptLogMessage$$UpdateLabels`
里到处是 `'[~1]'`、`'[~'`、`'[^'`、`'[*'` 这几个字面量:
`0x31d00d8 '[~1]'`、`0x31d00cc '[*'`、`0x31d00e4 '[^'`、`0x31d0138 '[~'`、`0x31d0144 ']'`(以及 §3.2/3.3/3.5 的 `Concat`)。
它们是**消息层内部的标签编码**:`[line N]→[~N]`、`[image X]→[^X]`、`[effectmessage X]→[*X]`。
`ScriptMessageCommonManager$$AddLabel`(`0x31cdfe8`)还证明**默认标签类型名是 `line`**:

```
0x31ce338  CALL System.String$$Split               ; 按 ' ' 切标签描述
0x31ce354  CALL System.Int32$$Parse                ; 第 0 段 = 序号
0x31ce36c  cmp  w9, #2
0x31ce370  csel x9, x10, x11, lt                   ; x10 = 'line' 槽 → 只有 1 段时类型名默认 'line'
```

语料 0 次,播放器**不需要**实现它们,但解析时不应该把它们当未知文本(如果有的话)。

---

## 4. `＠` 名称字段里的小语法(补充 §3 未覆盖的部分)

`＠` 行同样是"带标记的文本",并且还有自己的两个小语法:

1. **`＠<槽>:<显示名>`**——7,735 行。`：` 由 `GetTalkName` 用 `Concat` 处理(§3.18)。
   样例:`＠E：ネモ・プロフェッサー`、`＠C：？？？`、`＠L：[#遺分體:エレメンツ]`(名称里还能带注音)。
2. **`=spot[<槽1>,<槽2>]`**——159 行,`ScriptManager$$ProcessScript` 解析:
   ```
   0x31c0884  ldr  x8, [x8, #0xca8] ; &slot for '=spot'
   0x31c0888  ldr  x27, [x8] ; '=spot'
   0x31c0890  CALL System.String$$Contains  args: x1='=spot'    ; name.Contains("=spot")
   0x31c08d0  CALL System.String$$Split     args: x2='=spot'    ; Split("=spot")
   ```
   样例:`＠ネモ・マリーン=spot[H,I]`、`＠W：マシュ=spot[U,F]`、`＠O：ダ・ヴィンチ=spot[T,F]`。
   即**说话人名字后面可以附加"本次发言要点亮(spotlight)哪几个立绘槽"**。
3. `＠` 名里也会跑 `%N`(96 次,如 `＠[%1]`)与颜色(936 次,如 `＠T：[51d4ff]アナウンス[-]`)。

---

## 5. 嵌套规则(实证)

**规则:引擎用"深度计数"切括号、用"深度 + 引号"切参数,因此 `[...[..]..]` 是合法且语义明确的。**
证据(三处独立实现,算法一致):

| 函数 | VA | 深度计数指令 |
|---|---|---|
| `ScriptMessageLabel$$GetBraceIndex` | `0x31d0b64` | `0x31d0b9c cmp w8,#0x5b` / `0x31d0bc0 cmp w8,#0x5d` / `0x31d0bc8 cbz w21,#0x31d0be4` |
| `ScriptMessageLabel$$AnalysTagParam` | `0x31d0f98` | `0x31d1088` / `0x31d1090 subs w25,w25,#1` / `0x31d10a4 add` / `0x31d10ac cbz w25` |
| `ScriptMessageLabel$$GetTagSplitString` | `0x31d0d8c` | `0x31d0e44` / `0x31d0e4c subs w26,w26,#1` / `0x31d0e60 add` / `0x31d0e68 cbz w26` |
| `ScriptManager$$ReplaceBranchText` | `0x31b5064` | `0x31b5134 cmp w8,#0x5b` + 深度寄存器 w28 |

**引号 `"` 会在参数内部屏蔽分隔符**(`0x31d10c8 cmp w8,#0x22` 后进入原样拷贝循环 `0x31d10dc..0x31d1118`),
`ScriptManager$$AnalysParam` 也把 `"` 当特殊字符(`0x31a77f8` / `0x31a7838`),
`ScriptManager$$AnalysText` 同样(`0x31aa624 cmp w8,#0x22`)。

语料现实:**嵌套只有 13 例,全部是 `[&a:b]` 里再套标记**(§1.5)。因为"选一支再解析"是唯一需要嵌套的场景;
`ScriptMessageCommonManager$$UpdateLabels` 对选中的那一支**递归调用自己**(`0x31d05b0`),所以
`[&女の[#躯:からだ]がさほどに珍しいか？:同じ女の[#躯:からだ]、…]` 能正确渲染成
"女の<躯(からだ)>が…" 或 "同じ女の<躯(からだ)>、…"。

> 播放器实现要点:
> 1. `[&a:b]` 先按 `:`(深度 0、引号外)切两支,**只解析选中那一支**(另一支里的 `[` `]` 不参与配对);
> 2. 切括号必须用深度计数,不能"找到第一个 `]`";
> 3. 参数里出现 `"` 时,引号内是字面内容。

---

## 6. 对 `script-format.md` §3 的逐条修正

§3 表格(原文 12 行)+ 其后的 `talkName` 说明 + 文末建议,逐条判定如下。

| # | §3 原文 | 判定 | 修正/补充依据 |
|---|---|---|---|
| 1 | `[#RRGGBB]` … `[-]` 颜色起/止,证据 `'[#'`/`'[-]'`/`GetColor`/`EnforceColorTag`/`RemoveColorTag` | **修正(错)** | 语料 `[#` + 16 进制 = **0 次**。颜色是**裸 16 进制** `[RRGGBB]`/`[RRGGBBAA]`,`#` 由引擎在 `GetColor 0x31d7918 Concat('#', colorTag)` 里补。`IsColorBeginTag 0x31d66bc`(长度 8 或 10、`[`…`]`、hex 字符)是直接证据;旁证 `AccountLinkageParams$$AddColorCodeBracket 0x326e088` 的正则 `(\[[0-9A-F]{6}\])`。`'[#'` 的引用点 `AnalysScript 0x31a536c` / `GetReplacedText 0x31c62e8` 是**别的用途**(注音/强调,见 #3) |
| 2 | `[#ruby:base]` 注音 | **修正(参数顺序 + 命名)** | 正确形态是 `[#基准:读音]`(冒号前是正文)。`ScriptLineMessage$$AddLabel 0x3173a58 Substring(2,len-3)` + `0x3173a8c Split(':')` → 前段进 `FetchMainLabel`、后段进 `FetchRubyLabel`(0x3173a14/0x3173a30)。正则 `'\\[#[^:]+:[^:]+\\]'` 的引用点是 `ScriptLineMessage$$HasRubyFormat 0x3174d90`(文档写的 `HasRubyFormat` 对) |
| 3 | (缺) | **补充** | **`[#文本]`(无冒号)= 强调/傍点**:`AnalysScript 0x31a6eb0 b.gt`(有冒号才走注音)/ `0x31a6ebc '・ '`(无冒号用 `・` 作为内部名)+ `UpdateBouten 0x31ceaf0 Concat(acc,'・')`。语料 4,363 次,是 `#` 标记的第二形态 |
| 4 | `[r]` 换行 | **正确** | 补:`UpdateLabels 0x31d0464 Equals(name,'r')`;`AnalysScript 0x31a6e38 op_Equality(tok,'[r]') → 'r '`;`0x31a6594 Replace(…, '[r]')`(真实换行→`[r]`)。语料 133,096 次 |
| 5 | `[line <n>]` 行内图片(线) | **正确** | 补:`UpdateLabels 0x31d08dc StartsWith(name,'line')` + `0x31d0924 Trim` → `Concat('[~', n, ']')`(内部标签)。取值域 **2..28**(3 占 84.6%) |
| 6 | `[image <name>]` 行内图片 | **补充** | 还有 `[image <name>:<附带文本>]` 形态(语料 48 次,如 `[image npc_language_5:！　オベロン様だ…]`),靠 §2.2 的 `:` 切分;内部标签 `[^…]`(`0x31d06d8 Concat('[^',…)`);立绘形式 `[image <名> 1.5]` 由 `SetTalkName 0x31d3d3c` 构造 |
| 7 | `[~<n>]` / `[^…]` / `[*…]` / `[=…]` 行内效果/标记 | **修正(性质错误)** | 前三个是**引擎内部标签**(`[line]→[~]`、`[image]→[^]`、`[effectmessage]→[*]`),**脚本里不该出现**,语料 **0 次**;`[=` 是 `AnalysScript 0x31a5ac0 StartsWith(tok,'[=')` 认识的另一种前缀,语料 0 次,且 `UpdateLabels 0x31d0648 cmp w8,#0x3d; b.eq` 会把 `[=…]` **跳过不渲染** |
| 8 | `[tRoute <routeId> <text>]` 分支相关文本 | **修正(路径错误)** | 渲染路径是 `ScriptManager$$ReplaceBranchText 0x31b5064`,它识别 **`tRoute` / `tFlag` / `tRaidShortName`** 三个名字(比较点 `0x31b5218/0x31b5244/0x31b5270`)。文档引的正则 `\[tRoute …\]`(VA `0x31a47c0`)属于 `ScriptManager$$ScriptAnalys`(VA `0x31a4620`)的**文件级分支收集**,不是渲染。本语料 `tRoute`/`tFlag` 0 次,`tRaidShortName` 3 次 |
| 9 | `・` / `■` 傍点/强调符 | **部分修正** | `・` 作为傍点成立,但只以"`[#文本]` 的内部名"和 `UpdateBouten` 的输出形式存在;消息文本里的 6,974 个 `・` **绝大多数是普通中点**。**`■` 完全不是标记**:语料里是涂黑/乱码字符(88 行),引擎里只作为 `UILabel.set_text("■")` 的 UI 占位(`ScriptLineMessage$$Init 0x317285c` 等) |
| 10 | 全角 `［` `］` `：` 名称与称号分隔等 | **修正** | `［］` 是**输入消毒**产物:`GetTagFairingString 0x31d67d8` 把 `[`→`［`、`]`→`］`,唯一调用者 `ScriptReplaceString$$SetString 0x31d922c`(玩家名)。`：` 确实用于 `＠<槽>：<名>`(7,735 行),由 `GetTalkName 0x31d6fa0 Concat('：')` 处理 |
| 11 | `small`/`medium`/`large`/`x-small`/`x-large` 字号关键字 | **正确** | 补上具体数值:`ScriptMessageLabel$$.cctor 0x31d8068..0x31d80cc` → `-`=29、`x-small`=19、`small`=24、`medium`=29、`large`=48、`x-large`=64;`[f]/[font]/[fontSize]` handler `0x3187928`;可带第 2 参(垂直对齐) |
| 12 | `top`/`center`/`bottom` 对齐,证据 `GetVerticalAlignFromString` | **补充(与 align 是两条路)** | `GetVerticalAlignFromString 0x31d2828` 是 **`[f …]` 的第二参**(`SetFontSize 0x31d26ec`),不是 `[align]`。`[align]` 是另一套:`ProcessScript` 对整串 `'[align]'`/`'[align center]'`/`'[align right]'` 做 `op_Equality`(`0x31bea20`/`0x31c108c`/`0x31c10b8`),**只有这三个值,没有 left** |
| 13 | `icon_class_{0:D3}` 表情图标资源命名 | **正确** | 引用点 `ScriptMessageLabel$$GetTalkName 0x31d6c90`(作 `String.Format` 的模板) |
| 14 | `talkName` 解析用 `'：'`、`'[image '`、`'icon_class_{0:D3}'` 拆 | **修正(归属错)** | `'[image '` 的**使用点**是 `ScriptMessageCommonManager$$SetTalkName 0x31d3d3c`(构造 `[image <名> 1.5]`),不是 `GetTalkName`;`GetTalkName` 只用到 `'：' / 'icon_class_{0:D3}' / SCRIPT_ACTION_CODE_CLASS_SPLIT`(`0x31d6c90 / 0x31d6c9c / 0x31d6ca8`) |
| 15 | (缺) | **补充** | `[%N]`(§3.10)、`[&a:b]`(§3.11)、`[i 名]`(§3.4)、`[effectmessage …]`(§3.5)、`[servantName]`(§3.6)、`[wt]`/`[twt]`(§3.16)、`[line3]` 这类拼写错误(§2.5) |
| 16 | 文末建议"遇到不认识的 `[...]` 一律原样保留" | **正确,但有更强的实证** | 原样保留不是"建议",而是**引擎的实际行为**:`ScriptMessageCommonManager$$UpdateLabels` 未命中任何比较时走 `0x31d0420..0x31d0448 StringBuilder$$Append` 逐字符拷贝;括号未配对时 `0x31d04c0..0x31d04d8 Append('[')`。语料实证:`[line3]`(`0200011310.txt:90`) |
| 17 | §2 题干"反引号/引号未在证据中出现;`AnalysParam` 只处理 `' '`、`'='`、`,`" | **修正(错)** | 引号 `"` 在**三处**被比较:`ScriptManager$$AnalysParam 0x31a77f8 / 0x31a7838`(`cmp w8,#0x22`)、`ScriptMessageLabel$$AnalysTagParam 0x31d10c8`、`ScriptManager$$AnalysText 0x31aa624`;`IsWithInScriptCondition 0x31c659c` 也加载了 `'"'`。此外 `AnalysParam` 还处理 `'+'`(`0x31a77e8 cmp w8,#0x2b`)。语料里有带引号参数的真实行:`[input selectBranch skipStop "branchNotRouteSelect 4000517 4000574"]` |

**§3 未覆盖、本次新补充的标记(按出现次数排序)**:`[%1]` 3,855、`[#文本]` 4,363、`[51ffff]` 类裸颜色 2,342(+`＠` 936)、
`[&a:b]` 3,071、`[align …]` 535、`[i …]` 45、`[f]/[font]/[fontSize]` 1,344、`[s]/[speed]` 76、
`[twt]` 27、`[tRaidShortName]` 3、`[line3]` 1。

---

## 7. 播放器实现建议(基于本次实证)

1. **先做括号深度扫描**(不能"第一个 `]` 结束"),括号不配对时按字面文本处理(§2.5)。
2. **名字截断字符集固定为 `空格`/`:`/`[`/`]`**(§2.1);名字大小写敏感(`[fontSize]` ≠ `[fontsize]`)。
3. **参数按 `:` 切**,支持 `"` 引号屏蔽;`[&a:b]` 只解析被选中那一支(递归)。
4. 文本内联状态型标记:`[RRGGBB]`(颜色起,8/10 字符且全 hex)、`[-]`(颜色止)、
   `[f …]`/`[font …]`/`[fontSize …]`(字号 + 可选 top/center/bottom)、`[s n]`/`[speed n]`(打字速度,`-` 复位)、
   `[align]`/`[align center]`/`[align right]`(三种精确串)。
5. 替换:`[%1]`=玩家名、`[%2]`=任务名、`[%3]`=任务文本、`[%4]`=带注音任务文本、`[%5]`=所持从者数;
   未知编号按空串处理并补 `[-]`(引擎行为:`0x31d0410 Concat(替换文本,'[-]')`)。
6. **不认识的 `[...]` 原样输出**,并建议在调试视图里高亮(便于发现版本新增标记)。
7. 注意事项:`・` 是普通字符,只有 `[#…]` 包裹才是强调;全角 `［］` 与 `■` 都不是标记。

---

## 8. INFERRED / 未决

1. **INFERRED** `[#文本]` 的视觉效果就是"给文字加傍点" —— 代码路径明确(`'・ '` + `UpdateBouten` 每字符一个 `・`),
   但没有真机截图佐证。
2. **INFERRED** `[i 名]` 与 `[image 名]` 的渲染差异(推测 `i` 是小图标、`image` 是行内立绘语言气泡),
   两者共用同一资源命名族(`berserker_language_*` / `npc_language_*`),本次未能从代码中区分尺寸/锚点。
3. **INFERRED** `[&a:b]` 中 `playerGenderIndex` 的取值是 1/2 还是 0/1:`GetTagSplitString` 的 index 从 1 起算
   (`0x31d0f00`),而 `SetPlayerGenderIndex`/`GetPlayerGenderIndex`(`0x31d93f4`/`0x31d9450`)在 2.139.3 中
   **无调用者**;`playerGenderIndex` 由 `0x31a35e4 str w22,[x8,#8]` 从 `UserGame+0x4c` 直接写入。
4. **INFERRED** `[twt n]` 语义(推测定为"等待",与 `wt` 同族):它只出现在 `AnalysText` 的已知名字表
   (`0x31a960c`),不在 366 条命令、也不在 378 个 FNV 常量里。
5. **未决** `[f …]` 第 2 参之外的参数(4 参以上)语义:`fontSize` handler 对 `≥3` 参走 `0x3189480`,
   代码里只取 `p[0]/p[1]`,剩余参数未观察到用例。
6. **未决** `[%2]/[%3]/[%4]` 只由 `FirstExecuteScript` 在**脚本启动时**写入(任务名/任务文本),
   从者名等其它变量是否存在其它写入点未穷尽(仅确认 4 个 `SetString` 调用点)。

---

## 9. 证据索引(本文引用的全部 VA)

| VA | 方法 / 位置 | 用途 |
|---|---|---|
| `0x31d0bf8` | `ScriptMessageLabel$$GetCommandName` | 标记名截断字符集 `空格`/`:`/`[`/`]`(cmp 在 `0x31d0c88..0x31d0c94`) |
| `0x31d0f98` | `ScriptMessageLabel$$AnalysTagParam` | 参数 `:` 切分 + 深度 + 引号(`0x31d1080`/`0x31d1088`/`0x31d1090`/`0x31d10ac`/`0x31d10c8`) |
| `0x31d0d8c` | `ScriptMessageLabel$$GetTagSplitString` | 取第 N 个参数(深度/引号同款;index 比较 `0x31d0f00`) |
| `0x31d0b64` | `ScriptMessageLabel$$GetBraceIndex` | 配对括号(深度;`0x31d0b9c`/`0x31d0bc0`/`0x31d0be0`) |
| `0x31d66bc` | `ScriptMessageLabel$$IsColorBeginTag` | 裸 16 进制颜色(`0x31d66fc`/`0x31d671c`/`0x31d6738`/`0x31d67a0`) |
| `0x31d781c` | `ScriptMessageLabel$$GetColor` | `'#'+tag` → `ColorUtility.TryParseHtmlString`(`0x31d7918`/`0x31d7924`);`'[-]'` 判定 `0x31d78ac` |
| `0x31ce9b0` | `ScriptMessageLabel$$UpdateBouten` | 傍点:每字符一个 `'・'`(`0x31ceaf0`) |
| `0x31d7ed4` | `ScriptMessageLabel$$.cctor` | 字号字典(`0x31d8068..0x31d80cc`)、`'[line '`(`0x31d7f6c`) |
| `0x31d271c` | `ScriptMessageLabel$$GetFontSize` | 字号名 → 像素(空/`'-'` 取默认 29) |
| `0x31d5dc8` | `ScriptMessageLabel$$GetFontSizeString` | 像素 → 字号名(backlog 用) |
| `0x31d2828` | `ScriptMessageLabel$$GetVerticalAlignFromString` | top/center/bottom → 0/1/2 |
| `0x31d6be0` | `ScriptMessageLabel$$GetTalkName` | 全角 `'：'` 拼接(`0x31d6fa0`)、`icon_class_{0:D3}` |
| `0x31d67d8` | `ScriptMessageLabel$$GetTagFairingString` | `[`→`［`、`]`→`］`(输入消毒;`0x31d6b18`);调用者 `0x31d922c` |
| `0x31cfff8` | `ScriptMessageCommonManager$$UpdateLabels` | 主解析循环:`'effectmessage' 0x31d0318` / `'%' 0x31d039c` / `'&' 0x31d04f4` / `'r' 0x31d0464` / `'image' 0x31d0680` / `'i' 0x31d07b8` / `'line' 0x31d08dc` / `'servantName' 0x31d0840` / `'[-]' 0x31d0410` / 原样拷贝 `0x31d0420`/`0x31d04d8` / 递归 `0x31d05b0` |
| `0x31d2684` | `ScriptMessageCommonManager$$SetFontSize` | 字号 + 垂直对齐(`0x31d26e0`/`0x31d26ec`) |
| `0x31d29f0` | `ScriptMessageCommonManager$$GetVerticalAlignedOffset` | 用 `'・'` 计算垂直偏移 |
| `0x31cdfe8` | `ScriptMessageCommonManager$$AddLabel` | 内部标签默认名 `'line'`(`0x31ce370 csel`) |
| `0x31d0d0c` | `ScriptReplaceString$$GetString` | `replaceList[num]` |
| `0x31d9054` | `ScriptReplaceString$$Init` | 默认替换表内容(含嵌套标记样例 `0x31d908c`) |
| `0x31d9198` | `ScriptReplaceString$$SetString` | 调用 `GetTagFairingString`(`0x31d922c`) |
| `0x31a33ec` | `ScriptManager$$FirstExecuteScript` | `%1..%5` 写入点(`0x31a35a8`/`0x31a3624`/`0x31a363c`/`0x31a3654`/`0x31a3684`)、`playerGenderIndex`(`0x31a35e4`) |
| `0x31c601c` | `ScriptManager$$GetReplacedText` | `'%'`(`0x31c6190`)、`'&'`+性别(`0x31c61f8`/`0x31c6244`/`0x31c6264`) |
| `0x31a50ec` | `ScriptManager$$AnalysScript` | 内联标记集合判定(`0x31a6814..0x31a68a4`)、`'[r]'` 规范化(`0x31a6e38`)、`'・ '`(`0x31a6ebc`)、`'[=' 0x31a5ac0` |
| `0x31a920c` | `ScriptManager$$AnalysText` | 已知名字表(含 `'wt' 0x31a9bb8`、`'twt' 0x31a960c`)、引号 `0x31aa624` |
| `0x31bc344` | `ScriptManager$$ProcessScript` | `'[align]'`/`'[align center]'`/`'[align right]'` 整串比较(`0x31bea20`/`0x31c108c`/`0x31c10b8`/`0x31c11ec`);`'=spot' 0x31c0888` |
| `0x31a7688` | `ScriptManager$$AnalysParam` | `'+'`/`' '`/`'"'`/`','`/`'='`(`0x31a77e8`/`0x31a77f0`/`0x31a77f8`/`0x31a7838`/`0x31a7864`/`0x31a786c`) |
| `0x31b5064` | `ScriptManager$$ReplaceBranchText` | `tRoute`/`tFlag`/`tRaidShortName`(`0x31b5218`/`0x31b5244`/`0x31b5270`) |
| `0x3173948` | `ScriptLineMessage$$AddLabel` | `[#` 拆分:`FetchMainLabel`/`FetchRubyLabel`(`0x3173a14`/`0x3173a30`/`0x3173a58`) |
| `0x3174d64` | `ScriptLineMessage$$HasRubyFormat` | 正则 `'\\[#[^:]+:[^:]+\\]'`(`0x3174d90`) |
| `0x3187928` | `ScriptManager$$ScriptCommandExecute`(`f`/`font`/`fontSize` handler) | 参数个数分支(`0x3187938`/`0x3188cac`/`0x318946c`);三个名字各自的取字面量点 `0x3185408('f')`/`0x318017c('font')`/`0x3187914('fontSize')` 都以 `b #0x3187920` 汇入同一比较 |
| `0x3168348` | `CommonMessageManager$$ProcessScript` | 消息路径的同名字面量处理(`0x3168df0 cmp w9,#3` / `0x3168e60 SetFontSize`);`'parameter error'` 槽 `0x55c9000+0x58` |
| `0x3184a58` | `ScriptCommandExecute`(`s`/`speed` handler) | `'-'`→-1 / `Single.Parse`(`0x3184a80`/`0x3184aa4`) |
| `0x2e5bb7c` | `LocalizationManager$$ReplaceNameTag` | 对 `&`/`^`/`~`/`%`/`line` 前缀**跳过**(`0x2e5bec8` 等) |
| `0x326e088` | `AccountLinkageParams$$AddColorCodeBracket` | 正则 `'(\\[[0-9A-F]{6}\\])'` |

语料侧的可复现产物:`work/scratch/inline_scan.json`(全量统计)、`work/coverage/inline_scan.py`(扫描器)、
`work/scratch/findlit.py`、`work/scratch/winlit.py`(证据工具)。

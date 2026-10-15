# 执行模型闭环 —— `AnalysScript` ⇄ `AnalysText` 的分工与 `[k]` 的两级处理

> 本文收口 `coverage-verification.md` §5 的残余项 2/3(及 4 参见 `closure-meta-assets.md`)。
> 所有结论均为本次反汇编实测;1 条残余标 INFERRED(见 §4)。

---

## 1. 调用结构(先钉骨架)

```
ScriptManager$$LoadScriptAnalys(name,label)        0x31a45f0   ← 薄包装:GetScriptData() 后转调
      └─ ScriptManager$$ScriptAnalys(label,data,ori) 0x31a4620  ← 产出 List<List<string>>
             ├─ ScriptManager$$AnalysScript(scriptData)         0x31a50ec   ← 逐行循环 + 行级解析
             │      └─ ScriptManager$$AnalysText(...)            0x31a67c0   ← 每行调用(call site)
             └─ ScriptManager$$AnalysParam(...)                  0x31a7688
```

`AnalysText` 在**整个代码里只有 1 个调用者**:`ScriptManager$$AnalysScript` 的 `0x31a67c0`
(`find_callers.py 0x31a920c` → 1 caller)。也就是说"行分类"不是独立一遍扫描,而是
`AnalysScript` 逐行解析时**带着跨行状态**调用的。

### 1.1 签名(dump.cs:169469)

```csharp
protected void AnalysText(
    ref List<string> tagDataList,   // x1  → 局部 [sp+0x40]
    ref List<string> scriptDataList,// x2
    ref List<int>    lineDataList,  // x3  → [sp+0x38]
    ref List<int>    orgLineDataList,// x4 → [sp+0x30]
    ref int          lastMessageIndex,// x5→ [sp+0x48]  ← "当前未闭合消息块"的索引,-1 = 无
    ref string       talkName,      // x6  → [sp+0x20](= 说话人,判空用)
    ref bool         messageLine,   // x7
    ref int          fontSize,
    string analysData, int line, int orgLine)
```

函数序言把入参落到栈槽(实测 `0x31a923c: stp x5,x2,[sp,#0x48]` / `0x31a9240: stp x4,x3,[sp,#0x30]` /
`0x31a9244: str x1,[sp,#0x40]`),后续所有对 `[sp+0x48]`(=`lastMessageIndex`)、`[sp+0x40]`(=`tagDataList`)
的读写因此都可直接判定语义。

### 1.2 四条列表按"记录"对齐

`tagDataList` / `scriptDataList` / `lineDataList` / `orgLineDataList` 是**逐记录并行**的四条列表:
一条记录 = 一行指令或一行消息;消息记录**没有 tag**,所以 `tagDataList` 对应位置放 `null` 占位
(这就是 §2 那个 null 条目的来历)。

## 2. `[k]` / `[q]` 的两级处理(闭环)

### 2.1 tag 级:`AnalysScript` 补 `talkEnd`

`[k]` 与别名 `[q]` 走同一条分支链(`AnalysScript` 内,`op_Equality` 链起点 0x31a5cf8):

```
0x31a5cf0  ldr  x8, [x8, #0xf98]           ; &'k'
0x31a5cf8  bl   #0x4870cc0  CALL String$$op_Equality    
0x31a5cfc  tbnz w0,#0 → 0x31a5d1c           ; tag == "k" 命中
0x31a5d0c  ldr  x8, [x8, #0xfa0]  ; &'q'   ; 否则再试 'q'
0x31a5d14  bl   #0x4870cc0  CALL String$$op_Equality
0x31a5d18  tbz  w0,#0 → 0x31a5e18           ; 都不是 → 链上下一项(talkName/selectionUse/switchCase/…)
--- 命中路径 ---
0x31a5d1c  ldr  w8, [sp, #0x6c]; tbnz w8,#0x1f → 0x31a622c   ; 该行索引 <0 则跳过
0x31a5d24  x0 = [sp+0x60](talkName); op_Inequality(talkName, "")   ; 有未闭合说话人?
0x31a5d34  x27 = [sp+0x88]                                    ; = &tagDataList
0x31a5d4c  ldr  x9, [x9, #0xce0]  ; &'talkEnd'
0x31a5d40-0x31a5d6c  tagDataList.Add("talkEnd")               ; ← 补一条 talkEnd 记录
```

⇒ **`[k]` 的 tag 级语义 = "结束当前说话人块":若 `talkName` 非空,向 `tagDataList` 追加 `"talkEnd"`。**

### 2.2 消息级:`AnalysText` flush + `null` 占位

`AnalysText` 的 `k` 哈希分支(`fnv1a("k")=0xEE0C38EA` @0x31ab554 → 体 0x31ad4d8;`q` 同址汇入):

```
0x31ad4ec  x8=[sp+0x48](=&lastMessageIndex); w8=[x8]
0x31ad4fc  tbnz w8,#0x1f → 0x31ad5a0           ; lastMessageIndex < 0 ⇒ 无待闭合消息,跳过 flush
--- flush 块 0x31ad500-0x31ad590 ---
0x31ad500  x0=[ [sp+0x20] ](talkName); op_Inequality(x0,"")
0x31ad560  0x201abc4(…, x1='', …)              ; 追加空条目
0x31ad578  0x201ff54(lineDataList,  w[sp+0x2c])   
0x31ad590  0x201ff54(orgLineDataList, w[sp+0x28])
0x31ad594  str w9(#-1) → [sp+0x48]             ; lastMessageIndex = -1
--- 两条路径都到这里 ---
0x31ad5a0  x0 = [sp+0x40] (= &tagDataList)
0x31ad5ac-0x31ad5ec  inlined List<string>.Add:
     0x31ad5ac  w10=[x0,#0x1c](_version); 0x31ad5b0 x8=[x0,#0x10](_items)
     0x31ad5b8  _version++; 0x31ad5c4 x10=[x0,#0x18](_size)
     0x31ad5cc  cmp _size, _items.Length; b.hs → GrowIfNeeded(0x31b03f4)
     0x31ad5d4  x8 = _items + _size*8; _size++
     0x31ad5e4  str xzr, [x8,#0x20]!           ; ← 写入 null
     0x31ad5ec  bl #0x2230448                  ; GC 写屏障
```

⇒ **`[k]` 的消息级语义 = "闭合消息块":把待闭合的消息记录 flush 进 `scriptDataList`/`lineDataList`/
`orgLineDataList`,复位 `lastMessageIndex = -1`,并向 `tagDataList` 追加一条 `null` 占位记录。**

### 2.3 为什么必须有 `null` 占位

`[k]` 在 tag 级多产出了一条 `"talkEnd"` 记录、在消息级又 flush 出一条消息记录,两边都要在
`tagDataList` 里占位以保持四条列表**索引对齐**(§1.2)。`[k]` 行本身没有消息文本,所以占位值只能是 `null`。

## 3. 运行期消费端(闭环)

行分类结果被预计算成 4 条数组,由 `ProcessScript` 消费:

| 字段 | dump.cs | 写入点 | 读取点 |
|---|---|---|---|
| `executeLineList` (int[]) | 0x340 | — | `IsMessageLine` 0x31b7ad8 |
| `executeOrgLineList` (int[]) | 0x348 | — | — |
| `executeMessageFlagList` (bool[]) | 0x350 | `AnalysScript` **0x31a756c** `str x19,[x21,#0x350]` | `ProcessScript` **0x31c1a20**、`IsMessageLine` **0x31b7af0** |
| `executeMessageMaxSizeList` (int[]) | 0x358 | `AnalysScript` **0x31a7580** `str x1,[x21,#0x358]` | `ProcessScript` **0x31c1a34/0x31c1a64** |
| `executeSwitchList` (int[]) | 0x360 | (见 `closure-choice-branch.md`) | 选项跳转 |

- `IsMessageLine(i)` = `executeMessageFlagList[executeLineList[i]]`(0x31b7ad4-0x31b7b10),
  即 README 说的"只是查预计算数组" ✓(数组在 `AnalysScript` 末尾整体赋值)。
- `ProcessScript` 的消息块切分:**0x31c1a1c `AnalysParam` → 0x31c1a20/0x31c1a34 取两条数组 →
  0x31c1a58 起调 `ScriptMessageCommonManager`**(0x22305f4 = 单例取用),按 flag/maxSize 把
  `scriptDataList` 里的消息文本切给消息系统。
- `ProcessScript` 取 tag 做分派:`0x31bd140 ldr x25,[x20]` → `0x31bd14c ComputeStringHash(x25)`
  (0x2cdf448 = `<PrivateImplementationDetails>$$ComputeStringHash`),此前在 0x31bd128/0x31bd130
  有两个前置分支(其中 0x31bd138 `cbz → 0x31bd5c4` 绕过取 tag)。

## 4. 残余(INFERRED,1 条)

- `ProcessScript` 的 tag 取用点 0x31bd140 **没有** null 检查就直接 `ComputeStringHash`;因此 §2.2 插入的
  `null` 记录必然在**到达该点之前**被跳过或不被当作可执行行。候选点是 0x31bd128-0x31bd13c 的三个前置条件
  与目标 0x31bd5c4 / 0x31c2850,但**哪一条对应 `null` 记录未被钉死(INFERRED)**。
  不影响播放器实现:实现方只需把"无 tag 的记录"当消息体处理即可(与 `executeMessageFlagList` 的语义一致)。

---

## 复现命令

```bash
cd F:/Project/fgo
python work/tools/find_callers.py 0x31a920c          # AnalysText 唯一调用者 0x31a67c0
python work/coverage/win.py 0x31a5cf8 8 120          # AnalysScript 的 k/q op_Equality 链 → tagDataList.Add("talkEnd")
python work/coverage/win.py 0x31ad4d8 20 90          # AnalysText 的 k/q 体:flush + Add(null)
python work/coverage/win.py 0x31b7ad4 8 40           # IsMessageLine = executeMessageFlagList[executeLineList[i]]
python work/coverage/win.py 0x31c1a20 20 60          # ProcessScript 消费 executeMessage*List
grep -n "0x350\|0x358\|0x360" work/out/_evidence/class_ScriptManager.txt   # 字段名(0x340-0x360)
```

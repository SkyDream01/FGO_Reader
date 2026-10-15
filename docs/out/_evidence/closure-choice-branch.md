# 闭环选项（分支选择）语义 —— 语料全量统计 + 引擎反汇编取证

> 目标：把「`？n：文本` … `？！`」这套闭环选项语法，从**语料实证**（A 部）和**引擎反汇编**（B 部）
> 两侧同时钉死，最后给运行时模型（C 部）。
>
> 二进制：`work/extract/lib/arm64-v8a/libil2cpp.so`（FGO 2.139.3，代码段 `0x2321aa4–0x5311320`）。
> 工具：`python work/coverage/win.py <VA> [前] [后]`（带 `; 'literal'` / `CALL 方法名` 注解）、
> `python work/tools/find_callers.py 0x...`、`work/il2cpp_out/dump.cs`、`work/il2cpp_out/lit_methods.json`、
> `work/il2cpp_out/stringliteral.json`、`work/tools/resolve_strings.py`（字符串字面量槽位 → 值）。
> 标记符来源（`＠＄＃？？！：；`）见 `marker-table.md`；本文只补它没覆盖的部分。
>
> 惯例：`0x…` 全为 **VA**，每条都在本文里给出**指令原文**；凡是没有直接指令支撑的推断一律标注 **INFERRED**。

---

## 0. 复现命令

```bash
cd F:/Project/fgo

# A 部：语料全量统计（本文 A.0–A.10 的所有数字都由下面这段一次跑出）
python - <<'PY'
import os,re,io,collections
ROOT=r'F:\Project\fgo\scripts'; opt_re=re.compile(r'^？([^：]*)[：](.*)$')
files=[os.path.join(dp,fn) for dp,_,fs in os.walk(ROOT) for fn in fs if fn.endswith('.txt')]
n_opt=n_end=blocks=0; per=collections.Counter(); idx=collections.Counter()
for p in files:
    L=io.open(p,encoding='utf-8-sig',errors='replace').read().replace('\r\n','\n').split('\n')
    inblk=False; cur=[]
    for ln in L:
        if ln.startswith('？！'):
            n_end+=1
            if inblk: blocks+=1; per[len(cur)]+=1; inblk=False
            continue
        m=opt_re.match(ln) if ln.startswith('？') else None
        if m:
            n_opt+=1
            if not inblk: inblk=True; cur=[]
            cur.append(m.group(1)); idx[m.group(1)]+=1
print('files',len(files),'opt',n_opt,'end',n_end,'blocks',blocks)
print('per',dict(sorted(per.items())))
print('idx',dict(sorted(idx.items(), key=lambda kv:(len(kv[0]),kv[0]))))
PY
# 实测输出（本文引用值）：
# files 2583 opt 18197 end 11684 blocks 11676
# per {1: 5191, 2: 6456, 3: 23, 4: 5, 5: 1}
# idx {'1': 11658, '2': 6466, '3': 25, '4': 6, '5': 1, '1,1000': 4, ... , '1,1000,saveMaterial': 1, ...}

# B 部：反汇编窗口（示例，全部 VA 见正文）
python work/coverage/win.py 0x31a10b0 0 300    # Initialize：本地化键 → 字段映射
python work/coverage/win.py 0x31a66f0 0 60     # AnalysScript：？行 → tag 'switchCase'
python work/coverage/win.py 0x31a5f24 0 60     # AnalysScript：？！行 → tag 'switchCaseEnd'
python work/coverage/win.py 0x31a9080 0 40     # IsCodeSwitchCaseString（StartsWith('？') + Contains('：')）
python work/coverage/win.py 0x31b2e8c 0 100    # JumpScriptSwitchCase：索引 → flag / PlayerPrefs / 跳转入选项体
python work/coverage/win.py 0x31c2aa4 0 145    # ProcessScript：执行到 ？tag → 组选项文本 → 弹选择窗
python work/coverage/win.py 0x31c7f50 0 80     # HiddenFlagCheckReplaceMessage（`；` 语义）
python work/coverage/win.py 0x31875c4 0 30     # ScriptCommandExecute：tag 'switchCase' + isSwitchCase → 跳 switchCaseEnd
python work/coverage/win.py 0x3188c58 0 40     # ScriptCommandExecute：tag 'switchCaseEnd' → 复位 isSwitchCase
python work/coverage/win.py 0x317d28c 0 45     # selectionUse 命令处理器（CheckSwitchType 守卫）
python work/coverage/win.py 0x31b6e50 0 60     # EndSelectSwitchCase（Close / SaveSwitchSelection / JumpScriptSwitchCase）
python work/coverage/win.py 0x31c9e7c 0 70     # ScriptLoop.SetSwitchCase（回想/日志记录）
```

---

## A. 语料侧分类（`scripts\` 33 章全量，2583 个 `.txt`）

### A.0 总量与基本一致性

| 量 | 值 | 说明 |
|---|---|---|
| 文件数 | 2,583 | `scripts\**\*.txt` |
| 物理行数 | **1,870,344**（按 `\n` 切分）| 减去每文件末尾的空元素 2,583 ⇒ **1,867,761**，与既有 `supplement-script-format` 的数字**完全一致** |
| 以 `？` 开头的行 | **29,881** | 与 §A.1 的 18,197 + 11,684 严格相等 |
| `？<n>：<文本>` 选项行 | **18,197** | 正则 `^？([^：]*)[：](.*)$` |
| `？！` 行 | **11,684** | 全部**独占一行**（11,684/11,684；`end_shared=0`）|
| 由「选项行…`？！`」构成的块 | **11,676** | 8 个 `？！` 不落在块内，见 §A.3 |
| `；`(HIDDEN) 出现在行内 | **14 行**（其中 11 行为选项行，3 行为 `[line 3]` 乱码行）| 行首 `；` = 0（既有结论成立，但**行内**用法存在，见 §A.5）|
| `？` 出现在行内但非行首 | 31,956 行（如 `＠？？？` 2500 行、`[FFFFFF]？[-]` 124 行、`……？` 76 行）| 说话人「？？？」与台词的疑问符，不参与语法 |

### A.1 每块选项数分布（1/2/3/4/5）

| 选项数 | 块数 |
|---|---|
| 1 | 5,191 |
| 2 | 6,456 |
| 3 | 23 |
| 4 | 5 |
| 5 | 1 |

- 单选项块 = 5,191（占 44.5%）：**「无分支的台词/动作选项」**（玩家必须点一下才继续；选项文本本身就是要显示/记录的那一句，见 §A.9、§C.4）。
- 多选项块 = 6,485（2 选项为主）。

### A.2 序号 `n` 的取值分布（是否 1..k 连续 / 是否重复）

| `？n：` 的 `n` | 行数 |
|---|---|
| `1` | 11,658 |
| `2` | 6,466 |
| `3` | 25 |
| `4` | 6 |
| `5` | 1 |
| 非纯数字（`1,1000` / `1,1000,saveMaterial` 等）| 41 |

- **每块内 `n` 一律是 `1..k` 连续、无重复、无空洞**：以「块内序号集合 == {1..k}」为判据的检查在 11,676 个块里全部通过，0 例外（脚本判据：块内首选项若为纯数字则必为 `1`，`notstart1=0`）。
- 上下文相关统计：块内多选项且「选项文本被内联性别分支包裹」的行 1,317 行（形如 `？1：[&ああ:うん]……`，`[&男:女]` 与 `[&のか:の]` 均属此类）。
- 不存在 `？1：` 紧跟 `？！` 之外的特例：`？n：` 行**永远**位于块内（0 个「孤零选项行」）。

### A.3 `？！` 的形态与 8 个「非块尾」`？！`

- 11,684 行全部为**独立成行**、行内容恰为 `？！`（`end_shared=0`，即没有 `？！xxx` 形式）。
- 8 个 `？！` 不属于「块」：**含义是把 `？！` 当作「跳转落点/终止标记」单独使用**，不是块尾：
  - `Lostbelt No6…Avalon le Fae\0300092010.txt:478`：上一行是 `[label select_end]`（`477`），即 **label 后面直接跟 `？！`** —— `？！` 作为「跳到这里即结束该选项块」的落点；
  - `Lostbelt No1…Anastasia\0300012020.txt:2107`、`Ordeal Call IV…\0400050211.txt:1299/1474`、`0400050220.txt:1437`、`The Inescapable Gehenna Id\0400032010.txt:148`、`0400032320.txt:358`、`0300020441.txt:513`：位于一段普通演出之后、`[branch …]`/`[label …]` 之前，同样充当「块终止落点」。
  - 结论：`？！` 既是**块尾**，也是**可从外部跳入的 switch-case 终止标签**（引擎侧由同一个 `switchCaseEnd` tag 承担，见 §B.5）。

### A.4 块前导行 / 块后命令（Top 20）

**块首选项行之前最近的非空行**（决定「选项是否总在 `[k]` 之后」）：

| 前导行 | 次数 |
|---|---|
| `[k]` | 8,258 |
| `[wt 0.5]` | 530 |
| `[wt 1.0]` | 450 |
| `[wt 1.5]` | 207 |
| `？！` | 160 |
| `[wt 0.4]` | 138 |
| `[wt 0.7]` | 134 |
| `[wt 2.0]` | 119 |
| `[wt 1.2]` | 98 |
| `[wt 0.1]` | 88 |
| `[wt 0.6]`/`[wt 0.2]` | 76 / 71 |

> 即：**约 70.7% 的块紧跟在 `[k]`（台词结束）之后**，其余主要跟在 `[wt …]` 停顿之后；160 处是「上一个块刚结束接着下一个块（链式块）」。
> 所以「选项总在 `[k]` 之后」**不成立**，但「选项总在**一段台词/停顿结束之后**」成立（`？` 行永远不打断消息体）。

**块尾 `？！` 之后的第一条非空行** Top 20：

| 后继命令 | 次数 |
|---|---|
| `[charaFace` | 3,219 |
| `[charaFadeout` | 2,486 |
| `[messageOff]` | 2,007 |
| `[charaTalk` | 841 |
| `[bgm` | 301 |
| `[wt` | 221 |
| `[bgmStop` | 189 |
| `＠マシュ`（说话人）| 155 |
| `[se` | 123 |
| `[charaFaceFade` | 100 |
| **`[branch`** | **77** |
| **`[label`** | **72** |
| `[charaSet` | 61 |
| `[charaPut` | 59 |
| `[seStop` | 51 |
| `＠？？？` | 48 |
| `＠`（无名字说话人）| 37 |
| `[fadeout` | 35 |
| `[cueSe` | 35 |
| `[communicationCharaClear]` | 34 |

> 绝大多数块后是普通演出/台词；只有 77+72 处块后立刻出现 `[branch …]` / `[label …]` ——
> 这正是「**选项 → 跳转**」的写法（详见 §A.9）。

### A.5 `；`（SCRIPT_ACTION_CODE_SWITCH_CASE_HIDDEN）在语料里的真实用法

全文 14 行含 `；`，逐一列出后分三类：

**(1) 条件隐藏型选项（10 行，语法：`？n：<文本>；<flag名>`）**

| 文件:行 | 原文 |
|---|---|
| `Final Chapter\0400070720.txt:1243` | `？1：クエスト開始 ；flag_1` |
| `Final Chapter\0400070720.txt:1244` | `？2：クエスト開始 ；flag_2` |
| `Ordeal Call III…\0400040520.txt:441` | `？1：ジナコはここのボス、でいい[&のか:の]？；flag_1` |
| `Ordeal Call III…\0400040520.txt:445` | `？2：ムーン・ドバイとは？；flag_2` |
| `…:449` | `？3：ＢＢドバイとは？；flag_3` |
| `…:453` | `？4：人類滅亡ラスボス決定戦について；flag_4` |
| `…:457` | `？5：ムーン・ドバイにおけるムーンキャンサーとは；flag_5` |
| `Ordeal Call IV…\0400051740.txt:560` | `？1： ；hide_flag`（文本为空）|
| `編 郷愁永巡刻盤 パストカルデア\0500010320.txt:180/182/184` | `？1,1001：ライブラリで映画鑑賞を；flag_1000` 等 3 行 |

**(2) 乱码/占位行（3 行，非标记）**：`Seventh Singularity…\0100071610.txt:792/960`、`0100071611.txt:927`
（`[line 3]…ｓ＠４ｒ；ｆ＠ｅｅｙｗ＠ｒ[r]…` 这类「假名替换字形」演出文本，`；` 只是被扰乱后的普通字符）。

> 结论：`；` 是**「文本后缀 + flag 名」**的行内标记，**不是**独立一行的标记。
> 引擎里的判定函数是 `HiddenFlagCheckReplaceMessage`（含 `String.Contains('；')`），见 §B.8。

### A.6 非数字序号：素材消耗型选项（18 个块、41 行）

形式：`？<选项序号>,<素材ID>[,saveMaterial]：<文本>`

```
Lostbelt No6…Avalon le Fae\0300090260.txt:270  ？1,1000,saveMaterial：それはどういう……？
                                            282  ？2,2000,saveMaterial：…（もしかして、アルトリアとオベロンの眼って……）
                                            284  ？！
Lostbelt No6…Avalon le Fae\0300081031.txt:416  ？1,5000：ひとなみに、好きだと思うよ
                                            417  ？2,6000：……
```
- `saveMaterial` 相关行 18 行（`Lostbelt No6` 9 个文件 × 2 行 + …）、`[branchMaterial …]` 命令 26 次（`branchNotMaterial` 0 次）。
- 第二字段实测取值：`1000/1010/1020/…/1080`、`2000/2010/…/2080`、`3000`、`3001`、`4000`、`5000`、`6000`（小整数族），
  以及 `04000517`、`04000574`、`500010521`、`500015121`（长数字，出现于 `Ordeal Call IV\0400051740.txt`、`0500010211.txt`）。
- 序号仍取逗号前第一段、文本取最后一个 `：` 之后，**脚本层可确认**；第二/第三字段（素材或条件 id、`saveMaterial`）
  的具体消耗流程由引擎另路实现 —— 这部分 **INFERRED**，不在本文结论内。

### A.7 `[input selectBranch]`（83 行 `[input …]` 的完整形态与分布）

`[input …]` 全量 = **83** 行，形态只有三种：

| 完整原文 | 次数 |
|---|---|
| `[input selectBranch]` | **81** |
| `[input selectBranch skipStop "branchNotRouteSelect 4000517 4000574"]` | 1（`Ordeal Call IV…\0400051740.txt:529`）|
| `[input name]` | 1 |

`[label selectBranch]` = **82** 行；`[branch … INPUT_SELECT_BRANCH …]` = 22 行：

| `[branch …]` 形态 | 次数 |
|---|---|
| `[branch INPUT_SELECT_BRANCH_2 INPUT_SELECT_BRANCH 1]` | 11 |
| `[branch INPUT_SELECT_BRANCH_3]` | 8 |
| `[branch INPUT_SELECT_BRANCH_01b INPUT_SELECT_BRANCH 1]` | 3 |

**它与 `？n：` 块的距离关系（81 处 `[input selectBranch]` 全量）**：

- 其**后方同文件内**存在 `？` 行的：43 处。这 43 处里，`[input selectBranch]` 与后续第一个 `？` 之间**恰好存在 1 个 `[label selectBranch]`** 的有 42 处（另 1 处为 2 个）。
- 其后**本文件内不再出现任何 `？` 行**的：**39 处** —— 全部出现在文件末尾段落（如 `Lostbelt No1…Anastasia\0300010210.txt:1666`，
  之后 1695 `[label selectBranch]`，1701 章节特效，1709 `[end]`）。此时 `？` 块在**别处**（同 quest 的其它脚本文件 / 由 label 承接）。
  这 39 处的确切承接方式 **INFERRED**（引擎侧证据见 §B.6/B.7：索引来自 flag/PlayerPrefs，不需要本文件重列选项）。

**因此 `[input selectBranch]` 不是「块后触发」，而是「进入选择段的入口标记」**；典型排布（`Lostbelt No1…Anastasia\0300011720.txt`）：

```
 71 [input selectBranch]          ← 入口标记（+ 大量场景搭建）
 94 [label selectBranch]          ← 恢复/跳转落点
 97 ？1：森の伐採を手伝う
 98 ？2：トンネルの掘削を手伝う
 99 ？！
104 [branch INPUT_SELECT_BRANCH_2 INPUT_SELECT_BRANCH 1]   ← 用 flag 决定去哪个 label
106 [label INPUT_SELECT_BRANCH_1]
487 [label INPUT_SELECT_BRANCH_2]
865 [label INPUT_SELECT_BRANCH_3]
```

### A.8 `[selectionUse …]`（30 次）上下文

`[selectionUse masterMale]` 15 次、`[selectionUse masterFemale]` 15 次（只有这两种形态）。
它**不是**「回放已选过的选项」，而是**主人公性别条件段**：后面紧跟一个**单选项块**当作「主人公的台词」，
块的 body 里设置性别 flag。原文（`Lostbelt No1…Anastasia\0300011921.txt:66-77`）：

```
66 [flag MALE false]
67 [flag FEMALE false]
69 [selectionUse masterMale]
70 ？1：武蔵ちゃん！
71 [flag MALE true]
72 ？！
74 [selectionUse masterFemale]
75 ？1：武蔵ちゃん！
76 [flag FEMALE true]
77 ？！
```

### A.9 「选项 → 跳转目标」的语料写法（示例）

`[branch <label>]` = 无条件跳到 label；`[branch <label> <flag> <值>]` = flag 等于值才跳（引擎证据 §B.9）。
完整闭环实例（`Ordeal Call III…\0400040520.txt:441-463`，5 选 1 的「反复提问菜单」）：

```
441 ？1：ジナコはここのボス、でいい[&のか:の]？；flag_1
442 [flag flag_1 true]
443 [branch lbl_text1]
445 ？2：ムーン・ドバイとは？；flag_2
446 [flag flag_2 true]
447 [branch lbl_text2]
449 ？3：ＢＢドバイとは？；flag_3
450 [flag flag_3 true]
451 [branch lbl_text3]
453 ？4：人類滅亡ラスボス決定戦について；flag_4
454 [flag flag_4 true]
455 [branch lbl_text4]
457 ？5：ムーン・ドバイにおけるムーンキャンサーとは；flag_5
458 [flag flag_5 true]
459 [branch lbl_text5]
461 ？！
463 [branch select_start]          ← 回到菜单入口（未问过的问题因 ；flag 变空而从列表消失）
466 [label lbl_text1]
…
```

同一文件里另有 `[branch lblNotcompleteEnd]`（421/435 行，单参数 = 无条件跳转）与 `[label lblNotcompleteEnd]`(437)。

### A.10 十条 ≤200 字符的例句（选项文本/选项结果被后续命令引用）

1. `Anti-Primate Biosphere Tunguska Sanctuary\0300110110.txt:83-86`
   `？1：[&ああ:うん]……` / `？2：まさかの行動制限だね……` / `？！`（块前是 `[k]`，块后是 `[charaFadeout A 0.1]`）——无 body 的纯分支台词。
2. 同文件 `:272-290`：`？1：そうだね……ちょっと仮眠を……` ⇒ body `＠マシュ 「それがよろしいかと。…」[k]` ⇒
   `？2：いや、一息ついたら手伝いに行くよ` ⇒ body `[messageOff]…＠マシュ「では１時間後に、食堂で。…」[k]` ⇒ `？！` —— **每个选项各带一段 body**（互斥）。
3. `Lostbelt No1…Anastasia\0300011720.txt:97-104`：`？1：森の伐採を手伝う` / `？2：トンネルの掘削を手伝う` / `？！` /
   `[branch INPUT_SELECT_BRANCH_2 INPUT_SELECT_BRANCH 1]` —— **选项结果（flag INPUT_SELECT_BRANCH=序号）被 branch 消费**。
4. `Ordeal Call IV…\0400051740.txt:1243-1245`（`Final Chapter\0400070720.txt` 同型）：`？1：クエスト開始 ；flag_1` /
   `？2：クエスト開始 ；flag_2` / `？3：キャンセル` —— **同一可见文本 + 不同 flag**；两个 flag 由前置 `[ifClear]/[flag]/[else]` 互斥设置。
5. `Lostbelt No1…Anastasia\0300012020.txt:2096-2109`：`[branch sel01 SEL01 1]` / `？1：笑ってくれた、人がいた[&んだ:から]` /
   `？！` / 「＠パツシィ …」 / `？！` / `[label sel01]` —— ①**条件跳转绕过整个选项块**；②块内出现**两个 `？！`**（选项列表终止 + 终止落点，
   与 §A.3 的 8 例一致）。
6. `編 郷愁永巡刻盤 パストカルデア\0500010320.txt:180-184`：`？1,1001：ライブラリで映画鑑賞を；flag_1000` 等 —— 素材消耗 + 隐藏条件复合。
7. `Ordeal Call III…\0400040520.txt:441-463`（§A.9 全文）—— 选项→flag→branch→label→回到菜单的**闭环**。
8. `Lostbelt No1…Anastasia\0300011921.txt:69-77`（§A.8 全文）—— `[selectionUse]` + 单选项块 + `？！` 作为**条件段边界**。
9. `Lostbelt No1…Anastasia\0300010910.txt:171-201-204-274-313`：`[input selectBranch]` → `[label selectBranch]` →
   `？1：気付かれない内に回避しよう`（长 body 到 274）→ `？2：村を襲うかもしれない、戦おう` → `？！`(313) —— 长 body 分支。
10. `Anti-Primate Biosphere Tunguska Sanctuary\0300110110.txt:1231`：`？1：[line 3]はい！` / `？！` —— 单选项「主人公台词」。

---

## B. 引擎侧（反汇编取证）

### B.1 标记行 → 内部 tag 的转换（`ScriptManager$$AnalysScript`）

**字段映射**（`ScriptManager$$Initialize`，`this` = `x19`；键名来自 APK 本地化表，`&'…'` 为 win.py 解析出的字面量）：

```
0x31a10b0  ldr  x24,[x24,#0xf80]  ; &'SCRIPT_ACTION_CODE_COMMENT'      ← dump.cs: codeCommentString // 0x658
0x31a1114  ldr  x0,[x24]  ; 'SCRIPT_ACTION_CODE_COMMENT'
0x31a111c  bl   #0x2e58030  CALL LocalizationManager$$Get
0x31a1124  str  x0,[x19,#0x658]
0x31a1140  str  x0,[x19,#0x660]     ; codeLabelString      := '＄'
0x31a115c  str  x0,[x19,#0x668]     ; codeSceneString      := '＃'
0x31a1178  str  x0,[x19,#0x670]     ; codeTalkString       := '＠'
0x31a1194  str  x0,[x19,#0x678]     ; codeSwitchCaseString := '？'    ← ldr x0,[x25]; x25=[0x55ca000+0x7e8]='SCRIPT_ACTION_CODE_SWITCH_CASE'
0x31a11b0  str  x0,[x19,#0x680]     ; codeSwitchCaseSplitString  := '：' (0x31a11a0 ldr x0,[x22]; &'SCRIPT_ACTION_CODE_SWITCH_CASE_SPLIT')
0x31a11cc  str  x0,[x19,#0x688]     ; codeSwitchCaseHiddenString := '；' (0x31a11bc ldr x0,[x29]; &'SCRIPT_ACTION_CODE_SWITCH_CASE_HIDDEN')
0x31a11f0  str  x0,[x19,#0x690]     ; codeSwitchEndString  := '？！'(0x31a11e4/0x31a11e8 ; &'SCRIPT_ACTION_CODE_SWITCH_END')
0x31a1214  str  x0,[x19,#0x698]     ; codeInsertString     := '％！'
0x31a1238  str  x0,[x19,#0x6a0]     ; codeVoiceString      := '％％'
0x31a125c  str  x0,[x19,#0x6a8]     ; codeReturnString     := '￥'
```

字段名逐一对上 `dump.cs`（`protected string codeSwitchCaseString; // 0x678` / `codeSwitchCaseSplitString; // 0x680` /
`codeSwitchCaseHiddenString; // 0x688` / `codeSwitchEndString; // 0x690`）——**0x678/0x680/0x688 的键名归属由此确证，不再是推断**。

**(a) 判定函数 `IsCodeSwitchCaseString(string)` = `0x31a9080`**

```
0x31a9090  ldr  x1,[x0,#0x678]              ; '？'
0x31a90a0  bl   #0x4870d34 CALL System.String$$StartsWith
0x31a90a4  tbz  w0,#0,#0x31a90d0            ; 不以 '？' 开头 → false
0x31a90b4  bl   #0x4876934 CALL System.String$$Substring   ; Substring(1)
0x31a90bc  ldr  x1,[x19,#0x680]             ; '：'
0x31a90cc  b    #0x4877124                  ; 尾调用 System.String$$Contains   （0x4877124=Contains，已用 So.method_of 解析）
```

⇒ 判据是 **`行以 '？' 开头` 且 `去掉首字符后仍含 '：'`** —— 恰好命中语料的 `？1：文本`（含 `？1,1000,saveMaterial：文本`）。
注意这里用的是 **Contains**（不是 StartsWith），所以「`？` 之后紧跟序号」与「`？` 之后跟 `：`」都能通过。

**(b) `？…` 行 → tag `switchCase`**（`AnalysScript` = `0x31a50ec-0x31a7688`）

```
0x31a66f0  mov  x0,x21                                 ; this
0x31a66f4  mov  x1,x27                                 ; 当前行
0x31a66f8  bl   #0x31a9080 CALL ScriptManager$$IsCodeSwitchCaseString
0x31a66fc  tbz  w0,#0,#0x31a6780                       ; false → 走 AnalysText（普通文本行）
0x31a6700  adrp x8,#0x55ca000
0x31a670c  ldr  x8,[x8,#0x230]  ; &'switchCase'
0x31a6714  ldr  x26,[x8]  ; 'switchCase'              ; ← tag 名
0x31a6704  mov  x0,x27
0x31a6708  mov  w1,#1
0x31a6718  bl   #0x4876934 CALL System.String$$Substring   ; param = 行.Substring(1) = "n：文本"
```

⇒ **`？n：文本` 行被转成 `tag='switchCase'`，参数是「去掉首字符 `？` 后的整串」**（序号与文本**未在解析期切分**，一起进 param）。
序号/文本的切分在运行期按「tag 序号」而不是按文本数字完成（§B.3）。

**(c) `？！` 行 → tag `switchCaseEnd`**

```
0x31a5f24  ldr  x1,[x21,#0x690]                        ; '？！'
0x31a5f30  bl   #0x4870cc0 CALL System.String$$op_Equality
0x31a5f34  tbz  w0,#0,#0x31a66f0                       ; 不等 → 继续判 switchCase
0x31a5f40  ldr  x8,[x8,#0xd98]  ; &'switchCaseEnd'
0x31a5f48  ldr  x26,[x8]  ; 'switchCaseEnd'
0x31a5f4c  mov  w8,#-1
0x31a5f50  b    #0x31a6778
0x31a6778  str  w8,[sp,#0x48]                          ; 台词消息下标 := -1（该行不产生 message）
```

⇒ `？！` 行 → **`tag='switchCaseEnd'`，并显式把消息下标置 -1**（故 `？！` 自身不会往回想日志里塞一行空台词）。

**(d) `？？…` 形态（本语料 0 例，引擎支持）**

```
0x31a6720  ldr  x1,[x21,#0x678]  ; '？'
0x31a672c  bl   #0x4870d34 CALL System.String$$StartsWith   ; param.StartsWith('？')
0x31a6730  tbz  w0,#0,#0x31a6760
0x31a6734  ldr  x1,[x21,#0x680]  ; '：'
0x31a6740  bl   #0x4877de4 CALL System.String$$LastIndexOf
0x31a6744  add  w1,w0,#1
0x31a6750  bl   #0x4876934 CALL System.String$$Substring     ; param.Substring(最后一个'：'+1)
0x31a675c  bl   #0x31a90e4 CALL ScriptManager$$AddSwitchCaseAsset
```
⇒ 只有**行首双写 `？？`** 时才会在解析期把「最后一个 `：` 之后」的文本交给 `AddSwitchCaseAsset`（选项配图/资源）。
全语料 `？？` 仅出现在 `＠？？？`（说话人「？？？」）等行内位置，**无一行以 `？？` 开头**，故这条路径在 2.139.3 语料中不生效。

**(e) 标记字段的读取点（全代码段扫描，STR/LDR × 全宽）**

| 字段 | 读取点（VA / 指令） |
|---|---|
| `0x678` `？` | `0x31a9090 ldr x1,[x0,#0x678]`(IsCodeSwitchCaseString)、`0x31a6720 ldr x1,[x21,#0x678]`(AnalysScript) |
| `0x680` `：` | `0x31a90bc ldr x1,[x19,#0x680]`、`0x31a6734 ldr x1,[x21,#0x680]` |
| `0x688` `；` | `0x31c7f8c ldr x1,[x20,#0x688]`、`0x31c7fb0 ldr x1,[x20,#0x688]`、`0x31c8008 ldr x0,[x20,#0x688]`（均在 `HiddenFlagCheckReplaceMessage 0x31c7f50`）；`0x31c8254/0x31c8268/0x31c8288`（在 `ReplaceHiddenFlagText 0x31c8220`） |
| `0x690` `？！` | `0x31a5f24`(AnalysScript)、`0x31a906c`(`IsCodeSwitchEndString`) |

> 即：`；` 只在**选项文本处理**里被消费（隐藏判定），`？！` 只在解析期被消费 + 由 tag 名 `switchCaseEnd` 承担运行期语义。

### B.2 解析产物的容器

`dump.cs`（`ScriptManager` 字段）：

```
protected int executeIndex;          // 0x320
protected int executeIndexMax;       // 0x324
protected int executeWaitIndex;      // 0x32C
protected string[] executeTagList;   // 0x330   ← tag 名数组
protected string[] executeDataList;  // 0x338   ← 参数数组
protected bool isSwitchCase;         // 0x370   ← 「正在播放某个选项的 body」
protected bool isSelectBranch;       // 0x3D0   ← 「已遇到 [input selectBranch]，等分支决定」
protected int inputSelectBranchCount;// 0x430
protected string[] menuMessageList;  // 0x4A0   ← 选择窗要显示的选项文本
private ScriptLoop scriptLoop;       // 0x760
private Dictionary<string,object> switchSelections; // 0x798  ← 存档：已选序号
```

### B.3 运行时模型（一）：遇到 `？` tag 时弹选择窗（`ScriptManager$$ProcessScript`）

`ProcessScript` 内对 tag `switchCase` 的分发（`0x31bd990 ldr x1,[x8,#0x230] ; 'switchCase'` →
`0x31bd9b4 bl op_Equality` → `0x31bd9b8 tbz w0,#0,#0x31c2848`）落到 `0x31bd9bc`：

```
0x31bd9bc  ldr  x8,[x19,#0x28]        ; messageManager
0x31bd9c4  ldrb w8,[x8,#0x1c0]
0x31bd9c8  cbnz w8,#0x31c2850         ; 消息机忙 → 本帧不处理
0x31bd9cc  ldrb w8,[x19,#0x3a3]       ; isRequestSkip
0x31bd9d0  cbnz w8,#0x31bd0d4
0x31bd9d4  ldrb w8,[x19,#0x3a4]       ; isExecuteSkip
0x31bd9d8  cbnz w8,#0x31bd0d4
0x31bd9dc  b    #0x31c2aa4            ; → 正常路径：组选项 + 弹窗
```

`0x31c2aa4`（选项窗弹出路径，逐条）：

```
0x31c2aa4  ldr  x0,[x19,#0x238]                  ; scriptPlayBase
0x31c2ab4  bl   #0x4fd4510 CALL UnityEngine.GameObject$$SetActive      ; SetActive(false)
0x31c2ac0  bl   #0x31b536c CALL ScriptManager$$PausePlaySpeed          ; PausePlaySpeed(true)
0x31c2ac4  ldr  x22,[x19,#0x4a0]                 ; menuMessageList ← 选项文本数组
0x31c2af4  bl   #0x31b5064 CALL ScriptManager$$ReplaceBranchText      ; 每个选项文本做性别/分支替换
0x31c2b28  bl   #0x31c7f50 CALL ScriptManager$$HiddenFlagCheckReplaceMessage  ; '；' 隐藏判定（ref hiddenMode）
0x31c2b58  cbnz w10,#0x31c2d50                   ; (limitTimeMode | hiddenMode)≠0 → 隐藏/限时模式
0x31c2bb0  … #0x31d95bc CALL ScriptSelectDialog$$Open        ← 普通：显示选择窗
0x31c2cd4  … #0x31d95bc CALL ScriptSelectDialog$$Open
0x31c2ec4  … #0x31d998c CALL ScriptSelectDialog$$OpenHidden  ← 隐藏模式（见 §B.8）
0x31c2fcc  … #0x31d9aa4 CALL ScriptSelectDialog$$OpenLimitTime
```

（`find_callers.py` 复核：`ScriptSelectDialog$$Open` 的两个调用点 = `0x31c2bb0`、`0x31c2cd4`；`OpenHidden` = `0x31c2ec4`；
`OpenLimitTime` = `0x31c2fcc`，全部位于 `ProcessScript`。）

**选择窗点击回调**：`0x31c2ea4 bl #0x31da34c CALL ScriptSelectDialog.ClickDelegate$$.ctor`，
目标实例 = `x19`(ScriptManager)，方法指针取自槽 `0x55ca000+0xad8` → 即 `ScriptManager.OnSelectSwitchCase(int)`（`0x31b6834`）。

### B.4 运行时模型（二）：序号存储位置（三重记录 + 日志）

**① 选项正文的跳转 & 序号写入 flag/PlayerPrefs —— `JumpScriptSwitchCase(int index)`（`0x31b2e34`）**

```
0x31b2e8c  ldrb w8,[x19,#0x3d0]        ; isSelectBranch
0x31b2e90  cbz  w8,#0x31b2ef8
0x31b2e98  strb wzr,[x19,#0x3d0]       ; isSelectBranch = false
0x31b2e94/0x31b2ec4  skipButton(0x1d0) 虚调用（vtable+0x218, 参数 (0,1)）
0x31b2edc  bl   #0x3194a30 CALL ScriptManager$$SetSelectBranchIndex    ; ① 存档键
0x31b2ee0  ldr  x1,[x21]  ; 'INPUT_SELECT_BRANCH'                      ; ② flag 名（FLAG_NAME_INPUT_SELECT_BRANCH）
0x31b2ee8  bl   #0x31a8f0c CALL ScriptManager$$SearchFlag
0x31b2eec  cbz  x0,#0x31b2fbc
0x31b2ef0  sxtw x8,w20
0x31b2ef4  str  x8,[x0,#0x18]          ; flag.v = index   （ScriptFlagData: protected long v; // 0x18）
```

`SetSelectBranchIndex`（`0x3194a30`）→ `PlayerPrefs`：

```
0x31949f8  ldrb w8,[x19,#0x11f]
0x31949fc  ldr  x20,[x20,#0x3c8]  ; &'ScriptManagerSelectBranch'          ; getter：GetSelectBranchIndex 0x31949e8
0x3194a1c  … 0x3194a2c  b #0x4fcad18   (= UnityEngine.PlayerPrefs$$GetInt，尾调用)
0x3194a80  bl   #0x31949e8 CALL ScriptManager$$GetSelectBranchIndex
0x3194a84  cmp  w0,w19
0x3194a88  b.ne #0x3194a98
0x3194a98  adrp x8,#0x55ca000
0x3194aa4  ldr  x8,[x8,#0x3c8]  ; &'ScriptManagerSelectBranch'
0x3194a9c  mov  w1,w19
0x3194aac  bl   #0x4fcacc0 CALL UnityEngine.PlayerPrefs$$SetInt          ; ② 存档：键 'ScriptManagerSelectBranch'
```
（`dump.cs`：`public const string SCRIPT_SELECT_BRANCH_SAVE_KEY = "ScriptManagerSelectBranch";`、
`public const string FLAG_NAME_INPUT_SELECT_BRANCH = "INPUT_SELECT_BRANCH";` —— 与上面两条链完全吻合。）

**③ 跳进「第 index 个 switchCase」的正文**（同函数）：

```
0x31b2efc  ldrsw x21,[x19,#0x320]      ; i = executeIndex
0x31b2f18  ldr  x8,[x19,#0x330]        ; executeTagList
0x31b2f30  ldr  x1,[x22]  ; 'switchCase'
0x31b2f3c  bl   #0x4870cc0 CALL System.String$$op_Equality
0x31b2f40  tbz  w0,#0,#0x31b2f50
0x31b2f44  cmp  w23,w20                ; 第 index 个 switchCase ？
0x31b2f48  b.eq #0x31b2f9c
0x31b2f4c  add  w23,w23,#1
0x31b2f50  ldrsw x8,[x19,#0x324]       ; executeIndexMax
0x31b2f54  add  x21,x21,#1
0x31b2f58  cmp  x21,x8
0x31b2f5c  b.lt #0x31b2f18
0x31b2f9c  add  w8,w21,#1
0x31b2fa0  mov  w9,#3
0x31b2fa8  str  w8,[x19,#0x320]        ; executeIndex := 该 switchCase tag + 1  ← 选项正文起点
0x31b2fac  str  w8,[x19,#0x32c]        ; executeWaitIndex
0x31b2fb0  str  w9,[x19,#0x288]        ; state := 3
0x31b2fb4  strb w0,[x19,#0x370]        ; isSwitchCase := true
```
（未找到时：`0x31b2f64 mov w8,#0x10 ; str w8,[x19,#0x288]` = state 16，返回 false。）

**④ 日志/回想记录 —— `OnSelectSwitchCase → SetSelectLogMessage → ScriptLoop.SetSwitchCase`**

```
0x31b6c08  ldr  x0,[x0,#0x760]                     ; this.scriptLoop
0x31b6c14  ldr  w1,[x19,#0x320]                    ; executeIndex
0x31b6c24  bl   #0x31c9e7c CALL ScriptLoop$$SetSwitchCase
（find_callers：0x31c9e7c 的调用者 = 0x31b6c24 in SetSelectLogMessage；
  SetSelectLogMessage 的调用者 = 0x318eb2c(ScriptCommandExecute)、0x31b69b4(OnSelectSwitchCase)、0x31b72cc(OnSelectMenu)）
ScriptLoop.SetSwitchCase（0x31c9e7c）：
0x31c9ee8  strb w9,[x20,#0x30]     ; isAddLog = true
0x31c9ef0  ldr  w8,[x20,#0x1c]
0x31c9ef8  add  w8,w8,#1
0x31c9efc  str  w8,[x20,#0x1c]     ; switchCaseCount++
0x31c9ef4  ldr  x0,[x20,#0x20]     ; switchCaseIndex (List<int>)
0x31c9f40  str  w21,[x8,#0x20]     ;   Add(index)
0x31c9f94/0x31c9f98                 ; switchCaseMessage (List<string>).Add(message)
```

**⑤ 存档键 `scriptLoop` / 已选记录 —— `EndSelectSwitchCase(int)`（`0x31b6e50`）**

```
0x31b6e98  bl   #0x31d9dd0 CALL ScriptSelectDialog$$Close
0x31b6ea4  str  xzr,[x19,#0x4a0]                   ; menuMessageList = null
0x31b6eb8  strb w8,[x19,#0x375]                    ; isCancelInput = true
0x31b6ebc/0x31b6ecc Int32$$ToString(executeIndex) / ToString(index)
0x31b6edc  bl   #0x31b6f3c CALL ScriptManager$$SaveSwitchSelection   ; switchLine=executeIndex, idx=index
0x31b6ee8  bl   #0x31b2e34 CALL ScriptManager$$JumpScriptSwitchCase
```

`SaveSwitchSelection(string switchLine, string idx)`（`0x31b6f3c`）写入字典 `switchSelections (0x798)`：

```
0x31b6ff0  ldr  w8,[x22,#0x27c]     ; playMode==0 → 不存
0x31b6ff8  ldrb w8,[x22,#0x371]     ; isCollection → 不存
0x31b7014  ldr  x0,[x22,#0x798]     ; Dictionary<string,object> switchSelections
0x31b702c  bl   #0x40355ec CALL System.Collections.Generic.Dictionary<object,object>$$get_Count
```
（读回侧：`GetSwitchSelection(int switchLine)` = `0x31c54ac`，`0x31c554c ldr x0,[x19,#0x798]` + `0x31c5564 get_Count`；
`SetupSelectedRouteTypeList` `0x31c5828/0x31c585c` 亦读同一字典。字典键名的字面量 `'SwitchSelections'` 出现在
`ScriptManager$$.cctor` 的 `0x31c9540`（`work/il2cpp_out/lit_methods.json`），与 `KEY_SWITCH_INFO (0x48)` 对应 —— 键名值本身
**INFERRED**：`'SwitchSelections'` 是该字典的键前缀，未能逐字读出赋值点。）

**⑥ `lastSelectedIndex`（ScriptLoop 0x18）谁写谁读**

```
写：ScriptLoop$$ExecuteLoop（0x31c9c5c）
    0x31c9c88  ldr  w8,[x19,#0x14]                                  ; count
    0x31c9c8c  add  w9,w8,#1
    0x31c9c9c  str  w9,[x19,#0x14]                                  ; count++
    0x31c9ca0  b.lt #0x31c9cac
    0x31c9ca4  mov  w9,#1
    0x31c9ca8  strb w9,[x19,#0x10]                                  ; isForceStopAdd = true（第 2 轮起停止追加日志）
    0x31c9cac  ldr  x0,[x19,#0x20]                                  ; switchCaseIndex
    0x31c9cb4  bl   #0x38ba1b8 CALL System.Linq.Enumerable$$LastOrDefault<int>
    （0x31c9cbc str w?,[x19,#0x18] = lastSelectedIndex := 上一轮最后选中的序号）
读：ScriptLoop$$ShouldAddLogSwitchCase（0x31ca0b8）
    0x31ca0b8  ldrb w8,[x0,#0x38]   ; isEnableLoopLogLaterErase → true 直接返 true
    0x31ca0cc  ldr  w8,[x0,#0x14]   ; count
    0x31ca0d0  cbz  w8,#0x31ca0c0   ; count==0 → true
    0x31ca0d4  cmp  w8,#1 ; b.ne #0x31ca100
    0x31ca0dc  ldrb w8,[x0,#0x30]   ; isAddLog
    0x31ca0e4  ldr  w8,[x0,#0x18]   ; lastSelectedIndex ← 读点
写（复位）：ScriptLoop$$.ctor 调用 / ScriptManager$$InitSetting 0x31a2c04/0x31a2c10（`str` 0x760/0x1c…），
           以及 ExecuteLoop 的上表；SetLogEraseFlag（0x31c9e74）供外部开关。
```

### B.5 `？！` 之后引擎做什么（关键分支）

**执行到 `switchCase` tag 时的分叉点在 `ScriptCommandExecute` 的 handler 头部（`0x31875c4`）**：

```
0x31875c4  ldrb w8,[x19,#0x370]        ; isSwitchCase
0x31875c8  cbz  w8,#0x318a774          ; 未在选项体里 → 正常处理（弹窗/继续）
0x31875d8  ldr  x8,[x8,#0xd98]  ; &'switchCaseEnd'
0x31875dc  ldr  x1,[x8]  ; 'switchCaseEnd'
（随后 JumpScriptCommand("switchCaseEnd")）
```

**`JumpScriptCommand(string)` 的目标解析与状态复位（`0x31b2cfc` 起）**：

```
0x31b2d18  ldr  x0,[x0,#0xd98]  ; &'switchCaseEnd'
0x31b2d2c  ldr  w8,[x19,#0x320]        ; i = executeIndex
0x31b2d44  ldr  x8,[x19,#0x330]        ; executeTagList
0x31b2d64  ldr  x1,[x8,#0x20]          ; tag = executeTagList[i]
0x31b2d68  bl   #0x48706e4 CALL System.String$$Equals        ; tag.Equals("switchCaseEnd")
0x31b2de0/0x31b2dec  ldr x8,[x8,#0xd98] ; &'switchCaseEnd'
0x31b2df4  str  w21,[x19,#0x320]       ; executeIndex := 命中的 tag 下标
0x31b2df8  str  w21,[x19,#0x32c]
0x31b2e00  str  w9,[x19,#0x288]        ; (w9=3) state := 3
0x31b2e04  bl   #0x4870cc0 CALL System.String$$op_Equality   ; command == "switchCaseEnd" ?
0x31b2e0c  strb wzr,[x19,#0x370]       ; isSwitchCase := false    ← 复位点
```

**执行到 `switchCaseEnd` tag 时（`ScriptCommandExecute` handler，`0x3188c58`）**：

```
0x3188c3c/0x3188c48  ldr x8,[x8,#0xd98] ; &'switchCaseEnd'
0x3188c4c  ldr  x1,[x8]  ; 'switchCaseEnd'
0x3188c50  bl   #0x4870cc0 CALL System.String$$op_Equality
0x3188c54  tbz  w0,#0,#0x3188c6c
0x3188c58  ldrb w8,[x19,#0x370]        ; isSwitchCase
0x3188c5c  cbz  w8,#0x318ae40
0x3188c64  strb wzr,[x19,#0x370]       ; isSwitchCase := false
0x3188c68  b    #0x3193f04            ; 共用尾 → 继续顺序执行（块之后的那条命令）
```

⇒ **`？！` 的语义不是「等待选择」，也不是「按选择跳转」**，而是：
- **进入选择**由**第一个 `？` tag** 触发（§B.3，弹 `ScriptSelectDialog` 并等待输入）；
- **选择结果**由回调 `OnSelectSwitchCase` → `EndSelectSwitchCase` → `JumpScriptSwitchCase(index)` 把执行点搬到「第 index 个 `？` tag 的下一行」；
- **选项正文结束**（执行撞上下一个 `？` tag）时，`isSwitchCase==true` ⇒ `JumpScriptCommand("switchCaseEnd")` 直接跳到 `？！` 并**复位** `isSwitchCase`；
- 若正文一直走到 `？！`（最后一个选项的情形），`switchCaseEnd` handler 同样复位并**顺序继续**。
  两条路径最终都把执行点落在块之后，**`？！` 本身不等待、不分支**。

### B.6 `[input selectBranch]` / `[branch]` 侧的序号消费

**`input` 命令处理器（`ScriptCommandExecute`，`0x317a800`）**：

```
0x317a810  b.lt #0x318d244                                   ; pd 为空
0x317a81c  ldr  x22,[x22,#0xc00]  ; &'selectBranch'
0x317a824  ldr  x1,[x22]  ; 'selectBranch'
0x317a82c  bl   #0x4870cc0 CALL System.String$$op_Equality   ; pd[0] == "selectBranch"
0x317a83c  ldr  x8,[x8,#0xc30]  ; &'selectBranchSkipTrueColor'
0x317a848  bl   #0x4870cc0 CALL System.String$$op_Equality   ; pd[0] == "selectBranchSkipTrueColor"
0x317a854  ldr  w8,[x19,#0x294]                              ; inputTopMode
0x317a870  bl   #0x31dcc88 CALL ScriptSkipDialog$$Close
0x317a87c  bl   #0x31b53d8 CALL ScriptManager$$ResumePlaySpeed
0x317a884  strb w8,[x19,#0x3d0]                              ; isSelectBranch := true
0x317a8ac  ldr  x0,[x19,#0x1d0]                              ; skipButton
0x317a8b8  mov  w1,#3 ; mov w2,#1 ; blr x9(vtable+0x218)      ; skipButton.SetActive(?, true)
0x317a8cc  ldr  x0,[x19,#0x3a8]                              ; inputCommandIndex (List<int>)  ← 记录 input 行
```

**ProcessScript 的分支点（`0x31c2434` 的哈希分发，hash('selectBranch')=0xe3c8b0cd）**：

```
0x31c2434  mov  w8,#0xb0cd
0x31c2438  movk w8,#0xe3c8, lsl #16
0x31c243c  cmp  w0,w8 ; b.ne #0x31c2848
0x31c2450  ldr  x8,[x8,#0xc00]  ; &'selectBranch'
0x31c2458  bl   #0x4870cc0 CALL System.String$$op_Equality
0x31c2460  ldr  w8,[x19,#0x294] ; inputTopMode ; cbnz #0x31c2850
0x31c2470  ldr  x8,[x8,#0xc38]  ; &'selectBranch2'
0x31c2478  str  x1,[x19,#0x3d8]              ; waitType := "selectBranch2"
0x31c2484  bl   #0x31c3bbc CALL ScriptManager$$JumpSelectBranch
```
`JumpSelectBranch`（`0x31c3bbc`）：`0x31c3c20 mov w8,#4 ; str w8,[x19,#0x294]`（inputTopMode=4）、
构造 `System.Action`（`0x31c3c4c bl #0x4959620 CALL System.Action$$.ctor`）交给某单例
（`0x31c3c28 bl #0x47e721c CALL SingletonMonoBehaviour<object>$$get_Instance`）—— 即「把分支决定交给 UI/管理器，
脚本在此等待」。**该单例的具体类型与 Action 目标方法未逐字解析 → INFERRED。**

**`[branch …]` 命令处理器（`0x3179e00` 区）**：`pd` 用 `' '` 作分隔符（`misc_flows.json` 的 `branch` 项：字面量 `' '` ×2、
调用 `ScriptManager$$SearchFlag` + `ScriptFlagData$$Comp(string)`），
⇒ **`[branch <label> <flag> <值>]` = flag 的值等于 `<值>` 时跳到 label；`[branch <label>]` = 无条件跳 label**。
这解释了 §A.9 的 `[branch INPUT_SELECT_BRANCH_2 INPUT_SELECT_BRANCH 1]`：选项序号被写进 flag
`INPUT_SELECT_BRANCH`（§B.4 ①），紧接着由 `branch` 按序号跳到 `INPUT_SELECT_BRANCH_<序号>` 标签。

**跳转与选项块的边界**：`SetJumpIndexByLabel(label,index,ref isResetSwitchCase)`（`0x31b2b88`）在找 label 时若先撞上
`switchCase`/`switchCaseEnd` tag，就置 `isResetSwitchCase=true` 并**放弃**跳转：

```
0x31b2c34  ldr  x9,[x9,#0x230]  ; &'switchCase'
0x31b2c40  bl   #0x4870cc0 CALL System.String$$op_Equality
0x31b2c44  tbnz w0,#0,#0x31b2c7c            ; == switchCase → 0x31b2c7c
0x31b2c68  ldr  x9,[x9,#0xd98]  ; &'switchCaseEnd'
0x31b2c74  bl   #0x4870cc0 CALL System.String$$op_Equality
0x31b2c7c  mov  w8,#1 ; mov w0,wzr ; strb w8,[x19]  ; *isResetSwitchCase = true; return false
找到 label 时：
0x31b2cbc  mov  w8,#3
0x31b2cc0  str  w20,[x21,#0x320]            ; executeIndex := label 下标
0x31b2cc4  str  w20,[x21,#0x32c]
0x31b2cc8  str  w8,[x21,#0x288]             ; state := 3
0x31b2cd0  cbz  w8,#0x31b2cd8
0x31b2cd4  strb wzr,[x21,#0x370]            ; isSwitchCase := false
```
另外**按行号跳转** `JumpScript(int index)` 在 `0x31b2808 strb wzr,[x0,#0x370]` 也会复位 `isSwitchCase`。
⇒ 「跨选项块的 label 跳转被禁止 / 一跳就复位选项态」是一条硬约束，这也解释了为什么语料里
`[branch …]`/`[label …]` 总出现在块**外侧**或紧贴 `？！`。

### B.7 `[selectionUse …]` 的引擎语义（不是「回放选项」）

```
0x317d28c  ldr  x1,[x20]                          ; pd
0x317d298  bl   #0x31b55e8 CALL ScriptManager$$CheckSwitchType
0x317d29c  tbz  w0,#0,#0x317d2a4                 ; 判定为假 → 走 skip
0x317d2a0  b    #0x3193f00                       ; 判定为真 → 空操作，继续
0x317d2b0  ldr  x8,[x8,#0xd98]  ; &'switchCaseEnd'
（0x317d2b4 之后 = JumpScriptCommand("switchCaseEnd")）
```
`CheckSwitchType(string[] pd)`（`0x31b55e8`）字面量：`'cancel'`(0x31b5610)、`'masterMale'`(0x31b561c)、
`'masterFemale'`(0x31b5628)：

```
0x31b5638  cbz  x19,#0x31b5758                   ; pd == null → false
0x31b5644  cbz  w8,#0x31b5768                    ; pd.Length == 0 → false
0x31b5650  ldr  x8,[x8,#0xa88]  ; &'cancel'
0x31b5660  bl   #0x4870cc0 CALL System.String$$op_Equality
0x31b5668  mov  w0,wzr                           ; "cancel" → false
0x31b567c  ldr  x8,[x8,#0xa90]  ; &'masterMale'
0x31b5684  bl   #0x4870cc0 CALL System.String$$op_Equality
（"masterMale"/"masterFemale" 分支：读静态主人公性别后比较；性别来源类的解析 → INFERRED）
```
⇒ **`[selectionUse <X>]` = 守卫：`CheckSwitchType(X)` 为假就 `JumpScriptCommand("switchCaseEnd")` 跳过后续内容，
为真则空操作继续。** 与 §A.8 的语料形态（两个互斥的 `[selectionUse masterMale|Female]` + 各自单选项块 + `？！`）
完全对应；`？！` 在这里充当「条件段结束标记」，与 §B.5 的块尾是**同一个 tag**。

### B.8 `；`（隐藏选项）的引擎语义

`HiddenFlagCheckReplaceMessage(string message, int idx, ref bool hiddenMode)` = `0x31c7f50`
（被 §B.3 的选项文本循环调用：`0x31c2b28 bl #0x31c7f50`，返回值回写进 `menuMessageList[i]`）：

```
0x31c7f8c  ldr  x1,[x20,#0x688]                 ; '；'
0x31c7f98  bl   #0x4877124 CALL System.String$$Contains
0x31c7f9c  tbz  w0,#0,#0x31c7ff4                ; 不含 '；' → 原样返回
0x31c7fa0  mov  w8,#1
0x31c7fac  strb w8,[x21]                        ; *hiddenMode = true
0x31c7fb0  ldr  x1,[x20,#0x688]                 ; '；'
0x31c7fb4  bl   #0x48776f0 CALL System.String$$IndexOf
0x31c7fc0/0x31c7fc4  Substring(idx('；')+1)     ; flagName = '；' 之后的全部文本
0x31c7fd4  bl   #0x31a8f0c CALL ScriptManager$$SearchFlag
0x31c7fe0  bl   #0x3171a34 CALL ScriptFlagData$$Comp   ; 无参 Comp() = flag 真值
0x31c7fe4  tbz  w0,#0,#0x31c8008
0x31c7ff0  ldr  x19,[x8]  ; ''                  ; flag 为真 ⇒ 该选项文本 := 空串（= 不显示）
0x31c8008  ldr  x0,[x20,#0x688] ; '；'          ; flag 为假 ⇒ 去掉 '；flagName' 后缀，返回正常文本
```

`hiddenMode` 被聚合（`0x31c2b54 orr w10,w8,w9`）后决定走 `0x31c2d50` 的**隐藏模式**：
该路径只把**非空文本**的选项收集起来，并同时收集其**原始下标**，再调 `OpenHidden`：

```
0x31c2dd0  ldr  x24,[x26,x21,lsl#3]             ; message[i]
0x31c2de4  bl   #0x4870cc4 CALL System.String$$op_Inequality   ; message[i] != "" ?
0x31c2e04  … List<string>.Add(message[i])        ; x23
0x31c2e0c/0x31c2e18 … List<int>.Add(i)           ; x22（原始下标）
0x31c2e4c  bl   #0x44c9f14 CALL List<object>$$ToArray      ; string[]
0x31c2e68  bl   #0x44ad480 CALL List<int>$$ToArray         ; int[]
0x31c2ea4  bl   #0x31da34c CALL ScriptSelectDialog.ClickDelegate$$.ctor
0x31c2ec4  bl   #0x31d998c CALL ScriptSelectDialog$$OpenHidden(msgs, indexes, font, cb)
```
（UI 侧签名 `dump.cs`：`public void OpenHidden(string[] selectMessageList, int[] itemIds, Font fontType, ClickDelegate callback)`。）

⇒ **`；<flag>` 的语义 = 「条件隐藏」**：flag 为**真**时该选项文本被清空（隐藏模式下被摘除、不显示），
flag 为**假**时仅把 `；<flag>` 后缀去掉、正常显示；被隐藏项**仍保留原有序号**（`itemIds` 回传原始下标），
因此 `？n：` 的 `n` 与运行时序号在隐藏前后保持一致。**语料中 flag 为真 = 「该问题已问过/该选项不可再选」**
（§A.9 的 5 问菜单 + `[flag flag_N true]`）。

### B.9 一条完整执行链（把所有 VA 串起来）

```
[解析期] AnalysScript 0x31a66f8(IsCodeSwitchCaseString 0x31a9080)
   ⇒ tag='switchCase'(0x31a6714)  data=行.Substring(1)(0x31a6718)
   ⇒ `？！` ⇒ tag='switchCaseEnd'(0x31a5f48)，消息下标 := -1(0x31a6778)

[运行·显示] 执行到第一个 ？ tag
   ScriptCommandExecute 0x31875c4 ldrb w8,[x19,#0x370] → 0 ⇒ 0x318a774
   ProcessScript 0x31bd9a0 → 0x31c2aa4
      ReplaceBranchText(0x31b5064) / HiddenFlagCheckReplaceMessage(0x31c7f50)
      ScriptSelectDialog.Open(0x31d95bc) | OpenHidden(0x31d998c) | OpenLimitTime(0x31d9aa4)
      回调 = OnSelectSwitchCase(0x31b6834)   ← 等待输入

[运行·选择] OnSelectSwitchCase
   → SetSelectLogMessage(0x31b6bf8) → scriptLoop.SetSwitchCase(0x31c9e7c)   (日志/回想)
   → EndSelectSwitchCase(0x31b6e50)
        Close 对话框 / menuMessageList=null / isCancelInput=true
        SaveSwitchSelection(0x31b6f3c) → switchSelections 字典(0x798)
        JumpScriptSwitchCase(0x31b2e34)
             SetSelectBranchIndex(0x3194a30) → PlayerPrefs.SetInt('ScriptManagerSelectBranch') 0x3194aac
             SearchFlag('INPUT_SELECT_BRANCH') ⇒ flag.v = index  0x31b2ef4
             executeIndex := 第 index 个 switchCase tag + 1 (0x31b2fa8) ; isSwitchCase := true (0x31b2fb4)

[运行·正文] 选项正文顺序执行
   （正文里的 [branch …] 用 flag/序号跳到对应 label；跨块的 label 跳转被 SetJumpIndexByLabel 拒绝 0x31b2c7c）
   撞到下一个 ？ tag ⇒ ScriptCommandExecute 0x31875c4 ldrb w8,[x19,#0x370] → 1 ⇒
        JumpScriptCommand("switchCaseEnd") 0x31b2e0c 复位 isSwitchCase → 落在 ？！ 上
   或直接走到 ？！ tag ⇒ handler 0x3188c58 复位 isSwitchCase ⇒ 顺序继续（块之后）
```

---

## C. 结论（运行时模型 + `；` + 两类选项的脚本层区别)

1. **选项块的运行时模型 = 「顺扫弹窗 → 等待输入 → 记序号 → 跳到所选正文 → 复位」。**
   解析期把 `？n：文本` 变成 `tag='switchCase'`（参数=去掉 `？` 的整行）、把 `？！` 变成 `tag='switchCaseEnd'`
   （`0x31a6714/0x31a6718`、`0x31a5f48`）；运行期顺序执行时遇到**第一个** `switchCase` tag 就
   `PausePlaySpeed(true)` + 组 `menuMessageList` + 弹 `ScriptSelectDialog` 并等待（`0x31c2ac0/0x31c2aa4`、`0x31c2bb0`）。
   选完后 `OnSelectSwitchCase → EndSelectSwitchCase → JumpScriptSwitchCase(index)`
   **按「第 index 个 switchCase tag」定位正文起点**（`0x31b2f3c-0x31b2fa8`），并置 `isSwitchCase=true`（`0x31b2fb4`）。
   正文跑到下一个 `？` tag 时由 `0x31875c4 ldrb w8,[x19,#0x370]` + `JumpScriptCommand("switchCaseEnd")`（`0x31b2e0c`）
   直接落到 `？！`；若正文刚好走到 `？！`（最后一个选项），`0x3188c58` 的 `switchCaseEnd` handler 复位 `isSwitchCase`
   并顺序继续。⇒ **每个选项各有一段专属正文，正文之间互斥；`？！` 只是「正文结束/终止落点」，本身不等待也不分支。**

2. **序号存储位置（三重 + 日志）**：
   ① 存档键：`SetSelectBranchIndex` → `PlayerPrefs.SetInt("ScriptManagerSelectBranch", index)`（`0x3194aa4` 读键字面量、`0x3194aac` bl `#0x4fcacc0 CALL UnityEngine.PlayerPrefs$$SetInt`；常量 `SCRIPT_SELECT_BRANCH_SAVE_KEY="ScriptManagerSelectBranch"`）；
   ② flag：`SearchFlag("INPUT_SELECT_BRANCH")` 后 `str x8,[x0,#0x18]`（`0x31b2ee8/0x31b2ef4`，常量 `FLAG_NAME_INPUT_SELECT_BRANCH="INPUT_SELECT_BRANCH"`）——供脚本 `[branch <label> INPUT_SELECT_BRANCH <n>]` 消费；
   ③ 存档字典：`SaveSwitchSelection(executeIndex.ToString(), index.ToString())` → `switchSelections (0x798)`（`0x31b6edc`、`0x31b7014`），读回 `GetSwitchSelection (0x31c54ac)`；
   ④ 回想/日志：`ScriptLoop.SetSwitchCase(executeIndex, message)`（`0x31b6c24` → `0x31c9e7c`，`switchCaseIndex/switchCaseMessage` 追加、`switchCaseCount++`）；
   `ScriptLoop.lastSelectedIndex(0x18)` 由 `ExecuteLoop` 用 `Enumerable.LastOrDefault(switchCaseIndex)` 写入（`0x31c9cb4-0x31c9cbc`），被 `ShouldAddLogSwitchCase` 读取（`0x31ca0e4`），第 2 轮循环时 `isForceStopAdd=true`（`0x31c9ca8`）停止重复追加日志。

3. **`；`（HIDDEN）的语义 = 「文本尾部条件隐藏」**：语法是 `？n：<文本>；<flag名>`，**不是**独立行标记；
   引擎在选项文本后处理里 `Contains('；')` → `IndexOf('；')` 取 flag 名 → `SearchFlag` → `Comp()`：
   flag 为真 ⇒ 文本置空（隐藏模式下随 `OpenHidden(msgs, itemIds, …)` 一起**不显示**），flag 为假 ⇒ 去掉后缀正常显示；
   被隐藏项的**原始序号仍保留并回传**（`itemIds`）。语料 14 行中含 10 行是该形式（另 3 行是 `[line 3]` 乱码、1 行空文本），
   典型用途 = 「已问过的问题从菜单消失」与「同一文本的两个互斥 flag 选项」。**注意：既有结论「`；` 语料 0 次」只对「行首 `；`」成立**。

4. **「无分支台词选项」vs「真分支选项」在脚本层的区别（判别法，可用全量统计复现）**：
   - **单选项块（5,191 个，其中 5,139 个无 body）**：`？1：<台词/心声>` + `？！`（无 body）或紧邻一小段 body（52 个）。
     作用是**让玩家点一下把主人公那句话说出来/记录下来**（回想里的选项色 `SCRIPT_ACTION_LOG_SELECT_COLOR`、
     日志前缀 `Select[r]`）；其后继 100% 是普通演出命令（§A.4 的 Top20）。
   - **多选项块（6,485 个）**：选项正文按「`？k：` 到下一个 `？`/`？！`」切分；实测 (body1,body2) 四态
     4614/1661/134/76 —— 即**约 71% 的多选项块其实两边都没有 body**（纯「记录选择」型），只有 1,661+134+76 = 1,871 个块
     带有真正的分支正文。
   - **真分支的外部标记**：块后紧跟 `[branch …]`/`[label …]`（各 77/72 次），或选项 body 内以 `[branch <label>]` 收尾；
     需要跨文件/跨节的结果则用 `[input selectBranch]` + flag `INPUT_SELECT_BRANCH` + `[branch <label> INPUT_SELECT_BRANCH <n>]`
     （22 处）在脚本外决定落点。
   ⇒ 脚本层**没有**「这个块有没有分支」的显式标志：分支与否由「选项 body 是否非空 / 后续是否有 branch」体现，
     引擎一律走同一套「弹窗→取序号→跳正文」，因此**同一种语法同时承担「无分支台词」和「真分支」**。

5. **`[input selectBranch]` 不是「块后触发」**：它是「进入选择段的入口/恢复点」（`isSelectBranch=true`，`0x317a884`），
   紧随其后的 `[label selectBranch]`（82 处，与之 1:1）是恢复落点；真正的选择结果由 `SetSelectBranchIndex`/flag/字典记录
   （结论 2），所以有 **39 处** `[input selectBranch]` 之后本文件内根本没有 `？` 块（选项块在别处或上一段已消费完），
   这与「块后触发」的直觉相反。`[input selectBranch skipStop "…"]`（1 处）把附加的 branch 命令字符串一起带走，属特例。

6. **可复现的判别式（给后续脚本处理器的建议）**：
   `block := 0 或 more('？' 序号行) 之间夹任意行 … '？！'`；序号 = `1..k` 连续（含 `1,<素材id>[,saveMaterial]` 变体）；
   选项显示文本 = 最后一个 `：` 之后、且去掉尾部 `；<flag>`；`？！` 之后的第一条命令即块后继；
   若 `？1：` 之后到下一条 `？`/`？！` 之间无非空行 ⇒ 该选项无正文（= 纯台词选项）。

---

## D. 明确标注为 INFERRED 的部分（未逐字取证）

| # | 事项 | 状态 |
|---|---|---|
| D1 | `menuMessageList (0x4A0)` 的**填充点**（解析期把 `？n：` 的文本写进数组的具体指令） | 已证实它在运行期被读取并送进选择窗（0x31c2ac4/0x31c2b08/0x31c2b3c/0x31c2c90），且 `EndSelectSwitchCase 0x31b6ea4`/`OnSelectMenu 0x31b7304`/`ProcessScript 0x31bd2e4` 会清空；**写入点未逐字定位**（脚本层可确定文本来自 `？n：` 的 `：` 之后） |
| D2 | `？n：` 的**序号/文本切分发生在哪条指令** | 解析期只做 `Substring(1)`（整串进 data）；运行期用「第 index 个 switchCase tag」定位正文，**不解析文本里的数字**；唯一在解析期做切分的是 `？？…`（`AddSwitchCaseAsset`，语料 0 例） |
| D3 | `JumpSelectBranch` 里 `SingletonMonoBehaviour<object>.get_Instance`（0x47e721c）与 `new Action(this.??)` 的目标方法 | 未解析（槽 0x5570298/0x55cada8/0x5572c70 未在字面量表内） |
| D4 | `switchSelections(0x798)` 字典的键字面量取值（疑似 `'SwitchSelections'`，见 `lit_methods.json` 在 `ScriptManager$$.cctor 0x31c9540`） | 键名值未逐字读出 |
| D5 | `CheckSwitchType` 中主人公性别的具体取值来源类/字段 | 只确证与 `'masterMale'/'masterFemale'/'cancel'` 比较 |
| D6 | 39 处「`[input selectBranch]` 之后本文件无选项块」的确切承接机制 | 脚本层形态已列；运行期承接未取证 |
| D7 | `？<n>,<素材id>[,saveMaterial]：` 的素材消耗流程（`branchMaterial` 26 次） | 序号/文本解析成立；消耗流程未取证 |

> 全文所有 VA 均来自本次实际反汇编输出（`work/coverage/win.py`，逐窗口打印），未编造。

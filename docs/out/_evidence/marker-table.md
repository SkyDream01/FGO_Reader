# 脚本控制符（Marker）实证表 —— 来源：APK 内置本地化表

> 本文是 `supplement-script-format.md` §E.1 未解决项的**收口证据**。
> 结论：剧本文本里的 `＠` `＄` `＃` `？` `？！` 等控制符**不是硬编码字符，而是本地化表键值**，
> 由 `ScriptManager$$Initialize` 在运行时读入 `ScriptManager` 实例字段，再由 `ScriptManager$$AnalysScript`
> 用 `String.StartsWith` + 字段比较识别并转换成内部 tag。因此在整个 `libil2cpp.so` 里**搜不到这些字符的
> 立即数/字面量比较**（此前已全量扫描证实），这是设计使然，不是解析缺失。

---

## 1. 本地化表在 APK 内可直接读取（推翻"本地化表不在 APK 内"的旧假设）

`work/extract/assets/bin/Data/data.unity3d`（21MB，APK 基础包内）含 TextAsset **`LocalizationJpn`**（349,803 字节，
JSON 文本，键值表）。用 UnityPy 1.25.4 读取：

```python
import UnityPy
env = UnityPy.load(r"work\extract\assets\bin\Data\data.unity3d")
for obj in env.objects:
    if obj.type.name == "TextAsset":
        d = obj.read()
        if d.m_Name == "LocalizationJpn":
            s = d.m_Script          # 349,803 字节 JSON
```

### 1.1 控制符定义（原样摘录，字符与码位均为实测）

| 本地化键 | 值 | 码位 | 语义 |
|---|---|---|---|
| `SCRIPT_ACTION_CODE_COMMENT` | `＊` | U+FF0A | 注释行 |
| `SCRIPT_ACTION_CODE_LABEL` | `＄` | U+FF04 | **跳转标签定义行** |
| `SCRIPT_ACTION_CODE_SCENE` | `＃` | U+FF03 | 场景切换行 |
| `SCRIPT_ACTION_CODE_TALK` | `＠` | U+FF20 | **说话人（名字）行** |
| `SCRIPT_ACTION_CODE_SWITCH_CASE` | `？` | U+FF1F | 选项行前缀 |
| `SCRIPT_ACTION_CODE_SWITCH_CASE_SPLIT` | `：` | U+FF1A | 选项序号/文本分隔 |
| `SCRIPT_ACTION_CODE_SWITCH_CASE_HIDDEN` | `；` | U+FF1B | 隐藏选项 |
| `SCRIPT_ACTION_CODE_SWITCH_END` | `？！` | U+FF1F U+FF01 | 选项块结束 |
| `SCRIPT_ACTION_CODE_INSERT` | `％！` | U+FF05 U+FF01 | 插入 |
| `SCRIPT_ACTION_CODE_VOICE` | `％％` | U+FF05 U+FF05 | 语音标记 |
| `SCRIPT_ACTION_CODE_RETURN` | `￥` | U+FFE5 | 返回 |
| `SCRIPT_ACTION_CODE_CLASS_SPLIT` | `：` | U+FF1A | 称号/名字分隔（`GetTalkName` 用） |

同表相关辅助项：

| 键 | 值 | 用途 |
|---|---|---|
| `SCRIPT_ACTION_NOT_SET_AUTO_WAIT_TARGET` | `(wt|k)` | **正则：`wt`/`k` 行不计入自动播放等待字数** |
| `SCRIPT_ACTION_NOT_SET_AUTO_WAIT_COMMAND` | `speed,s,tVoice,delay,tdelay` | 不计字数的命令表 |
| `SCRIPT_ACTION_SET_AUTO_WAIT_TARGET` | `[、。]` | 参与计数的标点 |
| `SCRIPT_ACTION_BACK_LOG_TALK_START/END` | `「` / `」` | 回想日志的台词包裹符 |
| `SCRIPT_ACTION_LOG_SELECT_COLOR` | `[FF4040]` | 回想日志里选项文本的颜色 |
| `SCRIPT_ACTION_LOG_SELECT_MESSAGE` | `Select[r]` | 回想日志选项前缀 |

> 备注：`SCRIPT_ACTION_NOT_SET_AUTO_WAIT_TARGET='(wt|k)'` 与语料完全吻合 —— `[k]`(184,799) / `[wt 1.0]`(114,251)
> 是语料里排名第 1、第 3 的行，且它们不参与"按字符数换算等待时间"。

## 2. 运行时装配：`ScriptManager$$Initialize`

```
0x31a10b0  ldr  x24, [x24, #0xf80]  ; &'SCRIPT_ACTION_CODE_COMMENT'
0x31a10b4  ldr  x23, [x23, #0x830]  ; &'SCRIPT_ACTION_CODE_LABEL'
0x31a10b8  ldr  x27, [x27, #0x820]  ; &'SCRIPT_ACTION_CODE_SCENE'
0x31a10bc  ldr  x26, [x26, #0x710]  ; &'SCRIPT_ACTION_CODE_TALK'
0x31a10c0  ldr  x25, [x25, #0x7e8]  ; &'SCRIPT_ACTION_CODE_SWITCH_CASE'
0x31a10c4  ldr  x22, [x22, #0x7f0]  ; &'SCRIPT_ACTION_CODE_SWITCH_CASE_SPLIT'
0x31a10c8  ldr  x29, [x29, #0x800]  ; &'SCRIPT_ACTION_CODE_SWITCH_CASE_HIDDEN'
...
0x31a1130  ldr  x0, [x23]                       ; x0 = 键 'SCRIPT_ACTION_CODE_LABEL'
0x31a1138  bl   #0x2e58030  CALL LocalizationManager$$Get
0x31a1140  str  x0, [x19, #0x660]               ; 字段 0x660 := '＄'
0x31a114c  ldr  x0, [x27]                       ; 'SCRIPT_ACTION_CODE_SCENE'
0x31a1154  bl   #0x2e58030  CALL LocalizationManager$$Get
0x31a115c  str  x0, [x19, #0x668]               ; 字段 0x668 := '＃'
0x31a1168  ldr  x0, [x26]                       ; 'SCRIPT_ACTION_CODE_TALK'
0x31a1170  bl   #0x2e58030  CALL LocalizationManager$$Get
0x31a1178  str  x0, [x19, #0x670]               ; 字段 0x670 := '＠'
```

（`x19` = `this`，`ScriptManager` 单例。）

## 3. 行级转换：`ScriptManager$$AnalysScript`

```
0x31a5c6c  ldr  x1, [x21, #0x660]                 ; x1 = 字段0x660 = '＄'
0x31a5c78  bl   #0x4870d34  CALL System.String$$StartsWith(line, x1)
0x31a5c84  ldr  x8, [x8, #0xd80]  ; &'label'      ; 命中 ⇒ 该行是 label 行
0x31a5c8c  ldr  x1, [x21, #0x668]                 ; x1 = 字段0x668 = '＃'
0x31a5c98  bl   #0x4870d34  CALL System.String$$StartsWith(line, x1)
0x31a5ca4  ldr  x8, [x8, #0xbb8]  ; &'scene'      ; 命中 ⇒ scene 行
0x31a5cac  ldr  x1, [x21, #0x670]                 ; x1 = 字段0x670 = '＠'
0x31a5cb8  bl   #0x4870d34  CALL System.String$$StartsWith(line, x1)
0x31a5cc4  ldr  x8, [x8, #0xfb8]  ; &'talkName'   ; 命中 ⇒ talkName 行
0x31a5cd8  Substring(1)                            ; 去掉标记字符，余下为参数
```

**这三条链把"标记字符 → 内部 tag"完全钉死**：

| 标记 | 字段 | 转换后 tag | 语料出现次数（33 章全量） |
|---|---|---|---|
| `＄` (LABEL) | 0x660 | `label` | 2,582（每文件恰好 1 行，值即文件名派生的入口标签，如 `0100000010.txt` → `＄01-00-00-00-1-0`） |
| `＃` (SCENE) | 0x668 | `scene` | 0（本语料未使用） |
| `＠` (TALK) | 0x670 | `talkName` | 184,792 |

> 即：`＄01-00-00-00-1-0` 就是**该脚本的入口跳转标签**（`label 01-00-00-00-1-0`），
> 剧情章节通过 `GetScriptData()` 得到资源名后跳到这个标签；而不是此前推测的"section id/章节头"。

## 4. 选项（分支选择）语法 —— 语料实测

引擎侧：`SCRIPT_ACTION_CODE_SWITCH_CASE='？'`、`_SPLIT='：'`、`_HIDDEN='；'`、`_END='？！'`，
配合 `ScriptLoop.switchCaseCount / switchCaseIndex / lastSelectedIndex / switchCaseMessage`
（dump.cs:4831）与 `SetSelectLogMessage`（选项文本进回想日志）。

语料侧全量统计：

| 形态 | 次数 | 例句 |
|---|---|---|
| `？<n>：<选项文本>` | 18,198 | `？1：[&ああ:うん]……` |
| `？！` | 11,684 | `？！` |
| `；` / `＃` / `＊` / `％！` / `％％` / `￥` | 0 | （本语料未使用） |

真实块示例（`Anti-Primate Biosphere Tunguska Sanctuary/0300110110.txt` 第 82 行起）：

```
[charaFadein A 0.1 1]
＠マシュ
…………先輩。[r]これはいったい、どういう事なのでしょう……
[k]

？1：[&ああ:うん]……
？2：まさかの行動制限だね……

？！

[charaFadeout A 0.1]
```

要点：
- `？<n>：` 的 `<n>` 是选项序号；`：` 之后到行尾是**显示文本**，可含全部消息内联标记（含 `[&男:女]` 性别分支）。
- 块以独占一行的 `？！` 结束。
- 选项是否产生分支由脚本其他机制决定（`selectBranch` / `ScriptLoop`），本例为"无分支的台词选项"。

---

## 复现命令

```bash
cd F:/Project/fgo
python - <<'PY'
import UnityPy,re
env=UnityPy.load(r"work\extract\assets\bin\Data\data.unity3d")
for obj in env.objects:
    if obj.type.name!="TextAsset": continue
    d=obj.read()
    if (getattr(d,'m_Name','') or '')!="LocalizationJpn": continue
    s=d.m_Script if isinstance(d.m_Script,str) else d.m_Script.decode('utf-8')
    for m in re.finditer(r'"(SCRIPT_[A-Z_]+)"\s*:\s*"([^"]*)"', s):
        print(m.group(1), repr(m.group(2)), [hex(ord(c)) for c in m.group(2)])
    break
PY
# 反汇编窗口（需 VA 落在代码段 0x2321aa4–0x5311320）
python work/coverage/win.py 0x31a10b0 8 8      # Initialize 键加载
python work/coverage/win.py 0x31a1130 8 10     # 字段 0x660/0x668/0x670 赋值
python work/coverage/win.py 0x31a5c6c 6 20     # StartsWith → label/scene/talkName
```

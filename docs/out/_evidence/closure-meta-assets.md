# 悬留项闭环:`AnalysScript` 行分隔符 / 多语言控制符表 / ADV 脚本资源名

对象:`Fate/Grand Order` Android 2.139.3(IL2CPP,Unity 6000.0.68f1,arm64,metadata v31)。
本文只新建本文件与同目录 `closure-meta-assets.findings.json`,不改动既有文档。所有结论给出 `libil2cpp.so` 的 VA + 指令原文、
或 `global-metadata.dat` / `data.unity3d` / 语料的文件偏移 + 字节。**无法证实的部分标 INFERRED**。

工具与数据(全部在仓库内可复现):

```bash
python work/coverage/win.py <VA> [前] [后]        # 带字面量注解的反汇编窗口
python work/scratch/range.py <VA起> <VA止>        # 区间反汇编(adrp/ldr 精确注解)
python work/tools/find_callers.py 0x...           # bl 调用者
work/il2cpp_out/{script.json,dump.cs,stringliteral.json,lit_methods.json}
work/extract/lib/arm64-v8a/libil2cpp.so
work/extract/assets/bin/Data/Managed/Metadata/global-metadata.dat
work/extract/assets/bin/Data/data.unity3d         # 全部 15 个 TextAsset 都在这里
```

字面量/元数据槽位链的通用解释(后文一律使用):
代码 `adrp x8,page; ldr x8,[x8,#off]` 取到的是 **使用槽**(`R_AARCH64_RELATIVE`, type 1027);槽的 relocation addend 指向
`script.json` 的 `ScriptMetadata` 表项,表项给出被引用对象的类型/字段名;字符串槽再 `ldr x1,[x8]` 得 `System.String`。

---

## 0. 摘要

| # | 结论 | 置信 |
|---|---|---|
| A | `ScriptManager.AnalysScript` 的 `Split` 分隔符数组 = `char[4]{ U+BBBF, U+FEFF, U+FFFE, U+000A }`(字节 `BF BB FF FE FE FF 0A 00`)。其中 `U+000A`(LF)是语料实际用到的分隔符;其余 3 个是数据里写死的“防御性”码位,语料中 0 次出现。 | 高(字节级+SHA-256 双证) |
| B | 控制符(＠/＄/＊/…)来自**本地化表** `LocalizationJpn`(TextAsset,pathID 98);`LocalizationManager.Get` 读静态字典 `lookup`,由 `SetTextData` 解析表文本填充;内置默认表 = `mainTextData`,data.unity3d 中 25 个 `LocalizationManager` 实例全部指向该 TextAsset;运行时还可用 `AssetManager.loadAssetStorage("Localization",…)` 覆盖。代码中不存在 “Jpn/Eng” 字面量,语言差异来自资源(分服/分地区)内容。 | 高(B 具体机制) |
| C | 章节(ADV)脚本名 = `String.Format("{0:D10}", WarEntity.targetId)`(mstWar 的 `targetId`,long @0x58),存于 AssetStorage `"ScriptActionEncrypt/" + 名字前2位`(Ordeal Call 为 `"94/"+ 前4位`),文件清单资源 = `"ScriptActionEncrypt/ScriptFileList"`,存在性校验 = 名字+`".txt"` 是否在清单里。`Q/E/W` 后缀是在 `PlayQuestStart` 模式下追加到脚本名上的**同一资源内的条目键**(`<name>Q<questId>` / `<name>E<eventId>` / `<name>W<warId>`)。 | 高 |

---

## A. `char[4]` 行分隔符(确定结果:4 个字符)

### A.1 代码链(`ScriptManager.AnalysScript`,方法 0x31A50EC)

方法签名(script.json):`void ScriptManager__AnalysScript (ScriptManager_o* __this, System_String_o* scriptData, System_String_o* orgScriptData, const MethodInfo* method)`

```
0x31a54c4  ldr   x8, [x8, #0x6f0]     ; 槽 0x55706f0 -> '\r'   (reloc addend 0x57fd590 -> stringliteral '\r')
0x31a54c8  ldr   x9, [x9, #0x458]     ; 槽 0x5570458 -> ''     (reloc addend 0x57fd2e8)
0x31a54dc  bl    #0x48748dc          CALL System.String$$Replace            (text,"\r","")
0x31a54e8  mov   w1, #4                                                    ; 新数组长度 4
0x31a54ec  ldr   x8, [x8, #0x340]     ; 槽 0x558a340 -> cell 0x5787400 = "char[]_TypeInfo"
0x31a54f0  ldr   x8, [x8]
0x31a54f4  mov   x0, x8
0x31a54f8  bl    #0x2230564          ; char[] 分配 (mov w1,w1; b #0x226adbc,il2cpp_codegen_array_new_specific)
0x31a5504  mov   x20, x0              ; x20 = char[4]
0x31a5508  ldr   x8, [x8, #0x348]     ; 槽 0x558a348 -> cell 0x57fbc10 = Field$<PrivateImplementationDetails>.307012A8...
0x31a550c  ldr   x1, [x8]             ; x1 = RuntimeFieldHandle
0x31a5510  bl    #0x491026c          CALL System.Runtime.CompilerServices.RuntimeHelpers$$InitializeArray
0x31a5528  bl    #0x4875368          CALL System.String$$Split              (text, char[4], 0)
```

- `InitializeArray` 签名(script.json):`void System_Runtime_CompilerServices_RuntimeHelpers__InitializeArray (System_Array_o* array, intptr_t fldHandle, const MethodInfo* method)` —— 第 2 参 = 字段句柄。
- 两个使用槽的 relocation(`.rela.dyn`, type 1027 `R_AARCH64_RELATIVE`):
  - `0x558a340 -> addend 0x5787400` → `ScriptMetadata[0x5787400]` = **`char[]_TypeInfo`**(确认是 `new char[… ]`)。
  - `0x558a348 -> addend 0x57fbc10` → `ScriptMetadata[0x57fbc10]` = **`Field$<PrivateImplementationDetails>.307012A837186614D001E192B1D70E6A03D8FC10730FB392A7536E08456B2EF3`**。

### A.2 运行时语义(纯 memcpy,无字节序转换)

`0x491026c` 是 thunk:`cbz x0; cbz x1; b #0x223be28`。实体 0x223be28 尾部:

```
0x223bea8  mul   w21, w21, w8      ; w21 = 元素大小(2) * 数组长度(4) = 8
0x223beac  bl    #0x228cff4        ; x0 = fieldDefaultValue 数据指针
0x223beb0  mov   x1, x0
0x223beb4  add   x0, x19, #0x20    ; 目标 = array->vector
0x223beb8  mov   x2, x21
0x223bec8  b     #0x53113c0        ; memcpy
```

即把元数据里的 8 字节**原样**拷进 `char[4]`,LE arm64 下 4 个 char 就是这 8 字节按 UTF-16LE 解释。

### A.3 静态数据路径:field → FieldDefaultValue → data(走通,并给出字节)

字段名 = Roslyn 的 SHA-256 内容寻址(`<PrivateImplementationDetails>` 的命名规则),可自证内容:

```python
import hashlib
name='307012A837186614D001E192B1D70E6A03D8FC10730FB392A7536E08456B2EF3'
data=bytes.fromhex('bfbbfffefeff0a00')
hashlib.sha256(data).hexdigest().upper()==name   # True
```

`dump.cs:474991` 同一字段:`internal static readonly long 307012A837186614D001E192B1D70E6A03D8FC10730FB392A7536E08456B2EF3 = 3096220432055231; // 0x950`
(`3096220432055231 = 0x0AFFFEFEFFBBBF` = 上述 8 字节的 LE u64,两条路径一致。)

### A.4 元数据路径:直接解析 `global-metadata.dat`(v31,独立复核)

- magic `0xFAB11BAF`(offset 0),version **31**(offset 4)。头 = 8 字节 + 31 组 `(int32 offset,int32 size)`,至 0x100。
- 表索引(按可整除性与首/末地址闭合验证):0 stringLiteral、1 stringLiteralData、2 string、3 events、4 properties、5 methods、
  6 parameterDefaultValues、7 **fieldDefaultValues**、8 **fieldAndParameterDefaultValueData**、9 fieldMarshaledSizes、10 parameters、
  11 **fields**、…、30 exportedTypeDefinitions。
- 实测:`fieldDefaultValues @0x9F0908`(size 0x4E330 = 26692×12),`fields @0xCFAC0C`(size 0x15F030 = 119812×12),
  `fieldAndParameterDefaultValueData @0xA3EC38`(size 0xFD094),`string @0xD9010`。

解析结果(逐项可复现):

| 项 | 值 |
|---|---|
| 字段名 = `307012A8…B2EF3` 的字段索引 | `fields[75761]`(nameIndex→`string+…`, typeIndex `0x69DC`, token `0x040127F2`) |
| `fieldDefaultValues` 命中 | `(fieldIndex=75761, typeIndex=0x69DC, dataIndex=0xBB40)` |
| 数据绝对偏移 | blob `0xA3EC38 + 0xBB40` = **`0xA4A778`** |
| 8 字节 | **`BF BB FF FE FE FF 0A 00`** |

注:`dataIndex` 是相对 blob 的偏移;`0xA4A778` 正好位于相邻字段数据(`0xA4A710`+96=0xA4A770、下一字段 `0xA4A788`)之间,
与 `dump.cs` 里 `/*Metadata offset 0xA4A1xx…*/` 的注释体系一致。

### A.5 结论(4 个分隔字符)

按内存/UTF-16LE 解释 `BF BB FF FE FE FF 0A 00`:

| # | 码位 | 字符 | 备注 |
|---|---|---|---|
| 1 | `U+BBBF` | `뮿` | 语料中 0 次 |
| 2 | `U+FEFF` | ZWNBSP/BOM 码位 | 语料中 0 次 |
| 3 | `U+FFFE` | 非字符(byte-swapped BOM) | 语料中 0 次 |
| 4 | `U+000A` | **LF** | **唯一实际生效的分隔符** |

**方法自证**:对其它 `InitializeArray` 调用点做同一条链,解码结果正常 —— 如
`CriAtomEx$$.cctor`(0x2349c0c)得 `int[3]{1,2,3}`;`EventItemWindowMaker$$.cctor`(0x2815730)得 `float[4]{156,114,72,30}`;
`localization` 侧另有同族数组(见 A.6)。因此本链的解码方式是可靠的,`BF BB FF FE FE FF 0A 00` 就是 FGO 2.139.3 里
`AnalysScript` 真实使用的分隔符初始值(原 C# 源码里对应 4 个 char 字面量;为何是这 4 个码位属开发者/混淆选择,
本环境无法回证其“意图”,但内容确定)。

### A.6 兄弟数组与行为证据

1) **同族 `char[5]`**(元数据里 SHA 匹配的 RVA 数组只有 476 个,其中含这 3 个特殊码位的仅 2 个):

| 字段 | 长度 | 字节 | 码位 |
|---|---|---|---|
| `307012A8…`(本文主角) | 8 | `bf bb ff fe fe ff 0a 00` | BBBF, FEFF, FFFE, **LF** |
| `01A2D4D2A3644EB58B9321AF665A1E3DD259AB36BB36C6953CE858B64416EF54` | 10 | `bf bb ff fe fe ff 0d 00 0a 00` | BBBF, FEFF, FFFE, **CR, LF** |

第二个数组用于 **`LocalizationManager.SetTextData`**(本地化表解析,VA 0x2E5C768):

```
0x2e5c8f8  mov   w1, #5                 ; new char[5]
0x2e5c904  bl    #0x2230564             ; char[] 分配
0x2e5c908  ldr   x1, [x20]              ; x20 = [0x55b31e8] -> cell 0x57fbad8 = Field$…01A2D4D2A364…(char[5])
0x2e5c914  bl    #0x491026c             CALL RuntimeHelpers$$InitializeArray
0x2e5c934  bl    #0x4875368             CALL System.String$$Split
```

两处用法一致:“特殊 3 码位 + CR/LF(LF)”作为文本行分隔符集合。这解释了为何这 3 个码位被写死:它们是 FGO 文本管线约定的
“不可能出现在正文里的换行占位符”,而实际语料只用 LF。

2) **语料行为证据**(`scripts\` 33 章 2583 个 `.txt`,逐文件扫描):

| 指标 | 数量 |
|---|---|
| 行尾 `\r\n` | 1,773,635 |
| 行尾 `\r\r\n` | 47,063 |
| 孤立 `\r` | **0** |
| `U+BBBF/U+FEFF/U+FFFE/U+2028/U+2029`(UTF-8 编码) | **0** |

即:语料实际是 `CRLF`/`CRCRLF` 混排(不是“LF-only”);`Replace("\r","")` 把 CR 全部删掉后,`Split` 只可能在 LF 上断行。
对读者而言,等价规则是“按 LF 断行、删除 CR、再按需要切分那 3 个占位码位(可省略)”。

3) **阅读器建议**:`lineSplit = ['\uBBBF','\uFEFF','\uFFFE','\n']`(保留空行语义,.NET `Split(char[],0)` 不丢弃空串),
先 `text.replace('\r','')`。若只处理本仓库语料,用 `\n` 即可。

---

## B. 多语言控制符来源

### B.1 `LocalizationManager.Get` / `Initialize` / `LoadAssetData`(取值路径)

类:`LocalizationManager : SingletonMonoBehaviour<LocalizationManager>`(dump.cs TypeDefIndex 2107),关键字段:

```
[SerializeField] protected TextAsset mainTextData;      // 0x20
protected static Dictionary<string,string> lookup;      // 0x18
protected static bool isBusySetAssetData;               // 0x30
```

- **`Get(string key)` @0x2E58030**:先做类初始化检查,然后 `bl #0x2e580dc CALL LocalizationManager$$ContainsKey`
  (含 `ldr x8,[x0,#0xb8]; ldr x0,[x8,#0x18]` → 静态字典 `lookup`),命中则返回字典值 —— **取值来源 = 静态字典,不是每次读文件**。
- **`Initialize()` @0x2E57AFC**:取 `SingletonMonoBehaviour<LocalizationManager>.Instance`;空则返回;
  然后 `0x2e57c00 ldr x0,[x19,#0x20]`(= `mainTextData`)→ `TextAsset$$get_text` → 尾调用
  `b #0x2e5c768 CALL LocalizationManager$$SetTextData`(**解析内置表 → 填充 `lookup`**)。
- **`SetTextData(this,string)` @0x2E5C768**:用 A.6 的 `char[5]` 分隔符 `Split` 表文本,逐行解析 `"KEY" : "VALUE",` 写入 `lookup`。
- **`LoadAssetData()` @0x2E57C24**(热更新覆盖):
  ```
  0x2e57ca0  ldr  x0, [x0, #0xfb0]      ; 槽 0x55b2fb0 = 'Localization'
  0x2e57d70  bl   #0x2da0564            CALL AssetLoader.LoadEndDataHandler$$.ctor   (闭包 = <>c__DisplayClass16_0)
  0x2e57db0  b    #0x2da59ac            CALL AssetManager$$loadAssetStorage
  ```
  `AssetManager.loadAssetStorage(string name, AssetLoader.LoadEndDataHandler cb, int maxParallelLoad, bool canCancel, …)`,
  实参 `name="Localization"`, `maxParallelLoad=1`, `canCancel=false`。
  回调 `LocalizationManager.<>c__DisplayClass16_0$$<LoadAssetData>b__0` @0x2E5CFC8:
  `AssetData.GetObject<TextAsset>`(0x2e5d018)→ `get_text`(0x2e5d024)→ `SetTextData`(0x2e5d03c)→ `isBusySetAssetData=false`(0x2e5d05c)。

结论:表有**两个来源** —— (1) 随包/随场景的 `mainTextData`(内置默认);(2) 通过 `AssetManager` 的 **AssetStorage “Localization”**
(可随服务器本地化内容更新/分服下发)覆盖解析进同一 `lookup`。

### B.2 控制符键与 `ScriptManager` 字段(键→字段映射,全部实证)

`ScriptManager.Initialize` @0x31A0DC0 依次 `LocalizationManager.Get(key)` 并写入实例字段(每条 = `ldr x0,[key槽]` →
`bl #0x2e58030` → `str x0,[x19,#off]`):

| 字段 | 键 | 取/存指令 VA |
|---|---|---|
| `codeCommentString` 0x658 | `SCRIPT_ACTION_CODE_COMMENT` | Get 0x31a111c / str 0x31a1124 |
| `codeLabelString` 0x660 | `SCRIPT_ACTION_CODE_LABEL` | 0x31a1138 / 0x31a1140 |
| `codeSceneString` 0x668 | `SCRIPT_ACTION_CODE_SCENE` | 0x31a1154 / 0x31a115c |
| `codeTalkString` 0x670 | `SCRIPT_ACTION_CODE_TALK` | 0x31a1170 / 0x31a1178 |
| `codeSwitchCaseString` 0x678 | `SCRIPT_ACTION_CODE_SWITCH_CASE` | 0x31a118c / 0x31a1194 |
| `codeSwitchCaseSplitString` 0x680 | `SCRIPT_ACTION_CODE_SWITCH_CASE_SPLIT` | 0x31a11a8 / 0x31a11b0 |
| `codeSwitchCaseHiddenString` 0x688 | `SCRIPT_ACTION_CODE_SWITCH_CASE_HIDDEN` | 0x31a11c4 / 0x31a11cc |
| `codeSwitchEndString` 0x690 | `SCRIPT_ACTION_CODE_SWITCH_END` | 0x31a11e8 / 0x31a11f0 |
| `codeInsertString` 0x698 | `SCRIPT_ACTION_CODE_INSERT` | 0x31a120c / 0x31a1214 |
| `codeVoiceString` 0x6A0 | `SCRIPT_ACTION_CODE_VOICE` | 0x31a1230 / 0x31a1238 |
| `codeReturnString` 0x6A8 | `SCRIPT_ACTION_CODE_RETURN` | 0x31a1254 / 0x31a125c |
| `backLogTalkStartString` 0x6B0 | `SCRIPT_ACTION_BACK_LOG_TALK_START` | 0x31a1278 / 0x31a1280 |
| (0x6B8/0x6C0/0x6C8/0x6D0/0x6D8/0x700/0x708/0x710) | `…BACK_LOG_TALK_END / LOG_SELECT_MESSAGE / LOG_SELECT_MESSAGE2 / LOG_SELECT_COLOR / LOG_SELECT_TIME_OVER_COLOR / SET_AUTO_WAIT_TARGET / NOT_SET_AUTO_WAIT_TARGET / NOT_SET_AUTO_WAIT_COMMAND` | 0x31a129c…0x31a13c0 |

字段名来自 `dump.cs` `class ScriptManager`(0x658 `codeCommentString` … 0x6A8 `codeReturnString` …)。
`CommonMessageManager$$Init` 也用同一批键(0x3165bc0/0x3165bcc/0x3165bd8/0x3165be4)。

### B.3 表文件与“JP 是内置默认”(APK 实证)

`data.unity3d`(21,723,820 B,内含 globalgamemanagers / level0..24 / sharedassets* / resources.assets 等完整数据)的
**全部 15 个 TextAsset**:

| pathID | 名称 | 长度 | 内容 |
|---|---|---|---|
| **98** | **LocalizationJpn** | m_Script 349,803 字符 / UTF-8 533,126 B | 游戏本地化表(JSON 风格 `"KEY" : "VALUE",` + `//` 注释) |
| 602 | Localization | 1,240 字符 / 1,253 B | **NGUI 插件的示例表**(`KEY,English,Français`;正文 “This example shows how to implement localization using NGUI”),与游戏控制符无关 |
| 596–606 | uSequencer - License / FGO-NumberFont-0x / TextAtlasx / damagefont / critfont / BillingMode / PerformanceTestRunSettings / PlayMakerAssemblies | 11–9,146 B | 无关 |

- 位置:`LocalizationJpn` 在 cab **sharedassets0.assets**(pathID 98);本地化小表 `Localization` 在 cab resources.assets(pathID 602)。
- **内置默认表 = LocalizationJpn**:扫描 `data.unity3d` 全部 68,048 个 MonoBehaviour,`m_Script.pathID == 0x11DC`(LocalizationManager)
  的共 **25 个实例**;逐实例读原始字节(布局:需 `m_Script` PPtr 位于 +12,+20 处取 pathID,`m_Name` 于 +28,其后紧跟
  `mainTextData` PPtr)得到 **全部 25 个实例的 `mainTextData` 都指向 pathID 98**(fileID=2 或 3;如 level0 实例的 cab
  externals=[globalgamemanagers.assets, sharedassets0.assets, Library/unity default resources],fileID 2 → sharedassets0.assets)。
  即:**每个场景里的 LocalizationManager 预制体都挂了 LocalizationJpn 作为内置表**。
- NGUI 的 `Localization` 脚本(MonoScript pathID 0x181A,Fgo.Ngui)在包内 **0 个实例** → 小表是插件残留,不被游戏使用。

### B.4 JP 表的控制符实际取值(节选,其余见 findings.json)

```
"SCRIPT_ACTION_CODE_COMMENT" : "＊"        (U+FF0A)
"SCRIPT_ACTION_CODE_LABEL"   : "＄"        (U+FF04)
"SCRIPT_ACTION_CODE_SCENE"   : "＃"        (U+FF03)
"SCRIPT_ACTION_CODE_TALK"    : "＠"        (U+FF20)
"SCRIPT_ACTION_CODE_SWITCH_CASE"         : "？"   (U+FF1F)
"SCRIPT_ACTION_CODE_SWITCH_CASE_SPLIT"   : "："   (U+FF1A)
"SCRIPT_ACTION_CODE_SWITCH_CASE_HIDDEN"  : "；"   (U+FF1B)
"SCRIPT_ACTION_CODE_SWITCH_END" : "？！"    "SCRIPT_ACTION_CODE_INSERT" : "％！"
"SCRIPT_ACTION_CODE_VOICE" : "％％"         "SCRIPT_ACTION_CODE_RETURN" : "￥" (U+FFE5)
"SCRIPT_ACTION_CODE_CLASS_SPLIT" : "："
"SCRIPT_ACTION_BACK_LOG_TALK_START" : "「"  "SCRIPT_ACTION_BACK_LOG_TALK_END" : "」"
"SCRIPT_ACTION_LOG_SELECT_MESSAGE" : "Select[r]"   "SCRIPT_ACTION_LOG_SELECT_MESSAGE2" : "  {0}"
"SCRIPT_ACTION_LOG_SELECT_COLOR" : "[FF4040]"      "SCRIPT_ACTION_LOG_SELECT_TIME_OVER_COLOR" : "[FFFF00]"
"SCRIPT_ACTION_SELECT_COLOR" : "[FFFFFF]"          "SCRIPT_ACTION_CHAPTER_SUB_TITLE_BASE" : "{0} - {1}"
```

表规模:6,237 行(LF),`"KEY" : "VALUE"` 形式键值 4,930 条(含 `//` 注释与空行)。

### B.5 结论与阅读器做法

- **控制符随语言变化,机制是“表驱动”**:所有 12 个脚本控制符都经 `LocalizationManager.Get(SCRIPT_ACTION_CODE_*)` 得到,
  以资源里的本地化表为唯一来源;JP 客户端 APK 内置的是 `LocalizationJpn`(并且全部场景实例都引用它)。
- 运行时还能用 AssetStorage `"Localization"` 覆盖(B.1);该 storage 的实际内容在服务器(是否含其他语言、
  命名是否 `Localization`+语言后缀,**INFERRED**:代码里没有任何 "Jpn"/"Eng"/语言码字面量,搜索 `lit_methods.json` 的
  `Jpn` 命中数为 0,所以语言差分只能来自分服/分地区的资源内容,而非代码拼接)。
- **APK 内本地化表清单**(穷举):`com.aniplex.fategrandorder.apk` 共 211 项,资产侧只有 `assets/bin/Data/data.unity3d`
  (含上表 2 个当地化相关 TextAsset)与 `global-metadata.dat`、`Managed/Resources/*.dll-resources.dat`(BCL 资源,非游戏表);
  `config.arm64_v8a.apk` 21 项;xapk 3 项 —— 无其他语言表。
- **阅读器正确做法**:把 ＠/＄/＊/… 当作**配置**从 `LocalizationJpn` 解析(键名固定、值随语言),不要硬编码;
  解析 `LocalizationJpn` 时按 A.6 的分隔符集合断行,并忽略 `//` 注释行。

---

## C. ADV 脚本资源命名

### C.1 名称模板 = `"{0:D10}"`(输入 = mstWar 的 `targetId`)

`ScriptManager$$PlayChapterStart` @0x319A044(签名:`void PlayChapterStart(int warId, CallbackFunc cb, bool isCollection=false, int jumpLine=-1)`):

```
0x319a1d0  ldr   x8, [x8, #0x8e0]        ; 主数据类 usage(DataMasterBase<object,object,int> 泛型实例)
0x319a1d4  ldr   w1, [x20, #0x18]        ; warId(闭包捕获)
0x319a1dc  bl    #0x3f48444              CALL DataMasterBase<object,object,int>$$GetEntity
0x319a1f4  ldr   x9, [x0, #0x58]         ; WarEntity.targetId (long, dump.cs: public long targetId; // 0x58)
0x319a1f8  ldr   x22, [x22, #0x5d0]      ; 槽 0x55ca5d0 = '{0:D10}'   (字面量初始化 @0x319a0f8/0x319a990)
0x319a21c  bl    #0x4868ad0              CALL System.String$$Format    -> "0100000010"
0x319a284  str   x22, [x0, #0xc0]!       ; ScriptManager.playScriptDataName = Concat('PlayChapter ', 名字)
0x319a2a4  mov   x0, x21                 ; x21 = Format 结果(10 位名)
0x319a2a8  bl    #0x3195ce4              CALL ScriptManager$$GetScriptAssetName
0x319a30c  bl    #0x3195da0              CALL ScriptManager$$PlayLocal   (x3=assetName("01"), x4=10位名, w2=7 …)
```

- 主数据类确认:`dump.cs:140924 public class WarMaster : DataMasterBase<WarMaster, WarEntity, int>`;`WarEntity.targetId` 即
  “章节(war)对应的脚本 id”,如 Fuyuki(targetId=100000010)→ `"0100000010"`。
- 标签行(`＄01-00-00-00-1-0`)与文件名的关系 = **10 位数字按 2-2-2-2-1-1 分组加 `-`**。此式在语料上实测:
  2583 个文件里 2508 个满足 `filename == 首行 ＄标签去掉 '-'`;74 个文件内部标签与文件名不同(多为事件/93xx 体系,
  如 `0100011120.txt` 内为 `＄93-00-01-15-1-0`;文件内标签始终唯一,只有 1 个文件没有 ＄ 行)。故**权威来源是文件内的 ＄ 标签**,
  文件名是同一个 id 的另一种写法。

### C.2 资源仓储名:`GetScriptAssetName` + `textPath`

`GetScriptAssetName(string label)` @0x3195CE4(输入 = 10 位名,不是带 `-` 的显示标签):

```
0x3195d1c  cbz  x19, → NRE
0x3195d30  bl   #0x48746b4   String$$Substring(0,2)          ; "01" / "94"
0x3195d4c  bl   #0x48706e4   String$$Equals("94")             (字面量 '94' 槽 0x55ca448)
   若 == "94":  0x3195d64 Substring(0,4) → 0x3195d88 Concat(前2位, "/", 前4位)   -> "94/9401"
   否则     :  返回前 2 位                                      -> "01"
```

`ScriptManager$$LoadExecuteScript` @0x31A40AC(this,name,label):

```
0x31a4128  str  x20, [x19, #0x2d0]     ; this.assetName   = name
0x31a4138  str  x21, [x19, #0x2d8]     ; this.scriptLabel = label
0x31a4160  bl   #0x48706e4             String$$Equals(name,"94") ; 是 "94" 则 name = GetScriptAssetName(label)
0x31a4198  bl   #0x4870cc0             String.op_Equality(assetData.m_Name, name)  ; 已装载且同名 → 直接执行
0x31a420c  ldr  x0, [x8, #0x30]        ; ScriptManager.textPath ("ScriptActionEncrypt/")
0x31a4210  bl   #0x4867ef8             String$$Concat(textPath, name)              ; "ScriptActionEncrypt/01"
0x31a425c  bl   #0x2da59ac             CALL AssetManager$$loadAssetStorage(name, cb, 1, false)
```

`textPath`/`textPathRaw` 在 `ScriptManager$$.cctor`(0x31C9484 起)赋值:

```
0x31c94cc  ldr  x28, [x28, #0xec0]     ; 槽 0x55caec0 = 'ScriptAction/'
0x31c94d0  ldr  x27, [x27, #0xec8]     ; 槽 0x55caec8 = 'ScriptActionEncrypt/'
0x31c961c  str  x1, [x0, #0x28]!       ; textPathRaw = "ScriptAction/"          (dump.cs ScriptManager // 0x28)
0x31c9630  str  x1, [x0, #0x30]!       ; textPath    = "ScriptActionEncrypt/"   (dump.cs ScriptManager // 0x30)
```

取文本:`GetExecuteScriptText` @0x31A3E88 —— `this.assetData`(+0x310)→ `GetKey(name)` @0x3199EAC
(内部 `ScriptEncryptSettings.GetKey` @0x31710A4,`scriptEncryptSettings` 字段 +0x300)→ `AssetData.GetDecryptObjectText(name,key)` @0x2D9E830。

### C.3 存在性校验:`IsExistScriptFile`(后缀 `.txt` 在**清单**里)

`ScriptManager$$IsExistScriptFile` @0x319BF3C(this, scriptName):

```
0x319bf78  ldr  x1, [x22]        ; 槽 0x5587568 = '.txt'            (字面量初始化 @0x319bf64)
0x319bf84  bl   #0x4867ef8       String$$Concat(scriptName, ".txt")
0x319bf88  ldr  x20, [x19, #0x2f8]   ; this.scriptFileList (string[])
0x319bfc8  bl   #0x48706e4       String$$Equals(scriptFileList[i], name+".txt")   ; 线性查找
```

清单来源 `ScriptManager$$Initialize` @0x31A0DC0:

```
0x31a17f8  ldr  x23, [x23, #0x7e0]   ; 槽 0x55ca7e0 = 'ScriptFileList'
0x31a1830  ldr  x0, [x8, #0x30]      ; textPath = "ScriptActionEncrypt/"
0x31a1834  bl   #0x4867ef8           String$$Concat -> "ScriptActionEncrypt/ScriptFileList"
0x31a1870+ …                         AssetManager.loadAssetStorage(这个名字, handler, …)
```

`EndLoadScriptFileListAssetData` @0x31A22E8(回调):

```
0x31a2360  bl  #0x2d9e830   AssetData$$GetDecryptObjectText(...)        ; 取清单文本
0x31a2384  bl  #0x48748dc   String$$Replace(text,"\r\n","\n")           ; 字面量槽 0x5582660/0x55706d8
0x31a23a4  mov w1, #0xa     ; '\n'
0x31a23b0  bl  #0x4874f2c   String$$Split(text,'\n')                    ; → this.scriptFileList (+0x2f8)
0x31a23cc  bl  #0x37ee378   Array$$Sort<object>                         ; 排序
0x31a23d8  bl  #0x3806f00   AssetData$$GetObject<ScriptEncryptSettings>() ; → this.scriptEncryptSettings (+0x300)
```

故清单 = “`<10位名>.txt`”逐行(与语料文件名格式一致;语料是对这份清单逐项的下载/解密结果),另带一个
`ScriptEncryptSettings`(解密键来源)。

### C.4 `Q`/`E`/`W` 后缀的归属

`ScriptManager$$GetScriptData` @0x31A3BA8(私有;`playScriptDataName` 由 Play* 入口写入,模式标记):

```
0x31a3c3c  String.op_Equality(playScriptDataName, 'PlayQuestStart')      ; 槽 0x55ca660(初始化 @0x31a3be0)
   —— 仅 ScriptManager$$PlayQuestStart @0x319B55C 会写入:
0x319b770  str x1('PlayQuestStart'), [x0, #0xc0]                        ; playScriptDataName = "PlayQuestStart"

   base = this.scriptLabel (+0x2d8;即 10 位脚本名)
0x31a3c88  Concat(base, questStartAction)                ; 静态 string questStartAction // 0x138
0x31a3cec  Concat(base, "Q", scriptQuestId.ToString())   ; 'Q' 槽 0x55ca08c0(@0x31a3bf0), 静态 int scriptQuestId // 0xD8
0x31a3d60  Concat(base, "Q", questId.ToString())         ; 兜底 questId // 0xD4
0x31a3de0  Concat(base, "E", eventId.ToString())         ; 'E' 槽 0x5571410(@0x31a3bfc), 静态 int eventId // 0xD0
0x31a3e48  Concat(base, "W", warId.ToString())           ; 'W' 槽 0x5571408(@0x31a3be4), 静态 int warId // 0xCC
0x31a3cfc  GetExecuteScriptText(名字)                    ; 依次探测,命中即返回;全不中则探测 base 本身
```

结论:`Q/E/W` 是**同一脚本资源内的附加条目键的后缀**,由 `PlayQuestStart`(从任务开始续播)模式在运行时拼接;
`Q`+任务 id、`E`+事件 id、`W`+章节 id 依次探测。带后缀的条目不在本仓库语料里(语料只有基名文件);
它们与基名一样从 `<war> 资源`的 AssetData 里按名字取(**同一 AssetData 内的附加对象,INFERRED**:
`GetExecuteScriptText` 只做“名字→AssetData.GetDecryptObjectText”,没有二次装载)。

### C.5 与语料对拍(验证模板)

- 模板 `Format("{0:D10}", WarEntity.targetId)` → 10 位数字文件名:语料 2583 个文件名全部为 `^\d{10}\.txt$`
  (前缀分布 01:708、02:249、03:1048、04:533、05:45,对应语料收录的 5 个章节;`04`/`05` 会出现 94 之外的两位前缀,
  与 `GetScriptAssetName` 的 `Substring(0,2)` 规则一致)。
- 标签:`0100000010.txt` 首行 `＄01-00-00-00-1-0` ⇒ `Format("{0:D10}", 100000010)` = `"0100000010"`,
  标签 = 同数字按 2-2-2-2-1-1 加 `-`。对拍通过(2508/2583 完全一致,余下 74 个是文件内标签体系不同/1 个无标签)。
- 战斗脚本另有 9/10 位模板(与 ADV 分开):`SCRIPT_NAME_BATTLE_START="{0:D8}{1:D1}0"` 等常量(dump.cs:167801–167811)+
  `GetScriptName_BattleStart` @0x319B8E4(`'{0:D8}{1:D1}0'` @0x319b90c)、`GetScriptName_BattleEnd` @0x319BD7C 等。

### C.6 阅读器规则(建议)

1. 由章节/任务数据(客户端主数据 `mstWar` 的 `targetId`;服务器下发的 `scriptId`/`scriptQuestId`)得到整数 N。
2. 脚本资源名 = `f"{N:010d}"`;存储路径 = `ScriptActionEncrypt/` + `f"{N:010d}"[0:2]`
   (若前两位为 `94`,则为 `ScriptActionEncrypt/94/{前4位}`);同目录清单 `ScriptActionEncrypt/ScriptFileList`
   列出全部 `<名字>.txt`(解密后按 `\n` 切分、排序)。
3. 文件取回后需解密(`AssetData.GetDecryptObjectText(name, ScriptEncryptSettings.GetKey(name))`;本仓库已有等价实现
   `work/tools/rijndael256.py` 与 `work/tools/fgo_script_parser.py`)。
4. 文件内部标签 = 同一 N 的 2-2-2-2-1-1 短横线写法(`＄` 由 `SCRIPT_ACTION_CODE_LABEL` 配置,不可硬编码 `＄`);
   续播附加条目 = `<名字>Q<questId>` / `<名字>E<eventId>` / `<名字>W<warId>`(依次探测,最后回退基名)。

---

## 复现命令(最小集)

```bash
# A:反汇编 + 槽/reloc/元数据链
python work/coverage/win.py 0x31a54c4 40 40
python work/coverage/win.py 0x31a5510 80 20
python work/scratch/range.py 0x2e5c8f0 0x2e5c940            # char[5] 兄弟数组
python -c "…"   # 见 A.3/A.4 的解析片段(fields/FDV/blob 三张表 + sha256)
# B:
python work/scratch/range.py 0x2e57c24 0x2e57dc0           # LoadAssetData → loadAssetStorage("Localization")
python -c "import UnityPy; …"                               # data.unity3d TextAsset 清单 / mainTextData PPtr
# C:
python work/scratch/range.py 0x319a1c8 0x319a240           # {0:D10} Format
python work/scratch/range.py 0x3195ce4 0x3195da0           # GetScriptAssetName(string)
python work/scratch/range.py 0x319bf3c 0x319c000           # IsExistScriptFile(.txt)
python work/scratch/range.py 0x31a3ba8 0x31a3e64           # GetScriptData(Q/E/W)
```

(完)

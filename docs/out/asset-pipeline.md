# FGO 资源流水线:脚本从哪来、怎么解密

对象:`com.aniplex.fategrandorder` 2.139.3。本文只写**已在二进制中打通并本地验证过**的链路,
带证据地址(VA 为 `libil2cpp.so` 内虚拟地址)。可运行实现在 `tools/fgo_assets.py`。

---

## 1. 为什么阅读器必须先解决资源层

剧情脚本**不在 APK 里**:

- APK 内只有 `assets/AssetStorages/Android/AssetStorage.txt`(128 字节)和一个 CRI 音频配置 `assets/FGO.acf`。
- 脚本按需从 CDN 下载,进入 `AssetManager` / `AssetStorage` 体系:
  `ScriptManager$$LoadScript`(VA `0x31a4328`)调用 `AssetManager$$isExistAssetStorage`(`0x2da2ba0`)、
  `AssetManager$$isNeedDownload`(`0x2da4bac`)、`AssetLoader.LoadEndDataHandler`(`0x2da0564`)。

因此阅读器要么(1)复用游戏已下载的缓存,要么(2)自行实现同一套 storage/bundle 解析与解密。

---

## 2. AssetStorage.txt:容器格式 + 解密(已完全打通)

### 2.1 解密链路

读取方:`AssetManager.<InitCR>d__136$$MoveNext`(VA `0x2dac340`,协程状态机)。

```
文件文本(纯 ASCII/base64)
  → Convert.FromBase64String
  → CatAndMouseGame.MouseGame8(string)                 VA 0x2e4fe9c
        ├ decode: MouseHomeMainZ2(data, stageData, stageTop, true)   VA 0x2e4ffec
        │      = RijndaelManaged: BlockSize=256, KeySize=256, CBC, PKCS7
        │        CreateDecryptor(key=stageData, iv=stageTop)
        │        若明文以 "BZ" 开头则本函数返回 null(交给下一个)
        │        否则 GZip 解压
        └ fallback: MouseHomeMain(data, baseData, baseTop, true)     VA 0x2e4ea14
               使用 DataDecryptor(VA 0x2e5199c):同样 Rijndael-256 + BZip2InputStream
  → 逐字节按位取反(mvn)                      (MouseGame8 尾部循环, 0x2e4ff80-0x2e4ff9c)
  → Encoding.UTF8.GetString
```

实测:APK 内的 `AssetStorage.txt` 解出来是

```
~2538018432
@FgoDataVersion0066,20160420_1,20260918_20:23
```

即明文以 `BZh1`(bzip2)开头 → `MouseHomeMainZ2` 判定为 "BZ" 返回 null → `MouseHomeMain` 走 bzip2 分支。

### 2.2 密钥从哪来(重要)

密钥不是直接可用的字符串,`CatAndMouseGame..cctor`(VA `0x2e4bffc`)对**两个 64 字符字面量做奇偶拆位**:

| 字面量(.rodata) | 拆位后 |
|---|---|
| `kzdMtpmzqCHAfx00saU1gIhTjYCuOD1JstqtisXsGYqRVcqrHRydj3k6vJCySu3g` | 偶数字符 → `stageData`,奇数字符 → `stageTop` |
| `PFBs0eIuunoxKkCcLbqDVerU1rShhS276SAL3A8tFLUfGvtz3F3FFeKELIk3Nvi4` | 偶数字符 → `baseData`,奇数字符 → `baseTop` |

`dump.cs` 里 `CatAndMouseGame` 的常量值(`SKEY`/`SVEC`/`BKEY`/`BVEC`…)是这两个字面量的两半,
但**代码里实际操作的是拆位后的数组** —— 直接拿 `SKEY` 当 key 会解不开(已实测)。

`tools/fgo_assets.py` 中的 `STAGE_DATA/STAGE_TOP` 就是这个拆位结果,`decrypt_asset_storage()` 可复现。

### 2.3 明文格式

`InitCR` 的解析(VA `0x2dac700` 之后):

```
line 0        : "~<crc32>"      crc32 是标准 CRC-32(zlib/ISO-HDLC),
                               覆盖范围 = 第 1 个 '\n' 之后的全部字节(含末尾换行)
其余行        : 以 '@' 开头为记录;字段同样以 '@' 分隔
示例记录      : @FgoDataVersion0066,20160420_1,20260918_20:23
```

校验失败的错误串(`AssetManager` 内)佐证:
`'AssetStorage boot load error : ファイル先頭の１行目の内容が空'`、
`'~'`、`'AssetStorage boot load crc error : チェックサム値が不一致'`、
`Crc32$$Compute`、`System.UInt32$$Parse`。

> 注意:APK 内这份是**桩文件**,只有一行数据版本。真正的完整资源清单由游戏启动时下载
> (`'AssetStorageList download error'`、`CdnUrlString`/`DataServerAddress`)。
> 实测直接用 `https://cdn.data.fate-go.jp/AssetStorages/...` 请求会返回 403
> (`AccessDenied`),需要游戏自身的请求参数/会话;本地缓存里那份才是可直接解析的完整清单。

---

## 3. 资源包命名与密钥

`AssetData`(`dump.cs` 类 `AssetData`,VA 见下)定义:

分割字符常量(在 `AssetData..cctor` VA `0x2d9ec34`,取自 `.rodata 0xea68d8` 的 8 字节 `2f00400040005f00`):

| 常量 | 值 |
|---|---|
| `ASSETBUNDLE_SPLIT_BASE_CHAR` | `/` |
| `ASSETBUNDLE_SPLIT_CACHE_CHAR` | `@` |
| `ASSETBUNDLE_SPLIT_HASH_CHAR` | `@` |
| `ASSETBUNDLE_SPLIT_NOT_HASH_CHAR` | `_` |

命名规则(实测自反汇编):

| 属性 | 规则 | 证据 |
|---|---|---|
| `DownloadName` | 有扩展名:`name.Replace('/','_')`;无扩展名:`name.Replace('/','@') + ".unity3d"` | `AssetData$$get_DownloadName` VA `0x2d9cfdc` |
| `CacheName` | `name.Replace('/','@') + ".unity3d"` | `AssetData$$get_CacheName` VA `0x2d9d140` |
| `Path` | `AssetManager.CacheRoot + CacheName` | `AssetData$$get_Path` VA `0x2d9d284` |
| `Url` | 只在 `nowVersion != newVersion` 时有值,由 `AssetManager.getUrlString` 拼 `DataServerAddress + DownloadName + '?v=' + …` | `AssetData$$get_Url` VA `0x2d9cf3c`、`0x2da3994` |
| `Key` | `CatAndMouseGame.GetAssetbundleKey(keyType)` | `AssetData$$get_Key` VA `0x2d9d398` → VA `0x2e51200` |

**资源包自身的解密**由 `CatAndMouseGame` 的另一组游戏负责:`CatGame1..8` / `MouseGame1..8` /
`CatHome*` / `MouseHome*` / `DataDecryptor`(类清单见 `dump.cs` 中 `CatAndMouseGame` 附近,
方法 VA 例:`CatGame8 0x2e4fd08`、`MouseGame8 0x2e4fe9c`、`DataDecryptor::.ctor 0x2e5199c`)。
其中 `MouseHomeMainZ2` 的 `isCompress` 分支说明包体要么是 **bzip2** 要么是 **gzip**,要以 `BZ` 魔数区分。

`keyType` 取自资源记录字段,实际密钥材料由服务器下发的 key 集合提供:
`CatAndMouseGame.SetAssetbundleKeys`(VA `0x2e50fa4`)、`AddAssetbundleKeys`(`0x2e510f0`)、
`keyCollection`/`assetbundleKeyCollection` 字段(`dump.cs` 中 `CatAndMouseGame` 静态字段 0x68/0x70)。

---

## 4. 脚本资源的定位

- **脚本资源是 `.txt`**:`ScriptManager$$IsExistScriptFile`(VA `0x319bf3c`)把名字与字面量 `'.txt'`
  拼接后做比较。所以资源清单里形如 `<名字>.txt` 的条目就是剧本。
- 资源名由 `ScriptManager$$GetScriptAssetName` 系列生成:
  - `long scriptId` 版本用格式串 `'{0:D2}/{1:D4}'`(`0x319c1c0`、`0x319c2dc`),即两段式名字 `XX/YYYY`
  - `int questId` 版本检查首段是否为字面量 `'94'`,并把名字按 `'/'` 切分(`0x3195ce4`);
    对照该段的 `'/'` 切分逻辑可推断脚本资源名形如 `94/....`,但**精确的 id 分解需要一份真实的资源清单才能定论**(桩文件里没有记录)
- 战斗脚本名模板(类常量):`SCRIPT_NAME_BATTLE_BASE = "{0:D8}{1:D1}"`,
  `BATTLE_START = "{0:D8}{1:D1}0"`, `BATTLE_END = "{0:D8}{1:D1}1"`,
  `BATTLE_END2 = …2`, `BATTLE_START2 = …2`, `JUST_BEFORE = …9`, 等(dump.cs `ScriptManager` 常量区)。
- `ScriptManager$$GetScriptData()`(VA `0x31a3ba8`)按 `mode` 拼名字:见到 `'PlayQuestStart'`、
  以及后缀字面量 `'Q'`、`'E'`、`'W'`,再调 `GetExecuteScriptText(label)`。
- 启动模式字符串(决定从哪个 label 起播):`'DEFAULT' 'GACHA' 'SCENARIO' 'BATTLE_START' 'BATTLE_END'
  'CHAPTER_CLEAR' 'QUEST_START' 'COMMON' 'Common' 'Gacha' 'ChapterStart' 'QuestStart'`
  (`ScriptManager$$GetStartModeForAssetStorage` VA `0x3194260`)。

**给阅读器的实践路径**:优先读游戏已下载的缓存目录
(`AssetData.Path` = `CacheRoot + CacheName`,即 `<缓存根>/<name 的 '/' 换成 '@'>.unity3d`),
用 `tools/fgo_assets.py` 的规则构造文件名,再用 `MouseHomeMain` 系列的密钥解开包体,取出其中的 TextAsset 文本,
交给 `tools/fgo_script_parser.py` 解析。

---

## 5. 已验证 / 未验证清单

**已验证(本地可复现)**
- `AssetStorage.txt` 的 base64 → Rijndael-256-CBC(stageData/stageTop)→ bzip2 → NOT → UTF-8
- `~<crc32>` 校验值一致(`crc ok: True`)
- 资源包文件名替换规则与 `.unity3d` 后缀
- 脚本是文本、按行、空格分隔、`#`/`//` 注释、`\n` 等转义

**未验证(需真实下载资源才能确认)**
- 生产版 AssetStorage 的完整记录字段顺序(桩文件只有一行 `@FgoDataVersion…`)
- 各 `keyType` 对应的具体 `CatGame*/MouseGame*` 组合(代码是按 keyType 分派,未逐一枚举)
- 脚本文本中 `message2`/`message3` 两种消息行的精确参数含义(见 `commands.md`)
- CDN 直连需要游戏侧请求参数(403)

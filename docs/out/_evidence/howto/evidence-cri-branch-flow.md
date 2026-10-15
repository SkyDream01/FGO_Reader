# cri/branch/flow 证据补录

本文为 `how-to-adv-unrestored.md` 的四组——「CRI cue 与 BGM 保留(11)」「游戏条件分支(9)」「随机旗标(1)」「游戏流程及名字宽度判断(4)」——做针对性逆向补证。

约定：

- `0x…` 均为 libil2cpp.so 内 VA；命令 handler 都在 `ScriptManager$$ScriptCommandExecute`（`0x3177290..0x319402c`）内，`x19=this(ScriptManager)`、`x20=&pd[]`（长度 `[pd+0x18]`、元素 `pd[i] @0x20+8i`，值/分隔符交替）、`x25/x22=当前 tag`（`ldr x1,[x22]` 读 tag，见 evidence-fsm-insertion.md §0）。
- 结论不带标记即有反汇编或类体证据（`out/_evidence/class_ScriptManager.txt`、`work/il2cpp_out/dump.cs`）；推断标 **INFERRED**。
- 阅读器指 `F:/Project/FGO_Reader`（Web TS：`src/adv/{executor,commands,audio,resources,compiler}.ts`），下文的「阅读器补齐要点」直接对应该实现。
- 语料计数来自 `work/coverage/tag_counts.json` 与 `scripts/**` 实查（2583 文件 / 1,867,761 行）。

---

## 组 1. CRI cue 与 BGM 保留(11)

成员（11 条）：`cueSe`、`cueSeStop`、`cueSeVolume`、`cueSeContinue`、`cueSeContinueStop`、`cueSeContinueVolume`、`cueVoice`、`cueVoiceStop`、`cueVoiceVolume`、`keepSubBgmOn`、`keepSubBgmOff`。

### 1.0 共享后端链条（一次钉死；下面各命令只写差异）

**从命令到 CRI Atom 的完整调用链**（cueSe 为一个实例，`se`/`voice` 走同一后端不同重载）：

```
0x318fdd4  bl   #0x2e8036c  CALL OverwriteAssetSoundName$$PlaySe   ; (callMethod, assetName, objectName, volume, cb, ignorePreDelay)
0x2e804c8  b    #0x2e7ffc8                                        ; 6 参重载尾调用 SeManager.PlaySe(assetName, objectName, volume, fadeinTime, cb, notOverwrite, ignorePreDelay)
0x2e800ac  bl   #0x2e94624  CALL SeManager$$PlayLocal              ; 分配 num、new SePlayer
0x2e946e8  bl   #0x2e94784  CALL SePlayer$$.ctor                   ; cueSheetName=asset(0x18)、objName=object(0x20)
0x2e94e80  bl   #0x2e93fc4  CALL SeManager$$GetAudioSource         ; 取/建 CriAtomSource (SePlayer.source 0x38)
0x2e94f04  bl   #0x23464e0  CALL CriAtomSource$$set_volume
0x2e950fc  bl   #0x2346d6c  CALL CriAtomSource$$Play               ; 0x2346d6c = Play() → ldr x1,[x0,#0x70](_cueName)
0x2346dc8  bl   #0x2340ef0  CALL CriAtom$$GetAcb                  ; 入参 = [x19,#0x78](_cueSheet)
0x2346de0  bl   #0x235cedc  CALL CriAtomExPlayer$$SetCue           ; (player, acb, cueName, null)
```

CriAtomSource.Play 体内实证（`SePlayer.Update` 的 `0x2e950fc` 调它）：

```
0x2346d6c  ldr      x1, [x0, #0x70]        ; CriAtomSource._cueName
0x2346d74  sub      sp, sp, #0x30
0x2346db0  ldr      x0, [x19, #0x78]       ; CriAtomSource._cueSheet
0x2346db8  bl       #0x4871c3c  CALL System.String$$IsNullOrEmpty
0x2346dc8  bl       #0x2340ef0  CALL CriAtom$$GetAcb
0x2346de0  bl       #0x235cedc  CALL CriAtomExPlayer$$SetCue
```

**关键类体字段**（dump.cs）：

- `SePlayer`：`cueSheetName 0x18`、`objName 0x20`、`volume 0x34`、`source(CriAtomSource) 0x38`、`fadeinTime 0x54`（`public class SePlayer // TypeDefIndex 2204`）。
- `CriAtomSource`：`_cueName 0x70`、`_cueSheet 0x78`（`public class CriAtomSource // TypeDefIndex 19917`）。
- `ScriptManager`：`sePlayer 0x460`（单个「当前 SE」句柄）、`seContinuePlayers: Dictionary<int,SePlayer> 0x470`（续播池，按脚本 id 键控）、`voicePlayer 0x478`、`isNonStopBgm 0x2C9`。
- `SeManager`：`seSources(CriAtomSource[]) 0x28`、`sePlayerStatusList 0x68`、`sePlaybackStatusList 0x90`。
- `SoundManager`：`CpkLoader`（CPK 装载，见下）。

**命名与资源**：

- SE 资源路径模板 = `"Se/" + name`：`SeManager$$GetPathName @0x2E911AC`，`0x2e911c4 ldr x21,[x21,#0x5f8] ; &'Se/'`（阅读器 `resources.ts` 的 `audio: Se/${name}` 与此一致）。
- cueSe 的两个名字**都过 `ScriptManager$$ConvertNameString @0x31B1530`**；不存在 `ConvertCueName` 之类的专用转换（全库 method 名检索仅见 `BgmManager$$ExtractCueName @0x2E464DC`、`CriAtomExPlayer$$criAtomExPlayer_SetCueName @0x235CEEC`，与命令层无关）。
- cue sheet/bank 加载：常驻 `SoundManager$$Setup → CriAtom$$AddCueSheet @0x2E992C4`；CPK 内 cue sheet 由 `SoundManager.CpkLoader.<SetupCpk>d__14.MoveNext`：
  ```
  0x2e9e61c  bl   #0x2e9e0cc  CALL SoundManager.CpkLoader.EfCpkNameHelper$$ResolveCueSheetFileNames
  0x2e9e63c  bl   #0x234027c  CALL CriAtom$$AddCueSheet      ; (name, acbFile, awbFile, binder)
  ```
- 实机 APK（`work/com.aniplex.fategrandorder.apk`）内含 `assets/FGO.acf`、`assets/ResourceSound.acb.bytes`、`assets/ResourceSound.awb.bytes`（常驻 cue sheet）；`Se/SE_21` 之类脚本 SE 是下载资源（CPK/acb）——基础包内没有。

### `cueSe`

- handler：`0x3186434`（case verify `0x318642c`，tag 槽 `0x559b000+0x…`；同体只有 cueSe）。
- 共享体成员：无（三个长度形态各自成块，末尾统一进 `0x318fdc8/0x2E8036C` 或 `0x3186594/0x2E8041C`）。
- 参数消费（**三种形态**，与语料完全吻合）：
  - len==3（2 值：`asset object`）：`pd[0]→ConvertNameString 0x318fd8c`、`pd[2]→ConvertNameString 0x318fdb4`、`s0=1.0`（`0x318fdbc fmov s0,#1.0`）→ `0x318fdd4 PlaySe@0x2E8036C`（volume 默认 1）。
  - len==5（3 值：`asset object volume`）：同上但 `pd[4]→Single::Parse 0x318fd08` 作 volume → 同一 `PlaySe@0x2E8036C`。
  - len==7（4 值：`asset object fadein volume`）：`pd[6]→Parse 0x3186550`（存 s8）、`pd[4]→Parse 0x3186574`（s1）、`s0=s8(pd6)、s1=pd4` → `0x3186594 PlaySe@0x2E8041C`，即 **volume=pd[6]、fadeinTime=pd[4]**。
  - 其它长度 → `0x3193e80` 置 `'parameter error'`。校验：len=7 优先（`0x3186440 cmp w9,#7; b.ne 0x318fc2c`），其次 5（`0x318fc30`），再次 3（`0x318fd28`）；每个值前有 odd 槽 `' '` 守卫（`0x318645c/0x3186488/0x31864b4` 等）。
- 行为：`PlaySe` 返回的 `SePlayer` 写入 `ScriptManager.sePlayer(0x460)`：`0x318fddc str x0,[x19,#0x460]`；非正常播放速度时直接返回（`0x31864c8 IsNormalPlaySpeed`，0x31864d0 分支到 Normal）。
- 后端 API 地图：`OverwriteAssetSoundName$$PlaySe @0x2E8036C / @0x2E8041C` — 解析 asset+object 对并交给 `SeManager$$PlaySe(asset,object,…) @0x2E7FFC8` → `SeManager$$PlayLocal @0x2E94624` → `SePlayer$$.ctor @0x2E94784` → `CriAtomSource$$Play @0x2346D6C` → `CriAtomExPlayer$$SetCue @0x235CEDC`。类体字段见 §1.0。
- 资源：`"Se/"` 前缀（`0x2E911C4`）；cueSheet 名=asset（语料为 `SE_21…SE_26/Battle/Servants_*`），cue 名=object（语料为 `21_ad1177/bac16/m41410` 等）。
- 语料（按 tag_counts 全量）：**5712** 次。形态：2 值 **4933**、3 值 **189**、4 值 **590**。Top：`[cueSe SE_22 22_ad1177]` 186、`[cueSe SE_21 21_ad1114]` 52、`[cueSe SE_21 21_ad1118]` 45；4 值如 `[cueSe SE_23 23_ad1304 0 0.8]`（fadein=0、volume=0.8）；sheet 分布：SE_21 1124、SE_24 734、SE_22 712、Battle 594、SE_23 502、SE_25 407、SE_26 57、Servants_102800 54…
- 阅读器补齐要点：
  1. 播放层与 `se` 同源——**不是特殊音频格式**；差别只在寻址：`se` 用单名（OverwriteAssetSoundName 表解析），cueSe 直接给 (cueSheet, cueName) 对。因此「能否用普通文件近似」取决于能否把 ACB 的 cue 解成可播放文件，而不是播放机制。
  2. 最小实现：在 `commands.ts` 音频块加 `cueSe`，emit `{kind:"play", channel:"se", name, volume, fadeIn}`；`resources.ts` 的 `commandAssets` 增加 `cueSe`（asset=`Se/${p[0]}`、object=`${p[1]}`），`AudioAssetResolver` 按 `Se/<sheet>/<cue>` → 回退 `Se/<cue>` 顺序解析；未命中 → **静音降级 + 一次 diagnostics**（`unsupported` 或专门 reason），绝不发声伪造。
  3. 参数映射（values 数组 p，与引擎 pd 的换算：p[k]=pd[2k]）：`p[0]`=sheet、`p[1]`=cue；3 值 `p[2]`=volume；4 值 `p[2]`=fadeIn、`p[3]`=volume。
- 置信度：handler/重载/字段写 high；pd[4]/pd[6] 语义 high（s0/s1 与 dump 签名逐一对应）。未决项：无（cueSheet 与 bundle 内 acb 的命名细节需依 CPK 实物；`ResolveCueSheetFileNames` 未展开）。

### `cueSeStop`

- handler：`0x3188bb0`；**共享体**：与 `seStop` 同一尾块 `0x318bd58`（`OverwriteAssetSoundName$$StopSe @0x2E8064C`）。
- 参数消费（name **不过 ConvertNameString**，原样 pd[0]）：
  - len==0：`SoundManager$$stopSe(null,0) @0x2E9A9F8`（`0x318b34c`，全停）。
  - len 1–2：`StopSe(callMethod,pd[0],0)`（`0x318bd54 movi d0,#0` → `0x318bd5c`）。
  - len==3：`pd[2]→Single::Parse 0x3188c2c`（淡出）→ 同一 StopSe（`0x3188c34 b 0x318bd58`）。
- 行为：无字段写；仅停 SePlayer。`seStop` 与 cueSeStop 在引擎里**没有区别**（同一函数体、同一调用）。
- 后端 API 地图：`OverwriteAssetSoundName$$StopSe @0x2E8064C` — `(MethodBase, name, fadeoutTime)` → SeManager.StopSe。
- 资源：同 §1.0。
- 语料：**1674** 次，形态 `[cueSeStop 22_adm89 0.3]`、`[cueSeStop 22_ad1194 2.5]`（都带淡出）；恒 2 值。
- 阅读器补齐要点：加 `cueSeStop` 到 stop 列表：`emitAudio({kind:"stop", channel:"se", name:p[0]})`；淡出参数（p[1]）当前 `AudioChannels.stop` 不支持时长，可选增强为快速 fade；与现有 `seStop` 共用分支即可。
- 置信度：high。未决项：无。

### `cueSeVolume`

- handler：`0x318440c`（min 5=3 值；len≠5 → `0x3191820 parameter error`）。
- 参数消费：`pd[0]` 原样（无 ConvertNameString，`0x3184488 ldr x19,[x8,#0x20]`）；`pd[4]→Single::Parse 0x3184490` 存 s8、`pd[2]→Parse 0x31844b4` 存 s9；`s0=s8(pd4)、s1=s9(pd2)` → `0x31844e4 SoundManager$$changeVolumeSe`。
- 行为：调用 `SoundManager.changeVolumeSe(pd0, volume=pd[4], fadeTime=pd[2]) @0x2E9AAB8`（签名 `changeVolumeSe(string name, float volume, float fadeTime)`）。
- 后端 API 地图：`SoundManager$$changeVolumeSe @0x2E9AAB8`（注意不是 SeManager）；音量按名匹配正在播的 SePlayer。
- 资源：同 §1.0。
- 语料：**1031** 次，如 `[cueSeVolume 22_ad1213 1.5 0.3]`（pd2=渐变 1.5s、pd4=音量 0.3）。
- 阅读器补齐要点：加 `cueSeVolume` → `emitAudio({kind:"volume", channel:"se", name:p[0], volume:p[2], duration:p[1]})`（与现有 seVolume 同构，参数位一致）。
- 置信度：high。未决项：无。

### `cueSeContinue`

- handler：`0x317ffa4`；共享体：与 `seContinue` 结构平行但**不同体**（seContinue 体 `0x3180310`，name=pd[0]）。
- 参数消费（三种形态；值语义按 s 寄存器核对）：
  - len==9（5 值 `asset object fadein volume id`）：`pd[8]→Int32::Parse 0x318008c` 得 **id** → `ScriptManager$$CheckSameIdSeContinue @0x31B4D08`（`0x31800a0`）；name=**pd[2] 原样**（`0x31800dc ldr x22,[x8,#0x30]`，**无 ConvertNameString**）；volume=pd[6]、fadeinTime=pd[4]（`0x31800d8/0x3180134`）→ `0x3180154 PlaySeContinue@0x2E80178`（`(MethodBase,name,volume,Action,fadeinTime,ignore)`）。
  - len==7（4 值 `asset object volume id`）：`pd[6]→Int32 0x3191608`（id）、`pd[2]→ConvertNameString 0x3191658`、`pd[4]→Parse`（volume）、fadein=0（`0x31916b0 movi d1,#0`）→ 同 0x2E80178。
  - len==5（3 值 `asset object id`）：`pd[4]→Int32 0x319175c`（id）、`pd[2]→ConvertNameString 0x31917ac` → `0x31917f8 PlaySeContinue@0x2E800D4`（`(MethodBase,name,Action)`，无音量参数）。
  - 每次播放返回的 SePlayer 写入 `ScriptManager.seContinuePlayers(0x470)`：`0x3180160-0x3180168` 后 `b #0x319180c` → `0x3191814 bl Dictionary<int,object>$$Add(dict, w21=id, player)`。
- 行为：`CheckSameIdSeContinue(id)` 语义 = **同 id 续播幂等**：字典已含该 id → 取出旧 SePlayer → `StopSe(0)`（`0x31b4d84-0x31b4d8c`）并走销毁回调 → 再播新的并覆盖字典。⇒ 「续播」= 播放句柄按脚本内 id 保留在 `seContinuePlayers`，供 `cueSeContinueStop/Volume` 事后按 id 定位；与 `sePlayer(0x460)` 的单句柄不同。
- 后端 API 地图：`OverwriteAssetSoundName$$PlaySeContinue @0x2E7FF20/@0x2E800D4/@0x2E80178`（多重重载）；`ScriptManager$$CheckSameIdSeContinue @0x31B4D08`；`BasicHelper$$GetValue<int,object> @0x384907C`（按 id 取字典）；字段 `seContinuePlayers 0x470`。
- 资源：同 §1.0（语料 sheet 名 `SE_26`/`Servants_9943960`）。
- 语料：**32** 次；形态恒 3 值：`[cueSeContinue SE_26 26_ad1555 7]`、`[cueSeContinue Servants_9943960 m23605 3]`（末位=id，与 cueSeContinueStop 的 id 配对）。
- 阅读器补齐要点：实现续播池 `Map<number,{name,entry}>`：`cueSeContinue` → 若同 id 存在先停旧 → 播放（channel "se"，loop=false）→ 存入池；3 值形态按 `p[2]`=id；4 值 `p[2]`=volume、`p[3]`=id；5 值 `p[2]`=fadeIn、`p[3]`=volume、`p[4]`=id。音量/淡出可直接传给 `AudioIntent.play`。
- 置信度：handler/调用 high；「5 值（9 元素）形态 name 不过 ConvertNameString、4/3 值（7/5 元素）形态过」为实测差异（medium，可能是引擎作者笔误，按实测照抄即可）。未决项：`Action` 回调具体方法未解析（不影响补放）。

### `cueSeContinueStop`

- handler：`0x31838c8`；**共享体**：与 `seContinueStop` 同一函数体（tag 二次派发）。
- 参数消费：
  - len==5（3 值 `name fadeout id`）：`pd[4]→Int32 0x3183964`（id）→ `BasicHelper.GetValue<int,object>(seContinuePlayers,id) @0x384907C`（`0x3183980`）；命中 null → 直接 Normal；否则 `pd[2]→Single::Parse 0x31839a8`（淡出）→ `SePlayer$$StopSe @0x2E93E18`（`0x31839b4`）。
  - len==3（2 值 `name fadeout`）：枚举整个 `seContinuePlayers` 字典，逐项比较 `SePlayer.objName(0x20)`==pd[0]（`0x318bcec ldr x0,[x22,#0x20]`），相等者按 pd[2] 淡出 StopSe（`0x318bcc4-0x318bd14`）。
  - 其它长度 → `0x3193d94`（参数错误路径）。
- 行为：无 ScriptManager 字段写；停池中句柄。
- 后端 API 地图：`SePlayer$$StopSe @0x2E93E18`；`Dictionary<int,SePlayer>` 直接读取（`ScriptManager.seContinuePlayers 0x470`）。
- 语料：**20** 次；如 `[cueSeContinueStop 26_ad1555 1.0 7]`、`[cueSeContinueStop m23605 0.4 3]`（3 值，末位 id 与 cueSeContinue 配对）。
- 阅读器补齐要点：`cueSeContinueStop` → 有 id：停池中该项并删除；无 id（2 值）：按 name 匹配池中所有项停止（匹配 `entry.name`）。淡出可选。
- 置信度：high（枚举/比较/调用点均实测）。未决项：无。

### `cueSeContinueVolume`

- handler：`0x3188898`；**共享体**：与 `seContinueVolume` 同一函数体。
- 参数消费（min 7=4 值；另有 len==5 分支）：
  - len==7（4 值 `name fade volume id`）：`pd[6]→Int32 0x3188938`（id）→ 字典取 SePlayer（`0x3188954`）；`pd[4]→Parse 0x318897c` 存 s8、`pd[2]→Parse 0x31889a0` 存 s9；`s0=s8(pd4=volume)、s1=s9(pd2=fadeTime)` → `0x31889b4 SePlayer$$ChangeVolume @0x2E949CC`。
  - len==5（3 值）在 `0x3188ee4` 分支（结构同构，未逐条跟完 → 标注）。
- 行为：对池中句柄做音量渐变。
- 后端 API 地图：`SePlayer$$ChangeVolume(volume, fadeTime) @0x2E949CC`。
- 语料：**14** 次；如 `[cueSeContinueVolume 26_ad1551 1.0 0.5 1]`（fade=1.0、volume=0.5、id=1）。
- 阅读器补齐要点：等于对池中 id 项 emit `{kind:"volume", channel:"se", name:entry.name, volume:p[2], duration:p[1]}`；池中无此 id → no-op（与引擎 null 早退一致）。
- 置信度：high（7 值路径）；len==5 路径 medium。未决项：len==5 分支的参数字义。

### `cueVoice` / `cueVoiceStop` / `cueVoiceVolume`（3 条）

- handler：`cueVoice 0x317cef8`、`cueVoiceStop 0x3179ed0`、`cueVoiceVolume 0x317b954`。
- 参数消费（cueVoice：len==5→3 值、len==3→2 值；name 一律取 **pd[2]**→ConvertNameString）：
  - `cueVoice`（len5）：`pd[2]→ConvertNameString 0x317cf8c`、`pd[4]→Parse 0x317d64c`（volume）→ `0x317d67c SoundManager$$playCharaVoice(name, volume, false) @0x2E9B3D0`；（len3）：`0x3191548 playCharaVoice(name, ignorePreDelay) @0x2E9B304`。
  - `cueVoiceStop`（len3）：`pd[0]→ConvertNameString 0x3179f34`、`pd[2]→Parse 0x3179f58`（淡出）→ `0x318e7ec SoundManager$$stopVoice @0x2E9AF94`；（len1）走 0x318e7a8 同构。
  - `cueVoiceVolume`（len5）：`pd[0]→ConvertNameString 0x317e468`、volume=s0=pd[4]（0x317e48c）、fadeTime=s1=pd[2]（0x317e4b0）→ `0x317e4e0 SoundManager$$changeVolumeVoice @0x2E9B0C0`。
- 行为：`cueVoice` handler 内未见对 `ScriptManager.voicePlayer(0x478)` 的直接写入（`voice` handler 同；是否由 `playCharaVoice` 内部经 SoundManager 自管 → **INFERRED**）；功能与 `voice`（0x317d5b0，name=pd[0]）同构，只把名字参数位从 pd[0] 换成 pd[2]。
- 资源：语音资源同样经 `Se/` 与 CRI 管线（playCharaVoice → SeManager.PlayVoice(asset,object)）。
- 语料：**三条全为 0 次**（corpus 无 cueVoice/cueVoiceStop/cueVoiceVolume；语音语料走 `voice`62 / `voiceStop`5 / `voiceVolume`0 / `tVoice`17）。⇒ 优先级最低。
- 阅读器补齐要点：按 voice 通道照抄映射（cueVoice: name=p[1]、volume=p[2]；cueVoiceStop: name=p[0]、fade=p[1]；cueVoiceVolume: name=p[0]、fade=p[1]、volume=p[2]），或先按「已知但语料未用」标 unsupported 亦可（建议实现，成本≈0）。
- 置信度：high（调用点/参数字义实测）。未决项：无。

### `keepSubBgmOn` / `keepSubBgmOff`（2 条，无参数）

- handler：`keepSubBgmOn 0x3181fd4`（`mov w0,#1`）、`keepSubBgmOff 0x31797d0`（`mov w0,wzr`）→ 同一目标：
  ```
  0x3181fec  mov      w0, #1
  0x3181ff4  bl       #0x2e45d20  CALL BgmManager$$Enable_KeepSubBgm
  0x2e45da4  ldr      w8, [x20, #0x48]     ; enableCounter_KeepSubBgm
  0x2e45dac  sub      w9, w8, #1
  0x2e45db0  csinc    w8, w9, w8, eq       ; value==false → counter-1；true → counter+1
  0x2e45db4  bic      w8, w8, w8, asr #31  ; clamp ≥0
  0x2e45db8  str      w8, [x20, #0x48]
  ```
- 行为：**写入 BgmManager 单例 `enableCounter_KeepSubBgm(0x48)` 计数器**（+1/-1，夹 0），不是布尔。「subBgm 保持」语义：
  - 读取：`BgmManager$$IsKeepSubBgm @0x2E454C8`（`ldr w8,[x0,#0x48]; cmp #0; cset gt`），公共读取 `BgmManager$$GetIsKeepSubBgm @0x2E471D8` 被 `PlaySubBgmOnEnableComponent`（`0x2e38110`）消费——场景 OnEnable 时据此决定子 BGM 是否接力（该类另有 `ChangeKeepSubBgmStateIfNeed @0x2E383E8`）。
  - 复位：脚本执行退出时强制清零——`ScriptManager$$ExitExecuteScript @0x31B416C` 内 `0x31b4710 bl BgmManager$$ForceDisable_KeepSubBgm @0x2E45DD0`。
- 资源：无。
- 语料：**两条均 0 次**（语料不使用；语义仍应实现以防新脚本）。
- 阅读器补齐要点：在 executor 加 `keepSubBgm = Math.max(0, keepSubBgm ± 1)`；`soundStopAll`/`bgmStop` 路径在 `keepSubBgm > 0` 时**不停止 subBgm 通道**（`AudioChannels.stopAll` 需新增排除参数，或先 stopAll 后重放 subBgm 记录）；`start()`/播放结束时复位（对应 ExitExecuteScript）。
- 置信度：high（写入/读取/复位三处均实测）。未决项：`PlaySubBgmOnEnableComponent` 的完整接力流程未逐行跟（不影响计数语义）。

### 本组小结（CRI 11 条）

- **缺口分类**：
  - a) 纯逻辑缺口：`cueSeStop/cueSeVolume/cueSeContinue*/cueVoice*/keepSubBgm*` 的**命令分支与状态管理**可在现有 `AudioChannels`/`emitAudio` 上 1:1 补齐（续播池、keep 计数、参数位映射）。
  - b) 需原始资源：`cueSe/cueSeContinue/cueVoice` 的**声音本体**在 `Se/<sheet>` 的 ACB（CPK/下载资源）里，需要 ACB→可播文件的离线解包；基础包只有 `ResourceSound.acb(+awb)` 与 `FGO.acf`。
  - c) 需游戏数据源：无（cue 名转换不存在，名字直接来自脚本）。
- **最小可交付实现**：三条播放（cueSe/cueSeContinue/cueVoice）+ 三条停止 + 三条音量 + 两条 keep，全部走已有 `AudioIntent`；未解出的 cue 静音降级并记一条 diagnostics；`keepSubBgm` 计数器接 `soundStopAll`。
- **升级路径**：① 离线 ACB 解包 + `(sheet,cue)→文件` 映射表（可用 `Se/<sheet>/<cue>` 资源键）；② 续播池改为真实淡出/淡入（复用 TweenService）；③ 若日后接入 WebAudio 还可把 `fadeoutTime` 真正实现。

---

## 组 2. 游戏条件分支(9)

成员（9 条）：`branchMaterial`、`branchNotMaterial`、`branchHaveSvtEquip`、`branchNotHaveSvtEquip`、`branchRouteSelect`、`branchNotRouteSelect`、`branchRouteSelectCount`、`branchNotRouteSelectCount`、`branchSetGrandSvtCount`。

### 2.0 分支基座（跳转/返回码，全组适用）

- 所有正/反分支命令共用的「条件成立」尾块 = `0x3184684`：检查 pd.Length>0 后转 `0x319075c`：
  ```
  0x319075c  ldr      x1, [x8, #0x20]        ; pd[0] = 跳转标签
  0x3190768  bl       #0x31b1530  CALL ScriptManager$$ConvertNameString
  0x3190778  bl       #0x31a8488  CALL ScriptManager$$JumpScript   ; 按 label 找行 → executeIndex := 该行
  0x318cb98  mov      w24, wzr                 ; 跳转后返回 Normal(0)
  ```
- 条件不成立 = 直接 `mov w24,wzr`（`0x3193f00`）返回 Normal(0)，**顺序执行下一行**；本组 9 条**没有任何一条返回 ReturnFalse(0x3188c6c) 或 Continue(0x3193f04)**——跳行不是靠返回码，而是 handler 内部对 `executeIndex` 的副作用（`JumpScript(string) @0x31A8488`；其内部 label→行号解析见 `closure-choice-branch.md` §B.6 `SetJumpIndexByLabel 0x31b2b88`，跳转时若跨越 switchCase 会被拒绝并置 `isResetSwitchCase`，per 文档）。
- `ScriptManager$$GetQuestId @0x31B3F6C`：把 pd 中的任务键（数字串）转成 int 任务 ID（与 branchQuestClear 同一函数）。
- 编译器现状（阅读器 `compiler.ts:142`）：`/^(?:branch|jump|masterBranch)/` 已能为 `branchMaterial/branchRouteSelect/branchRouteSelectCount/branchSetGrandSvtCount/branchHaveSvtEquip`（都以 "branch" 开头）把 `params[0]`（=pd[0]）解析为 `targetIndex`。⇒ 复用零成本。

### `branchMaterial` / `branchNotMaterial`（共享体 `0x31802b0`）

- handler：`0x31802b0`（两 tag 共体，tag 二次派发 `0x31802cc &'branchMaterial'`）。
- 参数消费：**必须 0 参数**（`0x31802bc cmp w8,#1; b.ne 0x3193ee8`→`'parameter error'`）；唯一形态 `[branchMaterial <label>]`。
- 行为：条件 = `isCollection(0x371) == (tag=="branchMaterial")`：
  ```
  0x31802b0  ldr      x8, [x20]                ; pd
  0x31802bc  cmp      w8, #1 ; b.ne #0x3193ee8
  0x31802cc  ldr      x8, [x8, #0xdf0]  ; &'branchMaterial'
  0x31802d4  ldrb     w21, [x19, #0x371]       ; ScriptManager.isCollection
  0x31802dc  bl       #0x4870cc0  CALL System.String$$op_Equality
  0x31802e0  and      w8, w0, #1
  0x31802e4  cmp      w21, w8
  0x31802e8  b.ne     #0x3193f00              ; 不等 → Normal（不跳）
  0x31802ec  b        #0x3184684              ; 相等 → JumpScript(pd[0])
  ```
  ⇒ **branchMaterial 在 isCollection=true 时跳到 pd[0]；branchNotMaterial 反之**（正常游玩时后者跳）。
- 后端 API 地图：只读 `ScriptManager.isCollection(0x371)`（`SetIsCollection` 写入，per class_ScriptManager.txt）；无外部数据源。
- 资源：无。
- 语料：`branchMaterial` **26** 次（全部在 Lostbelt No6 系列），`branchNotMaterial` **0** 次。典型上下文（`0300090560.txt:244-256`）：
  ```
  [label selectBranch]
  [branchMaterial lblMaterial]      ← isCollection 时跳；否则顺序继续放战斗 BGM
  [bgm BGM_BATTLE_166 0.1]
  [branch lblBranchMaterialEnd]
  [label lblMaterial] … [bgmStop …] …
  ```
- 阅读器补齐要点：加 `case "branchMaterial"/"branchNotMaterial"`：`const coll = this.options.collectionMode ?? false;` 条件成立 → `this.jump(instruction.targetIndex)`。引擎中 isCollection 由「是否图书馆回放」决定，阅读器本质是回放器：**建议默认 `false`（正片语义）并暴露设置**；未知时按默认 false 处理即与现有 `branchQuestClear` 缺省 `questClear=false` 的安全默认一致。`Resources` 无消耗。
- 置信度：high（条件/跳转实测）。未决项：命令名与「素材（saveMaterial）」的直接关系未在引擎侧找到（**素材逻辑不在本 handler**，属 `？n,<id>,saveMaterial：` 选项解析/消耗流程，见 closure-choice-branch.md D7，per 文档）。

### `branchHaveSvtEquip` / `branchNotHaveSvtEquip`（共享体 `0x318459c`）

- handler：`0x318459c`（两 tag 共体；tag 二次派发 `0x31845fc/0x318460c &'branchHaveSvtEquip'`）。
- 参数消费：len≥3（`0x31845a8 cmp w9,#3; b.lt → parameter error`），pd[1]==' ' 守卫（`0x31845c4`），`pd[2]→Int32::Parse 0x31845ec`（礼装/装备 ID）。
- 行为：条件 = 两个 CondType.Kind 之一命中：
  ```
  0x3184630  mov      w0, #8
  0x3184634  mov      w1, w21                  ; pd[2] 装备ID
  0x3184648  bl       #0x2d6c594  CALL CondType$$IsOpen        ; kind=8
  0x3184650  mov      w0, #0x28
  0x3184668  bl       #0x2d6c594  CALL CondType$$IsOpen        ; kind=40
  0x318466c  orr      w9, w24, w0
  0x318467c  cmp      w8, w9                   ; (tag=='branchHaveSvtEquip') vs (open8|open40)
  0x3184680  b.ne     #0x3193f04              ; 不等 → w24=0 → Normal
  → 相等 → 0x3184684 → JumpScript(pd[0])
  ```
- 后端 API 地图：`CondType$$IsOpen(CondType.Kind, int targetId, long condValue, bool isCollection, BattleVoicePlayCondArgs) @0x2D6C594` — 游戏状态判定总入口（内部按 Kind 查用户数据/静态 master；礼装持有类 Kind 见 `CondType` 类体 `cachedServantEquipIdStrDic 0x18`）。Kind 常量 8/0x28 的枚举名未在 dump 展开（**INFERRED**：其一为「持有该 SvtEquip」，另一个为其等价/包含判定）。
- 资源：无。
- 语料：**两 tag 均 0 次**（完整名录里保留；新脚本可能用）。
- 阅读器补齐要点：`options.gameState?.svtEquipHaving?.(Number(p[1]))`；未注入 → 默认 false（`branchHaveSvtEquip` 不跳、`branchNotHaveSvtEquip` 跳，与现有未知处理一致），并记一次 diagnostics。**不猜测**；若要真值，需用户导入用户存档/配置表（礼装 ID 集合）。
- 置信度：参数/调用 high；两个 Kind 具体枚举名 medium/INFERRED。未决项：Kind 8/0x28 的名称与差别。

### `branchRouteSelect` / `branchNotRouteSelect`（共享体 `0x31834e4`）

- handler：`0x31834e4`（两 tag 共体；tag 二次派发 `0x3183594 &'branchRouteSelect'`）。
- 参数消费：min 5（3 值 `label quest route`），pd[1]/pd[3]==' ' 守卫；`pd[2]→ScriptManager$$GetQuestId 0x3183564`（任务 ID）、`pd[4]→Int32::Parse 0x3183588`（路线 ID）。
- 行为（两条判定路径 + 计费分支）：
  ```
  0x31835d8  bl   #0x2d72f88  CALL CondType$$IsRouteSelect          ; (quest,route) → w25
  0x3183608  eor  w25, w21, w25                                    ; w21=(tag=='branchRouteSelect')
  0x318360c  bl   #0x307af34  CALL MaterialBranchRouteManager$$IsMaterialSelectedRouteId ; → w22
  0x3183610  ldrb w8, [x19, #0x371]                                ; isCollection
  0x3183614  cbz  w8, #0x3183688                                   ; 非 collection → 用 IsRouteSelect
  0x318367c  bl   #0x2f9b260  CALL QuestPhaseMaster$$IsEnableMaterialPlayUseUserQuestRoute
  0x3183680  tbnz w0, #0, #0x3183688                               ; 允许 → 仍用 IsRouteSelect
  → 0x318f61c  eor w8, w21, w22 ; 相等才跳
  0x3183688  tbz  w25, #0, #0x3184684                              ; (w21^R)==0 → 跳 pd[0]
  ```
  ⇒ 正常游玩：`CondType.IsRouteSelect(quest,route)` 真 → `branchRouteSelect` 跳；collection 且该任务允许 material play 时仍用 IsRouteSelect；否则（collection 且不允许）改用 `MaterialBranchRouteManager.IsMaterialSelectedRouteId`。
- 后端 API 地图：
  - `CondType$$IsRouteSelect(int questId, int routeId) @0x2D72F88`；IList 重载 `@0x2D80EF4` 内部逐 route 调 `UserQuestRouteMaster$$haveRouteId @0x302B64C`（**用户数据源**：`UserQuestRouteEntity{userId,questId,routeId}` / `UserQuestRouteMaster.TryGetEntity`，dump.cs:134806 起）。
  - `MaterialBranchRouteManager$$IsMaterialSelectedRouteId @0x307AF34`（素材回放时选择的路线，带独立存储）。
  - `QuestPhaseMaster$$IsEnableMaterialPlayUseUserQuestRoute @0x2F9B260`。
- 资源：无。
- 语料：`branchRouteSelect` **18**、`branchNotRouteSelect` **14**；形态 `[branchRouteSelect select_branch_01 4000517 4000574]`、`[branchNotRouteSelect battle_select_lose 05000105 1000]`。
- 阅读器补齐要点：注入 `gameState.routeSelected(questId, routeId): boolean`（对应 haveRouteId）；未注入 → false（正/反分支按默认走 Not 侧，并 diagnostics）。collection 双路径可用同一 provider 表达（`routeSelected` 由调用方实现两者之一）；不要把 4000517 当 route、4000574 当 quest（顺序实测：pd[2]=quest、pd[4]=route）。
- 置信度：high（两条判定链/参数序实测）。未决项：`MaterialBranchRouteManager` 的持久化位置（用户数据 or PlayerPrefs）未展开（INFERRED：用户侧存储）。

### `branchRouteSelectCount` / `branchNotRouteSelectCount`（共享体 `0x317c85c`）

- handler：`0x317c85c`（两 tag 共体；tag 二次派发 `0x318dc38 &'branchRouteSelectCount'`）。
- 参数消费：min 9（5 值 `label count op questList routeList`）：`pd[2]→Int32 0x317c904`（数量）、`pd[4]→Enum.Parse(CondType.CheckType) 0x317c978`、pd[6..] 逗号分隔任务列表（`,` 是独立 pd 元素；逐项 `GetQuestId @0x317ca60`）、pd[8..] 逗号分隔路线列表（`0x318db7c` 起的第二个循环）。列表用一个 `List<int>` 装载（`List<int>.ctor 0x44ab170`）。
- 行为：汇总判定 + 比较：
  ```
  0x318dc5c  ldr      w21, [sp, #0x38]         ; count
  0x318dc60  ldr      w24, [sp, #0x30]         ; CheckType
  0x318dc7c  bl       #0x2d80ef4  CALL CondType$$IsRouteSelect   ; (questIds, routeIds, count, checkType, null)
  0x2d81340  bl       #0x302b64c  CALL UserQuestRouteMaster$$haveRouteId   ; 循环内逐 route
  ```
  `CondType.IsRouteSelect(IList<int> questIds, IList<int> routeIds, int count, CheckType, HashSet addCheckedRoute)` 语义 = 去重统计「已选路线命中数」，按 CheckType 与 count 比较（`GetCompareCheckType`：EQUAL=0→==、BELOW=1→<=、ABOVE=2→>=，见下 §`branchSetGrandSvtCount` 的实证）。
- 后端 API 地图：同 route select 两条（`UserQuestRouteMaster.haveRouteId @0x302B64C`、`CondType.IsRouteSelect(IList) @0x2D80EF4`）。
- 资源：无。
- 语料：`branchRouteSelectCount` **22**、`branchNotRouteSelectCount` **0**；形态 `[branchRouteSelectCount truthflag1 2 EQUAL 3000910,3000919 2030,2060]`、`... 2 ABOVE …`。
- 阅读器补齐要点：注入 `gameState.routeSelectCount?(questIds, routeIds, count, op)`；未注入 → 用 routeSelected 逐个求值按 op 比较（可在本地实现 EQUAL/BELOW/ABOVE 三态，跨列表按去重计数），count 缺省 0 结果必 false → 安全不跳。compiler 已解析 `params[0]` 标签（零成本）。
- 置信度：high（列表解析/调用/去重 HashSet 实测）。未决项：CheckType 的 BELOW/ABOVE 在 IList 重载内部的确切方向按 `GetCompareCheckType` 直读（(condValue, compValue) 顺序与脚本参数序一致，见下）。

### `branchSetGrandSvtCount`

- handler：`0x317e20c`（**独立 handler**，非共享体）。
- 参数消费：min 5（3 值 `label count op`），pd[1]/pd[3]==' ' 守卫；`pd[2]→Int32 0x317e288`、`pd[4]→Enum.Parse 0x317e2fc`（CheckType）。
- 行为（**不写任何字段**；名字里的「Set」不准确）：
  ```
  0x317e338  bl   #0x304155c  CALL UserServantGrandMaster$$GetUserServantEntities
  0x317e348  bl   #0x38ae6f4  CALL System.Linq.Enumerable$$Count          ; 冠位编成从者数 → w24
  0x317e390  bl   #0x2d6c3e4  CALL CondType$$GetCompareCheckType          ; (checkType=pd[4], cond=pd[2], comp=count)
  0x317e394  tbnz w0, #0, #0x3184684                                       ; true → JumpScript(pd[0])
  0x317e398  b    #0x3193f00                                               ; false → Normal
  ```
  `GetCompareCheckType(checkType, a(w1), b(w2))` 实证（`0x2D6C3E4`）：`cmp w20,w19` → EQUAL(0): `a==b`；BELOW(1): `a<=b`；ABOVE(2): `a>=b`（`0x2d6c448/0x2d6c470/0x2d6c494`）。调用处 w1=pd[2]（脚本值）、w2=count（真实数）。⇒ `[branchSetGrandSvtCount lbl 1 ABOVE]` = 1 ≥ 冠位数 时跳。
- 后端 API 地图：`UserServantGrandMaster$$GetUserServantEntities @0x304155C`（`UserServantGrandMaster : DataMasterBase<UserServantGrandEntity,…>`，dump.cs:136300 区）；`Enumerable$$Count @0x38AE6F4`；`CondType$$GetCompareCheckType @0x2D6C3E4`。
- 资源：无。
- 语料：**2** 次，恒为 `[branchSetGrandSvtCount lblSetGrandSvt 1 ABOVE]`。
- 阅读器补齐要点：注入 `gameState.grandSvtCount?: number`（没有用户存档时不可得）；未注入 → **不跳**（ABOVE/EQUAL 对 0 的默认 false 不安全：`0 ABOVE` 会真——因此未注入时应直接按「条件不可判定 → 不跳 + diagnostics」，与 branchQuestClear 未知的一致处理）；比较严格按 (scriptValue op actualCount)。
- 置信度：high（计数源/比较函数实测）。未决项：无（注意与素材/路线不同，这里是**计数器比较**而非状态写入）。

### 与已实现 `branchQuestClear/branchQuestNotClear` 的异同（复用性）

- 相同点：同为「(tag=='正') vs 真实状态」的异或比较 + 相等跳 `0x3184684`；跳转目标都是 pd[0]；返回码都是 Normal。`branchQuestClear` handler `0x317bdd0`：`pd[2]→GetQuestId 0x317be24`、`pd[4]→Int32 0x317be74`（阶段），判定走 `CondType$$IsQuestPhaseClear @0x2D70AD8`（`0x318a420`）。
- 阅读器侧可 100% 复用现有接口模式（`options.questClear` + `instruction.targetIndex` + `this.jump`）：新增的只是**更多状态谓词**。建议把 `ExecutorOptions` 扩展为：
  ```ts
  interface GameStateProvider {
    isCollection?: boolean;                       // branchMaterial/Not
    routeSelected?(questId: number, routeId: number): boolean;      // branchRouteSelect/Not（haveRouteId）
    routeSelectCount?(questIds: number[], routeIds: number[], count: number, op: "EQUAL"|"BELOW"|"ABOVE"): boolean;
    svtEquipHaving?(equipId: number): boolean;    // branchHaveSvtEquip/Not
    grandSvtCount?: number;                       // branchSetGrandSvtCount
  }
  ```
  并入 `ExecutorOptions.gameState?`，保留 `questClear` 兼容。
- 数据源说明（供实现者导出）：路线 = 用户数据 `UserQuestRouteEntity`（存档可见）；任务通关 = UserQuestMaster/clsQuestCheck；礼装 = `CondType.IsOpen` 内部查持有的 `UserServantEntity`；冠位数 = `UserServantGrandEntity` 列表。阅读器可从「用户导入的账号数据/手工配置 JSON」注入；无数据时统一「不可判定 → 走 Not 侧（正分支不跳）+ 诊断」。

### 本组小结（分支 9 条）

- **缺口分类**：a) 纯逻辑缺口：全部 9 条的**求值框架与跳转接线**（compiler 已解析 branch* 标签；只差 case 分支）。c) 需游戏数据源：路线（任务×路线集合）、礼装持有、冠位计数、isCollection 语义——需要可配置状态注入（JSON/回调）。b) 无需原始资源。
- **最小可交付实现**：9 条全部落 `executor.ts` 分支组；`gameState` 可空；不可判定 = Not 侧 + 一次 diagnostics；`branchMaterial` 用 `collectionMode`（默认 false）。
- **升级路径**：① 提供「存档导入」把 `UserQuestRouteEntity/questClear/SvtEquip` 解析为 provider；② `branchRouteSelectCount` 本地实现列表去重计数即可脱离 provider 半精度运行（只要 routeSelected 可用）；③ 与选项块（saveMaterial）联动时可把 material 消耗做成显式状态。

---

## 组 3. 随机旗标(1)

### `flagRandom`

- handler：`0x3184ed4`（len 必须 **恰为 5**（3 值 `flag ss es`）；`0x3184ee0 cmp w9,#5; b.ne 0x3193e80`，pd[1]/pd[3]==' ' 守卫）。
- 参数消费：`pd[0]→ScriptManager$$SearchFlag 0x3184f50`（flag 对象）；`pd[2]→x1、pd[4]→x2` → `ScriptFlagData$$SetRahdom @0x3171A64`（`0x3184f80`）；flag 不存在（null）→ 跳过返回 Normal。
- 行为（随机值来源 = **UnityEngine.Random**，非自实现；写入 flag.v）：
  ```
  0x3171a74  bl   #0x31718a4  CALL ScriptFlagData$$Conv      ; ss → int（"true"/"on"→1、"false"/"off"→0、否则数字解析）
  0x3171a80  bl   #0x31718a4  CALL ScriptFlagData$$Conv      ; es → int
  0x3171a90  add  w1, w19, #1                               ; max = es+1
  0x3171a94  bl   #0x4fcbde8  CALL UnityEngine.Random$$Range ; Range(int minInclusive, int maxExclusive)
  0x3171a9c  cmp  x19, w0, sxtw
  0x3171aa0  csel x8, x19, x8, lt                            ; 保险夹 upper
  0x3171aa4  str  x8, [x20, #0x18]                           ; ScriptFlagData.v = 随机值
  ```
  ⇒ 语义 = `flag = Random.Range(Conv(pd[2]), Conv(pd[4])+1)`，即 [ss, es] 闭区间随机整数。
- 种子与恢复语义：
  - **随机源是 Unity 全局 Random，不随存档序列化**；每次执行到本行都会重掷。
  - **存档的是 flag 值本身**：`ScriptManager$$SaveFlagInfo @0x31C8044` 用 `UnityEngine.PlayerPrefs$$GetString @0x4FCB15C` 读 JSON 字典、`ScriptFlagData$$Comp()` 取值、`JsonManager$$toJson` 回写（`0x31c8170/0x31c81d0`）；读回 `LoadFlagInfo @0x31A2FD4`。⇒ 跨脚本/跨继续用 flag 值恢复，而随机状态本身丢失。
- 后端 API 地图：`UnityEngine.Random$$Range(int,int) @0x4FCBDE8`；`ScriptFlagData$$Conv @0x31718A4`；`ScriptFlagData$$SetRahdom @0x3171A64`；字段 `ScriptFlagData.v 0x18`（与 `Set(long)`、`Comp()` 同一存储）。
- 资源：无。
- 语料：**0 次**（`flag` 命令 159 次，无 flagRandom；语料未覆盖）。
- 阅读器补齐要点（当前 `executor.ts:270` 是 `unsupported`）：
  1. 本地实现：`const lo=Number(p[1]??0), hi=Number(p[2]??lo); const v=lo+Math.floor(rand()*(hi-lo+1)); this.flags.set(p[0], String(v));`
  2. 随机源两种策略二选一（推荐后者）：
     - localStorage 持久种子：`seed = Number(localStorage['fgo:rngSeed'] ?? (Date.now()^...))`，用 mulberry32/xorshift 独立流；不污染其它随机（对应引擎独立于脚本逻辑）。
     - **回放轨迹内记录掷出值**（推荐）：把 `{flag, value}` 追加进 `decisions` 类轨迹，撤销/前进/从存档恢复时读轨迹复现——与引擎「存档含 flag 值、不含种子」的性质一致。
  3. `flags` 已是 `Map<string,string>`，与 `[branch]`/`[flag]` 天然衔接（数值存字符串，`[branch f 3]` 比较用字符串相等——与引擎 `ScriptFlagData.Comp(string)` 的整数比较存在差异：本命令产出数字，建议 branch 比较时对纯数字串做数值比较或在 flagRandom 侧只存字符串并保持现状，标为已知近似）。
- 置信度：handler/随机源/字段写 high。未决项：无（语料 0 次，无法对拍数值分布）。

### 本组小结（flagRandom 1 条）

- **缺口分类**：a) 纯逻辑缺口（行为可完全本地实现）；无资源/无游戏数据源依赖。
- **最小可交付实现**：如上 3 行代码 + 轨迹记录；把 `unsupported` 换成实现。
- **升级路径**：把随机掷值纳入既有 `ChoiceDecision` 式回放轨迹，保证「回退/继续」可复现；若未来做「同一存档重放一致性」测试，再加种子导出。

---

## 组 4. 游戏流程及名字宽度判断(4)

成员（4 条）：`masterNameWidth`、`questMessageOverwrite`、`revivalBranch`、`rewardSwitch`。

语料计数：`masterNameWidth` **1**；`questMessageOverwrite`/`revivalBranch`/`rewardSwitch` **均 0**（全语料无出现，仅名录保留）。

### `masterNameWidth`

- handler：`0x3185be0`（min 7=4 值；pd[1]/pd[3]/pd[5]==' ' 守卫）。
- 参数消费：`pd[0]`=字号名（喂 `ScriptMessageLabel$$GetFontSize @0x31D271C`，读取器有对应 `FONT_SIZES`）、`pd[2]→Int32::Parse 0x3185c90`（宽度阈值 px）、`pd[4]`=「小于阈值」跳转标签（`0x318fe1c → 0x3191874/0x3190760 → JumpScript`）、`pd[6]`=「不小于」跳转标签（`0x3191860 → 0x3190760 → JumpScript`）。
- 行为（测量的是**主人公名字**，不是 pd[0] 字面量）：
  ```
  0x3185cb4  mov      w0, #1
  0x3185cbc  bl       #0x31d0d0c  CALL ScriptReplaceString$$GetString        ; Index.USER_NAME=1 → 玩家名
  0x3185cec  bl       #0x2e5bb7c  CALL LocalizationManager$$ReplaceNameTag
  0x3185d28  bl       #0x31d271c  CALL ScriptMessageLabel$$GetFontSize       ; pd[0]="large" → 48
  0x3185d40  bl       #0x31d544c  CALL ScriptMessageCommonManager$$CreateLabel
  0x3185d7c  bl       #0x3627d4c  CALL UILabel$$set_fontSize
  0x3185d8c  bl       #0x3625460  CALL UILabel$$set_text                     ; 临时标签测量
  0x3185d90  ldr      w24, [x22, #0xa8]         ; UIWidget.mWidth（测量值）
  0x3185dc8  bl       #0x4fda4d8  CALL UnityEngine.Object$$Destroy           ; 销毁临时标签
  0x3185dd0  cmp      w24, w21 ; 0x3185dd4 b.ge #0x3191860               ; 测量宽 ≥ 阈值 → pd[6]；否则 → 0x318fe1c(pd[4])
  ```
- 后端 API 地图：`ScriptReplaceString$$GetString(Index.USER_NAME=1) @0x31D0D0C`（枚举 `ScriptReplaceString.Index { USER_NAME = 1 }`，dump.cs）；`LocalizationManager$$ReplaceNameTag @0x2E5BB7C`；`ScriptMessageLabel$$GetFontSize(string,int) @0x31D271C`；`ScriptMessageCommonManager$$CreateLabel @0x31D544C`；`UIWidget.mWidth 0xA8`。
- 资源：需字体/字号表（游戏内 master 名标签 prefab），无外部文件。
- 语料：唯一 1 处 `scripts/Lostbelt No7…/0300131040.txt:59`：
  ```
  [masterNameWidth large 339 _Name339Less _Name339Over]
  [label _Name339Less]      ← 紧邻下一行（正常分支）
  ```
  （该脚本按名宽 ≥339 时走 `_Name339Over` 的"滚动提示"版本）。
- 阅读器补齐要点（**属本地实现缺口**）：
  1. compiler：该 tag 不匹配现有 `/^(?:branch|jump|masterBranch)/`，需按 tag 特例把 `params[2]`/`params[3]` 解析成**两个** targetIndex（现 `Instruction` 只有 1 个 `targetIndex`；建议加 `targetList?: [number,number]` 或复用 if/else 帧式字段），并在 `executor.ts` 新增 case：宽<阈值 → jump(list[0])，否则 jump(list[1])。
  2. 宽度测量：`canvas.measureText(options.masterName)`，字体取 `FONT_SIZES[p[0]] ?? 29`；NGUI mWidth 与浏览器 px 存在缩放差（**INFERRED**），建议做「阈值 × 比例系数」可配置（默认 1.0），并在 1 个样本上校准（`large`=48、阈值 339）。
  3. 名字替换：与现有 `masterName` 选项一致；`ReplaceNameTag` 的 `<NAME>` 类标签直接以 `masterName` 代入即可。
- 置信度：handler/流程 high；宽度单位换算 medium（INFERRED）。未决项：NGUI `mWidth` 的像素基准与 web 排版 scale 的精确对应。

### `questMessageOverwrite`

- handler：`0x317d710`（len 只接受 1 或 2；len==0 或 ≥3 写 `'parameter error'` 后仍继续）。
- 参数消费：`pd[0]` 作为键后缀，前缀常量 `'QuestMessageAdd'`：`0x317d764 String.Concat('QuestMessageAdd', pd[0])`（字面量槽 `0x317d758 &'QuestMessageAdd'`）。
- 行为：查覆盖文本表 → 非空则写入任务消息字段：
  ```
  0x317d764  bl   #0x4867ef8  CALL System.String$$Concat                ; key = "QuestMessageAdd"+pd[0]
  0x317d79c  ldr  w2, [x8, #0xd4]                                        ; questId（来源对象见下）
  0x317d7a0  bl   #0x31a7e74  CALL ScriptManager$$GetOverwriteText       ; (label, questId) → 文本
  0x317d7ac  bl   #0x4871c3c  CALL System.String$$IsNullOrEmpty           ; 空 → Normal（不改写）
  0x317d7cc  ldr  x0, [x0, #0xb8]                                        ; 取目标对象
  0x317d7d4  str  x19, [x0, #0xf8]!                                      ; 写入 +0xf8（任务消息文本字段）
  ```
  `GetOverwriteText @0x31A7E74` 内部：`ScriptManager$$GetKey @0x3199EAC` → `AssetData$$GetDecryptObjectText @0x2D9E830` —— 即覆盖文本来自**加密的任务文本资产**（按 questId+label 定位），不是 master 静态表。
- 后端 API 地图：`ScriptManager$$GetOverwriteText(string,int) @0x31A7E74`；`ScriptManager$$GetKey @0x3199EAC`；`AssetData$$GetDecryptObjectText @0x2D9E830`；常量 `QUEST_MESSAGE_ADD = "QuestMessageAdd"`（class 常量区）；宿主对象 +0xd4(questId)/+0xf8(文本) 与 §`revivalBranch` 同一对象（其 +0xd0 是续关计数）——对象身份**INFERRED**（未逐字解析单例槽 `0x557a000+0xc8`）。
- 资源：加密文本资产（`GetKey`/`GetDecryptObjectText`），文件名 = `QuestMessageAdd<label>`。
- 语料：**0 次**。
- 阅读器补齐要点：`options.questMessageOverwrite?(key: string): string | undefined` 注入（key=label）；命中且非空 → 覆盖消息窗标题/引言（阅读器消息目录的 quest 消息位）；未注入 → **no-op**（与引擎空文本早退一致），记 diagnostics 一次。需要游戏数据源（c）。
- 置信度：handler/键拼接/调用链 high；宿主对象身份与文本资产格式 medium/INFERRED。未决项：`GetDecryptObjectText` 的资产格式与磁盘位置。

### `revivalBranch`

- handler：`0x31853a4`（min 3=2 值；pd[1]==' ' 守卫）。
- 参数消费：全部是标签（字符串，进 `JumpScript(ConvertNameString(pd[k]))`），无数值。
- 行为（三分支；`0x319075c`=跳 pd[0]、`0x3191f44`=跳 pd[2]、`0x318f2f8`=跳 pd[4]）：
  ```
  0x31853d8  ldrb     w8, [x19, #0x371]         ; isCollection
  0x31853dc  cbz      w8, #0x318ebd0
  0x31853ec  cmp      w9, #5
  0x31853f0  b.ge     #0x318f2f8              ; collection 且 len≥5（3值）→ 跳 pd[4]
  0x31853f4  cbnz     w9, #0x319075c          ; collection 且 len<5 → 跳 pd[0]
  --- 非 collection ---
  0x318ebd0  ldrb     w8, [x19, #0x374]         ; isRevival（私有 bool）
  0x318ebd4  cbz      w8, #0x3190c9c
  0x318ebe4  cmp      w9, #2 ; b.hi #0x3191f44  ; isRevival 且 len>2 → 跳 pd[2]
  --- isRevival==false 或续关计数/事件判定 ---
  0x3190cc0  ldr      w21, [x8, #0xd0]         ; 续关计数（同一宿主对象）
  0x3190d20  bl       #0x2f8d1d0  CALL QuestGroupMaster$$GetEventId
  0x3190d80  bl       #0x2f0a578  CALL EventDetailEntity$$IsRevivalEvent
  0x3190d88  strb     w9, [x19, #0x374]        ; isRevival := IsRevivalEvent()
  0x3191f28  ldrb     w9, [x19, #0x374] ; cbz w9, #0x31929f8 ; 最后 not-revival → 跳 pd[0]
  ```
  ⇒ 语义：collection → pd[0]/pd[4]；正常游玩：isRevival（含按事件数据计算）→ pd[2]，否则 → pd[0]。
- 后端 API 地图：`ScriptManager.isRevival(0x374)`、`isCollection(0x371)`；`EventDetailEntity$$IsRevivalEvent @0x2F0A578`；`QuestGroupMaster$$GetEventId @0x2F8D1D0`；续关计数对象 +0xd0（宿主与 questMessageOverwrite 同）。
- 资源：无（事件表来自 master 数据）。
- 语料：**0 次**。
- 阅读器补齐要点：`options.gameState.isRevival` / `collectionMode`；**阅读器值序 p[k]=引擎 pd[2k]**：正常游玩 isRevival → 跳 `p[1]`（引擎 pd[2]），否则 → `p[0]`；collection 3 值 → `p[2]`（引擎 pd[4]），2 值 → `p[0]`。未注入 → 走 `p[0]`（非 revival 默认），记 diagnostics。compiler 需扩展标签正则（`revivalBranch` 不以 "branch" 开头）：改为 `/^(?:branch|jump|masterBranch|revivalBranch)/` 或用 `endsWith("Branch")`。
- 置信度：跳转结构 high；「续关计数+事件表」中层逻辑 high（调用实测）。未决项：+0xd0 宿主对象身份（INFERRED）。

### `rewardSwitch`

- handler：`0x318522c`（len 只接受 1；len==0 或 ≥2 写 `'parameter error'` 后继续）。
- 参数消费：`pd[0]` 字符串 `'true'/'false'`（`0x3185284 op_Equality 'true'`；否则 `0x318a204 op_Equality 'false'`）。
- 行为：写 `ScriptManager.isGetReward(0x758)`：
  ```
  0x3185284  bl   #0x4870cc0  CALL System.String$$op_Equality   args: x1='true'
  0x3185290  mov  w24, wzr
  0x3185294  strb w8(=1), [x19, #0x758]           ; isGetReward := true
  0x318a214  strb wzr, [x19, #0x758]              ; 'false' → isGetReward := false
  ```
  其它字符串 → 不写、返回 Normal（**无参数校验错误**）。
- 后端 API 地图：字段 `isGetReward 0x758` 与 `onEndRewardSwitchScript: Action<bool> 0x750`（由 `ScriptManager$$PlayShopRewardSwitch @0x3196D48` 注入，调用者 `EventRewardRootComponent$$OnEndDialogRequestValentineShop @0x2549124`——情人节赠礼流程）；`SetOnEndRewardSwitchScript @0x31A3A08`。回调消费点未逐字定位（**INFERRED**：事件界面在脚本结束读取 isGetReward 决定是否发放）。
- 资源：无（UI 由事件界面负责；本命令只是状态开关）。
- 语料：**0 次**。
- 阅读器补齐要点：纯逻辑缺口：实现为设置 `flags`/`rewardGot` 状态即可（`this.rewardSwitch = p[0]==='true'` 等），或至少 no-op 不报 unsupported；事件界面（赠礼弹窗）属阅读器外的**游戏流程缺口**，无原始 UI 时不必复刻，保持状态供未来扩展。
- 置信度：handler/字段写 high；回调消费 medium/INFERRED。未决项：`onEndRewardSwitchScript.Invoke` 的调用点。

### 本组小结（flow 4 条）

- **缺口分类**：
  - a) 纯逻辑缺口：`masterNameWidth`（本地测量即可）、`revivalBranch`（isRevival/collection 两个开关）、`rewardSwitch`（状态位）。
  - b) 需原始资源：无（masterNameWidth 只依赖字体；游戏内 prefab 不影响判定）。
  - c) 需游戏数据源：`questMessageOverwrite`（加密任务文本资产）；`revivalBranch` 的 `isRevival`（事件 master/存档）；`masterNameWidth` 的 NGUI 像素基准（可校准，不阻塞）。
- **最小可交付实现**：
  1. compiler 扩展标签域（`revivalBranch`、`masterNameWidth` 双标签）；
  2. `masterNameWidth` 用 `canvas.measureText(masterName)` + 可配置比例系数；
  3. `revivalBranch` 用两个布尔（默认 collection=false、isRevival=false → 跳 p[0]）；
  4. `rewardSwitch` 写状态位；`questMessageOverwrite` 接可选注入，缺省 no-op。
- **升级路径**：任务文本覆盖接「解包任务文本 → 注入 map」；名字宽度用真实排版引擎（与消息窗同字体）在 1 个样本上校准后固定系数；若阅读器未来做「奖励发放」交互，再把 `rewardSwitch` 状态接到事件 UI 模拟。

---

## 附：本文件涉及的全部关键 VA 索引

| 主题 | VA | 说明 |
|---|---|---|
| cueSe handler | `0x3186434` | 共享尾 `0x318fdc8`/`0x3186594` |
| cueSeStop | `0x3188bb0` | 尾 `0x318bd58`，与 seStop 共体 |
| cueSeVolume | `0x318440c` | `SoundManager.changeVolumeSe @0x2E9AAB8` |
| cueSeContinue | `0x317ffa4` | `CheckSameIdSeContinue @0x31B4D08`；字典 Add 尾 `0x319180c` |
| cueSeContinueStop | `0x31838c8` | 与 seContinueStop 共体 |
| cueSeContinueVolume | `0x3188898` | 与 seContinueVolume 共体 |
| cueVoice / Stop / Volume | `0x317cef8` / `0x3179ed0` / `0x317b954` | playCharaVoice `0x2E9B3D0`/`0x2E9B304`、stopVoice `0x2E9AF94`、changeVolumeVoice `0x2E9B0C0` |
| keepSubBgmOn/Off | `0x3181fd4` / `0x31797d0` | `Enable_KeepSubBgm @0x2E45D20`（计数器 0x48）；读 `IsKeepSubBgm @0x2E454C8`；复位 `0x31B4710` |
| CRI 链 | `0x2E8036C`/`0x2E8041C`/`0x2E800D4`/`0x2E80178` → `0x2E7FFC8` → `0x2E94624` → `0x2E94784` → `0x2346D6C` → `0x2340EF0`/`0x235CEDC` | PlaySe/PlaySeContinue 重载 → SeManager → SePlayer → CriAtomSource → SetCue |
| CPK/cue sheet | `0x2E992C4` / `0x2E9E61C` / `0x2E9E63C` | `CriAtom.AddCueSheet`（常驻/CPK） |
| branchMaterial/Not | `0x31802B0` | isCollection(0x371) 比较；跳 `0x3184684` |
| branchHaveSvtEquip/Not | `0x318459C` | `CondType.IsOpen(8/0x28) @0x2D6C594` |
| branchRouteSelect/Not | `0x31834E4` | `IsRouteSelect @0x2D72F88`；`IsMaterialSelectedRouteId @0x307AF34`；`IsEnableMaterialPlayUseUserQuestRoute @0x2F9B260` |
| branchRouteSelectCount/Not | `0x317C85C` | `IsRouteSelect(IList) @0x2D80EF4`；`haveRouteId @0x302B64C` |
| branchSetGrandSvtCount | `0x317E20C` | `GetUserServantEntities @0x304155C`；`GetCompareCheckType @0x2D6C3E4` |
| 分支跳转基座 | `0x319075C` → `JumpScript @0x31A8488` | 不跳 = `0x3193F00` Normal |
| flagRandom | `0x3184ED4` | `SetRahdom @0x3171A64`；`Random.Range @0x4FCBDE8`；flag.v 0x18 |
| flag 持久化 | `0x31C8044`/`0x31A2FD4` | PlayerPrefs JSON |
| masterNameWidth | `0x3185BE0` | `GetString(USER_NAME=1) @0x31D0D0C`；`GetFontSize @0x31D271C`；UILabel.mWidth 0xA8 |
| questMessageOverwrite | `0x317D710` | `Concat('QuestMessageAdd',pd0) 0x317D764`；`GetOverwriteText @0x31A7E74` |
| revivalBranch | `0x31853A4` | isCollection 0x371 / isRevival 0x374；`IsRevivalEvent @0x2F0A578` |
| rewardSwitch | `0x318522C` | `isGetReward 0x758`；`PlayShopRewardSwitch @0x3196D48` |

> 全部 VA 均来自本次实际反汇编/类体 dump；语料统计来自 `tag_counts.json` 与 `scripts/**` 实测。未逐字确认的推断均已在正文标 INFERRED。

# FGO 2.139.3 非表现类脚本命令参数表（音频 / 消息窗 / 流程状态）

对象：`com.aniplex.fategrandorder` 2.139.3（arm64-v8a，IL2CPP）。
位置字段 `pd[i]` 指 `ScriptCommandExecute`(VA `0x3177290`) 中 `pd` 字符串数组的下标；
所有证据行号均可在 `out/_evidence/` 下的反汇编文件中复查（见文末）。
置信度：`high`=有直接 API 实参名证据；`medium`=由实参顺序/转换函数推断；`low`=仅定位到读取点，语义未闭环。

---

## 0. 共享约定

1. **下标布局**：参数数组 pd 由 ScriptManager.AnalysParam 切分：偶数下标=值，奇数下标=分隔符（' ' / ',' / '='）。第 k 个值在 pd[2k]。
2. **最少元素数**：处理块开头 `ldr wK,[pd,#0x18]; cmp wK,#N` 是最少元素数检查（commands.json.min_token_count）。
3. **省略参数**：可选值由 `pd[2k-1] == " "`（String::op_Equality）守卫；单空格字符串作为值表示‘省略/默认’。
4. **布尔字面量**：布尔参数是字符串 'true'/'false'（个别为 'on'/'off'、'allFalse'），用 String.op_Equality 比较。
5. **哨兵 `-`**：'-' 作为数值参数时表示 -1.0（betweenHeight 0x3184754、speed 0x3184a80：比较后直接 fmov s8,#-1.0）。
6. **`,` 与 `=`**：',' 也是合法分隔符（messageShake pd5==',' 0x318d474）；menu 用 '=' 连接 key/value（pd0=='=' 0x317fb3c）。
7. **返回码**：0x3193f00 = Normal(0)；0x3193f04 = Continue(1)（把行交给消息系统/需要点击推进）；0x3188c6c = ReturnFalse(2)；0x3193e80 = 参数错误（写入 'parameter error' 到 scriptErrorMessage 后返回 Normal）。
8. **等待字段**：等待状态字段：state(0x288=State.WAIT=4)、waitType(0x3d8)、waitIndex(0x3e0)、waitCount(0x3e4)、waitName(0x3e8)、waitMessage(0x3f8)、waitTime(0x400)。

### 0.1 `wait` / `tdelay` 的 pd[0] 子命令表

wait 的 pd[0] 是 72 个关键字的哈希树（根 0x318753c，x22=pd[0]）；12 个纯等待键 + 60 个命令名（等该命令/动画完成）。完整表在 out/_evidence/wait_keys.json。

**12 个纯等待关键字**（及其取值语义）：

| 关键字 | pd[2] 语义 | 证据 |
|---|---|---|
| `time` / `skippableTime` | 秒（float）；0 → 改读 pd[2] 为‘名称’等待 | `0x319373c` / `0x3193790` / `0x3193854` |
| `frame` | 帧（float） | `0x31937f0`（与 time 同构） |
| `rtime` | 真实时间（秒） | `0x318d910` 节点 → 与 time 同体 |
| `charaCut` / `charaCutStart` | 角色槽号（ConvertCharaIndex，源自 pd[2]） | `0x3193080` / `0x31930ec` |
| `charaFade` | 角色槽号 | `0x3193710` → 共享体 `0x31938c8` |
| `communicatioChara` | 角色槽号 | `0x3190780` → `0x31937xx` |
| `effectmessage` / `effectmessageStart` | 对话特效名（ConvertTalkEffectName→waitName） | `0x3193520` / `0x3193570` |
| `fastPlayDraw` | 等待 fastPlay 绘制完成（pd.Length≥3 且 pd[1]==' '） | `0x31935c8` |
| `fsmObjFinished` | 等待 FSM 对象结束 | `0x318d920` |
| `masterverticalImageSet` | 等待垂直立绘设置完成 | `0x318d97c` |

其余 60 个是**命令名**（如 `charaMoveEase`/`charaMoveFSL`/`effectmessageStart`/`insertionAnimationStart` 等），
语义为「等待该命令/动画完成」；共用体验证 pd.Length≥3、pd[1]==' '、pd[2]→`ConvertCharaIndex`（角色槽），pd[4]=int（`0x31938c8`/`0x31939c8`）。
完整 72 键清单（含每个键的节点地址与分支条件）：`out/_evidence/wait_keys.json`。

### 0.2 延迟/自动等待时间模型（`ScriptCommandDelayParam`）

- 结构：ScriptCommandDelayParam{executeIndex:int, executeIndexMax:int, delaySecond:float, skipDropFlag:bool, messageFlag:bool, checkTextSpeed:bool}（构造签名 index,indexMax,second,sflag,mflag,cflag @0x3170f44）
- 命令：delay/tdelay：index=pd[0]，indexMax=GetNextDelayEnd(当前行)（向前扫描 'delayEnd' 标签 0x31b2710），second=pd[2]，sflag=(pd[4]==0)，mflag=IsMessageLine(当前行)，cflag=(tag!='tdelay')；随后 TDelayJumpScript(indexMax+1) 跳到 delayEnd 之后。
- 推进：UpdateDelayScript(delta) 0x31b576c：checkTextSpeed 且非 messageFlag 时按 GetTextSpeed() 缩放 delta，否则用原始 delta；delaySecond 递减到 0 后 ProcessDelayScript 执行区间。
- 停止：DelayStop(index, skipFlag) 0x31c5ab4：skipFlag==1 强制中断；delayStop 命令传 2。
- `delayEnd`：delayEnd 在本版本是空体（0x3182018），仅作为标签被 GetNextDelayEnd 使用。
- **自动播放**：GetAutoWaitTime(charCount) 0x31b2038 = autoWaitTime(0x6f8) + scenarioTextWaitTimeSecond(0x720) * charCount / GetTextSpeed()。
- 不计入自动等待的行：CheckNotSetAutoWaitCommand 0x31b1eac：命令名数组里任一命令用 String::Contains 命中则返回 false（该行不计入自动等待）。
- 设点：SetAutoWait(stringData) 0x31b1974：先看 autoWaitTime(0x6f8)>0 且 scenarioTextWaitTimeSecond(0x720) 之类；用正则匹配 setAutoWaitTarget；再由 CheckNotSetAutoWaitCommand(notSetAutoWaitCommands, line) 决定该行是否参与计数。

### 0.3 音量类实参顺序（重要）

注意：seVolume/seContinue/voiceVolume/cueSeContinue 的 pd[2] 是渐变时间(fadeTime)、pd[4] 才是音量 volume（实参 s0/s1 顺序已核对）。

---

## 音频

### `bgm`

- handler: `0x31824fc`；BGM 播放。带可选音量；由 tag 决定主 BGM(subBgm 走 SubBgmPlayArgs+BgmManager.PlaySubBgm)。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | BGM 名（字符串名，可被 ConvertNameString 改写成资源名） | string | 资源名 | high | `0x318251c ConvertNameString;0x3189608 SubBgmPlayArgs..ctor;0x318962c PlaySubBgm` |
| 2 | 音量(volume)；省略时按 0（默认音量）处理 | float | 0.0–1.0（0=默认） | medium | `0x31893f8 Single::Parse;s0→ctor 的 volume 参数 0x3189608` |

  - ⚠ 未知/存疑：pd[2] 为 0 时是‘默认音量’还是‘静音’未区分（SubBgmPlayArgs 的 volume 是 Nullable<float>，需要看 PlaySubBgm 内部）

### `subBgm`

- handler: `0x31824fc`；副 BGM（sub 通道）播放，与 bgm 共用函数体，运行时按 tag 分支。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | BGM 名 | string | 资源名 | high | `0x318251c;0x31895d4 tag=='subBgm'` |
| 2 | 音量；0=默认 | float | 0.0–1.0 | medium | `0x31893f8` |

### `bgmStop`

- handler: `0x3181900`；停止 BGM（bgmStop/bgmStopEnd/subBgmStop 共用体，内部按 tag 分派）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | BGM 名；` ` (单空格)=省略（用当前 BGM/默认目标） | string | 资源名 / ` ` | medium | `0x3189674 pd[2]→Single 之前的 pd[0];0x31896c8 StopSubBgm(name)` |

  - ⚠ 未知/存疑：参数个数与 tag 分支的组合未逐条跟完（共有 3 个 tag 别名）

### `bgmStopEnd`

- handler: `0x3181900`；BGM 停止（结束段）：与 bgmStop 共用体，语义为‘到脚本结束时再停’。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | BGM 名 / ` ` | string | 资源名 / ` ` | low | `0x3181900 共用体;0x3189708 tag=='bgmStopEnd'` |

  - ⚠ 未知/存疑：与 bgmStop 的差异由 tag 分支处理，未逐指令确认

### `subBgmStop`

- handler: `0x3181900`；停止副 BGM。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | BGM 名 / ` ` | string | 资源名 / ` ` | low | `0x31896b8 tag=='subBgmStop'` |

  - ⚠ 未知/存疑：同上

### `keepSubBgmOn`

- handler: `0x3181fd4`；允许副 BGM 在场景切换后继续播放（BgmManager.Enable_KeepSubBgm(true)），无参数。
- 无参数。

### `keepSubBgmOff`

- handler: `0x31797d0`；禁止副 BGM 跨场景继续（Enable_KeepSubBgm(false)），无参数。
- 无参数。

### `se`

- handler: `0x3180760`；播放 SE。1 个值=默认音量；3 个值=name+volume；5 个值=name+fadeinTime+volume（实参顺序已核对：pd[2] 是淡入时间、pd[4] 才是音量）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | SE 名 | string | 资源名（ConvertNameString） | high | `0x318dfec;OverwriteAssetSoundName.PlaySe 0x2E7FBA0/0x2E80224` |
| 2 | 3 值形式：音量 volume；5 值形式：淡入时间 fadeinTime | float | 0.0-1.0 / 秒 | high | `5 值:0x3180830->s1(fadeinTime);3 值:0x318e010->s0(volume)` |
| 4 | 音量 volume（5 值形式） | float | 0.0-1.0 | high | `0x318080c->s8->s0（PlaySe 第 3 实参 volume）0x3180838` |

### `seStop`

- handler: `0x3180a80`；停止 SE。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | SE 名 | string | 资源名 | medium | `0x318bd5c OverwriteAssetSoundName.StopSe(name)` |
| 2 | 淡出时间 fadeoutTime | float | 秒 | medium | `0x3188c2c Single::Parse` |

### `seLoop`

- handler: `0x31833e0`；循环播放 SE（OverwriteAssetSoundName.PlaySeLoop(name, volume, fadeInTime)）；与 se 共用尾部，数值顺序同 se（pd[2]=淡入时间、pd[4]=音量）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | SE 名 | string | 资源名 | medium | `0x318e10c ConvertNameString;tag=='seLoop' 分支` |
| 2 | 淡入时间 fadeInTime | float | 秒 | medium | `0x318349c Single::Parse;s1` |
| 4 | 音量 volume | float | 0.0-1.0 | medium | `0x3183478 Single::Parse;s0;PlaySeLoop 0x2E804CC` |

  - ⚠ 未知/存疑：函数体与 se 共用尾部，顺序沿用 se 的结论（未单独核对 seLoop 调用点）

### `seVolume`

- handler: `0x3181dd0`；改变正在播放的 SE 音量（SoundManager.changeVolumeSe）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | SE 名 | string | 资源名 | high | `0x3181ea8 changeVolumeSe(name)` |
| 2 | 淡出/渐变时间 fadeTime | float | 秒 | medium | `0x3181e78→s1（第 3 实参 fadeTime）` |
| 4 | 音量 volume | float | 0.0–1.0 | medium | `0x3181e54→s0（第 2 实参 volume）` |

### `seContinue`

- handler: `0x3180310`；播放可续播 SE（跨场景/跨脚本延续，OverwriteAssetSoundName.PlaySeContinue）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | SE 名 | string | 资源名 | high | `0x3180418 x22=pd[0]→PlaySeContinue(name)` |
| 2 | 淡入时间 fadeinTime | float | 秒 | medium | `0x3180470 解析后→s1（第 5 实参 fadeinTime）` |
| 4 | 音量 volume | float | 0.0–1.0 | medium | `0x3180420 解析后→s0（第 3 实参 volume）` |
| 6 | 续播编号 id（脚本内唯一键） | int | 整数 | medium | `0x31803cc Int32::Parse;ScriptManager.CheckSameIdSeContinue 0x31803e0` |

### `seContinueStop`

- handler: `0x31838c8`；停止可续播 SE（与 cueSeContinueStop 共用体）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | SE 名 | string | 资源名 | medium | `0x318bc58 tail→OverwriteAssetSoundName.StopSe 0x318bd5c` |
| 2 | 淡出时间 | float | 秒 | medium | `0x31839a8/0x318bd1c Single::Parse` |
| 4 | 续播编号 id | int | 整数 | low | `0x3183964 Int32::Parse` |

  - ⚠ 未知/存疑：pd[4] 的用途（是否 id）未确认

### `seContinueVolume`

- handler: `0x3188898`；改变可续播 SE 的音量。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | SE 名 | string | 资源名 | low | `0x3188898` |
| 2 | 渐变时间 fadeTime | float | 秒 | low | `0x31889a0 Single::Parse` |
| 4 | 音量 volume | float | 0.0–1.0 | low | `0x318897c Single::Parse` |
| 6 | 续播编号 id | int | 整数 | low | `0x3188938 Int32::Parse` |

  - ⚠ 未知/存疑：函数体内未见直接 API 调用（可能走 ScriptSubLayer/Delay 机制），参数与 seContinue 保持一致才合理

### `cueSe`

- handler: `0x3186434`；按 asset+object 对播放 SE（OverwriteAssetSoundName.PlaySe(assetName,objectName,...)）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 资源名 assetName | string | 资源名 | high | `0x3186504 ConvertNameString` |
| 2 | 对象名 objectName | string | 对象名 | high | `0x318652c ConvertNameString` |
| 4 | 参数 A | float | — | low | `0x3186574 Single::Parse` |
| 6 | 参数 B | float | — | low | `0x3186550 Single::Parse` |

  - ⚠ 未知/存疑：pd[4]/pd[6] 对应 volume/fadeinTime 中的哪一个未确认

### `cueSeStop`

- handler: `0x3188bb0`；停止 cue SE。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | SE 名 | string | 资源名 | medium | `0x3188bb0 头部+0x318bd5c StopSe` |
| 2 | 淡出时间 | float | 秒 | medium | `0x3188c2c Single::Parse` |

### `cueSeVolume`

- handler: `0x318440c`；改变 cue SE 音量（changeVolumeSe，参数顺序同 seVolume）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | SE 名 | string | 资源名 | high | `0x31844e4 changeVolumeSe` |
| 2 | 渐变时间 fadeTime | float | 秒 | medium | `0x31844b4→与 seVolume 同构` |
| 4 | 音量 volume | float | 0.0–1.0 | medium | `0x3184490` |

### `cueSeContinue`

- handler: `0x317ffa4`；cue 版可续播 SE（5 个值）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | SE 名 | string | 资源名 | medium | `0x317ffa4` |
| 2 | SE 名/对象名（PlaySeContinue(name)） | string | — | medium | `0x3180154 PlaySeContinue(arg x1=pd2)` |
| 4 | 参数 | float | — | low | `0x31800e4 Single::Parse` |
| 6 | 参数 | float | — | low | `0x318007c` |
| 8 | 续播编号 id | int | 整数 | low | `0x318008c Int32::Parse` |

  - ⚠ 未知/存疑：与 seContinue 的对应关系只确认到 pd[0]/pd[2]

### `cueSeContinueStop`

- handler: `0x31838c8`；cue 版续播 SE 停止（与 seContinueStop 同一函数体）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | SE 名 | string | 资源名 | low | `0x31838c8` |
| 2 | 淡出时间 | float | 秒 | low | `0x31839a8` |
| 4 | 续播编号 | int | 整数 | low | `0x3183964` |

### `cueSeContinueVolume`

- handler: `0x3188898`；cue 版续播 SE 音量（与 seContinueVolume 同一函数体）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | SE 名 | string | 资源名 | low | `0x3188898` |
| 2 | 渐变时间 | float | 秒 | low | `0x31889a0` |
| 4 | 音量 | float | 0.0–1.0 | low | `0x318897c` |
| 6 | 续播编号 | int | 整数 | low | `0x3188938` |

### `cueVoice`

- handler: `0x317cef8`；cue 版语音播放。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 语音名 | string | 资源名 | low | `0x317cef8` |
| 2 | 对象名/参数 | string | — | low | `0x317cf8c ConvertNameString` |
| 4 | 参数 | string/float | — | low | `0x317cf20 pd1==' ' 守卫` |

  - ⚠ 未知/存疑：函数体未跟完；参数布局与 cueSe 类似（asset/object）

### `cueVoiceStop`

- handler: `0x3179ed0`；cue 版语音停止。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 语音名 | string | 资源名 | low | `0x318e7bc ConvertNameString` |
| 2 | 淡出时间 | float | 秒 | low | `0x3179f58 Single::Parse` |

### `cueVoiceVolume`

- handler: `0x317b954`；cue 版语音音量。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 语音名 | string | 资源名 | low | `0x317b954` |
| 2 | 渐变时间 | float | 秒 | low | `0x317b97c pd1==' ' 守卫` |
| 4 | 音量 | float | 0.0–1.0 | low | `0x317b9a8 pd3==' ' 守卫` |

  - ⚠ 未知/存疑：与 voiceVolume 同构的推测，未定位到 changeVolumeVoice 调用点

### `voice`

- handler: `0x317d5b0`；播放角色语音 SoundManager.playCharaVoice(name, volume, ignorePreDelay)。快速播放模式下直接跳过。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 语音名 | string | 资源名 | high | `0x317d628 ConvertNameString;0x317d67c playCharaVoice` |
| 2 | 音量 volume | float | 0.0–1.0 | high | `0x317d64c Single::Parse→s0（第 2 实参）` |

### `voiceStop`

- handler: `0x317d8c8`；停止语音（SoundManager.stopVoice(name, fadeoutTime)）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 语音名 | string | 资源名 | medium | `0x318e80c ConvertNameString` |
| 2 | 淡出时间 | float | 秒 | medium | `0x317d950 Single::Parse` |

### `voiceVolume`

- handler: `0x317e3ec`；改变语音音量（SoundManager.changeVolumeVoice(name, volume, fadeTime)）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 语音名 | string | 资源名 | medium | `0x317e468 ConvertNameString` |
| 2 | 渐变时间 fadeTime | float | 秒 | medium | `0x317e4b0（与 seVolume 同构：s1）` |
| 4 | 音量 volume | float | 0.0–1.0 | medium | `0x317e48c（s0）` |

### `tVoice`

- handler: `0x317cc08`；临时/教程语音（TVoice），≥4 个值；pd[0] 名字、pd[2] 对象名、pd[4] 浮点、pd[6..] 多个 int 参。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 语音名 | string | 资源名 | high | `0x317cc28 ConvertNameString` |
| 2 | 对象名 | string | 对象名（未转换，原样） | medium | `0x317cc40 ldr x23,[x8,#0x30]` |
| 4 | 浮点参数（时长/音量） | float | — | low | `0x318c77c Single::Parse` |
| 6 | 布尔参数（'true' 比较） | string | true/false | low | `0x318c8c0 String::Equals('true')` |
| 14 | int 参数 | int | — | low | `0x318cab0 Int32::Parse` |
| 16 | int 参数 | int | — | low | `0x318cae0` |
| 18 | int 参数 | int | — | low | `0x318cb10` |

  - ⚠ 未知/存疑：pd[8]/pd[10]/pd[12] 未见消费点（可能被跳过）；pd[4]/pd[6] 语义未确认

### `tVoiceUser`

- handler: `0x317ae9c`；用户（自定义）语音；pd.Length≥7。内含 pd[0]=='false'/'allFalse' 特判。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 语音名/条件 | string | 资源名 / false / allFalse | medium | `0x317aef4 ConvertNameString;0x318c5e8/0x318c614 String 比较` |
| 2 | 参数 | string | — | low | `0x317af10 pd 起点` |
| 4 | 浮点参数 | float | — | low | `0x318c77c Single::Parse` |
| 8 | 浮点参数 | float | — | low | `0x318c4a8 Single::Parse` |

  - ⚠ 未知/存疑：完整参数表未读完；仅确认 pd0/pd8 与 false/allFalse 特判

### `jingle`

- handler: `0x3186b70`；播放 jingle（SoundManager.playJingle/ BgmManager.PlayJingle(name, volume)）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | jingle 名 | string | 资源名 | medium | `0x3186be8 ConvertNameString` |
| 2 | 音量 | float | 0.0–1.0 | medium | `0x3186c0c Single::Parse` |

### `jingleStop`

- handler: `0x31846c0`；停止 jingle（BgmManager.IsPlayJingle(name) 判定后 StopJingle）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | jingle 名 | string | 资源名 | medium | `0x31846fc isPlayJingle(name)` |

### `advSoundSet`

- handler: `0x3182018`；空实现：函数体只有 `b #0x3193f00`（返回 Normal），本版本不消费任何参数。
- 无参数。

  - ⚠ 未知/存疑：与 delayEnd/enableFullScreen/enableWaitLoadAssetWhenResume 共用空体；如旧脚本带参会被直接忽略

### `soundStopAll`

- handler: `0x3188554`；停止所有声音（ScriptManager.SoundStopAll()），无参数。
- 无参数。

### `soundStopAllEnd`

- handler: `0x3187494`；脚本结束时停止所有声音；参数由 GetNonStopEndBgm() 内部决定，无脚本参数。
- 无参数。

### `soundStopAllFade`

- handler: `0x3181c98`；带淡出的全停止。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 淡出时间（秒） | float | 秒 | high | `0x3181cb4 Single::Parse→SoundStopAllFade(fade)` |

## 消息窗

### `messageOn`

- handler: `0x317bc58`；打开消息窗；必须无参数（pd.Length!=0 报参数错误）。
- 无参数。

### `messageOff`

- handler: `0x318152c`；关闭消息窗（OffScreen+ClearText+记录 back log），必须无参数（否则 parameter error 0x3193e80）。
- 无参数。

### `messageStart`

- handler: `0x317f98c`；把当前行整段交给消息系统（CalcMessageVerticalAlign(pd[])），可带可选参数（vertical align 数据）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 消息垂直对齐用参数数组（整段 pd 传入，解释在消息管理侧） | string[] | — | low | `0x317f99c CalcMessageVerticalAlign(dataList)` |

  - ⚠ 未知/存疑：消息系统内部的用法未展开（在 ScriptMessageCommonManager 侧）

### `messageChange`

- handler: `0x31852b8`；切换消息窗 prefab。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 消息窗名（ScriptUI/MessageWindow/<name>） | string | 资源名 | high | `0x31852f8 ConvertMessageWindowName` |

### `messageAlign`

- handler: `0x3186e48`；消息文本对齐/排布设置；<1 或 ≥3 个值均可（1 值时走另一条参数路径）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 对齐/行首参数（int 或对齐数据） | int/string | — | low | `0x3186e5c（pd.Length==1 路径）;0x318b478 Int32::Parse` |
| 2 | 浮点参数 | float | — | low | `0x318b660 Single::Parse` |
| 4 | 浮点参数 | float | — | low | `0x318b684 Single::Parse` |

  - ⚠ 未知/存疑：未定位到 SetMessageVerticalAlign/SetHorizontalAlign 的调用点；pd[2]/pd[4] 是否属于本命令存疑

### `messageShake`

- handler: `0x3182074`；消息窗震动（ScriptMessageCommonManager.Shake(duration, cycle, x, y)，4 个浮点值）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 持续时间 duration | float | 秒 | medium | `0x3182118 Single::Parse` |
| 2 | 周期 cycle | float | 秒 | medium | `0x3182190 Single::Parse` |
| 4 | X 振幅 | float | 像素 | low | `0x31821b4 Single::Parse` |
| 6 | Y 振幅 | float | 像素 | low | `0x3182148 Single::Parse` |

  - ⚠ 未知/存疑：pd[0]/2/4/6 与 Shake(duration,cycle,x,y) 的一一对应未逐条确认（顺序疑为 0,6,2,4）

### `messageShakeStop`

- handler: `0x317e89c`；停止消息窗震动，无参数。
- 无参数。

### `messageSpeedForcedNormal`

- handler: `0x3184204`；强制消息文字速度恢复正常；参数为 on/off。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 开关 | string | on / off | high | `0x318422c pd0=='on';0x318c2e0 pd0=='off'` |

### `scrollStop`

- handler: `0x317f1a0`；禁止消息滚动（isScrollStop=1），必须无参数；返回 Continue。
- 无参数。

### `effectmessageStop`

- handler: `0x31814c4`；停止对话特效消息（talk effect）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 特效名（Talk/<name>） | string | 资源名 | high | `0x31814e4 ConvertTalkEffectName` |

### `effectmessageDestroy`

- handler: `0x3181ce4`；销毁对话特效消息。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 特效名 | string | 资源名 | high | `0x3181d04 ConvertTalkEffectName` |

### `talkName`

- handler: `0x3187bf0`；设置说话人名。状态置 WAIT(4) 并把整段 pd 存入 waitType/waitMessage，由消息系统接手。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 说话人显示文本（含 [image]/[#ruby]/称号等标记，由 GetTalkName 解析） | string | 文本 | medium | `0x3187bf0;0x3188c90 存 waitType(0x3d8)/waitMessage(0x3f8)` |

  - ⚠ 未知/存疑：参数的拆分规则（imageName/classname/charaname/index）在 ScriptMessageCommonManager.SetTalkName(imageName,classname,charaname,index) 内部，未在脚本侧完成

### `talkNameBack`

- handler: `0x3184900`；设置说话人名牌的底图。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 图片名 | string | 资源名 | high | `0x318b1bc SetTalkNameBack(imageName)` |

### `talkStart`

- handler: `0x3182bc4`；开始对话（把整行交给消息系统），状态置 WAIT(4)。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 整行文本（原样存入 waitType/waitMessage，由消息系统解析） | string | 文本 | medium | `0x3182bd4 str pd 到 0x3d8;0x3182be4 0x3f8` |

### `talkEnd`

- handler: `0x3180268`；结束对话（状态 WAIT(4)，取 backLogTalkEndString 作为等待消息，返回 Normal）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 整行；实际使用 backLogTalkEndString 常量覆盖 | string | — | low | `0x3180280 ldr x1,[x19,#0x6b8]` |

### `message2`

- handler: `(内联比较 0x317b20c/0x3168448)`；消息体行：<tag> <参数...> <文本>。由消息系统处理（ScriptCommandExecute 返回 ReturnFalse 后 CommonMessageManager.ProcessScript 接手）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 第一个值（编号/字符数等预处理数据，逐行可变） | string | — | low | `0x3168448 ProcessScript 的 message2 比较` |
| 最后一项 | 正文 = pd 的最后一个值（整段原文，含 [#RRGGBB]/[r]/[image]/[tRoute] 标记） | string | 文本 | medium | `out/script-format.md §3/§5（解析器原型已实现）` |

  - ⚠ 未知/存疑：message2/message3 的完整参数表在 CommonMessageManager.ProcessScript 内按行变化（未逐行读完）

### `message3`

- handler: `(内联比较 0x317b20c/0x3168448)`；消息体行（同 message2，另一通道）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 最后一项 | 正文 = pd 的最后一个值 | string | 文本 | medium | `0x3168490 'message3' 字面量` |

  - ⚠ 未知/存疑：同 message2

### `page`

- handler: `0x3182038`；翻页/等待点击（page 与 clear 共用体；page 保存整行 pd 后交给消息系统）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 整段 pd（存入 waitType） | string[] | — | medium | `0x3182054 b #0x3192e70 → str x1,[x19,#0x3d8]` |

### `clear`

- handler: `0x3182038`；清屏（clear/clear2）：清消息并翻页。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 整段 pd（同 page） | string[] | — | low | `0x3182038` |

  - ⚠ 未知/存疑：clear 与 page 的差异在消息系统（clear2 在 CommonMessageManager 侧），脚本侧体相同

### `fontSize`

- handler: `0x3187928`；消息字号（可带垂直对齐）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 字号名 / 字体名 | string | small/medium/large/x-small/x-large/normal | high | `0x3187950 SetFontSize(sizeName,verticalAlign)` |
| 2 | 垂直对齐名（仅 ≥2 值时） | string | top/center/bottom | medium | `0x31894b0 SetFontSize(...,verticalAlign)` |

### `font`

- handler: `0x3187928`；与 fontSize 共用体；字体设置（等同 fontSize）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 字号/字体名 | string | 同 fontSize | low | `0x3187928` |

  - ⚠ 未知/存疑：font 与 fontSize 是别名（同一 handler）

### `fontType`

- handler: `0x31795f8`；字体类型（normal 之外的名字走 ConvertFontName(Font/<name>)）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 字体名；normal=默认字体 | string | normal / 资源名 | high | `0x3179614 IsNullOrEmpty;0x3179648 pd0=='normal';0x3179674 ConvertFontName` |

### `betweenHeight`

- handler: `0x318472c`；设置行间距。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 行高；'-' 表示 -1（默认） | float | -1 / 像素 | high | `0x3184754 pd0=='-'→-1.0;0x3184788 SetBetweenLineHeight` |

### `screen`

- handler: `0x31804c8`；消息窗屏幕区域（5 个 int + 可选布尔）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 布尔/开关（'true' 比较） | string | true/false | medium | `0x3180630 pd0=='true'（对应 SetScreen 的 isWindowBack）` |
| 2 | x | int | 像素 | medium | `0x31805a4 Int32::Parse（SetScreen(x,y,w,h,...) 0x31dxxxx）` |
| 4 | y | int | 像素 | medium | `0x31805c8` |
| 6 | w | int | 像素 | medium | `0x31805ec` |
| 8 | h | int | 像素 | medium | `0x3180610` |

  - ⚠ 未知/存疑：pd[0] 与 pd[2..8] 的实参顺序（SetScreen(x,y,w,h,isWindowBack)）按顺序对应推断，medium

### `faceTalkScreen`

- handler: `0x317cd60`；战棋/对话画面用固定背景图（img_talk_textbg/img_talk_namebg），无参数。
- 无参数。

## 流程/状态

### `label`

- handler: `0x317b600`；定义标签（跳转目标）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 标签名；特殊值 'skip'（=跳转时跳过标记） | string | 标签名 / skip | high | `0x317b624 op_Equality(标签表);0x317b68c op_Equality(pd0,'skip')` |

### `jump`

- handler: `0x31801a4`；跳转到标签/脚本。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 目标标签名（第 1 值） | string | 标签名 | medium | `0x31801cc pd1==' ';0x318c29c ConvertNameString` |
| 2 | 脚本名（第 2 值，可为 ` `） | string | 资源名 / ` ` | low | `0x318021c ConvertNameString;0x318c29c LoadExecuteScript` |

  - ⚠ 未知/存疑：pd[0]/pd[2] 谁是 label 谁是 script 未完全确认（LoadExecuteScript 在 0x318c29c 附近）

### `skip`

- handler: `0x317b3f4`；跳过设置/清除（'true'/'false'/'allFalse'）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 跳过开关 | string | true / false / allFalse | high | `0x317b420 pd0=='true';0x318c5e8/0x318c614` |

### `wait`

- handler: `0x31874f4`；阻塞等待。pd[0] 是等待类型关键字（72 个：12 个时间/对象关键字 + 60 个命令名）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 等待类型 waitType（写入 ScriptManager.waitType） | string | 见 conventions.wait_pd0_keys（72 个） | high | `0x31874f4 存 [x19,#0x3d8] 并 ComputeStringHash 后查 0x318753c 树;out/_evidence/wait_keys.json` |
| 2 | 等待量：time/frame/skippableTime=数值(秒/帧)；为 0 时改按名字等待；命令名时=角色槽 index | float/int/string | 秒 / 帧 / A-Z 槽位 / 名称 | medium | `0x3193790 Single::Parse+fcmp 0;0x3193854 ConvertNameString;0x3193918 ConvertCharaIndex` |
| 4 | 命令名等待时的第二参数（int；如帧数/编号） | int | 整数 | low | `0x31939c8 Int32::Parse` |

  - ⚠ 未知/存疑：72 个关键字中 12 个纯等待键的 pd[2] 语义（time=秒、frame=帧、rtime=真实时间）由 0x3193728/0x31937dc 分支给出；其余 60 个命令名共用 0x31938c8 体，pd[2]=角色槽，pd[4]=int

### `delay`

- handler: `0x3182768`；延迟区间：把当前行到下一个 delayEnd 之间的执行延迟 N 秒（可异步，不等）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 延迟槽编号（executeDelayParam 数组下标） | int | 0..上限 | high | `0x31827a8 Int32::Parse→w25 作为数组下标 0x3182830;DelayStop(index) 0x31c5ab4` |
| 2 | 延迟秒数 | float | 秒 | high | `0x31827cc Single::Parse→s0（ScriptCommandDelayParam.ctor 第 3 实参 delaySecond 0x3170f44）` |
| 4 | 标志(0/1)：skipDropFlag = (值==0) | int | 0 或 1 | medium | `0x31827f0 Int32::Parse→w26;cmp #0;cset w3,eq 0x318288c` |

  - ⚠ 未知/存疑：pd[4]==0 → skipDropFlag=true 的语义方向（0 表示‘跳过时丢弃’还是相反）未在 ProcessDelayScript 中逐条确认

### `tdelay`

- handler: `0x3182768`；同 delay，但不受文字速度影响（checkTextSpeed=false）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 延迟槽编号 | int | 整数 | high | `0x3182810 op_Inequality(tag,'tdelay')→cflag` |
| 2 | 延迟秒数 | float | 秒 | high | `0x31827cc` |
| 4 | 标志(0/1) | int | 0/1 | medium | `0x31827f0` |

  - ⚠ 未知/存疑：tdelay 与 delay 共用体，唯一差别是 cflag 取反

### `delayEnd`

- handler: `0x3182018`；延迟区间终点。本版本为空体（只返回 Normal）；区间终点由 GetNextDelayEnd 扫描 'delayEnd' 标签确定。
- 无参数。

  - ⚠ 未知/存疑：空实现（与 advSoundSet 共用）；标签本身仍被 GetNextDelayEnd 字符串比较使用 0x31b276c

### `delayStop`

- handler: `0x31886a0`；停止指定延迟槽。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 延迟槽编号 index | int | 整数 | high | `0x31886bc Int32::Parse→DelayStop(index)` |
| 2 | skipFlag（1/2 等，传给 DelayStop 的 skipFlag） | int | 1/2 | medium | `0x31886e0 Int32::Parse;0x3182850 DelayStop(i,2)` |

### `delayStopAll`

- handler: `0x317fcbc`；停止所有延迟槽。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 起始编号（int，用作循环起点） | int | 整数 | low | `0x317fce8 Int32::Parse` |

  - ⚠ 未知/存疑：函数体只解析 pd[0]，未见循环调用（可能共用尾部），需复核

### `end`

- handler: `0x317f9c4`；结束脚本（end/interruption 共用体；pd0=='interruption' 会置 ScriptManager.isScriptInterruption=1 0x459）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 结束淡出颜色 | string | white / black / 空(\` \`) | high | `0x318b4f4 EndExecuteScript(endFadeColor);0x317f9dc op_Equality('interruption')` |

### `interruption`

- handler: `0x317f9c4`；中断脚本（同 end 体；tag 为 interruption 时 isScriptInterruption=1）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 结束淡出颜色 | string | white/black/` ` | medium | `0x317f9dc;0x318b4f4` |

### `backlogStart`

- handler: `0x31813e0`；开始记录 back log（无参数，函数体外未见 pd 访问）。
- 无参数。

### `backlogEnd`

- handler: `0x317c1ec`；结束 back log 记录（无参数）。
- 无参数。

### `autoAndBackLog`

- handler: `0x317923c`；自动播放/back log 按钮开关。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 开关 | string | true/false | high | `0x317926c pd0=='true';0x317929c pd0=='false'` |

### `tapSkip`

- handler: `0x317bba0`；点击跳过设置；第 2 个值可为 dontResetPress。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 跳过名/标签 | string | 资源名 / ` ` | medium | `0x3190768 ConvertNameString` |
| 2 | 子关键词 | string | dontResetPress | medium | `0x3190430 pd2=='dontResetPress'` |
| 4 | int 参数 | int | 整数 | low | `0x31906cc Int32::Parse` |
| 6 | int 参数 | int | 整数 | low | `0x3190614 Int32::Parse` |
| 8 | int 参数 | int | 整数 | low | `0x3190638 Int32::Parse` |

  - ⚠ 未知/存疑：dontResetPress 分支之外的第 4/6/8 值语义未确认

### `speed`

- handler: `0x3184a58`；脚本播放速度倍率；'-' = -1（恢复默认）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 速度倍率；'-' → -1.0 | float | -1 / 倍率 | high | `0x3184a80 pd0=='-'→-1.0;0x3184aa4 Single::Parse;ModifyPlaySpeed` |

### `selectionUse`

- handler: `0x317d28c`；启用选择分支（selection）功能（无参数）。
- 无参数。

### `selectionCentering`

- handler: `0x317f90c`；选择项居中开关，参数必须是可解析的 bool。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 是否居中 | bool | true/false（Boolean.TryParse） | high | `0x317f948 Boolean::TryParse→[x19,#0x58]→0x90` |

### `input`

- handler: `0x317a800`；输入等待；pd[0] 为子关键词（selectBranch / selectBranchSkipTrueColor / skipStop 等）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 子关键词 | string | selectBranch / selectBranchSkipTrueColor | high | `0x317a82c/0x317a848 op_Equality` |
| 2 | selectBranch 时：子模式（skipStop=检查条件后跳过） | string | skipStop（0x317a950） | medium | `0x317a950 pd2=='skipStop'` |
| 4 | 条件脚本名（skipStop 模式，IsWithInScriptCondition） | string | 条件表达式 | medium | `0x317a978 IsWithInScriptCondition(conditionScript)` |

  - ⚠ 未知/存疑：input 支持的全部子关键词列表未穷举（其他值落到 0x318d9b8 的通用分支，含 'subBlur2Off' 等无关字面量，疑似邻居代码）

### `menu`

- handler: `0x317fa74`；菜单显示；选项行以 `key=value` 形式（pd[0] 可能为 '=' 或 ' '）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 菜单键/标签 或 ' '/'=' | string | 键名 / ` ` / = | medium | `0x317faf0 pd0==' ';0x317fb3c pd0=='=';0x317fb6c/0x317fba8 ConvertNameString` |
| 2 | 菜单标签名 | string | 标签名 | medium | `0x317fb6c/0x317fba8 ConvertNameString→menuLabelList` |

  - ⚠ 未知/存疑：menu 的多行选项解析在 AnalysScript/AnalysText 侧完成，未展开

### `branch`

- handler: `0x317b498`；条件分支：flag 名 + 比较值。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | flag 名 | string | flag 名 | high | `0x317b4ec SearchFlag(name)` |
| 2 | 比较值（'=' 比较） | string | true/false/数值 | high | `0x317b544 ScriptFlagData.Comp(value)` |
| 4 | 第二比较值/备用 | string | — | low | `0x317b498 中的 pd3==' ' 守卫` |

  - ⚠ 未知/存疑：pd[4] 用途未见消费（可能是另一分支形式）

### `branchMaterial`

- handler: `0x31802b0`；按素材持有情况分支；必须 0 参数（pd.Length!=0 报错）。用 isCollection/script 状态比较。
- 无参数。

  - ⚠ 未知/存疑：参数为 0：分支条件由 AnalysText/collection 状态（0x371）决定，0x31802d0 op_Equality(tag,'branchMaterial')

### `branchNotMaterial`

- handler: `0x31802b0`；按素材不持有分支（与 branchMaterial 共用体，比较取反）。
- 无参数。

  - ⚠ 未知/存疑：同 branchMaterial

### `branchHaveSvtEquip`

- handler: `0x318459c`；是否有从者礼装。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 2 | 装备/礼装编号（int） | int | 整数 | medium | `0x31845ec Int32::Parse` |

  - ⚠ 未知/存疑：pd[0] 是否为 0 值（可选）由 0x31845c4 pd1==' ' 守卫暗示 pd[2] 可省略

### `branchNotHaveSvtEquip`

- handler: `0x318459c`；没有从者礼装（取反）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 2 | 装备/礼装编号（int） | int | 整数 | medium | `0x31845ec` |

### `branchQuestClear`

- handler: `0x317bdd0`；任务已通关分支。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 4 | 任务 ID（int） | int | 整数 | medium | `0x317be74 Int32::Parse` |

  - ⚠ 未知/存疑：pd[0]/pd[2] 未消费（可能形态为 `branchQuestClear <label> <questId>`；Int32 在 pd[4]）

### `branchQuestNotClear`

- handler: `0x317bdd0`；任务未通关分支（取反）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 4 | 任务 ID（int） | int | 整数 | medium | `0x317be74` |

  - ⚠ 未知/存疑：同 branchQuestClear

### `branchRouteSelect`

- handler: `0x31834e4`；路线已选分支。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 4 | 路线 ID（int） | int | 整数 | medium | `0x3183588 Int32::Parse` |

### `branchNotRouteSelect`

- handler: `0x31834e4`；路线未选分支（取反）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 4 | 路线 ID（int） | int | 整数 | medium | `0x3183588` |

### `branchRouteSelectCount`

- handler: `0x317c85c`；已选路线数量分支。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 比较表达式/标签（String::Equals） | string | — | low | `0x317ca04 String::Equals` |
| 2 | 数量（int） | int | 整数 | medium | `0x317c904 Int32::Parse` |
| 4 | 枚举/比较符（Enum.Parse） | int/enum | — | medium | `0x317c978 Enum::Parse` |

  - ⚠ 未知/存疑：pd[0] 的语义（可能是 label）未确认

### `branchNotRouteSelectCount`

- handler: `0x317c85c`；未选路线数量分支（取反）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 比较表达式/标签 | string | — | low | `0x317ca04` |
| 2 | 数量（int） | int | 整数 | medium | `0x317c904` |
| 4 | 枚举/比较符 | int/enum | — | medium | `0x317c978` |

  - ⚠ 未知/存疑：同 branchRouteSelectCount

### `branchSetGrandSvtCount`

- handler: `0x317e20c`；设置大支援从者数量条件。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 2 | 数量（int） | int | 整数 | medium | `0x317e288 Int32::Parse` |
| 4 | 枚举/比较符 | int/enum | — | medium | `0x317e2fc Enum::Parse` |

### `revivalBranch`

- handler: `0x31853a4`；复活（续关）分支。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 分支值/名称 | string | — | low | `0x31853a4 pd1==' ' 守卫` |

  - ⚠ 未知/存疑：pd[0]/pd[2] 语义未定位（尾部混入邻居体）

### `flag`

- handler: `0x3188a44`；设置/清除脚本 flag。名字含 'Loop'/'isEnableLoopLogLaterErase' 时走特殊分支。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | flag 名 | string | flag 名（SearchFlag） | high | `0x3188a90 SearchFlag(name);0x3188ae0 Contains('Loop')` |
| 2 | 设置值 | string | true/false | high | `0x3188ab4 ScriptFlagData.Set(value);0x3188b10 pd2=='true'` |

### `flagRandom`

- handler: `0x3184ed4`；随机 flag（SetRahdom）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | flag 名 | string | flag 名 | high | `0x3184f50 SearchFlag` |
| 2 | 随机下限/权重 | int | 整数 | medium | `0x3184f80 SetRahdom(arg1)` |
| 4 | 随机上限 | int | 整数 | medium | `0x3184f80 SetRahdom(arg2)` |

### `masterBranch`

- handler: `0x3179bb8`；Master(御主)性别/形象分支。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 分支键 | string | — | low | `0x3179bb8 pd1==' '` |
| 2 | 分支值 | string | — | low | `0x318d244 通用体（含 SendEvent 等，疑似邻居）` |

  - ⚠ 未知/存疑：函数体与邻居混叠，参数语义未确认

### `questMessageOverwrite`

- handler: `0x317d710`；覆盖任务消息文本。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 文本键/文本 | string | 文本（与常量 'QuestMessageAdd' 拼接） | medium | `0x317d764 String.Concat('QuestMessageAdd', pd0)` |

### `rewardSwitch`

- handler: `0x318522c`；报酬切换开关（'true' 比较；≥2 个值）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 开关 | string | true/false | medium | `0x3185284 pd0=='true'` |

### `notification`

- handler: `0x317af78`；通知对话框。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 标题 | string | 文本 | medium | `0x317b01c ConvertNameString` |
| 2 | 正文 | string | 文本 | medium | `0x317afcc ConvertNameString` |

### `enableWaitLoadAssetWhenResume`

- handler: `0x3182018`；空实现（返回 Normal），本版本不消费参数；字段 enableWaitLoadAssetWhenResume(0x270) 不在该体内写。
- 无参数。

  - ⚠ 未知/存疑：空实现；如需旧行为请对照其他版本

### `enableFullScreen`

- handler: `0x3182018`；空实现（返回 Normal），本版本不消费参数。
- 无参数。

  - ⚠ 未知/存疑：空实现

### `useSimpleMeshFigure`

- handler: `0x317ba14`；使用简化 mesh 立绘（无参数）。
- 无参数。

### `switchCase`

- handler: `0x31875c4`；选择分支块开始（isSwitchCase 置位；已处于 switch 时跳到 switchCaseEnd）。
- 无参数。

  - ⚠ 未知/存疑：pd 未消费：分支项由 ScriptLoop/switchCaseMessage 机制承载（switchCaseEnd 通过 JumpScriptCommand 跳转 0x31875e0）

### `switchCaseEnd`

- handler: `0x3188c58`；选择分支块结束。
- 无参数。

  - ⚠ 未知/存疑：体内未见 pd 消费（0x3188c58 起点，尾部为邻居 fontSize 体）

## 影片/战棋

### `warEventScript`

- handler: `0x317a1bc`；战棋事件脚本编号。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 事件脚本编号（int） | int | 整数 | high | `0x317a1d8 Int32::Parse` |

### `movie`

- handler: `0x3183c38`；播放影片（movie/criMovie 共用体，ConvertCRIMovieName + PlayCRIMovie）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 影片名（CRI） | string | 资源名 | medium | `handler 头部 pd0 消费（ConvertCRIMovieName）` |

  - ⚠ 未知/存疑：函数体未跟完（0x3183c38 起 9 个值以上的分支）

### `criMovie`

- handler: `0x3183c38`；播放 CRI 影片（与 movie 共用体）。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 影片名（CRI） | string | 资源名 | medium | `0x3183c38` |

  - ⚠ 未知/存疑：同 movie

### `warEffectPiece`

- handler: `0x317fd14`；战棋棋子特效。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | key（特效键） | string | 键名 | high | `0x317fdfc PlayEffectPieceScript(key,effectName)` |
| 2 | 特效名 | string | 资源名 | high | `0x317fdfc` |
| 4 | int 参数 | int | 整数 | medium | `0x317fd64 Int32::Parse` |
| 6 | int 参数 | int | 整数 | medium | `0x317fd94` |
| 8 | int 参数 | int | 整数 | medium | `0x317fdc4` |

### `warEffectPos`

- handler: `0x3186664`；战棋坐标特效。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | key | string | 键名 | high | `0x31866dc PlayEffectPosScript` |
| 2 | 特效名 | string | 资源名 | high | `0x31866dc` |
| 4 | x（float） | float | 坐标 | medium | `0x3186688 Single::Parse` |
| 6 | y（float） | float | 坐标 | medium | `0x31866ac` |

### `warEffectOff`

- handler: `0x317fc60`；停止战棋特效。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | key | string | 键名 | high | `0x317fc94 StopEffectScript(key)` |

### `warEffectSquare`

- handler: `0x317f470`；格子特效。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | key | string | 键名 | high | `0x317f4c4 PlayEffectSquareScript` |
| 2 | 特效名 | string | 资源名 | high | `0x317f4c4` |
| 4 | int 参数 | int | 整数 | medium | `0x317f494` |

### `warMoveCameraPiece`

- handler: `0x3187cec`；战棋相机移动到棋子。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 棋子编号（int） | int | 整数 | high | `0x3187d08 Int32::Parse` |
| 2 | float 参数 | float | — | medium | `0x3187d2c` |
| 4 | float 参数 | float | — | medium | `0x3187d50` |
| 8 | int 参数 | int | — | medium | `0x3187da4` |
| 10 | int 参数 | int | — | medium | `0x3187dd4` |
| 12 | int 参数 | int | — | medium | `0x3187e04` |

  - ⚠ 未知/存疑：easeType 在共享尾 0x318cb54 MoveCameraPieceScript(easeType) 传入（pd[6] 候选）

### `warMoveCameraPos`

- handler: `0x317df90`；战棋相机移动到坐标。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | int 参数 | int | — | medium | `0x317dfac Int32::Parse` |
| 2 | float 参数 | float | — | medium | `0x317dfd0` |
| 4 | float 参数 | float | — | medium | `0x317dff4` |
| 6 | easeType（缓动类型） | string | 缓动名 | medium | `0x317e080 MoveCameraPosScript(easeType)` |
| 8 | float 参数 | float | — | medium | `0x317e024` |
| 10 | float 参数 | float | — | medium | `0x317e048` |

### `warMoveCameraSquare`

- handler: `0x3183030`；战棋相机移动到格子。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | int 参数 | int | — | medium | `0x318304c Int32::Parse` |
| 2 | float 参数 | float | — | medium | `0x3183070` |
| 4 | float 参数 | float | — | medium | `0x3183094` |
| 6 | easeType | string | 缓动名 | medium | `0x31830fc MoveCameraSquareScript(easeType)` |
| 8 | int 参数 | int | — | medium | `0x31830c4` |

### `warCharaFadein`

- handler: `0x317ac68`；战棋角色淡入。

| pd | 含义 | 类型 | 取值/单位 | 置信度 | 证据 VA |
|---|---|---|---|---|---|
| 0 | 角色槽（A-Z/数字→槽位号） | string | A-Z / 数字 | high | `0x317ac88 ConvertCharaIndex` |
| 2 | float 参数（淡入时间） | float | 秒 | medium | `0x317acf4 Single::Parse` |
| 4 | int 参数 | int | — | medium | `0x317ad18` |
| 6 | int 参数 | int | — | medium | `0x317ad3c` |
| 8 | int 参数 | int | — | medium | `0x317ad7c` |
| 10 | int 参数 | int | — | medium | `0x317adac` |
| 12 | int 参数 | int | — | medium | `0x317addc` |

  - ⚠ 未知/存疑：int 参数的语义（行列/方向/等级）未逐一定名

### `warBoardTalkScreen`

- handler: `0x317cd60`；战棋对话画面（与 faceTalkScreen 同体，无参数）。
- 无参数。

## 性别类（本版本不存在）

### `gender`

- handler: `(未在 366 命令表)`；性别切换。**本版本不在哈希命令表中**：仅作为 AnalysText 字面量/maleImageId 属性出现。
- 无参数。

  - ⚠ 未知/存疑：命令不存在于 2.139.3 的 366 条表内；如脚本使用 gender/maleImageId/form，会作为未知行返回 ReturnFalse

### `maleImageId`

- handler: `(未在 366 命令表)`；男性形象 ID。**本版本不是命令**（是属性名/字面量）。
- 无参数。

  - ⚠ 未知/存疑：同 gender

### `form`

- handler: `(未在 366 命令表)`；形态切换。**本版本不是命令**（AnalysText 字面量）。
- 无参数。

  - ⚠ 未知/存疑：同 gender

---

## 附录 A：本版本**不存在**的命令（不要按其他版本实现）

- `gender`：性别切换。**本版本不在哈希命令表中**：仅作为 AnalysText 字面量/maleImageId 属性出现。
- `maleImageId`：男性形象 ID。**本版本不是命令**（是属性名/字面量）。
- `form`：形态切换。**本版本不是命令**（AnalysText 字面量）。
- `detail`：细节显示开关。**不是哈希命令**：'detail' 只出现在 AnalysText 的已知标签表字面量里；本版本不作为命令处理（会走消息/未知行路径）。
- `dontResetPress`：**不是命令**，是 `tapSkip` 的 pd[2] 值：`tapSkip <name> dontResetPress`。
- `checkOn`：调试检查开关。**不是哈希命令**：'checkOn' 只在 AnalysText 字面量/调试字段（isDetectionDebugCheckOn 0x5d0）出现。
- `effectmessage`：**本版本没有独立 effectmessage 命令**：它只作为 `wait` 的 pd[0] 关键字（0x318f2ac 节点）出现；命令行请用 effectmessageStart/Stop/Destroy。
- `page2`：**不是命令**：消息系统的翻页标签变体，出现在 ProcessScript 的字面量表（0x31684b8 附近）。
- `clear2`：**不是命令**：消息系统的清屏标签变体（0x31684c0 字面量）。

> `dontResetPress` 只是 `tapSkip` 的 pd[2] 子关键词（`0x3190430`），`page2/clear2` 只在消息系统（`CommonMessageManager.ProcessScript` 字面量表 `0x31684b8`/`0x31684c0`）出现。

## 附录 B：方法与证据文件

- 反汇编：`tools/annotate_func.py`（含字符串/调用目标注解）、`tools/param_semantics.py`（pd 传播）；
  批量产物 `tools/misc_batch.py`、`tools/misc_distill.py`。
- 证据：`out/_evidence/misc_distill.txt`, `out/_evidence/misc_dump2.txt`, `out/_evidence/misc_dump3.txt`, `out/_evidence/wait_tree.txt`, `out/_evidence/wait_keys.json`, `out/_evidence/wait_vocab.txt`, `out/_evidence/mgr_time.txt`, `out/_evidence/mgr_time2.txt`。
- 哈希表：`out/commands.json`（366 条）、`out/_evidence/wait_keys.json`（wait 的 72 键）、
  `il2cpp_out/cmd_other_v3.json`（x22 寄存器 12 个纯等待键）。
- 计数：本文件覆盖 124 个命令、212 条参数记录。

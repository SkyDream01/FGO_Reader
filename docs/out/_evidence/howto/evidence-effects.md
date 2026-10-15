# effects 证据补录(how-to-adv-unrestored)

## 组名:常规、前后景及角色特效(41 条)

目标:`Fate/Grand Order` Android 2.139.3 / IL2CPP arm64 / `libil2cpp.so`。
本文件只是 `how-to-adv-unrestored.md` 中"常规、前后景及角色特效"一组的证据与实现要点。
所有 VA = ELF 虚拟地址;反汇编窗口命令见文末"复现命令"。
凡本文写"实测"的,均在本次会话内用 `work/coverage/win.py` 读取过机器码。
与既有文档冲突处一律显式标 `冲突:`。

覆盖命令(41):`effect effectPause effectStart effectStop effectDestroy effectForceStop`、
`fowardEffect fowardEffectPause fowardEffectStart fowardEffectStop fowardEffectDestroy`、
`backEffect backEffectPause backEffectStart backEffectStop backEffectDestroy`、
`charaEffect charaEffectPause charaEffectStart charaEffectStop charaEffectDestroy`、
`charaBackEffect charaBackEffectPause charaBackEffectStart charaBackEffectStop charaBackEffectDestroy`、
`charaSpecialEffect charaSpecialEffectPause charaSpecialEffectStart charaSpecialEffectStop`、
`specialEffect specialEffectPuase specialEffectStart specialEffectStop`、
`charaEffectEdgeBlur charaEffectEdgeBlurPause charaEffectEdgeBlurStart charaEffectEdgeBlurStop charaEffectEdgeBlurDestroy`、
`effectmessageStop effectmessageDestroy`。

---

## 0. 前置结论一:pd 数组与分词规则(全组共用,决定每条命令的参数下标)

**`pd` 不含 tag;`pd = AnalysParam(该行 tag 之后的参数文本)`。**

* 签名:`ScriptCommandExecute(string tag, string[] pd, int line, string data, ref string errorMessage, ref bool isScriptWait, ref float delta)`(dump.cs:167211 / `class_ScriptManager.txt:1701`)。
* 调用点 `ProcessScript` **0x31c1ac4/0x31c1ac8/0x31c1adc**:

```
0x31c1a18  mov  x1, x26
0x31c1a1c  bl   #0x31a7688  CALL ScriptManager$$AnalysParam      ; x28 = pd = AnalysParam(data)
...
0x31c1ac4  mov  x1, x25                             ; x25 = executeTagList[i]  ([x19,#0x330])
0x31c1ac8  mov  x2, x28                             ; x28 = pd
0x31c1ad0  mov  x4, x26                             ; x26 = executeDataList[i] ([x19,#0x338])
0x31c1adc  bl   #0x3177290  CALL ScriptManager$$ScriptCommandExecute
```
  (`executeTagList` 0x330 / `executeDataList` 0x338 / `executeLineList` 0x340,`class_ScriptManager.txt:262-264`)

* `AnalysParam` **0x31a7688**,逐字符扫描(实测 0x31a77d0-0x31a7af4):
  * 分隔符 **`' '`(0x20)、`','`(0x2c)、`'='`(0x3d)** 都各自成为**独立 token**;
  * 当前有累积 token 时:先 Add(token),再 Add(分隔符字符)(0x31a7914→0x31a7998);
  * 当前无 token 时:
    * `' '`:上一 token 是 `,` 或 `=` → 丢弃(0x31a7a24/0x31a7a2c 比较 `'='`、0x31a7a58 比较 `','`,`tbnz/tbz → 0x31a7af4`);否则 Add(`" "`)(0x31a7a68-0x31a7ae4);
    * `,` / `=`:上一 token 是 `" "` → **用当前分隔符替换它**(0x31a788c-0x31a78ec `List.set_Item`);否则 Add(分隔符字符)。
  * `"…"` 引号段整段进同一个 token 并保留引号(0x31a77f8-0x31a7860);后面 `ConvertTalkEffectName` 才去掉首尾引号(0x31b3818-0x31b386c)。
* 因此 `effect bit_talk_10 100,200 H` 的 `pd = ["bit_talk_10"," ","100",",","200"," ","H"]`,
  这也解释了各 handler 里必查的 `pd[1]==' '`、`pd[3]==','` 守卫(如 `effect` 0x3180c94/0x3180cc8)。

> 冲突:文档 `presentation.md` §1 说"element[0]=tag"。实测 handler 直接 `ldr x1,[x8,#0x20]`(pd[0])送去 `ConvertTalkEffectName`(0x3180b70-0x3180b90),若 pd[0] 是 tag 就会得到 `Talk/effect`;故 pd 不含 tag。`supplement-command-coverage.md` §B 的 `[wait effectmessage <名>]` 用 pd[2] 与本文一致(pd[0]='effectmessage',pd[1]=' ',pd[2]=名)。

## 0.1 前置结论二:实例容器(ScriptManager / ScriptCharaData 字段)

`ScriptManager.InitEffect` **0x31a1bec**(实测 0x31a1c20-0x31a1c70):

```
0x31a1c20  ldr  x0, [x19, #0x160]  ; specialEffectBase
0x31a1c28  bl   #0x30c994c  CALL ProgramEffectManager$$Destory     ; (注意源码拼写 Destory)
0x31a1c40  ldr  x20, [x19, #0x168] ; fowardEffectBase
0x31a1c48  bl   #0x30c1e40  CALL CommonEffectManager$$Destroy
0x31a1c4c  ldr  x0, [x19, #0x170]  ; effectBase
0x31a1c54  bl   #0x30c1e40  CALL CommonEffectManager$$Destroy
0x31a1c58  ldr  x0, [x19, #0x178]  ; backEffectBase
0x31a1c60  bl   #0x30c1e40  CALL CommonEffectManager$$Destroy
0x31a1c64  ldr  x0, [x19, #0x158]  ; communicationCharaEffectBase
0x31a1c6c  bl   #0x30c1e40  CALL CommonEffectManager$$Destroy
0x31a1c70  strb wzr, [x19, #0x498] ; isLoadCommunicationChara = false
```

| 容器 | off | 管理者 | 命令族 | 渲染层级(composition.md §:backEffect 在角色之后、effect 在角色之前、fowardEffect 覆盖全屏) |
|---|---|---|---|---|
| specialEffectBase | 0x160 | `ProgramEffectManager` | `specialEffect*` | 最前(ProgramEffect,带 cutting/flash 专用组件) |
| fowardEffectBase | 0x168 | `CommonEffectManager` | `fowardEffect*` | 前景 overlay |
| effectBase | 0x170 | `CommonEffectManager` | `effect*` | 角色前 |
| backEffectBase | 0x178 | `CommonEffectManager` | `backEffect*` | 角色后 |
| communicationCharaEffectBase | 0x158 | `CommonEffectManager` | `communicationChara*`(本组外) | — |
| charaList[i] | 0x490 | `ScriptCharaData[]`(每角色槽) | `chara*Effect*` | 角色自身层级 |

各 handler 内的容器加载(实测,可直接对上表):

```
0x3180b70(effect)        … 0x3191b90 CreateParam   x0 = [x19,#0x170]   (0x3191ae0 ldr x19,[x19,#0x170])
0x317c3c0(backEffect)    … 0x3190a4c CreateParam   x0 = [x19,#0x178]   (0x317…路径 0x31906a0 ldr x19,[x19,#0x178])
0x318087c(fowardEffect)  … 0x318a364/0x318a39c     x0 = [x19,#0x168]   (0x318a36c ldr x19,[x19,#0x168])
0x3187604(specialEffect) … 0x3188dec / 0x3188e54 CreateMainEffect  x0 = [x19,#0x160]
```

角色槽寻址(`chara*` 全族,实测 0x31880b4-0x31880cc、0x31865dc-0x31865f4、0x31883b4-0x31883cc):

```
0x31880b0  bl   #0x31b34f0  CALL ScriptManager$$ConvertCharaIndex      ; pd[0] → index
0x31880b4  ldr  x8, [x19, #0x490]                                     ; charaList
0x31880c0  cmp  w0, w9 ; 0x31880c8 add x8,x8,w0,sxtw #3 ; ldr x21,[x8,#0x20]   ; charaList[index]
0x31880d0  cbz  x21, #0x3193f00                                       ; 槽为空 → 直接返回 Normal
```

## 0.2 前置结论三:生命周期语义(Create / Resume / Stop / ForceStop / Destroy)

脚本侧的命令只是一层"薄壳",真正语义在 `CommonEffectManager` / `ProgramEffectManager` 里:

| 命令动作 | 脚本处理器调用 | 后端语义 | 证据 |
|---|---|---|---|
| 创建+播放 | `CreateParam(...)` | `LoadCreateLocal` 实例化 loader prefab → 异步加载 `Effect/<name>` → 加载完成后 Instantiate 并 `CommonEffectComponent.Init` | 0x3191b90 / 0x3190a4c / 0x318a39c / 0x30c0cb0 |
| 播放(已存在) | `Resume(parent[,name], isSkip)` | 遍历 parent 子对象:未加载完成的 loader 置 isSkip、清 isPause;已加载的 component 调 `Resume(isSkip)` | 0x318b38c/0x3182498 尾巴 → `CommonEffectManager$$Resume` 0x30c159c/0x30c1738(0x30c16cc `strb w27,[x23,#0x40]`=loader.isSkip,0x30c16d0 `strb wzr,[x23,#0x41]`=loader.isPause=false;0x30c171c `bl CommonEffectComponent$$Resume`) |
| 优雅停止 | `Stop(parent[,name], isSkip, isLoadStop=0, markKey=null)` → `StopInternal(force=false,…)` | 名称匹配后 `component.Stop(isDestroy:true, cb)`(虚表 +0x1b8);未加载完的 loader:仅在 isSkip‖isLoadStop 时 `loader.Stop()`,否则**返回 false(稍后重试)** | 0x30c1b2c `tbz w19,#0` → 0x30c1bd0 `mov w28,wzr`;**StopInternal** 0x30c1978;vtable 调用 0x30c1c14(force,+0x1c8)/0x30c1c24(+0x1b8) |
| 强制停止 | `ForceStop(...)` → `StopInternal(force=true,…)` | 名称匹配后直接 `Object.Destroy(component.gameObject)` | 0x30c1b94 `tbz w20,#0`:force 路径 0x30c1bc8 `bl UnityEngine.Object$$Destroy` |
| 销毁 | 同"强制停止 + isSkip=1" | `Destroy` 家族脚本侧一律 `isSkip=1`、`markKey=null`,失败则逐帧重试 | 0x31842c0-0x31842dc |
| 停不掉时的等待 | 返回 `false` → 写 `waitType(0x3d8)="frame"`、`state(0x288)=State.WAIT(4)`、`waitCount(0x3e4)=1.0f`、`*isScriptWait(x23)=1`,返回 Normal(0) | **命令会在下一帧被重放**(reader 必须实现"帧级重试") | 0x318b414-0x318b444 / 0x318b0c8-0x318b0fc / 0x318b25c-0x318b284 / 0x318be24-0x318be58 |

`State` 枚举:`NONE=0,IDLE=1,LOAD=2,EXECUTE=3,WAIT=4,WAIT_SKIP=5,WAIT_EXIT=6,EXIT=7…`(dump.cs:167168-167179)。

**名字匹配键**(`StopInternal`,实测 0x30c1b10-0x30c1b90):

```
0x30c1a50  cbz  x23, … ; x23 = effectName(脚本名)
0x30c1a70  bl   #0x30bfb78 CALL CommonEffectManager$$GetAssetName      ; "Effect/"+name
0x30c1b18  ldr  x1, [x26, #0x20]     ; loader.effectName(= Init 的 filename = 资产名)
0x30c1b24  bl   #0x48706e4 CALL System.String$$Equals
0x30c1b80  ldr  x1, [x26, #0x50]     ; CommonEffectComponent.effectName
0x30c1b88  bl   #0x48706e4 CALL System.String$$Equals
```
即 **匹配键 = `GetAssetName(脚本名)`(=`Effect/…`)**,不是脚本原文。`Stop(parent, …)`/`Resume(parent, …)`(不带名字)则对容器下**全部**实例生效。

**实例命名**(`CommonEffectComponent.Init` 0x30bb184,实测 0x30bb1f4-0x30bb360):

```
0x30bb208  bl   #0x4fd06d4 CALL UnityEngine.Component$$get_gameObject
0x30bb214  bl   #0x4fd9970 CALL UnityEngine.Object$$get_name      ; effectName = gameObject.name
0x30bb240  bl   #0x487036c CALL System.String$$EndsWith  x1='(Clone)'
0x30bb25c  bl   #0x48746b4 CALL System.String$$Substring  w2 = len-7   ; 去掉 "(Clone)"
0x30bb278  ldr  w8, [x0, #0x88]!   ; useAnimNum
0x30bb2a8  bl   #0x48727c4 CALL System.String$$Concat   ; "<effectName>_<useAnimNum>" (useAnimNum>=1)
0x30bb348  mov  x0, x8            ; x8 = 'Effect('
0x30bb34c  bl   #0x48727c4 CALL System.String$$Concat   ; "Effect(" + name + ")"
0x30bb360  bl   #0x4fd9ac4 CALL UnityEngine.Object$$set_name
```
→ 实例根对象名 = **`Effect(<effectName>)`**,`effectName` 来自 prefab 根对象名(去 `(Clone)`,多动画时加 `_<useAnimNum>`)。对阅读器而言:这就是"一个特效实例"的身份,`Stop/Resume(name)` 与 `IsBusy(name)` 都以它为准。

**组件状态机**(`CommonEffectComponent.Status`,dump.cs:148409-148421):
`INIT=0,PAUSE=1,DESTORY=2,START=3,LOOP=4,TOUCH=5,TOUCHED_LOOP=6,END=7`;
动画名表(`ANIMATION_NAME_TABLE`,`.cctor` 0x30bea20 实测 0x30beb10-0x30beb70):
`{3:"start",4:"loop",5:"touch",6:"touched_loop",7:"end"}`。
`Update` 0x30bcf00:`if (status>=3) { delta = useDeltaTimeInActive? RealTime.DeltaTimeInActive : RealTime.deltaTime; … }`(实测 0x30bcf48/0x30bcf78/0x30bcf80)——阅读器对"角色特效/前景特效"的每帧更新即:推进 `endtime/losttime`,按状态切 clip,`END` 后自毁。
序列化时间字段:`endtime 0x20`、`losttime 0x24`、`loop 0x2C`、`toucedLoop 0x2D`、`particlelist 0x30`,以及 `isDestroy 0x6C / isEndless 0x6D / isSkip 0x6E / isPause 0x6F / isStart 0x70`。

**快速播放的两条专门规则**(本组特有,阅读器要照抄):
1. `effect`/`charaEffect` 在快速播放时对名字含 `bit_shot_` 的特效**直接跳过不创建**(0x3180be4 `String$$Contains x1='bit_shot_'` → 0x3180bec `b #0x3193f00`;charaEffect 同:0x3187b54)。
2. 快速播放里"请求过特效"会插入一次 **0.01s 等待**(`isRequestEffect(0x3c0)` → `waitCount(0x3e4)=0x3c23d70a`):
```
0x319ca0  bl   #0x31b5344 CALL ScriptManager$$IsFastPlaySpeed
0x319ca8  ldrb w8, [x19, #0x3c0]      ; isRequestEffect
0x319cb8  strb wzr, [x19, #0x3c0]     ; 清除
0x319cbc  movk w8, #0x3c23, lsl #16   ; 0x3C23D70A = 0.01f
0x319cc0  str  w8, [x19, #0x3e4]      ; waitCount = 0.01
```
   相关字段:`isRequestEffect 0x3C0`、`isRequestEffectCommand 0x3C8`、`startEffectSkipName 0x410`(`class_ScriptManager.txt:296-310`);`startEffectSkipName` 由 `InitQuestStartEffectSkip` 0x31c6908 在 `clsQuestCheck.IsTapSkipQuestStart()` 时写入(0x31c69b4 `str x19,[x20,#0x410]`)。

---

## 共享体 A `effect` / `effectPause`(handler `0x3180b70`;`case_entry` 0x317bb14=`movk 0x6e6e`=hash 0x6e6e8d54)

* 参数消费(实测):
```
0x3180b70  ldr  x8, [x20] ; cmp len,#1
0x3180b90  bl   #0x31b37c8 CALL ScriptManager$$ConvertTalkEffectName   ; pd[0] → "Talk/<name>"(去引号)
0x3180ba4  bl   #0x31b8248 CALL ScriptManager$$GetEffectParameter     ; pd[0] → 附加参数对象
0x3180bb4  bl   #0x31b5344 CALL ScriptManager$$IsFastPlaySpeed        ; w24 = isSkip
0x3180bf0..0x3180c08  String.op_Equality(tag,'effectPause') → w22 = isPause
0x3180c94  String.op_Equality(pd[1],' ')      ; 坐标形式守卫
0x3180cc8  String.op_Equality(pd[3],',')
0x318fff8  ldr x0,[x8,#0x48] → op_Equality(pd[5],' ') ; 命中才 0x319002c ConvertEffectFlipKind(pd[6])
0x3191ae8  Int32.Parse(pd[2]) → x ; 0x3191b0c Int32.Parse(pd[4]) → y
0x3191b3c  bl   #0x31d8e3c CALL ScriptPosition$$GetPosition(x,y)
0x3191b90  bl   #0x30c14cc CALL CommonEffectManager$$CreateParam
```
* 调用链:`CommonEffectManager.CreateParam(parent=effectBase(0x170), effectName, pos, param, callback, isSkip=IsFastPlaySpeed, isPause=(tag=="effectPause"), flip)` @0x30c14cc。
* 写入字段:`isRequestEffect(0x3C0)=1`(0x3180c60)、`startEffectSkipName(0x410)=null`(0x3180c68);快速播放且非 Pause 时 `isRequestEffectCommand(0x3C8)=pd[0]`(0x3180c20 `str x1,[x19,#0x3c8]`,x1 取自 `[x26,#0x20]`;x26=参数数组的推断为 medium)并构造 `CommonEffectLoadComponent.LoadEndHandler` 回调(0x3180c50 `bl #0x30b7ae4` 委托 ctor);返回 Normal(0x3193f00)。
* 无坐标形式:`pd[1]!=' '` 或参数不足 5 → 0x318b510/0x318b514 → 落到 0x318b558 的 `CreateParam(parent,name,param,callback,isSkip,isPause,flip=NORMAL)` @0x30c1318(0x318b58c `mov w6,wzr`)。
* 资源:`ConvertTalkEffectName` 0x31b37c8 = `"Talk/"+name`(前缀字面量 `Talk/` @0x31b37e4,`String.Concat` @0x4867ef8);`GetAssetName` 0x30bfb78 再加 `"Effect/"`(静态前缀在 `.cctor` 0x30c36b8 `str x1,[x8]` with `'Effect/'`)→ **`Effect/Talk/<name>`**(per `composition.md` 行 29-31,本文实测到同一链路的两个端点)。
* 阅读器补齐要点:
  * 数据模型:`{assetName:"Effect/Talk/"+name, parent:"effect", pos:(x,y,0), flip, isPause, param, status, isRequestEffectRequested}`;
  * 每帧:若非 pause 推进 Status 机;`bit_shot_*` 在 fast 模式不建实例;
  * wait/状态机:创建是**异步的**(loader 先建,资产到达后才 Instantiate);`effectStop/Destroy` 在 loader 未完成时返回 false → 必须实现"帧级重试"而不是丢弃;
  * 资源缺失降级:预烘焙素材缺失时按 `Effect/Talk/<name>` 查表失败 → 记 warn + 空实例(仍要占位,否则 Stop 会永远重试)。
* 置信度:high。未决项:`0x3193fec` 那个返回静态 Vector2 的本地子程序(见共享体 H)未定名;`effect` 的 `LoadEndHandler` 回调方法体未展开(推断与"快速播放时等待资产"有关)。

## 共享体 B `backEffect` / `backEffectPause`(handler `0x317c3c0`)

* 参数消费:与 A 同构(实测):
```
0x317c3e0  ConvertTalkEffectName(pd[0])
0x317c3f4  GetEffectParameter(name)
0x317c404  IsFastPlaySpeed → w22(=isSkip)
0x317c420  op_Equality(tag,'backEffectPause') → w24(=isPause)
0x317c42c  strb w8(=1), [x19,#0x3c0]      ; isRequestEffect = true
0x317c45c  op_Equality(pd[1],' ')
0x317c490  op_Equality(pd[3],',')
0x318f054  ConvertEffectFlipKind(pd[6])   ; 0x318f020 先比 pd[5]==' '
0x31906a8  Int32.Parse(pd[2]) ; 0x31906cc Int32.Parse(pd[4]) ; 0x31906fc GetPosition
0x3190a4c  bl #0x30c1400  CALL CommonEffectManager$$CreateParam
```
* 调用链:`CreateParam(parent=backEffectBase(0x178), name, pos, param=GetEffectParameter, isSkip, isPause, flip)` @0x30c1400(x0=x19=GO 0x178,0x319069c `ldr x19,[x19,#0x178]`)。
* **与 A 的差异**:不带异步回调;不查 `bit_shot_`;仍置 `isRequestEffect=1`(0x317c42c)但不清 `startEffectSkipName`。
* 置信度:high。

## 共享体 C `fowardEffect` / `fowardEffectPause`(handler `0x318087c`)

* 参数消费(实测):
```
0x318089c  ConvertTalkEffectName(pd[0]); 0x31808b0 GetEffectParameter(name); 0x31808c0 IsFastPlaySpeed
0x31808e0  op_Equality(tag,'fowardEffectPause') → w24 = isPause
0x31808f4  strb w8,[x19,#0x3c0] ; str xzr,[x19,#0x410]        ; isRequestEffect=1; startEffectSkipName=null
0x3180928  op_Equality(pd[1],' ') ; 0x318095c op_Equality(pd[3],',')
0x318f4b4/0x318f4c0  op_Equality(pd[5],' ')          ; argc>=7 时的守卫
0x318f4e8  ConvertEffectFlipKind(pd[6])              ; 命中守卫后(0x318f4dc ldr x1,[x8,#0x50])
0x31909a8  Int32.Parse(pd[2]) ; 0x31909c8+ Int32.Parse(pd[4]) ; GetPosition
0x318a39c  bl #0x30c1234  CALL CommonEffectManager$$CreateParam   ; 无坐标形式(x0=[x19,#0x168], w5=flip=0)
```
* 调用链:`CreateParam(parent=fowardEffectBase(0x168), "Talk/<name>", pos|无, param=GetEffectParameter(name), isSkip, isPause, flip)`。
* 特殊性:名字比较里出现过 `'capture'`(0x3181444,`Camera.get_targetTexture` 0x3181454)——但该分支属于**独立命令 `capture`** 的代码块(`cmd_overview.txt`:`capture 0x3181454 | calls Camera$$get_targetTexture, ConvertTalkEffectName | lits 'effectmessageStop','messageOff'`),不在本组;`composition.md` 行 232 把它挂在 `fowardEffect` 名下属于归并过宽。
* 置信度:high(容器/参数);medium(pd[2]/pd[4] 的 Int32.Parse 逐条点,仅确认到 0x31909a8/0x31909c4 读取 `pd[2]`,`pd[4]` 读取按同构窗口 0x31909b8 `cmp w9,#4; b.ls` 判定)。

## 共享体 D `charaEffect` / `charaEffectPause`(handler `0x3187a5c`)

* 参数消费(实测):
```
0x3187a84  op_Equality(pd[1],' ')
0x3187aa8  ConvertCharaIndex(pd[0]) → charaList(0x490)[i] → x21(ScriptCharaData)
0x3187aec  ConvertTalkEffectName(pd[2])
0x3187afc  IsFastPlaySpeed → w22 ; 0x3187b1c op_Equality(tag,'charaEffectPause') → w24
0x3187b30  strb w8,[x19,#0x3c0] ; 0x3187b54 Contains(name,'bit_shot_') → fast 时跳过
0x3187b74  op_Equality(pd[3],' ') ; 0x3187bb0 op_Equality(pd[5],',')
0x319258c  ConvertEffectFlipKind(pd[8])     ; argc>=9,前有 pd[7]==' ' 守卫(0x3192558)
0x3192f74  Int32.Parse(pd[4]) → x ; 0x3192f98 Int32.Parse(pd[6]) → y   ; 0x3192f6c 读 +0x40=索引4, 0x3192f90 读 +0x50=索引6
0x3192fc8  bl #0x31d8ef8 CALL ScriptPosition$$GetCharaOffset          ; 角色偏移(静态表全 0, presentation §2.6)
0x3192fe4  bl #0x31707a0 CALL ScriptCharaData$$SetEffect
```
* 调用链:`ScriptCharaData.SetEffect(string n, Vector3 p, bool isSkip, bool isPause, FlipKind flip)` @0x31707a0(有坐标)或 `SetEffect(string n, bool isSkip, bool isPause, FlipKind flip)` @0x3170714(无坐标)→ 两者都取 `this.chara(0x38)` 转 `UIScriptChara.SetEffect` **0x31e4380 / 0x31e42f4**(0x3170720 `ldr x22,[x0,#0x38]`;0x3170768 `b #0x31e42f4`)。
* 角色容器:`UIScriptChara.baseEffect` **0x60**(类体 `class_UIScriptChara.txt:24`)——`UIScriptChara.StopEffect` 0x31e45b4 里 `ldr x21,[x21,#0x60]` 后直接 `b #0x30b60e8 CommonEffectManager$$Stop`;`ResumeEffect` 0x31e44d4 里 `ldr x20,[x20,#0x60]` 后 `b #0x30c159c CommonEffectManager$$Resume`。
* 参数形态(实测+结构判定):`charaEffect <槽位> <特效名> <x>,<y> [<朝向>]`;`pd[4]`=x(0x3192f74)、`pd[6]`=y(0x3192f98)、`pd[8]`=flip(0x319258c),坐标再经 `ScriptPosition.GetCharaOffset` 加角色偏移(0x3192fc8)。
  > 冲突:`params-visual.md`/brief 把 `pd[4]` 标成"颜色名"、`pd[6]` 标成"?"、`pd[8]` 标成"翻转"。实测 `charaEffect` 的颜色证据 `0x318d2b8` 落在 **charaEffectEdgeBlur** 的代码块(`ConvertColor(pd[4])`),`charaEffect` 消费的是 `pd[3]==' '`+`pd[5]==','`+`Int32.Parse(pd[4])/Parse(pd[6])`,`SetEffect` 签名里也**没有颜色参数**。
* 置信度:high(pd 下标 high;`pd[4]/pd[6]` 为 x/y 的结论 high——与 `effect` 共享同一坐标约定)。
* 未决项:`SetEffect` 内部对位姿/翻转的具体应用(在 `UIScriptChara.SetEffect` 0x31e4380 与 `CommonEffectManager.Create(...Vector3 pos, …FlipKind)` 0x30c044c 内),本组未逐指令展开。

## 共享体 E `charaBackEffect` / `charaBackEffectPause`(handler `0x3181664`)

* 参数消费:与 D 同构(实测 0x318168c `pd[1]==' '`、0x31816b4 `ConvertCharaIndex(pd[0])`、0x31816f8 `ConvertTalkEffectName(pd[2])`、0x3181728 `op_Equality(tag,'charaBackEffectPause')`、0x3181730 `isRequestEffect=1`、0x3181758 `pd[3]==' '`、0x318178c `pd[5]==','`)。
* 调用链:`ScriptCharaData.SetBackEffect` @0x3170938/0x3170994 → `UIScriptChara.SetBackEffect`(容器 `baseEffectBack` **0x68**)。
* 差异:作用在**角色背层**特效容器(`baseEffectBack 0x68`,`class_UIScriptChara.txt:26`)。
* 置信度:high(调用目标按 `class_ScriptCharaData.txt:331/334` + 与 D 同构的字段偏移;`baseEffectBack` 由类体给出)。

## 共享体 F `charaSpecialEffect` / `charaSpecialEffectPause`(handler `0x3184b84`)

* 参数消费(实测):
```
0x3184b90  cmp len,#3
0x3184bac  op_Equality(pd[1],' ')
0x3184bd4  ConvertCharaIndex(pd[0]) → charaList(0x490)
0x3184c1c  ConvertNameString(pd[2])          ; 注意:这里用 ConvertNameString,不是 ConvertTalkEffectName
0x3184c28  bl #0x3193fec                      ; 本地子程序:返回静态 Vector2 默认位置(见下)
0x3184c40  IsContinueSilhouette(this,pd)      ; 命名参数 'continueSilhouette'
0x3184c54  GetCharaSpecialEffectSubParam(this,pd) → ProgramEffectComponent.Param
```
* 调用链:`ScriptCharaData.SetSpecialEffect(n, pos, time, color, range, isSkip, isPause, isContinueSilhouette, param)` @**0x3170614**(签名见 `class_ScriptCharaData.txt:268`)→ `ProgramEffectManager.CreateCharaEffect(parent, name, pos, time, color, range, isSkip, isPause, isContinueSilhouette, param)` @0x30c92bc;角色容器 `UIScriptChara.baseSpecialEffect` **0x58**。
* 子参数(named params):`GetCharaSpecialEffectSubParam` @0x31c8ba4 逐个 `TryGetAndRemoveParams(pd, key, out string[])`(0x31c8c38/0x31c8c7c)取 `'ver'`、`'bodySize'`、`'bodyCenter'` 三键写进 `ProgramEffectComponent.Param{ver 0x10, bodyCenter 0x14, bodySize 0x1C}`(dump.cs:149548);`IsContinueSilhouette` 0x31c8acc 以字面量 `'continueSilhouette'` 查同一套命名参数。→ 命令可以写成 `charaSpecialEffect <槽> <名> … ver=1 bodySize=2,3 bodyCenter=0,0 continueSilhouette`。
* 默认位置来自本地子程序 **0x3193fec**(由 `bl` 调用,返回 s0,s1 两个 float,读静态字段存储 0x5794e18):
```
0x3193fec  stp x30,x19,[sp,#-0x10]!
0x3193ffc  adrp x0,#0x5794000 ; add x0,x0,#0xe18
0x3194004  bl  #0x22304a4                       ; 类型初始化
0x3194018  ldr x8,[x8] ; ldr x8,[x8,#0xb8]      ; static_fields
0x3194020  ldp s0,s1,[x8]                       ; 返回静态 Vector2
```
  (该静态 Vector2 指向何值未解析 → 见未决项)
* 置信度:medium-high。未决项:0x3193fec 返回的静态 Vector2 具体值(是否为 `(0,0)`)未解析;`SetCharaEffect` 的 time/color/range 参数**没有**从脚本 pd 消费(实测 handler 里只见 `0x3184c60 movi d0,#0` 把 pos.x 清 0,time/color 走 `ProgramEffectComponent.Param` 与默认颜色)——即 `charaSpecialEffect` 与 `specialEffect` 的参数表**不同**,不要套用。

## 共享体 G `charaEffectEdgeBlur` / `…Pause`(handler `0x3188390`)

本命令**不吃特效名参数,名字是硬编码的**:

```
0x31883b0  ConvertCharaIndex(pd[0]) → charaList(0x490)[i] → x21
0x31883e0  ldr x8,[x8,#0xe28]  ; &'bit_talk_edgeblur_light'
0x31883e8  bl  #0x31b37c8 CALL ScriptManager$$ConvertTalkEffectName   ; 固定名 → "Talk/bit_talk_edgeblur_light"
0x31883f8  IsFastPlaySpeed → w22
0x3188418  op_Equality(tag,'charaEffectEdgeBlurPause') → w24
0x3188420  strb w8(=1),[x19,#0x3c0]        ; isRequestEffect=1
0x3188430  fmov s16,#1.5                    ; thick 默认值
0x3188448  mov  w19,#4                      ; level 默认值
0x3188464  (颜色默认全 1.0 → Color(1,1,1,1))
```
* 可选参数(实测):`pd[2]`→`ConvertColor`(color,0x318a464)、`pd[4]`→`ConvertColor`(particleColor,0x318d2b8,缺省= color,0x318a48c-0x318a498)、`pd[6]`→`Convert.ToInt32`(level,0x318d314)、`pd[8]`→`Single.Parse`(thick,0x318d33c)。
* 调用链:`ScriptCharaData.SetEffectEdgeBlur(effectName, Color, Color particleColor, isSkip, isPause, FlipKind flip, int level, float thick)` @**0x3170824** → `UIScriptChara.SetEffectEdgeBlur` @0x31e013c;寄存器布局实测 0x318d344-0x318d384:`s0-3=color, s4-7=particleColor, w2=isSkip, w3=isPause, w4=flip(恒 0), w5=level, stack=thick`。
* blur 的实现入口(阅读器需建模的数据):`ScriptActionRenderEffectController`(类体 `class_ScriptActionRenderEffectController.txt`)持有 `material_ 0x38`,以 `StartGaussianBlur/StopGaussianBlur/SetGaussianBlur(sampleRange,sigma)`、`Reflection(...)` 做参数插值(每帧 `Update(delta)` 0x316A640)。角色级边缘模糊另需 `UIScriptChara.GetOffsetEdgeBlur/GetRectEdgeBlur/GetHighRectEdgeBlur/GetBodySubTexture/GetSizeEdgeBlur` 提供的角色本体 sub-texture 与包围盒(presentation §4.3 已列;本次未重复展开)。
* 置信度:high(参数与调用链);medium(blur 在 shader/材质层的落地细节,需资源侧配合,见 §资源)。
* 未决项:level/thick 在着色器里的具体单位;`charaEffectEdgeBlur` 是否还有第二套边光参数。

## 共享体 H `specialEffect` / `specialEffectPuase`(handler `0x3187604`;注意官方拼写 Puase)

* 参数消费(实测):
```
0x3187624  ConvertNameString(pd[0])
0x3187630  bl #0x3193fec                  ; 默认 Vector2(同 F)
0x3187668  op_Equality(pd[1],' ') ; 0x3187698 op_Equality(pd[3],',')
0x31876bc  Int32.Parse(pd[2]) → x ; 0x31876e0 Int32.Parse(pd[4]) → y
0x3187710  bl #0x31d8e3c CALL ScriptPosition$$GetPosition
0x318773c/0x3187740  op_Equality(pd[5],' ')      ; 守卫
0x3187764  Single.Parse(pd[6]) → time              ; ★ 不是 flip
0x31877f0  op_Equality(pd[7],' ')
0x31877b8  ConvertColor(pd[8]) → color
0x31877f0/0x318780c → 0x318f4a0  Single.Parse(pd[10]) → range
0x3188df8  IsFastPlaySpeed → w22
0x3188e18  op_Equality(tag,'specialEffectPuase') → isPause
0x3188ea4  strb w9(=1),[x19,#0x3c0]        ; isRequestEffect=1
0x3188e54  bl #0x30c8f6c CALL ProgramEffectManager$$CreateMainEffect
```
* 调用链:`ProgramEffectManager.CreateMainEffect(parent=specialEffectBase(0x160), name, pos, time, color, range, isSkip, isPause)` @0x30c8f6c;寄存器实测 0x3188e1c-0x3188e54:`s0/s1/s2=pos, s3=time, s4-s7=color, stack=range, w2=isSkip, w3=isPause`。缺参时,`0x3188dd4` 起把 time/color/range 全清零(即默认黑透明、range 0)。
* **两个名字特例**(实测 0x3188e9c-0x3188ec8 与 0x318ba8c-0x318bac0):
```
0x3188eac  op_Equality(name,'cutting') → GetComponent<CuttingEffectComponent>(obj) → CuttingStart([x19,#0x268]=captureTexture)   ; 0x30c4aa0
0x318ba94  op_Equality(name,'flash')   → GetComponent<FlashEffectComponent>(obj)  → FlashStart()                              ; 0x30c74a8
```
* 资源:特效名经 `ConvertNameString`,再由 `ProgramEffectManager.GetMainEffectPrefab`(0x30c8d0c)/`GetCharaEffectPrefab`(0x30c8e3c)取 prefab —— ProgramEffect 的 prefab 来自 `ProgramEffectManager.mainSpecialEffectList(0x20)` / `charaSpecialEffectList(0x28)`(类体),**不是** `Effect/` 资产存储路径(与 CommonEffect 族不同)。
* 置信度:high(参数/调用链/特例名)。
* 未决项:`mainSpecialEffectList` 的序列化内容(需要 prefab 侧数据才能知道有哪些可用名);`0x3193fec` 静态 Vector2 值。

---

## Start 族(把已创建但未播放/已暂停的实例恢复)

| 命令 | handler | 容器 | 调用(VA) |
|---|---|---|---|
| `effectStart` | 0x317cca8 | 0x170 | `ConvertTalkEffectName(pd[0])` 0x317ccc8 → `CommonEffectManager.Resume(parent, name, isSkip)` **0x30c1738**(尾巴 0x3182498:0x318249c IsFastPlaySpeed → 0x31824xx)|
| `fowardEffectStart` | 0x318140c | 0x168 | 同上(0x318142c → `ldr x21,[x19,#0x168]` → `b 0x3182498`)|
| `backEffectStart` | 0x3182470 | 0x178 | 同上(0x3182490 → `ldr x21,[x19,#0x178]`);参数不足时 0x318b100:`ldr x20,[x19,#0x178]` → `Resume(parent, isSkip)` @0x30c159c |
| `charaEffectStart` | 0x3188090 | chara.baseEffect 0x60 | `ScriptCharaData.ResumeEffect(x21, isSkip)` **0x3170850**(尾巴 0x318bda8:`and w1,w22,#1`)|
| `charaBackEffectStart` | 0x3187fb4 | chara.baseEffectBack 0x68 | `ScriptCharaData.ResumeBackEffect(x21, isSkip)` **0x3170a18**(尾巴 0x318bd94)|
| `charaSpecialEffectStart` | 0x3186754 | chara.baseSpecialEffect 0x58 | `ScriptCharaData.ResumeSpecialEffect(x21, isSkip)` **0x317064c**(尾巴 0x318bd74-0x318bd8c:先 `IsFastPlaySpeed`,再 `and w1,w0,#1`)|
| `specialEffectStart` | 0x318290c | 0x160 | `ConvertNameString(pd[0])` 0x318292c → `ProgramEffectManager.Resume(x0=[x19,#0x160], x1=name, w2=0, x3=0)` **0x30c9544**(实测 0x3182930-0x3182944);无参时 0x318b108 → `Resume(parent, isSkip=false)` **0x30c9408** |
| `charaEffectEdgeBlurStart` | 0x317b730 | chara.baseEffect 0x60 | **与 `charaEffectStart` 完全同尾**:0x317b77c `IsFastPlaySpeed` → `and w1,w0,#1` → 0x318bdb0 → `ScriptCharaData.ResumeEffect` |

要点:
* `*Start` **不创建**任何东西——它只对"已存在但被 Pause/未开始"的实例做 Resume;实例不存在时 `CommonEffectManager.Resume` 只是空遍历(0x30c1668 `cmp w21,w0; b.ge` 退出)。
* 无参形态(`pd` 为空/不足)存在:`effectStart`(0x317ccb8 `b.lt 0x318b38c` → `Resume(effectBase, isSkip)`)、`backEffectStart`(0x318b100)、`specialEffectStart`(0x318b108)都是 Resume 整个容器。
* 阅读器补齐:实现 `resume(parent, name?, isSkip)`;`name` 为 `null` 时匹配全部;`isSkip=true` 时跳过入场动画直接到 LOOP 状态(对应 `CommonEffectComponent.Resume(isSkip)` 0x30bb850 里 `strb w21,[x19,#0x6e]`=isSkip 与 `strb wzr,[x19,#0x6f]`=isPause=false)。
* 置信度:high。

## Stop 族(优雅停止,可等待)

| 命令 | handler | 容器 | 调用(VA)/动作 |
|---|---|---|---|
| `effectStop` | 0x31821f8 | 0x170 | 尾巴 0x3182220-0x3182268:`IsFastPlaySpeed` → `CommonEffectManager.Stop(parent,name,isSkip,isLoadStop=0,markKey=null)` **0x30c1c54** → 失败走帧等待(0x318b0bc)|
| `fowardEffectStop` | 0x318496c | 0x168 | 0x318b3d0:`Stop(parent, isSkip=1, isLoadStop=0, markKey=null)` **0x30b60e8** → 0x318b408 帧等待 |
| `backEffectStop` | 0x317ebac | 0x178 | 0x317ebd0 `ldr x21,[x19,#0x178]` → `b 0x3182220`(与 effectStop 同尾)|
| `charaEffectStop` | 0x317a4d0 | chara.baseEffect 0x60 | 先 `ModifyPlaySpeed(true)` 0x317a520;无 name 时 0x318bdbc:`ScriptCharaData.StopEffect(charaData,isSkip,MARK_STOPPED_CHARA_EFFECT)` **0x3170888**(markKey 取静态 `ScriptCharaData.MARK_STOPPED_CHARA_EFFECT` @static+0x158,实测 0x318bdd8-0x318bdec);返回 false → 帧等待 |
| `charaBackEffectStop` | 0x317e538 | chara.baseEffectBack 0x68 | 0x318be0c:`ScriptCharaData.StopBackEffect(charaData, isSkip)` **0x3170a50**;失败 → 帧等待(0x318be24)|
| `charaSpecialEffectStop` | 0x318198c | chara.baseSpecialEffect 0x58 | 0x318bd64:`ScriptCharaData.StopSpecialEffect(charaData)` **0x3170684**(无 isSkip 形参)|
| `specialEffectStop` | 0x317c6d8 | 0x160 | 0x318b37c:`ProgramEffectManager.Stop(x0=[x19,#0x160], x1=0)` **0x30c96b8**(停全部)|
| `charaEffectEdgeBlurStop` | 0x317eabc | chara.baseEffect 0x60 | **与 `charaEffectDestroy` 同尾** 0x318bde4:`StopEffect(charaData,isSkip,MARK_STOPPED_CHARA_EFFECT)` → 失败帧等待 |

* `MARK_STOPPED_CHARA_EFFECT`(`ScriptCharaData` 静态字段 0x158,dump.cs:168130)是"待销毁"标记:后续 `ScriptCharaData.DestroyEffectByMark`(0x31708c0)/`ScriptManager.DestroyStoppedCharaEffect` 会回收这些"停在那"的特效(presentation §4.5 的 `MARK_STOPPED_CHARA_EFFECT` 字面量出自 0x31b5450)。
* 阅读器补齐:`stop(parent, name?, isSkip, isLoadStop, markKey)` 语义 = "让实例播完 end 段再销毁";返回 `false` 时**不要吞掉命令**,按帧重试(`state=WAIT, waitType="frame", waitCount=1.0, isScriptWait=true`)。
* 置信度:high。

## Destroy 族(立即销毁)

| 命令 | handler | 容器 | 调用(VA) |
|---|---|---|---|
| `effectDestroy` | 0x3184278 | 0x170 | 共享尾 0x31842c0-0x31842dc:`CommonEffectManager.Stop(parent,name, isSkip=1, isLoadStop=0, markKey=null)` **0x30c1c54**;`pd` 为空时 0x318b130/0x318b13c:`Stop(effectBase, isSkip=1, 0, 0)` |
| `fowardEffectDestroy` | 0x317db6c | 0x168 | `ldr x21,[x19,#0x168]` → `b 0x31842ac`(同一共享尾)|
| `backEffectDestroy` | 0x3184ad0 | 0x178 | `ldr x21,[x19,#0x178]` → 共享尾;无参 0x318b218:`Stop(backEffectBase, isSkip=1, 0, 0)` **0x30b60e8** → 0x318b250 帧等待 |
| `charaEffectDestroy` | 0x317f398 | chara.baseEffect 0x60 | 0x318bdbc:`StopEffect(charaData, isSkip, MARK_STOPPED_CHARA_EFFECT)`;false → 帧等待 |
| `charaBackEffectDestroy` | 0x317b2e0 | chara.baseEffectBack 0x68 | 0x318bdf8:`StopBackEffect(charaData, isSkip=1)` **0x3170a50**(无 markKey 形参)|
| `charaEffectEdgeBlurDestroy` | 0x31865b8 | chara.baseEffect 0x60 | 直接 `ScriptCharaData.StopEffect(charaData, isSkip=1, markKey=null)` **0x3170888**(实测 0x31865fc-0x3186608)→ 恒返回 Normal(不等待)|

* 关键区别:`Destroy` = `Stop` + `isSkip=1`(跳过 end 动画直接销毁);`Stop` 用 `isSkip=IsFastPlaySpeed`。
* 置信度:high。

## `effectForceStop`(handler 0x3184508)

```
0x3184528  ConvertTalkEffectName(pd[0])
0x318452c  ldr x21,[x19,#0x170]        ; effectBase
0x318453c  IsFastPlaySpeed → w22
0x318b184  bl #0x30c1cdc CALL CommonEffectManager$$ForceStop   ; (parent, isSkip, isLoadStop=0, markKey=null)
0x318b188  b  #0x318b20c                ; true→Normal;false→0x318be24 帧等待
```
* 无参(0x318b140)形态:`ldr x20,[x19,#0x170]` → 同一 ForceStop → 帧等待。
* `ForceStop` 路径在 `StopInternal` 内是 `w20(force)!=0` 分支 → 直接 `Object.Destroy(组件 GO)`(0x30c1bc8,实测),**立刻**结束;语义上等价于"不给 end 表演的 Destroy"。
* 置信度:high。

## `effectmessageStop` / `effectmessageDestroy`(消息窗特效)

两者都走 `ScriptMessageCommonManager.MessageEffectStop`(**0x31d4df4**),不是 `CommonEffectManager`:

```
effectmessageStop  0x31814c4:
  0x31814e4  ConvertTalkEffectName(pd[0])      ; → "Talk/<name>"
  0x31814e8  ldr x21,[x19,#0x28]               ; ScriptMessageCommonManager
  0x31814f8  IsFastPlaySpeed → w2(isSkip)
  0x318150c  b #0x318b040 → 0x318b044 bl MessageEffectStop(x0=SMM, x1=name, w2=isSkip, x3=0)
  0x318b048  tbz w0 → 0x318b0c8(失败 → 帧等待) ; 成功 → Normal
effectmessageDestroy 0x3181ce4:
  0x3181d04  ConvertTalkEffectName(pd[0])
  0x3181d18  b #0x318b05c → 0x318b068 bl MessageEffectStop(SMM, name, w2=1, x3=0)  ; isSkip=1
```
* 等待语义(与 `supplement-command-coverage.md` §B 拼合):`[effectmessage <名> x,y t n]` 由 `AnalysText` 特判做资产校验、由 `ProcessScript` 用 `waitName(0x3e8)` 调 `MessageEffectIsBusy`(**0x31d4f58**)决定是否等;`ScriptMessageCommonManager` 侧还有 `MessageEffectIsStart` 0x31d50a4、`MessageEffectExist` 0x31d51f0。
* `ScriptManager.CheckEffectMessageStopping(string tag)` **0x31c4a44** 在每条命令前被调(0x31c19d0):当 `[x19+0x5c4]` 置位时,对 tag 做哈希分派,命中 `{seLoop, se, wait, seStop, seContinue, seContinueStop, seContinueVolume, effectmessageStop, seVolume}` 会停掉消息窗特效(实测字面量表 0x31c4a60-0x31c4ad0)。→ 阅读器应在这些 tag 出现时自动结束 `effectmessage` 状态。
* 置信度:high(调用链/参数);medium(`0x5c4` 的具体字段名未在 `class_ScriptManager.txt` 的抽样行内出现)。
* 未决项:`MessageEffectStop` 内部对 MessageLabel 贴图的处理(消息窗组,不在本组)。

---

## 后端 API 地图(阅读器建立等价接口用)

### `CommonEffectManager`(dump.cs:148830,`SingletonMonoBehaviour`)

字段:`loadEffectPrefab 0x20`(loader prefab,实例被 Instantiate 后 `GetComponent<CommonEffectLoadComponent>`)、`communicationCharaEffectPrefab 0x28`、`skinEffectLoadLists 0x30`、静态 `effectAssetStoragePath 0x0 ="Effect/"`、`skinEffectAssetStoragePath 0x8 ="Effect/Skin/{0:D2}"`、`testEffectPrefab 0x10`/`testBackEffectPrefab 0x18`/`testCharaEffectPrefab 0x20`/`testCharaBackEffectPrefab 0x28`(`.cctor` 0x30c3678 实测:前缀 `'Effect/'` 与 `'Effect/Skin/{0:D2}'` 写入,test* 全部置 null)。

| 方法 | VA | 语义 |
|---|---|---|
| `GetAssetName(string)` | 0x30bfb78 | `"Effect/" + effectName`(0x30bfbd8 `b #0x4867ef8`,与 `ConvertTalkEffectName` 同一个 String.Concat 桩)|
| `GetFlipQuaternion(FlipKind)` | 0x30bf908 | 1/2/3 → 三组常量四元数(`.rodata` 0xee927c/0xee9288/0xee9294),其余 → 单位四元数 |
| `Get(GameObject)` | 0x30bfbdc | 收集 parent 下所有 `CommonEffectComponent`(数组)|
| `IsBusy(GameObject)` / `IsBusy(GameObject,string)` | 0x30b632c / 0x30bfdc8 | 遍历子对象(0x30b63dc-0x30b641c 实测:childCount+GetChild+GetComponent),任一未结束 → true |
| `IsStart(GameObject)` / `IsStart(GameObject,string)` | 0x30bffdc / 0x30c0168 | 是否有已开始的实例 |
| `Create(...)` 8 个重载 | 0x30c0384/0x30c0640/0x30c0708/0x30c044c/0x30c07d0/0x30c0a74/0x30c0b3c/0x30c0898 | 由 prefab/AssetData 直接建 |
| `Create(parent,name,isSkip,isPause,flip)` / `…+callback` / `…+pos` / `…+pos,+callback` | 0x30c0bd8 / 0x30b90b8 / 0x30c1174 / 0x30b7bec | 脚本族实际走 CreateParam |
| `CreateParam(parent,name,param,isSkip,isPause,flip)` | **0x30c1234** | `fowardEffect` 无坐标形式用 |
| `CreateParam(parent,name,param,callback,isSkip,isPause,flip)` | **0x30c1318** | `effect` 无坐标形式用 |
| `CreateParam(parent,name,pos,param,isSkip,isPause,flip)` | **0x30c1400** | `backEffect` 用 |
| `CreateParam(parent,name,pos,param,callback,isSkip,isPause,flip)` | **0x30c14cc** | `effect` 用 |
| `LoadCreateLocal(parent,name,pos,param,cb,isSkip,isPause,flip)` | 0x30c0cb0 | Instantiate(loader) → `CommonEffectLoadComponent.Init(filename=GetAssetName(name), param, cb, isSkip, isPause, flip)`(0x30c0fa4 `b #0x30bede0`)|
| `Resume(parent,isSkip)` / `Resume(parent,name,isSkip)` | 0x30c159c / **0x30c1738** | 见 §0.2 |
| `Stop(parent,isSkip,isLoadStop,markKey)` / `Stop(parent,name,…)` | 0x30b60e8 / **0x30c1c54** | 见 §0.2 |
| `ForceStop(parent,…)` / `ForceStop(parent,name,…)` | 0x30c1cdc / 0x30c1d60 | 立即 Destroy |
| `StopInternal(force,parent,name,isSkip,isLoadStop,markKey)` | 0x30c1978 | 唯一实现;返回 bool(能否立刻完成)|
| `Destroy(parent)` / `Destroy(parent,name)` / `DestroyByMark(parent,markKey)` | 0x30c1e40 / 0x30c217c / 0x30c256c | — |
| `Reboot` / `LoadSkinEffects*` / `SetSkinEffect*` / `SetTestEffectPrefab` | 0x30c2bc4 / 0x30c3458 / 0x30c3574 / 0x30c2b0c | 皮肤与自测入口,脚本族不用 |

`CommonEffectLoadComponent`(`class_CommonEffectLoadComponent`,dump.cs:148735):`effectName 0x20 / isInit 0x28 / isEnable 0x29 / loadCallback 0x30 / param 0x38 / isSkip 0x40 / isPause 0x41 / flip 0x44`;`Init(string filename, object param, LoadEndHandler cb, bool isSkip, bool isPause, FlipKind flip)` @**0x30bede0**;**`Stop()` @0x30bf9d0**;`Resume(isSkip)` @0x30bf994;`EndLoad(AssetData)` @0x30bf038(内部 `Instantiate(asset)` 0x30bf21c → `GetComponent<CommonEffectComponent>` 0x30bf238 → 设置 parent/localScale/localRotation(flip 四元数,0x30c0f1c `Transform.set_localRotation`)→ Init)。

`CommonEffectComponent`(dump.cs:148465):
`Init(isSkip,isPause)` 0x30bb184 / `Init(string effectName,…)` 0x30bb7a0 / `Init(AssetData,…)` 0x30bb7e0;
`Resume(bool isSkip)` 0x30bb850;`SetParam(object)` 0x30bb96c;`NextPlayAnimation(Status)` 0x30bb970;
`ForceStart()` 0x30bb958 / `ForceStart(bool,Action)` 0x30bc3f0;`ForceLoop()` 0x30bc694;`ForceTouchedLoop()` 0x30bc948;
**`Stop(bool isDestroy,Action)` 0x30bcb6c**;`ForceStop(bool,Action)` 0x30bcdd0;`StopInternal(force,isDestroy,cb)` 0x30bcb7c;
`Rewind()` 0x30bcde0;`Update()` 0x30bcf00;`SetTime(endTime,lostTime)` 0x30bb15c;`SetEndlessEnable(bool)` 0x30bd4f0;
`SyncParticleList(float)` 0x30bdd2c;`SetTouchCallback/OnTouch/OnRelease` 0x30bde28/0x30bde30/0x30bdec4。

### `ProgramEffectManager`(dump.cs:149609)

字段:`mainSpecialEffectList 0x20`、`charaSpecialEffectList 0x28`(特效 prefab 白名单,非资产路径)。

| 方法 | VA |
|---|---|
| `Get(GameObject)` | 0x30c85fc |
| `IsBusy(GameObject)` / `IsBusy(GameObject,string)` | 0x30c87e8 / 0x30c8910 |
| `IsStart(GameObject)` / `IsStart(GameObject,string)` | 0x30c8a70 / 0x30c8ba4 |
| `GetMainEffectPrefab(string)` / `GetCharaEffectPrefab(string)` | 0x30c8d0c / 0x30c8e3c |
| `CreateMainEffect(parent,name,pos,time,color,range,isSkip,isPause)` | **0x30c8f6c** |
| `CreateCharaEffect(parent,name,pos,time,color,range,isSkip,isPause,isContinueSilhouette,param)` | 0x30c92bc |
| `Create(parent,prefab,pos,time,color,range,…)` | 0x30c90a4 |
| `Resume(parent,isSkip)` / `Resume(parent,name,isSkip)` | 0x30c9408 / **0x30c9544** |
| `Stop(parent)` / `Stop(parent,name)` | **0x30c96b8** / 0x30c97e4 |
| `Destory(parent)` / `Destory(parent,name)`(原文拼写) | 0x30c994c / 0x30c9c18 |

`ProgramEffectComponent`(`class_ProgramEffectComponent.txt`):`effectName 0x190 / effectColor 0x198 / effectRange 0x1A8 / duration 0x1AC / totalTime 0x1B0 / isSkip 0x1B4 / isPause 0x1B5 / isStart 0x1B6 / isContinueSilhouette 0x1B7 / param 0x1B8`;`Init(time,color,range,isSkip,isPause,isContinueSilhouette,param)` 0x30C80B0;`Resume(bool)` 0x30C857C;`Stop()` 0x30C8588。`Param{ver 0x10, bodyCenter 0x14, bodySize 0x1C}`(dump.cs:149548)。

### `ScriptCharaData` 侧(角色三容器)

| 方法 | VA |
|---|---|
| `SetEffect(name[,pos],isSkip,isPause,flip)` | 0x3170714 / 0x31707a0 |
| `ResumeEffect([name,]isSkip)` | 0x3170850 / 0x317086c |
| `StopEffect([name,]isSkip,markKey)` | 0x3170888 / 0x31708a4 |
| `DestroyEffectByMark(markKey)` | 0x31708c0 |
| `SetEffectEdgeBlur(...)` | 0x3170824 |
| `SetBackEffect / ResumeBackEffect / StopBackEffect` | 0x3170938·0x3170994 / 0x3170a18·0x3170a34 / 0x3170a50·0x3170a6c |
| `SetSpecialEffect / ResumeSpecialEffect / StopSpecialEffect` | 0x3170614 / 0x317064c·0x3170668 / 0x3170684·0x317069c |
| 静态 `MARK_STOPPED_CHARA_EFFECT` | static 偏移 0x158(dump.cs:168130)|

`UIScriptChara`(dump.cs:171674)容器:`baseCutEffect 0x50`、`baseSpecialEffect 0x58`、`baseEffect 0x60`、`baseEffectBack 0x68`、`baseShadowEffect 0x70`;`SetEffect` 0x31e42f4/0x31e4380、`ResumeEffect` 0x31e44d4/0x31e4540、`StopEffect` 0x31e45b4/0x31e462c、`SetEffectEdgeBlur` 0x31e013c。**无坐标重载用 `Vector3.zero`**(0x31e4340-0x31e4378 从静态字段 0x5571000+0xa88 +0xb8 取 s0,s1,s2)。

### `ScriptManager` 侧(转换与查询)

`ConvertTalkEffectName` **0x31b37c8**(`"Talk/"+去引号`);
`ConvertNameString` 0x31b1530;`ConvertCharaIndex` 0x31b34f0;`ConvertColor` 0x31b36bc;
`ConvertEffectFlipKind` **0x31b3ad0**(先 `ConvertNameString(param)`,再与 `'H'` 等比较;实测 `'H'→1` 分支 0x31b3b30-0x31b3b38,`V→2/F→3/其他→0` per `presentation.md` §4.1);
`GetEffectParameter` **0x31b8248**(实测 0x31b82b4-0x31b835c:名字以 `'Talk/bit_queststart'` 开头 → new `CommonEffectParam`(模板取自静态字段,写 `title/message/messageRuby/type/questMessageLabelMaxLine/questId`);否则若 `parameterList(0x398)` 非空 → new `RaceResultEffectParam{parameterList}`;否则 **null**);
`IsFastPlaySpeed` 0x31b5344 / `IsNormalPlaySpeed` 0x31b5324 / `ModifyPlaySpeed` 0x31a8220;
`GetCharaSpecialEffectSubParam` 0x31c8ba4 / `IsContinueSilhouette` 0x31c8acc / `TryGetAndRemoveParams` 0x31c8d54;
`CheckEffectMessageStopping` 0x31c4a44;`InitEffect` 0x31a1bec;`AnalysParam` 0x31a7688。

---

## 资源侧(阅读器"需原始资源"清单)

命名链(实测端点 + `composition.md` 行 60-70 汇总):

| 脚本写法 | 转换 | 资产名 | 证据 |
|---|---|---|---|
| `bit_talk_10` | `ConvertTalkEffectName` → `Talk/bit_talk_10`,再 `GetAssetName` | **`Effect/Talk/bit_talk_10`** | 0x31b37c8(`'Talk/'` 字面量 0x31b37e4)、0x30bfb78(`'Effect/'` 字面量 cctor 0x30c36b8) |
| `charaEffectEdgeBlur`(硬编码) | 同上 | **`Effect/Talk/bit_talk_edgeblur_light`** | 0x31883e0 字面量 `'bit_talk_edgeblur_light'` |
| `communicationChara` 特效 | 特殊映射:`Talk/communicationCharaEffect` → `Talk/bit_talk_10` | `Effect/Talk/bit_talk_10` | 0x30c0e0c-0x30c0e28 `csel x26,x8('Talk/bit_talk_10'),x26,ne` |
| 自测名 | `Talk/Test` 前缀且 `== Talk/TestEffect/Talk/TestBackEffect/Talk/TestCharaEffect/Talk/TestCharaBackEffect` | 用静态 test*Prefab | 0x30c0da4-0x30c0dfc、0x30c0fa8+ |
| wipe 类 | `ConvertWipeName` | `Effect/Wipe/<name>` | per `composition.md` 行 31/62 |
| 皮肤 | `Effect/Skin/{0:D2}` | — | cctor 0x30c36f4 |

* CommonEffect 族只依赖**资产存储路径 + prefab**;ProgramEffect(0x160)族依赖 `ProgramEffectManager.mainSpecialEffectList/charaSpecialEffectList` 上的**序列化 prefab 列表**(类体 0x20/0x28),`specialEffect <名>` 的可用值集合必须从 `ProgramEffectManager` 的 prefab 数据源导出(游戏数据源,不是文本资产)。
* `charaEffectEdgeBlur` 需要材质量化参数:`ScriptActionRenderEffectController.material_ 0x38` + `StartGaussianBlur(sampleRange,sigma)`/`SetGaussianBlur`(类体与 `distortion` 族共用,presentation §4.3);角色 sub-texture 与包围盒来自 `UIScriptChara.GetOffsetEdgeBlur…`。
* `specialEffect` 的两个特例名需要专用组件:`CuttingEffectComponent`(0x30c4aa0 `CuttingStart`)与 `FlashEffectComponent`(0x30c74a8 `FlashStart`)。

---

## 与既有文档的冲突 / 修订清单

1. `presentation.md` §1 "element[0]=tag" → 实测 **pd 不含 tag**(0x31c1ac4-0x31c1adc + 0x3180b70;见 §0)。
2. `params-visual.md` `charaEffect` 行:`pd[4]=颜色名`、`pd[6]=?`、`pd[8]=翻转` → 实测 `pd[4]`=x、`pd[6]`=y、`pd[8]`=flip,无颜色参数(SetEffect 无 Color 形参:`class_ScriptCharaData.txt:295-298`;颜色证据 0x318d2b8 属 `charaEffectEdgeBlur`)。
3. brief/`params-visual.md` `specialEffect` 行:`pd[6]=朝向/翻转或时长` → 实测 `pd[6]`=**time**(`Single.Parse` 0x3187764),`pd[10]`=**range**(`Single.Parse` 0x318f4a8);`effect`/`specialEffect` 的 `pd[10]=画框图片(ConvertPictureFrameImageName)` **未证实**(0x3190240 属 pictureFrame 流程,与 `effect`/`specialEffect` 无调用路径相连)。
4. `composition.md` 行 232 把 `capture`(Camera targetTexture)记在 `fowardEffect` 名下 → 实测那是独立命令 `capture`(0x3181438/0x3181454,`cmd_overview.txt` 列于 `capture`),`fowardEffect*` 无该分支。
5. `params-visual.md` `charaEffectEdgeBlur*` 行把 `pd[2]/pd[4]` 标成"颜色名"是对的(0x318a464/0x318d2b8),但漏了 `pd[6]=level`(`Convert.ToInt32` 0x318d314,默认 4)与 `pd[8]=thick`(`Single.Parse` 0x318d33c,默认 1.5)。
6. `brief-effects.md` `effectmessageDestroy/Stop` 的 `pd[0]` 描述为"资源名" → 实测经 `ConvertTalkEffectName` 变成 `Talk/<名>` 后交给 `ScriptMessageCommonManager.MessageEffectStop`(0x31814e4/0x3181d04),不是 CommonEffect 资产名。

---

## 本组小结

### 缺口分类

**a) 纯逻辑缺口(可完整实现,无需资源)**
* pd 分词与下标(§0);命令 → 容器映射(§0.1);生命周期语义与"帧级重试"等待(§0.2);`Resume/Stop/ForceStop/Destroy` 的名字匹配键、`isSkip/isPause/flip` 传递;`bit_shot_*` fast 跳过;fast 模式 0.01s 特效等待;`effectmessageStop/Destroy` + `CheckEffectMessageStopping` 的自动停止 tag 表;`charaSpecialEffect` 的命名参数(`ver/bodySize/bodyCenter/continueSilhouette`);`charaEffectEdgeBlur` 的固定名与 level/thick 默认值。

**b) 需原始资源(Unity prefab/粒子/材质/纹理)**
* 所有 `Effect/…` 资产(CommonEffect 族);`ProgramEffectManager.mainSpecialEffectList / charaSpecialEffectList` 的 prefab 与 `CuttingEffectComponent/FlashEffectComponent`;边缘模糊所需角色 sub-texture、`Sprite-ScriptActionRender` 系列材质与 `ScriptActionRenderEffectController.material_`(GaussianBlur 参数)。

**c) 需游戏数据源**
* `ProgramEffectManager` prefab 白名单(决定 `specialEffect <名>` 的合法值);`GetEffectParameter` 对 `Talk/bit_queststart*` 的模板参数(`CommonEffectParam` 静态模板)与 `parameterList(0x398)` 的数据来源;`startEffectSkipName` 的 quest-start 特效名(`clsQuestCheck.IsTapSkipQuestStart`)。

### 最小可交付实现(逻辑层,无资源也能跑)
1. 解析层:`AnalysParam` 等价分词器(空格/逗号/等号独立成 token + 引号段 + 合并规则)。
2. 模型:`EffectInstance{container, assetName, effectName, pos, flip, status, isPause, isSkip, markKey, isLoadComponent}`;容器 5 个 + 每角色 3 个。
3. 每帧:`status>=START(3)` 的实例才推进(0x30bcf48 `cmp w8,#3; b.hs`;INIT/PAUSE/DESTORY 不推进),按 `endtime/losttime` 计时;`isLoadComponent` 的实例等"资产就绪"事件;`END` 后回收。
4. 命令:Create/Resume/Stop/ForceStop/Destroy 五个原语 + `false → state=WAIT/frame=1.0/isScriptWait` 重试语义;`effectmessage*` 接消息窗状态机。

### 资源到位后的升级路径
1. 先接 CommonEffect 族(资产路径规则完整:`Effect/Talk/*`、`Effect/Wipe/*`、皮肤模板),播放层按 `CommonEffectComponent` 状态机映射 `start/loop/touch/touched_loop/end` 五段动画与粒子。
2. 再接 ProgramEffect 族(需要 prefab 清单 + `Cutting/Flash` 专用组件)。
3. 最后做 `charaEffectEdgeBlur`(角色 sub-texture + GaussianBlur 材质参数,依赖角色渲染管线先可用)。
4. `flip` 用 `GetFlipQuaternion`(0x30bf908)的三组常量四元数,不要自造角度。

---

## 复现命令

```bash
cd F:/Project/fgo/work
python coverage/win.py 0x3180b70 20 230     # effect/effectPause 主体
python coverage/win.py 0x317c3c0 10 130     # backEffect/backEffectPause
python coverage/win.py 0x318087c 4 160      # fowardEffect
python coverage/win.py 0x3187a5c 4 140      # charaEffect
python coverage/win.py 0x3184b84 4 80       # charaSpecialEffect
python coverage/win.py 0x3188390 6 120      # charaEffectEdgeBlur
python coverage/win.py 0x3187604 4 90       # specialEffect
python coverage/win.py 0x3193fec 0 50       # 静态 Vector2 取值子程序
python coverage/win.py 0x30c1b10 0 110      # StopInternal 名字匹配/force 分支
python coverage/win.py 0x30c0cb0 0 140      # LoadCreateLocal(资产名→loader)
python tools/annotate_func.py 'ScriptManager\$\$AnalysParam' 12
python tools/annotate_func.py 'ScriptManager\$\$GetEffectParameter' 8
python tools/klass.py '^CommonEffectManager$'
python tools/klass.py '^ProgramEffectManager$'
python tools/klass.py 'CommonEffectLoadComponent|CommonEffectParam'
```

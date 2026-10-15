# advprefab/movie/capture/endfade 证据补录

目标：FGO Android 2.139.3 / IL2CPP arm64，`extract/lib/arm64-v8a/libil2cpp.so`。本文为 how-to-adv-unrestored.md 的「ADV prefab / 3D 演出(6) + 影片(2) + 截屏及渲染模式(4) + 结束淡出(1)」四组补齐证据。
约定：VA = ELF 虚拟地址；handler 均在 `ScriptManager$$ScriptCommandExecute` `0x3177290..0x319402c` 内；`dump.cs` 行号指 `work/il2cpp_out/dump.cs`；【实证】= 反汇编/字面量/字段直证，【推断】= 由调用链推断；语料 = `F:\Project\fgo\scripts`（2583 文件）。
本文对 presentaiton.md §6.3 的两处旧描述做了修正（advPlayAnimator 与 tdelay 无关；advSet 的 wait 由共享尾块注册），冲突处以本文为准并给证据。

---

## ADV prefab / 3D 演出

### advSet

- handler：`0x317ec04`（共享体：wait 登记走共享尾块 `0x3184a20`，与 charaTalk 同一段）
- 参数消费：pd[0] → **不**经 ConvertNameString，直接送 `GetAssetName`（`0x317ec28 ldr x0,[x8,#0x20]` → `0x317ec30 bl GetAssetName`）
- 行为（写入字段 / 调用链）：
  - 前置：`scriptActionAdvPrefabController`(ScriptManager `0x248`) 必须存在（否则 NullRef 错误分支 `0x318f114`）；`controller.isSetup(0x38)!=0` → 直接返回 Normal（`0x3193f00`，不重复 Setup）。
  - `GetAssetName(pd[0])` @`0x3169b74` → `Setup(assetName)` @`0x3169bc0`。
  - 注册等待：`state(0x288)=4(WAIT)`、共享尾块 `0x3184a20` 写 `waitType(0x3D8)=tag('advSet')`、`waitIndex(0x3E0)=-1`、`*isScriptWait=1`、返回 Normal。
- 关键反汇编：

```
0x317ec18  ldr      x20, [x19, #0x248]      ; ScriptManager.scriptActionAdvPrefabController
0x317ec20  ldrb     w9, [x20, #0x38]        ; controller.isSetup
0x317ec24  cbnz     w9, #0x3193f00          ; 已 setup → 跳过（Normal）
0x317ec28  ldr      x0, [x8, #0x20]         ; pd[0]
0x317ec30  bl       #0x3169b74  CALL ScriptActionAdvPrefabController$$GetAssetName
0x317ec40  bl       #0x3169bc0  CALL ScriptActionAdvPrefabController$$Setup
0x317ec44  mov      w8, #4
0x317ec4c  str      w8, [x19, #0x288]       ; state = WAIT(4)
0x317ec50  ldr      x1, [x22]               ; x22 = &(DisplayClass808_0.tag 字段)
0x317ec54  b        #0x3184a20              ; 共享 wait 登记尾块
```

  - `x22` 的来历（函数序言闭包）：`0x3178fbc mov x22, x26`（x26=object_new(DisplayClass808_0)）、`0x3178fc4 str x25,[x22,#0x20]!`（x25=tag）→ 全函数内 `[x22]` 即当前 tag 字符串。【实证】
  - 共享尾块：

```
0x3184a20  str      x1, [x19, #0x3d8]      ; waitType = 'advSet'
0x3184a28  mov      w8, #-1
0x3184a34  str      w8, [x19, #0x3e0]      ; waitIndex = -1
0x318b0f8  strb     w9(=1), [x23]          ; *ref isScriptWait = true
0x318b0fc  b        #0x3193f04             ; 返回 Normal
```

- 后端 API 地图（`类$$方法 @VA` — 语义）：
  - `ScriptActionAdvPrefabController$$GetAssetName @0x3169b74` — `String.Format('ADV/{0}', baseName)`（字面量 `'ADV/{0}'` 槽 `0x55c90100`，尾调 `System.String$$Format @0x4868ad0`）。
  - `ScriptActionAdvPrefabController$$Setup @0x3169bc0` — `isSetup=false`；`AssetLoader.LoadEndDataHandler.ctor(this, …)` @`0x2da0564` + 尾调 `AssetManager$$loadAssetStorage @0x2da59ac`（异步加载 `ADV/{name}`）。
  - `ScriptActionAdvPrefabController$$<Setup>b__16_0 @0x316a3b0` — 加载回调：`this.assetData(0x40)=asset; this.isSetup(0x38)=true`（advSet 等待的结束条件）。
- 资源：路径模板 `'ADV/{0}'`（`0x3169b8c/0x3169bbc`）；`AnalysText` 预收集同一转换（`0x31af364 ConvertNameString → 0x31af370 GetAssetName`）。【实证】
- 阅读器补齐要点（纯逻辑缺口）：
  - 数据模型：`adv = { assetName, isSetup, waitState }`；`isSetup` 由异步加载完成置位；`advSet` 前若 `isSetup` 已 true 则整条命令跳过。
  - 每帧更新/状态机：命令结束不推进脚本（返回 Normal + isScriptWait=true → ProcessScript 进入 state=WAIT 循环），直到 `isSetup==true`。Web 侧可直接以"资源预载 Promise"实现同名语义（见下 wait 集成）。
  - 资源缺失降级：`ADV/{0}` 资产不在 Web 资源集中 → `isSetup` 永不置位会死等；必须提供超时/立即失败的兜底（或直接跳过 advSet）。
- 置信度：高（【实证】：handler、字段、字面量、回调全链）。未决项：无（RT 尺寸 1267 是原样立即数，见 advPrepare）。

### advPrepare

- handler：`0x317d14c`（共享体：无）
- 参数消费：pd[0] → `Prepare(objectName)`（`0x317d16c ldr x1,[x8,#0x20]` → `0x317d174 bl Prepare`）
- 行为（调用链 + 字段）：
  1. 要求 `controller.isSetup==1`（`0x317d154 ldrb w8,[x0,#0x38]; cbz → Normal`），否则整条跳过。
  2. `controller.Prepare(pd[0])`：实例化 prefab、把 demo 相机接进 RT、建演员表。
  3. `meshRenderBase(0x130).gameObject.SetActive(false)`；`meshAdvPrefabRenderBase(0x250).gameObject.SetActive(true)`。
  4. `meshAdvPrefabRenderBase`（ExUIMeshRenderer 虚函数槽 `0x3a8`）颜色置 (1,1,1,1)。
  5. `meshAdvPrefabRenderBase.SetImage(controller.renderTexture(0x20))` —— **3D 演出经 RenderTexture 合成到 2D quad**。
- 关键反汇编：

```
0x317d14c  ldr      x0, [x19, #0x248]      ; controller
0x317d154  ldrb     w8, [x0, #0x38]        ; isSetup 必须为 1
0x317d174  bl       #0x3169c80 CALL ScriptActionAdvPrefabController$$Prepare
0x317d194  bl       #0x4fd4510 CALL UnityEngine.GameObject$$SetActive   ; [0x130].SetActive(false)
0x317d1b4  bl       #0x4fd4510 CALL UnityEngine.GameObject$$SetActive   ; [0x250].SetActive(true)
0x317d1dc  blr      x9                     ; [0x250].set_color(1,1,1,1)
0x317d1f0  ldr      x1, [x8, #0x20]         ; controller.renderTexture
0x317d1f8  bl       #0x2e0c7ec CALL ExUIMeshRenderer$$SetImage
```

- 后端 API 地图：`ScriptActionAdvPrefabController$$Prepare @0x3169c80`（见下"共享体成员"）；`ExUIMeshRenderer$$SetImage @0x2e0c7ec`（把 RT 贴到全屏 mesh）；`ScriptManager.meshAdvPrefabRenderBase // 0x250`、`meshRenderBase // 0x130`（`class_ScriptManager.txt`）。
- 阅读器补齐要点：advPrepare = "切到 ADV 演出层"。Web 侧模型：`advLayer = { rtId, objectName, actors }`，把 `#adv-canvas`（或离屏 canvas）贴到全屏 <img>/CSS 背景并隐藏普通立绘层；若无资源则维持普通层。
- 置信度：高。未决项：无（demo 相机数量、演员性别显示条件见共享体成员）。

### advRelease

- handler：`0x31839d8`（共享体：无）
- 参数消费：无（handler 不读 pd[]）。
- 行为（调用链 + 字段）；
  - 要求 `controller.isSetup==1`，否则 Normal。
  - `meshAdvPrefabRenderBase(0x250).ClearImage()` @`0x2e0cabc` → `[0x250].SetActive(false)` → `[0x250].set_color(0,0,0,0)`（透明）→ `meshRenderBase(0x130).SetActive(true)`（恢复普通脚本渲染层）。
  - `controller.Release()` @`0x316a1c4`：`Destroy(demoRootObject(0x28))`→置 null；`actorDict(0x30)=null`；`RenderTexture.ReleaseTemporary(renderTexture(0x20))` @`0x4fbc1c8`→置 null；`AssetManager.releaseAsset(assetData(0x40))` @`0x2da4628`→置 null；`isSetup(0x38)=false`。
- 关键反汇编：

```
0x31839e8  ldr      x0, [x19, #0x250]
0x31839f4  bl       #0x2e0cabc CALL ExUIMeshRenderer$$ClearImage
0x3183a14  bl       #0x4fd4510 CALL UnityEngine.GameObject$$SetActive    ; [0x250]=false
0x3183a3c  blr      x9                     ; [0x250].set_color(0,0,0,0)
0x3183a5c  bl       #0x4fd4510 CALL UnityEngine.GameObject$$SetActive    ; [0x130]=true
0x3183a6c  bl       #0x316a1c4 CALL ScriptActionAdvPrefabController$$Release
```

- 后端 API 地图：`ScriptActionAdvPrefabController$$Release @0x316a1c4`；`AssetManager$$releaseAsset @0x2da4628`；`RenderTexture$$ReleaseTemporary @0x4fbc1c8`。
- 阅读器补齐要点：advRelease = 生命周期终点：销毁 demo 对象、注销演员表、释放 RT 与 assetbundle 引用、复位渲染层。纯逻辑可实现为释放对象/切回普通层；RT 与 assetbundle 引用在 Web 侧对应"释放 canvas/贴图引用 + 从 preload 计数中扣除"。
- 置信度：高。未决项：无。

### advActorShow / advActorHide

- handler：`advActorShow 0x318489c`；`advActorHide 0x317f138`（均无共享体）
- 参数消费：pd[0] → `ConvertNameString`（去首尾 `"`，`@0x31b1530`）→ `SetShow/SetHide(actorName)`：
  - show：`0x31848c0 ldr x1,[x8,#0x20]` → `0x31848cc bl ConvertNameString` → `0x31848dc bl SetShow`
  - hide：`0x317f15c` → `0x317f168 bl ConvertNameString` → `0x317f178 bl SetHide`
- 行为（调用链）：两者前置一致——`controller(0x248)` 存在且 `isSetup(0x38)!=0`；`SetShow @0x3169654`/`SetHide @0x3169788` = `actorDict(0x30).TryGetValue(name)` @`0x403749c` → `ActorController.Show() @0x3169358` / `Hide() @0x316937c`（均只剩 `GameObject.SetActive(true/false)`）。
- 关键反汇编：

```
0x3169688  ldr      x0, [x20, #0x30]        ; actorDict
0x31696a8  bl       #0x403749c CALL Dictionary$$TryGetValue
0x31696b8  bl       #0x3169358 CALL ScriptActionAdvPrefabActorController$$Show

0x3169358  ... Component$$get_gameObject
0x3169374  b        #0x4fd4510              ; GameObject$$SetActive(true)
```

- 阅读器补齐要点：纯逻辑缺口小：`actors[name].visible = true/false`；找不到名字 = 静默 no-op（TryGetValue 未命中直接返回）。名字需先做去引号转换。
- 置信度：高。未决项：无。

### advPlayAnimator

- handler：`0x318267c`（共享体：无；下列 `0x318274c` 的 tdelay 块是**下一条命令**的块，与 advPlayAnimator 无关——修正 presentation.md §6.3 的旧描述）
- 参数消费：pd[0] → `ConvertNameString`（actor 名）；pd[2] → `ConvertNameString`（trigger 名）：
  - `0x31826c0 bl ConvertNameString(pd[0])`；`0x31826d8 ldr x1,[x8,#0x30]`（pd[2]）→ `0x31826e8 bl ConvertNameString`
- 行为：
  - `IsJumpLine @0x31a3268` 为真 → 直接 Normal（跳读时不播）。
  - `pd.Count < 3` → Normal；要求 `isSetup==1`。
  - `controller.PlayAnimator(actorName, trigger) @0x316a0b4` = `actorDict.TryGetValue(actorName)` → `ActorController.PlayAnimator(trigger) @0x31692bc`：`animator(0x58)==null` 返回 false；否则 `IsGoNext(0x50)=false`；`Animator.SetTrigger(trigger) @0x4f80cd8`；返回 true。
  - 本 handler 直接 `b 0x3193f00`（Normal，**不注册 wait**）。
- 关键反汇编：

```
0x3182684  bl       #0x31a3268 CALL ScriptManager$$IsJumpLine
0x318268c  b        #0x3193f00              ; 跳读 → 不播
0x318269c  cmp      w9, #3                  ; 参数数 ≥3
0x31826c0  bl       #0x31b1530 CALL ScriptManager$$ConvertNameString     ; actor
0x31826e8  bl       #0x31b1530 CALL ScriptManager$$ConvertNameString     ; trigger
0x31826fc  bl       #0x316a0b4 CALL ScriptActionAdvPrefabController$$PlayAnimator
0x3182700  b        #0x3193f00              ; Normal
--- ActorController.PlayAnimator ---
0x3169328  strb     wzr, [x20, #0x50]       ; IsGoNext = false
0x3169338  bl       #0x4f80cd8 CALL UnityEngine.Animator$$SetTrigger
```

- 阅读器补齐要点：一次性的"给演员 Animator 抛 trigger"。Web 侧等价物 = 播放一段 CSS/SVG/精灵动画并由动画端点回填 `actor.goNext`（见 wait 集成）。
- 置信度：高（handler/actor 全链实证）。未决项：见下 wait 集成（ProcessScript 侧的 wait 分支存在但没有定位到赋值点）。

### 共享体成员：ScriptActionAdvPrefabController / ActorController / GoNextState / CameraLocator / LightSetting

- `ScriptActionAdvPrefabController`（dump.cs:164950，TypeDefIndex 4779）字段：`renderTexture 0x20`、`demoRootObject 0x28`、`actorDict 0x30`（`Dictionary<string, ScriptActionAdvPrefabActorController>`）、`isSetup 0x38`、`assetData 0x40`、`isPaused 0x48`。方法 VA：`GetAssetName 0x3169B74`、`Setup 0x3169BC0`、`Prepare 0x3169C80`、`PlayAnimator 0x316A0B4`、`CheckGoNext 0x316A138`、`SetShow 0x3169654`、`SetHide 0x3169788`、`Release 0x316A1C4`、`Pause 0x316A2CC`、`get_IsGoNext 0x3169A48`。
- `Prepare` 全流程（`0x3169c80->0x316a0b4`）：
  1. `renderTexture==null` → `RenderTexture.GetTemporary(1267, 576, 24)`（立即数 `0x4f3/0x240/0x18`，`0x3169d88-0x3169d9c`）并写回 `0x20`。
  2. `demoRootObject!=null && name!=objectName` → `Destroy` + 置 null。
  3. `Instantiate(assetData.GetObject<GameObject>(objectName), this.transform)` → `set_name(objectName)`。
  4. `GetComponentsInChildren<Camera>()` → 逐个 `camera.targetTexture = renderTexture`（`0x3169f14-0x3169f1c`）。
  5. `actorDict = new Dictionary<...>()`；`GetComponentsInChildren<ScriptActionAdvPrefabActorController>()` → `SetDisplay(genderType)` @`0x3169188`（返回 false 的演员被 SetActive(false) 且不入表）→ true 的再 `SetGender(genderType)` @`0x316920c`（`Animator.SetInteger("gender", v)`，字面量 `'gender'`）→ `dict.Add(actor.ActorName(0x20), actor)` → 若 `isPaused(0x48)` 则 `actor.Pause(true)`。
  - `genderType` 来源：`0x317...` 类元数据 `[class+0xb8][8]`（单例的性别枚举，1=男 2=女；与 `SetDisplay` 的比较 `w1==1&&cond==Male(2)` / `w2==2&&cond==Female(4)` 自洽）。
- `ScriptActionAdvPrefabActorController`（dump.cs:164799，4774）字段：`ActorName 0x20`、`displayCond 0x28`（`DisplayCond{Always=0,Male=2,Female=4}`，dump.cs:164919）、`FollowTarget 0x30`、`followOffsetPosition 0x38`、`followOffsetAngle 0x44`、`IsGoNext 0x50`、`animator 0x58`。方法 VA：`Awake 0x3169044`（`animator=GetComponent<Animator>`；`GetBehaviours<ScriptActionAdvPrefabActorGoNextState>` 后逐个 `SetOwner`；**Awake 末尾把 IsGoNext 置 1**，`0x3169174`）、`SetDisplay 0x3169188`、`SetGender 0x316920c`、`PlayAnimator 0x31692bc`、`Show 0x3169358`、`Hide 0x316937c`、`GoNext 0x31693a0`、`Pause 0x31693ac`、`Update 0x31693d8`（跟随 FollowTarget：`pos=target.pos+followOffsetPosition`，`euler=target.euler+followOffsetAngle`）、`ShowActor/HideActor 0x316959c/0x31696d0`（= 从 prefab 内部转调控制器 SetShow/SetHide）。
- `ScriptActionAdvPrefabActorGoNextState`（属性 `owner 0x18`，`OnStateEnter 0x3169834`）：`owner.IsGoNext(0x50)=true` —— 动画状态机里打了这个 behaviour 的状态进入时，等待中的脚本继续。【实证】这解释了 `PlayAnimator` 先清 IsGoNext 再 SetTrigger 的配对设计。
- `ScriptActionAdvPrefabCameraLocator`（`Locator 0x20`、`targetRig 0x28`、`scaleToCameraParameter 0x30`、`targetCameras 0x38`；`LateUpdate 0x31698e0`）：每帧把自身 transform 对齐到 targetRig/Locator。
- `ScriptActionAdvPrefabLightSetting`（`Start 0x316a4dc`）：`RenderSettings.ambientMode=3(Custom)`、ambientSkyColor、fog、fogColor/fogMode/fogDensity/fogStartDistance…（`OnDestroy 0x316a550` 应恢复）。这些是 prefab 自带辅助组件，**不是脚本命令**，Web 侧只需知道它们存在（灯光/相机跟随）。
- 控制器 `Pause(bool)` @`0x316a2cc`：`isPaused(0x48)=pause&1` + 对 dict 全部演员 `Action → x.Pause(pause)`（`<Pause>b__23_0 @0x316a3c0`）。**没有对应脚本命令**（语料 adv* 0 次；推断由系统流程直接调用）。
- `get_IsGoNext` @`0x3169a48`：`actorDict.Values` → `Enumerable.All(x=>x.IsGoNext)`（lambda `<get_IsGoNext>b__12_0 @0x316a44c` 读 `x+0x50`）。
- `CheckGoNext(actorName)` @`0x316a138`：命中 actor 返回其 `IsGoNext`；**未命中返回 true**。

### "3D 演出是否走 RenderTexture 合成"——是（直证）

- ADV prefab 内的相机在 `Prepare` 里被逐个 `targetTexture = controller.renderTexture`（`0x3169f1c`），RT 由 `GetTemporary(1267,576,24)` 创建（`0x3169d98`）；
- `advPrepare` 把该 RT `SetImage` 到 `ScriptManager.meshAdvPrefabRenderBase(0x250)`（ExUIMeshRenderer 全屏 quad），同时关闭普通 `meshRenderBase(0x130)`（`0x317d1f8` / `0x317d194`）。
- 因此链路 = `ADV prefab 相机 → RenderTexture(1267×576) → ExUIMeshRenderer(meshAdvPrefabRenderBase) → 剧情画面`。【实证】
- 引用 `ScriptActionSetRenderTextureComponent` 的地方：它是**场景 prefab 侧**组件（不是命令），`Start @0x316d184` 按 `textureType` 取纹理——`RenderTarget(0)` → `ScriptManager.GetRenderTargetTexture @0x31a02e4`（= `renderTextureCamera(0x138).targetTexture`）；`Capture(1)` → `ScriptManager.captureTexture(0x268)`——然后写到 `TargetObjects` 及子节点材质的 mainTexture/scale/offset（静态字段 `.cctor @0x316d3c4`；常量 `ScriptActionRenderWidth=1344`、`ScriptActionRenderHeight=576`；Tooltip："スクリプトでcaptureした画像を使用する場合はCaptureを選択してください"）。即：**capture 的产物被同屏素材引用**，与 ADV 的 RT 是两条独立通道。

### adv* 的 wait 集成与结束条件（ProcessScript state==WAIT 分派）

- `ScriptManager.Update @0x31bc278`：`state(0x288)==4 && waitType(0x3D8)=="time"` → 用 `Time.deltaTime`，否则 `RealTime.deltaTime`；随后 `ProcessScript`。
- `ProcessScript @0x31bc344` 的 state==4 分支（`0x31bd140` 起）以 `ComputeStringHash(waitType)` 二次分派：
  - `waitType=='advSet'`（hash `0x4799d20a`，`0x31bdef4 → 0x31c002c`）：

```
0x31c0048  ldr      x8, [x19, #0x248]      ; controller
0x31c0050  ldrb     w8, [x8, #0x38]        ; isSetup
0x31c0054  cbnz     w8, #0x31bd0d4         ; setup 完成 → 前进到下一行
0x31c0058  b        #0x31c2850             ; 否则本帧继续等
```

  - `waitType=='advPlayAnimator'`（hash `0x4c63a509`，`0x31be49c → 0x31c0380`）：

```
0x31c039c  ldr      x0, [x19, #0x3e8]      ; waitName
0x31c03a4  bl       #0x4871c3c CALL String$$IsNullOrEmpty
0x31c03bc  bl       #0x3169a48 CALL ScriptActionAdvPrefabController$$get_IsGoNext   ; waitName 空:所有演员 IsGoNext
0x31c03c0  tbnz     w0, #0, #0x31bd0d4     ; 全就绪 → 前进
0x31c0c50  bl       #0x316a138 CALL ScriptActionAdvPrefabController$$CheckGoNext   ; 否则按名字查单个演员
```

  - 结束条件总结：advSet 等 `controller.isSetup`；advPlayAnimator 的设计语义 = 等演员动画到达 GoNext 状态（Actor.Awake/GoNextState 都置 `IsGoNext=true`，PlayAnimator 先清零）。advActorShow/Hide/Prepare/Release **不注册 wait**（直接前进）。
- **未决项（重要）**：全二进制中字符串 `'advPlayAnimator'` 只被"比较"（dispatcher verify `0x318266c` 与 wait 分支 `0x31c0390`），**没有任何一处把它写入 `waitType(0x3D8)`**（全量扫描 `str ...,[xN,#0x3d8]` 站点清单可复现），即 `waitType=='advPlayAnimator'` 分支在 2.139.3 很可能是**死代码**（历史残留）。因此回放器的正确做法：按语义实现"advPlayAnimator 后可选等待演员 GoNext"，但默认按 2.139.3 行为**不等待**。adSet 的 waitType 赋值路径已逐条确认（`x22=&tag` → `0x3184a20`）。【实证 + 标注：advPlayAnimator 的 waitType 赋值点未定位】

---

## 影片（movie / criMovie）

### movie / criMovie（共享 handler `0x3183c38`）

- handler：`0x3183c38`（共享体：**movie 与 criMovie 完全同一处理体**；verify 块 `0x3183c1c-0x3183c34` 比较 `'criMovie'`，`movie` 由 hash 分支 `0x31831d4` 载入 `'movie'` 槽后 `b 0x3183c24` 复用同一比较指令——两 tag 各自与自身字面量比对通过后落到同一 handler）
- 参数消费（顺序）：
  1. `IsFastPlaySpeed @0x31b5344`(=`playScriptJumpLine(0x408)<0 || isBacklogOnly(0x392)` 或 `playSpeed(0x28C)==3`) 为真 → 返回 Normal（**快进时完全不播**）。
  2. 参数个数 ∈ {2,4,6,8,10}：`cmp w8,#9; mov w9,#0x2aa; tst`（位集 {1,3,5,7,9}，奇数位是分隔符）——否则 'parameter error'。
  3. `IsJumpLine @0x31a3268` 为真 → 返回 Normal（**跳读时完全不播**）。
  4. 4 次 `BasicHelper.Any<object>(pd, Func<string,bool>) @0x38449f0`，谓词 = `DisplayClass808_0` 上的 lambda（尾调用直证）：
     - `b__4 @0x31cb754 → ConvertCRIMovieBgmStop @0x31b3cd0` = `x.Equals("bgmStop")`
     - `b__5 @0x31cb76c → ConvertCRIMovieSeStop @0x31b3d24` = `"seStop"`
     - `b__6 @0x31cb784 → ConvertCRIMovieVoiceStop @0x31b3d78` = `"voiceStop"`
     - `b__7 @0x31cb79c → ConvertCRIMovieScriptStop @0x31b3dcc` = `x.ToLower().Equals("false")`
  5. `ConvertCRIMovieName(pd[0])` → `PlayCRIMovie(name, isBgmPause, isScriptStop, isSePause, isVoicePause)`：实参 = `w2=Any(bgmStop)`、`w3=!Any("false")`、`w4=Any(seStop)`、`w5=Any(voiceStop)`（`0x3183db8-0x3183dd0`）。
  6. 注册等待：`state=4` + `waitType='movie'`（**硬编码 'movie' 字面量**，`0x3183dd4-0x3183de8` → 尾块 `0x3192e70`）。
- 关键反汇编：

```
0x3183c40  bl       #0x31b5344 CALL ScriptManager$$IsFastPlaySpeed
0x3183c48  b        #0x3193f00              ; 快进 → 不播
0x3183c68  mov      w9, #0x2aa              ; 参数个数掩码 {2,4,6,8,10}
0x3183c7c  bl       #0x31a3268 CALL ScriptManager$$IsJumpLine
0x3183c84  b        #0x3193f00              ; 跳读 → 不播
0x3183db0  bl       #0x31b3c84 CALL ScriptManager$$ConvertCRIMovieName
0x3183dc0  and      w4, w21, #1             ; isSePause   = Any('seStop')
0x3183dc4  and      w5, w22, #1             ; isVoicePause= Any('voiceStop')
0x3183dcc  bl       #0x31bbe00 CALL ScriptManager$$PlayCRIMovie
0x3183de0  str      w9(#4), [x19, #0x288]   ; state=WAIT
0x3183de8  b        #0x3192e70              ; 共享尾块: waitType='movie'
```

- 播放的阻塞/跳过语义（ProcessScript state==WAIT，`waitType∈{movie,criMovie}`；criMovie 由 hash `0x1dcc0581` → `0x31bdbcc` 载入 `'criMovie'` 后 `b 0x31c03d0` 复用比较）：

```
0x31c03ec  ldr      x25, [x19, #0x5c8]      ; ScriptManager.cRIMoviePlayer
0x31c040c  bl       #0x4fd3cbc CALL Object$$op_Inequality
0x31c0410  tbz      w0, #0, #0x31bd0d4      ; 播放器已销毁(movie 结束) → 前进
0x31c0414  ldrb     w8, [x19, #0x6e0]       ; isScriptExecuteMoviePlay
0x31c0418  cbnz     w8, #0x31bd0d4          ; 非阻塞模式 → 也前进(影片后台继续)
0x31c041c  b        #0x31c2850              ; 否则本帧继续等
```

  - ⇒ **默认阻塞**（等 `cRIMoviePlayer==null`，即播完/被跳过销毁）；行内出现 token `false`（语料写法 `bgmPlay false`）→ `isScriptExecuteMoviePlay(0x6E0)=1` → **非阻塞**，脚本继续，影片留在后台。
  - 用户点击跳过由播放器自身处理（`CRIMoviePlayer.IsStoppable/IsPlaying/MovieStop`；跳过按钮 `enableSkipButton=false`，`isCanSkip` = `isScriptStop && isCollection(0x371)`）。
  - `movie` vs `criMovie`：2.139.3 中行为完全一致（同名转换、同 PlayCRIMovie、wait 类型统一记 'movie'）；差别仅是历史别名。【实证】
- 关键反汇编（PlayCRIMovie 主体，`0x31bbe00`）：

```
0x31bbf30  bl       #0x2da3fec CALL AssetManager$$getAsset          ; 同步取 Movie/xxx.usm
0x31bbf58  bl       #0x39ad800 CALL UnityEngine.Resources$$Load     ; x0='CRIMovie/CRIMoviePlayerWithPanel'
0x31bbfb8  bl       #0x39284ec CALL UnityEngine.Object$$Instantiate
0x31bbfc4  bl       #0x38ed51c CALL GameObjectExtensions$$RemoveComponent  ; ×2(去掉 prefab 多余组件)
0x31bc044  bl       #0x4fd444c CALL UnityEngine.GameObject$$set_layer   ; layer=13
0x31bc050  bl       #0x38ebe30 CALL UnityEngine.GameObject$$GetComponent  ; → CRIMoviePlayer
0x31bc05c  str      x0, [x24, #0x5c8]     ; cRIMoviePlayer
0x31bc0b4  bic      w10, w9(#1), w25     ; isScriptExecuteMoviePlay = !isScriptStop
0x31bc0bc  str      w8, [x24, #0x328]     ; executeIndexMovie = executeIndex
0x31bc0c0  strb     w10, [x24, #0x6e0]
0x31bc0b8  strb     w9(=1), [x24, #0x6e1] ; isNeedSkipStateAfterMovie = true
0x31bc22c  bl       #0x2486110 CALL CRIMoviePlayer$$Initialize
0x31bc270  b        #0x2486460            ; 尾调 CRIMoviePlayer.MoviePlay(isBgmPause,isSePause,isVoicePause,false)
```

- 后端 API 地图：
  - `ScriptManager$$ConvertCRIMovieName @0x31b3c84` — `String.Format('Movie/{0}.usm', s)`（字面量 `'Movie/{0}.usm'` 槽 `0x5573440`；同为 `String$$Format @0x4868ad0`）。
  - `ScriptManager$$PlayCRIMovie @0x31bbe00` — 载入 `Movie/<name>.usm` + 实例化 `CRIMovie/CRIMoviePlayerWithPanel`（Unity Resources，非 AssetBundle）→ `CRIMoviePlayer.Initialize @0x2486110(name, path, volume, isCanSkip, cpk, callBack, isCanControl=1, cinemascopeSideFrame=0, targetAlpha, fadeStartFrame, isLoadModeToDefaultWhenDestory=true, nonDeleteCallBack, startCallBack, enableSkipButton=false)` → `CRIMoviePlayer.MoviePlay @0x2486460`。
  - `CRIMoviePlayer : CriManaMovieController : CriManaMovieMaterial : CriMonoBehaviour`（dump.cs:278328）——**后端 = CRIWARE CriMana (Sofdec2)**，不是 Unity VideoPlayer。包装类字段：`texture(UITexture) 0xB8 / touch 0xC0 / background 0xC8 / busyAnim 0xD0 / debugLabel 0xD8 / callBack 0xE0 / isPlaying 0xF8 / isCanSkip 0x100 / isCanControl 0x101 / cinemascopeSideFrame 0x108 / isVoicePauseEnded 0x110 / isBgmPauseEnded 0x111 / isSePauseEnded 0x112 / IsEnableSkipButton 0x113`；协程 `<PlaySequence>d__44`、`<StopSequence>d__45`、`<SeekSequence>d__46`、`<PlaySeekSequence>d__47`（逐帧 `WaitForEndOfFrame` 等 Seeking/DispTexture，即"异步播放 + 可寻址"）；`MovieSeekByFrame/MovieSeekByRelativeTime` = 快进/回退。
  - 二进制里的 CriMana 相关类（dump.cs 989177+）：`CriManaPlugin`、`CriManaMovieController`、`CriManaMovieControllerForUI`、`CriManaMovieMaterial`、`CriManaMoviePlayerHolder`、`CriManaAmbisonicSource`、`CriManaConfig`（含 `PCH264PlaybackConfig/VitaH264PlaybackConfig/WebGLConfig`）+ `CRIMoviePlayer` 包装。
  - 断点续播：`MovieResumeKey(静态 0x68)`、`PlayedLastMovieKey(0x70)`；`SaveMovieResumeInfo/DeleteMovieResumeInfo/HasMovieResumeKey/GetMovieResumeInfo @0x31c84f0..0x31c8738`、`HasPlayedLastMovieKey/SavePlayedLastMovie`。
- 资源：影片名 → `Movie/{0}.usm`；播放器 prefab `CRIMovie/CRIMoviePlayerWithPanel`；语料 181 次 `criMovie`（119×`bgmPlay false`、60×`bgmPlay true`、2×`talk_mov151_M/_F`）+ 1 次 `movie talk_mov010`；**`bgmPlay` 这个 token 在 2.139.3 二进制里没有对应字面量**（不存在 `'bgmPlay'`，只有 `bgmStop/seStop/voiceStop/false`），因此 `bgmPlay` 被忽略，行为实际由 `false` token 决定（见上）。【实证 + 语料实证】
- 阅读器补齐要点：
  - a) 纯逻辑缺口（必须做）：`Movie/{0}.usm` 名称转换；`[criMovie name bgmPlay …]` 解析为 `{name, blocking=!contains('false')}`；wait 语义（阻塞=等资源放完/skip；非阻塞=立即继续）；快进/跳读时整条命令跳过且不注册 wait。
  - b) 需原始资源：USM(CRI Sofdec2) 视频无法在浏览器解码。降级：用占位层（黑屏/“影片播放中”+ 进度条）按 `ConversionsCRIMovieName` 找到的预计时长播放 CSS 过渡，或若资源目录里存在同名的 mp4/webm（二次转码产物）则用 `<video>`；skip/点击必须能在占位层上生效（对应 `MovieStop`）。
  - c) 需游戏数据源：无（影片名内联在脚本里）。
- 置信度：高（handler、wait 分支、PlayCRIMovie、CRIMoviePlayer 全链实证；`bgmPlay` 未命中为实证）。未决项：`isCanSkip=isScriptStop&&isCollection` 的设计意图未百分百确证（INFERRED：仅合集回放中允许中途跳过）。

---

## 截屏及渲染模式

### capture

- handler：`0x3181454`（共享体：无参数；**capture 不读 pd[]**——params-visual 里 pd[4] "截图/渲染目标相关字符串"是邻接命令串入，属误报）
- 行为（调用链 + 字段）：
  1. `renderTextureCamera(0x138).targetTexture`（`0x3181460 bl Camera$$get_targetTexture`）；为 null → `scriptErrorMessage='capture error'`（`0x318149c`）并返回 Normal（脚本继续；`0x318d24c ldr x1,[x8]; str x1,[x21]`，x21=ref scriptErrorMessage）。
  2. `RenderTexture.IsCreated()` 为假 → 注册 wait：`state=4` + `waitType='wipe'`（`0x318c704-0x318c710` → `0x318cb8c` 写 `0x3d8`），等当前划像结束（ProcessScript `0x31c04b0-0x31c04c0`：`isExecuteWipe(0x5A8)==0 || isWipeFilter(0x5AA)!=0` 才前进）。
  3. `meshCaptureBase(0x128).ClearImage()`（`0x318a0e0`）。
  4. `captureTexture(0x268) = RenderCameraSwap(this, captureTexture) @0x31a010c`。
  5. `captureTexture!=null` → `meshCaptureBase(0x128).SetImage(captureTexture)` + 颜色 (1,1,1,1)（`0x318a138-0x318a168`）。
- `RenderCameraSwap(this, oldRT) @0x31a010c`（**冻结/切换渲染目标的核心**，全部实证）：

```
0x31a016c  bl       #0x4f99b70 CALL Camera$$get_targetTexture   ; 当前 RT
0x31a01b4  bl       #0x4fd9ac4 CALL Object$$set_name           ; 旧 RT 更名 'captureScriptActionRednerTexture'
0x31a01dc  ldrb     w1, [x19, #0x731]                         ; isMaskEnabled
0x31a01e0  bl       #0x319f910 CALL ScriptManager$$CreateRenderTexture   ; 新 RT
0x31a0200  bl       #0x4fd9ac4 CALL Object$$set_name           ; 新 RT 更名 'TempScriptActionRednerTexture'
0x31a0214  bl       #0x4f99c40 CALL Camera$$set_targetTexture  ; renderTextureCamera(0x138) → 新 RT
0x31a0228  bl       #0x4f99c40 CALL Camera$$set_targetTexture  ; mapCamera(0x148)         → 新 RT
0x31a023c  bl       #0x4f99c40 CALL Camera$$set_targetTexture  ; ui2dCamera(0x150)        → 新 RT
0x31a0250  bl       #0x2e0c7ec CALL ExUIMeshRenderer$$SetImage ; meshRenderBase(0x130) ← 新 RT(直播画面)
```

  - 随后对三台相机 `Behaviour.set_enabled(false)` → 再 `(true)`（三个 `0x31a0264/0x31a0278/0x31a028c` 与 `0x31a02a0/0x31a02b4/0x31a02c8`）强制刷新。
  - `ScriptManager$$CreateRenderTexture @0x319f910`：`isMaskEnabled==1` → `RenderTexture.GetTemporary(RenderTextureDescriptor(1024,1024,0,depth24))`；否则 `RenderTexture.GetTemporary(1024,1024,0,0)`（立即数 `0x400`）。**capture 用 1024×1024 RT**。
  - 名称字面量：`'captureScriptActionRednerTexture'`（原文拼写如此，Redner=Render 的笔误）/`'TempScriptActionRednerTexture'`（`0x31a013c/0x31a0148`）。
- 阅读器补齐要点：
  - 数据模型：`captureTexture`（冻结帧）+ `liveRT`（照常演出的层）。语义 = "把当前画面冻结成贴图，之后场景继续变"；语料用法（`0100062811.txt:148-154`）：`[capture]` → `specialEffect/charaFadeout/…` → `[captureRelease]`；`0400070540.txt:910`：`[capture]` 后接 flash/effect/scene 变化。
  - Web 替代：若场景层是 canvas(2D/WebGL) → `drawImage` 快照到离屏 canvas 并叠在上层，语义 1:1；若场景是 DOM/CSS 实现 → 无法真正快照（html2canvas 类方案边界：跨域资源/滤镜/混合模式丢失）→ 降级为"冻结交互但保留画面"（无变化）或 no-op。相机/名称等参数：**capture 无参数**；涉及相机固定为 renderTextureCamera(0x138)（+mapCamera 0x148、ui2dCamera 0x150）。
  - 资源：使用 1024×1024 临时 RT（见上），无资产依赖。RT 由 `captureRelease` 释放。
- 置信度：高。未决项：**captureRelease 不把三台相机切回旧 RT**（只 `Release()+Destroy` 旧捕获 RT，`0x3182418-0x3182444`）；下一轮 capture 通过 `RenderCameraSwap` 重新更名新 RT——推断旧 RT 从"当前 RT"替换后由后续流程统一回收（未定位该回收点）。另 `meshCaptureBase(0x128)` 与 `meshRenderBase(0x130)` 的画面叠放次序未定位（INFERRED：capture 层在上）。

### captureRelease

- handler：`0x31823a4`（共享体：无，无参数）
- 行为：`captureTexture(0x268)!=null` 时：`meshCaptureBase(0x128).set_color(0,0,0,0)`（`0x31823fc blr`）→ `[0x128].ClearImage()` → `captureTexture.Release() @0x4fbbdb0` → `Object.Destroy(captureTexture)` → `str xzr,[x19,#0x268]`（置空）→ Normal。`captureTexture==null` 时直接 Normal（幂等）。
- 关键反汇编：

```
0x31823cc  bl       #0x4fd3cbc CALL Object$$op_Inequality   ; captureTexture != null
0x31823fc  blr      x9                                   ; meshCaptureBase.color=(0,0,0,0)
0x3182410  bl       #0x2e0cabc CALL ExUIMeshRenderer$$ClearImage
0x3182420  bl       #0x4fbbdb0 CALL RenderTexture$$Release
0x3182440  bl       #0x4fda4d8 CALL Object$$Destroy
0x3182444  str      xzr, [x19, #0x268]
```

- 阅读器补齐要点：丢弃快照、恢复直播；幂等（无快照时 no-op）。
- 置信度：高。未决项：同 capture（相机 RT 回收点）。

### backCameraColor（相机清屏色）

- handler：`0x317cb6c`（共享体：无）
- 参数消费：pd[0]（pd.Count≥1 时）：
  - `pd[0]=='false'`（`0x317cb94 bl String$$op_Equality`）→ `margeCamera(0x140).clearFlags = 3`（Depth，只清深度）→ Normal。
  - 否则：取 pd[0]；参数为空时用字面量 `'000000'`（`0x318b784`）；要求 `String.length==6`（`0x318b79c cmp w8,#6`）；`String.Concat("#", s)`（`0x318b7b4`）→ `ColorUtility.TryParseHtmlString(out color)`（`0x318b7c0`）；失败 → `scriptErrorMessage='parameter error'`（`0x318d244`）。
  - 成功 → `margeCamera(0x140).clearFlags = 2`（SolidColor）；`margeCamera.backgroundColor = color`（`0x318b7d8`/`0x318b7f8`）。
- 关键反汇编：

```
0x317cb94  bl       #0x4870cc0 CALL String$$op_Equality      ; pd[0]=='false'
0x317cbb0  bl       #0x4f995fc CALL Camera$$set_clearFlags   ; margeCamera.clearFlags=3
0x318b7b4  bl       #0x4867ef8 CALL String$$Concat          ; "#"+pd[0]
0x318b7c0  bl       #0x4fc0a28 CALL ColorUtility$$TryParseHtmlString
0x318b7d8  bl       #0x4f995fc CALL Camera$$set_clearFlags   ; clearFlags=2(SolidColor)
0x318b7f8  bl       #0x4f99474 CALL Camera$$set_backgroundColor
```

- 后端 API 地图：`ScriptManager.margeCamera // 0x140`（`class_ScriptManager.txt`）；`margeCameraBackgroundColor // 0x41C`（另有内部字段，命令只走 camera 属性）。
- 语料：`[backCameraColor]` 43 次全部无参（= 用默认 `000000` 设黑？不——无参时 `cmp w9,#1; b.lt` 走 `0x318b778` 用 `'000000'` 走颜色分支，即黑色 SolidColor）。注意 pd.Count==0 与 `'false'` 是不同路径。
- 阅读器补齐要点：纯逻辑：给"黑边/信箱条区域"（margeCamera 覆盖的背景）设颜色；`false` = 关闭纯色清屏（露出下层）。Web 侧映射为页面容器背景色/黑边 div 颜色；无参 = #000000。
- 置信度：高。未决项：无。

### useSimpleMeshFigure

- handler：`0x317ba14`（共享体：**共享尾块 `0x3193f04`（直接返回 Normal）**，即仅列表写入）
- 参数消费：遍历**全部 pd 元素**；元素等于 `','`（字面量 `0x55704b8`）→ 跳过；否则 `ConvertNameString(元素)` → `simpleMeshFigureNames(0x788).Add(name)`（List.Add @`0x201abc4`）。

```
0x317ba50  bl       #0x4870cc0 CALL String$$op_Equality      ; 元素==','
0x317ba64  ldr      x21, [x19, #0x788]                     ; simpleMeshFigureNames
0x317ba74  bl       #0x31b1530 CALL ScriptManager$$ConvertNameString
0x317ba88  bl       #0x201abc4 CALL List$$Add
```

- 后端 API 地图：`ScriptManager.simpleMeshFigureNames // 0x788`（`List<string>`）；消费点 `ScriptManager.IsUseSimpleMeshFigure(servantId) @0x31c82d4` → `List.Contains`（composition.md §6 已录）。
- 阅读器补齐要点："简化网格立绘"名单——用低精度立绘网格渲染这些从者（省内存）。Web 侧 = 对名单内 servantId 使用简化贴图/降采样。语料仅 1 次：`[useSimpleMeshFigure 1009000,1098321800]`（0400051911.txt:15），逗号与空格都是分词。
- 置信度：高（实现实证）；`IsUseSimpleMeshFigure` 的调用效果（渲染路径）为【推断】。

---

## endFade（结束淡出）

### endFade

- handler：`0x31843b4`（共享体：无）
- 参数消费：要求 pd.Count **恰为 1**（`cmp w9,#1; b.ne #0x3193e80`），pd[0] 与字面量比较：
  - `'clear'`（`0x31843e0`）→ `startMode(0x280) = 9`
  - `'black'`（`0x318c314`）→ `10`
  - `'white'`（`0x318df38`）→ `11`
  - 其他值 → 无操作，返回 Normal。
- 行为：唯一效果就是写 `ScriptManager.StartMode startMode // 0x280`：

```
0x31843dc  bl       #0x4870cc0 CALL String$$op_Equality   ; pd[0]=='clear'
0x31843e8  mov      w8, #9
0x318c314  bl       #0x4870cc0 CALL String$$op_Equality   ; 'black'
0x318c31c  mov      w8, #0xa
0x318df38  bl       #0x4870cc0 CALL String$$op_Equality   ; 'white'
0x318c324  str      w8, [x19, #0x280]                    ; startMode = 9/10/11
```

- 枚举（dump.cs:167144 `ScriptManager.StartMode`）：`CLEAR_FULL=9`、`BLACK_FULL=10`、`WHITE_FULL=11`（`CLEAR=5/BLACK=6/WHITE=7` 被 `end <color>` 直接使用）。
- 与 end 的衔接（全链，逐点 VA）：
  1. `end`/`interruption` handler `0x317f9c4`：`isScriptInterruption(0x459) = tag.Equals('interruption')`（`0x317f9dc`）；
     - pd.Count==1 → `EndExecuteScript(pd[0])`（`0x318b4f4 bl @0x31b2824`）；
     - pd.Count==0（`[end]`）→ `0x3188dc0 cbz → 0x318b4e8`：`EndExecuteScript(null)`；
     - pd.Count>1 → scriptErrorMessage=`'parameter be unnecessary'`（`0x3188dc8`）。
  2. `EndExecuteScript(color) @0x31b2824`：
     - `inputSelectBranchCount(0x430)=0`、`DeleteFlagInfo()`、CommonUI 淡出（对 CommonUI 若干 TweenAlpha.Begin）；
     - `GetEndMode(color) @0x31b402c`：
       - `IsNullOrEmpty(color)` → **返回 `startMode(0x280)`**（即 endFade 设定的 9/10/11）；
       - `'white'` → 7、`'black'` → 6；否则 startMode。
     - 按 mode 分族（`0x31b2914` 起的位测试）：
       - 黑族 {1,6,10,12,16}（含 `BLACK_FULL=10`）：若 `CommonUI.maskFadGetFadeoutKind()==1` 已黑 → 跳过；否则 `CommonUI.maskFadeout(kind=1, dur)`，若当前 fade 已是黑（`GetFadeoutType @0x31b40d0 == 1`）则 dur=0 瞬间到位（`0x31b2994-0x31b29e8`）；
       - 白族 {2,7,11,13}（含 `WHITE_FULL=11`）：同构，kind=2（`0x31b2954-0x31b299c`）；
       - clear 族 {3,4,5,9}（含 `CLEAR_FULL=9`）：`StartFade('clear', …) @0x31b2a08`（释放淡出，画面保持透明）；
       - 其他 mode：什么都不做。
     - 收尾 `state(0x288)=6`（WAIT_EXIT）（`0x31b2a80-0x31b2a88`）。
  3. `ExitExecuteScript @0x31b42d0`：`startMode==16(BLACK_SCENE_STOP)` → `AvalonSceneManager.setTargetRootActive(true)`（`0x31b42e8-0x31b4310`），随后 `state=0`。
- 关键反汇编（GetEndMode）：

```
0x31b4070  bl       #0x4871c3c CALL String$$IsNullOrEmpty
0x31b4078  ldr      w0, [x19, #0x280]     ; 空 → 读 endFade 设的 startMode
0x31b409c  mov      w0, #7                 ; 'white'
0x31b40c0  mov      w0, #6                 ; 'black'
--- EndExecuteScript 收尾 ---
0x31b2a7c  bl       #0x23be2ec CALL CommonUI$$maskFadeout   ; (dur, kind=1/2)
0x31b2a8c  str      w8(#6), [x19, #0x288]                  ; state=WAIT_EXIT
```

- 语料：**1 次**——`Final Singularity/0100082211.txt:931 [endFade white]`，其 4 行后即 `:935 [end]`（`[end]` 无参 → startMode=WHITE_FULL=11 → 白族 → 结束前白色淡出）。【语料实证】
- 阅读器补齐要点：
  - 纯逻辑：命令本身只写 `startMode`；真正的效果在 `end` 时按 `GetEndMode` 分族执行"遮罩淡出到黑/白"或 StartFade('clear')。最简：`endFade <color>` 存值；`end`（无参）→ 屏幕以对应颜色淡出并结束脚本；`end black|white` 覆盖；`endFade clear` → 结束时不加淡出（清掉已有 fade）。
  - 注意 `end` 的 pd[0]=`' '`（空格占位）也按空字符串处理（`IsNullOrEmpty` 对 " " 不成立；但 `[end]` 是 count=0 路径，已实证）。
- 置信度：高（handler/枚举/GetEndMode/EndExecuteScript/ExitExecuteScript 全链实证 + 语料 1:1 对应）。未决项：`WHITE_FULL/BLACK_FULL/CLEAR_FULL` 中 "FULL" 与其他变体（如 `WHITE_CLEAR`）的差异在本组命令里未使用（语料仅 white 1 次）；`CommonUI.maskFadeout` 的具体 UI 实现不在本组范围（per presentation.md §3.3）。

---

## 本组小结

### 缺口分类（按命令）

| 命令 | 语料次数 | 类别 | 说明 |
|---|---|---|---|
| advSet/Prepare/Release/ActorShow/ActorHide/PlayAnimator | 0（adv 全族） | b) 需原始资源 + a) 纯逻辑 | 逻辑全链已实证；`ADV/{0}` prefab 是 Unity prefab+Animator+RT 相机，Web 侧无对应资产 → 最简实现为 no-op/日志降级 |
| movie/criMovie | 181+1 | a) 纯逻辑（名称/wait/skip） + b) USM 资源 | 181 次说明**阅读器必须至少实现"占位影片 + 正确 wait/skip"**；USM 解码不可行 → 占位层（或二次转码 mp4） |
| capture / captureRelease | 14 / 1 | a) 纯逻辑 + b) 需渲染后端能力 | 快照语义明确；canvas 实现可 1:1，DOM 渲染需降级 |
| backCameraColor | 43 | a) 纯逻辑 | 仅设容器背景色/黑边色，最高性价比 |
| useSimpleMeshFigure | 1 | a) 纯逻辑（名单） + c) 数据源 | 名单本身在脚本里；简化贴图需要资源（缺则忽略） |
| endFade | 1 | a) 纯逻辑 | 与 `end` 的 startMode 链已完整实证 |

### 最小可交付实现（建议顺序）

1. **endFade + free `end`**：`startMode` 字段 + `GetEndMode` 三分支 + 结束遮罩淡出（黑/白/clear）——语料 1 次但成本极低。
2. **backCameraColor**：43 次，一次 setter（`false` → 清除纯色）。
3. **criMovie 占位播放器**：解析 `Movie/{0}.usm` 名称 + 阻塞/非阻塞（含 `false` token）+ 快进/跳读直接跳过 + 点击跳过 → 释放；解码留作升级路径。
4. **capture/captureRelease**：canvas 快照（若渲染器为 canvas）；否则冻结/恢复占位；`capture error` 等价物 = 记录错误并继续（原实现即 Normal）。
5. **useSimpleMeshFigure**：名单存下，供立绘渲染选路（无简化资源时等于全量正常渲染）。
6. **adv\***：语料 0 次 → 实现为"解析+记录+no-op"即可；wait 语义按本文表格留接口（`advSet`→isSetup、`advPlayAnimator`→演员 GoNext 可选）。

### 升级路径

- ADV：接入真实 `ADV/{name}` 资源（AssetBundle → glTF/USDZ 或烘焙序列帧）后可完整复刻 `Prepare`（相机→RT→全屏 quad）+ 演员表 + Animator 状态机（GoNextState → IsGoNext 回填）；RT 尺寸 1267×576（`GetTemporary(1267,576,24)` 原样）。
- 影片：USM 抽取 → ffmpeg 转 mp4/webm 后由 `<video>` 承接，`bgmStop/seStop/voiceStop` 参数映射静音轨，`SeekSequence` 对应 `video.currentTime`；断点续播键 `MovieResumeKey/PlayedLastMovieKey` 可对应 localStorage 键（非必需）。
- capture：若阅读器与游戏一样有独立"脚本渲染相机"，则按 `RenderCameraSwap` 语义实现双 RT 交换（冻结帧仍可见）；否则维持 canvas 快照方案。
- 渲染模式：`ScriptActionSetRenderTextureComponent`（RenderTarget/Capture 二选一 → 目标对象材质 mainTexture）是场景 prefab 声明式的"贴 RT 到物体"，仅在重建场景 prefab 体系时才需要。

### 证据复现命令（节选）

```
cd F:/Project/fgo/work
python coverage/win.py 0x317ec04 16 120          # advSet handler + tail 0x3184a20
python tools/annotate_func.py 'ScriptActionAdvPrefabController\$\$Prepare' 8
python tools/annotate_func.py 'ScriptActionAdvPrefabActorController\$\$PlayAnimator' 6
python coverage/win.py 0x317d14c 16 130          # advPrepare
python coverage/win.py 0x31839d8 16 130          # advRelease
python coverage/win.py 0x3183c38 16 150          # movie/criMovie handler
python tools/annotate_func.py 'ScriptManager\$\$PlayCRIMovie' 6
python tools/klass.py 'CRIMoviePlayer'           # 取 dump 行 278328 的类体
python coverage/win.py 0x3181454 16 140          # capture
python tools/annotate_func.py 'ScriptManager\$\$RenderCameraSwap' 6
python coverage/win.py 0x31823a4 16 120          # captureRelease
python coverage/win.py 0x317cb6c 16 100          # backCameraColor
python coverage/win.py 0x317ba14 16 110          # useSimpleMeshFigure
python coverage/win.py 0x31843b4 16 60           # endFade
python tools/annotate_func.py 'ScriptManager\$\$GetEndMode' 6
python tools/annotate_func.py 'ScriptManager\$\$EndExecuteScript' 6
# 语料
cd F:/Project/fgo && grep -rhoE '\[criMovie [^]]*\]' scripts | wc -l   # 181
```

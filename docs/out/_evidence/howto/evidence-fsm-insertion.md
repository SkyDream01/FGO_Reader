# fsm/insertion 证据补录

本文为 `how-to-adv-unrestored.md` 的“PlayMaker FSM(8) + 插入动画(7)”两组做针对性逆向补证。
约定:`0x…` 为 .so 内 VA(ScriptCommandExecute = `0x3177290..0x319402c`,ProcessScript = `0x31bc344..0x31c…`);
结论不带标记即有反汇编/类体证据,推断项标 **INFERRED**,未能定论标“未决”。反汇编窗口工具 `coverage/win.py`(before/after 为字节数)。

---

## 0. 两组共用的执行器上下文(下面的所有 handler 都成立)

ScriptCommandExecute 签名(dump.cs:169490):
`ScriptCommandExecute(string tag, string[] pd, int line, string data, ref string scriptErrorMessage, ref bool isScriptWait, ref float delta)`;
prologue 0x3177290 起:`x19=this, x25=tag, x22/…=pd`。

每条命令的派发前处理块(0x3178f7c..0x3178fd0)构造闭包 `ScriptManager.<>c__DisplayClass808_0`:

```
0x3178f7c  bl       #0x2230710            ; new DisplayClass808_0
0x3178f98  mov      x1, x19
0x3178fa0  str      x19, [x0, #0x10]!     ; [0x10] = ScriptManager
0x3178fac  mov      x1, x22
0x3178fb0  str      x22, [x20, #0x18]!     ; [0x18] = pd 数组
0x3178fbc  mov      x22, x26
0x3178fc0  mov      x1, x25
0x3178fc4  str      x25, [x22, #0x20]!     ; [0x20] = tag;x22 之后 = &closure.tag
```

因此:**handler 内 `ldr x1,[x22]` 读到的就是当前命令 tag**(例 0x317c358、0x3182b5c、0x3185e98)——这是共享 handler“二次派发”和 `waitType=tag` 的机制来源。当前参数数组用 `[x20]` 取用(长度 `[pd+0x18]`,元素 `pd[i] @0x20+8i`)。

pd 的元素布局(`AnalysParam` 产物):**值、分隔符交替**。空白切分出的分隔符是 `" "`;`<a>,<b>` 中的逗号被拆成独立元素。例:
- `fsmObjSetBool K var true` → pd=[K, " ", var, " ", true](pd[1]/pd[3] 都是空格)
- `insertionAnimationSetFSSideR name 0,70` → pd=[name, " ", "0", ",", "70"]
- `fsmObjLayer K ui 0,100` → pd=[K, " ", "ui", " ", "0", ",", "100"]

`ScriptManager` 相关字段(class_ScriptManager.txt / dump.cs:167168 起):
`state 0x288`(enum `ScriptManager.State`:{EXECUTE=3, WAIT=4, **ERROR=16**})、`waitType 0x3d8`、`waitIndex 0x3e0`、`waitCount 0x3e4`、`waitName 0x3e8`、
`fsmObjectDataList(ScriptFsmObjectData[] readonly) 0x790`、`isInsertionAnimationLoading 0x748`、`animationInsertionObjects(List<GameObject>) 0x778`、`animationInsertionAssetNames(List<string>) 0x780`、`scriptReScale(UIRootReScale) 0x120`、`stretchBase(UIWidget) 0xc8`。

**wait 机制**(fsm/insertion 的阻塞语义都走它):
- `wait` 命令 handler 0x31874d8:`state=WAIT`、`*delta=0`、`waitType=pd[0]`(0x31874f4-0x3187524),随后按 `ComputeStringHash(waitType)` 大 switch。所以 **waitType 就是 wait 关键字**。
- ProcessScript 每帧的 wait-check(`0x31bd14c` 处 hash 分派)按 waitType 找完成条件;不满足 → `0x31c2850`(保持 WAIT);满足 → `0x31bd0d4`(`state=EXECUTE(3)` + 前面 0x31bd0d0 `ResumePlaySpeed`);**waitType 不在开关内 → 0x31c2848:`state=ERROR(16)`**。

`ConvertCharaIndex @0x31b34f0`:逐字符 `'A'..'Z'` → `acc=(acc<<8)|(c-'A')`;**`K` → 10**;首字符非 A-Z 直接返回 0。fsm 的“槽位”就是该值。

---

## 1. fsm 组(PlayMaker FSM 对象)

### 1.1 fsmObjSet

- handler:`0x317c248`(case verify 0x317c218/0x317c23c,tag 字面量槽 0x55ca0d0)。min_token=5 = pd 必须 ≥5。
- 参数消费(len<5 → `0x3193e80` 置 `'parameter error'`):

```
0x317c25c  adrp     x9, #0x5574000
0x317c264  ldr      x9, [x9, #0x9b0]  ; &' '
0x317c268  ldr      x0, [x8, #0x28]   ; pd[1]
0x317c270  bl       #0x4870cc0  CALL System.String$$op_Equality   ; 必须 == ' '
0x317c298  bl       #0x31b34f0  CALL ScriptManager$$ConvertCharaIndex  ; pd[0] → idx
0x317c2a4  ldr      w9, [x8, #0x18]   ; 长度
0x317c2f4  cmp      w9, #4
0x317c2f8  b.ls     #0x3193cd4      ; 需 pd[2]、pd[4] 存在
0x317c304  ldr      x24, [x8, #0x30]  ; pd[2]
0x317c308  ldr      x25, [x8, #0x40]  ; pd[4]
0x317c324  bl       #0x3171d14  CALL ScriptFsmObjectData$$.ctor   ; ctor(x1=pd[2], x2=pd[4])
```

  **结论(回答 A)**:参数形态 = `fsmObjSet <slot> <assetName> <objectName>`;pd[2]→`assetName`、pd[4]→`objectName`,**pd[3] 是空格分隔符,没有任何类型标记/校验**。`fsmObjSet` **不是** SetBool/Float/String 的统一入口:它只创建/加载对象(变量赋值是 1.2 三条命令)。
- 行为:

```
0x317c2bc  ldr      x0, [x8, #0x20]   ; 旧槽
0x317c2c8  bl       #0x3172364  CALL ScriptFsmObjectData$$Destroy
0x317c2d4  mov      x1, x23          ; idx
0x317c2dc  bl       #0x2019c04        ; fsmObjectDataList[idx] = null
0x317c348  bl       #0x2019c04        ; fsmObjectDataList[idx] = 新 ScriptFsmObjectData
0x317c34c  mov      w8, #4
0x317c354  str      w8, [x19, #0x288] ; state = WAIT(4)
0x317c358  ldr      x1, [x22]
0x317c35c  str      x1, [x19, #0x3d8] ; waitType = tag('fsmObjSet')
0x317c368  str      w21, [x19, #0x3e0] ; waitIndex = ConvertCharaIndex(pd[0])
```

  即 **fsmObjSet 是隐式阻塞命令**:进入 WAIT,直到 §1.7 的 `fsmObjSet` 完成条件成立。
- 未决:`0x317c338 bl 0x201b5c8`(array/list 辅助,泛型实例名未解析)与 slot 数组长度来源(见 §1.7 负索引处同型代码,`ScriptManager..ctor 0x31c943c` 分配,长度取自某静态 int,@0x31c9430-0x31c9438,具体类未解析)。

### 1.2 fsmObjSetBool / fsmObjSetFloat / fsmObjSetString(共享体 `0x3182adc`)

三 case:bool 0x317dc10→0x3182ac0、float 0x3179364→0x3179378→0x3182ac8、string 0x31791fc→0x317ec58;都先做 tag 校验,再共享体:

```
0x3182adc  ldr      x8, [x20]
0x3182ae8  cmp      w9, #5
0x3182aec  b.lt     #0x3191820        ; len<5 → 'parameter error'(0x3191820)
0x3182afc  ldr      x0, [x8, #0x28]   ; pd[1] 必须 == ' '
0x3182b2c  bl       #0x31b34f0  CALL ScriptManager$$ConvertCharaIndex   ; pd[0]
0x3182b48  ldr      x19, [x8, #0x20]  ; fsmObjectDataList[idx]
0x3182b4c  cbz      x19, #0x3193f00 ; 槽空 → 静默 no-op
0x3182b5c  ldr      x21, [x22]       ; 二次派发:tag = [x22]
0x3182b64  bl       #0x4870cc0  CALL System.String$$op_Equality   ; == 'fsmObjSetString'?
```

- `fsmObjSetString`:len>4 必须;`SetString(slot, pd[2], pd[4])` @**0x3172104**(0x3182ba0)。
- `fsmObjSetFloat`(0x318be80→0x318be9c):len>4;`System.Single$$TryParse(pd[4]) @0x49e8974`(0x318bebc),失败 no-op;`SetFloat(slot, pd[2], v)` @**0x31721a0**(0x318beec)。
- `fsmObjSetBool`(0x318dd38→0x318dd54):len>4;`System.Boolean$$TryParse(pd[4]) @0x495d278`(0x318dd90),失败 no-op;`SetBool(slot, pd[2], v)` @**0x3172248**(0x318ddbc)。
- 参数形态:`fsmObjSetBool <slot> <varName> <true|false>`(pd[2]=变量名、pd[4]=值、pd[3]=空格)。**三者共用 min_token=5,没有 pd[3] 类型标记**。
- 不设 WAIT、不阻塞;槽位空对象时全部静默 no-op。
- 语料 0 次(仅 `fsmObjSet/SetState/SendEvent/Layer/Destroy` 各 3 次,per supplement-presentation-composition.md)。

### 1.3 fsmObjSetState / fsmObjSendEvent(共享体 `0x3185e08`)

```
0x3185e08  mov      x0, x19
0x3185e0c  mov      w1, #1
0x3185e14  bl       #0x31a8220  CALL ScriptManager$$ModifyPlaySpeed   ; ModifyPlaySpeed(isRecover=true)
0x3185e24  cmp      w9, #3
0x3185e28  b.lt     #0x3191820        ; len<3 → 'parameter error'
0x3185e40  bl       #0x4870cc0  CALL System.String$$op_Equality      ; pd[1]==' '
0x3185e68  bl       #0x31b34f0  CALL ScriptManager$$ConvertCharaIndex
0x3185e84  ldr      x21, [x8, #0x20]  ; slot;空 → no-op
0x3185e98  ldr      x22, [x22]        ; tag 复读
0x3185eac..0x3185ecc  SetState(slot, pd[2])   ; ScriptFsmObjectData$$SetState @0x3171fdc
0x318d3d4..0x318d410  SendEvent(slot, pd[2])  ; ScriptFsmObjectData$$SendEvent @0x3172070
0x318d414  bl       #0x31b5324  CALL ScriptManager$$IsNormalPlaySpeed
0x318d420  tbnz     w0, #0, #0x3193f00  ; 正常速度 → 结束
0x318d42c  bl       #0x31722e4  CALL ScriptFsmObjectData$$Skip      ; 快进 → 立即 Skip(FSM 发 SKIP)
```

- **SetState vs SendEvent 的区别 = 后端调用不同**(回应 A):`ScriptFsmObject.SetState(name)` 走 `PlayMakerFSM.SetState`(0x4adeacc)且把 `isPlaying=true`;`SendEvent(name)` 走 `PlayMakerFSM.SendEvent`(0x4adeb14)同样置 `isPlaying=true`(两条都先自动发一次 `"SKIP"`,见 §1.6)。前者是“跳到状态”,后者是“投递事件”。参数都是 pd[2](状态名/事件名)。
- 都不设 WAIT、不阻塞;但快进(非正常速度)时会立即 `Skip()`(语义:快进时 FSM 直接跳到结束)。

### 1.4 fsmObjDestroy(`0x317aba0`)

```
0x317abac  cmp      w9, #1
0x317abb0  b.lt     #0x3191820        ; len<1 → 'parameter error'
0x317abc0  bl       #0x31b34f0  CALL ScriptManager$$ConvertCharaIndex   ; pd[0]
0x317abe0  ldr      x0, [x8, #0x20]   ; slot;空 → 0x3193f00(no-op)
0x317abec  bl       #0x3172364  CALL ScriptFsmObjectData$$Destroy
0x317abf8  mov      x1, x20
0x317ac00  bl       #0x2019c04        ; fsmObjectDataList[idx] = null
```

不设 WAIT。Destroy 内部 = `Object.Destroy(go)` + `AssetManager.releaseAsset(loadedAssetData)`(见 §1.6)。

### 1.5 fsmObjLayer(`0x317f638`)

```
0x317f648  b.lt     #0x3193e80        ; len<3 → 'parameter error'
0x317f660  op_Equality(pd[1], ' ')    ; 必须空格
0x317f688  bl       #0x31b34f0  CALL ScriptManager$$ConvertCharaIndex  ; pd[0] → idx
0x317f6a4  ldr      x22, [x8, #0x20]  ; slot;空 → no-op
0x317f6d4  bl       #0x4870cc0  CALL System.String$$op_Equality  ; pd[2] 必须 == 'ui'(槽 0x55ca010)
0x317f6ec  bl       #0x4fd06d4  CALL UnityEngine.Component$$get_gameObject
0x317f6fc  bl       #0x3171e40  CALL ScriptFsmObjectData$$SetParent   ; SetParent(ScriptManager.scriptReScale(0x120).gameObject)
0x317f724  bl       #0x486c8a8  CALL System.String$$get_Chars        ; pd[5][0] 必须 == ','(0x2c)
0x317f754  bl       #0x49d31f4  CALL System.Int32$$Parse            ; x = Int32(pd[4])
0x317f77c..0x317f78c  SetPosition(x, y)  ; y = Int32(pd[6]) → ScriptFsmObjectData$$SetPosition @0x3171f34
```

- **层名取值**:2.139.3 只接受 `'ui'`,其余 → `'parameter error'`(0x317f6dc → 0x3193e80)。
- 可选坐标原文形如 `fsmObjLayer <slot> ui <x>,<y>`(pd[4]=x、pd[5]=`,`、pd[6]=y);无坐标则只挂父级。
- **与角色槽位的绑定(回应 A)**:所有 fsmObj* 命令的第 1 个参数都用 `ConvertCharaIndex` 编码成 `int` 索引,去 `ScriptManager.fsmObjectDataList(0x790)` 取一个 `ScriptFsmObjectData` 槽;**槽与角色无关**,只是 A-Z(base-26)编码的命名空间,K=10。越界 → 0x3193cd4(异常路径)。
- 不设 WAIT。SetParent 后对象被激活(`SetActive(true)`,见 ScriptFsmObjectData.SetParent 0x3171f1c)。

### 1.6 wait fsmObjFinished(完成条件,回应 A)

解析(`wait` handler):依次 `ConvertCharaIndex(pd[2]) → waitIndex`(0x319390c-0x319391c);缺参/`pd[1]!=' '` → `waitIndex=-1`(0x3193a38 `mov w8,#-1; str w8,[x19,#0x3e0]`)。waitType=关键字。

判定(ProcessScript,0x31bfa08 起):

```
0x31bfa08  ldr      x8, [x8, #0xd70]  ; &'fsmObjFinished'
0x31bfa10  bl       #0x4870cc0  CALL System.String$$op_Equality    ; waitType == 'fsmObjFinished'
0x31bfa18  ldr      w8, [x19, #0x3e0] ; waitIndex
0x31bfa1c  tbnz     w8, #0x1f, #0x31c0f38  ; 负值 → 另一分支(见下)
0x31bfa20  ldr      x9, [x19, #0x790] ; fsmObjectDataList
0x31bfa38  ldr      x0, [x8, #0x20]   ; slot
0x31bfa3c  cbz      x0, #0x31bd0d4    ; 槽空 → 完成
0x31bfa44  bl       #0x3171c8c  CALL ScriptFsmObjectData$$IsPlaying
0x31bfa48  tbz      w0, #0, #0x31bd0d4 ; IsPlaying==false → 完成
0x31bfa4c  b        #0x31c2850          ; 否则保持 WAIT
```

**完成条件 = `fsmObjectDataList[waitIndex] == null || !IsPlaying()`**。`IsPlaying()`(0x3171c8c)= 对象存在且 `ScriptFsmObject.isPlaying(0x28)`;`isPlaying` 在 SetState/SendEvent 时置 true,由 FSM prefab 发 `OnFinished`(`ScriptFsmObject.OnFinished @0x3171c74`: `strb wzr,[x0,#0x28]`)清零——该方法**无静态调用者**,说明由 prefab 的 PlayMaker Send Message 触发(**INFERRED**)。
负 waitIndex 分支 0x31c0f38 是一个循环(逐项 `IsPlaying`),循环上限取自某静态值(与 `ScriptManager..ctor` 数组长度同型代码,**未解析**);语义 **INFERRED** 为“等待全部 FSM 对象结束”。
另:`fsmObjSet` 的完成检查(0x31bf444-0x31bf48c)= 槽空或 `ScriptFsmObjectData.isLoading(0x18)==false`,即 **fsmObjSet 阻塞到资源加载/实例化完成**。

### 1.7 FSM 数据模型 / 后端 API 地图 / 资源

类体(class_ScriptFsmObject.txt / class_ScriptFsmObjectData.txt,dump.cs:166434/166489):

- `ScriptFsmObject : MonoBehaviour`:`[SerializeField] PlayMakerFSM fsm // 0x20`、`bool isPlaying // 0x28`;方法 `IsPlaying/SetState/SendEvent/SetString/SetFloat/SetBool/Skip/OnFinished`。
- `ScriptFsmObjectData`:`ScriptFsmObject fsmObject // 0x10`、`bool isLoading // 0x18`、`AssetData loadedAssetData // 0x20`;方法 `IsLoading/IsPlaying/.ctor(assetName,objectName)/SetParent/SetPosition/SetState/SendEvent/SetString/SetFloat/SetBool/Skip/Destroy`。

后端调用链(全部已核):

| 阅读器需建模的 API | 实现 | 证据 |
|---|---|---|
| `ScriptFsmObject.IsPlaying()` | 返回 `isPlaying` | 0x3171ab4 `ldrb w0,[x0,#0x28]` |
| `ScriptFsmObject.SetState(name)` | `Skip()` → `PlayMakerFSM.SetState(fsm,name)` @0x4adeacc;`isPlaying=true` | 0x3171abc-0x3171af0 |
| `ScriptFsmObject.SendEvent(name)` | `Skip()` → `PlayMakerFSM.SendEvent` @0x4adeb14;`isPlaying=true` | 0x3171b4c-0x3171b80 |
| `ScriptFsmObject.Skip()` | `PlayMakerFSM.SendEvent(fsm,"SKIP")`(字面量 'SKIP' 0x55c93b8) | 0x3171af8-0x3171b44 |
| `…SetString/SetFloat/SetBool` | `PlayMakerFSM.get_FsmVariables()`@0x4adf11c → `HutongGames.PlayMaker.FsmVariables.GetFsmString/Float/Bool`@0x4b24e08/0x4b2457c/0x4b24c9c → 写 value(字段 0x38) | 0x3171b88/0x3171be0/0x3171c28 |
| `ScriptFsmObjectData.IsPlaying()` | `fsmObject != null && fsmObject.isPlaying` | 0x3171c8c-0x3171cfc |
| `…IsLoading()` | 返回 `isLoading` | 0x3171c84 |
| `.ctor(assetName,objectName)` | 建闭包/`AssetLoader.LoadEndDataHandler` → **`AssetManager.loadAssetStorage(assetName, handler, async=1, 0, 0)`** @0x2da59ac;`isLoading=true` | 0x3171d14-0x3171e30 |
| 加载回调 `<.ctor>b__0(AssetData)` | `loadedAssetData=assetData` → `AssetData.GetObject(objectName)`@0x2d9e78c → `Object.Instantiate`@0x39283bc → `SetActive(false)` → `GetComponent<ScriptFsmObject>` → `fsmObject=…; isLoading=false` | 0x3172450-0x317257c |
| `SetParent(parent)` | `transform.SetParent(parent.transform)` + `ResetTransform`@0x292b934 + `SetActive(true)` | 0x3171e40-0x3171f1c |
| `SetPosition(x,y)` | `GameObjectExtensions.SetLocalPosition`@0x2929e18 | 0x3171f34-0x3171fc4 |
| `Destroy()` | `Object.Destroy(fsmObject.gameObject)`;`fsmObject=null`;**`AssetManager.releaseAsset(loadedAssetData)`**@0x2da4628 | 0x3172364-0x3172448 |

资源(回答 A):
- **无命名模板**:assetName 直接来自脚本(`fsmObjSet` pd[2],语料 `ScriptUI/SelectPanel/select01`),由 `AssetManager.loadAssetStorage` 当作 AssetStorage(bundle)组名加载;bundle 内的对象名 = pd[4](语料 `select01`,与 assetName 末级同名,但不是同一字段)。
- FSM 本体 = prefab 里的 `PlayMakerFSM` 序列化图(状态/转移/变量都在 prefab 里),`ScriptFsmObject` 只是外壳组件。
- PlayMaker 装配:`PlayMaker.dll`(dump.cs 镜像 14,标准运行时 HutongGames.PlayMaker.*)与 `Fgo.PlayMaker.dll`(镜像 4,dump.cs:5;含标准 Action 库 + FGO 扩展 `PlayMakerFSMHelper/FsmProcessor/UpdateHelper`,`// TypeDefIndex: 16549..`)。
- 阅读器补齐要点(见 §3)。
- 未决:0x317c338 的 0x201b5c8;fsmObjectDataList 长度静态源;负索引 wait 循环上限。

---

## 2. 插入动画组

### 2.1 insertionAnimationSet(+ FSL/FSR/FSSideL/FSSideR 变体,共享体 `0x318816c`)

入口:5 个 case 各自只加载自己的 tag 字面量槽后跳到验证块 0x3188150/0x3188158(Set 0x317e0f8→0x3188150;FSL 0x31838a0;FSR 0x318016c;FSSideL 0x31866e4;FSSideR 0x317dc30),验证后全部汇入共享体。

```
0x318816c  adrp     x8, #0x55c9000
0x3188178  ldr      x8, [x8, #0xee8]  ; &'insertionAnimationSet'
0x318817c  str      w9, [x19, #0x288] ; w9=4 → state = WAIT(4)
0x3188184  str      x1, [x19, #0x3d8] ; waitType = 'insertionAnimationSet'
0x318818c  mov      w8, #1
0x3188190  strb     w8, [x19, #0x748] ; isInsertionAnimationLoading = true
0x31881a4  ldr      x1, [x8, #0x20]   ; pd[0] = 动画名
0x31881b0  bl       #0x31b3f20  CALL ScriptManager$$ConvertInsertionAnimationName
0x3188200..0x3188214  AssetManager$$loadAssetStorage(path, handler, 1, 0, 0)
```

- **参数形态(回答 B)**:只有 pd[0] = 动画名,且 **handler 不校验任何参数**(len<1 也不报错,只是 pd[0] 空则路径变 `InsertionAnimations//`)。例:`insertionAnimationSet FSSideR ac_fude_triangle_slide_R 0,70` 里 `0,70` 由**加载完成的回调**消费,不在 handler 里解析。
- **FSL/FSR 变体差异 = 加载完成后叠加的 X 偏移**(不是参数差异):回调 0x31cbdb8 里 `GetFSCommandOffsetX(this, tag, 'insertionAnimationSet', 1)` @0x31c5b68,内部按 `tag == "insertionAnimationSet"+后缀` 分派:
  - `FSL` → `-(int)FSUtility.GetOffsetX(1, 48.0f)`(0x31c5c68-0x31c5cdc,末尾 `neg`)
  - `FSR` → 同参数取正(0x31c5d24-0x31c5d3c)
  - `FSSideL/FSSideR` → `FSUtility.GetForceOffsetX`(0x31c5dfc/0x31c5e58),仍走取负/取正尾
  - `CommonUI.GetForceObi_16_9()` 为真时直接返回 0(0x31c5c18-0x31c5c20)
- 资源名(回答 B):**`ConvertInsertionAnimationName @0x31b3f20` = `System.String$$Format @0x4868ad0`,模板字面量 `"InsertionAnimations/{0}/{0}"` 位于槽 0x55ca0a48(引用点 0x31b3f38/0x31b3f44)**;id 出现两次,例 `ac_fude_triangle_slide_R` → `InsertionAnimations/ac_fude_triangle_slide_R/ac_fude_triangle_slide_R`。
- 加载回调 `ScriptManager.<>c__DisplayClass808_0.<ScriptCommandExecute>b__2 @0x31cbdb8`(闭包字段 [0x10]this/[0x18]pd/[0x20]tag):

```
0x31cbe68  bl       #0x3806fd8  CALL AssetData$$GetObject<object>   ; GetObject(assetData, pd[0])
0x31cbebc  bl       #0x39284ec  CALL UnityEngine.Object$$Instantiate  ; Instantiate(obj, stretchBase(0xc8).transform)
0x31cbef0  str      w10, [x0, #0x1c]  ; List(0x780) 追加 pd[0](AddWithResize @0x31cbf30)
0x31cbf64  bl       #0x4fd9ac4  CALL UnityEngine.Object$$set_name    ; go.name = pd[0]
0x31cbfb8/d8  List(0x778) 追加 go
0x31cc00c  bl       #0x38ebda0  CALL UnityEngine.GameObject$$AddComponent<object>  ; + EventPlayAnimationInsertionComponent
0x31cc024  ldr      x0, [x8, #0x30];bl 0x49e8728   ; Single.Parse(pd[2]) → x(len>=5)
0x31cc044..0x31cc050  Single.Parse(pd[4]) → y
0x31cc08c..0x31cc0a0  Single.Parse(pd[6]) → scale 乘入 localScale(len>=7,即 <x>,<y>,<scale>)
0x31cc0e0  bl       #0x31c5b68  CALL ScriptManager$$GetFSCommandOffsetX
0x31cc0f4  bl       #0x2929e18  CALL GameObjectExtensions$$SetLocalPosition   ; (x+offset, y)
0x31cc104  strb     wzr, [x8, #0x748]   ; isInsertionAnimationLoading = false
```

- wait:目录里没有 `wait insertionAnimationSet`,但该命令**本身隐式阻塞**:ProcessScript 判定(0x31bf9f0)`waitType=='insertionAnimationSet'` → `isInsertionAnimationLoading(0x748)==0` 才算完成。

### 2.2 insertionAnimationStart(`0x3180d0c`)

```
0x3180d24  bl       #0x4fd53c0  CALL UnityEngine.GameObject$$Find      ; pd[0]
0x3180d4c  op_Implicit                                  ; 找不到 → 0x3193f00(no-op)
0x3180d70  bl       #0x38ebe30  CALL UnityEngine.GameObject$$GetComponent<object>  ; EventPlayAnimationInsertionComponent(槽 0x55c9560)
0x3180da4  ldrb     w8, [x21, #0x31]                        ; isDestroy → no-op
0x3180db8  bl       #0x248e2c8  CALL EventPlayAnimationInsertionComponent$$ChangeAnimationSprite  ; 参数=整个 pd!
0x3180dd8  bl       #0x31b5344  CALL ScriptManager$$IsFastPlaySpeed
0x3180de8  mov      w2, #1
0x3180df0  bl       #0x248e168  CALL EventPlayAnimationInsertionComponent$$PlayAnimation  ; (pd[0], true, isSkip)
```

参数:pd[0]=动画/对象名;pd[2..]=贴图名(`ChangeAnimationSprite` 用 `GetAssetName(args) @0x248e628`:跳过 args[0],其余非空项加前缀 **`"Image/"`**,引用点 0x248e70c-0x248e718)。
`PlayAnimation @0x248e168`(回答 B 的“生命周期”):

```
0x248e220  tbz      w22, #0, #0x248e230        ; playInAnim
0x248e228  "…_in" / 0x248e234 "…_out"
0x248e238  strb     w23, [x19, #0x31]          ; _out 分支:isDestroy = 1
0x248e240  System.String$$Concat               ; nowPlayAnimName = "Base Layer." + name + "_in|_out"
0x248e28c  fcsel    s0, s1(1.0), s0(0.0), ne  ; isSkip ? 1.0 : 0.0
0x248e290  bl       #0x4f83d08  CALL UnityEngine.Animator$$Play     ; Play(clip, layer0, offset)
0x248e2a4  bl       #0x4f8555c  CALL UnityEngine.Animator$$Update   ; Update(0)
0x248e2ac  strb     w8(=1), [x19, #0x30]       ; isActive = true
```

**不带 WAIT、不阻塞**(handler 以 `b #0x3193f00` 收尾);完成态由 §2.4 的 wait 观察。

### 2.3 insertionAnimationEnd(`0x317f818`)

与 Start 完全同型但:**不做 ChangeAnimationSprite**,`PlayAnimation(pd[0], playInAnim=false, isSkip=IsFastPlaySpeed)`(0x317f8e8 前 `mov w2, wzr` 后跳同一公共尾 0x3180dec)。即 End = 播 `"_out"` 段(并把 `isDestroy` 置位,播完后对象自毁)。

### 2.4 wait insertionAnimationStart / insertionAnimationEnd

语料(Final Chapter/0400074810.txt)证明两者存在:
`[wait insertionAnimationStart ac_fude_triangle_slide_R]`、`[wait insertionAnimationEnd ac_fude_triangle_slide_R]`。

- 解析(`wait` handler,0x3193644/0x319328c):`GameObject.Find(pd[2])` → `GetComponent<EventPlayAnimationInsertionComponent>()`;然后 **`waitName(0x3e8)=pd[2]`**(0x3193704-0x3193708),并跳到 0x3193880 收尾。
- 判定(ProcessScript;Start 0x31bf71c-0x31bf7c8,End 的 hash 桶 0x31bdd44 汇入同一块):

```
0x31bf720  ldr     x8, [x8, #0x2b8]    ; &'insertionAnimationStart'
0x31bf730  bl      #0x4870cc0 CALL System.String$$op_Equality  ; waitType=='insertionAnimationStart'|'insertionAnimationEnd'
0x31bf738  ldr     x0, [x19, #0x3e8]   ; waitName
0x31bf740  bl      #0x4fd53c0  CALL UnityEngine.GameObject$$Find
0x31bf770  tbz     w0, #0, #0x31bd0d4  ; 找不到 → 完成
0x31bf788  bl      #0x38ebe30  CALL UnityEngine.GameObject$$GetComponent<object>  ; EventPlayAnimationInsertionComponent
0x31bf7b8  tbz     w0, #0, #0x31bd0d4  ; 组件空 → 完成
0x31bf7c0  ldrb    w8, [x25, #0x30]    ; isActive
0x31bf7c4  cbz     w8, #0x31bd0d4     ; isActive==false → 完成
0x31bf7c8  b       #0x31c2850          ; 否则等待
```

**完成条件 = 对象/组件已不存在,或 `isActive(0x30)==false`**;`isActive` 由 `Update()`(0x248e030 起,`Animator.GetCurrentAnimatorStateInfo(0).normalizedTime` 判定,>1 → 收尾)清零 → 播放结束即满足。**Start 与 End 的完成判定完全一致。**

### 2.5 插入动画的每帧更新与 prefab 内容(回答 B)

`EventPlayAnimationInsertionComponent`(dump.cs:279186):

- 字段:`Animator mAnimator // 0x20`、`string nowPlayAnimName // 0x28`、`bool isActive // 0x30`、`bool isDestroy // 0x31`、`bool isLoadedSprite // 0x32`;常量 `SPRITE_NODE_NAME="Texture_"`、`IMAGE_PREFIX="Image/"`;静态 `MASK_TEX`。
- 方法:`Awake`(取 Animator、`StopPlayback`+`Update(0)`、`enabled=false`)、`Update`(每帧 normalizedTime 判定)、`IsActive/IsDestroy`、`PlayAnimation`、`ChangeAnimationSprite`、`GetAssetName(string[])`。
- 所以 `InsertionAnimations/<id>/<id>` prefab 通常含:Animator(状态名 **`Base Layer.{id}_in` / `Base Layer.{id}_out`**)+ 若干贴图节点(命名常量 `Texture_`/路径 `{自身名}/image/`,贴图资源 `Image/<pd[i]>`,**INFERRED** 具体子节点层级未逐条核对)+ 挂 `EventPlayAnimationInsertionComponent`。
- 阅读器无法加载 Unity prefab 时可做到的程度:
  a) 用脚本名直接占位一个定时器:`_in`/`_out` 段时长未知 → 取常量(如 0.3–0.5s)或“直到 `wait` 超时”兜底;
  b) `insertionAnimationStart/End` 只当作“显示/隐藏该名字的占位图层”;
  c) `wait insertionAnimation*` 在无资源时立即满足(等价于时长 0)——注意 `insertionAnimationSet` 的隐式 WAIT 也必须立即满足,否则卡死;
  d) 位置 = `(pd[2]+变体偏移, pd[4])`、缩放 = pd[6](这些**不依赖 prefab**,可直接实现)。

### 2.6 加载/销毁管理 API

- `ScriptManager.StartLoadAnimationAssetData @0x31a8824`:若预加载名单(`[this+0x2b8]`,List,**字段名未解析**)非空 → `names.ToArray()` + `loadAssetStorage(names, callback, 1, 0)`(0x31a88a0-0x31a8908);唯一调用者 ProcessScript 0x31c2a50(脚本开始阶段)。
- `ScriptManager.destroyAnimationInsertionObjects @0x31b15e4`:遍历 `animationInsertionObjects(0x778)`,`Object.Destroy` 每个非 null 项(0x31b1710),`Array.Clear`(0x31b1744),再按 `animationInsertionAssetNames(0x780)` 逐名 `AssetManager.releaseAssetStorage @0x2da6914`(0x31b178c)。列表在 `ScriptManager..ctor` 创建(0x31c93e4/0x31c9408)。
- `destroyAnimationInsertionObject(string objName)`(dump.cs:168806,单对象版)。

---

## 本组小结

### 缺口分类

**a) 纯逻辑缺口(仅靠本文档即可实现,无需原始资源)**
- fsm 槽位模型:`ConvertCharaIndex`(A-Z→int)+ `fsmObjectDataList` 数组 + 每槽 `{isLoading, isPlaying, assetName, objectName}`;
- `fsmObjSet` 的“隐式阻塞到加载完成”、`fsmObjDestroy/Layer/SetState/SendEvent/Set*` 的逐个语义;
- wait 状态机:waitType 是关键字、waitIndex/waitName/waitCount 三个参数槽;fsmObjSet/insertionAnimationSet 也会写入 WAIT 并复用同一完成判定;未知 waitType → ERROR;
- insertion 的 `Start/End` 生命周期与 `wait insertionAnimation*` 判定(isActive);
- 位置/缩放解析(`<x>,<y>[,<scale>]`、变体 X 偏移)。

**b) 需原始资源(PlayMaker FSM 图 / 动画 prefab)**
- FSM 的状态转移与变量效果本身——`ScriptFsmObject` 只是 `PlayMakerFSM` 外壳(SetState/SendEvent/Set* 全部转发到 PlayMaker),没有图就无法知道 `SendEvent "START"` 会做什么、`fsmObjFinished` 何时结束(`isPlaying` 只能由 FSM prefab 的 OnFinished 消息清零);
- 插入动画的时长/节奏(NormalizedTime)与贴图内容(`Image/<name>`),只存在于 `InsertionAnimations/<id>/<id>` prefab 与贴图资源。

**c) 需游戏数据源(CDN/AssetStorage)**
- `ScriptUI/SelectPanel/select01`(fsmObjSet 语料用例)、`InsertionAnimations/<id>/<id>` 的 bundle 与其中 `pd[4]` 对象名/prefab;
- 资产路径解析:`AssetManager.loadAssetStorage` 组名 → AssetStorage 条目(per `out/asset-pipeline.md`)。

### 最小可交付实现(Web 阅读器)

1. 数据模型:`fsmSlots: Map<int, FsmObj>`(含 assetName/objectName/isLoading/isPlaying)、`insertionObjects: Map<string, {state:'in'|'out', active, x,y,scale}>`。
2. 命令语义:`fsmObjSet` → 建槽并进入 `WAIT(waitType='fsmObjSet')`;`Set*`/`SetState`/`SendEvent` → 改槽(快进时视为 Skip);`fsmObjDestroy/Layer` → 删槽/挂层(ui=UI 根,可选坐标)。
3. wait 集成:每帧对 `state==WAIT` 求值 `waitType`:`fsmObjFinished` → `!slot?.isPlaying`;`insertionAnimationSet` → `!isInsertionAnimationLoading`;`insertionAnimationStart/End` → 占位对象不存在或 `!isActive`;未知 waitType → 记录 ERROR(与原版一致,便于发现漏实现)。
4. 无资源降级:`InsertionAnimations/*` 不存在时,`Set` 立即结束 WAIT、`Start/End` 当作改占位状态、`wait` 立即满足;`ScriptUI/*` 的 FSM 读不到图时,`fsmObjSet` 立即完成、`SendEvent/SetState` no-op、`fsmObjFinished` 立即满足(可配置“最低停留时长”防闪)。

### 升级路径

1. 把 PlayMaker 图做成离线转换(从 prefab 提取 `PlayMakerFSM` 的 states/transitions/variables → JSON),在阅读器里实现一个 PlayMaker 解释器子集(FsmStateAction 常用集来自 `PlayMaker.dll`/`Fgo.PlayMaker.dll`),即可真正驱动 `fsmObjFinished`(`SelectPanel/select01` 的 `WAIT_SELECTED_ANIMATION` 等)。
2. 插入动画:提取 prefab 的 Animator Controller 与贴图(离线转 sprite-sheet/WebM),按 `Base Layer.{id}_in/_out` 的时长驱动时间轴;或至少离线记录每个 id 的 `_in/_out` 时长表当常量。
3. `wait` 超时兜底策略保留(即便解释器上线,也要防止资源或事件缺失导致永久 WAIT;原版无超时,阅读器可加“可跳过”语义)。

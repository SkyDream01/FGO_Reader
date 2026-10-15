# distortion/stretch/war 证据补录

目标：FGO Android 2.139.3（IL2CPP arm64，`extract/lib/arm64-v8a/libil2cpp.so`）。
本文件只覆盖三组：**畸变及精灵遮罩(6)**、**拉伸、翻页和滚动(10)**、**战棋/战斗演出(10)**。
所有 handler 都在 `ScriptManager$$ScriptCommandExecute`（0x3177290..0x319402c）内；VA 为 ELF 虚拟地址，无标注即实测反汇编；推断一律写 `INFERRED`。
反汇编工具：`python coverage/win.py <VA> <before> <after>`（before/after 为十进制字节数）。

---

## 0. 共用前提：命令参数是「值/分隔符」交错 token 数组（三组都要用）

简报里 `pd[i]` 的下标含义此前没有对齐。实测：脚本行 `[cmd a b c]` 交给调度器的参数数组**不是** `['a','b','c']`，而是把分隔符（空格与逗号）也各算一个元素的数组。证据链：

* 行参数由 `ScriptManager$$AnalysParam`（**0x31a7688**）逐字符扫描生成；它先把双引号 `"` 内的内容整体并入 token（引号本身保留，故 handler 普遍再调 `ConvertNameString` 去引号），遇 `' '`/`,`/`=` 时**把当前 token 和分隔符字符各压入一次**：

```
0x31a7718  adrp x0, #0x5578000 ; ldr x0,[x0,#0x5d8]   ; &'='
0x31a7724  adrp x0, #0x5574000 ; ldr x0,[x0,#0x9b0]   ; &' '
0x31a7730  adrp x0, #0x5570000 ; ldr x0,[x0,#0x4b8]   ; &','
0x31a7864  cmp  w8, #0x2c        ; ',' ?
0x31a7868  b.eq #0x31a7874
0x31a78fc  cbz  x21, ...         ; ' ' 分支：StringBuilder 非空 -> push token
0x31a7990  add  x0, sp, #0xc     ; 再 push Char.ToString(分隔符)  （0x31a79f0 List.AddWithResize）
```

* 参数数组由 `ProcessScript` 交给调度器：`AnalysParam(executeDataList[i])` @**0x31c1a1c**，随后 `bl ScriptCommandExecute` @**0x31c1adc**（x1=tag 来自 `executeTagList[i]`@0x31c1974，x2=参数数组，x4=原始行文本）。字段定义见 `class_ScriptManager.txt`：`executeTagList 0x330 / executeDataList 0x338`。

**结论（reader 必须复刻）**：把参数串按空格与逗号切成「值 + 分隔符」序列，**值落在偶数下标**。语料例：

| 语料行 | token 数组长度 | handler 读到的值下标 |
|---|---|---|
| `[distortionstart 3.5 0.5 0.5 0.4 0.4 10.0]` | 11（值6+分隔5） | 0,2,4,6,8,10 |
| `[distortionstop 0.1]` | 1 | 0 |
| `[stretchin full 2.0 2.0]` | 5 | 0,2,4 |
| `[screen true 100 0 800 200]`（本组语料 0 次） | 9 | 0,2,4,6,8 |

handler 里的「本位数检查」`cmp wN,#K` 比的就是这个数组长度（如 distortionstart `cmp w8,#0xb` = 11）。
另外若某位没写值而写了 `' '`，handler 会把它当分隔符占位（见「拉伸」组 `stretchin` 的 `element[1]==' '` 判断），所以**「偶数位=值、奇数位=分隔符」**这条规则足以解释本文件全部参数形态。

---

## 畸变及精灵遮罩

### distortionstart

- **handler**：`0x317b128`（tag 比较 @0x317b118；非共享，独立块）。
- **参数消费**：arity 必须 **== 11（`cmp w8,#0xb` @0x317b134**，不等则回调度器 0x3191820）；`Single.Parse` 依次读 element[0,2,4,6,8,10]（0x317b164 / 0x317b188 / 0x317b1ac / 0x317b1d0 / 0x317b1f4 / 0x317b218），结果存 s8..s13。
- **行为**：

```
0x317b148  bl   #0x31a8220  CALL ScriptManager$$ModifyPlaySpeed          ; (this,1) 关掉快进
0x317b21c  adrp x8, #0x55ca000
0x317b228  ldr  x8, [x8, #0xa8]  ; &'Distortion'
0x317b238  bl   #0x319ff30  CALL ScriptManager$$SetCameraFilter  args: x1='Distortion'
0x317b23c  ldr  x0, [x19, #0x5e0]      ; ScriptManager.scriptActionRenderEffectController
0x317b244  fmov s0, s8                  ; sec        = element[0]
0x317b248  fmov s1, s9                  ; centerX    = element[2]
0x317b24c  mov  w1, wzr                 ; count      = 0（distortionstart 恒为一次性）
0x317b250  fmov s2, s10                 ; centerY    = element[4]
0x317b254  fmov s3, s11                 ; strength   = element[6]
0x317b25c  fmov s4, s12                 ; range      = element[8]
0x317b260  fmov s5, s13                 ; coefficient= element[10]
0x317b264  bl   #0x316a920  CALL ScriptActionRenderEffectController$$StartDistortion
0x317b270  bl   #0x31b5324  CALL ScriptManager$$IsNormalPlaySpeed
0x317b278  tbz  w0, #0, #0x317f358      ; 非正常速度 -> 0x317f358 SkipDistortion
```

  即 `distortionstart <sec> <centerX> <centerY> <strength> <range> <coefficient>`；
  `sec`=补间时长；`centerX/centerY`=畸变中心（语料恒为 0.5/0.5，与 `CreateDistortionParam` 的字段默认 0.5/0.5 一致 → 归一化屏幕中心，`INFERRED`）；`strength/range/coefficient`=畸变强度三参数（属性默认 coefficient=100，语料里也出现 100.0 与 10.0/20.0）；**count 恒 0**（单向插值，不 ping-pong）。
- **后端 API 地图**：`ScriptActionRenderEffectController$$StartDistortion @0x316a920`、`$$SkipDistortion @0x316c548`、`ScriptManager$$SetCameraFilter(string,float[]) @0x319ff30`、`ScriptManager$$ModifyPlaySpeed @0x31a8220`、`ScriptManager$$IsNormalPlaySpeed @0x31b5324`。
- **写入字段**：`ScriptManager.scriptActionRenderEffectController 0x5E0`（控制器实例）；控制器内部见下节。
- **资源**：shader 名由滤镜名拼接 —— `SetCameraFilter(string,float[])` 取 `ScriptManager.meshRenderBase(0x130).material`（`ExUIMeshRenderer$$get_material @0x2e0c664`，0x319ff38-0x319ff6c），再进 `SetCameraFilter(Material,string,float[]) @0x31a0304`：`filterName` 走 `GetStringWithFirstLetterChangedToUpperCase` 得到 `"Custom/Sprite-ScriptActionRender" + "Distortion"`（per presentation.md §4.2，`GetSpriteScriptActionRenderShader @0x31a0608`）。所以畸变挂在**主 ScriptAction 渲染网格的材质**上（也就是整幅 1344×576 剧情 RT 的显示 quad），不是相机后处理、也不影响消息窗口 UI。
- **置信度**：高（handler 与后端全链实测）。未决项：shader 内部对 5 个参数的具体算法（只能给材质属性名，见下）。

### distortionloop

- **handler**：`0x317f1e0`（tag 比较 @0x317f1d4）。
- **参数消费**：arity **== 13**（`cmp w8,#0xd` @0x317f1ec）；`Single.Parse@0x317f21c`(t0) / `Int32.Parse@0x317f240`(t2) / `Single.Parse`(t4,t6,t8,t10,t12)（0x317f264/288/2ac/2d0/2f4）。
- **行为**：与 start 完全同构，唯一区别 **count 取自 element[2]**：

```
0x317f320  fmov s0, s8      ; sec        = element[0]
0x317f324  fmov s1, s9      ; centerX    = element[4]
0x317f328  mov  w1, w21     ; count      = Int32.Parse(element[2])
0x317f32c  fmov s2, s10     ; centerY    = element[6]
0x317f330  fmov s3, s11     ; strength   = element[8]
0x317f338  fmov s4, s12     ; range      = element[10]
0x317f33c  fmov s5, s13     ; coefficient= element[12]
0x317f340  bl   #0x316a920  CALL StartDistortion
0x317f354  b    #0x3193f00                   ; IsNormalPlaySpeed==true -> Normal
0x317f358  ldr  x0, [x19, #0x5e0]
0x317f364  bl   #0x316c548  CALL SkipDistortion ; 非正常速度 -> 立即落到终态
```

  即 `distortionloop <sec> <count> <centerX> <centerY> <strength> <range> <coefficient>`。
- **distortionloop 与 start/stop 的关系**：三者是同一控制器上的不同启动方式：
  * `start` = 单向插值（count=0）；
  * `loop` = `count != 0` 时把插值速率做**三角波往返**（见 lambda 证据），即「来回摆动式畸变」；
  * `stop` = 从当前材质值插值到 `strength=range=0` 的停止参数。
  loop **没有配对的 stop 指令**，实际用法是 loop 之后用 `distortionstop` 收尾（回放器按同一状态机处理即可）。
- **置信度**：高（参数映射由语料 `[distortionstop ...]` 与 `distortionstart` 的 6 float 形态交叉验证）。

### distortionstop

- **handler**：`0x317b7ec`（tag 比较 @0x317b7e0；`shared_tail=0x3193f00` 即 Normal）。
- **参数消费**：arity **== 1**（`cmp w8,#1; b.ne 0x3193e80` @0x317b7f8）；`Single.Parse` element[0]（0x317b828）。
- **行为**：`StopDistortion(sec, new StopFunction)` → 非正常速度时再 `SkipDistortion`：

```
0x317b80c  bl   #0x31a8220  CALL ScriptManager$$ModifyPlaySpeed
0x317b828  bl   #0x49e8728  CALL System.Single$$Parse          ; sec = element[0]
0x317b82c  ldr  x20, [x19, #0x5e0]                            ; effectController
0x317b860  bl   #0x316c5cc  CALL ScriptActionRenderEffectController.StopFunction$$.ctor
0x317b874  bl   #0x316ace0  CALL ScriptActionRenderEffectController$$StopDistortion
0x317b880  bl   #0x31b5324  CALL ScriptManager$$IsNormalPlaySpeed
0x317b898  bl   #0x316c548  CALL ScriptActionRenderEffectController$$SkipDistortion
```

- **置信度**：高。语料：`[distortionstop 0.1]` / `[distortionstop 2.5]`，共 11 次。

### 共享后端：ScriptActionRenderEffectController（畸变/模糊/玻璃共用）

类体（`class_ScriptActionRenderEffectController.txt`，dump.cs 165399）与实测：

| 成员 | 偏移 | 语义（实测） |
|---|---|---|
| `timerCount` | 0x10 | 已播时长 |
| `timerMax` | 0x14 | 总时长（`Start` 写入 sec） |
| `loopCount` | 0x18 | `Start` 写入 (float)count；除 Skip 清零外**未发现读取点**（count 的实际作用在 lambda 里，INFERRED） |
| `reflectionFunction` | 0x20 | 每帧插值委托 |
| `stopFunction` | 0x28 | 停止完成回调（distortionstop 传入，OnStop 调用） |
| `isEnable` | 0x30 | 忙标志 |
| `requestStop` | 0x31 | 是否停止型 |
| `material_` | 0x38 | 目标材质 |

* `Start(sec,count,isStop,func,stopfunc) @0x316a854`：写委托/requestStop；`sec>0` 时 `timerCount=0, isEnable=1, timerMax=sec, loopCount=count`（0x316a8a4-0x316a8bc `stp s8,s0,[x19,#0x14]`）；`sec<=0` 直接走 `OnStop`。
* `Update(delta) @0x316a640`：`rate = timerCount/timerMax` 夹到 [0,1] 后调用委托：

```
0x316a6c8  ldp  s0, s8, [x19, #0x10]   ; s0=timerCount, s8=timerMax
0x316a6cc  fadd s0, s0, s9              ; += delta
0x316a6d0  fcmp s0, s8
0x316a6d4  str  s0, [x19, #0x10]
0x316a6e4  fdiv s0, s0, s8              ; rate
0x316a704  fcmp s0, s1(=1.0)
0x316a708  fcsel s1, s1, s0, gt         ; 上夹
0x316a710  fcsel s0, s2(=0), s1, mi     ; 下夹
```

* **loop 的“来回”在这里**：`<>c__DisplayClass19_0.<StartDistortion>b__0 @0x316d060`

```
0x316d064  ldr  w9, [x0, #0x10]   ; closure.count
0x316d070  cbz  x8, ...
0x316d074  fmov s1, #0.5
0x316d078  fabd s0, s1, s0        ; |0.5-rate|
0x316d07c  fsub s0, s1, s0        ; 0.5-|0.5-rate|
0x316d080  fadd s0, s0, s0        ; rate = 1-2|0.5-rate|  (三角波)
0x316d09c  b    #0x316c780        ; ReflectionMaterial(material, src, dest, rate)
```

* `Skip() @0x316a8e8`：`timerCount=timerMax; loopCount=0; Update(0)` → 立即按 rate=1 落终态；`SkipDistortion @0x316c548` 是其包装（`class` 里同名方法）。
* `DistortionParam`（dump.cs 165106）：`centerX 0x10 / centerY 0x14 / strength 0x18 / range 0x1c / coefficient 0x20`，
  * `CreateDistortionParam(x,y,str,rng,coeff) @0x316aba4`（字段默认 0.5/0.5/…/coefficient=100，见 0x316abfc-0x316ac10）；
  * `CreateMaterialValue(material) @0x316aa70` — 从材质读回当前值，属性名（0x316aaa4-0x316aab8）：**`_CenterX`、`_CenterY`、`_Strength`、`_Range`、`_Coefficient`**；
  * `CreateStopMaterial(material) @0x316ae00` — 停止目标：`_CenterX`/`_CenterY` 沿用材质现值、`_Coefficient` 沿用现值，**`strength`/`range` 保持默认 0**（0x316ae9c-0x316aecc 只回读三个属性）→ 视觉上「强度收敛到 0」；
  * `ReflectionMaterial(material,src,dest,rate) @0x316c780`：逐属性 `v = src + (dest-src)*rate` 后 `EffectParamBase$$SetFloatProperty @0x316c47c`（0x316c7fc-0x316c840 为 `_CenterX` 例）。
* `StopDistortion(sec,stopFunc) @0x316ace0`：`srcParam=CreateMaterialValue(material)`（0x316ad78）、`destParam=CreateStopMaterial(material)`（0x316ad90）→ `Start(sec, 0, isStop=true, ReflectionFunction, stopFunc)`（0x316addc）。

> 附带发现：`distortionstart/loop` 都会先 `SetCameraFilter('Distortion', null)` 换材质；而 **子层**版本（subBlur2/subBlur*/subCameraFilter 一族）用的是 `ScriptSubLayer.mesh(0x70).material` + `ScriptSubLayer.effectController(0x48)`（证据：`subBlur2` 路径 0x318cc88 `ldr x0,[x22,#0x70]` → get_material → `SetCameraFilter(mt,'GaussianBlurThrough')` @0x318cca8），即**同一套 render effect 机制按层各挂一份材质**。

### charaMask

- **handler**：`0x3183f88`（tag 比较 @0x3183f80）。
- **参数消费**：arity **> 2**（`cmp w9,#2; b.le 0x3191820` @0x3183f90）；element[0] → `ConvertCharaIndex`（0x3183fa8）→ 查 `ScriptManager.charaList(0x490)`；element[2] 与字面量 `'inside'`/`'outside'`/`'none'` 比较；**element[1]（分隔符）不消费**。
- **行为**：把角色精灵的「遮罩交互方式」设成 Unity `SpriteMask` 的三种模式：

```
0x3183fe8  ldr  x9, [x9, #0xe30]  ; &'inside'
0x3183ff8  bl   #0x4870cc0  CALL System.String$$op_Equality
0x3183ffc  tbnz w0, #0, #0x3184004
0x3184000  b    #0x318da2c                        ; 否则比 'outside'
0x3184004  mov  x0, x19      ; x19 = ScriptCharaData
0x3184008  mov  w1, #1       ; VisibleInsideMask
0x318400c  b    #0x318f610
0x318da3c  ldr  x1, [x8]  ; 'outside' (0x318da40 op_Equality)
0x318da4c  mov  w1, #2       ; VisibleOutsideMask
0x318da50  b    #0x318f610
0x318f5f8  ldr  x1, [x8]  ; 'none'  (0x318f600 op_Equality)
0x318f610  mov  x2, xzr
0x318f614  bl   #0x3170cd4  CALL ScriptCharaData$$SetMaskInteraction
```

  即 `[charaMask <槽位> inside|outside|none]`；数值 0/1/2 与 Unity `SpriteMaskInteraction{None,VisibleInsideMask,VisibleOutsideMask}` 一致（枚举名据 Unity API，INFERRED；数值来自实测 `mov w1,#1/#2/#0`）。
  `ScriptCharaData.SetMaskInteraction(int) @0x3170cd4` → `UIScriptChara.SetMaskInteraction @0x31e4c64`（角色渲染器开关遮罩交互）。
  角色槽位为空时**静默返回 Normal**（0x3183fc8 `cbz x19,#0x3193f00`）——阅读器应照抄这种降级。
- **与 ScriptSubLayer `#MASK` 的关系**：不是同一机制。`charaMask` 是 **SpriteMask（Unity 的 2D 遮罩组件）与角色渲染器的交互开关**，Shape 由 `spriteMaskSet/Off` 决定；而 `ScriptSubLayer.subLayerMask 0xB0 / SubLayerMask`（ScriptSubLayer.txt 41/60 行）与 `#MASK` 组是子层 RT 合成时的「层间遮罩」（subCameraFilter 一族 + `#MASK` key，per composition.md §7.2/§7.3）。若阅读器只把 `#MASK` 当特殊层 key，则 `charaMask` 需要单独建模，**不要**把它并进 `#MASK`。
- **预扫描**：`AnalysText` 里出现 tag `charaMask` 会把 `ScriptManager.isMaskEnabled(0x731)=1`（0x31af8a0-0x31af8b4）——说明遮罩能力按脚本预启用，与逐条命令无关。
- **相关但非本命令**：`ScriptCharaData.SetMaskData(int offsetX,int offsetY,int width,int height) @0x3170e78`（角色局部矩形遮罩数据，presentation.md §4.4 已列）。
- **置信度**：高（inside/outside/none 三分支与调用点实测；`ui` 与 Unity 枚举名的对应为 INFERRED）。未决项：`SetMaskData` 由哪条命令/组件消费未定位。

### spriteMaskSet

- **handler**：`0x3179ff0`（tag 比较 @0x3179fe0，tag 字面量同时被 handler 复用为 waitType）。
- **参数消费**：arity **≥ 1**（`cbz w8,#0x318d244` @0x3179ff8 → 参数不足走『parameter error』分支）；element[0] → `ConvertSpriteMaskName`（0x317a03c）。
- **行为**：进 LOAD 等待态 + 异步加载贴图：

```
0x3179fdc  ldr  x23, [x23, #0xbb8]  ; &'spriteMaskSet'
0x3179ff0  ldr  x8, [x20]
0x3179ffc  cbz  x8, #0x318d244                 ; len==0 -> 参数错误分支
0x317a000  ldr  x1, [x23]                      ; "spriteMaskSet"
0x317a004  mov  w8, #4
0x317a00c  str  w8, [x19, #0x288]              ; ScriptManager.state = 4  (LOAD)
0x317a010  str  x1, [x19, #0x3d8]              ; ScriptManager.waitType = "spriteMaskSet"
0x317a01c  strb w8(=1), [x19, #0x732]          ; isSpriteMaskLoading = true
0x317a03c  bl   #0x31b39b4  CALL ConvertSpriteMaskName      ; -> "Image/mask_<name>"
0x317a070  bl   #0x2da0564  CALL AssetLoader.LoadEndDataHandler$$.ctor
0x317a0a0  bl   #0x2da59ac  CALL AssetManager$$loadAssetStorage
0x317a0a4  mov  w24, wzr
0x317a0a8  tbz  w0, #0, #0x317a0b0            ; 加载启动失败 -> " is not found"
0x317a0ac  b    #0x3193f04                     ; 成功 -> return Normal(0)
0x317a0d8  ldr  x8, [x8, #0x828]  ; &' is not found'
0x317a0e0  bl   #0x4867ef8  CALL System.String$$Concat   ; 写 scriptErrorMessage
```

- **后台完成回调**：`ScriptManager.<>c__DisplayClass808_0.<ScriptCommandExecute>b__3` @**0x31cc128**（核心 0x31cc1b0-0x31cc214）：

```
0x31cc1bc  bl   #0x4f94240  CALL UnityEngine.Sprite$$Create     ; pivot(0.5,0.5), ppu 1.0
0x31cc1cc  ldr  x0, [x8, #0x210]        ; ScriptManager.spriteMask
0x31cc1d8  bl   #0x509f190  CALL UnityEngine.SpriteMask$$set_sprite
0x31cc1f8  mov  w1, #1
0x31cc200  bl   #0x4fd4510  CALL UnityEngine.GameObject$$SetActive   ; 打开 mask 物件
0x31cc210  strb wzr, [x8, #0x732]       ; isSpriteMaskLoading = false
```

  闭包类 `<>c__DisplayClass808_0 { ScriptManager <>4__this 0x10; string[] pd 0x18; string tag 0x20 }`（dump.cs 167621）。
- **遮罩目标与形状**：目标是 `ScriptManager.spriteMask 0x210`（`UnityEngine.SpriteMask` 组件，`class_ScriptManager.txt` 171 行）；形状/范围=**加载到的精灵 `Image/mask_<name>` 自身的 alpha 形状**（不是矩形/圆的代码分支）——即「自定义贴图遮罩」，`ConvertSpriteMaskName @0x31b39b4` 产出 `Image/mask_{0}`（0x31b39cc 字面量）。
- **wait/状态机集成**：这是本组唯一带等待的命令：`state=LOAD(4)` + `waitType="spriteMaskSet"` + `isSpriteMaskLoading`；完成回调清 flag。阅读器**必须**把「加载完成」视为同帧或立即可达，否则会卡流程。
- **置信度**：高。未决项：`spriteMaskSet` 是否有第二个参数（简报里 `pd4=颜色` 的 evidence `0x318d2b8` 属相邻命令区间，实测本 handler 只读 element[0]，`INFERRED`：第 2 参数不存在或已废弃）。

### spriteMaskOff

- **handler**：`0x3187440`（tag 比较 @0x3187438）。**无 arity 检查、无参数**。

```
0x3187440  ldr  x0, [x19, #0x210]        ; ScriptManager.spriteMask
0x3187450  bl   #0x509f190  CALL UnityEngine.SpriteMask$$set_sprite   ; null
0x318745c  bl   #0x4fd06d4  CALL UnityEngine.Component$$get_gameObject
0x3187470  bl   #0x4fd4510  CALL UnityEngine.GameObject$$SetActive    ; false
0x3187474  b    #0x3193f00                   ; Normal
```

- **注意**：`spriteMaskOff` **不**清 `isMaskEnabled(0x731)`，也不复位 `isSpriteMaskLoading`——它只清 sprite 并隐藏物件。阅读器对应「取消遮罩」而不是「重置遮罩系统」。
- **补充**：`spriteMaskOn` **不是**调度器命令（`il2cpp_out/lit_methods.json` 中该字面量只出现在 `AnalysText` 0x31aa4d0/0x31ad218；`cmd_names_full.txt` 只有 `spriteMaskOff/spriteMaskSet`）。阅读器遇到 `[spriteMaskOn ...]` 可直接忽略。
- **置信度**：高。

### Web 侧等价物建议（畸变 / 遮罩）

* **畸变**：等价物是 shader，DOM 没有原生对应。可行顺序：
  1. **SVG filter**：注入 `<filter><feTurbulence/><feDisplacementMap scale=strength>`，用 CSS `filter: url(#distortion)` 贴到舞台容器，`sec` 用 CSS transition/animation 驱动；`_CenterX/_CenterY` 只能转成局部偏移（SVG 无法按任意中心缩放位移场，需用 `feOffset`+`feComposite` 近似）→ 边缘会有拉伸伪影，需按 `range` 裁切。
  2. **Canvas/WebGL**：若舞台已是 canvas（否则新建离屏 canvas 采样 DOM 不可行），直接把 `_CenterX/_CenterY/_Strength/_Range/_Coefficient` 当 uniform 写位移贴图，才能忠实复刻。
  3. **降级**：都不做时把状态记全、每帧推进计时器（rate 曲线一致），只输出一次诊断；**绝不能因缺 shader 卡流程**（原版本组命令都不阻塞）。
* **精灵遮罩**：有 `Image/mask_*.png` 时用 CSS `-webkit-mask-image/-webkit-mask-position` + `mask-mode:luminance|alpha`，`charaMask` 的 inside/outside 用 `-webkit-mask-composite: source-in / xor`（或对角色节点单独套 `mask-image` 并反转 alpha 副本）等价；`mix-blend-mode` 不能替代（它是混合不是裁剪）。
* **资源缺失的安全降级**：`spriteMaskSet` 找不到贴图 → 记录一次诊断、直接当「加载完成」（不要进等待）、把 mask 视为关闭；`charaMask` 槽位不存在 → 静默跳过（原版 0x3183fc8 就是静默）。

---

## 拉伸、翻页和滚动

### stretchin / stretchout（共享 handler）

- **handler**：共享体 `0x3187cbc`（tag case：`stretchin` case_entry `0x317dc3c`、`stretchout` case_entry `0x317cea8`，都经 verify `0x3187cb4` 进入；handler 开头只做 `ldrb w8,[x19,#0x508]`(isExecuteStretch) 检查后跳 **body `0x318924c`**）。
- **参数消费**：arity **≥ 1**（`cmp w8,#1; b.lt 0x3191820` @0x3189258）；name=element[0]；`duration`：**仅当** `IsNormalPlaySpeed` && len≥3 && element[1]==' ' 时 `Single.Parse(element[2])`，否则 0；`scale`：len≥5 && element[3]==' ' 时 `Single.Parse(element[4])`，否则 1.0；方向 `isIn` = (tag=='stretchin')。

```
0x3189268  bl   #0x31b5324  CALL ScriptManager$$IsNormalPlaySpeed
0x3189280  cmp  w9, #3       ; len>=3 ?
0x3189294  ldr  x0, [x8, #0x28]      ; element[1]
0x3189298  ldr  x1, #' '             ; 必须正是空格
0x318929c  bl   #0x4870cc0  CALL System.String$$op_Equality
0x31892bc  ldr  x0, [x8, #0x30]      ; element[2]
0x31892c4  bl   #0x49e8728  CALL System.Single$$Parse        ; duration
0x31892dc  ldr  x1, [x8, #0x20]      ; element[0]
0x31892e8  bl   #0x31b1530  CALL ScriptManager$$ConvertNameString
0x3189304  bl   #0x4870cc0  CALL System.String$$op_Equality   ; tag=='stretchin' -> isIn
0x3189318  fmov s9, #1.00000000                              ; scale 默认 1.0
0x3189334  ldr  x0, [x8, #0x38]      ; element[3] == ' ' ?
0x3189358  ldr  x0, [x8, #0x40]      ; element[4]
0x3189360  bl   #0x49e8728  CALL System.Single$$Parse        ; scale
0x3189380  bl   #0x31b9c28  CALL ScriptManager$$StartStretch
```

- **后端**：`ScriptManager$$StartStretch(string name,bool isIn,float duration,float scale) @0x31b9c28`
  * 忙（`isExecuteStretch 0x508`）→ 返回 false（0x31b9cd8-0x31b9d00）；未知名称 → `state=0x10(ERROR)`（per presentation.md §3.5）；
  * 名称词汇（0x31b9c70-0x31b9ccc）：**`horizontally / horizontallyLeft / horizontallyRight / vertical / verticalUp / verticalDown / full`**；完成回调字面量 `'EndExecuteStretch'`；
  * 对 `stretchBase(0xC8)` 同时起缩放与位移动画：

```
0x31b9d84  bl   #0x4fd06d4  CALL UnityEngine.Component$$get_gameObject
0x31b9d9c  bl   #0x3619af0  CALL TweenScale$$Begin        ; (go, duration, sx,sy,sz)
0x31b9de0  bl   #0x4fd06d4  CALL UnityEngine.Component$$get_gameObject
0x31b9df8  bl   #0x3619114  CALL TweenPosition$$Begin     ; (go, duration, x,y,z)
```

  * 目标 transform 取自**共享静态预设**：`adrp x22,#0x5571000; ldr x22,[x22,#0xa88]; ldr x8,[x22]; ldr x8,[x8,#0xb8]`（=该元数据槽指向的类静态区）：缩放目标 3 float @+0xc/+0x10/+0x14、位置目标 3 float @+0x0/+4/+8（0x31b9d30-0x31b9d60）；
  * 反向（stretchout）用 `±stretchBaseRange * scale` 计算位移，例：`'horizontallyRight'` → `ldr s0,[x19,#0x50c]; fnmul s11,s0,s9`（0x31b9eb8，`stretchBaseRange` = ScriptManager 0x50C/0x510 Vector2）；
  * 成功后写 `stretchName(0x500)`、`isExecuteStretch(0x508)=1`（0x31b9e40-0x31b9e48）。
- **“画面变形”具体指什么**：不是几何形变网格，而是**把整块剧情显示层（`stretchBase` UIWidget，即承载 ScriptAction RT 的 UI 根）做 scale + translate 的补间**，配合 `stretchBaseRange` 让画面「被拉出去/缩回来」（黑边式过场）。子层有同构实现（下条）。
- **置信度**：高（名称词汇、Tween 目标、回调、状态写入均实测）。**未决项**：静态预设（元数据槽 0x5571a88）的类名未解析（多次尝试：槽内是 metadata-usage 表项，类名需 metadata 解析），其 6 个 float 的具体数值在运行时才由该 .cctor 写入；`implied`（INFERRED）：`sx,sy,sz / px,py,pz` 即「拉伸到位的默认 transform」。
- **语料**：`stretchin` 4 次、`stretchout` 1 次（`[stretchin full 2.0 2.0]`、`[stretchin full 0.1 1.0]`、`[stretchout full 3.0 3.0]` 等）——**只用到 `full`**。

### stretchOff

- **handler**：`0x3181c60`；**无参、无 arity 检查**：

```
0x3181c60  mov  x0, x19
0x3181c68  bl   #0x31a1cfc  CALL ScriptManager$$InitStretch
0x3181c6c  b    #0x3193f00
```

- **后端**：`ScriptManager$$InitStretch @0x31a1cfc`：读同一静态预设（`ldp s8,s9,[x8,#0xc] / ldr s10,[x8,#0x14]` 与 `ldp s11,s12,[x8] / ldr s13,[x8,#8]`，0x31a1d74-0x31a1db4），若 `isExecuteStretch` 则关掉 stretchBase 上的 Tween 组件（`GetComponent<>+Behaviour$$set_enabled(false)`，0x31a1dfc/0x31a1e14）并按预设复位缩放/位置；随后清 `stretchName(0x500)/isExecuteStretch(0x508)`（per presentation.md §3.5）。
- **语料**：0 次；**阅读器要点**：等价实现 = 取消补间 + 复位 `transform: none` + 清状态。
- **置信度**：高。

### subStretch

- **handler**：`0x3187f58`；arity **== 1**（`cmp w9,#1; b.ne 0x3191820` @0x3187f68），element[0] ∈ `on|off`：

```
0x3187f74  ldr  x9, [x9, #0x30]  ; &'on'
0x3187f80  bl   #0x4870cc0  CALL System.String$$op_Equality
0x3187f88  ldr  x0, [x19, #0x260]        ; subLayerManager
0x3187f90  mov  w1, #1
0x3187f94  b    #0x318c364
0x318c344  ldr  x9, [x9, #0x20]  ; &'off'     (0x318c350 op_Equality)
0x318c360  mov  w1, wzr
0x318c368  bl   #0x31dfb10  CALL ScriptSubLayerManager$$SetSubStretch
```

- **语义**：`[subStretch on|off]` 把「子层拉伸」整套开关交给 `ScriptSubLayerManager.SetSubStretch(bool) @0x31dfb10`（管理器字段 `isInvalidStretch 0x48`，`class_ScriptSubLayerManager.txt`）。语料 `[subStretch on]` 1 次。
- **置信度**：高。

### subStretchin / subStretchout（共享 handler）

- **handler**：共享体 `0x317d3a4`（tag case：`subStretchin` case_entry `0x317a24c`、`subStretchout` case_entry `0x317d374`，都经 verify `0x317d398` 进入）。
- **参数消费**：arity **≥ 1**；`duration` 同 stretchin（normalspeed && len≥5 && element[3]==' ' → `Single.Parse(element[4])`，0x317d3c0-0x317d420）；`element[0]` = 子层 key；`element[2]` = 方向名；`element[6]` = scale（len≥7 && element[5]==' '，0x318ce54-0x318ce90）。
- **行为**：

```
0x317d43c  ldr  x1, [x8, #0x20]          ; element[0] = layer key
0x317d444  bl   #0x31df7cc  CALL ScriptSubLayerManager$$GetScriptSubLayer
0x317d474  bl   #0x4fd3cbc  CALL UnityEngine.Object$$op_Inequality
0x317d478  tbnz w0, #0, #0x317d480
0x317d47c  b    #0x3193f00               ; 层不存在 -> 静默 Normal（不报错）
0x317d484  ldrb w8, [x21, #0x60]         ; ScriptSubLayer.IsExecuteStretch
0x317d488  cbz  w8, #0x318cdf4
0x317d490  ldr  x8, [x8, #0xe68]  ; &'subStretch'   -> 报错/诊断分支 0x318cb80
```

  正常路径 0x318cdf4：tag=='stretchin' → isIn（0x318ce34），name=`ConvertNameString(element[2])`（0x318ce14），最后

```
0x318ce94  fmov s0, s8                   ; duration
0x318ce98  fmov s1, s9                   ; scale
0x318ce9c  ldr  s2, [x19, #0x50c]        ; stretchBaseRange.x
0x318cea0  ldr  s3, [x19, #0x510]        ; stretchBaseRange.y
0x318cea4  and  w2, w23, #1              ; isIn
0x318ceb0  mov  x0, x21                  ; ScriptSubLayer
0x318ceb4  bl   #0x31dea10  CALL ScriptSubLayer$$StartSubStretch
```

- **后端**：`ScriptSubLayer.StartSubStretch(name,isIn,duration,scale,Vector2 stretchBaseRange) @0x31dea10`：与 `StartStretch` 同构（同 7 个名称字面量、同 `'EndExecuteStretch'`、忙检查 `IsExecuteStretch 0x60`），Tween 目标是 `subStretchBase(0x80)`（子层自己的 UIWidget），目标 transform 同样取自 0x5571a88 静态预设（0x31deb20-0x31deb60）。
- **语料**：两命令均 0 次。
- **置信度**：高（参数映射与调用实测）。未决项：`subStretch on/off` 与 `subStretchin/out` 的耦合（`SetSubStretch` 内部行为未逐行解析，INFERRED：开关整个子层拉伸容器）。

### screen

- **handler**：`0x31804c8`；arity **== 9** 且 element[1]/[3]/[5]/[7] 必须都是 `' '`（0x31804d4 `cmp w9,#9`、0x31804f0/0x318051c/0x3180544/0x3180574 四处 `op_Equality(' ')`）。
- **参数消费**：element[0] 与字面量 **`'true'`** 比较 → `isWindowBack`（0x3180620-0x3180638）；Int32.Parse 依次读 element[2]（x）、element[4]（y）、element[6]（w）、element[8]（h）（0x31805a4/0x31805c8/0x31805ec/0x3180610）。

```
0x3180638  and  w5, w0, #1
0x3180640  mov  w1, w21      ; x
0x3180644  mov  w2, w23      ; y
0x3180648  mov  w3, w20      ; w
0x318064c  mov  w4, w24      ; h
0x3180650  b    #0x318a2e8
0x318a2e8  mov  x6, xzr
0x318a2ec  bl   #0x31d193c  CALL ScriptMessageCommonManager$$SetScreen
0x318a300  bl   #0x3176a74  CALL ScriptLogMessage$$SetHomePosition
0x318a310  ldr  x8, [x8, #0xfc0]  ; &'clear'
0x318a314  strb w9(=1), [x19, #0x375]    ; ScriptManager.isCancelInput = true
```

- **语义**：`[screen <true|false> <x> <y> <w> <h>]` = **消息窗口在屏幕坐标系中的矩形**（不是画面几何变形！），`isWindowBack` 是窗口底板开关；返回值再喂给 `ScriptLogMessage.SetHomePosition`（回想/日志里的滚动定位）。`ScriptMessageCommonManager` = `ScriptManager.messageManager 0x28`。
- **注意**：简报里 `pd0=子层 key(#A 等)` 是误判（实测 element[0] 只与 `'true'` 比较）。
- **阅读器补齐要点**：纯逻辑（窗口 rect）——读者若已用 DOM 渲染文本框，直接把这四个像素值写进文本框容器的 `left/top/width/height`；`isWindowBack` 控制底板显示；`isCancelInput` 可忽略（原版用它防点击穿透）。资源/数据缺失时**忽略即可，不阻塞**。
- **语料**：0 次（`[screen ...]` 在本仓库语料未出现）。置信度：高。

### turnPageOn / turnPageOff

- **handler**：`turnPageOn 0x317d4e8`（arity **≤1**，`cmp w8,#1; b.gt 0x3191820`）、`turnPageOff 0x3182720`（arity **==0**，`cbnz w8,#0x318d244`）。
- **行为**：都收敛到 `ScriptMessageCommonManager.SetForcedDisableTurnPage(bool flag, bool force=false) @0x31d1c0c`：

```
0x317d500  ldr  x8, [x8, #0xe48]  ; &'f'
0x317d510  bl   #0x38ab830  CALL System.Linq.Enumerable$$Contains<object>   ; pd 里是否有 "f"
0x317d514  b    #0x318c6d4
0x318c6d0  mov  w0, wzr            ; 无参路径: contains=false
0x318c6d4  ldr  x8, [x19, #0x28]   ; ScriptMessageCommonManager
0x318c6dc  and  w2, w0, #1         ; force
0x318c6e4  mov  w1, wzr            ; flag=false  -> 允许翻页
0x318c6e8  bl   #0x31d1c0c  CALL ScriptMessageCommonManager$$SetForcedDisableTurnPage

0x3182720  ldr  x8, [x20]
0x318272c  cbnz x8, #0x318d244     ; 带参即报错
0x3182730  ldr  x0, [x19, #0x28]
0x3182738  mov  w1, #1
0x318273c  mov  w2, wzr
0x3182744  bl   #0x31d1c0c  CALL ScriptMessageCommonManager$$SetForcedDisableTurnPage
```

- **语义**：`turnPageOff` = 强制禁用翻页；`turnPageOn` = 解除禁用，`[turnPageOn f]` 时 `force=true`（强制立即解除）。相关状态：`ScriptMessageCommonManager.isForcedDisableTurnPage 0x1D3 / isForcedEnableTurnPage 0x1D4`（dump.cs 169707）。翻页是**文本框的「ページ送り」**，与贴图/子层无关（简报里「翻页效果（贴图? 子层?）」的疑问：都不是）。
- **阅读器补齐要点**：纯逻辑：`Stage.turnPage = {forcedDisable:bool, forced:bool}`；因为 Web 文本框没有翻页动画，实现为「状态记录 + 允许/禁止一次性放完」即可，视觉上可无差别；**不要**报错或阻塞。语料：`turnPageOn` 12 次（其中 1 次带 `f`）、`turnPageOff` 11 次。
- **置信度**：高（`f` 语义为「强制」由 `force` 形参名 + 0x318c6dc 传参实测；语义命名据 dump.cs，非猜测）。

### scrollStop

- **handler**：`0x317f1a0`；arity **== 0**（`cbnz w8,#0x3193e80` @0x317f1ac）：

```
0x317f1a0  ldr  x8, [x20]
0x317f1ac  cbnz w8, #0x3193e80     ; 带参即参数检查失败
0x317f1b0  mov  w8, #1
0x317f1b8  strb w8, [x19, #0x42c]  ; ScriptManager.isScrollStop = true
0x317f1bc  b    #0x3193f04         ; Normal
```

- **谁消费**：`ProcessScript` 在显示消息行时把它交给 `ScriptMessageCommonManager.ReturnScroll(bool isFast, bool isScrollStop) @0x31d4840`，随后清零：

```
0x31c1d0c  ldrb w2, [x19, #0x42c]        ; isScrollStop
0x31c1d14  cmp  w21, #0
0x31c1d18  csinc w1, w8(=1), wzr, eq     ; isFast
0x31c1d1c  bl   #0x31d4840  CALL ScriptMessageCommonManager$$ReturnScroll
0x31c1d2c  strb wzr, [x19, #0x42c]       ; 消费后清 0
```

- **语义**：`scrollStop` **停的是「下一条消息文本出现的滚动」**（ReturnScroll = 文本是否逐字/滚动出现），不是页面滚动、也不是镜头。字段：`ScriptManager.isScrollStop 0x42C`（`class_ScriptManager.txt` 313 行）；写点只有 handler 0x317f1b8 与 ProcessScript 的清零点 0x31c1d2c。
- **阅读器补齐要点**：纯逻辑一次性 flag：`pending.scrollStop = true` → 下一条 `message`/`talkStart` 落字时取「立即整段显示」；随后清 flag。语料 0 次；缺资源无关。
- **置信度**：高。

---

## 战棋/战斗演出

> 这一组的 handler 全在同一个巨型调度器里，但**后端全在 `WarBoardManager`（战棋盘面）**上；语料零覆盖（见下）。先给共享后端，再逐命令。

### 共享后端：WarBoardManager（棋子/格子/相机/特效）

类：`WarBoardManager : SingletonMonoBehaviour<WarBoardManager>`（dump.cs 439591；`class` 名与实例槽实测：`adrp x8,#0x559d000; ldr x8,[x8,#0x278]; ldr x0,[x8]; bl SingletonMonoBehaviour<object>$$get_Instance @0x47e721c`，随后直接调 `WarBoardManager$$*`）。

关键字段（`tools/klass.py '^WarBoardManager$' members`）：

| 字段 | 偏移 | 说明 |
|---|---|---|
| `boardRoot` / `boardObjectRoot` | 0x20 / 0x28 | 盘面根节点 |
| `mapCamera` (`MapCamera`) | 0x30 | 战棋相机 |
| `squarePrefab` / `roadPrefab` / `effectPrefab` | 0x60 / 0x68 / 0x88 | 格子/道路/特效 prefab |
| `masterPiecePrefab` / `servantPiecePrefab` | 0x90 / 0x98 | 棋子 prefab |
| `cameraRootPrefab` / `cameraRootAnimation` / `mapCameraComponent` | 0xC8 / 0xD0 / 0xD8 | 相机根 + SimpleAnimation + 相机组件 |
| `backgroundComponent` | 0x160 | 底板 |
| `centerPosition` (Vector2) | 0x198 | 盘面中心（相机坐标偏移基准） |
| **`squarePositionDict` (Dictionary<int,Vector3>)** | **0x1C8** | **格子编号 → 世界坐标** |
| `selectPiece` (WarBoardPieceData) | 0x2E8 | 当前选中棋子 |
| `battleData` / `battleEntity` / `battleRandom` | 0x248 / 0x268 / 0x270 | 战斗数据（棋子/演员的 HP 等） |

* **格子坐标换算 `GetSquarePosition(int squareIndex) @0x2b147ac`**：

```
0x2b14808  adrp x8, #0x5571000
0x2b1480c  ldr  x8, [x8, #0xa88]        ; 共享静态预设（与 stretch 同一槽）
0x2b14810  ldr  x0, [x20, #0x1c8]       ; squarePositionDict
0x2b14814  ldr  x8, [x8]
0x2b14818  ldr  x8, [x8, #0xb8]
0x2b1481c  ldr  d0, [x8]                ; 默认值 = 静态预设 Vector3（x,y）
0x2b14820  ldr  s1, [x8, #8]            ; z
0x2b14838  mov  w1, w19                 ; squareIndex
0x2b14844  bl   #0x3fe2858  CALL System.Collections.Generic.Dictionary<int, Vector3>$$TryGetValue
```

  → **格子不是算法换算，而是查表**；表在运行时由战棋数据装配（数据源 = 战棋地图/盘面数据，见下）。
* **参数错误分支**（本组多次引用）：`0x318d244` 与 `0x3193e80` 都把字面量 **`'parameter error'`**（0x55c9000+0x58）写入 scriptErrorMessage 后 **`b 0x3193f00`(=Normal)**——即**原版参数不合法也不中断脚本**，阅读器应照抄。
* **棋子查询 `GetPiecePosIndexScript(int[] targetPiece) @0x2b337d8`**（int[3] = 格子 x,y,z）：

```
0x2b337dc  cbz  x1, ...                 ; 数组/越界检查（len<3 直接抛）
0x2b33810  bl   #0x2b0a668  CALL WarBoardData$$GetPieceOnDisplay      ; (x,y,z) -> 棋子
0x2b33818  cbz  x0, #0x2b33880          ; 找不到 -> 返回 -1
0x2b3381c  ldr  x0, [x0, #0x110]        ; 棋子渲染组件
0x2b33828  bl   #0x4fd0604  CALL UnityEngine.Component$$get_transform
0x2b33840  bl   #0x4fe1830  CALL UnityEngine.Transform$$get_position
0x2b33850  bl   #0x4f9a704  CALL UnityEngine.Camera$$WorldToViewportPoint
0x2b33854  fmov s1, #-0.5
0x2b33860  fadd s0, s0, s1              ; vx-0.5
0x2b33868  fcmp s1(|vx-0.5|), s2(阈值常量 0xee7000+0x5e8)
0x2b33878  csinc w0, w8(=2), wzr, le    ; 返回: -1 未找到 / 0 远离中心 / 1 右半 / 2 左半
```

  `WarBoardData$$GetPieceOnDisplay @0x2b0a668`、`MapZoom$$GetZoomSize @0x2934234`、`MapCamera$$StartAutoWork @0x2934e58` 为相邻后端。
* **相机移动统一入口 `MoveCameraScript(int posIndex,float moveTime,float zoom,string easeType,Vector2 targetPos,bool isBoardObject) @0x2b3362c`**：

```
0x2b336a0  ldr  x0, [x20, #0x50]        ; MapZoom
0x2b336ac  bl   #0x2934234  CALL MapZoom$$GetZoomSize
0x2b336b4  tbz  w22, #0, ...            ; isBoardObject
0x2b336b8  ldr  s0, [x23, #0x198]       ; += centerPosition.x/y
0x2b336d0  cmp  w21, #2                 ; posIndex
0x2b336e8  mov  w9, #0x42c80000         ; posIndex==1 -> x +100
0x2b336f0  mov  w9, #-0x3d380000        ; posIndex==2 -> x -100
0x2b33730  bl   #0x2b22d74  CALL WarBoardManager$$GetEaseTypeScript
0x2b33754  bl   #0x2934e58  CALL MapCamera$$StartAutoWork
```

  `GetEaseTypeScript(string) @0x2b22d74` 的缓动词表（iTween 全套，字面量实测）：
  `linear, spring, punch, easeIn|easeOut|easeInOut × {Quad,Cubic,Quart,Quint,Sine,Expo,Circ,Elastic,Back,Bounce}`。

### warBoardTalkScreen

- **handler**：`0x317cd60`；**无参**（`shared_tail=0x3193f00`）。

```
0x317cd6c  bl   #0x31cc8ac  CALL ScriptMessageCommonManager$$GetMessageBackSprite
0x317cd9c  bl   #0x4fd3cbc  CALL UnityEngine.Object$$op_Inequality
0x317cdd0  bl   #0x2dbf24c  CALL AtlasManager$$SetWarBoardImage  args: x1='img_talk_textbg'
0x317cde0  bl   #0x31cc8c4  CALL ScriptMessageCommonManager$$GetTalkNameBackSprite
```

- **语义**：把消息窗口的底板/名牌底板换成战棋专用图（`AtlasManager.SetWarBoardImage(sprite,'img_talk_textbg') @0x2dbf24c`；名牌走另一个 SetWarBoardImage 调用）。纯表现层，无 wait。
- **置信度**：高（第一个图集名实测；名牌图名字面量未取，未决）。
- **阅读器**：若已实现文本框底板，可换一张「战棋盘面对话」底板；否则忽略。语料 0 次。

### warCharaFadein

- **handler**：`0x317ac68`；arity **≥ 13**（`cmp w9,#0xd; b.lt 0x3193e80`）。
- **参数消费**：element[0]=角色槽（`ConvertCharaIndex` 0x317ac88）；element[2]=float（时长）；element[4]=int；element[6]=int；element[8]/[10]/[12]=int → **int[3]**（`new int[3]` @0x317ad58，元素写入 0x317ad8c/0x317adbc/0x317af4）。

```
0x317ae04  mov  x1, x23                            ; int[3] 格子/坐标
0x317ae0c  bl   #0x2b337d8  CALL WarBoardManager$$GetPiecePosIndexScript
0x317ae10  cmp  w0, #2
0x317ae1c  cneg w8, w19, eq                        ; 左半屏 -> x 取负（镜像）
0x317ae24  csel w8, wzr, w8, lt                    ; 找不到(-1) -> x=0
0x317ae2c  scvtf s0, w8
0x317ae2c  scvtf s1, w22
0x317ae30  bl   #0x316fb48  CALL ScriptCharaData$$SetPosition
0x317ae38  b    #0x3182f74                         ; MoveAlpha(duration, 1.0)
0x3193b04  bl   #0x316fd5c  CALL ScriptCharaData$$MoveAlpha
```

- **语义**：`[warCharaFadein <槽位> <时长> <x> <y> <gx> <gy> <gz>]`：先用 int[3] 定位战棋棋子 → 用其屏幕左右半（返回 1/2）决定是否镜像 x → `ScriptCharaData.SetPosition(x,y)` + `ScriptCharaData.MoveAlpha(duration, alpha=1.0)` 淡入。
- **依赖**：`WarBoardData.GetPieceOnDisplay`（棋子表）+ 相机视口换算 → **需要游戏数据源**。
- **置信度**：中高（调用链与分支实测；元素[4]/[6] 与 x/y 的对应由 `cneg w8,w19` 与 `scvtf s1,w22` 推出，`INFERRED`）。

### warEventScript

- **handler**：`0x317a1bc`；arity **≥ 1**；element[0]=int（事件脚本编号）。

```
0x317a1d8  bl   #0x49d31f4  CALL System.Int32$$Parse
0x317a1f0  bl   #0x47e721c  CALL SingletonMonoBehaviour<object>$$get_Instance
0x317a1f8  mov  w1, w19
0x317a1fc  mov  w2, #1
0x317a204  bl   #0x2b33edc  CALL WarBoardManager$$AddEventScript
```

- **语义**：把战棋事件脚本编号注册进战棋事件队列（`AddEventScript(int eventId, bool)`），**不是** ADV 插入脚本。阅读器无对应概念 → 跳过 + 诊断。
- **置信度**：高。

### warEffectOff / warEffectPiece / warEffectPos / warEffectSquare

四个 handler 都只做参数整形 + 转发，全部经 `SingletonMonoBehaviour<WarBoardManager>.get_Instance @0x47e721c`：

| 命令 | handler / arity | 参数（token 下标） | 调用 |
|---|---|---|---|
| `warEffectOff` | `0x317fc60` / ≥1 | [0]=key | `WarBoardManager$$StopEffectScript(key) @0x2b33bb0`（0x317fc94） |
| `warEffectPiece` | `0x317fd14` / ≥9 | [0]=key, [2]=特效名, [4]/[6]/[8]=int → int[3] | `$$PlayEffectPieceScript(key,effectName,int[3]) @0x2b3389c`（0x317fdfc） |
| `warEffectPos` | `0x3186664` / ≥7 | [0]=key, [2]=特效名, [4]=float x, [6]=float y | `$$PlayEffectPosScript(key,effectName,Vector2(x,y)) @0x2b33bac`（0x31866dc） |
| `warEffectSquare` | `0x317f470` / ≥5 | [0]=key, [2]=特效名, [4]=int 格子号 | `$$PlayEffectSquareScript(key,effectName,squareIndex) @0x2b33a64`（0x317f4c4） |

```
0x317fd2c  mov  w1, #3
0x317fd40  bl   #0x2230564  CALL 0x2230564          ; new int[3]（数组分配）
0x317fdfc  bl   #0x2b3389c  CALL WarBoardManager$$PlayEffectPieceScript
0x31866d0  mov  x1, x19                              ; key
0x31866dc  bl   #0x2b33bac  CALL WarBoardManager$$PlayEffectPosScript
```

- **语义**：key 是脚本侧句柄（同一 key 后续可 `warEffectOff` 停）；位置可用「盘面格号」（Square）、「平面坐标」（Pos）、「棋子坐标 int[3]」（Piece）三种定位。特效资源侧只有间接证据：同类函数 `WarBoardManager$$CreateEffect @0x2b136b0` 与字段 `effectPrefab 0x88`（`PlayEffect*Script` 的内部装载链未逐行展开，`INFERRED`）。
- **阅读器**：跳过 + 诊断（见 §本组小结）。
- **置信度**：高（签名取自 dump.cs 440888-440897，与调用寄存器一一对应）。

### warMoveCameraPiece / warMoveCameraPos / warMoveCameraSquare

| 命令 | handler / arity | 参数（token 下标） | 调用（签名来自 dump.cs 440876-440882） |
|---|---|---|---|
| `warMoveCameraPiece` | `0x3187cec` / ≥13（≥19 时另有一组） | [0]=int posIndex, [2]=float moveTime, [4]=float zoom, [6]=string easeType, [8][10][12]=int[3] targetPiece；[14][16][18]=int[3] targetPiece2（可选） | `MoveCameraPieceScript(posIndex,moveTime,zoom,easeType,int[],int[]) @0x2b332a4`（0x318cb54） |
| `warMoveCameraPos` | `0x317df90` / ≥11 | [0]=int posIndex, [2]=float moveTime, [4]=float zoom, [6]=string easeType, [8]/[10]=float → Vector2 | `MoveCameraPosScript(posIndex,moveTime,zoom,easeType,Vector2) @0x2b337d0`（0x317e080） |
| `warMoveCameraSquare` | `0x3183030` / ≥9 | [0]=int posIndex, [2]=float moveTime, [4]=float zoom, [6]=string easeType, [8]=int squareIndex | `MoveCameraSquareScript(posIndex,moveTime,zoom,easeType,squareIndex) @0x2b33778` |

寄存器映射实测例（`warMoveCameraPos`）：

```
0x317dfac  bl   #0x49d31f4  CALL System.Int32$$Parse        ; posIndex=element[0]
0x317dff0  fmov s8, s0                                       ; moveTime=element[2]
0x317e020  fmov s9, s0                                       ; zoom    =element[4]
0x317e018  ldr  x21, [x8, #0x50]                             ; easeType=element[6]
0x317e044  fmov s10, s0                                      ; targetPos.x=element[8]
0x317e050  fmov s11, s0                                      ; targetPos.y=element[10]
0x317e080  bl   #0x2b337d0  CALL WarBoardManager$$MoveCameraPosScript
```

- **相机模型**：`MoveCamera*Script` → `MoveCameraScript`（§共享后端）→ `MapCamera.StartAutoWork`；`zoom` 与 `moveTime`、`easeType`（iTween 词表）、`posIndex`（1=+100 / 2=-100 的屏幕侧偏移）共同决定。`isBoardObject` 分支把 `centerPosition(0x198)` 加到目标上。
- **置信度**：高（参数寄存器与 4 个函数签名互证）。未决项：`MapCamera`/`MapZoom` 的 tween 细节与相机 RT 分辨率（未展开；战棋另有一套 3D 相机栈）。

### 语料与可达性（问题 C 的依据）

* `work/coverage/tag_counts.json`（counts 列表）：**本组 10 条全部缺失（0 次）**；直接 grep 语料 `F:\Project\fgo\scripts`（2583 个 txt / 1,867,761 行）：`grep -rl "\[war" → 0 个文件`。
* 对照：同文件里 `distortionstart 13 / distortionstop 11 / stretchin 4 / stretchout 1 / subStretch 1 / turnPageOn 12 / turnPageOff 11`（`charaMask/spriteMask*/screen/stretchOff/subStretch*/scrollStop` 0 次）。
* 这些命令的调用条件是 `WarBoardManager.Instance` 存活；入口 `ScriptManager.PlayWarBoardMessage(int stageId,int sceneType,long scriptId,Action callbackFunc)`（`class_ScriptManager.txt` 600 行）说明**战棋盘面对话走同一 ScriptManager**，即：命令属于「战棋专用演出脚本」，不进主线 ADV。
* 全部 war 命令 handler **都没有 wait 集成**（不写 `state/waitType`，直接 `b 0x3193f00`），即不阻塞脚本；管理器缺失时它们走 `0x318f114` 的 NullRef 分支（`bl 0x2230720`，统一空引用抛点）——**原版在战棋外调用会抛异常，阅读器跳过反而更稳**。

**建议**：**实现为「可识别 + 跳过 + 一次性诊断」，不做完整建模**。依据：① 语料 0 次，主线剧情不会触发；② 依赖 3D 相机、盘面 prefab、格子坐标表与棋子数据，属于另一套渲染栈（DOM/CSS 无法承载世界坐标→视口投影）；③ 无 wait/状态耦合，跳过不会改变流程；④ 逐条记录诊断可让「将来接入战棋回放」时不丢信息。

---

## 本组小结

### 1) 缺口分类（26 条命令）

| 类别 | 命令 | 说明 |
|---|---|---|
| **a) 纯逻辑缺口（可实现等价）** | `turnPageOn`、`turnPageOff`、`scrollStop`、`stretchOff`、`stretchin`、`stretchout`、`subStretch`、`subStretchin`、`subStretchout`、`screen` | 全部是「参数 → 状态/补间」；补间用 CSS transition/transform 或 JS 帧驱动即可等价；无原始资源依赖 |
| **b) 需原始资源（shader/RT/贴图）** | `distortionstart`、`distortionloop`、`distortionstop`（Custom/Sprite-ScriptActionRenderDistortion + 5 个材质属性）、`spriteMaskSet`/`spriteMaskOff`（`Image/mask_<name>` 精灵 + SpriteMask）、`charaMask`（需要真遮罩渲染）；`subStretchin/subStretchout` 还涉及子层 RT | 逻辑可完整实现，**视觉**必须有 shader/贴图/RT 才能复刻 |
| **c) 需游戏数据源** | 10 条 `war*` | 需要 `WarBoardManager` 现场（格子字典 0x1C8、棋子表 `WarBoardData`、战棋相机 `MapCamera/MapZoom`、盘面 prefab）；ADV 语料 0 覆盖 |
| 资源缺失以外的行为注意 | `spriteMaskSet` 是本组唯一有 **wait 集成**（`state=4`+`waitType='spriteMaskSet'`+`isSpriteMaskLoading`）的命令；`distortion*`/其余全部不阻塞 | |

### 2) 最小可交付实现（不改渲染也能推进）

1. **参数解析**：按 §0 的「值/分隔符交错」模型给三组命令建参数读取器；`arity` 用 handler 的 `cmp` 常量做校验（11/13/1/…/9），不满足走「参数错误」诊断而非抛异常。
2. **状态机**（每帧更新）：`distortion: {timer, max, count, src[5], dest[5], rate=clamp(t/max), 若 count!=0 则 rate=1-2|0.5-rate|}`；`stretch: {name,isIn,scale,duration,progress}`；`spriteMask: {name,url,active,loading}`；`charaMask: maskInteraction per chara`；`turnPage/scrollStop: 一次性 flag`。
3. **可见效果**（低成本可行部分）：
   * stretch/subStretch：舞台层与子层节点的 `transform: scale()/translate()` + `transition: <duration>`，`stretchOff` 复位；`full` 优先（语料只用 `full`）。
   * `screen`：文本框 rect（px）。
   * `spriteMaskSet/Off`：若贴图可解析 → `-webkit-mask-image`；否则置「遮罩关闭」。
   * distortion：若有 WebGL 通路就上位移 shader；否则记录 rate 曲线并对舞台加可控的轻微 `filter` 近似（并标 diag）；**计时器必须照走**以便 `distortionstop`/`SkipDistortion` 语义正确。
4. **war***：统一「识别 → 不动作 → 记一条诊断 → return Normal」；**不走任何等待**。

### 3) 升级路径

1. distortion：实现 `Custom/Sprite-ScriptActionRenderDistortion` 的等价位移 shader（uniform：`_CenterX,_CenterY,_Strength,_Range,_Coefficient` + 纹理采样偏移），即可从「近似」升到「等价」；子层（`ScriptSubLayer.effectController 0x48`/`mesh 0x70`）各挂一份即可支持 `subBlur*/subCameraFilter` 同族。
2. 遮罩：拿到 `Image/mask_*` 资产后，`spriteMaskSet` 用 CSS mask（alpha/luminance）+ `-webkit-mask-composite` 实现 inside/outside；`charaMask` 只需把 `maskInteraction` 传给角色节点。
3. 拉伸：解析静态预设（元数据槽 **0x5571a88**，`[x8+0xB8]` 静态区，位置 3 float @0x0、缩放 3 float @0xC）即可拿到「拉伸到位」的精确 transform；同一槽也被 `GetSquarePosition` 当默认 Vector3 使用（说明是全局版面预设，值在运行时 .cctor 写入 → 需运行时采样）。
4. 战棋：要真做需接入 ① `WarBoardData`（`GetPieceOnDisplay @0x2b0a668`）与格子字典（`squarePositionDict 0x1C8`，来自战棋盘面数据）；② `MapCamera/MapZoom + StartAutoWork @0x2934e58` 与 iTween 缓动词表（`GetEaseTypeScript @0x2b22d74`）；③ 战棋 prefab（棋盘/棋子/特效）与 `warBoardTalkScreen` 的 `img_talk_textbg` 底板。

### 4) 安全降级（问题 D 汇总）

| 情况 | 原版行为 | 阅读器应做 |
|---|---|---|
| distortion shader/材质缺失 | 用材质属性插值，材质永远存在 | 照走计时器与状态；不渲染畸变也不报错（最多首次诊断一次） |
| `Image/mask_*` 缺失 | 加载失败写 `"<name> is not found"` 到 scriptErrorMessage | 记诊断、**当加载立即完成**、遮罩视为关闭，绝不进入等待 |
| `charaMask` 槽位不存在 | 静默 return Normal（0x3183fc8） | 同原版：静默跳过 |
| `subStretchin/out` 层 key 不存在 | 静默 return Normal（0x317d478） | 同原版：静默跳过 |
| `stretchin/out` 名称非法 | `state=0x10 ERROR` | 记诊断 + 不写 stretch 状态 |
| `stretchin` 忙（已在拉伸中） | 报错分支（字面量 `'stretch'` → 0x318cb80） | 记诊断 + 忽略本次 |
| `screen` 参数不足 / `turnPageOff` 带参 / `scrollStop` 带参 | 写 `'parameter error'` 到 scriptErrorMessage 后 **return Normal（不断脚本）**（0x318d244 / 0x3193e80） | 记诊断 + 忽略，不改状态，继续执行后续命令 |
| `war*` 在无战棋现场时 | 走 NullRef 分支（0x318f114） | 识别并跳过，**不做任何动作**，一次性诊断 |
| 任意本组命令的参数解析失败 | 单命令失败不影响脚本继续（调度器返回 Normal/Continue） | 捕获异常、按 Normal 继续，绝不中断后续命令 |

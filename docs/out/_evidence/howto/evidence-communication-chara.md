# communication/chara 证据补录

范围:FGO Android 2.139.3 / IL2CPP arm64 (`extract/lib/arm64-v8a/libil2cpp.so`)。
覆盖三组命令:通讯窗口(communicationChara 族 5 条)、角色切入与攻击(6 条)、角色循环及复位(5 条)。
所有 VA 为 ELF 虚拟地址;handler 均在 `ScriptManager$$ScriptCommandExecute`(0x3177290..0x319402c)内。
本文件为逆向补证,不修改任何游戏文件。

---

## 0. 前置修正:handler 收到的 token 数组模型(影响本组全部命令)

**结论(实测,高置信度)**:传入 handler 的字符串数组 = 脚本行的分词结果**去掉 tag**,但**保留分隔符 token**(单个空格 `' '` 与逗号 `','` 各占一个元素);数组长度在 `[x8,#0x18]`,第 k 个元素在 `[x8,#0x20+8k]`。

验证证据:

| 脚本行 | 实际 token 数组(去 tag 后) | 证据 |
|---|---|---|
| `[charaCutin G upToDown 0.1 0]` | `["G"," ","upToDown"," ","0.1"," ","0"]`(count=7) | handler 读 elem0→ConvertCharaIndex、elem1==' '、elem2→ConvertNameString、elem3==' '、elem4→Single.Parse、elem6→Single.Parse(0x318561c/0x3185650/0x3185678/0x31856bc/0x31856e0/0x3185708) |
| `[charaAttack H normal 0,0 0.5]` | `["H"," ","normal"," ","0",",","0"," ","0.5"]`(count=9) | elem5 `get_Chars(0)==0x2c(',')`(0x3186334)、elem7 `get_Chars(0)==0x20(' ')`(0x3186368)、elem4=X int、elem6=Y int、elem8=duration(0x31863cc/0x31863f4/0x31863a8) |
| `[communicationCharaLoop 98003003 -256,0 5 0 5]` | `["98003003"," ","-256",",","0"," ","5"," ","0"," ","5"]` | elem3 首字符 `==','` 走坐标分支(0x317efb0/0x317efc8/0x317eff4) |

> 与文档的偏差:`params-visual.md`/`brief-*.md` 把奇数位称为 "separator(此位不是参数值)"——这理解对索引本身没错,但它们把**同一条命令里属于别的共享块的读取点**也算了进来(见 §1 conflict)。

阅读器实现建议:分词器按「非空格非逗号字符连成词;每个空格/逗号各自成为 token」生成数组,再把 `[` 后的 tag 去掉,即与引擎一致;这样所有 pd 下标可逐一对齐本文件。

---

## 1. 通讯窗口(组名:communication)

### communicationChara / communicationCharaLoop(共享体 0x317ef18)

- handler:`0x317ef18`(两条命令共用同一块;tag 校验在 0x317eef8:加载字面量 `'communicationChara'` 后 `op_Equality`+`tbnz w0,#0 -> 0x317ef18`,0x317efc..0x317ef14)。
- 参数消费(pd = token 下标,含空格/逗号 token):

| pd | 形式 | 转换/校验 | VA |
|---|---|---|---|
| 0 | `svtId*10+limitCount`(int) | `Int32.Parse` → w21;`w21/10`(**0x66666667 魔数除法**,0x318ef00-0x318ef20)、`w21%10` | 0x317ef34 / 0x318ef10-0x318ef20 |
| 1 | `' '` | `String.op_Equality(elem1," ")`,不等 → 全 0 缺省路径 | 0x317ef74 |
| 2 | **分值位置**:位置表下标 **或** x 坐标 | elem3 首字符 `==','` ? `Int32.Parse(elem2),Int32.Parse(elem4)` → `ScriptPosition.GetPosition(float,float)` : `Int32.Parse(elem2)` → `ScriptPosition.GetPosition(int)` | 0x317ef94/0x317efb0;0x317f018-0x317f024;0x318ed94-0x318edd4 |
| 4 或 6 | `A`(语料恒为 5)→ 深度 | 存 w23;`z = -(w23) * 10.0` | 0x318ef9c-0x318efb8 |
| 6 或 8 | `noiseKind`(语料 0/1) | 存 w24 → 参数+0x10 | 0x318ee68-0x318ee80 / 0x317f070 |
| 8 或 10 | `faceType`(0..10) | 存 w20 → 参数+0x1C | 0x318f110/0x318eeb8 / 0x317f0c0 |

  取值示例(语料):`[communicationChara 98003003 1 5 0 5]`(位置表 1=中央、noiseKind=0、face=5)、`[communicationCharaLoop 98003003 -256,0 5 0 5]`(坐标 x=-256,y=0)。
  可选位缺失时:`count<3` 或 elem1≠' ' → 全零(0x318eecc);缺 noise → 0x318f774(`w20=0,w24=0`);缺 face → 0x3192538(`w20=0`)。

  **冲突:`params-visual.md`(第 2216-2252 行)与 `brief-communication.md` 说 communicationChara 的 pd0=子层名`#A`、pd2=float 时长、pd4=目标 alpha、pd6/pd8=翻转(H/V/F),证据给 0x318f054/0x319258c/0x3192630;实测:0x319258c 是 `ScriptManager$$ConvertEffectFlipKind`、0x3192630 是 `ScriptSubLayer$$MoveAlphaCharaData`,两者属于**其它命令的 case 块**(branch_map 的 tail 跟踪把相邻 case 混入),communicationChara 的实际读取点为 0x317ef34/0x317efc8/0x317eff4/0x318ee1c/0x318ee68/0x318eeb8 与 0x317f070/0x317f0c0/0x317f110,即上表(svtId*10+limitCount / 位置 / 深度 5 / noiseKind 0-1 / faceType 0-10):语料 800+ 次实测语法 `[communicationCharaLoop 98003003 1 5 0 5]` 与上表逐位吻合,与文档表不符。**

- 行为(共享尾块 0x318eed8..,反汇编摘录):

```
0x318eed8  adrp x8,#0x55c5000
0x318eee0  ldr  x8,[x8,#0xb60]
0x318eee4  strb w9,[x19,#0x498]        ; ScriptManager.isLoadCommunicationChara = 1
0x318eef8  bl   CommunicationCharaEffectParam$$.ctor   ; new param
0x318ef10  smull x8,w21,w8             ; w21/10 (魔数 0x66666667)
0x318ef24  stp  w24,w8,[x25,#0x10]     ; param.noiseKind=w24, param.svtId=w21/10
0x318ef30  stp  w9,w20,[x25,#0x18]     ; param.limitCount=w21%10, param.faceType=w20
0x318ef34  ldr  x1,[x8]                ; 'communicationCharaLoop'
0x318ef38  ldr  x0,[x22]               ; x22 = 命令 tag
0x318ef3c  bl   System.String$$op_Equality
0x318ef54  bl   ScriptManager$$IsFastPlaySpeed          ; tag!=Loop 时用快进速度当 isStartLoop
0x318ef64  strb w9,[x25,#0x20]         ; param.isStartLoop
0x318eff8  bl   CommonEffectManager$$CreateParam       ; x1='Talk/communicationCharaEffect'
0x318f008  str  w9(4),[x19,#0x288]     ; ScriptManager.state = 4 (State.WAIT)
0x318f00c  str  wzr,[x19,#0x3e0]       ; waitIndex = 0
0x318f014  str  x1,[x19,#0x3d8]        ; waitType = 'communicationCharaLoad'
```

  `CreateParam` 实参:`parent = ScriptManager.communicationCharaEffectBase(0x158)`、`effectName = 'Talk/communicationCharaEffect'`、`pos = (s0,s1,s2)`(s0/s1 来自位置分支,`s2 = -A*10`)、`param`、`isSkip=isPause=flip=0`(dump.cs:CommonEffectManager.CreateParam(GameObject,string,Vector3,object,bool,bool,FlipKind) @0x30C1400)。
  另有一处 `param.callback = Action(ScriptManager, ReadyCommunicationChara)`(`Action$$.ctor` @0x318ef88,回调槽 0x28)。

- 后端 API 地图:
  * `ScriptManager.communicationCharaEffectBase @0x158`(GameObject,通讯层容器;[SerializerField])— 与 specialEffectBase 0x160/effectBase 0x170 并列,`ScriptManager$$InitEffect @0x31a1c64-0x31a1c70`:对该容器 `CommonEffectManager$$Destroy` 并清 `isLoadCommunicationChara=0`。
  * `CommonEffectManager$$CreateParam @0x30c1400` → `LoadCreateLocal`(0x30c0d48/0x30c0e0c 引用 `'Talk/communicationCharaEffect'`);`CommonEffectManager.GetAssetName @0x30bfb78` = `String.Concat(effectAssetStoragePath, name)`,而 `effectAssetStoragePath = 'Effect/'`(`CommonEffectManager$$.cctor @0x30c3694-0x30c36dc`)。**资源全名 = `Effect/Talk/communicationCharaEffect`**(prefab,CommonEffectManager.communicationCharaEffectPrefab 0x28)。
  * `CommonEffectManager$$Get @0x30bfbdc`(communicationCharaFace 用)、`$$IsBusy @0x30b632c`、`$$Stop @0x30b60e8`、`$$Destroy @0x30c1e40`。
  * `ScriptManager$$ReadyCommunicationChara @0x31b682c` = `strb wzr,[x0,#0x498]; ret`(**唯一清 isLoadCommunicationChara 的方法**)。
  * `CommonEffectManager.Get`/销毁与 ProcessScript 的 wait 联动见下。

- 特效实例(类体关键字段,`CommunicationCharaEffectComponent : CommonEffectComponent`,dump.cs:149061):
  `figureBase 0xD0`、`noiseEffect1 0xD8`、`noiseEffect2 0xE0`、`communicationCharaParam 0xE8`、`figure 0xF0(UIStandFigureM)`、`isLoad 0xF8`、`noiseCount 0xFC`;
  参数对象 `CommunicationCharaEffectParam{noiseKind 0x10, svtId 0x14, limitCount 0x18, faceType 0x1C, isStartLoop 0x20, callback 0x28}`。
  * `SetParam @0x30c3fa4` → `StandFigureManager$$CreateMeshPrefab(figureBase, svtId, limitCount, faceType, panelDepth=0, callback=EndDispFigure, loadRequiredResource=false) @0x30c4134`(签名见 dump.cs StandFigureManager,7 参重载;(推断:参数顺序按 3 参重载 `CreateMeshPrefab(parent,svtId,imageLimitCount,Face.Type,int,Action,bool)` @0x2dd8e00)。
  * `EndDispFigure @0x30c415c`:清 `isLoad(0xF8)`;`if (param.isStartLoop)` → 调虚表槽 0x1A8(推断为「开始循环/ForceLoop 类」)否则调槽 0x198(推断为「单次开始/ForceStart 类」);随后对 noiseEffect1(0xD8)走虚表槽 0x1B8、实参 `w1=1`(0x30c41a4-0x30c41bc,启用 1 号噪声层);`noiseCount(0xFC)=2.0f`;最后 invoke `param.callback`(=ReadyCommunicationChara,见上 chain;`br x2` @0x30c41e8)。

```
0x30c416c  ldrb w9,[x8,#0x20]      ; param.isStartLoop
0x30c4170  ldr  x8,[x0]            ; klass
0x30c4178  cbz  w9,#0x30c4190
0x30c417c  ldp  x9,x2,[x8,#0x1a8]  ; 虚表槽(循环开始)
0x30c4188  blr  x9
0x30c418c  b    #0x30c41a4
0x30c4190  ldp  x9,x3,[x8,#0x198]  ; 虚表槽(单次开始/或 Init)
0x30c41a0  blr  x9
0x30c41c0  ldr  x8,[x19,#0xe8]     ; param
0x30c41c4  mov  w9,#0x40000000
0x30c41c8  str  w9,[x19,#0xfc]     ; noiseCount = 2.0
0x30c41d0  ldr  x8,[x8,#0x28]      ; param.callback
0x30c41d8.. ldr x0,[x8,#0x40]; ldr x1,[x8,#0x28]; ... invoke
```
  * `Update @0x30c41f8`(循环节拍,**每帧消费**):

```
0x30c4200  ldrb w8,[x0,#0xf8]      ; isLoad?
0x30c4204  cbnz w8,...ret          ; 未加载完不跑
0x30c4208  ldr  w8,[x0,#0x38]      ; CommonEffectComponent.status
0x30c4210  orr  w8,w8,#2; cmp #2; b.ne ...
0x30c4228  bl   CommonEffectComponent$$Update
0x30c4230  ldr  s8,[x19,#0xfc]     ; noiseCount
0x30c4238  bl   RealTime$$get_deltaTime
0x30c423c  fsub s0,s8,s0
0x30c4248  b.hi ...ret
0x30c424c  ldr  x0,[x19,#0xe0]     ; noiseEffect2
0x30c4260  ldp  x9,x3,[x8,#0x198]; blr x9   ; 重放噪声特效
0x30c4268  mov  w8,#0x40000000
0x30c426c  str  w8,[x19,#0xfc]     ; noiseCount 复位 = 2.0s
```
  * `SetFace @0x30c4278` → `UIStandFigureRender$$SetFace(figure, faceType, 0f, null) @0x3114d5c`。

### communicationCharaLoop 与 communicationChara 的唯一差别

同一 handler;两者唯一分歧点是 `param.isStartLoop`(0x318ef3c-0x318ef64):
* tag == `'communicationCharaLoop'` → `isStartLoop = true`(EndDispFigure 走「循环开始」槽);
* tag == `'communicationChara'` → `isStartLoop = ScriptManager.IsFastPlaySpeed()`(快进/跳读时也当循环立即出图,正常速度走单次开始槽,随后脚本一般再发 `Loop` 进入循环)。

### communicationCharaFace

- handler:`0x317d044`(tag 校验 0x317d030)。
- 参数消费:`count>=1`(否则 0x3191820 参数错误);pd0 → `System.Int32$$Parse`(0x317d0ac)。
- 行为:取 `ScriptManager.communicationCharaEffectBase(0x158)` → `CommonEffectManager$$Get @0x30bfbdc` → `component = 返回值[0]`(0x317d080-0x317d0a0);对 component 做**类型检查**(必须是 slot@0x55c9000+0x518 的类,即 CommunicationCharaEffectComponent;0x317d0bc-0x317d0e4)→ `CommunicationCharaEffectComponent$$SetFace @0x317d0f4`(见上,直调 0x30c4278)。数组为空时直接 Normal(0x3193f00)。
- 语料:`[communicationCharaFace 0..10]`(528 次),与 param.faceType 是同一 Face.Type 取值域(0..10)。
- 阅读器补齐要点:独立的「换表情」命令,作用于当前通讯效果实例;新实例创建时 faceType 由 `communicationChara/Loop` 的最后一参给定。

### communicationCharaClear

- handler:`0x318670c`(tag 校验 0x31866fc)。
- 参数消费:**无**(体内不读 pd;最短路径)。
- 行为/反汇编:

```
0x318670c  adrp x8,#0x5593000
0x3186710  ldr  x8,[x8,#0x440]        ; CommonEffectManager 类(懒初始化)
0x3186714  ldr  x19,[x19,#0x158]      ; communicationCharaEffectBase
0x3186724  bl   0x22305f4             ; cctor 检查
0x3186728  mov  x0,x19
0x3186730  bl   CommonEffectManager$$Destroy @0x30c1e40
0x3186734  b    0x3193f00             ; Normal
```
- 语义:销毁通讯层容器上的全部效果实例(等价于把通讯窗口关掉)。**不**改 `isLoadCommunicationChara`。

### communicationCharaStop

- handler:`0x3181d7c`(tag 校验 0x3181d6c)。
- 参数消费:无。
- 行为:`CommonEffectManager$$Stop(parent=communicationCharaEffectBase(0x158), isSkip=0, isLoadStop=0, markKey=null) @0x30b60e8` → Normal。语义 = 停止播放(保留实例,后续可 Resume/或由 Clear 销毁)。
- 语料仅 3 次,Clear 814 次 → 实际关闭窗口几乎都用 `communicationCharaClear`。

### 窗口状态 / wait 关键字(共享体)

1) `communicationChara/Loop` 是**阻塞命令**:handler 里写 `state(0x288)=4(State.WAIT)`、`waitIndex(0x3E0)=0`、`waitType(0x3D8)='communicationCharaLoad'`(0x318f008-0x318f01c)后即返回 Normal;真正的等待在 `ScriptManager$$ProcessScript` 主循环:

```
0x31c0588  ldr  x8,[..]  ; &'communicationCharaLoad'
0x31c0590  bl   String$$op_Equality   ; x0 = waitType
0x31c0594  tbz  w0,#0,#0x31c2848      ; 非该 waitType → 跳到下一个 case
0x31c0598  ldrb w8,[x19,#0x498]       ; isLoadCommunicationChara
0x31c059c  cbz  w8,#0x31bd0d4         ; ==0(加载完) → 继续执行
0x31c05a0  b    #0x31c2850            ; !=0 → 本帧继续等
```

2) 脚本侧关键字 `[wait communicationChara]`(语料 813 次)。**注意拼写差异**:`wait` 命令自身的 key 树里只有**拼写错误型** `'communicatioChara'`(0x31907bc 对比、hash 常量 0x0ca51292=hash('communicatioChara'),0x31907a0),该分支只把 `waitName(0x3E8)` 置空(0x31907cc-0x31907d8);脚本的 `communicationChara`(正确拼写)在 key 树中**无对应叶**(正确的字符串字面量 0x5822528 在 wait handler 区域 0x31874f4..0x3193f00 内无任何引用,`find_literal_refs` 实测),落到该树的缺省路径——由于 `waitType(0x3D8)` 已按原文存入,真正的判定在 ProcessScript 的 `waitType=='communicationChara'` 分支:

```
0x31bf300  ldr  x1,[..]  ; 'communicationChara'
0x31bf308  bl   String$$op_Equality    ; x0 = waitType(0x3d8)
0x31bf30c  tbz  w0,#0,#0x31c2848
0x31bf318  ldr  x25,[x19,#0x158]       ; communicationCharaEffectBase
0x31bf334  bl   CommonEffectManager$$IsBusy @0x30b632c
0x31bf338  tbz  w0,#0,#0x31bd0d4       ; 不忙 → 等待结束
0x31bf33c  b    #0x31c2850             ; 忙 → 本帧继续等
```
即 `[wait communicationChara]` = 等到通讯层容器**不再忙**(效果已结束/销毁)。

3) 阅读器补齐要点(通讯窗口)
- 数据模型:`{svtId:int, limitCount:int, faceType:0..10, pos:{x,y}, depth:-(A*10), noiseKind:0|1, loop:bool, loaded:bool, noiseTimer:2.0, busy:bool}`。
- 每帧更新:`loaded` 后 `noiseTimer -= dt`,≤0 → 播放 2 号噪声层(2s 周期,`Update @0x30c41f8`);`isStartLoop==false` 时先播单次出现,再等脚本 `Loop` 转循环。
- wait/状态机:进入 `communicationChara/Loop` 命令即置 `WAIT('communicationCharaLoad')`,加载完成回调清标志;`[wait communicationChara]` 等 `busy==false`;`communicationCharaStop` 停止(置 busy=false),`communicationCharaClear` 销毁实例。
- 资源缺失降级(分类 b):`Effect/Talk/communicationCharaEffect` 与 `StandFigureManager.CreateMeshPrefab`(svtId 立绘网格 + 纹理图集)属**原始资源/游戏数据**。降级方案:用矩形占位 + svtId/表情文字(0..10 映射 NORMAL/PLEASURE/CRY/EMBARRASSED/SAD/ANGRY…),噪声层用 CSS 噪点动画近似;逻辑层(svtId*10+limitCount 拆分、位置表/坐标形式、循环、wait、Clear/Stop、SetFace)可 100% 纯逻辑实现。
- 置信度:handler 参数与字段写入 high;`isStartLoop` 所选虚表槽的方法名 INFERRED(槽位号 0x1A8/0x198 为 IL2CPP klass 内偏移,未解析出具体方法);`A=5 → z=-50` 语义 INFERRED(深度)。
- 未决项:虚表槽 0x1a8/0x198 的具体方法(候选 CommonEffectComponent.ForceLoop/ForceStart);StandFigureManager.CreateMeshPrefab 内部纹理图集规则。

---

## 2. 角色切入与攻击(组名:chara_cut / charaAttack)

### charaCutin / charaCutinPause(共享体 0x31855fc)

- handler:`0x31855fc`(tag 校验 0x31855f4;块内 0x3185740 再比较 tag 与 `'charaCutinPause'` 决定 isPause)。
- 参数消费(实测,反汇编摘录):

```
0x3185608  cmp  w9,#5; b.lt 0x3191820        ; count>=5 否则参数错误
0x318561c  ldr  x0,[x8,#0x28]; bl op_Equality(' ')   ; elem1 必须是空格 token
0x3185644  ldr  x0,[x8,#0x38]; bl op_Equality(' ')   ; elem3 必须是空格 token
0x318566c  ldr  x1,[x8,#0x20]; bl ConvertCharaIndex   ; elem0 = 槽位(A-Z…)
0x3185694  ldr  x21,[x8,#0x20]                ; → ScriptManager.charaList(0x490)[idx]
0x31856b0  ldr  x1,[x8,#0x30]; bl ConvertNameString   ; elem2 = 划像名(upToDown…)
0x31856d8  ldr  x0,[x8,#0x40]; bl Single$$Parse       ; elem4 = 时长(秒) → s8
0x3185700  (count>=7) ldr x0,[x8,#0x50]; bl Single$$Parse  ; elem6 = mgd → s9,缺省 0
0x318571c  strb w8(=1),[x19,#0x3c0]           ; ScriptManager.isRequestEffect = 1
0x3185720  bl   IsFastPlaySpeed               ; w2 = isSkip
0x3185740  bl   op_Equality('charaCutinPause') ; w3 = isPause
0x3185760  bl   ScriptCharaData$$SetCutin     ; (charaData, name, time=s0, mgd=s1, isSkip, isPause)
```
- 语义:`SetCutin(name, time, mgd, isSkip, isPause)` → `UIScriptImage.SetCutin`(见 §2.6 共享体);`isPause=1` 用于 tag `charaCutinPause`。

### charaCutinStart

- handler:`0x317d9c8`(tag 校验:`adrp #0x55ca000; ldr x8,[x8,#0x78]`(槽 0x55ca078='charaCutinStart')→ `op_Equality` @0x317d9bc,`tbnz w0,#0 -> 0x317d9c8` @0x317d9c0)。
- 参数消费:`count>=1`;pd0 → `ConvertCharaIndex`(0x317d9e8)→ `ScriptCharaData`。
- 行为:`isRequestEffect(0x3C0)=1`;`isSkip = IsFastPlaySpeed()`;`ScriptCharaData$$ResumeCutin(charaData, isSkip) @0x317da2c` → 虚分派 `UIScriptChara.ResumeCutin`(vtable 0x2d8/0x2e0)。**语料 0 次**。
- 阅读器补齐要点:`charaCutinPause` 建好实例并加载划像贴图但**不启动**;`charaCutinStart` 才真正开启动画(`CharaCutEffectComponent.Resume` → `isStart(0x1b6)!=0 && isPause(0x1b5)!=0` → `CutinResume()`)。两者配合 = 「狙击手式暂停/恢复」。

### charaCutout

- handler:`0x317dc8c`(tag 校验:`adrp #0x55c9000; ldr x8,[x8,#0x840]`(槽 0x55c9840='charaCutout')→ `op_Equality` @0x317dc80,`tbnz` → 0x317dc8c)。
- 参数消费:`count==3`(b.ne 参数错误);elem1 必须为空格 token(0x317dcb4);elem0→ConvertCharaIndex(0x317dcdc);elem2→`Single.Parse`(0x317dd1c)=时长。
- 行为:`isRequestEffect=1`;`SetCutout(charaData, time, isSkip=IsFastPlaySpeed)` @0x317dd48 → 虚分派 UIScriptImage.SetCutout。
- 语料:`[charaCutout H 1.0]` 等 8 次(时间 0.4/1.0)。

### charaCutStop

- handler:`0x31857a8`(tag 校验 0x3185798)。
- 参数消费:`count>=1`;pd0→ConvertCharaIndex(0x31857c8)。
- 行为:`ScriptCharaData$$StopCut @0x317059c`(反汇编摘录):

```
0x317059c  ldr  x0,[x0,#0x38]        ; chara (UIScriptChara)
0x31705a0  cbz  x0,#0x31705ac
0x31705a4  mov  x1,xzr
0x31705a8  b    #0x31e414c            ; UIScriptChara.StopSpecialEffect()
```
  `UIScriptChara.StopSpecialEffect @0x31e414c` = `ProgramEffectManager$$Destory(this.baseSpecialEffect(0x58))`(@0x30c994c)。
  说明:`UIScriptChara.StopCut`(0x31e3da0)、`SetCutin/ResumeCutin/SetCutout`(0x31e3d94-0x31e3d9c)在基类都是空 stub(`ret`),真正的 cut 实现在 `UIScriptImage`;StopCut 走的是 **StopSpecialEffect** 而非虚分派——实测如此(冲突:简报未涉及;`brief-chara_cut.md` 记 StopCut 为 consumer,但未说明它实际调用 StopSpecialEffect)。若 UIScriptChara 预制体里 baseCutEffect(0x50) 挂在 baseSpecialEffect(0x58) 之下,则销毁等价于砍掉切入特效(INFERRED,预制体层级无法静态验证)。
- 语料 0 次。

### charaAttack

- handler:`0x3186270`(tag 校验 0x3186268)。
- 参数消费(实测):

```
0x318627c  cmp  w9,#5; b.lt 0x3191820        ; count>=5
0x3186298  elem1 == ' '                       ; 空格 token
0x31862c4  elem3 == ' '                       ; 空格 token
0x31862ec  elem0 → ConvertCharaIndex          ; 槽位 → charaList
0x3186320  cmp  w9,#9; b.ne 0x3192c2c         ; 只接受 9 token 形式
0x3186334  elem4/elem5 get_Chars(0): elem5 首字符必须 ','(0x2c)
0x3186368  elem7 首字符必须 ' '(0x20)
0x31863a0  IsNormalPlaySpeed 时 Single.Parse(elem8) → duration,否则 0
0x31863d0  x19 = elem2 动作名('normal')
0x31863cc  Int32.Parse(elem4) → X;0x31863f4 Int32.Parse(elem6) → Y
0x3192cbc  bl   ScriptCharaData$$MoveAttack @0x3170338
```
  注意:非 9-token 形式会走 0x3192c2c → 0x3192ccc(7-token 简写分支,按 `index` 形式),语料未用,细节未展开(未决)。
- 行为:`ScriptCharaData.MoveAttack(kind,duration,x,y) @0x3170338` → `ScriptPosition.GetPosition(float,float)`(0x31703a4)→ `UIScriptChara.MoveAttack(kind, duration, v) @0x31e2a0c`:

```
0x31e2a84  bl   UIScriptChara$$StopMoveTween
0x31e2a88  fcmp duration,#0; fcsel s11 = duration>0 ? duration : 0.5   ; 缺省 0.5s
0x31e2aa0  strb w8(=1),[x19,#0xe8]        ; isMove
0x31e2aa8  op_Equality(kind,'normal')     ; 语料 53/53 全是 'normal'
0x31e2acc  bl   TweenPosition$$Begin(go, duration, target)   ; 完成回调 'EndMoveAttack'
0x31e2b38  str  'EndMoveAttack' → tween.oncomplete
```
  `TweenPosition.Begin` 的 x1=0(无缓动名),tween[0x20]=1(播放),tween[0x50]=gameObject,完成回调 `'EndMoveAttack'`;duration≤0 时(0x31e2b50 分支)直接 set_localPosition。
- 阅读器补齐要点:`charaAttack <slot> normal <x>,<y> <duration>` = 把角色在 duration 内平移到位;duration 仅正常速度解析,快进时传 0(被 MoveAttack 内 0.5s 缺省覆盖)。kind 目前只需识别 `normal`(其余取值未观察到;若遇到,按相同平移处理即可)。
- 语料:53 次,全部 `normal`;duration 0.1–2.0;坐标含负数与逗号形式(`-500,0`)。

### 共享体:cut 状态机、特效实例与暂停/恢复

* 实例类型:**`CharaCutEffectComponent : ProgramEffectComponent`**(dump.cs:147999),字段:
  `image 0x1C0(UIImageM)`、`wipeData 0x1C8(AssetData)`、`addVolume 0x1D0`、`bodySize 0x1D4`、`mgd 0x1DC`、`isCutBusy 0x1E0`;基类 `ProgramEffectComponent`: `duration 0x1AC`、`isSkip 0x1B4`、`isPause 0x1B5`、`isStart 0x1B6`。
* 创建链:`UIScriptImage.SetCutin(n,time,mgd,isSkip,isPause) @0x31eaf08`

```
0x31eaf8c  ldr  x23,[x20,#0x50]                 ; this.baseCutEffect(GameObject 容器)
0x31eafa8  s3 = time;s4..s7 = 1,1,1,1(白)
0x31eafc8  w2 = isSkip;w3 = isPause
0x31eaff4  bl   ProgramEffectManager$$CreateCharaEffect
                 ; (parent=baseCutEffect, effectName='cut', pos, time, Color.white, range,
                 ;  isSkip, isPause, isContinueSilhouette=0, param=null)
0x31eb058  bl   UnityEngine.GameObject$$GetComponent<CharaCutEffectComponent>
0x31eb078  x2 = n(脚本第二参,如 'upToDown')
0x31eb07c  x1 = imageList[mainIndex(0xe0)]      ; 当前显示中的 UIImageM
0x31eb0a8  b    CharaCutEffectComponent$$CutinStart(image, n, mgd)
```
* `CutinStart(image, wipeName, mgd) @0x30b6cec`:

```
0x30b6d78  strb w8(=1),[x19,#0x1e0]    ; isCutBusy = 1
0x30b6d88  str  x21,[x19,#0x1c0]       ; image = 角色当前贴图
0x30b6d9c  str  s8,[x19,#0x1dc]        ; mgd
0x30b6d90  ldr  x0,[..] ; 'Wipe/'
0x30b6da0  bl   String$$Concat          ; "Wipe/" + wipeName
0x30b6dc4  bl   AssetLoader.LoadEndDataHandler$$.ctor   ; 回调 EndLoadWipe
0x30b6e04  b    AssetManager$$loadAssetStorage          ; 异步加载划像贴图
```
* `EndLoadWipe(data) @0x30b6e08`:释放旧 wipeData、存新;`image.GetBodySize()`(0x30fbb98)→ bodySize;若 `isPause(0x1b5)!=0` → `isCutBusy=0`(仅准备,不播)否则 `CutinResume @0x30b6ec0`。
* `CutinResume` 关键(材质与补间):

```
0x30b6f04  ldr  s0,[x19,#0x1ac]        ; duration(脚本时长)
0x30b6f14  strb w8(=1),[x19,#0x1e0]    ; isCutBusy = 1
0x30b6f1c  fcmp s0,#0 ; b.le ...
0x30b6f28  image.SetAlpha(1.0)
0x30b6f54  addVolume(0x1d0) = max(mgd, 0)
0x30b6f6c  UIImageRender$$SetSharder('Custom/Sprite-ScriptActionFigureCut')   ; 换 shader
0x30b6f9c  UIImageRender$$SetWipeTexture(划像贴图)                            ; 划像遮罩
0x30b6fbc  UIImageRender$$SetFilterColor(1,1,1,1)
0x30b6fdc  UIImageRender$$SetGradation(addVolume)      ; material.SetFloat('_Gradation', v)
0x30b702c  TweenRenderVolume$$Begin(go, duration, from, addVolume+1.0039216)
0x30b706c  tween.oncomplete = 'OnEndCutinEffect'
```
  (`1.0039216 = 256/255`,常量 @0xee7348;`SetGradation` 写 `_Gradation` 材质属性,`UIImageRender.SetGradation @0x30fc208` 反汇编已证同 `wipe` 用的属性。)
  `OnEndCutinEffect @0x30b70d0` = `isCutBusy(0x1E0)=0`。
* `CutoutStart(time, isSkip) @0x30b70d8`:duration=time;`isSkip` 或缺时间 → 直接 `Object.Destroy(gameObject)`(0x4fda4d8);否则 `isCutBusy=1` + `TweenRenderVolume.Begin(go, duration, →0)` 完成回调 `'OnEndCutoutEffect'`(随后销毁,0x30b71f8 区域)。
* `Resume(isSkip) @0x30b70b0`:若 `isStart==0` → 无操作;若 `isPause==1` → `CutinResume()`。
* `UIScriptImage.ResumeCutin / SetCutout / StopCut` 都先在 `ProgramEffectManager$$Get(baseCutEffect) @0x30c85fc` 结果里找到 **CharaCutEffectComponent** 类型实例(类型检查 vtable 比对,0x31eb140-0x31eb174)再调用 (0x31eb1c0 虚分派 0x3e8/0x3f0;SetCutout 同构;`StopCut @0x31eb340` 实测为 index 边界检查后空实现)。
* 阅读器补齐要点(切入与攻击)
  - 分类 a(纯逻辑,必须实现):cut 生命周期状态机 `{created → textureLoaded → playing(isCutBusy=true) → busy=0}`;`charaCutinPause`(=准备)/`charaCutinStart`(=播放)/`charaCutin`(=立即播放)/`charaCutout`(向 0 补间后销毁)/`charaCutStop`(stop/destroy);`isRequestEffect` 标记;`charaAttack` 平移(0.5s 缺省);位置解析 `GetPosition(int|float,float)`。
  - 分类 b(原始资源):划像贴图 `Wipe/<name>`(upToDown/leftToRight/circleIn 等,与屏幕 wipe 同一资源目录)、shader `Custom/Sprite-ScriptActionFigureCut`、prefab `cut`(ProgramEffectManager 的 chara effect 资源,实际命名空间前缀未解析,见未决)。降级:用 CSS `mask-image` 线性/径向渐变 + `translateX/Y` 扫过实现切入;无贴图时用名字映射方向(upToDown→纵向、leftToRight→横向、circleIn→圆形径向)。
  - 分类 c(游戏数据):`ProgramEffectManager.CreateCharaEffect` 的 effectName→prefab 解析表未取到;不影响逻辑实现。
  - 每帧更新:仅 gradation 补间(+`_Gradation` 值),无独立 Update 逻辑(不同于通讯特效)。
  - 置信度:参数/字段/调用链 high;`cut` 特效 prefab 路径 INFERRED;StopCut→StopSpecialEffect 的层级前提 INFERRED。
  - 未决项:charaAttack 7-token 简写分支(0x3192ccc)语义;`ProgramEffectManager.CreateCharaEffect` 的 effectName 解析路径;`isContinueSilhouette` 对 cut 的影响(实参恒 0)。

---

## 3. 角色循环及复位(组名:chara_loop)

### charaFadeSpeed

- handler:`0x3180e44`(tag 校验 0x3180e3c)。
- 参数消费:`count==5`(否则 0x3193e80 参数错误);elem1==' '、elem3==' '(0x3180e6c/0x3180e98);elem0→ConvertCharaIndex(0x3180ec0);`IsNormalPlaySpeed` 为真才 `Single.Parse(elem2)`(0x3180f14)→ speed(s8),否则 0;`Single.Parse(elem4)`(0x3180f38)→ alpha。
- 行为/反汇编:

```
0x3180eec  bl   ScriptManager$$IsNormalPlaySpeed
0x3180ef14  (正常速度) bl Single$$Parse(elem2) → s8(速度)
0x3180f30  ldr  x0,[x8,#0x40]; bl Single$$Parse    ; elem4 = 目标 alpha → s1
0x3180f44  mov  x0,x21(CharaData); mov w1,wzr       ; isWaitTalk = false
0x3180f50  bl   ScriptCharaData$$MoveAlphaSpeed     ; (speed=s0, alpha=s1, isWaitTalk=false)
```
  `ScriptCharaData.MoveAlphaSpeed @0x316fd84` → `UIScriptChara.MoveAlphaSpeed(speed, a)`(虚分派,槽 22);`UIScriptChara` 静态只读 **`UNIT_SPEED = 0x3C75C28F ≈ 0.015`**(`.cctor @0x31e4cc8-0x31e4cdc`),用于把「速度」换算成补间时长(INFERRED:duration ∝ UNIT_SPEED/speed)。速度为 0(快进)时按立即执行处理。
- 语料 0 次。

### charaFadeTimeLoop

- handler:`0x3182fa0`(tag 校验 0x3182f90)。
- 参数消费/校验(实测):

```
0x3182fac  cmp  w9,#9; b.lt 0x318d244          ; count>=9,否则 "parameter error"
0x3182fc0..0x3182fe8  逐奇数位校验:for i=1;i<count;i+=2: op_Inequality(elem[i],' ')
                        ; 即要求整行按「词 空格 词」严格排列,否则 parameter error
0x318c09c  elem0 → ConvertCharaIndex → charaData
0x318c0dc  Int32.Parse(elem2) → N;<1 直接 Normal
0x318c0f0  lsl w9,w0,#2; add w9,#5
0x318c100  cmp  w9,count; b.ne Normal          ; count 必须 == 4N+5
0x318c114  new float[N] (durations);0x318c12c new float[N] (alphas)
0x318c13c  IsFastPlaySpeed → w19
0x318c150.. 循环 i=0..N-1(w26 从 6 起、步进 4):
0x318c164    (非快进) Single.Parse(elem[w26-2]) → durations[i]   ; 0x318c194 存
0x318c1b8    Single.Parse(elem[w26])         → alphas[i]        ; 0x318c1dc 存
0x318c204  Int32.Parse(elem[count-1]) → loopNum(w3)            ; 最后一词
0x318c224  bl ScriptCharaData$$MoveAlphaLoop @0x316fdac
             ; (duration[], alpha[], loopNum, isFastPlay)
```
- 语义:语法 = `charaFadeTimeLoop <slot> <N> <d1> <a1> ... <dN> <aN> <loopNum>`(token 数 4N+5 由代码强校验);快进时所有 d 记 0。
- 语料 0 次。

### charaFadeTimeLoopStop

- handler:`0x31889d8`(tag 校验 0x31889c8)。
- 参数消费:`count==1`(b.ne 0x3191820 参数错误);pd0→ConvertCharaIndex(0x31889f8)。
- 行为:`ScriptCharaData$$StopMoveAlphaLoop @0x316fdd0` → `UIScriptChara.StopMoveAlphaLoop @0x31e0abc`:若 alphas 非空 → 立即跳到最后一次 alpha 值(`MoveAlpha(0, alphas[last])`,虚分派 0x278/0x280),清 `isMoveAlphaLoop(0x120)`、清数组与计数。语料 0 次。

### charaReturn

- handler:`0x317a3ac`(tag 校验:`adrp #0x55ca000; ldr x8,[x8,#0x1e0]`(槽 0x55ca1e0='charaReturn')→ `op_Equality` @0x317a3a0)。
- 参数消费:`count>=1`;elem0→ConvertCharaIndex(0x317a3cc);可选 shape:`count>=3` 且 elem1 首字符 `' '`(0x317a444-0x317a420:get_Chars(0)==0x20)时 `duration = IsNormalPlaySpeed ? Single.Parse(elem2) : 0`(0x317a458);否则 duration=0(0x318be5c)。
- 行为:`ScriptCharaData$$MoveReturnPosition(duration) @0x317001c` @0x318be60 → `UIScriptChara.MoveReturnPosition @0x31e14ac`:

```
0x31e14f0  bl   UIScriptChara$$StopMoveTween
0x31e14f8  strb w8(=1),[x19,#0xe8]      ; isMove = 1
0x31e14f4/0x31e1500  duration<=0 → 立即置位(0x31e159c 分支)
0x31e151c  ldp  s1,s2,[x19,#0x7c]       ; basePosition.x/y(0x7c/0x80)
0x31e1520  ldr  s3,[x19,#0x84]          ; basePosition.z
0x31e1528  TweenPosition$$Begin(go, duration, basePosition)   ; 回调 'EndMoveReturn'
```
- **「回归位」语义(已证)**:`basePosition`(UIScriptChara 0x7C..0x84)= 最近一次摆放位置。`ScriptCharaData.SetPosition(int|x,y) → UIScriptChara.SetBasePosition @0x31e0d24` 同时写 `basePosition` 与 `localPosition`(0x31e0d50-0x31e0d6c)。因此 `charaReturn` = 退回最近一次 `charaPosition/charaSet` 决定的基准位;`GetBasePosition @0x31e0d18` 读同一字段。
- 语料 0 次。

### charaRollAxisLoopStop

- handler:`0x3185968`(tag 校验 0x3185958)。
- 参数消费:`count==1`(b.ne 0x3193e80);pd0→ConvertCharaIndex(0x3185988)。
- 行为:`isSkip=IsFastPlaySpeed()`(0x31859b4)→ `ScriptCharaData$$StopRollAxisLoop @0x3170488` → `UIScriptChara.StopRollAxisLoop(bool) @0x31e36cc`:

```
0x31e3704  bl   UIScriptChara$$StopRollAxisTween
0x31e3708  ldrb w8,[x19,#0x175]     ; isRollWait
0x31e370c  strb wzr,[x19,#0x174]    ; isRollLoop = 0
0x31e3710  cbz  w8,#0x31e37c4       ; !isRollWait → 直接收尾(EndExecuteRollAxis)
0x31e374c..0x31e37a4  把当前 localRotation 与 stopLocalRotationLoopEnd(0x178)
                      分别换算成角度 → 决定最短转向,补间到停止姿态(或 isFastPlay 立即)
0x31e37c4  b    UIScriptChara$$EndExecuteRollAxis
```
  `stopLocalRotationLoopEnd(0x178) = Quaternion.AngleAxis(stopAngle, axis)`,在 `StartRollAxis(isWait=1)` 时写入(0x31e360c-0x31e361c);循环本体是协程 `UIScriptChara.<RollAxis>d__137 @0x31e3344`(`runningRotationCoroutine(0x188)`)。**因此 `charaRollAxisLoopStop` 停的就是 `charaRollAxis` 启动的轴向自转循环;isRollWait 时落到 stopAngle 指定姿态,否则原地结束。**
- 语料 0 次。

### 循环消费方(共享体:谁在等、谁在推进)

1) `charaFadeTimeLoop` 的等待条件在 `ScriptManager$$ProcessScript`(waitType 分派,反汇编摘录):

```
0x31bf0e8  ldr  x1,[..]   ; 'charaFadeTimeLoop'
0x31bf0f0  bl   String$$op_Equality            ; x0 = waitType(0x3d8)
0x31bf0f4  tbz  w0,#0,#0x31c2848
0x31bf0f8  ldr  w8,[x19,#0x3e0]                ; waitIndex(0x3e0)= 角色槽
0x31bf100  ldr  x9,[x19,#0x490]                ; charaList
0x31bf118  ldr  x25,[...,#0x20]                ; charaData
0x31bf128  bl   ScriptCharaData$$IsMoveAlphaInfiniteLoop
0x31bf12c  tbnz w0,#0,#0x31bd0d4               ; 无限循环 → 不等待
0x31bf138  bl   ScriptCharaData$$IsMoveAlphaLoop
0x31bf13c  tbz  w0,#0,#0x31bd0d4               ; 已停 → 放行
0x31bf140  b    #0x31c2850                     ; 仍在循环 → 继续等
```
  即 `[wait charaFadeTimeLoop <slot>]` 的等待判定 = `IsMoveAlphaInfiniteLoop() || !IsMoveAlphaLoop()` 时放行。
  `ScriptCharaData.IsMoveAlphaLoop @0x316fce4` = `chara.isMoveAlphaLoop(0x120)`;`UIScriptChara.IsMoveAlphaInfiniteLoop @0x31e09a4` = `moveAlphaLoopNum(0x138)==0`(**loopNum=0 表示无限**)。
2) `MoveAlphaLoop` 的推进**不是每帧 Update**,而是 iTween 完成回调链:
  `UIScriptChara.MoveAlphaLoop(array,array,int,bool) @0x31e0ba0`:存 `moveAlphaDurations 0x128 / moveAlphaValues 0x130 / moveAlphaLoopNum 0x138`,清 `currentMoveAlphaIndex 0x124 / currentMoveAlphaLoopNum 0x13C`;isFastPlay → 直接 `StopMoveAlphaLoop()`(跳到末值)。
  `MoveAlphaLoop() @0x31e09f4`:`isMoveAlphaLoop(0x120)=1`;取 `durations[i]/alphas[i]` → `MoveAlpha(d, a, gameObject, get_MoveAlphaLoopCallbackName())`(虚分派 0x2a8/0x2b0 取回调名,0x278/0x280 执行)。
  `EndMoveAlphaLoop @0x31e0b38`(回调):`index++`;未越界 → 再进 `MoveAlphaLoop()`;越界 → `currentMoveAlphaLoopNum++`,未达 `moveAlphaLoopNum` 则 `index=0` 重来,否则结束(清 `0x120` 并清数组)。
  阅读器实现:用「步骤 + 定时器」等价实现即可,无需移植回调链;`loopNum=0` 视为无限(不参与 wait)。
3) `charaRollAxisLoopStop` / `charaReturn` / `charaFadeTimeLoopStop` 在 `wait` 命令的 key 表里都存在于 `out/_evidence/wait_keys.json`(即 `[wait charaRollAxisLoopStop A]` 语法合法,wait 命令会据 §0 token 模型取 elem2 角色槽写入 `waitIndex(0x3E0)`;`wait` handler 树:`bl ConvertNameString` @0x3193998(elem2)→ `waitName(0x3E8)`,`bl ConvertCharaIndex` @0x3193918 → `waitIndex` @0x31939d0)。ProcessScript 对 `charaRollAxisLoopStop` 无独立等待分支(字面量仅出现在 NotCountExcludeWaitTypes 数组构造处 0x31c0138-0x31c0140),因此该类 wait 在实测中不会阻塞——阅读器可保守处理为「等待对应实例空闲」。

### 阅读器补齐要点(循环与复位)

- 数据模型(挂在角色实例上):`{basePosition:{x,y,z}, currentPos, isMove, alphaLoop:{durations[],values[],loopNum,index,loopCount,active}, rollAxis:{axis,angle,duration,isLoop,isWait,stopAngle,stopRotation,coroutineActive}, returnDuration}`。
- 每帧更新:`fadeSpeed` 类 = alpha 补间(duration = f(speed,UNIT_SPEED≈0.015));`charaFadeTimeLoop` = 按 durations/values 逐步补间,回调推进,`loopNum=0` 无限;`charaReturn` = 位置补间回 `basePosition`;`charaRollAxisLoopStop` = 停止轴向自转并按需补间到 `AngleAxis(stopAngle, axis)`。
- wait/状态机集成:`[wait charaFadeTimeLoop A]` 用 `isMoveAlphaLoop && !infinite` 判定;`[wait charaRollAxisLoopStop A]` 可退化为等待 `rollAxis.active==false`。
- 分类:a) 纯逻辑(全部 5 条命令的参数解析、状态写入、wait 判定、复位目标);b) 无原始资源依赖(位置/alpha/旋转均为数值);c) 无游戏数据依赖。**本组是纯逻辑缺口最小、可直接补齐的一组。**
- 置信度:参数与调用链 high;UNIT_SPEED→duration 公式、roll 协程内部插值 INFERRED;`charaReturn` 的「回归位=basePosition」high(有写读双侧证据)。
- 未决项:RollAxis 协程(0x31e3344)内部每段角度/时长分配未逐条展开;charaFadeSpeed 的 `UNIT_SPEED` 精确公式未定位到读取点。

---

## 4. 语料出现次数(D;`grep -rho '\[<cmd>[^]]*\]' scripts`)

| 命令 | 次数 | 备注 |
|---|---|---|
| communicationCharaClear | 814 | 关闭窗口的主要手段 |
| communicationCharaLoop | 691 | |
| communicationCharaFace | 528 | 参数 0..10 |
| communicationChara | 131 | 全部 `98003003 …`/`98111500 …` 形式 |
| communicationCharaStop | 3 | |
| charaAttack | 53 | 全 `normal`;duration 0.1–2.0 |
| charaCutin | 16 | upToDown/leftToRight/circleIn,time 0.1–1.0,mgd ∈ {0,1.0} |
| charaCutout | 8 | time 0.4/1.0 |
| charaCutinStart / charaCutinPause / charaCutStop | 0 / 0 / 0 | 未观察 |
| charaFadeSpeed / charaFadeTimeLoop / charaFadeTimeLoopStop / charaReturn / charaRollAxisLoopStop | 0 | 未观察(命令存在且 handler 已定位) |

相关 wait 关键字:`[wait communicationChara]` 813 次;`[wait charaFadeTimeLoop A]`、`[wait charaRollAxisLoopStop A]` 等在本语料中未观察(仅 wait 键表收录)。

---

## 本组小结

### 缺口分类

| 项 | 分类 | 说明 |
|---|---|---|
| 通讯窗口逻辑(拆分 svtId*10+limitCount、两种位置形式、face/noise/loop 状态、wait 联动、Clear/Stop) | a 纯逻辑 | 已全量取证(§1) |
| 通讯窗口视觉(立绘网格、噪声粒子) | b/c | 需 `Effect/Talk/communicationCharaEffect` 与 svtId 立绘数据 |
| charaCutin 族状态机(准备/播放/淡出/停止/暂停恢复) | a 纯逻辑 | 已全量取证(§2) |
| 切入视觉(划像遮罩 + `_Gradation` 补间) | b | 需 `Wipe/<name>` 贴图与 `Cut…` shader;可用 CSS 渐变降级 |
| charaAttack 平移 | a 纯逻辑 | 0.5s 缺省已证;k非 normal 未观察 |
| 循环/复位 5 条命令(alpha 循环、fadeSpeed、return、rollAxis 停止) | a 纯逻辑 | 已全量取证(§3);无资源依赖 |
| wait 关键字(`communicationChara` / `communicationCharaLoad` / `charaFadeTimeLoop`) | a 纯逻辑 | 判定条件已定位 |

### 最小可交付实现

1. 分词器按 §0 模型产出 token(含空格/逗号),按 pd 下标实现本组 16 条命令的参数解析与校验(非法 → parameter error 语义,直接跳过该行);
2. 通讯窗口:占位矩形 + face 文字 + 2s 噪声闪烁 + `wait communicationChara`(busy 语义)与 `communicationCharaLoad`(加载期间阻塞)两个等待;
3. 切入:角色 sprite 上叠一个方向性 mask 扫过(time=时长,mgd 决定 gradation 超出量 0/1 + 256/255),`Pause/Start` 两段式,`Cutout` 反向扫除后移除,`CutStop` 兜底移除;
4. 循环:alpha 步骤序列 + loopNum(0=无限)、`charaFadeSpeed`(speed+alpha)、`charaReturn`(回 basePosition)、`charaRollAxisLoopStop`(停协程并落 stopAngle);
5. `charaAttack`:0.5s 缺省平移。

### 升级路径

- 拿到 `Effect/Talk/communicationCharaEffect` prefab 与立绘图集 → 换真立绘网格/噪声粒子;
- 拿到 `Wipe/upToDown|leftToRight|circleIn` 贴图(与屏幕 wipe 共享)→ 用 `mask-image` + `_Gradation` 等价参数驱动,替换 CSS 渐变降级;
- 解析 `ProgramEffectManager.CreateCharaEffect` 的 effectName → prefab 映射与 CommonEffectManager 加载回调时序(EndLoadWipe/EndDispFigure),即可与引擎逐帧对齐;
- 补齐通讯窗口的 `isStartLoop=false` 单次动画与虚表槽 0x1A8/0x198 的具体方法(ForceStart/ForceLoop 候选),以复刻「先出现、再循环」的两段表现。

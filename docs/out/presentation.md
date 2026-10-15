# FGO Adv 剧情演出系统逆向说明(动画 / 特效 / 镜头)

目标:|Fate/Grand Order Android v2.139.3|IL2CPP|`extract/lib/arm64-v8a/libil2cpp.so`。
用途:为「剧情脚本回放器(story reader)」提供可实现的语义描述。所有结论都带地址/字面量证据;凡是推断都标注 **(推断)**。
所有 VA 为 ELF 文件虚拟地址;`dump.cs` 行号指 `il2cpp_out/dump.cs`。

---

## 0. 方法学与证据文件

| 文件 | 内容 |
|---|---|
| `out/_evidence/cmd_sig.json` | 每条命令:cmo/handler VA、参数个数检查(`cmp w9,#N`)、`Parse` 顺序、首个 ScriptManager 调用、相关字面量 |
| `out/_evidence/cmd_index.json` | 每条命令 handler 前 0x140 字节内的调用+字面量 |
| `out/_evidence/cmd_table2.txt` / `eq_sites.json` | ScriptCommandExecute 中全部 `String.op_Equality` 站点与命令 tag 比较(x25) |
| `out/_evidence/class_*.txt` | 关键类的字段偏移/方法签名(dump.cs 抽取) |
| `out/_evidence/mgr_*.txt` `cam*.txt` `trans*.txt` `fx*.txt` | ScriptManager 方法/命令 handler 的注释反汇编 |

工具(`tools/`):`cmdwin.py`(命令→handler)、`cmd_dump.py`、`cmd_sig.py`、`cmd_index.py`、`cmd_table2.py`、`mdump.py`、`klass.py`、`mfind.py`。

---

## 1. 命令调度总览

* 调度器:`ScriptManager$$ScriptCommandExecute`,`VA 0x3177290..0x319402c`。
* 命令 tag 放在寄存器 **x25**,两种比较形态:`mov x0,x25; bl String.op_Equality`(字面量在 x1)或反向。旧表 `il2cpp_out/command_cmp.json` 只收录 226 条;`tools/cmd_table2.py` 修正字形后得到 **265 条**(op_Equality 可解析者,含参数分析)。
* **完整命令词表 = 379 条**:调度器把 `ComputeStringHash(tag)` 与 `movz/movk` 常量比较后 `b.eq` 到各 handler 块。用 FNV-1a(UTF-16 字符,`h=2166136261; h^=c; h*=16777619`)对 `stringliteral.json` 中所有字面量求哈希,与 379 个 switch 常量**全部一一命中**(`tools/hash_switch.py` → `out/_evidence/cmd_hash_switch.json`,`out/_evidence/cmd_names_full.txt`)。这解释了为何先前遗漏 `wipeout / wipeinEx / maskin / fadeout / stretchout / charaSet / charaMove / figureChange …`:这些 tag 在共享 handler 块中用常量二次比较,未与 x25 直接比较。
  * 验证样例:`wipeout`→0xd97b372a 与 0x317c7c4 常量一致,并 `b 0x317e8f8`(与 `wipein` 共用块,块内用 `'wipein'` 判断方向)。
  * 注意:`crossFade`、`allFalse`、`dontResetPress` **不是** tag(它们出现在参数比较中)。
* 返回值:0=Normal、1=Continue、2=ReturnFalse(`ScriptManager.ScriptCommandExecuteReturnCode`,dump.cs:167210)。公共分支地址:0x3193f00(Normal)、0x3193efc(Continue)、0x3193e80(参数不足/非法→按 Normal 结束)、0x3191820(下一个 tag 比较)、0x3193cd4(数组越界保护)、0x318f114(NullRef 保护)。
* 命令参数:x20 → string[] 对象;长度 `+0x18`,第 k 个元素 `+0x20+8k`(element[0]=tag)。证据:handler 里 `ldr w9,[x8,#0x18]; cmp w9,#N; b.lt <错误>` 的参数个数检查 + `ldr x0,[x8,#0x20+8k]`。
  * 参数可用单个空格 `' '` 表示省略(如 cameraMove@0x3186860、wipein@0x317e970 先 `cmp 参数,' '`);
  * **逗号是独立 token**:cameraMoveEase(cmp@0x317a664,与 `','` 比较)、useSimpleMeshFigure(0x317ba50)、wipeoutEx(按 +0x30/+0x40/+0x50/… 隔 2 取参,0x31840fc-0x318419c)都说明脚本行按空格切分、`,` 作为独立词进入参数数组。
* 对 reader 的意义:行 → 按空格切词(保留 `,`),首词为 tag,其后为参数;可选参数可能以 `' '` 占位。

---

## 2. 相机系统

### 2.1 结构(ScriptManager 字段,dump.cs:167792 起)

| 字段 | 偏移 | 说明 |
|---|---|---|
| `cameraScale` | 0xF8 | 缩放(zoom)根节点 |
| `cameraPosition` | 0x100 | 平移根节点 |
| `cameraRoll1` / `cameraRoll2` | 0x108 / 0x110 | roll 的两个 GameObject(绕非原点旋转的技巧) |
| `shakeRoot` | 0xC0 | 抖动作用的 Transform |
| `isExecuteCamera` | 0x4F8 | 主相机忙标志 |
| `isExecuteCameraRoll` | 0x4F9 | roll 忙标志 |
| `isWaitSubLayer` | 0x768 | **子相机**忙标志(`InitCamera(isMainCamera=false)` 写这里,见 0x31b85dc `csel x8,x9(0x4f8),x8(0x768),ne`) |
| `shakeTime/cycle/X/Y` | 0x4E8/0x4EC/0x4F0/0x4F4 | Shake 参数 |
| `stretchBase` | 0xC8 | 黑边/拉伸 UI(UIWidget) |
| `stretchName/isExecuteStretch/stretchBaseRange` | 0x500/0x508/0x50C(Vector2) | 拉伸状态 |

### 2.2 主相机方法

* `InitCamera(GameObject cameraScale, GameObject cameraPosition, bool isMainCamera)` @ **0x31b83dc**:两 GameObject 上 `GetComponent<>` 后 `Behaviour.set_enabled(false)`、`iTween.Stop(go)`、`localScale=Vector3.one`、`localPosition=Vector3.zero`;忙标志置 0(主 0x4F8 / 子 0x768)。
* `StartCamera(cameraScale, cameraPosition, float duration, Vector3 position, float scale, bool isMainCamera)` @ **0x31b9518**:
  * `duration>0`:`TweenScale.Begin(cameraScale, duration, scale, scale, 1)` + `TweenPosition.Begin(cameraPosition, duration, x,y,z)`,完成回调字符串 `'EndExecuteCamera'`(主)/`'EndExecuteSubCamera'`(子);
  * `duration<=0`:立即 `Transform.set_localScale/set_localPosition`;
  * 先 `StopMoveTween(cameraPosition)`、`StopMoveScaleTween(cameraScale)`(0x31b85fc / 0x31b86f4)。
* `MainCameraMoveEase(float time, Vector3 vector, string easetype, float scale, bool isScale)` @ **0x31b8ff0**:构造 Hashtable{`x`,`y`,`time`,`easetype`,`isLocal`=true,`delay`=0,`oncomplete`='EndExecuteCamera',`oncompletetarget`} → **`iTween.MoveTo(cameraPosition,…)`**;`isScale` 时 **`iTween.ScaleTo(cameraScale,…)`**;`time<=0` 立即设置。
* `EndExecuteCamera()` @0x31b97a8:仅 `isExecuteCamera(0x4F8)=0`(tween 完成回调)。

### 2.3 Roll

* `SetCameraRoll(cameraRoll1, cameraRoll2, float rollZ, Vector3 centerOffset, bool isMain)` @ **0x31b9830**:`Quaternion.Internal_FromEulerRad(0,0,rollZ)` → `roll1.set_localRotation`;`roll1/roll2.set_localPosition`(centerOffset/-centerOffset 的**双节点 pivot 技巧**,绕画面中心之外的点旋转)。
* `StartCameraRoll(cameraRoll1, float duration, float rollZ, bool isMain)` @ **0x31b9a08**:`TweenRotation.Begin(roll1,…)`,回调 `'EndExecuteCameraRoll'` / `'EndExecuteSubCameraRoll'`;结束恢复 `localRotation`。

### 2.4 子相机与子渲染

* `SubCameraMoveEase(GameObject subLayer, float time, Vector3 vector, string easetype, float scale, bool isScale)` @ **0x31b87ec**:与主相机同构,但目标就是**子层 GameObject**,回调 `'EndExecuteSubCamera'`(字面量证据)。
* `SubRenderMoveScaleEase(GameObject subLayer, float scale, float time, string easetype)` @ **0x31b8cf0**:`iTween.ScaleTo(subLayer,{x,y,time,easetype,oncomplete='EndExecuteSubCamera'})`。

### 2.5 抖动

* `Shake(float duration, float cycle, float x, float y)` @ **0x31a1c80**:`shakeTime(0x4E8)=Time.time+duration`(duration>0)、`shakeCycle(0x4EC)=cycle`、`shakeX/ Y(0x4F0/0x4F4)`;
* `OnShake()` @ **0x31ba0c0**:`shakeRoot(0xC0).localPosition = (Random.Range(-x,x), Random.Range(-y,y), 0)`,通过 `MonoBehaviour.InvokeRepeating("OnShake", …, shakeCycle)` 重复;Time.time≥shakeTime 时 `CancelInvoke("OnShake")` 并复位为静态 `Vector3.zero`;
* `IsShake()` @0x31ba0b0 = `shakeCycle>0`。`messageShake` 同参数(4 float,见 cmp@0x3186b00)。

### 2.6 位置表 ScriptPosition

`ScriptPosition`(dump.cs:170549)有 `positionList`(7 项 Vector2)与 `charaOffsetList`(3 项,全 0),`.cctor` @ **0x31d8f08**,常量来自 .rodata:

| index | 值 | 用途(推断) |
|---|---|---|
| 0 | (-256, 0) | 左 |
| 1 | (0,0) | 中 |
| 2 | (256, 0) | 右 |
| 3 | (-438, 0) | FSSide 左 |
| 4 | (-512, 0) | 左屏外(滑入起点) |
| 5 | (438, 0) | FSSide 右 |
| 6 | (512, 0) | 右屏外 |

* `GetPosition(int index)` @0x31d8d88:越界/负值回落到 index 0,返回 `Vector3(x,y,0)`。
* `GetPosition(float x,float y)` @0x31d8e3c:8 字节极简函数——直接返回传入的 (x,y,0)(cpu 侧 `scvtf` 后调用,证明脚本里写的是**数值坐标**)。
* 相机命令实测:`cameraMove` 解析顺序 = [duration(float,仅正常速度)]→[int x]→[int y]→`GetPosition(float,float)`→`Transform.set_localPosition`(0x3186870-0x3186954 证据)。

---

## 3. 转场(淡入淡出 / 划像 / 遮罩 / 闪光 / 拉伸)

### 3.1 Fade

字段:`fadeName 0x5E8`、`fadeColor 0x5F0..0x5FC(r,g,b,a)`、`isExecuteFade 0x600`、0x5FC 同时是 level(alpha)。

* `StartFadeMove(string name, float duration, float level)` @ **0x31bb998**:
  * 若 `isExecuteFade` 已置位或 `name=="clear"` → 返回 false;
  * `'black'`→Color(0,0,0)、`'white'`→Color(1,1,1)、其他 → `ConvertColor(name)`(0x31b36bc);
  * `duration>0`:`TweenRendererColor.Begin(meshFadeBase(0xE8).gameObject, duration, r,g,b,a)`,完成回调字符串 `'EndExecuteFade'`;`duration<=0` 直接调 tweener 的立即执行虚函数;
  * 写 `fadeName/fadeColor(含 alpha=level)/isExecuteFade=1`。
* `InitFade()` @0x31a2158:关闭 meshFadeBase(0xE8)/meshRenderBase(0x130) 上组件、清名字/颜色、`isExecuteFade=0`。
* `GetFadeoutType()` @ **0x31b40d0** → `MaskFade.Kind`:未淡出或 `a<1` → 0;**RGB 到 (0,0,0) 距离² < 1e-10 → 1(BLACK)**;到 (1,1,1) → 2(WHITE);否则 0。`MaskFade.Kind{NONE=0,BLACK=1,WHITE=2,TARGET_COLOR=3}`(dump.cs:25634)。
* 命令:`fadein`(cmp 0x3180b08)、`fadeout`、`fadeMove`、`fadeOff`(调 InitFade@0x3184b60)、`endFade`、`overlayFadein`、`soundStopAllFade`。
* reader 渲染:全屏 quad 颜色 = fadeColor,duration 后停在 level;`clear` 表示取消/不淡。

### 3.2 Wipe(划像)

字段:`wipeName 0x598`、`wipeAssetData 0x5A0`、`isExecuteWipe 0x5A8`、`isLoadWipe 0x5A9`、`isWipeFilter 0x5AA`、`isWipeIn 0x5AB`、`wipeDuration 0x5AC`、`wipeLevel 0x5B0`、`wipeParam1..4(cvcenter,cvcentersize,cvleft,cvright) 0x5B4..0x5C0`、`exWipeType 0x5D4`、`wipeExCutVarTriangles 0x5D8`。

* `StartWipe(string name, bool isIn, float duration, float level, float cvcenter=0, float cvcentersize=0, float cvleft=0, float cvright=0)` @ **0x31bae90**:写状态并由 `AssetManager.loadAssetStorage(name,…)` 异步加载,回调 `EndLoadWipe`。
* `SetWipeFilter(同参数)` @ **0x31bb07c**:唯一区别 `isWipeFilter(0x5AA)=1`(保留为持续滤镜)。
* `EndLoadWipe(AssetData)` @ **0x31bb1d4**:
  * 资源短名 == `'Wipe/cutVer'` 且 cvcenter/size/left/right 任一非 0 → 用 **ExUIUserMeshRenderer(0xE0)**`SetUserMesh(GetHorizontal5Split(...), GetHorizontal5SplitUv(), wipeExCutVarTriangles(0x5D8))`,并置 `exWipeType=1(CutVar)`;否则用 **ExUIMeshRenderer(0xD8)**`SetImage(asset)`;
  * 材质属性 **`'_Gradation'`** `SetFloat(wipeLevel)`;
  * `duration>0`:`TweenRenderVolume.Begin(go, from, to, duration)`(from/to 由 `isWipeIn(0x5AB)` 决定 0↔level),完成回调 `'EndExecuteWipe'`;否则立即。
* `GetHorizontal5SplitUv()` @ **0x31bb60c** 返回固定 12 元素 UV(.rodata 常量):
  `(0,1) (1/512,1) (1/512,0) (0.5,1) (0.5,0) (511/512,1) (511/512,0) (1,0)` — 5 段横向切分,左右各内缩半像素(1/512),说明切图基准宽 512。
* `GetHorizontal5Split(cvcenter,cvcentersize,cvleft,cvright)` @ **0x31bb734**:以 0.5 为中心用 `Math.Max(0,·)` 生成 12 个顶点(x 位置),y=0/1。
* `ConvertWipeName(string)` @ **0x31b3a00**:返回 `"Wipe/"+name`,并去掉参数外层双引号 `"`。
* 命令词汇:`wipein`(cmp 0x317e904,handler 0x317e910)、`wipeout`、`wipeinEx`、`wipeoutEx`、`wipeFilter`(cmp 0x3185808→ConvertWipeName@0x31858a4→SetWipeFilter@0x3185928)、`wipeFilterEx`、`wipeOff`(=InitWipe@0x3184948)。
  * 共享块(证据):`wipein`/`wipeout` 的 tag 常量分支到同一个块(0x317c7c4 `b 0x317e8f8`),块内用字面量 `'wipein'` 与 tag 比较决定方向;`wipeoutEx` 块内与 `'wipeinEx'` 比较(0x31840d8)。因此 `isIn` 由 tag 决定。
* reader:wipe = 全屏 quad 贴 `Wipe/<name>` 图,`_Gradation`=level;`TweenRenderVolume.Begin` 的 from/to 由 `isWipeIn(0x5AB)` 决定——**isWipeIn==0 → 0→level,==1 → level→0**(证据 0x31bb51c/0x31bb548 两条 `fcsel`);具体哪个 tag 传 0 未逐字验证(推断:`wipein` 让划像图覆盖屏幕)。duration=0 立即;`*Ex` 用 cutVar 5 段网格+4 个额外参数。

### 3.3 Mask

* `StartMask(string name, bool isIn, float duration)` @ **0x31bbc10**:
  * `isIn`(maskin)→ `CommonUI.Instance.maskFadein(duration)`;
  * 否则:`name=='clear'` → 依次 `InitEffect/InitFlashCommand/InitFlashDepCommand/InitWipe/InitFade` 并把 `maskOnWhileJumping(0x40C)=false`;
  * `'black'` → `maskFadeout(1,duration)`,`'white'` → `maskFadeout(2,duration)`(1/2 即 `MaskFade.Kind.BLACK/WHITE`)。
* `InitMask()` @0x31bbba8 → CommonUI 单例方法 @0x23be2bc(关闭遮罩)。
* `maskin`/`maskout` 是共享 handler 的两个 tag(常量分支:maskin→0x31834b4,maskout→0x3188468);实际调用点 **0x318921c-0x3189244**:比较取出的 tag 与字面量 `'maskin'` 得 `isIn=w2`,然后 `StartMask(name=ConvertNameString(参数),isIn,duration=s0)`。
* `MaskKindFromStartMode(int startMode)` @ **0x319a364**:`startMode-3` 作为下标查 0xee93e0 的 14 项表 `[1,2,0,1,2,0,0,1,2,0,0,0,1,1]`(**推断**:剧本开场淡入色)。
* 命令:`maskin`、`maskout`、`maskOff`,词汇 `clear|black|white`。

### 3.4 Flash(全屏闪光)

字段:`flashName 0x518`、`isExecuteFlash 0x520`、`isEndRequestFlash 0x521`、`flashCount 0x524`、`flashTime1/2/3 0x528/0x52C/0x530`、`flashColor1 0x534..0x540`、`flashColor2 0x544..0x550`;Dep 版同构:`0x558..0x594`(`flashDepNum 0x594`)。四边 mesh:`meshFlashBase 0xD0`、`charaMeshFlashBase 0xF0`。

* `StartFlash(name, float duration1, float duration2, Color color1, Color color2)` @ **0x31ba3d8**(忙则返回 false);
* `StartFlashDep(name, int dep, duration1, duration2, color1, color2)` @ **0x31ba8c0**;
* `OnFlashRequest()` @ **0x31ba490**:`flashName` 与字面量 **`'pingpong'` / `'once'` / `'loop'`** 比较 → 决定 tweener 循环方式;用时 `flashTime1(0x528)`+`flashColor1(0x534..0x540)`,再 `flashTime2(0x52C)`+`flashColor2`,最后到透明并 `'EndExecuteFlash'`;
* `EndFlash(float duration)` @ **0x31ba8a8**:`flashTime3(0x530)=duration; isEndRequestFlash(0x521)=1`(flashout 用它收尾);
* `InitFlashCommand()` @0x31ba200 / `InitFlashDepCommand()` @0x31ba2ec:把 mesh 颜色设为 (1,1,1,0) 并禁用。
* 命令:`flashin`、`flashout`(cmp 0x31809ac,先 `Single.Parse` 再 `EndFlash`)、`flashinDep`、`flashoutDep`、`flashDep`、`flashOff`、`flashOffDep`。名字词汇:**`once|loop|pingpong`**。
* reader:两段式颜色四边(时间1色1 → 时间2色2),`Dep` 走角色 mesh 且多一个依赖编号。

### 3.5 Stretch(画面拉伸)

* `StartStretch(string name, bool isIn, float duration, float scale)` @ **0x31b9c28**:
  * 名称词汇(字面量比较):**`horizontally, horizontallyLeft, horizontallyRight, vertical, verticalUp, verticalDown, full`**;
  * `TweenScale.Begin(stretchBase(0xC8), duration, sx,sy,1)` + `TweenPosition.Begin(...)`,完成回调 `'EndExecuteStretch'`;位置偏移 = `stretchBaseRange(0x50C/0x510) * scale`;
  * 未知名称 → `state(0x288)=0x10(ERROR)`;
  * `stretchName(0x500)=name,isExecuteStretch(0x508)=1`。
* `InitStretch()` @0x31a1cfc。命令:`stretchin`,`stretchout`,`stretchOff`,`subStretch`,`subStretchout`。

---

## 4. 屏幕特效 / 滤镜

### 4.1 特效层(InitEffect @ 0x31a1bec)

`specialEffectBase 0x160`(ProgramEffectManager,Destory@0x30c994c)、`fowardEffectBase 0x168`、`effectBase 0x170`、`backEffectBase 0x178`、`communicationCharaEffectBase 0x158`(后四者为 CommonEffectManager,Destroy@0x30c1e40)。对应命令族:`specialEffect*`、`fowardEffect*`、`effect*`、`backEffect*`、`communicationChara*`。

翻转:`CommonEffectManager.FlipKind{NORMAL=0,HORIZONTAL=1,VERTICAL=2,FULL=3}`;**`ConvertEffectFlipKind` @0x31b3ad0:`H`→1、`V`→2、`F`→3,其他→0**。

### 4.2 相机滤镜 cameraFilter / charaFilter

* `SetCameraFilter(string filterName, float[] paramsFloat)` @0x319ff30 → 内部 `SetCameraFilter(Material mt, string filterName, float[] paramsFloat)` @ **0x31a0304**:
  * `filterName` 为 `""`/`"normal"` → Shader = `GetSpriteScriptActionRenderShader("")` = **`Shader.Find("Custom/Sprite-ScriptActionRender")`**(0x31a0608);
  * `"summon"` → 额外 `renderTextureCamera(0x138).backgroundColor=(0,0,0,1)`;
  * 其他 → Shader 名 = **`"Custom/Sprite-ScriptActionRender" + UpperFirst(filterName)`**(`GetStringWithFirstLetterChangedToUpperCase` @0x31a0578);
  * **读取 16 个 float 组装 Matrix4x4,`Material.SetMatrix("_FilterParam", m)`**(0x31a04fc-0x31a0554)。
* `charaFilter`(cmp 0x3187830)走 `ScriptCharaData.SetFilter(filterName, Color)` → `UIScriptChara.filterName 0x98 / filterColor 0xA0`。
* reader:滤镜 = 换 Sprite-ScriptActionRender 系列 shader + 16 float 矩阵参数(`_FilterParam`)。

### 4.3 RenderTexture 系特效(ScriptActionRenderEffectController,dump.cs:165399)

字段:`timerCount 0x10`、`timerMax 0x14`、`loopCount 0x18`、`reflectionFunction 0x20`、`stopFunction 0x28`、`isEnable 0x30`、`requestStop 0x31`、`material_ 0x38`。

方法(全部 `(float sec, …)`,内部按 count/loop 做 start→stop 反射插值,`ReflectionMaterial(material, srcParam, destParam, rate)`):

| 方法 | 参数 |
|---|---|
| `StartDistortion(sec,count,centerX,centerY,strength,range,coefficient)` | DistortionParam 0x10-0x20 对应 centerX/centerY/strength/range/coefficient |
| `StartGaussianBlur(sec,sampleRange,sigma)` | GaussianBlurParam{sampleRange 0x10,sigma 0x14},`GetBlurFactors(sampleRange,sigma)` |
| `StartMotionBlur(sec,sampleRange,sigma,centerX,centerY,range,coefficient)` | MotionBlurParam 0x10-0x24 |
| `StartFrostedGlass(sec,sampleRange,sigma,tiling,scatter)` | FrostedGlassParam{sigma,tiling,scatter,blurLv} |
| `Stop*/SkipDistortion/SkipBlur/SetGaussianBlur/SetMotionBlur/SetFrostedGlass/SetFrostedTexture(Texture)` | |

命令证据:
* `distortionstart`(cmp 0x317b118):`ModifyPlaySpeed` 后连续 6 个 `Single.Parse` → StartDistortion;
* `distortionstop`(cmp 0x317b7dc):`Single.Parse(sec)` → `new StopFunction(...)`(0x316c5cc)→ `StopDistortion`(0x316ace0);正常速度时再 `SkipDistortion`;
* `distortionloop`(cmp 0x317f1d0):`Single.Parse,Int32.Parse,Single.Parse×3`;
* `blur` / `blurOff`(cmp 0x3187988):`blurOff` 含 `'lens'` 关键字 + `Single.Parse(sec)` + `StopGaussianBlur`(0x316b10c)(**推断**:`blur` 即 GaussianBlur start,`lens` 为子参数);
* 角色级边缘模糊:`ScriptCharaData.SetEffectEdgeBlur(effectName, Color color, Color particleColor, isSkip, isPause, FlipKind flip, int level=4, float thick=1.5)`;`UIScriptChara.GetOffsetEdgeBlur/GetRectEdgeBlur/GetHighRectEdgeBlur/GetBodySubTexture/GetSizeEdgeBlur` 提供角色本体 sub-texture 与包围盒 → 用角色贴图做边缘遮罩模糊。命令 `charaEffectEdgeBlur*`(Start cmp 0x317b730、Stop 0x317eabc、Destroy 0x31865b8)。

### 4.4 SpriteMask

* `ConvertSpriteMaskName(s)` @ **0x31b39b4** = `String.Format("Image/mask_{0}", s)`;
* `spriteMaskSet`(cmp 0x3179fe0):加载该资源 → `UnityEngine.SpriteMask.set_sprite`;加载失败输出 `" is not found"`;
* `spriteMaskOff`(cmp 0x3187434):`set_sprite(null)` + `SetActive(false)`;
* 角色局部遮罩:`ScriptCharaData.SetMaskData(int offsetX,int offsetY,int width,int height)` @0x3170e78;`charaMask` 命令额外支持 `inside`/`wipeoutEx` 关键字 + `ConvertWipeName`(用划像图当角色遮罩)。
* ScriptManager 侧字段:`spriteMask 0x210`、`isMaskEnabled 0x731`、`isSpriteMaskLoading 0x732`、`backMaskImage 0x258`。

### 4.5 其余

* `specialEffect*`(ProgramEffectManager;`ProgramEffectComponent.Param` dump.cs:149548)带 `GetEffectParameter`(0x31b8248)参数对象,`charaSpecialEffect*` 经 `GetCharaSpecialEffectSubParam`(0x31c8ba4)。
* `DestroyStoppedCharaEffect` @0x31b5450(字面量 `MARK_STOPPED_CHARA_EFFECT`),配合 `charaEffectStop/Destroy` 的停止队列(`StopEffect(bool isSkip,string markKey)`、`DestroyEffectByMark`)。

---

## 5. 角色演出

### 5.1 数据模型

`ScriptCharaData`(dump.cs:165886):

* `Kind{FIGURE=0,EQUIP=1,IMAGE=2,VERTICAL_IMAGE=3,HORIZONTAL_IMAGE=4}`、`State{LOAD,IDLE,MOVE,DESTROY}`;
* 字段:`kind 0x10,state 0x14,name 0x18,imageName 0x20,talkName 0x28,gameObject 0x30,chara 0x38(UIScriptChara),faceType 0x40(Face.Type),changeKind 0x48,changeSpeed 0x50,defaultDepth 0x54,defaultLayer 0x5C`;
* 方法族:`ChangeCharacter(kind,speed,imageName,type,isContinueSilhouette)`、`SetFace(type,fadeTime)`、`SetPosition(index|x,y|Vector3)`、`SetRelativePosition(Vector2)`、`SetScale`、`SetAlpha`、`SetDepth/RecoverDepth/SetTalkDepth`、`MoveAlpha/MoveAlphaSpeed/MoveAlphaLoop(duration[],alpha[],loop,fast)`、`MovePosition/MovePositionEase/MoveReturnPosition*`、`MoveScale/MoveScaleEase`、`MoveAttack(kind,duration,…)`、`MoveRelativePositionLoop(Vector2[],float[],loop,fast)`、`SetRoll/StartRoll/StartRollEx/StartRollAxis(rollAxis,roll,duration,isRollLoop,isRollWait,stopAngleLoopEnd)`、`Shake/ShakeStop`、`SetCutin/ResumeCutin/SetCutout/StopCut`、`SetEffect/SetBackEffect/SetEffectEdgeBlur`、`SetMaskData`、`SetLayer/SetSortingOrder`。
* `Face.Type{NORMAL=0,PLEASURE=1,CRY=2,EMBARRASSED=3,SAD=4,ANGRY=5,FACE_6..}`(dump.cs:61648)。

`UIScriptChara`(dump.cs:171674):

* 变换链字段:`baseRelativePosition 0x20 → baseDepth 0x28 → baseScale 0x30 → baseRoll1 0x38 → baseRoll2 0x40 → baseShake 0x48`;另有 `baseCutEffect 0x50`、`baseSpecialEffect 0x58`、`baseEffect 0x60`、`baseEffectBack 0x68`、`baseShadowEffect 0x70`;
* `ChangeKind{NONE=0,NORMAL=1,FADE=2,BLINK=3,CROSS_FADE=4}`(dump.cs:171573);
* 交叉淡入:`mainIndex 0xE0 / backIndex 0xE4`(双 sprite),`changeKind/changeSpeed/changeCount/changeRange/changeTotal/changeStep`(0xB0-0xC4)为逐帧推进参数;
* 状态:`isMove 0xE8,isRoll 0xE9,returnDuration 0xEC,returnEaseType 0xF0,isMoveRelativePosition 0xF8,moveRelativePositions 0x100,moveRelativeDurations 0x108,moveRelativeLoopNum 0x110,moveRelativeEaseType 0x118,isMoveAlphaLoop 0x120,moveAlphaDurations 0x128,moveAlphaValues 0x130,shakeTime 0x140…rollAxis 0x158,rollAngle 0x16C,rollDuration 0x170,isRollLoop 0x174,isRollWait 0x175,stopLocalRotationLoopEnd 0x178`;
* 子类:`UIScriptFigure`(0x172266)、`UIScriptImage`(0x172469)、`UIScriptEquip`(0x172144)、`UIScriptHorizontalImage`(0x172377)(further: UIScriptVerticalImage 同类)。

### 5.2 命令实测(cmp/handler 与调用链)

| 命令 | 证据 |
|---|---|
| `charaSet` | cmp 0x3186fd8;ConvertCharaIndex→按 Kind 建 `ScriptCharaData`(`SetCharaImage`@0x31b77c4 / `SetEquipGraphic`@0x31b79b4 内含 `ScriptCharaData.IsLoad→Destroy→.ctor(0x316f3a4)`) |
| `charaChange` | cmp 0x317ec9c;`ScriptCharaData.ChangeCharacter`;相关字面量 `crossFade`/`charaChange` |
| `charaFace` | cmp 0x31847c0;ConvertCharaIndex + `Int32.Parse` → `ScriptCharaData.SetFace`(0x316f3??) |
| `charaFaceFade` | cmp 0x3183290;带 fadeTime 的换表情 |
| `charaDepth` | cmp 0x3183120;ConvertCharaIndex + Int32.Parse → `SetDepth` |
| `charaLayer` | cmp 0x31829ec;ConvertCharaIndex;参数 `'sub'` → 默认子层;`IsExistTargetSubLayerGroup(tag,pd)`;`ScriptSubLayerManager.RegistCharaData`(0x31dfa98) |
| `charaCutout` | cmp 0x317dc8c;ConvertCharaIndex + float → `SetCutout` |
| `charaCutin` | cmp 0x31855f4;float×2 → `SetCutin(n,time,mgd,…)` |
| `charaMask` | cmp 0x3183f7c;`inside`/`wipeoutEx` + `ConvertWipeName` |
| `charaRoll` | cmp 0x3188238;Single.Parse + Int32×2 → `SetRoll(rollZ, centerOffset)` |
| `charaRollAxis` | cmp 0x3187798;float×2 → `StartRollAxis(axis,roll,duration,…)` |
| `charaScale` | cmp 0x3187fcc → `SetScale` |
| `charaShake` | cmp 0x3185f90;duration/cycle/x/y → `ScriptCharaData.Shake` |
| `charaFadeout` | cmp 0x3187e44;alpha 移动族(`MoveAlpha*`,loop 见 `charaFadeTimeLoop` cmp 0x3182f94 → `moveAlphaDurations/Values`) |
| `charaCrossFade` | cmp 0x317aad0 → ChangeKind.CROSS_FADE(0x38 chara 的 main/back 双图) |
| `charaFadeTime` | cmp 0x3188574;ConvertCharaIndex,IsNormalPlaySpeed,Single.Parse,Int32.Parse,字面量 `'delayStop'` |
| `charaEffectStart/Stop/Destroy` | `ScriptCharaData.ResumeEffect/StopEffect/StopEffect(markKey)` |
| `charaBackEffect*` | `SetBackEffect/ResumeBackEffect/StopBackEffect`(角色背层特效,baseEffectBack 0x68) |
| `charaSpecialEffect*` | ProgramEffectManager 角色特效,`SetSpecialEffect(...ProgramEffectComponent.Param)` |
| `useSimpleMeshFigure` | cmp 0x317ba14;逗号分隔的名字写入 `ScriptManager.simpleMeshFigureNames(0x788)`(List.Add @0x201abc4,**推断**:命中名字的 figure 用 simple mesh 绘制) |
| `figureChange` | 226 表中存在但 op_Equality handler 未定位;FNV-1a 恢复出 tag(0xd558a289),switch 站点 0x31921f0→handler **0x31934f8**、0x31791c4→0x3179760(细节未解析) |
| `equipSet` / `imageSet` / `verticalImageSet` / `horizontalImageSet` / `masterImageSet` / `masterImageChange` / `horizontalImageChange` | `charaSet` 家族等价命令(分别建 EQUIP/IMAGE/VERTICAL_IMAGE/HORIZONTAL_IMAGE 类 ScriptCharaData;`masterImage*`/`horizontalImageChange` 针对“主人称/横图”槽位) |
| `pictureFrame` | cmp 0x3184854;`ConvertPictureFrameImageName`=`"Image/{0}"`,`PICTURE_FRAME_Z_POS_NORMAL/TOP`(静态字段 0x10/0x14)控制 z;`SetPictureFrameImage`@0x31b7bbc 用 `ExUISpriteRenderer.SetAssetImage2`(0x2e0e478) |
| `spotlight` | 无同名命令;`ScriptManager.SetCharaSpotlight(List<int> charaIndexes)` @ **0x31b76dc**:遍历 `charaList(0x490)`,名单内在 `SetTalkMask(false)`(+`isTalkDepth(0x3B2)` 时 `SetTalkDepth()`),名单外在 `SetTalkMask(true)+RecoverDepth()` → **说话时其他人变暗** 的实现 |

### 5.3 层级与深度(reader 要点)

* 深度链:`ScriptCharaData.SetDepth(d)` → `UIScriptChara.baseDepth(0x28)` 的局部 z;`SetSortingOrder/SetLayer` 处理 2D 排序;`charaLayer` 把角色挂到某子层(其渲染顺序由子层相机单独决定);
* 图框(pictureFrame)是独立于角色层的 `ExUISpriteRenderer(0x78)` + z 常量;通信角色(`communicationChara*`)用 `communicationCharaEffectBase(0x158)` 与单独的 `isLoadCommunicationChara(0x498)`;
* `charaFadeSpeed`(0x3180e44)/`charaFadeTime`(0x3188574)控制淡入速度/时长;`ModifyPlaySpeed` 对这些速度做倍率。

---

## 6. 插入动画与 FSM 对象

### 6.1 insertionAnimation*

* 资源格式:**`InsertionAnimations/{0}/{0}`**(`ConvertInsertionAnimationName` @0x31b3f20,`String.Format`)。
* `insertionAnimationSet <name>`(cmp 0x3188164,handler 0x318816c):`ConvertInsertionAnimationName(name)` → `AssetManager.loadAssetStorage`(0x2da59ac)异步加载 prefab;置 `isInsertionAnimationLoading(0x748)=1`(证据 0x3188190)。
* `insertionAnimationStart`(cmp 0x3180d00):`GameObject.Find(<name>)` 校验对象存在;
* `insertionAnimationEnd`(cmp 0x317f808):同上;
* 管理:`animationInsertionObjects 0x778`、`animationInsertionAssetNames 0x780`、`StartLoadAnimationAssetData`@0x31a8824、`destroyAnimationInsertionObjects`@0x31b15e4(Destroy + `AssetManager.releaseAssetStorage` + `Array.Clear`)。

### 6.2 FSM 对象(`ScriptFsmObject` / `ScriptFsmObjectData`)

`ScriptFsmObjectData`(dump.cs:166489):`fsmObject 0x10`、`isLoading 0x18`、`loadedAssetData 0x20`;
方法:`ctor(assetName, objectName)`@0x3171d14、`SetParent(GameObject)`@0x3171e40、`SetPosition(x,y)`@0x3171f34、`SetState(stateName)`@0x3171fdc、`SendEvent(eventName)`@0x3172070、`SetString(name,value)`@0x3172104、`SetFloat(name,value)`@0x31721a0、`SetBool(name,value)`@0x3172248、`Skip()`@0x31722e4、`Destroy()`@0x3172364。

槽位:`ScriptManager.fsmObjectDataList`(**0x790**,只读数组),索引 = `ConvertCharaIndex(参数1)`(证据:fsmObjSetState 0x3185e68-0x3185e84、fsmObjDestroy 0x317abc0-0x317abec)。

命令:
* `fsmObjSet`(cmp 0x317c248,arity≥5):槽占用先 `Destroy()` 再建 `ctor(assetName,objectName)` 并 `SetParent/SetPosition`;
* `fsmObjSetState`(cmp 0x3185e08):`SetState(stateName)`;同函数内还内联了 tag 再比较(同一 handler 段还服务 `fsmObjSetString`);
* `fsmObjSetBool`/`fsmObjSetFloat`/`fsmObjSetString`(cmp 0x3182ad4 一带):`SetBool/SetFloat/SetString`(此区域有 `'true'/'false'` 字面量);
* `fsmObjSendEvent`:→`SendEvent(eventName)`;
* `fsmObjDestroy`(cmp 0x317aba0):`Destroy()` + 清槽;
* `fsmObjLayer`(cmp 0x317f638):参数 `'ui'` 等 → `SetParent(UI 根)`。
* reader:这些是 PlayMaker 状态机对象,脚本只能设置状态/变量/事件;回放器可按「槽位」保持对象生命周期,按时间轴重放这些调用即可。

### 6.3 adv prefab(demo 演出,带 RenderTexture)

* `ScriptActionAdvPrefabController`(dump.cs:164950):`renderTexture 0x20`、`demoRootObject 0x28`、`actorDict 0x30`、`isSetup 0x38`、`isPaused 0x48`;方法 `GetAssetName/Setup(assetName)/Prepare(objectName)/PlayAnimator(actor,trigger)/CheckGoNext/SetShow/SetHide/Release/Pause`;
* `ScriptActionAdvPrefabActorController`(dump.cs:164799):`ActorName 0x20`、`DisplayCond 0x28`、`FollowTarget 0x30`、`followOffsetPosition/Angle 0x38/0x44`、`IsGoNext 0x50`、`animator 0x58`;`SetDisplay(genderType)/SetGender/PlayAnimator(trigger)/Show/Hide`;
* 命令:`advSet`(cmp 0x317ec04,`GetAssetName`+`Setup`;与 `fsmObjSetString`/`charaChange` 关键字联动)、`advPrepare`(0x317d14c,`Prepare`+`SetImage` 到 `meshAdvPrefabRenderBase 0x250`)、`advPlayAnimator`(0x318267c,`PlayAnimator(actor,trigger)`,**内联 `tdelay` 分支会注册延迟**)、`advActorShow/Hide`(0x318489c/0x317f138)、`advRelease`(0x31839d8,`Release`+`ClearImage`)。

---

## 7. 子层(SubLayer / RenderTexture 子场景)

### 7.1 结构

`ScriptSubLayerManager`(dump.cs:171488):常量 `DEFAULT_SUB_LAYER_GROUP_NAME = "#A"`;`subLayerCamera 0x20`、`subLayerInstanceRoot 0x28`、`subLayerPrefab 0x30`、`stretchObj 0x38`、`listSubLayer 0x40`、`isInvalidStretch 0x48`;
方法:`InitSubLayer`@0x31df610、`StartSubLayer(Camera targetCamera,int count)`@0x31df614、`GetScriptSubLayer(layerKey)`@0x31df7cc、`RegistCharaData(layerKey,charaData)`@0x31dfa98、`SetDepth(layerKey,float)`@0x31dfadc、`QuitSubLayer`@0x31dfb08、`SetSubStretch(bool)`@0x31dfb10、`CreateSubLayer(count)`@0x31df6b4、`RenderingSubLayer`@0x31def68。

`ScriptSubLayer`(dump.cs:171209):`SUB_LAYER_NAME="ScriptRenderSub"`;`layerKey 0x20`、`isRendering 0x28`、`backgroundColor 0x2C`、`renderTexture 0x40`、**`effectController 0x48`(每个子层独立的 ScriptActionRenderEffectController)**、`edgeMaskSubMaterial 0x50`+`edgeMaskSubMaterialParams 0x58`、`IsExecuteStretch 0x60`、`renderRoot 0x68`、`meshRender 0x70(ExUIMeshRenderer)`、`shakeRoot 0x78`、`subStretchBase 0x80`、**独立相机链 `scaleCamera 0x88 / positionCamera 0x90 / rollCamera1 0x98 / rollCamera2 0xA0`**、`listCharaData 0xA8`、`subLayerMask 0xB0`、`shakeParam 0xB8`(struct,dump.cs:171453 附近)。

ScriptManager 侧:`subLayerManager 0x260`、`isWaitSubLayer 0x768`、`currentSubLayerTweenerList 0x770`;
`RenderCameraSubInit`@0x319ff74 → `InitSubLayer()`;`RenderCameraSubStart(int subLayerCount)`@0x31a00e8 → `StartSubLayer(renderTextureCamera(0x138), count)`。

### 7.2 tag 方案(`IsExistTargetSubLayerGroup` @ 0x31c69f8)

函数以命令 tag 做 hash switch,覆盖:`subCameraMoveEase, subRenderScale, '#', subRenderMoveFSL, subRenderMoveScale, subRenderMoveEaseFSR, subRenderMoveFSSideR/L, subRenderFadeinFSR/L/FSSideR, subRenderMoveEase, subRenderMoveEaseFSL, subCameraFilter, subRenderMove, subRenderMoveScaleEase, charaLayer, subRenderMoveFSR, subRenderMoveEaseFSSideR/L, subRenderFadeout, subRenderFadein, subRenderFadeinFSSideL`(逐字面量)。逻辑:按命令取参数中「层 key」的位置,若该 key **`String.StartsWith("#")` 则视为子层组**(0x31c6e64-0x31c6e7c),返回 true 表示目标存在(子层组)。默认组名 `#A`。

### 7.3 命令实测

* `subCameraMove`(cmp 0x3183b24):float+int×2,与 cameraMove 同参,作用于子层 GO;
* `subRenderMoveEase`(cmp 0x3186c54):`IsExistTargetSubLayerGroup` → Single.Parse+Int32×2 → `SubCameraMoveEase(subLayer,…)`;
* `subRenderShake`(cmp 0x31837b4):IsFastPlaySpeed + 2 float+2 int → 子层 shake(`ScriptSubLayer.shakeParam`);
* `subRenderDepth`(cmp 0x3185b88):`ScriptSubLayerManager.SetDepth(layerKey, depth)`;
* `subBlur2`(cmp 0x3180664):`GetScriptSubLayer(layerKey)` + lambda(`ScriptManager.<>c__DisplayClass808_4`)→ 对子层的 `effectController` 开 GaussianBlur;`subBlur2Off` 用 `Single.Parse(sec)`+`StopGaussianBlur`;
* `subRenderFadein`(cmp 0x3185f5c):Int32×2 + `IsExistTargetSubLayerGroup` → 子层 alpha 淡入;
* `subCameraFilter`:子层材质滤镜(用 `edgeMaskSubMaterial`/effectController)。

**reader 建议**:子层 = 独立 RenderTexture 场景;`subRender*` = 对该 RT 的移动/缩放/淡入淡出/shake/模糊;`#` 前缀 key 指定组(`#A` 起)。

---

## 8. 时间 / 播放模型(reader 关键)

### 8.1 播放速度

`ScriptManager.PlaySpeed{NONE=0,PAUSE=1,NORMAL=2,FAST=3}`;`playSpeed 0x28C`、`requestPlaySpeed 0x290`、`scenarioSpeed 0x6F0`;`IsNormalPlaySpeed`@0x31b5324、`IsFastPlaySpeed`@0x31b5344、`PausePlaySpeed(bool)`@0x31b536c、`ResumePlaySpeed`@0x31b53d8、`ModifyPlaySpeed(bool)`@0x31a8220。
证据:所有耗时参数解析前都有 `bl IsNormalPlaySpeed`(如 cameraMove 0x3186878、cameraMoveEase 0x317a700)——**快进/跳过时时间参数被忽略**。

### 8.2 Auto-wait(自动播放等待)

* `GetAutoWaitTime(int stringCount)` @ **0x31b2038** = `autoWaitTime(0x6F8) + textStepTime(0x720)*stringCount/GetTextSpeed()`(`GetTextSpeed`@0x31b206c 基于 `OptionManager.GetScenarioTextSpeed`);
* `SetAutoWait(string stringData)` @ **0x31b1974**:给行追加标签 **`[wait skippableTime {0:F2}]`**(常量 `AUTO_WAIT_TAG_FORMAT`,使用点 0x31b19d0/0x31b1d0c/0x31b1e44);
* `CheckNotSetAutoWaitCommand(string[] commands, string data)` @0x31b1eac:命令行黑名单匹配(`notSetAutoWaitCommands 0x718`);
* `GetCommandTag(string,int,string)` @0x31b1f34:逐字符取到 `]` 或空格 → 取 tag 名。

### 8.3 延迟模型(tdelay)

`ScriptCommandDelayParam`(dump.cs:166263):`executeIndex 0x10`、`executeIndexMax 0x14`、`delaySecond 0x18`、`skipDropFlag 0x1C`、`messageFlag 0x1D`、`checkTextSpeed 0x1E`;ctor@0x3170f44;数组 `executeDelayParam 0x6E8`。

* `UpdateDelayScript(float originalDelta)` @ **0x31b576c**:遍历未完成延迟项;`delta = originalDelta * (checkTextSpeed? GetTextSpeed(): 1)`;跳读(`IsTextSkip`@0x31b58dc)时强制推进;`delaySecond -= delta`;≤0 → `ProcessDelayScript(0x31b59c0)` 完成该段,完成后跳 `executeIndex` 并置 `state(0x288)=0x10`;
* `DelayStop(int index,int skipFlag)` @ **0x31c5ab4**;`DelayStopAll` @0x31c5b68;`delayStop`/`delayStopAll`/`delayStopAll` 命令存在;
* `GetNextDelayEnd(int index)` @ **0x31b2710**:从 index 起扫 `executeTagList(0x330)` 找 tag **`'delayEnd'`**,返回其行号 → **tdelay 区块的结束行**;
* `TDelayJumpScript(int)` @0x31b27a8。
* 命令证据:`tdelay`(cmp 0x3182760)handler:`GetNextDelayEnd()`、Int32.Parse(slot)、Single.Parse(time)、Int32.Parse、`DelayStop(slot,2)`,随后在 **0x31827a0-0x31828cc** 构造并压入 `ScriptCommandDelayParam(executeIndex+1, GetNextDelayEnd(), time, skipDropFlag, messageFlag=IsMessageLine(executeIndex), checkTextSpeed)`;`advPlayAnimator` 复用同一段注册逻辑。
* **reader 规则**:`[tdelay <slot> <time> …]` ~ `[delayEnd]` 之间的命令并行执行;保持计时器(受文本速度缩放),到期或遇到阻塞命令再继续;`delayStop`/`delayStopAll` 取消计时。

### 8.4 wait

`wait` 命令(handler 调 `ScriptManager.JumpScriptCommand`@0x31b2cfc)即「等待玩家点击/自动播放计时」的阻塞点;结合 8.2 的 `skippableTime` 即自动播放等待时长。

---

## 9. 渲染栈建议(reader)

自下而上(依据以上字段/初始化证据):

```
backEffect 0x178 → effect 0x170 → fowardEffect 0x168 → specialEffect/ProgramEffect 0x160
→ communicationCharaEffect 0x158 → sublayer RenderTextures(0x260,各自相机链 0x88-0xA0)
→ 角色(charaList 0x490,变换链 baseRelativePosition→baseDepth→baseScale→baseRoll1/2→baseShake)
→ UI/消息(panel 0x60-0x70)
→ fade quad meshFadeBase 0xE8 → wipe quad meshWipeBase 0xD8 / meshExWipeBase 0xE0 → flash quad meshFlashBase 0xD0
→ mask(spriteMask 0x210 / isMaskEnabled 0x731) → pictureFrame 0x78
```

单命令时间语义:
1. **tween 类**(fade/wipe/flash/stretch/camera*):t0 起在 duration 内插值,完成回调对应 `EndExecuteXxx`;duration=0 立即;
2. **延迟类**(tdelay 区块):后续命令并行,按 delaySecond 计时;
3. **阻塞类**:message/wait/select 等,等输入或 auto-wait(`autoWaitTime + textStepTime*字数/文本速度`)。

颜色/时长:淡入淡出 = 单色 + level(alpha);flash = 两段(时1色1 / 时2色2),循环方式 `once|loop|pingpong`;wipe = 贴图 + `_Gradation` level。

---

## 10. 未决问题

1. 参数下标映射:dispatcher 自 `x20` 的 string[] 取第 k 个词,但 1-based/0-based 没有对真实脚本全文逐一验证;`' '` 为「省略参数」占位、`,` 为独立 token(已证 cameraMove/wipein/shake/cameraMoveEase/wipeoutEx)。**完整 379 条命令名见 `out/_evidence/cmd_names_full.txt` 与 presentation.json `dispatcher.commands`;其中 265 条带参数/调用细节(`commands_detailed`)。**
2. `ScriptPosition.GetPosition(int)` 的 9 个调用点因 handler 共享布局未能归属到具体命令;positionList 0..6 语义为推断。
3. InitCamera/InitCameraRoll 中 GetComponent<> 的组件类型槽(0x5576710/0x5576690)未解析出类名。
4. Tween* 系列(C# 全局命名空间的小型 tween 库)只做了行为级描述,`loopType` 字段与 `once/loop/pingpong` 的映射未定位到具体偏移。
5. `MaskFade.Kind.TARGET_COLOR(=3)` 未找到使用命令。
6. `figureChange` 的 handler 入口未定位到(tag 在 226 表中,handler_start 判定失败);`FS/FSSide` 后缀参数名仅推断为 full-screen 变体。

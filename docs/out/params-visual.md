# 视觉/演出指令参数语义(params-visual)

FGO 2.139.3(IL2CPP,arm64)。本文是 253 条视觉/演出指令的**逐参数**说明,证据为 `libil2cpp.so` 中的 VA。`pd[i]` 即脚本行按空格切分后的第 i 个 token。

生成方式:`tools/vis_trace.py`(带边界与共享尾块跟踪的污点扫描,输出 `scratch/vis_flows.json`)+ 人工核对;置信度 high=直接证据(0 层扫描命中/人工读码),medium=顺序对应或共享尾块路径,low=仅见加载未见消费。

## 0. 共享约定(所有演出指令通用)

* **token 布局** — 脚本行按空格切成 token 数组 pd[];pd[0]=tag,之后 pd[1],pd[2],… 交替为“分隔符/值”。偶数下标=值,奇数下标=分隔符。逗号本身也是独立 token(`100,200` → 3 个 token `100` `,` `200`)。
* **值槽位** — JSON 中 valueslot = pd 下标;第 k 个值位于 pd[2k](k=1,2,…),pd[0] 是 tag。
* **空格占位/省略** — `' '`(单空格)表示“省略该参数”:比较指令 `pd[2k-1]==' '` 命中时读取 pd[2k],否则跳过该参数并使用默认值。`optional_pd` 即这些受空格守卫的下标。
* **角色槽位** — chara 系列第一个参数经 `ScriptManager.ConvertCharaIndex(string)` 转成角色槽位号:A→0, B→1, … Z→25(数字也可直接写);槽位 0..25 对应场内最多 26 个立绘(CHARA_MAX=26)。
* **位置参数** — chara 系(及部分 subRender)位置参数有两种写法:①单个整数 = `ScriptPosition.positionList` 下标(0 左 -256, 1 中 0, 2 右 +256, 3 FSSideL -438, 4 左屏外 -512, 5 FSSideR +438, 6 右屏外 +512,y 恒为 0);②`<x>,<y>` 两个整数 = 直接坐标(内部经 GetPosition(float,float) 原样返回)。区分方式:代码检查分隔符 pd[2k-1][0]==','(逗号形式)还是空格(下标形式)。
* **FSL/FSR/FSSide/NotNotch** — 命令名后缀 FSL/FSR/FSSideL/FSSideR/NotNotch 属于“全屏(FS)演出”变体,不是参数:位置偏移由 `ScriptManager.GetFSCommandOffsetX/Y(命令名, 基础名, forceObi)` 计算(内部用 FSUtility.GetOffsetX 按屏幕比例算出屏幕边缘 X),FSL=左边缘(取负)、FSR=右边缘(取正)、FSSide=侧位、NotNotch=不做刘海/黑边规避(forceObi/16:9 补偿)。同一 handler 由不同 tag 驱动,行为差异只在偏移量与是否规避刘海。
* **时间** — 时长单位秒(float);`cameraMove`/`charaMove` 等在 IsNormalPlaySpeed()==false(快进/跳过播放)时不解析时长,直接瞬移。
* **alpha/level** — alpha/level/scale 均为 0..1(颜色 alpha 与遮罩强度)。
* **旋转** — 旋转类参数(cameraRoll/cameraRollMove/charaRoll/charaRollMove)单位为**度**,终点为 `ScriptManager.SetCameraRoll(rollZ, centerOffset)` / `ScriptCharaData.SetRoll`;charaRollAxis 另有轴参数。
* **翻转/朝向** — 翻转/朝向参数经 `ScriptManager.ConvertEffectFlipKind(string)` 转换(`H`/`V`/`F`/其他→0..3),用于特效与立绘朝向。
* **charaSet 参数布局** — charaSet 系的参数布局(实证):pd0=槽位, pd2=立绘名(equipSet 时为从者ID,drew maleImageId), pd4=位置(下标或 x), pd5=',' 时 pd6=y, pd7==' ' 守卫后 pd8=全屏缩放类型(仅 imageSet/sceneSet), 其余参数交给 `ScriptManager.GetAfterParam(line, N)` 作为行尾附加串保存在 ScriptCharaData(+0x28)。
* **空实现 tag** — 部分 tag 在 2.139.3 的分发器里是空实现(handler 体只有 `b 0x3193f00`=return Normal),参数不参与运行时;脚本仍可写,阅读器按“无效果”处理。已证实:advSoundSet / enableFullScreen / delayEnd / enableWaitLoadAssetWhenResume(共享 handler 0x3182018)。


## chara 演出:切出/过场

### `charaCutStop` (0x31857a8, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31857c8 |

### `charaCutin` (0x31855fc, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3185678 |
| 1 | separator | 分隔符 `' '` | high | 0x3185624 |
| 2 | string | 立绘/图片名(ConvertNameString) | high | 0x31856bc |
| 3 | separator | 分隔符 `' '` | high | 0x3185650 |
| 4 | float | 时长(秒) | high | 0x31856d8 |
| 6 | float | 第二时长/速度(秒;可选) | medium | 0x3185700 |

### `charaCutinPause` (0x31855fc, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3185678 |
| 1 | separator | 分隔符 `' '` | high | 0x3185624 |
| 2 | string | 立绘/图片名(ConvertNameString) | high | 0x31856bc |
| 3 | separator | 分隔符 `' '` | high | 0x3185650 |
| 4 | float | 时长(秒) | high | 0x31856d8 |
| 6 | float | 第二时长/速度(秒;可选) | medium | 0x3185700 |

### `charaCutinStart` (0x317d9c8, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317d9e8 |

### `charaCutout` (0x317dc8c, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317dcdc |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317dcb4 |
| 2 | ? | 裁剪参数(未消费;仅 0x318f144 处比较) | low |  |


## chara* 角色立绘演出

### `charaAttack` (0x3186270, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31862ec |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3186298 |
| 2 | string | 攻击动作/特效名(ScriptCharaData.MoveAttack 第 1 参) | high | 0x31863d0 / 0x3192cc0 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3186298 |
| 4 | int | 目标 X 坐标 | high | 0x31863cc |
| 5 | string | 首字符必须为 ','(格式校验) | high | 0x3186334 |
| 6 | int | 目标 Y 坐标 | high | 0x31863f4 |
| 7 | string | 首字符必须为 ' '(格式校验) | high | 0x3186368 |
| 8 | float | 时长(秒;MoveAttack 第 4 参) | high | 0x31863a0 |

### `charaBackEffect` (0x3181664, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31816b4 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318168c |
| 2 | string | 特效名(Talk/<name>) | high | 0x31816f8 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318168c |
| 5 | separator | 分隔符 `,`(此位不是参数值) | high | 0x318168c |
| 7 | ? | 未知 | low |  |
| 8 | string | 翻转/朝向(H/V/F/其他) | medium | 0x3192464 |
*未决: pd7: 未找到消费点(仅有加载)*

### `charaBackEffectDestroy` (0x317b2e0, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31880b0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317b34c |
| 2 | string | 特效名(Talk/<name> 或 ConvertNameString 名) | medium | 0x3188134 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317b34c |
| 4 | string | 颜色(名称或 #RRGGBB) | medium | 0x318d2b8 |

### `charaBackEffectPause` (0x3181664, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31816b4 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318168c |
| 2 | string | 特效名(Talk/<name>) | high | 0x31816f8 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318168c |
| 5 | separator | 分隔符 `,`(此位不是参数值) | high | 0x318168c |
| 7 | ? | 未知 | low |  |
| 8 | string | 翻转/朝向(H/V/F/其他) | medium | 0x3192464 |
*未决: pd7: 未找到消费点(仅有加载)*

### `charaBackEffectStart` (0x3187fb4, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31880b0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3188030 |
| 2 | string | 特效名(Talk/<name> 或 ConvertNameString 名) | medium | 0x3188134 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3188030 |
| 4 | string | 颜色(名称或 #RRGGBB) | medium | 0x318d2b8 |

### `charaBackEffectStop` (0x317e538, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31880b0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317e5c4 |
| 2 | string | 特效名(Talk/<name> 或 ConvertNameString 名) | medium | 0x3188134 |

### `charaChange` (0x317ec9c, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317ecbc |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ed20 |
| 2 | string | 新立绘名+形态(ScriptManager.GetCharaImageNameAndFormId) | high | 0x317ee34 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ed20 |
| 4 | string | 附加名称(ConvertNameString) | high | 0x3193270 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ed20 |
| 6 | string | 颜色名(black/white/#RRGGBB 等) | high | 0x3193374 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ed20 |
| 8 | string | 颜色名(black/white/#RRGGBB 等) | high | 0x31933a8 |

### `charaClear` (0x3182968, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3182988 |
| 3 | ? | 分隔符/选项守卫(' ') | low |  |
| 4 | string | 消除方式/颜色(ConvertColor) | high | 0x318d2b8 |

### `charaCrossFade` (0x317aad0, min_token=7)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317aaf0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318d0d4 |
| 2 | string | 立绘/资源名(淡入的新立绘) | high | 0x318d14c |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318d0d4 |
| 4 | string | 颜色名(black/white/#RRGGBB 等) | high | 0x318d2b8 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318d0d4 |

### `charaDepth` (0x3183120, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3183170 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3183148 |
| 2 | ? | 深度值(z 排序值,越小越靠前?) | low |  |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3183148 |
| 4 | string | 颜色(名称或 #RRGGBB) | medium | 0x318d2b8 |

### `charaEffect` (0x3187a5c, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3187aa8 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187a84 |
| 2 | string | 特效名(Talk/<name>);亦作滤镜名(SetFilterCharaData) | high | 0x3187aec / 0x31925e0 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187a84 |
| 4 | string | 颜色名(black/white/#RRGGBB 等) | medium | 0x318d2b8 |
| 5 | separator | 分隔符 `,`(此位不是参数值) | high | 0x3187a84 |
| 7 | ? | 未知 | low |  |
| 8 | string | 翻转/朝向(ConvertEffectFlipKind) | medium | 0x319258c |
*未决: pd7: 未找到消费点(仅有加载)*

### `charaEffectDestroy` (0x317f398, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31880b0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317f404 |
| 2 | string | 特效名(Talk/<name> 或 ConvertNameString 名) | medium | 0x3188134 |

### `charaEffectEdgeBlur` (0x3188390, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31883b0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318a4d0 |
| 2 | string | 颜色名(black/white/#RRGGBB 等) | medium | 0x318a464 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318a4d0 |
| 4 | string | 颜色名(black/white/#RRGGBB 等) | medium | 0x318d2b8 |

### `charaEffectEdgeBlurDestroy` (0x31865b8, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31865d8 |

### `charaEffectEdgeBlurPause` (0x3188390, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31883b0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318a4d0 |
| 2 | string | 颜色名(black/white/#RRGGBB 等) | medium | 0x318a464 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318a4d0 |
| 4 | string | 颜色名(black/white/#RRGGBB 等) | medium | 0x318d2b8 |

### `charaEffectEdgeBlurStart` (0x317b730, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317b750 |

### `charaEffectEdgeBlurStop` (0x317eabc, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317eadc |

### `charaEffectPause` (0x3187a5c, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3187aa8 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187a84 |
| 2 | string | 特效名(Talk/<name>);亦作滤镜名(SetFilterCharaData) | high | 0x3187aec / 0x31925e0 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187a84 |
| 4 | string | 颜色名(black/white/#RRGGBB 等) | medium | 0x318d2b8 |
| 5 | separator | 分隔符 `,`(此位不是参数值) | high | 0x3187a84 |
| 7 | ? | 未知 | low |  |
| 8 | string | 翻转/朝向(ConvertEffectFlipKind) | medium | 0x319258c |
*未决: pd7: 未找到消费点(仅有加载)*

### `charaEffectStart` (0x3188090, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31880b0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318810c |
| 2 | string | 特效名(Talk/<name> 或 ConvertNameString 名) | medium | 0x3188134 |

### `charaEffectStop` (0x317a4d0, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31880b0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317a55c |
| 2 | string | 特效名(Talk/<name> 或 ConvertNameString 名) | medium | 0x3188134 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317a55c |
| 4 | string | 颜色(名称或 #RRGGBB) | medium | 0x318d2b8 |

### `charaFace` (0x31847c0, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184810 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31847e8 |
| 2 | string | 表情(face)编号/名 | low |  |

### `charaFaceFade` (0x3183290, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x318330c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31832b8 |
| 2 | ? | 表情/立绘形态参数 | high | 0x3190bc4 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31832b8 |

### `charaFaceIcon` (0x3182e04, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3182e54 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3182e2c |
| 2 | ? | 表情图标编号 | low |  |
| 4 | int | 图标 X 坐标(SetPosition(float,float)) | high | 0x3182f14 |
| 6 | int | 图标 Y 坐标 | high | 0x3182f38 |

### `charaFadeSpeed` (0x3180e44, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3180ec0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3180e6c |
| 2 | ? | 淡入速度倍率/秒 | low |  |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3180e6c |
| 4 | ? | 附加参数(未消费时忽略) | low |  |

### `charaFadeTime` (0x3188580, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31885f4 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31885a8 |
| 2 | ? | 淡入(alpha)时间(秒) | low |  |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31885a8 |
| 4 | ? | 淡入后的等待时间(秒) | low | 0x318d2b8 |

### `charaFadeTimeLoop` (0x3182fa0, min_token=9)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x318c09c |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3182fe0 |
| 4 | ? | 循环淡出时间(秒) | low | 0x318d2b8 |
| 20 | string | 附加参数(超出常规布局,含义未证实) | low |  |

### `charaFadeTimeLoopStop` (0x31889d8, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31889f8 |

### `charaFadein` (0x3184fa4, min_token=3)  角色淡入(Handler 只读 pd0;位置/时长在共享尾块中解析)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184ff4 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3184fcc |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | medium | 0x3189790 |
| 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) | medium | 0x3190c1c / 0x31897f0 |
| 5 | separator | `','`=坐标形式 | medium | 0x31897cc |
| 6 | int | Y 坐标(坐标形式) | medium | 0x3189814 |

### `charaFadeinFSL` (0x3184fa4, min_token=3)  左全屏变体:位置额外叠加屏幕左边缘 X 偏移(GetFSCommandOffsetX 取负)(参数与 charaFadein 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184ff4 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3184fcc |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | medium | 0x3189790 |
| 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) | medium | 0x3190c1c / 0x31897f0 |
| 5 | separator | `','`=坐标形式 | medium | 0x31897cc |
| 6 | int | Y 坐标(坐标形式) | medium | 0x3189814 |

### `charaFadeinFSLNotNotch` (0x3184fa4, min_token=3)  同 FSL,但不做刘海/黑边规避(forceObi 路径关闭)(参数与 charaFadein 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184ff4 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3184fcc |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | medium | 0x3189790 |
| 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) | medium | 0x3190c1c / 0x31897f0 |
| 5 | separator | `','`=坐标形式 | medium | 0x31897cc |
| 6 | int | Y 坐标(坐标形式) | medium | 0x3189814 |

### `charaFadeinFSR` (0x3184fa4, min_token=3)  右全屏变体:叠加屏幕右边缘 X 偏移(取正)(参数与 charaFadein 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184ff4 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3184fcc |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | medium | 0x3189790 |
| 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) | medium | 0x3190c1c / 0x31897f0 |
| 5 | separator | `','`=坐标形式 | medium | 0x31897cc |
| 6 | int | Y 坐标(坐标形式) | medium | 0x3189814 |

### `charaFadeinFSRNotNotch` (0x3184fa4, min_token=3)  同 FSR,但不做刘海/黑边规避(参数与 charaFadein 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184ff4 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3184fcc |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | medium | 0x3189790 |
| 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) | medium | 0x3190c1c / 0x31897f0 |
| 5 | separator | `','`=坐标形式 | medium | 0x31897cc |
| 6 | int | Y 坐标(坐标形式) | medium | 0x3189814 |

### `charaFadeinFSSideL` (0x3184fa4, min_token=3)  全屏侧位左:叠加 FSSideL 偏移(比 FSL 更靠内,positionList[3]=-438)(参数与 charaFadein 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184ff4 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3184fcc |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | medium | 0x3189790 |
| 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) | medium | 0x3190c1c / 0x31897f0 |
| 5 | separator | `','`=坐标形式 | medium | 0x31897cc |
| 6 | int | Y 坐标(坐标形式) | medium | 0x3189814 |

### `charaFadeinFSSideR` (0x3184fa4, min_token=3)  全屏侧位右:叠加 FSSideR 偏移(positionList[5]=+438)(参数与 charaFadein 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184ff4 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3184fcc |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | medium | 0x3189790 |
| 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) | medium | 0x3190c1c / 0x31897f0 |
| 5 | separator | `','`=坐标形式 | medium | 0x31897cc |
| 6 | int | Y 坐标(坐标形式) | medium | 0x3189814 |

### `charaFadeout` (0x3187e50, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3187ea0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187e78 |

### `charaFilter` (0x3187830, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3187880 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187858 |
| 2 | string | 滤镜名(与颜色一起传入) | high | 0x31878f0 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187858 |
| 4 | string | 颜色名(black/white/#RRGGBB 等) | high | 0x318d2b8 |

### `charaLayer` (0x31829ec, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3182a0c |
| 2 | ? | 层类别:'sub'/'normal'(比较@0x3182a5c/0x318da00) | high | 0x3182a5c |
| 4 | ? | 子层 key(#A 等,ScriptSubLayerManager.RegistCharaData) | high | 0x3182ab8 |

### `charaMask` (0x3183f88, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3183fa8 |
| 2 | ? | 遮罩方向:'inside'/'outside'(比较@0x3183ff8/0x318da40) | high | 0x3183ff8 |

### `charaMove` (0x318505c, min_token=5)  角色移动到 x,y(或位置下标),可选时长;FSL/FSR 变体按屏幕边缘叠加 X 偏移

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31850ac |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3185084 |
| 2 | int | X 坐标(pd[3]==',' 时为直接坐标)或位置下标(pd[3]==' ') | high | 0x3185184 / 0x318e9d0(下标分支 GetPosition(int)) |
| 3 | separator | `','`=坐标形式;`' '`=下标形式 | high | 0x31850f4 / 0x318e960 |
| 4 | int | Y 坐标(pd[3]==',');或 <时长>(pd[3]==' ') | high | 0x31851a8 / 0x318e9ac |
| 5 | separator | 分隔符 `' '`(守卫时长) | high | 0x3185128 |
| 6 | float | 时长(秒;仅坐标形式且正常速度) | high | 0x3185160 |

### `charaMoveEase` (0x3183e08, min_token=9)  角色按缓动移动;pd[8]=ease 名

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3183e58 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3183e30 |
| 2 | int | X 坐标(与 pd[3]==',' 后的 y 组成直接坐标)(坐标形式) | high | 0x3183ec8 |
| 4 | int | Y 坐标 | high | 0x3183ef4 |
| 6 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x3183ea4 |
| 8 | string | 缓动类型(iTween ease 名)(ScriptCharaData.MovePositionEase 第 4 参) | high | 0x3183f58 |

### `charaMoveEaseFSL` (0x3183e08, min_token=9)  左全屏变体:位置额外叠加屏幕左边缘 X 偏移(GetFSCommandOffsetX 取负)(参数与 charaMoveEase 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3183e58 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3183e30 |
| 2 | int | X 坐标(与 pd[3]==',' 后的 y 组成直接坐标)(坐标形式) | high | 0x3183ec8 |
| 4 | int | Y 坐标 | high | 0x3183ef4 |
| 6 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x3183ea4 |
| 8 | string | 缓动类型(iTween ease 名)(ScriptCharaData.MovePositionEase 第 4 参) | high | 0x3183f58 |

### `charaMoveEaseFSR` (0x3183e08, min_token=9)  右全屏变体:叠加屏幕右边缘 X 偏移(取正)(参数与 charaMoveEase 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3183e58 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3183e30 |
| 2 | int | X 坐标(与 pd[3]==',' 后的 y 组成直接坐标)(坐标形式) | high | 0x3183ec8 |
| 4 | int | Y 坐标 | high | 0x3183ef4 |
| 6 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x3183ea4 |
| 8 | string | 缓动类型(iTween ease 名)(ScriptCharaData.MovePositionEase 第 4 参) | high | 0x3183f58 |

### `charaMoveEaseFSSideL` (0x3183e08, min_token=9)  全屏侧位左:叠加 FSSideL 偏移(比 FSL 更靠内,positionList[3]=-438)(参数与 charaMoveEase 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3183e58 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3183e30 |
| 2 | int | X 坐标(与 pd[3]==',' 后的 y 组成直接坐标)(坐标形式) | high | 0x3183ec8 |
| 4 | int | Y 坐标 | high | 0x3183ef4 |
| 6 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x3183ea4 |
| 8 | string | 缓动类型(iTween ease 名)(ScriptCharaData.MovePositionEase 第 4 参) | high | 0x3183f58 |

### `charaMoveEaseFSSideR` (0x3183e08, min_token=9)  全屏侧位右:叠加 FSSideR 偏移(positionList[5]=+438)(参数与 charaMoveEase 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3183e58 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3183e30 |
| 2 | int | X 坐标(与 pd[3]==',' 后的 y 组成直接坐标)(坐标形式) | high | 0x3183ec8 |
| 4 | int | Y 坐标 | high | 0x3183ef4 |
| 6 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x3183ea4 |
| 8 | string | 缓动类型(iTween ease 名)(ScriptCharaData.MovePositionEase 第 4 参) | high | 0x3183f58 |

### `charaMoveFSL` (0x318505c, min_token=5)  左全屏变体:位置额外叠加屏幕左边缘 X 偏移(GetFSCommandOffsetX 取负)(参数与 charaMove 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31850ac |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3185084 |
| 2 | int | X 坐标(pd[3]==',' 时为直接坐标)或位置下标(pd[3]==' ') | high | 0x3185184 / 0x318e9d0(下标分支 GetPosition(int)) |
| 3 | separator | `','`=坐标形式;`' '`=下标形式 | high | 0x31850f4 / 0x318e960 |
| 4 | int | Y 坐标(pd[3]==',');或 <时长>(pd[3]==' ') | high | 0x31851a8 / 0x318e9ac |
| 5 | separator | 分隔符 `' '`(守卫时长) | high | 0x3185128 |
| 6 | float | 时长(秒;仅坐标形式且正常速度) | high | 0x3185160 |

### `charaMoveFSR` (0x318505c, min_token=5)  右全屏变体:叠加屏幕右边缘 X 偏移(取正)(参数与 charaMove 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31850ac |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3185084 |
| 2 | int | X 坐标(pd[3]==',' 时为直接坐标)或位置下标(pd[3]==' ') | high | 0x3185184 / 0x318e9d0(下标分支 GetPosition(int)) |
| 3 | separator | `','`=坐标形式;`' '`=下标形式 | high | 0x31850f4 / 0x318e960 |
| 4 | int | Y 坐标(pd[3]==',');或 <时长>(pd[3]==' ') | high | 0x31851a8 / 0x318e9ac |
| 5 | separator | 分隔符 `' '`(守卫时长) | high | 0x3185128 |
| 6 | float | 时长(秒;仅坐标形式且正常速度) | high | 0x3185160 |

### `charaMoveFSSideL` (0x318505c, min_token=5)  全屏侧位左:叠加 FSSideL 偏移(比 FSL 更靠内,positionList[3]=-438)(参数与 charaMove 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31850ac |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3185084 |
| 2 | int | X 坐标(pd[3]==',' 时为直接坐标)或位置下标(pd[3]==' ') | high | 0x3185184 / 0x318e9d0(下标分支 GetPosition(int)) |
| 3 | separator | `','`=坐标形式;`' '`=下标形式 | high | 0x31850f4 / 0x318e960 |
| 4 | int | Y 坐标(pd[3]==',');或 <时长>(pd[3]==' ') | high | 0x31851a8 / 0x318e9ac |
| 5 | separator | 分隔符 `' '`(守卫时长) | high | 0x3185128 |
| 6 | float | 时长(秒;仅坐标形式且正常速度) | high | 0x3185160 |

### `charaMoveFSSideR` (0x318505c, min_token=5)  全屏侧位右:叠加 FSSideR 偏移(positionList[5]=+438)(参数与 charaMove 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31850ac |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3185084 |
| 2 | int | X 坐标(pd[3]==',' 时为直接坐标)或位置下标(pd[3]==' ') | high | 0x3185184 / 0x318e9d0(下标分支 GetPosition(int)) |
| 3 | separator | `','`=坐标形式;`' '`=下标形式 | high | 0x31850f4 / 0x318e960 |
| 4 | int | Y 坐标(pd[3]==',');或 <时长>(pd[3]==' ') | high | 0x31851a8 / 0x318e9ac |
| 5 | separator | 分隔符 `' '`(守卫时长) | high | 0x3185128 |
| 6 | float | 时长(秒;仅坐标形式且正常速度) | high | 0x3185160 |

### `charaMoveReturn` (0x3184c98, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184ce8 |
| 1 | separator | 分隔符 `' '` | high | 0x3184cc0 |
| 2 | int | X 或位置下标(回位后位置) | high | 0x3184d30 |
| 3 | separator | `','`=坐标形式 | high |  |
| 4 | int | Y 坐标(坐标形式)或时长(下标形式) | medium |  |
| 5 | string | 首字符必须为 ' '(格式校验) | high | 0x3184d64 |
| 6 | float | 时长(秒;坐标形式) | medium |  |

### `charaMoveReturnEase` (0x3181a58, min_token=7)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3181aa8 |
| 1 | separator | 分隔符 `' '` | high | 0x3181a80 |
| 2 | int | X 或位置下标 | medium | 0x3181aec |
| 3 | separator | `','`=坐标形式 | medium |  |
| 4 | int | Y 坐标(坐标形式)或时长(下标形式) | medium |  |
| 5 | string | 首字符必须为 ' '(格式校验) | high | 0x3181b20 |
| 6 | float | 时长(秒;坐标形式) | medium |  |
| 8 | string | 缓动类型(iTween ease 名)(MoveReturnPositionEase) | medium |  |
| 10 | string | 附加选项(与 'stretchOff' 等比较) | low |  |

### `charaMoveReturnEaseFSL` (0x3181a58, min_token=7)  左全屏变体:位置额外叠加屏幕左边缘 X 偏移(GetFSCommandOffsetX 取负)(参数与 charaMoveReturnEase 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3181aa8 |
| 1 | separator | 分隔符 `' '` | high | 0x3181a80 |
| 2 | int | X 或位置下标 | medium | 0x3181aec |
| 3 | separator | `','`=坐标形式 | medium |  |
| 4 | int | Y 坐标(坐标形式)或时长(下标形式) | medium |  |
| 5 | string | 首字符必须为 ' '(格式校验) | high | 0x3181b20 |
| 6 | float | 时长(秒;坐标形式) | medium |  |
| 8 | string | 缓动类型(iTween ease 名)(MoveReturnPositionEase) | medium |  |
| 10 | string | 附加选项(与 'stretchOff' 等比较) | low |  |

### `charaMoveReturnEaseFSR` (0x3181a58, min_token=7)  右全屏变体:叠加屏幕右边缘 X 偏移(取正)(参数与 charaMoveReturnEase 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3181aa8 |
| 1 | separator | 分隔符 `' '` | high | 0x3181a80 |
| 2 | int | X 或位置下标 | medium | 0x3181aec |
| 3 | separator | `','`=坐标形式 | medium |  |
| 4 | int | Y 坐标(坐标形式)或时长(下标形式) | medium |  |
| 5 | string | 首字符必须为 ' '(格式校验) | high | 0x3181b20 |
| 6 | float | 时长(秒;坐标形式) | medium |  |
| 8 | string | 缓动类型(iTween ease 名)(MoveReturnPositionEase) | medium |  |
| 10 | string | 附加选项(与 'stretchOff' 等比较) | low |  |

### `charaMoveReturnEaseFSSideL` (0x3181a58, min_token=7)  全屏侧位左:叠加 FSSideL 偏移(比 FSL 更靠内,positionList[3]=-438)(参数与 charaMoveReturnEase 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3181aa8 |
| 1 | separator | 分隔符 `' '` | high | 0x3181a80 |
| 2 | int | X 或位置下标 | medium | 0x3181aec |
| 3 | separator | `','`=坐标形式 | medium |  |
| 4 | int | Y 坐标(坐标形式)或时长(下标形式) | medium |  |
| 5 | string | 首字符必须为 ' '(格式校验) | high | 0x3181b20 |
| 6 | float | 时长(秒;坐标形式) | medium |  |
| 8 | string | 缓动类型(iTween ease 名)(MoveReturnPositionEase) | medium |  |
| 10 | string | 附加选项(与 'stretchOff' 等比较) | low |  |

### `charaMoveReturnEaseFSSideR` (0x3181a58, min_token=7)  全屏侧位右:叠加 FSSideR 偏移(positionList[5]=+438)(参数与 charaMoveReturnEase 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3181aa8 |
| 1 | separator | 分隔符 `' '` | high | 0x3181a80 |
| 2 | int | X 或位置下标 | medium | 0x3181aec |
| 3 | separator | `','`=坐标形式 | medium |  |
| 4 | int | Y 坐标(坐标形式)或时长(下标形式) | medium |  |
| 5 | string | 首字符必须为 ' '(格式校验) | high | 0x3181b20 |
| 6 | float | 时长(秒;坐标形式) | medium |  |
| 8 | string | 缓动类型(iTween ease 名)(MoveReturnPositionEase) | medium |  |
| 10 | string | 附加选项(与 'stretchOff' 等比较) | low |  |

### `charaMoveReturnFSL` (0x3184c98, min_token=5)  左全屏变体:位置额外叠加屏幕左边缘 X 偏移(GetFSCommandOffsetX 取负)(参数与 charaMoveReturn 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184ce8 |
| 1 | separator | 分隔符 `' '` | high | 0x3184cc0 |
| 2 | int | X 或位置下标(回位后位置) | high | 0x3184d30 |
| 3 | separator | `','`=坐标形式 | high |  |
| 4 | int | Y 坐标(坐标形式)或时长(下标形式) | medium |  |
| 5 | string | 首字符必须为 ' '(格式校验) | high | 0x3184d64 |
| 6 | float | 时长(秒;坐标形式) | medium |  |

### `charaMoveReturnFSR` (0x3184c98, min_token=5)  右全屏变体:叠加屏幕右边缘 X 偏移(取正)(参数与 charaMoveReturn 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184ce8 |
| 1 | separator | 分隔符 `' '` | high | 0x3184cc0 |
| 2 | int | X 或位置下标(回位后位置) | high | 0x3184d30 |
| 3 | separator | `','`=坐标形式 | high |  |
| 4 | int | Y 坐标(坐标形式)或时长(下标形式) | medium |  |
| 5 | string | 首字符必须为 ' '(格式校验) | high | 0x3184d64 |
| 6 | float | 时长(秒;坐标形式) | medium |  |

### `charaMoveReturnFSSideL` (0x3184c98, min_token=5)  全屏侧位左:叠加 FSSideL 偏移(比 FSL 更靠内,positionList[3]=-438)(参数与 charaMoveReturn 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184ce8 |
| 1 | separator | 分隔符 `' '` | high | 0x3184cc0 |
| 2 | int | X 或位置下标(回位后位置) | high | 0x3184d30 |
| 3 | separator | `','`=坐标形式 | high |  |
| 4 | int | Y 坐标(坐标形式)或时长(下标形式) | medium |  |
| 5 | string | 首字符必须为 ' '(格式校验) | high | 0x3184d64 |
| 6 | float | 时长(秒;坐标形式) | medium |  |

### `charaMoveReturnFSSideR` (0x3184c98, min_token=5)  全屏侧位右:叠加 FSSideR 偏移(positionList[5]=+438)(参数与 charaMoveReturn 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184ce8 |
| 1 | separator | 分隔符 `' '` | high | 0x3184cc0 |
| 2 | int | X 或位置下标(回位后位置) | high | 0x3184d30 |
| 3 | separator | `','`=坐标形式 | high |  |
| 4 | int | Y 坐标(坐标形式)或时长(下标形式) | medium |  |
| 5 | string | 首字符必须为 ' '(格式校验) | high | 0x3184d64 |
| 6 | float | 时长(秒;坐标形式) | medium |  |

### `charaMoveScale` (0x3182550, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31825cc |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3182578 |
| 2 | ? | 缩放值(倍率) | low |  |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3182578 |
| 4 | ? | 未知 | low |  |
*未决: pd4: 未找到消费点(仅有加载)*

### `charaMoveScaleEase` (0x318228c, min_token=7)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31822dc |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31822b4 |
| 2 | ? | 缩放值(倍率) | low |  |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31822b4 |
| 4 | string | 颜色(名称或 #RRGGBB) | medium | 0x318d2b8 |
| 6 | ? | 未知 | low |  |
*未决: pd6: 未找到消费点(仅有加载)*

### `charaPut` (0x3186e80, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3186ed0 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3186ea8 |
| 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 | high | 0x3186f08 |
| 3 | separator | `','` 时进入坐标形式 | high | 0x3186f18 |
| 4 | int | Y 坐标(仅 pd[3]==',' 时) | high | 0x3186f60 |

### `charaPutFSL` (0x3186e80, min_token=3)  左全屏变体:位置额外叠加屏幕左边缘 X 偏移(GetFSCommandOffsetX 取负)(参数与 charaPut 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3186ed0 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3186ea8 |
| 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 | high | 0x3186f08 |
| 3 | separator | `','` 时进入坐标形式 | high | 0x3186f18 |
| 4 | int | Y 坐标(仅 pd[3]==',' 时) | high | 0x3186f60 |

### `charaPutFSLNotNotch` (0x3186e80, min_token=3)  同 FSL,但不做刘海/黑边规避(forceObi 路径关闭)(参数与 charaPut 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3186ed0 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3186ea8 |
| 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 | high | 0x3186f08 |
| 3 | separator | `','` 时进入坐标形式 | high | 0x3186f18 |
| 4 | int | Y 坐标(仅 pd[3]==',' 时) | high | 0x3186f60 |

### `charaPutFSR` (0x3186e80, min_token=3)  右全屏变体:叠加屏幕右边缘 X 偏移(取正)(参数与 charaPut 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3186ed0 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3186ea8 |
| 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 | high | 0x3186f08 |
| 3 | separator | `','` 时进入坐标形式 | high | 0x3186f18 |
| 4 | int | Y 坐标(仅 pd[3]==',' 时) | high | 0x3186f60 |

### `charaPutFSRNotNotch` (0x3186e80, min_token=3)  同 FSR,但不做刘海/黑边规避(参数与 charaPut 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3186ed0 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3186ea8 |
| 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 | high | 0x3186f08 |
| 3 | separator | `','` 时进入坐标形式 | high | 0x3186f18 |
| 4 | int | Y 坐标(仅 pd[3]==',' 时) | high | 0x3186f60 |

### `charaPutFSSideL` (0x3186e80, min_token=3)  全屏侧位左:叠加 FSSideL 偏移(比 FSL 更靠内,positionList[3]=-438)(参数与 charaPut 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3186ed0 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3186ea8 |
| 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 | high | 0x3186f08 |
| 3 | separator | `','` 时进入坐标形式 | high | 0x3186f18 |
| 4 | int | Y 坐标(仅 pd[3]==',' 时) | high | 0x3186f60 |

### `charaPutFSSideR` (0x3186e80, min_token=3)  全屏侧位右:叠加 FSSideR 偏移(positionList[5]=+438)(参数与 charaPut 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3186ed0 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3186ea8 |
| 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 | high | 0x3186f08 |
| 3 | separator | `','` 时进入坐标形式 | high | 0x3186f18 |
| 4 | int | Y 坐标(仅 pd[3]==',' 时) | high | 0x3186f60 |

### `charaRelativeLoopMove` (0x3181190, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31811b0 |
| 2 | int | 循环段数(相对位移次数;长度=6*n+5) | high | 0x31811f0 / 0x3181210 |

### `charaRelativeLoopMoveEase` (0x31871c4, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31871e4 |
| 2 | int | 循环段数(相对位移次数;长度=6*n+5) | high | 0x31811f0 / 0x3181210 |

### `charaRelativeLoopMoveStop` (0x3181f68, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3181f88 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318d270 |
| 4 | string | 颜色(名称或 #RRGGBB) | medium | 0x318d2b8 |

### `charaRelativePut` (0x31817d0, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3186ed0 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3186ea8 |
| 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 | high | 0x3186f08 |
| 3 | separator | `','` 时进入坐标形式 | high | 0x3186f18 |
| 4 | int | Y 坐标(仅 pd[3]==',' 时) | high | 0x3186f60 |

### `charaReturn` (0x317a3ac, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317a3cc |
| 1 | string | 首字符必须为 ' '(格式校验) | high | 0x317a414 |
| 2 | ? | 未知 | low |  |
*未决: pd2: 未找到消费点(仅有加载)*

### `charaRoll` (0x31869d0, min_token=7)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31869f0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3186a54 |
| 2 | ? | 旋转角(度) | low |  |
| 4 | ? | 旋转角增量/轴参数 | low |  |
| 5 | string | 首字符必须为 ','(格式校验) | high | 0x3186aa4 |
| 6 | ? | 时长(秒;pd[5]==',' 时) | low |  |

### `charaRollAxis` (0x3179868, min_token=9)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3179888 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318cfac |
| 2 | string | 立绘/资源名 | high | 0x318d14c |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318cfac |
| 4 | string | 颜色(名称或 #RRGGBB) | medium | 0x318d2b8 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318cfac |
| 6 | ? | 未知 | low |  |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318cfac |
| 9 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318cfac |
*未决: pd6: 未找到消费点(仅有加载)*

### `charaRollAxisLoopStop` (0x3185968, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3185988 |

### `charaRollMove` (0x317f4ec, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317f53c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317f514 |
| 2 | ? | 旋转角(度) | low |  |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317f514 |
| 4 | ? | 时长(秒) | low |  |

### `charaRollMoveEx` (0x31836ac, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31836fc |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31836d4 |
| 2 | float | 时长(秒;Single.Parse) | high | 0x3183748 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31836d4 |
| 4 | string | 颜色(名称或 #RRGGBB) | medium | 0x318d2b8 |
| 6 | int | 目标 X 坐标(GetPosition(float,float)) | medium | 0x3183804 |
| 7 | string | 首字符必须为 ','(格式校验) | high | 0x31837e0 |
| 8 | int | 目标 Y 坐标 | medium | 0x3183828 |

### `charaScale` (0x31815a4, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31815f4 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31815cc |
| 2 | ? | 缩放值(倍率) | low |  |

### `charaSet` (0x3186fe0, min_token=3)  设置角色槽位的立绘(共享 handler 0x3186fe0;含位置/全屏缩放类型)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3187030 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3187008 |
| 2 | string | 立绘/图片资源名(ConvertNameString) | high | 0x31870ac |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | high | 0x31927c4 |
| 4 | int | 位置(pd[4]=下标 或 X 坐标);其后可选参数原样保留在 ScriptCharaData.afterParam(GetAfterParam) | high | 0x31929d0 |
| 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 | high | 0x31927fc |
| 6 | int | Y 坐标(仅 pd[5]==',' 时) | high | 0x3192844 |
| 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) | high | 0x3192884 |

### `charaShadow` (0x317e6dc, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317e72c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317e704 |
| 2 | ? | 布尔(true/false;与 'true' 比较@0x317e778) | high | 0x317e778 |

### `charaShake` (0x31859e8, min_token=9)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3185abc |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3185a10 |
| 2 | ? | 时长(秒) | low |  |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3185a10 |
| 4 | ? | 周期(秒) | low |  |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3185a10 |
| 6 | ? | X 振幅 | low |  |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3185a10 |
| 8 | ? | Y 振幅 | low |  |

### `charaShakeStop` (0x3184e68, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184e88 |

### `charaSpecialEffect` (0x3184b84, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184bd4 |
| 1 | separator | 分隔符 `' '` | high | 0x3184bac |
| 2 | string | 特效名(ConvertNameString) | high | 0x3184c1c |
| 3 | separator | 分隔符/占位(见 0x318d444 比较) | medium | 0x318d444 |
| 5 | separator | `','`=坐标形式(x,y) | medium | 0x318d474 |
| 7 | separator | 分隔符 | medium | 0x318d51c |
| 9 | separator | 分隔符(守卫 pd[10]=颜色) | medium | 0x318d568 |
| 10 | string | 颜色名(black/white/#RRGGBB 等) | medium | 0x318d590 |
| 11 | separator | 分隔符 | medium | 0x318d5c8 |

### `charaSpecialEffectPause` (0x3184b84, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184bd4 |
| 1 | separator | 分隔符 `' '` | high | 0x3184bac |
| 2 | string | 特效名(ConvertNameString) | high | 0x3184c1c |
| 3 | separator | 分隔符/占位(见 0x318d444 比较) | medium | 0x318d444 |
| 5 | separator | `','`=坐标形式(x,y) | medium | 0x318d474 |
| 7 | separator | 分隔符 | medium | 0x318d51c |
| 9 | separator | 分隔符(守卫 pd[10]=颜色) | medium | 0x318d568 |
| 10 | string | 颜色名(black/white/#RRGGBB 等) | medium | 0x318d590 |
| 11 | separator | 分隔符 | medium | 0x318d5c8 |

### `charaSpecialEffectStart` (0x3186754, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31880b0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31867c0 |
| 2 | string | 特效名(Talk/<name> 或 ConvertNameString 名) | medium | 0x3188134 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31867c0 |
| 4 | string | 颜色(名称或 #RRGGBB) | medium | 0x318d2b8 |

### `charaSpecialEffectStop` (0x318198c, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31880b0 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31819f8 |
| 2 | string | 特效名(Talk/<name> 或 ConvertNameString 名) | medium | 0x3188134 |

### `charaTalk` (0x3184a00, min_token=None)  标记当前说话角色(ConvertCharaIndexTalk→SetTalkIndex,决定消息窗位置;无脚本参数)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | ? | 说话人槽位(ConvertCharaIndexTalk→SetTalkIndex) | high | 0x3189bbc |


## image* 画面图片

### `horizontalImageChange` (0x31884b4, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31884d4 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3189038 |
| 2 | string | 立绘/图片名(ConvertNameString) | high | 0x3189100 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3189038 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3189038 |

### `horizontalImageSet` (0x3186fe0, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3187030 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3187008 |
| 2 | string | 立绘/图片资源名(ConvertNameString) | high | 0x31870ac |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | high | 0x31927c4 |
| 4 | int | 位置:单值=位置下标;若 pd[5]==',' 则本值为 X 坐标 | high | 0x3192820/0x31928f8 |
| 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 | high | 0x31927fc |
| 6 | int | Y 坐标(仅 pd[5]==',' 时) | high | 0x3192844 |
| 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) | high | 0x3192884 |

### `imageChange` (0x31884b4, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31884d4 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3189038 |
| 2 | string | 立绘/图片名(ConvertNameString) | high | 0x3189100 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3189038 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3189038 |

### `imageSet` (0x3186fe0, min_token=3)  同 charaSet 一套代码,用于画面图片(imageSet 额外支持 pd[8] 全屏缩放类型)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3187030 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3187008 |
| 2 | string | 立绘/图片资源名(ConvertNameString) | high | 0x31870ac |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | high | 0x31927c4 |
| 4 | int | 位置:单值=位置下标;若 pd[5]==',' 则本值为 X 坐标 | high | 0x3192820/0x31928f8 |
| 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 | high | 0x31927fc |
| 6 | int | Y 坐标(仅 pd[5]==',' 时) | high | 0x3192844 |
| 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) | high | 0x3192884 |

### `verticalImageChange` (0x31884b4, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31884d4 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3189038 |
| 2 | string | 立绘/图片名(ConvertNameString) | high | 0x3189100 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3189038 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3189038 |

### `verticalImageSet` (0x3186fe0, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3187030 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3187008 |
| 2 | string | 立绘/图片资源名(ConvertNameString) | high | 0x31870ac |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | high | 0x31927c4 |
| 4 | int | 位置:单值=位置下标;若 pd[5]==',' 则本值为 X 坐标 | high | 0x3192820/0x31928f8 |
| 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 | high | 0x31927fc |
| 6 | int | Y 坐标(仅 pd[5]==',' 时) | high | 0x3192844 |
| 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) | high | 0x3192884 |


## master* (主人公立绘)

### `masterBranch` (0x3179bb8, min_token=3)  主人公立绘分支显示(名称/颜色/画框)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 名称(ConvertNameString) | high | 0x318dfec |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3179be0 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3179be0 |
| 4 | string | 颜色名(black/white/#RRGGBB 等) | high | 0x318d2b8 |
| 8 | string | 画框图片名(ConvertPictureFrameImageName) | high | 0x31919fc |

### `masterChange` (0x3187c1c, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3187c3c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318cfac |
| 2 | string | 立绘/资源名 | high | 0x318d14c |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318cfac |
| 4 | string | 颜色名(black/white/#RRGGBB 等) | high | 0x318d2b8 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318cfac |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318cfac |
| 9 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318cfac |

### `masterHorizontalImageChange` (0x317fe24, min_token=9)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317fe44 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317fea4 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317fea4 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317fea4 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317fea4 |

### `masterHorizontalImageSet` (0x3188708, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3188784 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3188730 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3188730 |

### `masterImageChange` (0x317fe24, min_token=9)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317fe44 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317fea4 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317fea4 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317fea4 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317fea4 |

### `masterImageSet` (0x3188708, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3188784 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3188730 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3188730 |

### `masterNameWidth` (0x3185be0, min_token=7)  主人公名字宽度调整(标签字号/画框)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 替换字符串/名字键(ScriptReplaceString.GetString) | medium |  |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3185c08 |
| 2 | string | 名字文本 | low |  |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3185c08 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3185c08 |
| 6 | string | 翻转/朝向(H/V/F/其他) | medium | 0x319002c |
| 8 | string | 画框图片名(ConvertPictureFrameImageName) | high | 0x31919fc |

### `masterScene` (0x3180a34, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 颜色/遮罩名(StartFadeMove) | high | 0x318a76c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318a4d0 |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x318a76c |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318a4d0 |
| 4 | float | 透明度/强度(0-1) | high | 0x318a76c |

### `masterSet` (0x3188708, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3188784 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3188730 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3188730 |

### `masterVerticalImageChange` (0x317fe24, min_token=9)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317fe44 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317fea4 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317fea4 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317fea4 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317fea4 |

### `masterVerticalImageSet` (0x3188708, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3188784 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3188730 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3188730 |


## 场景/画面

### `bScene` (0x317c59c, min_token=None)  加载 B 场景(背景)?资源名+颜色(共享 0x318af2c 尾块)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 背景资源名(ConvertNameString→B 场景加载) | high | 0x318af2c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318ae90 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318ae90 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318ae90 |
| 6 | string | 颜色 1(ConvertColor) | high | 0x318af80 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318ae90 |
| 8 | string | 颜色 2(ConvertColor) | high | 0x318afb4 |

### `faceTalkScreen` (0x317cd60, min_token=None)  把消息窗口背景切成头像对话样式(AtlasManager.SetWarBoardImage;无参数)
无参数(handler 体内不读 `pd[]`)。
### `scene` (0x3180e14, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 颜色/遮罩名(StartFadeMove) | high | 0x318a76c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318a5b8 |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x318a76c |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318a5b8 |
| 4 | float | 透明度/强度(0-1) | high | 0x318a76c |

### `sceneSet` (0x3186fe0, min_token=3)  同 charaSet 一套代码,用于场景背景

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3187030 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3187008 |
| 2 | string | 立绘/图片资源名(ConvertNameString) | high | 0x31870ac |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | high | 0x31927c4 |
| 4 | int | 位置:单值=位置下标;若 pd[5]==',' 则本值为 X 坐标 | high | 0x3192820/0x31928f8 |
| 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 | high | 0x31927fc |
| 6 | int | Y 坐标(仅 pd[5]==',' 时) | high | 0x3192844 |
| 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) | high | 0x3192884 |

### `screen` (0x31804c8, min_token=9)  切换消息窗/屏幕样式(SetScreen;子层 key + 参数,细节未全证)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等;SetScreen) | high | 0x31806d8 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31804f0 |
| 2 | string | 屏幕/消息窗参数(SetScreen) | low |  |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31804f0 |
| 4 | string | 屏幕/消息窗参数 | low |  |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31804f0 |
| 6 | string | 屏幕/消息窗参数 | low |  |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31804f0 |
| 8 | string | 屏幕/消息窗参数 | low |  |

### `warBoardTalkScreen` (0x317cd60, min_token=None)  同 faceTalkScreen(共享 handler 0x317cd60)
无参数(handler 体内不读 `pd[]`)。

## figure/equip/pictureFrame

### `equipChange` (0x31884b4, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x31884d4 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3189038 |
| 2 | string | 装备图片名(ConvertNameString) | high | 0x3189100 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3189038 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3189038 |

### `equipSet` (0x3186fe0, min_token=3)  同 charaSet 一套代码;pd[2] 为从者ID(会查 master 的 maleImageId 等)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3187030 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3187008 |
| 2 | string | 从者ID(数字串;经 TryParse→master→maleImageId/默认形象解析成 C 编号立绘) | high | 0x31870e4 |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | high | 0x31927c4 |
| 4 | int | 位置:单值=位置下标;若 pd[5]==',' 则本值为 X 坐标 | high | 0x3192820/0x31928f8 |
| 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 | high | 0x31927fc |
| 6 | int | Y 坐标(仅 pd[5]==',' 时) | high | 0x3192844 |
| 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) | high | 0x3192884 |

### `figureChange` (0x317ec9c, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317ecbc |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ed20 |
| 2 | string | 新立绘名+形态(GetCharaImageNameAndFormId) | high | 0x317ee34 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ed20 |
| 4 | string | 附加名称 | high | 0x3193270 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ed20 |
| 6 | string | 颜色名(black/white/#RRGGBB 等) | high | 0x3193374 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ed20 |
| 8 | string | 颜色名(black/white/#RRGGBB 等) | high | 0x31933a8 |

### `figureSet` (0x3186fe0, min_token=3)  同 charaSet 一套代码,用于立绘(Figure)对象

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3187030 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3187008 |
| 2 | string | 立绘/图片资源名(ConvertNameString) | high | 0x31870ac |
| 3 | separator | 分隔符 `' '`(守卫位置参数) | high | 0x31927c4 |
| 4 | int | 位置:单值=位置下标;若 pd[5]==',' 则本值为 X 坐标 | high | 0x3192820/0x31928f8 |
| 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 | high | 0x31927fc |
| 6 | int | Y 坐标(仅 pd[5]==',' 时) | high | 0x3192844 |
| 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) | high | 0x3192884 |

### `pictureFrame` (0x317e838, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 画框图片名/参数 | low | 0x31894b0 |
| 2 | string | 传给 SetFontSize() 的参数 `verticalAlign` | medium | 0x31894b0 |

### `pictureFrameTop` (0x317e838, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 画框图片名/参数 | low | 0x31894b0 |
| 2 | string | 传给 SetFontSize() 的参数 `verticalAlign` | medium | 0x31894b0 |


## camera* 主相机

### `backCameraColor` (0x317cb6c, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 'false'=关闭(相机 clearFlags=SolidColor=3);其他=颜色 | high | 0x317cb94 |

### `cameraFilter` (0x3181d38, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 滤镜名(SetCameraFilter) | medium | 0x318d3a4 |

### `cameraHome` (0x3188800, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | float | 归位时长(秒);0=立即 | medium | 0x318f980 |

### `cameraMove` (0x318683c, min_token=3)  主相机平移/缩放:dur x,y [scale];坐标为相机局部坐标

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x3186894 |
| 1 | separator | 分隔符 `' '`(必须) | high | 0x3186864 |
| 2 | int | X 坐标(摄像机局部坐标) | high | 0x31868f4 |
| 3 | separator | `','`(必须) | high | 0x31868d0 |
| 4 | int | Y 坐标 | high | 0x3186918 |
| 5 | separator | 分隔符 `' '`(守卫缩放) | high | 0x3186988 |

### `cameraMoveEase` (0x317a648, min_token=7)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | float | X 坐标 | high | 0x317a788 |
| 1 | separator | `','`(0x317a670 处比较) | high | 0x317a670 |
| 2 | float | Y 坐标 | high | 0x317a788 |
| 4 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x317a788 |
| 6 | string | 缓动类型(iTween ease 名) | high | 0x317a788 |
| 8 | float | 缩放(scale) | high | 0x317a788 |

### `cameraRoll` (0x3188238, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | float | 旋转角(度) | high | 0x318836c |
| 1 | separator | 分隔符 `' '` | high | 0x31882cc |
| 2 | float | 旋转中心 X 偏移 | high | 0x318836c |
| 3 | separator | `','`(中心偏移为坐标形式) | high | 0x3188294 |
| 4 | float | 旋转中心 Y 偏移 | high | 0x318836c |

### `cameraRollMove` (0x317dddc, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x318b458 |
| 1 | separator | 分隔符 `' '` | high | 0x317de50 |
| 2 | float | 旋转角(度) | high | 0x318b458 |


## 转场:淡入淡出/划像/遮罩/闪光/黑边/翻页

### `endFade` (0x31843b4, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 'clear'=清除淡出状态(与 'clear' 比较;否则按其他值处理) | high | 0x31843e0 |

### `fadeMove` (0x3181ef0, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 颜色名(black/white/#RRGGBB 等) | high | 0x318a76c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318a6a4 |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x318a76c |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318a6a4 |
| 4 | float | 透明度/强度(0-1)(目标强度) | high | 0x318a76c |

### `fadeOff` (0x3184b58, min_token=None)  取消淡入淡出(调 ScriptManager.InitFade;无参数)
无参数(handler 体内不读 `pd[]`)。
### `fadein` (0x3180b14, min_token=None)  全屏淡入(StartFade(name, isIn=tag=='fadein', duration, withFrameOption))

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 颜色/遮罩名(black/white/#RRGGBB) | high | 0x318d878 |
| 4 | string | 附带选项(StartFade 第 4 参 withFrameOption) | high | 0x318996c |

### `fadeout` (0x3180b14, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 颜色/遮罩名(black/white/#RRGGBB) | high | 0x318d878 |
| 4 | string | 附带选项(StartFade 第 4 参 withFrameOption) | high | 0x318996c |

### `flashOff` (0x317d868, min_token=None)  关闭闪光(调 ScriptManager.InitFlashCommand;无参数)
无参数(handler 体内不读 `pd[]`)。
### `flashOffDep` (0x317c600, min_token=None)  关闭 Dep 闪光(调 InitFlashDepCommand;无参数)
无参数(handler 体内不读 `pd[]`)。
### `flashin` (0x317df1c, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 闪光名(Flash/<name>) | high | 0x318af2c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318ae90 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318ae90 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318ae90 |
| 6 | string | 起始颜色(ConvertColor) | medium | 0x318af80 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318ae90 |
| 8 | string | 结束颜色(ConvertColor) | medium | 0x318afb4 |

### `flashinDep` (0x3187f10, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 闪光名(Flash/<name>) | high | 0x318ae0c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318ad60 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318ad60 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318ad60 |
| 6 | string | 起始颜色(ConvertColor) | medium | 0x318af80 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318ad60 |
| 8 | string | 结束颜色(ConvertColor) | medium | 0x318afb4 |
| 10 | string | 叠加角色槽位(ConvertCharaIndex) | low | 0x318ae34 |

### `flashout` (0x31809bc, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | float | 后段时长(秒;EndFlash) | high | 0x3180a0c |

### `flashoutDep` (0x3185ef0, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | float | 后段时长(秒;EndFlash) | high | 0x3180a0c |

### `maskOff` (0x3183208, min_token=None)  关闭遮罩(调 ScriptManager.InitMask;无参数)
无参数(handler 体内不读 `pd[]`)。
### `maskin` (0x3188484, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 遮罩名(ConvertNameString→StartMask.name) | high | 0x318920c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31891c0 |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x3189244 |

### `maskout` (0x3188484, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 遮罩名(ConvertNameString→StartMask.name) | high | 0x318920c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31891c0 |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x3189244 |

### `overlayFadein` (0x3184300, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3184350 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3184328 |
| 3 | ? | 未知 | low |  |
| 5 | string | 首字符必须为 ','(格式校验) | high | 0x318f544 |
*未决: pd3: 未找到消费点(仅有加载)*

### `stretchOff` (0x3181c60, min_token=None)  关闭黑边/拉伸(调 ScriptManager.InitStretch;无参数)
无参数(handler 体内不读 `pd[]`)。
### `stretchin` (0x3187cbc, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 方向名(StartStretch.name) | high | 0x3189380 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318929c |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x3189380 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318929c |
| 4 | float | 拉伸量(scale) | high | 0x3189380 |

### `stretchout` (0x3187cbc, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 方向名(StartStretch.name) | high | 0x3189380 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318929c |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x3189380 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318929c |
| 4 | float | 拉伸量(scale) | high | 0x3189380 |

### `turnPageOff` (0x3182720, min_token=None)  禁止消息翻页(SetForcedDisableTurnPage;pd4 颜色)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 4 | string | 颜色(ConvertColor) | low | 0x318d2b8 |

### `turnPageOn` (0x317d4e8, min_token=1)  允许消息翻页(SetForcedDisableTurnPage;参数与 'f' 比较,语义未确证)
无参数(handler 体内不读 `pd[]`)。
### `wipeFilter` (0x3185814, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 划像名(SetWipeFilter.name) | high | 0x3185928 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3185858 |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x3185928 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3185858 |
| 4 | float | 透明度/强度(0-1)(level) | high | 0x3185928 |
| 6 | string | 翻转/朝向(H/V/F/其他) | medium | 0x318f054 |

### `wipeFilterEx` (0x317bee0, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 划像名(SetWipeFilter.name) | high | 0x3185928 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317bf18 |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x3185928 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317bf18 |
| 4 | float | 透明度/强度(0-1)(level) | high | 0x3185928 |
| 6 | float | 传给 SetWipeFilter() 的参数 `cvcenter` | high | 0x317c06c |
| 8 | float | 传给 SetWipeFilter() 的参数 `cvcentersize` | high | 0x317c06c |
| 10 | float | 传给 SetWipeFilter() 的参数 `cvleft` | high | 0x317c06c |
| 12 | float | 传给 SetWipeFilter() 的参数 `cvright` | high | 0x317c06c |

### `wipeOff` (0x3184940, min_token=None)  取消划像(调 ScriptManager.InitWipe;无参数)
无参数(handler 体内不读 `pd[]`)。
### `wipein` (0x317e910, min_token=5)  划像入场(wipein/wipeout 共用;方向由 tag 决定)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 划像名(Wipe/<name>) | high | 0x317e9bc |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317e970 |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x317ea64 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317e970 |
| 4 | float | 透明度/强度(0-1)(划像强度 level) | high | 0x317ea64 |

### `wipeinEx` (0x318402c, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 划像名(Wipe/<name>) | high | 0x31840b8 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3184064 |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high |  |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3184064 |
| 4 | float | 透明度/强度(0-1)(level) | medium | 0x318d2b8 |
| 6 | float | cvcenter(扩展划像参数) | medium |  |
| 8 | float | cvcentersize | medium |  |
| 10 | float | cvleft | medium |  |
| 12 | float | cvright | medium |  |

### `wipeout` (0x317e910, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 划像名(Wipe/<name>) | high | 0x317e9bc |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317e970 |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x317ea64 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317e970 |
| 4 | float | 透明度/强度(0-1)(划像强度 level) | high | 0x317ea64 |

### `wipeoutEx` (0x318402c, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 划像名(Wipe/<name>) | high | 0x31840b8 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3184064 |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high |  |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3184064 |
| 4 | float | 透明度/强度(0-1)(level) | medium | 0x318d2b8 |
| 6 | float | cvcenter(扩展划像参数) | medium |  |
| 8 | float | cvcentersize | medium |  |
| 10 | float | cvleft | medium |  |
| 12 | float | cvright | medium |  |


## 特效 effect* 系列

### `backEffect` (0x317c3c0, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x317c3e0 |
| 1 | separator | 分隔符 `' '` | high | 0x317c45c |
| 3 | separator | `','`(坐标形式) | high | 0x317c490 |
| 5 | separator | 分隔符 `' '`(守卫 pd[6]=翻转/朝向) | medium |  |
| 6 | string | 翻转/朝向(ConvertEffectFlipKind) | medium | 0x318f054 |

### `backEffectDestroy` (0x3184ad0, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x3184298 |

### `backEffectPause` (0x317c3c0, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x317c3e0 |
| 1 | separator | 分隔符 `' '` | high | 0x317c45c |
| 3 | separator | `','`(坐标形式) | high | 0x317c490 |
| 5 | separator | 分隔符 `' '`(守卫 pd[6]=翻转/朝向) | medium |  |
| 6 | string | 翻转/朝向(ConvertEffectFlipKind) | medium | 0x318f054 |

### `backEffectStart` (0x3182470, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x3184298 |

### `backEffectStop` (0x317ebac, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x3184298 |

### `blur` (0x3181f20, min_token=2)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 目标(与 'lens' 相关:镜头模糊) | low |  |

### `blurOff` (0x3187994, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 目标名('lens'=镜头模糊) | high | 0x31879c8 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31879c8 |
| 2 | float | 时长(秒;Single.Parse@0x31879f0) | high | 0x31879f0 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31879c8 |
| 4 | string | 颜色(名称或 #RRGGBB) | medium | 0x318d2b8 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31879c8 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31879c8 |
| 9 | separator | 分隔符 ` `(此位不是参数值) | high | 0x31879c8 |

### `distortionloop` (0x317f1e0, min_token=9)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | float | 滤镜参数 1(SetCameraFilter.paramsFloat 数组的首值) | low |  |
| 2 | float | 滤镜参数 2 | low |  |
| 4 | float | 滤镜参数 3 | low |  |
| 6 | float | 滤镜参数 4 | low |  |
| 8 | float | 滤镜参数 5 | low |  |
| 10 | float | 滤镜参数 6 | low |  |
| 12 | float | 滤镜参数 7(SetCameraFilter.paramsFloat) | medium | 0x317b238 |

### `distortionstart` (0x317b128, min_token=9)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | float | 滤镜参数 1(SetCameraFilter.paramsFloat 数组的首值) | low |  |
| 2 | float | 滤镜参数 2 | low |  |
| 4 | float | 滤镜参数 3 | low |  |
| 6 | float | 滤镜参数 4 | low |  |
| 8 | float | 滤镜参数 5 | low |  |
| 10 | float | 滤镜参数 6 | low | 0x317b238 |

### `distortionstop` (0x317b7ec, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | ? | 未知 | low |  |
*未决: pd0: 未找到消费点(仅有加载)*

### `effect` (0x3180b70, min_token=1)  播放特效(CreateParam:effectName/x/y/flip/…)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x3180b90 |
| 1 | separator | 分隔符 `' '` | high | 0x3180c94 |
| 3 | separator | `','`(坐标形式) | high | 0x3180cc8 |
| 5 | separator | 分隔符 `' '`(守卫 pd[6]=翻转/朝向) | medium |  |
| 6 | string | 翻转/朝向 H/V/F(ConvertEffectFlipKind) | high | 0x319002c |
| 10 | string | 画框图片(ConvertPictureFrameImageName) | medium | 0x3190240 |

### `effectDestroy` (0x3184278, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x3184298 |

### `effectForceStop` (0x3184508, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x3184298 |

### `effectPause` (0x3180b70, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x3180b90 |
| 1 | separator | 分隔符 `' '` | high | 0x3180c94 |
| 3 | separator | `','`(坐标形式) | high | 0x3180cc8 |
| 5 | separator | 分隔符 `' '`(守卫 pd[6]=翻转/朝向) | medium |  |
| 6 | string | 翻转/朝向 H/V/F(ConvertEffectFlipKind) | high | 0x319002c |
| 10 | string | 画框图片(ConvertPictureFrameImageName) | medium | 0x3190240 |

### `effectStart` (0x317cca8, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x3184298 |

### `effectStop` (0x31821f8, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x3184298 |

### `effectmessageDestroy` (0x3181ce4, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 信息窗特效名(MessageEffectStop) | high | 0x31814e4 |

### `effectmessageStop` (0x31814c4, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 信息窗特效名(MessageEffectStop) | high | 0x31814e4 |

### `fowardEffect` (0x318087c, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x318089c |
| 1 | separator | 分隔符 `' '` | high | 0x3180928 |
| 3 | separator | `','`(坐标形式) | high | 0x318095c |
| 5 | separator | 分隔符 `' '`(守卫 pd[6]=翻转/朝向) | medium |  |
| 6 | string | 翻转/朝向(ConvertEffectFlipKind) | medium | 0x318f4e8 |
| 27 | string | 附加参数(超出常规布局,含义未证实) | low |  |

### `fowardEffectDestroy` (0x317db6c, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x3184298 |

### `fowardEffectPause` (0x318087c, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x318089c |
| 1 | separator | 分隔符 `' '` | high | 0x3180928 |
| 3 | separator | `','`(坐标形式) | high | 0x318095c |
| 5 | separator | 分隔符 `' '`(守卫 pd[6]=翻转/朝向) | medium |  |
| 6 | string | 翻转/朝向(ConvertEffectFlipKind) | medium | 0x318f4e8 |
| 27 | string | 附加参数(超出常规布局,含义未证实) | low |  |

### `fowardEffectStart` (0x318140c, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x3184298 |

### `fowardEffectStop` (0x318496c, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(Talk/<name>) | high | 0x3184298 |

### `specialEffect` (0x3187604, min_token=9)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(ConvertNameString→CreateMainEffect) | high | 0x3187624 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187668 |
| 2 | int | X 坐标(位置) | low |  |
| 3 | separator | 分隔符 `,`(此位不是参数值) | high | 0x3187668 |
| 4 | int | Y 坐标(CreateMainEffect.pos) | high | 0x3188e54 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187668 |
| 6 | string | 朝向/翻转(ConvertEffectFlipKind)或时长(time) | high | 0x318f4e8 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187668 |
| 8 | string | 颜色名(black/white/#RRGGBB 等) | high | 0x31877b8 |
| 9 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187668 |
| 10 | string | 画框图片名(ConvertPictureFrameImageName) | high | 0x3190240 |

### `specialEffectPuase` (0x3187604, min_token=9)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 资源/立绘名 | high | 0x3187624 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187668 |
| 2 | ? | 未知 | low |  |
| 3 | separator | 分隔符 `,`(此位不是参数值) | high | 0x3187668 |
| 4 | Vector3 | 传给 CreateMainEffect() 的参数 `pos.hfa` | medium | 0x3188e54 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187668 |
| 6 | string | 翻转/朝向(H/V/F/其他) | medium | 0x318f4e8 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187668 |
| 8 | string | 颜色(名称或 #RRGGBB) | high | 0x31877b8 |
| 9 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3187668 |
| 10 | string | 画框图片(Image/<name>) | medium | 0x3190240 |
*未决: pd2: 未找到消费点(仅有加载)*

### `specialEffectStart` (0x318290c, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(ConvertNameString→Resume) | high | 0x318292c |

### `specialEffectStop` (0x317c6d8, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 特效名(ConvertNameString) | high | 0x317c6f8 |

### `spriteMaskOff` (0x3187440, min_token=None)  关闭精灵遮罩(SpriteMask.sprite=null + SetActive(false);无参数)
无参数(handler 体内不读 `pd[]`)。
### `spriteMaskSet` (0x3179ff0, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 精灵遮罩名(Image/mask_<name>) | high | 0x317a03c |
| 4 | string | 颜色(ConvertColor) | high | 0x318d2b8 |

### `subBlur` (0x3180674, min_token=6)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x31806d8 |
| 2 | string | 方向名(StartSubStretch.name) | medium | 0x318ceb4 |
| 4 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | medium | 0x318ceb4 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318cc58 |
| 6 | float | 拉伸/虚化强度(scale) | medium | 0x318ceb4 |

### `subBlur2` (0x3180674, min_token=6)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x31806d8 |
| 2 | string | 方向名(StartSubStretch.name) | medium | 0x318ceb4 |
| 4 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | medium | 0x318ceb4 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318cc58 |
| 6 | float | 拉伸/虚化强度(scale) | medium | 0x318ceb4 |

### `subBlur2Off` (0x3183a9c, min_token=7)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3183afc |
| 2 | string | 背景纹理名(Back/<name>) | medium | 0x318bb6c |
| 4 | ? | 未知 | low |  |
| 6 | ? | 未知 | low |  |
*未决: pd4: 未找到消费点(仅有加载)*
*未决: pd6: 未找到消费点(仅有加载)*

### `subBlurOff` (0x3183a9c, min_token=7)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3183afc |
| 2 | string | 背景纹理名(Back/<name>) | medium | 0x318bb6c |
| 4 | ? | 未知 | low |  |
| 6 | ? | 未知 | low |  |
*未决: pd4: 未找到消费点(仅有加载)*
*未决: pd6: 未找到消费点(仅有加载)*


## 子层 subCamera*/subRender*/subStretch*

### `subCameraFilter` (0x3183234, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | medium | 0x3189ab0 |

### `subCameraHome` (0x317dac0, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x317dae4 |

### `subCameraMove` (0x3182c6c, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x318f878 |
| 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x318f8a4 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3182c94 |
| 4 | float | X 坐标 | high | 0x318f8a4 |
| 5 | string | 首字符必须为 ','(格式校验) | high | 0x3182d04 |
| 6 | float | Y 坐标 | high | 0x318f8a4 |
| 7 | string | 首字符必须为 ' '(格式校验) | high | 0x3182dbc |

### `subCameraMoveEase` (0x3185430, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | float | X 坐标 | high | 0x317a788 |

### `subCameraOff` (0x3179750, min_token=None)  关闭子相机渲染(调 RenderCameraSubQuit;无参数)
无参数(handler 体内不读 `pd[]`)。
### `subCameraOn` (0x318339c, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | int | 子层数量/索引(RenderCameraSubStart.subLayerCount) | medium | 0x318b128 |

### `subCameraRoll` (0x317a2e0, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | float | 旋转角(度) | high | 0x318836c |
| 2 | float | 旋转中心 X 偏移 | high | 0x318836c |
| 3 | separator | `','`(中心偏移为坐标形式) | high | 0x3188294 |
| 4 | float | 旋转中心 Y 偏移 | high | 0x318836c |
| 5 | string | 首字符必须为 ','(格式校验) | high | 0x318b91c |
| 6 | Vector3 | 传给 SetCameraRoll() 的参数 `centerOffset.hfa` | medium | 0x318ba00 |

### `subCameraRollMove` (0x3179e0c, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x318b458 |
| 2 | float | 旋转角(度) | high | 0x318b458 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x318b884 |
| 4 | float | 旋转角(度) | medium | 0x318b8cc |

### `subRenderDepth` (0x3182c14, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3182c48 |
| 2 | float | 深度值(ScriptSubLayer.SetDepth) | high | 0x3182c48 |

### `subRenderFadein` (0x3185f64, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3185fd0 |

### `subRenderFadeinFSL` (0x3185f64, min_token=None)  左全屏变体:位置额外叠加屏幕左边缘 X 偏移(GetFSCommandOffsetX 取负)(参数与 subRenderFadein 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3185fd0 |

### `subRenderFadeinFSR` (0x3185f64, min_token=None)  右全屏变体:叠加屏幕右边缘 X 偏移(取正)(参数与 subRenderFadein 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3185fd0 |

### `subRenderFadeinFSSideL` (0x3185f64, min_token=None)  全屏侧位左:叠加 FSSideL 偏移(比 FSL 更靠内,positionList[3]=-438)(参数与 subRenderFadein 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3185fd0 |

### `subRenderFadeinFSSideR` (0x3185f64, min_token=None)  全屏侧位右:叠加 FSSideR 偏移(positionList[5]=+438)(参数与 subRenderFadein 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3185fd0 |

### `subRenderFadeout` (0x317d310, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层名(#A 等) | medium | 0x3189f84 |

### `subRenderMove` (0x3180f80, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3180fec |

### `subRenderMoveEase` (0x3186c5c, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层名(#A 等) | high | 0x3186cc8 |

### `subRenderMoveEaseFSL` (0x3186c5c, min_token=None)  左全屏变体:位置额外叠加屏幕左边缘 X 偏移(GetFSCommandOffsetX 取负)(参数与 subRenderMoveEase 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层名(#A 等) | high | 0x3186cc8 |

### `subRenderMoveEaseFSR` (0x3186c5c, min_token=None)  右全屏变体:叠加屏幕右边缘 X 偏移(取正)(参数与 subRenderMoveEase 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层名(#A 等) | high | 0x3186cc8 |

### `subRenderMoveEaseFSSideL` (0x3186c5c, min_token=None)  全屏侧位左:叠加 FSSideL 偏移(比 FSL 更靠内,positionList[3]=-438)(参数与 subRenderMoveEase 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层名(#A 等) | high | 0x3186cc8 |

### `subRenderMoveEaseFSSideR` (0x3186c5c, min_token=None)  全屏侧位右:叠加 FSSideR 偏移(positionList[5]=+438)(参数与 subRenderMoveEase 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层名(#A 等) | high | 0x3186cc8 |

### `subRenderMoveFSL` (0x3180f80, min_token=None)  左全屏变体:位置额外叠加屏幕左边缘 X 偏移(GetFSCommandOffsetX 取负)(参数与 subRenderMove 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3180fec |

### `subRenderMoveFSR` (0x3180f80, min_token=None)  右全屏变体:叠加屏幕右边缘 X 偏移(取正)(参数与 subRenderMove 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3180fec |

### `subRenderMoveFSSideL` (0x3180f80, min_token=None)  全屏侧位左:叠加 FSSideL 偏移(比 FSL 更靠内,positionList[3]=-438)(参数与 subRenderMove 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3180fec |

### `subRenderMoveFSSideR` (0x3180f80, min_token=None)  全屏侧位右:叠加 FSSideR 偏移(positionList[5]=+438)(参数与 subRenderMove 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3180fec |

### `subRenderMoveScale` (0x317c508, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层名(#A 等) | medium | 0x3189d98 |

### `subRenderMoveScaleEase` (0x317f7b4, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层名(#A 等) | medium | 0x31899ac |

### `subRenderScale` (0x317cad8, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层名(#A 等) | medium | 0x3189eb8 |

### `subRenderShake` (0x3179c9c, min_token=9)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x3179d78 |
| 2 | float | 周期(cycle;Shake 第 2 参) | medium | 0x3179d94 |
| 4 | float | X 振幅 | high | 0x3179d94 |
| 6 | float | Y 振幅 | high | 0x3179d94 |
| 8 | float | 时长(秒) | high | 0x3179d94 |

### `subRenderShakeStop` (0x317fc00, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层名(#A 等) | high | 0x317fc20 |

### `subStretch` (0x3187f58, min_token=1)  子层黑边开关('on'/'off';ScriptSubLayerManager.SetSubStretch)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 'on'/'off'(ScriptSubLayerManager.SetSubStretch) | high | 0x3187f80 |

### `subStretchin` (0x317d3a4, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x317d444 |
| 2 | string | 方向名(StartSubStretch.name) | high | 0x318ceb4 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317d3f4 |
| 4 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x318ceb4 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317d3f4 |
| 6 | float | 拉伸量(scale) | high | 0x318ceb4 |

### `subStretchout` (0x317d3a4, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层 key(#A 等) | high | 0x317d444 |
| 2 | string | 方向名(StartSubStretch.name) | high | 0x318ceb4 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317d3f4 |
| 4 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) | high | 0x318ceb4 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317d3f4 |
| 6 | float | 拉伸量(scale) | high | 0x318ceb4 |


## 插入动画 / FSM / ADV

### `advActorHide` (0x317f138, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 对象/演员名(ConvertNameString) | high | 0x317f168 |

### `advActorShow` (0x318489c, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 对象/演员名(ConvertNameString) | high | 0x31848cc |

### `advPlayAnimator` (0x318267c, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 对象名 | high | 0x31826c0 |
| 2 | string | 动画触发器名(PlayAnimator.trigger) | high | 0x31826fc |

### `advPrepare` (0x317d14c, min_token=None)  预加载 ADV 对象(Prepare(objectName))

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 对象名(Prepare.objectName) | high | 0x317d174 |

### `advRelease` (0x31839d8, min_token=None)  释放 ADV 的 mesh 渲染对象(无参数)
无参数(handler 体内不读 `pd[]`)。
### `advSet` (0x317ec04, min_token=1)  设置 ADV 资源名(GetAssetName.baseName)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 资源基名(GetAssetName.baseName) | high | 0x317ec30 |

### `advSoundSet` (0x3182018, min_token=None)  空实现(2.139.3 handler 只有 b Normal;参数无运行时效果)
无参数(handler 体内不读 `pd[]`)。
### `fsmObjDestroy` (0x317aba0, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317abc0 |

### `fsmObjLayer` (0x317f638, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317f688 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317f660 |
| 2 | string | 层名('ui' 等) | high | 0x317f6d4 |
| 4 | string | 层名/层级参数 | low |  |
| 5 | string | 首字符必须为 ','(格式校验) | high | 0x317f724 |
| 6 | string | 附加参数 | low |  |

### `fsmObjSendEvent` (0x3185e08, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3185e68 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3185e40 |
| 2 | string | 事件名(Fsm.SendEvent) | low |  |

### `fsmObjSet` (0x317c248, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x317c298 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317c270 |
| 2 | string | 变量名(Fsm 变量) | low |  |
| 4 | string | 变量值 | low |  |

### `fsmObjSetBool` (0x3182adc, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3182b2c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3182b04 |
| 2 | string | 变量名 | low |  |
| 4 | bool | 布尔值(true/false) | high | 0x318bebc |

### `fsmObjSetFloat` (0x3182adc, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3182b2c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3182b04 |
| 2 | string | 变量名 | low |  |
| 4 | float | 浮点值 | high | 0x318bebc |

### `fsmObjSetState` (0x3185e08, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3185e68 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3185e40 |
| 2 | string | 状态名(Fsm.SetState) | low |  |

### `fsmObjSetString` (0x3182adc, min_token=5)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 角色槽位(A-Z/数字) | high | 0x3182b2c |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x3182b04 |
| 2 | string | 变量名 | low |  |
| 4 | string | 字符串值 | high | 0x318bebc |

### `insertionAnimationEnd` (0x317f818, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 插入动画名(Find/PlayAnimation) | high | 0x317f830 |

### `insertionAnimationSet` (0x318816c, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 插入动画名(InsertionAnimations/<name>) | high | 0x31881b0 |

### `insertionAnimationSetFSL` (0x318816c, min_token=None)  左全屏变体:位置额外叠加屏幕左边缘 X 偏移(GetFSCommandOffsetX 取负)(参数与 insertionAnimationSet 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 插入动画名 | high | 0x31881b0 |

### `insertionAnimationSetFSR` (0x318816c, min_token=None)  右全屏变体:叠加屏幕右边缘 X 偏移(取正)(参数与 insertionAnimationSet 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 插入动画名 | high | 0x31881b0 |

### `insertionAnimationSetFSSideL` (0x318816c, min_token=None)  全屏侧位左:叠加 FSSideL 偏移(比 FSL 更靠内,positionList[3]=-438)(参数与 insertionAnimationSet 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 插入动画名 | high | 0x31881b0 |

### `insertionAnimationSetFSSideR` (0x318816c, min_token=None)  全屏侧位右:叠加 FSSideR 偏移(positionList[5]=+438)(参数与 insertionAnimationSet 相同)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 插入动画名 | high | 0x31881b0 |

### `insertionAnimationStart` (0x3180d0c, min_token=None)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 插入动画名(Find/PlayAnimation) | high | 0x3180d24 |


## communicationChara*

### `communicationChara` (0x317ef18, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层名(#A 等) | medium | 0x318f878 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ef74 |
| 2 | float | 时长(秒) | medium | 0x3192630 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ef74 |
| 4 | float | 目标 alpha(0-1) | medium | 0x3192630 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ef74 |
| 6 | string | 翻转/朝向(H/V/F/其他) | medium | 0x318f054 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ef74 |
| 8 | string | 翻转/朝向(H/V/F/其他) | medium | 0x319258c |
| 9 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ef74 |

### `communicationCharaClear` (0x318670c, min_token=None)  销毁通信立绘效果(CommonEffectManager.Destroy;无参数)
无参数(handler 体内不读 `pd[]`)。
### `communicationCharaFace` (0x317d044, min_token=1)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 表情类型(Face.Type;SetFace.faceType) | high | 0x317d0f4 |

### `communicationCharaLoop` (0x317ef18, min_token=3)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 子层名(#A 等) | medium | 0x318f878 |
| 1 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ef74 |
| 2 | float | 时长(秒) | medium | 0x3192630 |
| 3 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ef74 |
| 4 | float | 目标 alpha(0-1) | medium | 0x3192630 |
| 5 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ef74 |
| 6 | string | 翻转/朝向(H/V/F/其他) | medium | 0x318f054 |
| 7 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ef74 |
| 8 | string | 翻转/朝向(H/V/F/其他) | medium | 0x319258c |
| 9 | separator | 分隔符 ` `(此位不是参数值) | high | 0x317ef74 |

### `communicationCharaStop` (0x3181d7c, min_token=None)  停止通信立绘效果(CommonEffectManager.Stop;无参数)
无参数(handler 体内不读 `pd[]`)。

## 其他

### `capture` (0x3181454, min_token=None)  抓取当前渲染到 RenderTexture 并交换渲染相机(ScreenShot/RenderCameraSwap)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 4 | string | 截图/渲染目标相关字符串 | low | 0x318d2b8 |

### `captureRelease` (0x31823a4, min_token=None)  释放截图用 RenderTexture(无参数)
无参数(handler 体内不读 `pd[]`)。
### `enableFullScreen` (0x3182018, min_token=None)  空实现(handler 只有 b Normal;与 advSoundSet 等共享 0x3182018)
无参数(handler 体内不读 `pd[]`)。
### `selectionCentering` (0x317f90c, min_token=1)  选项居中对齐开关(bool)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | bool | 布尔值(是否居中;k1 项选择) | high | 0x317f948 |

### `useSimpleMeshFigure` (0x317ba14, min_token=None)  用 SimpleMesh 立绘替换(参数为资源名列表,逗号分隔)

| pd | 类型 | 含义 | 置信 | 证据 |
|---|---|---|---|---|
| 0 | string | 立绘资源名(ConvertNameString,逗号分隔多项) | high | 0x317a074 |


## 附:方法、统计与未决问题

* 工具链:`tools/vis_trace.py`(逐 handler 区域反汇编 + 共享尾块跟踪 + pd[] 污点),`tools/branch_map.py`(区域/尾块图),`tools/vis_report.py`(批量扫描 → `scratch/vis_flows.json`),`tools/build_params_visual.py` + `tools/params_visual_manual.py`(本表)。
* 判定依据:handler 体内 `ldr xN,[pd,#0x20+8i]` 的偏移给出真实 pd 下标;`bl` 目标方法的参数名取自 `il2cpp_out/method_sig.json`(dump.cs);分隔符/枚举取值由 `String.op_Equality` / `get_Chars` 的立即数给出。
* 统计:253 条指令 / 991 个参数行 = high 742、medium 171、low 78;无参数指令 17 条;无法定位消费点的参数 15 个。
* 最大的未决问题:(1) 数值参数的**值语义**多为数据驱动(滤镜名→参数、颜色名→RGB、ease 名→iTween 曲线、位置名→坐标),二进制内只有字符串比较,没有可抄的枚举表,需要真实脚本对拍;(2) `screen`/`masterNameWidth`/`distortion*` 的数值参数经虚函数或数组传递,签名定位不到参数名;(3) 共享尾块被大量命令复用,个别命令的 pd 下标归属可能相差 2(高价值命令已逐条人工核对,其余按 medium 标注);(4) advSoundSet/enableFullScreen/delayEnd/enableWaitLoadAssetWhenResume 在 2.139.3 是空实现,老脚本里的参数没有运行时效果;(5) `turnPageOn` 的参数与 `'f'` 做 Contains 比较,语义未确证。
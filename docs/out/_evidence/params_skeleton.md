# 指令参数含义表(最终,自动生成)

来源优先级:人工核验 > 域文档(params-visual / params-misc) > 自动化跟踪。
`sources` 列标注该行来自哪里。

| 指令 | pd | 类型 | 含义 | 取值 | 置信度 | 来源 |
|---|---|---|---|---|---|---|
| `advActorHide` | 0 | string | 对象/演员名(ConvertNameString) |  | high | automation,params-visual |
| `advActorShow` | 0 | string | 对象/演员名(ConvertNameString) |  | high | automation,params-visual |
| `advPlayAnimator` | 0 | string | 对象名 |  | high | automation,params-visual |
| `advPlayAnimator` | 2 | string | 动画触发器名(PlayAnimator.trigger) |  | high | automation,params-visual |
| `advPrepare` | 0 | string | 对象名(Prepare.objectName) |  | high | automation,params-visual |
| `advRelease` | 0 | string | 传给 GetScriptSubLayer() 的参数 `layerKey`(string) |  | low | automation |
| `advSet` | 0 | string | 资源基名(GetAssetName.baseName) |  | high | automation,params-visual |
| `advSoundSet` | 0 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `autoAndBackLog` | 0 | string | 开关 | true/false | high | automation,params-misc |
| `bScene` | 0 | string | 背景资源名(ConvertNameString→B 场景加载) |  | high | automation,params-visual |
| `bScene` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `bScene` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `bScene` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `bScene` | 6 | string | 颜色 1(ConvertColor) |  | high | automation,params-visual |
| `bScene` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `bScene` | 8 | string | 颜色 2(ConvertColor) |  | high | automation,params-visual |
| `backCameraColor` | 0 | string | 'false'=关闭(相机 clearFlags=SolidColor=3);其他=颜色 |  | high | automation,params-visual |
| `backEffect` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `backEffect` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `backEffect` | 3 | separator | `','`(坐标形式) |  | high | automation,params-visual |
| `backEffect` | 5 | separator | 分隔符 `' '`(守卫 pd[6]=翻转/朝向) |  | medium | automation,params-visual |
| `backEffect` | 6 | string | 翻转/朝向(ConvertEffectFlipKind) |  | medium | automation,params-visual |
| `backEffectDestroy` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `backEffectPause` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `backEffectPause` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `backEffectPause` | 3 | separator | `','`(坐标形式) |  | high | automation,params-visual |
| `backEffectPause` | 5 | separator | 分隔符 `' '`(守卫 pd[6]=翻转/朝向) |  | medium | automation,params-visual |
| `backEffectPause` | 6 | string | 翻转/朝向(ConvertEffectFlipKind) |  | medium | automation,params-visual |
| `backEffectStart` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `backEffectStop` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `backlogEnd` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `backlogStart` | 0 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `backlogStart` | 2 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `betweenHeight` | 0 | float | 行高；'-' 表示 -1（默认） | -1 / 像素 | high | automation,params-misc |
| `bgm` | 0 | string | BGM 名（字符串名，可被 ConvertNameString 改写成资源名） | 资源名 | high | automation,params-misc |
| `bgm` | 2 | float | 音量(volume)；省略时按 0（默认音量）处理 | 0.0–1.0（0=默认） | medium | automation,params-misc |
| `bgmStop` | 0 | string | BGM 名；` ` (单空格)=省略（用当前 BGM/默认目标） | 资源名 / ` ` | medium | automation,params-misc |
| `bgmStop` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `bgmStopEnd` | 0 | string | BGM 名 / ` ` | 资源名 / ` ` | low | automation,params-misc |
| `bgmStopEnd` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `blur` | 0 | string | 目标(与 'lens' 相关:镜头模糊) |  | low | automation,params-visual |
| `blurOff` | 0 | string | 目标名('lens'=镜头模糊) |  | high | automation,params-visual |
| `blurOff` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `blurOff` | 2 | float | 时长(秒;Single.Parse@0x31879f0) |  | high | automation,params-visual |
| `blurOff` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `blurOff` | 4 | string | 颜色(名称或 #RRGGBB) |  | medium | automation,params-visual |
| `blurOff` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `blurOff` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `blurOff` | 9 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `branch` | 0 | string | flag 名 | flag 名 | high | automation,params-misc |
| `branch` | 2 | string | 比较值（'=' 比较） | true/false/数值 | high | automation,params-misc |
| `branch` | 4 | string | 第二比较值/备用 | — | low | automation,params-misc |
| `branchHaveSvtEquip` | 0 | string | 传给 isPlayJingle() 的参数 `name`(string) |  | low | automation |
| `branchHaveSvtEquip` | 2 | int | 装备/礼装编号（int） | 整数 | medium | automation,params-misc |
| `branchMaterial` | 0 | unknown | 传给 isPlayJingle() 的参数 `name`(string) |  | high | automation |
| `branchNotHaveSvtEquip` | 0 | string | 传给 isPlayJingle() 的参数 `name`(string) |  | low | automation |
| `branchNotHaveSvtEquip` | 2 | int | 装备/礼装编号（int） | 整数 | medium | automation,params-misc |
| `branchNotMaterial` | 0 | unknown | 传给 isPlayJingle() 的参数 `name`(string) |  | high | automation |
| `branchNotRouteSelect` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `branchNotRouteSelect` | 4 | int | 路线 ID（int） | 整数 | medium | automation,params-misc |
| `branchNotRouteSelectCount` | 0 | string | 比较表达式/标签 | — | low | automation,params-misc |
| `branchNotRouteSelectCount` | 2 | int | 数量（int） | 整数 | medium | automation,params-misc |
| `branchNotRouteSelectCount` | 4 | int/enum | 枚举/比较符 | — | medium | automation,params-misc |
| `branchQuestClear` | 0 | string | 划像名(拼成 Wipe/<name>) |  | low | automation |
| `branchQuestClear` | 4 | int | 任务 ID（int） | 整数 | medium | automation,params-misc |
| `branchQuestNotClear` | 0 | string | 划像名(拼成 Wipe/<name>) |  | low | automation |
| `branchQuestNotClear` | 4 | int | 任务 ID（int） | 整数 | medium | automation,params-misc |
| `branchRouteSelect` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `branchRouteSelect` | 4 | int | 路线 ID（int） | 整数 | medium | automation,params-misc |
| `branchRouteSelectCount` | 0 | string | 比较表达式/标签（String::Equals） | — | low | automation,params-misc |
| `branchRouteSelectCount` | 2 | int | 数量（int） | 整数 | medium | automation,params-misc |
| `branchRouteSelectCount` | 4 | int/enum | 枚举/比较符（Enum.Parse） | — | medium | automation,params-misc |
| `branchSetGrandSvtCount` | 0 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `branchSetGrandSvtCount` | 2 | int | 数量（int） | 整数 | medium | automation,params-misc |
| `branchSetGrandSvtCount` | 4 | int/enum | 枚举/比较符 | — | medium | automation,params-misc |
| `cameraFilter` | 0 | string | 滤镜名(SetCameraFilter) |  | medium | automation,params-visual |
| `cameraHome` | 0 | float | 归位时长(秒);0=立即 |  | medium | automation,params-visual |
| `cameraMove` | 0 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `cameraMove` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `cameraMove` | 2 | int | X 坐标(摄像机局部坐标) |  | high | automation,params-visual |
| `cameraMove` | 3 | separator | `','`(必须) |  | high | automation,params-visual |
| `cameraMove` | 4 | int | Y 坐标 |  | high | automation,params-visual |
| `cameraMove` | 5 | separator | 分隔符 `' '`(守卫缩放) |  | high | automation,params-visual |
| `cameraMoveEase` | 0 | float | X 坐标 |  | high | automation,params-visual |
| `cameraMoveEase` | 1 | separator | `','`(0x317a670 处比较) |  | high | automation,params-visual |
| `cameraMoveEase` | 2 | float | Y 坐标 |  | high | automation,params-visual |
| `cameraMoveEase` | 4 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `cameraMoveEase` | 6 | string | 缓动类型(iTween ease 名) |  | high | automation,params-visual |
| `cameraMoveEase` | 8 | float | 缩放(scale) |  | high | automation,params-visual |
| `cameraRoll` | 0 | float | 旋转角(度) |  | high | automation,params-visual |
| `cameraRoll` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `cameraRoll` | 2 | float | 旋转中心 X 偏移 |  | high | automation,params-visual |
| `cameraRoll` | 3 | separator | `','`(中心偏移为坐标形式) |  | high | automation,params-visual |
| `cameraRoll` | 4 | float | 旋转中心 Y 偏移 |  | high | automation,params-visual |
| `cameraRollMove` | 0 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `cameraRollMove` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `cameraRollMove` | 2 | float | 旋转角(度) |  | high | automation,params-visual |
| `capture` | 0 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `capture` | 2 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `capture` | 4 | string | 截图/渲染目标相关字符串 |  | low | automation,params-visual |
| `captureRelease` | 0 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `captureRelease` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `charaAttack` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaAttack` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaAttack` | 2 | string | 攻击动作/特效名(ScriptCharaData.MoveAttack 第 1 参) |  | high | automation,params-visual |
| `charaAttack` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaAttack` | 4 | int | 目标 X 坐标 |  | high | automation,params-visual |
| `charaAttack` | 5 | string | 首字符必须为 ','(格式校验) |  | high | automation,params-visual |
| `charaAttack` | 6 | int | 目标 Y 坐标 |  | high | automation,params-visual |
| `charaAttack` | 7 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `charaAttack` | 8 | float | 时长(秒;MoveAttack 第 4 参) |  | high | automation,params-visual |
| `charaBackEffect` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaBackEffect` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaBackEffect` | 2 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `charaBackEffect` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaBackEffect` | 5 | separator | 分隔符 `,`(此位不是参数值) |  | high | automation,params-visual |
| `charaBackEffect` | 7 | ? | 未知 |  | low | automation,params-visual |
| `charaBackEffect` | 8 | string | 翻转/朝向(H/V/F/其他) |  | medium | automation,params-visual |
| `charaBackEffectDestroy` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaBackEffectDestroy` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaBackEffectDestroy` | 2 | string | 对话特效名(拼成 Talk/<name>) |  | high | automation |
| `charaBackEffectDestroy` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaBackEffectDestroy` | 4 | string | 颜色(名称或 #RRGGBB) |  | medium | automation,params-visual |
| `charaBackEffectPause` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaBackEffectPause` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaBackEffectPause` | 2 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `charaBackEffectPause` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaBackEffectPause` | 5 | separator | 分隔符 `,`(此位不是参数值) |  | high | automation,params-visual |
| `charaBackEffectPause` | 7 | ? | 未知 |  | low | automation,params-visual |
| `charaBackEffectPause` | 8 | string | 翻转/朝向(H/V/F/其他) |  | medium | automation,params-visual |
| `charaBackEffectStart` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaBackEffectStart` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaBackEffectStart` | 2 | string | 对话特效名(拼成 Talk/<name>) |  | high | automation |
| `charaBackEffectStart` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaBackEffectStart` | 4 | string | 颜色(名称或 #RRGGBB) |  | medium | automation,params-visual |
| `charaBackEffectStop` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaBackEffectStop` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaBackEffectStop` | 2 | string | 对话特效名(拼成 Talk/<name>) |  | high | automation |
| `charaChange` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaChange` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaChange` | 2 | string | 新立绘名+形态(ScriptManager.GetCharaImageNameAndFormId) |  | high | automation,params-visual |
| `charaChange` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaChange` | 4 | string | 附加名称(ConvertNameString) |  | high | automation,params-visual |
| `charaChange` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaChange` | 6 | string | 颜色名(black/white/#RRGGBB 等) |  | high | automation,params-visual |
| `charaChange` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaChange` | 8 | string | 颜色名(black/white/#RRGGBB 等) |  | high | automation,params-visual |
| `charaClear` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaClear` | 3 | ? | 分隔符/选项守卫(' ') |  | low | automation,params-visual |
| `charaClear` | 4 | string | 消除方式/颜色(ConvertColor) |  | high | automation,params-visual |
| `charaCrossFade` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaCrossFade` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaCrossFade` | 2 | string | 立绘/资源名(淡入的新立绘) |  | high | automation,params-visual |
| `charaCrossFade` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaCrossFade` | 4 | string | 颜色名(black/white/#RRGGBB 等) |  | high | automation,params-visual |
| `charaCrossFade` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaCrossFade` | 6 | float |  |  | ? | automation |
| `charaCutStop` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaCutin` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaCutin` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaCutin` | 2 | string | 立绘/图片名(ConvertNameString) |  | high | automation,params-visual |
| `charaCutin` | 3 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaCutin` | 4 | float | 时长(秒) |  | high | automation,params-visual |
| `charaCutin` | 6 | float | 第二时长/速度(秒;可选) |  | medium | automation,params-visual |
| `charaCutinPause` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaCutinPause` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaCutinPause` | 2 | string | 立绘/图片名(ConvertNameString) |  | high | automation,params-visual |
| `charaCutinPause` | 3 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaCutinPause` | 4 | float | 时长(秒) |  | high | automation,params-visual |
| `charaCutinPause` | 6 | float | 第二时长/速度(秒;可选) |  | medium | automation,params-visual |
| `charaCutinStart` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaCutout` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaCutout` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaCutout` | 2 | ? | 裁剪参数(未消费;仅 0x318f144 处比较) |  | low | automation,params-visual |
| `charaDepth` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaDepth` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaDepth` | 2 | ? | 深度值(z 排序值,越小越靠前?) |  | low | automation,params-visual |
| `charaDepth` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaDepth` | 4 | string | 颜色(名称或 #RRGGBB) |  | medium | automation,params-visual |
| `charaEffect` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaEffect` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaEffect` | 2 | string | 特效名(Talk/<name>);亦作滤镜名(SetFilterCharaData) |  | high | automation,params-visual |
| `charaEffect` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaEffect` | 4 | string | 颜色名(black/white/#RRGGBB 等) |  | medium | automation,params-visual |
| `charaEffect` | 5 | separator | 分隔符 `,`(此位不是参数值) |  | high | automation,params-visual |
| `charaEffect` | 7 | ? | 未知 |  | low | automation,params-visual |
| `charaEffect` | 8 | string | 翻转/朝向(ConvertEffectFlipKind) |  | medium | automation,params-visual |
| `charaEffectDestroy` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaEffectDestroy` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaEffectDestroy` | 2 | string | 对话特效名(拼成 Talk/<name>) |  | high | automation |
| `charaEffectEdgeBlur` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaEffectEdgeBlur` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaEffectEdgeBlur` | 2 | string | 颜色名(black/white/#RRGGBB 等) |  | medium | automation,params-visual |
| `charaEffectEdgeBlur` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaEffectEdgeBlur` | 4 | string | 颜色名(black/white/#RRGGBB 等) |  | medium | automation,params-visual |
| `charaEffectEdgeBlurDestroy` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaEffectEdgeBlurPause` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaEffectEdgeBlurPause` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaEffectEdgeBlurPause` | 2 | string | 颜色名(black/white/#RRGGBB 等) |  | medium | automation,params-visual |
| `charaEffectEdgeBlurPause` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaEffectEdgeBlurPause` | 4 | string | 颜色名(black/white/#RRGGBB 等) |  | medium | automation,params-visual |
| `charaEffectEdgeBlurStart` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaEffectEdgeBlurStop` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaEffectPause` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaEffectPause` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaEffectPause` | 2 | string | 特效名(Talk/<name>);亦作滤镜名(SetFilterCharaData) |  | high | automation,params-visual |
| `charaEffectPause` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaEffectPause` | 4 | string | 颜色名(black/white/#RRGGBB 等) |  | medium | automation,params-visual |
| `charaEffectPause` | 5 | separator | 分隔符 `,`(此位不是参数值) |  | high | automation,params-visual |
| `charaEffectPause` | 7 | ? | 未知 |  | low | automation,params-visual |
| `charaEffectPause` | 8 | string | 翻转/朝向(ConvertEffectFlipKind) |  | medium | automation,params-visual |
| `charaEffectStart` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaEffectStart` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaEffectStart` | 2 | string | 对话特效名(拼成 Talk/<name>) |  | high | automation |
| `charaEffectStop` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaEffectStop` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaEffectStop` | 2 | string | 对话特效名(拼成 Talk/<name>) |  | high | automation |
| `charaEffectStop` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaEffectStop` | 4 | string | 颜色(名称或 #RRGGBB) |  | medium | automation,params-visual |
| `charaFace` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFace` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaFace` | 2 | string | 表情(face)编号/名 |  | low | automation,params-visual |
| `charaFaceFade` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFaceFade` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaFaceFade` | 2 | ? | 表情/立绘形态参数 |  | high | automation,params-visual |
| `charaFaceFade` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaFaceIcon` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFaceIcon` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaFaceIcon` | 2 | ? | 表情图标编号 |  | low | automation,params-visual |
| `charaFaceIcon` | 4 | int | 图标 X 坐标(SetPosition(float,float)) |  | high | automation,params-visual |
| `charaFaceIcon` | 6 | int | 图标 Y 坐标 |  | high | automation,params-visual |
| `charaFadeSpeed` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFadeSpeed` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaFadeSpeed` | 2 | ? | 淡入速度倍率/秒 |  | low | automation,params-visual |
| `charaFadeSpeed` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaFadeSpeed` | 4 | ? | 附加参数(未消费时忽略) |  | low | automation,params-visual |
| `charaFadeTime` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFadeTime` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaFadeTime` | 2 | ? | 淡入(alpha)时间(秒) |  | low | automation,params-visual |
| `charaFadeTime` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaFadeTime` | 4 | ? | 淡入后的等待时间(秒) |  | low | automation,params-visual |
| `charaFadeTimeLoop` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFadeTimeLoop` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaFadeTimeLoop` | 4 | ? | 循环淡出时间(秒) |  | low | automation,params-visual |
| `charaFadeTimeLoop` | 20 | string | 附加参数(超出常规布局,含义未证实) |  | low | automation,params-visual |
| `charaFadeTimeLoopStop` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFadein` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFadein` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaFadein` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | medium | automation,params-visual |
| `charaFadein` | 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadein` | 5 | separator | `','`=坐标形式 |  | medium | automation,params-visual |
| `charaFadein` | 6 | int | Y 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeinFSL` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFadeinFSL` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaFadeinFSL` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | medium | automation,params-visual |
| `charaFadeinFSL` | 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeinFSL` | 5 | separator | `','`=坐标形式 |  | medium | automation,params-visual |
| `charaFadeinFSL` | 6 | int | Y 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeinFSLNotNotch` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFadeinFSLNotNotch` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaFadeinFSLNotNotch` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | medium | automation,params-visual |
| `charaFadeinFSLNotNotch` | 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeinFSLNotNotch` | 5 | separator | `','`=坐标形式 |  | medium | automation,params-visual |
| `charaFadeinFSLNotNotch` | 6 | int | Y 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeinFSR` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFadeinFSR` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaFadeinFSR` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | medium | automation,params-visual |
| `charaFadeinFSR` | 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeinFSR` | 5 | separator | `','`=坐标形式 |  | medium | automation,params-visual |
| `charaFadeinFSR` | 6 | int | Y 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeinFSRNotNotch` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFadeinFSRNotNotch` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaFadeinFSRNotNotch` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | medium | automation,params-visual |
| `charaFadeinFSRNotNotch` | 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeinFSRNotNotch` | 5 | separator | `','`=坐标形式 |  | medium | automation,params-visual |
| `charaFadeinFSRNotNotch` | 6 | int | Y 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeinFSSideL` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFadeinFSSideL` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaFadeinFSSideL` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | medium | automation,params-visual |
| `charaFadeinFSSideL` | 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeinFSSideL` | 5 | separator | `','`=坐标形式 |  | medium | automation,params-visual |
| `charaFadeinFSSideL` | 6 | int | Y 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeinFSSideR` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFadeinFSSideR` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaFadeinFSSideR` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | medium | automation,params-visual |
| `charaFadeinFSSideR` | 4 | int | 位置下标(pd[3]==' ' 且非坐标形式);或 X 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeinFSSideR` | 5 | separator | `','`=坐标形式 |  | medium | automation,params-visual |
| `charaFadeinFSSideR` | 6 | int | Y 坐标(坐标形式) |  | medium | automation,params-visual |
| `charaFadeout` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFadeout` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaFilter` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaFilter` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaFilter` | 2 | string | 滤镜名(与颜色一起传入) |  | high | automation,params-visual |
| `charaFilter` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaFilter` | 4 | string | 颜色名(black/white/#RRGGBB 等) |  | high | automation,params-visual |
| `charaLayer` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaLayer` | 2 | ? | 层类别:'sub'/'normal'(比较@0x3182a5c/0x318da00) |  | high | automation,params-visual |
| `charaLayer` | 4 | ? | 子层 key(#A 等,ScriptSubLayerManager.RegistCharaData) |  | high | automation,params-visual |
| `charaMask` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMask` | 2 | ? | 遮罩方向:'inside'/'outside'(比较@0x3183ff8/0x318da40) |  | high | automation,params-visual |
| `charaMove` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMove` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaMove` | 2 | int | X 坐标(pd[3]==',' 时为直接坐标)或位置下标(pd[3]==' ') |  | high | automation,params-visual |
| `charaMove` | 3 | separator | `','`=坐标形式;`' '`=下标形式 |  | high | automation,params-visual |
| `charaMove` | 4 | int | Y 坐标(pd[3]==',');或 <时长>(pd[3]==' ') |  | high | automation,params-visual |
| `charaMove` | 5 | separator | 分隔符 `' '`(守卫时长) |  | high | automation,params-visual |
| `charaMove` | 6 | float | 时长(秒;仅坐标形式且正常速度) |  | high | automation,params-visual |
| `charaMoveEase` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveEase` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaMoveEase` | 2 | int | X 坐标(与 pd[3]==',' 后的 y 组成直接坐标)(坐标形式) |  | high | automation,params-visual |
| `charaMoveEase` | 4 | int | Y 坐标 |  | high | automation,params-visual |
| `charaMoveEase` | 6 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `charaMoveEase` | 8 | string | 缓动类型(iTween ease 名)(ScriptCharaData.MovePositionEase 第 4 参) |  | high | automation,params-visual |
| `charaMoveEaseFSL` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveEaseFSL` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaMoveEaseFSL` | 2 | int | X 坐标(与 pd[3]==',' 后的 y 组成直接坐标)(坐标形式) |  | high | automation,params-visual |
| `charaMoveEaseFSL` | 4 | int | Y 坐标 |  | high | automation,params-visual |
| `charaMoveEaseFSL` | 6 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `charaMoveEaseFSL` | 8 | string | 缓动类型(iTween ease 名)(ScriptCharaData.MovePositionEase 第 4 参) |  | high | automation,params-visual |
| `charaMoveEaseFSR` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveEaseFSR` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaMoveEaseFSR` | 2 | int | X 坐标(与 pd[3]==',' 后的 y 组成直接坐标)(坐标形式) |  | high | automation,params-visual |
| `charaMoveEaseFSR` | 4 | int | Y 坐标 |  | high | automation,params-visual |
| `charaMoveEaseFSR` | 6 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `charaMoveEaseFSR` | 8 | string | 缓动类型(iTween ease 名)(ScriptCharaData.MovePositionEase 第 4 参) |  | high | automation,params-visual |
| `charaMoveEaseFSSideL` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveEaseFSSideL` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaMoveEaseFSSideL` | 2 | int | X 坐标(与 pd[3]==',' 后的 y 组成直接坐标)(坐标形式) |  | high | automation,params-visual |
| `charaMoveEaseFSSideL` | 4 | int | Y 坐标 |  | high | automation,params-visual |
| `charaMoveEaseFSSideL` | 6 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `charaMoveEaseFSSideL` | 8 | string | 缓动类型(iTween ease 名)(ScriptCharaData.MovePositionEase 第 4 参) |  | high | automation,params-visual |
| `charaMoveEaseFSSideR` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveEaseFSSideR` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaMoveEaseFSSideR` | 2 | int | X 坐标(与 pd[3]==',' 后的 y 组成直接坐标)(坐标形式) |  | high | automation,params-visual |
| `charaMoveEaseFSSideR` | 4 | int | Y 坐标 |  | high | automation,params-visual |
| `charaMoveEaseFSSideR` | 6 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `charaMoveEaseFSSideR` | 8 | string | 缓动类型(iTween ease 名)(ScriptCharaData.MovePositionEase 第 4 参) |  | high | automation,params-visual |
| `charaMoveFSL` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveFSL` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaMoveFSL` | 2 | int | X 坐标(pd[3]==',' 时为直接坐标)或位置下标(pd[3]==' ') |  | high | automation,params-visual |
| `charaMoveFSL` | 3 | separator | `','`=坐标形式;`' '`=下标形式 |  | high | automation,params-visual |
| `charaMoveFSL` | 4 | int | Y 坐标(pd[3]==',');或 <时长>(pd[3]==' ') |  | high | automation,params-visual |
| `charaMoveFSL` | 5 | separator | 分隔符 `' '`(守卫时长) |  | high | automation,params-visual |
| `charaMoveFSL` | 6 | float | 时长(秒;仅坐标形式且正常速度) |  | high | automation,params-visual |
| `charaMoveFSR` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveFSR` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaMoveFSR` | 2 | int | X 坐标(pd[3]==',' 时为直接坐标)或位置下标(pd[3]==' ') |  | high | automation,params-visual |
| `charaMoveFSR` | 3 | separator | `','`=坐标形式;`' '`=下标形式 |  | high | automation,params-visual |
| `charaMoveFSR` | 4 | int | Y 坐标(pd[3]==',');或 <时长>(pd[3]==' ') |  | high | automation,params-visual |
| `charaMoveFSR` | 5 | separator | 分隔符 `' '`(守卫时长) |  | high | automation,params-visual |
| `charaMoveFSR` | 6 | float | 时长(秒;仅坐标形式且正常速度) |  | high | automation,params-visual |
| `charaMoveFSSideL` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveFSSideL` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaMoveFSSideL` | 2 | int | X 坐标(pd[3]==',' 时为直接坐标)或位置下标(pd[3]==' ') |  | high | automation,params-visual |
| `charaMoveFSSideL` | 3 | separator | `','`=坐标形式;`' '`=下标形式 |  | high | automation,params-visual |
| `charaMoveFSSideL` | 4 | int | Y 坐标(pd[3]==',');或 <时长>(pd[3]==' ') |  | high | automation,params-visual |
| `charaMoveFSSideL` | 5 | separator | 分隔符 `' '`(守卫时长) |  | high | automation,params-visual |
| `charaMoveFSSideL` | 6 | float | 时长(秒;仅坐标形式且正常速度) |  | high | automation,params-visual |
| `charaMoveFSSideR` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveFSSideR` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaMoveFSSideR` | 2 | int | X 坐标(pd[3]==',' 时为直接坐标)或位置下标(pd[3]==' ') |  | high | automation,params-visual |
| `charaMoveFSSideR` | 3 | separator | `','`=坐标形式;`' '`=下标形式 |  | high | automation,params-visual |
| `charaMoveFSSideR` | 4 | int | Y 坐标(pd[3]==',');或 <时长>(pd[3]==' ') |  | high | automation,params-visual |
| `charaMoveFSSideR` | 5 | separator | 分隔符 `' '`(守卫时长) |  | high | automation,params-visual |
| `charaMoveFSSideR` | 6 | float | 时长(秒;仅坐标形式且正常速度) |  | high | automation,params-visual |
| `charaMoveReturn` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveReturn` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaMoveReturn` | 2 | int | X 或位置下标(回位后位置) |  | high | automation,params-visual |
| `charaMoveReturn` | 3 | separator | `','`=坐标形式 |  | high | automation,params-visual |
| `charaMoveReturn` | 4 | int | Y 坐标(坐标形式)或时长(下标形式) |  | medium | automation,params-visual |
| `charaMoveReturn` | 5 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `charaMoveReturn` | 6 | float | 时长(秒;坐标形式) |  | medium | automation,params-visual |
| `charaMoveReturnEase` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveReturnEase` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaMoveReturnEase` | 2 | int | X 或位置下标 |  | medium | automation,params-visual |
| `charaMoveReturnEase` | 3 | separator | `','`=坐标形式 |  | medium | automation,params-visual |
| `charaMoveReturnEase` | 4 | int | Y 坐标(坐标形式)或时长(下标形式) |  | medium | automation,params-visual |
| `charaMoveReturnEase` | 5 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `charaMoveReturnEase` | 6 | float | 时长(秒;坐标形式) |  | medium | automation,params-visual |
| `charaMoveReturnEase` | 8 | string | 缓动类型(iTween ease 名)(MoveReturnPositionEase) |  | medium | automation,params-visual |
| `charaMoveReturnEase` | 10 | string | 附加选项(与 'stretchOff' 等比较) |  | low | automation,params-visual |
| `charaMoveReturnEaseFSL` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveReturnEaseFSL` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaMoveReturnEaseFSL` | 2 | int | X 或位置下标 |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSL` | 3 | separator | `','`=坐标形式 |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSL` | 4 | int | Y 坐标(坐标形式)或时长(下标形式) |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSL` | 5 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `charaMoveReturnEaseFSL` | 6 | float | 时长(秒;坐标形式) |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSL` | 8 | string | 缓动类型(iTween ease 名)(MoveReturnPositionEase) |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSL` | 10 | string | 附加选项(与 'stretchOff' 等比较) |  | low | automation,params-visual |
| `charaMoveReturnEaseFSR` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveReturnEaseFSR` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaMoveReturnEaseFSR` | 2 | int | X 或位置下标 |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSR` | 3 | separator | `','`=坐标形式 |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSR` | 4 | int | Y 坐标(坐标形式)或时长(下标形式) |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSR` | 5 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `charaMoveReturnEaseFSR` | 6 | float | 时长(秒;坐标形式) |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSR` | 8 | string | 缓动类型(iTween ease 名)(MoveReturnPositionEase) |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSR` | 10 | string | 附加选项(与 'stretchOff' 等比较) |  | low | automation,params-visual |
| `charaMoveReturnEaseFSSideL` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveReturnEaseFSSideL` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaMoveReturnEaseFSSideL` | 2 | int | X 或位置下标 |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSSideL` | 3 | separator | `','`=坐标形式 |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSSideL` | 4 | int | Y 坐标(坐标形式)或时长(下标形式) |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSSideL` | 5 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `charaMoveReturnEaseFSSideL` | 6 | float | 时长(秒;坐标形式) |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSSideL` | 8 | string | 缓动类型(iTween ease 名)(MoveReturnPositionEase) |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSSideL` | 10 | string | 附加选项(与 'stretchOff' 等比较) |  | low | automation,params-visual |
| `charaMoveReturnEaseFSSideR` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveReturnEaseFSSideR` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaMoveReturnEaseFSSideR` | 2 | int | X 或位置下标 |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSSideR` | 3 | separator | `','`=坐标形式 |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSSideR` | 4 | int | Y 坐标(坐标形式)或时长(下标形式) |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSSideR` | 5 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `charaMoveReturnEaseFSSideR` | 6 | float | 时长(秒;坐标形式) |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSSideR` | 8 | string | 缓动类型(iTween ease 名)(MoveReturnPositionEase) |  | medium | automation,params-visual |
| `charaMoveReturnEaseFSSideR` | 10 | string | 附加选项(与 'stretchOff' 等比较) |  | low | automation,params-visual |
| `charaMoveReturnFSL` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveReturnFSL` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaMoveReturnFSL` | 2 | int | X 或位置下标(回位后位置) |  | high | automation,params-visual |
| `charaMoveReturnFSL` | 3 | separator | `','`=坐标形式 |  | high | automation,params-visual |
| `charaMoveReturnFSL` | 4 | int | Y 坐标(坐标形式)或时长(下标形式) |  | medium | automation,params-visual |
| `charaMoveReturnFSL` | 5 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `charaMoveReturnFSL` | 6 | float | 时长(秒;坐标形式) |  | medium | automation,params-visual |
| `charaMoveReturnFSR` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveReturnFSR` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaMoveReturnFSR` | 2 | int | X 或位置下标(回位后位置) |  | high | automation,params-visual |
| `charaMoveReturnFSR` | 3 | separator | `','`=坐标形式 |  | high | automation,params-visual |
| `charaMoveReturnFSR` | 4 | int | Y 坐标(坐标形式)或时长(下标形式) |  | medium | automation,params-visual |
| `charaMoveReturnFSR` | 5 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `charaMoveReturnFSR` | 6 | float | 时长(秒;坐标形式) |  | medium | automation,params-visual |
| `charaMoveReturnFSSideL` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveReturnFSSideL` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaMoveReturnFSSideL` | 2 | int | X 或位置下标(回位后位置) |  | high | automation,params-visual |
| `charaMoveReturnFSSideL` | 3 | separator | `','`=坐标形式 |  | high | automation,params-visual |
| `charaMoveReturnFSSideL` | 4 | int | Y 坐标(坐标形式)或时长(下标形式) |  | medium | automation,params-visual |
| `charaMoveReturnFSSideL` | 5 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `charaMoveReturnFSSideL` | 6 | float | 时长(秒;坐标形式) |  | medium | automation,params-visual |
| `charaMoveReturnFSSideR` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveReturnFSSideR` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaMoveReturnFSSideR` | 2 | int | X 或位置下标(回位后位置) |  | high | automation,params-visual |
| `charaMoveReturnFSSideR` | 3 | separator | `','`=坐标形式 |  | high | automation,params-visual |
| `charaMoveReturnFSSideR` | 4 | int | Y 坐标(坐标形式)或时长(下标形式) |  | medium | automation,params-visual |
| `charaMoveReturnFSSideR` | 5 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `charaMoveReturnFSSideR` | 6 | float | 时长(秒;坐标形式) |  | medium | automation,params-visual |
| `charaMoveScale` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveScale` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaMoveScale` | 2 | ? | 缩放值(倍率) |  | low | automation,params-visual |
| `charaMoveScale` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaMoveScale` | 4 | ? | 未知 |  | low | automation,params-visual |
| `charaMoveScaleEase` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaMoveScaleEase` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaMoveScaleEase` | 2 | ? | 缩放值(倍率) |  | low | automation,params-visual |
| `charaMoveScaleEase` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaMoveScaleEase` | 4 | string | 颜色(名称或 #RRGGBB) |  | medium | automation,params-visual |
| `charaMoveScaleEase` | 6 | ? | 未知 |  | low | automation,params-visual |
| `charaPut` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaPut` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaPut` | 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 |  | high | automation,params-visual |
| `charaPut` | 3 | separator | `','` 时进入坐标形式 |  | high | automation,params-visual |
| `charaPut` | 4 | int | Y 坐标(仅 pd[3]==',' 时) |  | high | automation,params-visual |
| `charaPutFSL` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaPutFSL` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaPutFSL` | 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 |  | high | automation,params-visual |
| `charaPutFSL` | 3 | separator | `','` 时进入坐标形式 |  | high | automation,params-visual |
| `charaPutFSL` | 4 | int | Y 坐标(仅 pd[3]==',' 时) |  | high | automation,params-visual |
| `charaPutFSLNotNotch` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaPutFSLNotNotch` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaPutFSLNotNotch` | 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 |  | high | automation,params-visual |
| `charaPutFSLNotNotch` | 3 | separator | `','` 时进入坐标形式 |  | high | automation,params-visual |
| `charaPutFSLNotNotch` | 4 | int | Y 坐标(仅 pd[3]==',' 时) |  | high | automation,params-visual |
| `charaPutFSR` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaPutFSR` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaPutFSR` | 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 |  | high | automation,params-visual |
| `charaPutFSR` | 3 | separator | `','` 时进入坐标形式 |  | high | automation,params-visual |
| `charaPutFSR` | 4 | int | Y 坐标(仅 pd[3]==',' 时) |  | high | automation,params-visual |
| `charaPutFSRNotNotch` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaPutFSRNotNotch` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaPutFSRNotNotch` | 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 |  | high | automation,params-visual |
| `charaPutFSRNotNotch` | 3 | separator | `','` 时进入坐标形式 |  | high | automation,params-visual |
| `charaPutFSRNotNotch` | 4 | int | Y 坐标(仅 pd[3]==',' 时) |  | high | automation,params-visual |
| `charaPutFSSideL` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaPutFSSideL` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaPutFSSideL` | 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 |  | high | automation,params-visual |
| `charaPutFSSideL` | 3 | separator | `','` 时进入坐标形式 |  | high | automation,params-visual |
| `charaPutFSSideL` | 4 | int | Y 坐标(仅 pd[3]==',' 时) |  | high | automation,params-visual |
| `charaPutFSSideR` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaPutFSSideR` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaPutFSSideR` | 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 |  | high | automation,params-visual |
| `charaPutFSSideR` | 3 | separator | `','` 时进入坐标形式 |  | high | automation,params-visual |
| `charaPutFSSideR` | 4 | int | Y 坐标(仅 pd[3]==',' 时) |  | high | automation,params-visual |
| `charaRelativeLoopMove` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaRelativeLoopMove` | 2 | int | 循环段数(相对位移次数;长度=6*n+5) |  | high | automation,params-visual |
| `charaRelativeLoopMoveEase` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaRelativeLoopMoveEase` | 2 | int | 循环段数(相对位移次数;长度=6*n+5) |  | high | automation,params-visual |
| `charaRelativeLoopMoveStop` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaRelativeLoopMoveStop` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaRelativeLoopMoveStop` | 4 | string | 颜色(名称或 #RRGGBB) |  | medium | automation,params-visual |
| `charaRelativePut` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaRelativePut` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaRelativePut` | 2 | int | 位置:单值=位置下标;pd[3]==',' 时为 X 坐标 |  | high | automation,params-visual |
| `charaRelativePut` | 3 | separator | `','` 时进入坐标形式 |  | high | automation,params-visual |
| `charaRelativePut` | 4 | int | Y 坐标(仅 pd[3]==',' 时) |  | high | automation,params-visual |
| `charaReturn` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaReturn` | 1 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `charaReturn` | 2 | ? | 未知 |  | low | automation,params-visual |
| `charaRoll` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaRoll` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaRoll` | 2 | ? | 旋转角(度) |  | low | automation,params-visual |
| `charaRoll` | 4 | ? | 旋转角增量/轴参数 |  | low | automation,params-visual |
| `charaRoll` | 5 | string | 首字符必须为 ','(格式校验) |  | high | automation,params-visual |
| `charaRoll` | 6 | ? | 时长(秒;pd[5]==',' 时) |  | low | automation,params-visual |
| `charaRollAxis` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaRollAxis` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaRollAxis` | 2 | string | 立绘/资源名 |  | high | automation,params-visual |
| `charaRollAxis` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaRollAxis` | 4 | string | 颜色(名称或 #RRGGBB) |  | medium | automation,params-visual |
| `charaRollAxis` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaRollAxis` | 6 | ? | 未知 |  | low | automation,params-visual |
| `charaRollAxis` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaRollAxis` | 9 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaRollAxisLoopStop` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaRollMove` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaRollMove` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaRollMove` | 2 | ? | 旋转角(度) |  | low | automation,params-visual |
| `charaRollMove` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaRollMove` | 4 | ? | 时长(秒) |  | low | automation,params-visual |
| `charaRollMoveEx` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaRollMoveEx` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaRollMoveEx` | 2 | float | 时长(秒;Single.Parse) |  | high | automation,params-visual |
| `charaRollMoveEx` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaRollMoveEx` | 4 | string | 颜色(名称或 #RRGGBB) |  | medium | automation,params-visual |
| `charaRollMoveEx` | 6 | int | 目标 X 坐标(GetPosition(float,float)) |  | medium | automation,params-visual |
| `charaRollMoveEx` | 7 | string | 首字符必须为 ','(格式校验) |  | high | automation,params-visual |
| `charaRollMoveEx` | 8 | int | 目标 Y 坐标 |  | medium | automation,params-visual |
| `charaScale` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaScale` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaScale` | 2 | ? | 缩放值(倍率) |  | low | automation,params-visual |
| `charaSet` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaSet` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `charaSet` | 2 | string | 立绘/图片资源名(ConvertNameString) |  | high | automation,params-visual |
| `charaSet` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | high | automation,params-visual |
| `charaSet` | 4 | int | 位置(pd[4]=下标 或 X 坐标);其后可选参数原样保留在 ScriptCharaData.afterParam(GetAfterParam) |  | high | automation,params-visual |
| `charaSet` | 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 |  | high | automation,params-visual |
| `charaSet` | 6 | int | Y 坐标(仅 pd[5]==',' 时) |  | high | automation,params-visual |
| `charaSet` | 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) |  | high | automation,params-visual |
| `charaShadow` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaShadow` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaShadow` | 2 | ? | 布尔(true/false;与 'true' 比较@0x317e778) |  | high | automation,params-visual |
| `charaShake` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaShake` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaShake` | 2 | ? | 时长(秒) |  | low | automation,params-visual |
| `charaShake` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaShake` | 4 | ? | 周期(秒) |  | low | automation,params-visual |
| `charaShake` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaShake` | 6 | ? | X 振幅 |  | low | automation,params-visual |
| `charaShake` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaShake` | 8 | ? | Y 振幅 |  | low | automation,params-visual |
| `charaShakeStop` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaSpecialEffect` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaSpecialEffect` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaSpecialEffect` | 2 | string | 特效名(ConvertNameString) |  | high | automation,params-visual |
| `charaSpecialEffect` | 3 | separator | 分隔符/占位(见 0x318d444 比较) |  | medium | automation,params-visual |
| `charaSpecialEffect` | 5 | separator | `','`=坐标形式(x,y) |  | medium | automation,params-visual |
| `charaSpecialEffect` | 7 | separator | 分隔符 |  | medium | automation,params-visual |
| `charaSpecialEffect` | 9 | separator | 分隔符(守卫 pd[10]=颜色) |  | medium | automation,params-visual |
| `charaSpecialEffect` | 10 | string | 颜色名(black/white/#RRGGBB 等) |  | medium | automation,params-visual |
| `charaSpecialEffect` | 11 | separator | 分隔符 |  | medium | automation,params-visual |
| `charaSpecialEffectPause` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaSpecialEffectPause` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `charaSpecialEffectPause` | 2 | string | 特效名(ConvertNameString) |  | high | automation,params-visual |
| `charaSpecialEffectPause` | 3 | separator | 分隔符/占位(见 0x318d444 比较) |  | medium | automation,params-visual |
| `charaSpecialEffectPause` | 5 | separator | `','`=坐标形式(x,y) |  | medium | automation,params-visual |
| `charaSpecialEffectPause` | 7 | separator | 分隔符 |  | medium | automation,params-visual |
| `charaSpecialEffectPause` | 9 | separator | 分隔符(守卫 pd[10]=颜色) |  | medium | automation,params-visual |
| `charaSpecialEffectPause` | 10 | string | 颜色名(black/white/#RRGGBB 等) |  | medium | automation,params-visual |
| `charaSpecialEffectPause` | 11 | separator | 分隔符 |  | medium | automation,params-visual |
| `charaSpecialEffectStart` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaSpecialEffectStart` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaSpecialEffectStart` | 2 | string | 名称字符串(立绘/资源/对象名) |  | high | automation |
| `charaSpecialEffectStart` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaSpecialEffectStart` | 4 | string | 颜色(名称或 #RRGGBB) |  | medium | automation,params-visual |
| `charaSpecialEffectStop` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `charaSpecialEffectStop` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `charaSpecialEffectStop` | 2 | string | 名称字符串(立绘/资源/对象名) |  | high | automation |
| `charaTalk` | 0 | ? | 说话人槽位(ConvertCharaIndexTalk→SetTalkIndex) |  | high | automation,params-visual |
| `charaTalk` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `clear` | 0 | string[] | 整段 pd（同 page） | — | low | automation,params-misc |
| `communicationChara` | 0 | string | 子层名(#A 等) |  | medium | automation,params-visual |
| `communicationChara` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `communicationChara` | 2 | float | 时长(秒) |  | medium | automation,params-visual |
| `communicationChara` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `communicationChara` | 4 | float | 目标 alpha(0-1) |  | medium | automation,params-visual |
| `communicationChara` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `communicationChara` | 6 | string | 翻转/朝向(H/V/F/其他) |  | medium | automation,params-visual |
| `communicationChara` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `communicationChara` | 8 | string | 翻转/朝向(H/V/F/其他) |  | medium | automation,params-visual |
| `communicationChara` | 9 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `communicationCharaClear` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `communicationCharaClear` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `communicationCharaFace` | 0 | string | 表情类型(Face.Type;SetFace.faceType) |  | high | automation,params-visual |
| `communicationCharaLoop` | 0 | string | 子层名(#A 等) |  | medium | automation,params-visual |
| `communicationCharaLoop` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `communicationCharaLoop` | 2 | float | 时长(秒) |  | medium | automation,params-visual |
| `communicationCharaLoop` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `communicationCharaLoop` | 4 | float | 目标 alpha(0-1) |  | medium | automation,params-visual |
| `communicationCharaLoop` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `communicationCharaLoop` | 6 | string | 翻转/朝向(H/V/F/其他) |  | medium | automation,params-visual |
| `communicationCharaLoop` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `communicationCharaLoop` | 8 | string | 翻转/朝向(H/V/F/其他) |  | medium | automation,params-visual |
| `communicationCharaLoop` | 9 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `communicationCharaStop` | 0 | string | 传给 changeVolumeSe() 的参数 `name`(string) |  | low | automation |
| `criMovie` | 0 | string | 影片名（CRI） | 资源名 | medium | automation,params-misc |
| `cueSe` | 0 | string | 资源名 assetName | 资源名 | high | automation,params-misc |
| `cueSe` | 2 | string | 对象名 objectName | 对象名 | high | automation,params-misc |
| `cueSe` | 4 | float | 参数 A | — | low | automation,params-misc |
| `cueSe` | 6 | float | 参数 B | — | low | automation,params-misc |
| `cueSeContinue` | 0 | string | SE 名 | 资源名 | medium | automation,params-misc |
| `cueSeContinue` | 2 | string | SE 名/对象名（PlaySeContinue(name)） | — | medium | automation,params-misc |
| `cueSeContinue` | 4 | float | 参数 | — | low | automation,params-misc |
| `cueSeContinue` | 6 | float | 参数 | — | low | automation,params-misc |
| `cueSeContinue` | 8 | int | 续播编号 id | 整数 | low | automation,params-misc |
| `cueSeContinueStop` | 0 | string | SE 名 | 资源名 | low | automation,params-misc |
| `cueSeContinueStop` | 2 | float | 淡出时间 | 秒 | low | automation,params-misc |
| `cueSeContinueStop` | 4 | int | 续播编号 | 整数 | low | automation,params-misc |
| `cueSeContinueVolume` | 0 | string | SE 名 | 资源名 | low | automation,params-misc |
| `cueSeContinueVolume` | 2 | float | 渐变时间 | 秒 | low | automation,params-misc |
| `cueSeContinueVolume` | 4 | float | 音量 | 0.0–1.0 | low | automation,params-misc |
| `cueSeContinueVolume` | 6 | int | 续播编号 | 整数 | low | automation,params-misc |
| `cueSeStop` | 0 | string | SE 名 | 资源名 | medium | automation,params-misc |
| `cueSeStop` | 2 | float | 淡出时间 | 秒 | medium | automation,params-misc |
| `cueSeVolume` | 0 | string | SE 名 | 资源名 | high | automation,params-misc |
| `cueSeVolume` | 2 | float | 渐变时间 fadeTime | 秒 | medium | automation,params-misc |
| `cueSeVolume` | 4 | float | 音量 volume | 0.0–1.0 | medium | automation,params-misc |
| `cueVoice` | 0 | string | 语音名 | 资源名 | low | automation,params-misc |
| `cueVoice` | 2 | string | 对象名/参数 | — | low | automation,params-misc |
| `cueVoice` | 4 | string/float | 参数 | — | low | automation,params-misc |
| `cueVoiceStop` | 0 | string | 语音名 | 资源名 | low | automation,params-misc |
| `cueVoiceStop` | 2 | float | 淡出时间 | 秒 | low | automation,params-misc |
| `cueVoiceVolume` | 0 | string | 语音名 | 资源名 | low | automation,params-misc |
| `cueVoiceVolume` | 2 | float | 渐变时间 | 秒 | low | automation,params-misc |
| `cueVoiceVolume` | 4 | float | 音量 | 0.0–1.0 | low | automation,params-misc |
| `delay` | 0 | int | 延迟槽编号（executeDelayParam 数组下标） | 0..上限 | high | automation,params-misc |
| `delay` | 2 | float | 延迟秒数 | 秒 | high | automation,params-misc |
| `delay` | 4 | int | 标志(0/1)：skipDropFlag = (值==0) | 0 或 1 | medium | automation,params-misc |
| `delayEnd` | 0 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `delayStop` | 0 | int | 延迟槽编号 index | 整数 | high | automation,params-misc |
| `delayStop` | 2 | int | skipFlag（1/2 等，传给 DelayStop 的 skipFlag） | 1/2 | medium | automation,params-misc |
| `delayStopAll` | 0 | int | 起始编号（int，用作循环起点） | 整数 | low | automation,params-misc |
| `distortionloop` | 0 | float | 滤镜参数 1(SetCameraFilter.paramsFloat 数组的首值) |  | low | automation,params-visual |
| `distortionloop` | 2 | float | 滤镜参数 2 |  | low | automation,params-visual |
| `distortionloop` | 4 | float | 滤镜参数 3 |  | low | automation,params-visual |
| `distortionloop` | 6 | float | 滤镜参数 4 |  | low | automation,params-visual |
| `distortionloop` | 8 | float | 滤镜参数 5 |  | low | automation,params-visual |
| `distortionloop` | 10 | float | 滤镜参数 6 |  | low | automation,params-visual |
| `distortionloop` | 12 | float | 滤镜参数 7(SetCameraFilter.paramsFloat) |  | medium | automation,params-visual |
| `distortionstart` | 0 | float | 滤镜参数 1(SetCameraFilter.paramsFloat 数组的首值) |  | low | automation,params-visual |
| `distortionstart` | 2 | float | 滤镜参数 2 |  | low | automation,params-visual |
| `distortionstart` | 4 | float | 滤镜参数 3 |  | low | automation,params-visual |
| `distortionstart` | 6 | float | 滤镜参数 4 |  | low | automation,params-visual |
| `distortionstart` | 8 | float | 滤镜参数 5 |  | low | automation,params-visual |
| `distortionstart` | 10 | float | 滤镜参数 6 |  | low | automation,params-visual |
| `distortionstop` | 0 | ? | 未知 |  | low | automation,params-visual |
| `effect` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `effect` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `effect` | 3 | separator | `','`(坐标形式) |  | high | automation,params-visual |
| `effect` | 5 | separator | 分隔符 `' '`(守卫 pd[6]=翻转/朝向) |  | medium | automation,params-visual |
| `effect` | 6 | string | 翻转/朝向 H/V/F(ConvertEffectFlipKind) |  | high | automation,params-visual |
| `effect` | 10 | string | 画框图片(ConvertPictureFrameImageName) |  | medium | automation,params-visual |
| `effectDestroy` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `effectForceStop` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `effectPause` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `effectPause` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `effectPause` | 3 | separator | `','`(坐标形式) |  | high | automation,params-visual |
| `effectPause` | 5 | separator | 分隔符 `' '`(守卫 pd[6]=翻转/朝向) |  | medium | automation,params-visual |
| `effectPause` | 6 | string | 翻转/朝向 H/V/F(ConvertEffectFlipKind) |  | high | automation,params-visual |
| `effectPause` | 10 | string | 画框图片(ConvertPictureFrameImageName) |  | medium | automation,params-visual |
| `effectStart` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `effectStop` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `effectmessageDestroy` | 0 | string | 特效名 | 资源名 | high | automation,params-misc,params-visual |
| `effectmessageStop` | 0 | string | 特效名（Talk/<name>） | 资源名 | high | automation,params-misc,params-visual |
| `else` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `enableFullScreen` | 0 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `enableWaitLoadAssetWhenResume` | 0 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `end` | 0 | string | 结束淡出颜色 | white / black / 空(\` \`) | high | automation,params-misc |
| `endFade` | 0 | string | 'clear'=清除淡出状态(与 'clear' 比较;否则按其他值处理) |  | high | automation,params-visual |
| `endIf` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `equipChange` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `equipChange` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `equipChange` | 2 | string | 装备图片名(ConvertNameString) |  | high | automation,params-visual |
| `equipChange` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `equipChange` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `equipSet` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `equipSet` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `equipSet` | 2 | string | 从者ID(数字串;经 TryParse→master→maleImageId/默认形象解析成 C 编号立绘) |  | high | automation,params-visual |
| `equipSet` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | high | automation,params-visual |
| `equipSet` | 4 | int | 位置:单值=位置下标;若 pd[5]==',' 则本值为 X 坐标 |  | high | automation,params-visual |
| `equipSet` | 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 |  | high | automation,params-visual |
| `equipSet` | 6 | int | Y 坐标(仅 pd[5]==',' 时) |  | high | automation,params-visual |
| `equipSet` | 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) |  | high | automation,params-visual |
| `f` | 0 | string | 传给 SetFontSize() 的参数 `sizeName`(string) |  | high | automation |
| `faceTalkScreen` | — | — | 把消息窗口背景切成头像对话样式(AtlasManager.SetWarBoardImage;无参数) | | | — |
| `fadeMove` | 0 | string | 颜色名(black/white/#RRGGBB 等) |  | high | automation,params-visual |
| `fadeMove` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `fadeMove` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `fadeMove` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `fadeMove` | 4 | float | 透明度/强度(0-1)(目标强度) |  | high | automation,params-visual |
| `fadeOff` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `fadeOff` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `fadein` | 0 | string | 颜色/遮罩名(black/white/#RRGGBB) |  | high | automation,params-visual |
| `fadein` | 4 | string | 附带选项(StartFade 第 4 参 withFrameOption) |  | high | automation,params-visual |
| `fadeout` | 0 | string | 颜色/遮罩名(black/white/#RRGGBB) |  | high | automation,params-visual |
| `fadeout` | 4 | string | 附带选项(StartFade 第 4 参 withFrameOption) |  | high | automation,params-visual |
| `figureChange` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `figureChange` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `figureChange` | 2 | string | 新立绘名+形态(GetCharaImageNameAndFormId) |  | high | automation,params-visual |
| `figureChange` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `figureChange` | 4 | string | 附加名称 |  | high | automation,params-visual |
| `figureChange` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `figureChange` | 6 | string | 颜色名(black/white/#RRGGBB 等) |  | high | automation,params-visual |
| `figureChange` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `figureChange` | 8 | string | 颜色名(black/white/#RRGGBB 等) |  | high | automation,params-visual |
| `figureSet` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `figureSet` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `figureSet` | 2 | string | 立绘/图片资源名(ConvertNameString) |  | high | automation,params-visual |
| `figureSet` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | high | automation,params-visual |
| `figureSet` | 4 | int | 位置:单值=位置下标;若 pd[5]==',' 则本值为 X 坐标 |  | high | automation,params-visual |
| `figureSet` | 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 |  | high | automation,params-visual |
| `figureSet` | 6 | int | Y 坐标(仅 pd[5]==',' 时) |  | high | automation,params-visual |
| `figureSet` | 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) |  | high | automation,params-visual |
| `flag` | 0 | string | flag 名 | flag 名（SearchFlag） | high | automation,params-misc |
| `flag` | 2 | string | 设置值 | true/false | high | automation,params-misc |
| `flagRandom` | 0 | string | flag 名 | flag 名 | high | automation,params-misc |
| `flagRandom` | 2 | int | 随机下限/权重 | 整数 | medium | automation,params-misc |
| `flagRandom` | 4 | int | 随机上限 | 整数 | medium | automation,params-misc |
| `flashOff` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `flashOffDep` | 0 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `flashin` | 0 | string | 闪光名(Flash/<name>) |  | high | automation,params-visual |
| `flashin` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `flashin` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `flashin` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `flashin` | 6 | string | 起始颜色(ConvertColor) |  | medium | automation,params-visual |
| `flashin` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `flashin` | 8 | string | 结束颜色(ConvertColor) |  | medium | automation,params-visual |
| `flashinDep` | 0 | string | 闪光名(Flash/<name>) |  | high | automation,params-visual |
| `flashinDep` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `flashinDep` | 2 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `flashinDep` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `flashinDep` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `flashinDep` | 6 | string | 起始颜色(ConvertColor) |  | medium | automation,params-visual |
| `flashinDep` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `flashinDep` | 8 | string | 结束颜色(ConvertColor) |  | medium | automation,params-visual |
| `flashinDep` | 10 | string | 叠加角色槽位(ConvertCharaIndex) |  | low | automation,params-visual |
| `flashout` | 0 | float | 后段时长(秒;EndFlash) |  | high | automation,params-visual |
| `flashoutDep` | 0 | float | 后段时长(秒;EndFlash) |  | high | automation,params-visual |
| `font` | 0 | string | 传给 SetFontSize() 的参数 `sizeName`(string) |  | high | automation |
| `fontSize` | 0 | string | 字号名 / 字体名 | small/medium/large/x-small/x-large/normal | high | automation,params-misc |
| `fontSize` | 2 | string | 垂直对齐名（仅 ≥2 值时） | top/center/bottom | medium | automation,params-misc |
| `fontType` | 0 | string | 字体名；normal=默认字体 | normal / 资源名 | high | automation,params-misc |
| `fowardEffect` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `fowardEffect` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `fowardEffect` | 2 | int |  |  | ? | automation |
| `fowardEffect` | 3 | separator | `','`(坐标形式) |  | high | automation,params-visual |
| `fowardEffect` | 5 | separator | 分隔符 `' '`(守卫 pd[6]=翻转/朝向) |  | medium | automation,params-visual |
| `fowardEffect` | 6 | string | 翻转/朝向(ConvertEffectFlipKind) |  | medium | automation,params-visual |
| `fowardEffect` | 27 | string | 附加参数(超出常规布局,含义未证实) |  | low | automation,params-visual |
| `fowardEffectDestroy` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `fowardEffectPause` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `fowardEffectPause` | 1 | separator | 分隔符 `' '` |  | high | automation,params-visual |
| `fowardEffectPause` | 2 | int |  |  | ? | automation |
| `fowardEffectPause` | 3 | separator | `','`(坐标形式) |  | high | automation,params-visual |
| `fowardEffectPause` | 5 | separator | 分隔符 `' '`(守卫 pd[6]=翻转/朝向) |  | medium | automation,params-visual |
| `fowardEffectPause` | 6 | string | 翻转/朝向(ConvertEffectFlipKind) |  | medium | automation,params-visual |
| `fowardEffectPause` | 27 | string | 附加参数(超出常规布局,含义未证实) |  | low | automation,params-visual |
| `fowardEffectStart` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `fowardEffectStop` | 0 | string | 特效名(Talk/<name>) |  | high | automation,params-visual |
| `fsmObjDestroy` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `fsmObjLayer` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `fsmObjLayer` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `fsmObjLayer` | 2 | string | 层名('ui' 等) |  | high | automation,params-visual |
| `fsmObjLayer` | 4 | string | 层名/层级参数 |  | low | automation,params-visual |
| `fsmObjLayer` | 5 | string | 首字符必须为 ','(格式校验) |  | high | automation,params-visual |
| `fsmObjLayer` | 6 | string | 附加参数 |  | low | automation,params-visual |
| `fsmObjSendEvent` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `fsmObjSendEvent` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `fsmObjSendEvent` | 2 | string | 事件名(Fsm.SendEvent) |  | low | automation,params-visual |
| `fsmObjSet` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `fsmObjSet` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `fsmObjSet` | 2 | string | 变量名(Fsm 变量) |  | low | automation,params-visual |
| `fsmObjSet` | 4 | string | 变量值 |  | low | automation,params-visual |
| `fsmObjSetBool` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `fsmObjSetBool` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `fsmObjSetBool` | 2 | string | 变量名 |  | low | automation,params-visual |
| `fsmObjSetBool` | 4 | bool | 布尔值(true/false) |  | high | automation,params-visual |
| `fsmObjSetFloat` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `fsmObjSetFloat` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `fsmObjSetFloat` | 2 | string | 变量名 |  | low | automation,params-visual |
| `fsmObjSetFloat` | 4 | float | 浮点值 |  | high | automation,params-visual |
| `fsmObjSetState` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `fsmObjSetState` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `fsmObjSetState` | 2 | string | 状态名(Fsm.SetState) |  | low | automation,params-visual |
| `fsmObjSetString` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `fsmObjSetString` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `fsmObjSetString` | 2 | string | 变量名 |  | low | automation,params-visual |
| `fsmObjSetString` | 4 | string | 字符串值 |  | high | automation,params-visual |
| `horizontalImageChange` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `horizontalImageChange` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `horizontalImageChange` | 2 | string | 立绘/图片名(ConvertNameString) |  | high | automation,params-visual |
| `horizontalImageChange` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `horizontalImageChange` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `horizontalImageSet` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `horizontalImageSet` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `horizontalImageSet` | 2 | string | 立绘/图片资源名(ConvertNameString) |  | high | automation,params-visual |
| `horizontalImageSet` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | high | automation,params-visual |
| `horizontalImageSet` | 4 | int | 位置:单值=位置下标;若 pd[5]==',' 则本值为 X 坐标 |  | high | automation,params-visual |
| `horizontalImageSet` | 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 |  | high | automation,params-visual |
| `horizontalImageSet` | 6 | int | Y 坐标(仅 pd[5]==',' 时) |  | high | automation,params-visual |
| `horizontalImageSet` | 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) |  | high | automation,params-visual |
| `ifClear` | 0 | string | 判断用的 flag / 条件名 |  | medium | automation,manual |
| `imageChange` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `imageChange` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `imageChange` | 2 | string | 立绘/图片名(ConvertNameString) |  | high | automation,params-visual |
| `imageChange` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `imageChange` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `imageSet` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `imageSet` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `imageSet` | 2 | string | 立绘/图片资源名(ConvertNameString) |  | high | automation,params-visual |
| `imageSet` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | high | automation,params-visual |
| `imageSet` | 4 | int | 位置:单值=位置下标;若 pd[5]==',' 则本值为 X 坐标 |  | high | automation,params-visual |
| `imageSet` | 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 |  | high | automation,params-visual |
| `imageSet` | 6 | int | Y 坐标(仅 pd[5]==',' 时) |  | high | automation,params-visual |
| `imageSet` | 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) |  | high | automation,params-visual |
| `input` | 0 | string | 子关键词 | selectBranch / selectBranchSkipTrueColor | high | automation,params-misc |
| `input` | 2 | string | selectBranch 时：子模式（skipStop=检查条件后跳过） | skipStop（0x317a950） | medium | automation,params-misc |
| `input` | 4 | string | 传给 IsWithInScriptCondition() 的参数 `conditionScript`(string) |  | high | automation |
| `insertionAnimationEnd` | 0 | string | 插入动画名(Find/PlayAnimation) |  | high | automation,params-visual |
| `insertionAnimationSet` | 0 | string | 插入动画名(InsertionAnimations/<name>) |  | high | automation,params-visual |
| `insertionAnimationSetFSL` | 0 | string | 插入动画名 |  | high | automation,params-visual |
| `insertionAnimationSetFSR` | 0 | string | 插入动画名 |  | high | automation,params-visual |
| `insertionAnimationSetFSSideL` | 0 | string | 插入动画名 |  | high | automation,params-visual |
| `insertionAnimationSetFSSideR` | 0 | string | 插入动画名 |  | high | automation,params-visual |
| `insertionAnimationStart` | 0 | string | 插入动画名(Find/PlayAnimation) |  | high | automation,params-visual |
| `interruption` | 0 | string | 结束淡出颜色 | white/black/` ` | medium | automation,params-misc |
| `jingle` | 0 | string | jingle 名 | 资源名 | medium | automation,params-misc |
| `jingle` | 2 | float | 音量 | 0.0–1.0 | medium | automation,params-misc |
| `jingleStop` | 0 | string | 传给 isPlayJingle() 的参数 `name`(string) |  | high | automation |
| `jump` | 0 | string | 目标标签名（第 1 值） | 标签名 | medium | automation,params-misc |
| `jump` | 2 | string | 名称字符串(立绘/资源/对象名) |  | high | automation |
| `k` | 0 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `keepSubBgmOff` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `keepSubBgmOn` | 0 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `l` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `label` | 0 | string | 标签名；特殊值 'skip'（=跳转时跳过标记） | 标签名 / skip | high | automation,params-misc |
| `maskOff` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `maskin` | 0 | string | 遮罩名(ConvertNameString→StartMask.name) |  | high | automation,params-visual |
| `maskin` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `maskin` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `maskout` | 0 | string | 遮罩名(ConvertNameString→StartMask.name) |  | high | automation,params-visual |
| `maskout` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `maskout` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `masterBranch` | 0 | string | 名称(ConvertNameString) |  | high | automation,params-visual |
| `masterBranch` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterBranch` | 2 | string | 分支值 | — | low | automation,params-misc |
| `masterBranch` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterBranch` | 4 | string | 颜色名(black/white/#RRGGBB 等) |  | high | automation,params-visual |
| `masterBranch` | 8 | string | 画框图片名(ConvertPictureFrameImageName) |  | high | automation,params-visual |
| `masterChange` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `masterChange` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterChange` | 2 | string | 立绘/资源名 |  | high | automation,params-visual |
| `masterChange` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterChange` | 4 | string | 颜色名(black/white/#RRGGBB 等) |  | high | automation,params-visual |
| `masterChange` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterChange` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterChange` | 9 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterHorizontalImageChange` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `masterHorizontalImageChange` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterHorizontalImageChange` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterHorizontalImageChange` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterHorizontalImageChange` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterHorizontalImageSet` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `masterHorizontalImageSet` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterHorizontalImageSet` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterImageChange` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `masterImageChange` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterImageChange` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterImageChange` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterImageChange` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterImageSet` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `masterImageSet` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterImageSet` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterNameWidth` | 0 | string | 替换字符串/名字键(ScriptReplaceString.GetString) |  | medium | automation,params-visual |
| `masterNameWidth` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterNameWidth` | 2 | string | 名字文本 |  | low | automation,params-visual |
| `masterNameWidth` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterNameWidth` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterNameWidth` | 6 | string | 翻转/朝向(H/V/F/其他) |  | medium | automation,params-visual |
| `masterNameWidth` | 8 | string | 画框图片名(ConvertPictureFrameImageName) |  | high | automation,params-visual |
| `masterScene` | 0 | string | 颜色/遮罩名(StartFadeMove) |  | high | automation,params-visual |
| `masterScene` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterScene` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `masterScene` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterScene` | 4 | float | 透明度/强度(0-1) |  | high | automation,params-visual |
| `masterSet` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `masterSet` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterSet` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterVerticalImageChange` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `masterVerticalImageChange` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterVerticalImageChange` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterVerticalImageChange` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterVerticalImageChange` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterVerticalImageSet` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `masterVerticalImageSet` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `masterVerticalImageSet` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `menu` | 0 | string | 名称字符串(立绘/资源/对象名) |  | high | automation |
| `menu` | 2 | string | 菜单标签名 | 标签名 | medium | automation,params-misc |
| `messageAlign` | 0 | int/string | 对齐/行首参数（int 或对齐数据） | — | low | automation,params-misc |
| `messageAlign` | 2 | float | 浮点参数 | — | low | automation,params-misc |
| `messageAlign` | 4 | float | 浮点参数 | — | low | automation,params-misc |
| `messageChange` | 0 | string | 消息窗名（ScriptUI/MessageWindow/<name>） | 资源名 | high | automation,params-misc |
| `messageOff` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `messageOff` | 2 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `messageOn` | 0 | string | 划像名(拼成 Wipe/<name>) |  | low | automation |
| `messageShake` | 0 | float | 持续时间 duration | 秒 | medium | automation,params-misc |
| `messageShake` | 2 | float | 周期 cycle | 秒 | medium | automation,params-misc |
| `messageShake` | 4 | float | X 振幅 | 像素 | low | automation,params-misc |
| `messageShake` | 6 | float | Y 振幅 | 像素 | low | automation,params-misc |
| `messageShakeStop` | 0 | string | 划像名(拼成 Wipe/<name>) |  | low | automation |
| `messageSpeedForcedNormal` | 0 | string | 开关 | on / off | high | automation,params-misc |
| `messageStart` | 0 | string[] | 消息垂直对齐用参数数组（整段 pd 传入，解释在消息管理侧） | — | low | automation,params-misc |
| `movie` | 0 | string | 影片名（CRI） | 资源名 | medium | automation,params-misc |
| `notification` | 0 | string | 名称字符串(立绘/资源/对象名) |  | high | automation |
| `notification` | 2 | string | 名称字符串(立绘/资源/对象名) |  | high | automation |
| `overlayFadein` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `overlayFadein` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `overlayFadein` | 3 | ? | 未知 |  | low | automation,params-visual |
| `overlayFadein` | 5 | string | 首字符必须为 ','(格式校验) |  | high | automation,params-visual |
| `page` | 0 | string[] | 整段 pd（存入 waitType） | — | medium | automation,params-misc |
| `pictureFrame` | 0 | string | 画框图片名/参数 |  | low | automation,params-visual |
| `pictureFrame` | 2 | string | 传给 SetFontSize() 的参数 `verticalAlign` |  | medium | automation,params-visual |
| `pictureFrameTop` | 0 | string | 画框图片名/参数 |  | low | automation,params-visual |
| `pictureFrameTop` | 2 | string | 传给 SetFontSize() 的参数 `verticalAlign` |  | medium | automation,params-visual |
| `q` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `q` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `questMessageOverwrite` | 0 | string | 文本键/文本 | 文本（与常量 'QuestMessageAdd' 拼接） | medium | automation,params-misc |
| `revivalBranch` | 0 | string | 分支值/名称 | — | low | automation,params-misc |
| `revivalBranch` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `rewardSwitch` | 0 | string | 开关 | true/false | medium | automation,params-misc |
| `s` | 0 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `s` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `scene` | 0 | string | 颜色/遮罩名(StartFadeMove) |  | high | automation,params-visual |
| `scene` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `scene` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `scene` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `scene` | 4 | float | 透明度/强度(0-1) |  | high | automation,params-visual |
| `sceneSet` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `sceneSet` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `sceneSet` | 2 | string | 立绘/图片资源名(ConvertNameString) |  | high | automation,params-visual |
| `sceneSet` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | high | automation,params-visual |
| `sceneSet` | 4 | int | 位置:单值=位置下标;若 pd[5]==',' 则本值为 X 坐标 |  | high | automation,params-visual |
| `sceneSet` | 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 |  | high | automation,params-visual |
| `sceneSet` | 6 | int | Y 坐标(仅 pd[5]==',' 时) |  | high | automation,params-visual |
| `sceneSet` | 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) |  | high | automation,params-visual |
| `screen` | 0 | string | 子层 key(#A 等;SetScreen) |  | high | automation,params-visual |
| `screen` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `screen` | 2 | int | x | 像素 | medium | automation,params-misc |
| `screen` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `screen` | 4 | int | y | 像素 | medium | automation,params-misc |
| `screen` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `screen` | 6 | int | w | 像素 | medium | automation,params-misc |
| `screen` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `screen` | 8 | int | h | 像素 | medium | automation,params-misc |
| `scrollStop` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `scrollStop` | 2 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `se` | 0 | string | SE 名 | 资源名（ConvertNameString） | high | automation,params-misc |
| `se` | 2 | float | 3 值形式：音量 volume；5 值形式：淡入时间 fadeinTime | 0.0-1.0 / 秒 | high | automation,params-misc |
| `se` | 4 | float | 音量 volume（5 值形式） | 0.0-1.0 | high | automation,params-misc |
| `seContinue` | 0 | string | SE 名 | 资源名 | high | automation,params-misc |
| `seContinue` | 2 | float | 淡入时间 fadeinTime | 秒 | medium | automation,params-misc |
| `seContinue` | 4 | float | 音量 volume | 0.0–1.0 | medium | automation,params-misc |
| `seContinue` | 6 | int | 续播编号 id（脚本内唯一键） | 整数 | medium | automation,params-misc |
| `seContinueStop` | 0 | string | SE 名 | 资源名 | medium | automation,params-misc |
| `seContinueStop` | 2 | float | 淡出时间 | 秒 | medium | automation,params-misc |
| `seContinueStop` | 4 | int | 续播编号 id | 整数 | low | automation,params-misc |
| `seContinueVolume` | 0 | string | SE 名 | 资源名 | low | automation,params-misc |
| `seContinueVolume` | 2 | float | 渐变时间 fadeTime | 秒 | low | automation,params-misc |
| `seContinueVolume` | 4 | float | 音量 volume | 0.0–1.0 | low | automation,params-misc |
| `seContinueVolume` | 6 | int | 续播编号 id | 整数 | low | automation,params-misc |
| `seLoop` | 0 | string | SE 名 | 资源名 | medium | automation,params-misc |
| `seLoop` | 2 | float | 淡入时间 fadeInTime | 秒 | medium | automation,params-misc |
| `seLoop` | 4 | float | 音量 volume | 0.0-1.0 | medium | automation,params-misc |
| `seStop` | 0 | string | SE 名 | 资源名 | medium | automation,params-misc |
| `seStop` | 2 | float | 淡出时间 fadeoutTime | 秒 | medium | automation,params-misc |
| `seVolume` | 0 | string | SE 名 | 资源名 | high | automation,params-misc |
| `seVolume` | 2 | float | 淡出/渐变时间 fadeTime | 秒 | medium | automation,params-misc |
| `seVolume` | 4 | float | 音量 volume | 0.0–1.0 | medium | automation,params-misc |
| `selectionCentering` | 0 | bool | 是否居中 | true/false（Boolean.TryParse） | high | automation,params-misc,params-visual |
| `selectionUse` | 0 | string | 传给 GetScriptSubLayer() 的参数 `layerKey`(string) |  | low | automation |
| `shake` | 0 | float | 抖动时长(秒) |  | high | automation,manual |
| `shake` | 2 | float | 抖动周期(cycle,秒;越大越慢) |  | high | automation,manual |
| `shake` | 4 | float | X 方向幅度 |  | high | automation,manual |
| `shake` | 6 | float | Y 方向幅度 |  | high | automation,manual |
| `shakeStop` | 0 | - | 无参数(或忽略) |  | medium | automation,manual |
| `skip` | 0 | string | 跳过开关 | true / false / allFalse | high | automation,params-misc |
| `soundStopAll` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `soundStopAllEnd` | 0 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `soundStopAllEnd` | 8 | string | 颜色([#RRGGBB] / 名称) |  | low | automation |
| `soundStopAllFade` | 0 | float | 淡出时间（秒） | 秒 | high | automation,params-misc |
| `specialEffect` | 0 | string | 特效名(ConvertNameString→CreateMainEffect) |  | high | automation,params-visual |
| `specialEffect` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `specialEffect` | 2 | int | X 坐标(位置) |  | low | automation,params-visual |
| `specialEffect` | 3 | separator | 分隔符 `,`(此位不是参数值) |  | high | automation,params-visual |
| `specialEffect` | 4 | int | Y 坐标(CreateMainEffect.pos) |  | high | automation,params-visual |
| `specialEffect` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `specialEffect` | 6 | string | 朝向/翻转(ConvertEffectFlipKind)或时长(time) |  | high | automation,params-visual |
| `specialEffect` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `specialEffect` | 8 | string | 颜色名(black/white/#RRGGBB 等) |  | high | automation,params-visual |
| `specialEffect` | 9 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `specialEffect` | 10 | string | 画框图片名(ConvertPictureFrameImageName) |  | high | automation,params-visual |
| `specialEffectPuase` | 0 | string | 资源/立绘名 |  | high | automation,params-visual |
| `specialEffectPuase` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `specialEffectPuase` | 2 | ? | 未知 |  | low | automation,params-visual |
| `specialEffectPuase` | 3 | separator | 分隔符 `,`(此位不是参数值) |  | high | automation,params-visual |
| `specialEffectPuase` | 4 | Vector3 | 传给 CreateMainEffect() 的参数 `pos.hfa` |  | medium | automation,params-visual |
| `specialEffectPuase` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `specialEffectPuase` | 6 | string | 翻转/朝向(H/V/F/其他) |  | medium | automation,params-visual |
| `specialEffectPuase` | 7 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `specialEffectPuase` | 8 | string | 颜色(名称或 #RRGGBB) |  | high | automation,params-visual |
| `specialEffectPuase` | 9 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `specialEffectPuase` | 10 | string | 画框图片(Image/<name>) |  | medium | automation,params-visual |
| `specialEffectStart` | 0 | string | 特效名(ConvertNameString→Resume) |  | high | automation,params-visual |
| `specialEffectStop` | 0 | string | 特效名(ConvertNameString) |  | high | automation,params-visual |
| `speed` | 0 | float | 速度倍率；'-' → -1.0 | -1 / 倍率 | high | automation,params-misc |
| `speed` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `spriteMaskOff` | 0 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `spriteMaskOff` | 8 | string | 颜色([#RRGGBB] / 名称) |  | low | automation |
| `spriteMaskSet` | 0 | string | 精灵遮罩名(Image/mask_<name>) |  | high | automation,params-visual |
| `spriteMaskSet` | 4 | string | 颜色(ConvertColor) |  | high | automation,params-visual |
| `stretchOff` | 0 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `stretchin` | 0 | string | 方向名(StartStretch.name) |  | high | automation,params-visual |
| `stretchin` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `stretchin` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `stretchin` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `stretchin` | 4 | float | 拉伸量(scale) |  | high | automation,params-visual |
| `stretchout` | 0 | string | 方向名(StartStretch.name) |  | high | automation,params-visual |
| `stretchout` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `stretchout` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `stretchout` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `stretchout` | 4 | float | 拉伸量(scale) |  | high | automation,params-visual |
| `subBgm` | 0 | string | BGM 名 | 资源名 | high | automation,params-misc |
| `subBgm` | 2 | float | 音量；0=默认 | 0.0–1.0 | medium | automation,params-misc |
| `subBgmStop` | 0 | string | BGM 名 / ` ` | 资源名 / ` ` | low | automation,params-misc |
| `subBgmStop` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `subBlur` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subBlur` | 2 | string | 方向名(StartSubStretch.name) |  | medium | automation,params-visual |
| `subBlur` | 4 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | medium | automation,params-visual |
| `subBlur` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `subBlur` | 6 | float | 拉伸/虚化强度(scale) |  | medium | automation,params-visual |
| `subBlur2` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subBlur2` | 2 | string | 方向名(StartSubStretch.name) |  | medium | automation,params-visual |
| `subBlur2` | 4 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | medium | automation,params-visual |
| `subBlur2` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `subBlur2` | 6 | float | 拉伸/虚化强度(scale) |  | medium | automation,params-visual |
| `subBlur2Off` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subBlur2Off` | 2 | string | 背景纹理名(Back/<name>) |  | medium | automation,params-visual |
| `subBlur2Off` | 4 | ? | 未知 |  | low | automation,params-visual |
| `subBlur2Off` | 6 | ? | 未知 |  | low | automation,params-visual |
| `subBlurOff` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subBlurOff` | 2 | string | 背景纹理名(Back/<name>) |  | medium | automation,params-visual |
| `subBlurOff` | 4 | ? | 未知 |  | low | automation,params-visual |
| `subBlurOff` | 6 | ? | 未知 |  | low | automation,params-visual |
| `subCameraFilter` | 0 | string | 子层 key(#A 等) |  | medium | automation,params-visual |
| `subCameraHome` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subCameraMove` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subCameraMove` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `subCameraMove` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `subCameraMove` | 4 | float | X 坐标 |  | high | automation,params-visual |
| `subCameraMove` | 5 | string | 首字符必须为 ','(格式校验) |  | high | automation,params-visual |
| `subCameraMove` | 6 | float | Y 坐标 |  | high | automation,params-visual |
| `subCameraMove` | 7 | string | 首字符必须为 ' '(格式校验) |  | high | automation,params-visual |
| `subCameraMoveEase` | 0 | float | X 坐标 |  | high | automation,params-visual |
| `subCameraMoveEase` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `subCameraOff` | 0 | string | 角色槽位索引(把 A-Z / 数字转成槽位号) |  | low | automation |
| `subCameraOn` | 0 | int | 子层数量/索引(RenderCameraSubStart.subLayerCount) |  | medium | automation,params-visual |
| `subCameraRoll` | 0 | float | 旋转角(度) |  | high | automation,params-visual |
| `subCameraRoll` | 2 | float | 旋转中心 X 偏移 |  | high | automation,params-visual |
| `subCameraRoll` | 3 | separator | `','`(中心偏移为坐标形式) |  | high | automation,params-visual |
| `subCameraRoll` | 4 | float | 旋转中心 Y 偏移 |  | high | automation,params-visual |
| `subCameraRoll` | 5 | string | 首字符必须为 ','(格式校验) |  | high | automation,params-visual |
| `subCameraRoll` | 6 | Vector3 | 传给 SetCameraRoll() 的参数 `centerOffset.hfa` |  | medium | automation,params-visual |
| `subCameraRollMove` | 0 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `subCameraRollMove` | 2 | float | 旋转角(度) |  | high | automation,params-visual |
| `subCameraRollMove` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `subCameraRollMove` | 4 | float | 旋转角(度) |  | medium | automation,params-visual |
| `subRenderDepth` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subRenderDepth` | 2 | float | 深度值(ScriptSubLayer.SetDepth) |  | high | automation,params-visual |
| `subRenderFadein` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subRenderFadeinFSL` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subRenderFadeinFSR` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subRenderFadeinFSSideL` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subRenderFadeinFSSideR` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subRenderFadeout` | 0 | string | 子层名(#A 等) |  | medium | automation,params-visual |
| `subRenderMove` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subRenderMoveEase` | 0 | string | 子层名(#A 等) |  | high | automation,params-visual |
| `subRenderMoveEaseFSL` | 0 | string | 子层名(#A 等) |  | high | automation,params-visual |
| `subRenderMoveEaseFSR` | 0 | string | 子层名(#A 等) |  | high | automation,params-visual |
| `subRenderMoveEaseFSSideL` | 0 | string | 子层名(#A 等) |  | high | automation,params-visual |
| `subRenderMoveEaseFSSideR` | 0 | string | 子层名(#A 等) |  | high | automation,params-visual |
| `subRenderMoveFSL` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subRenderMoveFSR` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subRenderMoveFSSideL` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subRenderMoveFSSideR` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subRenderMoveScale` | 0 | string | 子层名(#A 等) |  | medium | automation,params-visual |
| `subRenderMoveScaleEase` | 0 | string | 子层名(#A 等) |  | medium | automation,params-visual |
| `subRenderScale` | 0 | string | 子层名(#A 等) |  | medium | automation,params-visual |
| `subRenderShake` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subRenderShake` | 2 | float | 周期(cycle;Shake 第 2 参) |  | medium | automation,params-visual |
| `subRenderShake` | 4 | float | X 振幅 |  | high | automation,params-visual |
| `subRenderShake` | 6 | float | Y 振幅 |  | high | automation,params-visual |
| `subRenderShake` | 8 | float | 时长(秒) |  | high | automation,params-visual |
| `subRenderShakeStop` | 0 | string | 子层名(#A 等) |  | high | automation,params-visual |
| `subStretch` | 0 | string | 'on'/'off'(ScriptSubLayerManager.SetSubStretch) |  | high | automation,params-visual |
| `subStretch` | 2 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `subStretchin` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subStretchin` | 2 | string | 方向名(StartSubStretch.name) |  | high | automation,params-visual |
| `subStretchin` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `subStretchin` | 4 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `subStretchin` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `subStretchin` | 6 | float | 拉伸量(scale) |  | high | automation,params-visual |
| `subStretchout` | 0 | string | 子层 key(#A 等) |  | high | automation,params-visual |
| `subStretchout` | 2 | string | 方向名(StartSubStretch.name) |  | high | automation,params-visual |
| `subStretchout` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `subStretchout` | 4 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `subStretchout` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `subStretchout` | 6 | float | 拉伸量(scale) |  | high | automation,params-visual |
| `switchCase` | 0 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `switchCase` | 8 | string | 颜色([#RRGGBB] / 名称) |  | low | automation |
| `switchCaseEnd` | 0 | string | 名称字符串(立绘/资源/对象名) |  | high | automation |
| `switchCaseEnd` | 2 | string | 名称字符串(立绘/资源/对象名) |  | high | automation |
| `tVoice` | 0 | string | 语音名 | 资源名 | high | automation,params-misc |
| `tVoice` | 2 | string | 对象名 | 对象名（未转换，原样） | medium | automation,params-misc |
| `tVoice` | 4 | float | 浮点参数（时长/音量） | — | low | automation,params-misc |
| `tVoice` | 6 | string | 布尔参数（'true' 比较） | true/false | low | automation,params-misc |
| `tVoice` | 14 | int | int 参数 | — | low | automation,params-misc |
| `tVoice` | 16 | int | int 参数 | — | low | automation,params-misc |
| `tVoice` | 18 | int | int 参数 | — | low | automation,params-misc |
| `tVoiceUser` | 0 | string | 名称字符串(立绘/资源/对象名) |  | high | automation |
| `tVoiceUser` | 2 | string | 参数 | — | low | automation,params-misc |
| `tVoiceUser` | 4 | float | 浮点参数 | — | low | automation,params-misc |
| `tVoiceUser` | 8 | float | 浮点参数 | — | low | automation,params-misc |
| `talkEnd` | 0 | string | 整行；实际使用 backLogTalkEndString 常量覆盖 | — | low | automation,params-misc |
| `talkName` | 0 | string | 说话人显示文本（含 [image]/[#ruby]/称号等标记，由 GetTalkName 解析） | 文本 | medium | automation,params-misc |
| `talkNameBack` | 0 | string | 图片名 | 资源名 | high | automation,params-misc |
| `talkNameBack` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `talkStart` | 0 | string | 整行文本（原样存入 waitType/waitMessage，由消息系统解析） | 文本 | medium | automation,params-misc |
| `tapSkip` | 0 | string | 跳过名/标签 | 资源名 / ` ` | medium | automation,params-misc |
| `tapSkip` | 2 | string | 子关键词 | dontResetPress | medium | automation,params-misc |
| `tapSkip` | 4 | int | int 参数 | 整数 | low | automation,params-misc |
| `tapSkip` | 6 | int | int 参数 | 整数 | low | automation,params-misc |
| `tapSkip` | 8 | int | int 参数 | 整数 | low | automation,params-misc |
| `tdelay` | 0 | int | 延迟槽编号 | 整数 | high | automation,params-misc |
| `tdelay` | 2 | float | 延迟秒数 | 秒 | high | automation,params-misc |
| `tdelay` | 4 | int | 标志(0/1) | 0/1 | medium | automation,params-misc |
| `turnPageOff` | 0 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `turnPageOff` | 4 | string | 颜色(ConvertColor) |  | low | automation,params-visual |
| `turnPageOn` | — | — | 允许消息翻页(SetForcedDisableTurnPage;参数与 'f' 比较,语义未确证) | | | — |
| `useSimpleMeshFigure` | 0 | string | 立绘资源名(ConvertNameString,逗号分隔多项) |  | high | automation,params-visual |
| `verticalImageChange` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `verticalImageChange` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `verticalImageChange` | 2 | string | 立绘/图片名(ConvertNameString) |  | high | automation,params-visual |
| `verticalImageChange` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `verticalImageChange` | 5 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `verticalImageSet` | 0 | string | 角色槽位(A-Z/数字) |  | high | automation,params-visual |
| `verticalImageSet` | 1 | separator | 分隔符 `' '`(必须) |  | high | automation,params-visual |
| `verticalImageSet` | 2 | string | 立绘/图片资源名(ConvertNameString) |  | high | automation,params-visual |
| `verticalImageSet` | 3 | separator | 分隔符 `' '`(守卫位置参数) |  | high | automation,params-visual |
| `verticalImageSet` | 4 | int | 位置:单值=位置下标;若 pd[5]==',' 则本值为 X 坐标 |  | high | automation,params-visual |
| `verticalImageSet` | 5 | separator | `','`=坐标形式(x,y);`' '`=下标形式 |  | high | automation,params-visual |
| `verticalImageSet` | 6 | int | Y 坐标(仅 pd[5]==',' 时) |  | high | automation,params-visual |
| `verticalImageSet` | 7 | separator | 分隔符 `' '`(守卫 pd[7]==" " 才继续) |  | high | automation,params-visual |
| `voice` | 0 | string | 语音名 | 资源名 | high | automation,params-misc |
| `voice` | 2 | float | 音量 volume | 0.0–1.0 | high | automation,params-misc |
| `voiceStop` | 0 | string | 语音名 | 资源名 | medium | automation,params-misc |
| `voiceStop` | 2 | float | 淡出时间 | 秒 | medium | automation,params-misc |
| `voiceVolume` | 0 | string | 名称字符串(立绘/资源/对象名) |  | high | automation |
| `voiceVolume` | 2 | float | 渐变时间 fadeTime | 秒 | medium | automation,params-misc |
| `voiceVolume` | 4 | float | 音量 volume | 0.0–1.0 | medium | automation,params-misc |
| `wait` | 0 | string | 等待类型 waitType（写入 ScriptManager.waitType） | 见 conventions.wait_pd0_keys（72 个） | high | automation,params-misc |
| `wait` | 2 | float/int/string | 等待量：time/frame/skippableTime=数值(秒/帧)；为 0 时改按名字等待；命令名时=角色槽 index | 秒 / 帧 / A-Z 槽位 / 名称 | medium | automation,params-misc |
| `wait` | 4 | int | 命令名等待时的第二参数（int；如帧数/编号） | 整数 | low | automation,params-misc |
| `wait` | 8 | string | 颜色([#RRGGBB] / 名称) |  | low | automation |
| `warBoardTalkScreen` | — | — | 同 faceTalkScreen(共享 handler 0x317cd60) | | | — |
| `warCharaFadein` | 0 | string | 角色槽（A-Z/数字→槽位号） | A-Z / 数字 | high | automation,params-misc |
| `warCharaFadein` | 2 | float | float 参数（淡入时间） | 秒 | medium | automation,params-misc |
| `warCharaFadein` | 4 | int | int 参数 | — | medium | automation,params-misc |
| `warCharaFadein` | 6 | int | int 参数 | — | medium | automation,params-misc |
| `warCharaFadein` | 8 | int | int 参数 | — | medium | automation,params-misc |
| `warCharaFadein` | 10 | int | int 参数 | — | medium | automation,params-misc |
| `warCharaFadein` | 12 | int | int 参数 | — | medium | automation,params-misc |
| `warEffectOff` | 0 | string | key | 键名 | high | automation,params-misc |
| `warEffectPiece` | 0 | string | key（特效键） | 键名 | high | automation,params-misc |
| `warEffectPiece` | 2 | string | 特效名 | 资源名 | high | automation,params-misc |
| `warEffectPiece` | 4 | int | int 参数 | 整数 | medium | automation,params-misc |
| `warEffectPiece` | 6 | int | int 参数 | 整数 | medium | automation,params-misc |
| `warEffectPiece` | 8 | int | int 参数 | 整数 | medium | automation,params-misc |
| `warEffectPos` | 0 | string | key | 键名 | high | automation,params-misc |
| `warEffectPos` | 2 | string | 特效名 | 资源名 | high | automation,params-misc |
| `warEffectPos` | 4 | float | x（float） | 坐标 | medium | automation,params-misc |
| `warEffectPos` | 6 | float | y（float） | 坐标 | medium | automation,params-misc |
| `warEffectSquare` | 0 | string | key | 键名 | high | automation,params-misc |
| `warEffectSquare` | 2 | string | 特效名 | 资源名 | high | automation,params-misc |
| `warEffectSquare` | 4 | int | int 参数 | 整数 | medium | automation,params-misc |
| `warEventScript` | 0 | int | 事件脚本编号（int） | 整数 | high | automation,params-misc |
| `warMoveCameraPiece` | 0 | int | 棋子编号（int） | 整数 | high | automation,params-misc |
| `warMoveCameraPiece` | 2 | float | float 参数 | — | medium | automation,params-misc |
| `warMoveCameraPiece` | 4 | float | float 参数 | — | medium | automation,params-misc |
| `warMoveCameraPiece` | 6 | unknown |  |  | ? | automation |
| `warMoveCameraPiece` | 8 | int | int 参数 | — | medium | automation,params-misc |
| `warMoveCameraPiece` | 10 | int | int 参数 | — | medium | automation,params-misc |
| `warMoveCameraPiece` | 12 | int | int 参数 | — | medium | automation,params-misc |
| `warMoveCameraPos` | 0 | int | int 参数 | — | medium | automation,params-misc |
| `warMoveCameraPos` | 2 | float | float 参数 | — | medium | automation,params-misc |
| `warMoveCameraPos` | 4 | float | float 参数 | — | medium | automation,params-misc |
| `warMoveCameraPos` | 6 | string | easeType（缓动类型） | 缓动名 | medium | automation,params-misc |
| `warMoveCameraPos` | 8 | float | float 参数 | — | medium | automation,params-misc |
| `warMoveCameraPos` | 10 | float | float 参数 | — | medium | automation,params-misc |
| `warMoveCameraSquare` | 0 | int | int 参数 | — | medium | automation,params-misc |
| `warMoveCameraSquare` | 2 | float | float 参数 | — | medium | automation,params-misc |
| `warMoveCameraSquare` | 4 | float | float 参数 | — | medium | automation,params-misc |
| `warMoveCameraSquare` | 6 | string | easeType | 缓动名 | medium | automation,params-misc |
| `warMoveCameraSquare` | 8 | int | int 参数 | — | medium | automation,params-misc |
| `wipeFilter` | 0 | string | 划像名(SetWipeFilter.name) |  | high | automation,params-visual |
| `wipeFilter` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `wipeFilter` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `wipeFilter` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `wipeFilter` | 4 | float | 透明度/强度(0-1)(level) |  | high | automation,params-visual |
| `wipeFilter` | 6 | string | 翻转/朝向(H/V/F/其他) |  | medium | automation,params-visual |
| `wipeFilterEx` | 0 | string | 划像名(SetWipeFilter.name) |  | high | automation,params-visual |
| `wipeFilterEx` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `wipeFilterEx` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `wipeFilterEx` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `wipeFilterEx` | 4 | float | 透明度/强度(0-1)(level) |  | high | automation,params-visual |
| `wipeFilterEx` | 6 | float | 传给 SetWipeFilter() 的参数 `cvcenter` |  | high | automation,params-visual |
| `wipeFilterEx` | 8 | float | 传给 SetWipeFilter() 的参数 `cvcentersize` |  | high | automation,params-visual |
| `wipeFilterEx` | 10 | float | 传给 SetWipeFilter() 的参数 `cvleft` |  | high | automation,params-visual |
| `wipeFilterEx` | 12 | float | 传给 SetWipeFilter() 的参数 `cvright` |  | high | automation,params-visual |
| `wipeOff` | 0 | string | 对话特效名(拼成 Talk/<name>) |  | low | automation |
| `wipeOff` | 2 | string | 名称字符串(立绘/资源/对象名) |  | low | automation |
| `wipein` | 0 | string | 划像名(资源名,拼成 Wipe/<name>) |  | high | automation,manual,params-visual |
| `wipein` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `wipein` | 2 | float | 时长(秒,duration) |  | high | automation,manual,params-visual |
| `wipein` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `wipein` | 4 | float | 强度/程度(level) |  | high | automation,manual,params-visual |
| `wipeinEx` | 0 | string | 划像名(Wipe/<name>) |  | high | automation,params-visual |
| `wipeinEx` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `wipeinEx` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `wipeinEx` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `wipeinEx` | 4 | float | 透明度/强度(0-1)(level) |  | medium | automation,params-visual |
| `wipeinEx` | 6 | float | cvcenter(扩展划像参数) |  | medium | automation,params-visual |
| `wipeinEx` | 8 | float | cvcentersize |  | medium | automation,params-visual |
| `wipeinEx` | 10 | float | cvleft |  | medium | automation,params-visual |
| `wipeinEx` | 12 | float | cvright |  | medium | automation,params-visual |
| `wipeout` | 0 | string | 划像名(Wipe/<name>) |  | high | automation,params-visual |
| `wipeout` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `wipeout` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `wipeout` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `wipeout` | 4 | float | 透明度/强度(0-1)(划像强度 level) |  | high | automation,params-visual |
| `wipeoutEx` | 0 | string | 划像名(Wipe/<name>) |  | high | automation,params-visual |
| `wipeoutEx` | 1 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `wipeoutEx` | 2 | float | 时长(秒;快进/非正常速度时忽略→瞬间完成) |  | high | automation,params-visual |
| `wipeoutEx` | 3 | separator | 分隔符 ` `(此位不是参数值) |  | high | automation,params-visual |
| `wipeoutEx` | 4 | float | 透明度/强度(0-1)(level) |  | medium | automation,params-visual |
| `wipeoutEx` | 6 | float | cvcenter(扩展划像参数) |  | medium | automation,params-visual |
| `wipeoutEx` | 8 | float | cvcentersize |  | medium | automation,params-visual |
| `wipeoutEx` | 10 | float | cvleft |  | medium | automation,params-visual |
| `wipeoutEx` | 12 | float | cvright |  | medium | automation,params-visual |
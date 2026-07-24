# FGO 引擎脚本文档

> 基于 2,583 个脚本文件逆向分析得出的格式规范

---

## 目录

1. [概述](#概述)
2. [文件结构](#文件结构)
3. [语法基础](#语法基础)
4. [文本标记](#文本标记)
5. [命令参考](#命令参考)
   - [场景/背景](#场景背景)
   - [角色管理](#角色管理)
   - [音频](#音频)
   - [摄像机](#摄像机)
   - [视觉效果](#视觉效果)
   - [影片/动画](#影片动画)
   - [控制流](#控制流)
   - [UI 控制](#ui-控制)
   - [子摄像机系统](#子摄像机系统)
   - [其他命令](#其他命令)
6. [控制流模式](#控制流模式)
7. [完整示例](#完整示例)
8. [附录](#附录)

---

## 概述

FGO（Fate/Grand Order）使用自定义文本 DSL 作为视觉小说脚本引擎。所有脚本均为 `.txt` 文件，UTF-8 编码，包含日文文本和嵌入式命令。

### 设计原则

- **事件驱动**：脚本按顺序执行，无函数/循环结构
- **无变量系统**：使用硬编码 ID 和标签跳转
- **视觉小说范式**：以对话为核心，命令控制演出效果
- **角色槽位制**：A-Z 单字母标识角色/效果槽位

### 文件编码

- 编码：UTF-8
- 扩展名：`.txt`
- 换行：CRLF 或 LF

---

## 文件结构

### 目录组织

```
scripts/
├── Singularity FFlame Contaminated City Fuyuki/    # 特异点章节
├── Third SingularitySealed Ends of the Four Seas/   # 第三特异点
├── Lostbelt No1Permafrost Empire Anastasia/         # 异闻带章节
├── PrologueDec 26th 2017/                           # 序章
├── The Inescapable Gehenna Id/                      # 活动章节
└── ...
```

### 文件命名规则

文件名为 10 位数字 ID + `.txt`：

```
XXXXXXXXXX.txt
```

ID 编码规则（对应头部 `＄` 标签）：

| 位置 | 含义 | 示例值 |
|------|------|--------|
| XX | 大类别 | 01=特异点, 02=?, 03=异闻带/活动, 04=主线/活动, 05=特殊 |
| XX | 章节号 | 00, 01... |
| XX | 子章节/任务号 | 03, 06, 07... |
| XX | 场景/阶段号 | 01, 02... |
| X | 分支/变体 | 0, 1, 2... |
| X | 子变体 | 0, 1... |

**示例**：
- `0100030110.txt` → 特异点, 子章节03, 场景01, 变体1, 子0
- `0300060750.txt` → 异闻带, 子章节06, 场景07, 变体5, 子0

### 脚本头部

大多数脚本以标识符开头（约 93.4% 的文件包含此头部）：

```
＄01-00-03-01-1-0
```

- 使用全角 `＄` 符号
- 格式与文件名 ID 对应
- **注意**：约 6.6% 的脚本文件没有此头部，直接以命令开始
- 部分文件的 `＄` 位于第 2 行（首行为空行）

---

## 语法基础

### 命令格式

```
[command parameter1 parameter2 ...]
```

- 方括号包裹
- 命令名与参数以空格分隔
- 参数数量因命令而异

### 对话格式

```
＠角色名
台词文本内容[k]
```

- `＠`（全角 at 标记）标识说话者
- 台词独占一行
- `[k]` 表示等待玩家点击继续
- `[r]` 表示换行（不等待）

### 角色槽位

使用大写字母 A-Z 作为槽位标识：

| 槽位范围 | 用途 |
|----------|------|
| A-G | 主要角色 |
| H-J | 特效/次要角色 |
| K-M | 额外角色/效果 |
| N-Z | 子摄像机/特殊用途 |

### 注释

脚本中无专用注释语法。不使用命令的行被视为对话文本或空行。

---

## 文本标记

### 换行与分页

| 标记 | 含义 | 出现次数 |
|------|------|----------|
| `[k]` | 硬换行，等待玩家点击 | 184,799 |
| `[r]` | 软换行，不等待 | 133,096 |
| `[line N]` | 强制 N 行显示（2-6） | 19,538 |
| `[line3]` | 三行显示（简写） | 1 |

### 注音/ルビ（Ruby Text）

```
[#原文:读音]
```

**示例**：
- `[#船長:キャプテン]` → 显示"船長"，注音为"キャプテン"
- `[#戦:いくさ]` → 显示"戦"，注音为"いくさ"

### 性别依存文本

```
[&男性文本:女性文本]
```

根据主角性别自动选择显示文本。

**示例**：
- `[&君:ちゃん]` → 男性主角显示"君"，女性显示"ちゃん"
- `[&彼:彼女]` → 男性显示"彼"，女性显示"彼女"
- `[&オレ:わたし]` → 男性显示"オレ"，女性显示"わたし"

### 颜色标记

```
[RRGGBB]文本[-]
```

或

```
[RRGGBB]文本[RRGGBB]
```

**常用颜色**：

| 颜色代码 | 用途 | 出现次数 |
|----------|------|----------|
| `51ffff` | 蓝色（常见于系统文本） | 1,375 |
| `93CA76` | 绿色 | 347 |
| `51d4ff` | 浅蓝 | 228 |
| `D9FF69` | 黄绿色 | 228 |
| `6680ff` | 紫蓝 | 161 |
| `FFFFFF` | 白色 | 514 |
| `FF0000` | 红色 | 48 |
| `FF143C` | 深红 | 28 |

**示例**：
```
[51ffff]システムメッセージ[-]
[FF0000]警告！[-]
```

### 变量替换

| 标记 | 含义 | 出现次数 |
|------|------|----------|
| `[%1]` | 玩家名称 | 3,952 |
| `[%5]` | （推测）备用变量 | 1 |

### 文本对齐

```
[align center]
[align right]
[align left]
```

### 字体控制

```
[font large]      # 大字体
[font small]      # 小字体
[font x-large]    # 特大字体

[fontSize large]
[fontSize x-large]
[f small]         # 小字体（简写）
[f -]             # 默认字体
```

### 消息速度

```
[speed -]         # 默认速度
[speed 32]        # 指定速度
[messageSpeedForcedNormal on/off]  # 强制正常速度
```

---

## 命令参考

### 场景/背景

#### 切换场景

```
[scene 场景ID]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 场景ID | 整数 | 背景/场景资源标识 |

**示例**：
```
[scene 104100]
[scene 95207]
```

#### 命名场景

```
[sceneSet 槽位 场景ID 模式]
```

**示例**：
```
[sceneSet Q 142200 1]
[sceneSet R 142200 1]
```

#### 淡入淡出

```
[fadein 颜色 时长]
[fadeout 颜色 时长]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 颜色 | 字符串/十六进制 | `black`, `white`, 或十六进制颜色如 `ffd700`, `f93769`, `ff000080` 等 |
| 时长 | 浮点数 | 秒数 |

**常用颜色值**：

| 颜色值 | 说明 |
|--------|------|
| `black` | 黑色（最常用） |
| `white` | 白色 |
| `ffd700` | 金色 |
| `f93769` | 粉红色 |
| `ff5a36` / `ff3333` | 橙红/亮红 |
| `ff000080` | 半透明红色 |
| `9f0000` / `800000` | 深红 |
| `dc143c` / `dd1f30` | 猩红 |
| `ffffe4` / `fafad2` | 米黄 |
| `dff2fc` | 极浅蓝 |
| `502749` | 深紫 |
| `c0c0c0` | 银灰 |
| `424242` | 深灰 |
| `ffa07a` / `b3b8bb` | 浅橙/灰蓝 |
| `dedcdf` | 浅灰 |

**示例**：
```
[fadein black 1.0]
[fadeout black 1.5]
[fadein white 2.0]
[fadeout white 0.5]
[fadein ffd700 1.0]
[fadeout f93769 0.8]
```

#### 擦除过渡

```
[wipein 方向 时长 参数]
[wipeout 方向 时长 参数]
```

**方向类型**：

| 方向 | 说明 | 出现频次 |
|------|------|----------|
| `leftToRight` | 从左到右 | 高 |
| `rightToLeft` | 从右到左 | 高 |
| `leftDownToRightUp` | 左下到右上（对角线） | 中 |
| `rightUpToLeftDown` | 右上到左下（对角线） | 中 |
| `leftuptorightdown` | 左上到右下（对角线） | 低 |
| `rightdowntoleftup` | 右下到左上（对角线） | 低 |
| `circleIn` | 圆形收缩 | 高 |
| `circleOut` | 圆形扩散 | 低 |
| `openEye` | 睁眼效果 | 中 |
| `cinema` | 电影模式 | 中 |
| `downtoup` | 从下到上 | 中 |
| `uptodown` | 从上到下 | 中 |
| `rollright` | 向右滚动 | 中 |
| `rollleft` | 向左滚动 | 中 |
| `rollflashright` | 向右滚动闪光 | 低 |
| `rectanglestriplefttoright` | 三条矩形从左到右 | 高 |
| `rectanglestriprighttoleft` | 三条矩形从右到左 | 高 |
| `rectanglestripuptodown` | 三条矩形从上到下 | 中 |
| `rectanglestripdowntoup` | 三条矩形从下到上 | 中 |
| `rectanglelefttoright` | 单矩形从左到右 | 低 |
| `rectanglerighttoleft` | 单矩形从右到左 | 低 |
| `sideblind` | 百叶窗侧向 | 低 |
| `verblind` | 百叶窗垂直 | 低 |
| `cutver` | 垂直切割 | 低 |
| `cutside` | 侧向切割 | 低 |
| `cutacross` | 横向切割 | 低 |
| `noise` | 噪点过渡 | 低 |
| `windmill` | 风车旋转 | 低 |
| `uzumaki` | 涡旋 | 低 |
| `uzumakibig` | 大涡旋 | 低 |
| `moya` | 朦胧 | 低 |
| `magic` | 魔法阵 | 低 |
| `gunya` | 抖动 | 低 |
| `clash` | 碰撞 | 低 |
| `fire` | 火焰 | 低 |
| `sazanami` | 涟漪 | 低 |
| `mozafade` | 马赛克淡出 | 低 |
| `mezo` | 马赛克 | 低 |
| `diaout` | 菱形扩散 | 低 |
| `polka02` / `polka04` | 圆点图案 | 低 |
| `heartout` / `heartoutbig` | 心形扩散 | 低 |
| `guruguru` | 旋转 | 低 |
| `damage` | 伤害闪烁 | 低 |

**示例**：
```
[wipein rightToLeft 1.0 1.0]
[wipeout circleIn 0.5 1]
[wipein openEye 1.0 1.0]
[wipeFilter cinema 0.5 0]
[wipein rollright 0.5 1]
[wipeout rectanglestriplefttoright 0.5 1]
```

#### 遮罩

```
[maskin 颜色 时长]
[maskout 颜色 时长]
```

**示例**：
```
[maskin black 1.0]
[maskout white 2.0]
```

#### 拉伸效果

```
[stretchin 类型 时长 参数]
[stretchout 类型 时长 参数]
```

**示例**：
```
[stretchin full 2.0 2.0]
[stretchout full 3.0 3.0]
```

---

### 角色管理

#### 设置角色

```
[charaSet 槽位 角色ID 显示标志 名称]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 槽位 | 字母 | A-Z |
| 角色ID | 整数 | 角色资源 ID |
| 显示标志 | 整数 | 1=显示, 0=隐藏 |
| 名称 | 字符串 | 显示名称 |

**示例**：
```
[charaSet A 1098158200 1 シオン]
[charaSet B 98115000 1 通信用]
[charaSet A 98001000 1 マシュ_制服]
```

#### 角色表情

```
[charaFace 槽位 表情编号]
[charaFaceFade 槽位 表情编号 时长]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 表情编号 | 整数 | 0=默认, 1-30+ 不同表情 |
| 时长 | 浮点数 | 过渡时间（仅 Fade 版） |

**示例**：
```
[charaFace A 12]                # 瞬间切换表情
[charaFace A 0]                 # 恢复默认表情
[charaFaceFade A 20 0.3]        # 平滑过渡到新表情
[charaFaceFade Q 35 0.3]
[charaFaceFade A 27 0.2]
```

#### 角色淡入淡出

```
[charaFadein 槽位 时长 位置]
[charaFadeout 槽位 时长]
```

**示例**：
```
[charaFadein A 0.4 1]
[charaFadeout A 0.1]
[charaFadein A 0.1 2]
```

#### 角色位置

```
[charaMove 槽位 X,Y 时长]
[charaMoveEase 槽位 X,Y 时长 缓动函数]
[charaMoveReturn 槽位 X,Y 时长]
[charaMoveReturnEase 槽位 X,Y 时长 缓入函数 缓出函数]
[charaMoveFSL 槽位 X,Y 时长]               # 左侧角色移动 (Full Screen Left)
[charaMoveFSR 槽位 X,Y 时长]               # 右侧角色移动 (Full Screen Right)
[charaMoveEaseFSL 槽位 X,Y 时长 缓动函数]  # 左侧缓动移动
[charaMoveEaseFSR 槽位 X,Y 时长 缓动函数]  # 右侧缓动移动
[charaMoveFSSideL 槽位 X,Y 时长]           # 侧左移动 (Full Screen Side Left)
[charaMoveFSSideR 槽位 X,Y 时长]           # 侧右移动 (Full Screen Side Right)
[charaMoveEaseFSSideL 槽位 X,Y 时长 缓动函数]  # 侧左缓动移动
[charaMoveEaseFSSideR 槽位 X,Y 时长 缓动函数]  # 侧右缓动移动
[charaMoveReturnFSL 槽位 X,Y 时长]         # 左侧返回原位
[charaMoveReturnFSR 槽位 X,Y 时长]         # 右侧返回原位
[charaMoveReturnFSSideL 槽位 X,Y 时长]     # 侧左返回原位
[charaMoveReturnFSSideR 槽位 X,Y 时长]     # 侧右返回原位
[charaMoveReturnEaseFSL 槽位 X,Y 时长 缓入 缓出]  # 左侧缓动返回
[charaMoveReturnEaseFSR 槽位 X,Y 时长 缓入 缓出]  # 右侧缓动返回
```

**缓动函数**：`easeOutQuad`, `easeOutSine`, `easeInOutSine`, `easeOutExpo`, `easeOutCirc`, `easeOutQuart`, `easeInOutQuad`, `easeInOutQuint`, `easeInSine`, `easeOutCubic`, `easeInOutExpo`

**示例**：
```
[charaMove G 0,0 0.3]
[charaMoveEase V 0,-350 4.0 easeOutQuad]
[charaMoveReturn G 200,-5 0.6]
[charaMoveFSL E -250,0 10.0]
[charaMoveFSR D 236,0 0.6]
[charaMoveReturnEase G 0,10 0.4 easeOutSine easeInSine]
```

#### 角色缩放

```
[charaScale 槽位 缩放倍率]
[charaMoveScale 槽位 倍率 时长]
[charaMoveScaleEase 槽位 倍率 时长 缓动函数]
```

**示例**：
```
[charaScale C 1.1]
[charaScale T 1.01]
[charaMoveScale R 2.5 1.0]
```

#### 角色旋转

```
[charaRoll 槽位 角度]                     # 设置旋转角度
[charaRollAxis 槽位 轴 角度 时长]         # 绕指定轴旋转
[charaRollMove 槽位 时长 角度]            # 旋转动画
[charaRollMoveEx 槽位 时长 角度 X,Y]      # 扩展旋转（带位移）
```

**示例**：
```
[charaRoll X 31]
[charaRollAxis K y 180 0.1]
[charaRollMove O 0.1 0]
[charaRollMoveEx O 6.5 1440 0,-200]
[charaRollMoveEx J 0 -10 0,0]
```

#### 角色深度

```
[charaDepth 槽位 层级]
```

**示例**：
```
[charaDepth B 1]
[charaDepth A 2]
[charaDepth C 3]
```

#### 角色切换

```
[charaChange 槽位 新ID 显示标志 过渡方式 时长]
[charaCrossFade 槽位 新ID 新表情 时长]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 新ID | 整数 | 新的角色资源 ID |
| 显示标志 | 整数 | 1=显示, 0=隐藏 |
| 过渡方式 | 字符串 | `fade`, `normal` |
| 时长 | 浮点数 | 过渡时间 |

**示例**：
```
[charaChange A 98020000 1 fade 2]
[charaChange J 9018002 13 normal 0.1]
[charaCrossFade A 1098158210 6 0.2]
[charaCrossFade F 1098329920 36 1.1]
```

#### 角色效果

```
[charaEffect 槽位 效果名]
[charaEffectStop 槽位 效果名]
[charaEffectDestroy 槽位 效果名]
[charaEffectPause 槽位 效果名 X,Y 参数]   # 暂停效果
[charaEffectStart 槽位 效果名]             # 恢复效果
```

**常用效果名**：
- `bit_talk_noise`, `bit_talk_10`, `bit_talk_12`, `bit_talk_13`
- `bit_talk_36`, `bit_talk_41`
- `bit_talk_10_LowLevel`

**示例**：
```
[charaEffect B bit_talk_noise]
[charaEffectStop G bit_talk_10]
[charaEffectDestroy S bit_talk_4elements_light]
[charaEffectPause J bit_talk_gram_slash_03_fs 0,50 H]
[charaEffectStart J bit_talk_gram_slash_03_fs]
```

#### 角色边缘模糊

```
[charaEffectEdgeBlur 槽位 颜色1 颜色2 强度 模糊度]
[charaEffectEdgeBlurDestroy 槽位]
[charaEffectEdgeBlurStop 槽位]
[charaEffectEdgeBlurPause 槽位 颜色1 颜色2 强度 模糊度]  # 暂停并改变参数
[charaEffectEdgeBlurStart 槽位]                            # 恢复播放
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 槽位 | 字母 | A-Z |
| 颜色1 | 十六进制 | 边缘颜色 1 |
| 颜色2 | 十六进制 | 边缘颜色 2 |
| 强度 | 整数/浮点数 | 效果强度 |
| 模糊度 | 整数/浮点数 | 模糊程度 |

**示例**：
```
[charaEffectEdgeBlur A ffffff ffffff 4 1]
[charaEffectEdgeBlurDestroy A]
[charaEffectEdgeBlurPause A FFF9A5 FFF9A5 4 3.0]
[charaEffectEdgeBlurStart A]
```

#### 角色滤镜

```
[charaFilter 槽位 字母模式 silhouette/normal 颜色]
```

**参数说明**：
| 参数 | 类型 | 说明 |
|------|------|------|
| 槽位 | 字母 | A-Z |
| 字母模式 | 字母 | A-Z（通常为单字母标识，如 A, B, C 等） |
| 模式 | 字符串 | `silhouette` — 剪影效果 / `normal` — 恢复正常显示 |
| 颜色 | 十六进制 | 颜色值，如 `00000080`, `FFFFFF00`, `16161680` 等 |

**示例**：
```
[charaFilter G A silhouette 00000080]   # 变为剪影
[charaFilter G A normal 00000080]       # 恢复正常
[charaFilter H B silhouette 00000000]
[charaFilter I C silhouette 00000080]
[charaFilter D A silhouette FFFFFF00]
[charaFilter F B normal 16161680]
```

#### 角色阴影

```
[charaShadow 槽位 开关]
```

控制角色是否显示阴影。

**示例**：
```
[charaShadow F true]     # 显示阴影
[charaShadow F false]    # 隐藏阴影
[charaShadow H true]
[charaShadow H false]
```

#### 角色震动

角色的抖动效果（不同于屏幕震动）。

```
[charaShake 槽位 幅度 X强度 Y强度 时长]
[charaShakeStop 槽位]
```

**示例**：
```
[charaShake A 0.05 3 3 0.25]
[charaShake D 0.05 3 3 0.4]
[charaShake E 0.05 3 3 0.15]
[charaShakeStop H]
[charaShakeStop A]
```

#### 角色对话标记

```
[charaTalk 槽位]                    # 指定单个说话角色
[charaTalk on]                      # 开启对话模式（场景过渡后重置对话状态）
[charaTalk depthOn]                 # 开启深度显示（子渲染层角色可见）
[charaTalk depthOff]                # 关闭深度显示
[charaTalk A,B]                     # 双角色同时说话
[charaTalk A,B,C]                   # 三角色同时说话
[charaTalk A,B,C,D,E,F]             # 最多6角色同时说话
[charaTalk D,L,C,N,O,B,M,K]         # 8人同时说话（多人场景）
```

**示例**：
```
[charaTalk A]
[charaTalk on]
[charaTalk depthOn]
[charaTalk B,C]                     # B和C同时说话
[charaTalk D,L,C,N,O,B,M,K]         # 8人同时说话（多人场景）
```

#### 多角色对话标记（spot）

```
＠角色名=spot[槽位列表]
```

当多个角色同时说出相同台词时使用此标记，`spot` 内包含所有参与角色的槽位。

**示例**：
```
＠ダ・ヴィンチ＆ゴルドルフ=spot[A,B]
ちょっと待ったぁぁぁぁぁ！[k]

＠デイノニクス11兄弟たち=spot[C,D]
クェーー！無茶も休み休みクェー！[k]

＠オセロトル=spot[A,B,C,D,E,F]
[FFFFFF]？[-][k]

＠一同=spot[D,L,C,N,O,B,M,K]
[line 6]（呆然）[k]
```

#### 角色图层

```
[charaLayer 槽位 模式]
```

**模式**：
- `normal` — 普通图层
- `main` — 主图层
- `sub #A` — 子渲染层 A（用于分屏/画中画）
- `sub #B` — 子渲染层 B
- `sub #C` — 子渲染层 C
- `sub #D` — 子渲染层 D
- `sub #mask` — 遮罩子渲染层

**示例**：
```
[charaLayer T sub #A]
[charaLayer O normal]
[charaLayer D sub #A]
[charaLayer E sub #C]
[charaLayer F sub #D]
[charaLayer G sub #mask]
[charaLayer H main]
```

#### 角色特殊效果

高级视觉效果，用于角色出现/消失、闪白、擦除等。

```
[charaSpecialEffect 槽位 效果类型 参数 时长]
[charaSpecialEffectStop 槽位]                    # 停止效果
[charaSpecialEffectStop 槽位 效果类型]            # 停止指定类型
[charaSpecialEffectStop 槽位 参数]                # 停止指定参数的效果
```

**效果类型一览**：

| 效果类型 | 功能 |
|----------|------|
| `appearance` | 角色显现（从透明到不透明） |
| `erasureReverse` | 反向擦除显现（从有到无的逆过程） |
| `flashErasure` | 闪白擦除消失 |
| `enemyErasure` | 敌人消失效果 |
| `erasure` | 擦除消失（淡出式） |
| `appearanceReverse` | 反向显现（从有到无） |
| `darkEnemyErasure` | 暗色敌人消失效果 |
| `wipeTimeRe` | 反向擦除时间控制 |
| `wipeTime` | 擦除时间控制 |
| `flash` | 闪光效果 |
| `wipe` | 擦除过渡 |

**参数说明**：
- 参数1：整数，模式选择（0 或 1）
- 时长：浮点数，效果持续时间

**示例**：
```
[charaSpecialEffect F appearance 0 1.0]           # 角色显现
[charaSpecialEffect A appearanceReverse 1 0.25]   # 反向显现
[charaSpecialEffect G flashErasure 1 1.7]         # 闪白消失
[charaSpecialEffect C erasure 1 1.0]              # 擦除消失
[charaSpecialEffect G erasureReverse 1 0.7]       # 反向擦除显现
[charaSpecialEffect G darkEnemyErasure 1 3]       # 暗色敌人消失
[charaSpecialEffect E flash 0 1]                  # 闪光
[charaSpecialEffect K wipeTime 1 2.0]             # 擦除时间控制
[charaSpecialEffect G wipeTimeRe 1 1.0]           # 反向擦除时间
[charaSpecialEffect H wipe 1 0.1]                 # 擦除过渡
[charaSpecialEffectStop E]
[charaSpecialEffectStop G flash]
[charaSpecialEffectStop A darkEnemyErasure]
```

#### 角色攻击动画

角色冲向目标的攻击动作。

```
[charaAttack 槽位 类型 X,Y 时长]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 类型 | 字符串 | 攻击类型（如 `normal`） |
| X,Y | 坐标 | 冲击位移 |
| 时长 | 浮点数 | 动画时间 |

**示例**：
```
[charaAttack D normal 250,0 0.25]
[charaAttack A normal 450,0 0.4]
[charaAttack B normal -200,0 0.2]
[charaAttack E normal 0,-898 14.0]
```

#### 角色切入/切出

特殊的角色出现/消失动画效果。

```
[charaCutin 槽位 方向 时长 参数]
[charaCutout 槽位 时长]
```

**方向**：`leftToRight`, `rightToLeft`, `upToDown`, `circleIn`

**示例**：
```
[charaCutin H leftToRight 0.1 1.0]
[charaCutin G leftToRight 0.25 0.0]
[charaCutin D upToDown 0.5 0.25]
[charaCutin E leftToRight 0.4 1.0]
[charaCutin F circleIn 1.0 1.0]
[charaCutout F 1.0]
[charaCutout E 0.4]
```

#### 角色背景效果

在角色背后显示的特殊效果（如光环、魔法阵等）。

```
[charaBackEffect 槽位 效果名 X,Y]
[charaBackEffectDestroy 槽位 效果名]
[charaBackEffectStop 槽位 效果名 时长]
```

**示例**：
```
[charaBackEffect K bit_talk_fire_wall -250,0]
[charaBackEffect A bit_talk_black_aura_tsk]
[charaBackEffect A bit_talk_lightning_01t]
[charaBackEffectDestroy K bit_talk_fire_wall]
[charaBackEffectStop A bit_talk_black_aura_tsk]
[charaBackEffectStop A bit_talk_lightning_01t 0.1]
```

#### 角色放置

将角色瞬间移动到指定位置（无动画）。

```
[charaPut 槽位 X,Y]                # 普通放置
[charaPutFSL 槽位 X,Y]             # 左侧放置 (Full Screen Left)
[charaPutFSR 槽位 X,Y]             # 右侧放置 (Full Screen Right)
[charaPutFSSideL 槽位 X,Y]         # 侧左放置 (Full Screen Side Left)
[charaPutFSSideR 槽位 X,Y]         # 侧右放置 (Full Screen Side Right)
```

**示例**：
```
[charaPut B 0,0]
[charaPut B 1200,2000]             # 移出屏幕
[charaPutFSL G -240,0]
[charaPutFSR N 30,50]
[charaPutFSSideL N -375,-50]
[charaPutFSSideR K 450,-50]
```

#### 角色淡入位置变体

```
[charaFadeinFSL 槽位 时长 位置]              # 左侧淡入 (Full Screen Left)
[charaFadeinFSR 槽位 时长 位置]              # 右侧淡入 (Full Screen Right)
[charaFadeinFSSideL 槽位 时长 X,Y]           # 侧左淡入 (Full Screen Side Left)
[charaFadeinFSSideR 槽位 时长 X,Y]           # 侧右淡入 (Full Screen Side Right)
[charaFadeinFSLNotNotch 槽位 时长 X,Y]       # 左侧淡入（无刘海屏适配）
[charaFadeinFSRNotNotch 槽位 时长 X,Y]       # 右侧淡入（无刘海屏适配）
```

**示例**：
```
[charaFadeinFSL L 0.1 0]
[charaFadeinFSR A 0.1 2]
[charaFadeinFSSideL F 0.1 -350,0]
[charaFadeinFSSideR A 0.1 390,0]
[charaFadeinFSLNotNotch K 0.2 -110,-105]
[charaFadeinFSRNotNotch L 0.2 270,-105]
```

#### 角色持续移动

角色的循环浮动动画，用于呼吸效果、悬浮效果等。

```
[charaRelativeLoopMove 槽位 模式 X,Y X2,Y2 时长1 时长2 参数]
[charaRelativeLoopMoveStop 槽位]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 模式 | 整数 | 移动模式 |
| X,Y | 坐标 | 起始偏移 |
| X2,Y2 | 坐标 | 结束偏移 |
| 时长1 | 浮点数 | 正向移动时间 |
| 时长2 | 浮点数 | 反向移动时间 |
| 参数 | 整数 | 额外参数 |

**示例**：
```
[charaRelativeLoopMove N 2 0,-2 0,0 0.4 0.4 0]
[charaRelativeLoopMove K 2 0,-2 0,0 0.15 0.1 0]
[charaRelativeLoopMove D 2 0,-4 0,0 0.6 0.6 0]
[charaRelativeLoopMoveStop N]
[charaRelativeLoopMoveStop K]
```

#### 角色淡出时间

```
[charaFadeTime 槽位 参数 时长]
```

设置角色淡入/淡出的时间参数。

**示例**：
```
[charaFadeTime C 0 0.4]
[charaFadeTime R 0.2 0.5]
[charaFadeTime Y 0.4 0.5]
```

#### 清除角色

完全移除指定槽位的角色（包括其所有效果）。

```
[charaClear 槽位]
```

**示例**：
```
[charaClear F]
[charaClear B]
[charaClear G]
```

#### 装备设置

为角色设置装备/道具的显示。

```
[equipSet 槽位 装备ID 数量 名称]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 装备ID | 整数 | 装备资源 ID |
| 数量 | 整数 | 显示数量 |
| 名称 | 字符串 | 装备名称 |

**示例**：
```
[equipSet S 9402490 1 アトラス院]
[equipSet L 9402180 2 若返りの霊薬]
[equipSet E 9400780 2 モナ・リザ]
```

---

### 音频

#### 背景音乐

```
[bgm BGM标识 淡入时长] [音量]
[bgmStop BGM标识 淡出时长]
[bgmStopEnd BGM标识 淡出时长]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| BGM标识 | 字符串 | 如 `BGM_EVENT_38`, `BGM_MAP_23` |
| 时长 | 浮点数 | 秒数 |
| 音量 | 浮点数 | 可选，0.0-1.0 |

**BGM 类型前缀**：
- `BGM_EVENT_` — 事件音乐
- `BGM_MAP_` — 地图音乐
- `BGM_BATTLE_` — 战斗音乐
- `BGM_ENDING_` — 结尾音乐

**示例**：
```
[bgm BGM_EVENT_38 0.1]
[bgm BGM_MAP_57 0.1 0.9]
[bgmStop BGM_EVENT_38 1.5]
[bgmStopEnd BGM_BATTLE_43 2.0]
```

#### 音效

```
[se 音效标识]
[seStop 音效标识 淡出时长]
[seLoop 音效标识]
[seVolume 音效标识 淡入 淡出]
[seContinue 音效标识 参数 音量 编号]
[seContinueStop 音效标识 时长 编号]
[seContinueVolume 音效标识 时长 音量 编号]
```

**`seContinueVolume` 参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| 音效标识 | 字符串 | 如 `ad1`, `ad931` |
| 时长 | 浮点数 | 音量过渡时间 |
| 音量 | 浮点数 | 目标音量 0.0-1.0 |
| 编号 | 整数 | 通道编号 |

**音效标识前缀**：
- `ad` — 通用音效
- `bac` — 战斗音效

**示例**：
```
[se ad1]
[se ad931]
[seStop ad931 1.5]
[seLoop ad84]
[seVolume ad9 0 0.4]
```

#### 提示音

```
[cueSe 类别 标识]
[cueSeStop 标识 时长]
[cueSeVolume 标识 淡入 淡出]
[cueSeContinue 类别 标识 参数 音量 编号]
[cueSeContinueStop 标识 时长 编号]
[cueSeContinueVolume 标识 时长 音量 编号]
```

**类别**：`SE_21`, `NoblePhantasm_9943010`, `Servants_100100`

**示例**：
```
[cueSe SE_21 21_ad1097]
[cueSe NoblePhantasm_9943010 NP_9943010_6]
[cueSeStop m84916 2.0]
```

#### 全部停止

```
[soundStopAll]
[soundStopAllEnd]
[soundStopAllFade 时长]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 时长 | 浮点数 | 淡出时间（秒） |

**示例**：
```
[soundStopAll]
[soundStopAllFade 0.4]
[soundStopAllEnd]
```

#### 语音

```
[voice 语音标识]
[voiceStop 语音标识]
[voiceStop 语音标识 参数]
```

**示例**：
```
[voice 302800_0_B030]
[voice 701100_0_B100]
[voiceStop NP_502300_1]
[voiceStop NP_100100_1 0]
```

#### 铃声

```
[jingle BGM标识]
```

**示例**：
```
[jingle BGM_ENDING_1]
```

---

### 摄像机

#### 移动

```
[cameraMove 时长 X,Y 缩放]
[cameraMoveEase 时长 X,Y 缩放 缓动函数]
```

**示例**：
```
[cameraMove 0.1 0,-30 1.2]
[cameraMoveEase 0,-30 1.0 easeOutQuad 1.2]
[cameraMove 2.5 0,0 1.01]
```

#### 归位

```
[cameraHome 时长]
```

**示例**：
```
[cameraHome 3.0]
[cameraHome 0.1]
```

#### 旋转

```
[cameraRoll 角度 X,Y]
[cameraRollMove 时长 角度]
```

**示例**：
```
[cameraRoll 0]
[cameraRoll 10 0,0]
[cameraRollMove 2.0 2]
```

#### 滤镜

```
[cameraFilter 模式 参数...]
```

**模式**：`gray`, `normal`, `aberration`, `darkred`

**示例**：
```
[cameraFilter gray]
[cameraFilter normal]
[cameraFilter aberration 1 2 1 -2 -1 2]
[cameraFilter darkred]
```

#### 背景颜色

```
[backCameraColor]
```

---

### 视觉效果

#### 全局效果

```
[effect 效果名]
[effectStop 效果名]
[effectDestroy 效果名]
[effectForceStop 效果名]
[effectStart]              # 恢复暂停的效果
[effectPause 效果名]        # 暂停指定效果
```

| 命令 | 说明 |
|------|------|
| `effect 效果名` | 播放全局视觉效果 |
| `effectStop 效果名` | 停止效果 |
| `effectDestroy 效果名` | 销毁效果实例 |
| `effectForceStop 效果名` | 强制立即停止效果 |
| `effectStart` | 恢复之前暂停的效果 |
| `effectPause 效果名` | 暂停指定名称的效果 |

**常用效果名**：
- `bit_sepia01_depth_fs` — 棕褐色调
- `bit_talk_rubble` — 瓦砾
- `bit_talk_13`, `bit_talk_14`, `bit_talk_21`, `bit_talk_41` — 各种视觉效果
- `bit_talk_security_fs` — 安全框

**示例**：
```
[effect bit_sepia01_depth_fs]
[effect bit_talk_rubble]
[effectStop bit_sepia01_depth_fs]
[effectDestroy bit_talk_security_fs]
[effectPause bit_talk_rubble]
[effectStart]
```

#### 前向效果

```
[fowardEffect 效果名]
[fowardEffectStop 效果名]
[fowardEffectDestroy 效果名]
[fowardEffectStart]              # 恢复暂停的前向效果
[fowardEffectPause 效果名]        # 暂停指定前向效果
```

| 命令 | 说明 |
|------|------|
| `fowardEffect 效果名` | 播放前向视觉效果 |
| `fowardEffectStop 效果名` | 停止前向效果 |
| `fowardEffectDestroy 效果名` | 销毁前向效果实例 |
| `fowardEffectStart` | 恢复之前暂停的前向效果 |
| `fowardEffectPause 效果名` | 暂停指定名称的前向效果 |

**示例**：
```
[fowardEffect bit_talk_29]
[fowardEffect bit_talk_14]
[fowardEffectStop bit_talk_41]
[fowardEffectPause bit_talk_29]
[fowardEffectStart]
```

#### 背景效果

```
[backEffect 效果名]
[backEffectStop 效果名 时长]
[backEffectDestroy 效果名]
```

**示例**：
```
[backEffect bit_talk_07_loop]
[backEffectStop bit_talk_lightning_01t 0.1]
[backEffectDestroy bit_talk_light_range]
```

#### 文字效果

```
[effectmessage 效果名 X,Y 时长 参数]
[effectmessageStop 效果名]
```

**示例**：
```
[effectmessage bit_talk_hknf_text 440,179 1.5 48]
[effectmessageStop bit_talk_hknf_text]
```

#### 屏幕震动

```
[shake 幅度 X强度 Y强度 时长]
[shakeStop]
```

**示例**：
```
[shake 0.05 2 2 3.0]
[shake 0.05 3 3 6.5]
[shakeStop]
```

#### 模糊

```
[blur 类型 参数1 参数2 参数3]
[blurOff 类型 时长]
```

**类型**：`lens`, `motion`, `glass`

**示例**：
```
[blur lens 1.1 2 10]
[blur lens 0.5 2 20]
[blur motion 1.0 2 10]
[blur glass 0.5 2 10]
[blurOff lens 0.1]
```

#### 闪光

```
[flashin 模式 时长 颜色1 颜色2]
[flashout 时长]
[flashOff]
```

**模式**：`once`, `loop`

**示例**：
```
[flashin once 0.1 0.3 FFFFFFAF FFFFFF00]
[flashin loop 0.7 0.7 FF000080 FF000000]
[flashout 0.5]
[flashOff]
```

#### 扭曲效果

```
[distortionstart 参数1 参数2 参数3 参数4 参数5 参数6]
[distortionstop 时长]
```

**示例**：
```
[distortionstart 3.5 0.5 0.5 0.4 0.4 10.0]
[distortionstop 0.1]
```

#### 全屏效果

```
[enableFullScreen]
```

---

### 影片/动画

#### 过场影片

```
[criMovie 影片标识 bgmPlay 开关]
```

| 参数 | 类型 | 说明 |
|------|------|------|
| 影片标识 | 字符串 | 如 `talk_mov148` |
| bgmPlay | 布尔 | `true`/`false` |

**示例**：
```
[criMovie talk_mov148 bgmPlay true]
[criMovie talk_mov333 bgmPlay false]
```

#### 电影滤镜

```
[pictureFrame 画面标识]
[pictureFrameTop 画面标识]
```

**示例**：
```
[pictureFrame cut063_cinema]
[pictureFrameTop cut063_cinema]
```

#### 画面比例

```
[turnPageOn]
[turnPageOff]
[messageChange cinema]
```

#### 过场动画

```
[movie 影片标识]
```

**示例**：
```
[movie talk_mov010]
```

#### 插入动画

```
[insertionAnimationStart 动画标识 画面标识]
[insertionAnimationEnd 动画标识]
[insertionAnimationSetFSSideR 动画标识 X,Y]
```

**示例**：
```
[insertionAnimationStart ac_fude_triangle_slide_R cut530_ior_06]
[insertionAnimationEnd ac_fude_triangle_slide_R]
```

---

### 控制流

#### 标签

```
[label 标签名]
```

**示例**：
```
[label lblClear01]
[label lblNotClear01]
[label selectBranch]
```

#### 分支跳转

```
[branch 标签名]
```

**示例**：
```
[branch lblConf01]
[branch lblClear02]
```

#### 条件分支

```
[branchQuestClear 标签名 任务ID]       # 任务已完成
[branchQuestNotClear 标签名 任务ID]    # 任务未完成
[branchMaterial 标签名]                 # 素材相关
[branchRouteSelect 标签名 任务ID 参数]  # 路线选择
[branchNotRouteSelect 标签名 任务ID 参数]
[branchRouteSelectCount 标志名 数量 比较 任务ID列表 标签列表]
[branchSetGrandSvtCount 标签名 数量 比较]
```

**示例**：
```
[branchQuestClear lblClear01 4000217]
[branchQuestNotClear lblNotClear05 4000326]
[branchRouteSelect select_answer_01 3000810 5000]
[branchRouteSelectCount truthflag1 2 EQUAL 3000910,3000919 2030,2060]
```

#### 玩家输入

```
[input 标签名]
```

**示例**：
```
[input selectBranch]
```

#### 跳过控制

```
[skip true/false]
[tapSkip 参数]
```

**示例**：
```
[skip false]    # 禁止跳过
[skip true]     # 允许跳过
[tapSkip test_skip]
```

#### 条件判断

```
[ifClear 任务ID]
[endIf]
[else]
```

**示例**：
```
[ifClear 60152100]
... 已通关内容 ...
[else]
... 未通关内容 ...
[endIf]
```

#### 标志位

```
[flag 名称 值]
```

**示例**：
```
[flag smn 1]
[flag kda 1]
[flag flag_1 true]
[flag IsCmn true]
```

#### 清除

```
[clear]
```

#### 中断

```
[interruption]
```

#### 选择使用

```
[selectionUse 类型]
```

**类型**：`masterMale`, `masterFemale`

**示例**：
```
[selectionUse masterMale]
[selectionUse masterFemale]
```

#### 结束

```
[end]
[endFade 颜色]
```

**示例**：
```
[end]
[endFade white]
```

---

### UI 控制

#### 消息窗口

```
[messageOff]              # 隐藏消息窗口
[messageOn]               # 显示消息窗口（隐含）
[messageChange cinema]    # 电影模式
[messageAlign bottom]     # 底部对齐
```

#### 消息震动

```
[messageShake 幅度 X强度 Y强度 时长]
[messageShakeStop]
```

**示例**：
```
[messageShake 0.05 4 4 0.4]
[messageShakeStop]
```

#### 文字背景

```
[talkNameBack 图片标识]
```

**示例**：
```
[talkNameBack img_talk_namebg02]
[talkNameBack]
```

#### 等待

```
[wait 类型 参数...]
```

**等待类型**：

| 类型 | 说明 | 参数 |
|------|------|------|
| `fade` | 等待淡入淡出完成 | 无 |
| `wipe` | 等待擦除完成 | 无 |
| `mask` | 等待遮罩完成 | 无 |
| `charaCrossFade 槽位` | 等待角色交叉淡化完成 | 槽位字母 |
| `charaSpecialEffect` | 等待角色特殊效果完成 | 无 |
| `charaMove 槽位` | 等待角色移动完成 | 槽位字母 |
| `charaMoveReturn 槽位` | 等待角色返回原位完成 | 槽位字母 |
| `charaChange` | 等待角色切换完成 | 无 |
| `charaCut` | 等待角色切入/切出完成 | 无 |
| `charaEffect 效果名` | 等待角色效果完成 | 效果名称 |
| `charaEffectStart` | 等待角色效果恢复完成 | 无 |
| `charaBackEffect` | 等待角色背景效果完成 | 无 |
| `camera` | 等待摄像机移动完成 | 无 |
| `cameraRoll` | 等待摄像机旋转完成 | 无 |
| `effect` | 等待全局效果完成 | 无 |
| `fowardEffect` | 等待前向效果完成 | 无 |
| `fowardEffectStart` | 等待前向效果恢复完成 | 无 |
| `flash` | 等待闪光完成 | 无 |
| `se 音效标识` | 等待音效播放完成 | 音效 ID |
| `voice` | 等待语音播放完成 | 无 |
| `tvoice` | 等待测试语音完成 | 无 |
| `scene` | 等待场景加载完成 | 无 |
| `specialEffect` | 等待特殊效果完成 | 无 |
| `subCamera` | 等待子摄像机移动完成 | 无 |
| `insertionAnimationStart 标识` | 等待插入动画开始完成 | 动画标识 |
| `insertionAnimationEnd 标识` | 等待插入动画结束完成 | 动画标识 |
| `subRenderMoveFSSideL #层` | 等待子渲染层左侧移动完成 | 层编号 |
| `subRenderMoveFSSideR #层` | 等待子渲染层右侧移动完成 | 层编号 |
| `imageSet` | 等待图像设置完成 | 无 |
| `fastPlayDraw` | 等待快速绘制完成 | 无 |
| `fsmObjFinished` | 等待 FSM 对象完成 | 无 |
| `touch` | 等待触摸输入 | 无 |

**示例**：
```
[wait fade]
[wait charaCrossFade A]
[wait wipe]
[wait camera]
[wait charaMove B]
[wait se ad1]
[wait voice]
[wait flash]
```

#### 等待加载

```
[enableWaitLoadAssetWhenResume]
```

#### 自动返回

```
[autoAndBackLog false]
```

#### 日志标记

```
[backlogStart]    # 开始记录到日志
[backlogEnd]      # 结束记录到日志
```

用于标记可回溯的对话段落范围。

#### 章节效果

```
[fowardEffect bit_chapterstart401]
```

---

### 子摄像机系统

子摄像机用于分屏显示、画中画等高级演出。

#### 开关

```
[subCameraOn 编号]
[subCameraOff]
```

**示例**：
```
[subCameraOn 1]
[subCameraOn 2]
[subCameraOff]
```

#### 移动

```
[subCameraMove #层 时长 X,Y 缩放]
[subCameraMoveEase #层 X,Y 时长 缓动函数 缩放]
[subCameraHome #层 时长]
[subCameraRoll #层 角度 X,Y]
[subCameraRollMove #层 时长 角度]
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `subCameraHome` | `#层 时长` | 子摄像机归位到初始位置 |
| `subCameraRollMove` | `#层 时长 角度` | 子摄像机旋转动画 |

**示例**：
```
[subCameraMove #A 0.1 10,0 1.1]
[subCameraMoveEase #A 0,-50 0.5 easeOutQuart 1.2]
[subCameraHome #A 1.0]
[subCameraRoll #A 30 0,0
```

#### 滤镜

```
[subCameraFilter #层 模式 参数...]
```

**模式**：`through`, `mask`, `maskEdge`, `maskEdge&gray`, `mask&gray`, `inversion`, `gray`, `normal`

**示例**：
```
[subCameraFilter #A through]
[subCameraFilter #A mask cut359_mask12]
[subCameraFilter #A maskEdge cut359_mask05 3 255,255,255,255]
[subCameraFilter #A maskEdge&gray cut359_mask05 3 255,255,255,255]
[subCameraFilter #A mask&gray cut359_mask12]
[subCameraFilter #A inversion]
[subCameraFilter #A gray]
[subCameraFilter #A normal]
```

#### 子渲染层

```
[subRenderDepth #层 层级]
[subRenderFadein #层 时长 X,Y]
[subRenderFadeinFSL #层 时长 X,Y]       # 左侧淡入
[subRenderFadeinFSR #层 时长 X,Y]       # 右侧淡入
[subRenderFadeinFSSideL #层 时长 X,Y]   # 侧左淡入
[subRenderFadeinFSSideR #层 时长 X,Y]   # 侧右淡入
[subRenderFadeout #层 时长]
[subRenderMove #层 X,Y 时长]
[subRenderMoveEase #层 X,Y 时长 缓动函数]
[subRenderMoveFSL #层 X,Y 时长]         # 左侧移动
[subRenderMoveFSR #层 X,Y 时长]         # 右侧移动
[subRenderMoveFSSideL #层 X,Y 时长]     # 侧左移动
[subRenderMoveFSSideR #层 X,Y 时长]     # 侧右移动
[subRenderMoveEaseFSL #层 X,Y 时长 缓动函数]   # 左侧缓动移动
[subRenderMoveEaseFSR #层 X,Y 时长 缓动函数]   # 右侧缓动移动
[subRenderMoveEaseFSSideL #层 X,Y 时长 缓动函数]  # 侧左缓动移动
[subRenderMoveEaseFSSideR #层 X,Y 时长 缓动函数]  # 侧右缓动移动
[subRenderMoveScale #层 倍率 时长]      # 缩放移动
[subRenderMoveScaleEase #层 倍率 时长 缓动函数]  # 缓动缩放移动
[subRenderScale #层 倍率]
[subRenderShake #层 幅度 X强度 Y强度 参数]
[subRenderShakeStop #层]
```

**示例**：
```
[subRenderDepth #A 2]
[subRenderFadein #A 1.0 -200,0]
[subRenderFadeinFSL #B 0.4 -120,-120]
[subRenderFadeout #A 0.4]
[subRenderMove #A 150,0 16.0]
[subRenderMoveEase #B 0,-330 0.3 easeOutQuint]
[subRenderScale #A 1.5]
[subRenderMoveScale #C 1.1 3.5]
```

#### 子模糊

```
[subBlur #层 类型 参数1 参数2 参数3 参数4]
[subBlurOff #层 类型 时长 模式]
[subBlur2 #层 类型 参数1 参数2 参数3 参数4]
[subBlur2Off #层 类型 时长 模式]
```

**示例**：
```
[subBlur #A lens 0.4 2 10 1.0 subBlur]
[subBlurOff #A lens 0.1 normal]
```

#### 子拉伸

```
[subStretch on]
```

#### 叠加淡入

```
[overlayFadein 槽位 时长 X,Y]
```

**示例**：
```
[overlayFadein I 0.1 0,734]
[overlayFadein J 0.1 0,-734]
```

#### 图像设置

```
[imageSet 槽位 图像ID 参数...]
[image 图像标识]
[imageChange 槽位 新图像 模式 时长]
[horizontalImageSet 槽位 图像ID 参数]
[verticalImageSet 槽位 图像ID 参数]
```

**示例**：
```
[imageSet C back10000 1 1]
[imageSet T back10000 1]
[image berserker_language_2]
[horizontalImageSet K scene88101 2]
[verticalImageSet J back68500 1]
```

#### 主角相关

```
[masterSet 槽位 男性ID 女性ID 参数]
[masterScene 男性场景ID 女性场景ID 时长]
[masterImageSet 槽位 男性ID 女性ID 参数]
[masterBranch _Male标签 _Female标签]
[masterNameWidth 参数 名称1 名称2 名称3]
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `masterSet` | `槽位 男性ID 女性ID 参数` | 设置主角角色（根据性别自动选择） |
| `masterScene` | `男性场景ID 女性场景ID 时长` | 设置主角场景 |
| `masterImageSet` | `槽位 男性ID 女性ID 参数` | 设置主角图像 |
| `masterBranch` | `_Male标签 _Female标签` | 性别分支跳转 |
| `masterNameWidth` | `参数 名称1 名称2 名称3` | 设置主角名称显示宽度 |

**示例**：
```
[masterSet L 1098348300 1098348310 1]
[masterScene 276600 276601 1.0]
[masterBranch _Male01 _Female01]
[masterNameWidth large 339 _Name339Less _Name339Over]
```

---

### 其他命令

#### 通信角色

```
[communicationChara 角色ID 标志 参数1 参数2 参数3]
[communicationCharaClear]
[communicationCharaFace 表情编号]
[communicationCharaLoop 角色ID 标志 参数1 参数2 参数3]
[communicationCharaStop]
```

**示例**：
```
[communicationChara 98003003 1 5 0 2]
[communicationCharaClear]
[communicationCharaFace 4]
```

#### FSM 对象

```
[fsmObjSet 槽位 路径 名称]
[fsmObjSetState 槽位 状态]
[fsmObjSendEvent 槽位 事件]
[fsmObjLayer 槽位 层级]
[fsmObjDestroy 槽位]
```

**示例**：
```
[fsmObjSet K ScriptUI/SelectPanel/select01 select01]
[fsmObjSetState K WAIT_SELECTED_ANIMATION]
[fsmObjSendEvent K START]
[fsmObjLayer K ui]
[fsmObjDestroy K]
```

#### 滚动停止

```
[scrollStop]
```

#### 全屏模式

```
[enableFullScreen]
```

#### 简单网格模型

```
[useSimpleMeshFigure ID1,ID2]
```

**示例**：
```
[useSimpleMeshFigure 1009000,1098321800]
```

#### 特殊效果

```
[specialEffect 类型]
```

**类型**：`cutting`

#### 淡入移动

```
[fadeMove 颜色 时长 参数]
```

**示例**：
```
[fadeMove white 1.5 0.9]
[fadeMove white 0.7 0.1]
```

#### 擦除关闭

```
[wipeOff]
```

#### 语音测试

```
[tVoice 语音包标识 语音ID 时长]
```

**示例**：
```
[tVoice ChrVoice_7100100 0_T010 0.4]
[tVoice ChrVoice_7100100 0_T030]
```

#### 时间等待

```
[twt 时长]
[wt 时长]
```

**示例**：
```
[twt 0.5]
[wt 1.0]
[wt 0.1]
```

#### 捕获

```
[capture]
[captureRelease]
```

#### 任务简称

```
[tRaidShortName 任务ID 参数]
```

**示例**：
```
[tRaidShortName 80593 1]
```

#### 文本显示

```
[q]
[Q]
[s 参数]
```

---

## 控制流模式

### 线性叙事

最基本的模式，命令和对话顺序执行：

```
＄01-00-03-01-1-0
[scene 104100]
[fadein black 1.0]
[charaSet A 98001000 1 マシュ]
[charaFadein A 0.4 1]
[charaTalk A]
＠マシュ
おはようございます、マスター[k]
[fadeout black 0.5]
[end]
```

### 玩家分支选择

```
[input selectBranch]

？1：選択肢Aのテキスト
？2：選択肢Bのテキスト
？！

[label selectBranch]
[branch lblBranch01]

[label lblBranch01]
... 分支A的内容 ...
[branch lblEnd]

[label lblBranch02]
... 分支B的内容 ...

[label lblEnd]
... 后续共通内容 ...
```

### 任务进度条件分支

```
[branchQuestClear lblClear01 94146201]
[branch lblNotClear01]

[label lblClear01]
... 已通关的对话 ...
[branch lblContinue]

[label lblNotClear01]
... 未通关的对话 ...

[label lblContinue]
... 后续内容 ...
```

### 场景切换标准序列

```
[messageOff]
[fadeout black 0.5]
[wait fade]
[scene 新场景ID]
[bgm BGM_MAP_XX 0.1]
[fadein black 0.5]
[wait fade]
[messageOn]
```

### 角色登场序列

```
[charaSet A 角色ID 1 名称]
[charaFadein A 0.4 1]
[charaTalk A]
＠名称
台词[k]
```

### 角色退场序列

```
[charaFadeout A 0.1]
[charaClear A]
```

### 性别分支

```
[masterBranch _Male _Female]

... 共通内容 ...

[masterSet L 男性ID 女性ID 1]
[masterScene 男性场景 女性场景 1.0]
```

---

## 完整示例

### 最小可运行脚本

```
＄01-00-00-01-1-0
[scene 10000]
[fadein black 1.0]
[charaSet A 98001000 1 マシュ]
[charaFadein A 0.4 1]
[charaTalk A]
＠マシュ
……マスター。[k]
本日もよろしくお願いします。[k]
[fadeout black 0.5]
[end]
```

### 带分支的对话脚本

```
＄01-00-00-02-1-0
[scene 104100]
[fadein black 1.0]
[bgm BGM_EVENT_38 0.1]
[charaSet A 98001000 1 マシュ]
[charaFadein A 0.4 1]
[charaTalk A]
＠マシュ
マスター、お疲れ様です。[k]
今日の作戦についてご確認ください。[k]

[input selectBranch]

？1：作戦を確認する
？2：準備ができていない
？！

[label selectBranch]
[branch lblReady]

[label lblReady]
[charaFace A 1]
[charaTalk A]
＠マシュ
では、説明いたします。[k]
……（作戦説明）[k]
[fadeout black 0.5]
[bgmStop BGM_EVENT_38 1.0]
[end]
```

### 带战斗过渡的完整任务脚本

```
＄03-00-06-01-1-0
[scene 142200]
[fadein black 1.0]
[bgm BGM_MAP_23 0.1]
[charaSet A 1098158200 1 シオン]
[charaSet B 1098123200 1 ゴルドルフ]
[charaFadein A 0.4 1]
[charaFadein B 0.4 2]
[charaTalk A]
＠シオン
……特異点の反応が近いです。[k]
[charaFace B 3]
[charaTalk B]
＠ゴルドルフ
気を引き締めていくぞ。[k]
[messageOff]
[fadeout black 0.5]
[wait fade]
[criMovie talk_mov148 bgmPlay true]
[fadein black 0.5]
[wait fade]
[messageOn]
[charaTalk A]
＠シオン
……敵のサーヴァントです。[k]
[bgm BGM_BATTLE_43 0.1]
[messageOff]
[fadeout black 0.5]
[wait fade]
[end]
```

---

## 附录

### 角色 ID 前缀

| ID 范围 | 说明 |
|---------|------|
| 98001000+ | 玛修（各种服装） |
| 1098158200+ | 主角/玩家相关 |
| 1098123200+ | 戈尔德鲁夫 |
| 1098182300+ | 尼莫 |
| 98115000+ | 通信角色 |

### BGM 标识索引

| 前缀 | 用途 |
|------|------|
| `BGM_EVENT_` | 事件/剧情音乐 |
| `BGM_MAP_` | 地图探索音乐 |
| `BGM_BATTLE_` | 战斗音乐 |
| `BGM_ENDING_` | 结尾音乐 |

### 场景 ID 范围

| ID 范围 | 类型 |
|---------|------|
| 10000-11000 | 迦勒底内部 |
| 21230+ | 城市/街道 |
| 95200+ | 特殊场景 |
| 142200+ | 异闻带场景 |

### 缓动函数参考

| 名称 | 效果 |
|------|------|
| `easeOutQuad` | 缓出（二次） |
| `easeOutSine` | 缓出（正弦） |
| `easeOutExpo` | 缓出（指数） |
| `easeOutCirc` | 缓出（圆形） |
| `easeOutQuart` | 缓出（四次） |
| `easeOutQuint` | 缓出（五次） |
| `easeOutCubic` | 缓出（三次） |
| `easeInOutSine` | 入出（正弦） |
| `easeInOutQuad` | 入出（二次） |
| `easeInOutExpo` | 入出（指数） |
| `easeInOutQuint` | 入出（五次） |
| `easeInSine` | 缓入（正弦） |

### 命令统计

基于 2,583 个脚本文件的命令使用频率（Top 30）：

| 命令 | 出现次数 | 用途 |
|------|----------|------|
| `[k]` | 184,799 | 等待点击 |
| `[r]` | 133,096 | 换行 |
| `wt` | 116,117 | 时间等待 |
| `charaFace` | 115,973 | 角色表情 |
| `charaTalk` | 70,650 | 角色对话 |
| `charaFadeout` | 76,808 | 角色淡出 |
| `charaFadein` | 74,320 | 角色淡入 |
| `charaSet` | 26,798 | 设置角色 |
| `charaScale` | 15,860 | 角色缩放 |
| `charaDepth` | 21,768 | 角色深度 |
| `line` | 19,538 | 行数控制 |
| `messageOff` | 27,236 | 隐藏消息 |
| `wait` | 26,884 | 等待 |
| `se` | 24,080 | 音效 |
| `cameraMove` | 2,512 | 摄像机移动 |
| `charaMove` | 9,030 | 角色移动 |
| `charaEffect` | 4,657 | 角色效果 |
| `charaEffectStop` | 1,829 | 停止角色效果 |
| `bgm` | 12,478 | 背景音乐 |
| `bgmStop` | 9,146 | 停止BGM |
| `scene` | 10,447 | 切换场景 |
| `fadein` | 8,791 | 淡入 |
| `fadeout` | 8,770 | 淡出 |
| `soundStopAll` | 4,929 | 停止所有声音 |
| `seStop` | 11,506 | 停止音效 |
| `seVolume` | 10,256 | 音效音量 |
| `effect` | 3,164 | 视觉效果 |
| `fowardEffect` | 1,303 | 前向效果 |
| `flashin` | 1,231 | 闪光 |
| `shake` | 2,426 | 震动 |
| `charaFilter` | — | 角色滤镜（剪影/正常） |
| `charaLayer` | — | 角色图层（normal/main/sub #A~#D/mask） |
| `charaEffectEdgeBlur` | — | 角色边缘模糊 |
| `subCameraFilter` | — | 子摄像机滤镜（8种模式） |
| `blur` | — | 模糊（lens/motion/glass） |
| `cameraFilter` | — | 摄像机滤镜（含 darkred） |
| `masterNameWidth` | — | 主角名称宽度 |
| `backlogStart/End` | — | 日志段落标记 |
| `effectStart/Pause` | — | 全局效果恢复/暂停 |
| `fowardEffectStart/Pause` | — | 前向效果恢复/暂停 |

### 特殊标记说明

以下标记并非独立命令，而是其他语法的组成部分：

| 标记 | 实际用途 |
|------|----------|
| `[A]`, `[B]`, `[C]` ... `[Z]` | `spot` 标记的一部分，用于多角色对话 |
| `[A,B]`, `[C,D]` 等 | `spot` 标记的槽位列表，如 `＠角色=spot[A,B]` |
| `[charaTalk on]` | 开启对话模式（场景过渡后重置对话状态） |
| `[charaTalk A,B]` | 多角色同时说话 |
| `=spot[...]` | 对话行标记，表示多个角色共同说出台词 |
| `[q]`, `[Q]` | 对话队列标记（清除/重置对话状态） |
| `[s 参数]` | 滚动位置设置 |
| `[I]` | 单字母 spot 标记（极少单独使用） |
| `[line3]` | `[line 3]` 的简写形式 |

### 仍未完全确认的命令

| 命令 | 推测用途 |
|------|----------|
| `scrollStop` | 滚动停止 |
| `capture` / `captureRelease` | 屏幕捕获相关 |
| `interruption` | 中断标记 |
| `tapSkip` | 点击跳过标记 |
| `useSimpleMeshFigure` | 简化网格模型显示 |
| `autoAndBackLog` | 自动返回日志 |
| `wipeFilter` | 擦除滤镜（参数类型除 `cinema` 外还支持 `circleIn` 等方向值） |
| `voiceStop` 双参数形式 | 第二个参数（如 `0`）含义不明，可能是停止模式 |

---

> **文档版本**: v1.2
> **生成日期**: 2026-07-24
> **基于文件数**: 2,583 个脚本
> **更新内容**: 
> - v1.2: 补充 `wait` 完整类型列表（25+种）、扩展淡入淡出颜色值（18+种）、扩展擦除方向（30+种）、修正 `charaFilter` 格式描述、补充 `charaLayer` 子层（#C/#D/#mask/main）、补充 `subCameraFilter` 模式、补充模糊类型（motion/glass）、补充 `cameraFilter darkred`、添加 `masterNameWidth` 命令、添加 `soundStopAllFade` 参数说明、添加 `effectStart`/`effectPause`/`fowardEffectStart`/`fowardEffectPause` 详细说明、添加 `seContinueVolume`/`cueseContinueVolume` 参数表、修正 `＄` 头部非必需说明、修正 `voiceStop` 双参数形式
> - v1.1: 补充了多角色对话标记（spot）、多角色 charaTalk、角色移动位置变体（FSL/FSR/SideL/SideR）、子渲染层完整命令、角色效果暂停/恢复、对话模式开关（charaTalk on）等
> **说明**: 本文档基于实际脚本文件逆向分析，部分命令参数含义为推测，可能存在偏差。

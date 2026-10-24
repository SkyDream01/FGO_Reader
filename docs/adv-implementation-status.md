# ADV 补齐开发状态

更新：2026-10-15。依据 [how-to-adv-unrestored.md](how-to-adv-unrestored.md) 及其补充证据实现。原来的 [adv-unrestored.md](adv-unrestored.md) 保留为补齐前的核查快照。

## 本次交付

原清单 154 条命令均有执行、编译转换或文档要求的显式降级路径；单测提供 A–Z 实例后逐条检查，避免空槽返回掩盖漏分支。这表示处理链完整，不表示 Unity 资源、shader、音视频及游戏数据已经逐项复刻。

| 范围 | 当前行为 |
|---|---|
| 常规/前后景/角色特效 | 五类容器和角色容器分别保存实例，统一资源键、暂停创建、恢复、停止、强停、销毁和 busy；加载未完成时逐帧重试。自制 SVG 粒子、斩击、放射线、雨、烟雾、噪声、能量环负责替代显示。快速播放跳过 `bit_shot_*`。 |
| 通讯窗口 | 正确拆分 `svtId*10+limit`；保存坐标、深度、表情、噪声与循环状态；自制边框/扫描层配合 Atlas 或本地立绘。支持加载等待、动画等待、停止与清除。 |
| 角色演出 | 切入 Pause→Start、方向遮罩与切出；攻击平移；透明度分段循环、无限循环等待放行、Stop 落末值、回归位；任意轴有限/循环旋转、停止角与 pivot；表情/资源双缓冲渐变和隐式 `charaChange` 等待。 |
| 音频 | CRI sheet/cue 按 `Se/<sheet>/<cue>` → `Se/<cue>` → 名称寻址本地文件；淡入、淡出、音量、续播 ID 池、脚本结束停止、subBGM keep 计数。续播池和 BGM 播放元素由 App 持有，下一段剧情沿用播放位置，退出阅读器时释放。`wait se` 只看当前普通 SE 句柄，续播池不会拖住等待。 |
| 游戏流程 | 游戏条件 Provider、不可判定的 Not 侧、数值旗标比较、可配置种子的确定性随机旗标；双目标名字宽度判断；复刻/奖励状态、可注入任务文本；显式选项、菜单标签跳转和通知。 |
| 消息系统 | `clear/page` 清消息并等待点击，保留舞台；消息框独立抖动、行距、窗口/名牌替代资源、字号及标签垂直对齐、消息块垂直对齐、强制正常速度、翻页/滚动状态、文本框矩形。行内完成等待暂停后续字符，结束后继续同一句。 |
| 阅读策略 | `skip`、`tapSkip`、`autoAndBackLog`、`backlogStart/End` 状态接入执行器及 UI；隐藏的自动/历史按钮也不能由快捷键开启。 |
| 舞台 | 相机底色、冻结场景快照及释放、畸变计时/SVG 位移近似、独立 sprite mask、方向拉伸和子层拉伸；FSL/FSR 与 FSSide 分别计算；图片站位/全屏缩放参数、CharaGraph 卡面分路和 Form→基础→默认立绘回退。 |
| 影片 | 区分阻塞和 `false` 后台播放；快进/重放跳过；本地 MP4/WebM 使用 `<video>` 的真实事件与进度，缺片显示 3 秒可跳过占位。影片结束/跳过恢复暂停的音频。 |
| 插入动画/FSM/ADV/战棋 | 插入动画有位置、缩放和 0.4 秒自制三角展开时间轴；FSM 保存变量、状态、事件、层和坐标，无图时立即完成；ADV 保存 setup/演员/trigger；战棋按指南显式记录依赖并放行。 |

## 自制资源与替换

[src/adv/assets](../src/adv/assets/README.md) 中的 SVG 均为本项目原创，按 AGPL-3.0-only 许可提供。除静态纹理外，`RuntimeEffects.tsx` 用 SVG 几何绘制部分资源。动画使用执行器时钟，暂停、快进、回退不会留下独立运行的 CSS 时间轴。

本地 ZIP 的 `assets.images` 可用 `Effect/Talk/<name>` 或 `<name>` 覆盖替代特效，`CharaGraph/<id>` 提供卡面，`mask_<name>` 提供遮罩；`assets.sounds` 可用 `Se/<sheet>/<cue>` 提供已转换 cue；新增 `assets.movies` 提供 MP4/WebM。格式示例见 [custom-scripts.md](custom-scripts.md)。

自制演出、缺失声音和数据依赖在“演出兼容提示”中说明，不以没有 `unsupported` 诊断宣称完全还原。未知 wait 记录诊断后继续；缺少资源的 Set/Prepare 不留下永久等待。原生四条空命令继续保持静默。

## 注入接口

- `ExecutorOptions.gameState` / `useExecutor.gameState` / `ReaderView.gameState` 接受 `GameStateProvider`。可提供 collection、revival、任务阶段、礼装持有、任务×路线、路线计数、冠位数及任务替换文本。没有账号数据时不伪造正分支结果；冠位计数未提供时直接不跳。
- `ExecutorOptions.measureName`、`nameWidthScale` 支持名字测量与真机校准；浏览器默认使用 canvas 和字号表。
- `ExecutorOptions.randomSeed` 控制随机旗标；默认按脚本、指令、访问次序生成稳定值，恢复、回退和翻译预读不会消耗主执行器的随机序列。
- `compileFgoScript` 的 `markers`、`variables`、`textReplacements` 接受服务器本地化表/替换器。默认控制符来自 `localization.json`，未配置服务器表时使用该表。
- `useExecutor.configureExecutor` 在 `start()` 前接入音频/其他外部后端，避免开场等待先于播放器初始化。

## 仍需资源或校准的边界

1. 自制特效、CSS 划像/着色、SVG 畸变/模糊、分轴拉伸、卡面布局均为视觉近似。数值型特效名使用中性粒子，不从名字推断删除角色。`cutVer` 网格、maskEdge、精确 shader 混色和原生默认拉伸预设尚不能与真机等同。
2. 缺少原始音频时静音继续，不凭 cue 名生成声音；USM 内容不可从命令还原，需离线转码或本地替代影片。ACB/CPK 解码、Unity AssetBundle、原生 3D 和任意 PlayMaker Action 解释器不包含在浏览器后端中。
3. `charaFadeSpeed` 的 UNIT_SPEED 换算、原生字号宽度、RollAxis 曲线、刘海/forceObi 差异仍需真机对拍。默认无刘海，保持 NotNotch 变体及可扩展偏移接口。
4. delay/tdelay 继续调度演出命令子集，嵌套、文本、复杂控制流会明确诊断；指南中这项属于可后置、语料零覆盖项。
5. 服务器本地化表需要调用方提供；未擅自请求未公开的游戏缓存。稀有插入/返回控制符使用原有安全降级，没有虚构调用栈。

## 验证

```powershell
npm run build

# 部分 Windows 沙箱禁止对系统临时目录中的 Vitest 模块进行 rename。
$taskTemp = Join-Path (Get-Location) 'node_modules/.tmp/vitest'
New-Item -ItemType Directory -Force -Path $taskTemp | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
npm test -- --experimental.fsModuleCache=true

$env:FGO_CORPUS_DIR = 'F:/Project/fgo/scripts'
$env:FGO_CORPUS_REPLAY = '1'
$env:FGO_CORPUS_REPORT = 'node_modules/.tmp/adv-corpus-report.json'
npm test -- src/adv/corpus.test.ts --experimental.fsModuleCache=true

# 启动本机生产服务器后分别执行；可通过 FGO_E2E_URL 指定地址。
python tests/e2e_adv_supplement.py
python tests/e2e_adv_media.py
python tests/e2e_native_runtime.py
python tests/e2e_custom_import.py
```

语料回放选择一条可复现路径，重复进入同一选项时轮换选择；这证明所走路径没有崩溃或永久等待，不是所有选项组合穷举，也不是原生游戏视觉对拍。专项测试另覆盖缺资源等待、加载期重试、隐藏按钮、行内等待、字形缓冲、菜单双标签、cue 参数及跨脚本音频句柄。

本轮已通过生产构建、153 项测试（包括两项完整语料测试）及以上四个浏览器脚本。2,583 份语料均执行结束，走过 11,408 次选项选择，没有崩溃、永久等待或被流程保护强制终止。浏览器媒体测试使用实际生成的 WAV/WebM，验证开场 cue 等待、Blob 影片播放及结束事件；[离线演示 ZIP](../examples/adv-supplement.zip) 也已实际导入播放。

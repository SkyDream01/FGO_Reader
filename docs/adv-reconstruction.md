# 基于 docs/out 的 ADV 引擎重构

本版替换旧语法 AST、命令分派、执行器、动画时钟及舞台合成实现。书库、Atlas 客户端、翻译代理与 Windows / Android 启动入口接入同一套新引擎。

## 资料优先级

1. `out/coverage-verification.md`、四份 `supplement-*.md` 和 `_evidence/closure-*.md` 中的实证修正。
2. `out/command_params.json`、演出和画面专题中有明确消费点的参数记录。
3. 同目录标为 INFERRED / low 的记录仅作参考；资料不足的行为保留诊断。

`out/script-format.md` 的裸命令语法、`＄` 为纯章节元数据、`#` 十六进制颜色等旧结论不再使用。`charaPut` 的坐标对采用 `SetPosition` 的高置信度证据；补充卷中“百分比缩放”的推断不覆盖该消费点。

## 模块

| 文件 | 职责 |
|---|---|
| `src/adv/commandNames.json` / `spec.ts` | 366 条原始大小写命令、本地化控制符和字号常量 |
| `src/adv/syntax.ts` | 引号和括号深度扫描、原始行分类、保留分隔符的 `pd[]` |
| `src/adv/markup.ts` | 注音、傍点、性别文本、变量、颜色、字号、图片和行内动作 |
| `src/adv/compiler.ts` | 保留源顺序的指令、入口标签、选项正文和共享出口、资源目录 |
| `src/adv/executor.ts` | 游标、显式等待、分支旗标、选择轨迹、恢复与只读预览 |
| `src/adv/stage.ts` | A–Z 共用槽位、背景、主相机及按键分组的子层 |
| `src/adv/tween.ts` / `easings.ts` | 游戏/实时时钟、完成标志、33 个 iTween 缓动名 |
| `src/adv/message.ts` | 按字符位置触发动作和等待的逐字显示 |
| `src/adv/audio.ts` | 浏览器声音生命周期、音量渐变、真实音频完成等待 |
| `src/components/StoryStage.tsx` / `StageSprites.tsx` | 共享坐标尺度、子层合成、Atlas 表情合成和实时透明度 |

`node scripts/generate-adv-spec.mjs` 从逆向参数表重新生成命令名；识别命令和实现命令是两个独立层次。

## 已实现的关键语义

- 整行必须恰为单个已知括号组才是命令，其他括号内容进入消息解析。不认识的标记原样显示；命令大小写敏感，缓动名大小写不敏感。
- `＄` 和 `[label]` 都生成真实跳转落点。`＠` 为说话人，`＃` 为场景，`＊` 为注释。调用方可用 `compileFgoScript` 的 `markers` 覆盖本地化控制符。
- `[k]` / `[q]` 关闭消息并等待输入；`wt`、`twt` 分别改写为游戏时间、实时间等待，`frame` 按更新帧计数。行内等待只在对应文字显示后生效。
- 首个 `？` 进入选择；选中正文遇后续选项标题直接走共同出口。隐藏选项保留原始序号和翻译 ID，选择轨迹支持多次访问同一选项块。
- `branch label flag value` 比较旗标的字符串值。恢复先按记录的选择路径重放，缺少选择记录时停在选项窗口。
- `master*` 选择男性/女性资源与标签，`[%1]` 是经过括号消毒的御主名，`[%5]` 由 `variables[5]` 提供从者数。
- 角色、背景槽和图片槽共享 A–Z；按最新补证，`imageSet` / `sceneSet` 第三值为站位，第四值为全屏缩放类型。场景 ID 按 D5 补零且不截断长 ID。
- 画面采用 1344×576 渲染参考，16:9 安全区域为 1024×576；两轴使用同一个缩放单位。原来的画面 Y −0.25、角色 Y +0.1 校准和固定 CSS 入场动画已移除。
- 子层独立保存相机、变换、透明度、深度及滤镜参数，普通槽位和子层槽位依深度合成。淡入淡出、闪光和震屏使用执行器时钟。
- 本地包可提供 `images` 和 `sounds` 映射。声音等待查询播放器生命周期，缺少可播放资源时不制造等待时长。

## 实现边界

根据 `how-to-adv-unrestored.md` 完成的后续处理链、自制资源及验证见 [ADV 补齐开发状态](adv-implementation-status.md)。原缺口清单中的 154 条命令现均有执行、编译转换或指南要求的降级路径。自制资源及缺失原生资源仍会记录兼容诊断；不能据此宣称全部演出与 Unity 视觉一致。

划像采用浏览器裁切近似，部分颜色滤镜和模糊使用 CSS。非 Z 轴旋转、表情交叉渐变和 FS 变体公式已接入；原始 shader 的 maskEdge、精确合成、曲线及刘海边距仍需资源和真机对拍。`#MASK` 是普通组键，不按特殊内置遮罩解释。未知效果名称不按字符串猜测删除角色。

`delay` / `tdelay` 提供独立时钟下的演出区间调度；嵌套延迟、延迟区间内的对话/复杂控制流尚未完整复刻。跨脚本音频续播现通过 App 持有的实际播放元素实现。游戏条件可由 Provider 注入，没有源数据时不替用户伪造游戏存档。

旧指令索引和翻译单元 ID 不兼容。阅读进度、书签、选择轨迹和机器翻译缓存使用 v7 命名空间；旧记录保留在浏览器存储中，升级后不继续套用。

## 验证

```powershell
npm run build
npm test

# 指向自己的真实脚本目录；不把语料复制进仓库。
$env:FGO_CORPUS_DIR = "F:/Project/fgo/scripts"
npm test -- --experimental.fsModuleCache=true src/adv/corpus.test.ts

# 先启动服务器；测试使用本地模拟数据。
$env:FGO_E2E_URL = "http://127.0.0.1:5187"
python tests/e2e_native_runtime.py
```

语料验证检查全部脚本能否编译和是否存在结构错误；它不等于原始游戏视觉对拍。浏览器测试检查阅读、字号/注音、子层、镜头、设置、隐藏选择、书签、回退及重新打开后的进度恢复。

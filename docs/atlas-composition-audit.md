# Atlas 剧情画面校对记录

校对日期：2026-10-15。

## 范围与参照

| 脚本 | 对话数 | 参照 |
| --- | ---: | --- |
| `9415900210` | 99 | [Atlas 第2节](https://apps.atlasacademy.io/db/JP/script/9415900210) |
| `9415900310` | 82 | [Atlas 第3节](https://apps.atlasacademy.io/db/JP/script/9415900310)，以及用户提供的游戏内巨人／玛修斜切窗口截图 |

静态构图采用 Atlas 的原始背景、立绘、表情和 `svtScript` 元数据，并核对其 [Scene.tsx](https://github.com/atlasacademy/apps/blob/a596decc0a0f8cb4556dcf7fc59fa53e3916faa1/packages/db/src/Component/Scene.tsx) 与 `Scene.css`。正常播放检查按原始脚本的时长和缓动推进；游戏内截图用于校正斜切窗口的几何关系。

## 已修正

| 问题 | 处理及覆盖场景 |
| --- | --- |
| 第2节神社背景出现横向接缝 | 选用宽屏背景；修正 `sceneSet` 图层原点，并限制放大背景的平移范围，覆盖窗口边缘。 |
| 立绘位置、缩放与表情切换产生偏移 | 保留原图透明留白；应用元数据偏移；缩放以立绘原图的原点计算，换表情时保持位置。 |
| 第3节电影边框、图片和遮罩缺失 | 修正 Atlas 图片目录及 `_fs` 边框变体；保留方形源图的有效区域和留白。 |
| 斜切窗口角度错误、人物头部被裁切 | 使用亮度遮罩和居中的半宽采样；窗口贯穿全高，竖向移动只平移内容；保留黑色描边。 |
| 巨人登场前，右侧窗口已提前显示 | 子渲染层初始隐藏，等待 `subRenderFadein`；验证首次淡入和中断后反向淡入的连续透明度。 |
| 娜酱、黑胡子及半透明背景漏画 | 补齐 `charaPut`／`charaFadeTime` 的显示状态；透明度为零退场后隐藏。保留隐形特效挂点的坐标。 |
| 部分擦屏方向反转 | 区分覆盖与显现时剩余遮罩的边缘，检查上下左右四个方向。 |
| 冲击特效在恢复阅读位置后残留 | 单次冲击完成后移除；持续效果保持脚本的停止／销毁行为。 |

## 验证结果

- 两节均关闭减少动画，按 **25 ms** 步长从头推进至结尾；输入边界自动停留一秒后继续，选择第一项。分别经过 99／82 段对话，画面素材缺失为零，没有运行时异常或等待卡住。
- 中间帧覆盖背景平移、多人同框、两种斜切遮罩的进出、钓鱼段落、巨人镜头推进、镜头复位和黑胡子透明度变化。
- 像素回归覆盖 `1344×576`、`1024×576`、`780×440` 三种窗口；额外检查首次切入的半透明帧、两人同框和四向擦屏。
- `npm run build` 通过；`npm test` 为 **163 通过、2 项可选测试跳过**。
- 生产构建的浏览器检查通过：播放、选项、回退、恢复阅读位置、镜头移动及调整设置后保持当前位置。

稳定的离线回归用例为 `tests/e2e_atlas_alignment.py`，入口为 `tests/fixtures/atlas_alignment.html`。可先运行开发服务器，再执行：

```powershell
python tests/e2e_atlas_alignment.py
```

测试也支持独立构建入口，避免依赖开发服务器：

```powershell
node --input-type=module -e 'import { build } from "vite"; await build({base:"/",build:{outDir:"screenshots/atlas-alignment/site",rolldownOptions:{input:"tests/fixtures/atlas_alignment.html"}}});'
$env:FGO_ALIGNMENT_SITE = "$PWD/screenshots/atlas-alignment/site"
python tests/e2e_atlas_alignment.py
```

本机真实素材回放记录和截图位于 `screenshots/atlas-9415900210/animation/`、`screenshots/atlas-9415900310/animation/`。`screenshots/` 为本地校对产物，不纳入版本控制。

## 仍属近似的部分

没有提供游戏内完整录像，因此本次不能确认全部动画逐帧一致。梦幻／褐色滤镜、落地冲击、钓鱼和碎石效果仍使用自制矢量效果；矩形条纹擦屏保留方向及时间，图案仍是基础 CSS 遮罩。音效与原生 Unity shader 未做听感或逐像素复刻。

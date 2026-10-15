# 主场景实证:`data.unity3d` 与相机栈

来源:`extract/assets/bin/Data/data.unity3d`(UnityFS,Unity 6000.0.68f1,208,713 个对象),
用 UnityPy 直接读取——**这是游戏主场景/预制体集合,不是加密资源**,可以直接当"画面构建"的参照物。

复现:

```python
import UnityPy
env = UnityPy.load('extract/assets/bin/Data/data.unity3d')
for o in env.objects:
    if o.type.name == 'Camera':
        d = o.read()
        print(d.m_GameObject.read().m_Name, d.m_Depth, d.m_ClearFlags, d.orthographic)
```

## 剧情(Adv)场景的相机栈

| Camera | 正交 | depth | clearFlags | 作用(按 depth 顺序) |
|---|---|---|---|---|
| `BgCamera` | 是 | **-1** | 2 = SolidColor | 背景(最底) |
| `FigureCamera` | 是 | **0** | 2 = SolidColor | 立绘 |
| `ActionCamera` | 是 | **1** | 2 = SolidColor | 角色动作/特效 |
| `ActionCameraSub` | 是 | **1** | 2 = SolidColor | 动作子相机(副层用) |
| `MapCamera` | 是 | **1** | 2 = SolidColor | 地图 |
| `2DUICamera` | 是 | **2** | 3 = Depth | 2D UI |
| `MargeCamera` | 是 | **8** | 3 = Depth | 合成/描边类 |
| `CommonUICamera` | 是 | **10** | 3 = Depth | 通用 UI |
| `FrontCommonUICamera` | 是 | **11** | 4 = Nothing | 前置通用 UI |
| `SystemUICamera` | 是 | **14** | 3 = Depth | 系统 UI |
| `TouchCamera` | 是 | **15** | 3 = Depth | 触控(最上) |
| `SummonBGCamera` | 否(透视) | 0 | 3 = Depth | 召唤背景(3D) |

其它场景/子场景中的相机(同文件内共 346 个 Camera 对象,去重后)还包括:
`UICamera(5)` / `UIFrontEffectCamera(6)` / `UIFrontCamera(7)` / `UIBackCamera(4)`、
`WorldBgCamera` / `EarthCamera` / `EarthEffCamera` / `CutInCamera`(地球仪、宝具切入等)、
`BoardCamera(-1 / 0.5)` / `GrandBoardCamera(0.7)` / `GrandBoardBgCamera(0.6)`(战棋盘)、
`BattleChrCamera(11)`(战斗角色)、`3DCamera`、`UIWaterCamera(2)`。

> 阅读器实现要点(INFERRED,但与本栈一致):背景 → 立绘 → 动作/特效 → 2D UI → …… → 触控,
> 用**一个正交相机 + 分层 RenderTexture/Panel 深度**就能复现同样的叠放顺序;
> `clearFlags` 表明只有 `BgCamera/FigureCamera/ActionCamera*` 清屏,UI 层是叠加绘制。

原始数据:`out/_evidence/cameras.json`(全部 346 个相机的名称/depth/clearFlags/正交标志)。

## 场景中可直接复用的对象

`data.unity3d` 内含 68,048 个 MonoBehaviour、58,127 个 GameObject,以及
`ScriptManager` / `ScriptMessageCommonManager` / `ScriptSubLayerManager` / `ScriptLineMessage` 等
剧情系统的组件实例(已导出到 `out/_evidence/adv_components.json`),包括它们的序列化字段默认值——
需要"和游戏一模一样"的窗口尺寸/引用关系时,应直接以这些字段为准。

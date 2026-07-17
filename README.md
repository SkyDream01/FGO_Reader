# CHRONICLE // FGO 剧情阅读器

一个基于 [Atlas Academy](https://atlasacademy.io/) 数据的非官方 PC 剧情阅读器。项目以远程方式读取剧情脚本、背景、角色图和 BGM，不在仓库中分发游戏资源。

当前功能包括：

- 简中、日服、美服、繁中、韩服区域切换
- 主线/活动目录、剧情节点与脚本片段选择
- 场景、角色、BGM、淡入淡出、震屏、选项等常用 ADV 指令
- 逐字显示、自动播放、已读跳过、历史记录、书签和自动继续上次观测
- 日服剧情原文/简中译文切换，支持 DeepL、OpenAI 兼容接口与实验性 Bing / Edge 翻译
- PC 视觉小说快捷键、全屏、静音与减少动态效果
- Atlas 特殊多级脚本路径解析与离线降级界面

当前立绘使用资源自带的默认表情；`charaFace` 表情差分合成尚未实现。

## 视频介绍

[在哔哩哔哩观看项目介绍视频](https://www.bilibili.com/video/BV1n7Nv6jE58/)

## 运行

Windows 下可直接使用一键脚本：

```powershell
.\init.cmd
.\start.cmd
```

`init.cmd` 会安装项目依赖并完成生产构建；`start.cmd` 会检查依赖、重新构建最新源码，然后在 `http://127.0.0.1:4173` 启动阅读器。启动窗口会在服务运行期间保持打开，关闭该窗口即可同时停止本地服务。可通过 `PORT` 环境变量修改端口：

```powershell
$env:PORT = 8080
.\start.cmd
```

也可以手动运行：

```bash
npm install
npm run dev
```

构建并以本地生产服务器运行：

```bash
npm run build
npm start
```

## 日文翻译

翻译仅对成功载入的日服剧情生效，覆盖说话人、对白、选项和历史记录；目录、章节标题和 BGM 名称保持原样。按 `T` 可在日文原文与简体中文译文之间切换。

翻译后端必须在阅读设置中手动选择，后端失败时不会自动切换到其他服务。可直接在设置页填写配置，也可以复制 `.env.example` 为 `.env.local`，使用服务端环境变量：

- DeepL：`DEEPL_AUTH_KEY`，可选 `DEEPL_SERVER_URL`
- OpenAI 兼容：`OPENAI_COMPAT_BASE_URL`、`OPENAI_COMPAT_MODEL`、可选 `OPENAI_COMPAT_API_KEY`
- 本机免鉴权兼容服务：设置 `OPENAI_COMPAT_ALLOW_NO_AUTH=true`

OpenAI 兼容地址只允许 HTTPS，或 `localhost` / `127.0.0.1` / `::1` 的 HTTP。项目不会读取或使用 `OPENAI_API_KEY`，兼容接口应使用独立的 `OPENAI_COMPAT_API_KEY`。

选择“OpenAI 兼容”后，设置页会直接编辑项目根目录的 `.env.local`。Base URL、模型和兼容密钥保存后立即生效，无需重启；已有密钥只会显示“已配置”状态，不会从服务端回传到浏览器。写接口仅接受上述 OpenAI 兼容变量，并只允许通过当前本机阅读器页面调用，文件中的端口和其他环境变量会保留。

DeepL 页面配置仍按当前功能约定明文保存在浏览器 localStorage，仅建议在自己的本机浏览器中使用，并可随时通过“清除本地凭据”删除。Bing / Edge 使用免密的非官方临时令牌链路，没有 SLA，可能因限流或上游策略变化而失效。

运行解析器测试：

```bash
npm test
```

## 默认快捷键

- `Enter` / `Space` / `PageDown`：补全文字或下一句
- `A`：自动播放
- `S`：跳过已读
- 按住 `Ctrl`：临时快进
- `L` / `PageUp`：历史记录
- `T`：日文原文 / 简中译文
- `H`：隐藏界面
- `M`：静音
- `B`：保存书签
- `F`：全屏
- `?`：快捷键帮助
- `Esc`：关闭面板

## 免责声明

本项目是由爱好者维护的非官方工具，未获得 TYPE-MOON（有限会社ノーツ）、Lasengle、Aniplex 或 Atlas Academy 的授权、赞助或背书，与上述各方均无隶属关系。

项目按“现状”提供，不对功能可用性、数据完整性、翻译准确性或远程资源的持续可访问性作任何保证。上游接口、数据结构和资源地址可能随时变化；使用、部署或分发本项目时，请自行确认并遵守所在地法律以及相关服务、数据和资源的使用条款。因使用本项目产生的风险与责任由使用者自行承担。

## 版权声明

本仓库中由项目作者创作的源代码及文档采用 [MIT License](LICENSE) 许可。MIT 许可仅适用于本仓库的原创内容，不授予任何第三方游戏内容、剧情文本、角色、图像、音乐、商标、Atlas Academy 数据或其他远程资源的权利。

Fate/Grand Order 及相关游戏内容的版权与商标归其各自权利人所有。本仓库不分发游戏资源；通过本项目访问的第三方内容仍受其原有版权及使用条款约束。

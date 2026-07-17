# 自定义单脚本 ZIP 剧本包

阅读器可以导入一个 ZIP 文件，播放其中的一篇 FGO 格式剧本。这个功能适合整理自己的原创文本，或导入自己明确拥有使用和分发权限的内容。请不要把游戏原文、图片或音乐重新打包分发，除非你已经取得相应授权。

一个包只对应一份剧本。最容易上手的做法是先复制仓库中的 <code>examples/custom-script-package</code>，确认文本包可以导入后，再逐步加入图片和 BGM。

## 先做一个最小文本包

最小包只有两个 UTF-8 文件：

~~~
my-story/
├── manifest.json
└── script.txt
~~~

1. 用支持 UTF-8 的编辑器保存 <code>manifest.json</code> 和 <code>script.txt</code>。
2. 将这两个文件压缩为 ZIP。
3. 在阅读器目录页左下角“本地脚本库”区域点击“导入 ZIP 资源包”，选择该文件。
4. 在预览页核对标题、区服、帧数和资源数量；确认后点击“导入并开始观测”。导入成功后，它也会出现在“浏览脚本库”中。

推荐把文件本身压到 ZIP 根目录：

~~~
my-story.zip
├── manifest.json
└── script.txt
~~~

也可以多包一层唯一的目录：

~~~
my-story.zip
└── my-story/
    ├── manifest.json
    └── script.txt
~~~

导入器会在 ZIP 根目录，或唯一的一层外包装目录中寻找 <code>manifest.json</code>。使用外包装目录时，所有非目录文件都必须在这层目录之下；不要同时在根目录放说明文件、系统生成的额外文件或另一份剧本。

清单中的 <code>script</code> 和 <code>assets</code> 路径始终相对于“包根目录”——也就是 ZIP 根目录，或自动识别出的唯一外包装目录。它们**不应**包含外包装目录名。例如 ZIP 内是 <code>my-story/script.txt</code> 时，清单仍写 <code>"script": "script.txt"</code>；这个文件必须真实存在，且路径规则与资源路径完全相同。

Windows PowerShell 中，如果 <code>my-story</code> 是工作目录，可用下面的命令把目录内容直接压到 ZIP 根目录：

~~~powershell
Compress-Archive -Path .\my-story\* -DestinationPath .\my-story.zip
~~~

## manifest.json 格式

清单文件必须是 UTF-8 JSON，根对象只能使用下列字段。字段名、固定字符串和大小写都应保持一致：

~~~json
{
  "format": "fgo-reader-script-package",
  "version": 1,
  "title": "月下的约定",
  "author": "示例作者",
  "description": "一篇自定义单脚本",
  "region": "JP",
  "script": "script.txt",
  "assets": {
    "backgrounds": {
      "10001": "assets/backgrounds/10001.webp"
    },
    "characters": {
      "1001001": "assets/characters/1001001.png"
    },
    "bgm": {
      "BGM_EVENT_2": "assets/bgm/BGM_EVENT_2.ogg"
    }
  }
}
~~~

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| <code>format</code> | 是 | 固定为 <code>fgo-reader-script-package</code>。 |
| <code>version</code> | 是 | 当前固定为数字 <code>1</code>。 |
| <code>title</code> | 是 | 导入后显示的标题。 |
| <code>author</code> | 否 | 作者署名。 |
| <code>description</code> | 否 | 简短说明。 |
| <code>region</code> | 是 | 使用大写区域代码：<code>CN</code>、<code>JP</code>、<code>NA</code>、<code>TW</code> 或 <code>KR</code>。 |
| <code>script</code> | 是 | ZIP 内的 UTF-8 剧本文本路径，例如 <code>script.txt</code>。 |
| <code>assets</code> | 否 | 本地背景、立绘和 BGM 的 ID 到 ZIP 路径映射。 |

<code>assets</code> 下的 <code>backgrounds</code>、<code>characters</code> 和 <code>bgm</code> 都是可选对象。JSON 对象键会是字符串，因此即使 ID 看起来是数字，也请写成键名，例如 <code>"10001"</code>。

ZIP 内路径必须相对于包根目录，并使用正斜杠 <code>/</code>，例如 <code>assets/backgrounds/10001.webp</code>。不要写空路径、以 <code>/</code> 开头的路径、反斜杠、<code>.</code> 或 <code>..</code> 路径段、盘符路径、<code>file:</code> 路径或网络 URL。也就是说，资源一定要实际放在 ZIP 内，不能引用创作者电脑上的本地文件。

## 用资源 ID 指向 ZIP 内文件

剧本命令中的 ID 会用于查找对应的映射，不是根据文件名猜测资源：

| 剧本命令 | 查找的映射 | 示例 |
| --- | --- | --- |
| <code>[scene 10001]</code> | <code>assets.backgrounds["10001"]</code> | 背景图 |
| <code>[charaSet MASH 1001001 0 玛修]</code> | <code>assets.characters["1001001"]</code> | 玛修立绘；<code>MASH</code> 是剧本槽位，不是资源键。 |
| <code>[bgm BGM_EVENT_2 0.2]</code> | <code>assets.bgm["BGM_EVENT_2"]</code> | BGM 音频。 |

本地映射优先于 Atlas Academy 的远程资源。没有给某个 ID 配置本地映射时，阅读器才会按 <code>region</code> 尝试 Atlas 回退；回退失败时会以缺失资源状态继续，而不会把资源写入包中。已经配置映射的资源必须真实存在于 ZIP 内，否则导入会被拒绝。

可作为本地背景或立绘的格式是 PNG、JPEG（<code>.jpg</code> 或 <code>.jpeg</code>）和 WebP。BGM 只支持 MP3、Ogg 和 WAV。SVG 不能作为图片资源；包也不是网页或插件容器，不要放入或依赖 JavaScript、HTML 或其他可执行内容。

## 大小与文件数限制

为避免浏览器在解压时占用过多内存，导入包有以下上限：

| 项目 | 上限 |
| --- | ---: |
| ZIP 压缩包 | 64 MiB |
| 解压后的总大小 | 128 MiB |
| 剧本文本 | 2 MiB |
| 单张背景或立绘 | 12 MiB |
| 单个 BGM | 24 MiB |
| ZIP 中的文件数 | 256 个 |
| 展开后的剧情帧 | 10,000 条 |
| 定义的角色槽位 | 64 个 |
| 每组选项 | 9 个 |

图片和音频通常最容易超过限制。先压缩图片、裁剪无用音频，并删除未被映射或未被剧本使用的文件。

## 剧本基本写法

每条对话以全角 <code>＠</code> 开头，不能使用半角 <code>@</code>。一条对话必须用 <code>[k]</code> 或 <code>[page]</code> 结束；否则后续文本可能仍被当作同一条对话的一部分。

最简单的署名形式是 <code>＠玛修</code>。也可以让槽位成为发言者：<code>＠MASH：玛修</code>（冒号可使用全角或半角）；前者是槽位名，后者是显示名称。<code>[scene]</code> 的 ID 和 <code>charaSet</code> 的角色 ID 必须是数字；<code>[bgm]</code> 的 ID 不能含空格，后面的可选参数会被阅读器忽略。

~~~text
[scene 10001]
[bgm BGM_EVENT_2 0.2]
[charaSet MASH 1001001 0 玛修]
[charaFadein MASH 0.2 1]
[charaTalk MASH]
＠MASH：玛修
欢迎来到自定义剧本。[k]
~~~

常用命令如下：

| 命令 | 用途 |
| --- | --- |
| <code>[scene ID]</code> | 切换背景 ID。 |
| <code>[bgm ID ...]</code>、<code>[bgmStop]</code> | 播放或停止 BGM。 |
| <code>[charaSet 槽位 角色ID 表情ID 名称]</code> | 定义角色槽位和角色 ID。 |
| <code>[charaPut 槽位 位置]</code>、<code>[charaFadein 槽位 时长 位置]</code> | 显示角色；位置 <code>0</code>、<code>1</code>、<code>2</code> 分别常用于左、中、右。 |
| <code>[charaTalk 槽位]</code>、<code>[charaFadeout 槽位]</code>、<code>[charaClearAll]</code> | 标记发言角色、隐藏角色或清空角色。 |
| <code>[fadein]</code>、<code>[fadeout]</code>、<code>[wipein]</code>、<code>[wipeout]</code> | 使用基础转场。 |

阅读器只实现常用的 ADV 命令子集。不要把剧情推进建立在未列出的游戏命令上；不支持的命令可能被忽略。<code>charaFace</code> 虽可被解析，但目前不会渲染表情差分，立绘仍使用角色 ID 对应的默认图片。

## 选项、收束与重置

选项标题必须严格写为全角 <code>？</code>、数字、全角或半角冒号、选项文字，例如 <code>？1：继续前进</code>；不能使用半角 <code>?</code>。选项组以单独一行全角 <code>？！</code> 结束。选项内部不能再嵌套选项。

~~~text
？1：继续前进
＠玛修
好的，我们出发。[k]
？2：暂时休息
＠玛修
明白了，稍后再继续。[page]
？！
~~~

所有选项应在 <code>？！</code> 前收束到同一剧情状态。解析器会以第一个选项结束时的场景、BGM 和角色状态继续解析，不会自动合并不同分支。因此若任一分支改过背景、音乐或角色，请在选项组之后明确重置为共同状态：

~~~text
？！
[scene 10001]
[bgm BGM_EVENT_2]
[charaClearAll]
[charaPut MASH 1]
＠MASH：玛修
我们回到同一条主线。[k]
~~~

## JP 剧本与翻译同意

当 <code>region</code> 为 <code>JP</code> 时，导入预览会显示“允许此脚本使用翻译服务”开关，默认关闭。即使已开启，读者仍需在阅读器设置中选择翻译后端，再用 <code>T</code> 或工具栏的“译文”按钮切换；只有进入译文模式后文本才会发送给其选定后端。以后可在“浏览脚本库”中切换该包的“译文”开关来撤回**未来**授权；这无法撤回已经发送给第三方后端的文本。需要清除本机翻译记录时，可在阅读设置中清除本地凭据和翻译缓存。请在导入前告知读者这一点，并确认你有权将相关内容交给所选翻译服务处理。

## 常见导入问题

| 提示或现象 | 检查方法 |
| --- | --- |
| 找不到 <code>manifest.json</code> | 确认它位于 ZIP 根目录，或所有文件共同的唯一外包装目录中。 |
| 清单或脚本无效 | 重新用 UTF-8 保存；检查固定字段、版本号、<code>script</code> 文件名和全角 <code>＠</code>。 |
| 资源映射不存在 | 映射路径相对包根目录，使用 <code>/</code>，并确认对应文件已被压入 ZIP。 |
| 没有本地图片或声音 | 检查扩展名是否受支持；未映射资源会尝试 Atlas 回退，因此离线时应把需要的资源映射进包。 |
| 选项后画面不对 | 不嵌套选项，并在 <code>？！</code> 后明确重置背景、BGM 和角色到共同状态。 |

## 导入前检查

- <code>manifest.json</code> 和 <code>script.txt</code> 都是 UTF-8。
- 清单中的固定字段和版本号完全匹配，未添加自定义字段。
- ZIP 根目录或唯一外包装目录中能找到 <code>manifest.json</code>。
- 每个资源映射都指向 ZIP 中真实存在的相对路径。
- 图片只用 PNG、JPEG 或 WebP；音频只用 MP3、Ogg 或 WAV。
- 对话使用全角 <code>＠</code>，选项使用全角 <code>？</code>，每条对话都有 <code>[k]</code> 或 <code>[page]</code>。
- 选项不嵌套，分支结束后重置到共同状态。
- 包内不依赖 SVG、JavaScript 或创作者电脑上的本地路径。

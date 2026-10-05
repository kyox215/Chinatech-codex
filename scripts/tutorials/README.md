# 首页三语视频教程

五集教程各提供中文、意大利语和英语，共 15 个静态 MP4、15 张 WebP 封面和 15 份 WebVTT。网页读取 `lib/tutorials.ts` 的 `getTutorials(locale)`；`tutorials` 保留中文默认目录。中文 URL 不变，外语位于 `public/tutorials/it/` 与 `public/tutorials/en/`。构建和播放都不调用语音服务。

视频是实际页面截图组成的操作动画，不是连续录屏。所有资料均为本机虚构演示数据。每一步先显示页面，再聚焦真实目标区域，显示鼠标路径、落点和脉冲；适用步骤切换至实际点击或填写后的页面状态。截图目标由 Playwright 对真实 DOM 元素测量，外语截图重新测量对应语言的布局。画面包含对应语言硬字幕，另附可由播放器开启的字幕轨。

| 语言 | 自然语音 | 语速 |
| --- | --- | --- |
| 中文 | `zh-CN-XiaoxiaoNeural` | `+5%` |
| 意大利语 | `it-IT-ElsaNeural` | `+3%` |
| 英语 | `en-US-JennyNeural` | `+2%` |

作者环境需要 Node 24、项目依赖、Playwright Chromium、`ffmpeg`、`ffprobe` 和独立 Python 环境中的 `edge-tts`。本轮在 macOS 使用 Helvetica Neue / PingFang SC；其他作者环境须安装可显示中文的字体并复核字幕。无需新增应用依赖、应用密钥或付费 API。Edge TTS 只在作者生成配音时发送公开讲稿；不要加入客户或内部资料。中文旧音频按实际讲稿匹配后复用。

在项目根目录复现：

```sh
# 使用已按项目规则启动的本机虚构预览；脚本只接受 3121 / 3123。
export TUTORIAL_CAPTURE_ORIGIN=http://127.0.0.1:3123
export TUTORIAL_TTS_PYTHON="$PWD/.local/tutorials/tts-env/bin/python"
export TUTORIAL_LEGACY_WORK="$PWD/.local/tutorials"

TUTORIAL_CAPTURE_LOCALE=zh-CN node scripts/tutorials/capture.mjs
TUTORIAL_CAPTURE_LOCALE=it node scripts/tutorials/capture.mjs
TUTORIAL_CAPTURE_LOCALE=en node scripts/tutorials/capture.mjs
node scripts/tutorials/prepare-audio.mjs all
node scripts/tutorials/render.mjs all
node scripts/tutorials/verify.mjs all
```

1. 先核对当前业务和界面，再修改 `storyboard.json`、`storyboard.it.json`、`storyboard.en.json`。五集的 ID、编号、功能链接保持一致，讲稿与阶段、报价、到货、保管、销售等独立事实必须一致。
2. 本机服务必须使用 `BACKEND_MODE=preview LOCAL_PREVIEW=true`。采集脚本先验证虚构预览会话，阻止所有站外页面请求。注册、登录页面只读；演示提交只操作本机预览。外语截图通过站点语言状态切换取得，切回中文后继续相同动作。
3. 采集脚本可追加 `start`、`intake`、`follow-up`、`procurement`、`retail` 或逗号分隔的多集 ID；`public` 只重拍首页和账号页面。只重拍指定步骤可设置 `TUTORIAL_CAPTURE_FRAMES=retail-review,retail-saved`，脚本仍执行完整的前置虚构操作，仅替换这些截图。不要同时运行多个采集进程，它们共享截图索引。
4. `prepare-audio.mjs` 接受 `all` 或单个语言代码，逐句测量配音并转为 48 kHz 单声道 PCM。补齐与裁切按采样数执行，时长与 24 fps 帧边界一致。讲稿没变时直接使用私有缓存。
5. `render.mjs [all|zh-CN|it|en] [可选分集ID]` 输出 H.264/AAC、1280×960、24 fps、AAC 96 kb/s 与前置 MP4 索引。视频段落只编码画面，最后一次合并编码音轨；字幕、步骤跳转和目录时长使用同一份实测结果。截图和生成参数变化会使该段缓存失效。
6. `verify.mjs` 验证全部视频完整解码、编码格式、声轨、尺寸、帧率、faststart、逐句 PCM 时长、字幕文字和时码、六个章节时码及封面尺寸。每集每步从成片提取两个鼠标运动帧，对不含字幕的画面区域比较；同时生成首步四帧联系图，供人工核对鼠标落点与字幕。

`scripts/tutorials/.work/` 保存私有截图、音频、合成中间帧、测量和验证证据，已被忽略。验证汇总是 `.work/evidence/verification.json`，各集运动联系图为 `*-motion-sheet.png`；这些文件不能作为网页依赖或一起发布。全量验证通过时另生成可提交的 `assets-manifest.json`，记录 45 个公共文件的路径、字节数、SHA-256，以及 15 集的时长、语音、章节和验证结果，便于鉴别产物版本。网站播放只使用 `public/tutorials` 下的 MP4、WebP、VTT，以及生成的 `lib/tutorials.ts`。完成后仍需运行播放器和语言切换的浏览器回归；媒体解码检查不替代页面交互测试。

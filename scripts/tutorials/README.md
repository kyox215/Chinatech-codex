# 首页视频教程

网站直接读取 `public/tutorials/` 中的 MP4、WebP 封面与 VTT 字幕，以及 `lib/tutorials.ts` 的分集和章节目录。构建与播放不调用语音服务。

当前 5 集使用真实页面截图与虚构演示资料，配音为 `zh-CN-XiaoxiaoNeural`，语速 `+5%`。画面自带中文字幕，另附可由播放器开启的字幕轨。

修改或重新生成：

1. 修改 `scripts/tutorials/storyboard.json` 中的标题、说明和讲稿。先核对当前真实业务及界面，勿承诺未实现的能力。
2. 使用项目要求的 Node 24，安装项目依赖和 Playwright Chromium。在 3121 或 3123 启动 `BACKEND_MODE=preview LOCAL_PREVIEW=true` 的本地预览，不连接生产后台。
3. 执行 `TUTORIAL_CAPTURE_ORIGIN=http://127.0.0.1:3123 node scripts/tutorials/capture.mjs`。脚本检查本地虚构预览会话，截图及位置标记存入 `.local/tutorials/`；公开注册／登录画面只读，禁止向外部发起变更请求。可追加分集 ID 单独重拍。
4. 准备本机 `ffmpeg`、`ffprobe` 和 `.local/tutorials/tts-env/bin/python`；在该独立 Python 虚拟环境安装 `edge-tts`。该工具只在作者生成配音时联网发送公开讲稿，不需要应用密钥，勿加入客户或内部资料。
5. 执行 `node scripts/tutorials/render.mjs`。可追加分集 ID 单独生成；所有分集存在测量结果时才更新目录。脚本按每段实测配音长度生成字幕和章节，输出 H.264/AAC、1280×960、15fps，并前置 MP4 索引。
6. 核对新视频、字幕与步骤，运行教程浏览器回归及项目必要检查；只提交公共媒体、目录和本目录源文件，勿提交 `.local`、Python 环境或任何账号资料。

当前每集约 64–71 秒、1.1–1.3 MB。首页只显示一个播放器，用户点击播放或章节时才加载 MP4；选集或离开页面会停止并释放旧媒体。

# Office 教程与微信推广

公开 `/toolbox/office` 的四种操作各提供中文、意大利语、英语，共12支1920×1080视频、12份VTT和12张WebP。独立 `lib/office-tutorials.ts` 使用原Tutorial类型；首页目录与资产保持原样。另制作中文1080×1920微信推广片、JPEG封面、二维码和推广文字，推广片仅供微信交付。

视频从当前本机公开页面采集，记录真实DOM目标与操作后状态。复制采集使用内存Clipboard替身并逐字核对当前页面命令，不改用户剪贴板；页面选择／复制／下载不执行Office命令。Windows终端是明确标注的代码绘制示意，省略命令本体，不展示虚构成功，不安装／激活／卸载Office。讲稿保留有效授权、保存与备份、配置／网络失败时停止及实际输出核对。

制作沿用项目现有Node24、Playwright、Sharp、FFmpeg、FFprobe及私有Python的Edge TTS。中文Xiaoxiao+5%、意大利语Elsa+3%、英语Jenny+2%；仅发送公开讲稿，不使用应用密钥或付费API。二维码由私有制作环境的qrcode8.2生成，使用既有ZXing实际解码原图、视频末帧和JPEG封面，不新增网站依赖。

在本项目隔离候选中执行，先确认3147端口归属并启动无正式凭据的预览。Python路径必须显式指向本项目的私有制作环境，不使用authoring旧模块的兄弟目录回退。

```sh
OFFICE_TTS_PYTHON=/本项目/.local/tutorials/tts-env/bin/python node scripts/office-tutorials/author.mjs audio
node scripts/office-tutorials/capture.mjs
node scripts/office-tutorials/render.mjs
node scripts/office-tutorials/verify.mjs
```

捕获脚本只接受 `http://127.0.0.1:3147` 或本项目隔离验证端口3159，阻止站外请求。命令生成使用无害合成网关与固定测试签名密钥，不读取服务器环境或调用真实网关；截图复制逐字核对合成启动器且从不执行。按顺序采集，不同时修改UI或运行另一采集任务；完整捕获后再渲染。语音缓存按voice／rate／实际朗读文本存储，画面按截图、目标、字幕、滤镜和编码参数校验缓存。最终封装重建固定24fps时间戳，避免分段concat四舍五入形成可变帧率；完整成片先私有写入并校验时长，再替换公共文件。

私有截图、音频、中间段及微信交付源在 `.local/office-videos/`，不发布或提交。公共36资产仅位于 `public/tutorials/office/`；`assets-manifest.json`冻结路径、字节、SHA256、章节／语音／目标及示意来源。媒体校验检查13成片的全解码、24fps、H.264／AAC、非静音声轨、faststart、大小、时长、字幕和78鼠标步骤；浏览器另验12真实播放／章节／语言清理／失败重试，不能用媒体解码冒充页面交互。

推广文件是交付给用户自行发送的素材；制作及发布不代表已经发微信，也不证明Windows真机执行结果。
